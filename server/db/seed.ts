import { initDatabase, getAllSubjects, createSubject, createLesson, getSubjectByKey } from "./database";

const subjects = [
  { key: "math", name_ar: "الرياضيات", color: "#3498DB", icon: "calculator", order_index: 1, primary_language: "ar", terms_language: "fr" },
  { key: "ar", name_ar: "اللغة العربية", color: "#27AE60", icon: "book", order_index: 2, primary_language: "ar", terms_language: null },
  { key: "fr", name_ar: "اللغة الفرنسية", color: "#9B59B6", icon: "language", order_index: 3, primary_language: "fr", terms_language: null },
  { key: "sc", name_ar: "العلوم الطبيعية", color: "#E67E22", icon: "leaf", order_index: 4, primary_language: "ar", terms_language: "fr" },
  { key: "islam", name_ar: "التربية الإسلامية", color: "#16A085", icon: "moon", order_index: 5, primary_language: "ar", terms_language: null },
  { key: "pc", name_ar: "الفيزياء والكيمياء", color: "#2980B9", icon: "flask", order_index: 6, primary_language: "ar", terms_language: "fr" },
  { key: "hg", name_ar: "التاريخ والجغرافيا", color: "#E74C3C", icon: "earth", order_index: 7, primary_language: "ar", terms_language: null },
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
  ar: [
    "أنواع الجمل - الاسمية والفعلية",
    "علامات الإعراب",
    "الفعل الماضي والمضارع والأمر",
    "المفعول المطلق",
    "البلاغة - التشبيه والاستعارة",
    "النعت والتوكيد",
    "الحال والتمييز",
    "الإضافة",
    "الممنوع من الصرف",
    "أسلوب الشرط",
  ],
  fr: [
    "Module I: discours explicatif - Séquence 1 : C'est surprenant !",
    "Séquence 2 : Qu'est-ce qui s'est passé et comment cela est arrivé ?",
    "Séquence 3 : Qu'est-ce que c'est et comment ça fonctionne ?",
    "Séquence 4 : Je choisirais plutôt…",
    "Module 2: discours argumentatif - Séquence 5 : Pour ma part, voila ce que je pense.",
    "Séquence 6 : Je ne suis pas du même avis !",
    "Séquence 7 : On est d'accord ?",
    "Séquence 8 : Quel métier choisir ?",
  ],
  sc: [
    "ORGANISATION GÉNÉRALE DE LA CELLULE",
    "REPRODUCTION CHEZ L'HOMME",
    "SYSTÈME NERVEUX ET MOTRICITÉ",
    "ROCHES MAGMATIQUES ET MÉTAMORPHIQUES",
    "ÉCOLOGIE",
  ],
  islam: [
    "تعريف علم التوحيد واهميته ومكانته",
    "حدوث الكون أدلته النقلية والعقلية",
    "خلق الإنسان واستخلافه في الأرض",
    "أدلة الصفات الواجبة في حق اللّٰه تعالى",
    "الجائز والمستحيل في حق اللّٰه تعالى",
    "الرسل (صفاتهم، والحكمة من بعثتهم)",
    "معجزات الرسل والفرق بينها وبين غيرها من الخوارق",
    "تكامل الرسالات السماوية وختمها برسالة محمد رسول اللّٰه صلى اللّٰه عليه وسلم",
    "سورة النور من الآية 1 إلى الآية10",
    "سورة النور من الآية 11 إلى الآية 20",
    "سورة النور من الآية 21 إلى الآية 26",
    "سورة النور من الآية 27 إلى الآية 31",
    "سورة النور من الآية 32 إلى الآية 38",
    "سورة النور من الآية 39 إلى الآية 44",
    "سورة النور من الآية 45 إلى الآية 52",
    "سورة النور من الآية 53 إلى الآية 57",
    "سورة النور من الآية 58 إلى الآية 60",
    "سورة النور من الآية 61 إلى الآية 64",
    "حرمة الغش والخديعة والتحايل",
    "تحريم الغلول والرشوة",
    "الظلم والاحتقار",
    "الكبر والعجب ورؤية الفضل على الغير",
    "الأمر بحفظ اللسان وبقية الجوارح",
    "وسائل التسلية وفق الضوابط الشرعية",
    "نزول القرآن منجما والحكمة منه",
    "اسباب النزول",
    "المكي و المدني ( أهدافهما وخصائصهما)",
    "التفسير و مناهجه",
    "ترجمة لبعض المفسرين",
    "بعض المعذبين في سبيل اللّٰه",
    "السفارة في الإسلام من خلال جعفر",
    "الزوجة وأثرها في الدعوة من خلال خديجة بنت خويلد",
    "الدعوة والتعليم من خلال مصعب بن عمير",
    "التضحية في سبيل الإسلام من خلال صهيب الرومي",
    "مراجعة عامة للبيع",
    "بيع الغائب",
    "البيع على البرنامج",
    "المزاد العلني (صفته - شروطه - حكمه)",
    "بيع الثمار والزروع",
    "العيوب في البيع",
    "السلم",
    "الهبة والصدقة",
    "الحبس والوقف",
    "العارية و الوديعة",
    "النكاح حكمه - وحكمته - ومقدماته",
    "أركان النكاح وشروطه",
    "النساء المحرمات",
    "النفقة والحضانة",
    "الطلاق والعدة والارتجاع",
    "الظهار والخلع",
    "الإيلاء واللعان",
    "الأنكحة الفاسدة",
    "الأيمان والنذور",
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
  hg: [
    "الحرب العالمية الأولى - أسبابها ونتائجها",
    "الحرب العالمية الثانية",
    "الحركات الوطنية في إفريقيا",
    "الاستعمار في موريتانيا",
    "استقلال موريتانيا",
    "خريطة العالم - القارات والمحيطات",
    "المناخ والأقاليم المناخية",
    "السكان والتوزيع الجغرافي",
    "الموارد الطبيعية في موريتانيا",
    "التنمية المستدامة",
  ],
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
