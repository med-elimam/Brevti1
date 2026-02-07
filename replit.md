# Brevti - Brevet Study Companion App

## Overview

Brevti (بريفتي) is a Mauritanian exam preparation mobile application built for the Concours d'entrée au lycée (Abreivah/Brevet exam). The app provides a study companion with features including personalized study plans, focus timer, lessons, exercises, quizzes, mock exams, and analytics tracking. The UI is fully Arabic with RTL support.

## Recent Changes (Feb 2026)

- **Branding Update**: Custom branding assets in `assets/branding/` (icon, adaptive-icon, favicon, splash, splash-square). app.json updated with new paths, scheme `brevti`, bundle ID `com.brevti.app`
- **In-App Splash Screen**: Animated splash overlay in `_layout.tsx` using react-native-reanimated. Shows branding logo with scale-in + fade-out animation (~1.8s) before revealing main app
- **API URL Consolidation**: Unified to `EXPO_PUBLIC_API_BASE_URL` (replaces old `EXPO_PUBLIC_API_URL`). Falls back to `EXPO_PUBLIC_DOMAIN` then `window.location.origin` then `localhost:5000`
- **Deployment**: VM mode with `server:build` (esbuild) + `expo:static:build` for production. Server starts with two-phase initialization (health endpoints available immediately)
- **Data Persistence Fix**: SQLite DB and uploads survive restarts via VM deployment
- **Subject Language Policy**: Each subject has `primary_language` (ar|fr) and `terms_language` (fr|null). AI prompts auto-adapt per subject
- **Server-First Architecture**: All content served from Express backend API
- **Admin CMS**: Production-ready admin panel with visual block editor, AI-powered content generation, file uploads, question bank, exam builder
- **Dual Data Architecture**:
  - Server (better-sqlite3): Subjects, lessons, questions, exams, sources (content data)
  - Local SQLite (expo-sqlite): Settings, study sessions, attempts (user-specific data)

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React Native with Expo SDK 54
- **Navigation**: expo-router with file-based routing and typed routes
- **State Management**: React Context (AppContext) for global app state, TanStack React Query for server state
- **UI**: Custom components with Arabic RTL layout, expo-linear-gradient for styling
- **Fonts**: Cairo Arabic font family (@expo-google-fonts/cairo)
- **Data Flow**: AppContext fetches subjects from `/api/subjects`, quiz/mock screens fetch questions/exams from server API

### Backend Architecture
- **Server**: Express.js (Node.js) running on port 5000
- **API Pattern**: RESTful endpoints prefixed with `/api`
- **Admin Auth**: ADMIN_TOKEN header for `/api/admin/*` endpoints
- **File Processing**: Multer for PDF uploads, pdf-parse for text extraction
- **AI Integration**: OpenAI API via Replit AI Integrations (fallback to OPENAI_API_KEY)

### Public API Endpoints (Mobile App)
- `GET /api/subjects` - All subjects with lesson_count and question_count
- `GET /api/lessons?subject_id=X` - Published lessons for a subject
- `GET /api/lesson/:id` - Lesson detail with content blocks
- `GET /api/questions?subject_id=X&difficulty=Y&lesson_id=Z` - Questions with filters
- `GET /api/exams?subject_id=X` - Exams for a subject
- `GET /api/exam/:id` - Exam detail with questions

### Admin API Endpoints
- `GET /api/admin/verify` - Verify admin token
- CRUD for subjects, lessons, questions, exams, sources
- AI content generation, file uploads

### Data Storage
- **Server Database**: SQLite (better-sqlite3) at `./data/app.db` - content data
- **Local Database**: expo-sqlite - user settings, study sessions, attempts
- **Server Schema Fields**:
  - Subjects: `id`, `key`, `name_ar`, `color`, `icon`, `order_index`, `is_active`
  - Lessons: `id`, `subject_id`, `title_ar`, `content_blocks_json`, `status` (draft/published)
  - Questions: `id`, `subject_id`, `lesson_id`, `difficulty`, `qtype`, `statement_md`, `options_json`, `correct_answer_json`, `solution_md`
  - Exams: `id`, `subject_id`, `title_ar`, `year`, `duration_minutes`

### Key Design Patterns
- **Server-First Content**: All educational content stored and served from Express backend
- **Local User Data**: Settings, study sessions, and attempts stored in local SQLite
- **Admin CMS**: Visual block editor (6 block types), checkbox-based question/exam assignment, AI tools with pickers
- **Focus Timer**: Configurable work/break sessions with haptic feedback (جلسة تركيز)

### Screen Routes
- `/onboarding` - Initial setup (exam date, daily goal, focus timer settings)
- `/(tabs)` - Main tab navigation (Dashboard, Plan, Subjects, Exercises, Analytics)
- `/timer` - Focus timer
- `/quiz?subjectId=X&difficulty=Y` - Practice exercises from server questions
- `/mock?examId=X` - Full mock exam simulation from server exams
- `/subjects/[id]` - Subject detail with lessons
- `/lessons/[id]` - Lesson detail view
- `/settings` - App configuration
- `/admin` - Admin CMS panel

## External Dependencies

### Third-Party Services
- **Replit AI Integrations**: Primary AI provider (OpenAI-compatible, no personal API key needed)
- **OpenAI API**: Fallback AI provider (requires `OPENAI_API_KEY` environment variable)

### Key NPM Packages
- `expo` ~54.0.27 - Core Expo framework
- `expo-router` ~6.0.22 - File-based navigation
- `expo-sqlite` ^16.0.10 - Local SQLite database
- `openai` - OpenAI API client (used via Replit AI Integrations)
- `better-sqlite3` - Server-side SQLite
- `pdf-parse` - PDF text extraction
- `multer` - File uploads

### Environment Variables Required
- `AI_INTEGRATIONS_OPENAI_API_KEY` - Auto-set by Replit AI Integrations
- `AI_INTEGRATIONS_OPENAI_BASE_URL` - Auto-set by Replit AI Integrations
- `OPENAI_API_KEY` - Fallback OpenAI API key
- `ADMIN_TOKEN` - Token for accessing admin panel and editing content
- `EXPO_PUBLIC_API_BASE_URL` - API base URL for mobile app (optional, auto-detected on Replit)
- `EXPO_PUBLIC_DOMAIN` - Public domain fallback (auto-set by Replit)
- `DB_PATH` - Custom SQLite DB path (optional, default: `./data/app.db`)
- `UPLOADS_DIR` - Custom uploads directory (optional, default: `./uploads`)

## Admin Panel Usage

1. Go to Settings > "لوحة الإدارة" (Admin Panel)
2. Enter ADMIN_TOKEN to authenticate
3. Manage subjects, lessons, questions, exams, and sources
4. Use AI tools to generate content (requires sources assigned to lessons)
5. Publish lessons to make them visible in the mobile app
