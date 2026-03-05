
import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import TagScene from './components/TagScene';
import PetCard from './components/PetCard';
import { buildTagMesh, getTagConfig } from './utils/geometry';
import { generateQRMatrix } from './utils/qr';
import { exportSTL } from './utils/exporter';
import LZString from 'lz-string';
import { compressWithDict, decompressWithDict } from './utils/dictionary';
import './App.css';

const SUPPORTED_LANGS = [
  { code: 'it', flag: '🇮🇹' },
  { code: 'en', flag: '🇬🇧' },
  { code: 'es', flag: '🇪🇸' },
  { code: 'fr', flag: '🇫🇷' },
  { code: 'de', flag: '🇩🇪' },
];

function readCardHash() {
  const hash = window.location.hash;
  if (!hash) return null;

  // EXTREME format: #e:NAME:P1:P2:DICT_DESC
  if (hash.startsWith('#e:')) {
    const data = hash.slice(3);
    const [n, p, p2, d] = data.split(':').map(v => decodeURIComponent(v));
    return {
      name: n || '',
      phone: p || '',
      phone2: p2 || '',
      description: decompressWithDict(d)
    };
  }

  // UNIVERSAL OPTIMIZED (No Dictionary): #*NAME:P1:P2:DESC
  if (hash.startsWith('#*')) {
    const data = hash.slice(2);
    const [n, p, p2, d] = data.split(':').map(v => decodeURIComponent(v));
    return {
      name: n || '',
      phone: p || '',
      phone2: p2 || '',
      description: d || ''
    };
  }

  // Most compact format: #q/NAME|P1|P2|DESC
  if (hash.startsWith('#q/')) {
    const data = hash.slice(3);
    const [n, p, p2, d] = data.split('|').map(v => decodeURIComponent(v));
    return { name: n || '', phone: p || '', phone2: p2 || '', description: d || '' };
  }

  // Compressed format: #c/XXXX (lz-string)
  if (hash.startsWith('#c/')) {
    try {
      const compressed = hash.slice(3);
      const decompressed = LZString.decompressFromEncodedURIComponent(compressed);
      if (decompressed) {
        const [n, p, p2, d] = decompressed.split('|');
        return { name: n || '', phone: p || '', phone2: p2 || '', description: d || '' };
      }
    } catch (e) {
      console.error("Failed to parse compressed hash", e);
    }
  }

  // Legacy format: #card?n=...
  if (hash.startsWith('#card?')) {
    const qs = new URLSearchParams(hash.slice(6));
    return {
      name: qs.get('n') || '',
      phone: qs.get('p') || '',
      phone2: qs.get('p2') || '',
      description: qs.get('d') || ''
    };
  }

  return null;
}

function buildCardUrl(name, phone, phone2, description, minimal = false) {
  const base = window.location.origin + window.location.pathname;

  const rawData = [
    (name || '').trim(),
    (phone || '').trim(),
    minimal ? '' : (phone2 || '').trim(),
    minimal ? '' : (description || '').trim()
  ];

  // 1. Extreme Optimized (Dictionary + AlphaNum)
  const dictDesc = compressWithDict(rawData[3]);
  const extremeData = [
    rawData[0].toUpperCase(),
    rawData[1].replace(/\D/g, ''),
    rawData[2].replace(/\D/g, ''),
    dictDesc
  ].join(':');

  const baseUpper = base.toUpperCase();
  const extremeUrl = `${baseUpper}#e:${extremeData}`;

  // 2. Universal Optimized (No Dictionary, Pure AlphaNum)
  const universalData = rawData.map(v => v.toUpperCase()).join(':');
  const universalUrl = `${baseUpper}#*${universalData}`;

  // 3. Simple Positional
  const pipeJoined = rawData.map(v => encodeURIComponent(v)).join('|');
  const pipeUrl = `${base}#q/${pipeJoined}`;

  // 4. LZ-String Compressed
  const compressed = LZString.compressToEncodedURIComponent(rawData.join('|'));
  const compressedUrl = `${base}#c/${compressed}`;

  const urls = [extremeUrl, universalUrl, pipeUrl, compressedUrl];
  return urls.reduce((a, b) => a.length <= b.length ? a : b);
}


