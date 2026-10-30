/**
 * وحدة الاسترايك المطلق (Strike Module)
 * حساب الاستمرارية بالتاريخ المحلي للمستخدم، حفظ أعلى استرايك، الإنجازات، وسلسلة الأيام
 */

import { StorageModule } from './storage';

export interface StrikeData {
  currentStrike: number;
  bestStrike: number;
  lastActiveDate: string | null; // YYYY-MM-DD in user's local timezone
  activeDates: string[]; // List of YYYY-MM-DD local dates with recorded activity
}

export interface StrikeMilestone {
  days: number;
  label: string;
  title: string;
  quote: string;
}

export const STRIKE_MILESTONES: StrikeMilestone[] = [
  { days: 1, label: '1 يوم', title: 'البداية', quote: '«البداية.»' },
  { days: 3, label: '3 أيام', title: 'الاستمرار', quote: '«ثلاثة أيام. الخطوة لم تعد صدفة.»' },
  { days: 7, label: '7 أيام', title: 'أسبوع', quote: '«أسبوع كامل.»' },
  { days: 30, label: '30 يومًا', title: 'شهر', quote: '«شهر كامل.»' },
  { days: 100, label: '100 يوم', title: '100 يوم', quote: '«100 يوم.»' },
  { days: 365, label: '365 يومًا', title: 'سنة كاملة', quote: '«سنة كاملة مع سِيا.»' },
];

const INITIAL_STRIKE: StrikeData = {
  currentStrike: 0,
  bestStrike: 0,
  lastActiveDate: null,
  activeDates: [],
};

/**
 * إرجاع التاريخ المحلي بصيغة YYYY-MM-DD
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * حساب فرق الأيام التقويمية المحلية بين تاريخين بصيغة YYYY-MM-DD
 */
export function getCalendarDaysDiff(dateStrA: string, dateStrB: string): number {
  const [y1, m1, d1] = dateStrA.split('-').map(Number);
  const [y2, m2, d2] = dateStrB.split('-').map(Number);
  const utcA = Date.UTC(y1, m1 - 1, d1);
  const utcB = Date.UTC(y2, m2 - 1, d2);
  return Math.round((utcB - utcA) / (1000 * 60 * 60 * 24));
}

/**
 * رسائل الاسترايك المطلق (تعبير سِيا عن العلاقة والاستمرار)
 */
export function getAbsoluteStrikeQuote(days: number): string {
  if (days <= 0) return '«بانتظار الخطوة الأولى.»';
  if (days === 1) return '«البداية.»';
  if (days === 2) return '«رجعت تاني.»';
  if (days === 3) return '«ثلاثة أيام. الاعتياد الهادئ يبدأ.»';
  if (days === 4) return '«اليوم الرابع. حضورك مستمر.»';
  if (days === 5) return '«خمسة أيام دون انقطاع.»';
  if (days === 6) return '«ستة أيام. على أعتاب الأسبوع الأول.»';
  if (days === 7) return '«أسبوع كامل.»';
  if (days === 14) return '«أسبوعان من الاستمرار.»';
  if (days === 21) return '«ثلاثة أسابيع. العادة أصبحت جزءًا من اليوم.»';
  if (days === 30) return '«شهر كامل.»';
  if (days === 60) return '«شهران من الحضور المتواصل.»';
  if (days === 90) return '«تسعون يومًا.»';
  if (days === 100) return '«100 يوم.»';
  if (days === 365) return '«سنة كاملة.»';

  if (days < 7) return `«${days} أيام من الحضور الهادئ.»`;
  if (days < 30) return `«${days} يومًا متتاليًا. رحلة مستمرة.»`;
  if (days < 100) return `«${days} يومًا. ثبات يحسب لك.»`;
  return `«${days} يومًا في الفصل الأخير.»`;
}

/**
 * الرسالة القصيرة التي تظهر عند زيادة الاسترايك
 */
