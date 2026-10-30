/**
 * وحدة المحادثة (Chat Module)
 * إدارة جلسات الحوار الحالية والسابقة مع سِيا 9
 */

import { StorageModule } from './storage';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: number;
  messages: ChatMessage[];
}

function formatTime(date: Date = new Date()): string {
  return date.toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(date: Date = new Date()): string {
  return date.toLocaleDateString('ar-EG', {
    month: 'short',
    day: 'numeric',
  });
}

export const ChatModule = {
  getAllConversations(): Conversation[] {
    const list = StorageModule.get<Conversation[]>(StorageModule.KEYS.CONVERSATIONS, []);
    return list.sort((a, b) => b.updatedAt - a.updatedAt);
  },

  createConversation(): Conversation {
    const now = new Date();
    const initialMsg: ChatMessage = {
      id: `msg_${Date.now()}_init`,
      role: 'assistant',
      content: 'أهلًا يا سهر. سِيا 9 جاهز.. عاملة إيه النهارده؟',
      timestamp: formatTime(now),
    };

    const conv: Conversation = {
      id: `conv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: 'محادثة مع سِيا',
      createdAt: formatDate(now),
      updatedAt: Date.now(),
      messages: [initialMsg],
    };

    const all = this.getAllConversations();
    const updated = [conv, ...all];
    StorageModule.set(StorageModule.KEYS.CONVERSATIONS, updated);
    StorageModule.set(StorageModule.KEYS.ACTIVE_CONVERSATION_ID, conv.id);
    return conv;
  },

  getActiveConversation(): Conversation {
    const all = this.getAllConversations();
    const activeId = StorageModule.get<string | null>(
      StorageModule.KEYS.ACTIVE_CONVERSATION_ID,
      null
    );

    if (activeId) {
      const found = all.find((c) => c.id === activeId);
      if (found) {
        if (
          found.messages.length === 1 &&
          found.messages[0].role === 'assistant' &&
          found.messages[0].content.includes('أهلًا بك. أنا سِيا')
        ) {
          found.messages[0].content = 'أهلًا يا سهر. سِيا 9 جاهز.. عاملة إيه النهارده؟';
          StorageModule.set(StorageModule.KEYS.CONVERSATIONS, all);
        }
        return found;
      }
    }

    if (all.length > 0) {
      StorageModule.set(StorageModule.KEYS.ACTIVE_CONVERSATION_ID, all[0].id);
      return all[0];
    }

    return this.createConversation();
  },

  setActiveConversation(id: string): Conversation | null {
    const all = this.getAllConversations();
    const found = all.find((c) => c.id === id);
    if (!found) return null;
    StorageModule.set(StorageModule.KEYS.ACTIVE_CONVERSATION_ID, id);
    return found;
  },

  appendMessage(
    conversationId: string,
    role: 'user' | 'assistant',
    content: string
  ): Conversation {
    const all = this.getAllConversations();
    const idx = all.findIndex((c) => c.id === conversationId);

    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      role,
      content,
      timestamp: formatTime(new Date()),
    };

    if (idx === -1) {
      const fresh = this.createConversation();
      fresh.messages.push(newMsg);
      return fresh;
    }

    const conv = { ...all[idx] };
    conv.messages = [...conv.messages, newMsg];
    conv.updatedAt = Date.now();

    // تحديث عنوان المحادثة تلقائيًا من أول رسالة للمستخدم
    const userMessages = conv.messages.filter((m) => m.role === 'user');
    if (role === 'user' && userMessages.length === 1) {
      conv.title = content.trim().slice(0, 36) + (content.trim().length > 36 ? '...' : '');
    }

    all[idx] = conv;
    StorageModule.set(StorageModule.KEYS.CONVERSATIONS, all);
    return conv;
  },

  deleteConversation(id: string): Conversation {
    const all = this.getAllConversations().filter((c) => c.id !== id);
    StorageModule.set(StorageModule.KEYS.CONVERSATIONS, all);
    if (all.length > 0) {
      StorageModule.set(StorageModule.KEYS.ACTIVE_CONVERSATION_ID, all[0].id);
      return all[0];
    }
    return this.createConversation();
  },

  clearAllConversations(): Conversation {
    StorageModule.set(StorageModule.KEYS.CONVERSATIONS, []);
    return this.createConversation();
  },
};
