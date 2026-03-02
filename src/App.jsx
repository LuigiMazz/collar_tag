
import { useState, useCallback, useRef, useEffect } from 'react';
import TagScene from './components/TagScene';
import PetCard from './components/PetCard';
import { buildTagMesh } from './utils/geometry';
import { generateQRMatrix } from './utils/qr';
import { exportSTL, export3MF } from './utils/exporter';
import LZString from 'lz-string';
import { compressWithDict, decompressWithDict } from './utils/dictionary';
import './App.css';


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

function buildCardUrl(name, phone, phone2, description) {
  const base = window.location.origin + window.location.pathname;

  const rawData = [
    (name || '').trim(),
    (phone || '').trim(),
    (phone2 || '').trim(),
    (description || '').trim()
  ];

  // 1. Extreme Optimized (Dictionary + AlphaNum)
  const dictDesc = compressWithDict(rawData[3]);
  const extremeData = [
    rawData[0].toUpperCase(),
    rawData[1].replace(/\D/g, ''),
    rawData[2].replace(/\D/g, ''),
    dictDesc
  ].join(':');
  const extremeUrl = `${base}#e:${extremeData}`;

  // 2. Universal Optimized (No Dictionary, Pure AlphaNum)
  const universalData = rawData.map(v => v.toUpperCase()).join(':');
  const universalUrl = `${base}#*${universalData}`;

  // 3. Simple Positional
  const pipeJoined = rawData.map(v => encodeURIComponent(v)).join('|');
  const pipeUrl = `${base}#q/${pipeJoined}`;

  // 4. LZ-String Compressed
  const compressed = LZString.compressToEncodedURIComponent(rawData.join('|'));
  const compressedUrl = `${base}#c/${compressed}`;

  // Selection: prioritize extremeUrl, then universalUrl if they are close in size
  // because they stay in the highly efficient Alphanumeric mode.
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
  const [name, setName] = useState('LUNA');
  const [phone, setPhone] = useState('3331234567');
  const [phone2, setPhone2] = useState('');
  const [description, setDescription] = useState('');
  const [autoRot, setAutoRot] = useState(true);
  const [mesh, setMesh] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cardUrl, setCardUrl] = useState('');
  const [showTutorial, setShowTutorial] = useState(false);

  const meshRef = useRef(null);

  // Genera la mesh CSG
  const handleGenerate = useCallback(async () => {
    if (!name.trim()) { setError('Inserisci il nome dell\'animale.'); return; }
    if (!phone.trim()) { setError('Inserisci il numero di telefono.'); return; }

    setLoading(true);
    setError(null);

    try {
      await new Promise(r => setTimeout(r, 50));

      const url = buildCardUrl(name, phone, phone2, description);
      // FASE 4: Level 'L' (7%) for minimum module count
      const qrMatrix = generateQRMatrix(url, 0, 'L');
      const newMesh = buildTagMesh(qrMatrix, name, phone, phone2, 'white');

      meshRef.current = newMesh;
      setMesh(newMesh);
      setCardUrl(url);
    } catch (err) {
      console.error(err);
      setError('Errore nella generazione. Riprova.');
    } finally {
      setLoading(false);
    }
  }, [name, phone, phone2, description]);

  const handleExportSTL = useCallback(() => {
    if (!meshRef.current) return;
    setShowTutorial(true);
  }, []);

  const triggerDownloadSTL = useCallback(() => {
    exportSTL(meshRef.current, `pawtag3d_${name.toLowerCase().replace(/\s+/g, '_')}`);
    setShowTutorial(false);
  }, [name]);

  const handleExport3MF = useCallback(() => {
    if (!meshRef.current) return;
    const fname = `pawtag3d_${name.toLowerCase().replace(/\s+/g, '_')}`;
    export3MF(meshRef.current, '#FFFFFF', '#1A1A1A', fname);
  }, [name]);

  const handlePreviewCard = useCallback(() => {
    const url = buildCardUrl(name, phone, phone2, description);
    window.open(url, '_blank');
  }, [name, phone, phone2, description]);

  const hasMesh = mesh && !loading;

  return (
    <>
      <div className="app-container">
        {/* ---------------------------------------------------------------- */}
        {/* Sidebar                                                           */}
        {/* ---------------------------------------------------------------- */}
        <aside className="sidebar">
          <div className="sidebar-header">
            <img src="/logo.png" alt="PawTag Logo" className="app-logo" />
            <h1 className="app-title">PawTag 3D</h1>
          </div>
          <p className="app-subtitle">
            Crea una medaglietta intelligente per il tuo compagno d'avventure. 🐾
          </p>

          <div className="form-group">
            <label htmlFor="animal-name">Nome animale</label>
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
            <label htmlFor="phone">📞 Primo numero</label>
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
            <label htmlFor="phone2">📞 Secondo numero (opzionale)</label>
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
            <label htmlFor="description">📝 Note mediche o caratteriali</label>
            <textarea
              id="description"
              value={description}
              maxLength={150}
              rows={3}
              placeholder="Esempio: Ha bisogno di farmaci..."
              onChange={e => setDescription(e.target.value)}
            />
            <p className="hint" style={{ textAlign: 'right' }}>
              {description.length}/150
            </p>
          </div>


          <div className="form-group form-check">
            <input
              id="auto-rotate"
              type="checkbox"
              checked={autoRot}
              onChange={e => setAutoRot(e.target.checked)}
            />
            <label htmlFor="auto-rotate">Rotazione automatica</label>
          </div>

          <div className="spec-box">
            <h3>Specifiche</h3>
            <ul>
              <li>Diametro: <strong>30 mm</strong></li>
              <li>Spessore: <strong>3.6 mm</strong></li>
              <li>Foro: <strong>Ø 4 mm</strong></li>
              <li>Incisione: <strong>1.0 mm</strong></li>
            </ul>
          </div>

          <button
            className="btn btn-primary"
            onClick={handleGenerate}
            disabled={loading}
          >
            {loading ? 'Sto lavorando...' : '✨ Genera anteprima'}
          </button>

          {hasMesh && (
            <button className="btn btn-secondary" onClick={handlePreviewCard}>
              👁️ Anteprima pagina QR
            </button>
          )}

          {hasMesh && (
            <div className="export-group">
              <button className="btn btn-export" onClick={handleExportSTL}>
                📥 Scarica STL
              </button>
            </div>
          )}

          {error && <p className="error-msg">{error}</p>}

          <div className="about-section">
            <h3>Cos'è PawTag 3D?</h3>
            <p>
              Un progetto per la <strong>sicurezza</strong> dei nostri amici.
              I dati sono salvati nel QR: nessuna registrazione, massima privacy.
            </p>
            <div className="creator-info">
              Fatto con ❤️ da <span>Luigi Mazzarella</span>
            </div>
          </div>
        </aside>

        <main className="canvas-wrapper">
          {mesh ? (
            <TagScene mesh={mesh} autoRotate={autoRot} />
          ) : (
            <div className="canvas-placeholder">
              <p>
                {loading
                  ? 'Costruzione geometria CSG in corso…'
                  : 'Compila nome e telefono, poi clicca "Genera anteprima"'}
              </p>
            </div>
          )}
        </main>
      </div>

      {showTutorial && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Preparazione alla stampa 3D</h2>
            <p className="tutorial-text">
              Per ottenere un risultato bicolore perfetto con il file STL:
              <br /><br />
              Nello slicer (es. Bambu Studio o PrusaSlicer),
              usa lo strumento <strong>"Dipingi"</strong> (Paint Tool),
              seleziona il tipo di tool <strong>"Height Range"</strong> e imposta l'altezza a <strong> 1 mm</strong>,
              poi spostati alla base del qrcode o imposta l'altezza a <strong>2,61 mm</strong> e colora tutto il resto.
            </p>

            <div className="tutorial-info-box">
              <div className="info-header">
                <span className="info-icon">💡</span><p><strong>INFO:</strong></p>
              </div>
              <p>È consigliabile usare un <strong>ugello da 0.2mm</strong> per una massima leggibilità.</p>
              <p>Se si deisdera stampare con <strong>ungello da 0.4mm</strong>, si consiglia di aumentare il diametro della medaglia ad almeno <strong>40mm</strong></p>
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
                Il tuo browser non supporta il tag video.
              </video>
            </div>

            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setShowTutorial(false)}
              >
                Annulla
              </button>
              <button
                className="btn btn-primary"
                onClick={triggerDownloadSTL}
              >
                Scarica STL ora
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
