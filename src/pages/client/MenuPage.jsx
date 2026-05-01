import { useEffect, useMemo, useRef, useState } from 'react';
import { menuCategories, menuProducts, rewardLevels } from '../../data/menuProducts';
import { formatPrice } from '../../utils/format';
import {
  addStoredOrder,
  findStoredOrder,
  getStoredOrders,
  updateStoredOrder,
} from '../../utils/ordersStorage';
import { addOrderToHistory, addRewardPoints, getRewardsProfile } from '../../utils/rewardsStorage';
import { addBillRequest } from '../../utils/billRequestsStorage';
import {
  clientCancelApiOrder,
  clientUpdateApiOrder,
  createApiBillRequest,
  createApiOrder,
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
  const [rewardsProfile, setRewardsProfile] = useState(() => getRewardsProfile());
  const [earnedPoints, setEarnedPoints] = useState(0);
  const [billRequestStatus, setBillRequestStatus] = useState('');
  const [sessionOrders, setSessionOrders] = useState([]);
  const [isLinkExpired, setIsLinkExpired] = useState(false);
  const [qrToken, setQrToken] = useState(() => getQrTokenFromUrl());
  const [authMenuOpen, setAuthMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart],
  );

  const filteredProducts = useMemo(() => {
    if (activeCategory === 'Tous') {
      return menuProducts;
    }

    return menuProducts.filter((product) => product.category === activeCategory);
  }, [activeCategory]);

  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart],
  );

  const cartPoints = useMemo(
    () => cart.reduce((sum, item) => sum + item.points * item.quantity, 0),
    [cart],
  );

  const nextReward = useMemo(() => {
    const nextLevel = rewardLevels.find((reward) => reward.points > rewardsProfile.totalPoints);
    return nextLevel || rewardLevels[rewardLevels.length - 1];
  }, [rewardsProfile.totalPoints]);

  const rewardProgress = useMemo(() => {
    if (!nextReward) return 100;
    return Math.min(100, Math.round((rewardsProfile.totalPoints / nextReward.points) * 100));
  }, [nextReward, rewardsProfile.totalPoints]);

  const submittedOrderId = submittedOrder?.id;
  const isClientAuthenticated = accessMode !== 'direct';
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

    const intervalId = window.setInterval(() => {
      const storedOrder = findStoredOrder(submittedOrderId);
      if (storedOrder) {
        setSubmittedOrder(storedOrder);
      }
    }, 1000);

    return () => window.clearInterval(intervalId);
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
      setOrderComment(draft.orderComment || '');
      setEditingOrderId(draft.editingOrderId || null);
      setActiveCategory(draft.activeCategory || 'Tous');
      setEarnedPoints(Number(draft.earnedPoints || 0));
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
      orderComment,
      editingOrderId,
      submittedOrderId: submittedOrder?.id || null,
      submittedOrder,
      activeCategory,
      selectedProductId: selectedProduct?.id,
      earnedPoints,
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
    earnedPoints,
    isLinkExpired,
    orderComment,
    qrToken,
    selectedProduct?.id,
    step,
    submittedOrder,
    tableNumber,
  ]);

  useEffect(() => {
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
      const currentProfile = getRewardsProfile();
      const tokenMatches = currentSession?.token === (urlToken || currentSession?.token);
      const linkIsExpired = !tokenMatches || isGuestSessionExpired(currentSession);
      const activeSessionOrders = currentSession && tokenMatches
        ? storedOrders.filter((order) => currentSession.orderIds.includes(order.id))
        : [];

      setSessionOrders(activeSessionOrders);
      setRewardsProfile(currentProfile);
      setIsLinkExpired(linkIsExpired);
    };

    refreshSession();
    const intervalId = window.setInterval(refreshSession, 1000);

    return () => window.clearInterval(intervalId);
  }, [tableNumber]);

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
    setStep(MENU_STEP);
  };

  const returnToMenuForAnotherOrder = () => {
    setCart([]);
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
      const profile = getRewardsProfile();
      setRewardsProfile(profile);
      setClientName(profile.clientName || '');
      setStep(AUTH_STEP);
      return;
    }

    setStep(MENU_STEP);
  };

  const handleClientAuthenticated = ({ phone, name }) => {
    const profile = getRewardsProfile();
    setClientName(profile.clientName || name || phone);
    setClientPhone(phone || '');
    setRewardsProfile({
      ...profile,
      clientName: profile.clientName || name || phone,
    });
    setAuthMenuOpen(false);
    setStep(MENU_STEP);
  };

  const startRewards = () => {
    setAccessMode('sign-in');
    const profile = getRewardsProfile();
    setRewardsProfile(profile);
    setClientName(profile.clientName || '');
    setAuthMenuOpen(false);
    setStep(AUTH_STEP);
  };

  const claimCurrentOrderRewards = (mode) => {
    if (!submittedOrder || accessMode !== 'direct') return;

    const nextProfile = addRewardPoints({
      clientName: clientName || 'Client fidele',
      points: submittedOrder.points,
    });

    addOrderToHistory(submittedOrder);
    setAccessMode(mode);
    setRewardsProfile(nextProfile);
    setEarnedPoints(submittedOrder.points);
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
      total,
      points: cartPoints,
      items: cart,
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
    } catch (error) {
      console.warn('Backend indisponible, commande gardee en localStorage.', error);
    }

    if (editingOrderId) {
      updateStoredOrder(savedOrder.id, savedOrder);
    } else {
      addStoredOrder(savedOrder);
    }

    if (accessMode !== 'direct') {
      const nextProfile = addRewardPoints({
        clientName: clientName || 'Client fidele',
        points: savedOrder.points || cartPoints,
      });
      addOrderToHistory(savedOrder);
      setRewardsProfile(nextProfile);
      setEarnedPoints(savedOrder.points || cartPoints);
    }

    addOrderToQrSession({ table: tableNumber, accessMode, orderId: savedOrder.id });
    setSessionOrders((currentOrders) => [
      savedOrder,
      ...currentOrders.filter((currentOrder) => currentOrder.id !== savedOrder.id),
    ]);
    setSubmittedOrder(savedOrder);
    setEditingOrderId(null);
    setCart([]);
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
    setCart(order.items || []);
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
      total: targetOrder.total,
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

  return (
    <main className="client-page">
      <header className="client-header">
        <div>
          <p className="eyebrow">Commande client QR</p>
          <h1>Menu du restaurant</h1>
          <div className="client-header-meta">
            <p className="table-label">Table numero {tableNumber}</p>
            <p className="service-chip">Service rapide</p>
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
          <ClientAuth initialMode={accessMode} onAuthenticated={handleClientAuthenticated} />
        </section>
      )}

      {step === MENU_STEP && !isLinkExpired && (
        <div className="menu-layout">
          <section className="menu-section">
            <section className="client-auth-bar">
              <div>
                <p className="eyebrow">Recompenses premium</p>
                {accessMode === 'direct' ? (
                  <>
                    <h2>Commande rapide, cadeaux possibles</h2>
                    <p>
                      Connecte-toi pour garder tes points et debloquer soda, glace ou menu gratuit.
                    </p>
                  </>
                ) : (
                  <>
                    <h2>{clientName || 'Client fidele'}, tes points sont actifs</h2>
                    <p>Chaque plat ajoute des points automatiquement a ton profil.</p>
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
                  ☰
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
              <div>
                <p className="eyebrow">Programme fidelite</p>
                {accessMode === 'direct' ? (
                  <>
                    <h2>Connecte-toi pour commencer les recompenses</h2>
                    <p>
                      Cette commande peut rapporter {cartPoints} point(s). Les points sont gardes
                      seulement avec un compte client.
                    </p>
                  </>
                ) : (
                  <>
                    <h2>{rewardsProfile.totalPoints} points disponibles</h2>
                    <p>
                      Prochaine recompense : {nextReward.title} a {nextReward.points} points.
                    </p>
                  </>
                )}
              </div>
              {accessMode === 'direct' ? (
                <button type="button" onClick={startRewards}>
                  Sign in pour les points
                </button>
              ) : (
                <div className="reward-meter" aria-label="Progression recompense">
                  <span style={{ width: `${rewardProgress}%` }} />
                </div>
              )}
            </section>

            <div className="menu-hero">
              <div
                className="menu-hero-image"
                style={{ backgroundImage: `url(${selectedProduct.image})` }}
                aria-hidden="true"
              />
              <div>
                <p className="eyebrow">Selection du moment</p>
                <h2>{selectedProduct.name}</h2>
                <p>{selectedProduct.description}</p>
                <div className="hero-stats">
                  <span>⏱ {selectedProduct.prepTime}</span>
                  <span>🎁 {selectedProduct.points} pts</span>
                  <span className="price-badge">💰 {formatPrice(selectedProduct.price)}</span>
                </div>
              </div>
              <button type="button" onClick={() => addToCart(selectedProduct)}>
                Ajouter cette suggestion
              </button>
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
                      <span>⏱ {product.prepTime}</span>
                      <span>🎁 {product.points} pts</span>
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
            {cart.length === 0 && <p className="muted">Aucun produit ajoute.</p>}

            <div className="cart-items">
              {cart.map((item) => (
                <div className="cart-item" key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    <span>
                      {item.quantity} x {formatPrice(item.price)}
                    </span>
                  </div>
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

            <div className="total-row">
              <span>Total</span>
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
              <strong>+{earnedPoints} points ajoutes</strong>
              <span>
                Tu as maintenant {rewardsProfile.totalPoints} points et {rewardsProfile.orderCount}{' '}
                commande(s) dans ton profil fidelite.
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
                <span>⏱ {detailProduct.prepTime}</span>
                <span>🎁 {detailProduct.points} pts</span>
                <span className="price-badge">💰 {formatPrice(detailProduct.price)}</span>
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
                  <span>Ce plat ajoute {detailProduct.points} point(s) a un compte client.</span>
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
  const historyOrders = profile.orderHistory || [];
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
          <strong>Historique du compte</strong>
          <span>
            {historyOrders.length} commande(s) sauvegardee(s), {profile.totalPoints} points au
            total.
          </span>
        </div>
      )}
    </section>
  );
}

export default MenuPage;
