import { EdgeTTS } from '@andresaya/edge-tts';
import crypto from 'crypto';

/**
 * High-fidelity Microsoft Neural TTS Voices for Indian Languages.
 * Studio-grade, natural human inflection, pronunciation, and warmth.
 */
export const VOICE_MAP = {
  en: 'en-IN-NeerjaExpressiveNeural',
  tanglish: 'en-IN-NeerjaNeural',
  ta: 'ta-IN-PallaviNeural',
  mr: 'mr-IN-AarohiNeural',
  hi: 'hi-IN-SwaraNeural',
  te: 'te-IN-ShrutiNeural',
  kn: 'kn-IN-SapnaNeural',
  ml: 'ml-IN-SobhanaNeural',
  bn: 'bn-IN-TanishaaNeural',
  gu: 'gu-IN-DhwaniNeural',
  ur: 'ur-IN-GulNeural'
};

const MALE_VOICE_MAP = {
  en: 'en-IN-PrabhatNeural',
  tanglish: 'en-IN-PrabhatNeural',
  ta: 'ta-IN-ValluvarNeural',
  mr: 'mr-IN-ManoharNeural',
  hi: 'hi-IN-MadhurNeural',
  te: 'te-IN-MohanNeural',
  kn: 'kn-IN-GaganNeural',
  ml: 'ml-IN-MidhunNeural',
  bn: 'bn-IN-BashkarNeural',
  gu: 'gu-IN-NiranjanNeural',
  ur: 'ur-IN-SalmanNeural'
};

// In-memory LRU cache for audio buffers (max 100 entries)
const audioCache = new Map();
const MAX_CACHE_SIZE = 100;

/**
 * Clean text for warm, human-like speech synthesis.
 * Strips code blocks, markdown links, symbols, emojis, technical IDs, and expands units.
 */
export function cleanTextForSpeech(text, lang = 'en') {
  if (!text) return '';

  let cleaned = String(text)
    // Remove code blocks and inline code
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    // Remove markdown links [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove markdown headers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold and italic markers
    .replace(/[*_~>]/g, '')
    // Replace ampersand with word
    .replace(/&/g, lang === 'ta' ? ' மற்றும் ' : lang === 'mr' || lang === 'hi' ? ' और ' : ' and ')
    // Remove table pipes and markdown bullets
    .replace(/[|●•\-\t]/g, ' ')
    // Remove emojis and special icons
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    // Remove long hex/mongo IDs
    .replace(/\b[0-9a-f]{24}\b/gi, ' ')
    .replace(/#[0-9a-f]{4,}/gi, ' ')
    // Expand currency
    .replace(/₹\s*(\d+(?:\.\d+)?)/g, (_, num) => {
      if (lang === 'ta') return `${num} ரூபாய்`;
      if (lang === 'mr' || lang === 'hi') return `${num} रुपये`;
      if (lang === 'te') return `${num} రూపాయలు`;
      if (lang === 'kn') return `${num} ರೂಪಾಯಿ`;
      if (lang === 'ml') return `${num} രൂപ`;
      return `${num} rupees`;
    })
    // Expand units
    .replace(/\/kg\b/gi, () => {
      if (lang === 'ta') return ' ஒரு கிலோவிற்கு';
      if (lang === 'mr' || lang === 'hi') return ' प्रति किलो';
      return ' per kilogram';
    })
    .replace(/\bkg\b/gi, () => {
      if (lang === 'ta') return ' கிலோ';
      if (lang === 'mr' || lang === 'hi') return ' किलो';
      return ' kilograms';
    })
    // Normalize punctuation & whitespace
    .replace(/\s+/g, ' ')
    .trim();

  // If text is too long (over 1200 chars), truncate gracefully to first 3-4 sentences
  if (cleaned.length > 1200) {
    const sentences = cleaned.match(/[^.!?।\n]+[.!?।\n]+/g) || [cleaned];
    let truncated = '';
    for (const s of sentences) {
      if ((truncated + s).length > 1000) break;
      truncated += s;
    }
    cleaned = truncated.trim() || cleaned.slice(0, 1000);
  }

  return cleaned;
}

/**
 * Generate audio buffer using Edge Neural TTS.
 */
export async function synthesizeSpeech({ text, language = 'en', gender = 'female', voiceOverride = null }) {
  const clean = cleanTextForSpeech(text, language);
  if (!clean) {
    throw new Error('No speech text provided after formatting.');
  }

  const voice =
    voiceOverride ||
    (gender === 'male' ? MALE_VOICE_MAP[language] : null) ||
    VOICE_MAP[language] ||
    VOICE_MAP.en;

  const cacheKey = crypto.createHash('md5').update(`${voice}__${clean}`).digest('hex');
  if (audioCache.has(cacheKey)) {
    return {
      buffer: audioCache.get(cacheKey),
      voice,
      text: clean,
      cached: true
    };
  }

  const tts = new EdgeTTS();
  await tts.synthesize(clean, voice, {
    rate: '+0%',
    pitch: '+0Hz',
    volume: '+0%',
    outputFormat: 'audio-24khz-48kbitrate-mono-mp3'
  });

  const buffer = await tts.toBuffer();

  if (buffer && buffer.length > 0) {
    if (audioCache.size >= MAX_CACHE_SIZE) {
      const firstKey = audioCache.keys().next().value;
      audioCache.delete(firstKey);
    }
    audioCache.set(cacheKey, buffer);
  }

  return {
    buffer,
    voice,
    text: clean,
    cached: false
  };
}
