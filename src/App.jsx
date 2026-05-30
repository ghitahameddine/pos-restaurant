import { Suspense, lazy } from 'react';
import './App.css';

const AdminPage = lazy(() => import('./pages/admin/AdminPage'));
const MenuPage = lazy(() => import('./pages/client/MenuPage'));
const KitchenPage = lazy(() => import('./pages/kitchen/KitchenPage'));
const QrCodesPage = lazy(() => import('./pages/QrCodesPage'));
const ServerPage = lazy(() => import('./pages/server/ServerPage'));

function HomePage() {
  return (
    <main className="home-page">
      <section className="home-card">
        <p className="eyebrow">POS Restaurant</p>
        <h1>Frontend POS2</h1>
        <p>
          Premiere etape : parcours client apres scan du QR code, puis validation sur tablette
          serveur.
        </p>
        <div className="home-actions">
          <a className="primary-link" href="/menu?table=1">
            Ouvrir le menu table 1
          </a>
          <a className="secondary-link" href="/qr-codes">
            Voir les 10 QR codes
          </a>
          <a className="secondary-link" href="/server">
            Ouvrir tablette serveur
          </a>
          <a className="secondary-link" href="/kitchen?station=plats">
            Ouvrir ecran cuisine
          </a>
          <a className="secondary-link" href="/admin">
            Ouvrir administration
          </a>
        </div>
      </section>
    </main>
  );
}

function NotFoundPage() {
  return (
    <main className="home-page">
      <section className="home-card">
        <p className="eyebrow">Page introuvable</p>
        <h1>Route non disponible</h1>
        <p>Pour tester le QR code client, ouvre /menu?table=1.</p>
        <a className="primary-link" href="/menu?table=1">
          Aller au menu
        </a>
      </section>
    </main>
  );
}

function PageLoader() {
  return (
    <main className="home-page">
      <section className="home-card">
        <p className="eyebrow">POS2</p>
        <h1>Chargement...</h1>
        <p>Preparation de l'interface demandee.</p>
      </section>
    </main>
  );
}

function App() {
  const path = window.location.pathname;
  let page = null;

  if (path === '/') {
    page = <HomePage />;
  } else if (path === '/menu') {
    page = <MenuPage />;
  } else if (path === '/qr-codes') {
    page = <QrCodesPage />;
  } else if (path === '/server') {
    page = <ServerPage />;
  } else if (path === '/kitchen') {
    page = <KitchenPage />;
  } else if (path === '/admin') {
    page = <AdminPage />;
  } else {
    page = <NotFoundPage />;
  }

  return <Suspense fallback={<PageLoader />}>{page}</Suspense>;
}

export default App;
