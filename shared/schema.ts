import { sql } from "drizzle-orm";
import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
});

export const subjects = pgTable("subjects", {
  id: serial("id").primaryKey(),
  key: text("key").unique().notNull(),
  name_ar: text("name_ar").notNull(),
  color: text("color").notNull().default("#3498DB"),
  icon: text("icon").notNull().default("book"),
  order_index: integer("order_index").notNull().default(0),
  is_active: integer("is_active").notNull().default(1),
  primary_language: text("primary_language").notNull().default("ar"),
  terms_language: text("terms_language"),
});

export const lessons = pgTable("lessons", {
  id: serial("id").primaryKey(),
  subject_id: integer("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
  title_ar: text("title_ar").notNull(),
  order_index: integer("order_index").notNull().default(0),
  status: text("status").notNull().default("draft"),
  content_blocks_json: text("content_blocks_json").default("[]"),
  summary_ar: text("summary_ar").default(""),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const sources = pgTable("sources", {
  id: serial("id").primaryKey(),
  subject_id: integer("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
  lesson_id: integer("lesson_id").references(() => lessons.id, { onDelete: "set null" }),
  type: text("type").notNull(),
  filename: text("filename").notNull().default(""),
  original_name: text("original_name").notNull().default(""),
  mime: text("mime").notNull().default(""),
  size: integer("size").notNull().default(0),
  storage_path: text("storage_path").notNull().default(""),
  extracted_text: text("extracted_text").default(""),
  created_at: timestamp("created_at").defaultNow(),
});

export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  subject_id: integer("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
  lesson_id: integer("lesson_id").references(() => lessons.id, { onDelete: "set null" }),
  difficulty: text("difficulty").notNull().default("medium"),
  qtype: text("qtype").notNull().default("mcq"),
  statement_md: text("statement_md").notNull().default(""),
  options_json: text("options_json").default("[]"),
  correct_answer_json: text("correct_answer_json").default("\"\""),
  solution_md: text("solution_md").default(""),
  tags_json: text("tags_json").default("[]"),
  source_ids_json: text("source_ids_json").default("[]"),
  created_at: timestamp("created_at").defaultNow(),
});

export const exams = pgTable("exams", {
  id: serial("id").primaryKey(),
  subject_id: integer("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
  title_ar: text("title_ar").notNull().default(""),
  year: integer("year"),
  duration_minutes: integer("duration_minutes").notNull().default(60),
  structure_json: text("structure_json").default("{}"),
  created_at: timestamp("created_at").defaultNow(),
});

export const exam_questions = pgTable("exam_questions", {
  id: serial("id").primaryKey(),
  exam_id: integer("exam_id").notNull().references(() => exams.id, { onDelete: "cascade" }),
  question_id: integer("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  order_index: integer("order_index").notNull().default(0),
});

export const lesson_progress = pgTable("lesson_progress", {
  id: serial("id").primaryKey(),
  lesson_id: integer("lesson_id").notNull().references(() => lessons.id, { onDelete: "cascade" }),
  is_studied: boolean("is_studied").notNull().default(false),
  has_notes: boolean("has_notes").notNull().default(false),
  exercise_completed: boolean("exercise_completed").notNull().default(false),
  completed_at: timestamp("completed_at"),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Subject = typeof subjects.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
export type Source = typeof sources.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type Exam = typeof exams.$inferSelect;
export type ExamQuestion = typeof exam_questions.$inferSelect;
