import type { GuideSection } from "@/components/help/GuideView";

export function getStudentGuide(locale: "ar" | "en"): { title: string; subtitle: string; sections: GuideSection[] } {
  if (locale === "en") {
    return {
      title: "📘 Student Guide",
      subtitle: "Everything you can do on the platform and how to use it",
      sections: [
        {
          icon: "📚", title: "My Curricula", desc: "Upload and study your curricula",
          items: [
            { label: "Upload a curriculum", desc: "PDF or image file — the AI automatically breaks it into units and lessons" },
            { label: "Study a lesson", desc: "Each lesson has an explanation, summary, key terms, flashcards, and a video if your teacher added one" },
          ],
        },
        {
          icon: "✏️", title: "Exams", desc: "Take a lesson quiz, unit test, or full exam",
          items: [
            { label: "Create a custom exam", desc: "Choose the curriculum and exam type — the AI generates questions from your material" },
            { label: "AI hints", desc: "If your teacher enabled AI assist for you, you can get a hint while solving without seeing the answer directly" },
          ],
        },
        {
          icon: "📊", title: "Grades & Progress", desc: "Track your results over time",
          items: [
            { label: "My Grades", desc: "See every exam attempt, its score, and whether your teacher approved it" },
            { label: "My Progress", desc: "A summary of how you're doing across your curricula" },
          ],
        },
        {
          icon: "📖", title: "Glossary", desc: "Every key term across your curricula in one place",
          items: [],
        },
        {
          icon: "📅", title: "My Schedule", desc: "Two independent timetables",
          items: [
            { label: "School Timetable", desc: "Your real class schedule — you or your teacher can add and edit it" },
            { label: "Study Plan", desc: "A flexible personal revision plan. If your teacher sets a slot it becomes fixed (🔒) and only they can change it — everything else is yours to plan freely" },
          ],
        },
        {
          icon: "💳", title: "Plans", desc: "Free plan limits and paid plan options",
          items: [
            { label: "Upgrade", desc: "Monthly or yearly plans remove the free-tier limits on uploads, questions, and summaries" },
          ],
        },
        {
          icon: "🌐", title: "Language & Account", desc: "Available everywhere in the sidebar",
          items: [
            { label: "AR / EN switch", desc: "Top of the sidebar — switches the whole interface direction and language instantly" },
            { label: "Change password", desc: "If your account was created by your teacher, you were asked to set your own password on first login" },
          ],
        },
      ],
    };
  }

  return {
    title: "📘 دليل الطالب",
    subtitle: "كل حاجة تقدر تعملها في المنصة وإزاي تستخدمها",
    sections: [
      {
        icon: "📚", title: "مناهجي", desc: "رفع ودراسة مناهجك",
        items: [
          { label: "رفع منهج", desc: "ملف PDF أو صورة — الذكاء الاصطناعي بيقسّمه تلقائيًا لوحدات ودروس" },
          { label: "دراسة الدرس", desc: "كل درس فيه شرح، ملخص، مصطلحات، بطاقات مذاكرة، وفيديو لو معلمك ضافه" },
        ],
      },
      {
        icon: "✏️", title: "الاختبارات", desc: "امتحان درس، وحدة، أو امتحان شامل",
        items: [
          { label: "إنشاء امتحان مخصص", desc: "اختار المنهج ونوع الامتحان — الذكاء الاصطناعي بيولّد الأسئلة من مادتك" },
          { label: "تلميحات الذكاء الاصطناعي", desc: "لو معلمك فعّل مساعد AI ليك، تقدر تاخد تلميح وانت بتحل من غير ما تشوف الإجابة مباشرة" },
        ],
      },
      {
        icon: "📊", title: "درجاتي وتقدمي", desc: "تابع نتائجك على مر الوقت",
        items: [
          { label: "درجاتي", desc: "شوف كل محاولة امتحان، درجتها، ولو معلمك وافق عليها" },
          { label: "تقدمي", desc: "ملخص لأدائك في كل مناهجك" },
        ],
      },
      {
        icon: "📖", title: "المصطلحات", desc: "كل المصطلحات المهمة من كل مناهجك في مكان واحد",
        items: [],
      },
      {
        icon: "📅", title: "جدولي", desc: "جدولين مستقلين عن بعض",
        items: [
          { label: "الجدول الدراسي", desc: "مواعيد حصصك الفعلية بالمدرسة — إنت أو معلمك تقدروا تضيفوا وتعدّلوا" },
          { label: "جدول المذاكرة", desc: "خطة مذاكرة شخصية مرنة. لو معلمك حدد ميعاد بيبقى ثابت (🔒) وميتغيرش غيره — الباقي كله تحت تصرفك" },
        ],
      },
      {
        icon: "💳", title: "الخطط", desc: "حدود الخطة المجانية وخيارات الاشتراك",
        items: [
          { label: "الترقية", desc: "الخطة الشهرية أو السنوية بتشيل حدود الرفع والأسئلة والملخصات" },
        ],
      },
      {
        icon: "🌐", title: "اللغة والحساب", desc: "متاحة دايمًا من القائمة الجانبية",
        items: [
          { label: "زرار AR / EN", desc: "أعلى القائمة الجانبية — بيبدّل لغة واتجاه الواجهة كاملة فورًا" },
          { label: "تغيير كلمة المرور", desc: "لو حسابك اتعمل بمعرفة معلمك، هتتطلب تحدد باسورد خاص بيك أول ما تدخل" },
        ],
      },
    ],
  };
}
