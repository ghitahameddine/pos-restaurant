import { useEffect, useMemo, useRef, useState } from 'react';
import { menuCategories, menuProducts } from '../../data/menuProducts';
import { formatPrice } from '../../utils/format';
import {
  addStoredOrder,
  findStoredOrder,
  getStoredOrders,
  updateStoredOrder,
} from '../../utils/ordersStorage';
import { addBillRequest } from '../../utils/billRequestsStorage';
import {
  clientCancelApiOrder,
  clientUpdateApiOrder,
  createApiBillRequest,
  createApiOrder,
  fetchMyLoyaltyApi,
  redeemRewardApi,
  subscribeRealtime,
} from '../../utils/api';
import {
  addOrderToQrSession,
  createQrSession,
  getQrSession,
  isGuestSessionExpired,
} from '../../utils/qrSessionStorage';
import ClientAuth from './ClientAuth';

const ACCESS_STEP = 'access';
const AUTH_STEP = 'auth';
const MENU_STEP = 'menu';
const CONFIRMATION_STEP = 'confirmation';
const CLIENT_DRAFT_PREFIX = 'pos2-client-draft-';
const PENDING_STATUS = 'En attente de validation serveur';
const CANCELLED_STATUS = 'Annulee par le serveur';

function getTableNumber() {
  const params = new URLSearchParams(window.location.search);
  return params.get('table') || 'non definie';
}

function getQrTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('token');
}

function getClientDraftKey(table, token) {
  return `${CLIENT_DRAFT_PREFIX}${table}-${token}`;
}

function getStoredClientDraft(table, token) {
  if (!token) return null;

  const rawDraft = localStorage.getItem(getClientDraftKey(table, token));

  if (!rawDraft) return null;

  try {
    return JSON.parse(rawDraft);
  } catch {
    return null;
  }
}

function saveClientDraft(table, token, draft) {
  if (!token) return;
  localStorage.setItem(getClientDraftKey(table, token), JSON.stringify(draft));
}

function getStoredClientAuth() {
  const rawAuth = localStorage.getItem('pos2-client-auth');
  if (!rawAuth) return null;

  try {
    return JSON.parse(rawAuth);
  } catch {
    return null;
  }
}

function getDefaultLoyaltyRewards() {
  return {
    totalPoints: getStoredClientAuth()?.points || 0,
    rewards: [],
    transactions: [],
  };
}

function getEstimatedProductPoints(price) {
  return Math.floor(Number(price || 0) / 10);
}

function findRewardTargetProduct(reward) {
  if (!reward) return null;

  const rewardText = `${reward.name || ''} ${reward.description || ''}`.toLowerCase();

  if (rewardText.includes('orange')) {
    return menuProducts.find((product) => product.name === 'Jus Orange Frais') || null;
  }

  if (rewardText.includes('dessert')) {
    return (
      menuProducts.find((product) => product.name === 'Tiramisu') ||
      menuProducts.find((product) => product.category === 'Desserts') ||
      null
    );
  }

  return null;
}

function getRewardDisplayName(reward) {
  return findRewardTargetProduct(reward)?.name || reward?.name || 'Recompense';
}

function getRewardDiscountPercent(reward) {
  if (!reward || reward.type !== 'DISCOUNT') return 0;
  return Number(reward.discountPercent || 20);
}

function getRewardNote(reward) {
  if (!reward) return '';

  if (reward.type === 'FREE_ITEM') {
    return `Article offert : ${getRewardDisplayName(reward)}`;
  }

  return `Reduction fidelite appliquee : ${getRewardDiscountPercent(reward)}%`;
}

function applyRewardPreviewToOrder(order, reward) {
  if (!order || !reward) return order;

  const targetProduct = findRewardTargetProduct(reward);
  const cleanItems = (order.items || []).filter((item) => !item.isRewardItem);

  const previewOrder = {
    ...order,
    items: cleanItems,
    reward: {
      id: reward.id,
      name: getRewardDisplayName(reward),
      description: reward.description,
      pointsCost: reward.pointsCost,
      type: reward.type,
      discountPercent: reward.discountPercent || null,
    },
    rewardNote: getRewardNote(reward),
  };

  if (reward.type === 'FREE_ITEM') {
    previewOrder.items = [
      ...cleanItems,
      {
        id: `reward-${reward.id}`,
        productId: targetProduct?.id || null,
        name: targetProduct?.name || reward.name,
        price: 0,
        quantity: 1,
        points: 0,
        isRewardItem: true,
        rewardLabel: 'Offert',
      },
    ];
    return previewOrder;
  }

  const subtotal = Number(previewOrder.subtotal || previewOrder.total || 0);
  const discountAmount = Math.round((subtotal * getRewardDiscountPercent(reward)) / 100 * 100) / 100;
  previewOrder.discountAmount = discountAmount;
  previewOrder.total = Math.max(0, subtotal - discountAmount);
  return previewOrder;
}

