/**
 * وحدة التخزين (Storage Module)
 * إدارة البيانات المحلية، التصدير، والحذف الكامل
 */

export interface AppSettings {
  theme: 'dark' | 'light';
  memoryEnabled: boolean;
  musicEnabled: boolean;
  musicVolume: number;
  customMusicUrl: string;
  fontSize: 'normal' | 'comfortable';
  sendOnEnter: boolean;
  introSeen: boolean;
}

const STORAGE_KEYS = {
  CONVERSATIONS: 'sia9_conversations',
  ACTIVE_CONVERSATION_ID: 'sia9_active_conv_id',
  MEMORIES: 'sia9_memories',
  STRIKE: 'sia9_strike_data',
  SETTINGS: 'sia9_settings',
  P2P_ROOM_CODE: 'sia9_p2p_code',
} as const;

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  memoryEnabled: true,
  musicEnabled: false,
  musicVolume: 0.25,
  customMusicUrl: '',
  fontSize: 'normal',
  sendOnEnter: true,
  introSeen: false,
};

export const StorageModule = {
  KEYS: STORAGE_KEYS,

  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },

  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Storage write error:', e);
    }
  },

  getSettings(): AppSettings {
    const saved = this.get<Partial<AppSettings>>(STORAGE_KEYS.SETTINGS, {});
    return { ...DEFAULT_SETTINGS, ...saved };
  },

  saveSettings(settings: AppSettings): void {
    this.set(STORAGE_KEYS.SETTINGS, settings);
  },

  exportAllData(): string {
    const payload = {
      app: 'سِيا 9 — النسخة الأخيرة',
      exportedAt: new Date().toISOString(),
      settings: this.getSettings(),
      strike: this.get(STORAGE_KEYS.STRIKE, null),
      memories: this.get(STORAGE_KEYS.MEMORIES, []),
      conversations: this.get(STORAGE_KEYS.CONVERSATIONS, []),
    };
    return JSON.stringify(payload, null, 2);
  },

  clearAllData(): void {
    Object.values(STORAGE_KEYS).forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch {
        // ignore
      }
    });
  },
};
