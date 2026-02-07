import express from "express";
import type { Express, Request, Response } from "express";
import multer from "multer";
import pdfParse from "pdf-parse";
import OpenAI from "openai";
import path from "path";
import fs from "fs";
import * as crypto from "crypto";
import {
  getDbForHealth,
  dbPath,
  getAllSubjects,
  getActiveSubjects,
  getSubjectById,
  getSubjectByKey,
  createSubject,
  updateSubject,
  deleteSubject,
  type Subject,
  getLessonsBySubject,
  getLessonById,
  createLesson,
  updateLesson,
  deleteLesson,
  getLessonCountBySubject,
  getSourcesBySubject,
  getSourcesByLesson,
  getSourceById,
  createSource,
  updateSource,
  deleteSource,
  getQuestions,
  getQuestionById,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  getQuestionCountBySubject,
  getExamsBySubject,
  getExamById,
  createExam,
  updateExam,
  deleteExam,
  getExamQuestions,
  setExamQuestions,
  getSubjectsWithCounts,
} from "./db/database";

const uploadsDir = process.env.UPLOADS_DIR || path.resolve(process.cwd(), "uploads");

const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = crypto.randomBytes(12).toString("hex") + ext;
    cb(null, name);
  },
});

const upload = multer({
  storage: diskStorage,
  limits: { fileSize: 25 * 1024 * 1024 },
});

const memUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

function normalizeText(input: string): string {
  return input.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function verifyAdminToken(req: Request): boolean {
  const token = req.headers["x-admin-token"] || req.headers["authorization"];
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) return true;
  return token === adminToken || token === `Bearer ${adminToken}`;
}

function getSubjectLanguagePrompt(subject: Subject): string {
  if (subject.primary_language === 'fr') {
    return `LANGUE: Écris en français simple et clair, adapté au niveau du brevet.
- Phrases courtes, orientées examen.
- Utilise LaTeX pour les formules: $...$ en ligne, $$ ... $$ en bloc.`;
  }

  if (subject.terms_language === 'fr') {
    return `اللغة: اكتب الشرح بالعربية البسيطة.
- أبقِ المصطلحات العلمية بالفرنسية كما هي (لا تترجمها).
- عند تقديم مصطلح لأول مرة: الشرح بالعربية + (المصطلح بالفرنسية).
  مثال: الانكسار (Réfraction)، العدسة (Lentille)، البؤرة (Foyer)
- اجعل النص قصيراً ومركزاً على الامتحان فقط.
- استخدم LaTeX للصيغ: $...$ سطري، $$ ... $$ مستقل.`;
  }

  return `اللغة: اكتب بالعربية فقط.
- جمل قصيرة وواضحة.
- محتوى مركز على الامتحان.
- استخدم LaTeX للصيغ الرياضية إن وجدت.`;
}

function getLanguageModeLabel(subject: Subject): { mode: string; label_ar: string } {
  if (subject.primary_language === 'fr') {
    return { mode: 'fr_only', label_ar: 'فرنسية فقط' };
  }
  if (subject.terms_language === 'fr') {
    return { mode: 'ar_fr_terms', label_ar: 'عربية + مصطلحات فرنسية' };
  }
  return { mode: 'ar_only', label_ar: 'عربية فقط' };
}

function getOpenAIClient(): { client: OpenAI; model: string } {
  const aiApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  const aiBaseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  if (!aiApiKey) throw new Error("Missing OpenAI API key");
  const model = aiBaseUrl ? "gpt-4.1-nano" : (process.env.OPENAI_MODEL || "gpt-4.1-mini");
  const client = aiBaseUrl
    ? new OpenAI({ apiKey: aiApiKey, baseURL: aiBaseUrl })
    : new OpenAI({ apiKey: aiApiKey });
  return { client, model };
}

