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
  },
  settings: {
    title: 'الإعدادات',
    fontSize: 'حجم خط القراءة',
    sample: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
  },
  admin: {
    title: 'خَتْمة — لوحة التحكم',
    heading: 'لوحة تحكم المشرفة',
    placeholder: 'ستُبنى لوحة التحكم في مرحلة لاحقة.',
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
