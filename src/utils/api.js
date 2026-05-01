const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';
const SERVER_AUTH_STORAGE_KEY = 'pos2-server-auth';
const CLIENT_AUTH_STORAGE_KEY = 'pos2-client-auth';

function getStoredAuthToken() {
  const rawAuth =
    sessionStorage.getItem(SERVER_AUTH_STORAGE_KEY) || localStorage.getItem(CLIENT_AUTH_STORAGE_KEY);

  if (!rawAuth) return '';

  try {
    return JSON.parse(rawAuth).token || '';
  } catch {
    return '';
  }
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

function withTimeout(ms = 2000) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), ms);
  return { controller, timeoutId };
}

async function requestJson(path, options = {}) {
  const { controller, timeoutId } = withTimeout(options.timeout || 2500);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(getStoredAuthToken() ? { Authorization: `Bearer ${getStoredAuthToken()}` } : {}),
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.message || `Erreur API ${response.status}`);
    }

    return response.status === 204 ? null : response.json();
  } finally {
    window.clearTimeout(timeoutId);
  }
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

export function mapOrderFromApi(order) {
  const items = (order.items || []).map((item) => ({
    id: item.menuItemId,
    backendLineId: item.id,
    name: item.itemName,
    price: Number(item.unitPrice || 0),
    quantity: Number(item.quantity || 0),
    points: Number(item.points || 0),
  }));

  return {
    id: order.orderNumber || `ORD-${order.id}`,
    backendId: order.id,
    table: String(order.tableNumber),
    clientName: order.clientPhone || 'Client',
    clientPhone: order.clientPhone || '',
    accessMode: order.source === 'SERVER_ASSISTED' ? 'server-assisted' : 'direct',
    comment: order.comment || '',
    serverComment: order.serverComment || '',
    total: Number(order.total || 0),
    points: Number(order.points || 0),
    items,
    status: mapOrderStatusFromApi(order.status),
    sourceLabel: order.source === 'SERVER_ASSISTED' ? 'Serveur' : 'Commande directe QR',
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
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
    total: Number(request.total || 0),
    items: order?.items || [],
    status: request.status === 'PRINTED' ? 'Ticket imprime' : 'En attente',
    createdAt: request.createdAt,
    updatedAt: request.printedAt || request.createdAt,
  };
}

export async function fetchApiOrders() {
  const orders = await requestJson('/orders');
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
    body: JSON.stringify({ phone, otp, password, name }),
  });
}

export async function loginApi({ phone, password }) {
  return requestJson('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ phone, password }),
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

export function subscribeRealtime({ onOrder, onBillRequest, onTable, onError } = {}) {
  const eventSource = new EventSource(`${API_BASE_URL}/realtime`);

  eventSource.addEventListener('ORDER_UPDATED', (event) => {
    const data = JSON.parse(event.data);
    onOrder?.(mapOrderFromApi(data.payload));
  });

  eventSource.addEventListener('BILL_REQUEST_UPDATED', (event) => {
    const data = JSON.parse(event.data);
    onBillRequest?.(mapBillRequestFromApi(data.payload));
  });

  eventSource.addEventListener('TABLE_UPDATED', (event) => {
    const data = JSON.parse(event.data);
    onTable?.(data.payload);
  });

  eventSource.onerror = (event) => {
    onError?.(event);
  };

  return () => eventSource.close();
}