function MenuPage() {
  const tableNumber = getTableNumber();
  const draftLoadedRef = useRef(false);
  const [step, setStep] = useState(MENU_STEP);
  const [accessMode, setAccessMode] = useState(() => (getStoredClientAuth() ? 'sign-in' : 'direct'));
  const [clientName, setClientName] = useState(() => getStoredClientAuth()?.name || '');
  const [clientPhone, setClientPhone] = useState(() => getStoredClientAuth()?.phone || '');
  const [cart, setCart] = useState([]);
  const [orderComment, setOrderComment] = useState('');
  const [submittedOrder, setSubmittedOrder] = useState(null);
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [activeCategory, setActiveCategory] = useState('Tous');
  const [selectedProduct, setSelectedProduct] = useState(menuProducts[0]);
  const [detailProduct, setDetailProduct] = useState(null);
  const [rewardsProfile, setRewardsProfile] = useState(() => getDefaultLoyaltyRewards());
  const [loyaltyMessage, setLoyaltyMessage] = useState('');
  const [loyaltyError, setLoyaltyError] = useState('');
  const [redeemingRewardId, setRedeemingRewardId] = useState(null);
  const [selectedRewardId, setSelectedRewardId] = useState(null);
  const [billRequestStatus, setBillRequestStatus] = useState('');
  const [sessionOrders, setSessionOrders] = useState([]);
  const [isLinkExpired, setIsLinkExpired] = useState(false);
  const [qrToken, setQrToken] = useState(() => getQrTokenFromUrl());
  const [authMenuOpen, setAuthMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart],
  );

  const filteredProducts = useMemo(() => {
    if (activeCategory === 'Tous') {
      return menuProducts;
    }

    return menuProducts.filter((product) => product.category === activeCategory);
  }, [activeCategory]);

  const nextReward = useMemo(() => {
    const orderedRewards = [...(rewardsProfile.rewards || [])].sort(
      (firstReward, secondReward) => firstReward.pointsCost - secondReward.pointsCost,
    );
    return (
      orderedRewards.find((reward) => reward.pointsCost > rewardsProfile.totalPoints) ||
      orderedRewards[orderedRewards.length - 1] ||
      null
    );
  }, [rewardsProfile.totalPoints]);

  const rewardProgress = useMemo(() => {
    if (!nextReward) return 100;
    return Math.min(100, Math.round((rewardsProfile.totalPoints / nextReward.pointsCost) * 100));
  }, [nextReward, rewardsProfile.totalPoints]);

  const selectedReward = useMemo(
    () =>
      (rewardsProfile.rewards || []).find((reward) => String(reward.id) === String(selectedRewardId)) ||
      null,
    [rewardsProfile.rewards, selectedRewardId],
  );

  const rewardDiscountAmount = useMemo(() => {
    if (!selectedReward || selectedReward.type !== 'DISCOUNT') return 0;
    return Math.round((subtotal * getRewardDiscountPercent(selectedReward)) / 100 * 100) / 100;
  }, [selectedReward, subtotal]);

  const total = useMemo(
    () => Math.max(0, subtotal - rewardDiscountAmount),
    [subtotal, rewardDiscountAmount],
  );

  const rewardPreviewItem = useMemo(() => {
    if (!selectedReward || selectedReward.type !== 'FREE_ITEM') return null;

    return {
      id: `reward-preview-${selectedReward.id}`,
      name: selectedReward.name,
      price: 0,
      quantity: 1,
      isRewardItem: true,
      rewardLabel: 'Offert',
    };
  }, [selectedReward]);

  const cartDisplayItems = useMemo(
    () => (rewardPreviewItem ? [...cart, rewardPreviewItem] : cart),
    [cart, rewardPreviewItem],
  );

  const cartCount = useMemo(
    () => cartDisplayItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartDisplayItems],
  );

  const cartPoints = useMemo(() => Math.floor(total / 10), [total]);

  const submittedOrderId = submittedOrder?.id;
  const isClientAuthenticated = accessMode !== 'direct' && Boolean(getStoredClientAuth()?.phone);
  const visibleSessionOrders = useMemo(() => {
    const orderMap = new Map();

    sessionOrders.forEach((order) => {
      if (order?.id) {
        orderMap.set(order.id, order);
      }
    });

    if (submittedOrder?.id) {
      orderMap.set(submittedOrder.id, submittedOrder);
    }

    return Array.from(orderMap.values()).sort(
      (firstOrder, secondOrder) =>
        Date.parse(secondOrder.createdAt || 0) - Date.parse(firstOrder.createdAt || 0),
    );
  }, [sessionOrders, submittedOrder]);

  useEffect(() => {
    if (!submittedOrderId) return undefined;

    const syncSubmittedOrderFromStorage = () => {
      const storedOrder = findStoredOrder(submittedOrderId);
      if (storedOrder) {
        setSubmittedOrder(storedOrder);
      }
    };

    window.addEventListener('focus', syncSubmittedOrderFromStorage);
    document.addEventListener('visibilitychange', syncSubmittedOrderFromStorage);

    return () => {
      window.removeEventListener('focus', syncSubmittedOrderFromStorage);
      document.removeEventListener('visibilitychange', syncSubmittedOrderFromStorage);
    };
  }, [submittedOrderId]);

  useEffect(() => {
    if (!qrToken || draftLoadedRef.current || isLinkExpired) return;

    const draft = getStoredClientDraft(tableNumber, qrToken);

    const restoreDraftId = window.setTimeout(() => {
      if (!draft) {
        draftLoadedRef.current = true;
        return;
      }

      setStep(draft.step || MENU_STEP);
      setAccessMode(draft.accessMode || 'direct');
      setClientName(draft.clientName || '');
      setClientPhone(draft.clientPhone || '');
      setCart(Array.isArray(draft.cart) ? draft.cart : []);
      setSelectedRewardId(draft.selectedRewardId || null);
      setOrderComment(draft.orderComment || '');
      setEditingOrderId(draft.editingOrderId || null);
      setActiveCategory(draft.activeCategory || 'Tous');
      setBillRequestStatus(draft.billRequestStatus || '');

      const restoredProduct = menuProducts.find((product) => product.id === draft.selectedProductId);
      if (restoredProduct) {
        setSelectedProduct(restoredProduct);
      }

      if (draft.submittedOrderId) {
        const storedOrder = findStoredOrder(draft.submittedOrderId);
        setSubmittedOrder(storedOrder || draft.submittedOrder || null);
      }

      draftLoadedRef.current = true;
    }, 0);

    return () => window.clearTimeout(restoreDraftId);
  }, [isLinkExpired, qrToken, tableNumber]);

  useEffect(() => {
    if (!qrToken || !draftLoadedRef.current || isLinkExpired) return;

    saveClientDraft(tableNumber, qrToken, {
      step,
      accessMode,
      clientName,
      clientPhone,
      cart,
      selectedRewardId,
      orderComment,
      editingOrderId,
      submittedOrderId: submittedOrder?.id || null,
      submittedOrder,
      activeCategory,
      selectedProductId: selectedProduct?.id,
      billRequestStatus,
      updatedAt: new Date().toISOString(),
    });
  }, [
    accessMode,
    activeCategory,
    billRequestStatus,
    cart,
    clientName,
    clientPhone,
    editingOrderId,
    isLinkExpired,
    orderComment,
    qrToken,
    selectedRewardId,
    selectedProduct?.id,
    step,
    submittedOrder,
    tableNumber,
  ]);

  useEffect(() => {
    let expiryTimeoutId = null;
    let sessionCheckId = null;

    const refreshSession = () => {
      const urlToken = getQrTokenFromUrl();
      let currentSession = getQrSession(tableNumber);

      if (!urlToken) {
        if (!currentSession || isGuestSessionExpired(currentSession)) {
          currentSession = createQrSession({ table: tableNumber });
        }

        const params = new URLSearchParams(window.location.search);
        params.set('token', currentSession.token);
        window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
        setQrToken(currentSession.token);
      } else {
        setQrToken(urlToken);
      }

      const storedOrders = getStoredOrders();
      const tokenMatches = currentSession?.token === (urlToken || currentSession?.token);
      const linkIsExpired = !tokenMatches || isGuestSessionExpired(currentSession);
      const activeSessionOrders = currentSession && tokenMatches
        ? storedOrders.filter((order) => currentSession.orderIds.includes(order.id))
        : [];

      setSessionOrders(activeSessionOrders);
      setIsLinkExpired(linkIsExpired);

      if (expiryTimeoutId) {
        window.clearTimeout(expiryTimeoutId);
      }

      if (!linkIsExpired && currentSession?.expiresAt) {
        const delayUntilExpiry = Math.max(0, Date.parse(currentSession.expiresAt) - Date.now());
        expiryTimeoutId = window.setTimeout(refreshSession, delayUntilExpiry + 250);
      }
    };

    refreshSession();
    sessionCheckId = window.setInterval(refreshSession, 30000);

    return () => {
      if (expiryTimeoutId) {
        window.clearTimeout(expiryTimeoutId);
      }
      if (sessionCheckId) {
        window.clearInterval(sessionCheckId);
      }
    };
  }, [tableNumber]);

  useEffect(() => {
    const stopRealtime = subscribeRealtime({
      onOrder: (updatedOrder) => {
        if (!updatedOrder) return;

        setSessionOrders((currentOrders) => {
          const belongsToSession = currentOrders.some(
            (currentOrder) =>
              currentOrder.id === updatedOrder.id ||
              Number(currentOrder.backendId) === Number(updatedOrder.backendId),
          );

          if (!belongsToSession) {
            return currentOrders;
          }

          updateStoredOrder(updatedOrder.id, updatedOrder);

          return currentOrders.map((currentOrder) =>
            currentOrder.id === updatedOrder.id ||
            Number(currentOrder.backendId) === Number(updatedOrder.backendId)
              ? updatedOrder
              : currentOrder,
          );
        });

        setSubmittedOrder((currentOrder) => {
          if (
            !currentOrder ||
            (currentOrder.id !== updatedOrder.id &&
              Number(currentOrder.backendId) !== Number(updatedOrder.backendId))
          ) {
            return currentOrder;
          }

          updateStoredOrder(updatedOrder.id, updatedOrder);
          return updatedOrder;
        });
      },
      onBillRequest: () => {
        setBillRequestStatus((currentStatus) => currentStatus);
      },
    });

    return stopRealtime;
  }, []);

  useEffect(() => {
    if (!isClientAuthenticated) {
      setRewardsProfile(getDefaultLoyaltyRewards());
      return undefined;
    }

    let isMounted = true;

    const loadLoyalty = async () => {
      try {
        const loyalty = await fetchMyLoyaltyApi();
        if (!isMounted) return;
        setRewardsProfile({
          totalPoints: Number(loyalty.points || 0),
          rewards: loyalty.rewards || [],
          transactions: loyalty.transactions || [],
        });
      } catch (error) {
        if (!isMounted) return;
        setRewardsProfile(getDefaultLoyaltyRewards());
        setLoyaltyError('');
      }
    };

    loadLoyalty();

    return () => {
      isMounted = false;
    };
  }, [isClientAuthenticated]);

  const replaceOrderEverywhere = (updatedOrder) => {
    if (!updatedOrder?.id) return;

    updateStoredOrder(updatedOrder.id, updatedOrder);
    setSessionOrders((currentOrders) =>
      currentOrders.map((currentOrder) =>
        currentOrder.id === updatedOrder.id ? updatedOrder : currentOrder,
      ),
    );
    if (submittedOrder?.id === updatedOrder.id) {
      setSubmittedOrder(updatedOrder);
    }
  };

  const addToCart = (product) => {
    setCart((currentCart) => {
      const existingProduct = currentCart.find((item) => item.id === product.id);

      if (existingProduct) {
        return currentCart.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }

      return [...currentCart, { ...product, quantity: 1 }];
    });
  };

  const scrollToCart = () => {
    setCartOpen(true);
  };

  const viewSubmittedOrder = () => {
    if (!submittedOrder) return;
    setAuthMenuOpen(false);
    setStep(CONFIRMATION_STEP);
  };

  const logoutClient = () => {
    localStorage.removeItem('pos2-client-auth');
    setAccessMode('direct');
    setClientName('');
    setClientPhone('');
    setAuthMenuOpen(false);
    setRewardsProfile(getDefaultLoyaltyRewards());
    setLoyaltyMessage('');
    setLoyaltyError('');
    setSelectedRewardId(null);
    setStep(MENU_STEP);
  };

  const returnToMenuForAnotherOrder = () => {
    setCart([]);
    setSelectedRewardId(null);
    setOrderComment('');
    setEditingOrderId(null);
    setBillRequestStatus('');
    setStep(MENU_STEP);
  };

  const removeOneFromCart = (productId) => {
    setCart((currentCart) =>
      currentCart
        .map((item) => (item.id === productId ? { ...item, quantity: item.quantity - 1 } : item))
        .filter((item) => item.quantity > 0),
    );
  };

  const continueToMenu = (mode) => {
    setAccessMode(mode);
    setIsLinkExpired(false);
    setAuthMenuOpen(false);

    if (mode === 'sign-in' || mode === 'sign-up') {
      setClientName(getStoredClientAuth()?.name || '');
      setStep(AUTH_STEP);
      return;
    }

    setStep(MENU_STEP);
  };

  const handleClientAuthenticated = ({ phone, name, points }) => {
    setClientName(name || phone);
    setClientPhone(phone || '');
    setRewardsProfile({
      ...getDefaultLoyaltyRewards(),
      totalPoints: typeof points === 'number' ? points : 0,
    });
    setSelectedRewardId(null);
    setAuthMenuOpen(false);
    setStep(MENU_STEP);
  };

  const startRewards = () => {
    setAccessMode('sign-in');
    setClientName(getStoredClientAuth()?.name || '');
    setAuthMenuOpen(false);
    setStep(AUTH_STEP);
  };

  const returnFromAuthToMenu = () => {
    setStep(MENU_STEP);
  };

  const claimCurrentOrderRewards = (mode) => {
    continueToMenu(mode);
  };

  const openProductDetails = (product) => {
    setSelectedProduct(product);
    setDetailProduct(product);
  };

  const confirmOrder = async () => {
    if (cart.length === 0) return;

    const createdAt = new Date().toISOString();
    const existingOrder = editingOrderId
      ? visibleSessionOrders.find((order) => order.id === editingOrderId)
      : null;

    const order = {
      id: existingOrder?.id || `TEMP-${createdAt.replaceAll(/[-:.TZ]/g, '')}`,
      backendId: existingOrder?.backendId,
      table: tableNumber,
      clientName: clientName || 'Client invite',
      clientPhone,
      accessMode,
      comment: orderComment,
      subtotal,
      total,
      points: cartPoints,
      items: cart.filter((item) => !item.isRewardItem),
      reward: selectedReward
        ? {
            id: selectedReward.id,
            name: selectedReward.name,
            description: selectedReward.description,
            pointsCost: selectedReward.pointsCost,
            type: selectedReward.type,
            discountPercent: selectedReward.discountPercent || null,
          }
        : null,
      rewardNote: selectedReward ? getRewardNote(selectedReward) : '',
      status: PENDING_STATUS,
      sourceLabel: accessMode === 'direct' ? 'Commande directe QR' : 'Client authentifie',
      createdAt: existingOrder?.createdAt || createdAt,
      updatedAt: createdAt,
    };

    let savedOrder = order;

    try {
      savedOrder = editingOrderId && existingOrder?.backendId
        ? await clientUpdateApiOrder(order, qrToken)
        : await createApiOrder(order);

      if (selectedReward && savedOrder?.backendId && isClientAuthenticated) {
        setRedeemingRewardId(selectedReward.id);
        try {
          const rewardResponse = await redeemRewardApi(selectedReward.id);
          if (rewardResponse.order) {
            savedOrder = rewardResponse.order;
          }

          const loyalty = await fetchMyLoyaltyApi();
          setRewardsProfile({
            totalPoints: Number(loyalty.points || 0),
            rewards: loyalty.rewards || [],
            transactions: loyalty.transactions || [],
          });
          setLoyaltyMessage(rewardResponse.message || 'Recompense appliquee a la commande.');
        } finally {
          setRedeemingRewardId(null);
        }
      }

      if (selectedReward && !savedOrder?.rewardNote) {
        savedOrder = applyRewardPreviewToOrder(savedOrder, selectedReward);
      }
    } catch (error) {
      console.warn('Backend indisponible, commande gardee en localStorage.', error);
      if (selectedReward) {
        savedOrder = applyRewardPreviewToOrder(savedOrder, selectedReward);
      }
    }

    if (editingOrderId) {
      updateStoredOrder(savedOrder.id, savedOrder);
    } else {
      addStoredOrder(savedOrder);
    }

    addOrderToQrSession({ table: tableNumber, accessMode, orderId: savedOrder.id });
    setSessionOrders((currentOrders) => [
      savedOrder,
      ...currentOrders.filter((currentOrder) => currentOrder.id !== savedOrder.id),
    ]);
    setSubmittedOrder(savedOrder);
    setEditingOrderId(null);
    setCart([]);
    setSelectedRewardId(null);
    setOrderComment('');
    setStep(CONFIRMATION_STEP);
  };

  const cancelPendingOrder = async (order) => {
    if (!order || order.status !== PENDING_STATUS) return;

    let cancelledOrder = {
      ...order,
      status: CANCELLED_STATUS,
      updatedAt: new Date().toISOString(),
    };

    try {
      if (order.backendId) {
        cancelledOrder = await clientCancelApiOrder(order, qrToken);
      }
    } catch (error) {
      console.warn('Backend indisponible, annulation gardee en localStorage.', error);
    }

    updateStoredOrder(cancelledOrder.id, cancelledOrder);
    setSessionOrders((currentOrders) =>
      currentOrders.map((currentOrder) =>
        currentOrder.id === cancelledOrder.id ? cancelledOrder : currentOrder,
      ),
    );
    if (submittedOrder?.id === cancelledOrder.id) {
      setSubmittedOrder(cancelledOrder);
    }
    setBillRequestStatus('Commande annulee avant validation serveur.');
  };

  const editPendingOrder = (order) => {
    if (!order || order.status !== PENDING_STATUS) return;

    setEditingOrderId(order.id);
    setSubmittedOrder(order);
    setCart((order.items || []).filter((item) => !item.isRewardItem));
    setSelectedRewardId(order.reward?.id || null);
    setOrderComment(order.comment || '');
    setBillRequestStatus('');
    setCartOpen(true);
    setStep(MENU_STEP);
  };

  const requestBill = async (targetOrder = submittedOrder) => {
    if (!targetOrder) return;
    if (targetOrder.status === PENDING_STATUS || targetOrder.status === CANCELLED_STATUS) return;

    const createdAt = new Date().toISOString();
    const localBillRequest = {
      id: `BILL-${createdAt.replaceAll(/[-:.TZ]/g, '')}`,
      table: tableNumber,
      orderId: targetOrder.id,
      clientName: targetOrder.clientName,
      subtotal: targetOrder.subtotal || targetOrder.total,
      total: targetOrder.total,
      reward: targetOrder.reward || null,
      rewardNote: targetOrder.rewardNote || '',
      discountAmount: targetOrder.discountAmount || 0,
      items: targetOrder.items,
      status: 'En attente',
      createdAt,
      updatedAt: createdAt,
    };

    try {
      const apiBillRequest = await createApiBillRequest(targetOrder);
      addBillRequest(apiBillRequest);
    } catch (error) {
      console.warn('Backend indisponible, demande addition gardee en localStorage.', error);
      addBillRequest(localBillRequest);
    }

    setBillRequestStatus('Le serveur associe a votre table a ete appele pour ramener l addition.');
  };

  const handleRewardRedeem = async (reward) => {
    setLoyaltyMessage('');
    setLoyaltyError('');

    if (!isClientAuthenticated) {
      setLoyaltyError('Connecte-toi pour utiliser tes points.');
      return;
    }

    if (!reward) return;

    if (rewardsProfile.totalPoints < reward.pointsCost) {
      setLoyaltyError(
        `Encore ${reward.pointsCost - rewardsProfile.totalPoints} point(s) pour ${getRewardDisplayName(reward)}.`,
      );
      return;
    }

    const isSameRewardSelected = String(selectedRewardId) === String(reward.id);

    setSelectedRewardId((currentRewardId) =>
      String(currentRewardId) === String(reward.id) ? null : reward.id,
    );
    setLoyaltyMessage(
      isSameRewardSelected
        ? 'Recompense retiree du panier.'
        : `${getRewardDisplayName(reward)} sera applique a cette commande.`,
    );
    setCartOpen(true);
  };

  return (
    <main className="client-page">
      <header className={`client-header ${step === MENU_STEP && !isLinkExpired ? 'client-header-rich' : ''}`}>
        <div className="client-header-copy">
          <p className="eyebrow">Commande client QR</p>
          <h1>Menu du restaurant</h1>
          <p className="client-header-summary">
            Commande digitale a table, suivi clair, validation rapide par le serveur.
          </p>
          <div className="client-header-meta">
            <p className="table-label">Table numero {tableNumber}</p>
            <p className="service-chip">{isClientAuthenticated ? 'Compte client' : 'Commande rapide'}</p>
          </div>
        </div>
      </header>

      {isLinkExpired && (
        <section className="access-panel session-panel">
          <p className="eyebrow">Lien QR termine</p>
          <h2>La session invite de cette table est fermee</h2>
          <p>
            Ce token QR n'est plus valable. Il reste actif 1h30 ou jusqu'a la cloture de
            l'addition. Pour commander a nouveau, il faut scanner le QR code de la table une
            nouvelle fois.
          </p>
          <a className="primary-link" href={`/menu?table=${tableNumber}`}>
            Simuler un nouveau scan QR
          </a>
        </section>
      )}

      {step === ACCESS_STEP && !isLinkExpired && (
        <section className="access-panel">
          <div className="access-hero">
            <div>
              <p className="eyebrow">Bienvenue a table {tableNumber}</p>
              <h2>Choisis ton mode de commande</h2>
              <p>
                Tu peux te connecter pour garder ton historique, creer un compte fidelite, ou
                commander directement sans inscription.
              </p>
              <small className="token-note">Token QR actif : {qrToken || 'generation...'}</small>
            </div>
            <div className="qr-preview">
              <span>QR</span>
              <small>Table {tableNumber}</small>
            </div>
          </div>

          <div className="choice-grid">
            <button type="button" onClick={() => continueToMenu('sign-up')}>
              <strong>Sign up</strong>
              <span>Creer un compte et commencer la fidelite.</span>
            </button>
            <button type="button" onClick={() => continueToMenu('sign-in')}>
              <strong>Sign in</strong>
              <span>Retrouver ton profil et ton historique.</span>
            </button>
            <button type="button" onClick={() => continueToMenu('direct')}>
              <strong>Commander directement</strong>
              <span>Voir le menu et envoyer la commande au serveur.</span>
            </button>
          </div>

          <ClientOrdersPanel
            orders={visibleSessionOrders}
            profile={rewardsProfile}
            onRequestBill={requestBill}
            onCancelOrder={cancelPendingOrder}
            onEditOrder={editPendingOrder}
            billRequestStatus={billRequestStatus}
          />
        </section>
      )}

      {step === AUTH_STEP && !isLinkExpired && (
        <section className="access-panel">
          <ClientAuth
            initialMode={accessMode}
            onAuthenticated={handleClientAuthenticated}
            onBackToMenu={returnFromAuthToMenu}
          />
        </section>
      )}

      {step === MENU_STEP && !isLinkExpired && (
        <div className="menu-layout">
          <section className="menu-section">
            <div className="client-overview-grid">
              <section className="client-auth-bar">
                <div className="client-auth-copy">
                  <p className="eyebrow">Compte client</p>
                  {accessMode === 'direct' ? (
                    <>
                      <h2>Commande rapide</h2>
                      <p>Connecte-toi seulement si tu veux garder tes points et ton historique.</p>
                    </>
                  ) : (
                    <>
                      <h2>{clientName || 'Compte client'}, fidelite active</h2>
                      <p>Les points sont ajoutes apres paiement uniquement.</p>
                    </>
                  )}
                </div>
                <div className="client-auth-actions" aria-label="Choix compte client">
                  <button
                    className="hamburger-menu-button"
                    type="button"
                    aria-expanded={authMenuOpen}
                    aria-label="Ouvrir le menu client"
                    onClick={() => setAuthMenuOpen((isOpen) => !isOpen)}
                  >
                    Menu
                  </button>
                  {authMenuOpen && (
                    <div className="client-auth-menu">
                      {isClientAuthenticated ? (
                        <button type="button" onClick={logoutClient}>
                          Deconnecter
                        </button>
                      ) : (
                        <>
                          <button type="button" onClick={() => continueToMenu('sign-up')}>
                            S'inscrire
                          </button>
                          <button type="button" onClick={() => continueToMenu('sign-in')}>
                            Se connecter
                          </button>
                          <button type="button" onClick={() => continueToMenu('direct')}>
                            Commande rapide
                          </button>
                        </>
                      )}
                      <button
                        className="view-order-button"
                        disabled={!submittedOrder}
                        type="button"
                        onClick={viewSubmittedOrder}
                      >
                        Voir ma commande
                      </button>
                    </div>
                  )}
                </div>
              </section>

              <section className="reward-strip">
                <div className="reward-strip-header">
                  <div className="reward-strip-copy">
                    <p className="eyebrow">Programme fidelite</p>
                    {accessMode === 'direct' ? (
                      <>
                        <h2>Cumule tes points</h2>
                        <p>
                          Gagne 1 point chaque 10 MAD payes. Connecte-toi pour garder tes
                          points et debloquer tes recompenses.
                        </p>
                      </>
                    ) : (
                      <>
                        <h2>Fidelite active</h2>
                        <p>
                          {nextReward
                            ? `${rewardsProfile.totalPoints} pts disponibles. Prochaine recompense : ${nextReward.name} a ${nextReward.pointsCost} pts.`
                            : `${rewardsProfile.totalPoints} pts disponibles. Cette commande peut ajouter environ ${cartPoints} point(s) apres paiement.`}
                        </p>
                      </>
                    )}
                  </div>
                  {accessMode === 'direct' && (
                    <button type="button" onClick={startRewards}>
                      Se connecter
                    </button>
                  )}
                </div>
                {selectedReward && accessMode !== 'direct' && (
                  <p className="reward-strip-selection">
                    Recompense choisie : {selectedReward.type === 'DISCOUNT'
                      ? `${selectedReward.name} - ${getRewardDiscountPercent(selectedReward)}%`
                      : `${getRewardDisplayName(selectedReward)} offert`}
                  </p>
                )}
                {accessMode === 'direct' ? (
                  <div className="reward-strip-metrics reward-strip-metrics-guest">
                    <article className="reward-stat-card">
                      <span>Cette commande</span>
                      <strong>{cartPoints} pts</strong>
                    </article>
                    <article className="reward-stat-card">
                      <span>Principe</span>
                      <strong>1 pt / 10 MAD</strong>
                    </article>
                  </div>
                ) : (
                  <div className="reward-strip-metrics">
                    <article className="reward-stat-card">
                      <span>Solde</span>
                      <strong>{rewardsProfile.totalPoints} pts</strong>
                    </article>
                    <article className="reward-stat-card">
                      <span>Cette commande</span>
                      <strong>{cartPoints} pts</strong>
                    </article>
                    <div className="reward-progress-card">
                      <span>Prochaine recompense</span>
                      <strong>{nextReward ? nextReward.name : 'Toutes debloquees'}</strong>
                      <div className="reward-meter" aria-label="Progression recompense">
                        <span style={{ width: `${rewardProgress}%` }} />
                      </div>
                    </div>
                  </div>
                )}
              </section>
            </div>

            {isClientAuthenticated &&
              ((rewardsProfile.rewards || []).length > 0 || loyaltyMessage || loyaltyError) && (
              <section className="client-loyalty-panel">
                <div className="section-heading compact-section-heading">
                  <h2>Utiliser mes points</h2>
                  <p>Choisis une recompense et elle sera appliquee directement au panier.</p>
                </div>

                {(loyaltyMessage || loyaltyError) && (
                  <p className={loyaltyError ? 'auth-error' : 'auth-message'}>
                    {loyaltyError || loyaltyMessage}
                  </p>
                )}

                <div className="client-reward-grid">
                  {(rewardsProfile.rewards || []).map((reward) => {
                    const canRedeem = rewardsProfile.totalPoints >= reward.pointsCost;
                    const missingPoints = Math.max(0, reward.pointsCost - rewardsProfile.totalPoints);
                    const isSelected = String(selectedRewardId) === String(reward.id);

                    return (
                      <article
                        className={`client-reward-card ${isSelected ? 'client-reward-card-active' : ''}`}
                        key={reward.id}
                      >
                        <div className="client-reward-card-copy">
                          <span className="client-reward-type">
                            {reward.type === 'DISCOUNT' ? 'Reduction' : 'Article offert'}
                          </span>
                          <strong>{reward.type === 'FREE_ITEM' ? getRewardDisplayName(reward) : reward.name}</strong>
                          <p>{reward.description}</p>
                          <span className="client-reward-hint">
                            {reward.type === 'DISCOUNT'
                              ? `Le total baisse de ${getRewardDiscountPercent(reward)}%.`
                              : `${getRewardDisplayName(reward)} sera ajoute au panier a 0 MAD.`}
                          </span>
                        </div>
                        <div className="client-reward-footer">
                          <div className="client-reward-meta">
                            <span>{reward.pointsCost} pts</span>
                            {!canRedeem && <small>Encore {missingPoints} pts</small>}
                          </div>
                          <button
                            className={`primary-button ${isSelected ? 'reward-selected-button' : ''}`}
                            type="button"
                            onClick={() => handleRewardRedeem(reward)}
                          >
                            {redeemingRewardId === reward.id
                              ? 'Application...'
                              : isSelected
                                ? 'Retirer'
                                : 'Utiliser'}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            <div className="menu-hero">
              <div
                className="menu-hero-image"
                style={{ backgroundImage: `url(${selectedProduct.image})` }}
                aria-hidden="true"
              />
              <div className="menu-hero-content">
                <p className="eyebrow">Selection du moment</p>
                <div className="menu-hero-copy">
                  <h2>{selectedProduct.name}</h2>
                  <p>{selectedProduct.description}</p>
                </div>
                <div className="menu-hero-footer">
                  <div className="hero-stats">
                    <span>{selectedProduct.prepTime}</span>
                    <span>{getEstimatedProductPoints(selectedProduct.price)} pts</span>
                    <span className="price-badge">{formatPrice(selectedProduct.price)}</span>
                  </div>
                  <button type="button" onClick={() => addToCart(selectedProduct)}>
                    Ajouter au panier
                  </button>
                </div>
              </div>
            </div>

            {accessMode !== 'direct' && (
              <label className="field">
                Nom du client
                <input
                  onChange={(event) => setClientName(event.target.value)}
                  placeholder="Ex: Pablo"
                  type="text"
                  value={clientName}
                />
              </label>
            )}

            <div className="section-heading">
              <h2>Produits disponibles</h2>
              <p>Explore les categories, consulte les details, puis ajoute au panier.</p>
            </div>

            <div className="category-tabs" aria-label="Categories du menu">
              {menuCategories.map((category) => (
                <button
                  className={activeCategory === category ? 'active' : ''}
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  type="button"
                >
                  {category}
                </button>
              ))}
            </div>

            <div className="product-list">
              {filteredProducts.map((product) => (
                <article
                  className="product-card"
                  key={product.id}
                  style={{ '--product-accent': product.accent }}
                >
                  <div
                    className="product-image"
                    style={{ backgroundImage: `url(${product.image})` }}
                    aria-hidden="true"
                  />
                  <div>
                    <div className="product-topline">
                      <span>{product.category}</span>
                      <strong>{product.badge}</strong>
                    </div>
                    <h3>{product.name}</h3>
                    <p>{product.description}</p>
                    <div className="product-details">
                      <span>{product.prepTime}</span>
                      <span>{getEstimatedProductPoints(product.price)} pts</span>
                    </div>
                    <small>{product.details}</small>
                  </div>
                  <footer>
                    <strong>{formatPrice(product.price)}</strong>
                    <div className="product-actions">
                      <button type="button" onClick={() => openProductDetails(product)}>
                        Details
                      </button>
                      <button type="button" onClick={() => addToCart(product)}>
                        Ajouter
                      </button>
                    </div>
                  </footer>
                </article>
              ))}
            </div>
          </section>

          {cartOpen && (
            <button
              className="cart-backdrop"
              type="button"
              aria-label="Fermer le panier"
              onClick={() => setCartOpen(false)}
            />
          )}

          <aside className={`cart-panel ${cartOpen ? 'cart-panel-open' : ''}`} id="client-cart">
            <div className="cart-title">
              <div>
                <h2>Panier</h2>
                <p>Table {tableNumber}</p>
              </div>
              <span>{cartCount}</span>
            </div>
            <button
              className="cart-close-button"
              type="button"
              aria-label="Fermer le panier"
              onClick={() => setCartOpen(false)}
            >
              ×
            </button>
            <div className="points-preview">
              <span>Points de cette commande</span>
              <strong>{cartPoints} pts</strong>
            </div>
            {selectedReward && (
              <div className="cart-reward-banner">
                <strong>Recompense appliquee</strong>
                <span>{getRewardNote(selectedReward)}</span>
              </div>
            )}
            {cart.length === 0 && !rewardPreviewItem && <p className="muted">Aucun produit ajoute.</p>}

            <div className="cart-items">
              {cartDisplayItems.map((item) => (
                <div className={`cart-item ${item.isRewardItem ? 'cart-item-reward' : ''}`} key={`${item.id}-${item.quantity}`}>
                  <div>
                    <strong>{item.name}</strong>
                    <span>
                      {item.quantity} x {formatPrice(item.price)}
                    </span>
                  </div>
                  {item.isRewardItem ? (
                    <strong className="cart-item-tag">Gratuit</strong>
                  ) : (
                    <div className="cart-quantity-actions" aria-label={`Quantite ${item.name}`}>
                      <button
                        type="button"
                        aria-label={`Retirer ${item.name}`}
                        onClick={() => removeOneFromCart(item.id)}
                      >
                        -
                      </button>
                      <strong>{item.quantity}</strong>
                      <button
                        type="button"
                        aria-label={`Ajouter ${item.name}`}
                        onClick={() => addToCart(item)}
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <label className="field">
              Commentaire sur l'ordre
              <textarea
                onChange={(event) => setOrderComment(event.target.value)}
                placeholder="Ex: sans oignon, sauce a part, allergie, cuisson..."
                value={orderComment}
              />
            </label>

            {selectedReward?.type === 'DISCOUNT' && (
              <>
                <div className="total-row total-row-muted">
                  <span>Sous-total</span>
                  <strong>{formatPrice(subtotal)}</strong>
                </div>
                <div className="total-row total-row-discount">
                  <span>{selectedReward.name}</span>
                  <strong>-{formatPrice(rewardDiscountAmount)}</strong>
                </div>
              </>
            )}
            <div className="total-row">
              <span>Total a payer</span>
              <strong>{formatPrice(total)}</strong>
            </div>

            <button className="primary-button" type="button" onClick={confirmOrder}>
              {editingOrderId ? "Mettre a jour l'ordre" : "Confirmer l'ordre"}
            </button>
          </aside>

          <button
            className="floating-basket"
            type="button"
            onClick={scrollToCart}
            aria-label="Voir le panier"
          >
            <span aria-hidden="true">🛒</span>
            <strong>{cartCount}</strong>
          </button>
        </div>
      )}

      {step === CONFIRMATION_STEP && submittedOrder && (
        <section className="confirmation-panel confirmation-panel-clean">
          <div className="confirmation-hero-card">
            <div>
              <p className="eyebrow">Commande envoyee</p>
              <h2>Table {submittedOrder.table}</h2>
              <p>
                La commande est visible sur la tablette serveur. Garde cette page ouverte pour
                suivre le statut ou demander l'addition.
              </p>
              <span className="confirmation-status-chip">{submittedOrder.status}</span>
            </div>
            <div className="confirmation-live-card">
              <span>Suivi</span>
              <strong>Serveur</strong>
              <small>Mise a jour automatique</small>
            </div>
          </div>

          <div className="confirmation-actions">
            <button className="primary-button" type="button" onClick={returnToMenuForAnotherOrder}>
              Retour au menu
            </button>
          </div>

          <ClientOrdersPanel
            orders={visibleSessionOrders}
            profile={rewardsProfile}
            onRequestBill={requestBill}
            onCancelOrder={cancelPendingOrder}
            onEditOrder={editPendingOrder}
            billRequestStatus={billRequestStatus}
          />

          {accessMode === 'direct' ? (
            <div className="reward-callout">
              <strong>Tu commandes sans compte</strong>
              <span>
                Cree un compte ou connecte-toi la prochaine fois pour garder tes points et gagner
                un soda, une glace ou un menu gratuit.
              </span>
              <div className="reward-actions">
                <button type="button" onClick={() => claimCurrentOrderRewards('sign-in')}>
                  Sign in et garder mes points
                </button>
                <button type="button" onClick={() => claimCurrentOrderRewards('sign-up')}>
                  Sign up maintenant
                </button>
              </div>
            </div>
          ) : (
            <div className="reward-callout success">
              <strong>Points credites apres paiement</strong>
              <span>
                Cette commande peut rapporter environ {submittedOrder.points} point(s) si elle est payee.
              </span>
            </div>
          )}
        </section>
      )}

      {detailProduct && (
        <div className="product-detail-backdrop" role="presentation">
          <section className="product-detail-panel" aria-label={`Details ${detailProduct.name}`}>
            <button
              className="detail-close-button"
              type="button"
              onClick={() => setDetailProduct(null)}
            >
              Fermer
            </button>
            <div
              className="detail-image"
              style={{ backgroundImage: `url(${detailProduct.image})` }}
              aria-hidden="true"
            />
            <div className="detail-content">
              <p className="eyebrow">{detailProduct.category}</p>
              <h2>{detailProduct.name}</h2>
              <p>{detailProduct.description}</p>
              <div className="hero-stats">
                <span>{detailProduct.prepTime}</span>
                <span>{getEstimatedProductPoints(detailProduct.price)} pts</span>
                <span className="price-badge">{formatPrice(detailProduct.price)}</span>
              </div>
              <div className="detail-info-grid">
                <div>
                  <strong>Details</strong>
                  <span>{detailProduct.details}</span>
                </div>
                <div>
                  <strong>Poste cuisine</strong>
                  <span>{detailProduct.station}</span>
                </div>
                <div>
                  <strong>Recompenses</strong>
                  <span>
                    Cette commande rapporte environ {getEstimatedProductPoints(detailProduct.price)} point(s) apres paiement.
                  </span>
                </div>
              </div>
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  addToCart(detailProduct);
                  setDetailProduct(null);
                }}
              >
                Ajouter au panier
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function ClientOrdersPanel({
  orders,
  profile,
  onRequestBill,
  onCancelOrder,
  onEditOrder,
  billRequestStatus,
}) {
  const historyOrders = profile.transactions || [];
  const hasActiveOrders = orders.length > 0;
  const hasHistory = historyOrders.length > 0;

  if (!hasActiveOrders && !hasHistory) {
    return null;
  }

  return (
    <section className="client-orders-panel">
      <div className="section-heading">
        <h2>Mes commandes</h2>
        <p>Toutes les commandes de cette session QR sont ici, avec leur addition separee.</p>
      </div>

      {hasActiveOrders && (
        <div className="client-order-list">
          {orders.map((order) => (
            <article className="client-order-card" key={order.id}>
              <div className="order-title">
                <div>
                  <strong>{order.id}</strong>
                  <span>Table {order.table}</span>
                </div>
                <span className="status-badge">{order.status}</span>
              </div>
              <ul>
                {order.items.map((item) => (
                  <li key={`${order.id}-${item.id}`}>
                    {item.quantity} x {item.name}
                  </li>
                ))}
              </ul>
              {order.rewardNote && <p className="client-order-note">{order.rewardNote}</p>}
              <div className="total-row compact-total">
                <span>Total</span>
                <strong>{formatPrice(order.total)}</strong>
              </div>
              {order.status === PENDING_STATUS ? (
                <div className="client-order-actions">
                  <button type="button" onClick={() => onEditOrder(order)}>
                    Modifier
                  </button>
                  <button
                    className="client-order-danger"
                    type="button"
                    onClick={() => onCancelOrder(order)}
                  >
                    Annuler
                  </button>
                </div>
              ) : order.status === CANCELLED_STATUS ? (
                <p className="client-order-note">Commande annulee avant validation.</p>
              ) : (
                <button type="button" onClick={() => onRequestBill(order)}>
                  Demander l'addition
                </button>
              )}
            </article>
          ))}
        </div>
      )}

      {billRequestStatus && <p className="session-message">{billRequestStatus}</p>}

      {hasHistory && (
        <div className="history-mini">
          <strong>Historique fidelite</strong>
          <span>
            {historyOrders.length} mouvement(s) et {profile.totalPoints} points disponibles.
          </span>
        </div>
      )}
    </section>
  );
}

export default MenuPage;
