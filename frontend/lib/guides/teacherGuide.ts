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
            { label: "A student who already has an account", desc: "Students can study with several teachers. If they already have an account (with another teacher), they add you themselves from their account using your join code — then they appear here. You only see their work with you" },
            { label: "AI Assist toggle", desc: "Only visible if the admin granted you this permission — lets a specific student get AI hints during exams" },
          ],
        },
        {
          icon: "🧑‍🤝‍🧑", title: "My Groups", desc: "Reusable named groups of your students (e.g. a class)",
          items: [
            { label: "Create a group", desc: "Pick any of your students once and reuse the group whenever you target an assignment — editing a group later never changes who was already assigned past exams" },
          ],
        },
        {
          icon: "📝", title: "Assignments", desc: "Create a timed exam or practice for specific students, on your schedule",
          items: [
            { label: "Who gets it", desc: "Pick individual students and/or a saved group — each targeted student gets their own attempt" },
            { label: "What it covers", desc: "Choose the curriculum, exam type (lesson/unit/comprehensive), and optionally a specific unit/lesson — questions come first from anything already extracted or published for that scope, then AI fills in the rest" },
            { label: "Time limit", desc: "Leave it blank to use the curriculum's configured duration, or set a custom number of minutes just for this one assignment" },
            { label: "Scheduling", desc: "Optional \"opens at\" and \"due by\" dates — the student can't start it outside that window" },
            { label: "Allow multiple attempts", desc: "Off by default for \"exam\", on by default for \"practice\" — toggle either way" },
            { label: "Auto-reveal score", desc: "If off, essay questions wait in your Needs Review queue; if on, essay is graded by AI immediately and the student sees their full result right away" },
            { label: "Roster view", desc: "Open the assignment to see every targeted student and their attempt status" },
          ],
        },
        {
          icon: "🎮", title: "Games & Activities", desc: "Write questions once, play them as many games, assign them, print them",
          items: [
            { label: "Create an activity", desc: "Games & Activities → New activity. Type questions and answers, quick-paste one per line (question | answer | wrong option…), take them from a lesson's flashcards, or 🤖 generate them with AI from the lesson text" },
            { label: "11 games, one click apart", desc: "Quiz, speed true/false, match up, flashcards, anagram, crossword, spell it, random wheel, gold quest, build the tower, and the team board (one screen for the whole class, teams take turns)" },
            { label: "🖨️ Print / PDF", desc: "Quiz, match, crossword, anagram, true/false and cut-out cards print as a worksheet with an optional answer key" },
            { label: "🌍 Public library", desc: "Share your activity with other teachers, or copy theirs into your own and edit it" },
            { label: "📝 Assign tab", desc: "Make it homework for all your students or one group, with a due date and seconds per question. Options: power-ups (50/50, double points, freeze time), 🧘 calm mode for older students (no sounds/memes/animations) and a hard time limit for game modes" },
            { label: "📊 Report tab", desc: "The leaderboard, each student's best score and time, the accuracy of every question, the hardest questions and the most common wrong answer" },
            { label: "From a lesson", desc: "The 🎮 Games tab on any lesson lists its activities and has a button to make one from that lesson" },
          ],
        },
        {
          icon: "🔗", title: "Share Link & Leaderboard", desc: "Send one link — students play and get ranked by score and speed",
          items: [
            { label: "Turn the link on", desc: "Open the activity → 🔗 Share tab → Share link. Copy it, send it on WhatsApp, or show the QR code" },
            { label: "You control it", desc: "Switch the link off any time; 🔄 New link kills the old one immediately" },
            { label: "Who can open it", desc: "\"Open to anyone\": the link opens a sign-up screen — your registered students sign in (the result goes to their record), anyone else enters name, mobile and class. A mobile number that belongs to one of your students must sign in, so nobody can submit under a student's name. Off: only your registered students" },
            { label: "Leaderboard", desc: "Ranked by % correct, then the faster time, then points — each player's best attempt in the assessed games counts (flashcards, wheel, gold quest and tower are practice only). Choose whether players see it after finishing; you always see it in the report" },
          ],
        },
        {
          icon: "📒", title: "Results Records", desc: "Everyone who played your activities, in one place",
          items: [
            { label: "Who's in it", desc: "Your students and everyone who signed up through a share link, with mobile and class — filter or search, open a row for each activity's best % and time" },
            { label: "➕ Add to my students", desc: "Turns a share-link participant into your student: creates the account with their mobile (temporary password shown once) and moves all their past results into their record" },
            { label: "Student record", desc: "Each student's page now lists their games & activities results next to their exams" },
          ],
        },
        {
          icon: "🔴", title: "Live Game", desc: "A live class competition: questions on your screen, answers from phones",
          items: [
            { label: "Start", desc: "Open any activity → 🔴 Live game. Show the screen: students join at /play with the PIN or the QR code — no account needed" },
            { label: "Scoring", desc: "Correct answers score more the faster they come, with a streak bonus. After each question you see the answer distribution and the leaderboard; the podium at the end" },
            { label: "Control", desc: "The answer is revealed when time runs out or everyone has answered (or press Reveal). Click a player's name in the lobby to remove them (e.g. an inappropriate nickname). 🔊 mutes the music" },
            { label: "Results", desc: "Signed-in students' scores are saved to the activity's report" },
          ],
        },
        {
          icon: "🎞️", title: "Interactive Videos", desc: "Turn a lesson (or a whole unit) into an interactive video — from the lesson's 🎬 Video tab",
          items: [
            { label: "🤖 AI", desc: "Script taken from the lesson text itself (or a free explanation), narrated scene by scene, with questions between scenes" },
            { label: "🎙️ Podcast", desc: "Record your voice in the browser or upload audio — slides follow what you say and questions land in the right places" },
            { label: "📤 Upload a video", desc: "Your own video with interactive questions inside (written by AI or by you)" },
            { label: "🔊 Voices", desc: "6 Arabic narration voices for AI videos — 3 female and 3 male teachers (firm, calm, upbeat, deep…). The free plan voices about 40 scenes a day; past that the rest of the day's scenes use one standard voice" },
            { label: "Visuals for every subject", desc: "Animated chemical equations, organ diagrams that light up part by part, graphs, timelines, maps, sentence parsing, comparisons, definitions, real illustrations" },
            { label: "📖 Lesson-text view", desc: "Show the lesson text itself with the sentence being said lit up — alone or under the scenes" },
            { label: "Review & publish", desc: "Edit the questions, scenes and narration, then publish — students see it only after publishing" },
          ],
        },
        {
          icon: "📋", title: "Needs Review", desc: "Grade the exams your students submitted",
          items: [
            { label: "Manual grading", desc: "Essay always lands here, plus any question (of any type) whose source had no known correct answer — those are never auto-graded or guessed, even if a student's answer looks right" },
            { label: "🤖 AI Suggestion", desc: "Get a suggested score and reasoning before you decide — for MCQ/true-false/fill-blank it also shows the options the student was choosing from" },
            { label: "Decision", desc: "Approve, reject, or request revision — the student is notified either way" },
          ],
        },
        {
          icon: "📚", title: "Manage My Curricula", desc: "Your own curricula, separate from your students'",
          items: [
            { label: "Upload", desc: "PDF/image, auto-processed into units and lessons" },
            { label: "Content type: Curriculum vs Exam", desc: "\"Curriculum\" is teaching material (chunked for AI explanations/questions). \"Exam\" is an already-written exam paper — its real questions and answers are extracted verbatim instead of AI-generated, and shown as reviewable question cards, not a raw scanned page" },
            { label: "Delete", desc: "🗑️ on any curriculum card — removes it and everything under it (units, lessons, extracted questions, indexed content); can't be undone" },
            { label: "Delete one extracted question", desc: "On an exam paper's question list, 🗑️ removes just that one bad extraction" },
          ],
        },
        {
          icon: "🗂️", title: "Question Bank", desc: "Build a reusable pool of questions that automatically feeds your students' practices and exams",
          items: [
            { label: "Generate from Curriculum", desc: "Pick a curriculum (and optionally a unit/lesson) as the source — for an \"exam\"-type curriculum this pulls the verbatim-extracted questions, otherwise the AI generates new ones from the content" },
            { label: "Review, then pick a destination", desc: "Select which of the generated/extracted questions to keep, then choose the curriculum/unit/lesson to attach them to — this can be a different curriculum than the source, e.g. extracting an exam paper's questions and pooling them under your real teaching curriculum" },
            { label: "Why this matters", desc: "Once published, these questions are pulled automatically whenever a student (or an assignment) generates a practice/exam matching that curriculum/unit/lesson — before any new AI generation happens" },
            { label: "📋 No answer", desc: "If an exam paper never printed an answer for a question, extraction leaves it blank rather than guessing — the system never auto-grades that question for any student, no matter its type; it's flagged here and always routed to your Needs Review queue instead, exactly like essay" },
            { label: "Publish a question manually", desc: "Type one in yourself and make it available to the community" },
            { label: "Browse & filter", desc: "Search the shared bank by type, difficulty, curriculum, unit, and lesson" },
            { label: "Delete", desc: "🗑️ on any question you published, with a confirmation" },
          ],
        },
        {
          icon: "⚙️", title: "Exam Settings", desc: "The default question counts, time limit, and points per exam type/curriculum — editable by the admin only",
          items: [
            { label: "Per-assignment override", desc: "When creating an assignment you can still set a custom time limit just for that one exam, without changing these defaults" },
          ],
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
          { label: "طالب عنده حساب بالفعل", desc: "الطالب يقدر يذاكر مع أكتر من مدرس. لو عنده حساب (عند مدرس تاني)، هو اللي بيضيفك من حسابه بكود الانضمام بتاعك — وبعدها يظهر هنا. وإنت بتشوف شغله معاك بس" },
          { label: "زرار AI Assist", desc: "بيظهر بس لو الآدمن دّاك الصلاحية دي — بيخلي طالب معيّن ياخد تلميحات AI في الامتحانات" },
        ],
      },
      {
        icon: "🧑‍🤝‍🧑", title: "مجموعاتي", desc: "مجموعات محفوظة وقابلة لإعادة الاستخدام من طلابك (زي فصل دراسي)",
        items: [
          { label: "عمل مجموعة", desc: "اختار طلابك مرة واحدة واستخدم المجموعة كل ما احتجت تستهدفها بتكليف — تعديل المجموعة بعد كده مبيأثرش على مين كان مستهدف في امتحانات سابقة" },
        ],
      },
      {
        icon: "📝", title: "التكليفات", desc: "اعمل امتحان أو تدريب محدد المدة لطلاب معيّنين، في الميعاد اللي تحدده",
        items: [
          { label: "لمين", desc: "اختار طلاب بالاسم و/أو مجموعة محفوظة — كل طالب مستهدف ياخد محاولته الخاصة" },
          { label: "بيغطي إيه", desc: "اختار المنهج، نوع الامتحان (درس/وحدة/شامل)، واختياريًا وحدة/درس معيّن — الأسئلة بتيجي الأول من أي حاجة مستخلصة أو منشورة لنفس النطاق، وبعدين الذكاء الاصطناعي يكمّل الباقي" },
          { label: "مدة الاختبار", desc: "سيبها فاضية عشان تاخد المدة المضبوطة على المنهج، أو حدد عدد دقائق مخصص للتكليف ده بس" },
          { label: "الجدولة", desc: "ميعاد فتح وميعاد تسليم اختياريين — الطالب مش هيقدر يبدأ برّه الفترة دي" },
          { label: "السماح بمحاولات متعددة", desc: "مقفول افتراضيًا لو النوع \"امتحان\"، ومفتوح افتراضيًا لو \"تدريب\" — تقدر تغيّرها" },
          { label: "كشف الدرجة تلقائيًا", desc: "لو مقفول، الأسئلة المقالية بتستنى في قائمة \"تحتاج مراجعة\" عندك؛ لو مفتوح، بتتصحح فورًا بالذكاء الاصطناعي والطالب بيشوف نتيجته كاملة على طول" },
          { label: "عرض القائمة", desc: "افتح التكليف عشان تشوف كل طالب مستهدف وحالة محاولته" },
        ],
      },
        {
          icon: "🎮", title: "الأنشطة والألعاب", desc: "اكتب الأسئلة مرة واحدة والعبها بكذا لعبة، واسندها واجب، واطبعها",
          items: [
            { label: "عمل نشاط", desc: "الأنشطة والألعاب ← نشاط جديد. اكتب الأسئلة وإجاباتها، أو الصقها بسرعة سطر لكل سؤال (السؤال | الإجابة | اختيار غلط…)، أو خدها من فلاش كارد الدرس، أو 🤖 ولّدها بالذكاء الاصطناعي من نص الدرس" },
            { label: "11 لعبة بضغطة", desc: "مسابقة، صح وخطأ سريع، توصيل، بطاقات، رتّب الحروف، كلمات متقاطعة، اكتب الإجابة، العجلة العشوائية، صيد الذهب، ابني البرج، ولوحة الفرق (شاشة واحدة للفصل كله والفرق بتتبادل الأدوار)" },
            { label: "🖨️ طباعة / PDF", desc: "المسابقة والتوصيل والكلمات المتقاطعة ورتّب الحروف وصح وخطأ والبطاقات بتتطبع ورقة عمل ومعاها نموذج إجابة لو حبيت" },
            { label: "🌍 المكتبة العامة", desc: "شارك نشاطك مع مدرسين تانيين، أو انسخ نشاط مدرس تاني لأنشطتك وعدّل فيه" },
            { label: "📝 تاب الإسناد", desc: "اسنده واجب لكل طلابك أو لمجموعة، بآخر موعد ووقت لكل سؤال. واختيارات: المساعدات (احذف إجابتين، نقاط مضاعفة، وقّف الوقت)، 🧘 وضع هادئ للمراحل الكبيرة (من غير أصوات ولا رسائل تشجيع ولا حركات)، وحد زمني صارم لألعاب اللعب" },
            { label: "📊 تاب التقرير", desc: "لوحة الترتيب، وأحسن نتيجة ووقت لكل طالب، ونسبة الإجابة الصح لكل سؤال، وأصعب الأسئلة وأكتر إجابة غلط" },
            { label: "من الدرس", desc: "تاب 🎮 ألعاب في أي درس بيعرض أنشطته، وفيه زرار تعمل نشاط من الدرس ده" },
          ],
        },
        {
          icon: "🔗", title: "رابط المشاركة والترتيب", desc: "ابعت رابط واحد — الطلاب يحلوا ويترتبوا بالدرجة والسرعة",
          items: [
            { label: "فعّل الرابط", desc: "افتح النشاط ← تاب 🔗 مشاركة ← رابط مشاركة. انسخه أو ابعته واتساب أو اعرض كود QR" },
            { label: "إنت المتحكم", desc: "تقفل الرابط في أي وقت، و🔄 رابط جديد بيلغي القديم فوراً" },
            { label: "مين يقدر يفتحه", desc: "«مسموح لأي حد»: الرابط بيفتح على شاشة تسجيل — طالبك المسجّل يدخل بحسابه (والنتيجة تروح سجله)، وأي حد تاني يكتب اسمه وموبايله وفصله. ولو الرقم بتاع طالب عندك لازم يسجّل دخول، عشان محدش يحل باسم طالب. لو قفلته: طلابك المسجلين بس" },
            { label: "الترتيب", desc: "بنسبة الإجابات الصح، ولو اتساووا الأسرع، وبعدين النقاط — وبتتحسب أحسن محاولة لكل واحد في الألعاب اللي فيها تقييم (البطاقات والعجلة وصيد الذهب والبرج للتدريب بس). تختار يظهر للطلاب بعد ما يخلصوا ولا لأ، وإنت بتشوفه دايماً في التقرير" },
          ],
        },
        {
          icon: "📒", title: "سجل النتائج", desc: "كل اللي حلّوا أنشطتك في مكان واحد",
          items: [
            { label: "مين فيه", desc: "طلابك وكل اللي سجّلوا من رابط المشاركة، بالموبايل والفصل — فلتر أو دوّر، وافتح أي صف تشوف أحسن نسبة ووقت في كل نشاط" },
            { label: "➕ أضفه لطلابي", desc: "يحوّل اللي سجّل من الرابط لطالب عندك: يعمل حسابه برقم موبايله (كلمة سر مؤقتة بتظهر مرة واحدة) وينقل كل نتايجه القديمة لسجله" },
            { label: "سجل الطالب", desc: "صفحة كل طالب بقت بتعرض نتايج الأنشطة والألعاب جنب الامتحانات" },
          ],
        },
        {
          icon: "🔴", title: "المسابقة الحية", desc: "مسابقة جماعية مباشرة: الأسئلة على شاشتك والإجابة من الموبايل",
          items: [
            { label: "البداية", desc: "افتح أي نشاط ← 🔴 مسابقة حية. اعرض الشاشة، والطلاب يدخلوا على /play بالكود أو كود QR من غير حساب" },
            { label: "النقاط", desc: "الإجابة الصح بتاخد نقط أكتر كل ما تكون أسرع، ومكافأة للإجابات الصح ورا بعض. بعد كل سؤال بيظهر توزيع الإجابات والترتيب، وفي الآخر منصة الأبطال" },
            { label: "التحكم", desc: "الإجابة بتنكشف لما الوقت يخلص أو كل الطلاب يجاوبوا (أو اضغط اكشف). اضغط على اسم لاعب في شاشة الانتظار عشان تطرده (مثلاً لو كتب اسم غير لائق). 🔊 بيكتم الموسيقى" },
            { label: "النتايج", desc: "نتايج الطلاب المسجلين بتتحفظ في تقرير النشاط" },
          ],
        },
        {
          icon: "🎞️", title: "الفيديوهات التفاعلية", desc: "حوّل الدرس (أو الفصل كله) لفيديو تفاعلي — من تاب 🎬 فيديو في الدرس",
          items: [
            { label: "🤖 بالذكاء الاصطناعي", desc: "السكريبت من نص الدرس نفسه (أو شرح حر)، وتعليق صوتي لكل مشهد، وأسئلة بين المشاهد" },
            { label: "🎙️ بودكاست", desc: "سجّل صوتك من المتصفح أو ارفع ملف صوتي — الشرائح بتتغير مع كلامك والأسئلة بتظهر في مكانها" },
            { label: "📤 رفع فيديو", desc: "فيديو من عندك وجواه أسئلة تفاعلية (بالذكاء الاصطناعي أو تكتبها إنت)" },
            { label: "🔊 الأصوات", desc: "6 أصوات عربي للتعليق في فيديو الذكاء الاصطناعي — 3 مدرّسات و3 مدرّسين (حازم، هادئ، حماسي، رزين…). الخطة المجانية بتكفي حوالي 40 مشهد في اليوم، وبعدها باقي مشاهد اليوم بتتقرا بصوت واحد عادي" },
            { label: "عرض بصري لكل المواد", desc: "معادلات كيميائية متحركة، رسم الأعضاء والأجهزة وكل جزء بينوّر، رسم الدوال، خطوط زمنية، خرايط، إعراب الجمل، مقارنات، تعريفات، ورسوم توضيحية" },
            { label: "📖 عرض نص الدرس", desc: "اعرض نص الدرس نفسه والجملة اللي بتتقال منوّرة — لوحده أو تحت المشاهد" },
            { label: "المراجعة والنشر", desc: "عدّل الأسئلة والمشاهد والتعليق الصوتي وبعدين انشر — الطلاب مش بيشوفوه غير بعد النشر" },
          ],
        },
      {
        icon: "📋", title: "تحتاج مراجعة", desc: "صحّح امتحانات طلابك",
        items: [
          { label: "التصحيح اليدوي", desc: "المقالي بيوصل هنا دايمًا، وكمان أي سؤال (أي نوع) مالوش إجابة معروفة في مصدره — دول مش بيتصححوا تلقائي أو يتخمّن عليهم أبدًا، حتى لو إجابة الطالب شكلها صح" },
          { label: "🤖 اقتراح ذكاء اصطناعي", desc: "خد درجة مقترحة وسبب قبل ما تقرر — لو السؤال اختيار من متعدد/صح وخطأ/فراغ بيوريك الخيارات اللي الطالب كان بيختار منها كمان" },
          { label: "القرار", desc: "موافقة، رفض، أو طلب مراجعة — الطالب بيتبلّغ في الحالتين" },
        ],
      },
      {
        icon: "📚", title: "إدارة مناهجي", desc: "مناهجك الخاصة، منفصلة عن مناهج طلابك",
        items: [
          { label: "رفع منهج", desc: "PDF أو صورة، بيتحلل تلقائيًا لوحدات ودروس" },
          { label: "نوع المحتوى: منهج ولا امتحان", desc: "\"منهج\" ده مادة تعليمية (بتتقسم للذكاء الاصطناعي يشرحها ويولّد منها أسئلة). \"امتحان\" ده ورقة امتحان مكتوبة بالفعل — أسئلتها وإجاباتها الحقيقية بتتستخلص حرفيًا بدل ما تتولّد، وبتتعرض كـكروت أسئلة قابلة للمراجعة مش كصفحة ممسوحة ضوئيًا" },
          { label: "حذف منهج", desc: "🗑️ على أي كارت منهج — بيمسحه وكل اللي تحته (وحدات، دروس، أسئلة مستخلصة، محتوى مفهرس)؛ الإجراء ده نهائي" },
          { label: "حذف سؤال مستخلص لوحده", desc: "في قائمة أسئلة ورقة الامتحان، 🗑️ بيمسح الاستخلاص الغلط ده بس" },
        ],
      },
      {
        icon: "🗂️", title: "بنك الأسئلة", desc: "ابني مخزون أسئلة قابل لإعادة الاستخدام يغذّي تدريبات وامتحانات طلابك أوتوماتيك",
        items: [
          { label: "توليد من المنهج", desc: "اختار منهج (واختياريًا وحدة/درس) كمصدر — لو المنهج نوعه \"امتحان\" بيسحب الأسئلة المستخلصة حرفيًا، لو منهج عادي الذكاء الاصطناعي بيولّد أسئلة جديدة من محتواه" },
          { label: "راجع، وبعدين اختار الوجهة", desc: "حدد أي الأسئلة المولّدة/المستخلصة عايز تحتفظ بيها، وبعدين اختار المنهج/الوحدة/الدرس اللي عايز تربطها بيه — ممكن يكون منهج مختلف عن المصدر، زي استخلاص أسئلة ورقة امتحان وربطها بمنهجك الحقيقي" },
          { label: "ليه ده مهم", desc: "بمجرد النشر، الأسئلة دي بتتسحب أوتوماتيك أول ما طالب (أو تكليف) يعمل تدريب/امتحان على نفس المنهج/الوحدة/الدرس — قبل أي توليد جديد بالذكاء الاصطناعي" },
          { label: "📋 من غير إجابة", desc: "لو ورقة الامتحان ملقتش فيها إجابة مكتوبة لسؤال معيّن، الاستخلاص بيسيبها فاضية بدل ما يخمّن — والنظام مش هيصحح السؤال ده تلقائي لأي طالب مهما كان نوعه، بيتعلّم عليه هنا وبيتحول لقائمة \"تحتاج مراجعة\" عندك زي المقالي بالظبط" },
          { label: "نشر سؤال يدويًا", desc: "اكتب سؤال بنفسك واجعله متاح للمجتمع" },
          { label: "تصفّح وفلترة", desc: "دوّر في المكتبة المشتركة حسب النوع، الصعوبة، المنهج، الوحدة، والدرس" },
          { label: "حذف", desc: "🗑️ على أي سؤال نشرته، مع تأكيد قبل الحذف" },
        ],
      },
      {
        icon: "⚙️", title: "إعدادات الامتحانات", desc: "عدد الأسئلة الافتراضي، مدة الاختبار، والدرجات لكل نوع امتحان/منهج — التعديل للآدمن بس",
        items: [
          { label: "استثناء لكل تكليف", desc: "لما تعمل تكليف، لسه تقدر تحدد مدة مخصصة للامتحان ده بس، من غير ما تغيّر الإعدادات العامة دي" },
        ],
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
