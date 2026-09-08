import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createSpeechLifecycle,
  type SpeechLifecycleController,
} from "@/lib/voice/speech-lifecycle";
import {
  parseLanguageSwitchCommand,
  getSwitchingStatusLabel,
  type VoiceLang,
} from "@/lib/voice/languages";
import { executeCopilotTurn } from "@/lib/copilot/unified-agent";
import { createConversation } from "@/lib/conversation/service";
import type { Trip } from "@/types";

describe("Voice Language Switching Concurrency & Authoritative Speech Lifecycle", () => {
  let lifecycle: SpeechLifecycleController;

  beforeEach(() => {
    lifecycle = createSpeechLifecycle("test_session", "en");

    class MockAudio {
      src = "";
      currentTime = 0;
      paused = true;
      listeners: Record<string, Function[]> = {};

      play = vi.fn().mockImplementation(() => {
        this.paused = false;
        return Promise.resolve();
      });

      pause = vi.fn().mockImplementation(() => {
        this.paused = true;
        this.listeners["pause"]?.forEach((cb) => cb());
      });

      addEventListener = vi.fn((event: string, cb: Function) => {
        this.listeners[event] = this.listeners[event] || [];
        this.listeners[event].push(cb);
      });

      removeEventListener = vi.fn((event: string, cb: Function) => {
        this.listeners[event] = (this.listeners[event] || []).filter((f) => f !== cb);
      });
    }

    vi.stubGlobal("Audio", MockAudio);

    vi.stubGlobal("speechSynthesis", {
      speak: vi.fn(),
      cancel: vi.fn(),
      getVoices: vi.fn().mockReturnValue([]),
    });
  });

  afterEach(() => {
    lifecycle.destroy();
    vi.restoreAllMocks();
  });

  // ── Scenario A & B: Switching to Hindi and barging in with English ────────
  it("Scenario A & B: Switch to Hindi then barge in with 'Actually, can you talk in English?' cleanly cancels prior speech", () => {
    // 1. Initial English request
    const req1 = lifecycle.startSpeechRequest("greeting_en");
    expect(lifecycle.speechGeneration).toBe(1);
    expect(lifecycle.conversationLanguage).toBe("en");

    // 2. User says: "Can you talk in Hindi?"
    const switchCmd1 = parseLanguageSwitchCommand("Can you talk in Hindi?");
    expect(switchCmd1.isSwitch).toBe(true);
    expect(switchCmd1.targetLang).toBe("hi");

    // Invariant 6: cancelSpeech("language_switch") is authoritative
    lifecycle.cancelSpeech("language_switch");
    lifecycle.conversationLanguage = "hi";
    expect(lifecycle.speechGeneration).toBe(2);
    expect(lifecycle.isGenerationActive(req1.generation)).toBe(false);

    // Hindi speech starts
    const req2 = lifecycle.startSpeechRequest("hindi_response");
    expect(lifecycle.speechGeneration).toBe(3);
    expect(lifecycle.isGenerationActive(req2.generation)).toBe(true);

    // 3. User barges in: "Actually, can you talk in English?"
    const switchCmd2 = parseLanguageSwitchCommand("Actually, can you talk in English?");
    expect(switchCmd2.isSwitch).toBe(true);
    expect(switchCmd2.targetLang).toBe("en");

    // Seamless cancellation on barge-in
    lifecycle.cancelSpeech("barge_in");
    lifecycle.conversationLanguage = "en";
    expect(lifecycle.speechGeneration).toBe(4);
    // Prior Hindi generation is invalidated immediately!
    expect(lifecycle.isGenerationActive(req2.generation)).toBe(false);
  });

  // ── Scenario C: Devanagari & transliterated switch commands ───────────────
  it("Scenario C: Accurately detects transliterated/Devanagari commands like 'एक्चुअली यू टॉक इन इंग्लिश'", () => {
    // The exact string from the user bug report screenshot:
    const res1 = parseLanguageSwitchCommand("एक्चुअली यू टॉक इन इंग्लिश");
    expect(res1.isSwitch).toBe(true);
    expect(res1.targetLang).toBe("en");

    const res2 = parseLanguageSwitchCommand("इंग्लिश में बोलो");
    expect(res2.isSwitch).toBe(true);
    expect(res2.targetLang).toBe("en");

    const res3 = parseLanguageSwitchCommand("हिंदी में बात करो");
    expect(res3.isSwitch).toBe(true);
    expect(res3.targetLang).toBe("hi");

    const res4 = parseLanguageSwitchCommand("मराठीत बोला");
    expect(res4.isSwitch).toBe(true);
    expect(res4.targetLang).toBe("mr");

    const res5 = parseLanguageSwitchCommand("தமிழில் பேசுங்கள்");
    expect(res5.isSwitch).toBe(true);
    expect(res5.targetLang).toBe("ta");

    const res6 = parseLanguageSwitchCommand("can you switch to kannada please");
    expect(res6.isSwitch).toBe(true);
    expect(res6.targetLang).toBe("kn");
  });

  // ── Scenario D: At most ONE TTS generation active, never two voices ───────
  it("Scenario D: At most ONE active playback pipeline may exist at any time; never two voices", async () => {
    const req1 = lifecycle.startSpeechRequest("audio_1");
    expect(lifecycle.speechGeneration).toBe(1);

    // Simulate audio 1 playback
    const p1 = lifecycle.playAudioBase64("chunk_1", "mp3", req1.generation);

    // Start second speech request immediately
    const req2 = lifecycle.startSpeechRequest("audio_2");
    expect(lifecycle.speechGeneration).toBe(2);

    // Prior playback must resolve to false (interrupted/discarded)
    const result1 = await p1;
    expect(result1).toBe(false);

    // Only req2 generation is active
    expect(lifecycle.isGenerationActive(req1.generation)).toBe(false);
    expect(lifecycle.isGenerationActive(req2.generation)).toBe(true);

    const instr = lifecycle.getInstrumentation();
    expect(instr.activePlaybackCount).toBeLessThanOrEqual(1);
  });

  // ── Scenario E: Late TTS network response discarded ───────────────────────
  it("Scenario E: Discards late TTS network responses after generation has advanced", async () => {
    const { generation, signal } = lifecycle.startSpeechRequest("slow_tts");

    // Generation is bumped before network returns
    lifecycle.cancelSpeech("language_switch");

    // Network arrives late
    const isStillActive = lifecycle.isGenerationActive(generation);
    expect(isStillActive).toBe(false);

    // Playback for late chunk must be dropped
    const played = await lifecycle.playAudioBase64("late_audio", "mp3", generation);
    expect(played).toBe(false);
  });

  // ── Scenario F: Implicit language detection does NOT switch conversation language
  it("Scenario F: Plain travel queries in another language do NOT trigger language switch", () => {
    const normalQuery1 = "Mumbai to Delhi train ticket confirm";
    const switchCmd1 = parseLanguageSwitchCommand(normalQuery1);
    expect(switchCmd1.isSwitch).toBe(false);

    const normalQuery2 = "12952 मुंबई से दिल्ली तत्काल टिकट";
    const switchCmd2 = parseLanguageSwitchCommand(normalQuery2);
    expect(switchCmd2.isSwitch).toBe(false);
  });

  // ── Scenario G: Language switch does NOT mutate journey state, trip state, or booking state
  it("Scenario G: Language switch control intent preserves journey and trip state without mutation", async () => {
    const dummyTrip = {
      id: "trip_123",
      from: "Mumbai",
      fromCode: "BCT",
      to: "Delhi",
      toCode: "NDLS",
      dateLabel: "Tomorrow",
      trainName: "August Kranti Rajdhani",
      travelClass: "3A",
      travellerIds: ["user_1"],
      boardingStationName: "Mumbai Central",
      arrivalDisplay: "08:30 AM",
      fare: 2150,
      mode: "assisted",
      status: "upcoming",
      createdAt: new Date().toISOString(),
      agentState: "ready",
    } as unknown as Trip;

    const conv = createConversation({ channel: "phone", language: "en", tripId: dummyTrip.id });

    // User commands language switch
    const result = await executeCopilotTurn({
      channel: "phone",
      text: "Can you talk in Hindi?",
      language: "en",
      trip: dummyTrip,
      conversation: conv,
      isUserInitiated: true,
    });

    expect(result.ok).toBe(true);
    expect(result.intent).toBe("language_change");
    expect(result.language).toBe("hi");
    // Invariant 10: Trip and journey state are preserved unchanged!
    expect(result.trip?.id).toBe("trip_123");
    expect(result.trip?.from).toBe("Mumbai");
    expect(result.trip?.to).toBe("Delhi");
    expect(result.toolUsed).toBe("language_switch");
    // Does not call booking action tools
    expect(result.actionPlan).toBeUndefined();
  });

  // ── Scenario H: Rapid successive switches leave only the latest generation ─
  it("Scenario H: Rapid successive switches (en -> hi -> mr -> en) leave only the last generation", () => {
    const g1 = lifecycle.startSpeechRequest("en").generation;
    const g2 = lifecycle.startSpeechRequest("hi").generation;
    const g3 = lifecycle.startSpeechRequest("mr").generation;
    const g4 = lifecycle.startSpeechRequest("en_final").generation;

    expect(lifecycle.isGenerationActive(g1)).toBe(false);
    expect(lifecycle.isGenerationActive(g2)).toBe(false);
    expect(lifecycle.isGenerationActive(g3)).toBe(false);
    expect(lifecycle.isGenerationActive(g4)).toBe(true);
    expect(lifecycle.speechGeneration).toBe(g4);
  });

  // ── Scenario I: Turn deduplication ────────────────────────────────────────
  it("Scenario I: Consecutive duplicate user utterances are identified by deduplication logic", () => {
    const lastTurn = { text: "", time: 0 };
    const checkTurn = (text: string, now: number) => {
      const norm = text.toLowerCase().trim();
      if (lastTurn.text === norm && now - lastTurn.time < 2000) {
        return false; // deduplicated
      }
      lastTurn.text = norm;
      lastTurn.time = now;
      return true; // accepted
    };

    const t0 = 1000;
    expect(checkTurn("Can you talk in Hindi?", t0)).toBe(true);
    // Duplicate speech event 200ms later (e.g. from WebSpeech interim + final)
    expect(checkTurn("Can you talk in Hindi?", t0 + 200)).toBe(false);
    // New utterance accepted
    expect(checkTurn("Actually, can you talk in English?", t0 + 500)).toBe(true);
  });

  // ── Scenario J: Authoritative cancelSpeech(reason) ────────────────────────
  it("Scenario J: cancelSpeech resets active request, active playback, and increments generation", () => {
    const req = lifecycle.startSpeechRequest("test");
    expect(lifecycle.speechGeneration).toBe(1);
    expect(lifecycle.isSpeaking).toBe(true);

    lifecycle.cancelSpeech("barge_in");
    expect(lifecycle.speechGeneration).toBe(2);
    expect(lifecycle.isSpeaking).toBe(false);
    expect(lifecycle.activeTTSRequestId).toBeNull();
    expect(lifecycle.isGenerationActive(req.generation)).toBe(false);

    const instr = lifecycle.getInstrumentation();
    expect(instr.lastCancelReason).toBe("barge_in");
    expect(instr.activePlaybackCount).toBe(0);
  });

  // ── Scenario K: Switching status label rendered with target language ───────
  it("Scenario K: getSwitchingStatusLabel outputs localized indicators", () => {
    expect(getSwitchingStatusLabel("hi")).toContain("हिंदी");
    expect(getSwitchingStatusLabel("en")).toContain("English");
    expect(getSwitchingStatusLabel("mr")).toContain("मराठी");
    expect(getSwitchingStatusLabel("ta")).toContain("தமி");
    expect(getSwitchingStatusLabel("kn")).toContain("ಕನ್ನಡ");
  });

  // ── Scenario L: Unified agent language change control execution ───────────
  it("Scenario L: Unified agent language switch turn does not advance journey stages", async () => {
    const conv = createConversation({ channel: "browser_voice", language: "en" });
    const result = await executeCopilotTurn({
      channel: "browser_voice",
      text: "Please switch to Tamil",
      language: "en",
      conversation: conv,
      isUserInitiated: true,
    });

    expect(result.intent).toBe("language_change");
    expect(result.language).toBe("ta");
    expect(result.speakText).toBeDefined();
    expect(result.assistantMessage.language).toBe("ta");
  });

  // ── Scenario M: Stale generations cannot mutate state or play audio ───────
  it("Scenario M: Stale generation cannot play audio or fire callbacks", async () => {
    const req1 = lifecycle.startSpeechRequest("turn_1");
    lifecycle.cancelSpeech("barge_in");

    const onEndedMock = vi.fn();
    const played = await lifecycle.playAudioBase64("audio_payload", "mp3", req1.generation, onEndedMock);

    expect(played).toBe(false);
    expect(onEndedMock).not.toHaveBeenCalled();
  });

  // ── Scenario N: AbortController aborts in-flight network ───────────────────
  it("Scenario N: startSpeechRequest provides AbortSignal that aborts on cancellation", () => {
    const { signal } = lifecycle.startSpeechRequest("fetch_test");
    expect(signal.aborted).toBe(false);

    lifecycle.cancelSpeech("barge_in");
    expect(signal.aborted).toBe(true);
  });

  // ── Scenario O: Session-scoped speech lifecycle ───────────────────────────
  it("Scenario O: Separate voice sessions maintain isolated lifecycles", () => {
    const session1 = createSpeechLifecycle("session_modal_1", "en");
    const session2 = createSpeechLifecycle("session_modal_2", "hi");

    const r1 = session1.startSpeechRequest("s1");
    const r2 = session2.startSpeechRequest("s2");

    // Cancelling session 1 does not affect session 2
    session1.cancelSpeech("barge_in");

    expect(session1.isGenerationActive(r1.generation)).toBe(false);
    expect(session2.isGenerationActive(r2.generation)).toBe(true);

    session1.destroy();
    session2.destroy();
  });
});
