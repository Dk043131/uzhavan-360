import { useCallback, useEffect, useRef, useState } from "react";

const LANG = {
  en: "en-IN",
  ta: "ta-IN",
  tanglish: "en-IN",
  hi: "hi-IN",
  mr: "mr-IN",
  te: "te-IN",
  kn: "kn-IN",
  ml: "ml-IN",
  bn: "bn-IN",
  gu: "gu-IN"
};

const GROQ_API_KEY = process.env.REACT_APP_GROQ_API_KEY || "";

/**
 * Clean text for warm, human-like speech synthesis.
 * Strips code blocks, markdown links, symbols, emojis, technical IDs, and expands units.
 */
function cleanTextForSpeech(text, lang = "en") {
  if (!text) return "";
  let cleaned = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/###?\s+/g, "")
    .replace(/[*_~>#]/g, "")
    .replace(/\|/g, " ")
    .replace(/[✅❌⚠️🌾🍅🥔🥕🌽🚜📦🛒💰✨🎙️●•]/gu, "")
    .replace(/#[0-9a-f]{4,}/gi, " ")
    .replace(/\/kg\b/gi, lang === "ta" ? " ஒரு கிலோ" : lang === "mr" || lang === "hi" ? " प्रति किलो" : " per kilogram")
    .replace(/₹\s*(\d+(?:\.\d+)?)/g, (_, num) => {
      if (lang === "ta") return `${num} ரூபாய்`;
      if (lang === "mr" || lang === "hi") return `${num} रुपये`;
      return `${num} rupees`;
    })
    .replace(/\s+/g, " ")
    .trim();

  return cleaned;
}

/**
 * Select the highest quality natural/neural voice available for the language.
 * Prioritizes Apple Neural/Siri/Enhanced, Google Natural, Microsoft Online (Natural).
 */
function findBestVoice(voices, lang) {
  if (!voices || voices.length === 0) return null;

  const targetLang = (lang || "en").toLowerCase();

  // 1. Language-specific matching
  if (targetLang === "ta") {
    const tamil = voices.find(
      (v) =>
        (v.lang && v.lang.toLowerCase().startsWith("ta")) ||
        (v.name && /tamil|valluvar|pallavi/i.test(v.name))
    );
    if (tamil) return tamil;
  } else if (targetLang === "mr") {
    const marathi = voices.find(
      (v) =>
        (v.lang && v.lang.toLowerCase().startsWith("mr")) ||
        (v.name && /marathi|aarohi/i.test(v.name))
    );
    if (marathi) return marathi;
  } else if (targetLang === "hi") {
    const hindi = voices.find(
      (v) =>
        (v.lang && v.lang.toLowerCase().startsWith("hi")) ||
        (v.name && /hindi|swara|madhur|kalpana|lekha/i.test(v.name))
    );
    if (hindi) return hindi;
  } else if (targetLang === "te") {
    const telugu = voices.find(
      (v) =>
        (v.lang && v.lang.toLowerCase().startsWith("te")) ||
        (v.name && /telugu|mohan|shruti/i.test(v.name))
    );
    if (telugu) return telugu;
  } else if (targetLang === "kn") {
    const kannada = voices.find(
      (v) =>
        (v.lang && v.lang.toLowerCase().startsWith("kn")) ||
        (v.name && /kannada|gagan|sapna/i.test(v.name))
    );
    if (kannada) return kannada;
  } else if (targetLang === "ml") {
    const malayalam = voices.find(
      (v) =>
        (v.lang && v.lang.toLowerCase().startsWith("ml")) ||
        (v.name && /malayalam|midhun|sobhana/i.test(v.name))
    );
    if (malayalam) return malayalam;
  }

  // 2. High-quality Indian English voice (en-IN) — natural & human
  const indianNatural = voices.find(
    (v) =>
      (v.lang === "en-IN" || v.lang === "en_IN") &&
      /natural|neural|google|rishi|neerja|veena|lekha|prabhat/i.test(v.name)
  );
  if (indianNatural) return indianNatural;

  const anyIndian = voices.find((v) => v.lang === "en-IN" || v.lang === "en_IN");
  if (anyIndian) return anyIndian;

  // 3. Natural / Neural English voice (Apple Siri, Samantha, Google, Microsoft Natural)
  const naturalEng = voices.find(
    (v) =>
      v.lang &&
      v.lang.startsWith("en") &&
      /natural|neural|google|siri|premium|enhanced|samantha|ava/i.test(v.name)
  );
  if (naturalEng) return naturalEng;

  return voices.find((v) => v.lang && v.lang.startsWith("en")) || voices[0];
}

/**
 * Split text into reasonable conversational chunks so browser SpeechSynthesis never stalls.
 */
function splitIntoChunks(text, maxLen = 140) {
  if (text.length <= maxLen) return [text];
  const parts = text.match(/[^.!?।\n]+[.!?।\n]+|[^.!?।\n]+$/g) || [text];
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
          formData.append("language", "ta");
          formData.append(
            "prompt",
            "வணக்கம், உழவன் 360, தக்காளி, வெங்காயம், நெல், கத்தரிக்காய், சிறுகீரை, மார்க்கெட், விலை, விளைச்சல், இருப்பு, சந்தை, ஆர்டர், பண்ணை, விவசாயம், என்ன விலை, உரம், எவ்வளவு"
          );
        } else if (targetLang === "mr") {
          formData.append("language", "mr");
          formData.append(
            "prompt",
            "नमस्कार, उझवन 360, शेती, टोमॅटो, कांदा, तांदूळ, भाजीपाला, भाव काय आहे, साठा, खरेदीदार, बाजार, विक्री"
          );
        } else if (targetLang === "hi") {
          formData.append("language", "hi");
          formData.append(
            "prompt",
            "नमस्ते, उझवन 360, कृषि, टमाटर, प्याज, धान, गेहूं, मंडी भाव, फसल, स्टॉक, आर्डर, किसान"
          );
        } else if (targetLang === "te") {
          formData.append("language", "te");
          formData.append(
            "prompt",
            "నమస్కారం, ఉళవన్ 360, వ్యవసాయం, టమోటా, ఉల్లిపాయ, వరి, కూరగాయలు, ధర ఎంత, నిల్వ, ఆర్డర్"
          );
        } else if (targetLang === "kn") {
          formData.append("language", "kn");
          formData.append(
            "prompt",
            "ನಮಸ್ಕಾರ, ಉಳವನ್ 360, ಕೃಷಿ, ಟೊಮೇಟೊ, ಈರುಳ್ಳಿ, ಭತ್ತ, ತರಕಾರಿ, ಬೆಲೆ ಎಷ್ಟು, ದಾಸ್ತಾನು"
          );
        } else if (targetLang === "ml") {
          formData.append("language", "ml");
          formData.append(
            "prompt",
            "നമസ്കാരം, ഉഴവൻ 360, കൃഷി, തക്കാളി, ഉള്ളി, നെല്ല്, പച്ചക്കറികൾ, വില എത്ര, സ്റ്റോക്ക്"
          );
        } else if (targetLang === "tanglish") {
          formData.append(
            "prompt",
            "Vanakkam, Uzhavan 360, thakkali, vengayam, nel, keerai, vilai evlo, rate enna, stock irukka, sandhai, order status, farm produce, mandi, kaatu, en produce"
          );
        } else {
          formData.append("language", "en");
          formData.append(
            "prompt",
            "Uzhavan 360, agriculture, crops, vegetables, tomato, onion, paddy, rate, harvest, orders, stock"
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

      const cleanText = cleanTextForSpeech(text, language);
      if (!cleanText) return;

      const voices =
        voicesRef.current.length > 0
          ? voicesRef.current
          : window.speechSynthesis.getVoices() || [];
      const bestVoice = findBestVoice(voices, language);
      const chunks = splitIntoChunks(cleanText, 140);

      chunks.forEach((chunk) => {
        const utterance = new SpeechSynthesisUtterance(chunk);
        utterance.lang = LANG[language] || "en-IN";
        if (bestVoice) utterance.voice = bestVoice;
        // Human-like cadence: 0.94 rate sounds warm and natural, not mechanical or rushed
        utterance.rate = 0.94;
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
