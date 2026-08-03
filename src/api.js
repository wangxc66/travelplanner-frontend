import axios from 'axios';

const TOKEN_KEY = 'tp_token';
const USER_KEY = 'tp_user';

const client = axios.create({ baseURL: '/' });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * The dev database is in-memory, so every backend restart wipes the accounts while the browser still
 * holds a perfectly well-signed token for a user that no longer exists. Without this, the app sits on a
 * spinner forever. Any 401/403 drops the stale session and sends the user back to the auth screen.
 */
let onUnauthorized = () => {};

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const isAuthCall = (error?.config?.url || '').startsWith('/auth/');
    if ((status === 401 || status === 403) && !isAuthCall) {
      session.clear();
      onUnauthorized();
    }
    return Promise.reject(error);
  },
);

/**
 * Normalises a failure into the server's semantic code plus params, keeping the English message as a
 * fallback for codes the dictionary does not know yet.
 */
export function errorNotice(error) {
  const data = error?.response?.data || {};
  return {
    code: data.code || 'error.generic',
    params: data.params || {},
    message: data.message || error?.message,
  };
}

export const session = {
  get() {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  save(auth) {
    localStorage.setItem(TOKEN_KEY, auth.token);
    localStorage.setItem(USER_KEY, JSON.stringify({ username: auth.username, displayName: auth.displayName }));
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

const unwrap = (promise) => promise.then((res) => res.data);

export const api = {
  login: (body) => unwrap(client.post('/auth/login', body)),
  register: (body) => unwrap(client.post('/auth/register', body)),

  cities: () => unwrap(client.get('/api/cities')),
  categories: (cityId) => unwrap(client.get(`/api/cities/${cityId}/categories`)),
  pois: (cityId, { keyword = '', category = '' } = {}) =>
    unwrap(client.get(`/api/cities/${cityId}/pois`, { params: { keyword, category, limit: 120 } })),

  trips: () => unwrap(client.get('/api/trips')),
  trip: (tripId) => unwrap(client.get(`/api/trips/${tripId}`)),
  createTrip: (body) => unwrap(client.post('/api/trips', body)),
  updateTrip: (tripId, body) => unwrap(client.patch(`/api/trips/${tripId}`, body)),
  deleteTrip: (tripId) => unwrap(client.delete(`/api/trips/${tripId}`)),

  addItem: (tripId, body) => unwrap(client.post(`/api/trips/${tripId}/items`, body)),
  removeItem: (tripId, itemId) => unwrap(client.delete(`/api/trips/${tripId}/items/${itemId}`)),
  moveItem: (tripId, itemId, body) => unwrap(client.post(`/api/trips/${tripId}/items/${itemId}/move`, body)),
  toggleLock: (tripId, itemId) => unwrap(client.post(`/api/trips/${tripId}/items/${itemId}/lock`)),
  reorderDay: (tripId, dayIndex, itemIds) =>
    unwrap(client.put(`/api/trips/${tripId}/days/${dayIndex}/order`, { itemIds })),

  optimizeDay: (tripId, dayIndex) => unwrap(client.post(`/api/trips/${tripId}/days/${dayIndex}/optimize`)),
  optimizeAll: (tripId) => unwrap(client.post(`/api/trips/${tripId}/optimize`)),
  rebalance: (tripId) => unwrap(client.post(`/api/trips/${tripId}/rebalance`)),
};
