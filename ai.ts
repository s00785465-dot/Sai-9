/**
 * وحدة الذكاء الاصطناعي (AI Module)
 * الاتصال الفعلي بـ AI API مع دمج الهوية والذاكرة والاسترايك
 */

import { AI_API_URL, AI_MODEL, SYSTEM_PROMPT } from '../config';
import { MemoryModule } from './memory';
import { StrikeModule, getAbsoluteStrikeQuote } from './strike';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export const AIModule = {
  async sendMessage(
    history: ChatTurn[],
    options: { memoryEnabled: boolean }
  ): Promise<string> {
    const strikeData = StrikeModule.getData();
    const memoryContext = MemoryModule.buildMemoryContext(options.memoryEnabled);

    const strikeContext =
      strikeData.currentStrike > 0
        ? `\n\n[حالة الاسترايك الحالية لسهر مع سِيا (لا تذكرها إلا لو كانت مناسبة للسياق)]: ${strikeData.currentStrike} يومًا متتاليًا (${getAbsoluteStrikeQuote(
            strikeData.currentStrike
          )}) — أعلى استرايك وصلت له سهر: ${strikeData.bestStrike} يومًا.`
        : '';

    const fullSystemPrompt = `${SYSTEM_PROMPT}${strikeContext}${memoryContext}`;

    const response = await fetch(AI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        systemPrompt: fullSystemPrompt,
        messages: history.slice(-16), // إرسال آخر 16 رسالة للحفاظ على السياق والسرعة
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'تعذر الاتصال بسِيا في الوقت الحالي.');
    }

    return data.reply;
  },
};
