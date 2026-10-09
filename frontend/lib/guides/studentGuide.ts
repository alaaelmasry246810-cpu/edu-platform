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
          icon: "🎮", title: "Games & Activities", desc: "Activities your teacher assigned or sent you a link to",
          items: [
            { label: "Play your way", desc: "Open an activity and switch between games (quiz, match, crossword, gold quest, tower…) without changing the questions" },
            { label: "Power-ups", desc: "In the quiz: remove two answers, double points, or freeze time — once each. 🔊 reads the question aloud" },
            { label: "Leaderboard", desc: "If your teacher shows it, after finishing you see your rank by % correct, then speed — your best attempt in the assessed games counts" },
            { label: "Teacher's link", desc: "A link from your teacher opens a short sign-up screen: if you're your teacher's student, sign in so the result goes to your record; otherwise enter your name, mobile and class (if your teacher allows)" },
            { label: "🔴 Live game", desc: "Games & Activities → Join a live game (or go to /play), enter the PIN on the class screen and your name, then answer from your phone — faster correct answers score more" },
          ],
        },
        {
          icon: "🃏", title: "Flashcards", desc: "Each lesson's flashcards tab has four study modes",
          items: [
            { label: "🧠 Learn (spaced repetition)", desc: "Cards you miss come back today; cards you know come back after 1, 3, 7 and 16 days until they're mastered" },
            { label: "🔗 Match and ⌨️ Write", desc: "A timed matching game, and a test where you type the answer" },
            { label: "Offline", desc: "Activities and flashcards you've opened before keep working without internet" },
          ],
        },
        {
          icon: "🎞️", title: "Interactive Videos", desc: "In the lesson's 🎬 Video tab",
          items: [
            { label: "Questions inside", desc: "The video stops at each question; you see if you're right and why. Skipping ahead doesn't skip a question" },
            { label: "Views", desc: "Switch between scenes, the lesson text with the spoken sentence lit up, or both. Click any sentence to jump to that moment" },
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
          icon: "🎮", title: "الأنشطة والألعاب", desc: "الأنشطة اللي مدرسك اسندها لك أو بعتلك رابطها",
          items: [
            { label: "العب بطريقتك", desc: "افتح النشاط وبدّل بين الألعاب (مسابقة، توصيل، كلمات متقاطعة، صيد الذهب، البرج…) من غير ما الأسئلة تتغير" },
            { label: "المساعدات", desc: "في المسابقة: احذف إجابتين، نقاط مضاعفة، أو وقّف الوقت — كل واحدة مرة. و🔊 بيقرالك السؤال بصوت" },
            { label: "الترتيب", desc: "لو مدرسك مفعّله، بعد ما تخلص بتشوف ترتيبك بنسبة الإجابات الصح وبعدين السرعة — وبتتحسب أحسن محاولة ليك في الألعاب اللي فيها تقييم" },
            { label: "رابط المدرس", desc: "الرابط اللي مدرسك يبعته بيفتح على شاشة تسجيل صغيرة: لو إنت طالب عنده سجّل دخولك عشان النتيجة تتسجل في سجلك، ولو لأ اكتب اسمك وموبايلك وفصلك (لو المدرس سامح)" },
            { label: "🔴 المسابقة الحية", desc: "الأنشطة والألعاب ← ادخل مسابقة حية (أو روح /play)، اكتب الكود اللي على شاشة الفصل واسمك، وجاوب من موبايلك — الإجابة الصح الأسرع بتاخد نقط أكتر" },
          ],
        },
        {
          icon: "🃏", title: "الفلاش كارد", desc: "تاب الفلاش كارد في كل درس فيه 4 طرق مذاكرة",
          items: [
            { label: "🧠 تعلّم (تكرار متباعد)", desc: "البطاقة اللي تنساها بترجعلك النهارده، واللي تعرفها بترجع بعد يوم ثم 3 أيام ثم أسبوع ثم 16 يوم لحد ما تتحفظ" },
            { label: "🔗 توصيل و⌨️ اكتب", desc: "لعبة توصيل بالوقت، واختبار تكتب فيه الإجابة" },
            { label: "من غير نت", desc: "الأنشطة والبطاقات اللي فتحتها قبل كده بتشتغل من غير إنترنت" },
          ],
        },
        {
          icon: "🎞️", title: "الفيديوهات التفاعلية", desc: "في تاب 🎬 فيديو في الدرس",
          items: [
            { label: "أسئلة جوه الفيديو", desc: "الفيديو بيقف عند كل سؤال وبتعرف إجابتك صح ولا غلط وليه. والتقديم مش بيعدّي سؤال" },
            { label: "طرق العرض", desc: "بدّل بين المشاهد، أو نص الدرس والجملة اللي بتتقال منوّرة، أو الاتنين. واضغط على أي جملة يروح للحظة اللي اتقالت فيها" },
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
