import { NextResponse } from "next/server";
import WebSocket from "ws";
import { bcp47For, isVoiceLang, type VoiceLang } from "@/lib/voice/languages";

export const runtime = "nodejs";

interface ActiveSession {
  ws: WebSocket;
  controller: ReadableStreamDefaultController<Uint8Array>;
  timer: NodeJS.Timeout;
  lang: string;
}

const activeSessions = new Map<string, ActiveSession>();

const SARVAM_REALTIME_WS_URL =
  process.env.SARVAM_REALTIME_WS_URL || "wss://api.sarvam.ai/speech-to-text-realtime/ws";

function cleanupSession(sessionId: string) {
  const session = activeSessions.get(sessionId);
  if (!session) return;
  activeSessions.delete(sessionId);
  clearTimeout(session.timer);
  try {
    session.ws.close();
  } catch {
    /* ignore */
  }
}

/**
 * GET: Open an SSE stream for real-time transcript updates.
 * Query parameters:
 *   sessionId: Unique client session ID
 *   lang: User's voice language (e.g. "hi", "en", "ta")
 */
export async function GET(req: Request) {
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "realtime_unavailable", reason: "SARVAM_API_KEY not configured" },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");
  const rawLang = searchParams.get("lang") || "en";
  const voiceLang: VoiceLang = isVoiceLang(rawLang) ? rawLang : "en";
  const bcp47 = bcp47For(voiceLang);

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  cleanupSession(sessionId);

  const encoder = new TextEncoder();
  let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller;
    },
    cancel() {
      cleanupSession(sessionId);
    },
  });

  const targetWsUrl = `${SARVAM_REALTIME_WS_URL}?language_code=${encodeURIComponent(bcp47)}&model=saaras:v3-realtime`;

  try {
    const ws = new WebSocket(targetWsUrl, {
      headers: {
        "Api-Subscription-Key": apiKey,
      },
      handshakeTimeout: 5000,
    });

    const sessionTimer = setTimeout(() => {
      cleanupSession(sessionId);
    }, 60000); // 60s max session timeout

    ws.on("open", () => {
      if (streamController) {
        streamController.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "connected", sessionId })}\n\n`)
        );
      }
    });

    ws.on("message", (raw: WebSocket.Data) => {
      if (!streamController) return;
      try {
        const payload = JSON.parse(raw.toString());
        // Handle various message envelope schemas from Sarvam
        const transcript =
          payload.transcript ??
          payload.text ??
          payload.data?.transcript ??
          (typeof payload.data === "string" ? payload.data : "");
        const isFinal =
          Boolean(payload.is_final ??
          payload.isFinal ??
          (payload.type === "final" ||
          payload.event === "transcript_final" ||
          false));
        const detectedLanguage =
          payload.language_code ?? payload.languageCode ?? bcp47;

        if (transcript) {
          const eventType = isFinal ? "final" : "interim";
          streamController.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: eventType,
                text: transcript,
                isFinal,
                languageCode: detectedLanguage,
              })}\n\n`
            )
          );
        }
      } catch {
        /* non-json or ping frame */
      }
    });

    ws.on("error", (err: Error) => {
      if (streamController) {
        streamController.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", error: err.message })}\n\n`
          )
        );
      }
      cleanupSession(sessionId);
    });

    ws.on("close", () => {
      if (streamController) {
        streamController.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "closed" })}\n\n`)
        );
      }
      cleanupSession(sessionId);
    });

    if (streamController) {
      activeSessions.set(sessionId, {
        ws,
        controller: streamController,
        timer: sessionTimer,
        lang: bcp47,
      });
    }

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    cleanupSession(sessionId);
    return NextResponse.json(
      { error: "realtime_failed", reason: err instanceof Error ? err.message : "websocket failed" },
      { status: 502 }
    );
  }
}

/**
 * POST: Forward base64 PCM audio chunks from client to Sarvam WebSocket.
 * Body: { sessionId: string, audio?: string, isFinal?: boolean }
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    sessionId?: string;
    audio?: string;
    isFinal?: boolean;
  };

  const { sessionId, audio, isFinal } = body;
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  const session = activeSessions.get(sessionId);
  if (!session || session.ws.readyState !== WebSocket.OPEN) {
    return NextResponse.json({ error: "session_inactive" }, { status: 410 });
  }

  try {
    if (audio) {
      // Send audio chunk to Sarvam
      const frame = JSON.stringify({
        event: "audio_input",
        audio,
      });
      session.ws.send(frame);
    }

    if (isFinal) {
      // Signal speech turn completion
      const endFrame = JSON.stringify({
        event: "audio_end",
      });
      session.ws.send(endFrame);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: "send_failed", reason: err instanceof Error ? err.message : "failed to send audio" },
      { status: 500 }
    );
  }
}
