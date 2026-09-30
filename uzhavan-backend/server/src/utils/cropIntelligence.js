/**
 * Agricultural Crop Intelligence & Entity Extraction for Uzhavan 360
 * Supports Tamil, English, and Tanglish domain terms.
 */

// Category enum: LEAFY | FLOWER | FRUITING | TUBER | ROOT | GRAIN | CITRUS | OTHER
export const CROP_CATEGORY_MAP = {
  // Leafy
  spinach: 'LEAFY', keerai: 'LEAFY', கீரை: 'LEAFY', palak: 'LEAFY',
  coriander: 'LEAFY', kothamalli: 'LEAFY', கொத்தமல்லி: 'LEAFY',
  mint: 'LEAFY', pudina: 'LEAFY', புதினா: 'LEAFY',
  cabbage: 'LEAFY', mutaikos: 'LEAFY', முட்டைக்கோஸ்: 'LEAFY',
  fenugreek: 'LEAFY', methi: 'LEAFY', vendhayam: 'LEAFY', வெந்தயக்கீரை: 'LEAFY',
  murungai_keerai: 'LEAFY', முருங்கைக்கீரை: 'LEAFY', sirukeerai: 'LEAFY', சிறுகீரை: 'LEAFY',

  // Flower
  cauliflower: 'FLOWER', காலிஃபிளவர்: 'FLOWER',
  banana_flower: 'FLOWER', vazhaipoo: 'FLOWER', வாழைப்பூ: 'FLOWER',

  // Fruiting vegetables & fruits
  tomato: 'FRUITING', thakkali: 'FRUITING', தக்காளி: 'FRUITING',
  brinjal: 'FRUITING', eggplant: 'FRUITING', kathirikai: 'FRUITING', கத்தரிக்காய்: 'FRUITING',
  okra: 'FRUITING', bhendi: 'FRUITING', vendakkai: 'FRUITING', வெண்டைக்காய்: 'FRUITING',
  chilli: 'FRUITING', green_chilli: 'FRUITING', milagai: 'FRUITING', மிளகாய்: 'FRUITING',
  capsicum: 'FRUITING', kudai_milagai: 'FRUITING', குடைமிளகாய்: 'FRUITING',
  drumstick: 'FRUITING', murungakkai: 'FRUITING', முருங்கைக்காய்: 'FRUITING',
  cucumber: 'FRUITING', vellarikkai: 'FRUITING', வெள்ளரிக்காய்: 'FRUITING',
  bottle_gourd: 'FRUITING', suraikkai: 'FRUITING', சுரைக்காய்: 'FRUITING',
  ridge_gourd: 'FRUITING', peerkangai: 'FRUITING', பீர்க்கங்காய்: 'FRUITING',
  snake_gourd: 'FRUITING', pudalangai: 'FRUITING', புடலங்காய்: 'FRUITING',
  bitter_gourd: 'FRUITING', pavakkai: 'FRUITING', பாகற்காய்: 'FRUITING',
  pumpkin: 'FRUITING', poosanikkai: 'FRUITING', பூசணிக்காய்: 'FRUITING',
  ash_gourd: 'FRUITING', sambal_poosani: 'FRUITING', சாம்பல்_பூசணி: 'FRUITING',
  banana: 'FRUITING', vazhaipazham: 'FRUITING', வாழைப்பழம்: 'FRUITING', vazhaikkai: 'FRUITING', வாழைக்காய்: 'FRUITING',
  mango: 'FRUITING', maangai: 'FRUITING', மாங்காய்: 'FRUITING', maambazham: 'FRUITING', மாம்பழம்: 'FRUITING',
  papaya: 'FRUITING', pappali: 'FRUITING', பப்பாளி: 'FRUITING',
  guava: 'FRUITING', koyya: 'FRUITING', கொய்யா: 'FRUITING',
  watermelon: 'FRUITING', tharpoosani: 'FRUITING', தர்பூசணி: 'FRUITING',
  coconut: 'FRUITING', thengai: 'FRUITING', தேங்காய்: 'FRUITING', elaneer: 'FRUITING', இளநீர்: 'FRUITING',

  // Tuber & Root
  potato: 'TUBER', urulaikilangu: 'TUBER', urulai: 'TUBER', உருளைக்கிழங்கு: 'TUBER',
  carrot: 'TUBER', கேரட்: 'TUBER',
  beetroot: 'TUBER', பீட்ரூட்: 'TUBER',
  radish: 'TUBER', mullangi: 'TUBER', முள்ளங்கி: 'TUBER',
  ginger: 'TUBER', inji: 'TUBER', இஞ்சி: 'TUBER',
  turmeric: 'TUBER', manjal: 'TUBER', மஞ்சள்: 'TUBER',
  tapioca: 'TUBER', maravalli: 'TUBER', மரவள்ளிக்கிழங்கு: 'TUBER',
  yam: 'TUBER', senai: 'TUBER', சேனைக்கிழங்கு: 'TUBER',
  onion: 'ROOT', vengayam: 'ROOT', வெங்காயம்: 'ROOT',
  shallots: 'ROOT', chinna_vengayam: 'ROOT', சின்ன_வெங்காயம்: 'ROOT',
  garlic: 'ROOT', poondu: 'ROOT', பூண்டு: 'ROOT',

  // Grain & Pulses
  paddy: 'GRAIN', nel: 'GRAIN', நெல்: 'GRAIN', rice: 'GRAIN', arisi: 'GRAIN', அரிசி: 'GRAIN',
  wheat: 'GRAIN', godhumai: 'GRAIN', கோதுமை: 'GRAIN',
  maize: 'GRAIN', corn: 'GRAIN', cholam: 'GRAIN', சோளம்: 'GRAIN',
  millet: 'GRAIN', ragi: 'GRAIN', kezhvaragu: 'GRAIN', கேழ்வரகு: 'GRAIN',
  bajra: 'GRAIN', kambu: 'GRAIN', கம்பு: 'GRAIN',
  groundnut: 'GRAIN', nilakadalai: 'GRAIN', kadalai: 'GRAIN', நிலக்கடலை: 'GRAIN',
  black_gram: 'GRAIN', ulundu: 'GRAIN', உளுந்து: 'GRAIN',
  green_gram: 'GRAIN', pasi_payiru: 'GRAIN', பாசிப்பயறு: 'GRAIN',

  // Citrus
  lemon: 'CITRUS', lime: 'CITRUS', elumichai: 'CITRUS', எலுமிச்சை: 'CITRUS',
  orange: 'CITRUS', ஆரஞ்சு: 'CITRUS', sweet_lime: 'CITRUS', sathukudi: 'CITRUS', சாத்துக்குடி: 'CITRUS'
};

