import {
  BankOutlined,
  CoffeeOutlined,
  EnvironmentOutlined,
  EyeOutlined,
  MoonOutlined,
  PictureOutlined,
  PushpinOutlined,
  ShoppingOutlined,
  SunOutlined,
} from '@ant-design/icons';

/**
 * `Icon` is the component, not an element: callers size and colour it themselves. Line icons rather
 * than emoji — emoji render differently on every platform and read as noise next to antd's own set.
 */
export const CATEGORY_STYLE = {
  Landmark: { color: '#3b6cff', Icon: EnvironmentOutlined },
  Museum: { color: '#7c3aed', Icon: PictureOutlined },
  Park: { color: '#10b981', Icon: SunOutlined },
  Food: { color: '#ef4444', Icon: CoffeeOutlined },
  Shopping: { color: '#ec4899', Icon: ShoppingOutlined },
  Nightlife: { color: '#f59e0b', Icon: MoonOutlined },
  Temple: { color: '#0ea5e9', Icon: BankOutlined },
  Viewpoint: { color: '#14b8a6', Icon: EyeOutlined },
};

export const categoryStyle = (category) =>
  CATEGORY_STYLE[category] || { color: '#94a3b8', Icon: PushpinOutlined };

/** Labels come from the dictionary via `t('mode.' + value)`. */
export const MODES = [{ value: 'WALK' }, { value: 'TRANSIT' }, { value: 'DRIVE' }];

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
