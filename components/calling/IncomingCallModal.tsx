"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff, Mic, Volume2, CheckCircle2, Radio, Languages } from "lucide-react";
import { VoiceWaveform } from "@/components/voice/VoiceWaveform";
import { useStore } from "@/lib/store";
import { addMessage, createConversation } from "@/lib/conversation/service";
import type { Conversation } from "@/lib/conversation/types";
import type { Trip } from "@/types";
import { cn } from "@/lib/utils";
import {
  parseLanguageSwitchCommand,
  getSwitchingStatusLabel,
  getLanguageDialogue,
  bcp47For,
  voiceLangDef,
  type VoiceLang,
} from "@/lib/voice/languages";
import {
  createSpeechLifecycle,
  type SpeechLifecycleController,
  type SpeechCancelReason,
} from "@/lib/voice/speech-lifecycle";

export interface CallQuickReply {
  label: string;
  agentResponse?: string;
  followUpReplies?: CallQuickReply[];
  onSelect?: () => void;
}

interface IncomingCallModalProps {
  isOpen: boolean;
  onAccept?: () => void;
  onDecline: () => void;
  callerName?: string;
  callerRole?: string;
  subtitle?: string;
  briefingText?: string;
  trip?: Trip | null;
  /** Quick response options for deterministic demo scenarios */
  quickReplies?: CallQuickReply[];
  onUserSpoken?: (transcript: string) => void;
  autoSpeak?: boolean;
}