export default function App() {
  const [cardParams, setCardParams] = useState(() => readCardHash());

  useEffect(() => {
    const onHash = () => setCardParams(readCardHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (cardParams) return (
    <PetCard
      name={cardParams.name}
      phone={cardParams.phone}
      phone2={cardParams.phone2}
      description={cardParams.description}
    />
  );
  return <TagEditor />;
}



function TagEditor() {
  const { t, i18n } = useTranslation();

  const [name, setName] = useState('LUNA');
  const [phone, setPhone] = useState('3331234567');
  const [phone2, setPhone2] = useState('');
  const [description] = useState('');
  const [diameter, setDiameter] = useState(30);
  const [minimalQR, setMinimalQR] = useState(false);
  const [useNFC, setUseNFC] = useState(false);
  const [autoRot] = useState(true);
  const [mesh, setMesh] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [qrInfo, setQrInfo] = useState({ version: 0, moduleSize: 0 });
  const [showTutorial, setShowTutorial] = useState(false);
  const [showNFCGuide, setShowNFCGuide] = useState(false);
  const [nfcStatus, setNfcStatus] = useState(null); // null | 'writing' | 'success' | 'error'
  const [nfcError, setNfcError] = useState('');

  const meshRef = useRef(null);
  const cardUrlRef = useRef('');

  const handleGenerate = useCallback(async () => {
    if (!name.trim()) { setError(t('errName')); return; }
    if (!phone.trim()) { setError(t('errPhone')); return; }

    setLoading(true);
    setError(null);

    try {
      await new Promise(r => setTimeout(r, 50));

      const url = buildCardUrl(name, phone, phone2, description, minimalQR);
      cardUrlRef.current = url;

      const qrMatrix = generateQRMatrix(url, 0, 'M');
      const count = qrMatrix.length;
      const version = (count - 17) / 4;

      const mSize = getTagConfig(diameter).qrSize / count;

      setQrInfo({ version, moduleCount: count, moduleSize: mSize });

      const newMesh = buildTagMesh(qrMatrix, name, phone, phone2, 'white', diameter, useNFC);

      meshRef.current = newMesh;
      setMesh(newMesh);
    } catch (err) {
      console.error(err);
      setError(t('errGeneral'));
    } finally {
      setLoading(false);
    }
  }, [name, phone, phone2, description, minimalQR, diameter, useNFC, t]);

  const handleExportSTL = useCallback(() => {
    if (!meshRef.current) return;
    setShowTutorial(true);
  }, []);

  const triggerDownloadSTL = useCallback(() => {
    exportSTL(meshRef.current, `pawtag3d_${name.toLowerCase().replace(/\s+/g, '_')}`);
    setShowTutorial(false);
  }, [name]);

  const handleWriteNFC = useCallback(async () => {
    const url = cardUrlRef.current;
    if (!url) return;

    if (!('NDEFReader' in window)) {
      setShowNFCGuide(true);
      return;
    }

    try {
      setNfcStatus('writing');
      setNfcError('');
      const ndef = new window.NDEFReader();
      await ndef.write({ records: [{ recordType: 'url', data: url }] });
      setNfcStatus('success');
    } catch (e) {
      setNfcStatus('error');
      setNfcError(e.message);
    }
  }, []);

  const handlePreviewCard = useCallback(() => {
    const url = buildCardUrl(name, phone, phone2, description);
    window.open(url, '_blank');
  }, [name, phone, phone2, description]);

  const hasMesh = mesh && !loading;

  const printHint = qrInfo.moduleSize > 0.8
    ? t('hintGood')
    : qrInfo.moduleSize > 0.5
      ? t('hintMedium')
      : t('hintPoor');

  const printClass = qrInfo.moduleSize > 0.8 ? 'good' : qrInfo.moduleSize > 0.6 ? 'medium' : 'hard';

  return (
    <>
      <div className="app-container">
        {/* ---------------------------------------------------------------- */}
        {/* Sidebar                                                           */}
        {/* ---------------------------------------------------------------- */}
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
            <button className="btn btn-nfc" onClick={handleWriteNFC} disabled={nfcStatus === 'writing'}>
              {nfcStatus === 'writing' ? t('btnWritingNFC') : t('btnWriteNFC')}
            </button>
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

          {error && <p className="error-msg">{error}</p>}

          <div className="about-section">
            <h3>{t('aboutTitle')}</h3>
            <p dangerouslySetInnerHTML={{ __html: t('aboutDesc') }} />
            <div className="creator-info">
              {t('madeBy')} <span>Luigi Mazzarella</span>
            </div>
          </div>
        </aside>

        <main className="canvas-wrapper">
          {mesh ? (
            <TagScene mesh={mesh} autoRotate={autoRot} />
          ) : (
            <div className="canvas-placeholder">
              {loading ? (
                <p>{t('msgLoadingGeometry')}</p>
              ) : (
                <div className="welcome-card">
                  <div className="welcome-icon">🐾</div>
                  <h2 className="welcome-title">{t('welcomeTitle')}</h2>
                  <p className="welcome-desc">
                    <span dangerouslySetInnerHTML={{ __html: t('welcomeDescLine1') }} /><br />
                    <span dangerouslySetInnerHTML={{ __html: t('welcomeDescLine2') }} /><br />
                    <span dangerouslySetInnerHTML={{ __html: t('welcomeDescLine3') }} />
                  </p>
                  <ol className="welcome-steps">
                    <li dangerouslySetInnerHTML={{ __html: t('welcomeStep1') }} />
                    <li dangerouslySetInnerHTML={{ __html: t('welcomeStep2') }} />
                    <li dangerouslySetInnerHTML={{ __html: t('welcomeStep3') }} />
                  </ol>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {showTutorial && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>{t('tutorialTitle')}</h2>
            <p className="tutorial-text" dangerouslySetInnerHTML={{ __html: t('tutorialText') }} />

            <div className="tutorial-info-box">
              <div className="info-header">
                <span className="info-icon">💡</span><p><strong>INFO:</strong></p>
              </div>
              <p dangerouslySetInnerHTML={{ __html: t('tutorialInfoNozzle') }} />
              <p dangerouslySetInnerHTML={{ __html: t('tutorialInfoNozzle04') }} />
            </div>

            <div className="tutorial-media-container">
              <video
                src="/tutorial.mov"
                autoPlay
                loop
                muted
                playsInline
                className="tutorial-video"
              >
                {t('videoFallback')}
              </video>
            </div>

            {useNFC && (
              <div className="nfc-tutorial-section">
                <h3>{t('nfcTutorialTitle')}</h3>
                <p className="nfc-tutorial-intro" dangerouslySetInnerHTML={{ __html: t('nfcTutorialIntro') }} />
                <a
                  className="nfc-amazon-link"
                  href="https://www.amazon.it/s?k=NFC+tag+25mm+coin"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('nfcAmazonLink')}
                </a>
                <ol className="nfc-steps">
                  <li dangerouslySetInnerHTML={{ __html: t('nfcStep1') }} />
                  <li dangerouslySetInnerHTML={{ __html: t('nfcStep2') }} />
                  <li dangerouslySetInnerHTML={{ __html: t('nfcStep3') }} />
                  <li dangerouslySetInnerHTML={{ __html: t('nfcStep4') }} />
                  <li dangerouslySetInnerHTML={{ __html: t('nfcStep5') }} />
                </ol>
              </div>
            )}

            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setShowTutorial(false)}
              >
                {t('btnCancel')}
              </button>
              <button
                className="btn btn-primary"
                onClick={triggerDownloadSTL}
              >
                {t('btnDownloadNow')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showNFCGuide && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>{t('nfcGuideTitle')}</h2>

            <div className="nfc-guide-platform">
              <h3>{t('androidGuideTitle')}</h3>
              <ol className="nfc-steps">
                <li dangerouslySetInnerHTML={{ __html: t('androidStep1') }} />
                <li dangerouslySetInnerHTML={{ __html: t('androidStep2') }} />
                <li dangerouslySetInnerHTML={{ __html: t('androidStep3') }} />
                <li>{t('androidStep4')}</li>
              </ol>
            </div>

            <div className="nfc-guide-platform">
              <h3>{t('iosGuideTitle')}</h3>
              <p dangerouslySetInnerHTML={{ __html: t('iosGuideIntro') }} />
              <ol className="nfc-steps">
                <li dangerouslySetInnerHTML={{ __html: t('iosStep1') }} />
                <li dangerouslySetInnerHTML={{ __html: t('iosStep2') }} />
                <li dangerouslySetInnerHTML={{ __html: t('iosStep3') }} />
                <li>
                  {t('iosStep4Label')}
                  <div className="nfc-url-box">{cardUrlRef.current}</div>
                </li>
                <li dangerouslySetInnerHTML={{ __html: t('iosStep5') }} />
              </ol>
            </div>

            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => setShowNFCGuide(false)}>
                {t('btnClose')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
