import './App.css';
import MenuPage from './pages/client/MenuPage';
import QrCodesPage from './pages/QrCodesPage';
import ServerPage from './pages/server/ServerPage';

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

function App() {
  const path = window.location.pathname;

  if (path === '/') {
    return <HomePage />;
  }

  if (path === '/menu') {
    return <MenuPage />;
  }

  if (path === '/qr-codes') {
    return <QrCodesPage />;
  }

  if (path === '/server') {
    return <ServerPage />;
  }

  return <NotFoundPage />;
}

export default App;
