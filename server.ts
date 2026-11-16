import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const GROQ_API_KEY =
  process.env.GROQ_API_KEY || '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';

async function callGroqAPI(
  messages: Array<{ role: string; content: string }>,
  systemPrompt?: string
): Promise<{ reply: string; model: string }> {
  const formatted: Array<{ role: string; content: string }> = [];
  if (systemPrompt) {
    formatted.push({ role: 'system', content: systemPrompt });
  }
  for (const m of messages) {
    formatted.push({
      role: m.role === 'assistant' || m.role === 'model' ? 'assistant' : 'user',
      content: String(m.content || ''),
    });
  }

  const modelsToTry = ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b'];
  let lastError: any = null;

  for (const modelName of modelsToTry) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: modelName,
          messages: formatted,
          temperature: 0.7,
          max_tokens: 1500,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        lastError = new Error(
          `Groq model ${modelName} returned status ${response.status}: ${errorBody}`
        );
        continue;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) {
        return { reply: content, model: modelName };
      }
    } catch (e) {
      lastError = e;
    }
  }

  throw lastError || new Error('فشلت جميع نماذج Groq');
}

// In-memory WebRTC Signaling store (solely for exchanging SDP Offer/Answer & ICE candidates to establish P2P WebRTC)
interface SignalingRoom {
  code: string;
  createdAt: number;
  offer: RTCSessionDescriptionInit | null;
  answer: RTCSessionDescriptionInit | null;
  hostCandidates: RTCIceCandidateInit[];
  guestCandidates: RTCIceCandidateInit[];
  status: 'waiting' | 'negotiating' | 'connected' | 'closed';
}

const signalingRooms = new Map<string, SignalingRoom>();

// Clean up stale signaling rooms older than 2 hours
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of signalingRooms.entries()) {
    if (now - room.createdAt > 2 * 60 * 60 * 1000) {
      signalingRooms.delete(code);
    }
  }
}, 10 * 60 * 1000);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '2mb' }));

  // ============================================================================
  // 1. AI API Endpoint — Sia 9 Personal AI
  // ============================================================================
  app.post('/api/ai/chat', async (req, res) => {
    try {
      const { messages, systemPrompt, model } = req.body;

      if (!Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({ error: 'الرسائل مطلوبة لإجراء المحادثة.' });
        return;
      }

      // Prioritize Groq using the provided API key
      if (GROQ_API_KEY) {
        try {
          const groqResult = await callGroqAPI(messages, systemPrompt);
          res.json({ reply: groqResult.reply, model: groqResult.model });
          return;
        } catch (groqErr) {
          console.warn('Groq API error, falling back to Gemini:', groqErr);
        }
      }

      // Fallback to Gemini if available
      if (process.env.GEMINI_API_KEY) {
        const selectedModel = model || 'gemini-3.8-flash';

        const formattedContents = messages.map(
          (msg: { role: string; content: string }) => ({
            role:
              msg.role === 'assistant' || msg.role === 'model'
                ? 'model'
                : 'user',
            parts: [{ text: String(msg.content || '') }],
          })
        );

        const response = await ai.models.generateContent({
          model: selectedModel,
          contents: formattedContents,
          config: {
            systemInstruction: systemPrompt || undefined,
            temperature: 0.7,
          },
        });

        const replyText = response.text || 'سِيا هنا، لكن لم يصل نص في هذا الرد.';
        res.json({ reply: replyText, model: selectedModel });
        return;
      }

      throw new Error('تعذر الاتصال بمحرك الذكاء الاصطناعي.');
    } catch (error: any) {
      console.error('Sia AI Error:', error);
      res.status(500).json({
        error:
          error?.message || 'تعذر الاتصال بمحرك الذكاء الاصطناعي في الوقت الحالي.',
      });
    }
  });

  // ============================================================================
  // 2. WebRTC Signaling Endpoints (Used only to establish P2P DataChannel)
  // ============================================================================
  // Host creates a room with an initial WebRTC SDP Offer
  app.post('/api/signaling/create', (req, res) => {
    const { code, offer } = req.body;
    if (!code || !offer) {
      res.status(400).json({ error: 'رمز الغرفة وعرض الاتصال (Offer) مطلوبان.' });
      return;
    }
    const normalizedCode = String(code).trim().toUpperCase();
    signalingRooms.set(normalizedCode, {
      code: normalizedCode,
      createdAt: Date.now(),
      offer,
      answer: null,
      hostCandidates: [],
      guestCandidates: [],
      status: 'waiting',
    });
    res.json({ ok: true, code: normalizedCode });
  });

  // Fetch room signaling state (Offer, Answer, ICE Candidates)
  app.get('/api/signaling/room/:code', (req, res) => {
    const normalizedCode = String(req.params.code || '').trim().toUpperCase();
    const room = signalingRooms.get(normalizedCode);
    if (!room) {
      res.status(404).json({ error: 'لم يتم العثور على غرفة بهذا الرمز.' });
      return;
    }
    res.json({
      code: room.code,
      offer: room.offer,
      answer: room.answer,
      hostCandidates: room.hostCandidates,
      guestCandidates: room.guestCandidates,
      status: room.status,
    });
  });

  // Guest submits WebRTC SDP Answer to join room
  app.post('/api/signaling/join', (req, res) => {
    const { code, answer } = req.body;
    const normalizedCode = String(code || '').trim().toUpperCase();
    const room = signalingRooms.get(normalizedCode);
    if (!room) {
      res.status(404).json({ error: 'لم يتم العثور على غرفة بهذا الرمز.' });
      return;
    }
    room.answer = answer;
    room.status = 'negotiating';
    res.json({ ok: true });
  });

  // Exchange ICE candidates between Host and Guest
  app.post('/api/signaling/candidate', (req, res) => {
    const { code, role, candidate } = req.body;
    const normalizedCode = String(code || '').trim().toUpperCase();
    const room = signalingRooms.get(normalizedCode);
    if (!room || !candidate) {
      res.status(404).json({ error: 'الغرفة غير موجودة أو بيانات المرشح ناقصة.' });
      return;
    }
    if (role === 'host') {
      room.hostCandidates.push(candidate);
    } else {
      room.guestCandidates.push(candidate);
    }
    res.json({ ok: true });
  });

  // Close / remove signaling room
  app.delete('/api/signaling/room/:code', (req, res) => {
    const normalizedCode = String(req.params.code || '').trim().toUpperCase();
    signalingRooms.delete(normalizedCode);
    res.json({ ok: true });
  });

  // ============================================================================
  // 3. Vite Middleware (Dev) or Static Assets (Prod)
  // ============================================================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Sia 9 server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
