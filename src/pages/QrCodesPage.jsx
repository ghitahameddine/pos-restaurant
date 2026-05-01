const tableNumbers = Array.from({ length: 10 }, (_, index) => index + 1);

function getMenuUrl(tableNumber) {
  return `${window.location.origin}/menu?table=${tableNumber}`;
}

function getQrImageUrl(tableNumber) {
  const menuUrl = getMenuUrl(tableNumber);
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=14&data=${encodeURIComponent(menuUrl)}`;
}

function QrCodesPage() {
  return (
    <main className="qr-page">
      <header className="qr-header">
        <div>
          <p className="eyebrow">QR Codes Restaurant</p>
          <h1>10 tables connectees</h1>
          <p>
            Chaque QR ouvre l'interface client. Le token temporaire est cree automatiquement au
            scan, puis expire apres 1h30 ou apres la demande d'addition.
          </p>
        </div>
        <a className="secondary-link" href="/server">
          Tablette serveur
        </a>
      </header>

      <section className="qr-grid" aria-label="Liste des QR codes par table">
        {tableNumbers.map((tableNumber) => {
          const menuUrl = getMenuUrl(tableNumber);

          return (
            <article className="qr-card" key={tableNumber}>
              <div className="qr-card-top">
                <span>Table</span>
                <strong>{tableNumber}</strong>
              </div>
              <a className="qr-image-link" href={menuUrl}>
                <img
                  alt={`QR code table ${tableNumber}`}
                  height="220"
                  src={getQrImageUrl(tableNumber)}
                  width="220"
                />
              </a>
              <p>{menuUrl}</p>
              <a className="primary-link" href={menuUrl}>
                Ouvrir la table {tableNumber}
              </a>
            </article>
          );
        })}
      </section>
    </main>
  );
}

export default QrCodesPage;