const COMMON_CROP_NAMES = [
  { en: 'Tomato', ta: 'தக்காளி', keys: ['tomato', 'tomatoes', 'thakkali', 'தக்காளி'] },
  { en: 'Onion', ta: 'வெங்காயம்', keys: ['onion', 'onions', 'vengayam', 'வெங்காயம்', 'shallot', 'shallots', 'chinna vengayam'] },
  { en: 'Potato', ta: 'உருளைக்கிழங்கு', keys: ['potato', 'potatoes', 'urulaikilangu', 'urulai', 'உருளைக்கிழங்கு', 'உருளை', 'aloo'] },
  { en: 'Brinjal', ta: 'கத்தரிக்காய்', keys: ['brinjal', 'brinjals', 'eggplant', 'eggplants', 'kathirikai', 'கத்தரிக்காய்', 'baingan'] },
  { en: 'Okra (Ladies Finger)', ta: 'வெண்டைக்காய்', keys: ['okra', 'ladies finger', 'lady finger', 'vendakkai', 'வெண்டைக்காய்', 'bhindi'] },
  { en: 'Chilli', ta: 'மிளகாய்', keys: ['chilli', 'chillies', 'chili', 'chilies', 'milagai', 'green chilli', 'green chillies', 'மிளகாய்', 'பச்சை மிளகாய்'] },
  { en: 'Carrot', ta: 'கேரட்', keys: ['carrot', 'carrots', 'கேரட்'] },
  { en: 'Beetroot', ta: 'பீட்ரூட்', keys: ['beetroot', 'beetroots', 'beet', 'beets', 'பீட்ரூட்'] },
  { en: 'Drumstick', ta: 'முருங்கைக்காய்', keys: ['drumstick', 'drumsticks', 'murungakkai', 'முருங்கைக்காய்'] },
  { en: 'Cabbage', ta: 'முட்டைக்கோஸ்', keys: ['cabbage', 'cabbages', 'mutaikos', 'முட்டைக்கோஸ்'] },
  { en: 'Cauliflower', ta: 'காலிஃபிளவர்', keys: ['cauliflower', 'cauliflowers', 'காலிஃபிளவர்', 'gobi'] },
  { en: 'Spinach', ta: 'கீரை', keys: ['spinach', 'keerai', 'கீரை', 'palak', 'முருங்கைக்கீரை', 'greens'] },
  { en: 'Paddy', ta: 'நெல்', keys: ['paddy', 'nel', 'நெல்', 'rice', 'அரிசி'] },
  { en: 'Maize / Corn', ta: 'சோளம்', keys: ['maize', 'corn', 'cholam', 'சோளம்'] },
  { en: 'Ragi', ta: 'கேழ்வரகு', keys: ['ragi', 'kezhvaragu', 'கேழ்வரகு', 'finger millet'] },
  { en: 'Banana', ta: 'வாழைப்பழம்', keys: ['banana', 'bananas', 'vazhaipazham', 'வாழைப்பழம்', 'வாழைக்காய்', 'plantain', 'plantains'] },
  { en: 'Mango', ta: 'மாங்காய்', keys: ['mango', 'mangoes', 'maangai', 'மாங்காய்', 'மாம்பழம்'] },
  { en: 'Coconut', ta: 'தேங்காய்', keys: ['coconut', 'coconuts', 'thengai', 'தேங்காய்', 'இளநீர்', 'tender coconut'] },
  { en: 'Lemon', ta: 'எலுமிச்சை', keys: ['lemon', 'lemons', 'lime', 'limes', 'elumichai', 'எலுமிச்சை'] },
  { en: 'Ginger', ta: 'இஞ்சி', keys: ['ginger', 'inji', 'இஞ்சி', 'adrak'] },
  { en: 'Garlic', ta: 'பூண்டு', keys: ['garlic', 'poondu', 'பூண்டு', 'lahsun'] },
  { en: 'Cucumber', ta: 'வெள்ளரிக்காய்', keys: ['cucumber', 'cucumbers', 'vellarikkai', 'வெள்ளரிக்காய்'] },
  { en: 'Bitter Gourd', ta: 'பாகற்காய்', keys: ['bitter gourd', 'pavakkai', 'பாகற்காய்'] },
  { en: 'Bottle Gourd', ta: 'சுரைக்காய்', keys: ['bottle gourd', 'suraikkai', 'சுரைக்காய்'] },
  { en: 'Snake Gourd', ta: 'புடலங்காய்', keys: ['snake gourd', 'pudalangai', 'புடலங்காய்'] },
  { en: 'Ridge Gourd', ta: 'பீர்க்கங்காய்', keys: ['ridge gourd', 'peerkangai', 'பீர்க்கங்காய்'] },
  { en: 'Pumpkin', ta: 'பூசணிக்காய்', keys: ['pumpkin', 'pumpkins', 'poosanikkai', 'பூசணிக்காய்'] },
  { en: 'Groundnut', ta: 'நிலக்கடலை', keys: ['groundnut', 'groundnuts', 'peanut', 'peanuts', 'nilakadalai', 'நிலக்கடலை', 'kadalai'] },
  { en: 'Turmeric', ta: 'மஞ்சள்', keys: ['turmeric', 'manjal', 'மஞ்சள்'] },
  { en: 'Watermelon', ta: 'தர்பூசணி', keys: ['watermelon', 'watermelons', 'tharpoosani', 'தர்பூசணி'] },
  { en: 'Papaya', ta: 'பப்பாளி', keys: ['papaya', 'papayas', 'pappali', 'பப்பாளி'] },
  { en: 'Guava', ta: 'கொய்யா', keys: ['guava', 'guavas', 'koyya', 'கொய்யா'] }
];

