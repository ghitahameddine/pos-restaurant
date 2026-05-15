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

const STATION_COLUMNS = [
  { status: 'WAITING', label: 'En attente', hint: 'A demarrer' },
  { status: 'IN_PROGRESS', label: 'En cours', hint: 'Preparation active' },
  { status: 'DONE', label: 'Pretes', hint: 'Depose au slot' },
];

function normalizeScreenKey(value) {
  const requested = String(value || 'plats').trim().toLowerCase();
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
  if (!Number.isFinite(minutes) || minutes <= 0) return 'A l instant';
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours} h ${remainingMinutes} min` : `${hours} h`;
}

function getStationActionLabel(status) {
  if (status === 'WAITING') return 'Commencer';
  if (status === 'IN_PROGRESS') return 'Marquer pret';
  return 'Depose au slot';
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

function getUrgencyLabel(minutes) {
  if (!Number.isFinite(minutes) || minutes < 8) return 'Normal';
  if (minutes < 15) return 'Urgent';
  return 'Retard';
}

function getSlotAccent(slotColor) {
  const value = String(slotColor || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(value)) return value;

  const normalized = value.toLowerCase();
  if (normalized.includes('rouge')) return '#bb4639';
  if (normalized.includes('vert')) return '#207f5c';
  if (normalized.includes('bleu')) return '#23545b';
  if (normalized.includes('jaune') || normalized.includes('gold') || normalized.includes('dor')) return '#b89039';
  return '#b89039';
}

function countStationStatus(tickets, status) {
  return tickets.filter((ticket) => ticket.status === status).length;
}

function getProgressItems(ticket) {
  return [ticket.plats, ticket.boissons, ticket.desserts].filter(Boolean);
}

function stampTickets(tickets) {
  const receivedAt = Date.now();
  return Array.isArray(tickets) ? tickets.map((ticket) => ({ ...ticket, receivedAt })) : [];
}

function mergeStationWithManager(stationTickets, managerTickets) {
  const managerByOrderId = new Map(
    (Array.isArray(managerTickets) ? managerTickets : []).map((ticket) => [ticket.orderId, ticket]),
  );

  return (Array.isArray(stationTickets) ? stationTickets : []).map((ticket) => ({
    ...ticket,
    ...managerByOrderId.get(ticket.orderId),
    status: ticket.status,
    items: ticket.items,
    stationKey: ticket.stationKey,
    stationLabel: ticket.stationLabel,
  }));
}

function KitchenPage() {
  const [activeScreen, setActiveScreen] = useState(getActiveScreen);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [nowTick, setNowTick] = useState(() => Date.now());
  const requestIdRef = useRef(0);
  const hasLoadedRef = useRef(false);

  const activeScreenMeta = useMemo(
    () => SCREEN_OPTIONS.find((option) => option.key === activeScreen) || SCREEN_OPTIONS[0],
    [activeScreen],
  );

  const liveTickets = useMemo(
    () =>
      tickets.map((ticket) => ({
        ...ticket,
        liveElapsedMinutes:
          Number(ticket.elapsedMinutes || 0) +
          Math.max(0, Math.floor((nowTick - Number(ticket.receivedAt || nowTick)) / 60000)),
      })),
    [nowTick, tickets],
  );

  const operationalSummary = useMemo(() => {
    if (activeScreen === 'manager') {
      return [
        { label: 'Plateaux complets', value: liveTickets.filter((ticket) => ticket.completeReady).length },
        { label: 'En attente postes', value: liveTickets.filter((ticket) => !ticket.completeReady).length },
        { label: 'Commandes visibles', value: liveTickets.length },
      ];
    }

    return [
      { label: 'En attente', value: countStationStatus(liveTickets, 'WAITING') },
      { label: 'En cours', value: countStationStatus(liveTickets, 'IN_PROGRESS') },
      { label: 'Pretes', value: countStationStatus(liveTickets, 'DONE') },
    ];
  }, [activeScreen, liveTickets]);

  const stationColumns = useMemo(
    () =>
      STATION_COLUMNS.map((column) => ({
        ...column,
        tickets: liveTickets.filter((ticket) => ticket.status === column.status),
      })),
    [liveTickets],
  );

  const managerColumns = useMemo(
    () => [
      {
        id: 'building',
        label: 'En montage',
        hint: 'Postes pas encore tous prets',
        tickets: liveTickets.filter((ticket) => !ticket.completeReady),
      },
      {
        id: 'complete',
        label: 'Plateaux complets',
        hint: 'A controler puis envoyer au comptoir',
        tickets: liveTickets.filter((ticket) => ticket.completeReady),
      },
    ],
    [liveTickets],
  );

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('station', activeScreen);
    window.history.replaceState({}, '', `${url.pathname}${url.search}`);
  }, [activeScreen]);

  useEffect(() => {
    const tickId = window.setInterval(() => setNowTick(Date.now()), 60000);
    return () => window.clearInterval(tickId);
  }, []);

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
      if (!hasLoadedRef.current) setLoading(true);
      setError('');

      try {
        const data = activeScreen === 'manager'
          ? await fetchApiKitchenManager()
          : await Promise.all([fetchApiKitchenStation(activeScreen), fetchApiKitchenManager()]).then(
              ([stationTickets, managerTickets]) => mergeStationWithManager(stationTickets, managerTickets),
            );

        if (!cancelled && requestId === requestIdRef.current) {
          setTickets(stampTickets(data));
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
      if (realtimeRefreshId) window.clearTimeout(realtimeRefreshId);
      realtimeRefreshId = window.setTimeout(loadKitchenData, 250);
    };

    loadKitchenData();

    const stopRealtime = subscribeRealtime({
      onOrder: scheduleKitchenRefresh,
      onError: () => {},
    });

    const intervalId = window.setInterval(loadKitchenData, 30000);

    return () => {
      cancelled = true;
      if (realtimeRefreshId) window.clearTimeout(realtimeRefreshId);
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

      const [refreshed, managerTickets] = await Promise.all([
        fetchApiKitchenStation(activeScreen),
        fetchApiKitchenManager(),
      ]);
      setTickets(stampTickets(mergeStationWithManager(refreshed, managerTickets)));
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
      setTickets(stampTickets(await fetchApiKitchenManager()));
    } catch (actionError) {
      setError(actionError.message || 'Impossible de valider ce plateau.');
    } finally {
      setBusyKey('');
    }
  };

  return (
    <main className="kitchen-page kds-page">
      <section className="kitchen-shell">
        <header className="kitchen-header kds-header">
          <div className="kitchen-header-copy">
            <p className="eyebrow">Cuisine POS2</p>
            <h1>{activeScreenMeta.label}</h1>
            <p>
              {activeScreen === 'manager'
                ? 'Controle final des plateaux, slots visibles et transfert vers le comptoir.'
                : 'Kanban cuisine: slot dominant, timer lisible et action rapide par carte.'}
            </p>
          </div>
        </header>

        <section className="kitchen-summary kds-summary">
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
            <p>Synchronisation des tickets et des slots cuisine.</p>
          </section>
        ) : null}

        {!loading && liveTickets.length === 0 ? (
          <section className="kitchen-empty-state">
            <h2>Aucune commande pour ce poste</h2>
            <p>
              {activeScreen === 'manager'
                ? 'Le responsable verra ici les plateaux en cours de montage.'
                : 'Les commandes validees apparaissent ici avec leur slot cuisine.'}
            </p>
          </section>
        ) : null}

        {!loading && liveTickets.length > 0 ? (
          <section className="kitchen-board-shell kds-board-shell">
            <header className="kitchen-board-heading">
              <div>
                <span>{activeScreen === 'manager' ? 'Vue responsable' : 'Workflow KDS'}</span>
                <strong>
                  {activeScreen === 'manager'
                    ? 'Controle plateau complet'
                    : `${activeScreenMeta.label}: en attente, en cours, pretes`}
                </strong>
              </div>
              <p>Les cartes bougent par statut. Le slot couleur reste le repere principal du plateau.</p>
            </header>

            <section className="kds-kanban-board">
              {activeScreen === 'manager'
                ? managerColumns.map((column) => (
                    <KitchenColumn column={column} key={column.id}>
                      {column.tickets.map((ticket) => (
                        <KitchenManagerCard
                          busyKey={busyKey}
                          key={ticket.orderId}
                          onComplete={handleManagerComplete}
                          ticket={ticket}
                        />
                      ))}
                    </KitchenColumn>
                  ))
                : stationColumns.map((column) => (
                    <KitchenColumn column={column} key={column.status}>
                      {column.tickets.map((ticket) => (
                        <KitchenStationCard
                          activeScreen={activeScreen}
                          busyKey={busyKey}
                          key={ticket.orderId}
                          onAction={handleStationAction}
                          ticket={ticket}
                        />
                      ))}
                    </KitchenColumn>
                  ))}
            </section>
          </section>
        ) : null}
      </section>
    </main>
  );
}

function KitchenColumn({ children, column }) {
  return (
    <section className="kds-kanban-column">
      <header className="kds-column-header">
        <div>
          <strong>{column.label}</strong>
          <span>{column.hint}</span>
        </div>
        <b>{column.tickets.length}</b>
      </header>
      <div className="kds-column-stack">
        {column.tickets.length === 0 ? <p className="kds-empty-column">Aucune carte.</p> : children}
      </div>
    </section>
  );
}

function KitchenSlotHero({ ticket }) {
  const slotAccent = getSlotAccent(ticket.slotColor);
  const slotNumber = ticket.slotNumber || ticket.slotLabel?.match(/\d+/)?.[0] || '';
  const slotName = ticket.slotLabel || (slotNumber ? `Slot ${slotNumber}` : 'Slot cuisine');

  return (
    <div className="kds-slot-hero" style={{ background: slotAccent }}>
      <span>Slot cuisine</span>
      <strong>{slotNumber ? `#${slotNumber}` : slotName.replace(/^Slot\s+/i, '')}</strong>
      <small>{slotName}</small>
    </div>
  );
}

