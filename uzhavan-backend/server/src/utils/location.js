/**
 * Location Utilities — Geospatial helpers for Uzhavan 360
 * Level 1 Architecture Reference: Section 11 — Google Maps Architecture
 */

const EARTH_RADIUS_KM = 6371;

/**
 * Compute Haversine distance between two lat/lng points.
 * @param {{lat: number, lng: number}} point1
 * @param {{lat: number, lng: number}} point2
 * @returns {number} distance in kilometres
 */
export function haversineDistance(point1, point2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(point2.lat - point1.lat);
  const dLng = toRad(point2.lng - point1.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(point1.lat)) * Math.cos(toRad(point2.lat)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Apply spatial privacy jitter to protect farmer exact coordinates.
 * Level 1 Architecture Decision Record: ADR 05
 *
 * @param {{lat: number, lng: number}} exactCoords
 * @param {number} maxJitterMeters - Default 1000m (1 km)
 * @returns {{lat: number, lng: number}} Fuzzed approximate coords
 */
export function applyPrivacyJitter(exactCoords, maxJitterMeters = 1000) {
  const jitterDegLat = (maxJitterMeters / 111320) * (Math.random() * 2 - 1);
  const jitterDegLng =
    (maxJitterMeters / (111320 * Math.cos((exactCoords.lat * Math.PI) / 180))) *
    (Math.random() * 2 - 1);
  return {
    lat: parseFloat((exactCoords.lat + jitterDegLat).toFixed(6)),
    lng: parseFloat((exactCoords.lng + jitterDegLng).toFixed(6))
  };
}

/**
 * Build a MongoDB GeoJSON Point for storage.
 * MongoDB 2dsphere index format: [longitude, latitude]
 */
export function toGeoJsonPoint(lat, lng) {
  return {
    type: 'Point',
    coordinates: [parseFloat(lng), parseFloat(lat)]
  };
}

/**
 * Convert metres to MongoDB $nearSphere maxDistance (metres).
 * @param {number} km
 */
export function kmToMetres(km) {
  return km * 1000;
}

/**
 * Default discovery radius in km
 */
export const DEFAULT_DISCOVERY_RADIUS_KM = 25;
export const MAX_DISCOVERY_RADIUS_KM = 100;

/**
 * Comprehensive Tamil Nadu District and Agricultural Trading Hub Geocoding
 */
export const TAMIL_NADU_LOCATIONS = {
  salem: { name: 'Salem', nameTa: 'சேலம்', lat: 11.6643, lng: 78.1460, district: 'Salem' },
  சேலம்: { name: 'Salem', nameTa: 'சேலம்', lat: 11.6643, lng: 78.1460, district: 'Salem' },
  coimbatore: { name: 'Coimbatore', nameTa: 'கோயம்புத்தூர்', lat: 11.0168, lng: 76.9558, district: 'Coimbatore' },
  kovai: { name: 'Coimbatore', nameTa: 'கோவை', lat: 11.0168, lng: 76.9558, district: 'Coimbatore' },
  கோயம்புத்தூர்: { name: 'Coimbatore', nameTa: 'கோயம்புத்தூர்', lat: 11.0168, lng: 76.9558, district: 'Coimbatore' },
  கோவை: { name: 'Coimbatore', nameTa: 'கோவை', lat: 11.0168, lng: 76.9558, district: 'Coimbatore' },
  chennai: { name: 'Chennai', nameTa: 'சென்னை', lat: 13.0827, lng: 80.2707, district: 'Chennai' },
  madras: { name: 'Chennai', nameTa: 'சென்னை', lat: 13.0827, lng: 80.2707, district: 'Chennai' },
  சென்னை: { name: 'Chennai', nameTa: 'சென்னை', lat: 13.0827, lng: 80.2707, district: 'Chennai' },
  madurai: { name: 'Madurai', nameTa: 'மதுரை', lat: 9.9252, lng: 78.1198, district: 'Madurai' },
  மதுரை: { name: 'Madurai', nameTa: 'மதுரை', lat: 9.9252, lng: 78.1198, district: 'Madurai' },
  trichy: { name: 'Tiruchirappalli', nameTa: 'திருச்சி', lat: 10.7905, lng: 78.7047, district: 'Tiruchirappalli' },
  tiruchirappalli: { name: 'Tiruchirappalli', nameTa: 'திருச்சிராப்பள்ளி', lat: 10.7905, lng: 78.7047, district: 'Tiruchirappalli' },
  திருச்சி: { name: 'Tiruchirappalli', nameTa: 'திருச்சி', lat: 10.7905, lng: 78.7047, district: 'Tiruchirappalli' },
  erode: { name: 'Erode', nameTa: 'ஈரோடு', lat: 11.3410, lng: 77.7281, district: 'Erode' },
  ஈரோடு: { name: 'Erode', nameTa: 'ஈரோடு', lat: 11.3410, lng: 77.7281, district: 'Erode' },
  tiruppur: { name: 'Tiruppur', nameTa: 'திருப்பூர்', lat: 11.1085, lng: 77.3411, district: 'Tiruppur' },
  tirupur: { name: 'Tiruppur', nameTa: 'திருப்பூர்', lat: 11.1085, lng: 77.3411, district: 'Tiruppur' },
  திருப்பூர்: { name: 'Tiruppur', nameTa: 'திருப்பூர்', lat: 11.1085, lng: 77.3411, district: 'Tiruppur' },
  dindigul: { name: 'Dindigul', nameTa: 'திண்டுக்கல்', lat: 10.3673, lng: 77.9803, district: 'Dindigul' },
  திண்டுக்கல்: { name: 'Dindigul', nameTa: 'திண்டுக்கல்', lat: 10.3673, lng: 77.9803, district: 'Dindigul' },
  thanjavur: { name: 'Thanjavur', nameTa: 'தஞ்சாவூர்', lat: 10.7870, lng: 79.1378, district: 'Thanjavur' },
  tanjore: { name: 'Thanjavur', nameTa: 'தஞ்சாவூர்', lat: 10.7870, lng: 79.1378, district: 'Thanjavur' },
  தஞ்சாவூர்: { name: 'Thanjavur', nameTa: 'தஞ்சாவூர்', lat: 10.7870, lng: 79.1378, district: 'Thanjavur' },
  dharmapuri: { name: 'Dharmapuri', nameTa: 'தர்மபுரி', lat: 12.1211, lng: 78.1590, district: 'Dharmapuri' },
  தர்மபுரி: { name: 'Dharmapuri', nameTa: 'தர்மபுரி', lat: 12.1211, lng: 78.1590, district: 'Dharmapuri' },
  krishnagiri: { name: 'Krishnagiri', nameTa: 'கிருஷ்ணகிரி', lat: 12.5186, lng: 78.2138, district: 'Krishnagiri' },
  கிருஷ்ணகிரி: { name: 'Krishnagiri', nameTa: 'கிருஷ்ணகிரி', lat: 12.5186, lng: 78.2138, district: 'Krishnagiri' },
  namakkal: { name: 'Namakkal', nameTa: 'நாமக்கல்', lat: 11.2189, lng: 78.1652, district: 'Namakkal' },
  நாமக்கல்: { name: 'Namakkal', nameTa: 'நாமக்கல்', lat: 11.2189, lng: 78.1652, district: 'Namakkal' },
  theni: { name: 'Theni', nameTa: 'தேனி', lat: 10.0104, lng: 77.4768, district: 'Theni' },
  தேனி: { name: 'Theni', nameTa: 'தேனி', lat: 10.0104, lng: 77.4768, district: 'Theni' },
  tirunelveli: { name: 'Tirunelveli', nameTa: 'திருநெல்வேலி', lat: 8.7139, lng: 77.7567, district: 'Tirunelveli' },
  nellai: { name: 'Tirunelveli', nameTa: 'நெல்லை', lat: 8.7139, lng: 77.7567, district: 'Tirunelveli' },
  திருநெல்வேலி: { name: 'Tirunelveli', nameTa: 'திருநெல்வேலி', lat: 8.7139, lng: 77.7567, district: 'Tirunelveli' },
  thoothukudi: { name: 'Thoothukudi', nameTa: 'தூத்துக்குடி', lat: 8.7642, lng: 78.1348, district: 'Thoothukudi' },
  tuticorin: { name: 'Thoothukudi', nameTa: 'தூத்துக்குடி', lat: 8.7642, lng: 78.1348, district: 'Thoothukudi' },
  தூத்துக்குடி: { name: 'Thoothukudi', nameTa: 'தூத்துக்குடி', lat: 8.7642, lng: 78.1348, district: 'Thoothukudi' },
  nagercoil: { name: 'Nagercoil', nameTa: 'நாகர்கோவில்', lat: 8.1833, lng: 77.4319, district: 'Kanyakumari' },
  kanyakumari: { name: 'Kanyakumari', nameTa: 'கன்னியாகுமரி', lat: 8.0883, lng: 77.5385, district: 'Kanyakumari' },
  vellore: { name: 'Vellore', nameTa: 'வேலூர்', lat: 12.9165, lng: 79.1325, district: 'Vellore' },
  வேலூர்: { name: 'Vellore', nameTa: 'வேலூர்', lat: 12.9165, lng: 79.1325, district: 'Vellore' },
  tiruvannamalai: { name: 'Tiruvannamalai', nameTa: 'திருவண்ணாமலை', lat: 12.2253, lng: 79.0747, district: 'Tiruvannamalai' },
  திருவண்ணாமலை: { name: 'Tiruvannamalai', nameTa: 'திருவண்ணாமலை', lat: 12.2253, lng: 79.0747, district: 'Tiruvannamalai' },
  villupuram: { name: 'Villupuram', nameTa: 'விழுப்புரம்', lat: 11.9401, lng: 79.4924, district: 'Villupuram' },
  விழுப்புரம்: { name: 'Villupuram', nameTa: 'விழுப்புரம்', lat: 11.9401, lng: 79.4924, district: 'Villupuram' },
  cuddalore: { name: 'Cuddalore', nameTa: 'கடலூர்', lat: 11.7480, lng: 79.7680, district: 'Cuddalore' },
  கடலூர்: { name: 'Cuddalore', nameTa: 'கடலூர்', lat: 11.7480, lng: 79.7680, district: 'Cuddalore' },
  nagapattinam: { name: 'Nagapattinam', nameTa: 'நாகப்பட்டினம்', lat: 10.7672, lng: 79.8424, district: 'Nagapattinam' },
  thiruvarur: { name: 'Thiruvarur', nameTa: 'திருவாரூர்', lat: 10.7725, lng: 79.6344, district: 'Thiruvarur' },
  mayiladuthurai: { name: 'Mayiladuthurai', nameTa: 'மயிலாடுதுறை', lat: 11.1018, lng: 79.6524, district: 'Mayiladuthurai' },
  karur: { name: 'Karur', nameTa: 'கரூர்', lat: 10.9601, lng: 78.0766, district: 'Karur' },
  கரூர்: { name: 'Karur', nameTa: 'கரூர்', lat: 10.9601, lng: 78.0766, district: 'Karur' },
  perambalur: { name: 'Perambalur', nameTa: 'பெரம்பலூர்', lat: 11.2342, lng: 78.8821, district: 'Perambalur' },
  ariyalur: { name: 'Ariyalur', nameTa: 'அரியலூர்', lat: 11.1401, lng: 79.0754, district: 'Ariyalur' },
  pudukkottai: { name: 'Pudukkottai', nameTa: 'புதுக்கோட்டை', lat: 10.3833, lng: 78.8219, district: 'Pudukkottai' },
  sivaganga: { name: 'Sivaganga', nameTa: 'சிவகங்கை', lat: 9.8433, lng: 78.4819, district: 'Sivaganga' },
  ramanathapuram: { name: 'Ramanathapuram', nameTa: 'ராமநாதபுரம்', lat: 9.3716, lng: 78.8377, district: 'Ramanathapuram' },
  virudhunagar: { name: 'Virudhunagar', nameTa: 'விருதுநகர்', lat: 9.5872, lng: 77.9624, district: 'Virudhunagar' },
  tenkasi: { name: 'Tenkasi', nameTa: 'தென்காசி', lat: 8.9594, lng: 77.3000, district: 'Tenkasi' },
  kallakurichi: { name: 'Kallakurichi', nameTa: 'கள்ளக்குறிச்சி', lat: 11.7384, lng: 78.9629, district: 'Kallakurichi' },
  ranipet: { name: 'Ranipet', nameTa: 'ராணிப்பேட்டை', lat: 12.9272, lng: 79.3330, district: 'Ranipet' },
  tirupathur: { name: 'Tirupathur', nameTa: 'திருப்பத்தூர்', lat: 12.4958, lng: 78.5678, district: 'Tirupathur' },
  chengalpattu: { name: 'Chengalpattu', nameTa: 'செங்கல்பட்டு', lat: 12.6841, lng: 79.9839, district: 'Chengalpattu' },
  tiruvallur: { name: 'Tiruvallur', nameTa: 'திருவள்ளூர்', lat: 13.1437, lng: 79.9083, district: 'Tiruvallur' },
  kanchipuram: { name: 'Kanchipuram', nameTa: 'காஞ்சிபுரம்', lat: 12.8342, lng: 79.7036, district: 'Kanchipuram' },
  காஞ்சிபுரம்: { name: 'Kanchipuram', nameTa: 'காஞ்சிபுரம்', lat: 12.8342, lng: 79.7036, district: 'Kanchipuram' },
  ooty: { name: 'Ooty', nameTa: 'ஊட்டி', lat: 11.4102, lng: 76.6950, district: 'Nilgiris' },
  nilgiris: { name: 'Nilgiris', nameTa: 'நீலகிரி', lat: 11.4102, lng: 76.6950, district: 'Nilgiris' },
  pollachi: { name: 'Pollachi', nameTa: 'பொள்ளாச்சி', lat: 10.6609, lng: 77.0094, district: 'Coimbatore' },
  பொள்ளாச்சி: { name: 'Pollachi', nameTa: 'பொள்ளாச்சி', lat: 10.6609, lng: 77.0094, district: 'Coimbatore' },
  hosur: { name: 'Hosur', nameTa: 'ஓசூர்', lat: 12.7409, lng: 77.8253, district: 'Krishnagiri' },
  ஓசூர்: { name: 'Hosur', nameTa: 'ஓசூர்', lat: 12.7409, lng: 77.8253, district: 'Krishnagiri' }
};

/**
 * Automatically resolve Tamil Nadu coordinates from town/city name or free text
 * @param {string} queryOrText
 * @returns {{ lat: number, lng: number, district: string, city: string } | null}
 */
export function resolveTamilNaduLocation(queryOrText) {
  if (!queryOrText || typeof queryOrText !== 'string') return null;
  const clean = queryOrText.toLowerCase().trim();

  // 1. Exact match
  if (TAMIL_NADU_LOCATIONS[clean]) {
    const loc = TAMIL_NADU_LOCATIONS[clean];
    return { lat: loc.lat, lng: loc.lng, district: loc.district, city: loc.name };
  }

  // 2. Contains match in sentence (e.g. "location is Salem", "சேலத்தில் தக்காளி")
  for (const [key, loc] of Object.entries(TAMIL_NADU_LOCATIONS)) {
    const regex = new RegExp(`(?:^|[\\s,;.:])${key}(?:$|[\\s,;.:])`, 'i');
    if (regex.test(clean) || clean.includes(key)) {
      return { lat: loc.lat, lng: loc.lng, district: loc.district, city: loc.name };
    }
  }

  return null;
}

