import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ADMIN_AUTH_STORAGE_KEY,
  cancelAdminOrderApi,
  createAdminMenuItemApi,
  createAdminRewardApi,
  createAdminStaffApi,
  createApiSlot,
  createApiTable,
  deleteAdminMenuItemApi,
  deleteAdminRewardApi,
  deleteAdminStaffApi,
  deleteApiSlot,
  deleteApiTable,
  deleteApiTablePermanent,
  fetchAdminDashboardApi,
  fetchAdminMenuApi,
  fetchAdminRewardsApi,
  fetchAdminStaffApi,
  fetchAdminTablesApi,
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
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'menu', label: 'Menu' },
  { id: 'tables', label: 'Tables & QR' },
  { id: 'staff', label: 'Staff' },
  { id: 'rewards', label: 'Recompenses' },
  { id: 'slots', label: 'Slots' },
  { id: 'state', label: 'Etat restaurant' },
  { id: 'emergency', label: 'Corrections' },
];

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
  jaune: '#b89039',
};

function normalizeSlotColor(color) {
  const value = String(color || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(value)) {
    return value;
  }
  return slotColorFallbacks[value.toLowerCase()] || '#b89039';
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
      const results = await Promise.allSettled([
        fetchAdminDashboardApi(),
        fetchAdminMenuApi(),
        fetchAdminTablesApi(),
        fetchAdminStaffApi(),
        fetchAdminRewardsApi(),
        fetchApiSlots('KITCHEN'),
        fetchApiSlots('COUNTER'),
        fetchApiOrders(),
        fetchRestaurantStateApi(),
      ]);

      const getResult = (index, fallback) =>
        results[index].status === 'fulfilled' ? results[index].value : fallback;

      setDashboard(getResult(0, dashboard));
      setMenuItems(Array.isArray(getResult(1, menuItems)) ? getResult(1, menuItems) : []);
      setTablesData(Array.isArray(getResult(2, tablesData)) ? getResult(2, tablesData) : []);
      setStaff(Array.isArray(getResult(3, staff)) ? getResult(3, staff) : []);
      setRewards(Array.isArray(getResult(4, rewards)) ? getResult(4, rewards) : []);
      const kitchenSlots = getResult(5, []);
      const counterSlots = getResult(6, []);
      setSlots([...(Array.isArray(kitchenSlots) ? kitchenSlots : []), ...(Array.isArray(counterSlots) ? counterSlots : [])]);
      setOrders(Array.isArray(getResult(7, orders)) ? getResult(7, orders) : []);
      setRestaurantState(getResult(8, restaurantState));

      const failedRequest = results.find((result) => result.status === 'rejected');
      if (failedRequest && !silent) {
        setError(failedRequest.reason?.message || 'Une partie des donnees admin n a pas pu etre chargee.');
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

      realtimeRefreshId = window.setTimeout(() => loadAdminData({ silent: true }), 250);
    };

    const intervalId = window.setInterval(() => loadAdminData({ silent: true }), 30000);
    const unsubscribeRealtime = subscribeRealtime({
      onOrder: scheduleAdminRefresh,
      onBillRequest: scheduleAdminRefresh,
      onTable: scheduleAdminRefresh,
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
        available: Boolean(menuDraft.available),
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
    setSelectedExportOrderIds(recentExportOrders.map((order) => String(order.backendId || order.id)));
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
          <small>
            Pour la demo, cree ou transforme un utilisateur en role ADMIN dans MySQL avant de te
            connecter.
          </small>
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
              <span>{String(index + 1).padStart(2, '0')}</span>
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
            <h1>{tabs.find((tab) => tab.id === activeTab)?.label}</h1>
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
          <section className="admin-section">
            <div className="admin-metrics-grid">
              <MetricCard label="Commandes actives" value={dashboard?.activeOrders || 0} />
              <MetricCard label="A valider" value={dashboard?.ordersToValidate || 0} tone="gold" />
              <MetricCard label="En cuisine" value={dashboard?.kitchenOrders || 0} />
              <MetricCard label="Tables occupees" value={dashboard?.occupiedTables || 0} />
              <MetricCard label="Retards cuisine" value={dashboard?.kitchenDelayedOrders || 0} tone="danger" />
              <MetricCard label="Ventes aujourd hui" value={formatPrice(Number(dashboard?.salesToday || 0))} tone="gold" />
            </div>

            <div className="admin-grid-2">
              <Panel title="Flux operationnel">
                <ProgressRow label="A valider" value={dashboard?.ordersToValidate || 0} max={dashboard?.activeOrders || 1} />
                <ProgressRow label="Cuisine" value={dashboard?.kitchenOrders || 0} max={dashboard?.activeOrders || 1} />
                <ProgressRow label="Pretes" value={dashboard?.readyOrders || 0} max={dashboard?.activeOrders || 1} />
                <ProgressRow label="Demandes addition" value={dashboard?.billRequests || 0} max={dashboard?.activeOrders || 1} />
              </Panel>
              <Panel title="Etat restaurant">
                <StatusLine label="Restaurant" value={restaurantState?.open ? 'Ouvert' : 'Ferme'} />
                <StatusLine label="Commandes" value={restaurantState?.orderingPaused ? 'Pausees' : 'Actives'} />
                <StatusLine label="QR ordering" value={restaurantState?.qrOrderingPaused ? 'Pause' : 'Actif'} />
                <p className="admin-muted">{restaurantState?.message || 'Aucun message.'}</p>
              </Panel>
            </div>

            <Panel title="Exports commandes">
              <div className="admin-export-panel">
                <div>
                  <h3>Toutes les commandes</h3>
                  <p>Telecharger toutes les commandes visibles dans le back-office.</p>
                  <div className="admin-card-actions">
                    <button className="admin-secondary-button" onClick={() => downloadOrdersCsv('all')} type="button">
                      CSV toutes
                    </button>
                    <button className="admin-primary-button" onClick={() => downloadOrdersPdf('all')} type="button">
                      PDF toutes
                    </button>
                  </div>
                </div>
                <div className="admin-export-selection-card">
                  <div>
                    <h3>Une ou plusieurs commandes</h3>
                    <p>
                      Selectionne les commandes recentes a exporter. Parfait pour reimprimer ou
                      envoyer un petit rapport.
                    </p>
                  </div>
                  <div className="admin-export-selection-toolbar">
                    <button className="admin-secondary-button" onClick={selectRecentExportOrders} type="button">
                      Tout selectionner
                    </button>
                    <button className="admin-ghost-button" onClick={clearExportSelection} type="button">
                      Vider
                    </button>
                  </div>
                  <div className="admin-export-order-list">
                    {recentExportOrders.map((order) => {
                      const orderKey = String(order.backendId || order.id);
                      const isChecked = selectedExportOrderIds.includes(orderKey);
                      return (
                        <label className="admin-export-order-row" key={orderKey}>
                          <input
                            checked={isChecked}
                            onChange={() => toggleExportOrder(order)}
                            type="checkbox"
                          />
                          <span>
                            <strong>{order.id}</strong>
                            <small>
                              Table {order.table} · {orderStatusLabel(order.status)}
                            </small>
                          </span>
                          <b>{formatPrice(Number(order.total || 0))}</b>
                        </label>
                      );
                    })}
                    {recentExportOrders.length === 0 && (
                      <p className="admin-muted">Aucune commande disponible pour le moment.</p>
                    )}
                  </div>
                  <div className="admin-card-actions">
                    <button className="admin-secondary-button" onClick={() => downloadOrdersCsv('selected')} type="button">
                      CSV selection
                    </button>
                    <button className="admin-primary-button" onClick={() => downloadOrdersPdf('selected')} type="button">
                      PDF selection
                    </button>
                  </div>
                </div>
                <div>
                  <Field
                    label="Date exacte"
                    type="date"
                    value={exportDraft.date}
                    onChange={(value) => setExportDraft({ ...exportDraft, date: value })}
                  />
                  <div className="admin-card-actions">
                    <button className="admin-secondary-button" onClick={() => downloadOrdersCsv('date')} type="button">
                      CSV date
                    </button>
                    <button className="admin-primary-button" onClick={() => downloadOrdersPdf('date')} type="button">
                      PDF date
                    </button>
                  </div>
                </div>
                <div>
                  <Field
                    label="Numero commande"
                    value={exportDraft.orderId}
                    onChange={(value) => setExportDraft({ ...exportDraft, orderId: value })}
                  />
                  <div className="admin-card-actions">
                    <button className="admin-secondary-button" onClick={() => downloadOrdersCsv('order')} type="button">
                      CSV commande
                    </button>
                    <button className="admin-primary-button" onClick={() => downloadOrdersPdf('order')} type="button">
                      PDF commande
                    </button>
                  </div>
                </div>
              </div>
            </Panel>
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
                <Checkbox
                  checked={menuDraft.available}
                  label="Produit disponible"
                  onChange={(checked) => setMenuDraft({ ...menuDraft, available: checked })}
                />
                <button className="admin-primary-button" type="submit">
                  {menuDraft.id ? 'Modifier produit' : 'Ajouter produit'}
                </button>
              </form>
            </Panel>
            <Panel title="Produits">
              <div className="admin-card-list">
                {menuItems.map((item) => (
                  <article className="admin-list-card" key={item.id}>
                    <img alt={item.name} src={item.imageUrl} />
                    <div>
                      <strong>{item.name}</strong>
                      <small>{item.category} - {item.station}</small>
                      <span>{formatPrice(Number(item.price || 0))} - {item.points} pts</span>
                    </div>
                    <span className={item.available ? 'admin-pill success' : 'admin-pill muted'}>
                      {item.available ? 'Disponible' : 'Indisponible'}
                    </span>
                    <button className="admin-secondary-button" onClick={() => setMenuDraft(item)} type="button">
                      Editer
                    </button>
                    <button className="admin-danger-button" onClick={() => runAdminAction(() => deleteAdminMenuItemApi(item.id), 'Produit desactive.')} type="button">
                      Desactiver
                    </button>
                  </article>
                ))}
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
                {staff.map((member) => (
                  <article className="admin-list-card staff" key={member.id}>
                    <div>
                      <strong>{member.name}</strong>
                      <small>{member.phone}</small>
                      <span>{member.role} - Tables: {member.assignedTables || 'Toutes / non defini'}</span>
                    </div>
                    <span className={member.active ? 'admin-pill success' : 'admin-pill muted'}>
                      {member.active ? 'Actif' : 'Desactive'}
                    </span>
                    <button className="admin-secondary-button" onClick={() => setStaffDraft({ ...member, password: '' })} type="button">
                      Editer
                    </button>
                    <button className="admin-danger-button" onClick={() => runAdminAction(() => deleteAdminStaffApi(member.id), 'Compte staff desactive.')} type="button">
                      Desactiver
                    </button>
                  </article>
                ))}
              </div>
            </Panel>
          </section>
        )}

        {activeTab === 'rewards' && (
          <section className="admin-section admin-grid-2">
            <Panel title="Gestion fidelite">
              <form className="admin-form" onSubmit={saveReward}>
                <Field label="Nom" value={rewardDraft.name} onChange={(value) => setRewardDraft({ ...rewardDraft, name: value })} />
                <Textarea label="Description" value={rewardDraft.description} onChange={(value) => setRewardDraft({ ...rewardDraft, description: value })} />
                <div className="admin-form-row">
                  <Field label="Cout points" type="number" value={rewardDraft.pointsCost} onChange={(value) => setRewardDraft({ ...rewardDraft, pointsCost: value })} />
                  <Select label="Type" value={rewardDraft.type} onChange={(value) => setRewardDraft({ ...rewardDraft, type: value })}>
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
          <section className="admin-section admin-grid-2">
            <Panel title="Corrections commandes">
              <div className="admin-card-list">
                {activeOrders.map((order) => (
                  <article className="admin-list-card emergency" key={order.backendId}>
                    <div>
                      <strong>Table {order.table}</strong>
                      <small>{order.id} - {orderStatusLabel(order.status)}</small>
                      <span>{formatPrice(order.total)}</span>
                    </div>
                    <button className="admin-danger-button" onClick={() => runAdminAction(() => cancelAdminOrderApi(order.backendId), 'Commande annulee.')} type="button">
                      Annuler commande
                    </button>
                  </article>
                ))}
                {activeOrders.length === 0 && <p className="admin-muted">Aucune commande active a corriger.</p>}
              </div>
            </Panel>
            <Panel title="Paiements et slots">
              <div className="admin-card-list">
                {paidOrders.slice(0, 8).map((order) => (
                  <article className="admin-list-card emergency" key={order.backendId}>
                    <div>
                      <strong>Table {order.table}</strong>
                      <small>{order.id} - Payee</small>
                      <span>{formatPrice(order.total)}</span>
                    </div>
                    <button className="admin-secondary-button" onClick={() => runAdminAction(() => reopenAdminPaymentApi(order.backendId), 'Paiement rouvert.')} type="button">
                      Reouvrir paiement
                    </button>
                  </article>
                ))}
                <button
                  className="admin-secondary-button"
                  onClick={() => loadAdminData({ silent: true, force: true })}
                  type="button"
                >
                  Rafraichir etat
                </button>
              </div>
            </Panel>
          </section>
        )}
      </section>
    </main>
  );
}

function MetricCard({ label, value, tone = 'neutral' }) {
  return (
    <article className={`admin-metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function Panel({ title, children }) {
  return (
    <section className="admin-panel">
      <h2>{title}</h2>
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

function StatusLine({ label, value }) {
  return (
    <div className="admin-status-line">
      <span>{label}</span>
      <strong>{value}</strong>
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
        <input value={color} onChange={(event) => onChange(event.target.value)} placeholder="#B89039" />
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