export function IncomingCallModal({
  isOpen,
  onAccept,
  onDecline,
  callerName = "Aarav",
  callerRole = "Tatkal Copilot",
  subtitle = "Immediate booking confirmation required",
  briefingText,
  trip,
  quickReplies = [],
  onUserSpoken,
  autoSpeak = true,
}: IncomingCallModalProps) {
  const [callState, setCallState] = useState<"incoming" | "connected" | "ended">("incoming");
  const [durationSec, setDurationSec] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState<string | null>(null);
  const [switchingLanguageLabel, setSwitchingLanguageLabel] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [activeReplies, setActiveReplies] = useState<CallQuickReply[]>(quickReplies);
  const [voiceLang, setVoiceLang] = useState<VoiceLang>("en");
  const { logActivity } = useStore();

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speechRecRef = useRef<any>(null);
  const voiceLangRef = useRef<VoiceLang>("en");
  const isSpeakingRef = useRef(false);
  const currentAgentTextRef = useRef("");
  const bargeInInterruptedRef = useRef(false);
  const callStateRef = useRef<"incoming" | "connected" | "ended">("incoming");
  const originalBriefingTextRef = useRef("");
  const lastAgentResponseRef = useRef("");
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestInterimRef = useRef<string>("");
  const transcriptContainerRef = useRef<HTMLDivElement | null>(null);
  const speechLifecycleRef = useRef<SpeechLifecycleController | null>(null);
  const lastSpokenTurnRef = useRef<{ text: string; time: number }>({ text: "", time: 0 });

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  // Keep activeReplies fresh in ref to eliminate stale closure issues
  const activeRepliesRef = useRef<CallQuickReply[]>(quickReplies);
  useEffect(() => {
    setActiveReplies(quickReplies);
    activeRepliesRef.current = quickReplies;
  }, [quickReplies, isOpen]);

  // Stop currently playing agent audio immediately via authoritative SpeechLifecycleController
  const cleanupAudioOnly = useCallback((reason: SpeechCancelReason = "barge_in") => {
    bargeInInterruptedRef.current = true;
    speechLifecycleRef.current?.cancelSpeech(reason);
    setIsSpeaking(false);
    isSpeakingRef.current = false;
  }, []);

  // Teardown all active audio and microphone sessions on hangup/close
  const cleanupAudioAndMic = useCallback(() => {
    cleanupAudioOnly("teardown");
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    latestInterimRef.current = "";
    if (speechRecRef.current) {
      try {
        speechRecRef.current.abort();
      } catch {}
      speechRecRef.current = null;
    }
    setIsListening(false);
    setInterimText(null);
    setSwitchingLanguageLabel(null);
  }, [cleanupAudioOnly]);

  // Initialize call state on open
  useEffect(() => {
    if (isOpen) {
      setCallState("incoming");
      setDurationSec(0);
      setTranscript([]);
      setVoiceLang("en");
      voiceLangRef.current = "en";
      setSwitchingLanguageLabel(null);
      speechLifecycleRef.current = createSpeechLifecycle("incoming-call-modal", "en");
      const conv = createConversation({
        channel: "phone",
        language: "en",
        tripId: trip?.id,
      });
      setConversation(conv);
    } else {
      cleanupAudioAndMic();
      speechLifecycleRef.current?.cancelSpeech("teardown");
      speechLifecycleRef.current = null;
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      cleanupAudioAndMic();
      speechLifecycleRef.current?.cancelSpeech("teardown");
      speechLifecycleRef.current = null;
    };
  }, [isOpen, trip?.id, cleanupAudioAndMic]);

  // Call duration counter
  useEffect(() => {
    if (callState === "connected") {
      timerRef.current = setInterval(() => {
        setDurationSec((prev) => prev + 1);
      }, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [callState]);

  // Auto-scroll transcript: Top-aligned for initial briefing so greeting is never clipped,
  // smooth-scrolled to bottom for ongoing conversational turns.
  useEffect(() => {
    if (!transcriptContainerRef.current) return;
    if (transcript.length <= 1) {
      transcriptContainerRef.current.scrollTop = 0;
    } else {
      transcriptContainerRef.current.scrollTo({
        top: transcriptContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [transcript]);

  /**
   * Plays agent voice across all 10 Indian languages.
   * Keeps microphone active so the user can barge in seamlessly at any time.
   * Bound authoritatively to SpeechLifecycleController with monotonic generation tokens.
   */
  const playAgentVoice = useCallback(
    async (
      text: string,
      targetLang?: VoiceLang,
      prefix?: string,
      onTextReady?: (spokenText: string) => void
    ): Promise<{ text: string; played: boolean }> => {
      let lifecycle = speechLifecycleRef.current;
      if (!lifecycle) {
        lifecycle = createSpeechLifecycle("incoming-call-modal", voiceLangRef.current);
        speechLifecycleRef.current = lifecycle;
      }

      const lang = targetLang || voiceLangRef.current;
      lifecycle.conversationLanguage = lang;
      setIsSpeaking(true);
      isSpeakingRef.current = true;
      bargeInInterruptedRef.current = false;

      // Start authoritative speech request token
      const { generation, signal } = lifecycle.startSpeechRequest("play_agent_voice");

      let finalSpokenText = prefix ? `${prefix.trim()} ${text.trim()}` : text;

      try {
        const res = await fetch("/api/calling/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voiceLang: lang, prefix }),
          signal,
        });

        // If generation changed while waiting for network response, discard immediately
        if (!lifecycle.isGenerationActive(generation)) {
          return { text: finalSpokenText, played: false };
        }

        const data = (await res.json().catch(() => ({}))) as {
          audioBase64?: string;
          audioCodec?: string;
          text?: string;
        };

        if (!lifecycle.isGenerationActive(generation)) {
          return { text: finalSpokenText, played: false };
        }

        if (data?.text) {
          finalSpokenText = data.text;
        }
        currentAgentTextRef.current = finalSpokenText;

        // Invariant 5: An async operation may mutate transcript ONLY if it still owns the current active generation
        onTextReady?.(finalSpokenText);

        if (bargeInInterruptedRef.current || !lifecycle.isGenerationActive(generation)) {
          setIsSpeaking(false);
          isSpeakingRef.current = false;
          return { text: finalSpokenText, played: false };
        }

        // 1. Play Sarvam audio via authoritative lifecycle
        if (data?.audioBase64) {
          const codec = data.audioCodec || "mp3";
          const played = await lifecycle.playAudioBase64(data.audioBase64, codec, generation);
          if (lifecycle.isGenerationActive(generation)) {
            setIsSpeaking(false);
            isSpeakingRef.current = false;
          }
          return { text: finalSpokenText, played };
        }

        // 2. Browser SpeechSynthesis fallback bounded by generation
        const played = await lifecycle.playBrowserSpeech(finalSpokenText, lang, generation);
        if (lifecycle.isGenerationActive(generation)) {
          setIsSpeaking(false);
          isSpeakingRef.current = false;
        }
        return { text: finalSpokenText, played };
      } catch {
        if (lifecycle.isGenerationActive(generation)) {
          setIsSpeaking(false);
          isSpeakingRef.current = false;
        }
        return { text: finalSpokenText, played: false };
      }
    },
    []
  );

  const currentStageRef = useRef<"briefing" | "follow_up" | "closing">("briefing");
  const isProcessingTurnRef = useRef(false);

  // Helper to determine if spoken text is acoustic echo from agent's own speaker audio
  const isAcousticEcho = useCallback((spokenText: string, agentText: string): boolean => {
    // If agent is not actively speaking right now, it CANNOT be an acoustic echo!
    if (!isSpeakingRef.current) return false;
    if (!agentText || !spokenText) return false;
    const sNorm = spokenText.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").trim();
    const aNorm = agentText.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").trim();
    if (!sNorm || !aNorm) return false;

    // Common short user answers (e.g. हाँ, ha, ok, yes, no, nahi, ho) should NEVER be discarded as echo!
    if (sNorm.length <= 4) return false;

    // Direct substring match
    if (aNorm.includes(sNorm)) return true;

    // Word overlap match (>60% words from spoken text belong to current agent sentence)
    const sWords = sNorm.split(/\s+/).filter((w) => w.length > 2);
    if (sWords.length === 0) return false; // Short utterances are NEVER treated as echo
    const matched = sWords.filter((w) => aNorm.includes(w));
    return matched.length / sWords.length >= 0.6;
  }, []);

  // Ensure continuous hands-free microphone listening via Web Speech API
  const ensureListening = useCallback((targetLang?: VoiceLang) => {
    if (typeof window === "undefined") return;
    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRec) return;

    const desiredLang = targetLang || voiceLangRef.current;
    const desiredBcp = bcp47For(desiredLang);

    // If an instance is already active with the requested language, preserve it
    if (speechRecRef.current && speechRecRef.current.lang === desiredBcp) {
      return;
    }

    // Cleanly decommission previous instance to prevent collision or double-listening
    if (speechRecRef.current) {
      const oldSr = speechRecRef.current;
      speechRecRef.current = null;
      try {
        oldSr.onend = null;
        oldSr.onerror = null;
        oldSr.onresult = null;
        oldSr.abort();
      } catch {}
    }

    try {
      const sr = new SpeechRec();
      sr.continuous = true;
      sr.interimResults = true;
      sr.lang = desiredBcp;
      speechRecRef.current = sr;

      sr.onstart = () => {
        setIsListening(true);
      };

      sr.onresult = (ev: any) => {
        let interim = "";
        let final = "";

        for (let i = ev.resultIndex; i < ev.results.length; ++i) {
          const trans = ev.results[i][0].transcript;
          if (ev.results[i].isFinal) {
            final += trans;
          } else {
            interim += trans;
          }
        }

        const currentSpoken = (interim || final).trim();

        // ── SEAMLESS AUDIO BARGE-IN ─────────────────────────────────────
        // If the user speaks while Aarav is talking, check echo and silence the agent!
        if (currentSpoken && isSpeakingRef.current) {
          const agentSpoken = currentAgentTextRef.current || "";
          if (!isAcousticEcho(currentSpoken, agentSpoken)) {
            console.log("[IncomingCallModal] Seamless barge-in triggered:", currentSpoken);
            cleanupAudioOnly();
            isProcessingTurnRef.current = false;
          }
        }

        if (interim.trim()) {
          const candidateInterim = interim.trim();
          latestInterimRef.current = candidateInterim;
          setInterimText(candidateInterim);

          // Web Speech API fallback: If user pauses after speaking interim phrase (e.g. 1000ms),
          // Chrome often stalls without setting isFinal. Finalize the interim text so user speech isn't trapped!
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
          }
          silenceTimerRef.current = setTimeout(() => {
            const candidate = latestInterimRef.current.trim();
            if (candidate && !isSpeakingRef.current) {
              latestInterimRef.current = "";
              setInterimText(null);
              if (!isAcousticEcho(candidate, currentAgentTextRef.current)) {
                handleSpokenTurnRef.current(candidate);
              }
            }
          }, 1000);
        }

        if (final.trim()) {
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
          latestInterimRef.current = "";
          setInterimText(null);
          const candidate = final.trim();
          // Filter out echo bleed only if agent is actively speaking
          if (isAcousticEcho(candidate, currentAgentTextRef.current)) {
            return;
          }
          handleSpokenTurnRef.current(candidate);
        }
      };

      const tryStart = (retries = 3) => {
        if (speechRecRef.current !== sr || callStateRef.current !== "connected") return;
        try {
          sr.start();
          setIsListening(true);
        } catch (err) {
          if (retries > 0) {
            setTimeout(() => {
              if (speechRecRef.current === sr && callStateRef.current === "connected") {
                tryStart(retries - 1);
              }
            }, 200);
          } else if (sr.lang !== "en-IN") {
            // Fallback to en-IN if regional language start fails
            console.warn(`[IncomingCallModal] Falling back speech recognition from ${sr.lang} to en-IN`);
            sr.lang = "en-IN";
            setTimeout(() => {
              if (speechRecRef.current === sr && callStateRef.current === "connected") {
                tryStart(2);
              }
            }, 200);
          } else {
            setIsListening(false);
          }
        }
      };

      sr.onerror = (ev: any) => {
        if (ev.error === "not-allowed") {
          setIsListening(false);
          return;
        }
        if (ev.error !== "no-speech") {
          console.warn("[IncomingCallModal] Speech recognition error:", ev.error);
          if (sr.lang !== "en-IN" && (ev.error === "language-not-supported" || ev.error === "network")) {
            console.warn("[IncomingCallModal] Regional recognition error, falling back to en-IN");
            sr.lang = "en-IN";
          }
        }
      };

      sr.onend = () => {
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
        const trappedCandidate = latestInterimRef.current.trim();
        if (trappedCandidate && !isSpeakingRef.current) {
          latestInterimRef.current = "";
          setInterimText(null);
          if (!isAcousticEcho(trappedCandidate, currentAgentTextRef.current)) {
            handleSpokenTurnRef.current(trappedCandidate);
          }
        }

        if (speechRecRef.current !== sr) return; // Superseded by a newer instance
        if (callStateRef.current === "connected") {
          setTimeout(() => {
            if (callStateRef.current === "connected" && speechRecRef.current === sr) {
              tryStart(3);
            }
          }, 150);
        } else {
          setIsListening(false);
        }
      };

      // Allow 120ms gap for previous abort to release the browser audio pipeline
      setTimeout(() => {
        tryStart(3);
      }, 120);
    } catch (err) {
      console.warn("[IncomingCallModal] Failed to start speech recognition:", err);
      setIsListening(false);
    }
  }, [cleanupAudioOnly, isAcousticEcho]);

  // Process a selected or recognized turn
  const processTurn = useCallback(
    async (userText: string, chosenReply?: CallQuickReply, explicitLang?: VoiceLang) => {
      cleanupAudioOnly();
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      latestInterimRef.current = "";
      setInterimText(null);

      const currentReplies = activeRepliesRef.current;
      const targetReply = chosenReply || currentReplies[0];

      if (!targetReply) return;

      const effectiveLang = explicitLang || voiceLangRef.current;

      // Record user turn in transcript and canonical conversation
      setTranscript((prev) => [...prev, `You: ${userText}`]);

      setConversation((prevConv) => {
        if (!prevConv) return null;
        const { conversation: nextConv } = addMessage(prevConv, {
          role: "user",
          originalText: userText,
          channel: "phone",
          status: "final",
        });
        return nextConv;
      });

      onUserSpoken?.(userText);

      if (targetReply?.agentResponse) {
        const agentMsg = targetReply.agentResponse;
        lastAgentResponseRef.current = agentMsg;
        // Add agent response to transcript immediately
        setTranscript((prev) => [...prev, `${callerName}: ${agentMsg}`]);

        setConversation((prevConv) => {
          if (!prevConv) return null;
          const { conversation: nextConv } = addMessage(prevConv, {
            role: "assistant",
            originalText: agentMsg,
            channel: "phone",
            status: "final",
          });
          return nextConv;
        });

        // Speak Copilot's voice response in the detected/effective language
        isProcessingTurnRef.current = true;
        await playAgentVoice(agentMsg, effectiveLang).finally(() => {
          isProcessingTurnRef.current = false;
        });
      }

      // If follow-up conversational choices exist, advance to follow_up
      if (targetReply.followUpReplies && targetReply.followUpReplies.length > 0) {
        const nextReplies = targetReply.followUpReplies;
        setActiveReplies(nextReplies);
        activeRepliesRef.current = nextReplies;
        currentStageRef.current = "follow_up";

        // Keep speech recognition healthy without creating duplicate instances
        ensureListening();
      } else {
        // Natural end of dialogue
        currentStageRef.current = "closing";
        setTimeout(() => {
          targetReply.onSelect?.();
        }, 700);
      }
    },
    [callerName, cleanupAudioOnly, ensureListening, onUserSpoken, playAgentVoice]
  );

  const processTurnRef = useRef(processTurn);
  useEffect(() => {
    processTurnRef.current = processTurn;
  }, [processTurn]);

  // Match recognized speech across all 10 Indian languages and auto-detect language
  const handleSpokenTurn = useCallback(
    (spoken: string) => {
      const norm = spoken.toLowerCase().replace(/[.,!?'"]/g, "").trim();
      if (!norm) return;

      // Invariant 11: Turn deduplication — ignore duplicate utterances within 2000ms
      const now = Date.now();
      if (
        lastSpokenTurnRef.current.text === norm &&
        now - lastSpokenTurnRef.current.time < 2000
      ) {
        console.log("[IncomingCallModal] Ignoring duplicate spoken utterance:", norm);
        return;
      }
      lastSpokenTurnRef.current = { text: norm, time: now };

      // Invariant 8 & 9: Language switching is a CONTROL operation and MUST be resolved before normal journey-agent execution
      // Only an explicit language-switch intent may change conversationLanguage.
      const switchResult = parseLanguageSwitchCommand(spoken);

      if (switchResult.isSwitch) {
        const targetLang: VoiceLang = switchResult.targetLanguage;
        const lifecycle = speechLifecycleRef.current;

        console.log(
          `[IncomingCallModal] Language switch requested: ${voiceLangRef.current} -> ${targetLang}`
        );

        // Invariant 6: cancelSpeech() is the ONLY mechanism allowed to invalidate speech
        lifecycle?.cancelSpeech("language_switch");
        if (lifecycle) {
          lifecycle.conversationLanguage = targetLang;
          lifecycle.targetLanguage = targetLang;
          lifecycle.voiceState = "switching_language";
        }

        setVoiceLang(targetLang);
        voiceLangRef.current = targetLang;
        const switchingLabel = getSwitchingStatusLabel(targetLang);
        setSwitchingLanguageLabel(switchingLabel);

        logActivity([
          {
            kind: "agent_reasoning",
            text: `Spoken language switched to ${voiceLangDef(targetLang).englishName}. Aarav adapting dialogue.`,
            metadata: { tool: `language_switch_${targetLang}`, action: "switch_language" },
          },
        ]);

        // Reconfigure speech recognition cleanly in target language
        ensureListening(targetLang);

        const langPack = getLanguageDialogue(targetLang);

        // ── USER REQUESTED LANGUAGE SWITCH ──────────────────────────────────
        // Crucial: DO NOT skip message 1 or deviate to generic template!
        // Repeat the actual current message (e.g. customized briefing with spend limits)
        // translated natively into the new language, prefixed with polite switch acknowledgment.
        setTranscript((prev) => [...prev, `You: ${spoken}`]);
        onUserSpoken?.(spoken);

        const baseMessageToRepeat =
          currentStageRef.current === "briefing"
            ? (originalBriefingTextRef.current || briefingText || subtitle || langPack.briefingMessage)
            : (lastAgentResponseRef.current || langPack.yesAvailableResponse);

        if (currentStageRef.current === "briefing") {
          const localizedBriefingReplies: CallQuickReply[] = [
            {
              label: langPack.yesAvailableLabel,
              agentResponse: langPack.yesAvailableResponse,
              followUpReplies: [
                {
                  label: langPack.allGoodLabel,
                  agentResponse: langPack.farewellResponse,
                  onSelect: () => {
                    setCallState("ended");
                    onDecline();
                  },
                },
                {
                  label: langPack.confirmDetailsLabel || "Confirm details",
                  agentResponse:
                    langPack.confirmDetailsResponse || langPack.farewellResponse,
                  onSelect: () => {
                    setCallState("ended");
                    onDecline();
                  },
                },
                {
                  label: langPack.haveNiceDayLabel || "Have a nice day",
                  agentResponse: langPack.farewellResponse,
                  onSelect: () => {
                    setCallState("ended");
                    onDecline();
                  },
                },
              ],
            },
            {
              label: langPack.outsideLabel,
              agentResponse: langPack.outsideResponse,
              followUpReplies: [
                {
                  label: langPack.authorizeLabel,
                  agentResponse: langPack.farewellResponse,
                  onSelect: () => {
                    setCallState("ended");
                    onDecline();
                  },
                },
              ],
            },
          ];

          setActiveReplies(localizedBriefingReplies);
          activeRepliesRef.current = localizedBriefingReplies;
        } else if (currentStageRef.current === "follow_up") {
          const localizedFollowUpReplies: CallQuickReply[] = [
            {
              label: langPack.allGoodLabel,
              agentResponse: langPack.farewellResponse,
              onSelect: () => {
                setCallState("ended");
                onDecline();
              },
            },
            {
              label: langPack.confirmDetailsLabel || "Confirm details",
              agentResponse:
                langPack.confirmDetailsResponse || langPack.farewellResponse,
              onSelect: () => {
                setCallState("ended");
                onDecline();
              },
            },
            {
              label: langPack.haveNiceDayLabel || "Have a nice day",
              agentResponse: langPack.farewellResponse,
              onSelect: () => {
                setCallState("ended");
                onDecline();
              },
            },
          ];

          setActiveReplies(localizedFollowUpReplies);
          activeRepliesRef.current = localizedFollowUpReplies;
        }

        // Play repeated actual message in target language without advancing turn
        isProcessingTurnRef.current = true;
        void playAgentVoice(
          baseMessageToRepeat,
          targetLang,
          langPack.switchAck,
          (spokenMsg) => {
            // Discard if superseded
            if (lifecycle && !lifecycle.isGenerationActive(lifecycle.speechGeneration)) return;
            lastAgentResponseRef.current = spokenMsg;
            setTranscript((prev) => [...prev, `${callerName}: ${spokenMsg}`]);

            setConversation((prevConv) => {
              if (!prevConv) return null;
              let { conversation: nextConv } = addMessage(prevConv, {
                role: "user",
                originalText: spoken,
                channel: "phone",
                status: "final",
              });
              nextConv = addMessage(nextConv, {
                role: "assistant",
                originalText: spokenMsg,
                channel: "phone",
                status: "final",
              }).conversation;
              return nextConv;
            });
          }
        ).finally(() => {
          isProcessingTurnRef.current = false;
          setSwitchingLanguageLabel(null);
          if (lifecycle) {
            lifecycle.voiceState = "listening";
          }
        });
        return;
      }

      const currentLang = voiceLangRef.current;
      const langPack = getLanguageDialogue(currentLang);
      const replies = activeRepliesRef.current;

      let match: CallQuickReply | undefined;

      // 2. Check for polite closing / no questions / all good / thank you across 10 languages
      const isFarewell =
        /(?:^|\s)(no questions?|all set|all good|no changes?|fine|clear|perfect|thank you|thanks|nice day|good day|great day|goodbye|bye|drop call|drop the call|done|koi sawaal nahi|shukriya|dhanyawad|alvida|kahi prashna nahi|kelvigal illai|nandri|prashnalu levu|dhanyavadamulu|prashnegalilla|dhanyavadagalu|koi prashna nathi|aabhar|samshayamilla|nanni|koi sawal nahi|dhanvaad|khuda hafiz|ಧನ್ಯವಾದ|ಧನ್ಯವಾದಗಳು|ಪ್ರಶ್ನೆಗಳಿಲ್ಲ|நன்றி|ధన్యవాదాలు|ధన్యవాదములు|ಶುಕ್ರಿಯಾ|अलविदा|धन्यवाद|शुक्रिया)(?:$|\s|[.,!?])/i.test(
          norm
        );

      if (isFarewell) {
        match = replies.find((r) =>
          /no questions?|all set|all good|no changes?|thank|nice day|good day|goodbye|sawaal|shukriya|dhanyawad|nandri|aabhar|nanni|dhanvaad|ಧನ್ಯವಾದ|நன்றி|ధన్యవాదాలు/i.test(
            r.label
          )
        );
        if (!match && currentLang !== "en") {
          match = {
            label: langPack.allGoodLabel,
            agentResponse: langPack.farewellResponse,
            onSelect: replies[0]?.onSelect || (() => onDecline()),
          };
        }
      }

      // 3. Check for details / boarding / passenger confirmation
      if (
        !match &&
        /(?:^|\s)(confirm|details|passenger|boarding|station|train|yatri|tapasheel|vivaralu|ಮಾಹಿತಿ|ವಿವರ|ರೈಲು|ಪ್ರಯಾಣಿಕ)(?:$|\s|[.,!?])/i.test(
          norm
        )
      ) {
        match = replies.find((r) =>
          /confirm|details|passenger|boarding|station|train|ಮಾಹಿತಿ|ವಿವರ/i.test(r.label)
        );
      }

      // 4. Check availability / yes keywords across 10 languages (Native & Romanized)
      const isYes =
        /(?:^|\s)(yes|available|sure|i will|ready|ill be available|i am available|i will be available|okay|ok|approve|myself|haan|ha|theek hai|karunga|ho|nakki|chalel|aam|aama|seri|avunu|sare|haudu|sari|athe|shari|haanji|कन्ह|कहना|कहा|उपलब्ध|रहूंगा|रहूँगा|मंजूरी|हाँ|हाँजी|हाँ जी|बिलकुल|बिल्कुल|ज़रूर|तैयार|हौ|अवेलेबल|हो|होय|ಹೌದು|ಸರಿ|ಲಭ್ಯವಿರುತ್ತೇನೆ|ಇರುತ್ತೇನೆ|ಮಾಡಿ|ಬುಕ್|ಆಯ್ತು|ஆம்|சரி|இருப்பேன்|అవును|సరే|ఉంటాను|హా|ચોક્કસ|અതെ|ശരി|ਸ਼੍ਰੀ|ਹਾਂਜੀ)(?:$|\s|[.,!?])/i.test(
          norm
        );

      if (!match && isYes) {
        match = replies.find((r) =>
          /yes|available|haan|ho|aam|avunu|haudu|ha|athe|haanji|उपलब्ध|हूँ|रहूँगा|रहूंगा|ಹೌದು|ಲಭ್ಯ|ஆம்|అవును|हाँ|कन्ह/i.test(r.label)
        );
        if (!match && currentLang !== "en") {
          match = {
            label: langPack.yesAvailableLabel,
            agentResponse: langPack.yesAvailableResponse,
            followUpReplies: [
              {
                label: langPack.allGoodLabel,
                agentResponse: langPack.farewellResponse,
                onSelect: () => {
                  setCallState("ended");
                  onDecline();
                },
              },
            ],
          };
        }
      }

      // 5. Check takeover / no / outside keywords across 10 languages (Native & Romanized)
      const isNo =
        /(?:^|\s)(no|not|cant|cannot|wont|outside|take over|takeover|authorize|permission|you do it|nahi|na|bahar|tum karo|baher|illai|veliye|kaadu|bayata|illa|horagiddene|purathanu|ijazat|नहीं|ना|नाही|बाहर|लॉग इन|लॉगिन|असमर्थ|ಇಲ್ಲ|ಇಲ್ಲಾ|ಹೊರಗಿದ್ದೇನೆ|ಮಾಡಬೇಡಿ|ಇಲ್ಲವೇ|இல்லை|வெளியே|కాదు|లేదు|బయట|નથી|બહાર|പുറത്താണ്)(?:$|\s|[.,!?])/i.test(
          norm
        );

      if (!match && isNo) {
        match = replies.find((r) =>
          /no|outside|permission|take over|nahi|baher|illai|kaadu|illa|purathanu|बाहर|लॉग|नहीं|ಇಲ್ಲ|ಹೊರಗೆ|இல்லை|లేదు/i.test(r.label)
        );
        if (!match && currentLang !== "en") {
          match = {
            label: langPack.outsideLabel,
            agentResponse: langPack.outsideResponse,
            followUpReplies: [
              {
                label: langPack.authorizeLabel,
                agentResponse: langPack.farewellResponse,
                onSelect: () => {
                  setCallState("ended");
                  onDecline();
                },
              },
            ],
          };
        }
      }

      // 6. Fallback substring/token matching
      if (!match) {
        match = replies.find(
          (r) =>
            norm.includes(r.label.toLowerCase()) ||
            r.label.toLowerCase().includes(norm)
        );
      }

      // 7. Stage-aware sensible default: in briefing stage, if spoken without matching negative, assume affirmative available
      if (!match && currentStageRef.current === "briefing") {
        match = replies[0];
      }

      const selected = match || replies[0];
      void processTurnRef.current(spoken, selected, currentLang);
    },
    [ensureListening, onDecline, playAgentVoice]
  );

  const handleSpokenTurnRef = useRef(handleSpokenTurn);
  useEffect(() => {
    handleSpokenTurnRef.current = handleSpokenTurn;
  }, [handleSpokenTurn]);

  const handleAccept = async () => {
    setCallState("connected");
    currentStageRef.current = "briefing";
    onAccept?.();

    const spokenText = briefingText || subtitle;
    originalBriefingTextRef.current = spokenText;
    lastAgentResponseRef.current = spokenText;
    setTranscript([`${callerName}: ${spokenText}`]);

    if (conversation) {
      const { conversation: nextConv } = addMessage(conversation, {
        role: "assistant",
        originalText: spokenText,
        channel: "phone",
        status: "final",
      });
      setConversation(nextConv);
    }

    logActivity([
      {
        kind: "agent_reasoning",
        text: `Proactive browser call accepted from ${callerName} (${callerRole}).`,
        metadata: { tool: "browser_call" },
      },
    ]);

    // Start continuous listening immediately so user can barge in at ANY time
    ensureListening(voiceLangRef.current);

    // Play Aarav's briefing voice cleanly
    await playAgentVoice(spokenText, voiceLangRef.current);
  };

  const handleDecline = () => {
    cleanupAudioAndMic();
    setCallState("ended");
    if (timerRef.current) clearInterval(timerRef.current);
    onDecline();
  };

  const handleReplyClick = (reply: CallQuickReply) => {
    void processTurn(reply.label, reply);
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[94vw] sm:max-w-md rounded-3xl bg-slate-950/90 backdrop-blur-2xl border border-white/15 text-white shadow-2xl p-6 relative overflow-hidden glass-panel"
        >
          {/* Subtle Ambient Glow */}
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 h-44 w-44 rounded-full bg-emerald-500/25 blur-3xl pointer-events-none" />

          {callState === "incoming" ? (
            /* Incoming Call View */
            <div className="text-center space-y-6 py-2 relative z-10">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[0.7rem] font-bold tracking-widest uppercase">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                INCOMING CALL
              </div>

              {/* Aarav Avatar */}
              <div className="relative mx-auto h-24 w-24 rounded-full overflow-hidden border-2 border-emerald-400/60 shadow-lg shadow-emerald-500/20">
                <Image
                  src="/aarav-namaste.jpg"
                  alt={callerName}
                  fill
                  className="object-cover"
                  priority
                />
              </div>

              <div className="space-y-1">
                <h3 className="text-xl font-black tracking-tight">{callerName}</h3>
                <p className="text-xs text-emerald-400 font-semibold">{callerRole}</p>
                <p className="text-xs text-slate-300 pt-2 px-3 leading-relaxed">
                  &ldquo;{subtitle}&rdquo;
                </p>
              </div>

              {/* Accept / Decline CTA Buttons */}
              <div className="grid grid-cols-2 gap-4 pt-4">
                <button
                  type="button"
                  onClick={handleDecline}
                  className="py-3 px-4 rounded-2xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <PhoneOff className="h-4 w-4 text-rose-400" />
                  <span>Decline</span>
                </button>

                <button
                  type="button"
                  onClick={handleAccept}
                  className="py-3 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/30 transition flex items-center justify-center gap-2 cursor-pointer animate-bounce"
                >
                  <Phone className="h-4 w-4" />
                  <span>Accept Call</span>
                </button>
              </div>
            </div>
          ) : (
            /* Active Call View */
            <div className="space-y-4 relative z-10">
              {/* Call Header & Duration */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="relative h-9 w-9 rounded-full overflow-hidden border border-emerald-400/50 shrink-0">
                    <Image
                      src="/aarav-namaste.jpg"
                      alt={callerName}
                      fill
                      className="object-cover"
                      priority
                    />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">{callerName}</h4>
                    <span className="text-[0.68rem] text-emerald-400 font-medium">{callerRole}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-mono text-xs font-bold text-slate-300">
                    {formatDuration(durationSec)}
                  </span>
                  <div className="text-[0.65rem] text-emerald-400 flex items-center gap-1.5 font-semibold justify-end">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>CONNECTED</span>
                    <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-[0.6rem] text-emerald-300 border border-emerald-500/30 font-mono uppercase font-bold">
                      {voiceLangDef(voiceLang).englishName}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dynamic Waveform & Real-Time Speaking / Listening State with Barge-in */}
              <div className="py-1 text-center space-y-2">
                <div className="h-10 flex items-center justify-center">
                  <VoiceWaveform active={isSpeaking || isListening} tone="brand" />
                </div>

                <div className="flex items-center justify-center gap-2 text-[0.75rem] font-medium">
                  {switchingLanguageLabel ? (
                    <span className="text-amber-300 flex items-center gap-1.5 font-semibold animate-pulse">
                      <Languages className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                      <span>{switchingLanguageLabel}</span>
                    </span>
                  ) : isSpeaking ? (
                    <span className="text-emerald-400 flex items-center gap-1.5 font-semibold">
                      <Volume2 className="h-3.5 w-3.5 animate-pulse shrink-0" />
                      <span>{callerName} is speaking ({voiceLangDef(voiceLang).englishName})</span>
                      <span className="text-[0.65rem] text-slate-400 font-normal ml-1 bg-white/5 px-1.5 py-0.5 rounded-md">
                        Speak to barge in
                      </span>
                    </span>
                  ) : isListening ? (
                    <span className="text-emerald-300 flex items-center gap-1.5 font-semibold">
                      <Mic className="h-3.5 w-3.5 animate-bounce text-emerald-400 shrink-0" />
                      <span>Listening... Speak in any of 10 Indian languages</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => ensureListening()}
                      className="text-slate-400 hover:text-emerald-400 flex items-center gap-1 text-[0.7rem] cursor-pointer"
                    >
                      <Mic className="h-3.5 w-3.5" />
                      <span>Tap to speak</span>
                    </button>
                  )}
                </div>

                {interimText && (
                  <p className="text-[0.72rem] text-emerald-300 italic font-mono animate-pulse">
                    You: &ldquo;{interimText}...&rdquo;
                  </p>
                )}
              </div>

              {/* Live Transcript Box */}
              <div
                ref={transcriptContainerRef}
                className="max-h-52 overflow-y-auto rounded-2xl bg-white/[0.04] border border-white/10 p-3.5 space-y-2.5 text-xs leading-relaxed scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
              >
                {transcript.map((line, idx) => {
                  const isUser = line.startsWith("You:");
                  const rawContent = isUser
                    ? line.replace(/^You:\s*/, "")
                    : line.replace(new RegExp(`^${callerName}:\\s*`), "");

                  return (
                    <div
                      key={idx}
                      className={cn(
                        "flex flex-col gap-1 rounded-xl p-2.5 transition-colors",
                        isUser
                          ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 ml-4"
                          : "bg-white/[0.05] border border-white/10 text-slate-100 mr-2"
                      )}
                    >
                      <div className="flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-wider">
                        {isUser ? (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            You
                          </span>
                        ) : (
                          <span className="text-emerald-300 flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            {callerName}
                          </span>
                        )}
                      </div>
                      <p className="whitespace-pre-wrap leading-relaxed text-[0.78rem]">
                        {rawContent}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Interactive Quick Response Fallback */}
              {activeReplies.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[0.68rem] font-bold text-slate-400 uppercase tracking-wider">
                    <span>Speak aloud or tap response:</span>
                    {isListening && (
                      <span className="text-emerald-400 lowercase font-normal flex items-center gap-1">
                        <Radio className="h-2.5 w-2.5 animate-pulse" />
                        mic active
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    {activeReplies.map((reply, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleReplyClick(reply)}
                        className="w-full text-left px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-emerald-500/25 border border-white/10 hover:border-emerald-500/50 text-xs font-semibold text-white transition-all duration-200 hover-lift active-press flex items-center justify-between cursor-pointer shadow-xs"
                      >
                        <span>&ldquo;{reply.label}&rdquo;</span>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 opacity-75 shrink-0 ml-2" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* End Call Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleDecline}
                  className="w-full py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <PhoneOff className="h-4 w-4 text-rose-400" />
                  <span>End Call</span>
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
