export const ROLES = { FARMER: "ROLE_FARMER", BUYER: "ROLE_BUYER", ADMIN: "ROLE_ADMIN" };

export const CATEGORIES = [
  { key: "", label: "All produce", icon: "🌾" },
  { key: "LEAFY", label: "Leafy greens", icon: "🥬" },
  { key: "FRUITING", label: "Fruiting", icon: "🍅" },
  { key: "TUBER", label: "Tubers", icon: "🥔" },
  { key: "ROOT", label: "Roots", icon: "🥕" },
  { key: "GRAIN", label: "Grains", icon: "🌾" },
  { key: "CITRUS", label: "Citrus", icon: "🍋" },
  { key: "FLOWER", label: "Flowers", icon: "🌼" },
  { key: "OTHER", label: "Other", icon: "🧺" },
];

export const UNITS = ["KG", "TON", "QUINTAL", "BUNDLE", "CRATE", "PIECE"];

export const BYPRODUCT_CATEGORIES = ["PADDY_STRAW", "WHEAT_STRAW", "SUGARCANE_BAGASSE", "CORN_STALKS", "BANANA_STEMS", "COCONUT_SHELLS", "FARM_MANURE", "CROP_RESIDUE", "FRUIT_RESIDUES", "VEGETABLE_RESIDUES", "OTHER"];

export const BUSINESS_TYPES = ["HOUSEHOLD", "RETAIL", "WHOLESALE", "RESTAURANT", "PROCESSOR", "OTHER"];

// Manual location presets (user chose manual selection). Coordinates drive backend distance/radius.
export const CITIES = [
  { name: "Coimbatore", lat: 11.0168, lng: 76.9558 },
  { name: "Chennai", lat: 13.0827, lng: 80.2707 },
  { name: "Madurai", lat: 9.9252, lng: 78.1198 },
  { name: "Tiruchirappalli", lat: 10.7905, lng: 78.7047 },
  { name: "Salem", lat: 11.6643, lng: 78.146 },
  { name: "Bengaluru", lat: 12.9716, lng: 77.5946 },
];

export const REQUEST_STATUS = {
  REQUESTED: { label: "Awaiting farmer", tone: "pending" },
  ACCEPTED: { label: "Accepted — confirm quantity", tone: "action" },
  REJECTED: { label: "Declined", tone: "danger" },
  EXPIRED: { label: "Expired", tone: "muted" },
  QUANTITY_PENDING: { label: "Quantity pending", tone: "action" },
  RESERVED: { label: "Reserved", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "muted" },
};

export const ORDER_STATUS = {
  RESERVED: { label: "Reserved", tone: "pending" },
  PREPARING: { label: "Preparing", tone: "action" },
  READY_FOR_PICKUP: { label: "Ready for pickup", tone: "action" },
  COMPLETED: { label: "Completed", tone: "success" },
  COMPLETED_PARTIAL: { label: "Completed (partial)", tone: "warning" },
  NO_SHOW: { label: "No-show", tone: "danger" },
  CANCELLED_BY_BUYER: { label: "Cancelled by buyer", tone: "muted" },
  CANCELLED_BY_FARMER: { label: "Cancelled by farmer", tone: "muted" },
  EXPIRED: { label: "Expired", tone: "muted" },
};

export const ACTIVE_ORDER_STATES = ["RESERVED", "PREPARING", "READY_FOR_PICKUP"];

export const TAMIL_NAMES = { tomato: "தக்காளி", tomatoes: "தக்காளி", onion: "வெங்காயம்", onions: "வெங்காயம்", brinjal: "கத்தரிக்காய்", okra: "வெண்டைக்காய்", drumstick: "முருங்கைக்காய்", potato: "உருளைக்கிழங்கு", carrot: "கேரட்", banana: "வாழைப்பழம்", mango: "மாம்பழம்", coriander: "கொத்தமல்லி", keerai: "கீரை" };

export const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80";

export const money = (v = 0) => `₹${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
export const qty = (v, unit = "KG") => `${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })} ${String(unit || "KG").toLowerCase()}`;
export const idOf = (ref) => (ref && typeof ref === "object" ? ref._id : ref);
export const nameOf = (ref, fallback = "") => (ref && typeof ref === "object" ? ref.name : fallback);
export const relTime = (d) => {
  if (!d) return "";
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};
export const cropName = (name = "") => { const words = name.toLowerCase().replace(/[()]/g, " ").split(/\s+/); return words.map((w) => TAMIL_NAMES[w]).find(Boolean) || ""; };
export const imageFor = (item) => item?.images?.[0]?.url || FALLBACK_IMAGE;
