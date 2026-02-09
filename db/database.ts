import path from "path";
import fs from "fs";

const dbPath = process.env.DB_PATH || path.resolve(process.cwd(), "data", "app.db");
const uploadsDir = process.env.UPLOADS_DIR || path.resolve(process.cwd(), "uploads");
const dataDir = path.dirname(dbPath);

let _db: any = null;
let _initialized = false;

function ensureDirectories(): void {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(uploadsDir, { recursive: true });
}

function getDb(): any {
  if (_db) return _db;

  ensureDirectories();

  const Database = require("better-sqlite3");
  _db = new Database(dbPath);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  _db.pragma("wal_checkpoint(TRUNCATE)");

  return _db;
}

function ensureSchema(): void {
  if (_initialized) return;
  const d = getDb();

  d.exec(`
    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      name_ar TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#3498DB',
      icon TEXT NOT NULL DEFAULT 'book',
      order_index INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER NOT NULL,
      title_ar TEXT NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')),
      content_blocks_json TEXT DEFAULT '[]',
      summary_ar TEXT DEFAULT '',
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_lessons_subject ON lessons(subject_id);

    CREATE TABLE IF NOT EXISTS sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER NOT NULL,
      lesson_id INTEGER,
      type TEXT NOT NULL CHECK(type IN ('pdf','image','text')),
      filename TEXT NOT NULL DEFAULT '',
      original_name TEXT NOT NULL DEFAULT '',
      mime TEXT NOT NULL DEFAULT '',
      size INTEGER NOT NULL DEFAULT 0,
      storage_path TEXT NOT NULL DEFAULT '',
      extracted_text TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
      FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sources_subject ON sources(subject_id);
    CREATE INDEX IF NOT EXISTS idx_sources_lesson ON sources(lesson_id);

    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER NOT NULL,
      lesson_id INTEGER,
      difficulty TEXT NOT NULL DEFAULT 'medium' CHECK(difficulty IN ('easy','medium','hard')),
      qtype TEXT NOT NULL DEFAULT 'mcq' CHECK(qtype IN ('mcq','short','problem')),
      statement_md TEXT NOT NULL DEFAULT '',
      options_json TEXT DEFAULT '[]',
      correct_answer_json TEXT DEFAULT '""',
      solution_md TEXT DEFAULT '',
      tags_json TEXT DEFAULT '[]',
      source_ids_json TEXT DEFAULT '[]',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
      FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions(subject_id);
    CREATE INDEX IF NOT EXISTS idx_questions_lesson ON questions(lesson_id);
    CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(difficulty);

    CREATE TABLE IF NOT EXISTS exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER NOT NULL,
      title_ar TEXT NOT NULL DEFAULT '',
      year INTEGER,
      duration_minutes INTEGER NOT NULL DEFAULT 60,
      structure_json TEXT DEFAULT '{}',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_exams_subject ON exams(subject_id);

    CREATE TABLE IF NOT EXISTS exam_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
      FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_eq_exam ON exam_questions(exam_id);
    CREATE INDEX IF NOT EXISTS idx_eq_question ON exam_questions(question_id);
  `);

  try { d.exec(`ALTER TABLE subjects ADD COLUMN primary_language TEXT NOT NULL DEFAULT 'ar' CHECK(primary_language IN ('ar','fr'))`); } catch {}
  try { d.exec(`ALTER TABLE subjects ADD COLUMN terms_language TEXT DEFAULT NULL CHECK(terms_language IN ('fr', NULL))`); } catch {}

  d.exec(`UPDATE subjects SET primary_language='ar', terms_language='fr' WHERE key IN ('pc','math','sc')`);
  d.exec(`UPDATE subjects SET primary_language='fr', terms_language=NULL WHERE key='fr'`);
  d.exec(`UPDATE subjects SET primary_language='ar', terms_language=NULL WHERE key IN ('ar','islam','hg')`);

  _initialized = true;
}

