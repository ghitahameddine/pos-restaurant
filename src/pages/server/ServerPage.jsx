import { useEffect, useMemo, useState } from 'react';
import { menuProducts } from '../../data/menuProducts';
import { formatPrice } from '../../utils/format';
import {
  addStoredOrder,
  dedupeOrders,
  getStoredOrders,
  saveStoredOrders,
  updateStoredOrder,
} from '../../utils/ordersStorage';
import {
  getBillRequests,
  saveBillRequests,
  updateBillRequest,
} from '../../utils/billRequestsStorage';
import { markQrSessionBillRequested } from '../../utils/qrSessionStorage';
import {
  createApiBillRequest,
  createApiOrder,
  fetchApiBillRequests,
  fetchMenuCatalogApi,
  fetchApiOrders,
  fetchApiSlots,
  fetchApiTables,
  forgotPasswordApi,
  isBackendOrder,
  loginApi,
  markApiTableAvailable,
  printApiBillRequest,
  releaseApiTable,
  resetPasswordApi,
  subscribeRealtime,
  updateApiOrderStatus,
} from '../../utils/api';

const SERVER_AUTH_KEY = 'pos2-server-authenticated';
const SERVER_AUTH_STORAGE_KEY = 'pos2-server-auth';

function normalizeCatalogText(value) {
  return String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function getCatalogFallback(item) {
  const itemId = Number(item.id);
  const itemName = normalizeCatalogText(item.name);
  const itemCategory = normalizeCatalogText(item.category);
  const itemStation = normalizeCatalogText(item.station);

  return (
    menuProducts.find((product) => Number(product.id) === itemId) ||
    menuProducts.find((product) => normalizeCatalogText(product.name) === itemName) ||
    menuProducts.find((product) => {
      const productName = normalizeCatalogText(product.name);
      return itemName && (itemName.includes(productName) || productName.includes(itemName));
    }) ||
    menuProducts.find((product) => normalizeCatalogText(product.category) === itemCategory) ||
    menuProducts.find((product) => normalizeCatalogText(product.station) === itemStation) ||
    menuProducts[0] ||
    {}
  );
}

function getCatalogImage(item, fallback) {
  const backendImage = String(item.imageUrl || item.image || '').trim();
  return backendImage || fallback.image || menuProducts[0]?.image || '';
}

function mapCatalogProduct(item) {
  const fallback = getCatalogFallback(item);
  return {
    ...fallback,
    id: item.id,
    name: item.name || fallback.name,
    category: item.category || fallback.category,
    price: Number(item.price || fallback.price || 0),
    points: Number(item.points || fallback.points || 0),
    station: item.station || fallback.station,
    description: item.description || fallback.description || '',
    details: item.details || fallback.details || '',
    image: getCatalogImage(item, fallback),
    prepTime: fallback.prepTime || '10 min',
    badge: item.available === false ? 'Indisponible' : fallback.badge || 'Maison',
    available: item.available !== false,
    stockQuantity: item.stockQuantity ?? null,
    unavailableReason: item.unavailableReason || '',
  };
}

function getStoredServerAuth() {
  const rawAuth = sessionStorage.getItem(SERVER_AUTH_STORAGE_KEY);
  if (!rawAuth) return null;

  try {
    return JSON.parse(rawAuth);
  } catch {
    return null;
  }
}

function parseAssignedTables(assignedTables) {
  if (!assignedTables) return [];
  return String(assignedTables)
    .split(',')
    .map((tableNumber) => tableNumber.trim())
    .filter(Boolean);
}

function formatTicketDate(dateValue) {
  const date = dateValue ? new Date(dateValue) : new Date();

  return new Intl.DateTimeFormat('fr-MA', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function getOrderActivityDate(order) {
  return order?.updatedAt || order?.createdAt || '';
}

function isSameLocalDay(dateValue, referenceDate = new Date()) {
  if (!dateValue) return false;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;

  return (
    date.getFullYear() === referenceDate.getFullYear() &&
    date.getMonth() === referenceDate.getMonth() &&
    date.getDate() === referenceDate.getDate()
  );
}

function createEmptyServerOrder() {
  return {
    table: '',
    clientName: 'Client accompagne',
    comment: '',
    items: [],
  };
}

function getStatusLabel(status) {
  const labels = {
    'En attente de validation serveur': 'A valider',
    'Confirmee par le serveur': 'Confirmee',
    'Prete / pickup': 'Prete / pickup',
    Servie: 'Servie',
    Payee: 'Payee',
    'Annulee par le serveur': 'Annulee',
  };

  return labels[status] || status;
}

function getOrderSubtotal(order) {
  return Number(order?.subtotal || order?.total || 0);
}

function getOrderDiscountAmount(order) {
  if (!order?.reward || order.reward.type !== 'DISCOUNT') {
    return 0;
  }

  if (typeof order.discountAmount === 'number') {
    return Number(order.discountAmount || 0);
  }

  return Math.max(0, Math.round((getOrderSubtotal(order) - Number(order.total || 0)) * 100) / 100);
}

function isRewardFreeItem(item) {
  return Boolean(item?.isRewardItem) || (Number(item?.price || 0) === 0 && Number(item?.quantity || 0) > 0);
}

function isKitchenIncidentItem(item) {
  return Boolean(item?.cancelled || item?.cancellationReason);
}

function getKitchenIncidentItems(order) {
  return (order?.items || []).filter(isKitchenIncidentItem);
}

function hasKitchenIncident(order) {
  return getKitchenIncidentItems(order).length > 0;
}

function getKitchenIncidentLabel(order) {
  const count = getKitchenIncidentItems(order).length;
  if (count === 0) return '';
  if (count === 1) return '1 article signale par la cuisine';
  return `${count} articles signales par la cuisine`;
}

function getOrderCancellationReason(order) {
  const serverComment = String(order?.serverComment || '').trim();
  if (serverComment) return serverComment;

  const incidentReason = getKitchenIncidentItems(order).find((item) => item.cancellationReason)?.cancellationReason;
  return incidentReason || '';
}

function isKitchenCancelledOrder(order) {
  return isCancelledOrder(order) && getOrderCancellationReason(order).toLowerCase().includes('cuisine');
}

function isReadyForPickup(order) {
  const status = String(order.status || '').toLowerCase();

  return status.includes('prete') || status.includes('pickup');
}

function isServedOrder(order) {
  const status = String(order?.status || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  return status === 'served' || status === 'servie' || status === 'servi';
}

function isPaidOrder(order) {
  const status = String(order?.status || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  return status === 'paid' || status === 'payee';
}

function isCancelledOrder(order) {
  const status = String(order?.status || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  return status === 'cancelled' || status.includes('annulee') || status.includes('annule');
}

function isPendingValidationOrder(order) {
  const status = String(order?.status || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  return status === 'pending_server_validation' || status.includes('attente de validation');
}

function isConfirmedOrder(order) {
  const status = String(order?.status || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  return status === 'confirmed' || status === 'in_kitchen' || status.includes('confirmee');
}

function isBillableOrder(order) {
  return Boolean(order?.items?.length) && isServedOrder(order) && !isPaidOrder(order);
}

function getOrderStage(order) {
  if (!order) return 'unknown';
  if (isPendingValidationOrder(order)) return 'validate';
  if (isConfirmedOrder(order)) return 'kitchen';
  if (isReadyForPickup(order)) return 'pickup';
  if (isServedOrder(order)) return 'payment';
  if (isPaidOrder(order)) return 'paid';
  if (isCancelledOrder(order)) return 'cancelled';

  return 'unknown';
}

function getPrimaryActionLabel(order) {
  const stage = getOrderStage(order);

  if (stage === 'validate') return 'Confirmer';
  if (stage === 'kitchen') return 'En cuisine';
  if (stage === 'pickup') return 'Servir';
  if (stage === 'payment') return 'Encaisser';
  if (stage === 'paid') return 'Payee';
  if (stage === 'cancelled') return 'Annulee';

  return 'Aucune action';
}

function getSelectedPaymentMethod(paymentMethods, order) {
  if (!order) return '';
  return paymentMethods[order.id] || 'Especes';
}

function getPickupSlotInfo(order, slots) {
  if (!order?.backendId) return null;
  return slots.find((slot) => Number(slot.currentOrderId) === Number(order.backendId)) || null;
}

function normalizeSlotAccent(color) {
  const value = String(color || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(value)) {
    return value;
  }

  const normalized = value.toLowerCase();
  if (normalized.includes('rouge')) return '#bb4639';
  if (normalized.includes('vert')) return '#207f5c';
  if (normalized.includes('bleu')) return '#23545b';
  if (normalized.includes('jaune') || normalized.includes('gold') || normalized.includes('dor')) return '#c76b42';
  return '#5f6f6a';
}

function getReadySinceLabel(dateValue, nowTick) {
  const diffMinutes = getReadySinceMinutes(dateValue, nowTick);

  if (diffMinutes <= 0) return 'Prete maintenant';
  if (diffMinutes < 60) {
    return diffMinutes === 1 ? 'Prete depuis 1 min' : `Prete depuis ${diffMinutes} min`;
  }

  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;

  if (hours < 24) {
    return minutes > 0 ? `Prete depuis ${hours} h ${minutes} min` : `Prete depuis ${hours} h`;
  }

  return 'Prete depuis +24 h';
}

function getReadySinceMinutes(dateValue, nowTick) {
  if (!dateValue) return 0;

  const readyDate = new Date(dateValue);
  if (Number.isNaN(readyDate.getTime())) return 0;

  return Math.max(0, Math.floor((nowTick - readyDate.getTime()) / 60000));
}

function getReadyTone(minutes) {
  if (!Number.isFinite(minutes) || minutes < 4) return 'fresh';
  if (minutes < 8) return 'watch';
  return 'alert';
}

function mapTableStatusToUi(status, hasActiveOrder, hasPaidOrder) {
  const normalized = String(status || '')
    .trim()
    .toUpperCase();

  if (hasActiveOrder) return 'in_service';
  if (normalized === 'PAID_STILL_SEATED') return 'paid_still_seated';
  if (normalized === 'CLEANING') return 'cleaning';
  if (normalized === 'IN_SERVICE' || normalized === 'BILL_REQUESTED') return 'in_service';
  if (normalized === 'AVAILABLE') return 'available';

  // Fallback only for old/local table data without backend status.
  if (hasPaidOrder) return 'paid_still_seated';
  return 'available';
}

function getTableStatusLabel(tableStatus) {
  if (tableStatus === 'available') return 'Libre';
  if (tableStatus === 'in_service') return 'Occupee';
  if (tableStatus === 'paid_still_seated') return 'Payee - client assis';
  if (tableStatus === 'cleaning') return 'A nettoyer';
  return 'Statut inconnu';
}

function ServerPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => sessionStorage.getItem(SERVER_AUTH_KEY) === 'true',
  );
  const [serverAuth, setServerAuth] = useState(() => getStoredServerAuth());
  const [credentials, setCredentials] = useState({ phone: '0600000000', password: '' });
  const [serverAuthMode, setServerAuthMode] = useState('login');
  const [serverOtp, setServerOtp] = useState('');
  const [serverNewPassword, setServerNewPassword] = useState('');
  const [serverAuthMessage, setServerAuthMessage] = useState('');
  const [serverAuthError, setServerAuthError] = useState('');
  const [serverActionError, setServerActionError] = useState('');
  const [serverAuthLoading, setServerAuthLoading] = useState(false);
  const [orders, setOrders] = useState(() => dedupeOrders(getStoredOrders()));
  const [billRequests, setBillRequests] = useState(() => getBillRequests());
  const [activeTicket, setActiveTicket] = useState(null);
  const [serverComments, setServerComments] = useState({});
  const [serverOrder, setServerOrder] = useState(createEmptyServerOrder);
  const [activeServerView, setActiveServerView] = useState('orders');
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [tableFilter, setTableFilter] = useState('all');
  const [historyFilter, setHistoryFilter] = useState('all');
  const [historySearchType, setHistorySearchType] = useState('table');
  const [historySearch, setHistorySearch] = useState('');
  const [paymentMethods, setPaymentMethods] = useState({});
  const [cancelDialog, setCancelDialog] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [activeServerCategory, setActiveServerCategory] = useState('Tous');
  const [menuCatalog, setMenuCatalog] = useState(() =>
    menuProducts.map((product) => ({
      ...product,
      available: product.available !== false,
      unavailableReason: product.unavailableReason || '',
    })),
  );
  const [counterSlots, setCounterSlots] = useState([]);
  const [apiTables, setApiTables] = useState([]);
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    if (!isAuthenticated) {
      return undefined;
    }

    let cancelled = false;
    let refreshInProgress = false;
    let realtimeRefreshId = null;

    const refreshServerData = async () => {
      if (refreshInProgress) return;
      refreshInProgress = true;
      try {
        const [apiOrders, apiBillRequests, apiCounterSlots, nextApiTables] = await Promise.all([
          fetchApiOrders(),
          fetchApiBillRequests(),
          fetchApiSlots('COUNTER'),
          fetchApiTables(),
        ]);

        if (cancelled) return;

        const cleanApiOrders = dedupeOrders(apiOrders);
        saveStoredOrders(cleanApiOrders);
        saveBillRequests(apiBillRequests);
        setOrders(cleanApiOrders);
        setBillRequests(apiBillRequests);
        setCounterSlots(Array.isArray(apiCounterSlots) ? apiCounterSlots : []);
        setApiTables(Array.isArray(nextApiTables) ? nextApiTables : []);
      } catch (error) {
        if (cancelled) return;
        setOrders(dedupeOrders(getStoredOrders()));
        setBillRequests(getBillRequests());
      } finally {
        refreshInProgress = false;
      }
    };

    const scheduleServerRefresh = () => {
      if (realtimeRefreshId) {
        window.clearTimeout(realtimeRefreshId);
      }

      realtimeRefreshId = window.setTimeout(refreshServerData, 250);
    };

    refreshServerData();
    const intervalId = window.setInterval(refreshServerData, 30000);
    const unsubscribeRealtime = subscribeRealtime({
      onOrder: (nextOrder) => {
        setOrders((currentOrders) => {
          const exists = currentOrders.some(
            (order) =>
              order.id === nextOrder.id ||
              (order.backendId && nextOrder.backendId && order.backendId === nextOrder.backendId),
          );
          const nextOrders = dedupeOrders(exists
            ? currentOrders.map((order) =>
                order.id === nextOrder.id ||
                (order.backendId && nextOrder.backendId && order.backendId === nextOrder.backendId)
                  ? nextOrder
                  : order,
              )
            : [nextOrder, ...currentOrders]);
          saveStoredOrders(nextOrders);
          return nextOrders;
        });
        fetchApiSlots('COUNTER')
          .then((nextSlots) => setCounterSlots(Array.isArray(nextSlots) ? nextSlots : []))
          .catch(() => {});
        fetchApiTables()
          .then((nextTables) => setApiTables(Array.isArray(nextTables) ? nextTables : []))
          .catch(() => {});
        scheduleServerRefresh();
      },
      onBillRequest: (nextBillRequest) => {
        setBillRequests((currentRequests) => {
          const exists = currentRequests.some((request) => request.id === nextBillRequest.id);
          const nextRequests = exists
            ? currentRequests.map((request) =>
                request.id === nextBillRequest.id ? nextBillRequest : request,
              )
            : [nextBillRequest, ...currentRequests];
          saveBillRequests(nextRequests);
          return nextRequests;
        });
        fetchApiTables()
          .then((nextTables) => setApiTables(Array.isArray(nextTables) ? nextTables : []))
          .catch(() => {});
        scheduleServerRefresh();
      },
      onTable: () => {
        fetchApiTables()
          .then((nextTables) => setApiTables(Array.isArray(nextTables) ? nextTables : []))
          .catch(() => {});
        scheduleServerRefresh();
      },
      onError: () => {
        // Le refresh de secours prend le relais si le canal temps reel tombe.
      },
    });

    const tickId = window.setInterval(() => setNowTick(Date.now()), 60000);

    return () => {
      cancelled = true;
      if (realtimeRefreshId) {
        window.clearTimeout(realtimeRefreshId);
      }
      window.clearInterval(intervalId);
      window.clearInterval(tickId);
      unsubscribeRealtime();
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      return undefined;
    }

    let cancelled = false;

    const loadMenuCatalog = async () => {
      try {
        const nextCatalog = await fetchMenuCatalogApi();
        if (!cancelled && Array.isArray(nextCatalog)) {
          const mappedCatalog = nextCatalog.map(mapCatalogProduct);
          let removedUnavailableItem = false;
          setMenuCatalog(mappedCatalog);
          setServerOrder((currentOrder) => ({
            ...currentOrder,
            items: currentOrder.items
              .map((orderItem) => {
                const latestProduct = mappedCatalog.find((product) => Number(product.id) === Number(orderItem.id));
                if (!latestProduct) return orderItem;
                if (latestProduct.available === false) {
                  removedUnavailableItem = true;
                  return null;
                }
                return { ...orderItem, ...latestProduct, quantity: orderItem.quantity };
              })
              .filter(Boolean),
          }));
          if (removedUnavailableItem) {
            setServerActionError('Un produit devenu indisponible a ete retire de la nouvelle commande.');
          }
        }
      } catch (error) {
        console.warn('Menu backend indisponible pour le serveur.', error);
      }
    };

    loadMenuCatalog();
    const stopMenuRealtime = subscribeRealtime({
      onMenu: loadMenuCatalog,
    });
    const menuRefreshId = window.setInterval(loadMenuCatalog, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(menuRefreshId);
      stopMenuRealtime();
    };
  }, [isAuthenticated]);

  const assignedTableNumbers = useMemo(
    () => parseAssignedTables(serverAuth?.assignedTables),
    [serverAuth],
  );
  const visibleOrders = useMemo(() => {
    const cleanOrders = dedupeOrders(orders);
    if (assignedTableNumbers.length === 0) {
      return cleanOrders;
    }
    return cleanOrders.filter((order) => assignedTableNumbers.includes(String(order.table)));
  }, [assignedTableNumbers, orders]);

  const pendingOrders = useMemo(
    () => visibleOrders.filter((order) => order.status === 'En attente de validation serveur'),
    [visibleOrders],
  );

  const handledOrders = useMemo(
    () => visibleOrders.filter((order) => order.status !== 'En attente de validation serveur'),
    [visibleOrders],
  );

  const confirmedOrders = useMemo(
    () => visibleOrders.filter((order) => order.status === 'Confirmee par le serveur'),
    [visibleOrders],
  );

  const pickupOrders = useMemo(() => visibleOrders.filter((order) => isReadyForPickup(order)), [visibleOrders]);
  const kitchenCancelledOrders = useMemo(() => visibleOrders.filter(isKitchenCancelledOrder), [visibleOrders]);

  const servedOrders = useMemo(() => visibleOrders.filter(isServedOrder), [visibleOrders]);
  const paidOrders = useMemo(() => visibleOrders.filter(isPaidOrder), [visibleOrders]);
  const billableOrders = useMemo(() => visibleOrders.filter(isBillableOrder), [visibleOrders]);

  const pendingBillRequests = useMemo(
    () => billRequests.filter((request) => request.status === 'En attente'),
    [billRequests],
  );

  const billRequestOrders = useMemo(
    () =>
      pendingBillRequests
        .map((request) => {
          const requestedOrder =
            visibleOrders.find((order) => order.id === request.orderId) ||
            visibleOrders.find(
              (order) =>
                request.backendOrderId &&
                order.backendId &&
                Number(request.backendOrderId) === Number(order.backendId),
            );

          if (requestedOrder) return requestedOrder;

          return visibleOrders.find(
            (order) =>
              String(order.table) === String(request.table) &&
              !isCancelledOrder(order) &&
              !isPaidOrder(order),
          );
        })
        .filter(Boolean),
    [pendingBillRequests, visibleOrders],
  );

  const paymentOrders = useMemo(() => {
    const orderMap = new Map();
    [...servedOrders, ...billRequestOrders].forEach((order) => {
      if (isCancelledOrder(order) || isPaidOrder(order) || isPendingValidationOrder(order)) {
        return;
      }
      orderMap.set(order.backendId ? `backend-${order.backendId}` : order.id, order);
    });
    return Array.from(orderMap.values());
  }, [billRequestOrders, servedOrders]);

  const paymentOrdersWithBillInfo = useMemo(
    () =>
      paymentOrders.map((order) => ({
        order,
        billRequest:
          pendingBillRequests.find((request) => request.orderId === order.id) ||
          pendingBillRequests.find(
            (request) =>
              request.backendOrderId &&
              order.backendId &&
              Number(request.backendOrderId) === Number(order.backendId),
          ) ||
          pendingBillRequests.find(
            (request) => !request.orderId && String(request.table) === String(order.table),
          ) ||
          null,
      })),
    [paymentOrders, pendingBillRequests],
  );

  const paymentOrdersWithBillRequestCount = useMemo(
    () => paymentOrdersWithBillInfo.filter(({ billRequest }) => Boolean(billRequest)).length,
    [paymentOrdersWithBillInfo],
  );
  const cashablePaymentOrders = useMemo(
    () => paymentOrdersWithBillInfo.filter(({ order }) => isServedOrder(order)),
    [paymentOrdersWithBillInfo],
  );
  const activeServiceOrders = useMemo(
    () => [...pendingOrders, ...confirmedOrders, ...pickupOrders, ...kitchenCancelledOrders],
    [confirmedOrders, kitchenCancelledOrders, pendingOrders, pickupOrders],
  );
  const orderStatusColumns = useMemo(
    () => [
      {
        id: 'validate',
        title: 'A valider',
        description: 'Commandes en attente de validation.',
        orders: pendingOrders,
      },
      {
        id: 'kitchen',
        title: 'En cuisine',
        description: 'Commandes confirmees en preparation.',
        orders: [...kitchenCancelledOrders, ...confirmedOrders],
      },
      {
        id: 'pickup',
        title: 'Prets a servir',
        description: 'Commandes pretes a etre servies.',
        orders: pickupOrders,
      },
    ],
    [confirmedOrders, kitchenCancelledOrders, pendingOrders, pickupOrders],
  );
  const serverCategories = useMemo(
    () => ['Tous', ...new Set(menuCatalog.map((product) => product.category))],
    [menuCatalog],
  );
  const filteredServerProducts = useMemo(() => {
    if (activeServerCategory === 'Tous') {
      return menuCatalog;
    }

    return menuCatalog.filter((product) => product.category === activeServerCategory);
  }, [activeServerCategory, menuCatalog]);

  const tableOverview = useMemo(() => {
    const sourceTables =
      Array.isArray(apiTables) && apiTables.length > 0
        ? [...apiTables]
            .filter((table) => table?.active !== false)
            .filter(
              (table) =>
                assignedTableNumbers.length === 0 ||
                assignedTableNumbers.includes(String(table.number || table.id)),
            )
            .sort((left, right) => Number(left.number || 0) - Number(right.number || 0))
        : Array.from({ length: 10 }, (_, index) => ({
            id: index + 1,
            number: index + 1,
            status: null,
            active: true,
          })).filter(
            (table) =>
              assignedTableNumbers.length === 0 ||
              assignedTableNumbers.includes(String(table.number)),
          );

    return sourceTables.map((table) => {
      const tableNumber = String(table.number || table.id);
      const tableOrders = visibleOrders
        .filter((order) => String(order.table) === tableNumber)
        .sort(
          (left, right) =>
            new Date(right.updatedAt || right.createdAt || 0).getTime() -
            new Date(left.updatedAt || left.createdAt || 0).getTime(),
        );
      const activeOrders = tableOrders.filter((order) => !isCancelledOrder(order) && !isPaidOrder(order));
      const paidOrders = tableOrders.filter((order) => isPaidOrder(order));
      const hasBillRequest = pendingBillRequests.some((request) => String(request.table) === tableNumber);
      const activeOrder = activeOrders[0] || null;
      const status = mapTableStatusToUi(table.status, activeOrders.length > 0, paidOrders.length > 0);
      const referenceOrders =
        status === 'in_service'
          ? activeOrders
          : ['paid_still_seated', 'cleaning'].includes(status)
            ? paidOrders.slice(0, 1)
            : [];
      const itemsCount = referenceOrders.reduce(
        (sum, order) =>
          sum +
          (order.items || []).reduce((itemSum, item) => itemSum + Number(item.quantity || 0), 0),
        0,
      );
      const total = referenceOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);

      return {
        id: tableNumber,
        number: tableNumber,
        backendId: table.id || null,
        status,
        label: getTableStatusLabel(status),
        hasBillRequest,
        guests: itemsCount,
        total,
        totalLabel: status === 'paid_still_seated' ? 'Total paye' : 'Total',
        activeOrderId: activeOrder?.id || paidOrders[0]?.id || null,
      };
    });
  }, [apiTables, assignedTableNumbers, pendingBillRequests, visibleOrders]);

  const filteredTables = useMemo(() => {
    if (tableFilter === 'all') return tableOverview;
    return tableOverview.filter((table) => table.status === tableFilter);
  }, [tableFilter, tableOverview]);

  const filteredHistoryOrders = useMemo(() => {
    const normalizedSearch = historySearch.trim().toLowerCase();

    return handledOrders.filter((order) => {
      const stage = getOrderStage(order);
      const matchesFilter =
        historyFilter === 'all' ||
        (historyFilter === 'confirmed' && order.status === 'Confirmee par le serveur') ||
        (historyFilter === 'paid' && order.status === 'Payee') ||
        (historyFilter === 'cancelled' && order.status === 'Annulee par le serveur') ||
        (historyFilter === 'kitchen' && stage === 'kitchen');
      const matchesItems = (order.items || []).some((item) =>
        `${item.name} ${item.quantity} ${item.price}`.toLowerCase().includes(normalizedSearch),
      );
      let matchesSearch = normalizedSearch.length === 0;

      if (!matchesSearch) {
        if (historySearchType === 'table') {
          matchesSearch = String(order.table).toLowerCase().includes(normalizedSearch);
        } else if (historySearchType === 'order') {
          matchesSearch = String(order.id).toLowerCase().includes(normalizedSearch);
        }
      }

      return matchesFilter && matchesSearch;
    });
  }, [handledOrders, historyFilter, historySearch, historySearchType]);

  const reprintHistoryBill = (order) => {
    if (!order?.items?.length || !isPaidOrder(order)) return;

    setActiveTicket({
      id: `REPRINT-${order.id}`,
      orderId: order.id,
      table: order.table,
      items: order.items,
      subtotal: order.subtotal,
      total: order.total,
      comment: order.comment,
      reward: order.reward,
      rewardNote: order.rewardNote,
      discountAmount: getOrderDiscountAmount(order),
      createdAt: order.updatedAt || order.createdAt,
      paymentMethod: order.paymentMethod || 'Especes',
    });
    window.setTimeout(() => window.print(), 100);
  };

  const getServerItemQuantity = (productId) =>
    serverOrder.items.find((item) => item.id === productId)?.quantity || 0;

  const buildBillFromRequest = (request) => {
    const requestedOrder = orders.find(
      (order) =>
        order.id === request.orderId &&
        String(order.table) === String(request.table) &&
        !['Annulee par le serveur', 'Payee'].includes(order.status),
    );
    const latestTableOrder = request.orderId
      ? null
      : orders.find(
          (order) =>
            String(order.table) === String(request.table) &&
            !['Annulee par le serveur', 'Payee'].includes(order.status),
        );
    const billOrder = requestedOrder || latestTableOrder;

    if (billOrder) {
      return {
        ...request,
        orderId: billOrder.id,
        items: billOrder.items || [],
        subtotal: billOrder.subtotal || billOrder.total || 0,
        total: billOrder.total || 0,
        clientName: billOrder.clientName || request.clientName,
        comment: billOrder.comment || request.comment,
        reward: billOrder.reward || null,
        rewardNote: billOrder.rewardNote || '',
        discountAmount: getOrderDiscountAmount(billOrder),
        createdAt: billOrder.createdAt || request.createdAt,
      };
    }

    if (request.items?.length > 0) {
      return request;
    }

    return {
      ...request,
      orderId: request.orderId || 'Commande introuvable',
      items: [],
      subtotal: request.subtotal || 0,
      total: 0,
      reward: request.reward || null,
      rewardNote: request.rewardNote || '',
      discountAmount: request.discountAmount || 0,
    };
  };

  const findBillRequestForOrder = (order) => {
    if (!order) return null;

    return (
      pendingBillRequests.find((request) => request.orderId === order.id) ||
      pendingBillRequests.find(
        (request) =>
          request.backendOrderId &&
          order.backendId &&
          Number(request.backendOrderId) === Number(order.backendId),
      ) ||
      pendingBillRequests.find(
        (request) => !request.orderId && String(request.table) === String(order.table),
      ) ||
      null
    );
  };

  const billingSelectableOrders = useMemo(() => {
    const uniqueOrders = new Map(paymentOrders.map((order) => [order.id, order]));

    return Array.from(uniqueOrders.values());
  }, [paymentOrders]);

  const orderQueueSelectableOrders = useMemo(
    () => [...pendingOrders, ...confirmedOrders, ...pickupOrders],
    [confirmedOrders, pendingOrders, pickupOrders],
  );

  const selectableOrders = useMemo(() => {
    if (activeServerView === 'history') return handledOrders;
    if (activeServerView === 'billing') return billingSelectableOrders;
    if (activeServerView === 'ready') return pickupOrders;
    if (activeServerView === 'orders') return orderQueueSelectableOrders;
    return activeServiceOrders;
  }, [
    activeServerView,
    activeServiceOrders,
    billingSelectableOrders,
    handledOrders,
    orderQueueSelectableOrders,
    pickupOrders,
  ]);

  const selectedOrder = selectedOrderId
    ? selectableOrders.find((order) => order.id === selectedOrderId) || null
    : null;
  const selectedBillRequest = findBillRequestForOrder(selectedOrder);
  const showSelectedOrderPanel =
    Boolean(selectedOrder) && (activeServerView === 'orders' || activeServerView === 'ready');

  useEffect(() => {
    if (
      (activeServerView !== 'orders' && activeServerView !== 'ready') ||
      !selectedOrderId
    ) {
      return;
    }

    const sourceOrders =
      activeServerView === 'ready'
        ? pickupOrders
        : orderQueueSelectableOrders;
    const currentSelectedOrder = sourceOrders.find((order) => order.id === selectedOrderId);
    if (!currentSelectedOrder) {
      setSelectedOrderId(null);
    }
  }, [activeServerView, orderQueueSelectableOrders, pickupOrders, selectedOrderId]);

  const openNewOrderForTable = (tableId) => {
    setSelectedOrderId(null);
    setActiveServerCategory('Tous');
    setServerOrder({ ...createEmptyServerOrder(), table: tableId });
    setActiveServerView('menu');
  };

  const selectTableOrder = (table) => {
    if (table.status === 'available') {
      openNewOrderForTable(table.id);
      return;
    }

    const targetOrderId = table.activeOrderId;

    if (!targetOrderId) {
      setServerActionError(`Aucune commande active trouvee pour la table ${table.id}.`);
      return;
    }

    setServerActionError('');
    setSelectedOrderId(targetOrderId);
    setActiveServerView('orders');
  };

  const addItemForTable = (table) => {
    setServerActionError('');
    setSelectedOrderId(null);
    setActiveServerCategory('Tous');
    setServerOrder({ ...createEmptyServerOrder(), table: table.id });
    setActiveServerView('menu');
  };

  const openReplacementOrder = (order) => {
    if (!order) return;

    setServerActionError('');
    setSelectedOrderId(null);
    setActiveServerCategory('Tous');
    setServerOrder({
      ...createEmptyServerOrder(),
      table: order.table,
      clientName: order.clientName || 'Client accompagne',
      comment: `Remplacement suite incident cuisine sur ${order.id}`,
    });
    setActiveServerView('menu');
  };

  const syncOneTableInState = (nextTable) => {
    if (!nextTable?.number) return;

    setApiTables((currentTables) => {
      if (!Array.isArray(currentTables) || currentTables.length === 0) {
        return currentTables;
      }

      return currentTables.map((table) =>
        Number(table.number) === Number(nextTable.number) ? nextTable : table,
      );
    });
  };

  const refreshTablesSilently = async () => {
    try {
      const nextTables = await fetchApiTables();
      setApiTables(Array.isArray(nextTables) ? nextTables : []);
    } catch (error) {
      console.warn('Actualisation des tables impossible pour le moment.', error);
    }
  };

  const refreshOrdersAndTablesSilently = async () => {
    try {
      const [nextOrders, nextTables] = await Promise.all([fetchApiOrders(), fetchApiTables()]);
      const cleanOrders = dedupeOrders(nextOrders);
      saveStoredOrders(cleanOrders);
      setOrders(cleanOrders);
      setApiTables(Array.isArray(nextTables) ? nextTables : []);
    } catch (error) {
      console.warn('Actualisation commandes/tables impossible pour le moment.', error);
    }
  };

  const releaseTable = async (tableNumber) => {
    try {
      setServerActionError('');
      syncOneTableInState(await releaseApiTable(Number(tableNumber)));
      await refreshTablesSilently();
    } catch (error) {
      setServerActionError(error.message || "Impossible de changer l'etat de la table.");
      console.warn("Impossible de passer la table en nettoyage pour l'instant.", error);
    }
  };

  const markTableAvailable = async (tableNumber) => {
    try {
      setServerActionError('');
      syncOneTableInState(await markApiTableAvailable(Number(tableNumber)));
      await refreshTablesSilently();
    } catch (error) {
      setServerActionError(error.message || "Impossible de marquer la table libre.");
      console.warn("Impossible de liberer la table pour l'instant.", error);
    }
  };

  const replaceOrderInState = (nextOrder) => {
    setOrders((currentOrders) => {
      const nextOrders = currentOrders.map((order) => (order.id === nextOrder.id ? nextOrder : order));
      saveStoredOrders(nextOrders);
      return nextOrders;
    });
  };

  const confirmOrder = async (orderId) => {
    const order = orders.find((item) => item.id === orderId);
    setServerActionError('');

    if (order && isBackendOrder(order)) {
      try {
        replaceOrderInState(
          await updateApiOrderStatus(
            order,
            'Confirmee par le serveur',
            serverComments[orderId] || '',
          ),
        );
        return;
      } catch (error) {
        setServerActionError(error.message || "Impossible de confirmer: backend indisponible.");
        return;
      }
    }

    const nextOrders = updateStoredOrder(orderId, {
      status: 'Confirmee par le serveur',
      serverComment: serverComments[orderId] || '',
    });
    setOrders(nextOrders);
  };

  const openCancelDialog = (order) => {
    setCancelReason('');
    setServerActionError('');
    setCancelDialog(order);
  };

  const closeCancelDialog = () => {
    setCancelDialog(null);
    setCancelReason('');
  };

  const cancelOrder = async (orderId, reasonValue = '') => {
    const order = orders.find((item) => item.id === orderId);
    const cancellationReason = reasonValue.trim();

    if (!cancellationReason) {
      setServerActionError("Annulation bloquee: le motif est obligatoire.");
      return false;
    }

    setServerActionError('');

    if (order && isBackendOrder(order)) {
      try {
        replaceOrderInState(
          await updateApiOrderStatus(order, 'Annulee par le serveur', cancellationReason),
        );
        return true;
      } catch (error) {
        setServerActionError(error.message || "Impossible d'annuler: backend indisponible.");
        return false;
      }
    }

    const nextOrders = updateStoredOrder(orderId, {
      status: 'Annulee par le serveur',
      serverComment: cancellationReason,
    });
    setOrders(nextOrders);
    return true;
  };

  const submitCancelDialog = async () => {
    if (!cancelDialog) return;
    const reason = cancelReason.trim();
    if (!reason) {
      setServerActionError('Saisir motif avant de refuser la commande.');
      return;
    }

    const cancelled = await cancelOrder(cancelDialog.id, reason);
    if (cancelled) closeCancelDialog();
  };

  const serveOrder = async (orderId) => {
    const order = orders.find((item) => item.id === orderId);
    setServerActionError('');

    if (order && isBackendOrder(order)) {
      try {
        replaceOrderInState(await updateApiOrderStatus(order, 'Servie', serverComments[orderId] || ''));
        return;
      } catch (error) {
        setServerActionError(error.message || "Impossible de servir: backend indisponible.");
        return;
      }
    }

    const nextOrders = updateStoredOrder(orderId, {
      status: 'Servie',
      serverComment: serverComments[orderId] || '',
    });
    setOrders(nextOrders);
  };

  const editPendingOrderItem = (order, product, quantityChange) => {
    if (product.available === false && quantityChange > 0) {
      setServerActionError(product.unavailableReason || 'Ce produit est indisponible.');
      return;
    }

    const editableItems = order.items.filter((item) => !item.isRewardItem);
    const rewardItems = order.items.filter((item) => item.isRewardItem);
    const existingItem = editableItems.find((item) => item.id === product.id);

    const nextEditableItems =
      existingItem || quantityChange < 0
        ? editableItems
            .map((item) =>
              item.id === product.id ? { ...item, quantity: item.quantity + quantityChange } : item,
            )
            .filter((item) => item.quantity > 0)
        : [...editableItems, { ...product, quantity: 1 }];

    const nextItems = [...nextEditableItems, ...rewardItems];
    const nextSubtotal = nextItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const nextDiscount =
      order.reward?.type === 'DISCOUNT'
        ? Math.max(
            0,
            Math.round((nextSubtotal * Number(order.reward.discountPercent || 0)) / 100 * 100) / 100,
          )
        : 0;
    const nextTotal = Math.max(0, nextSubtotal - nextDiscount);
    const nextPoints = Math.floor(nextTotal / 10);

    const nextOrders = updateStoredOrder(order.id, {
      items: nextItems,
      subtotal: nextSubtotal,
      discountAmount: nextDiscount,
      total: nextTotal,
      points: nextPoints,
      serverComment: serverComments[order.id] || 'Commande ajustee par le serveur',
    });

    setOrders(nextOrders);
  };

  const updateServerOrderItem = (product, quantityChange) => {
    if (product.available === false && quantityChange > 0) {
      setServerActionError(product.unavailableReason || 'Ce produit est indisponible.');
      return;
    }

    setServerOrder((currentOrder) => {
      const existingItem = currentOrder.items.find((item) => item.id === product.id);

      if (!existingItem && quantityChange > 0) {
        return {
          ...currentOrder,
          items: [...currentOrder.items, { ...product, quantity: 1 }],
        };
      }

      const nextItems = currentOrder.items
        .map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + quantityChange } : item,
        )
        .filter((item) => item.quantity > 0);

      return { ...currentOrder, items: nextItems };
    });
  };

  const serverOrderTotal = serverOrder.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const serverOrderPoints = serverOrder.items.reduce(
    (sum, item) => sum + item.points * item.quantity,
    0,
  );
  const canSubmitServerOrder = Boolean(serverOrder.table && serverOrder.items.length > 0);

  const printOrderBill = async (order) => {
    if (!order?.items?.length || Number(order.total || 0) <= 0) return;
    const paymentMethod = paymentMethods[order.id] || 'Especes';

    if (isBackendOrder(order)) {
      try {
        const request = await createApiBillRequest(order);
        const printedRequest = await printApiBillRequest(request, paymentMethod);
        if (printedRequest.order) {
          replaceOrderInState(printedRequest.order);
        }
        refreshTablesSilently();
        setBillRequests((currentRequests) => {
          const nextRequests = [
            printedRequest,
            ...currentRequests.filter((item) => item.id !== printedRequest.id),
          ];
          saveBillRequests(nextRequests);
          return nextRequests;
        });
      } catch (error) {
        console.warn('Backend indisponible, impression locale.', error);
      }
    }

    const bill = {
      id: `BILL-${order.id}`,
      orderId: order.id,
      table: order.table,
      items: order.items,
      subtotal: order.subtotal,
      total: order.total,
      clientName: order.clientName,
      comment: order.comment,
      reward: order.reward,
      rewardNote: order.rewardNote,
      discountAmount: getOrderDiscountAmount(order),
      createdAt: order.createdAt,
      paymentMethod,
      status: 'Ticket imprime',
    };

    setActiveTicket(bill);
    markQrSessionBillRequested(bill.table);
    const nextOrders = updateStoredOrder(order.id, {
      status: 'Payee',
    });
    setOrders(nextOrders);
    window.setTimeout(() => window.print(), 100);
  };

  const isPrimaryActionDisabled = (order) => {
    if (!order) return true;

    const stage = getOrderStage(order);
    if (stage === 'payment') {
      return !getSelectedPaymentMethod(paymentMethods, order) || !order.items?.length || Number(order.total || 0) <= 0;
    }

    return ['kitchen', 'paid', 'cancelled', 'unknown'].includes(stage);
  };

  const runPrimaryOrderAction = (order) => {
    if (!order || isPrimaryActionDisabled(order)) return;

    const stage = getOrderStage(order);

    if (stage === 'validate') {
      confirmOrder(order.id);
      return;
    }

    if (stage === 'pickup') {
      serveOrder(order.id);
      return;
    }

    if (stage === 'payment') {
      const billRequest = findBillRequestForOrder(order);
      if (billRequest) {
        printBill(billRequest);
        return;
      }
      printOrderBill(order);
    }
  };

  const submitServerOrder = async () => {
    if (!serverOrder.table || serverOrder.items.length === 0) return;
    const unavailableItem = serverOrder.items.find((item) => {
      const latestProduct = menuCatalog.find((product) => Number(product.id) === Number(item.id));
      return latestProduct?.available === false;
    });

    if (unavailableItem) {
      const latestProduct = menuCatalog.find((product) => Number(product.id) === Number(unavailableItem.id));
      setServerActionError(latestProduct?.unavailableReason || `${unavailableItem.name} est indisponible.`);
      setServerOrder((currentOrder) => ({
        ...currentOrder,
        items: currentOrder.items.filter((item) => Number(item.id) !== Number(unavailableItem.id)),
      }));
      return;
    }

    const createdAt = new Date().toISOString();

    const order = {
      id: `SRV-${createdAt.replaceAll(/[-:.TZ]/g, '')}`,
      table: serverOrder.table,
      clientName: serverOrder.clientName || 'Client accompagne',
      accessMode: 'server-assisted',
      comment: serverOrder.comment,
      serverComment: 'Commande prise par le serveur',
      total: serverOrderTotal,
      points: serverOrderPoints,
      items: serverOrder.items,
      status: 'Confirmee par le serveur',
      createdAt,
      updatedAt: createdAt,
    };

    try {
      const apiOrder = await createApiOrder(order);
      setOrders(addStoredOrder(apiOrder));
    } catch (error) {
      console.warn('Backend indisponible, commande serveur gardee en localStorage.', error);
      setOrders(addStoredOrder(order));
    }

    setServerOrder(createEmptyServerOrder());
  };

  const loginServer = async (event) => {
    event.preventDefault();
    if (!credentials.phone || !credentials.password) {
      setServerAuthError('Telephone et mot de passe obligatoires.');
      return;
    }

    setServerAuthLoading(true);
    setServerAuthError('');

    try {
      const auth = await loginApi({
        phone: credentials.phone.trim(),
        password: credentials.password,
      });

      if (auth.role !== 'WAITER') {
        setServerAuthError('Ce compte n est pas un compte serveur.');
        return;
      }

      sessionStorage.setItem(SERVER_AUTH_KEY, 'true');
      sessionStorage.setItem(SERVER_AUTH_STORAGE_KEY, JSON.stringify(auth));
      setServerAuth(auth);
      setIsAuthenticated(true);
    } catch (error) {
      setServerAuthError(
        error.message?.includes('Backend indisponible') || error.message?.includes('API inaccessible')
          ? "Connexion trop lente ou API inaccessible. Verifie /api/health puis relance Spring Boot si besoin."
          : error.message || 'Connexion serveur impossible.',
      );
    } finally {
      setServerAuthLoading(false);
    }
  };

  const recoverServerPassword = async () => {
    if (!credentials.phone) {
      setServerAuthError('Entrez le telephone du serveur.');
      return;
    }

    setServerAuthLoading(true);
    setServerAuthError('');

    try {
      const response = await forgotPasswordApi({ phone: credentials.phone.trim() });
      setServerAuthMessage(response.message || 'Code envoye : 1234');
      setServerAuthMode('reset');
    } catch (error) {
      setServerAuthError(error.message || 'Impossible de recuperer le mot de passe.');
    } finally {
      setServerAuthLoading(false);
    }
  };

  const resetServerPassword = async () => {
    if (!credentials.phone || !serverOtp || !serverNewPassword) {
      setServerAuthError('Telephone, OTP et nouveau mot de passe obligatoires.');
      return;
    }

    setServerAuthLoading(true);
    setServerAuthError('');

    try {
      await resetPasswordApi({
        phone: credentials.phone.trim(),
        otp: serverOtp,
        newPassword: serverNewPassword,
      });
      setCredentials((current) => ({ ...current, password: serverNewPassword }));
      setServerOtp('');
      setServerNewPassword('');
      setServerAuthMode('login');
      setServerAuthMessage('Mot de passe modifie. Connectez-vous maintenant.');
    } catch (error) {
      setServerAuthError(error.message || 'Impossible de modifier le mot de passe.');
    } finally {
      setServerAuthLoading(false);
    }
  };

  const logoutServer = () => {
    sessionStorage.removeItem(SERVER_AUTH_KEY);
    sessionStorage.removeItem(SERVER_AUTH_STORAGE_KEY);
    setServerAuth(null);
    setIsAuthenticated(false);
  };

  const handleServerNavPointer = (event) => {
    const navButton = event.target.closest('button[data-server-view]');

    if (navButton?.dataset.serverView) {
      setActiveServerView(navButton.dataset.serverView);
    }
  };

  const printBill = async (request) => {
    const bill = buildBillFromRequest(request);
    const paymentMethod = paymentMethods[bill.orderId] || 'Especes';

    if (!bill.items?.length || Number(bill.total || 0) <= 0) {
      const nextRequests = updateBillRequest(request.id, {
        status: 'Addition incomplete',
        serverNote: 'Aucune commande active trouvee pour cette table.',
      });
      setBillRequests(nextRequests);
      return;
    }

    if (request.backendId) {
      try {
        const printedRequest = await printApiBillRequest(request, paymentMethod);
        if (printedRequest.order) {
          replaceOrderInState(printedRequest.order);
        }
        refreshTablesSilently();
        setBillRequests((currentRequests) => {
          const nextRequests = currentRequests.map((item) =>
            item.id === printedRequest.id ? printedRequest : item,
          );
          saveBillRequests(nextRequests);
          return nextRequests;
        });
      } catch (error) {
        console.warn('Backend indisponible, impression locale.', error);
      }
    }

    setActiveTicket({ ...bill, paymentMethod });
    markQrSessionBillRequested(bill.table);
    const nextRequests = updateBillRequest(bill.id, {
      orderId: bill.orderId,
      items: bill.items,
      total: bill.total,
      status: 'Ticket imprime',
      printedAt: new Date().toISOString(),
    });
    const nextOrders = updateStoredOrder(bill.orderId, {
      status: 'Payee',
    });
    setOrders(nextOrders);
    setBillRequests(nextRequests);
    window.setTimeout(() => window.print(), 100);
  };

  if (!isAuthenticated) {
    return (
      <main className="server-page">
        <section className="server-login-panel">
          <div>
            <p className="eyebrow">Acces personnel</p>
            <h1>{serverAuthMode === 'login' ? 'Connexion serveur' : 'Recuperer le mot de passe'}</h1>
            <p>
              L'interface serveur est reservee au personnel. Connectez-vous avec telephone et mot
              de passe.
            </p>
          </div>

          <form className="server-login-form" onSubmit={loginServer}>
            <label className="field">
              Telephone
              <input
                onChange={(event) =>
                  setCredentials((current) => ({ ...current, phone: event.target.value }))
                }
                placeholder="Ex: 0600000000"
                type="tel"
                value={credentials.phone}
              />
            </label>

            {serverAuthMode === 'login' && (
              <>
                <label className="field">
                  Mot de passe
                  <input
                    onChange={(event) =>
                      setCredentials((current) => ({ ...current, password: event.target.value }))
                    }
                    placeholder="Mot de passe serveur"
                    type="password"
                    value={credentials.password}
                  />
                </label>
                <button className="primary-button" disabled={serverAuthLoading} type="submit">
                  Se connecter
                </button>
                <button
                  className="auth-text-button"
                  type="button"
                  onClick={() => {
                    setServerAuthMode('forgot');
                    setServerAuthError('');
                  }}
                >
                  Mot de passe oublie ?
                </button>
              </>
            )}

            {serverAuthMode === 'forgot' && (
              <>
                <button
                  className="primary-button"
                  disabled={serverAuthLoading}
                  type="button"
                  onClick={recoverServerPassword}
                >
                  Recuperer le code OTP
                </button>
                <button className="auth-text-button" type="button" onClick={() => setServerAuthMode('login')}>
                  Retour connexion
                </button>
              </>
            )}

            {serverAuthMode === 'reset' && (
              <>
                <label className="field">
                  Code OTP
                  <input
                    onChange={(event) => setServerOtp(event.target.value)}
                    placeholder="1234"
                    type="text"
                    value={serverOtp}
                  />
                </label>
                <label className="field">
                  Nouveau mot de passe
                  <input
                    onChange={(event) => setServerNewPassword(event.target.value)}
                    placeholder="Nouveau mot de passe"
                    type="password"
                    value={serverNewPassword}
                  />
                </label>
                <button
                  className="primary-button"
                  disabled={serverAuthLoading}
                  type="button"
                  onClick={resetServerPassword}
                >
                  Modifier le mot de passe
                </button>
              </>
            )}

            {serverAuthMessage && <p className="auth-message">{serverAuthMessage}</p>}
            {serverAuthError && <p className="auth-error">{serverAuthError}</p>}
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="server-page server-tablet-page">
      <div className="server-tablet-shell">
        <aside className="server-sidebar">
          <div className="server-brand">
            <span>P2</span>
            <div>
              <strong>POS2</strong>
              <small>Station</small>
            </div>
          </div>
          <nav
            className="server-nav"
            aria-label="Navigation serveur"
            onPointerDownCapture={handleServerNavPointer}
          >
            <button
              className={activeServerView === 'orders' ? 'is-active' : ''}
              data-server-view="orders"
              type="button"
              onFocus={() => setActiveServerView('orders')}
              onClick={() => setActiveServerView('orders')}
            >
              <span>01</span>
              <b>File des commandes</b>
            </button>
            <button
              className={activeServerView === 'floor' ? 'is-active' : ''}
              data-server-view="floor"
              type="button"
              onFocus={() => setActiveServerView('floor')}
              onClick={() => setActiveServerView('floor')}
            >
              <span>02</span>
              <b>Tables</b>
            </button>
            <button
              className={activeServerView === 'menu' ? 'is-active' : ''}
              data-server-view="menu"
              type="button"
              onFocus={() => setActiveServerView('menu')}
              onClick={() => setActiveServerView('menu')}
            >
              <span>03</span>
              <b>Nouvelle commande</b>
            </button>
            <button
              className={activeServerView === 'billing' ? 'is-active' : ''}
              data-server-view="billing"
              type="button"
              onFocus={() => setActiveServerView('billing')}
              onClick={() => setActiveServerView('billing')}
            >
              <span>04</span>
              <b>Paiement / Additions</b>
            </button>
            <button
              className={activeServerView === 'ready' ? 'is-active' : ''}
              data-server-view="ready"
              type="button"
              onFocus={() => setActiveServerView('ready')}
              onClick={() => setActiveServerView('ready')}
            >
              <span>05</span>
              <b>Plats prets</b>
            </button>
            <button
              className={activeServerView === 'history' ? 'is-active' : ''}
              data-server-view="history"
              type="button"
              onFocus={() => setActiveServerView('history')}
              onClick={() => setActiveServerView('history')}
            >
              <span>06</span>
              <b>Historique</b>
            </button>
          </nav>
          <div className="server-sidebar-spacer" />
          <div className="server-session-note">Session serveur active</div>
        </aside>

        <section className="server-app-shell">
          <header className="server-topbar">
            <div className="server-profile">
              <span className="notification-dot" aria-hidden="true" />
              <span className="server-avatar">SP</span>
              <div>
                <strong>Serveur POS2</strong>
                <small>Tablette service</small>
              </div>
              <button className="server-logout-link" type="button" onClick={logoutServer}>
                Quitter
              </button>
            </div>
          </header>

          <div
            className={`server-workspace ${
              activeServerView === 'floor' ? 'server-workspace-tables' : ''
            } ${showSelectedOrderPanel ? '' : 'server-workspace-single'}`}
          >
            <section className="server-main-panel">
              {serverActionError && (
                <div className="server-action-error" role="alert">
                  {serverActionError}
                </div>
              )}

              {activeServerView === 'floor' && (
                <section className="server-dashboard-section server-table-map-section">
                  <div className="server-section-title">
                    <div>
                      <h1>Tables</h1>
                      <p>Selection rapide d'une table et action directe selon son statut.</p>
                    </div>
                    <div className="server-filter-pills server-table-filters" aria-label="Filtres tables">
                      {[
                        ['all', 'Toutes', tableOverview.length],
                        [
                          'available',
                          'Libres',
                          tableOverview.filter((table) => table.status === 'available').length,
                        ],
                        [
                          'in_service',
                          'Occupees',
                          tableOverview.filter((table) => table.status === 'in_service').length,
                        ],
                        [
                          'paid_still_seated',
                          'Payees assises',
                          tableOverview.filter((table) => table.status === 'paid_still_seated').length,
                        ],
                        [
                          'cleaning',
                          'A nettoyer',
                          tableOverview.filter((table) => table.status === 'cleaning').length,
                        ],
                      ].map(([filter, label, count]) => (
                        <button
                          className={tableFilter === filter ? 'is-active' : ''}
                          key={filter}
                          type="button"
                          onClick={() => setTableFilter(filter)}
                        >
                          {label} <strong>{count}</strong>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="server-table-service-grid">
                    {filteredTables.map((table) => (
                      <article
                        className={`server-service-table-card ${table.status}`}
                        key={table.id}
                        onClick={() => selectTableOrder(table)}
                      >
                        <header>
                          <div>
                            <span>Table</span>
                            <strong>{table.id}</strong>
                          </div>
                          <span className={`status-badge status-table-${table.status}`}>
                            {table.label}
                          </span>
                        </header>
                        <div className="server-table-card-metrics">
                          <div>
                            <span>Articles actifs</span>
                            <strong>{table.guests}</strong>
                          </div>
                          <div>
                            <span>{table.totalLabel}</span>
                            <strong>{formatPrice(table.total)}</strong>
                          </div>
                        </div>
                        {table.hasBillRequest && table.status === 'in_service' && (
                          <span className="server-table-request-hint">Addition demandee</span>
                        )}
                        <div className="server-table-card-actions">
                          {table.status === 'available' && (
                            <button
                              className="btn btn-primary"
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openNewOrderForTable(table.id);
                              }}
                            >
                              Nouvelle commande
                            </button>
                          )}
                          {table.status === 'in_service' && (
                            <>
                              <button
                                className="btn btn-secondary"
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  selectTableOrder(table);
                                }}
                              >
                                Voir commande
                              </button>
                              <button
                                className="btn btn-secondary"
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  addItemForTable(table);
                                }}
                              >
                                Ajouter article
                              </button>
                            </>
                          )}
                          {table.status === 'paid_still_seated' && (
                            <button
                              className="btn btn-primary"
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                releaseTable(table.number);
                              }}
                            >
                              Client parti
                            </button>
                          )}
                          {table.status === 'cleaning' && (
                            <button
                              className="btn btn-secondary"
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                markTableAvailable(table.number);
                              }}
                            >
                              Marquer libre
                            </button>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {activeServerView === 'orders' && (
                <section className="server-dashboard-section server-order-line-section" id="order-line">
                  <div className="server-section-title">
                    <div>
                      <h1>File des commandes</h1>
                      <p>Chaque colonne indique clairement la prochaine action du serveur.</p>
                    </div>
                    <div className="server-filter-pills server-kpi-pills">
                      <span>
                        A valider <strong>{pendingOrders.length}</strong>
                      </span>
                      <span>
                        En cuisine <strong>{confirmedOrders.length}</strong>
                      </span>
                      <span>
                        Prets <strong>{pickupOrders.length}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="server-flow-strip" aria-label="Flux commande">
                    <span>Client</span>
                    <strong>A valider</strong>
                    <strong>En cuisine</strong>
                    <span>Servir</span>
                  </div>

                  <div className="server-status-board">
                    {orderStatusColumns.map((column) => (
                      <section className="server-status-column" key={column.id}>
                        <header className="server-status-column-header">
                          <div>
                            <span>{column.description}</span>
                            <h2>{column.title}</h2>
                          </div>
                          <strong>{column.orders.length}</strong>
                        </header>

                        <div className="server-status-column-list">
                          {column.orders.length === 0 && (
                            <p className="empty-state">Aucune commande ici.</p>
                          )}
                            {column.orders.map((order) => (
                              <ServerOrderCard
                                key={order.id}
                                order={order}
                                slotInfo={column.id === 'pickup' ? getPickupSlotInfo(order, counterSlots) : null}
                                readySinceLabel={
                                  column.id === 'pickup' ? getReadySinceLabel(order.readySince, nowTick) : ''
                                }
                                readySinceTone={
                                  column.id === 'pickup'
                                    ? getReadyTone(getReadySinceMinutes(order.readySince, nowTick))
                                    : ''
                                }
                                compactPickup={column.id === 'pickup'}
                                selected={selectedOrder?.id === order.id}
                                primaryDisabled={isPrimaryActionDisabled(order)}
                                onPrimary={() => runPrimaryOrderAction(order)}
                                onReject={() => openCancelDialog(order)}
                                onSelect={() => setSelectedOrderId(order.id)}
                              />
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                </section>
              )}

              {activeServerView === 'ready' && (
                <section className="server-dashboard-section server-order-line-section" id="ready-orders">
                  <div className="server-section-title">
                    <div>
                      <h1>Plats prets</h1>
                      <p>Plateaux valides par la cuisine, prets pour le comptoir puis le service.</p>
                    </div>
                    <div className="server-filter-pills server-kpi-pills">
                      <span>
                        Prets <strong>{pickupOrders.length}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="server-status-board server-status-board-single">
                    <section className="server-status-column">
                      <header className="server-status-column-header">
                        <div>
                          <span>Commande terminee cote cuisine</span>
                          <h2>Plats prets</h2>
                        </div>
                        <strong>{pickupOrders.length}</strong>
                      </header>

                      <div className="server-status-column-list">
                        {pickupOrders.length === 0 && <p className="empty-state">Aucun plateau pret pour le moment.</p>}
                        {pickupOrders.map((order) => (
                          <ServerOrderCard
                            key={order.id}
                            order={order}
                            slotInfo={getPickupSlotInfo(order, counterSlots)}
                            readySinceLabel={getReadySinceLabel(order.readySince, nowTick)}
                            readySinceTone={getReadyTone(getReadySinceMinutes(order.readySince, nowTick))}
                            selected={selectedOrder?.id === order.id}
                            primaryDisabled={isPrimaryActionDisabled(order)}
                            onPrimary={() => runPrimaryOrderAction(order)}
                            onReject={() => openCancelDialog(order)}
                            onSelect={() => setSelectedOrderId(order.id)}
                          />
                        ))}
                      </div>
                    </section>
                  </div>
                </section>
              )}

              {activeServerView === 'billing' && (
                <section className="server-dashboard-section server-billing-section" id="payment">
                  <div className="server-section-title">
                    <div>
                      <h1>Paiement / Additions</h1>
                      <p>Commandes a encaisser, avec indication quand le client demande l'addition.</p>
                    </div>
                    <div className="server-filter-pills server-kpi-pills">
                      <span>
                        A encaisser <strong>{paymentOrdersWithBillInfo.length}</strong>
                      </span>
                      <span>
                        Payees <strong>{paidOrders.length}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="server-billing-layout">
                    <div className="server-billing-main">
                      {paymentOrders.length === 0 && (
                        <div className="server-empty-state-card">
                          <span aria-hidden="true">MAD</span>
                          <h2>Aucune commande a encaisser</h2>
                          <p>Les commandes confirmees ou servies apparaitront ici.</p>
                        </div>
                      )}
                      {paymentOrders.length > 0 && (
                        <section className="server-billing-panel server-cashier-panel">
                          <header className="server-billing-panel-header">
                            <div>
                              <h2>A encaisser</h2>
                              <p>Commandes pretes a etre encaissees.</p>
                            </div>
                            <button
                              className="server-refresh-button"
                              type="button"
                              onClick={refreshOrdersAndTablesSilently}
                            >
                              Actualiser la liste
                            </button>
                          </header>
                          <div className="server-bill-request-grid server-cashier-grid">
                            {paymentOrdersWithBillInfo.length === 0 && (
                              <div className="server-inline-empty-card">
                                Aucune commande prete a encaisser.
                              </div>
                            )}
                            {paymentOrdersWithBillInfo.map(({ order, billRequest }) => {
                              const orderCanBePaid = isServedOrder(order);
                              const orderWaitsValidation = isPendingValidationOrder(order);
                              const selectedPaymentMethod = paymentMethods[order.id] || 'Especes';
                              const actionLabel = orderCanBePaid
                                ? 'Encaisser'
                                : orderWaitsValidation
                                  ? 'En attente serveur'
                                  : 'Marquer servie';

                              return (
                        <article
                          className={`server-bill-request-card server-cashier-card ${
                            selectedOrder?.id === order.id ? 'is-selected' : ''
                          }`}
                          key={`payment-cashier-${order.id}`}
                          onClick={() => setSelectedOrderId(order.id)}
                        >
                          <div className="server-bill-request-top">
                            <div>
                              <span>Table</span>
                              <strong>{order.table}</strong>
                            </div>
                            <span
                              className={`status-badge ${
                                billRequest ? 'status-paid' : 'status-payment'
                              }`}
                            >
                              {billRequest
                                ? "Client demande l'addition"
                                : orderCanBePaid
                                  ? 'A encaisser'
                                  : 'Commande confirmee'}
                            </span>
                          </div>
                          <p>{order.id}</p>
                          {billRequest && (
                            <div className="server-bill-request-comment">
                              Client demande addition
                            </div>
                          )}
                          <ul>
                            {order.items.slice(0, 3).map((item) => (
                              <li key={`served-${order.id}-${item.id}-${item.name}`}>
                                <span>
                                  {item.quantity}x {item.name}
                                  {isRewardFreeItem(item) ? ' - Gratuit' : ''}
                                </span>
                                <strong>{isRewardFreeItem(item) ? '0 MAD' : formatPrice(item.price * item.quantity)}</strong>
                              </li>
                            ))}
                            {order.items.length > 3 && (
                              <li>
                                <span>+{order.items.length - 3} autre(s)</span>
                                <strong />
                              </li>
                            )}
                          </ul>
                          {order.rewardNote && <p className="server-reward-note">{order.rewardNote}</p>}
                          {getOrderDiscountAmount(order) > 0 && (
                            <div className="server-card-total-line server-card-total-subline">
                              <span>Sous-total</span>
                              <strong>{formatPrice(getOrderSubtotal(order))}</strong>
                            </div>
                          )}
                          {getOrderDiscountAmount(order) > 0 && (
                            <div className="server-card-total-line server-card-total-discount">
                              <span>Reduction</span>
                              <strong>-{formatPrice(getOrderDiscountAmount(order))}</strong>
                            </div>
                          )}
                          <div className="server-card-total-line">
                            <span>Total final</span>
                            <strong>{formatPrice(order.total)}</strong>
                          </div>
                          {orderCanBePaid && (
                            <div className="server-payment-method-choice server-card-payment-methods">
                              {['Especes', 'Carte', 'Digital'].map((method) => (
                                <button
                                  className={selectedPaymentMethod === method ? 'is-active' : ''}
                                  key={`${order.id}-${method}`}
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setPaymentMethods((current) => ({
                                      ...current,
                                      [order.id]: method,
                                    }));
                                  }}
                                >
                                  {method}
                                </button>
                              ))}
                            </div>
                          )}
                          <button
                            className="btn btn-primary"
                            disabled={
                              orderWaitsValidation ||
                              (orderCanBePaid &&
                                (!selectedPaymentMethod ||
                                  !order.items?.length ||
                                  Number(order.total || 0) <= 0))
                            }
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              if (orderWaitsValidation) return;
                              if (orderCanBePaid) {
                                runPrimaryOrderAction(order);
                                return;
                              }
                              serveOrder(order.id);
                            }}
                          >
                            {actionLabel}
                          </button>
                          {orderCanBePaid && isPrimaryActionDisabled(order) && (
                            <small className="server-disabled-help">
                              Choisissez un mode de paiement pour encaisser.
                            </small>
                          )}
                          {orderWaitsValidation && (
                            <small className="server-disabled-help">
                              Le serveur doit d'abord valider cette commande.
                            </small>
                          )}
                          {!orderCanBePaid && !orderWaitsValidation && (
                            <small className="server-disabled-help">
                              Commande active. Marquez-la servie pour passer a l'encaissement.
                            </small>
                          )}
                        </article>
                        );
                      })}
                          </div>
                        </section>
                      )}
                    </div>
                    <BillingDaySummary
                      billRequestCount={paymentOrdersWithBillRequestCount}
                      pendingPaymentCount={paymentOrdersWithBillInfo.length}
                      paidOrders={paidOrders}
                    />
                  </div>
                </section>
              )}

              {activeServerView === 'menu' && (
                <section className="server-dashboard-section server-menu-section" id="manual-order">
                  <div className="server-section-title">
                    <div>
                      <h2>Nouvelle commande</h2>
                      <p>Creez une nouvelle commande pour un client.</p>
                    </div>
                  </div>

                  <div className="server-form-grid server-manual-fields">
                    <label className="field">
                      Table
                      <input
                        onChange={(event) =>
                          setServerOrder((currentOrder) => ({
                            ...currentOrder,
                            table: event.target.value,
                          }))
                        }
                        placeholder="Ex: 4"
                        type="number"
                        value={serverOrder.table}
                      />
                    </label>

                    <label className="field">
                      Nom client
                      <input
                        onChange={(event) =>
                          setServerOrder((currentOrder) => ({
                            ...currentOrder,
                            clientName: event.target.value,
                          }))
                        }
                        type="text"
                        value={serverOrder.clientName}
                      />
                    </label>

                    <label className="field server-comment-field">
                      Commentaire sur l'ordre
                      <textarea
                        onChange={(event) =>
                          setServerOrder((currentOrder) => ({
                            ...currentOrder,
                            comment: event.target.value,
                          }))
                        }
                        placeholder="Ex: allergie, cuisson, demande speciale..."
                        value={serverOrder.comment}
                      />
                    </label>
                  </div>

                  <div className="server-category-row">
                    {serverCategories.map((category) => (
                      <button
                        className={activeServerCategory === category ? 'is-active' : ''}
                        key={category}
                        type="button"
                        onClick={() => setActiveServerCategory(category)}
                      >
                        {category}
                      </button>
                    ))}
                  </div>

                  <div className="server-food-grid">
                    {filteredServerProducts.map((product) => {
                      const quantity = getServerItemQuantity(product.id);

                      return (
                        <article
                          className={`server-food-card ${product.available === false ? 'server-food-card-unavailable' : ''}`}
                          key={product.id}
                        >
                          <div
                            className="server-food-image"
                            style={{ backgroundImage: product.image ? `url("${product.image}")` : undefined }}
                          />
                          <div className="server-food-body">
                            <small>{product.category}</small>
                            <strong>{product.name}</strong>
                            {product.available === false && (
                              <small className="server-product-unavailable">
                                {product.unavailableReason || 'Indisponible temporairement'}
                              </small>
                            )}
                            <span>{formatPrice(product.price)}</span>
                          </div>
                          <div className="quantity-actions">
                            <button
                              disabled={quantity === 0 || product.available === false}
                              type="button"
                              onClick={() => updateServerOrderItem(product, -1)}
                            >
                              -
                            </button>
                            <span>{quantity}</span>
                            <button
                              disabled={product.available === false}
                              type="button"
                              onClick={() => updateServerOrderItem(product, 1)}
                            >
                              +
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  <div className="server-manual-summary">
                    <div>
                      <span>Commande serveur</span>
                      <strong>
                        {serverOrder.table
                          ? `Table ${serverOrder.table}`
                          : 'Aucune table selectionnee'}
                      </strong>
                      <small>
                        {serverOrder.items.length} article(s) - {formatPrice(serverOrderTotal)} -{' '}
                        {serverOrderPoints} point(s)
                      </small>
                      {!canSubmitServerOrder && (
                        <small className="server-disabled-help">
                          Selectionnez une table et ajoutez au moins un article.
                        </small>
                      )}
                    </div>
                    <button
                      className="btn btn-primary"
                      disabled={!canSubmitServerOrder}
                      type="button"
                      onClick={submitServerOrder}
                    >
                      Valider commande
                    </button>
                  </div>
                </section>
              )}

              {activeServerView === 'history' && (
                <section className="server-dashboard-section" id="history">
                  <div className="server-section-title">
                    <div>
                      <h2>Historique</h2>
                      <p>Commandes confirmees, annulees ou payees pendant le service.</p>
                    </div>
                  </div>

                  <div className="server-history-toolbar">
                    <div className="server-filter-pills server-history-filters">
                      {[
                        ['all', 'Toutes'],
                        ['confirmed', 'Confirmees'],
                        ['paid', 'Payees'],
                        ['cancelled', 'Annulees'],
                      ].map(([filter, label]) => (
                        <button
                          className={historyFilter === filter ? 'is-active' : ''}
                          key={filter}
                          type="button"
                          onClick={() => setHistoryFilter(filter)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <label className="server-history-search">
                      Recherche
                      <select
                        onChange={(event) => setHistorySearchType(event.target.value)}
                        value={historySearchType}
                      >
                        <option value="table">Par numero de table</option>
                        <option value="order">Par numero de commande</option>
                      </select>
                      <input
                        onChange={(event) => setHistorySearch(event.target.value)}
                        placeholder={
                          historySearchType === 'order'
                            ? 'Ex: ORD-2026...'
                            : 'Ex: 1'
                        }
                        type="search"
                        value={historySearch}
                      />
                    </label>
                  </div>

                  <div className="history-list server-history-grid">
                    {filteredHistoryOrders.length === 0 && (
                      <p className="empty-state">Aucune commande trouvee.</p>
                    )}
                    {filteredHistoryOrders.map((order) => (
                      <HistoryOrderCard
                        key={order.id}
                        onReprint={() => reprintHistoryBill(order)}
                        order={order}
                        selected={selectedOrder?.id === order.id}
                        onSelect={() => setSelectedOrderId(order.id)}
                      />
                    ))}
                  </div>
                </section>
              )}
            </section>

            {showSelectedOrderPanel && (
              <aside className="server-payment-panel" id="billing">
                <SelectedOrderPanel
                  order={selectedOrder}
                  billRequest={selectedBillRequest}
                  menuCatalog={menuCatalog}
                  primaryDisabled={isPrimaryActionDisabled(selectedOrder)}
                  onEditItem={editPendingOrderItem}
                  onPrimary={() => runPrimaryOrderAction(selectedOrder)}
                  onAddReplacement={() => openReplacementOrder(selectedOrder)}
                  onCancelOrder={() => selectedOrder && openCancelDialog(selectedOrder)}
                  onReject={() => selectedOrder && openCancelDialog(selectedOrder)}
                  onPaymentMethodChange={(orderId, method) =>
                    setPaymentMethods((current) => ({
                      ...current,
                      [orderId]: method,
                    }))
                  }
                  onServerCommentChange={(orderId, value) =>
                    setServerComments((current) => ({
                      ...current,
                      [orderId]: value,
                    }))
                  }
                  paymentMethod={selectedOrder ? getSelectedPaymentMethod(paymentMethods, selectedOrder) : ''}
                  serverComments={serverComments}
                />
              </aside>
            )}
          </div>
        </section>
      </div>

      {cancelDialog && (
        <ServerCancelDialog
          error={serverActionError}
          onClose={closeCancelDialog}
          onReasonChange={setCancelReason}
          onSubmit={submitCancelDialog}
          order={cancelDialog}
          reason={cancelReason}
        />
      )}

      {activeTicket && (
        <section className="print-ticket" aria-label="Ticket addition">
          <div className="ticket-brand">
            <span>POS2</span>
            <h2>Restaurant</h2>
            <p>Ticket d'addition</p>
          </div>

          <div className="ticket-meta">
            <div>
              <span>Table</span>
              <strong>{activeTicket.table}</strong>
            </div>
            <div>
              <span>Commande</span>
              <strong>{activeTicket.orderId}</strong>
            </div>
            <div>
              <span>Date</span>
              <strong>{formatTicketDate(activeTicket.createdAt)}</strong>
            </div>
          </div>

          <div className="ticket-divider" />
          {(activeTicket.items || []).map((item) => (
            <div className="ticket-row" key={`ticket-${activeTicket.orderId}-${item.id}`}>
              <div>
                <strong>{item.name}</strong>
                <span>
                  {item.quantity} x {formatPrice(item.price)}
                </span>
                {isRewardFreeItem(item) && <small className="ticket-free-tag">Gratuit</small>}
              </div>
              <strong>{isRewardFreeItem(item) ? '0 MAD' : formatPrice(item.price * item.quantity)}</strong>
            </div>
          ))}
          <div className="ticket-divider" />
          {Number(activeTicket.discountAmount || 0) > 0 && (
            <>
              <div className="ticket-row">
                <span>Sous-total</span>
                <strong>{formatPrice(activeTicket.subtotal || activeTicket.total)}</strong>
              </div>
              <div className="ticket-row">
                <span>{activeTicket.rewardNote || 'Reduction fidelite'}</span>
                <strong>-{formatPrice(activeTicket.discountAmount)}</strong>
              </div>
            </>
          )}
          <div className="ticket-row ticket-total">
            <span>Total</span>
            <strong>{formatPrice(activeTicket.total)}</strong>
          </div>
          <div className="ticket-row">
            <span>Mode paiement</span>
            <strong>{activeTicket.paymentMethod || 'Especes'}</strong>
          </div>
          {activeTicket.comment && (
            <p className="ticket-note">Note client : {activeTicket.comment}</p>
          )}
          {activeTicket.rewardNote && (
            <p className="ticket-note">Fidelite : {activeTicket.rewardNote}</p>
          )}
          <p className="ticket-footer">Merci pour votre visite.</p>
        </section>
      )}
    </main>
  );
}

function BillingDaySummary({ billRequestCount, pendingPaymentCount, paidOrders }) {
  const todayPaidOrders = paidOrders.filter((order) => isSameLocalDay(getOrderActivityDate(order)));
  const paidCount = todayPaidOrders.length;
  const totalPaid = todayPaidOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);

  return (
    <aside className="server-billing-summary-card" aria-label="Apercu du jour">
      <header>
        <div>
          <span className="server-summary-eyebrow">Apercu du jour</span>
          <h2>Paiement</h2>
        </div>
        <span className="server-summary-live-dot" aria-hidden="true" />
      </header>

      <div className="server-summary-stat-list">
        <div className="server-summary-stat">
          <span className="server-summary-icon server-summary-icon-blue" aria-hidden="true">+</span>
          <div>
            <small>Demandes d'addition</small>
            <strong>{billRequestCount}</strong>
          </div>
        </div>
        <div className="server-summary-stat">
          <span className="server-summary-icon server-summary-icon-green" aria-hidden="true">MAD</span>
          <div>
            <small>A encaisser</small>
            <strong>{pendingPaymentCount}</strong>
          </div>
        </div>
        <div className="server-summary-stat">
          <span className="server-summary-icon server-summary-icon-teal" aria-hidden="true">OK</span>
          <div>
            <small>Payees aujourd'hui</small>
            <strong>{paidCount}</strong>
          </div>
        </div>
      </div>

      <section className="server-summary-total">
        <span>Total encaisse</span>
        <strong>{formatPrice(totalPaid)}</strong>
        <small>Aujourd'hui</small>
      </section>

      <section className="server-summary-tip">
        <div className="server-summary-wallet" aria-hidden="true">
          <span />
        </div>
        <strong>Encaissement rapide</strong>
        <p>Selectionnez une commande, choisissez le mode de paiement, puis encaissez en un geste.</p>
      </section>
    </aside>
  );
}

function ServerCancelDialog({ error, onClose, onReasonChange, onSubmit, order, reason }) {
  const suggestions = ['Client absent', 'Erreur de commande', 'Produit indisponible', 'Demande client'];

  return (
    <div className="server-modal-backdrop" role="presentation">
      <section aria-modal="true" className="server-cancel-modal" role="dialog">
        <header>
          <span>Refus commande</span>
          <h2>Saisir motif</h2>
          <p>
            Table {order.table} - {order.id}. Le motif sera visible dans le dashboard admin.
          </p>
        </header>

        <div className="server-cancel-suggestions">
          {suggestions.map((suggestion) => (
            <button key={suggestion} onClick={() => onReasonChange(suggestion)} type="button">
              {suggestion}
            </button>
          ))}
        </div>

        <label>
          Motif obligatoire
          <textarea
            autoFocus
            onChange={(event) => onReasonChange(event.target.value)}
            placeholder="Ex: le client a change d'avis, doublon, produit indisponible..."
            value={reason}
          />
        </label>

        {error ? <p className="server-cancel-modal-error">{error}</p> : null}

        <footer>
          <button className="btn btn-secondary" onClick={onClose} type="button">
            Fermer
          </button>
          <button className="btn btn-danger" disabled={!reason.trim()} onClick={onSubmit} type="button">
            Refuser commande
          </button>
        </footer>
      </section>
    </div>
  );
}

function ServerOrderCard({
  order,
  slotInfo,
  readySinceLabel,
  readySinceTone,
  selected,
  primaryDisabled,
  onPrimary,
  onReject,
  onSelect,
  compactPickup = false,
}) {
  const stage = getOrderStage(order);
  const visibleItems = order.items.slice(0, compactPickup ? 2 : 3);
  const discountAmount = getOrderDiscountAmount(order);
  const slotAccent = slotInfo ? normalizeSlotAccent(slotInfo.color) : '#5f6f6a';
  const slotLabel = slotInfo?.colorName || slotInfo?.color || 'Slot attribue';
  const incidentItems = getKitchenIncidentItems(order);
  const kitchenCancelled = isKitchenCancelledOrder(order);
  const cancellationReason = getOrderCancellationReason(order);

  const isCompactPickupCard = stage === 'pickup' && compactPickup;

  return (
    <article
      className={`server-compact-order-card status-card-${stage} ${
        stage === 'pickup' ? 'server-ready-pickup-card' : ''
      } ${isCompactPickupCard ? 'server-ready-pickup-card-compact' : ''} ${
        selected ? 'is-selected' : ''
      }`}
      style={{ '--slot-accent': slotAccent }}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onSelect();
      }}
      tabIndex={0}
    >
      <header className="server-compact-card-header">
        <div>
          <span>Table</span>
          <strong>{order.table}</strong>
        </div>
        <span className={`status-badge status-${stage}`}>{getStatusLabel(order.status)}</span>
      </header>

      <p className="server-order-id">{order.id}</p>

      {kitchenCancelled ? (
        <div className="server-order-incident-alert server-order-cancel-alert">
          <strong>{order.id} annulee par la cuisine</strong>
          <span>{cancellationReason || 'Motif non precise'}</span>
        </div>
      ) : incidentItems.length > 0 && (
        <div className="server-order-incident-alert">
          <strong>Incident cuisine</strong>
          <span>{getKitchenIncidentLabel(order)} - client a consulter</span>
        </div>
      )}

      {stage === 'pickup' && !isCompactPickupCard ? (
        <>
          <div className="server-ready-meta">
            <div className="server-ready-slot" style={{ '--slot-accent': slotAccent }}>
              <span>Table a servir</span>
              <strong>Table {order.table}</strong>
            </div>
            <div
              className="server-ready-slot-badge"
              style={{ '--slot-accent': slotAccent }}
            >
              <span>{slotInfo ? `Slot ${slotInfo.number}` : 'Slot'}</span>
              <strong>{slotLabel}</strong>
            </div>
          </div>

          <p className={`server-ready-timer server-ready-timer-${readySinceTone || 'fresh'}`}>
            {readySinceLabel}
          </p>
        </>
      ) : null}

      {isCompactPickupCard ? (
        <div className="server-ready-inline-summary">
          <div className="server-ready-inline-slot" style={{ '--slot-accent': slotAccent }}>
            <span>{slotInfo ? `Slot ${slotInfo.number}` : 'Slot'}</span>
            <strong>{slotLabel}</strong>
          </div>
          <p className={`server-ready-timer server-ready-timer-${readySinceTone || 'fresh'}`}>
            {readySinceLabel}
          </p>
        </div>
      ) : null}

      <ul className="server-compact-items">
        {visibleItems.map((item, index) => {
          const itemHasIncident = isKitchenIncidentItem(item);

          return (
            <li
              className={itemHasIncident ? 'server-line-cancelled' : ''}
              key={`${order.id}-${item.id}-${index}`}
            >
              <span className="server-order-line-text">
                {itemHasIncident ? (
                  <span className="server-incident-line-icon" aria-hidden="true">
                    !
                  </span>
                ) : null}
                <span>
                  {item.quantity}x {item.name}
                  {isRewardFreeItem(item) ? ' - Gratuit' : ''}
                  {itemHasIncident
                    ? ` - Annule (${item.cancellationReason || 'motif cuisine'})`
                    : ''}
                </span>
              </span>
            </li>
          );
        })}

        {order.items.length > visibleItems.length && (
          <li>
            <span>+{order.items.length - visibleItems.length} autre(s)</span>
          </li>
        )}
      </ul>

      {order.rewardNote && <p className="server-reward-note">{order.rewardNote}</p>}

      {discountAmount > 0 && (
        <div className="server-card-total-line server-card-total-subline">
          <span>Sous-total</span>
          <strong>{formatPrice(getOrderSubtotal(order))}</strong>
        </div>
      )}

      {discountAmount > 0 && (
        <div className="server-card-total-line server-card-total-discount">
          <span>Reduction</span>
          <strong>-{formatPrice(discountAmount)}</strong>
        </div>
      )}

      <div className="server-card-total-line">
        <span>Total final</span>
        <strong>{formatPrice(order.total)}</strong>
      </div>

      <div className="server-card-actions">
        {stage === 'kitchen' ? (
          <div className="server-kitchen-state">
            <span className="status-badge status-kitchen">En cuisine</span>
            <p>En preparation cote cuisine.</p>
          </div>
        ) : (
          <button
            className={`btn ${stage === 'validate' ? 'btn-success' : 'btn-primary'}`}
            disabled={primaryDisabled}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onPrimary();
            }}
          >
            {stage === 'pickup' ? 'Servir la table' : getPrimaryActionLabel(order)}
          </button>
        )}

        {stage === 'validate' && (
          <button
            className="btn btn-danger"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onReject();
            }}
          >
            Refuser
          </button>
        )}
      </div>
    </article>
  );
}

function SelectedOrderPanel({
  order,
  billRequest,
  menuCatalog = [],
  primaryDisabled,
  onEditItem,
  onPrimary,
  onAddReplacement,
  onCancelOrder,
  onReject,
  onPaymentMethodChange,
  onServerCommentChange,
  paymentMethod,
  serverComments,
}) {
  if (!order) {
    return (
      <section className="server-payment-card server-selected-order-card">
        <div className="server-empty-panel">
          <span>Selection</span>
          <h2>Aucune commande</h2>
          <p>Choisis une commande dans la file pour afficher ses details ici.</p>
        </div>
      </section>
    );
  }

  const stage = getOrderStage(order);
  const billReady = isServedOrder(order);
  const orderedProductIds = new Set(order.items.filter((item) => !item.isRewardItem).map((item) => item.id));
  const productsToAdd = menuCatalog.filter((product) => !orderedProductIds.has(product.id));
  const discountAmount = getOrderDiscountAmount(order);
  const incidentItems = getKitchenIncidentItems(order);
  const orderHasIncident = incidentItems.length > 0;

  return (
    <section className="server-payment-card server-selected-order-card">
      <header className="server-selected-heading">
        <div>
          <span>Commande selectionnee</span>
          <h2>Table {order.table}</h2>
          <p>{order.id}</p>
        </div>
        <span className={`status-badge status-${stage}`}>{getStatusLabel(order.status)}</span>
      </header>

      <div className="server-panel-section">
        <h3>Articles</h3>
        <div className="server-payment-items">
          {order.items.map((item, index) => {
            const itemHasIncident = isKitchenIncidentItem(item);

            return (
            <div
              className={`payment-item-row ${itemHasIncident ? 'server-line-cancelled' : ''}`}
              key={`selected-${order.id}-${item.id}-${index}`}
            >
              <div>
                <strong className="server-order-line-text">
                  {itemHasIncident ? <span className="server-incident-line-icon" aria-hidden="true">!</span> : null}
                  <span>{item.name}</span>
                </strong>
                <span>
                  {item.quantity} x {formatPrice(item.price)}
                </span>
                {isRewardFreeItem(item) && <small className="server-item-inline-tag">Gratuit</small>}
                {itemHasIncident && (
                  <small className="server-item-inline-tag server-item-cancelled-tag">
                    Annule cuisine: {item.cancellationReason || 'motif non precise'}
                  </small>
                )}
              </div>
              <strong>{isRewardFreeItem(item) ? '0 MAD' : formatPrice(item.price * item.quantity)}</strong>
            </div>
            );
          })}
        </div>
        {order.rewardNote && <p className="server-reward-note">{order.rewardNote}</p>}
      </div>

      {orderHasIncident && (
        <section className="server-incident-panel">
          <div>
            <span>Incident cuisine</span>
            <h3>Decision client requise</h3>
            <p>
              La cuisine a retire un article. Le total est deja recalcule. Consulte le
              client avant de continuer le service.
            </p>
          </div>
          <ul>
            {incidentItems.map((item, index) => (
              <li key={`incident-line-${order.id}-${item.id}-${index}`}>
                <strong className="server-order-line-text">
                  <span className="server-incident-line-icon" aria-hidden="true">!</span>
                  <span>{item.name}</span>
                </strong>
                <span>
                  {item.quantity} x annule - {item.cancellationReason || 'motif cuisine'}
                </span>
              </li>
            ))}
          </ul>
          <div className="server-incident-actions">
            <button className="btn btn-secondary" type="button" onClick={onAddReplacement}>
              Remplacer article
            </button>
            <button className="btn btn-danger" type="button" onClick={onCancelOrder}>
              Annuler commande
            </button>
          </div>
          <small>
            Si le client accepte la suppression, aucune action supplementaire n'est necessaire:
            l'addition utilise deja le nouveau total.
          </small>
        </section>
      )}

      {stage === 'validate' && (
        <details className="server-panel-edit-card">
          <summary>
            <span>Modifier avant confirmation</span>
            <small>Verifier a table puis ajuster la commande.</small>
          </summary>

          <div className="server-edit-section">
            <strong className="server-edit-title">Articles dans la commande</strong>
            <div className="server-edit-current-list">
              {order.items.map((item) => {
                const product = menuCatalog.find((menuProduct) => menuProduct.id === item.id) || item;

                return (
                  <div className="server-edit-current-row" key={`edit-current-${order.id}-${item.id}`}>
                    <div>
                      <strong>{item.name}</strong>
                      <span>
                        {item.quantity} x {formatPrice(item.price)}
                      </span>
                      {product.available === false && (
                        <small className="server-product-unavailable">
                          {product.unavailableReason || 'Indisponible temporairement'}
                        </small>
                      )}
                      {isRewardFreeItem(item) && <small className="server-item-inline-tag">Gratuit</small>}
                    </div>
                    {isRewardFreeItem(item) ? (
                      <strong className="server-item-inline-tag">Offert</strong>
                    ) : (
                      <div className="quantity-actions server-edit-quantity">
                        <button
                          aria-label={`Retirer ${item.name}`}
                          disabled={item.quantity === 0}
                          type="button"
                          onClick={() => onEditItem(order, product, -1)}
                        >
                          -
                        </button>
                        <span>{item.quantity}</span>
                        <button
                          aria-label={`Ajouter ${item.name}`}
                          disabled={product.available === false}
                          type="button"
                          onClick={() => onEditItem(order, product, 1)}
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {productsToAdd.length > 0 && (
            <div className="server-edit-section">
              <strong className="server-edit-title">Ajouter un article</strong>
              <div className="server-edit-add-list">
                {productsToAdd.map((product) => (
                  <div className="server-edit-add-row" key={`edit-add-${order.id}-${product.id}`}>
                    <div>
                      <strong>{product.name}</strong>
                      <span>
                        {formatPrice(product.price)} - {product.points} pts
                      </span>
                      {product.available === false && (
                        <small className="server-product-unavailable">
                          {product.unavailableReason || 'Indisponible temporairement'}
                        </small>
                      )}
                    </div>
                    <button
                      className="btn btn-secondary server-edit-add-button"
                      disabled={product.available === false}
                      type="button"
                      onClick={() => onEditItem(order, product, 1)}
                    >
                      {product.available === false ? 'Indisponible' : 'Ajouter'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </details>
      )}

      <label className="field server-panel-comment">
        Commentaire serveur
        <textarea
          onChange={(event) => onServerCommentChange(order.id, event.target.value)}
          placeholder="Ex: client confirme sans oignon, remplacer jus..."
          value={serverComments[order.id] || ''}
        />
      </label>

      <div className="payment-summary server-panel-summary">
        {discountAmount > 0 && (
          <div>
            <span>Sous-total</span>
            <strong>{formatPrice(getOrderSubtotal(order))}</strong>
          </div>
        )}
        {discountAmount > 0 && (
          <div>
            <span>Reduction</span>
            <strong>-{formatPrice(discountAmount)}</strong>
          </div>
        )}
        <div>
          <span>Total final</span>
          <strong>{formatPrice(order.total)}</strong>
        </div>
        <div>
          <span>Mode paiement</span>
          <strong>{paymentMethod || (billReady ? 'A choisir' : 'A definir')}</strong>
        </div>
      </div>

      {stage === 'payment' && (
        <div className="server-payment-method-choice" aria-label="Mode de paiement">
          {['Especes', 'Carte', 'Digital'].map((method) => (
            <button
              className={paymentMethod === method ? 'is-active' : ''}
              key={method}
              type="button"
              onClick={() => onPaymentMethodChange(order.id, method)}
            >
              {method}
            </button>
          ))}
        </div>
      )}

      {stage === 'kitchen' && !orderHasIncident && (
        <p className="server-card-note">
          Commande en preparation. Aucune action serveur pour le moment.
        </p>
      )}

      {stage === 'kitchen' && orderHasIncident && (
        <p className="server-card-note server-card-note-warning">
          Action serveur: consulter le client pour remplacer, supprimer ou annuler.
        </p>
      )}

      {stage === 'payment' && primaryDisabled && (
        <p className="server-disabled-help">Choisissez un mode de paiement pour encaisser.</p>
      )}

      <div className="server-payment-actions selected-panel-actions">
        {stage !== 'kitchen' && (
          <button
            className={`btn ${stage === 'validate' ? 'btn-success' : 'btn-primary'}`}
            disabled={primaryDisabled}
            type="button"
            onClick={onPrimary}
          >
            {getPrimaryActionLabel(order)}
          </button>
        )}
        {stage === 'validate' && (
          <button className="btn btn-danger" type="button" onClick={onReject}>
            Refuser
          </button>
        )}
      </div>
    </section>
  );
}

function HistoryOrderCard({ order, selected, onSelect, onReprint }) {
  const stage = getOrderStage(order);
  const canReprint = isPaidOrder(order) && Boolean(order.items?.length);
  const discountAmount = getOrderDiscountAmount(order);
  const statusClass =
    order.status === 'Payee'
      ? 'history-paid'
      : order.status === 'Annulee par le serveur'
        ? 'history-cancelled'
        : stage === 'kitchen'
          ? 'history-kitchen'
          : 'history-confirmed';

  return (
    <article
      className={`history-card server-history-card ${selected ? 'is-selected' : ''}`}
      onClick={onSelect}
    >
      <header className="server-history-card-header">
        <div>
          <span>Table</span>
          <strong>{order.table}</strong>
        </div>
        <span className={`history-status-badge ${statusClass}`}>
          {getStatusLabel(order.status)}
        </span>
      </header>

      <div className="server-history-meta">
        <span>{order.id}</span>
        <span>{formatTicketDate(order.updatedAt || order.createdAt)}</span>
      </div>

      <ul className="server-history-items">
        {order.items.map((item) => (
          <li key={`history-${order.id}-${item.id}`}>
            <span>
              {item.quantity}x {item.name}
              {isRewardFreeItem(item) ? ' - Gratuit' : ''}
            </span>
            <strong>{isRewardFreeItem(item) ? '0 MAD' : formatPrice(item.price * item.quantity)}</strong>
          </li>
        ))}
      </ul>
      {order.rewardNote && <p className="server-reward-note">{order.rewardNote}</p>}
      {discountAmount > 0 && (
        <div className="server-card-total-line server-card-total-subline">
          <span>Sous-total</span>
          <strong>{formatPrice(getOrderSubtotal(order))}</strong>
        </div>
      )}
      {discountAmount > 0 && (
        <div className="server-card-total-line server-card-total-discount">
          <span>Reduction</span>
          <strong>-{formatPrice(discountAmount)}</strong>
        </div>
      )}

      <div className="server-card-total-line">
        <span>Total final</span>
        <strong>{formatPrice(order.total)}</strong>
      </div>
      {canReprint && (
        <div className="server-history-actions">
          <button
            className="btn btn-secondary"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onReprint?.();
            }}
          >
            Reimprimer l'addition
          </button>
        </div>
      )}
    </article>
  );
}

export default ServerPage;
