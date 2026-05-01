const QR_SESSION_PREFIX = 'pos2-qr-session-table-';
const GUEST_SESSION_DURATION_MS = 90 * 60 * 1000;

function getSessionKey(table) {
  return `${QR_SESSION_PREFIX}${table}`;
}

function createToken() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createQrSession({ table, accessMode = 'scan', orderId = null }) {
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.parse(createdAt) + GUEST_SESSION_DURATION_MS).toISOString();
  const session = {
    table,
    token: createToken(),
    accessMode,
    orderIds: orderId ? [orderId] : [],
    billRequested: false,
    createdAt,
    expiresAt,
  };

  localStorage.setItem(getSessionKey(table), JSON.stringify(session));
  return session;
}

export function getQrSession(table) {
  const rawSession = localStorage.getItem(getSessionKey(table));

  if (!rawSession) {
    return null;
  }

  try {
    return JSON.parse(rawSession);
  } catch {
    return null;
  }
}

export function isGuestSessionExpired(session) {
  if (!session) {
    return false;
  }

  return session.billRequested || Date.parse(session.expiresAt) <= Date.now();
}

export function addOrderToQrSession({ table, accessMode, orderId }) {
  const currentSession = getQrSession(table);

  if (!currentSession || isGuestSessionExpired(currentSession)) {
    return createQrSession({ table, accessMode, orderId });
  }

  const nextSession = {
    ...currentSession,
    accessMode,
    orderIds: currentSession.orderIds.includes(orderId)
      ? currentSession.orderIds
      : [orderId, ...currentSession.orderIds],
  };

  localStorage.setItem(getSessionKey(table), JSON.stringify(nextSession));
  return nextSession;
}

export function markQrSessionBillRequested(table) {
  const currentSession = getQrSession(table);

  if (!currentSession) {
    return null;
  }

  const nextSession = {
    ...currentSession,
    billRequested: true,
    updatedAt: new Date().toISOString(),
  };

  localStorage.setItem(getSessionKey(table), JSON.stringify(nextSession));
  return nextSession;
}
