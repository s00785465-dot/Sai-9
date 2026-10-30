/**
 * وحدة الاتصال المباشر نظير-لنظير (P2P / WebRTC Module) — غرفة سِيا
 * ملاحظة: الرسائل في غرفة سِيا تنتقل مباشرة عبر P2P ولا يتم حفظها في أي سجل على الإطلاق.
 */

export type P2PConnectionStatus =
  | 'disconnected'
  | 'creating'
  | 'waiting_peer'
  | 'joining'
  | 'negotiating'
  | 'connected_p2p'
  | 'error';

export interface P2PMessage {
  id: string;
  sender: 'me' | 'peer' | 'system';
  text: string;
  timestamp: string;
}

export interface P2PCallbacks {
  onStatusChange: (status: P2PConnectionStatus, detail?: string) => void;
  onMessage: (msg: P2PMessage) => void;
  onRoomCodeReady: (code: string) => void;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

function generateShortRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let part = '';
  for (let i = 0; i < 4; i++) {
    part += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `SIA-${part}`;
}

function nowTime(): string {
  return new Date().toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export class SiaP2PRoom {
  private pc: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private roomCode: string = '';
  private role: 'host' | 'guest' | null = null;
  private callbacks: P2PCallbacks;
  private addedRemoteCandidatesCount = 0;
  private pendingOutgoingQueue: Array<{ id: string; text: string; timestamp: string }> = [];

  constructor(callbacks: P2PCallbacks) {
    this.callbacks = callbacks;
  }

  public getActiveCode(): string {
    return this.roomCode;
  }

  private setupDataChannel(channel: RTCDataChannel) {
    this.dataChannel = channel;

    channel.onopen = () => {
      this.stopSignalingPoll();
      this.callbacks.onStatusChange('connected_p2p', 'متصل (P2P)');

      // إرسال أي رسائل مؤقتة كُتبت أثناء التفاوض فور فتح القناة المباشرة
      while (this.pendingOutgoingQueue.length > 0) {
        const queued = this.pendingOutgoingQueue.shift();
        if (queued && channel.readyState === 'open') {
          try {
            channel.send(JSON.stringify(queued));
          } catch {
            // ignore
          }
        }
      }
    };

    channel.onclose = () => {
      this.callbacks.onStatusChange('waiting_peer', 'بانتظار الطرف الآخر...');
    };

    channel.onerror = () => {
      this.callbacks.onStatusChange('error', 'خطأ في الاتصال');
    };

    channel.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        this.callbacks.onMessage({
          id: parsed.id || `p2p_peer_${Date.now()}`,
          sender: 'peer',
          text: String(parsed.text || ''),
          timestamp: parsed.timestamp || nowTime(),
        });
      } catch {
        this.callbacks.onMessage({
          id: `p2p_peer_${Date.now()}`,
          sender: 'peer',
          text: String(event.data),
          timestamp: nowTime(),
        });
      }
    };
  }

