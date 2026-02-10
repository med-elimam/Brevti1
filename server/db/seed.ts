import { initDatabase, getAllSubjects, createSubject, createLesson, getSubjectByKey } from "./database";

const subjects = [
  { key: "math", name_ar: "الرياضيات", color: "#3498DB", icon: "calculator", order_index: 1, primary_language: "ar", terms_language: "fr" },
  { key: "pc", name_ar: "الفيزياء والكيمياء", color: "#2980B9", icon: "flask", order_index: 2, primary_language: "ar", terms_language: "fr" },
  { key: "sn", name_ar: "العلوم الطبيعية", color: "#E67E22", icon: "leaf", order_index: 3, primary_language: "ar", terms_language: "fr" },
  { key: "fr", name_ar: "اللغة الفرنسية", color: "#9B59B6", icon: "language", order_index: 4, primary_language: "fr", terms_language: null },
  { key: "ar", name_ar: "اللغة العربية", color: "#27AE60", icon: "book", order_index: 5, primary_language: "ar", terms_language: null },
  { key: "hg", name_ar: "التاريخ والجغرافيا", color: "#E74C3C", icon: "earth", order_index: 6, primary_language: "ar", terms_language: null },
  { key: "islam", name_ar: "التربية الإسلامية", color: "#16A085", icon: "moon", order_index: 7, primary_language: "ar", terms_language: null },
  { key: "civic", name_ar: "التربية المدنية", color: "#F1C40F", icon: "people", order_index: 8, primary_language: "ar", terms_language: null },
  { key: "en", name_ar: "اللغة الإنجليزية", color: "#E67E22", icon: "language", order_index: 9, primary_language: "en", terms_language: null },
];

const lessonsBySubject: Record<string, string[]> = {
  math: [
    "NOMBRES REELS ET OPERATIONS",
    "ORDRE, INTERVALLES ET VALEURS ABSOLUE",
    "RACINES CARREES",
    "CALCUL LITTERAL",
    "EQUATIONS ET INEQUATIONS",
    "VECTEURS DU PLAN",
    "REPERES DU PLAN",
    "EQUATIONS DE DROITES",
    "SYSTEMES D'EQUATIONS ET D'INEQUATIONS",
    "PROJECTION DANS LE PLAN",
    "THEOREME DE THALES",
    "TRANSFORMATIONS DANS LE PLAN",
    "TRIGONOMETRIE",
    "FONCTIONS AFFINES",
    "PROBABILITES",
    "PYRAMIDE",
    "CONE DE REVOLUTION",
    "LEXIQUE",
  ],
  pc: [
    "LES MATERIAUX",
    "REACTIONS CHIMIQUES",
    "PREPARATION D'UNE SOLUTION",
    "SOLUTIONS ACIDES, BASIQUES ET NEUTRES",
    "MASSE, VOLUME ET POIDS",
    "EQUILIBRE D'UN SOLIDE SOUMIS A DEUX FORCES",
    "RESISTANCE ELECTRIQUE",
    "PUISSANCE ET ENERGIE ELECTRIQUE",
    "REFLEXION ET REFRACTION DE LA LUMIERE",
    "LES LENTILLES MINCES",
  ],
  sn: [
    "ORGANISATION GÉNÉRALE DE LA CELLULE",
    "REPRODUCTION CHEZ L'HOMME",
    "SYSTÈME NERVEUX ET MOTRICITÉ",
    "ROCHES MAGMATIQUES ET MÉTAMORPHIQUES",
    "ÉCOLOGIE",
  ],
  fr: [
    "Module I: discours explicatif",
    "Module 2: discours argumentatif",
  ],
  ar: [
    "أنواع الجمل - الاسمية والفعلية",
    "علامات الإعراب",
    "الفعل الماضي والمضارع والأمر",
    "المفعول المطلق",
    "البلاغة - التشبيه والاستعارة",
  ],
  hg: [
    "الحرب العالمية الأولى",
    "الحرب العالمية الثانية",
    "الاستعمار في موريتانيا",
    "استقلال موريتانيا",
  ],
  islam: [
    "تعريف علم التوحيد واهميته ومكانته",
    "حدوث الكون أدلته النقلية والعقلية",
    "سورة النور",
  ],
  civic: [
    "المواطنة وحقوق الإنسان",
    "الدولة والمؤسسات",
    "القيم الاجتماعية",
  ],
  en: [
    "Tenses and Grammar",
    "Vocabulary and Comprehension",
  ]
};

export async function seedDatabase() {
  await initDatabase();

  const existing = await getAllSubjects();
  if (existing.length > 0) {
    console.log("Database already seeded, skipping...");
    return;
  }

  console.log("Seeding database...");

  for (const s of subjects) {
    await createSubject(s);
  }

  for (const [subjectKey, titles] of Object.entries(lessonsBySubject)) {
    const subject = await getSubjectByKey(subjectKey);
    if (!subject) continue;
    for (let i = 0; i < titles.length; i++) {
      await createLesson({ 
        subject_id: subject.id, 
        title_ar: titles[i], 
        order_index: i + 1, 
        status: 'draft' 
      });
    }
  }

  console.log("Database seeded successfully!");
}
