export interface InstallGuidance {
  environment: string;
  steps: readonly string[];
}

interface InstallEnvironment {
  userAgent: string;
  maxTouchPoints?: number;
}

/** Browser-specific manual installation steps when no native prompt is exposed. */
export function getInstallGuidance({
  userAgent,
  maxTouchPoints = 0,
}: InstallEnvironment): InstallGuidance {
  const ios =
    /iPad|iPhone|iPod/i.test(userAgent) ||
    (/Macintosh/i.test(userAgent) && maxTouchPoints > 1);
  const android = /Android/i.test(userAgent);
  const samsung = /SamsungBrowser/i.test(userAgent);
  const firefox = /Firefox|FxiOS/i.test(userAgent);
  const edge = /EdgA|EdgiOS|Edg\//i.test(userAgent);
  const chrome = /Chrome|CriOS/i.test(userAgent) && !edge && !samsung;

  if (ios) {
    const browser = firefox
      ? 'فايرفوكس على iPhone أو iPad'
      : chrome
        ? 'كروم على iPhone أو iPad'
        : edge
          ? 'إيدج على iPhone أو iPad'
          : 'سفاري على iPhone أو iPad';

    return {
      environment: browser,
      steps: [
        'اضغط زر المشاركة في شريط المتصفح. إذا لم يظهر، افتح قائمة المتصفح ثم اختر «مشاركة».',
        'مرّر لأسفل واختر «إضافة إلى الشاشة الرئيسية».',
        'فعّل «فتح كتطبيق ويب» إذا ظهر هذا الخيار.',
        'اضغط «إضافة».',
      ],
    };
  }

  if (android && samsung) {
    return {
      environment: 'متصفح سامسونج على أندرويد',
      steps: [
        'اضغط زر القائمة ☰ أسفل المتصفح.',
        'اختر «إضافة الصفحة إلى»، ثم «الشاشة الرئيسية».',
        'اضغط «إضافة».',
      ],
    };
  }

  if (android && firefox) {
    return {
      environment: 'فايرفوكس على أندرويد',
      steps: [
        'اضغط قائمة ⋮ بجانب شريط العنوان.',
        'اختر «تثبيت» أو «إضافة إلى الشاشة الرئيسية».',
        'اضغط «تثبيت» أو «إضافة» للتأكيد.',
      ],
    };
  }

  if (android && edge) {
    return {
      environment: 'إيدج على أندرويد',
      steps: ['اضغط قائمة ⋮ أسفل المتصفح.', 'اختر «إضافة إلى الهاتف»، ثم «تثبيت».'],
    };
  }

  if (android && chrome) {
    return {
      environment: 'كروم على أندرويد',
      steps: [
        'اضغط قائمة ⋮ بجانب شريط العنوان.',
        'اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».',
        'اضغط «تثبيت» أو «إضافة» للتأكيد.',
      ],
    };
  }

  if (android) {
    return {
      environment: 'متصفح على أندرويد',
      steps: [
        'افتح قائمة المتصفح.',
        'اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».',
        'اضغط «تثبيت» أو «إضافة» للتأكيد.',
      ],
    };
  }

  return {
    environment: 'هذا المتصفح',
    steps: [
      'افتح قائمة المتصفح وابحث عن «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».',
      'إذا لم يظهر الخيار، افتح هذه الصفحة من الهاتف في سفاري أو كروم أو فايرفوكس أو متصفح سامسونج.',
    ],
  };
}
