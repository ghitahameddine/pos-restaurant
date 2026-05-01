const BILL_REQUESTS_STORAGE_KEY = 'pos2-bill-requests';

function normalizeBillRequest(request) {
  return {
    id: request.id || `BILL-${Date.now()}`,
    table: request.table || '-',
    orderId: request.orderId || 'Commande inconnue',
    clientName: request.clientName || 'Client',
    total: Number(request.total || 0),
    items: Array.isArray(request.items) ? request.items : [],
    status: request.status || 'En attente',
    createdAt: request.createdAt || new Date().toISOString(),
    updatedAt: request.updatedAt || request.createdAt || new Date().toISOString(),
  };
}

export function getBillRequests() {
  const rawRequests = localStorage.getItem(BILL_REQUESTS_STORAGE_KEY);

  if (!rawRequests) {
    return [];
  }

  try {
    const requests = JSON.parse(rawRequests);
    return Array.isArray(requests) ? requests.map(normalizeBillRequest) : [];
  } catch {
    return [];
  }
}

export function saveBillRequests(requests) {
  localStorage.setItem(BILL_REQUESTS_STORAGE_KEY, JSON.stringify(requests));
}

export function addBillRequest(request) {
  const requests = getBillRequests();
  const existingOpenRequest = requests.find(
    (item) =>
      item.status === 'En attente' &&
      (item.orderId === request.orderId ||
        (!request.orderId && String(item.table) === String(request.table))),
  );

  if (existingOpenRequest) {
    return requests;
  }

  const nextRequests = [request, ...requests];
  saveBillRequests(nextRequests);
  return nextRequests;
}

export function updateBillRequest(requestId, changes) {
  const requests = getBillRequests();
  const nextRequests = requests.map((request) =>
    request.id === requestId
      ? { ...request, ...changes, updatedAt: new Date().toISOString() }
      : request,
  );
  saveBillRequests(nextRequests);
  return nextRequests;
}
