import { useCallback, useEffect, useRef, useState } from "react";

const LANG = { en: "en-IN", ta: "ta-IN", tanglish: "en-IN" };
const GROQ_API_KEY = process.env.REACT_APP_GROQ_API_KEY || "";

/**
 * Clean text for natural speech synthesis.
 * Strips code blocks, markdown links, symbols, emojis, and formats numbers/units.
 */
function cleanTextForSpeech(text) {
  if (!text) return "";
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#*_~>]/g, "")
    .replace(/\|/g, " ")
    .replace(/[✅❌⚠️🌾🍅🥔🥕🌽🚜📦🛒💰]/gu, "")
    .replace(/₹\s*(\d+)/g, "$1 rupees")
    .replace(/\/kg\b/gi, " per kilogram")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Select the highest quality natural/neural voice available for the language.
 */
function findBestVoice(voices, lang) {
  if (!voices || voices.length === 0) return null;

  if (lang === "ta") {
    // 1. Dedicated Tamil voices (Google தமிழ், Apple Valluvar, Microsoft Pallavi)
    const tamil = voices.find(
      (v) =>
        (v.lang && v.lang.toLowerCase().startsWith("ta")) ||
        (v.name && v.name.toLowerCase().includes("tamil"))
    );
    if (tamil) return tamil;
  }

  // 2. High-quality Indian English voice (en-IN)
  const indianNatural = voices.find(
    (v) =>
      (v.lang === "en-IN" || v.lang === "en_IN") &&
      /natural|neural|google|rishi|neerja|veena|lekha/i.test(v.name)
  );
  if (indianNatural) return indianNatural;

  const anyIndian = voices.find((v) => v.lang === "en-IN" || v.lang === "en_IN");
  if (anyIndian) return anyIndian;

  // 3. Natural / Neural English voice
  const naturalEng = voices.find(
    (v) =>
      v.lang &&
      v.lang.startsWith("en") &&
      /natural|neural|google|samantha|ava|karen|siri|premium/i.test(v.name)
  );
  if (naturalEng) return naturalEng;

  return voices.find((v) => v.lang && v.lang.startsWith("en")) || voices[0];
}

/**
 * Split text into reasonable chunks so browser SpeechSynthesis never stalls.
 */
function splitIntoChunks(text, maxLen = 160) {
  if (text.length <= maxLen) return [text];
  const parts = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
  const chunks = [];
  let current = "";
  for (const part of parts) {
    if ((current + " " + part).trim().length > maxLen) {
      if (current.trim()) chunks.push(current.trim());
      current = part;
    } else {
      current = (current + " " + part).trim();
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

export function useSpeech({ language = "en", onResult }) {
  const Recognition =
    typeof window !== "undefined"
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;

  const hasMediaDevices =
    typeof window !== "undefined" &&
    Boolean(navigator?.mediaDevices?.getUserMedia);

  // Supported if either MediaRecorder (Groq Whisper) or Web Speech Recognition is available
  const sttSupported = Boolean(hasMediaDevices || Recognition);
  const ttsSupported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const voicesRef = useRef([]);

  // Load available system voices
  useEffect(() => {
    if (!ttsSupported) return;
    const updateVoices = () => {
      try {
        voicesRef.current = window.speechSynthesis.getVoices() || [];
      } catch (_) {}
    };
    updateVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, [ttsSupported]);

  // Transcribe recorded audio with Groq Whisper
  const transcribeAudioBlob = useCallback(
    async (blob, activeLang) => {
      if (!blob || blob.size < 500) {
        setTranscribing(false);
        return;
      }
      setTranscribing(true);
      try {
        const formData = new FormData();
        const mime = blob.type || "audio/webm";
        let ext = "webm";
        if (mime.includes("mp4")) ext = "mp4";
        else if (mime.includes("ogg")) ext = "ogg";
        else if (mime.includes("wav")) ext = "wav";

        formData.append("file", blob, `voice_recording.${ext}`);
        formData.append("model", "whisper-large-v3-turbo");

        const targetLang = activeLang || language;
        if (targetLang === "ta") {
          // Explicit Tamil ISO code + rich Tamil agricultural vocabulary
          formData.append("language", "ta");
          formData.append(
            "prompt",
            "வணக்கம், உழவன் 360, தக்காளி, வெங்காயம், நெல், கத்தரிக்காய், சிறுகீரை, மார்க்கெட், விலை, விளைச்சல், இருப்பு, சந்தை, ஆர்டர், பண்ணை, விவசாயம், என்ன விலை, உரம், எவ்வளவு"
          );
        } else if (targetLang === "tanglish") {
          // Tanglish: Provide conversational phonetic prompt without locking to English
          formData.append(
            "prompt",
            "Vanakkam, Uzhavan 360, thakkali, vengayam, nel, keerai, vilai evlo, rate enna, stock irukka, sandhai, order status, farm produce, mandi, kaatu, en produce"
          );
        } else {
          formData.append("language", "en");
          formData.append(
            "prompt",
            "Uzhavan 360, agriculture, Tamil Nadu, crops, vegetables, tomato, onion, paddy, rate, harvest, orders, stock"
          );
        }

        const response = await fetch(
          "https://api.groq.com/openai/v1/audio/transcriptions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${GROQ_API_KEY}`,
            },
            body: formData,
          }
        );

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          console.warn("[Groq Whisper STT Error]", errData);
          return;
        }

        const data = await response.json();
        const text = data?.text?.trim();
        if (text) {
          onResult?.(text);
        }
      } catch (err) {
        console.warn("[STT Error]", err.message);
      } finally {
        setTranscribing(false);
      }
    },
    [language, onResult]
  );

  const stop = useCallback(() => {
    // 1. Stop MediaRecorder if running
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch (_) {}
    }

    // 2. Stop audio stream tracks to release microphone
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // 3. Stop browser SpeechRecognition fallback if running
    if (recRef.current) {
      try {
        recRef.current.stop();
      } catch (_) {}
    }

    setListening(false);
  }, []);

  const start = useCallback(async () => {
    // Cancel any ongoing speech when listening starts
    if (ttsSupported) {
      try {
        window.speechSynthesis.cancel();
      } catch (_) {}
    }

    // Try Groq Whisper STT with MediaRecorder first (Ultra-fast, accurate Whisper Large v3)
    if (hasMediaDevices && GROQ_API_KEY) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 16000,
          },
        });
        streamRef.current = stream;
        audioChunksRef.current = [];

        let mimeType = "audio/webm;codecs=opus";
        if (
          typeof MediaRecorder !== "undefined" &&
          !MediaRecorder.isTypeSupported(mimeType)
        ) {
          mimeType = MediaRecorder.isTypeSupported("audio/webm")
            ? "audio/webm"
            : MediaRecorder.isTypeSupported("audio/mp4")
            ? "audio/mp4"
            : "";
        }

        const options = mimeType ? { mimeType } : {};
        const mediaRecorder = new MediaRecorder(stream, options);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          const blob = new Blob(audioChunksRef.current, {
            type: mediaRecorder.mimeType || "audio/webm",
          });
          audioChunksRef.current = [];
          await transcribeAudioBlob(blob, language);
        };

        mediaRecorder.start(250);
        setListening(true);
        return;
      } catch (micErr) {
        console.warn(
          "[MediaRecorder STT] Falling back to Web Speech Recognition:",
          micErr.message
        );
      }
    }

    // Fallback: Web Speech API SpeechRecognition
    if (Recognition) {
      try {
        const rec = new Recognition();
        rec.lang = LANG[language] || (language === "ta" ? "ta-IN" : "en-IN");
        rec.interimResults = false;
        rec.maxAlternatives = 1;
        rec.onresult = (e) => onResult?.(e.results[0][0].transcript);
        rec.onend = () => setListening(false);
        rec.onerror = () => setListening(false);
        recRef.current = rec;
        rec.start();
        setListening(true);
      } catch (recErr) {
        console.warn("[SpeechRecognition Error]", recErr.message);
        setListening(false);
      }
    }
  }, [hasMediaDevices, ttsSupported, language, onResult, transcribeAudioBlob, Recognition]);

  // Nice natural TTS synthesis
  const say = useCallback(
    (text) => {
      if (!ttsSupported || !text) return;
      try {
        window.speechSynthesis.cancel();
      } catch (_) {}

      const cleanText = cleanTextForSpeech(text);
      if (!cleanText) return;

      const voices =
        voicesRef.current.length > 0
          ? voicesRef.current
          : window.speechSynthesis.getVoices() || [];
      const bestVoice = findBestVoice(voices, language);
      const chunks = splitIntoChunks(cleanText, 160);

      chunks.forEach((chunk) => {
        const utterance = new SpeechSynthesisUtterance(chunk);
        utterance.lang = LANG[language] || "en-IN";
        if (bestVoice) utterance.voice = bestVoice;
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
      });
    },
    [language, ttsSupported]
  );

  useEffect(() => {
    return () => {
      recRef.current?.abort?.();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return { sttSupported, ttsSupported, listening, transcribing, start, stop, say };
}
