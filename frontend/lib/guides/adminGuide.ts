import type { GuideSection } from "@/components/help/GuideView";

export function getAdminGuide(locale: "ar" | "en"): { title: string; subtitle: string; sections: GuideSection[] } {
  if (locale === "en") {
    return {
      title: "📘 Admin Guide",
      subtitle: "Everything you can do on the platform and how to use it",
      sections: [
        {
          icon: "📊", title: "Statistics", desc: "Platform overview at a glance",
          items: [
            { label: "Totals", desc: "Total/pending/active users, paying subscribers, and total curricula" },
          ],
        },
        {
          icon: "👨‍🏫", title: "Teachers", desc: "The top of the hierarchy: you create every teacher account",
          items: [
            { label: "+ Add Teacher", desc: "Set their name, email and password yourself, then grant permissions" },
            { label: "Permissions", desc: "AI Assist, PDF Export, Question Bank, Analytics, Channel Links — toggle any combination on independently for each teacher" },
            { label: "Suspend / Activate / Delete", desc: "Deleting a teacher unlinks their students rather than deleting them" },
          ],
        },
        {
          icon: "👥", title: "All Users", desc: "Every account on the platform",
          items: [
            { label: "Approve / Reject", desc: "Self-registered accounts start pending until you approve them" },
            { label: "Plan", desc: "Change a user's subscription plan directly from the dropdown" },
            { label: "Reset Password", desc: "Generate a new temporary password for anyone who's locked out — shown once, they must change it on next login" },
          ],
        },
        {
          icon: "📚", title: "Manage Curricula", desc: "Every curriculum uploaded by every user, platform-wide",
          items: [
            { label: "Search", desc: "By title or by the uploader's name/email" },
            { label: "Delete", desc: "Removes the curriculum and all its lessons permanently" },
          ],
        },
        {
          icon: "💰", title: "Plans & Pricing", desc: "Free-tier limits and paid plan prices — changes apply instantly, no redeploy needed",
          items: [],
        },
        {
          icon: "🏷️", title: "Discount Coupons", desc: "Create percentage-off codes for subscribers, with optional usage caps and expiry dates",
          items: [],
        },
        {
          icon: "🤖", title: "AI Settings", desc: "Control the AI model and RAG behavior without redeploying",
          items: [
            { label: "Model", desc: "Switch between GPT-4o, GPT-4o Mini, Claude 3.5 Sonnet, or Gemini 1.5 Pro" },
            { label: "RAG tuning", desc: "Top-K, chunk size, chunk overlap, and creativity (temperature)" },
          ],
        },
      ],
    };
  }

  return {
    title: "📘 دليل الآدمن",
    subtitle: "كل حاجة تقدر تعملها في المنصة وإزاي تستخدمها",
    sections: [
      {
        icon: "📊", title: "الإحصائيات", desc: "نظرة عامة على المنصة بنظرة واحدة",
        items: [
          { label: "الأرقام الإجمالية", desc: "إجمالي/في الانتظار/نشطين، المشتركون المدفوعون، وإجمالي المناهج" },
        ],
      },
      {
        icon: "👨‍🏫", title: "المعلمون", desc: "قمة الهرم: إنت اللي بتنشئ كل حساب معلم",
        items: [
          { label: "+ إضافة معلم", desc: "حط اسمه وإيميله وباسورده بنفسك، وبعدين حدد صلاحياته" },
          { label: "الصلاحيات", desc: "مساعد AI، تصدير PDF، بنك الأسئلة، التحليلات، روابط القنوات — فعّل أي مجموعة منها لكل معلم بشكل مستقل" },
          { label: "إيقاف / تفعيل / حذف", desc: "حذف المعلم بيلغي ربط طلابه بيه بدل ما يحذفهم" },
        ],
      },
      {
        icon: "👥", title: "جميع المستخدمين", desc: "كل حساب على المنصة",
        items: [
          { label: "موافقة / رفض", desc: "الحسابات اللي بتسجل نفسها بنفسها بتبدأ في انتظار موافقتك" },
          { label: "الخطة", desc: "غيّر خطة اشتراك أي مستخدم مباشرة من القايمة المنسدلة" },
          { label: "إعادة تعيين الباسورد", desc: "ولّد باسورد مؤقت جديد لأي حد قافل حسابه — بيظهر مرة واحدة وهيتطلب يغيّره أول دخول" },
        ],
      },
      {
        icon: "📚", title: "إدارة المناهج", desc: "كل منهج رفعه أي مستخدم على المنصة كلها",
        items: [
          { label: "البحث", desc: "بالعنوان أو باسم/إيميل صاحب المنهج" },
          { label: "حذف", desc: "بيشيل المنهج وكل دروسه نهائيًا" },
        ],
      },
      {
        icon: "💰", title: "الخطط والأسعار", desc: "حدود الخطة المجانية وأسعار الخطط المدفوعة — التغييرات بتتطبق فورًا من غير إعادة نشر",
        items: [],
      },
      {
        icon: "🏷️", title: "كوبونات الخصم", desc: "أنشئ أكواد خصم بالنسبة المئوية للمشتركين، مع حد استخدام وتاريخ انتهاء اختياريين",
        items: [],
      },
      {
        icon: "🤖", title: "إعدادات AI", desc: "تحكم في نموذج الذكاء الاصطناعي وسلوك RAG من غير إعادة نشر",
        items: [
          { label: "النموذج", desc: "بدّل بين GPT-4o، GPT-4o Mini، Claude 3.5 Sonnet، أو Gemini 1.5 Pro" },
          { label: "ضبط RAG", desc: "Top-K، حجم القطعة، التداخل، ودرجة الإبداع (Temperature)" },
        ],
      },
    ],
  };
}
