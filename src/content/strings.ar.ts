/**
 * Centralized Arabic UI copy — the single source of user-facing text
 * (REQUIREMENTS §3: no hardcoded strings baked into HTML). Import from here;
 * never scatter copy across the UI or HTML.
 *
 * Wording is a first draft, to be refined with the admin.
 */
export const strings = {
  common: {
    appName: 'خَتْمة',
    done: 'تم',
    loading: 'جارٍ التحميل…',
  },
  member: {
    title: 'خَتْمة',
    greeting: 'السلام عليكم ورحمة الله',
    tagline: 'تطبيق ختمة القرآن الجماعية',
    rosterHeading: 'الأعضاء',
    finishedToday: 'انتهيت من قراءة صفحاتي اليوم',
    emptyRoster: 'لا يوجد أعضاء بعد',
    connecting: 'جارٍ الاتصال بقاعدة البيانات…',
    connectionError: 'تعذّر الاتصال بقاعدة البيانات. تأكّد من تشغيل المحاكي (emulator).',
    // Identity gate
    choosePrompt: 'اختر اسمك للمتابعة',
    switchPerson: 'لست أنت؟',
    // Today view
    todayHeading: 'صفحات اليوم',
    pagesWord: 'صفحات',
    pageWord: 'صفحة',
    dayWord: 'اليوم',
    ofWord: 'من',
    daysLeft: 'أيام متبقية',
    oneDayLeft: 'باقٍ يوم واحد',
    doneToday: 'تم إنجاز صفحات اليوم، جزاك الله خيرًا',
    notStarted: 'لم تبدأ هذه الختمة بعد',
    ended: 'انتهت هذه الختمة',
    noKhatmas: 'لست مشتركًا في أي ختمة حالية.',
    saveError: 'تعذّر حفظ الإنجاز، حاول مرة أخرى.',
    // Insights & progress
    groupProgress: 'تقدّم المجموعة',
    completedTodayCount: 'أتمّوا اليوم',
    lifetimeLead: 'أتممت قراءة',
    lifetimeTail: 'من ٦٠٤ صفحة من المصحف',
    // Completion
    khatmaComplete: 'اكتملت الختمة، تقبّل الله',
    du3aHeading: 'دعاء ختم القرآن',
    reciterLead: 'يقرأ دعاء ختم القرآن',
    pausedNote: 'أنت في استراحة من الختمة حاليًا، لا توجد صفحات مطلوبة منك',
  },
  settings: {
    title: 'الإعدادات',
    fontSize: 'حجم خط القراءة',
    sample: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
  },
  admin: {
    title: 'خَتْمة — لوحة التحكم',
    heading: 'لوحة تحكم المشرفة',
    connecting: 'جارٍ الاتصال بقاعدة البيانات…',

    // Roster management
    rosterHeading: 'الأعضاء',
    addPerson: 'إضافة عضو',
    namePlaceholder: 'الاسم',
    notePlaceholder: 'ملاحظة (اختياري)',
    pagesPerDayLabel: 'صفحة/يوم',
    nameTaken: 'هذا الاسم مستخدم بالفعل',
    nameRequired: 'الرجاء إدخال الاسم',
    disable: 'إيقاف مؤقت',
    enable: 'تفعيل',
    disabledBadge: 'موقوفة مؤقتًا',
    remove: 'حذف',
    confirmRemove: 'حذف هذا العضو من القائمة؟',
    emptyRoster: 'لا يوجد أعضاء بعد. أضيفي عضوًا للبدء.',

    // Create khatma
    createHeading: 'ختمة جديدة',
    khatmaNamePlaceholder: 'اسم الختمة (اختياري)',
    durationLabel: 'عدد الأيام',
    startDateLabel: 'تاريخ البدء',
    scopeLabel: 'النطاق',
    scopeFull: 'المصحف كامل',
    scopeRange: 'نطاق صفحات',
    scopeSurahs: 'سور محددة',
    fromPage: 'من صفحة',
    toPage: 'إلى صفحة',
    surahsPlaceholder: 'أرقام السور مفصولة بفواصل (مثال: 2،3،4)',
    membersLabel: 'الأعضاء المشاركون',
    reciterLabel: 'قارئ دعاء الختم',
    reciterAuto: 'تلقائيًا (بالتناوب)',
    createButton: 'إنشاء الختمة',
    coverageCovered: 'كل صفحات النطاق مغطاة',
    coverageShort: 'صفحة بدون تكليف (الطاقة لا تكفي النطاق)',
    selectMembers: 'اختاري عضوًا واحدًا على الأقل',
    createError: 'تعذّر إنشاء الختمة، تحقّقي من المدخلات',

    // Active dashboard
    activeHeading: 'الختمات الحالية',
    noActive: 'لا توجد ختمات حالية.',
    dayWord: 'اليوم',
    ofWord: 'من',
    daysLeft: 'أيام متبقية',
    oneDayLeft: 'باقٍ يوم واحد',
    notStarted: 'لم تبدأ بعد',
    ended: 'انتهت',
    progressLabel: 'تقدّم المجموعة',
    pendingHeading: 'لم يُكمِلوا صفحاتهم',
    finalStretch: '⚠ اقتربت النهاية',
    leftoverHeading: 'صفحات بدون تكليف',
    leftoverHint: 'اقرئيها بنفسك أو كلّفي بها متطوعًا',
    assignTo: 'تكليف بها',
    regenerate: 'إعادة توزيع الأيام المتبقية',
    regenerated: 'تمت إعادة التوزيع',
    regenerateEnded: 'لا توجد أيام قادمة لإعادة توزيعها',
    markComplete: 'إنهاء الختمة',
    confirmComplete: 'إنهاء هذه الختمة ونقلها إلى «السابقة»؟',
    anonymousOn: 'الأسماء مخفية عن الأعضاء',
    anonymousOff: 'الأسماء ظاهرة للأعضاء',
    reciterIs: 'قارئ الدعاء',
    none: 'غير محدد',
    membersProgress: 'إنجاز الأعضاء',
    undo: 'تراجع',
    markDone: 'تحديد كمنجز',

    // Completed / previous khatmas
    completedHeading: 'الختمات السابقة',
    noCompleted: 'لا توجد ختمات مكتملة بعد.',
    durationWord: 'مدة',
    daysWord: 'يوم',
    restart: 'دورة جديدة',
    confirmRestart: 'بدء دورة جديدة بنفس الأعضاء والنطاق؟',

    // Du3a editor
    du3aEditorHeading: 'نص دعاء ختم القرآن',
    save: 'حفظ',
    saved: 'تم الحفظ',
    saveError: 'تعذّر الحفظ، حاول مرة أخرى',
  },
  quran: {
    sampleHeading: 'سورة الفاتحة',
    loadError: 'تعذّر تحميل نص المصحف.',
  },
} as const;

/**
 * Starter du3a2 al-khatma to pre-fill for the admin, who can edit it at any
 * time (REQUIREMENTS §7, §10). Stored in Firestore at `content/global`; this
 * constant is only the initial seed value.
 */
export const DEFAULT_DU3A_TEXT =
  'اللَّهُمَّ ارْحَمْنِي بِالْقُرْآنِ، وَاجْعَلْهُ لِي إِمَامًا وَنُورًا وَهُدًى وَرَحْمَةً. ' +
  'اللَّهُمَّ ذَكِّرْنِي مِنْهُ مَا نُسِّيتُ، وَعَلِّمْنِي مِنْهُ مَا جَهِلْتُ، ' +
  'وَارْزُقْنِي تِلَاوَتَهُ آنَاءَ اللَّيْلِ وَأَطْرَافَ النَّهَارِ، ' +
  'وَاجْعَلْهُ لِي حُجَّةً يَا رَبَّ الْعَالَمِينَ.';

export type Strings = typeof strings;