export function registerRoutes(app: Express): void {
  app.use("/uploads", (req, res, next) => {
    res.setHeader("Cache-Control", "public, max-age=31536000");
    next();
  }, express.static(uploadsDir));

  // ─── HEALTH ─────────────────────────────────────────
  app.get("/api/health", (_req, res) => {
    try {
      const counts = getDbForHealth().prepare(`
        SELECT
          (SELECT COUNT(*) FROM subjects) as subjects,
          (SELECT COUNT(*) FROM lessons) as lessons,
          (SELECT COUNT(*) FROM sources) as sources,
          (SELECT COUNT(*) FROM questions) as questions,
          (SELECT COUNT(*) FROM exams) as exams
      `).get() as Record<string, number>;

      res.json({
        ok: true,
        db_path: dbPath,
        db_exists: fs.existsSync(dbPath),
        db_size_bytes: fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0,
        counts,
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // ─── ADMIN VERIFY ───────────────────────────────────
  app.get("/api/admin/verify", (req, res) => {
    if (!verifyAdminToken(req)) return res.status(401).json({ valid: false });
    return res.json({ valid: true });
  });

  app.get("/api/admin/subject-language-mode/:id", (req, res) => {
    if (!verifyAdminToken(req)) return res.status(401).json({ message: "غير مصرح" });
    const subject = getSubjectById(parseInt(req.params.id, 10));
    if (!subject) return res.status(404).json({ message: "غير موجود" });
    return res.json(getLanguageModeLabel(subject));
  });

  // ═══════════════════════════════════════════════════
  //  PUBLIC ENDPOINTS (mobile app)
  // ═══════════════════════════════════════════════════

  app.get("/api/subjects", (_req, res) => {
    try {
      const subjects = getSubjectsWithCounts();
      return res.json(subjects);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "فشل تحميل المواد" });
    }
  });

  app.get("/api/lessons", (req, res) => {
    try {
      const { subject_id } = req.query;
      if (!subject_id) return res.status(400).json({ message: "subject_id مطلوب" });
      const sid = parseInt(subject_id as string, 10);
      const lessons = getLessonsBySubject(sid).filter(l => l.status === "published");
      return res.json(lessons);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "فشل تحميل الدروس" });
    }
  });

  app.get("/api/lesson/:id", (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "معرف غير صالح" });
      const lesson = getLessonById(id);
      if (!lesson) return res.status(404).json({ message: "الدرس غير موجود" });
      return res.json(lesson);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "فشل تحميل الدرس" });
    }
  });

  app.get("/api/questions", (req, res) => {
    try {
      const { subject_id, lesson_id, difficulty, qtype } = req.query;
      const filters: any = {};
      if (subject_id) filters.subject_id = parseInt(subject_id as string, 10);
      if (lesson_id) filters.lesson_id = parseInt(lesson_id as string, 10);
      if (difficulty) filters.difficulty = difficulty as string;
      if (qtype) filters.qtype = qtype as string;
      return res.json(getQuestions(filters));
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "فشل تحميل الأسئلة" });
    }
  });

  app.get("/api/exams", (req, res) => {
    try {
      const { subject_id } = req.query;
      if (!subject_id) return res.status(400).json({ message: "subject_id مطلوب" });
      return res.json(getExamsBySubject(parseInt(subject_id as string, 10)));
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "فشل تحميل الامتحانات" });
    }
  });

  app.get("/api/exam/:id", (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "معرف غير صالح" });
      const exam = getExamById(id);
      if (!exam) return res.status(404).json({ message: "الامتحان غير موجود" });
      const questions = getExamQuestions(id);
      return res.json({ ...exam, questions });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "فشل" });
    }
  });

  // ═══════════════════════════════════════════════════
  //  ADMIN CRUD ENDPOINTS
  // ═══════════════════════════════════════════════════

  // ─── SUBJECTS CRUD ──────────────────────────────────

  app.get("/api/admin/subjects", (req, res) => {
    if (!verifyAdminToken(req)) return res.status(401).json({ message: "غير مصرح" });
    return res.json(getAllSubjects());
  });

  app.post("/api/admin/subjects", (req, res) => {
    if (!verifyAdminToken(req)) return res.status(401).json({ message: "غير مصرح" });
    try {
      const { key, name_ar, color, icon, order_index } = req.body;
      if (!key || !name_ar) return res.status(400).json({ message: "key و name_ar مطلوبان" });
      const id = createSubject({ key, name_ar, color, icon, order_index });
      return res.json({ id, message: "تم إنشاء المادة" });
    } catch (err: any) {
      if (err.message?.includes("UNIQUE")) return res.status(409).json({ message: "المفتاح موجود مسبقاً" });
      console.error(err);
      return res.status(500).json({ message: "فشل" });
    }
  });

  app.put("/api/admin/subjects/:id", (req, res) => {
    if (!verifyAdminToken(req)) return res.status(401).json({ message: "غير مصرح" });
    try {
      const id = parseInt(req.params.id, 10);
      const ok = updateSubject(id, req.body);
      if (!ok) return res.status(404).json({ message: "غير موجود" });
      return res.json({ message: "تم التحديث" });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "فشل" });
    }
  });

  app.delete("/api/admin/subjects/:id", (req, res) => {
    if (!verifyAdminToken(req)) return res.status(401).json({ message: "غير مصرح" });
    const ok = deleteSubject(parseInt(req.params.id, 10));
    if (!ok) return res.status(404).json({ message: "غير موجود" });
    return res.json({ message: "تم الحذف" });
  });

  // ─── LESSONS CRUD ───────────────────────────────────

  app.get("/api/admin/lessons", (req, res) => {
    if (!verifyAdminToken(req)) return res.status(401).json({ message: "غير مصرح" });
    const { subject_id } = req.query;
    if (!subject_id) return res.status(400).json({ message: "subject_id مطلوب" });
    return res.json(getLessonsBySubject(parseInt(subject_id as string, 10)));
  });

  app.get("/api/admin/lessons/:id", (req, res) => {
    if (!verifyAdminToken(req)) return res.status(401).json({ message: "غير مصرح" });
    const lesson = getLessonById(parseInt(req.params.id, 10));
    if (!lesson) return res.status(404).json({ message: "غير موجود" });
    return res.json(lesson);
  });

  app.post("/api/admin/lessons", (req, res) => {
    if (!verifyAdminToken(req)) return res.status(401).json({ message: "غير مصرح" });
    try {
      const { subject_id, title_ar, order_index, status, content_blocks_json, summary_ar } = req.body;
      if (!subject_id || !title_ar) return res.status(400).json({ message: "subject_id و title_ar مطلوبان" });
      const id = createLesson({ subject_id, title_ar, order_index, status, content_blocks_json, summary_ar });
      return res.json({ id, message: "تم إنشاء الدرس" });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "فشل" });
    }
  });

  app.put("/api/admin/lessons/:id", (req, res) => {
    if (!verifyAdminToken(req)) return res.status(401).json({ message: "غير مصرح" });
    try {
      const id = parseInt(req.params.id, 10);
      const ok = updateLesson(id, req.body);
      if (!ok) return res.status(404).json({ message: "غير موجود" });
      return res.json({ message: "تم التحديث" });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "فشل" });
    }
  });

  app.delete("/api/admin/lessons/:id", (req, res) => {
    if (!verifyAdminToken(req)) return res.status(401).json({ message: "غير مصرح" });
    const ok = deleteLesson(parseInt(req.params.id, 10));
    if (!ok) return res.status(404).json({ message: "غير موجود" });
    return res.json({ message: "تم الحذف" });
  });

  // ─── SOURCES CRUD ───────────────────────────────────

  app.get("/api/admin/sources", (req, res) => {
    if (!verifyAdminToken(req)) return res.status(401).json({ message: "غير مصرح" });
    const { subject_id, lesson_id } = req.query;
    if (lesson_id) return res.json(getSourcesByLesson(parseInt(lesson_id as string, 10)));
    if (subject_id) return res.json(getSourcesBySubject(parseInt(subject_id as string, 10)));
    return res.status(400).json({ message: "subject_id أو lesson_id مطلوب" });
  });

  app.post("/api/admin/sources/upload", upload.single("file"), async (req, res) => {
    if (!verifyAdminToken(req)) return res.status(401).json({ message: "غير مصرح" });
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ message: "ملف مطلوب" });

      const { subject_id, lesson_id } = req.body;
      if (!subject_id) return res.status(400).json({ message: "subject_id مطلوب" });

      const isPdf = file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf");
      const isImage = file.mimetype.startsWith("image/");
      const fileType = isPdf ? "pdf" : isImage ? "image" : "text";

      let extractedText = "";
      if (isPdf) {
        try {
          const buffer = fs.readFileSync(file.path);
          const data = await pdfParse(buffer);
          extractedText = normalizeText(data.text || "");
        } catch (e) {
          console.error("PDF extraction failed:", e);
        }
      }

      const id = createSource({
        subject_id: parseInt(subject_id, 10),
        lesson_id: lesson_id ? parseInt(lesson_id, 10) : null,
        type: fileType,
        filename: file.filename,
        original_name: file.originalname,
        mime: file.mimetype,
        size: file.size,
        storage_path: `/uploads/${file.filename}`,
        extracted_text: extractedText,
      });

      return res.json({ id, message: "تم رفع الملف", extracted_text_length: extractedText.length });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "فشل رفع الملف" });
    }
  });

  app.put("/api/admin/sources/:id", (req, res) => {
    if (!verifyAdminToken(req)) return res.status(401).json({ message: "غير مصرح" });
    try {
      const id = parseInt(req.params.id, 10);
      const ok = updateSource(id, req.body);
      if (!ok) return res.status(404).json({ message: "غير موجود" });
      return res.json({ message: "تم التحديث" });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "فشل" });
    }
  });

  app.delete("/api/admin/sources/:id", (req, res) => {
    if (!verifyAdminToken(req)) return res.status(401).json({ message: "غير مصرح" });
    try {
      const source = getSourceById(parseInt(req.params.id, 10));
      if (!source) return res.status(404).json({ message: "غير موجود" });
      if (source.filename) {
        const filePath = path.join(uploadsDir, source.filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
      deleteSource(source.id);
      return res.json({ message: "تم الحذف" });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "فشل" });
    }
  });

  // ─── QUESTIONS CRUD ─────────────────────────────────

  app.get("/api/admin/questions", (req, res) => {
    if (!verifyAdminToken(req)) return res.status(401).json({ message: "غير مصرح" });
    const { subject_id, lesson_id, difficulty, qtype } = req.query;
    const filters: any = {};
    if (subject_id) filters.subject_id = parseInt(subject_id as string, 10);
    if (lesson_id) filters.lesson_id = parseInt(lesson_id as string, 10);
    if (difficulty) filters.difficulty = difficulty;
    if (qtype) filters.qtype = qtype;
    return res.json(getQuestions(filters));
  });

  app.post("/api/admin/questions", (req, res) => {
    if (!verifyAdminToken(req)) return res.status(401).json({ message: "غير مصرح" });
    try {
      const { subject_id, lesson_id, difficulty, qtype, statement_md, options_json, correct_answer_json, solution_md, tags_json, source_ids_json } = req.body;
      if (!subject_id || !statement_md) return res.status(400).json({ message: "subject_id و statement_md مطلوبان" });
      const id = createQuestion({
        subject_id, lesson_id, difficulty: difficulty || "medium", qtype: qtype || "mcq",
        statement_md, options_json, correct_answer_json, solution_md, tags_json, source_ids_json,
      });
      return res.json({ id, message: "تم إنشاء السؤال" });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "فشل" });
    }
  });

  app.put("/api/admin/questions/:id", (req, res) => {
    if (!verifyAdminToken(req)) return res.status(401).json({ message: "غير مصرح" });
    try {
      const id = parseInt(req.params.id, 10);
      const ok = updateQuestion(id, req.body);
      if (!ok) return res.status(404).json({ message: "غير موجود" });
      return res.json({ message: "تم التحديث" });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "فشل" });
    }
  });

  app.delete("/api/admin/questions/:id", (req, res) => {
    if (!verifyAdminToken(req)) return res.status(401).json({ message: "غير مصرح" });
    const ok = deleteQuestion(parseInt(req.params.id, 10));
    if (!ok) return res.status(404).json({ message: "غير موجود" });
    return res.json({ message: "تم الحذف" });
  });

  // ─── EXAMS CRUD ─────────────────────────────────────

  app.get("/api/admin/exams", (req, res) => {
    if (!verifyAdminToken(req)) return res.status(401).json({ message: "غير مصرح" });
    const { subject_id } = req.query;
    if (!subject_id) return res.status(400).json({ message: "subject_id مطلوب" });
    return res.json(getExamsBySubject(parseInt(subject_id as string, 10)));
  });

  app.post("/api/admin/exams", (req, res) => {
    if (!verifyAdminToken(req)) return res.status(401).json({ message: "غير مصرح" });
    try {
      const { subject_id, title_ar, year, duration_minutes, structure_json } = req.body;
      if (!subject_id || !title_ar) return res.status(400).json({ message: "subject_id و title_ar مطلوبان" });
      const id = createExam({ subject_id, title_ar, year, duration_minutes, structure_json });
      return res.json({ id, message: "تم إنشاء الامتحان" });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "فشل" });
    }
  });

  app.put("/api/admin/exams/:id", (req, res) => {
    if (!verifyAdminToken(req)) return res.status(401).json({ message: "غير مصرح" });
    try {
      const id = parseInt(req.params.id, 10);
      const ok = updateExam(id, req.body);
      if (!ok) return res.status(404).json({ message: "غير موجود" });
      return res.json({ message: "تم التحديث" });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "فشل" });
    }
  });

  app.delete("/api/admin/exams/:id", (req, res) => {
    if (!verifyAdminToken(req)) return res.status(401).json({ message: "غير مصرح" });
    const ok = deleteExam(parseInt(req.params.id, 10));
    if (!ok) return res.status(404).json({ message: "غير موجود" });
    return res.json({ message: "تم الحذف" });
  });

  app.put("/api/admin/exams/:id/questions", (req, res) => {
    if (!verifyAdminToken(req)) return res.status(401).json({ message: "غير مصرح" });
    try {
      const id = parseInt(req.params.id, 10);
      const { question_ids } = req.body;
      if (!Array.isArray(question_ids)) return res.status(400).json({ message: "question_ids مطلوب" });
      setExamQuestions(id, question_ids);
      return res.json({ message: "تم تحديث أسئلة الامتحان" });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "فشل" });
    }
  });

  app.get("/api/admin/exams/:id/questions", (req, res) => {
    if (!verifyAdminToken(req)) return res.status(401).json({ message: "غير مصرح" });
    return res.json(getExamQuestions(parseInt(req.params.id, 10)));
  });

  // ═══════════════════════════════════════════════════
  //  AI GENERATION ENDPOINTS
  // ═══════════════════════════════════════════════════

  app.post("/api/admin/ai/generate-lesson-blocks", async (req, res) => {
    if (!verifyAdminToken(req)) return res.status(401).json({ message: "غير مصرح" });
    try {
      const { lesson_id, source_ids } = req.body;
      if (!lesson_id) return res.status(400).json({ message: "lesson_id مطلوب" });
      if (!source_ids || !Array.isArray(source_ids) || source_ids.length === 0) {
        return res.status(400).json({ message: "يجب تحديد مصدر واحد على الأقل. لا يمكن التوليد بدون مصادر." });
      }

      const lesson = getLessonById(lesson_id);
      if (!lesson) return res.status(404).json({ message: "الدرس غير موجود" });

      const subject = getSubjectById(lesson.subject_id);
      if (!subject) return res.status(404).json({ message: "المادة غير موجودة" });

      const sourceTexts: string[] = [];
      for (const sid of source_ids) {
        const src = getSourceById(sid);
        if (src && src.extracted_text) sourceTexts.push(src.extracted_text);
      }

      if (sourceTexts.join("").trim().length === 0) {
        return res.status(400).json({ message: "المصادر المحددة لا تحتوي على نص مستخرج" });
      }

      const { client, model } = getOpenAIClient();
      const langPrompt = getSubjectLanguagePrompt(subject);

      const systemPrompt = `أنت معلم خبير في التعليم الموريتاني متخصص في مادة ${subject.name_ar}.
مهمتك: أنشئ محتوى درس منظم بتنسيق JSON لدرس "${lesson.title_ar}".

${langPrompt}

يجب أن ترجع مصفوفة JSON من الكتل (blocks)، كل كتلة بالشكل:
{ "type": "heading|text|formula|example|warning|exercise", "title": "...", "content": "..." }

الأنواع المتاحة:
- heading: عنوان فرعي
- text: شرح نصي
- formula: صيغة رياضية (استخدم LaTeX بين $...$ للسطري و $$ ... $$ للمنفصل)
- example: مثال توضيحي
- warning: تحذير أو خطأ شائع
- exercise: تمرين تطبيقي مع الحل

القواعد:
1. استند فقط على المصادر المقدمة
2. أنشئ 5-15 كتلة متنوعة
3. ابدأ بعنوان ثم شرح ثم أمثلة ثم تمارين
4. لا تكتب فقرات طويلة - جمل قصيرة مركزة على الامتحان
5. أجب بـ JSON فقط (مصفوفة) بدون أي نص إضافي`;

      const response = await client.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: `المادة: ${subject.name_ar}
الدرس: ${lesson.title_ar}

المصادر:
${sourceTexts.join("\n\n---\n\n")}`,
          },
        ],
        max_tokens: 4000,
        response_format: { type: "json_object" },
      });

      let blocksStr = response.choices[0].message.content || "[]";
      let blocks: any[];
      try {
        const parsed = JSON.parse(blocksStr);
        blocks = Array.isArray(parsed) ? parsed : (parsed.blocks || parsed.content || []);
      } catch {
        blocks = [];
      }

      const blocksJson = JSON.stringify(blocks);
      updateLesson(lesson_id, { content_blocks_json: blocksJson });

      return res.json({ message: "تم توليد محتوى الدرس", blocks_count: blocks.length, blocks });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "فشل التوليد بالذكاء الاصطناعي" });
    }
  });

  app.post("/api/admin/ai/generate-questions", async (req, res) => {
    if (!verifyAdminToken(req)) return res.status(401).json({ message: "غير مصرح" });
    try {
      const { subject_id, lesson_id, source_ids, count = 5, difficulty_distribution } = req.body;
      if (!subject_id) return res.status(400).json({ message: "subject_id مطلوب" });
      if (!source_ids || !Array.isArray(source_ids) || source_ids.length === 0) {
        return res.status(400).json({ message: "يجب تحديد مصدر واحد على الأقل. لا يمكن التوليد بدون مصادر." });
      }

      const subject = getSubjectById(subject_id);
      if (!subject) return res.status(404).json({ message: "المادة غير موجودة" });

      const sourceTexts: string[] = [];
      for (const sid of source_ids) {
        const src = getSourceById(sid);
        if (src && src.extracted_text) sourceTexts.push(src.extracted_text);
      }

      if (sourceTexts.join("").trim().length === 0) {
        return res.status(400).json({ message: "المصادر لا تحتوي على نص" });
      }

      const dist = difficulty_distribution || { easy: Math.ceil(count * 0.3), medium: Math.ceil(count * 0.4), hard: count - Math.ceil(count * 0.3) - Math.ceil(count * 0.4) };

      const { client, model } = getOpenAIClient();
      const langPrompt = getSubjectLanguagePrompt(subject);

      const systemPrompt = `أنت خبير في إعداد أسئلة امتحان البريفيه الموريتاني في مادة ${subject.name_ar}.

${langPrompt}

أنشئ ${count} سؤال اختيار من متعدد (MCQ) بالتوزيع التالي:
- سهل: ${dist.easy}
- متوسط: ${dist.medium}
- صعب: ${dist.hard}

أجب بـ JSON فقط بالشكل:
{ "questions": [
  {
    "difficulty": "easy|medium|hard",
    "statement_md": "نص السؤال",
    "options": ["الخيار أ", "الخيار ب", "الخيار ج", "الخيار د"],
    "correct_index": 0,
    "solution_md": "شرح الإجابة الصحيحة"
  }
]}

القواعد:
1. استند فقط على المصادر
2. 4 خيارات لكل سؤال
3. correct_index: رقم الخيار الصحيح (0-3)
4. استخدم LaTeX للصيغ الرياضية`;

      const response = await client.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: `المادة: ${subject.name_ar}
${lesson_id ? `الدرس ID: ${lesson_id}` : ""}

المصادر:
${sourceTexts.join("\n\n---\n\n")}`,
          },
        ],
        max_tokens: 4000,
        response_format: { type: "json_object" },
      });

      let questionsData: any[];
      try {
        const parsed = JSON.parse(response.choices[0].message.content || "{}");
        questionsData = parsed.questions || [];
      } catch {
        questionsData = [];
      }

      const createdIds: number[] = [];
      for (const q of questionsData) {
        const id = createQuestion({
          subject_id,
          lesson_id: lesson_id || null,
          difficulty: q.difficulty || "medium",
          qtype: "mcq",
          statement_md: q.statement_md || "",
          options_json: JSON.stringify(q.options || []),
          correct_answer_json: JSON.stringify(q.correct_index ?? 0),
          solution_md: q.solution_md || "",
          source_ids_json: JSON.stringify(source_ids),
        });
        createdIds.push(id);
      }

      return res.json({ message: `تم توليد ${createdIds.length} سؤال`, question_ids: createdIds });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "فشل توليد الأسئلة" });
    }
  });

  app.post("/api/admin/ai/generate-exam-variant", async (req, res) => {
    if (!verifyAdminToken(req)) return res.status(401).json({ message: "غير مصرح" });
    try {
      const { exam_id, source_ids } = req.body;
      if (!exam_id) return res.status(400).json({ message: "exam_id مطلوب" });
      if (!source_ids || !Array.isArray(source_ids) || source_ids.length === 0) {
        return res.status(400).json({ message: "يجب تحديد مصادر" });
      }

      const exam = getExamById(exam_id);
      if (!exam) return res.status(404).json({ message: "الامتحان غير موجود" });

      const subject = getSubjectById(exam.subject_id);
      if (!subject) return res.status(404).json({ message: "المادة غير موجودة" });

      const origQuestions = getExamQuestions(exam_id);

      const sourceTexts: string[] = [];
      for (const sid of source_ids) {
        const src = getSourceById(sid);
        if (src && src.extracted_text) sourceTexts.push(src.extracted_text);
      }

      const { client, model } = getOpenAIClient();
      const langPrompt = getSubjectLanguagePrompt(subject);

      const existingQuestionsStr = origQuestions.map((q, i) =>
        `${i + 1}. [${q.difficulty}] ${q.statement_md}`
      ).join("\n");

      const systemPrompt = `أنت خبير في إعداد امتحانات البريفيه الموريتاني في ${subject.name_ar}.

${langPrompt}

أنشئ نسخة بديلة (variant) من الامتحان التالي بنفس الهيكل والصعوبة:

الامتحان الأصلي:
${existingQuestionsStr}

أنشئ ${origQuestions.length} سؤال MCQ بنفس توزيع الصعوبات.
أجب بـ JSON:
{ "questions": [{ "difficulty": "...", "statement_md": "...", "options": [...], "correct_index": 0, "solution_md": "..." }] }

استخدم LaTeX للصيغ.`;

      const response = await client.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: `المصادر:\n${sourceTexts.join("\n\n---\n\n")}`,
          },
        ],
        max_tokens: 4000,
        response_format: { type: "json_object" },
      });

      let questionsData: any[];
      try {
        const parsed = JSON.parse(response.choices[0].message.content || "{}");
        questionsData = parsed.questions || [];
      } catch {
        questionsData = [];
      }

      const newExamId = createExam({
        subject_id: exam.subject_id,
        title_ar: `${exam.title_ar} (نسخة بديلة)`,
        year: exam.year,
        duration_minutes: exam.duration_minutes,
        structure_json: exam.structure_json,
      });

      const qIds: number[] = [];
      for (const q of questionsData) {
        const qid = createQuestion({
          subject_id: exam.subject_id,
          difficulty: q.difficulty || "medium",
          qtype: "mcq",
          statement_md: q.statement_md || "",
          options_json: JSON.stringify(q.options || []),
          correct_answer_json: JSON.stringify(q.correct_index ?? 0),
          solution_md: q.solution_md || "",
          source_ids_json: JSON.stringify(source_ids),
        });
        qIds.push(qid);
      }

      setExamQuestions(newExamId, qIds);

      return res.json({ message: "تم إنشاء نسخة بديلة", exam_id: newExamId, question_count: qIds.length });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "فشل" });
    }
  });

  // Legacy PDF extract endpoint
  app.post("/api/pdf/extract", memUpload.single("file"), async (req, res) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ message: "Missing PDF file" });
      const mimeOk = file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf");
      if (!mimeOk) return res.status(400).json({ message: "File is not a PDF" });
      const data = await pdfParse(file.buffer);
      const text = normalizeText(data.text || "");
      if (!text) return res.status(422).json({ message: "No extractable text" });
      return res.json({ filename: file.originalname, pages: data.numpages ?? null, text });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "PDF extraction failed" });
    }
  });

}