function KitchenTimer({ minutes }) {
  const tone = getElapsedTone(minutes);

  return (
    <div className={`kds-timer tone-${tone}`}>
      <span>{getUrgencyLabel(minutes)}</span>
      <strong>{formatElapsed(minutes)}</strong>
    </div>
  );
}

function KitchenProgressStrip({ ticket }) {
  const progressItems = getProgressItems(ticket);
  if (progressItems.length === 0) return null;

  return (
    <div className="kds-progress-strip">
      {progressItems.map((progress) => (
        <div
          className={`kds-progress-chip progress-${String(progress.status || 'waiting').toLowerCase()} ${
            progress.required ? '' : 'not-required'
          }`}
          key={progress.stationKey}
        >
          <span>{progress.stationLabel}</span>
          <strong>{getManagerStatusLabel(progress)}</strong>
        </div>
      ))}
    </div>
  );
}

function KitchenStationCard({ activeScreen, busyKey, onAction, ticket }) {
  const actionKey = `${activeScreen}-${ticket.orderId}`;
  const isDone = ticket.status === 'DONE';
  const isInProgress = ticket.status === 'IN_PROGRESS';

  return (
    <article className={`kds-ticket-card kds-status-${String(ticket.status).toLowerCase()}`}>
      <KitchenSlotHero ticket={ticket} />

      <div className="kds-ticket-main">
        <div className="kds-ticket-head">
          <div>
            <span>Table</span>
            <strong>{ticket.tableNumber}</strong>
          </div>
          <KitchenTimer minutes={ticket.liveElapsedMinutes} />
        </div>

        <div className="kds-order-line">
          <span>{ticket.orderNumber}</span>
          <b className={`kds-state-badge status-${String(ticket.status).toLowerCase()}`}>
            {isDone ? 'Depose au slot' : getStationStatusLabel(ticket.status)}
          </b>
        </div>

        <KitchenProgressStrip ticket={ticket} />

        <div className="kds-items-list">
          {ticket.items.map((item) => (
            <div className="kds-item-row" key={item.id}>
              <span>{item.quantity}x</span>
              <strong>{item.itemName}</strong>
              {item.rewardItem && <b>Offert</b>}
            </div>
          ))}
        </div>

        {ticket.customerComment ? (
          <div className="kds-comment">
            <span>Commentaire</span>
            <strong>{ticket.customerComment}</strong>
          </div>
        ) : null}

        <button
          className={`kds-primary-action ${isInProgress ? 'action-ready' : ''}`}
          disabled={isDone || busyKey === actionKey}
          onClick={() => onAction(ticket)}
          type="button"
        >
          {busyKey === actionKey ? 'Mise a jour...' : getStationActionLabel(ticket.status)}
        </button>
      </div>
    </article>
  );
}

