import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ADMIN_AUTH_STORAGE_KEY,
  ADMIN_REFRESH_TIMEOUT_MS,
  cancelAdminOrderApi,
  createAdminMenuItemApi,
  createAdminRewardApi,
  createAdminStaffApi,
  createApiSlot,
  createApiTable,
  deactivateAdminUserApi,
  deleteAdminMenuItemPermanentApi,
  deleteAdminRewardApi,
  deleteAdminStaffApi,
  deleteAdminStaffPermanentApi,
  deleteAdminUserPermanentApi,
  deleteApiSlot,
  deleteApiTable,
  deleteApiTablePermanent,
  fetchAdminDashboardApi,
  fetchAdminMenuApi,
  fetchAdminRewardsApi,
  fetchAdminStaffApi,
  fetchAdminTablesApi,
  fetchAdminUsersApi,
  fetchApiOrders,
  fetchApiSlots,
  fetchRestaurantStateApi,
  forceFreeApiSlot,
  loginApi,
  reopenAdminPaymentApi,
  subscribeRealtime,
  updateAdminMenuItemApi,
  updateAdminRewardApi,
  updateAdminStaffApi,
  updateApiSlot,
  updateApiTable,
  updateRestaurantStateApi,
} from '../../utils/api';
import { formatPrice } from '../../utils/format';
import heroImage from '../../assets/hero.png';

const tabs = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'menu', label: 'Menu', icon: 'menu' },
  { id: 'stock', label: 'Stock', icon: 'stock' },
  { id: 'tables', label: 'Tables & QR', icon: 'qr' },
  { id: 'staff', label: 'Staff', icon: 'staff' },
  { id: 'users', label: 'Clients', icon: 'users' },
  { id: 'rewards', label: 'Recompenses', icon: 'reward' },
  { id: 'slots', label: 'Slots', icon: 'slots' },
  { id: 'state', label: 'Etat restaurant', icon: 'state' },
  { id: 'emergency', label: 'Corrections', icon: 'alert' },
];

function AdminIcon({ name, className = '' }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 2,
    viewBox: '0 0 24 24',
  };

  const paths = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </>
    ),
    menu: (
      <>
        <path d="M4 7h16" />
        <path d="M4 12h16" />
        <path d="M4 17h11" />
      </>
    ),
    stock: (
      <>
        <path d="M4 8l8-4 8 4-8 4-8-4z" />
        <path d="M4 8v8l8 4 8-4V8" />
        <path d="M12 12v8" />
      </>
    ),
    qr: (
      <>
        <rect x="4" y="4" width="6" height="6" rx="1" />
        <rect x="14" y="4" width="6" height="6" rx="1" />
        <rect x="4" y="14" width="6" height="6" rx="1" />
        <path d="M14 14h2v2h-2z" />
        <path d="M18 14h2v6h-6v-2" />
      </>
    ),
    staff: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-8 0v2" />
        <circle cx="12" cy="7" r="4" />
        <path d="M19 8v6" />
        <path d="M22 11h-6" />
      </>
    ),
    users: (
      <>
        <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
        <circle cx="10" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    reward: (
      <>
        <path d="M20 12v8H4v-8" />
        <path d="M2 7h20v5H2z" />
        <path d="M12 7v13" />
        <path d="M12 7H8.5A2.5 2.5 0 1 1 11 4.5L12 7z" />
        <path d="M12 7h3.5A2.5 2.5 0 1 0 13 4.5L12 7z" />
      </>
    ),
    slots: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <path d="M9 5v14" />
        <path d="M15 5v14" />
      </>
    ),
    state: (
      <>
        <path d="M12 2v10" />
        <path d="M18.4 6.6a9 9 0 1 1-12.8 0" />
      </>
    ),
    alert: (
      <>
        <path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </>
    ),
  };

  return (
    <svg className={`admin-icon ${className}`} aria-hidden="true" {...common}>
      {paths[name] || paths.dashboard}
    </svg>
  );
}

const imagePresets = [
  heroImage,
  'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1605621234603-421e591840cd?auto=format&fit=crop&w=900&q=80',
];

const emptyMenuDraft = {
  id: null,
  name: '',
  category: 'Burgers',
  price: 0,
  points: 0,
  station: 'Plats',
  description: '',
  details: '',
  imageUrl: imagePresets[0],
  available: true,
  stockQuantity: '',
  unavailableReason: '',
};

const emptyTableDraft = {
  id: null,
  number: 1,
  active: true,
  status: 'AVAILABLE',
  qrUrl: '',
};

const emptyStaffDraft = {
  id: null,
  name: '',
  phone: '',
  password: '',
  role: 'WAITER',
  assignedTables: '',
  active: true,
};

const emptyRewardDraft = {
  id: null,
  name: '',
  description: '',
  pointsCost: 40,
  type: 'FREE_ITEM',
  discountPercent: '',
  active: true,
};

const emptySlotDraft = {
  id: null,
  number: 1,
  color: '#bb4639',
  colorName: 'Rouge',
  zone: 'KITCHEN',
};

const slotColorFallbacks = {
  rouge: '#bb4639',
  bleu: '#23545b',
  vert: '#207f5c',
  jaune: '#c76b42',
};

function normalizeSlotColor(color) {
  const value = String(color || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(value)) {
    return value;
  }
  return slotColorFallbacks[value.toLowerCase()] || '#5f6f6a';
}

