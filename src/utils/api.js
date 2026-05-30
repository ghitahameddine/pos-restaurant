function resolveApiBaseUrl() {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  const hostname = window.location.hostname || 'localhost';
  const isLocalDesktop = hostname === 'localhost' || hostname === '127.0.0.1';

  if (isLocalDesktop) {
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    const port = import.meta.env.VITE_API_PORT || '8080';
    return `${protocol}//127.0.0.1:${port}/api`;
  }

  return `${window.location.origin}/api`;
}

const API_BASE_URL = resolveApiBaseUrl();
const API_TIMEOUT_MS = 6000;
const AUTH_TIMEOUT_MS = 6000;
export const ADMIN_REFRESH_TIMEOUT_MS = 4000;
const SERVER_AUTH_STORAGE_KEY = 'pos2-server-auth';
const CLIENT_AUTH_STORAGE_KEY = 'pos2-client-auth';
export const ADMIN_AUTH_STORAGE_KEY = 'pos2-admin-auth';
export const API_HEALTH_URL = `${API_BASE_URL}/health`;

function buildApiAccessError(path, detail = '') {
  const suffix = detail ? ` Detail: ${detail}` : '';
  return `API inaccessible (${path}) sur ${API_BASE_URL}.${suffix} Verifiez que Spring Boot tourne sur le port 8080 et que l'adresse frontend correspond au backend.`;
}

function getStoredClientPhone() {
  const rawAuth = localStorage.getItem(CLIENT_AUTH_STORAGE_KEY);
  if (!rawAuth) return '';

  try {
    return JSON.parse(rawAuth).phone || '';
  } catch {
    return '';
  }
}

function withTimeout(ms = 6000) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), ms);
  return { controller, timeoutId };
}

function getLocalhostFallbackBaseUrl() {
  const hostname = window.location.hostname || 'localhost';
  if (hostname !== 'localhost') {
    return '';
  }

  return `${window.location.origin}/api`;
}

async function fetchJson(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(getStoredClientPhone() ? { 'X-Client-Phone': getStoredClientPhone() } : {}),
      ...(options.headers || {}),
    },
    signal: options.signal,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message || `Erreur API ${response.status}`);
  }

  return response.status === 204 ? null : response.json();
}

