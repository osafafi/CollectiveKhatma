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
    confirmTitle: 'تأكيد الإجراء',
    confirm: 'تأكيد',
    cancel: 'إلغاء',
    increase: 'زيادة',
    decrease: 'تقليل',
  },
  // Shared feedback-state copy for the React primitives (RM-300): loading,
  // empty, error/retry, snackbar dismissal, and the last-resort crash fallback.
  feedback: {
    loading: 'جارٍ التحميل…',
    empty: 'لا توجد عناصر لعرضها',
    errorTitle: 'تعذّر تحميل البيانات',
    errorBody: 'حدث خطأ أثناء الاتصال. حاول مرة أخرى.',
    retry: 'إعادة المحاولة',
    dismiss: 'إغلاق',
    crashTitle: 'حدث خطأ غير متوقع',
    crashBody: 'نعتذر، حدث خطأ غير متوقع في التطبيق. حاول مرة أخرى.',
  },
  preview: {
    migrationLabel: 'معاينة ترحيل React',
    notProduction: 'هذه معاينة تطوير منفصلة. التطبيق الحالي المنشور لم يتغير.',
    memberHeading: 'معاينة تطبيق الأعضاء',
    adminHeading: 'معاينة لوحة التحكم',
    primitivesHeading: 'المكوّنات المشتركة',
    chartsHeading: 'مخططات التقدّم',
  },
  // Bottom tab bar / side rail (member app). Kept short to fit a tab label.
  nav: {
    khatmas: 'الختمات',
    quran: 'المصحف',
    personal: 'صفحتي',
    settings: 'الإعدادات',
  },
  member: {
    title: 'خَتْمة',
    greeting: 'السلام عليكم ورحمة الله',
    tagline: 'تطبيق ختمة القرآن الجماعية',
    rosterHeading: 'الأعضاء',
    finishedToday: 'انتهيت من قراءة صفحاتي',
    emptyRoster: 'لا يوجد أعضاء بعد',
    connecting: 'جارٍ الاتصال بقاعدة البيانات…',
    connectionError: 'تعذّر الاتصال بقاعدة البيانات. تأكّد من تشغيل المحاكي (emulator).',
    // Identity gate
    choosePrompt: 'اختر اسمك للمتابعة',
    switchPerson: 'لست أنت؟',
    // Navigation / headings
    khatmasHeading: 'ختماتي',
    back: 'رجوع',
    openKhatma: 'فتح الختمة',
    // Current round
    todayHeading: 'صفحاتي في هذه الجولة',
    pagesWord: 'صفحات',
    pageWord: 'صفحة',
    ofWord: 'من',
    roundWord: 'الجولة',
    startedWord: 'بدأت',
    doneToday: 'تم إنجاز صفحات الجولة، جزاك الله خيرًا',
    awaitingDistribution: 'بانتظار توزيع صفحات جديدة',
    noKhatmas: 'لست مشتركًا في أي ختمة حالية.',
    saveError: 'تعذّر حفظ الإنجاز، حاول مرة أخرى.',
    // Warnings (the member sees only their OWN warning, gently worded).
    warningNote:
      'أُعيدت صفحات جولتك السابقة إلى المجموعة. تابعي مع صفحاتك الجديدة عند توزيعها.',
    releasedNote:
      'أُعيدت هذه الصفحات إلى المجموعة وأُسندت لغيرك — انتظري الجولة القادمة.',
    // Insights & progress
    groupProgress: 'تقدّم المجموعة',
    completedRoundCount: 'أتمّوا صفحات الجولة',
    lifetimeLead: 'أتممت قراءة',
    lifetimeTail: 'من ٦٠٤ صفحة من المصحف',
    // Series history
    historyHeading: 'ختمات مكتملة من هذه السلسلة',
    completedOn: 'اكتملت في',
    // Completion
    khatmaComplete: 'اكتملت الختمة، تقبّل الله',
    du3aHeading: 'دعاء ختم القرآن',
    reciterLead: 'يقرأ دعاء ختم القرآن',
    pausedNote: 'أنت في استراحة من الختمة حاليًا، لا توجد صفحات مطلوبة منك',
  },
  personal: {
    heading: 'صفحتي الشخصية',
    myKhatmas: 'ختماتي',
  },
  // In-app mushaf reader — both the free-browse tab and the assigned-pages flow.
  reader: {
    browseTitle: 'المصحف الشريف',
    surah: 'السورة',
    surahHeading: 'سورة',
    juz: 'الجزء',
    page: 'صفحة',
    of: 'من',
    next: 'التالية',
    prev: 'السابقة',
    goToPage: 'انتقال إلى صفحة',
    bismillah: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
    readMyPages: 'اقرأ صفحاتي',
    noPagesToday: 'لا توجد صفحات مطلوبة منك حاليًا',
    finishedReading: 'أتممت قراءة صفحاتي',
    sajda: '۩ سجدة',
  },
  settings: {
    title: 'الإعدادات',
    avatarTitle: 'الصورة الرمزية',
    avatarLabel: 'رمز تعبيري (اختياري)',
    avatarHelper:
      'اختاري رمزًا تعبيريًا واحدًا، أو اتركيه فارغًا لاستخدام الأحرف الأولى من اسمك.',
    avatarPreview: 'معاينة الصورة الرمزية',
    saveAvatar: 'حفظ الصورة الرمزية',
    avatarSaved: 'تم الحفظ',
    avatarSaveError: 'تعذّر حفظ الصورة الرمزية، حاولي مرة أخرى.',
    fontSize: 'حجم خط القراءة',
    sample: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
  },
  admin: {
    title: 'خَتْمة — لوحة التحكم',
    heading: 'لوحة تحكم المشرفة',
    connecting: 'جارٍ الاتصال بقاعدة البيانات…',

    // Tabs
    navHome: 'الرئيسية',
    navRoster: 'الأعضاء',
    navKhatmas: 'الختمات',
    navSettings: 'الإعدادات',

    // Home — per-series metrics + the daily distribution action.
    homeHeading: 'نظرة عامة',
    distribute: 'توزيع صفحات اليوم',
    redistribute: 'إعادة توزيع الصفحات',
    confirmDistribute:
      'توزيع الجولة التالية الآن؟ ستُعاد صفحات من لم يُكمِل إلى المجموعة وسيُنبَّه.',
    distributedToday: 'تم توزيع صفحات اليوم ✓',
    distributeSuccess: 'تم التوزيع',
    confirmRedistribute:
      'إعادة الصفحات الموزعة غير المقروءة إلى المجموعة وتوزيعها من جديد؟ لن تُسحب السور أو الأجزاء الموزعة.',
    redistributeSuccess: 'تمت إعادة توزيع الصفحات',
    alreadyDistributed: 'سبق توزيع صفحات اليوم لهذه الختمة',
    distributeError: 'تعذّر التوزيع، حاولي مرة أخرى',
    rolloverNote: 'اكتملت صفحات الختمة وبدأت الختمة التالية تلقائيًا 🎉',
    completedNote: 'اكتملت الختمة، تقبّل الله 🎉',
    pagesRemaining: 'صفحة متبقية',
    lastDistribution: 'آخر توزيع',
    roundWord: 'الجولة',
    noActive: 'لا توجد ختمات حالية.',
    legendDone: 'قُرئت',
    legendPending: 'قيد القراءة',
    legendRemaining: 'متبقية',
    pageMapHeading: 'خريطة صفحات القرآن',
    pageMapHoldHint: 'اضغطي مطولاً ثم اسحبي للتنقل بين الصفحات',
    pageMapKeyboardHint: 'استخدمي السهمين للتنقل بين الصفحات',
    pageWord: 'الصفحة',
    warningYellowWord: 'تحذير أول',
    warningRedWord: 'تحذير ثانٍ',

    // Roster management
    rosterHeading: 'الأعضاء',
    searchPlaceholder: 'ابحثي بالاسم…',
    noMatches: 'لا نتائج مطابقة',
    addPerson: 'إضافة عضو',
    namePlaceholder: 'الاسم',
    notePlaceholder: 'ملاحظة (اختياري)',
    pagesPerDayLabel: 'صفحة/جولة',
    nameTaken: 'هذا الاسم مستخدم بالفعل',
    nameRequired: 'الرجاء إدخال الاسم',
    rename: 'إعادة تسمية العضو',
    renameHeading: 'تعديل اسم العضو',
    disable: 'إيقاف مؤقت',
    enable: 'تفعيل',
    disabledBadge: 'موقوفة مؤقتًا',
    remove: 'حذف',
    confirmRemove: 'حذف هذا العضو من القائمة؟',
    emptyRoster: 'لا يوجد أعضاء بعد. أضيفي عضوًا للبدء.',

    // Create khatma (series)
    createHeading: 'ختمة جديدة',
    seriesNamePlaceholder: 'اسم الختمة (مثال: أهل القرآن)',
    seriesNameRequired: 'الرجاء إدخال اسم الختمة',
    continuesSeries: 'سيتابع هذا الاسم سلسلته — الختمة رقم',
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
    selectMembers: 'اختاري عضوًا واحدًا على الأقل',
    createError: 'تعذّر إنشاء الختمة، تحقّقي من المدخلات',
    seriesImageLabel: 'صورة سلسلة الختمة',
    chooseSeriesImage: 'اختيار من الصور',
    seriesImageOptional: 'اختيارية · تُستخدم الصورة الافتراضية عند عدم الاختيار',
    selectedSeriesImage: 'الصورة المختارة',
    seriesImageGalleryHeading: 'اختيار صورة سلسلة الختمة',
    useSeriesPlaceholder: 'استخدام الصورة الافتراضية',
    noSeriesImages: 'لا توجد صور إضافية في مجلد صور الختمات بعد.',
    seriesImageAlt: 'صورة سلسلة الختمة',

    // Khatmas list + per-khatma page
    khatmasHeading: 'كل الختمات',
    statusActive: 'جارية',
    statusCompleted: 'مكتملة',
    progressLabel: 'تقدّم المجموعة',
    pendingHeading: 'لم يُكمِلوا صفحاتهم',
    membersProgress: 'إنجاز الأعضاء',
    chunkDone: '✓ أُنجزت',
    chunkPending: 'قيد القراءة',
    chunkReleased: 'أُعيدت للمجموعة',
    noChunk: 'بلا صفحات بعد',
    clearWarning: 'إزالة التحذير',
    undo: 'تراجع',
    markDone: 'تحديد كمنجز',
    addMember: 'إضافة عضو للختمة',
    markComplete: 'إنهاء الختمة',
    confirmComplete: 'إنهاء هذه الختمة ونقلها إلى «السابقة»؟',
    confirmRemoveKhatma: 'حذف هذه الختمة نهائيًا مع كل تكليفاتها؟',
    reciterIs: 'قارئ الدعاء',
    none: 'غير محدد',
    startNext: 'بدء الختمة التالية',
    confirmStartNext: 'بدء الختمة التالية في هذه السلسلة بنفس الأعضاء والنطاق؟',

    // Create flow, per-member capacity, member management, editing
    createNewButton: 'إنشاء ختمة جديدة',
    cancel: 'إلغاء',
    capacityLabel: 'سعة القراءة لكل عضو (صفحات + سور + أجزاء)',
    capacityPages: 'صفحة',
    capacitySurahs: 'سورة',
    capacityJuz: 'جزء',
    noSurah: '—',
    saveCapacity: 'حفظ السعة',
    returnToPool: 'إرجاع الصفحات للمجموعة',
    confirmReturnToPool: 'إرجاع صفحات هذه العضوة غير المقروءة إلى المجموعة؟',
    removeFromKhatma: 'إزالة من الختمة',
    confirmRemoveFromKhatma: 'إزالة هذه العضوة من الختمة؟ ستعود صفحاتها إلى المجموعة.',
    editKhatmaHeading: 'تعديل بيانات الختمة',
    saveKhatma: 'حفظ التعديلات',
    khatmaNumberLabel: 'رقم الختمة',
    createdDateLabel: 'تاريخ الإنشاء',

    // Completed / previous khatmas
    completedHeading: 'الختمات السابقة',
    historyHeading: 'ختمات هذه السلسلة المكتملة',
    noCompleted: 'لا توجد ختمات مكتملة بعد.',
    completedOn: 'اكتملت في',

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
