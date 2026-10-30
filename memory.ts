/**
 * وحدة ذاكرة سِيا (Memory Module)
 * إدارة الذكريات المحفوظة، المعلومات المهمة، والتفضيلات التي يسمح المستخدم بحفظها
 */

import { StorageModule } from './storage';

export type MemoryCategory = 'ذكريات محفوظة' | 'معلومات مهمة' | 'تفضيلات';

export interface MemoryItem {
  id: string;
  content: string;
  category: MemoryCategory;
  createdAt: string;
}

export const MEMORY_CATEGORIES: MemoryCategory[] = [
  'ذكريات محفوظة',
  'معلومات مهمة',
  'تفضيلات',
];

export const MemoryModule = {
  getAll(): MemoryItem[] {
    return StorageModule.get<MemoryItem[]>(StorageModule.KEYS.MEMORIES, []);
  },

  add(content: string, category: MemoryCategory = 'ذكريات محفوظة'): MemoryItem | null {
    const trimmed = content.trim();
    if (!trimmed) return null;

    const current = this.getAll();
    const newItem: MemoryItem = {
      id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      content: trimmed,
      category,
      createdAt: new Date().toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
    };

    const updated = [newItem, ...current];
    StorageModule.set(StorageModule.KEYS.MEMORIES, updated);
    return newItem;
  },

  remove(id: string): MemoryItem[] {
    const current = this.getAll();
    const updated = current.filter((item) => item.id !== id);
    StorageModule.set(StorageModule.KEYS.MEMORIES, updated);
    return updated;
  },

  clearAll(): void {
    StorageModule.set(StorageModule.KEYS.MEMORIES, []);
  },

  /**
   * تجهيز سياق الذاكرة لإرساله إلى سِيا في حال كانت الذاكرة مفعّلة
   */
  buildMemoryContext(memoryEnabled: boolean): string {
    if (!memoryEnabled) {
      return '\n\n[ذاكرة سِيا متوقفة حاليًا — لا تستخدم أي ذكريات سابقة ولا تخترع أي مواقف أو معلومات لم تُذكر في المحادثة الحالية].';
    }
    const items = this.getAll();
    if (items.length === 0) {
      return '\n\n[ذاكرة سِيا فارغة حاليًا — لا توجد أي معلومات محفوظة مسبقًا عن سهر. لا تخترع أي ذكريات أو مواقف أو تواريخ من الماضي، وإذا سألتك عن شيء سابق قل ببساطة: "مش فاكر إنك قلتيلي ده قبل كده"].';
    }

    const grouped = items.map((m) => `- [${m.category}]: ${m.content}`).join('\n');
    return `\n\n[ذاكرة سِيا الحقيقية المحفوظة والخاصة بسهر فقط (استخدمها بشكل طبيعي عند الحاجة ولا تخترع أي شيء خارجها)]:\n${grouped}`;
  },
};
