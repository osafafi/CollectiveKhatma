import { describe, expect, it } from 'vitest';
import { getInstallGuidance } from '@/app/member/install/installGuidance';

describe('member install guidance', () => {
  it('recognizes Safari and Chromium-branded browsers on iOS', () => {
    const safari = getInstallGuidance({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Version/18.5 Mobile/15E148 Safari/604.1',
    });
    const chrome = getInstallGuidance({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 CriOS/138.0 Mobile/15E148 Safari/604.1',
    });

    expect(safari.environment).toBe('سفاري على iPhone أو iPad');
    expect(chrome.environment).toBe('كروم على iPhone أو iPad');
    expect(safari.steps).toContain('فعّل «فتح كتطبيق ويب» إذا ظهر هذا الخيار.');
  });

  it('recognizes iPad desktop-mode user agents by touch support', () => {
    const guidance = getInstallGuidance({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.5 Safari/605.1.15',
      maxTouchPoints: 5,
    });

    expect(guidance.environment).toBe('سفاري على iPhone أو iPad');
  });

  it('returns distinct Android instructions for Samsung, Firefox, and Chrome', () => {
    const samsung = getInstallGuidance({
      userAgent:
        'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/136.0 Mobile Safari/537.36 SamsungBrowser/28.0',
    });
    const firefox = getInstallGuidance({
      userAgent: 'Mozilla/5.0 (Android 15; Mobile; rv:140.0) Gecko/140.0 Firefox/140.0',
    });
    const chrome = getInstallGuidance({
      userAgent:
        'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/138.0 Mobile Safari/537.36',
    });

    expect(samsung.environment).toBe('متصفح سامسونج على أندرويد');
    expect(samsung.steps[0]).toContain('☰');
    expect(firefox.environment).toBe('فايرفوكس على أندرويد');
    expect(chrome.environment).toBe('كروم على أندرويد');
  });
});