function KitchenManagerCard({ busyKey, onComplete, ticket }) {
  const actionKey = `manager-${ticket.orderId}`;
  const complete = ticket.completeReady;

  return (
    <article className={`kds-ticket-card kds-manager-card ${complete ? 'kds-status-done' : 'kds-status-waiting'}`}>
      <KitchenSlotHero ticket={ticket} />

      <div className="kds-ticket-main">
        <div className="kds-ticket-head">
          <div>
            <span>Table</span>
            <strong>{ticket.tableNumber}</strong>
          </div>
          <KitchenTimer minutes={ticket.liveElapsedMinutes} />
        </div>

        <div className="kds-order-line">
          <span>{ticket.orderNumber}</span>
          <b className={`kds-state-badge ${complete ? 'status-done' : 'status-waiting'}`}>
            {complete ? 'Plateau complet' : 'En montage'}
          </b>
        </div>

        <KitchenProgressStrip ticket={ticket} />

        {ticket.customerComment ? (
          <div className="kds-comment">
            <span>Commentaire</span>
            <strong>{ticket.customerComment}</strong>
          </div>
        ) : null}

        <button
          className="kds-primary-action action-ready"
          disabled={!complete || busyKey === actionKey}
          onClick={() => onComplete(ticket)}
          type="button"
        >
          {busyKey === actionKey
            ? 'Validation...'
            : complete
              ? 'Valider plateau complet'
              : 'En attente des postes'}
        </button>
      </div>
    </article>
  );
}

export default KitchenPage;
