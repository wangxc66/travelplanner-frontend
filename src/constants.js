export const CATEGORY_STYLE = {
  Landmark: { color: '#3b6cff', icon: '📍' },
  Museum: { color: '#7c3aed', icon: '🖼️' },
  Park: { color: '#10b981', icon: '🌳' },
  Food: { color: '#ef4444', icon: '🍜' },
  Shopping: { color: '#ec4899', icon: '🛍️' },
  Nightlife: { color: '#f59e0b', icon: '🍸' },
  Temple: { color: '#0ea5e9', icon: '⛩️' },
  Viewpoint: { color: '#14b8a6', icon: '🔭' },
};

export const categoryStyle = (category) =>
  CATEGORY_STYLE[category] || { color: '#94a3b8', icon: '📌' };

/** Labels come from the dictionary via `t('mode.' + value)`. */
export const MODES = [
  { value: 'WALK', icon: '🚶' },
  { value: 'TRANSIT', icon: '🚇' },
  { value: 'DRIVE', icon: '🚗' },
];

export const GOOGLE_MAPS_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';

/** "1h 30m" / "1 小时 30 分" — the shape differs per language, so the dictionary owns it. */
export function formatMinutes(minutes, t) {
  const total = minutes || 0;
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return t('unit.minutes', { m });
  return m ? t('unit.hoursMinutes', { h, m }) : t('unit.hours', { h });
}

/**
 * Deep link into the Uber app for one leg of the itinerary, falling back to the web flow on desktop.
 * Every ride-shaped leg in the plan is one tap from a booked car.
 */
export function uberLink(from, to) {
  const params = new URLSearchParams({
    action: 'setPickup',
    'pickup[latitude]': from.lat,
    'pickup[longitude]': from.lng,
    'pickup[nickname]': from.name,
    'dropoff[latitude]': to.lat,
    'dropoff[longitude]': to.lng,
    'dropoff[nickname]': to.name,
  });
  return `https://m.uber.com/ul/?${params.toString()}`;
}

export function lyftLink(from, to) {
  const params = new URLSearchParams({
    id: 'lyft',
    'pickup[latitude]': from.lat,
    'pickup[longitude]': from.lng,
    'destination[latitude]': to.lat,
    'destination[longitude]': to.lng,
  });
  return `https://ride.lyft.com/ridetype?${params.toString()}`;
}
