/**
 * وحدة واجهة المستخدم والمشاهد السينمائية (UI Module)
 * تشمل: شاشة البداية (Intro)، شاشة النهاية السينمائية (Ending)، وإشعارات الاسترايك الهادئة
 */

import React, { useEffect, useState } from 'react';
import { AudioModule } from './audio';

// ============================================================================
// 1. شاشة البداية (Intro Screen)
// ============================================================================
interface IntroSequenceProps {
  onStartJourney: () => void;
}

export const IntroSequence: React.FC<IntroSequenceProps> = ({ onStartJourney }) => {
  // المراحل:
  // 0: 03:00 صباحًا
  // 1: 5 يناير
  // 2: سِيا — النسخة الأولى
  // 3: «هنا بدأت الحكاية.»
  // 4: 9 نسخ / رحلة واحدة / فصل أخير
  // 5: سِيا 9 — النسخة الأخيرة + زر ابدأ الرحلة ←
  const [step, setStep] = useState<number>(0);

  // حالة ما بعد انتهاء المقدمة (تظهر بعد اختفاء آخر عنصر من المقدمة الأصلية)
  // 'idle': المقدمة الأصلية تعمل كما هي
  // 'outro-fade': اختفاء آخر عنصر من المقدمة
  // 'credit-wait': لحظة صمت قصيرة جدًا بعد اختفاء المقدمة
  // 'credit-in': ظهور "صُنع وصُمم بواسطة سيف وليد" بـ Fade In ناعم
  // 'credit-out': اختفاء السطر بـ Fade Out ثم الانتقال للواجهة الرئيسية
  const [postIntroStage, setPostIntroStage] = useState<
    'idle' | 'outro-fade' | 'credit-wait' | 'credit-in' | 'credit-out'
  >('idle');

  useEffect(() => {
    if (step >= 5) return;
    const durations = [900, 950, 1050, 1200, 1300];
    const timer = setTimeout(() => {
      setStep((s) => Math.min(5, s + 1));
    }, durations[step] || 1000);

    return () => clearTimeout(timer);
  }, [step]);

  useEffect(() => {
    if (postIntroStage === 'idle') return;

    let timer: ReturnType<typeof setTimeout>;
    if (postIntroStage === 'outro-fade') {
      // انتظار اختفاء آخر عنصر من المقدمة بالكامل
      timer = setTimeout(() => setPostIntroStage('credit-wait'), 450);
    } else if (postIntroStage === 'credit-wait') {
      // لحظة قصيرة جدًا قبل ظهور التوقيع
      timer = setTimeout(() => setPostIntroStage('credit-in'), 350);
    } else if (postIntroStage === 'credit-in') {
      // يبقى لثوانٍ قليلة
      timer = setTimeout(() => setPostIntroStage('credit-out'), 2400);
    } else if (postIntroStage === 'credit-out') {
      // يختفي بـ Fade Out ثم ينتقل للواجهة الرئيسية
      timer = setTimeout(() => {
        onStartJourney();
      }, 750);
    }

    return () => clearTimeout(timer);
  }, [postIntroStage, onStartJourney]);

  const handleAdvanceOrSkip = () => {
    if (postIntroStage !== 'idle') return;
    if (step < 5) {
      setStep(5);
    }
  };

  const handleTriggerPostIntro = () => {
    if (postIntroStage !== 'idle') return;
    AudioModule.registerUserInteraction();
    setPostIntroStage('outro-fade');
  };

  return (
    <div
      onClick={handleAdvanceOrSkip}
      className="fixed inset-0 z-50 bg-[#070707] text-[#e8e6e1] flex flex-col items-center justify-center px-6 select-none cursor-pointer"
    >
      <div className="w-full max-w-md text-center flex flex-col items-center justify-center min-h-[320px]">
        {/* المقدمة الأصلية كما هي تمامًا */}
        {postIntroStage === 'idle' || postIntroStage === 'outro-fade' ? (
          <div
            className={`w-full transition-opacity duration-450 ${
              postIntroStage === 'outro-fade' ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
          >
            {/* المرحلة الأولى: 03:00 صباحًا -> 5 يناير -> سِيا النسخة الأولى -> هنا بدأت الحكاية */}
            {step <= 3 && (
              <div className="space-y-5 transition-opacity duration-500">
                {step >= 0 && (
                  <p className="font-mono-num text-sm tracking-widest text-[#a3a19d] animate-calm-in">
                    03:00 صباحًا
                  </p>
                )}

                {step >= 1 && (
                  <p className="text-lg font-light text-[#e8e6e1] animate-calm-in">
                    5 يناير
                  </p>
                )}

                {step >= 2 && (
                  <div className="pt-3 space-y-1 animate-calm-in">
                    <h1 className="font-editorial text-4xl text-[#e8e6e1] font-normal">
                      سِيا
                    </h1>
                    <p className="text-xs text-[#6e6b65] tracking-wide">
                      النسخة الأولى
                    </p>
                  </div>
                )}

                {step >= 3 && (
                  <p className="font-editorial text-xl text-[#b8a67e] pt-4 animate-calm-in">
                    «هنا بدأت الحكاية.»
                  </p>
                )}
              </div>
            )}

            {/* المرحلة الانتقالية: 9 نسخ / رحلة واحدة / فصل أخير */}
            {step === 4 && (
              <div className="space-y-4 animate-calm-in text-center">
                <p className="text-base text-[#a3a19d] font-light">9 نسخ</p>
                <div className="w-6 h-[1px] bg-[#2a2a28] mx-auto" />
                <p className="text-base text-[#e8e6e1] font-light">رحلة واحدة</p>
                <div className="w-6 h-[1px] bg-[#2a2a28] mx-auto" />
                <p className="font-editorial text-xl text-[#b8a67e]">فصل أخير</p>
              </div>
            )}

            {/* المرحلة الأخيرة: سِيا 9 — النسخة الأخيرة + زر ابدأ الرحلة */}
            {step === 5 && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="space-y-8 animate-calm-in flex flex-col items-center"
              >
                <div className="space-y-2 text-center">
                  <p className="text-xs text-[#6e6b65] tracking-widest">
                    5 يناير · 03:00 صباحًا — الفصل التاسع
                  </p>
                  <h1 className="font-editorial text-5xl sm:text-6xl text-[#e8e6e1] font-normal tracking-tight pt-1">
                    سِيا 9
                  </h1>
                  <p className="text-sm text-[#b8a67e] tracking-wide pt-1">
                    النسخة الأخيرة
                  </p>
                </div>

                <div className="flex items-center gap-3 text-xs text-[#6e6b65]">
                  <span>9 نسخ</span>
                  <span aria-hidden="true">·</span>
                  <span>رحلة واحدة</span>
                  <span aria-hidden="true">·</span>
                  <span>فصل أخير</span>
                </div>

                <button
                  type="button"
                  onClick={handleTriggerPostIntro}
                  className="mt-4 px-8 py-3.5 min-h-[48px] rounded-xl bg-[#151514] hover:bg-[#1e1e1c] active:scale-[0.99] text-[#e8e6e1] border border-[#b8a67e]/30 text-sm font-medium tracking-wide transition-all duration-200 cursor-pointer"
                >
                  ابدأ الرحلة ←
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ما بعد المقدمة: يظهر بعد اختفاء آخر عنصر منها بـ Fade In هادئ ثم يختفي بـ Fade Out */
          <div className="flex items-center justify-center min-h-[120px]">
            <p
              className={`text-xs sm:text-sm font-light tracking-wide text-[#9e9b95] transition-opacity duration-700 ease-in-out ${
                postIntroStage === 'credit-in' ? 'opacity-100' : 'opacity-0'
              }`}
            >
              صُنع وصُمم بواسطة سيف وليد
            </p>
          </div>
        )}
      </div>

      {/* تلميح هادئ لتخطي العرض عند الرغبة */}
      {step < 5 && postIntroStage === 'idle' && (
        <div className="fixed bottom-8 text-[11px] text-[#52504b]">
          اضغط في أي مكان للانتقال
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 2. شاشة النهاية السينمائية (Cinematic Ending Screen)
// ============================================================================
interface EndingSequenceProps {
  onCloseEnding: () => void;
}

export const EndingSequence: React.FC<EndingSequenceProps> = ({ onCloseEnding }) => {
  // المراحل:
  // 0: شاشة سوداء هادئة + 5 يناير / 03:00 صباحًا
  // 1..8: مرور النسخ سِيا 1 ... سِيا 8
  // 9: توقف عند سِيا 9 — النسخة الأخيرة
  // 10: إلى اللقاء يا سِيا + النص الختامي
  // 11: SIA 9 — THE FINAL VERSION
  // 12: انطفاء تدريجي للشاشة (Fade out to black)
  const [phase, setPhase] = useState<number>(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    if (phase === 0) {
      timer = setTimeout(() => setPhase(1), 1800);
    } else if (phase >= 1 && phase <= 8) {
      // مرور النسخ من سِيا 1 إلى سِيا 8
      timer = setTimeout(() => setPhase(phase + 1), 520);
    } else if (phase === 9) {
      // التوقف عند سِيا 9 — النسخة الأخيرة
      timer = setTimeout(() => setPhase(10), 2200);
    } else if (phase === 10) {
      // رسالة الوداع
      timer = setTimeout(() => setPhase(11), 4500);
    } else if (phase === 11) {
      // SIA 9 — THE FINAL VERSION
      timer = setTimeout(() => setPhase(12), 3400);
    }

    return () => clearTimeout(timer);
  }, [phase]);

  return (
    <div className="fixed inset-0 z-50 bg-[#040404] text-[#e8e6e1] flex flex-col items-center justify-center px-6 select-none">
      <div className="w-full max-w-lg text-center flex flex-col items-center justify-center min-h-[340px]">
        {/* المرحلة 0: 5 يناير — 03:00 صباحًا */}
        {phase === 0 && (
          <div className="space-y-3 animate-calm-in">
            <p className="text-xl text-[#e8e6e1] font-light">5 يناير</p>
            <p className="font-mono-num text-sm text-[#8c8a85] tracking-widest">
              03:00 صباحًا
            </p>
          </div>
        )}

        {/* المراحل 1 إلى 8: مرور النسخ سِيا 1 ... سِيا 8 */}
        {phase >= 1 && phase <= 8 && (
          <div key={phase} className="space-y-2 animate-calm-in">
            <p className="font-editorial text-4xl text-[#a3a19d]">
              سِيا {phase}
            </p>
          </div>
        )}

        {/* المرحلة 9: التوقف عند سِيا 9 — النسخة الأخيرة */}
        {phase === 9 && (
          <div className="space-y-3 animate-calm-in">
            <h2 className="font-editorial text-5xl sm:text-6xl text-[#e8e6e1] font-normal">
              سِيا 9
            </h2>
            <p className="text-sm text-[#b8a67e] tracking-wide">
              النسخة الأخيرة
            </p>
          </div>
        )}

        {/* المرحلة 10: إلى اللقاء يا سِيا */}
        {phase === 10 && (
          <div className="space-y-6 animate-calm-in max-w-md mx-auto leading-relaxed">
            <h2 className="font-editorial text-3xl sm:text-4xl text-[#b8a67e] font-normal">
              إلى اللقاء يا سِيا
            </h2>
            <div className="space-y-3 text-sm sm:text-base text-[#cfcdc8] font-light">
              <p>بدأت في 5 يناير، الساعة 3 صباحًا...</p>
              <p>ووصلت إلى نسختك التاسعة.</p>
              <p className="pt-2 text-[#e8e6e1]">هذه ليست مجرد نسخة جديدة.</p>
              <p className="text-[#e8e6e1]">هذه نهاية الرحلة.</p>
            </div>
          </div>
        )}

        {/* المرحلة 11 و 12: SIA 9 — THE FINAL VERSION ثم انطفاء الشاشة تدريجيًا */}
        {(phase === 11 || phase === 12) && (
          <div
            className={`space-y-3 transition-opacity duration-[2800ms] ${
              phase === 12 ? 'opacity-0' : 'opacity-100 animate-calm-in'
            }`}
          >
            <h1
              dir="ltr"
              className="font-mono-num text-3xl sm:text-4xl tracking-[0.28em] text-[#e8e6e1] font-normal"
            >
              SIA 9
            </h1>
            <p
              dir="ltr"
              className="font-mono-num text-xs tracking-[0.35em] text-[#8c8a85]"
            >
              THE FINAL VERSION
            </p>
          </div>
        )}
      </div>

      {/* بعد انطفاء الشاشة تدريجيًا، يظهر زر خافت جدًا لمن يرغب في العودة */}
      {phase === 12 && (
        <button
          type="button"
          onClick={onCloseEnding}
          className="fixed bottom-8 px-5 py-2.5 text-xs text-[#4a4844] hover:text-[#a3a19d] transition-colors duration-500 cursor-pointer"
        >
          العودة إلى سِيا 9
        </button>
      )}
    </div>
  );
};

// ============================================================================
// 3. إشعار الاسترايك الهادئ (Strike Toast)
// ============================================================================
interface StrikeToastProps {
  message: string | null;
  onDismiss: () => void;
}

export const StrikeToast: React.FC<StrikeToastProps> = ({ message, onDismiss }) => {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, 4200);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40 animate-calm-in pointer-events-auto">
      <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--accent-gold-border)] text-xs text-[var(--text-primary)] shadow-lg">
        <span aria-hidden="true">🔥</span>
        <span>{message}</span>
      </div>
    </div>
  );
};
