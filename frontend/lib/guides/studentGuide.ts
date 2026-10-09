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
            { label: "Create a custom exam", desc: "Choose the curriculum and exam type — questions come from your teacher's material and question bank, topped up by AI-generated ones" },
            { label: "AI hints", desc: "If your teacher enabled AI assist for you, you can get a hint while solving without seeing the answer directly" },
            { label: "Instant grading", desc: "Most questions are graded the moment you submit — including \"explain why\". Essay always needs your teacher, and so does any question (rare) that came from material with no known answer to check against — those show as pending instead of right/wrong, so you're never marked wrong just because the system doesn't know" },
          ],
        },
        {
          icon: "📝", title: "My Assignments", desc: "Exams and practice your teacher created specifically for you",
          items: [
            { label: "Where it comes from", desc: "Your teacher targets you individually or through a group — it shows up here, not in the self-service Exams page" },
            { label: "Time window", desc: "If your teacher set an \"opens at\" / \"due by\" date, you can only start it inside that window" },
            { label: "Time limit", desc: "May be a custom duration your teacher set just for this assignment, different from that curriculum's usual exams" },
            { label: "Attempts", desc: "One attempt unless your teacher allowed multiple" },
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
          { label: "إنشاء امتحان مخصص", desc: "اختار المنهج ونوع الامتحان — الأسئلة بتيجي من مادة معلمك وبنك الأسئلة، ولو ناقص أي عدد الذكاء الاصطناعي بيكمّله" },
          { label: "تلميحات الذكاء الاصطناعي", desc: "لو معلمك فعّل مساعد AI ليك، تقدر تاخد تلميح وانت بتحل من غير ما تشوف الإجابة مباشرة" },
          { label: "تصحيح فوري", desc: "أغلب الأسئلة بتتصحح لحظة التسليم — حتى \"علّل\". المقالي دايمًا محتاج معلمك، وكمان أي سؤال (نادر) جه من مادة مالهاش إجابة معروفة — دول بتظهر \"قيد المراجعة\" بدل صح/خطأ، عشان منتحسبش عليك غلط لمجرد إن النظام مش عارف الإجابة" },
        ],
      },
      {
        icon: "📝", title: "تكليفاتي", desc: "امتحانات وتدريبات عملهالك معلمك بالاسم",
        items: [
          { label: "منين بتيجي", desc: "معلمك بيستهدفك إنت بالاسم أو عن طريق مجموعة — بتظهر هنا، مش في صفحة الاختبارات العادية" },
          { label: "فترة الإتاحة", desc: "لو معلمك حدد ميعاد فتح/ميعاد تسليم، مش هتقدر تبدأ إلا جوه الفترة دي" },
          { label: "مدة الاختبار", desc: "ممكن تكون مدة مخصصة حددها معلمك للتكليف ده بس، مختلفة عن امتحانات المنهج ده العادية" },
          { label: "المحاولات", desc: "محاولة واحدة إلا لو معلمك سمح بمحاولات متعددة" },
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