  /**
   * إنشاء غرفة جديدة أو تفعيل رمز محفوظ كمضيف (Host)
   */
  async createRoom(customCode?: string): Promise<string> {
    this.leaveRoom(false);
    this.role = 'host';
    this.roomCode = (customCode || generateShortRoomCode()).trim().toUpperCase();
    this.addedRemoteCandidatesCount = 0;

    this.callbacks.onRoomCodeReady(this.roomCode);
    this.callbacks.onStatusChange('creating', 'جاري تجهيز الغرفة...');

    try {
      this.pc = new RTCPeerConnection(RTC_CONFIG);

      const channel = this.pc.createDataChannel('sia9-p2p-room', {
        ordered: true,
      });
      this.setupDataChannel(channel);

      this.pc.onicecandidate = async (event) => {
        if (event.candidate && this.roomCode) {
          try {
            await fetch('/api/signaling/candidate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                code: this.roomCode,
                role: 'host',
                candidate: event.candidate.toJSON(),
              }),
            });
          } catch {
            // ignore
          }
        }
      };

      this.pc.onconnectionstatechange = () => {
        if (!this.pc) return;
        if (this.pc.connectionState === 'disconnected' || this.pc.connectionState === 'failed') {
          this.callbacks.onStatusChange('waiting_peer', 'بانتظار الطرف الآخر...');
        }
      };

      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      const res = await fetch('/api/signaling/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: this.roomCode,
          offer: this.pc.localDescription,
        }),
      });

      if (!res.ok) {
        throw new Error('تعذر تهيئة الغرفة.');
      }

      this.callbacks.onStatusChange('waiting_peer', 'بانتظار الطرف الآخر...');
      this.startHostSignalingPoll();
      return this.roomCode;
    } catch (err: any) {
      this.callbacks.onStatusChange('error', err?.message || 'تعذر إنشاء الغرفة.');
      throw err;
    }
  }

  /**
   * الربط باستخدام رمز الغرفة:
   * إذا كانت الغرفة موجودة وبانتظار طرف ثانٍ ينضم إليها كـ Guest،
   * وإذا لم تكن مفعّلة بعد على الخادم يفتحها بهذا الرمز كـ Host ليدخل للشات فورًا.
   */
  async connectWithCode(inputCode: string): Promise<string> {
    const code = inputCode.trim().toUpperCase();
    if (!code) throw new Error('الرمز مطلوب');

    try {
      const checkRes = await fetch(`/api/signaling/room/${encodeURIComponent(code)}`);
      if (checkRes.ok) {
        const roomData = await checkRes.json();
        if (roomData.offer && !roomData.answer) {
          await this.joinRoom(code, roomData);
          return code;
        }
      }
    } catch {
      // ignore and host with this code
    }

    return await this.createRoom(code);
  }

  /**
   * الانضمام إلى غرفة نشطة باستخدام الرمز (Guest)
   */
  async joinRoom(inputCode: string, prefetchedRoomData?: any): Promise<void> {
    const code = inputCode.trim().toUpperCase();
    if (!code) return;

    this.leaveRoom(false);
    this.role = 'guest';
    this.roomCode = code;
    this.addedRemoteCandidatesCount = 0;

    this.callbacks.onRoomCodeReady(this.roomCode);
    this.callbacks.onStatusChange('joining', 'جاري الربط...');

    try {
      let roomData = prefetchedRoomData;
      if (!roomData) {
        const roomRes = await fetch(`/api/signaling/room/${encodeURIComponent(code)}`);
        if (!roomRes.ok) {
          await this.createRoom(code);
          return;
        }
        roomData = await roomRes.json();
      }

      if (!roomData.offer) {
        await this.createRoom(code);
        return;
      }

      this.pc = new RTCPeerConnection(RTC_CONFIG);

      this.pc.ondatachannel = (event) => {
        this.setupDataChannel(event.channel);
      };

      this.pc.onicecandidate = async (event) => {
        if (event.candidate && this.roomCode) {
          try {
            await fetch('/api/signaling/candidate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                code: this.roomCode,
                role: 'guest',
                candidate: event.candidate.toJSON(),
              }),
            });
          } catch {
            // ignore
          }
        }
      };

      this.pc.onconnectionstatechange = () => {
        if (!this.pc) return;
        if (this.pc.connectionState === 'disconnected' || this.pc.connectionState === 'failed') {
          this.callbacks.onStatusChange('waiting_peer', 'بانتظار الطرف الآخر...');
        }
      };

      this.callbacks.onStatusChange('negotiating', 'جاري فتح قناة P2P...');

      await this.pc.setRemoteDescription(new RTCSessionDescription(roomData.offer));

      if (Array.isArray(roomData.hostCandidates)) {
        for (const cand of roomData.hostCandidates) {
          await this.pc.addIceCandidate(new RTCIceCandidate(cand));
        }
        this.addedRemoteCandidatesCount = roomData.hostCandidates.length;
      }

      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);

      const joinRes = await fetch('/api/signaling/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: this.roomCode,
          answer: this.pc.localDescription,
        }),
      });

      if (!joinRes.ok) {
        throw new Error('تعذر إرسال استجابة الربط.');
      }

      this.startGuestSignalingPoll();
    } catch (err: any) {
      this.callbacks.onStatusChange('error', err?.message || 'تعذر الربط.');
      throw err;
    }
  }

  private startHostSignalingPoll() {
    this.stopSignalingPoll();
    let answerApplied = false;

    this.pollTimer = setInterval(async () => {
      if (!this.pc || !this.roomCode) return;
      try {
        const res = await fetch(`/api/signaling/room/${encodeURIComponent(this.roomCode)}`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.answer && !answerApplied && this.pc.signalingState === 'have-local-offer') {
          answerApplied = true;
          this.callbacks.onStatusChange('negotiating', 'جاري فتح قناة P2P...');
          await this.pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        }

        if (answerApplied && Array.isArray(data.guestCandidates)) {
          while (this.addedRemoteCandidatesCount < data.guestCandidates.length) {
            const cand = data.guestCandidates[this.addedRemoteCandidatesCount];
            this.addedRemoteCandidatesCount++;
            await this.pc.addIceCandidate(new RTCIceCandidate(cand));
          }
        }
      } catch {
        // ignore poll error
      }
    }, 1200);
  }

  private startGuestSignalingPoll() {
    this.stopSignalingPoll();

    this.pollTimer = setInterval(async () => {
      if (!this.pc || !this.roomCode) return;
      try {
        const res = await fetch(`/api/signaling/room/${encodeURIComponent(this.roomCode)}`);
        if (!res.ok) return;
        const data = await res.json();

        if (Array.isArray(data.hostCandidates)) {
          while (this.addedRemoteCandidatesCount < data.hostCandidates.length) {
            const cand = data.hostCandidates[this.addedRemoteCandidatesCount];
            this.addedRemoteCandidatesCount++;
            await this.pc.addIceCandidate(new RTCIceCandidate(cand));
          }
        }
      } catch {
        // ignore
      }
    }, 1200);
  }

  private stopSignalingPoll() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /**
   * إرسال رسالة مباشرة عبر قناة بيانات WebRTC (دون حفظها في أي سجل)
   */
  sendMessage(text: string): boolean {
    const trimmed = text.trim();
    if (!trimmed) return false;

    const msg: P2PMessage = {
      id: `p2p_msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      sender: 'me',
      text: trimmed,
      timestamp: nowTime(),
    };

    const payload = {
      id: msg.id,
      text: msg.text,
      timestamp: msg.timestamp,
    };

    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify(payload));
    } else {
      this.pendingOutgoingQueue.push(payload);
    }

    this.callbacks.onMessage(msg);
    return true;
  }

  /**
   * مغادرة الغرفة وإغلاق اتصال WebRTC ومسح الرسائل المؤقتة
   */
  leaveRoom(notifyStatus: boolean = true) {
    this.stopSignalingPoll();
    this.pendingOutgoingQueue = [];

    if (this.roomCode && this.role === 'host') {
      fetch(`/api/signaling/room/${encodeURIComponent(this.roomCode)}`, {
        method: 'DELETE',
      }).catch(() => {});
    }

    if (this.dataChannel) {
      try {
        this.dataChannel.close();
      } catch {}
      this.dataChannel = null;
    }

    if (this.pc) {
      try {
        this.pc.close();
      } catch {}
      this.pc = null;
    }

    this.roomCode = '';
    this.role = null;
    this.addedRemoteCandidatesCount = 0;

    if (notifyStatus) {
      this.callbacks.onStatusChange('disconnected', 'غير متصل');
    }
  }
}
