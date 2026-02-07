import express from "express";
import http from "http";
import path from "path";
import fs from "fs";

const startTime = Date.now();
const log = (...args: unknown[]) => console.log(`[+${Date.now() - startTime}ms]`, ...args);

const port = parseInt(process.env.PORT || "5000", 10);

const app = express();

//app.get("/", (_req, res) => {
  //res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
  //res.end("ok");
//});

app.get("/health", (_req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
  res.end("ok");
});

app.get("/healthz", (_req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
  res.end("ok");
});

app.get("/ready", (_req, res) => {
  const body = JSON.stringify({
    ok: true,
    uptime_ms: Date.now() - startTime,
    ts: new Date().toISOString(),
  });
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(body);
});

log("Health routes registered");

app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  const origin = req.header("origin");
  res.header("Access-Control-Allow-Origin", origin || "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, X-Admin-Token, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

if (process.env.NODE_ENV !== "production") {
  try {
    const { createProxyMiddleware } = require("http-proxy-middleware");
    const metroProxy = createProxyMiddleware({
      target: "http://localhost:8081",
      changeOrigin: true,
      ws: true,
    });
    app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      const isMetroRequest =
        req.path.endsWith(".bundle") ||
        req.path.startsWith("/symbolicate") ||
        req.path.startsWith("/logs") ||
        req.path.startsWith("/hot") ||
        req.path.startsWith("/message") ||
        req.path.startsWith("/status") ||
        req.path.startsWith("/inspector") ||
        req.path.startsWith("/node_modules");
      if (isMetroRequest) {
        return metroProxy(req, res, next);
      }
      next();
    });
    log("Metro proxy enabled for development");
  } catch {}
}

app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  const start = Date.now();
  const reqPath = req.path;
  let capturedJsonResponse: Record<string, unknown> | undefined = undefined;
  const originalResJson = res.json;
  res.json = function (bodyJson: any) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson]);
  };
  res.on("finish", () => {
    if (!reqPath.startsWith("/api")) return;
    const duration = Date.now() - start;
    let logLine = `${req.method} ${reqPath} ${res.statusCode} in ${duration}ms`;
    if (capturedJsonResponse) {
      logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
    }
    if (logLine.length > 80) {
      logLine = logLine.slice(0, 79) + "…";
    }
    console.log(logLine);
  });
  next();
});

log("Middleware registered");

function getAppName(): string {
  try {
    const appJsonPath = path.resolve(process.cwd(), "app.json");
    const appJsonContent = fs.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}

function serveStaticManifest(platform: string, res: express.Response): boolean {
  const manifestPath = path.resolve(process.cwd(), "static-build", platform, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    return false;
  }
  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");
  res.setHeader("Cache-Control", "no-cache");
  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
  return true;
}

async function serveExpoManifest(platform: string, req: express.Request, res: express.Response) {
  if (process.env.NODE_ENV === "production") {
    if (!serveStaticManifest(platform, res)) {
      return res.status(404).json({ error: `Manifest not found for platform: ${platform}` });
    }
    return;
  }
  try {
    await new Promise<void>((resolve, reject) => {
      const metroReq = http.request(
        {
          hostname: "localhost",
          port: 8081,
          path: req.originalUrl || "/",
          method: req.method,
          headers: { ...req.headers, host: "localhost:8081" },
        },
        (metroRes) => {
          Object.entries(metroRes.headers).forEach(([key, value]) => {
            if (value) res.setHeader(key, value);
          });
          res.status(metroRes.statusCode || 200);
          metroRes.pipe(res);
          resolve();
        },
      );
      metroReq.on("error", (err) => reject(err));
      req.pipe(metroReq);
    });
  } catch (err) {
    log("Metro not available, trying static manifest...");
    if (!serveStaticManifest(platform, res)) {
      return res.status(502).json({ error: "Metro bundler not available and no static build found" });
    }
  }
}

function serveLandingPage({ req, res, landingPageTemplate, appName }: { req: express.Request; res: express.Response; landingPageTemplate: string; appName: string }) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;
  const html = landingPageTemplate
    .replace(/BASE_URL_PLACEHOLDER/g, baseUrl)
    .replace(/EXPS_URL_PLACEHOLDER/g, expsUrl)
    .replace(/APP_NAME_PLACEHOLDER/g, appName);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}

let landingPageTemplate = "";
try {
  const templatePath = path.resolve(process.cwd(), "server", "templates", "landing-page.html");
  landingPageTemplate = fs.readFileSync(templatePath, "utf-8");
} catch {
  landingPageTemplate = "<html><body><h1>App</h1></body></html>";
}
const appName = getAppName();

log("Serving static Expo files with dynamic manifest routing");

app.get("/landing", (req: express.Request, res: express.Response) => {
  return serveLandingPage({ req, res, landingPageTemplate, appName });
});

app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.path !== "/manifest") {
    return next();
  }
  const platform = req.header("expo-platform");
  if (platform && (platform === "ios" || platform === "android")) {
    return serveExpoManifest(platform, req, res);
  }
  next();
});

app.use("/assets", express.static(path.resolve(process.cwd(), "assets")));
app.use(express.static(path.resolve(process.cwd(), "static-build")));

log("Expo routing configured");

const { registerRoutes } = require("./routes");
registerRoutes(app);

log("API routes registered");
// SPA fallback: serve Expo Web for any non-API route
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) return next();

  const indexPath = path.resolve(process.cwd(), "static-build", "index.html");
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }

  return res.status(404).send("static-build/index.html not found");
});


app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  const error = err as { status?: number; statusCode?: number; message?: string };
  const status = error.status || error.statusCode || 500;
  const message = error.message || "Internal Server Error";
  console.error("Internal Server Error:", err);
  if (res.headersSent) {
    return next(err);
  }
  return res.status(status).json({ message });
});

log("All initialization complete, starting listener");

app.listen(port, "0.0.0.0", () => {
  log(`Server listening on port ${port}`);

  setImmediate(() => {
    try {
      const { seedDatabase } = require("./db/seed");
      seedDatabase();
      log("Database seeded successfully");
    } catch (err) {
      console.error("Database seeding error (non-fatal):", err);
    }
  });
});
