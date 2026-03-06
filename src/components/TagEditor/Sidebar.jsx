
import { useTranslation } from 'react-i18next';

const SUPPORTED_LANGS = [
    { code: 'it', flag: '🇮🇹' },
    { code: 'en', flag: '🇬🇧' },
    { code: 'es', flag: '🇪🇸' },
    { code: 'fr', flag: '🇫🇷' },
    { code: 'de', flag: '🇩🇪' },
];

export function Sidebar({ state, setters, actions }) {
    const { t, i18n } = useTranslation();
    const {
        name, phone, phone2, diameter, useNFC, minimalQR,
        qrInfo, loading, nfcStatus, nfcError, mesh
    } = state;
    const {
        setName, setPhone, setPhone2, setDiameter, setUseNFC, setMinimalQR
    } = setters;
    const {
        handleGenerate, handlePreviewCard, handleWriteNFC, handleExportSTL
    } = actions;

    const hasMesh = mesh && !loading;

    const printHint = qrInfo.moduleSize > 0.8
        ? t('hintGood')
        : qrInfo.moduleSize > 0.5
            ? t('hintMedium')
            : t('hintPoor');

    const printClass = qrInfo.moduleSize > 0.8 ? 'good' : qrInfo.moduleSize > 0.6 ? 'medium' : 'hard';

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <img src="/logo.png" alt="PawTag Logo" className="app-logo" />
                <h1 className="app-title">{t('appTitle')}</h1>
            </div>

            <div className="lang-switcher">
                {SUPPORTED_LANGS.map(({ code, flag }) => (
                    <button
                        key={code}
                        className={`lang-btn${i18n.resolvedLanguage === code ? ' active' : ''}`}
                        onClick={() => i18n.changeLanguage(code)}
                        title={code.toUpperCase()}
                    >
                        {flag}
                    </button>
                ))}
            </div>

            <p className="app-subtitle">{t('appSubtitle')}</p>

            <div className="form-group">
                <label htmlFor="animal-name">{t('labelPetName')}</label>
                <input
                    id="animal-name"
                    type="text"
                    value={name}
                    maxLength={14}
                    placeholder="LUNA"
                    onChange={e => setName(e.target.value)}
                />
            </div>

            <div className="form-group">
                <label htmlFor="phone">{t('labelPhone1')}</label>
                <input
                    id="phone"
                    type="tel"
                    value={phone}
                    maxLength={16}
                    placeholder="333 123 4567"
                    onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                />
            </div>

            <div className="form-group">
                <label htmlFor="phone2">{t('labelPhone2')}</label>
                <input
                    id="phone2"
                    type="tel"
                    value={phone2}
                    maxLength={16}
                    placeholder="333 765 4321"
                    onChange={e => setPhone2(e.target.value.replace(/\D/g, ''))}
                />
            </div>

            <div className="form-group">
                <label htmlFor="diameter">
                    {t('labelDiameter')} <strong>{diameter}mm</strong>
                </label>
                <input
                    id="diameter"
                    type="range"
                    min="30"
                    max="45"
                    step="1"
                    value={diameter}
                    onChange={e => setDiameter(parseInt(e.target.value))}
                />
            </div>

            <div className="nfc-toggle-group">
                <div className="nfc-toggle-row">
                    <span className="nfc-toggle-label">
                        <span className="nfc-icon">📡</span>
                        <span>
                            <strong>{t('nfcModeTitle')}</strong>
                            <small>{t('nfcModeDesc')}</small>
                        </span>
                    </span>
                    <label className="toggle-switch">
                        <input type="checkbox" checked={useNFC} onChange={e => setUseNFC(e.target.checked)} />
                        <span className="toggle-slider"></span>
                    </label>
                </div>
                {useNFC && (
                    <div className="nfc-info-chip">{t('nfcChipInfo')}</div>
                )}
            </div>

            <div className="form-group form-check form-row" title={t('titleSimplifiedQR')}>
                <input
                    id="minimal-qr"
                    type="checkbox"
                    checked={minimalQR}
                    onChange={e => setMinimalQR(e.target.checked)}
                />
                <label htmlFor="minimal-qr">{t('labelSimplifiedQR')}</label>
            </div>

            <div className={`printability-box ${printClass}`}>
                <div className="print-header">
                    <span className="print-icon">
                        {qrInfo.moduleSize > 0.8 ? '✅' : qrInfo.moduleSize > 0.6 ? '⚠️' : '❌'}
                    </span>
                    <strong>{t('printQualityTitle')}</strong>
                </div>
                <div className="print-details">
                    <span>{t('labelQRVersion')} {qrInfo.version || '-'}</span>
                    <span>{t('labelModuleSize')} {qrInfo.moduleSize ? qrInfo.moduleSize.toFixed(2) + 'mm' : '-'}</span>
                </div>
                <p className="print-hint">{printHint}</p>
            </div>

            <div className="spec-box">
                <h3>{t('specsTitle')}</h3>
                <ul>
                    <li>{t('specDiameter')} <strong>{diameter} mm</strong></li>
                    <li>{t('specThickness')} <strong>3.6 mm</strong></li>
                    <li>{t('specHole')} <strong>Ø 4 mm</strong></li>
                    <li>{t('specEngrave')} <strong>0.6 mm</strong></li>
                    {useNFC && <li>{t('specNFCCavity')} <strong>Ø25mm × 0.4mm (centro)</strong></li>}
                </ul>
            </div>

            <button
                className="btn btn-primary"
                onClick={handleGenerate}
                disabled={loading}
            >
                {loading ? t('btnGenerating') : t('btnGenerate')}
            </button>

            {hasMesh && (
                <button className="btn btn-secondary" onClick={handlePreviewCard}>
                    {t('btnPreviewCard')}
                </button>
            )}

            {hasMesh && useNFC && (
                <>
                    <button className="btn btn-nfc" onClick={handleWriteNFC} disabled={nfcStatus === 'writing'}>
                        {nfcStatus === 'writing' ? t('btnWritingNFC') : t('btnWriteNFC')}
                    </button>
                    <button
                        className="btn btn-secondary btn-write-later"
                        style={{ marginTop: '0.5rem', width: '100%' }}
                        onClick={() => setters.setShowWriteLater(true)}
                    >
                        {t('btnWriteLater')}
                    </button>
                </>
            )}
            {nfcStatus === 'success' && (
                <p className="nfc-success-msg">{t('msgNFCSuccess')}</p>
            )}
            {nfcStatus === 'error' && (
                <p className="nfc-error-msg">{t('msgNFCErrorPrefix')} {nfcError}</p>
            )}

            {hasMesh && (
                <div className="export-group">
                    <button className="btn btn-export" onClick={handleExportSTL}>
                        {t('btnDownloadSTL')}
                    </button>
                </div>
            )}

            {state.error && <p className="error-msg">{state.error}</p>}

            <div className="about-section">
                <h3>{t('aboutTitle')}</h3>
                <p dangerouslySetInnerHTML={{ __html: t('aboutDesc') }} />
                <div className="creator-info">
                    {t('madeBy')} <span>Luigi Mazzarella</span>
                </div>
            </div>
        </aside>
    );
}
