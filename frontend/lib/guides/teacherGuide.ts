import type { GuideSection } from "@/components/help/GuideView";

export function getTeacherGuide(locale: "ar" | "en"): { title: string; subtitle: string; sections: GuideSection[] } {
  if (locale === "en") {
    return {
      title: "📘 Teacher Guide",
      subtitle: "Everything you can do on the platform and how to use it",
      sections: [
        {
          icon: "🏠", title: "Home", desc: "Your join code and a quick overview",
          items: [
            { label: "Join code", desc: "Share it with students so they can link to you during self-registration (if you still allow that)" },
          ],
        },
        {
          icon: "👥", title: "My Students", desc: "Add students directly and manage their accounts",
          items: [
            { label: "+ Add Student", desc: "Enter just the name and email — a temporary password (first name + year, e.g. 'ahmed2026') is generated and shown once. Copy it and hand it to the student; they must change it on first login" },
            { label: "Reset Password", desc: "If a student forgets their password, generate a new temporary one the same way" },
            { label: "AI Assist toggle", desc: "Only visible if the admin granted you this permission — lets a specific student get AI hints during exams" },
          ],
        },
        {
          icon: "📋", title: "Needs Review", desc: "Grade the exams your students submitted",
          items: [
            { label: "Manual grading", desc: "Open (\"why\"/essay) questions need your judgment — MCQ/true-false/fill-blank are graded automatically" },
            { label: "🤖 AI Suggestion", desc: "Get a suggested score and reasoning for an open answer before you decide" },
            { label: "Decision", desc: "Approve, reject, or request revision — the student is notified either way" },
          ],
        },
        {
          icon: "📚", title: "Manage My Curricula", desc: "Your own curricula, separate from your students'",
          items: [
            { label: "Upload", desc: "Same as a student upload — PDF/image, auto-processed into lessons" },
          ],
        },
        {
          icon: "🗂️", title: "Question Bank", desc: "Share questions with other teachers, or use theirs",
          items: [
            { label: "Publish a question", desc: "Make one of your questions available to the community" },
            { label: "Import", desc: "Mark a question as imported, then add it to your own curriculum manually" },
          ],
        },
        {
          icon: "⚙️", title: "Exam Settings", desc: "View how each exam type is configured (question counts, time, points) — editable by the admin only",
          items: [],
        },
        {
          icon: "📅", title: "A Student's Schedule", desc: "Open it from that student's results page",
          items: [
            { label: "Any slot you set is fixed", desc: "The student cannot edit or delete a slot you created — it always takes priority over theirs" },
          ],
        },
        {
          icon: "🔗", title: "Educational Channel Links", desc: "Only visible if the admin granted you this permission",
          items: [
            { label: "Add your channels", desc: "YouTube, Telegram, etc. — shown on your Home page" },
          ],
        },
      ],
    };
  }

  return {
    title: "📘 دليل المعلم",
    subtitle: "كل حاجة تقدر تعملها في المنصة وإزاي تستخدمها",
    sections: [
      {
        icon: "🏠", title: "الرئيسية", desc: "كود الانضمام بتاعك ونظرة سريعة",
        items: [
          { label: "كود الانضمام", desc: "شاركه مع طلابك عشان يترابطوا بيك وقت التسجيل الذاتي (لو لسه مفعّل)" },
        ],
      },
      {
        icon: "👥", title: "طلابي", desc: "إضافة طلاب مباشرة وإدارة حساباتهم",
        items: [
          { label: "+ إضافة طالب", desc: "حط بس الاسم والإيميل — هيتولّد باسورد مؤقت (اسم أول + سنة، مثلاً 'ahmed2026') ويظهر مرة واحدة. انسخه وديه للطالب — لازم يغيّره أول ما يسجّل دخول" },
          { label: "إعادة تعيين الباسورد", desc: "لو الطالب نسي باسورده، تقدر تولّد واحد جديد بنفس الطريقة" },
          { label: "زرار AI Assist", desc: "بيظهر بس لو الآدمن دّاك الصلاحية دي — بيخلي طالب معيّن ياخد تلميحات AI في الامتحانات" },
        ],
      },
      {
        icon: "📋", title: "تحتاج مراجعة", desc: "صحّح امتحانات طلابك",
        items: [
          { label: "التصحيح اليدوي", desc: "الأسئلة المفتوحة (علّل/مقالي) محتاجة تقييمك — الاختيار من متعدد وصح/خطأ والفراغات بتتصحح تلقائيًا" },
          { label: "🤖 اقتراح ذكاء اصطناعي", desc: "خد درجة مقترحة وسبب لإجابة مفتوحة قبل ما تقرر" },
          { label: "القرار", desc: "موافقة، رفض، أو طلب مراجعة — الطالب بيتبلّغ في الحالتين" },
        ],
      },
      {
        icon: "📚", title: "إدارة مناهجي", desc: "مناهجك الخاصة، منفصلة عن مناهج طلابك",
        items: [
          { label: "رفع منهج", desc: "زي رفع الطالب بالظبط — PDF/صورة، بيتحلل تلقائيًا لدروس" },
        ],
      },
      {
        icon: "🗂️", title: "بنك الأسئلة", desc: "شارك أسئلتك مع معلمين تانيين، أو استخدم أسئلتهم",
        items: [
          { label: "نشر سؤال", desc: "اجعل واحد من أسئلتك متاح للمجتمع" },
          { label: "استيراد", desc: "علّم السؤال كمستورد، وبعدين ضيفه لمنهجك يدويًا" },
        ],
      },
      {
        icon: "⚙️", title: "إعدادات الامتحانات", desc: "شوف إزاي كل نوع امتحان مضبوط (عدد الأسئلة، الوقت، الدرجات) — التعديل للآدمن بس",
        items: [],
      },
      {
        icon: "📅", title: "جدول طالب معيّن", desc: "افتحه من صفحة نتائج الطالب",
        items: [
          { label: "أي ميعاد تحدده بيبقى ثابت", desc: "الطالب مش هيقدر يعدّله أو يمسحه — بتاعك دايمًا له الأولوية على بتاعه" },
        ],
      },
      {
        icon: "🔗", title: "روابط القنوات التعليمية", desc: "بتظهر بس لو الآدمن دّاك الصلاحية دي",
        items: [
          { label: "ضيف قنواتك", desc: "يوتيوب، تليجرام، إلخ — بتظهر في صفحتك الرئيسية" },
        ],
      },
    ],
  };
}
