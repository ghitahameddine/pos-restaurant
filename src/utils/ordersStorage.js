const ORDERS_STORAGE_KEY = 'pos2-orders';

export function getStoredOrders() {
  const rawOrders = localStorage.getItem(ORDERS_STORAGE_KEY);

  if (!rawOrders) {
    return [];
  }

  try {
    return JSON.parse(rawOrders);
  } catch {
    return [];
  }
}

function getOrderKey(order) {
  return order?.backendId ? `backend-${order.backendId}` : `local-${order?.id}`;
}

export function dedupeOrders(orders) {
  const orderMap = new Map();

  orders.forEach((order) => {
    if (!order?.id) return;
    orderMap.set(getOrderKey(order), order);
  });

  return Array.from(orderMap.values());
}

export function saveStoredOrders(orders) {
  localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(dedupeOrders(orders)));
}

export function addStoredOrder(order) {
  const orders = getStoredOrders();
  const nextOrders = dedupeOrders([
    order,
    ...orders.filter(
      (currentOrder) =>
        currentOrder.id !== order.id &&
        (!order.backendId || currentOrder.backendId !== order.backendId),
    ),
  ]);
  saveStoredOrders(nextOrders);
  return nextOrders;
}

export function findStoredOrder(orderId) {
  return getStoredOrders().find((order) => order.id === orderId) || null;
}

export function updateStoredOrder(orderId, changes) {
  const orders = getStoredOrders();
  const nextOrders = orders.map((order) =>
    order.id === orderId ? { ...order, ...changes, updatedAt: new Date().toISOString() } : order,
  );
  saveStoredOrders(nextOrders);
  return nextOrders;
}
