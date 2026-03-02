
export default function PetCard({ name, phone }) {
  const displayName  = name  || 'Animale';
  const displayPhone = phone || 'N/D';

  return (
    <div className="petcard-overlay">
      <div className="petcard">
        <div className="petcard-paw">🐾</div>

        <h1 className="petcard-name">{displayName}</h1>

        <p className="petcard-label">Numero del proprietario</p>

        <a
          className="petcard-phone"
          href={`tel:${displayPhone.replace(/\s/g, '')}`}
        >
          {displayPhone}
        </a>

        <a
          className="petcard-call-btn"
          href={`tel:${displayPhone.replace(/\s/g, '')}`}
        >
          Chiama il proprietario
        </a>

        <p className="petcard-footer">
          Hai trovato questo animale? Scansiona il QR sulla medaglietta oppure chiama il numero sopra.
        </p>
      </div>
    </div>
  );
}