function db(): ReturnType<typeof Database> {
  ensureSchema();
  return getDb();
}

export interface Subject {
  id: number;
  key: string;
  name_ar: string;
  color: string;
  icon: string;
  order_index: number;
  is_active: number;
  primary_language: string;
  terms_language: string | null;
}

export interface Lesson {
  id: number;
  subject_id: number;
  title_ar: string;
  order_index: number;
  status: string;
  content_blocks_json: string;
  summary_ar: string;
  updated_at: string;
}

export interface Source {
  id: number;
  subject_id: number;
  lesson_id: number | null;
  type: string;
  filename: string;
  original_name: string;
  mime: string;
  size: number;
  storage_path: string;
  extracted_text: string;
  created_at: string;
}

export interface Question {
  id: number;
  subject_id: number;
  lesson_id: number | null;
  difficulty: string;
  qtype: string;
  statement_md: string;
  options_json: string;
  correct_answer_json: string;
  solution_md: string;
  tags_json: string;
  source_ids_json: string;
  created_at: string;
}

export interface Exam {
  id: number;
  subject_id: number;
  title_ar: string;
  year: number | null;
  duration_minutes: number;
  structure_json: string;
  created_at: string;
}

export interface ExamQuestion {
  id: number;
  exam_id: number;
  question_id: number;
  order_index: number;
}

export function getAllSubjects(): Subject[] {
  return db().prepare("SELECT * FROM subjects ORDER BY order_index, id").all() as Subject[];
}

export function getActiveSubjects(): Subject[] {
  return db().prepare("SELECT * FROM subjects WHERE is_active = 1 ORDER BY order_index, id").all() as Subject[];
}

export function getSubjectById(id: number): Subject | undefined {
  return db().prepare("SELECT * FROM subjects WHERE id = ?").get(id) as Subject | undefined;
}

export function getSubjectByKey(key: string): Subject | undefined {
  return db().prepare("SELECT * FROM subjects WHERE key = ?").get(key) as Subject | undefined;
}

export function createSubject(data: { key: string; name_ar: string; color?: string; icon?: string; order_index?: number; is_active?: number; primary_language?: string; terms_language?: string | null }): number {
  const result = db().prepare(
    "INSERT INTO subjects (key, name_ar, color, icon, order_index, is_active, primary_language, terms_language) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(data.key, data.name_ar, data.color || '#3498DB', data.icon || 'book', data.order_index || 0, data.is_active ?? 1, data.primary_language || 'ar', data.terms_language ?? null);
  return result.lastInsertRowid as number;
}

export function updateSubject(id: number, data: Partial<Omit<Subject, 'id'>>): boolean {
  const fields: string[] = [];
  const values: (string | number)[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) { fields.push(`${k} = ?`); values.push(v as string | number); }
  }
  if (fields.length === 0) return false;
  values.push(id);
  return db().prepare(`UPDATE subjects SET ${fields.join(', ')} WHERE id = ?`).run(...values).changes > 0;
}

export function deleteSubject(id: number): boolean {
  return db().prepare("DELETE FROM subjects WHERE id = ?").run(id).changes > 0;
}

export function getLessonsBySubject(subjectId: number): Lesson[] {
  return db().prepare("SELECT * FROM lessons WHERE subject_id = ? ORDER BY order_index, id").all(subjectId) as Lesson[];
}

export function getLessonById(id: number): Lesson | undefined {
  return db().prepare("SELECT * FROM lessons WHERE id = ?").get(id) as Lesson | undefined;
}