/**
 * Infer category from crop name
 */
export function inferCropCategory(cropName) {
  if (!cropName) return 'OTHER';
  const clean = cropName.toLowerCase().replace(/[^a-z0-9\u0B80-\u0BFF]/g, ' ').trim();
  for (const [key, cat] of Object.entries(CROP_CATEGORY_MAP)) {
    if (clean.includes(key.replace(/_/g, ' '))) {
      return cat;
    }
  }
  return 'OTHER';
}

/**
 * Extract crop name, price, quantity, date, location from free text
 */
export function extractProduceEntities(text) {
  if (!text || typeof text !== 'string') return {};
  const lower = text.toLowerCase();
  const entities = {};

  // 1. Detect Crop with word boundaries (avoids 'price' matching 'rice') and plural support
  for (const crop of COMMON_CROP_NAMES) {
    if (crop.keys.some((k) => {
      const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = /^[a-z\s]+$/i.test(k) ? `${escaped}(?:es|s)?` : escaped;
      const regex = new RegExp(`(?:^|[\\s,;.:!?])${pattern}(?:$|[\\s,;.:!?])`, 'i');
      return regex.test(lower);
    })) {
      entities.name = crop.en;
      entities.nameTamil = crop.ta;
      entities.category = inferCropCategory(crop.en);
      break;
    }
  }

  // 2. Detect Price (e.g. "price is 5 rupees", "₹5", "5 rs", "5 per kg", "rate 25", "விலை 25")
  const priceMatch =
    text.match(/(?:price|rate|cost|விலை|விலை\s*ரூபாய்|₹|rs\.?|inr)\s*(?:is|:|=)?\s*(\d+(?:\.\d+)?)/i) ||
    text.match(/(\d+(?:\.\d+)?)\s*(?:rupees|rupee|rs|ரூபாய்|ரூ)/i) ||
    text.match(/(\d+(?:\.\d+)?)\s*(?:per\s*(?:kg|kilo|bag|mootai|கிலோ))/i);

  if (priceMatch) {
    entities.pricePerUnit = parseFloat(priceMatch[1]);
  }

  // 3. Detect Quantity & Unit (e.g. "100 kg", "500 kgs", "50 bags", "10 மூட்டை", "5 ton")
  const qtyMatch =
    text.match(/(\d+(?:\.\d+)?)\s*(kg|kgs|kilo|kilos|கிலோ|bag|bags|மூட்டை|ton|tons|டன்|box|crates?|bunches?|pieces?|பார்சல்)/i) ||
    text.match(/(?:quantity|qty|stock|அளவு|ஸ்டாக்)\s*(?:is|:|=)?\s*(\d+(?:\.\d+)?)/i);

  if (qtyMatch) {
    entities.quantity = parseFloat(qtyMatch[1]);
    const rawUnit = (qtyMatch[2] || '').toLowerCase();
    if (/bag|மூட்டை/.test(rawUnit)) entities.unit = 'BAG';
    else if (/ton|டன்/.test(rawUnit)) entities.unit = 'TON';
    else if (/box/.test(rawUnit)) entities.unit = 'BOX';
    else if (/crate/.test(rawUnit)) entities.unit = 'CRATE';
    else if (/bunch|கட்டு/.test(rawUnit)) entities.unit = 'BUNCH';
    else if (/piece/.test(rawUnit)) entities.unit = 'PIECE';
    else entities.unit = 'KG';
  }

  // 4. Detect Harvest Date
  if (/tomorrow|நாளை|naalai/i.test(lower)) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    entities.harvestDate = d.toISOString().split('T')[0];
  } else if (/today|இன்று|innikku/i.test(lower)) {
    entities.harvestDate = new Date().toISOString().split('T')[0];
  } else if (/day after tomorrow|நாளை மறுநாள்/i.test(lower)) {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    entities.harvestDate = d.toISOString().split('T')[0];
  }

  // 5. Detect GPS Coordinates if pasted (e.g. "11.6619, 78.1193")
  const coordMatch = text.match(/([0-9]{1,2}\.[0-9]{3,7})\s*,\s*([0-9]{1,3}\.[0-9]{3,7})/);
  if (coordMatch) {
    const p1 = parseFloat(coordMatch[1]);
    const p2 = parseFloat(coordMatch[2]);
    // TN lat is ~8-14, lng is ~76-81
    if (p1 >= 8 && p1 <= 14 && p2 >= 76 && p2 <= 81) {
      entities.latitude = p1;
      entities.longitude = p2;
    } else if (p2 >= 8 && p2 <= 14 && p1 >= 76 && p1 <= 81) {
      entities.latitude = p2;
      entities.longitude = p1;
    }
  }

  return entities;
}
