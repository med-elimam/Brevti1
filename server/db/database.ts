import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../../shared/schema";
import { sql, eq, asc, desc, and, relations } from "drizzle-orm";

// ... existing code ...

export const questionsRelations = relations(schema.questions, ({ many }) => ({
  examQuestions: many(schema.exam_questions),
}));

export const examQuestionsRelations = relations(schema.exam_questions, ({ one }) => ({
  question: one(schema.questions, {
    fields: [schema.exam_questions.question_id],
    references: [schema.questions.id],
  }),
  exam: one(schema.exams, {
    fields: [schema.exam_questions.exam_id],
    references: [schema.exams.id],
  }),
}));

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export const db = drizzle(pool, { schema });

// Helper functions to match the previous API
export async function getAllSubjects() {
  return await db.query.subjects.findMany({
    orderBy: (subjects) => [asc(subjects.order_index), asc(subjects.id)],
  });
}

export async function getActiveSubjects() {
  return await db.query.subjects.findMany({
    where: (subjects) => eq(subjects.is_active, 1),
    orderBy: (subjects) => [asc(subjects.order_index), asc(subjects.id)],
  }) as any[];
}

export async function getSubjectById(id: number) {
  return await db.query.subjects.findFirst({
    where: (subjects) => eq(subjects.id, id),
  });
}

export async function getSubjectByKey(key: string) {
  return await db.query.subjects.findFirst({
    where: (subjects) => eq(subjects.key, key),
  });
}

export async function createSubject(data: any) {
  const [result] = await db.insert(schema.subjects).values(data).returning({ id: schema.subjects.id });
  return result.id;
}

export async function updateSubject(id: number, data: any) {
  await db.update(schema.subjects).set(data).where(eq(schema.subjects.id, id));
  return true;
}

export async function deleteSubject(id: number) {
  await db.delete(schema.subjects).where(eq(schema.subjects.id, id));
  return true;
}

export async function getLessonsBySubject(subjectId: number) {
  return await db.query.lessons.findMany({
    where: (lessons) => eq(lessons.subject_id, subjectId),
    orderBy: (lessons) => [asc(lessons.order_index), asc(lessons.id)],
  });
}

export async function getLessonById(id: number) {
  return await db.query.lessons.findFirst({
    where: (lessons) => eq(lessons.id, id),
  });
}

export async function createLesson(data: any) {
  const [result] = await db.insert(schema.lessons).values(data).returning({ id: schema.lessons.id });
  return result.id;
}

export async function updateLesson(id: number, data: any) {
  await db.update(schema.lessons).set({ ...data, updated_at: new Date() }).where(eq(schema.lessons.id, id));
  return true;
}

export async function deleteLesson(id: number) {
  await db.delete(schema.lessons).where(eq(schema.lessons.id, id));
  return true;
}

export async function getLessonCountBySubject(subjectId: number) {
  const result = await db.select({ count: sql`count(*)` }).from(schema.lessons).where(and(eq(schema.lessons.subject_id, subjectId), eq(schema.lessons.status, 'published')));
  return result[0].count;
}

export async function getQuestionCountBySubject(subjectId: number) {
  const result = await db.select({ count: sql`count(*)` }).from(schema.questions).where(eq(schema.questions.subject_id, subjectId));
  return result[0].count;
}

export async function getSubjectsWithCounts() {
  const subs = await getActiveSubjects();
  return await Promise.all(subs.map(async (s) => ({
    ...s,
    lesson_count: await getLessonCountBySubject(s.id),
    question_count: await getQuestionCountBySubject(s.id),
  })));
}

export async function getSourcesByLesson(lessonId: number) {
  return await db.query.sources.findMany({
    where: (sources) => eq(sources.lesson_id, lessonId),
    orderBy: (sources) => desc(sources.created_at),
  });
}

export async function getSourceById(id: number) {
  return await db.query.sources.findFirst({
    where: (sources) => eq(sources.id, id),
  });
}

export async function createSource(data: any) {
  const [result] = await db.insert(schema.sources).values(data).returning({ id: schema.sources.id });
  return result.id;
}

export async function updateSource(id: number, data: any) {
  await db.update(schema.sources).set(data).where(eq(schema.sources.id, id));
  return true;
}

export async function deleteSource(id: number) {
  await db.delete(schema.sources).where(eq(schema.sources.id, id));
  return true;
}

export async function getQuestionById(id: number) {
  return await db.query.questions.findFirst({
    where: (questions) => eq(questions.id, id),
  });
}

export async function updateQuestion(id: number, data: any) {
  await db.update(schema.questions).set(data).where(eq(schema.questions.id, id));
  return true;
}

export async function deleteQuestion(id: number) {
  await db.delete(schema.questions).where(eq(schema.questions.id, id));
  return true;
}

export async function getExamById(id: number) {
  return await db.query.exams.findFirst({
    where: (exams) => eq(exams.id, id),
  });
}

export async function createExam(data: any) {
  const [result] = await db.insert(schema.exams).values(data).returning({ id: schema.exams.id });
  return result.id;
}

export async function updateExam(id: number, data: any) {
  await db.update(schema.exams).set(data).where(eq(schema.exams.id, id));
  return true;
}

export async function deleteExam(id: number) {
  await db.delete(schema.exams).where(eq(schema.exams.id, id));
  return true;
}

export async function getExamQuestions(examId: number) {
  return await db.query.exam_questions.findMany({
    where: (eq_table) => eq(eq_table.exam_id, examId),
    with: {
      question: true
    },
    orderBy: (eq_table) => asc(eq_table.order_index),
  }) as any;
}

export async function setExamQuestions(examId: number, questionIds: number[]) {
  await db.delete(schema.exam_questions).where(eq(schema.exam_questions.exam_id, examId));
  if (questionIds.length > 0) {
    await db.insert(schema.exam_questions).values(
      questionIds.map((qid, idx) => ({
        exam_id: examId,
        question_id: qid,
        order_index: idx,
      }))
    );
  }
}

export async function getSourcesBySubject(subjectId: number) {
  return await db.query.sources.findMany({
    where: (sources) => eq(sources.subject_id, subjectId),
    orderBy: (sources) => desc(sources.created_at),
  });
}

export async function getQuestions(filters: any) {
  const conditions = [];
  if (filters.subject_id) conditions.push(eq(schema.questions.subject_id, filters.subject_id));
  if (filters.lesson_id) conditions.push(eq(schema.questions.lesson_id, filters.lesson_id));
  if (filters.difficulty) conditions.push(eq(schema.questions.difficulty, filters.difficulty));
  if (filters.qtype) conditions.push(eq(schema.questions.qtype, filters.qtype));
  
  return await db.query.questions.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: (questions) => desc(questions.created_at),
  });
}

export async function createQuestion(data: any) {
  const [result] = await db.insert(schema.questions).values(data).returning({ id: schema.questions.id });
  return result.id;
}

export async function getExamsBySubject(subjectId: number) {
  return await db.query.exams.findMany({
    where: (exams) => eq(exams.subject_id, subjectId),
    orderBy: (exams) => desc(exams.created_at),
  });
}

export async function initDatabase() {
  const { execSync } = require("child_process");
  try {
    execSync("npx drizzle-kit push", { stdio: "inherit" });
    console.log("Database schema pushed successfully");
  } catch (err) {
    console.error("Database schema push failed:", err);
  }
}

export async function getDbForHealth() {
  return db;
}

export const uploadsDir = process.env.UPLOADS_DIR || "uploads";
export const dbPath = "postgresql";
