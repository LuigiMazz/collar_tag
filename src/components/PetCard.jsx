
import { useTranslation } from 'react-i18next';

export default function PetCard({ name, phone, phone2, description }) {
  const { t } = useTranslation();

  const displayName = name || t('defaultPetName');
  const displayPhone = phone || t('phoneNA');

  return (
    <div className="petcard-overlay">
      <div className="petcard">
        <div className="petcard-paw">🐾</div>

        <h1 className="petcard-name">{displayName}</h1>

        {description && (
          <div className="petcard-description">
            <p>{description}</p>
          </div>
        )}

        <div className="petcard-contacts">
          <div className="contact-item">
            <p className="petcard-label">{t('labelPrimaryContact')}</p>
            <a className="petcard-phone" href={`tel:${displayPhone.replace(/\s/g, '')}`}>{displayPhone}</a>
            <a className="petcard-call-btn" href={`tel:${displayPhone.replace(/\s/g, '')}`}>{t('btnCallNow')}</a>
          </div>

          {phone2 && (
            <div className="contact-item">
              <p className="petcard-label">{t('labelSecondaryContact')}</p>
              <a className="petcard-phone" href={`tel:${phone2.replace(/\s/g, '')}`}>{phone2}</a>
              <a className="petcard-call-btn" href={`tel:${phone2.replace(/\s/g, '')}`}>{t('btnCallNow')}</a>
            </div>
          )}
        </div>

        <p className="petcard-footer">
          <strong>{t('footerFoundAnimal')}</strong><br />
          {t('footerFoundAnimalDesc')}
        </p>
      </div>
    </div>
  );
}