function parseAssignedTableNumbers(assignedTables) {
  return String(assignedTables || '')
    .split(',')
    .map((tableNumber) => tableNumber.trim())
    .filter(Boolean);
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

function isSameLocalMonth(dateValue, referenceDate = new Date()) {
  if (!dateValue) return false;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;

  return date.getFullYear() === referenceDate.getFullYear() && date.getMonth() === referenceDate.getMonth();
}

function getStaffPaidOrders(member, paidOrders) {
  const assignedTables = parseAssignedTableNumbers(member.assignedTables);
  const isWaiter = member.role === 'WAITER';

  if (!isWaiter) return [];
  if (assignedTables.length === 0) return paidOrders;

  return paidOrders.filter((order) => assignedTables.includes(String(order.table)));
}

function getStaffRevenueStats(member, paidOrders) {
  const memberPaidOrders = getStaffPaidOrders(member, paidOrders);
  const todayOrders = memberPaidOrders.filter((order) => isSameLocalDay(getOrderActivityDate(order)));
  const monthOrders = memberPaidOrders.filter((order) => isSameLocalMonth(getOrderActivityDate(order)));

  return {
    todayTotal: todayOrders.reduce((sum, order) => sum + Number(order.total || 0), 0),
    monthTotal: monthOrders.reduce((sum, order) => sum + Number(order.total || 0), 0),
    todayCount: todayOrders.length,
    monthCount: monthOrders.length,
  };
}

function getStoredAdminAuth() {
  const rawAuth = sessionStorage.getItem(ADMIN_AUTH_STORAGE_KEY);
  if (!rawAuth) {
    return {
      name: 'admin',
      phone: '0601010101',
      role: 'ADMIN',
    };
  }

  try {
    return JSON.parse(rawAuth);
  } catch {
    return {
      name: 'admin',
      phone: '0601010101',
      role: 'ADMIN',
    };
  }
}

function getQrImageUrl(url) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=12&data=${encodeURIComponent(url)}`;
}

function getDefaultTableMenuUrl(tableNumber) {
  return `${window.location.origin}/menu?table=${tableNumber || 1}`;
}

function getTableQrUrl(table) {
  return table?.qrUrl || getDefaultTableMenuUrl(table?.number || 1);
}

function orderStatusLabel(status) {
  const labels = {
    'En attente de validation serveur': 'A valider',
    'Confirmee par le serveur': 'En cuisine',
    'Prete / pickup': 'Prete',
    Servie: 'Servie',
    Payee: 'Payee',
    'Annulee par le serveur': 'Annulee',
  };

  return labels[status] || status;
}

function isCancelledAdminOrder(order) {
  const status = String(order?.status || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  return status.includes('annule') || status === 'cancelled';
}

function getAdminCancellationReason(order) {
  const serverComment = String(order?.serverComment || '').trim();
  if (serverComment) return serverComment;

  const itemReason = (order?.items || []).find((item) => item.cancellationReason)?.cancellationReason;
  return itemReason || 'Motif non precise';
}

function getCancellationSource(order) {
  const reason = getAdminCancellationReason(order).toLowerCase();
  if (reason.includes('cuisine')) return 'Cuisine';
  if (String(order?.status || '').toLowerCase().includes('serveur')) return 'Serveur';
  return 'Service';
}

function getCorrectionSearchText(order) {
  return [
    order?.id,
    order?.backendId,
    order?.table ? `table ${order.table}` : '',
    order?.status,
    order?.total,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function getCorrectionStatusTone(status) {
  const normalizedStatus = String(status || '').toLowerCase();
  if (normalizedStatus.includes('payee')) return 'success';
  if (normalizedStatus.includes('servie')) return 'served';
  if (normalizedStatus.includes('prete')) return 'ready';
  if (normalizedStatus.includes('cuisine') || normalizedStatus.includes('confirmee')) return 'warning';
  return 'muted';
}

function tableStatusLabel(status) {
  const labels = {
    AVAILABLE: 'Libre',
    IN_SERVICE: 'Occupee',
    BILL_REQUESTED: 'Addition demandee',
    PAID_STILL_SEATED: 'Payee - client assis',
    CLEANING: 'A nettoyer',
  };

  return labels[status] || status;
}

function AdminPage() {
  const [auth, setAuth] = useState(() => getStoredAdminAuth());
  const [loginForm, setLoginForm] = useState({ phone: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [hasAdminLoaded, setHasAdminLoaded] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const [dashboard, setDashboard] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [tablesData, setTablesData] = useState([]);
  const [staff, setStaff] = useState([]);
  const [users, setUsers] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [slots, setSlots] = useState([]);
  const [orders, setOrders] = useState([]);
  const [restaurantState, setRestaurantState] = useState(null);

  const [menuDraft, setMenuDraft] = useState(emptyMenuDraft);
  const [tableDraft, setTableDraft] = useState(emptyTableDraft);
  const [staffDraft, setStaffDraft] = useState(emptyStaffDraft);
  const [rewardDraft, setRewardDraft] = useState(emptyRewardDraft);
  const [slotDraft, setSlotDraft] = useState(emptySlotDraft);
  const [exportDraft, setExportDraft] = useState({ date: '', orderId: '' });
  const [selectedExportOrderIds, setSelectedExportOrderIds] = useState([]);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [stockDrafts, setStockDrafts] = useState({});
  const [correctionQuery, setCorrectionQuery] = useState('');
  const [correctionStatusFilter, setCorrectionStatusFilter] = useState('ALL');
  const adminLoadingRef = useRef(false);
  const adminInteractionPauseUntilRef = useRef(0);

  const isAdmin = auth?.role === 'ADMIN';

  const activeOrders = useMemo(
    () =>
      orders.filter((order) =>
        ['En attente de validation serveur', 'Confirmee par le serveur', 'Prete / pickup', 'Servie'].includes(
          order.status,
        ),
      ),
    [orders],
  );

  const paidOrders = useMemo(() => orders.filter((order) => order.status === 'Payee'), [orders]);
  const filteredCorrectionOrders = useMemo(() => {
    const query = correctionQuery.trim().toLowerCase();
    return activeOrders.filter((order) => {
      const matchesQuery = !query || getCorrectionSearchText(order).includes(query);
      const matchesStatus = correctionStatusFilter === 'ALL' || order.status === correctionStatusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [activeOrders, correctionQuery, correctionStatusFilter]);
  const filteredPaidCorrectionOrders = useMemo(() => {
    const query = correctionQuery.trim().toLowerCase();
    return paidOrders.filter((order) => !query || getCorrectionSearchText(order).includes(query)).slice(0, 8);
  }, [correctionQuery, paidOrders]);
  const cancelledOrders = useMemo(
    () =>
      orders
        .filter(isCancelledAdminOrder)
        .sort((firstOrder, secondOrder) =>
          Date.parse(getOrderActivityDate(secondOrder) || 0) - Date.parse(getOrderActivityDate(firstOrder) || 0),
        ),
    [orders],
  );
  const activeRewards = useMemo(
    () => rewards.filter((reward) => reward.active !== false),
    [rewards],
  );
  const recentExportOrders = useMemo(
    () =>
      [...orders]
        .sort((firstOrder, secondOrder) => Date.parse(secondOrder.createdAt || 0) - Date.parse(firstOrder.createdAt || 0))
        .slice(0, 12),
    [orders],
  );
  const exportSearchOrders = useMemo(() => {
    const query = exportDraft.orderId.trim().toLowerCase();
    if (!query) return recentExportOrders;

    return orders
      .filter((order) => {
        const haystack = [
          order.id,
          order.backendId,
          order.table ? `table ${order.table}` : '',
          order.table,
          order.clientName,
          order.clientPhone,
          order.status,
          order.paymentMethod,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      })
      .sort((firstOrder, secondOrder) => Date.parse(secondOrder.createdAt || 0) - Date.parse(firstOrder.createdAt || 0));
  }, [exportDraft.orderId, orders, recentExportOrders]);
  const dashboardRecentOrders = useMemo(() => recentExportOrders.slice(0, 7), [recentExportOrders]);
  const sourceStats = useMemo(() => {
    const withAccount = Number(dashboard?.ordersWithAccount || 0);
    const withoutAccount = Number(dashboard?.ordersWithoutAccount || 0);
    const serverAssisted = orders.filter((order) => order.accessMode === 'server-assisted').length;
    const clientQr = Math.max(0, orders.length - serverAssisted);
    return {
      withAccount,
      withoutAccount,
      serverAssisted,
      clientQr,
      total: Math.max(1, withAccount + withoutAccount),
    };
  }, [dashboard, orders]);
  const serviceStats = useMemo(() => {
    const paidCount = paidOrders.length;
    const totalRevenue = paidOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const averageBasket = paidCount > 0 ? totalRevenue / paidCount : 0;
    const servedUnpaid = orders.filter((order) => order.status === 'Servie').length;
    const accountOrders = Number(dashboard?.ordersWithAccount || 0);
    const totalAccountTracked = Math.max(1, accountOrders + Number(dashboard?.ordersWithoutAccount || 0));
    const accountRate = Math.round((accountOrders / totalAccountTracked) * 100);
    const unavailableProducts = Number(dashboard?.unavailableMenuItems || 0);
    const menuAvailabilityRate =
      menuItems.length > 0 ? Math.round(((menuItems.length - unavailableProducts) / menuItems.length) * 100) : 100;

    return {
      paidCount,
      totalRevenue,
      averageBasket,
      servedUnpaid,
      accountRate,
      menuAvailabilityRate,
    };
  }, [dashboard, menuItems.length, orders, paidOrders]);

  function getNextSlotNumber(zone) {
    const sameZoneSlots = slots.filter((slot) => slot.zone === zone);
    return sameZoneSlots.length === 0
      ? 1
      : Math.max(...sameZoneSlots.map((slot) => Number(slot.number || 0))) + 1;
  }

  function markAdminInteraction() {
    adminInteractionPauseUntilRef.current = Date.now() + 4000;
  }

  function shouldPauseSilentAdminRefresh() {
    return Date.now() < adminInteractionPauseUntilRef.current;
  }

  async function loadAdminData({ silent = false, force = false } = {}) {
    if (!isAdmin) return;
    if (silent && !force && shouldPauseSilentAdminRefresh()) return;
    if (adminLoadingRef.current) return;
    adminLoadingRef.current = true;
    const showVisibleLoader = !silent && !hasAdminLoaded;

    if (showVisibleLoader) {
      setLoading(true);
    }
    if (!silent) {
      setError('');
    }

    try {
      const requestOptions = silent ? { timeout: ADMIN_REFRESH_TIMEOUT_MS } : {};
      const results = await Promise.allSettled([
        fetchAdminDashboardApi(requestOptions),
        fetchAdminMenuApi(requestOptions),
        fetchAdminTablesApi(requestOptions),
        fetchAdminStaffApi(requestOptions),
        fetchAdminUsersApi(requestOptions),
        fetchAdminRewardsApi(requestOptions),
        fetchApiSlots('KITCHEN', requestOptions),
        fetchApiSlots('COUNTER', requestOptions),
        fetchApiOrders(requestOptions),
        fetchRestaurantStateApi(requestOptions),
      ]);

      const getResult = (index, fallback) =>
        results[index].status === 'fulfilled' ? results[index].value : fallback;

      setDashboard(getResult(0, dashboard));
      setMenuItems(Array.isArray(getResult(1, menuItems)) ? getResult(1, menuItems) : []);
      setTablesData(Array.isArray(getResult(2, tablesData)) ? getResult(2, tablesData) : []);
      setStaff(Array.isArray(getResult(3, staff)) ? getResult(3, staff) : []);
      setUsers(Array.isArray(getResult(4, users)) ? getResult(4, users) : []);
      setRewards(Array.isArray(getResult(5, rewards)) ? getResult(5, rewards) : []);
      const kitchenSlots = getResult(6, []);
      const counterSlots = getResult(7, []);
      setSlots([...(Array.isArray(kitchenSlots) ? kitchenSlots : []), ...(Array.isArray(counterSlots) ? counterSlots : [])]);
      setOrders(Array.isArray(getResult(8, orders)) ? getResult(8, orders) : []);
      setRestaurantState(getResult(9, restaurantState));

      const criticalIndexes = [0, 1, 2, 8];
      const criticalFailure = results.find(
        (result, index) => criticalIndexes.includes(index) && result.status === 'rejected',
      );

      if (!criticalFailure) {
        setError('');
      } else if (!silent) {
        setError(criticalFailure.reason?.message || 'Une partie des donnees admin n a pas pu etre chargee.');
      }
    } catch (loadError) {
      if (!silent) {
        setError(loadError.message || 'Impossible de charger le dashboard admin.');
      }
    } finally {
      adminLoadingRef.current = false;
      setHasAdminLoaded(true);
      if (showVisibleLoader) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    loadAdminData({ silent: false });
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return undefined;

    let realtimeRefreshId = null;
    const scheduleAdminRefresh = () => {
      if (realtimeRefreshId) {
        window.clearTimeout(realtimeRefreshId);
      }

      realtimeRefreshId = window.setTimeout(() => loadAdminData({ silent: true, force: true }), 250);
    };

    const intervalId = window.setInterval(() => loadAdminData({ silent: true }), 30000);
    const unsubscribeRealtime = subscribeRealtime({
      onOrder: scheduleAdminRefresh,
      onBillRequest: scheduleAdminRefresh,
      onTable: scheduleAdminRefresh,
      onMenu: scheduleAdminRefresh,
    });

    return () => {
      if (realtimeRefreshId) {
        window.clearTimeout(realtimeRefreshId);
      }
      window.clearInterval(intervalId);
      unsubscribeRealtime();
    };
  }, [isAdmin]);

  async function handleLogin(event) {
    event.preventDefault();
    setLoginError('');

    try {
      const response = await loginApi(loginForm);
      sessionStorage.setItem(ADMIN_AUTH_STORAGE_KEY, JSON.stringify(response));
      setAuth(response);

      if (response.role !== 'ADMIN') {
        setLoginError('Ce compte existe, mais il n a pas le role ADMIN.');
      }
    } catch (loginFailure) {
      setLoginError(loginFailure.message || 'Connexion impossible.');
    }
  }

  function handleLogout() {
    sessionStorage.removeItem(ADMIN_AUTH_STORAGE_KEY);
    setAuth(getStoredAdminAuth());
  }

  function showNotice(message) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 3500);
  }

  function showError(message) {
    setError(message);
    window.setTimeout(() => setError(''), 5000);
  }

  function validateMenuDraft() {
    if (!menuDraft.name.trim()) return 'Le nom du plat est obligatoire.';
    if (!menuDraft.category.trim()) return 'La categorie est obligatoire.';
    if (!menuDraft.station.trim()) return 'Le poste cuisine est obligatoire.';
    if (!menuDraft.description.trim()) return 'La description est obligatoire.';
    if (Number(menuDraft.price) < 0) return 'Le prix doit etre positif.';
    if (menuDraft.stockQuantity !== '' && Number(menuDraft.stockQuantity) < 0) {
      return 'Le stock ne peut pas etre negatif.';
    }
    return '';
  }

  function handleMenuImageFile(file) {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showError('Le fichier choisi doit etre une image.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      showError('Image trop lourde. Choisis une image de moins de 2 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setMenuDraft((currentDraft) => ({
        ...currentDraft,
        imageUrl: String(reader.result || ''),
      }));
      showNotice('Image ajoutee au produit.');
    };
    reader.onerror = () => showError('Impossible de lire cette image.');
    reader.readAsDataURL(file);
  }

  function handleMenuImageDrop(event) {
    event.preventDefault();
    handleMenuImageFile(event.dataTransfer.files?.[0]);
  }

  function handleMenuImageDragOver(event) {
    event.preventDefault();
  }

  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      showNotice('Lien copie.');
    } catch {
      showError('Impossible de copier le lien automatiquement.');
    }
  }

  async function runAdminAction(action, successMessage) {
    try {
      setError('');
      await action();
      if (successMessage) {
        showNotice(successMessage);
      }
      await loadAdminData({ silent: true, force: true });
    } catch (actionError) {
      showError(actionError.message || 'Action admin impossible.');
    }
  }

  async function saveMenuItem(event) {
    event.preventDefault();
    try {
      setError('');
      const validationMessage = validateMenuDraft();
      if (validationMessage) {
        showError(validationMessage);
        return;
      }
      const payload = {
        ...menuDraft,
        price: Number(menuDraft.price),
        points: Number(menuDraft.points),
        stockQuantity:
          menuDraft.stockQuantity === '' || menuDraft.stockQuantity === null || menuDraft.stockQuantity === undefined
            ? null
            : Number(menuDraft.stockQuantity),
        available: Boolean(menuDraft.available),
        unavailableReason: menuDraft.available ? '' : menuDraft.unavailableReason,
      };
      if (menuDraft.id) {
        await updateAdminMenuItemApi(menuDraft.id, payload);
        showNotice('Produit modifie.');
      } else {
        await createAdminMenuItemApi(payload);
        showNotice('Produit ajoute.');
      }
      setMenuDraft(emptyMenuDraft);
      await loadAdminData({ silent: true, force: true });
    } catch (actionError) {
      showError(actionError.message || 'Impossible de sauvegarder le produit.');
    }
  }

  function buildMenuPayload(item, overrides = {}) {
    const nextItem = { ...item, ...overrides };
    return {
      name: nextItem.name,
      category: nextItem.category,
      price: Number(nextItem.price || 0),
      points: Number(nextItem.points || 0),
      station: nextItem.station,
      description: nextItem.description,
      details: nextItem.details || '',
      imageUrl: nextItem.imageUrl || '',
      available: Boolean(nextItem.available),
      stockQuantity:
        nextItem.stockQuantity === '' || nextItem.stockQuantity === null || nextItem.stockQuantity === undefined
          ? null
          : Number(nextItem.stockQuantity),
      unavailableReason: nextItem.available ? '' : nextItem.unavailableReason || 'Indisponible temporairement',
    };
  }

  function getStockDraft(item) {
    return stockDrafts[item.id] || {
      available: item.available,
      stockQuantity: item.stockQuantity ?? '',
      unavailableReason: item.unavailableReason || '',
    };
  }

  function updateStockDraft(item, updates) {
    setStockDrafts((currentDrafts) => ({
      ...currentDrafts,
      [item.id]: {
        ...getStockDraft(item),
        ...updates,
      },
    }));
  }

  async function saveStockItem(item, forcedAvailability) {
    const draft = getStockDraft(item);
    const nextAvailable = typeof forcedAvailability === 'boolean' ? forcedAvailability : draft.available;
    const nextReason = nextAvailable ? '' : draft.unavailableReason || 'Indisponible temporairement';
    const payload = buildMenuPayload(item, {
      available: nextAvailable,
      stockQuantity: draft.stockQuantity,
      unavailableReason: nextReason,
    });

    await runAdminAction(
      () => updateAdminMenuItemApi(item.id, payload),
      nextAvailable ? 'Produit disponible dans le menu.' : 'Produit retire temporairement du menu.',
    );
    setStockDrafts((currentDrafts) => {
      const nextDrafts = { ...currentDrafts };
      delete nextDrafts[item.id];
      return nextDrafts;
    });
  }

  async function saveTable(event) {
    event.preventDefault();
    setError('');
    const payload = {
      ...tableDraft,
      number: Number(tableDraft.number),
      active: Boolean(tableDraft.active),
      qrUrl: tableDraft.qrUrl?.trim() || getDefaultTableMenuUrl(tableDraft.number),
    };
    try {
      if (tableDraft.id) {
        await updateApiTable(tableDraft.id, payload);
        showNotice('Table modifiee.');
      } else {
        await createApiTable(payload);
        showNotice('Table ajoutee.');
      }
      setTableDraft(emptyTableDraft);
      await loadAdminData({ silent: true, force: true });
    } catch (actionError) {
      showError(actionError.message || 'Impossible de sauvegarder la table.');
    }
  }

  function editTable(table) {
    setTableDraft({
      id: table.id,
      number: table.number,
      active: table.active !== false,
      status: table.status || 'AVAILABLE',
      qrUrl: table.qrUrl || getDefaultTableMenuUrl(table.number),
    });
  }

  async function saveStaff(event) {
    event.preventDefault();
    setError('');
    const payload = { ...staffDraft, active: Boolean(staffDraft.active) };
    try {
      if (staffDraft.id) {
        await updateAdminStaffApi(staffDraft.id, payload);
        showNotice('Compte staff modifie.');
      } else {
        await createAdminStaffApi(payload);
        showNotice('Compte staff cree.');
      }
      setStaffDraft(emptyStaffDraft);
      await loadAdminData({ silent: true, force: true });
    } catch (actionError) {
      showError(actionError.message || 'Impossible de sauvegarder le compte staff.');
    }
  }

  async function saveReward(event) {
    event.preventDefault();
    setError('');
    if (rewardDraft.type === 'FREE_ITEM' && !rewardDraft.name) {
      showError('Choisissez un article du menu pour cette recompense.');
      return;
    }
    const payload = {
      ...rewardDraft,
      pointsCost: Number(rewardDraft.pointsCost),
      discountPercent: rewardDraft.discountPercent === '' ? null : Number(rewardDraft.discountPercent),
      active: Boolean(rewardDraft.active),
    };
    try {
      if (rewardDraft.id) {
        await updateAdminRewardApi(rewardDraft.id, payload);
        showNotice('Recompense modifiee.');
      } else {
        await createAdminRewardApi(payload);
        showNotice('Recompense ajoutee.');
      }
      setRewardDraft(emptyRewardDraft);
      await loadAdminData({ silent: true, force: true });
    } catch (actionError) {
      showError(actionError.message || 'Impossible de sauvegarder la recompense.');
    }
  }

  async function saveSlot(event) {
    event.preventDefault();
    setError('');
    const payload = {
      ...slotDraft,
      number: Number(slotDraft.number),
      color: normalizeSlotColor(slotDraft.color),
      colorName: slotDraft.colorName?.trim() || 'Sans nom',
    };
    const duplicateSlot = slots.find(
      (slot) =>
        slot.zone === payload.zone &&
        Number(slot.number) === payload.number &&
        slot.id !== slotDraft.id,
    );
    if (duplicateSlot) {
      showError(`Ce numero existe deja dans ${payload.zone}. Prochain numero libre: ${getNextSlotNumber(payload.zone)}.`);
      return;
    }
    try {
      if (slotDraft.id) {
        await updateApiSlot(slotDraft.id, payload);
        showNotice('Slot modifie.');
      } else {
        await createApiSlot(payload);
        showNotice('Slot ajoute.');
      }
      setSlotDraft(emptySlotDraft);
      await loadAdminData({ silent: true, force: true });
    } catch (actionError) {
      showError(actionError.message || 'Impossible de sauvegarder le slot.');
    }
  }

  async function updateState(nextState) {
    try {
      setError('');
      const savedState = await updateRestaurantStateApi(nextState);
      setRestaurantState(savedState);
      showNotice('Etat restaurant mis a jour.');
      await loadAdminData({ silent: true, force: true });
    } catch (actionError) {
      showError(actionError.message || 'Impossible de modifier l etat restaurant.');
    }
  }

  function getOrdersForExport(mode) {
    if (mode === 'selected') {
      if (selectedExportOrderIds.length === 0) {
        showError('Selectionne au moins une commande avant de telecharger.');
        return [];
      }
      return orders.filter((order) => selectedExportOrderIds.includes(String(order.backendId || order.id)));
    }

    if (mode === 'date') {
      if (!exportDraft.date) {
        showError('Choisis une date avant de telecharger.');
        return [];
      }
      return orders.filter((order) => String(order.createdAt || '').startsWith(exportDraft.date));
    }

    if (mode === 'order') {
      const query = exportDraft.orderId.trim().toLowerCase();
      if (!query) {
        showError('Saisis un numero de commande avant de telecharger.');
        return [];
      }
      return orders.filter((order) => String(order.id || '').toLowerCase().includes(query));
    }

    return orders;
  }

  function toggleExportOrder(order) {
    const orderKey = String(order.backendId || order.id);
    setSelectedExportOrderIds((currentIds) =>
      currentIds.includes(orderKey)
        ? currentIds.filter((id) => id !== orderKey)
        : [...currentIds, orderKey],
    );
  }

  function selectRecentExportOrders() {
    setSelectedExportOrderIds(exportSearchOrders.map((order) => String(order.backendId || order.id)));
  }

  function clearExportSelection() {
    setSelectedExportOrderIds([]);
  }

  function buildExportRows(selectedOrders) {
    return selectedOrders.map((order) => ({
      commande: order.id,
      table: order.table,
      statut: orderStatusLabel(order.status),
      date: order.createdAt || '',
      articles: order.items.map((item) => `${item.quantity}x ${item.name}`).join(' | '),
      total: Number(order.total || 0).toFixed(2),
      paiement: order.paymentMethod || 'A definir',
    }));
  }

  function downloadBlob(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function downloadOrdersCsv(mode) {
    const selectedOrders = getOrdersForExport(mode);
    if (selectedOrders.length === 0) {
      showError('Aucune commande trouvee pour cet export.');
      return;
    }

    const rows = buildExportRows(selectedOrders);
    const headers = ['commande', 'table', 'statut', 'date', 'articles', 'total', 'paiement'];
    const csv = [
      headers.join(';'),
      ...rows.map((row) =>
        headers
          .map((header) => `"${String(row[header] ?? '').replaceAll('"', '""')}"`)
          .join(';'),
      ),
    ].join('\n');

    downloadBlob(`pos2-commandes-${mode || 'toutes'}.csv`, `\ufeff${csv}`, 'text/csv;charset=utf-8');
    showNotice('Export CSV telecharge.');
  }

  function cleanPdfText(text) {
    return String(text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7E]/g, ' ')
      .replace(/[()\\]/g, '\\$&');
  }

  function createPdfContent(title, lines) {
    const pageLines = [title, '', ...lines].reduce((pages, line, index) => {
      const pageIndex = Math.floor(index / 42);
      pages[pageIndex] = pages[pageIndex] || [];
      pages[pageIndex].push(line);
      return pages;
    }, []);

    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ];
    const pageRefs = [];

    pageLines.forEach((page) => {
      const content = `BT\n/F1 10 Tf\n50 800 Td\n${page
        .map((line) => `(${cleanPdfText(line).slice(0, 95)}) Tj\n0 -17 Td`)
        .join('')}ET`;
      const contentRef = objects.length + 1;
      objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
      const pageRef = objects.length + 1;
      objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentRef} 0 R >>`);
      pageRefs.push(pageRef);
    });

    objects[1] = `<< /Type /Pages /Kids [${pageRefs.map((ref) => `${ref} 0 R`).join(' ')}] /Count ${pageRefs.length} >>`;

    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    objects.forEach((object, index) => {
      offsets.push(pdf.length);
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach((offset) => {
      pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
    });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return pdf;
  }

  function downloadOrdersPdf(mode) {
    const selectedOrders = getOrdersForExport(mode);
    if (selectedOrders.length === 0) {
      showError('Aucune commande trouvee pour cet export.');
      return;
    }

    const lines = buildExportRows(selectedOrders).flatMap((row) => [
      `Commande ${row.commande} | Table ${row.table} | ${row.statut}`,
      `Date: ${row.date}`,
      `Articles: ${row.articles || 'Aucun article'}`,
      `Total: ${row.total} MAD | Paiement: ${row.paiement}`,
      '------------------------------------------------------------',
    ]);

    downloadBlob(
      `pos2-commandes-${mode || 'toutes'}.pdf`,
      createPdfContent('Rapport commandes POS2', lines),
      'application/pdf',
    );
    showNotice('Export PDF telecharge.');
  }

  if (!auth || !isAdmin) {
    return (
      <main className="admin-login-page">
        <section className="admin-login-card">
          <p className="eyebrow">Administration POS2</p>
          <h1>Interface administrateur</h1>
          <p>
            Connecte-toi avec un compte role ADMIN pour gerer le menu, les tables, les slots, le
            staff, les recompenses et les corrections.
          </p>
          <form onSubmit={handleLogin}>
            <label>
              Telephone
              <input
                value={loginForm.phone}
                onChange={(event) => setLoginForm({ ...loginForm, phone: event.target.value })}
                placeholder="Ex: 0500000000"
              />
            </label>
            <label>
              Mot de passe
              <input
                type="password"
                value={loginForm.password}
                onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })}
                placeholder="Mot de passe"
              />
            </label>
            {loginError && <p className="admin-form-error">{loginError}</p>}
            <button className="admin-primary-button" type="submit">
              Se connecter
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main
      className="admin-shell"
      onFocusCapture={markAdminInteraction}
      onKeyDownCapture={markAdminInteraction}
      onPointerDownCapture={markAdminInteraction}
    >
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span>P2</span>
          <div>
            <strong>POS2 Admin</strong>
            <small>Gestion restaurant</small>
          </div>
        </div>
        <nav>
          {tabs.map((tab, index) => (
            <button
              className={activeTab === tab.id ? 'active' : ''}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              <span className="admin-nav-icon"><AdminIcon name={tab.icon} /></span>
              <small>{String(index + 1).padStart(2, '0')}</small>
              {tab.label}
            </button>
          ))}
        </nav>
        <button className="admin-secondary-button" onClick={handleLogout} type="button">
          Quitter admin
        </button>
      </aside>

      <section className="admin-workspace">
        <header className="admin-topbar">
          <div>
            <p className="eyebrow">Back-office restaurant</p>
            <h1 className="admin-page-title">
              <span className="admin-title-icon">
                <AdminIcon name={tabs.find((tab) => tab.id === activeTab)?.icon || 'dashboard'} />
              </span>
              {tabs.find((tab) => tab.id === activeTab)?.label}
            </h1>
          </div>
          <div className="admin-session">
            <span>{auth.name?.slice(0, 2).toUpperCase() || 'AD'}</span>
            <div>
              <strong>{auth.name}</strong>
              <small>{auth.phone}</small>
            </div>
          </div>
        </header>

        {notice && <div className="admin-notice">{notice}</div>}
        {error && <div className="admin-error">{error}</div>}
        {loading && <div className="admin-loading">Chargement des donnees...</div>}

        {activeTab === 'dashboard' && (
          <section className="admin-section admin-dashboard-pro">
            <div className="admin-dashboard-command">
              <div>
                <p className="eyebrow">Bonjour admin</p>
                <h2>{restaurantState?.open ? 'Restaurant ouvert' : 'Restaurant ferme'}</h2>
                <span>
                  {restaurantState?.open
                    ? 'Tous les systemes sont operationnels.'
                    : 'Le restaurant est ferme aux nouvelles commandes.'}
                </span>
                <div className="admin-hero-meta">
                  <small>En ligne</small>
                  <small>Derniere mise a jour : aujourd hui</small>
                </div>
              </div>
              <img alt="Salle restaurant" className="admin-dashboard-command-photo" src={heroImage} />
              <div className="admin-command-status">
                <button onClick={() => setActiveTab('state')} type="button">
                  Voir l'etat detaille
                  <span aria-hidden="true">›</span>
                </button>
              </div>
            </div>

            <div className="admin-priority-grid">
              <MetricCard iconName="alert" label="A valider maintenant" value={dashboard?.ordersToValidate || 0} hint="Aucune commande" />
              <MetricCard iconName="menu" label="En cuisine" value={dashboard?.kitchenOrders || 0} hint="Preparation en cours" tone="warning" />
              <MetricCard iconName="state" label="Retards cuisine" value={dashboard?.kitchenDelayedOrders || 0} hint="Necessite attention" tone="danger" />
              <MetricCard iconName="slots" label="Ventes aujourd hui" value={formatPrice(Number(dashboard?.salesToday || 0))} hint="Chiffre d'affaires du jour" />
            </div>

            <div className="admin-dashboard-layout">
              <Panel className="admin-dashboard-panel-flow" iconName="state" subtitle="Suivi en temps reel des commandes" title="Flux de service">
                <div className="admin-flow-grid">
                  <FlowStep iconName="qr" label="A valider" value={dashboard?.ordersToValidate || 0} hint="A traiter" />
                  <FlowStep iconName="menu" label="Cuisine" value={dashboard?.kitchenOrders || 0} hint="En preparation" />
                  <FlowStep iconName="alert" label="Pretes" value={dashboard?.readyOrders || 0} hint="Pretes a servir" />
                  <FlowStep iconName="stock" label="Additions" value={dashboard?.billRequests || 0} hint="Demandes clients" />
                </div>
                <DashboardRealStats stats={serviceStats} />
              </Panel>

              <Panel className="admin-dashboard-panel-health" iconName="state" subtitle="Indicateurs cles de performance" title="Sante du restaurant">
                <StatusLine iconName="staff" hint="En cours de traitement" label="Commandes actives" value={dashboard?.activeOrders || 0} />
                <StatusLine iconName="qr" hint="En service" label="Tables occupees" value={dashboard?.occupiedTables || 0} />
                <StatusLine iconName="users" hint="Connectes" label="Utilisateurs" value={dashboard?.totalUsers || users.length || 0} />
                <StatusLine iconName="reward" hint="Hors service" label="Produits indisponibles" value={dashboard?.unavailableMenuItems || 0} />
                <div className="admin-health-ok">
                  <AdminIcon name="state" />
                  <div>
                    <strong>Tout fonctionne bien</strong>
                    <span>Votre restaurant est operationnel et pret a servir.</span>
                  </div>
                </div>
              </Panel>
            </div>

            <section className="admin-cancelled-orders-panel">
              <header>
                <div>
                  <span>Suivi incidents</span>
                  <h2>Commandes annulees</h2>
                  <p>Motifs saisis par le serveur ou le responsable cuisine.</p>
                </div>
                <strong>{cancelledOrders.length}</strong>
              </header>

              {cancelledOrders.length === 0 ? (
                <p className="admin-empty-cancellations">Aucune commande annulee pour le moment.</p>
              ) : (
                <div className="admin-cancelled-order-list">
                  {cancelledOrders.slice(0, 6).map((order) => (
                    <article className="admin-cancelled-order-card" key={order.backendId || order.id}>
                      <div className="admin-cancelled-order-main">
                        <span>{getCancellationSource(order)}</span>
                        <strong>{order.id}</strong>
                        <small>Table {order.table} - {orderStatusLabel(order.status)}</small>
                      </div>
                      <p>{getAdminCancellationReason(order)}</p>
                      <b>{formatPrice(Number(order.total || 0))}</b>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <div className="admin-dashboard-layout">
              <Panel title="Clients et commandes">
                <OrderSplitCard stats={sourceStats} />
                <div className="admin-mini-grid">
                  <StatusLine label="Clients comptes" value={dashboard?.clientUsers || 0} />
                  <StatusLine label="Staff" value={dashboard?.staffUsers || staff.length || 0} />
                  <StatusLine label="Avec compte" value={dashboard?.ordersWithAccount || 0} />
                  <StatusLine label="Sans compte" value={dashboard?.ordersWithoutAccount || 0} />
                </div>
              </Panel>

              <Panel title="Dernieres commandes">
                <DashboardOrdersTable orders={dashboardRecentOrders} />
              </Panel>
            </div>

            <section className="admin-export-launch">
              <div>
                <span className="admin-export-icon">EXPORT</span>
                <h2>Exports commandes</h2>
                <p>Ouvrez un espace dedie pour rechercher, selectionner et telecharger les commandes en CSV ou PDF.</p>
              </div>
              <button className="admin-primary-button" onClick={() => setExportDialogOpen(true)} type="button">
                Exporter commandes
              </button>
            </section>
          </section>
        )}

        {activeTab === 'menu' && (
          <section className="admin-section admin-grid-2">
            <Panel title="Gestion du menu">
              <form className="admin-form" onSubmit={saveMenuItem}>
                <Field label="Nom" value={menuDraft.name} onChange={(value) => setMenuDraft({ ...menuDraft, name: value })} />
                <div className="admin-form-row">
                  <Field label="Categorie" value={menuDraft.category} onChange={(value) => setMenuDraft({ ...menuDraft, category: value })} />
                  <Field label="Poste" value={menuDraft.station} onChange={(value) => setMenuDraft({ ...menuDraft, station: value })} />
                </div>
                <div className="admin-form-row">
                  <Field label="Prix MAD" type="number" value={menuDraft.price} onChange={(value) => setMenuDraft({ ...menuDraft, price: value })} />
                  <Field label="Points affiches" type="number" value={menuDraft.points} onChange={(value) => setMenuDraft({ ...menuDraft, points: value })} />
                </div>
                <Textarea label="Description" value={menuDraft.description} onChange={(value) => setMenuDraft({ ...menuDraft, description: value })} />
                <Textarea label="Details" value={menuDraft.details} onChange={(value) => setMenuDraft({ ...menuDraft, details: value })} />
                <Field label="Image URL" value={menuDraft.imageUrl} onChange={(value) => setMenuDraft({ ...menuDraft, imageUrl: value })} />
                <div
                  className="admin-image-uploader"
                  onDragOver={handleMenuImageDragOver}
                  onDrop={handleMenuImageDrop}
                >
                  <div>
                    <strong>Ajouter une image du plat</strong>
                    <span>Glisse une image ici, choisis depuis le PC, ou colle un lien en haut.</span>
                  </div>
                  <label className="admin-secondary-button admin-file-button">
                    Choisir image
                    <input
                      accept="image/*"
                      onChange={(event) => handleMenuImageFile(event.target.files?.[0])}
                      type="file"
                    />
                  </label>
                </div>
                {menuDraft.imageUrl && (
                  <div className="admin-image-preview">
                    <img alt="Apercu produit" src={menuDraft.imageUrl} />
                    <div>
                      <strong>Apercu image</strong>
                      <span>{menuDraft.imageUrl.startsWith('data:') ? 'Image importee depuis le PC.' : 'Image depuis un lien ou preset.'}</span>
                    </div>
                  </div>
                )}
                <div className="admin-image-presets">
                  {imagePresets.map((imageUrl) => (
                    <button key={imageUrl} onClick={() => setMenuDraft({ ...menuDraft, imageUrl })} type="button">
                      <img alt="Preset produit" src={imageUrl} />
                    </button>
                  ))}
                </div>
                <button className="admin-primary-button" type="submit">
                  {menuDraft.id ? 'Modifier produit' : 'Ajouter produit'}
                </button>
              </form>
            </Panel>
            <Panel title="Produits">
              <div className="admin-card-list">
                {menuItems.map((item) => (
                  <article className="admin-list-card menu-product" key={item.id}>
                    <img alt={item.name} src={item.imageUrl} />
                    <div>
                      <strong>{item.name}</strong>
                      <small>{item.category} - {item.station}</small>
                      <span>{formatPrice(Number(item.price || 0))} - {item.points} pts</span>
                    </div>
                    <button className="admin-secondary-button" onClick={() => setMenuDraft(item)} type="button">
                      Editer
                    </button>
                    <button
                      className="admin-danger-button outline"
                      onClick={() =>
                        runAdminAction(
                          () => deleteAdminMenuItemPermanentApi(item.id),
                          'Produit supprime definitivement.',
                        )
                      }
                      type="button"
                    >
                      Supprimer definitivement
                    </button>
                  </article>
                ))}
              </div>
            </Panel>
          </section>
        )}

        {activeTab === 'stock' && (
          <section className="admin-section">
            <div className="admin-stock-overview">
              <Panel title="Gestion du stock">
                <div className="admin-account-summary">
                  <span>{menuItems.length} produits</span>
                  <span>{menuItems.filter((item) => item.available).length} disponibles</span>
                  <span>{menuItems.filter((item) => !item.available).length} indisponibles</span>
                </div>
                <p className="admin-muted">
                  Cette page gere uniquement la disponibilite et le stock. Les informations du plat restent dans la page Menu.
                </p>
              </Panel>
              <Panel title="Regle de service">
                <StatusLine label="Produit disponible" value="Visible client et serveur" />
                <StatusLine label="Produit indisponible" value="Visible avec raison, mais non commandable" />
              </Panel>
            </div>

            <Panel title="Produits et disponibilite">
              <div className="admin-stock-grid">
                {menuItems.map((item) => {
                  const draft = getStockDraft(item);
                  const isAvailable = Boolean(draft.available);
                  return (
                    <article className={`admin-stock-card ${isAvailable ? 'is-available' : 'is-unavailable'}`} key={item.id}>
                      <img alt={item.name} src={item.imageUrl} />
                      <div className="admin-stock-main">
                        <div>
                          <strong>{item.name}</strong>
                          <small>{item.category} - {item.station}</small>
                        </div>
                        <span className={isAvailable ? 'admin-pill success' : 'admin-pill danger'}>
                          {isAvailable ? 'Disponible' : 'Indisponible'}
                        </span>
                      </div>

                      <div className="admin-stock-controls">
                        <Field
                          label="Quantite stock"
                          min="0"
                          type="number"
                          value={draft.stockQuantity}
                          onChange={(value) => updateStockDraft(item, { stockQuantity: value })}
                          placeholder="Non suivi"
                        />
                        <Field
                          label="Raison si indisponible"
                          value={draft.unavailableReason}
                          onChange={(value) => updateStockDraft(item, { unavailableReason: value })}
                          placeholder="Rupture de stock, ingredient termine..."
                        />
                      </div>

                      <div className="admin-stock-actions">
                        {isAvailable ? (
                          <button
                            className="admin-danger-button"
                            onClick={() => {
                              updateStockDraft(item, { available: false, unavailableReason: draft.unavailableReason || 'Indisponible temporairement' });
                              saveStockItem({ ...item, available: false, unavailableReason: draft.unavailableReason || 'Indisponible temporairement' }, false);
                            }}
                            type="button"
                          >
                            Rendre indisponible
                          </button>
                        ) : (
                          <button
                            className="admin-primary-button"
                            onClick={() => saveStockItem(item, true)}
                            type="button"
                          >
                            Rendre disponible
                          </button>
                        )}
                        <button className="admin-secondary-button" onClick={() => saveStockItem(item)} type="button">
                          Enregistrer stock
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </Panel>
          </section>
        )}

        {activeTab === 'tables' && (
          <section className="admin-section admin-grid-2">
            <Panel title="Tables et QR codes">
              <form className="admin-form compact" onSubmit={saveTable}>
                <div className="admin-form-row">
                  <Field label="Numero table" type="number" value={tableDraft.number} onChange={(value) => setTableDraft({ ...tableDraft, number: value })} />
                  <Select label="Statut" value={tableDraft.status} onChange={(value) => setTableDraft({ ...tableDraft, status: value })}>
                    <option value="AVAILABLE">Libre</option>
                    <option value="IN_SERVICE">Occupee</option>
                    <option value="BILL_REQUESTED">Addition</option>
                    <option value="PAID_STILL_SEATED">Payee - client assis</option>
                    <option value="CLEANING">A nettoyer</option>
                  </Select>
                </div>
                <Field
                  label="Lien QR de la table"
                  value={tableDraft.qrUrl || getDefaultTableMenuUrl(tableDraft.number)}
                  onChange={(value) => setTableDraft({ ...tableDraft, qrUrl: value })}
                />
                <button
                  className="admin-secondary-button"
                  onClick={() => setTableDraft({ ...tableDraft, qrUrl: getDefaultTableMenuUrl(tableDraft.number) })}
                  type="button"
                >
                  Utiliser le lien automatique
                </button>
                <Checkbox checked={tableDraft.active} label="Table active" onChange={(checked) => setTableDraft({ ...tableDraft, active: checked })} />
                <button className="admin-primary-button" type="submit">
                  {tableDraft.id ? 'Modifier table' : 'Ajouter table'}
                </button>
                {tableDraft.id && (
                  <button className="admin-secondary-button" onClick={() => setTableDraft(emptyTableDraft)} type="button">
                    Annuler edition
                  </button>
                )}
              </form>
              <div className="admin-qr-preview">
                <div>
                  <span className="admin-pill gold">
                    {tableDraft.id ? 'Table selectionnee' : 'Apercu automatique'}
                  </span>
                  <h3>QR Table {tableDraft.number || '-'}</h3>
                  <p>{tableDraft.qrUrl || getDefaultTableMenuUrl(tableDraft.number)}</p>
                  <div className="admin-card-actions">
                    <a className="admin-secondary-button" href={tableDraft.qrUrl || getDefaultTableMenuUrl(tableDraft.number)} target="_blank" rel="noreferrer">
                      Tester le lien
                    </a>
                    <button
                      className="admin-secondary-button"
                      onClick={() => copyToClipboard(tableDraft.qrUrl || getDefaultTableMenuUrl(tableDraft.number))}
                      type="button"
                    >
                      Copier le lien
                    </button>
                  </div>
                </div>
                <img alt={`QR table ${tableDraft.number || 1}`} src={getQrImageUrl(tableDraft.qrUrl || getDefaultTableMenuUrl(tableDraft.number))} />
              </div>
              <div className="admin-table-grid">
                {tablesData.map((table) => (
                  <article className="admin-table-card" key={table.id}>
                    <div>
                      <strong>Table {table.number}</strong>
                      <span className={`admin-table-status ${String(table.status).toLowerCase()}`}>
                        {tableStatusLabel(table.status)}
                      </span>
                      <small>{table.active ? 'Active' : 'Desactivee'}</small>
                    </div>
                    <img alt={`QR table ${table.number}`} src={getQrImageUrl(getTableQrUrl(table))} />
                    <p>{getTableQrUrl(table)}</p>
                    <div className="admin-card-actions">
                      <button className="admin-secondary-button" onClick={() => editTable(table)} type="button">
                        Editer
                      </button>
                      <button className="admin-danger-button" onClick={() => runAdminAction(() => deleteApiTable(table.id), 'Table desactivee.')} type="button">
                        Desactiver
                      </button>
                      <button className="admin-danger-button outline" onClick={() => runAdminAction(() => deleteApiTablePermanent(table.id), 'Table supprimee definitivement.')} type="button">
                        Supprimer
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </Panel>
            <Panel title="Regle QR">
              <p className="admin-muted">
                Le QR pointe vers le menu client. Le token temporaire est cree au scan, expire apres
                1h30 ou apres demande d addition selon le flux client.
              </p>
              <p className="admin-muted">
                Pour imprimer les QR, ouvre aussi la page publique /qr-codes.
              </p>
            </Panel>
          </section>
        )}

        {activeTab === 'staff' && (
          <section className="admin-section admin-grid-2">
            <Panel title="Comptes staff">
              <div className="admin-account-summary">
                <span>{staff.length} comptes staff</span>
                <span>{staff.filter((member) => member.active).length} actifs</span>
                <span>{staff.filter((member) => member.role === 'WAITER').length} serveurs</span>
              </div>
              <form className="admin-form" onSubmit={saveStaff}>
                <Field label="Nom" value={staffDraft.name} onChange={(value) => setStaffDraft({ ...staffDraft, name: value })} />
                <Field label="Telephone" value={staffDraft.phone} onChange={(value) => setStaffDraft({ ...staffDraft, phone: value })} />
                <Field label={staffDraft.id ? 'Nouveau mot de passe optionnel' : 'Mot de passe'} type="password" value={staffDraft.password} onChange={(value) => setStaffDraft({ ...staffDraft, password: value })} />
                <Select label="Role" value={staffDraft.role} onChange={(value) => setStaffDraft({ ...staffDraft, role: value })}>
                  <option value="WAITER">Serveur</option>
                  <option value="KITCHEN">Cuisine</option>
                  <option value="ADMIN">Admin</option>
                </Select>
                <Field label="Tables assignees (ex: 1,2,3)" value={staffDraft.assignedTables || ''} onChange={(value) => setStaffDraft({ ...staffDraft, assignedTables: value })} />
                <Checkbox checked={staffDraft.active} label="Compte actif" onChange={(checked) => setStaffDraft({ ...staffDraft, active: checked })} />
                <button className="admin-primary-button" type="submit">
                  {staffDraft.id ? 'Modifier compte' : 'Creer compte'}
                </button>
              </form>
            </Panel>
            <Panel title="Equipe">
              <div className="admin-card-list">
                {staff.map((member) => {
                  const revenueStats = getStaffRevenueStats(member, paidOrders);
                  return (
                    <article className="admin-list-card staff" key={member.id}>
                      <div>
                        <strong>{member.name}</strong>
                        <small>{member.phone}</small>
                        <span>{member.role} - Tables: {member.assignedTables || 'Toutes / non defini'}</span>
                      </div>
                      <div className="admin-staff-revenue">
                        <span>
                          <small>Aujourd'hui</small>
                          <strong>{formatPrice(revenueStats.todayTotal)}</strong>
                          <em>{revenueStats.todayCount} encaissement(s)</em>
                        </span>
                        <span>
                          <small>Ce mois</small>
                          <strong>{formatPrice(revenueStats.monthTotal)}</strong>
                          <em>{revenueStats.monthCount} encaissement(s)</em>
                        </span>
                      </div>
                      <span className={member.active ? 'admin-pill success' : 'admin-pill muted'}>
                        {member.active ? 'Actif' : 'Desactive'}
                      </span>
                      <button className="admin-secondary-button" onClick={() => setStaffDraft({ ...member, password: '' })} type="button">
                        Editer
                      </button>
                      <button
                        className="admin-danger-button"
                        disabled={!member.active}
                        onClick={() => runAdminAction(() => deleteAdminStaffApi(member.id), 'Compte staff desactive.')}
                        type="button"
                      >
                        Desactiver
                      </button>
                      <button
                        className="admin-danger-button outline"
                        onClick={() =>
                          runAdminAction(
                            () => deleteAdminStaffPermanentApi(member.id),
                            'Compte staff supprime definitivement.',
                          )
                        }
                        type="button"
                      >
                        Supprimer
                      </button>
                    </article>
                  );
                })}
              </div>
            </Panel>
          </section>
        )}

        {activeTab === 'users' && (
          <section className="admin-section">
            <div className="admin-grid-2">
              <Panel title="Comptes clients">
                <div className="admin-account-summary">
                  <span>{users.filter((user) => user.role === 'CLIENT').length} clients</span>
                  <span>{users.filter((user) => user.role === 'CLIENT' && user.active).length} actifs</span>
                  <span>{users.reduce((sum, user) => sum + Number(user.points || 0), 0)} points cumules</span>
                </div>
                <p className="admin-muted">
                  Ces comptes correspondent aux clients qui se connectent par telephone et mot de passe pour garder leurs points.
                </p>
              </Panel>
              <Panel title="Commandes compte / sans compte">
                <ProgressRow label="Avec compte client" value={dashboard?.ordersWithAccount || 0} max={orders.length || 1} />
                <ProgressRow label="Sans compte" value={dashboard?.ordersWithoutAccount || 0} max={orders.length || 1} />
                <p className="admin-muted">
                  Une commande avec compte contient un telephone client. Une commande sans compte vient du mode rapide QR.
                </p>
              </Panel>
            </div>
            <Panel title="Gestion utilisateurs">
              <div className="admin-user-grid">
                {users
                  .filter((user) => user.role === 'CLIENT')
                  .map((user) => (
                    <article className="admin-user-card" key={user.id}>
                      <div className="admin-user-avatar">{user.name?.slice(0, 2).toUpperCase() || 'CL'}</div>
                      <div>
                        <strong>{user.name}</strong>
                        <small>{user.phone}</small>
                        <span>{user.points || 0} points</span>
                      </div>
                      <span className={user.active ? 'admin-pill success' : 'admin-pill muted'}>
                        {user.active ? 'Actif' : 'Desactive'}
                      </span>
                      <div className="admin-card-actions">
                        <button
                          className="admin-danger-button"
                          disabled={!user.active}
                          onClick={() => runAdminAction(() => deactivateAdminUserApi(user.id), 'Compte client desactive.')}
                          type="button"
                        >
                          Desactiver
                        </button>
                        <button
                          className="admin-danger-button outline"
                          onClick={() =>
                            runAdminAction(
                              () => deleteAdminUserPermanentApi(user.id),
                              'Compte client supprime definitivement.',
                            )
                          }
                          type="button"
                        >
                          Supprimer
                        </button>
                      </div>
                    </article>
                  ))}
                {users.filter((user) => user.role === 'CLIENT').length === 0 && (
                  <p className="admin-muted">Aucun compte client pour le moment.</p>
                )}
              </div>
            </Panel>
          </section>
        )}

        {activeTab === 'rewards' && (
          <section className="admin-section admin-grid-2">
            <Panel title="Gestion fidelite">
              <form className="admin-form" onSubmit={saveReward}>
                {rewardDraft.type === 'FREE_ITEM' ? (
                  <Select
                    label="Nom"
                    value={rewardDraft.name}
                    onChange={(value) => {
                      const selectedItem = menuItems.find((item) => item.name === value);
                      setRewardDraft((current) => ({
                        ...current,
                        name: value,
                        description:
                          selectedItem && !current.description?.trim()
                            ? `${selectedItem.name} offert avec les points fidelite.`
                            : current.description,
                      }));
                    }}
                  >
                    <option value="">Choisir un article du menu</option>
                    {menuItems.map((item) => (
                      <option key={item.id || item.name} value={item.name}>
                        {item.name} - {item.category || 'Menu'}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Field label="Nom" value={rewardDraft.name} onChange={(value) => setRewardDraft({ ...rewardDraft, name: value })} />
                )}
                <Textarea label="Description" value={rewardDraft.description} onChange={(value) => setRewardDraft({ ...rewardDraft, description: value })} />
                <div className="admin-form-row">
                  <Field label="Cout points" type="number" value={rewardDraft.pointsCost} onChange={(value) => setRewardDraft({ ...rewardDraft, pointsCost: value })} />
                  <Select
                    label="Type"
                    value={rewardDraft.type}
                    onChange={(value) =>
                      setRewardDraft((current) => ({
                        ...current,
                        type: value,
                        name:
                          value === 'FREE_ITEM' && !menuItems.some((item) => item.name === current.name)
                            ? ''
                            : current.name,
                        discountPercent: value === 'FREE_ITEM' ? '' : current.discountPercent,
                      }))
                    }
                  >
                    <option value="FREE_ITEM">Article offert</option>
                    <option value="DISCOUNT">Reduction</option>
                  </Select>
                </div>
                <Field label="Pourcentage reduction" type="number" value={rewardDraft.discountPercent || ''} onChange={(value) => setRewardDraft({ ...rewardDraft, discountPercent: value })} />
                <Checkbox checked={rewardDraft.active} label="Recompense active" onChange={(checked) => setRewardDraft({ ...rewardDraft, active: checked })} />
                <button className="admin-primary-button" type="submit">
                  {rewardDraft.id ? 'Modifier recompense' : 'Ajouter recompense'}
                </button>
              </form>
            </Panel>
            <Panel title="Recompenses disponibles">
              <div className="admin-reward-grid">
                {activeRewards.map((reward) => (
                  <article className="admin-reward-card" key={reward.id}>
                    <span className="admin-pill gold">{reward.type}</span>
                    <h3>{reward.name}</h3>
                    <p>{reward.description}</p>
                    <strong>{reward.pointsCost} pts</strong>
                    <span className={reward.active ? 'admin-pill success' : 'admin-pill muted'}>
                      {reward.active ? 'Active' : 'Supprimee'}
                    </span>
                    <div className="admin-card-actions">
                      <button className="admin-secondary-button" onClick={() => setRewardDraft(reward)} type="button">
                        Editer
                      </button>
                      <button className="admin-danger-button" onClick={() => runAdminAction(() => deleteAdminRewardApi(reward.id), 'Recompense supprimee.')} type="button">
                        Supprimer
                      </button>
                    </div>
                  </article>
                ))}
                {activeRewards.length === 0 && (
                  <p className="admin-muted">Aucune recompense active pour le moment.</p>
                )}
              </div>
            </Panel>
          </section>
        )}

        {activeTab === 'slots' && (
          <section className="admin-section admin-grid-2">
            <Panel title="Slots cuisine / comptoir">
              <form className="admin-form compact" onSubmit={saveSlot}>
                <div className="admin-form-row">
                  <Field label="Numero" type="number" value={slotDraft.number} onChange={(value) => setSlotDraft({ ...slotDraft, number: value })} />
                  <ColorField label="Couleur exacte" value={slotDraft.color} onChange={(value) => setSlotDraft({ ...slotDraft, color: value })} />
                </div>
                <Field
                  label="Nom affiche en cuisine"
                  value={slotDraft.colorName || ''}
                  onChange={(value) => setSlotDraft({ ...slotDraft, colorName: value })}
                  placeholder="Ex: Rouge, Bleu, Comptoir 1"
                />
                <Select label="Zone" value={slotDraft.zone} onChange={(value) => setSlotDraft({ ...slotDraft, zone: value })}>
                  <option value="KITCHEN">Cuisine</option>
                  <option value="COUNTER">Comptoir</option>
                </Select>
                <button
                  className="admin-secondary-button"
                  onClick={() => setSlotDraft({ ...slotDraft, number: getNextSlotNumber(slotDraft.zone) })}
                  type="button"
                >
                  Utiliser prochain numero libre
                </button>
                <button className="admin-primary-button" type="submit">
                  {slotDraft.id ? 'Modifier slot' : 'Ajouter slot'}
                </button>
              </form>
              <div className="admin-slot-grid">
                {slots.map((slot) => (
                  <article className="admin-slot-card" key={slot.id}>
                    <div className="slot-color" style={{ background: normalizeSlotColor(slot.color) }} />
                    <strong>Slot {slot.number} - {slot.colorName || slot.color}</strong>
                    <small>{slot.zone} - {slot.status}</small>
                    <span>{slot.currentOrderId ? `Commande ${slot.currentOrderId}` : 'Libre'}</span>
                    <div className="admin-card-actions">
                      <button className="admin-secondary-button" onClick={() => setSlotDraft(slot)} type="button">
                        Editer
                      </button>
                      <button className="admin-secondary-button" onClick={() => runAdminAction(() => forceFreeApiSlot(slot.id), 'Slot libere.')} type="button">
                        Liberer
                      </button>
                      <button className="admin-danger-button" onClick={() => runAdminAction(() => deleteApiSlot(slot.id), 'Slot supprime.')} type="button">
                        Supprimer
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </Panel>
            <Panel title="Regle slots">
              <p className="admin-muted">
                Le slot cuisine est reserve quand la commande est confirmee. Le slot comptoir sert au
                pickup quand le responsable valide le plateau complet.
              </p>
            </Panel>
          </section>
        )}

        {activeTab === 'state' && restaurantState && (
          <section className="admin-section admin-grid-2">
            <Panel title="Etat du restaurant">
              <div className="admin-state-actions">
                <ToggleAction
                  active={restaurantState.open}
                  label="Restaurant ouvert"
                  onClick={() => updateState({ open: !restaurantState.open })}
                />
                <ToggleAction
                  active={!restaurantState.orderingPaused}
                  label="Commandes actives"
                  onClick={() => updateState({ orderingPaused: !restaurantState.orderingPaused })}
                />
                <ToggleAction
                  active={!restaurantState.qrOrderingPaused}
                  label="QR ordering actif"
                  onClick={() => updateState({ qrOrderingPaused: !restaurantState.qrOrderingPaused })}
                />
              </div>
              <Textarea
                label="Message operationnel"
                value={restaurantState.message || ''}
                onChange={(value) => setRestaurantState({ ...restaurantState, message: value })}
              />
              <button className="admin-primary-button" onClick={() => updateState({ message: restaurantState.message })} type="button">
                Sauvegarder message
              </button>
            </Panel>
            <Panel title="Effet attendu">
              <StatusLine label="Open / close" value="Controle si le restaurant accepte le service." />
              <StatusLine label="Disable ordering" value="Pause temporaire des commandes." />
              <StatusLine label="Pause QR" value="Bloque la commande autonome client." />
            </Panel>
          </section>
        )}

        {activeTab === 'emergency' && (
          <section className="admin-section admin-corrections-page">
            <div className="admin-corrections-hero">
              <div>
                <span className="admin-corrections-kicker">Centre de corrections</span>
                <h2>Interventions sensibles</h2>
                <p>Annulez des commandes ou rouvrez des paiements seulement en cas d'erreur operationnelle.</p>
              </div>
              <button
                className="admin-secondary-button"
                onClick={() => loadAdminData({ silent: true, force: true })}
                type="button"
              >
                Rafraichir
              </button>
            </div>

            <div className="admin-corrections-summary">
              <article>
                <span>Commandes annulables</span>
                <strong>{activeOrders.length}</strong>
              </article>
              <article>
                <span>Paiements rouvrables</span>
                <strong>{paidOrders.length}</strong>
              </article>
              <article>
                <span>Commandes annulees</span>
                <strong>{cancelledOrders.length}</strong>
              </article>
            </div>

            <div className="admin-corrections-toolbar">
              <Field
                label="Recherche"
                value={correctionQuery}
                onChange={setCorrectionQuery}
                placeholder="Commande, table, statut..."
              />
              <Select label="Statut commandes" value={correctionStatusFilter} onChange={setCorrectionStatusFilter}>
                <option value="ALL">Tous les statuts</option>
                <option value="En attente de validation serveur">A valider</option>
                <option value="Confirmee par le serveur">En cuisine</option>
                <option value="Prete / pickup">Prete</option>
                <option value="Servie">Servie</option>
              </Select>
            </div>

            <div className="admin-corrections-grid">
              <Panel title="Corrections commandes">
                <div className="admin-correction-list">
                  {filteredCorrectionOrders.slice(0, 10).map((order) => (
                    <article className="admin-correction-row" key={order.backendId}>
                      <div className="admin-correction-table">
                        <span>Table</span>
                        <strong>{order.table}</strong>
                      </div>
                      <div className="admin-correction-main">
                        <strong>{order.id}</strong>
                        <small>Commande active</small>
                      </div>
                      <span className={`admin-correction-badge ${getCorrectionStatusTone(order.status)}`}>
                        {orderStatusLabel(order.status)}
                      </span>
                      <b>{formatPrice(order.total)}</b>
                      <button
                        className="admin-danger-button"
                        onClick={() => runAdminAction(() => cancelAdminOrderApi(order.backendId), 'Commande annulee.')}
                        type="button"
                      >
                        Annuler
                      </button>
                    </article>
                  ))}
                  {filteredCorrectionOrders.length === 0 && <p className="admin-muted">Aucune commande active a corriger.</p>}
                </div>
              </Panel>

              <Panel title="Paiements et slots">
                <div className="admin-correction-list">
                  {filteredPaidCorrectionOrders.map((order) => (
                    <article className="admin-correction-row payment" key={order.backendId}>
                      <div className="admin-correction-table">
                        <span>Table</span>
                        <strong>{order.table}</strong>
                      </div>
                      <div className="admin-correction-main">
                        <strong>{order.id}</strong>
                        <small>Paiement encaisse</small>
                      </div>
                      <span className="admin-correction-badge success">Payee</span>
                      <b>{formatPrice(order.total)}</b>
                      <button
                        className="admin-secondary-button"
                        onClick={() => runAdminAction(() => reopenAdminPaymentApi(order.backendId), 'Paiement rouvert.')}
                        type="button"
                      >
                        Rouvrir
                      </button>
                    </article>
                  ))}
                  {filteredPaidCorrectionOrders.length === 0 && <p className="admin-muted">Aucun paiement trouve.</p>}
                </div>
              </Panel>

              <section className="admin-corrections-audit">
                <header>
                  <span>Historique</span>
                  <h2>Dernieres annulations</h2>
                </header>
                <div className="admin-corrections-audit-list">
                  {cancelledOrders.slice(0, 4).map((order) => (
                    <article key={order.backendId || order.id}>
                      <div>
                        <strong>{order.id}</strong>
                        <small>Table {order.table} - {getCancellationSource(order)}</small>
                      </div>
                      <p>{getAdminCancellationReason(order)}</p>
                      <b>{formatPrice(Number(order.total || 0))}</b>
                    </article>
                  ))}
                  {cancelledOrders.length === 0 && <p className="admin-muted">Aucune annulation enregistree.</p>}
                </div>
              </section>

              <section className="admin-corrections-note">
                <strong>Bon usage</strong>
                <p>Chaque correction doit correspondre a une erreur reelle : mauvaise table, paiement saisi trop tot, commande annulee par le client ou incident cuisine.</p>
              </section>
            </div>
          </section>
        )}
      </section>
      {exportDialogOpen && (
        <ExportOrdersDialog
          clearSelection={clearExportSelection}
          downloadOrdersCsv={downloadOrdersCsv}
          downloadOrdersPdf={downloadOrdersPdf}
          exportDraft={exportDraft}
          exportSearchOrders={exportSearchOrders}
          onClose={() => setExportDialogOpen(false)}
          orderStatusLabel={orderStatusLabel}
          orders={orders}
          selectRecentExportOrders={selectRecentExportOrders}
          selectedExportOrderIds={selectedExportOrderIds}
          setExportDraft={setExportDraft}
          toggleExportOrder={toggleExportOrder}
        />
      )}
    </main>
  );
}

function ExportOrdersDialog({
  clearSelection,
  downloadOrdersCsv,
  downloadOrdersPdf,
  exportDraft,
  exportSearchOrders,
  onClose,
  orderStatusLabel,
  orders,
  selectRecentExportOrders,
  selectedExportOrderIds,
  setExportDraft,
  toggleExportOrder,
}) {
  const selectedCount = selectedExportOrderIds.length;
  const hasResults = exportSearchOrders.length > 0;

  return (
    <div className="admin-export-modal-backdrop" role="presentation">
      <section className="admin-export-modal" role="dialog" aria-modal="true" aria-label="Exporter commandes">
        <header className="admin-export-modal-header">
          <div>
            <span className="admin-export-icon">EXPORT</span>
            <h2>Exporter les commandes</h2>
            <p>Recherchez par numero, table, client ou statut, puis exportez tout ou seulement votre selection.</p>
          </div>
          <button className="admin-ghost-button admin-export-close" onClick={onClose} type="button">
            Fermer
          </button>
        </header>

        <div className="admin-export-modal-toolbar">
          <Field
            label="Rechercher une commande"
            value={exportDraft.orderId}
            onChange={(value) => setExportDraft({ ...exportDraft, orderId: value })}
            placeholder="Ex: ORD, table 4, client, payee..."
          />
          <Field
            label="Filtrer par date"
            type="date"
            value={exportDraft.date}
            onChange={(value) => setExportDraft({ ...exportDraft, date: value })}
          />
        </div>

        <div className="admin-export-quick-actions">
          <article>
            <strong>Toutes les commandes</strong>
            <span>{orders.length} commande(s) chargee(s)</span>
          </article>
          <div className="admin-card-actions">
            <button className="admin-secondary-button" onClick={() => downloadOrdersCsv('all')} type="button">
              Export CSV tout
            </button>
            <button className="admin-primary-button" onClick={() => downloadOrdersPdf('all')} type="button">
              Export PDF tout
            </button>
          </div>
        </div>

        <div className="admin-export-selection-bar">
          <div>
            <strong>{selectedCount} selectionnee(s)</strong>
            <span>{hasResults ? `${exportSearchOrders.length} resultat(s) affiches` : 'Aucun resultat'}</span>
          </div>
          <div className="admin-card-actions">
            <button className="admin-secondary-button" disabled={!hasResults} onClick={selectRecentExportOrders} type="button">
              Selectionner resultats
            </button>
            <button className="admin-ghost-button" disabled={selectedCount === 0} onClick={clearSelection} type="button">
              Vider selection
            </button>
          </div>
        </div>

        <div className="admin-export-order-list admin-export-modal-list">
          {exportSearchOrders.map((order) => {
            const orderKey = String(order.backendId || order.id);
            const isChecked = selectedExportOrderIds.includes(orderKey);
            return (
              <label className="admin-export-order-row" key={orderKey}>
                <input checked={isChecked} onChange={() => toggleExportOrder(order)} type="checkbox" />
                <span>
                  <strong>{order.id}</strong>
                  <small>
                    Table {order.table} - {order.clientName || 'Client'} - {orderStatusLabel(order.status)}
                  </small>
                </span>
                <b>{formatPrice(Number(order.total || 0))}</b>
              </label>
            );
          })}
          {!hasResults && <p className="admin-muted">Aucune commande ne correspond a cette recherche.</p>}
        </div>

        <footer className="admin-export-modal-footer">
          <div className="admin-card-actions">
            <button className="admin-secondary-button" disabled={selectedCount === 0} onClick={() => downloadOrdersCsv('selected')} type="button">
              Export CSV selection
            </button>
            <button className="admin-primary-button" disabled={selectedCount === 0} onClick={() => downloadOrdersPdf('selected')} type="button">
              Export PDF selection
            </button>
          </div>
          <div className="admin-card-actions">
            <button className="admin-secondary-button" disabled={!exportDraft.date} onClick={() => downloadOrdersCsv('date')} type="button">
              CSV date
            </button>
            <button className="admin-primary-button" disabled={!exportDraft.date} onClick={() => downloadOrdersPdf('date')} type="button">
              PDF date
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function MetricCard({ iconName = 'dashboard', label, value, hint = '', tone = 'neutral' }) {
  return (
    <article className={`admin-metric ${tone}`}>
      <i aria-hidden="true">
        <AdminIcon name={iconName} />
      </i>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {hint ? <small>{hint}</small> : null}
      </div>
    </article>
  );
}

function Panel({ title, children, className = '', iconName = '', subtitle = '' }) {
  return (
    <section className={`admin-panel ${className}`}>
      <header className="admin-panel-heading">
        {iconName ? (
          <span className="admin-panel-icon">
            <AdminIcon name={iconName} />
          </span>
        ) : null}
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </header>
      {children}
    </section>
  );
}

function ProgressRow({ label, value, max }) {
  const percent = Math.min(100, Math.round((Number(value || 0) / Math.max(1, Number(max || 1))) * 100));
  return (
    <div className="admin-progress-row">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="admin-progress-track">
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function StatusLine({ label, value, hint = '', iconName = '' }) {
  return (
    <div className="admin-status-line">
      {iconName ? (
        <span className="admin-status-icon">
          <AdminIcon name={iconName} />
        </span>
      ) : null}
      <div>
        <span>{label}</span>
        {hint ? <small>{hint}</small> : null}
      </div>
      <strong>{value}</strong>
      <b aria-hidden="true">›</b>
    </div>
  );
}

function FlowStep({ label, value, hint, iconName = 'dashboard' }) {
  return (
    <article className="admin-flow-step">
      <i aria-hidden="true">
        <AdminIcon name={iconName} />
      </i>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{hint}</small>
      </div>
    </article>
  );
}

function DashboardRealStats({ stats }) {
  return (
    <div className="admin-real-stats" aria-label="Statistiques operationnelles">
      <article>
        <span>Commandes payees</span>
        <strong>{stats.paidCount}</strong>
        <small>Historique charge</small>
      </article>
      <article>
        <span>CA encaisse</span>
        <strong>{formatPrice(stats.totalRevenue)}</strong>
        <small>Total des commandes payees</small>
      </article>
      <article>
        <span>Panier moyen</span>
        <strong>{formatPrice(stats.averageBasket)}</strong>
        <small>CA / commandes payees</small>
      </article>
      <article>
        <span>A encaisser</span>
        <strong>{stats.servedUnpaid}</strong>
        <small>Commandes servies non payees</small>
      </article>
      <article>
        <span>Comptes client</span>
        <strong>{stats.accountRate}%</strong>
        <small>Commandes rattachees a un compte</small>
      </article>
      <article>
        <span>Menu disponible</span>
        <strong>{stats.menuAvailabilityRate}%</strong>
        <small>Produits actifs au menu</small>
      </article>
    </div>
  );
}

function OrderSplitCard({ stats }) {
  const accountPercent = Math.round((Number(stats?.withAccount || 0) / Math.max(1, Number(stats?.total || 1))) * 100);
  const noAccountPercent = 100 - accountPercent;

  return (
    <div className="admin-split-card">
      <div
        className="admin-donut"
        style={{
          background: `conic-gradient(#1f7a76 0 ${accountPercent}%, #c76b42 ${accountPercent}% ${Math.min(100, accountPercent + noAccountPercent)}%, #e8dfca 0)`,
        }}
      >
        <strong>{stats?.total || 0}</strong>
        <span>commandes</span>
      </div>
      <div className="admin-split-legend">
        <StatusLine label="Avec compte" value={stats?.withAccount || 0} />
        <StatusLine label="Sans compte" value={stats?.withoutAccount || 0} />
        <StatusLine label="QR client" value={stats?.clientQr || 0} />
        <StatusLine label="Serveur assiste" value={stats?.serverAssisted || 0} />
      </div>
    </div>
  );
}

