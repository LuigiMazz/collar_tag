
export default function PetCard({ name, phone, phone2, description }) {
  const displayName = name || 'Animale';
  const displayPhone = phone || 'N/D';

  return (
    <div className="petcard-overlay">
      <div className="petcard">
        <div className="petcard-paw">🐾</div>

        <h1 className="petcard-name">{displayName}</h1>

        {description && <p className="petcard-description">{description}</p>}

        <div className="petcard-contacts">
          <div className="contact-item">
            <p className="petcard-label">Contatto principale</p>
            <a className="petcard-phone" href={`tel:${displayPhone.replace(/\s/g, '')}`}>{displayPhone}</a>
            <a className="petcard-call-btn" href={`tel:${displayPhone.replace(/\s/g, '')}`}>Chiama</a>
          </div>

          {phone2 && (
            <div className="contact-item">
              <p className="petcard-label">Contatto secondario</p>
              <a className="petcard-phone" href={`tel:${phone2.replace(/\s/g, '')}`}>{phone2}</a>
              <a className="petcard-call-btn" href={`tel:${phone2.replace(/\s/g, '')}`}>Chiama</a>
            </div>
          )}
        </div>

        <p className="petcard-footer">
          Hai trovato questo animale? Scansiona il QR sulla medaglietta oppure chiama i numeri sopra.
        </p>
      </div>
    </div>
  );
}