export function createLesson(data: { subject_id: number; title_ar: string; order_index?: number; status?: string; content_blocks_json?: string; summary_ar?: string }): number {
  const result = db().prepare(
    "INSERT INTO lessons (subject_id, title_ar, order_index, status, content_blocks_json, summary_ar) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(data.subject_id, data.title_ar, data.order_index || 0, data.status || 'draft', data.content_blocks_json || '[]', data.summary_ar || '');
  return result.lastInsertRowid as number;
}

export function updateLesson(id: number, data: Partial<Omit<Lesson, 'id'>>): boolean {
  const fields: string[] = [];
  const values: (string | number)[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) { fields.push(`${k} = ?`); values.push(v as string | number); }
  }
  if (fields.length === 0) return false;
  fields.push("updated_at = CURRENT_TIMESTAMP");
  values.push(id);
  return db().prepare(`UPDATE lessons SET ${fields.join(', ')} WHERE id = ?`).run(...values).changes > 0;
}

export function deleteLesson(id: number): boolean {
  return db().prepare("DELETE FROM lessons WHERE id = ?").run(id).changes > 0;
}

export function getLessonCountBySubject(subjectId: number): number {
  const row = db().prepare("SELECT COUNT(*) as cnt FROM lessons WHERE subject_id = ? AND status = 'published'").get(subjectId) as { cnt: number };
  return row.cnt;
}

export function getSourcesBySubject(subjectId: number): Source[] {
  return db().prepare("SELECT * FROM sources WHERE subject_id = ? ORDER BY created_at DESC").all(subjectId) as Source[];
}

export function getSourcesByLesson(lessonId: number): Source[] {
  return db().prepare("SELECT * FROM sources WHERE lesson_id = ? ORDER BY created_at DESC").all(lessonId) as Source[];
}

export function getSourceById(id: number): Source | undefined {
  return db().prepare("SELECT * FROM sources WHERE id = ?").get(id) as Source | undefined;
}

export function createSource(data: { subject_id: number; lesson_id?: number | null; type: string; filename: string; original_name: string; mime: string; size: number; storage_path: string; extracted_text?: string }): number {
  const result = db().prepare(
    "INSERT INTO sources (subject_id, lesson_id, type, filename, original_name, mime, size, storage_path, extracted_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(data.subject_id, data.lesson_id ?? null, data.type, data.filename, data.original_name, data.mime, data.size, data.storage_path, data.extracted_text || '');
  return result.lastInsertRowid as number;
}

export function updateSource(id: number, data: Partial<Omit<Source, 'id'>>): boolean {
  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) { fields.push(`${k} = ?`); values.push(v as string | number | null); }
  }
  if (fields.length === 0) return false;
  values.push(id);
  return db().prepare(`UPDATE sources SET ${fields.join(', ')} WHERE id = ?`).run(...values).changes > 0;
}

export function deleteSource(id: number): boolean {
  return db().prepare("DELETE FROM sources WHERE id = ?").run(id).changes > 0;
}

export function getQuestions(filters: { subject_id?: number; lesson_id?: number; difficulty?: string; qtype?: string }): Question[] {
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  if (filters.subject_id) { conditions.push("subject_id = ?"); params.push(filters.subject_id); }
  if (filters.lesson_id) { conditions.push("lesson_id = ?"); params.push(filters.lesson_id); }
  if (filters.difficulty) { conditions.push("difficulty = ?"); params.push(filters.difficulty); }
  if (filters.qtype) { conditions.push("qtype = ?"); params.push(filters.qtype); }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return db().prepare(`SELECT * FROM questions ${where} ORDER BY created_at DESC`).all(...params) as Question[];
}

export function getQuestionById(id: number): Question | undefined {
  return db().prepare("SELECT * FROM questions WHERE id = ?").get(id) as Question | undefined;
}