async function fetchJsonWithTimeout(baseUrl, path, options = {}) {
  const { controller, timeoutId } = withTimeout(options.timeout || API_TIMEOUT_MS);

  try {
    return await fetchJson(baseUrl, path, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function isNetworkError(error) {
  return error instanceof TypeError || error?.name === 'AbortError';
}

async function requestJson(path, options = {}) {
  const fallbackBaseUrl = getLocalhostFallbackBaseUrl();
  const candidates = [API_BASE_URL];

  if (fallbackBaseUrl && fallbackBaseUrl !== API_BASE_URL) {
    candidates.push(fallbackBaseUrl);
  }

  let lastNetworkError = null;

  for (const baseUrl of candidates) {
    try {
      return await fetchJsonWithTimeout(baseUrl, path, options);
    } catch (error) {
      if (!isNetworkError(error)) {
        throw error;
      }

      lastNetworkError = error;
    }
  }

  const detail =
    lastNetworkError?.name === 'AbortError'
      ? `timeout ${options.timeout || API_TIMEOUT_MS}ms`
      : lastNetworkError?.message || 'connexion refusee';

  throw new Error(buildApiAccessError(path, detail));
}

export function isBackendOrder(order) {
  return Boolean(order?.backendId);
}

export function mapOrderStatusFromApi(status) {
  const labels = {
    PENDING_SERVER_VALIDATION: 'En attente de validation serveur',
    CONFIRMED: 'Confirmee par le serveur',
    IN_KITCHEN: 'Confirmee par le serveur',
    READY: 'Prete / pickup',
    SERVED: 'Servie',
    PAID: 'Payee',
    CANCELLED: 'Annulee par le serveur',
  };

  return labels[status] || status;
}

export function mapOrderStatusToApi(status) {
  const labels = {
    'En attente de validation serveur': 'PENDING_SERVER_VALIDATION',
    'Confirmee par le serveur': 'CONFIRMED',
    'Prete / pickup': 'READY',
    Servie: 'SERVED',
    Payee: 'PAID',
    'Annulee par le serveur': 'CANCELLED',
  };

  return labels[status] || status;
}

export function mapPaymentMethodToApi(method) {
  const labels = {
    Especes: 'CASH',
    Carte: 'CARD',
    Digital: 'DIGITAL',
  };

  return labels[method] || 'CASH';
}

export function mapPaymentMethodFromApi(method) {
  const labels = {
    CASH: 'Especes',
    CARD: 'Carte',
    DIGITAL: 'Digital',
  };

  return labels[method] || 'Especes';
}

function getRewardDisplayName(reward) {
  if (!reward) return 'Recompense';

  const rewardText = `${reward.name || ''} ${reward.description || ''}`.toLowerCase();

  if (rewardText.includes('orange')) {
    return 'Jus Orange Frais';
  }

  if (rewardText.includes('dessert')) {
    return 'Tiramisu';
  }

  return reward.name || 'Recompense';
}

export function mapOrderFromApi(order) {
  const items = (order.items || []).map((item) => ({
    id: item.menuItemId,
    backendLineId: item.id,
    name: item.itemName,
    price: item.cancelled ? 0 : Number(item.unitPrice || 0),
    originalPrice: Number(item.unitPrice || 0),
    quantity: Number(item.quantity || 0),
    points: Number(item.points || 0),
    cancelled: Boolean(item.cancelled),
    cancellationReason: item.cancellationReason || '',
  }));

  const reward = order.reward
    ? {
        id: order.reward.id,
        name: getRewardDisplayName(order.reward),
        description: order.reward.description,
        pointsCost: Number(order.reward.pointsCost || 0),
        type: order.reward.type,
        discountPercent: order.reward.discountPercent ? Number(order.reward.discountPercent) : null,
      }
    : null;

  if (reward?.type === 'FREE_ITEM') {
    items.push({
      id: `reward-${reward.id}`,
      backendLineId: null,
      name: reward.name,
      price: 0,
      quantity: 1,
      points: 0,
      isRewardItem: true,
      rewardLabel: 'Gratuit',
    });
  }

  const subtotal = Number(order.subtotal || order.total || 0);
  const total = Number(order.total || 0);
  const discountAmount =
    reward?.type === 'DISCOUNT' ? Math.max(0, Math.round((subtotal - total) * 100) / 100) : 0;

  return {
    id: order.orderNumber || `ORD-${order.id}`,
    backendId: order.id,
    table: String(order.tableNumber),
    clientName: order.clientPhone || 'Client',
    clientPhone: order.clientPhone || '',
    accessMode: order.source === 'SERVER_ASSISTED' ? 'server-assisted' : 'direct',
    comment: order.comment || '',
    serverComment: order.serverComment || '',
    subtotal,
    total,
    discountAmount,
    points: Number(order.points || 0),
    paymentMethod: mapPaymentMethodFromApi(order.paymentMethod),
    reward,
    rewardNote: order.rewardNote || '',
    readySince:
      String(order.status || '').toUpperCase() === 'READY'
        ? order.updatedAt || order.createdAt || null
        : null,
    items,
    status: mapOrderStatusFromApi(order.status),
    sourceLabel: order.source === 'SERVER_ASSISTED' ? 'Serveur' : 'Commande directe QR',
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

export async function fetchApiSlots(zone = '', options = {}) {
  const query = zone ? `?zone=${encodeURIComponent(zone)}` : '';
  return requestJson(`/slots${query}`, options);
}

export async function createApiSlot(slot) {
  return requestJson('/slots', {
    method: 'POST',
    body: JSON.stringify(slot),
  });
}

export async function updateApiSlot(id, slot) {
  return requestJson(`/slots/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(slot),
  });
}

export async function forceFreeApiSlot(id) {
  return requestJson(`/slots/${id}/force-free`, {
    method: 'PATCH',
  });
}

export async function deleteApiSlot(id) {
  return requestJson(`/slots/${id}`, {
    method: 'DELETE',
  });
}

export async function fetchApiTables() {
  return requestJson('/tables');
}

export async function fetchAdminTablesApi(options = {}) {
  return requestJson('/tables/admin', options);
}

export async function createApiTable(table) {
  return requestJson('/tables', {
    method: 'POST',
    body: JSON.stringify(table),
  });
}

export async function updateApiTable(id, table) {
  return requestJson(`/tables/admin/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(table),
  });
}

export async function deleteApiTable(id) {
  return requestJson(`/tables/admin/${id}`, {
    method: 'DELETE',
  });
}

export async function deleteApiTablePermanent(id) {
  return requestJson(`/tables/admin/${id}/permanent`, {
    method: 'DELETE',
  });
}

export async function releaseApiTable(tableNumber) {
  return requestJson(`/tables/${Number(tableNumber)}/release`, {
    method: 'PATCH',
  });
}

export async function markApiTableAvailable(tableNumber) {
  return requestJson(`/tables/${Number(tableNumber)}/mark-available`, {
    method: 'PATCH',
  });
}

export async function forceApiTableAvailable(tableNumber) {
  return requestJson(`/tables/${Number(tableNumber)}/force-available`, {
    method: 'PATCH',
  });
}

export function mapBillRequestFromApi(request) {
  const order = request.order ? mapOrderFromApi(request.order) : null;

  return {
    id: request.requestNumber || `BILL-${request.id}`,
    backendId: request.id,
    table: String(request.tableNumber),
    orderId: order?.id || request.orderNumber || `ORD-${request.orderId}`,
    backendOrderId: request.orderId,
    order,
    clientName: order?.clientName || 'Client',
    subtotal: Number(order?.subtotal || request.total || 0),
    total: Number(request.total || 0),
    reward: order?.reward || null,
    rewardNote: order?.rewardNote || '',
    discountAmount: Number(order?.discountAmount || 0),
    items: order?.items || [],
    status: request.status === 'PRINTED' ? 'Ticket imprime' : 'En attente',
    createdAt: request.createdAt,
    updatedAt: request.printedAt || request.createdAt,
  };
}

export async function fetchApiOrders(options = {}) {
  const orders = await requestJson('/orders', options);
  return orders.map(mapOrderFromApi);
}

export async function createApiOrder(order) {
  const isServerAssisted = order.accessMode === 'server-assisted';
  const payload = {
    tableNumber: Number(order.table),
    clientPhone: isServerAssisted ? '' : order.clientPhone || getStoredClientPhone(),
    source: isServerAssisted ? 'SERVER_ASSISTED' : 'CLIENT_QR',
    comment: order.comment || '',
    items: order.items.map((item) => ({
      menuItemId: Number(item.id),
      quantity: Number(item.quantity),
    })),
  };

  return mapOrderFromApi(await requestJson('/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  }));
}

export async function updateApiOrderStatus(order, status, serverComment = '') {
  const backendId = order.backendId || order.id;
  const payload = {
    status: mapOrderStatusToApi(status),
    serverComment,
  };

  return mapOrderFromApi(await requestJson(`/orders/${backendId}/status`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }));
}

export async function clientUpdateApiOrder(order, qrToken) {
  const backendId = order.backendId || order.id;
  const payload = {
    qrToken,
    comment: order.comment || '',
    items: order.items.map((item) => ({
      menuItemId: Number(item.id),
      quantity: Number(item.quantity),
    })),
  };

  return mapOrderFromApi(await requestJson(`/orders/${backendId}/client-update`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }));
}

export async function clientCancelApiOrder(order, qrToken) {
  const backendId = order.backendId || order.id;

  return mapOrderFromApi(await requestJson(`/orders/${backendId}/client-cancel`, {
    method: 'PATCH',
    body: JSON.stringify({ qrToken }),
  }));
}

export async function fetchApiBillRequests() {
  const requests = await requestJson('/bill-requests');
  return requests.map(mapBillRequestFromApi);
}

export async function createApiBillRequest(order) {
  if (!order?.backendId) {
    throw new Error('Commande non synchronisee avec le backend.');
  }

  return mapBillRequestFromApi(await requestJson('/bill-requests', {
    method: 'POST',
    body: JSON.stringify({ orderId: order.backendId }),
  }));
}

export async function printApiBillRequest(request, paymentMethod = 'Especes') {
  if (!request?.backendId) {
    throw new Error('Addition non synchronisee avec le backend.');
  }

  return mapBillRequestFromApi(await requestJson(`/bill-requests/${request.backendId}/print`, {
    method: 'POST',
    body: JSON.stringify({ paymentMethod: mapPaymentMethodToApi(paymentMethod) }),
  }));
}

export async function registerClientApi({ phone, otp, password, name }) {
  return requestJson('/auth/register', {
    method: 'POST',
    timeout: AUTH_TIMEOUT_MS,
    body: JSON.stringify({ phone, otp, password, name }),
  });
}

export async function loginApi({ phone, password }) {
  return requestJson('/auth/login', {
    method: 'POST',
    timeout: AUTH_TIMEOUT_MS,
    body: JSON.stringify({ phone, password }),
  });
}

export async function checkApiHealth(timeout = AUTH_TIMEOUT_MS) {
  return requestJson('/health', { timeout });
}

export async function fetchAdminDashboardApi(options = {}) {
  return requestJson('/admin/dashboard', options);
}

export async function fetchRestaurantStateApi(options = {}) {
  return requestJson('/admin/restaurant-state', options);
}

export async function updateRestaurantStateApi(state) {
  return requestJson('/admin/restaurant-state', {
    method: 'PATCH',
    body: JSON.stringify(state),
  });
}

export async function fetchAdminStaffApi(options = {}) {
  return requestJson('/admin/staff', options);
}

export async function fetchAdminUsersApi(options = {}) {
  return requestJson('/admin/users', options);
}

export async function createAdminStaffApi(staff) {
  return requestJson('/admin/staff', {
    method: 'POST',
    body: JSON.stringify(staff),
  });
}

export async function updateAdminStaffApi(id, staff) {
  return requestJson(`/admin/staff/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(staff),
  });
}

export async function deleteAdminStaffApi(id) {
  return requestJson(`/admin/staff/${id}`, {
    method: 'DELETE',
  });
}

export async function deleteAdminStaffPermanentApi(id) {
  return requestJson(`/admin/staff/${id}/permanent`, {
    method: 'DELETE',
  });
}

export async function deactivateAdminUserApi(id) {
  return requestJson(`/admin/users/${id}/deactivate`, {
    method: 'PATCH',
  });
}

export async function deleteAdminUserPermanentApi(id) {
  return requestJson(`/admin/users/${id}/permanent`, {
    method: 'DELETE',
  });
}

export async function cancelAdminOrderApi(id) {
  return mapOrderFromApi(await requestJson(`/admin/orders/${id}/cancel`, {
    method: 'PATCH',
  }));
}

export async function reopenAdminPaymentApi(id) {
  return mapOrderFromApi(await requestJson(`/admin/orders/${id}/reopen-payment`, {
    method: 'PATCH',
  }));
}

export async function fetchAdminMenuApi(options = {}) {
  return requestJson('/menu/admin', options);
}

export async function fetchMenuCatalogApi() {
  return requestJson('/menu/catalog');
}

export async function createAdminMenuItemApi(item) {
  return requestJson('/menu', {
    method: 'POST',
    body: JSON.stringify(item),
  });
}

export async function updateAdminMenuItemApi(id, item) {
  return requestJson(`/menu/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(item),
  });
}

export async function setMenuItemAvailabilityApi(id, available, unavailableReason = '') {
  return requestJson(`/menu/${id}/availability`, {
    method: 'PATCH',
    body: JSON.stringify({ available, unavailableReason }),
  });
}

export async function deleteAdminMenuItemApi(id) {
  return requestJson(`/menu/${id}`, {
    method: 'DELETE',
  });
}

export async function deleteAdminMenuItemPermanentApi(id) {
  return requestJson(`/menu/${id}/permanent`, {
    method: 'DELETE',
  });
}

export async function forgotPasswordApi({ phone }) {
  return requestJson('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
}

export async function resetPasswordApi({ phone, otp, newPassword }) {
  return requestJson('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ phone, otp, newPassword }),
  });
}

export async function fetchRewardsApi() {
  return requestJson('/rewards');
}

export async function fetchAdminRewardsApi(options = {}) {
  return requestJson('/rewards/admin', options);
}

export async function createAdminRewardApi(reward) {
  return requestJson('/rewards', {
    method: 'POST',
    body: JSON.stringify(reward),
  });
}

export async function updateAdminRewardApi(id, reward) {
  return requestJson(`/rewards/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(reward),
  });
}

export async function deleteAdminRewardApi(id) {
  return requestJson(`/rewards/${id}`, {
    method: 'DELETE',
  });
}

export async function fetchMyLoyaltyApi() {
  return requestJson('/loyalty/me');
}

export async function redeemRewardApi(rewardId) {
  const response = await requestJson(`/rewards/${rewardId}/redeem`, {
    method: 'POST',
  });

  return {
    ...response,
    order: response.order ? mapOrderFromApi(response.order) : null,
  };
}

export async function fetchApiKitchenStation(station) {
  return requestJson(`/kitchen/stations/${station}`);
}

export async function fetchApiKitchenManager() {
  return requestJson('/kitchen/manager');
}

export async function startApiKitchenStationOrder(station, orderId) {
  return requestJson(`/kitchen/stations/${station}/orders/${orderId}/start`, {
    method: 'PATCH',
  });
}

export async function readyApiKitchenStationOrder(station, orderId) {
  return requestJson(`/kitchen/stations/${station}/orders/${orderId}/ready`, {
    method: 'PATCH',
  });
}

export async function cancelApiKitchenStationItem(station, orderId, itemId, reason) {
  return requestJson(`/kitchen/stations/${station}/orders/${orderId}/items/${itemId}/cancel`, {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  });
}

export async function completeApiKitchenOrder(orderId) {
  return mapOrderFromApi(await requestJson(`/kitchen/orders/${orderId}/complete`, {
    method: 'POST',
  }));
}

export async function cancelApiKitchenOrder(orderId, reason) {
  return mapOrderFromApi(await requestJson(`/kitchen/orders/${orderId}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  }));
}

export function subscribeRealtime({ onOrder, onBillRequest, onTable, onMenu, onError } = {}) {
  const realtimeEnabled = import.meta.env.VITE_ENABLE_SSE !== 'false';

  if (!realtimeEnabled) {
    return () => {};
  }

  let eventSource = null;
  let closed = false;
  let reconnectTimeoutId = null;
  let reconnectDelay = 1000;

  const safelyReadEvent = (event, mapper, callback) => {
    try {
      const data = JSON.parse(event.data);
      callback?.(mapper(data.payload));
    } catch (error) {
      onError?.(error);
    }
  };

  const connect = () => {
    if (closed) return;

    eventSource = new EventSource(`${API_BASE_URL}/realtime`);

    eventSource.onopen = () => {
      reconnectDelay = 1000;
    };

    eventSource.addEventListener('ORDER_UPDATED', (event) => {
      safelyReadEvent(event, mapOrderFromApi, onOrder);
    });

    eventSource.addEventListener('BILL_REQUEST_UPDATED', (event) => {
      safelyReadEvent(event, mapBillRequestFromApi, onBillRequest);
    });

    eventSource.addEventListener('TABLE_UPDATED', (event) => {
      safelyReadEvent(event, (payload) => payload, onTable);
    });

    eventSource.addEventListener('MENU_UPDATED', (event) => {
      safelyReadEvent(event, (payload) => payload, onMenu);
    });

    eventSource.addEventListener('PING', () => {});

    eventSource.onerror = (event) => {
      onError?.(event);
      eventSource.close();

      if (closed) return;

      window.clearTimeout(reconnectTimeoutId);
      reconnectTimeoutId = window.setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, 30000);
    };
  };

  connect();

  return () => {
    closed = true;
    window.clearTimeout(reconnectTimeoutId);
    eventSource?.close();
  };
}