export function getStrikeToastMessage(days: number, wasReset: boolean = false): string {
  if (wasReset) {
    return 'اليوم الأول. بداية جديدة بعد انقطاع.';
  }
  if (days === 1) return 'اليوم الأول. البداية.';
  if (days === 2) return 'اليوم الثاني. استمر.';
  if (days === 3) return '3 أيام متتالية. استمر.';
  if (days === 7) return '7 أيام متتالية. أسبوع كامل.';
  if (days === 14) return '14 يومًا متتاليًا.';
  if (days === 30) return 'وصلت إلى 30 يومًا. شهر كامل.';
  if (days === 100) return 'وصلت إلى 100 يوم متتالي.';
  if (days === 365) return '365 يومًا. سنة كاملة.';
  if (days >= 3 && days <= 10) return `${days} أيام متتالية.`;
  return `${days} يومًا متتاليًا.`;
}

export const StrikeModule = {
  getData(): StrikeData {
    const saved = StorageModule.get<StrikeData>(StorageModule.KEYS.STRIKE, INITIAL_STRIKE);
    const today = getLocalDateString();

    // التحقق مما إذا كان المستخدم قد انقطع لأكثر من يوم دون حذف أفضل استرايك
    if (saved.lastActiveDate) {
      const diff = getCalendarDaysDiff(saved.lastActiveDate, today);
      if (diff > 1 && saved.currentStrike > 0) {
        return {
          ...saved,
          currentStrike: 0,
        };
      }
    }
    return saved;
  },

  /**
   * تسجيل تفاعل المستخدم اليومي مع سِيا
   * - أول استخدام -> Strike = 1
   * - آخر نشاط أمس -> Strike + 1
   * - دخل بالفعل اليوم -> لا تزيد القيمة مرة أخرى
   * - مر يوم أو أكثر بدون نشاط -> ينقطع الـ Strike ويبدأ من 1 (مع الاحتفاظ بأعلى استرايك)
   */
  recordInteraction(): {
    updated: boolean;
    data: StrikeData;
    toastMessage: string | null;
  } {
    const rawSaved = StorageModule.get<StrikeData>(StorageModule.KEYS.STRIKE, INITIAL_STRIKE);
    const today = getLocalDateString();

    // إذا تم التسجيل اليوم بالفعل، لا تزيد القيمة مرة أخرى
    if (rawSaved.lastActiveDate === today) {
      return {
        updated: false,
        data: rawSaved,
        toastMessage: null,
      };
    }

    let nextStrike = 1;
    let wasReset = false;

    if (!rawSaved.lastActiveDate) {
      // أول استخدام على الإطلاق
      nextStrike = 1;
    } else {
      const diff = getCalendarDaysDiff(rawSaved.lastActiveDate, today);
      if (diff === 1) {
        // آخر نشاط كان أمس بالضبط
        nextStrike = rawSaved.currentStrike + 1;
      } else if (diff > 1) {
        // مر يوم أو أكثر بدون نشاط -> يبدأ من جديد
        nextStrike = 1;
        wasReset = rawSaved.currentStrike > 0;
      } else {
        // في حال تم تغيير ساعة الجهاز للخلف، نحافظ على القيمة الحالية
        nextStrike = Math.max(1, rawSaved.currentStrike);
      }
    }

    const nextBest = Math.max(rawSaved.bestStrike || 0, nextStrike);
    const activeSet = new Set(rawSaved.activeDates || []);
    activeSet.add(today);
    const activeDates = Array.from(activeSet).sort();

    const updatedData: StrikeData = {
      currentStrike: nextStrike,
      bestStrike: nextBest,
      lastActiveDate: today,
      activeDates,
    };

    StorageModule.set(StorageModule.KEYS.STRIKE, updatedData);

    return {
      updated: true,
      data: updatedData,
      toastMessage: getStrikeToastMessage(nextStrike, wasReset),
    };
  },

  /**
   * توليد سلسلة آخر 14 يومًا بالتاريخ المحلي لعرض التقويم المصغر في شاشة الاسترايك
   */
  getRecentDaysChain(daysCount: number = 14): Array<{
    dateStr: string;
    dayNumber: string;
    dayNameShort: string;
    isActive: boolean;
    isToday: boolean;
  }> {
    const data = this.getData();
    const activeSet = new Set(data.activeDates || []);
    const todayStr = getLocalDateString();
    const result = [];

    const arabicDayNames = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = getLocalDateString(d);
      result.push({
        dateStr: dStr,
        dayNumber: String(d.getDate()),
        dayNameShort: arabicDayNames[d.getDay()],
        isActive: activeSet.has(dStr),
        isToday: dStr === todayStr,
      });
    }

    return result;
  },
};