export function createQuestion(data: { subject_id: number; lesson_id?: number | null; difficulty: string; qtype: string; statement_md: string; options_json?: string; correct_answer_json?: string; solution_md?: string; tags_json?: string; source_ids_json?: string }): number {
  const result = db().prepare(
    "INSERT INTO questions (subject_id, lesson_id, difficulty, qtype, statement_md, options_json, correct_answer_json, solution_md, tags_json, source_ids_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(data.subject_id, data.lesson_id ?? null, data.difficulty, data.qtype, data.statement_md, data.options_json || '[]', data.correct_answer_json || '""', data.solution_md || '', data.tags_json || '[]', data.source_ids_json || '[]');
  return result.lastInsertRowid as number;
}

export function updateQuestion(id: number, data: Partial<Omit<Question, 'id'>>): boolean {
  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) { fields.push(`${k} = ?`); values.push(v as string | number | null); }
  }
  if (fields.length === 0) return false;
  values.push(id);
  return db().prepare(`UPDATE questions SET ${fields.join(', ')} WHERE id = ?`).run(...values).changes > 0;
}

export function deleteQuestion(id: number): boolean {
  return db().prepare("DELETE FROM questions WHERE id = ?").run(id).changes > 0;
}

export function getQuestionCountBySubject(subjectId: number): number {
  const row = db().prepare("SELECT COUNT(*) as cnt FROM questions WHERE subject_id = ?").get(subjectId) as { cnt: number };
  return row.cnt;
}

export function getExamsBySubject(subjectId: number): Exam[] {
  return db().prepare("SELECT * FROM exams WHERE subject_id = ? ORDER BY created_at DESC").all(subjectId) as Exam[];
}

export function getExamById(id: number): Exam | undefined {
  return db().prepare("SELECT * FROM exams WHERE id = ?").get(id) as Exam | undefined;
}

export function createExam(data: { subject_id: number; title_ar: string; year?: number | null; duration_minutes?: number; structure_json?: string }): number {
  const result = db().prepare(
    "INSERT INTO exams (subject_id, title_ar, year, duration_minutes, structure_json) VALUES (?, ?, ?, ?, ?)"
  ).run(data.subject_id, data.title_ar, data.year ?? null, data.duration_minutes || 60, data.structure_json || '{}');
  return result.lastInsertRowid as number;
}

export function updateExam(id: number, data: Partial<Omit<Exam, 'id'>>): boolean {
  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) { fields.push(`${k} = ?`); values.push(v as string | number | null); }
  }
  if (fields.length === 0) return false;
  values.push(id);
  return db().prepare(`UPDATE exams SET ${fields.join(', ')} WHERE id = ?`).run(...values).changes > 0;
}

export function deleteExam(id: number): boolean {
  return db().prepare("DELETE FROM exams WHERE id = ?").run(id).changes > 0;
}

export function getExamQuestions(examId: number): (ExamQuestion & Question)[] {
  return db().prepare(
    `SELECT eq.id as eq_id, eq.exam_id, eq.order_index, q.*
     FROM exam_questions eq
     JOIN questions q ON eq.question_id = q.id
     WHERE eq.exam_id = ?
     ORDER BY eq.order_index`
  ).all(examId) as (ExamQuestion & Question)[];
}

export function setExamQuestions(examId: number, questionIds: number[]): void {
  const d = db();
  const del = d.prepare("DELETE FROM exam_questions WHERE exam_id = ?");
  const ins = d.prepare("INSERT INTO exam_questions (exam_id, question_id, order_index) VALUES (?, ?, ?)");
  const tx = d.transaction(() => {
    del.run(examId);
    questionIds.forEach((qid, idx) => ins.run(examId, qid, idx));
  });
  tx();
}

export function getSubjectsWithCounts(): (Subject & { lesson_count: number; question_count: number })[] {
  return db().prepare(`
    SELECT s.*,
      (SELECT COUNT(*) FROM lessons l WHERE l.subject_id = s.id AND l.status = 'published') as lesson_count,
      (SELECT COUNT(*) FROM questions q WHERE q.subject_id = s.id) as question_count
    FROM subjects s
    WHERE s.is_active = 1
    ORDER BY s.order_index, s.id
  `).all() as (Subject & { lesson_count: number; question_count: number })[];
}

export function initDatabase(): void {
  ensureSchema();
}

export function getDbForHealth(): any {
  return db();
}

export { dbPath, uploadsDir };
