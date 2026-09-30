import { http } from "./client";

export { API_BASE, ApiError, tokenStore, setUnauthorizedHandler } from "./client";

// POST /auth/register|login → { user, token }; GET /auth/me → { user }; POST /auth/logout → { loggedOut: true }
export const authApi = {
  register: (data) => http.post("/auth/register", data),
  login: (data) => http.post("/auth/login", data),
  me: () => http.get("/auth/me"),
  logout: () => http.post("/auth/logout"),
};

// GET/PATCH /users/profile → { user }
export const usersApi = {
  profile: () => http.get("/users/profile"),
  update: (data) => http.patch("/users/profile", data),
};

// GET /farmers/:id → { farmer, products } ; GET /farmers → [ shops ]
export const farmersApi = {
  get: (id) => http.get(`/farmers/${id}`),
  shops: (params, signal) => http.get("/farmers", params, { signal }),
};

// GET /marketplace → { items, pagination }
export const marketplaceApi = { search: (params, signal) => http.get("/marketplace", params, { signal }) };

// Products: farmer owned CRUD
export const productsApi = {
  get: (id) => http.get(`/products/${id}`),
  mine: () => http.get("/products/farmer/my-products"),
  create: (data) => http.post("/products", data),
  update: (id, data) => http.patch(`/products/${id}`, data),
  remove: (id) => http.delete(`/products/${id}`),
};

// Inventory ledger operations → { product } / { history }
export const inventoryApi = {
  addHarvest: (data) => http.post("/inventory/add-harvest", data),
  offPlatformSale: (data) => http.post("/inventory/off-platform-sale", data),
  history: (productId) => http.get(`/inventory/history/${productId}`),
};

// Requests → { request } / { items, pagination }
export const requestsApi = {
  list: (params) => http.get("/requests", params),
  create: (data) => http.post("/requests", data),
  accept: (id) => http.patch(`/requests/${id}/accept`),
  reject: (id, reason) => http.patch(`/requests/${id}/reject`, { reason }),
  cancel: (id, reason) => http.patch(`/requests/${id}/cancel`, { reason }),
};

// Orders → { order } / { items, pagination }
export const ordersApi = {
  list: (params) => http.get("/orders", params),
  get: (id) => http.get(`/orders/${id}`),
  confirmQuantity: (requestId, data) => http.post(`/orders/confirm-quantity/${requestId}`, data),
  updateStatus: (id, status) => http.patch(`/orders/${id}/status`, { status }),
  complete: (id, fulfilledQuantity) => http.patch(`/orders/${id}/complete`, fulfilledQuantity !== undefined ? { fulfilledQuantity } : {}),
  noShow: (id) => http.patch(`/orders/${id}/no-show`),
  cancelByBuyer: (id, reason) => http.patch(`/orders/${id}/cancel-by-buyer`, { reason }),
  cancelByFarmer: (id, reason) => http.patch(`/orders/${id}/cancel-by-farmer`, { reason }),
};

// Notifications → { items, pagination }
export const notificationsApi = {
  list: (params) => http.get("/notifications", params),
  markRead: (id) => http.patch(`/notifications/${id}/read`),
  markAllRead: () => http.patch("/notifications/read-all"),
};

// Demand intelligence
export const demandApi = {
  signals: (params) => http.get("/demand/signals", params),
  matchSupply: (params) => http.get("/demand/match-supply", params),
  sellMyHarvest: (params) => http.get("/demand/sell-my-harvest", params),
  decisionSupport: (params) => http.get("/demand/decision-support", params),
};

// Byproducts → { items, pagination } / { byproduct } / { byproducts }
export const byproductsApi = {
  search: (params) => http.get("/byproducts", params),
  mine: () => http.get("/byproducts/my-byproducts"),
  create: (data) => http.post("/byproducts", data),
  remove: (id) => http.delete(`/byproducts/${id}`),
};

// Admin (ROLE_ADMIN only)
export const adminApi = {
  overview: () => http.get("/admin/overview"),
  users: (params) => http.get("/admin/users", params),
  verify: (id, isVerified) => http.patch(`/admin/users/${id}/verify`, { isVerified }),
  auditLogs: (params) => http.get("/admin/audit-logs", params),
};

// Uzhavan AI — always through the backend, never Gemini directly
export const uzhavanApi = {
  status: () => http.get("/uzhavan"),
  message: (data) => http.post("/uzhavan/message", data),
  tool: (data) => http.post("/uzhavan/tool", data),
  conversations: () => http.get("/uzhavan/conversations"),
  conversation: (id) => http.get(`/uzhavan/conversations/${id}`),
  auditLog: () => http.get("/uzhavan/audit-log"),
  ttsAudioUrl: async ({ text, language, voice, gender }) => {
    const url = `${API_BASE}/uzhavan/tts`;
    const token = tokenStore.get();
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ text, language, voice, gender })
    });
    if (!res.ok) throw new Error("TTS synthesis failed");
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },
};
