/**
 * 前端唯一和后端说话的地方。用原生 fetch，不依赖 axios。
 *
 * 和 staybooking / twitch 的 utils.js 是同一种写法：顶部一个固定的域名常量，下面每个接口一个
 * 具名导出的函数。唯一的不同是这里保留了一个共用的 request()，因为登录态、错误结构、空响应体
 * 这三件事在 18 个接口里各写一遍，改一次就要改 18 处，而且必然有人漏掉。
 */

// 后端地址。留空表示走 CRA 的 proxy（package.json 里配的 http://localhost:8080）；
// 部署到线上时用 REACT_APP_API_DOMAIN 指向后端的公网地址。
const domain = process.env.REACT_APP_API_DOMAIN || '';

const TOKEN_KEY = 'tp_token';
const USER_KEY = 'tp_user';

/* ------------------------------------------------------------------ 登录态 */

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

/**
 * 开发用的是内存数据库，后端一重启账号就没了，而浏览器还留着一个签名完好、但对应用户已不存在的
 * token。没有这个回调的话，页面会永远停在转圈上。
 */
let onUnauthorized = () => {};

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

/* ------------------------------------------------------------------ 错误 */

/**
 * fetch 只在断网这类情况下 reject，HTTP 4xx/5xx 它一律当成功。所以每个响应都要自己判
 * response.ok，不合格就抛出这个错误，让调用方的 catch 能接住 —— axios 原本替我们做的就是这件事。
 */
class ApiError extends Error {
  constructor(status, body) {
    super(body?.message || `HTTP ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body || {};
  }
}

/** 把失败统一成「语义码 + 参数」，字典里没有这个码时退回后端给的英文原文。 */
export function errorNotice(error) {
  const body = error instanceof ApiError ? error.body : {};
  return {
    code: body.code || 'error.generic',
    params: body.params || {},
    message: body.message || error?.message,
  };
}

/* ------------------------------------------------------------------ 会话失效判定 */

const isRejected = (status) => status === 401 || status === 403;

/**
 * 后端对所有鉴权失败都回 403：没带 token、token 损坏、token 有效但用户已不存在，三者无法区分。
 * 但普通的并发竞态也会回 403（连点两次删除，第二次必然失败），为这个把用户踢回登录页太粗暴。
 *
 * 所以先探测一次会话是否真的失效。同时只探测一次：一批注定失败的请求不该变成一批探测请求。
 */
let runningProbe = null;

function sessionIsGone() {
  if (!runningProbe) {
    runningProbe = request('/api/trips', { isProbe: true })
      .then(() => false)
      .catch((error) => isRejected(error.status))
      .finally(() => {
        runningProbe = null;
      });
  }
  return runningProbe;
}

/* ------------------------------------------------------------------ 请求核心 */

/** { keyword: 'a', category: '' } → '?keyword=a&category=' */
function queryString(params) {
  if (!params) return '';
  const search = new URLSearchParams(params).toString();
  return search ? `?${search}` : '';
}

/**
 * 读取响应体。DELETE /api/trips/{id} 返回的是 200 + 空 body，此时 response.json() 会抛
 * 「Unexpected end of JSON input」—— axios 原本替我们挡掉了这个坑。
 */
async function readBody(response) {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * 所有请求的必经之路，等价于 axios 实例 + 请求拦截器 + 响应拦截器：
 *   1. 拼上域名和查询串
 *   2. 自动附带 Bearer token
 *   3. 自动序列化 JSON body
 *   4. 判 response.ok，失败抛 ApiError
 *   5. 会话真的失效时清 session 并回登录页
 */
async function request(path, { method = 'GET', body, params, isProbe = false } = {}) {
  const headers = {};
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${domain}${path}${queryString(params)}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.ok) {
    return readBody(response);
  }

  const payload = await readBody(response);
  const isAuthCall = path.startsWith('/auth/');
  if (isRejected(response.status) && !isAuthCall && !isProbe && (await sessionIsGone())) {
    session.clear();
    onUnauthorized();
  }
  throw new ApiError(response.status, payload);
}

/* ------------------------------------------------------------------ 账号 */

export const login = (credential) => request('/auth/login', { method: 'POST', body: credential });

export const register = (credential) => request('/auth/register', { method: 'POST', body: credential });

/* ------------------------------------------------------------------ 目录（公开，无需登录） */

export const getCities = () => request('/api/cities');

export const getCategories = (cityId) => request(`/api/cities/${cityId}/categories`);

export const searchPois = (cityId, { keyword = '', category = '' } = {}) =>
  request(`/api/cities/${cityId}/pois`, { params: { keyword, category, limit: 120 } });

/* ------------------------------------------------------------------ 行程 */

export const getTrips = () => request('/api/trips');

export const getTrip = (tripId) => request(`/api/trips/${tripId}`);

export const createTrip = (body) => request('/api/trips', { method: 'POST', body });

export const updateTrip = (tripId, body) => request(`/api/trips/${tripId}`, { method: 'PATCH', body });

export const deleteTrip = (tripId) => request(`/api/trips/${tripId}`, { method: 'DELETE' });

/* ------------------------------------------------------------------ 行程里的站点 */

export const addItem = (tripId, body) => request(`/api/trips/${tripId}/items`, { method: 'POST', body });

export const removeItem = (tripId, itemId) =>
  request(`/api/trips/${tripId}/items/${itemId}`, { method: 'DELETE' });

export const moveItem = (tripId, itemId, body) =>
  request(`/api/trips/${tripId}/items/${itemId}/move`, { method: 'POST', body });

export const toggleLock = (tripId, itemId) =>
  request(`/api/trips/${tripId}/items/${itemId}/lock`, { method: 'POST' });

export const reorderDay = (tripId, dayIndex, itemIds) =>
  request(`/api/trips/${tripId}/days/${dayIndex}/order`, { method: 'PUT', body: { itemIds } });

/* ------------------------------------------------------------------ 规划 */

export const optimizeDay = (tripId, dayIndex) =>
  request(`/api/trips/${tripId}/days/${dayIndex}/optimize`, { method: 'POST' });

export const optimizeAll = (tripId) => request(`/api/trips/${tripId}/optimize`, { method: 'POST' });

export const rebalance = (tripId) => request(`/api/trips/${tripId}/rebalance`, { method: 'POST' });
