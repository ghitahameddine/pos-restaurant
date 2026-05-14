import { useEffect, useMemo, useRef, useState } from 'react';
import {
  completeApiKitchenOrder,
  fetchApiKitchenManager,
  fetchApiKitchenStation,
  readyApiKitchenStationOrder,
  startApiKitchenStationOrder,
  subscribeRealtime,
} from '../../utils/api';

const SCREEN_OPTIONS = [
  { key: 'plats', label: 'Plats principaux', shortLabel: 'Plats', aliases: ['plat', 'mains', 'main'] },
  { key: 'boissons', label: 'Boissons', shortLabel: 'Boissons', aliases: ['boisson', 'drinks', 'drink'] },
  { key: 'desserts', label: 'Desserts', shortLabel: 'Desserts', aliases: ['dessert'] },
  { key: 'manager', label: 'Responsable cuisine', shortLabel: 'Responsable', aliases: ['responsable', 'chef'] },
];

function normalizeScreenKey(value) {
  const requested = String(value || 'plats')
    .trim()
    .toLowerCase();
  const screen = SCREEN_OPTIONS.find(
    (option) => option.key === requested || option.aliases.includes(requested),
  );
  return screen?.key || 'plats';
}

function getActiveScreen() {
  const params = new URLSearchParams(window.location.search);
  return normalizeScreenKey(params.get('station'));
}

