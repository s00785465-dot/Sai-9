/**
 * سِيا 9 — النسخة الأخيرة
 * التطبيق الرئيسي (يربط وحدات: AI, Chat, Memory, Strike, Timeline, P2P, Audio, Storage, UI)
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Send,
  Plus,
  History,
  Trash2,
  Bookmark,
  Copy,
  Check,
  LogOut,
  X,
} from 'lucide-react';
import { StorageModule, AppSettings } from './storage';
import {
  StrikeModule,
  StrikeData,
  STRIKE_MILESTONES,
  getAbsoluteStrikeQuote,
} from './strike';
import {
  MemoryModule,
  MemoryItem,
  MemoryCategory,
  MEMORY_CATEGORIES,
} from './memory';
import { ChatModule, Conversation } from './chat';
import { AIModule } from './ai';
import { AudioModule } from './audio';
import { SiaP2PRoom, P2PConnectionStatus, P2PMessage } from './room';
import { SIA_TIMELINE, TimelineVersion } from './timeline';
import { IntroSequence } from './intro';
import { EndingSequence } from './ending';
import { StrikeToast } from './StrikeToast';

type ActiveSection = 'chat' | 'memory' | 'strike' | 'timeline' | 'room' | 'settings';

export default function App() {
  // --------------------------------------------------------------------------
  // 1. الإعدادات والمشاهد السينمائية (Intro / Ending)
  // --------------------------------------------------------------------------
  const [settings, setSettings] = useState<AppSettings>(() =>
    StorageModule.getSettings()
  );
  const [showIntro, setShowIntro] = useState<boolean>(true);
  const [showEnding, setShowEnding] = useState<boolean>(false);
  const [activeSection, setActiveSection] = useState<ActiveSection>('chat');

  // --------------------------------------------------------------------------
  // 2. حالة الاسترايك (STRIKE)
  // --------------------------------------------------------------------------
  const [strikeData, setStrikeData] = useState<StrikeData>(() =>
    StrikeModule.getData()
  );
  const [strikeToast, setStrikeToast] = useState<string | null>(null);

  // --------------------------------------------------------------------------
  // 3. حالة المحادثة والذكاء الاصطناعي (Chat & AI)
  // --------------------------------------------------------------------------
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    ChatModule.getAllConversations()
  );
  const [activeConv, setActiveConv] = useState<Conversation>(() =>
    ChatModule.getActiveConversation()
  );
  const [chatInput, setChatInput] = useState<string>('');
  const [isSiaTyping, setIsSiaTyping] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState<boolean>(false);
  const [savedNoticeId, setSavedNoticeId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // --------------------------------------------------------------------------
  // 4. حالة ذاكرة سِيا (Memory)
  // --------------------------------------------------------------------------
  const [memories, setMemories] = useState<MemoryItem[]>(() =>
    MemoryModule.getAll()
  );
  const [newMemoryText, setNewMemoryText] = useState<string>('');
  const [newMemoryCategory, setNewMemoryCategory] =
    useState<MemoryCategory>('ذكريات محفوظة');
  const [memoryFilter, setMemoryFilter] = useState<MemoryCategory | 'الكل'>('الكل');
  const [confirmClearMemory, setConfirmClearMemory] = useState<boolean>(false);

  // --------------------------------------------------------------------------
  // 5. حالة رحلة سِيا (Timeline)
  // --------------------------------------------------------------------------
  const [selectedVersion, setSelectedVersion] = useState<TimelineVersion>(
    SIA_TIMELINE[8] // سِيا 9 افتراضيًا عند فتح التفاصيل
  );

  // --------------------------------------------------------------------------
  // 6. حالة غرفة سِيا (Sia Room — P2P / WebRTC)
  // --------------------------------------------------------------------------
  const p2pRef = useRef<SiaP2PRoom | null>(null);
  const [p2pStatus, setP2PStatus] = useState<P2PConnectionStatus>('disconnected');
  const [p2pStatusDetail, setP2PStatusDetail] = useState<string>('غير متصل');
  const [roomCode, setRoomCode] = useState<string>(() =>
    StorageModule.get<string>(StorageModule.KEYS.P2P_ROOM_CODE, '')
  );
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [p2pMessages, setP2PMessages] = useState<P2PMessage[]>([]);
  const [p2pInput, setP2PInput] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const p2pEndRef = useRef<HTMLDivElement | null>(null);

  // --------------------------------------------------------------------------
  // 7. تأكيدات الإعدادات
  // --------------------------------------------------------------------------
  const [confirmResetAll, setConfirmResetAll] = useState<boolean>(false);
  const [confirmClearChats, setConfirmClearChats] = useState<boolean>(false);

  // تطبيق المظهر (داكن / فاتح)
  useEffect(() => {
    if (settings.theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [settings.theme]);

  // مزامنة إعدادات الصوت
  useEffect(() => {
    AudioModule.configure({
      enabled: settings.musicEnabled,
      volume: settings.musicVolume,
      customUrl: settings.customMusicUrl,
    });
  }, [settings.musicEnabled, settings.musicVolume, settings.customMusicUrl]);

  // تمرير تلقائي لأسفل المحادثة
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConv.messages, isSiaTyping]);

  useEffect(() => {
    p2pEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [p2pMessages]);

  // تهيئة كائن P2P WebRTC عند الحاجة
  useEffect(() => {
    p2pRef.current = new SiaP2PRoom({
      onStatusChange: (status, detail) => {
        setP2PStatus(status);
        if (detail) setP2PStatusDetail(detail);
      },
      onMessage: (msg) => {
        setP2PMessages((prev) => [...prev, msg]);
      },
      onRoomCodeReady: (code) => {
        setRoomCode(code);
        StorageModule.set(StorageModule.KEYS.P2P_ROOM_CODE, code);
      },
    });

    return () => {
      p2pRef.current?.leaveRoom(false);
    };
  }, []);

  // اتصال تلقائي بالرمز المحفوظ فور دخول غرفة سِيا
  useEffect(() => {
    if (
      activeSection === 'room' &&
      roomCode &&
      p2pRef.current &&
      p2pRef.current.getActiveCode() !== roomCode
    ) {
      p2pRef.current.connectWithCode(roomCode).catch(() => {});
    }
  }, [activeSection, roomCode]);

  // تحديث الإعدادات وحفظها
  const updateSettings = (patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      StorageModule.saveSettings(next);
      return next;
    });
  };

  // تسجيل التفاعل اليومي في نظام الـ Strike
  const triggerDailyInteraction = () => {
    const result = StrikeModule.recordInteraction();
    setStrikeData(result.data);
    if (result.updated && result.toastMessage) {
      setStrikeToast(result.toastMessage);
    }
  };

  // بدء الرحلة بعد شاشة البداية
  const handleStartJourney = () => {
    AudioModule.registerUserInteraction();
    triggerDailyInteraction();
    updateSettings({ introSeen: true });
    setShowIntro(false);
  };

  // --------------------------------------------------------------------------
  // وظائف محادثة سِيا (Chat Handlers)
  // --------------------------------------------------------------------------
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = chatInput.trim();
    if (!text || isSiaTyping) return;

    AudioModule.registerUserInteraction();
    triggerDailyInteraction();
    setChatError(null);
    setChatInput('');

    // إضافة رسالة المستخدم
    const updatedAfterUser = ChatModule.appendMessage(activeConv.id, 'user', text);
    setActiveConv(updatedAfterUser);
    setConversations(ChatModule.getAllConversations());
    setIsSiaTyping(true);

    try {
      const historyForAI = updatedAfterUser.messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const reply = await AIModule.sendMessage(historyForAI, {
        memoryEnabled: settings.memoryEnabled,
      });

      const updatedAfterSia = ChatModule.appendMessage(
        updatedAfterUser.id,
        'assistant',
        reply
      );
      setActiveConv(updatedAfterSia);
      setConversations(ChatModule.getAllConversations());
    } catch (err: any) {
      setChatError(err?.message || 'حدث خطأ أثناء الاتصال بسِيا.');
    } finally {
      setIsSiaTyping(false);
    }
  };

  const handleNewConversation = () => {
    const fresh = ChatModule.createConversation();
    setActiveConv(fresh);
    setConversations(ChatModule.getAllConversations());
    setShowHistoryDrawer(false);
    setChatError(null);
  };

  const handleSelectConversation = (id: string) => {
    const found = ChatModule.setActiveConversation(id);
    if (found) {
      setActiveConv(found);
      setShowHistoryDrawer(false);
      setChatError(null);
    }
  };

  const handleDeleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextActive = ChatModule.deleteConversation(id);
    setActiveConv(nextActive);
    setConversations(ChatModule.getAllConversations());
  };

  const handleSaveMessageToMemory = (msgId: string, content: string) => {
    const added = MemoryModule.add(content, 'ذكريات محفوظة');
    if (added) {
      setMemories(MemoryModule.getAll());
      setSavedNoticeId(msgId);
      setTimeout(() => setSavedNoticeId(null), 2000);
    }
  };

  // --------------------------------------------------------------------------
  // وظائف ذاكرة سِيا (Memory Handlers)
  // --------------------------------------------------------------------------
  const handleAddMemory = (e: React.FormEvent) => {
    e.preventDefault();
    const added = MemoryModule.add(newMemoryText, newMemoryCategory);
    if (added) {
      setMemories(MemoryModule.getAll());
      setNewMemoryText('');
      triggerDailyInteraction();
    }
  };

  const handleRemoveMemory = (id: string) => {
    const next = MemoryModule.remove(id);
    setMemories(next);
  };

  const handleClearAllMemories = () => {
    MemoryModule.clearAll();
    setMemories([]);
    setConfirmClearMemory(false);
  };

  // --------------------------------------------------------------------------
  // وظائف غرفة سِيا (P2P / WebRTC Handlers)
  // --------------------------------------------------------------------------
  const handleCreateRoom = async () => {
    setP2PMessages([]);
    try {
      const code = await p2pRef.current?.createRoom();
      if (code) {
        setRoomCode(code);
        StorageModule.set(StorageModule.KEYS.P2P_ROOM_CODE, code);
      }
    } catch {}
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = joinCodeInput.trim().toUpperCase();
    if (!trimmed) return;
    setP2PMessages([]);
    setRoomCode(trimmed);
    StorageModule.set(StorageModule.KEYS.P2P_ROOM_CODE, trimmed);
    setJoinCodeInput('');
    try {
      await p2pRef.current?.connectWithCode(trimmed);
    } catch {}
  };

  const handleLeaveRoom = () => {
    p2pRef.current?.leaveRoom(true);
    setRoomCode('');
    StorageModule.set(StorageModule.KEYS.P2P_ROOM_CODE, '');
    setP2PMessages([]);
  };

  const handleCopyRoomCode = () => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleSendP2PMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!p2pInput.trim()) return;
    const sent = p2pRef.current?.sendMessage(p2pInput);
    if (sent) {
      setP2PInput('');
    }
  };

  // --------------------------------------------------------------------------
  // وظائف البيانات والإعدادات
  // --------------------------------------------------------------------------
  const handleResetAllData = () => {
    p2pRef.current?.leaveRoom(true);
    StorageModule.clearAllData();
    setRoomCode('');
    setP2PMessages([]);
    setSettings(StorageModule.getSettings());
    setStrikeData(StrikeModule.getData());
    setMemories(MemoryModule.getAll());
    const freshConv = ChatModule.getActiveConversation();
    setActiveConv(freshConv);
    setConversations(ChatModule.getAllConversations());
    setConfirmResetAll(false);
  };

  // --------------------------------------------------------------------------
  // العرض: شاشة البداية أو شاشة النهاية السينمائية
  // --------------------------------------------------------------------------
  if (showIntro) {
    return <IntroSequence onStartJourney={handleStartJourney} />;
  }

  if (showEnding) {
    return <EndingSequence onCloseEnding={() => setShowEnding(false)} />;
  }

  const filteredMemories =
    memoryFilter === 'الكل'
      ? memories
      : memories.filter((m) => m.category === memoryFilter);

  const recentDaysChain = StrikeModule.getRecentDaysChain(14);

  const navItems: Array<{ id: ActiveSection; label: string }> = [
    { id: 'chat', label: 'المحادثة' },
    { id: 'memory', label: 'ذاكرة سِيا' },
    { id: 'strike', label: 'الاسترايك' },
    { id: 'timeline', label: 'رحلة سِيا' },
    { id: 'room', label: 'غرفة سِيا' },
    { id: 'settings', label: 'الإعدادات' },
  ];

  return (
    <div
      onClick={() => AudioModule.registerUserInteraction()}
      className="min-h-screen flex flex-col bg-[var(--bg-deep)] text-[var(--text-primary)]"
    >
      <StrikeToast
        message={strikeToast}
        onDismiss={() => setStrikeToast(null)}
      />

      {/* الشريط العلوي */}
      <header className="sticky top-0 z-30 h-14 px-4 sm:px-8 border-b border-[var(--border-hairline)] bg-[var(--bg-deep)]/90 backdrop-blur-md flex items-center justify-between">
        <button
          type="button"
          onClick={() => setActiveSection('chat')}
          className="font-editorial text-2xl font-normal tracking-tight text-[var(--text-primary)] cursor-pointer whitespace-nowrap"
        >
          سِيا 9
        </button>

        <nav className="hidden md:flex items-center gap-6 text-xs">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveSection(item.id)}
              className={`py-1 transition-colors whitespace-nowrap cursor-pointer ${
                activeSection === item.id
                  ? 'text-[var(--text-primary)] border-b border-[var(--accent-gold)] font-medium'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setActiveSection('strike')}
            title="الاسترايك المطلق"
            className="px-3 py-1.5 min-h-[36px] rounded-lg bg-[var(--bg-surface)] border border-[var(--border-hairline)] hover:border-[var(--accent-gold-border)] text-xs text-[var(--text-primary)] flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
          >
            <span aria-hidden="true">🔥</span>
            <span className="font-mono-num">{strikeData.currentStrike}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowEnding(true)}
            className="px-3 py-1.5 min-h-[36px] rounded-lg text-xs text-[var(--text-secondary)] hover:text-[var(--accent-gold)] border border-transparent hover:border-[var(--border-hairline)] transition-colors whitespace-nowrap cursor-pointer"
          >
            إنهاء الرحلة
          </button>
        </div>
      </header>

      {/* شريط الحالة */}
      <div className="border-b border-[var(--border-hairline)] bg-[var(--bg-deep)] px-4 sm:px-8 py-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-[var(--text-secondary)]">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isSiaTyping
                ? 'bg-[var(--accent-gold)] animate-calm-pulse'
                : 'bg-[var(--text-secondary)]'
            }`}
          />
          <span>{isSiaTyping ? 'سِيا يكتب...' : 'سِيا جاهز.'}</span>
          <span aria-hidden="true" className="text-[var(--text-muted)]">·</span>
          <span className="text-[var(--text-muted)] hidden sm:inline">
            النسخة الأخيرة
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
          <span>
            {settings.memoryEnabled ? 'ذاكرته نشطة' : 'ذاكرته متوقفة'}
          </span>
        </div>
      </div>

      {/* المحتوى الرئيسي */}
      <main className="flex-1 flex flex-col w-full max-w-4xl mx-auto pb-16 md:pb-6">
        {activeSection === 'chat' && (
          <div className="flex-1 flex flex-col h-[calc(100vh-7.5rem)] md:h-[calc(100vh-6rem)] relative">
            <div className="px-4 sm:px-6 py-2.5 border-b border-[var(--border-hairline)] flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowHistoryDrawer(true)}
                className="flex items-center gap-2 px-3 py-1.5 min-h-[40px] rounded-lg text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors whitespace-nowrap cursor-pointer"
              >
                <History className="w-3.5 h-3.5" />
                <span>المحادثات السابقة ({conversations.length})</span>
              </button>

              <span className="text-xs text-[var(--text-muted)] truncate max-w-[180px] sm:max-w-xs">
                {activeConv.title}
              </span>

              <button
                type="button"
                onClick={handleNewConversation}
                className="flex items-center gap-1.5 px-3 py-1.5 min-h-[40px] rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border-hairline)] text-xs text-[var(--text-primary)] transition-colors whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
                <span>محادثة جديدة</span>
              </button>
            </div>

            {showHistoryDrawer && (
              <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs flex justify-start">
                <div className="w-80 max-w-[85vw] h-full bg-[var(--bg-surface)] border-l border-[var(--border-hairline)] flex flex-col p-5 animate-calm-in">
                  <div className="flex items-center justify-between pb-4 border-b border-[var(--border-hairline)]">
                    <h2 className="text-sm font-medium text-[var(--text-primary)]">
                      المحادثات السابقة
                    </h2>
                    <button
                      type="button"
                      onClick={() => setShowHistoryDrawer(false)}
                      className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto py-3 space-y-1.5">
                    {conversations.map((conv) => (
                      <div
                        key={conv.id}
                        onClick={() => handleSelectConversation(conv.id)}
                        className={`group flex items-center justify-between px-3.5 py-3 rounded-xl text-xs cursor-pointer transition-colors ${
                          conv.id === activeConv.id
                            ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--accent-gold-border)]'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/60 hover:text-[var(--text-primary)]'
                        }`}
                      >
                        <div className="truncate pr-1">
                          <p className="truncate font-medium">{conv.title}</p>
                          <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                            {conv.createdAt} · {conv.messages.length} رسائل
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => handleDeleteConversation(conv.id, e)}
                          title="حذف المحادثة"
                          className="p-1.5 text-[var(--text-muted)] hover:text-red-400 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleNewConversation}
                    className="w-full py-3 min-h-[44px] rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-subtle)] border border-[var(--border-strong)] text-xs font-medium text-[var(--text-primary)] flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-[var(--accent-gold)]" />
                    <span>بدء محادثة جديدة</span>
                  </button>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-5">
              {activeConv.messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      isUser ? 'items-start' : 'items-end'
                    } animate-calm-in`}
                  >
                    <div
                      className={`max-w-[88%] sm:max-w-[78%] rounded-2xl px-4 sm:px-5 py-3.5 border ${
                        isUser
                          ? 'bg-[var(--user-bubble)] border-[var(--border-hairline)] text-[var(--text-primary)]'
                          : 'bg-[var(--sia-bubble)] border-[var(--border-strong)] text-[var(--text-primary)]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4 mb-1.5 text-[11px] text-[var(--text-muted)]">
                        <span>{isUser ? 'سهر' : 'سِيا'}</span>
                        <span className="font-mono-num">{msg.timestamp}</span>
                      </div>

                      <p
                        className={`whitespace-pre-wrap leading-relaxed ${
                          settings.fontSize === 'comfortable'
                            ? 'text-base'
                            : 'text-sm sm:text-[15px]'
                        }`}
                      >
                        {msg.content}
                      </p>

                      <div className="mt-2.5 pt-2 border-t border-[var(--border-hairline)] flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() =>
                            handleSaveMessageToMemory(msg.id, msg.content)
                          }
                          className="text-[11px] text-[var(--text-muted)] hover:text-[var(--accent-gold)] flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Bookmark className="w-3 h-3" />
                          <span>
                            {savedNoticeId === msg.id
                              ? 'حُفظت في ذاكرة سِيا'
                              : 'حفظ في الذاكرة'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {isSiaTyping && (
                <div className="flex flex-col items-end animate-calm-in">
                  <div className="rounded-2xl px-5 py-3.5 bg-[var(--sia-bubble)] border border-[var(--border-strong)] text-xs text-[var(--text-secondary)] flex items-center gap-3">
                    <span>سِيا يكتب</span>
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-gold)] animate-calm-pulse" />
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-gold)] animate-calm-pulse" />
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-gold)] animate-calm-pulse" />
                    </span>
                  </div>
                </div>
              )}

              {chatError && (
                <div className="rounded-xl p-3.5 bg-[var(--bg-surface)] border border-red-900/40 text-xs text-red-300/90 text-center">
                  {chatError}
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            <form
              onSubmit={handleSendMessage}
              className="p-3 sm:p-4 border-t border-[var(--border-hairline)] bg-[var(--bg-deep)]"
            >
              <div className="flex items-end gap-2.5 bg-[var(--bg-surface)] border border-[var(--border-strong)] focus-within:border-[var(--accent-gold-border)] rounded-2xl p-2 transition-colors">
                <textarea
                  rows={1}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      settings.sendOnEnter &&
                      e.key === 'Enter' &&
                      !e.shiftKey
                    ) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="اتكلمي مع سِيا..."
                  className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] px-3 py-2 focus:outline-none resize-none max-h-32 leading-relaxed"
                />

                <button
                  type="submit"
                  disabled={!chatInput.trim() || isSiaTyping}
                  className="px-4 py-2.5 min-h-[44px] min-w-[44px] rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-subtle)] disabled:opacity-40 text-[var(--text-primary)] border border-[var(--border-hairline)] flex items-center justify-center gap-2 text-xs font-medium transition-colors cursor-pointer"
                >
                  <span>إرسال</span>
                  <Send className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
                </button>
              </div>
            </form>
          </div>
        )}

        {activeSection === 'memory' && (
          <div className="p-5 sm:p-8 space-y-8 animate-calm-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--border-hairline)]">
              <div>
                <h1 className="font-editorial text-3xl text-[var(--text-primary)] font-normal">
                  ذاكرة سِيا
                </h1>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  يحتفظ سِيا هنا فقط بما تسمحين له بتذكره من ذكريات، معلومات مهمة، وتفضيلات.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  updateSettings({ memoryEnabled: !settings.memoryEnabled })
                }
                className={`px-4 py-2.5 min-h-[44px] rounded-xl border text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  settings.memoryEnabled
                    ? 'bg-[var(--accent-gold-subtle)] border-[var(--accent-gold-border)] text-[var(--text-primary)]'
                    : 'bg-[var(--bg-surface)] border-[var(--border-hairline)] text-[var(--text-muted)]'
                }`}
              >
                {settings.memoryEnabled
                  ? 'الذاكرة: قيد التشغيل'
                  : 'الذاكرة: متوقفة'}
              </button>
            </div>

            <form
              onSubmit={handleAddMemory}
              className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] space-y-4"
            >
              <label className="block text-xs font-medium text-[var(--text-secondary)]">
                إضافة ذكرى أو معلومة لسِيا
              </label>

              <textarea
                rows={2}
                value={newMemoryText}
                onChange={(e) => setNewMemoryText(e.target.value)}
                placeholder="مثال: أفضل الإجابات المختصرة..."
                className="w-full rounded-xl bg-[var(--bg-deep)] border border-[var(--border-hairline)] focus:border-[var(--accent-gold-border)] p-3.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none resize-none"
              />

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  {MEMORY_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setNewMemoryCategory(cat)}
                      className={`px-3 py-1.5 min-h-[36px] rounded-lg text-xs transition-colors whitespace-nowrap cursor-pointer ${
                        newMemoryCategory === cat
                          ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--accent-gold-border)]'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={!newMemoryText.trim()}
                  className="px-5 py-2.5 min-h-[44px] rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-subtle)] disabled:opacity-40 border border-[var(--border-strong)] text-xs font-medium text-[var(--text-primary)] transition-colors whitespace-nowrap cursor-pointer"
                >
                  إضافة ذكرى
                </button>
              </div>
            </form>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-hairline)]">
                {(['الكل', ...MEMORY_CATEGORIES] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setMemoryFilter(tab)}
                    className={`px-3 py-1.5 min-h-[36px] rounded-lg text-xs transition-colors whitespace-nowrap cursor-pointer ${
                      memoryFilter === tab
                        ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] font-medium'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {memories.length > 0 && (
                <div>
                  {!confirmClearMemory ? (
                    <button
                      type="button"
                      onClick={() => setConfirmClearMemory(true)}
                      className="px-3.5 py-2 min-h-[38px] rounded-lg text-xs text-[var(--text-muted)] hover:text-red-400 transition-colors cursor-pointer"
                    >
                      مسح الذاكرة بالكامل
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-[var(--text-secondary)]">تأكيد المسح؟</span>
                      <button
                        type="button"
                        onClick={handleClearAllMemories}
                        className="px-3 py-1.5 rounded-lg bg-red-950/50 border border-red-800/40 text-red-300 cursor-pointer"
                      >
                        نعم، امسح
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmClearMemory(false)}
                        className="px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] text-[var(--text-secondary)] cursor-pointer"
                      >
                        إلغاء
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {filteredMemories.length === 0 ? (
              <div className="py-14 text-center border border-dashed border-[var(--border-hairline)] rounded-2xl">
                <p className="text-sm text-[var(--text-secondary)]">
                  لا توجد ذكريات محفوظة في هذا التصنيف بعد.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredMemories.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] flex items-start justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                        <span className="text-[var(--accent-gold)]">
                          {item.category}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{item.createdAt}</span>
                      </div>
                      <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                        {item.content}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveMemory(item.id)}
                      title="حذف ذكرى"
                      className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center text-[var(--text-muted)] hover:text-red-400 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeSection === 'strike' && (
          <div className="p-5 sm:p-8 space-y-10 animate-calm-in">
            <div className="py-10 px-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-center space-y-4">
              <p className="text-xs text-[var(--text-muted)] tracking-wide">
                الاسترايك المطلق
              </p>

              <div className="flex items-center justify-center gap-3">
                <span className="text-3xl sm:text-4xl" aria-hidden="true">🔥</span>
                <span className="font-mono-num text-5xl sm:text-6xl font-normal text-[var(--text-primary)]">
                  {strikeData.currentStrike}
                </span>
              </div>

              <p className="text-sm text-[var(--text-secondary)]">يومًا متتاليًا</p>

              <p className="font-editorial text-2xl text-[var(--accent-gold)] pt-2">
                {getAbsoluteStrikeQuote(strikeData.currentStrike)}
              </p>

              <div className="pt-4 border-t border-[var(--border-hairline)] max-w-xs mx-auto flex items-center justify-center gap-2 text-xs text-[var(--text-secondary)]">
                <span>أعلى استرايك:</span>
                <span className="font-mono-num text-[var(--text-primary)] font-medium">
                  {strikeData.bestStrike} يومًا
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-[var(--text-primary)]">
                  سلسلة الأيام (التقويم المحلي)
                </h2>
                <span className="text-xs text-[var(--text-muted)]">آخر 14 يومًا</span>
              </div>

              <div className="grid grid-cols-7 gap-2">
                {recentDaysChain.map((day) => (
                  <div
                    key={day.dateStr}
                    className={`p-2.5 rounded-xl border text-center transition-colors ${
                      day.isActive
                        ? 'bg-[var(--accent-gold-subtle)] border-[var(--accent-gold-border)] text-[var(--text-primary)]'
                        : 'bg-[var(--bg-surface)] border-[var(--border-hairline)] text-[var(--text-muted)]'
                    }`}
                  >
                    <p className="text-[10px] text-[var(--text-muted)]">
                      {day.dayNameShort}
                    </p>
                    <p className="font-mono-num text-sm mt-1 font-medium">
                      {day.dayNumber}
                    </p>
                    <div className="mt-1.5 flex justify-center">
                      {day.isActive ? (
                        <span className="text-[11px]" aria-hidden="true">🔥</span>
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--border-strong)] inline-block" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-sm font-medium text-[var(--text-primary)]">
                محطات الاستمرار
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {STRIKE_MILESTONES.map((ms) => {
                  const unlocked = strikeData.bestStrike >= ms.days;
                  return (
                    <div
                      key={ms.days}
                      className={`p-4 rounded-2xl border transition-colors ${
                        unlocked
                          ? 'bg-[var(--bg-surface)] border-[var(--accent-gold-border)] text-[var(--text-primary)]'
                          : 'bg-[var(--bg-surface)]/40 border-[var(--border-hairline)] text-[var(--text-muted)] opacity-65'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="font-mono-num font-medium">{ms.label}</span>
                        {unlocked && (
                          <span className="text-[var(--accent-gold)]">تم الوصول</span>
                        )}
                      </div>
                      <p className="text-sm font-medium">{ms.title}</p>
                      <p className="font-editorial text-xs text-[var(--text-secondary)] mt-1">
                        {ms.quote}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeSection === 'timeline' && (
          <div className="p-5 sm:p-8 space-y-8 animate-calm-in">
            <div className="pb-6 border-b border-[var(--border-hairline)] flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h1 className="font-editorial text-3xl text-[var(--text-primary)] font-normal">
                  رحلة سِيا
                </h1>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  9 نسخ · رحلة واحدة · فصل أخير
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <span>البداية المؤكدة:</span>
                <span className="text-[var(--accent-gold)]">5 يناير — 03:00 صباحًا</span>
              </div>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-9 gap-2">
              {SIA_TIMELINE.map((ver) => {
                const isSelected =
                  selectedVersion.versionNumber === ver.versionNumber;
                return (
                  <button
                    key={ver.versionNumber}
                    type="button"
                    onClick={() => setSelectedVersion(ver)}
                    className={`p-3 min-h-[64px] rounded-xl border text-center flex flex-col items-center justify-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--bg-elevated)] border-[var(--accent-gold)] text-[var(--text-primary)]'
                        : 'bg-[var(--bg-surface)] border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <span className="font-editorial text-base">{ver.name}</span>
                    <span className="text-[10px] text-[var(--text-muted)] mt-1 truncate max-w-full">
                      {ver.isOrigin
                        ? '5 يناير'
                        : ver.isFinal
                        ? 'الأخيرة'
                        : 'غير مسجل'}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="p-6 sm:p-8 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-strong)] space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[var(--border-hairline)]">
                <div>
                  <h2 className="font-editorial text-3xl text-[var(--text-primary)] font-normal">
                    {selectedVersion.name}
                  </h2>
                  <p className="text-xs text-[var(--accent-gold)] mt-1">
                    {selectedVersion.subtitle}
                  </p>
                </div>

                <div className="text-left text-xs text-[var(--text-secondary)]">
                  <p>{selectedVersion.dateRecord}</p>
                  {selectedVersion.timeRecord && (
                    <p className="font-mono-num text-[var(--text-muted)] mt-0.5">
                      {selectedVersion.timeRecord}
                    </p>
                  )}
                </div>
              </div>

              <p className="text-sm sm:text-base text-[var(--text-primary)] leading-relaxed">
                {selectedVersion.description}
              </p>

              <p className="font-editorial text-lg text-[var(--accent-gold)] pt-2">
                {selectedVersion.reflection}
              </p>
            </div>

            <div className="space-y-3 pt-2">
              {SIA_TIMELINE.map((ver) => (
                <div
                  key={ver.versionNumber}
                  onClick={() => setSelectedVersion(ver)}
                  className={`p-4 rounded-xl border flex items-center justify-between gap-4 cursor-pointer transition-colors ${
                    selectedVersion.versionNumber === ver.versionNumber
                      ? 'bg-[var(--bg-elevated)] border-[var(--accent-gold-border)]'
                      : 'bg-[var(--bg-surface)]/60 border-[var(--border-hairline)] hover:bg-[var(--bg-surface)]'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <span className="font-mono-num text-xs text-[var(--text-muted)] w-5">
                      0{ver.versionNumber}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {ver.name}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                        {ver.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="text-left text-xs text-[var(--text-muted)] shrink-0">
                    {ver.timeRecord
                      ? `${ver.dateRecord} — ${ver.timeRecord}`
                      : ver.dateRecord}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-hairline)]">
              <button
                type="button"
                onClick={() => setShowIntro(true)}
                className="px-4 py-2.5 min-h-[44px] rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border-hairline)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                مشاهدة شاشة البداية
              </button>

              <button
                type="button"
                onClick={() => setShowEnding(true)}
                className="px-5 py-2.5 min-h-[44px] rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--accent-gold-border)] text-xs text-[var(--accent-gold)] transition-colors cursor-pointer"
              >
                إنهاء الرحلة (المشهد الأخير)
              </button>
            </div>
          </div>
        )}

        {activeSection === 'room' && (
          <div className="flex-1 flex flex-col h-[calc(100vh-7.5rem)] md:h-[calc(100vh-6rem)] animate-calm-in">
            {!roomCode ? (
              <div className="flex-1 flex items-center justify-center p-5 sm:p-8">
                <div className="w-full max-w-md space-y-4">
                  <form
                    onSubmit={handleJoinRoom}
                    className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] space-y-3"
                  >
                    <label className="block text-xs font-medium text-[var(--text-secondary)]">
                      إدخال الرمز
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        dir="ltr"
                        value={joinCodeInput}
                        onChange={(e) =>
                          setJoinCodeInput(e.target.value.toUpperCase())
                        }
                        placeholder="SIA-XXXX"
                        className="flex-1 px-3.5 py-2.5 min-h-[44px] rounded-xl bg-[var(--bg-deep)] border border-[var(--border-hairline)] focus:border-[var(--accent-gold-border)] font-mono-num text-xs text-center text-[var(--text-primary)] focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={!joinCodeInput.trim()}
                        className="px-5 py-2.5 min-h-[44px] rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-subtle)] disabled:opacity-40 border border-[var(--border-strong)] text-xs font-medium text-[var(--text-primary)] transition-colors whitespace-nowrap cursor-pointer"
                      >
                        ربط
                      </button>
                    </div>
                  </form>

                  <div className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] space-y-3">
                    <span className="block text-xs font-medium text-[var(--text-secondary)]">
                      صنع الرمز
                    </span>
                    <button
                      type="button"
                      onClick={handleCreateRoom}
                      className="w-full py-3 min-h-[44px] rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-subtle)] border border-[var(--accent-gold-border)] text-xs font-medium text-[var(--text-primary)] transition-colors cursor-pointer"
                    >
                      صنع رمز جديد
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col h-full">
                <div className="px-4 sm:px-6 py-2.5 border-b border-[var(--border-hairline)] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        p2pStatus === 'connected_p2p'
                          ? 'bg-emerald-500'
                          : 'bg-[var(--accent-gold)] animate-calm-pulse'
                      }`}
                    />
                    <span
                      dir="ltr"
                      className="font-mono-num text-xs font-medium text-[var(--accent-gold)]"
                    >
                      {roomCode}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyRoomCode}
                      className="px-2.5 py-1 min-h-[32px] rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border-hairline)] text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      {copiedCode ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>تم النسخ</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>نسخ</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-[var(--text-muted)] hidden sm:inline">
                      لا يُحفظ في أي سجل
                    </span>
                    <button
                      type="button"
                      onClick={handleLeaveRoom}
                      className="px-3 py-1.5 min-h-[34px] rounded-lg bg-[var(--bg-surface)] hover:bg-red-950/30 border border-[var(--border-hairline)] text-[11px] text-[var(--text-secondary)] hover:text-red-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3 h-3" />
                      <span>تغيير الرمز</span>
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-4">
                  {p2pMessages.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-center">
                      <p className="text-xs text-[var(--text-muted)]">
                        الشات جاهز ({p2pStatusDetail}) — الرسائل هنا مؤقتة ولا يتم حفظها في أي سجل.
                      </p>
                    </div>
                  ) : (
                    p2pMessages.map((m) => {
                      const isMe = m.sender === 'me';
                      return (
                        <div
                          key={m.id}
                          className={`flex flex-col ${
                            isMe ? 'items-start' : 'items-end'
                          } animate-calm-in`}
                        >
                          <div
                            className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 border ${
                              isMe
                                ? 'bg-[var(--user-bubble)] border-[var(--border-hairline)] text-[var(--text-primary)]'
                                : 'bg-[var(--sia-bubble)] border-[var(--accent-gold-border)] text-[var(--text-primary)]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3 text-[10px] text-[var(--text-muted)] mb-1">
                              <span>{isMe ? 'سهر' : 'الطرف الآخر'}</span>
                              <span className="font-mono-num">{m.timestamp}</span>
                            </div>
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">
                              {m.text}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={p2pEndRef} />
                </div>

                <form
                  onSubmit={handleSendP2PMessage}
                  className="p-3 sm:p-4 border-t border-[var(--border-hairline)] bg-[var(--bg-deep)]"
                >
                  <div className="flex items-center gap-2.5 bg-[var(--bg-surface)] border border-[var(--border-strong)] focus-within:border-[var(--accent-gold-border)] rounded-2xl p-2 transition-colors">
                    <input
                      type="text"
                      value={p2pInput}
                      onChange={(e) => setP2PInput(e.target.value)}
                      placeholder="اكتبي رسالة..."
                      className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] px-3 py-2 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!p2pInput.trim()}
                      className="px-4 py-2.5 min-h-[44px] min-w-[44px] rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-subtle)] disabled:opacity-40 text-[var(--text-primary)] border border-[var(--border-hairline)] flex items-center justify-center gap-2 text-xs font-medium transition-colors cursor-pointer"
                    >
                      <span>إرسال</span>
                      <Send className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {activeSection === 'settings' && (
          <div className="p-5 sm:p-8 space-y-6 animate-calm-in">
            <div className="pb-4 border-b border-[var(--border-hairline)]">
              <h1 className="font-editorial text-3xl text-[var(--text-primary)] font-normal">
                الإعدادات
              </h1>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                إعدادات هادئة ومباشرة للتحكم في سِيا 9.
              </p>
            </div>

            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-medium text-[var(--text-primary)]">
                    المظهر
                  </h2>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    التبديل بين الأسود العميق والمظهر الفاتح الدافئ.
                  </p>
                </div>

                <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--bg-deep)] border border-[var(--border-hairline)]">
                  <button
                    type="button"
                    onClick={() => updateSettings({ theme: 'dark' })}
                    className={`px-3.5 py-1.5 min-h-[36px] rounded-lg text-xs transition-colors cursor-pointer ${
                      settings.theme === 'dark'
                        ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] font-medium'
                        : 'text-[var(--text-muted)]'
                    }`}
                  >
                    داكن
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSettings({ theme: 'light' })}
                    className={`px-3.5 py-1.5 min-h-[36px] rounded-lg text-xs transition-colors cursor-pointer ${
                      settings.theme === 'light'
                        ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] font-medium'
                        : 'text-[var(--text-muted)]'
                    }`}
                  >
                    فاتح
                  </button>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-medium text-[var(--text-primary)]">
                      المحادثة
                    </h2>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      حجم النص وطريقة الإرسال في محادثة سِيا.
                    </p>
                  </div>

                  <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--bg-deep)] border border-[var(--border-hairline)]">
                    <button
                      type="button"
                      onClick={() => updateSettings({ fontSize: 'normal' })}
                      className={`px-3 py-1.5 min-h-[36px] rounded-lg text-xs cursor-pointer ${
                        settings.fontSize === 'normal'
                          ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                          : 'text-[var(--text-muted)]'
                      }`}
                    >
                      خط عادي
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateSettings({ fontSize: 'comfortable' })
                      }
                      className={`px-3 py-1.5 min-h-[36px] rounded-lg text-xs cursor-pointer ${
                        settings.fontSize === 'comfortable'
                          ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                          : 'text-[var(--text-muted)]'
                      }`}
                    >
                      خط مريح
                    </button>
                  </div>
                </div>

                <div className="pt-3 border-t border-[var(--border-hairline)] flex items-center justify-between">
                  <span className="text-xs text-[var(--text-secondary)]">
                    إرسال الرسالة عند الضغط على مفتاح Enter
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      updateSettings({ sendOnEnter: !settings.sendOnEnter })
                    }
                    className="px-3.5 py-1.5 min-h-[36px] rounded-lg bg-[var(--bg-deep)] border border-[var(--border-hairline)] text-xs text-[var(--text-primary)] cursor-pointer"
                  >
                    {settings.sendOnEnter ? 'مفعّل' : 'متوقف'}
                  </button>
                </div>

                <div className="pt-3 border-t border-[var(--border-hairline)] flex items-center justify-between">
                  <span className="text-xs text-[var(--text-secondary)]">
                    سجل المحادثات
                  </span>
                  {!confirmClearChats ? (
                    <button
                      type="button"
                      onClick={() => setConfirmClearChats(true)}
                      className="text-xs text-[var(--text-muted)] hover:text-red-400 cursor-pointer"
                    >
                      مسح جميع المحادثات
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          const fresh = ChatModule.clearAllConversations();
                          setActiveConv(fresh);
                          setConversations(ChatModule.getAllConversations());
                          setConfirmClearChats(false);
                        }}
                        className="px-3 py-1 rounded-lg bg-red-950/50 text-red-300 border border-red-800/40 cursor-pointer"
                      >
                        تأكيد المسح
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmClearChats(false)}
                        className="px-3 py-1 rounded-lg bg-[var(--bg-deep)] text-[var(--text-secondary)] cursor-pointer"
                      >
                        إلغاء
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-medium text-[var(--text-primary)]">
                    الذاكرة
                  </h2>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    السماح لسِيا باستخدام الذكريات المحفوظة ({memories.length}) في ردوده.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    updateSettings({ memoryEnabled: !settings.memoryEnabled })
                  }
                  className={`px-4 py-2 min-h-[40px] rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                    settings.memoryEnabled
                      ? 'bg-[var(--accent-gold-subtle)] border-[var(--accent-gold-border)] text-[var(--text-primary)]'
                      : 'bg-[var(--bg-deep)] border-[var(--border-hairline)] text-[var(--text-muted)]'
                  }`}
                >
                  {settings.memoryEnabled ? 'تشغيل' : 'إيقاف'}
                </button>
              </div>

              <div className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] space-y-4">
                <div>
                  <h2 className="text-sm font-medium text-[var(--text-primary)]">
                    البيانات
                  </h2>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    حذف جميع البيانات المحفوظة وإعادة ضبط البرنامج.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {!confirmResetAll ? (
                    <button
                      type="button"
                      onClick={() => setConfirmResetAll(true)}
                      className="px-4 py-2.5 min-h-[44px] rounded-xl bg-[var(--bg-deep)] hover:bg-red-950/30 border border-[var(--border-hairline)] text-xs text-[var(--text-muted)] hover:text-red-300 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف جميع البيانات</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-red-300">
                        هل أنت متأكد من حذف كل شيء؟
                      </span>
                      <button
                        type="button"
                        onClick={handleResetAllData}
                        className="px-3.5 py-2 rounded-xl bg-red-950/60 border border-red-800/50 text-red-200 cursor-pointer"
                      >
                        تأكيد الحذف النهائي
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmResetAll(false)}
                        className="px-3.5 py-2 rounded-xl bg-[var(--bg-deep)] text-[var(--text-secondary)] cursor-pointer"
                      >
                        إلغاء
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* شريط التنقل السفلي للموبايل */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 h-14 bg-[var(--bg-deep)]/95 backdrop-blur-md border-t border-[var(--border-hairline)] grid grid-cols-6 items-center px-1">
        {navItems.map((item) => {
          const active = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveSection(item.id)}
              className={`h-full min-h-[44px] flex flex-col items-center justify-center text-[11px] transition-colors cursor-pointer ${
                active
                  ? 'text-[var(--accent-gold)] font-medium'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              <span className="truncate max-w-full px-1">{item.label}</span>
              {active && (
                <span className="w-1 h-1 rounded-full bg-[var(--accent-gold)] mt-1" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