function DashboardOrdersTable({ orders }) {
  if (!orders || orders.length === 0) {
    return <p className="admin-muted">Aucune commande recente.</p>;
  }

  return (
    <div className="admin-orders-table">
      <div className="admin-orders-table-head">
        <span>Commande</span>
        <span>Table</span>
        <span>Source</span>
        <span>Statut</span>
        <span>Total</span>
      </div>
      {orders.map((order) => (
        <div className="admin-orders-table-row" key={order.backendId || order.id}>
          <strong data-label="Commande">{order.id}</strong>
          <span data-label="Table">Table {order.table}</span>
          <span data-label="Source">{order.sourceLabel || (order.accessMode === 'server-assisted' ? 'Serveur' : 'QR client')}</span>
          <span className="admin-table-status" data-label="Statut">{orderStatusLabel(order.status)}</span>
          <b data-label="Total">{formatPrice(Number(order.total || 0))}</b>
        </div>
      ))}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', ...inputProps }) {
  return (
    <label className="admin-field">
      {label}
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} {...inputProps} />
    </label>
  );
}

function ColorField({ label, value, onChange }) {
  const color = normalizeSlotColor(value);
  return (
    <label className="admin-field">
      {label}
      <div className="admin-color-field">
        <input aria-label={label} type="color" value={color} onChange={(event) => onChange(event.target.value)} />
        <input value={color} onChange={(event) => onChange(event.target.value)} placeholder="#1F7A76" />
      </div>
    </label>
  );
}

function Textarea({ label, value, onChange }) {
  return (
    <label className="admin-field">
      {label}
      <textarea value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Select({ label, value, onChange, children }) {
  return (
    <label className="admin-field">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}

function Checkbox({ label, checked, onChange }) {
  return (
    <label className="admin-checkbox">
      <input checked={checked} type="checkbox" onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

function ToggleAction({ active, label, onClick }) {
  return (
    <button className={`admin-toggle-action ${active ? 'active' : ''}`} onClick={onClick} type="button">
      <span>{active ? 'Actif' : 'Pause'}</span>
      {label}
    </button>
  );
}

export default AdminPage;