function formatElapsed(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return 'A l instant';
  }

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours} h ${remainingMinutes} min` : `${hours} h`;
}

function getStationActionLabel(status) {
  if (status === 'WAITING') return 'Commencer';
  if (status === 'IN_PROGRESS') return 'Marquer pret';
  return 'Pret pour plateau';
}

function getStationStatusLabel(status) {
  if (status === 'WAITING') return 'En attente';
  if (status === 'IN_PROGRESS') return 'En cours';
  if (status === 'DONE') return 'Pret';
  return 'Inconnu';
}

function getManagerStatusLabel(progress) {
  if (!progress?.required) return 'Non concerne';
  if (progress.status === 'DONE') return 'Pret';
  if (progress.status === 'IN_PROGRESS') return 'En cours';
  return 'En attente';
}

function getElapsedTone(minutes) {
  if (!Number.isFinite(minutes) || minutes < 8) return 'fresh';
  if (minutes < 15) return 'watch';
  return 'alert';
}

function countStationStatus(tickets, status) {
  return tickets.filter((ticket) => ticket.status === status).length;
}

function getSlotTheme(slotColor) {
  const normalized = String(slotColor || '')
    .trim()
    .toLowerCase();

  if (normalized.includes('rouge')) {
    return 'slot-red';
  }
  if (normalized.includes('vert')) {
    return 'slot-green';
  }
  if (normalized.includes('bleu')) {
    return 'slot-blue';
  }
  if (normalized.includes('jaune') || normalized.includes('gold') || normalized.includes('dor')) {
    return 'slot-gold';
  }

  return 'slot-neutral';
}

function getSlotAccent(slotColor) {
  const value = String(slotColor || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(value)) {
    return value;
  }

  const normalized = value.toLowerCase();
  if (normalized.includes('rouge')) return '#bb4639';
  if (normalized.includes('vert')) return '#207f5c';
  if (normalized.includes('bleu')) return '#23545b';
  if (normalized.includes('jaune') || normalized.includes('gold') || normalized.includes('dor')) return '#b89039';
  return '#b89039';
}

function KitchenPage() {
  const [activeScreen, setActiveScreen] = useState(getActiveScreen);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const requestIdRef = useRef(0);
  const hasLoadedRef = useRef(false);

  const activeScreenMeta = useMemo(
    () => SCREEN_OPTIONS.find((option) => option.key === activeScreen) || SCREEN_OPTIONS[0],
    [activeScreen],
  );

  const operationalSummary = useMemo(() => {
    if (activeScreen === 'manager') {
      return [
        { label: 'Plateaux complets', value: tickets.filter((ticket) => ticket.completeReady).length },
        { label: 'En attente postes', value: tickets.filter((ticket) => !ticket.completeReady).length },
        { label: 'Commandes visibles', value: tickets.length },
      ];
    }

    return [
      { label: 'En attente', value: countStationStatus(tickets, 'WAITING') },
      { label: 'En cours', value: countStationStatus(tickets, 'IN_PROGRESS') },
      { label: 'Prets', value: countStationStatus(tickets, 'DONE') },
    ];
  }, [activeScreen, tickets]);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('station', activeScreen);
    window.history.replaceState({}, '', `${url.pathname}${url.search}`);
  }, [activeScreen]);

  useEffect(() => {
    let cancelled = false;
    let refreshInProgress = false;
    let realtimeRefreshId = null;
    hasLoadedRef.current = false;

    const loadKitchenData = async () => {
      if (refreshInProgress) return;
      refreshInProgress = true;
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      if (!hasLoadedRef.current) {
        setLoading(true);
      }
      setError('');

      try {
        const data =
          activeScreen === 'manager'
            ? await fetchApiKitchenManager()
            : await fetchApiKitchenStation(activeScreen);

        if (!cancelled && requestId === requestIdRef.current) {
          setTickets(Array.isArray(data) ? data : []);
          setError('');
        }
      } catch (fetchError) {
        if (!cancelled && requestId === requestIdRef.current) {
          setError(fetchError.message || 'Impossible de charger les ecrans cuisine.');
        }
      } finally {
        if (!cancelled && requestId === requestIdRef.current) {
          hasLoadedRef.current = true;
          setLoading(false);
        }
        refreshInProgress = false;
      }
    };

    const scheduleKitchenRefresh = () => {
      if (realtimeRefreshId) {
        window.clearTimeout(realtimeRefreshId);
      }

      realtimeRefreshId = window.setTimeout(loadKitchenData, 250);
    };

    loadKitchenData();

    const stopRealtime = subscribeRealtime({
      onOrder: () => {
        scheduleKitchenRefresh();
      },
      onError: () => {
        // polling fallback keeps the board alive
      },
    });

    const intervalId = window.setInterval(loadKitchenData, 30000);

    return () => {
      cancelled = true;
      if (realtimeRefreshId) {
        window.clearTimeout(realtimeRefreshId);
      }
      stopRealtime();
      window.clearInterval(intervalId);
    };
  }, [activeScreen]);

  const handleStationAction = async (ticket) => {
    const actionKey = `${activeScreen}-${ticket.orderId}`;
    setBusyKey(actionKey);
    setError('');

    try {
      if (ticket.status === 'WAITING') {
        await startApiKitchenStationOrder(activeScreen, ticket.orderId);
      } else if (ticket.status === 'IN_PROGRESS') {
        await readyApiKitchenStationOrder(activeScreen, ticket.orderId);
      }

      const refreshed = await fetchApiKitchenStation(activeScreen);
      setTickets(Array.isArray(refreshed) ? refreshed : []);
    } catch (actionError) {
      setError(actionError.message || "Impossible d'actualiser ce poste.");
    } finally {
      setBusyKey('');
    }
  };

  const handleManagerComplete = async (ticket) => {
    const actionKey = `manager-${ticket.orderId}`;
    setBusyKey(actionKey);
    setError('');

    try {
      await completeApiKitchenOrder(ticket.orderId);
      const refreshed = await fetchApiKitchenManager();
      setTickets(Array.isArray(refreshed) ? refreshed : []);
    } catch (actionError) {
      setError(actionError.message || 'Impossible de valider ce plateau.');
    } finally {
      setBusyKey('');
    }
  };

  return (
    <main className="kitchen-page">
      <section className="kitchen-shell">
        <header className="kitchen-header">
          <div className="kitchen-header-copy">
            <p className="eyebrow">Cuisine POS2</p>
            <h1>{activeScreenMeta.label}</h1>
            <p>
              {activeScreen === 'manager'
                ? 'Validation finale des commandes avant transfert vers le comptoir.'
                : 'Lecture rapide, gros boutons, une action claire par carte.'}
            </p>
          </div>

        </header>

        <section className="kitchen-summary">
          <div className="kitchen-summary-card kitchen-summary-card-accent">
            <span>Poste actif</span>
            <strong>{activeScreenMeta.shortLabel}</strong>
          </div>
          {operationalSummary.map((item) => (
            <div className="kitchen-summary-card" key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </section>

        {error ? <div className="kitchen-feedback">{error}</div> : null}

        {loading ? (
          <section className="kitchen-empty-state">
            <h2>Chargement des commandes cuisine...</h2>
            <p>Nous synchronisons les tickets et les slots en temps reel.</p>
          </section>
        ) : null}

        {!loading && tickets.length === 0 ? (
          <section className="kitchen-empty-state">
            <h2>Aucune commande pour ce poste</h2>
            <p>
              {activeScreen === 'manager'
                ? 'Le responsable cuisine verra ici les plateaux en cours de montage.'
                : 'Les nouvelles commandes valides apparaitront ici des qu un slot cuisine leur est attribue.'}
            </p>
          </section>
        ) : null}

        {!loading && tickets.length > 0 ? (
          <section className="kitchen-board-shell">
            <header className="kitchen-board-heading">
              <div>
                <span>{activeScreen === 'manager' ? 'Vue globale plateaux' : 'File operationnelle du poste'}</span>
                <strong>
                  {activeScreen === 'manager'
                    ? 'Validation finale avant transfert comptoir'
                    : `${activeScreenMeta.label} a traiter`}
                </strong>
              </div>
              <p>
                {activeScreen === 'manager'
                  ? 'Une commande part au comptoir seulement si tous les postes sont prets.'
                  : 'Chaque carte montre la table, le slot, les articles du poste et le temps ecoule.'}
              </p>
            </header>

            <section className={activeScreen === 'manager' ? 'kitchen-manager-grid' : 'kitchen-board-grid'}>
              {activeScreen === 'manager'
                ? tickets.map((ticket) => {
                    const tone = getElapsedTone(ticket.elapsedMinutes);
                    const actionKey = `manager-${ticket.orderId}`;
                    const slotThemeClass = getSlotTheme(ticket.slotColor);
                    const slotAccent = getSlotAccent(ticket.slotColor);

                    return (
                      <article key={ticket.orderId} className={`kitchen-manager-card ${slotThemeClass}`}>
                        <div className={`kitchen-card-top kitchen-card-top-band ${slotThemeClass}`} style={{ background: slotAccent }}>
                          <div>
                            <span className="kitchen-card-label">Table</span>
                            <strong>Table {ticket.tableNumber}</strong>
                            <p>{ticket.orderNumber}</p>
                          </div>
                          <div className="kitchen-slot-pill">
                            <span>{ticket.slotLabel}</span>
                            <strong>{ticket.slotLabel.replace(/^Slot\\s+/i, '')}</strong>
                          </div>
                        </div>

                        <div className="kitchen-card-body">
                          <div className="kitchen-progress-grid">
                            {[ticket.plats, ticket.boissons, ticket.desserts].map((progress) => (
                              <div
                                key={progress.stationKey}
                                className={`kitchen-progress-card progress-${String(progress.status || 'waiting').toLowerCase()}`}
                              >
                                <span>{progress.stationLabel}</span>
                                <strong>{getManagerStatusLabel(progress)}</strong>
                              </div>
                            ))}
                          </div>

                          {ticket.customerComment ? (
                            <div className="kitchen-comment-box">
                              <span>Commentaire client</span>
                              <strong>{ticket.customerComment}</strong>
                            </div>
                          ) : null}

                          <div className="kitchen-card-bottom">
                            <span className={`kitchen-timer-pill tone-${tone}`}>
                              {formatElapsed(ticket.elapsedMinutes)}
                            </span>
                            <button
                              type="button"
                              disabled={!ticket.completeReady || busyKey === actionKey}
                              onClick={() => handleManagerComplete(ticket)}
                            >
                              {busyKey === actionKey
                                ? 'Validation...'
                                : ticket.completeReady
                                  ? 'Valider plateau complet'
                                  : 'En attente des postes'}
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })
                : tickets.map((ticket) => {
                    const tone = getElapsedTone(ticket.elapsedMinutes);
                    const actionKey = `${activeScreen}-${ticket.orderId}`;
                    const slotThemeClass = getSlotTheme(ticket.slotColor);
                    const slotAccent = getSlotAccent(ticket.slotColor);

                    return (
                      <article key={ticket.orderId} className={`kitchen-ticket-card ${slotThemeClass}`}>
                        <div className={`kitchen-card-top kitchen-card-top-band ${slotThemeClass}`} style={{ background: slotAccent }}>
                          <div>
                            <span className="kitchen-card-label">Table</span>
                            <strong>Table {ticket.tableNumber}</strong>
                            <p>{ticket.orderNumber}</p>
                          </div>
                          <div className={`kitchen-status-pill status-${String(ticket.status).toLowerCase()}`}>
                            {getStationStatusLabel(ticket.status)}
                          </div>
                        </div>

                        <div className="kitchen-card-body">
                          <div className="kitchen-ticket-meta">
                            <div>
                              <span>Slot cuisine</span>
                              <strong>{ticket.slotLabel}</strong>
                            </div>
                            <div>
                              <span>Couleur</span>
                              <strong>{ticket.slotLabel.replace(/^Slot\\s+/i, '')}</strong>
                            </div>
                            <div>
                              <span>Temps ecoule</span>
                              <strong className={`kitchen-timer-text tone-${tone}`}>
                                {formatElapsed(ticket.elapsedMinutes)}
                              </strong>
                            </div>
                          </div>

                          <div className="kitchen-items-list">
                            {ticket.items.map((item) => (
                              <div key={item.id} className="kitchen-item-row">
                                <div className="kitchen-item-main">
                                  <span className="kitchen-item-qty">{item.quantity}x</span>
                                  <strong>{item.itemName}</strong>
                                </div>
                                {item.rewardItem ? <span>Offert</span> : null}
                              </div>
                            ))}
                          </div>

                          {ticket.customerComment ? (
                            <div className="kitchen-comment-box">
                              <span>Commentaire client</span>
                              <strong>{ticket.customerComment}</strong>
                            </div>
                          ) : null}

                          <button
                            type="button"
                            className="kitchen-primary-action"
                            disabled={ticket.status === 'DONE' || busyKey === actionKey}
                            onClick={() => handleStationAction(ticket)}
                          >
                            {busyKey === actionKey ? 'Mise a jour...' : getStationActionLabel(ticket.status)}
                          </button>
                        </div>
                      </article>
                    );
                  })}
            </section>
          </section>
        ) : null}
      </section>
    </main>
  );
}

export default KitchenPage;
