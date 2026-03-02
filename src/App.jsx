

import { useState, useCallback, useRef, useEffect } from 'react';
import TagScene from './components/TagScene';
import PetCard from './components/PetCard';
import { buildTagMesh } from './utils/geometry';
import { generateQRMatrix } from './utils/qr';
import { exportSTL, export3MF } from './utils/exporter';
import './App.css';


function readCardHash() {
  const hash = window.location.hash;
  if (!hash.startsWith('#card?')) return null;
  const qs = new URLSearchParams(hash.slice(6));
  return {
    name: qs.get('n') || '',
    phone: qs.get('p') || '',
    phone2: qs.get('p2') || '',
    description: qs.get('d') || ''
  };
}

function buildCardUrl(name, phone, phone2, description) {
  const base = window.location.origin + window.location.pathname;
  const params = new URLSearchParams();
  if (name) params.set('n', name.trim());
  if (phone) params.set('p', phone.trim());
  if (phone2) params.set('p2', phone2.trim());
  if (description) params.set('d', description.trim());

  return `${base}#card?${params}`;
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


const COLOR_OPTIONS = [
  { key: 'white', label: 'Bianco', hex: '#FFFFFF', fill: '#1A1A1A' },
  { key: 'gold', label: 'Oro', hex: '#D4AF37', fill: '#1A1A1A' },
];

function TagEditor() {
  const [name, setName] = useState('LUNA');
  const [phone, setPhone] = useState('3331234567');
  const [phone2, setPhone2] = useState('');
  const [description, setDescription] = useState('');
  const [autoRot, setAutoRot] = useState(true);
  const [colorKey, setColorKey] = useState('white');
  const [mesh, setMesh] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cardUrl, setCardUrl] = useState('');

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
      const qrMatrix = generateQRMatrix(url, 0, 'L');
      const newMesh = buildTagMesh(qrMatrix, name, phone, phone2, colorKey);

      meshRef.current = newMesh;
      setMesh(newMesh);
      setCardUrl(url);
    } catch (err) {
      console.error(err);
      setError('Errore nella generazione. Riprova.');
    } finally {
      setLoading(false);
    }
  }, [name, phone, phone2, description, colorKey]);

  const handleExportSTL = useCallback(() => {
    if (!meshRef.current) return;
    exportSTL(meshRef.current, `medaglietta_${name.toLowerCase().replace(/\s+/g, '_')}`);
  }, [name]);

  const handleExport3MF = useCallback(() => {
    if (!meshRef.current) return;
    const opt = COLOR_OPTIONS.find(c => c.key === colorKey) ?? COLOR_OPTIONS[0];
    const fname = `medaglietta_${name.toLowerCase().replace(/\s+/g, '_')}`;
    export3MF(meshRef.current, opt.hex, opt.fill, fname);
  }, [name, colorKey]);

  const handlePreviewCard = useCallback(() => {
    const url = buildCardUrl(name, phone, phone2, description);
    window.open(url, '_blank');
  }, [name, phone, phone2, description]);

  const hasMesh = mesh && !loading;

  return (
    <div className="app-container">
      {/* ---------------------------------------------------------------- */}
      {/* Sidebar                                                           */}
      {/* ---------------------------------------------------------------- */}
      <aside className="sidebar">
        <h1 className="app-title">Medaglietta 3D</h1>
        <p className="app-subtitle">
          Il QR aprirà una pagina con nome e numero — nessun sito esterno richiesto.
        </p>

        <div className="form-group">
          <label htmlFor="animal-name">Nome animale</label>
          <input
            id="animal-name"
            type="text"
            value={name}
            maxLength={14}
            placeholder="es. LUNA"
            onChange={e => setName(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label htmlFor="phone">Primo numero di telefono</label>
          <input
            id="phone"
            type="tel"
            value={phone}
            maxLength={16}
            placeholder="es. 3331234567"
            onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
          />
        </div>

        <div className="form-group">
          <label htmlFor="phone2">Secondo numero (opzionale)</label>
          <input
            id="phone2"
            type="tel"
            value={phone2}
            maxLength={16}
            placeholder="es. 3337654321"
            onChange={e => setPhone2(e.target.value.replace(/\D/g, ''))}
          />
        </div>

        <div className="form-group">
          <label htmlFor="description">Descrizione / Note mediche</label>
          <textarea
            id="description"
            value={description}
            maxLength={150}
            rows={3}
            placeholder="es. Ha bisogno di farmaci per il cuore..."
            onChange={e => setDescription(e.target.value)}
          />
          <p className="hint" style={{ textAlign: 'right', fontSize: '0.7rem' }}>
            {description.length}/150
          </p>
        </div>

        {/* Colore medaglietta */}
        <div className="form-group">
          <label>Colore medaglietta</label>
          <div className="color-toggle">
            {COLOR_OPTIONS.map(opt => (
              <button
                key={opt.key}
                type="button"
                className={`color-btn ${colorKey === opt.key ? 'active' : ''}`}
                onClick={() => setColorKey(opt.key)}
                style={{ '--swatch': opt.hex }}
              >
                <span className="color-swatch" />
                {opt.label}
              </button>
            ))}
          </div>
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

        <div className="qr-info-box">
          <span className="qr-info-icon">ℹ️</span>
          <p>
            Il QR punterà a <strong>{name || '…'}</strong> /{' '}
            <strong>{phone || '…'}</strong>
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={handleGenerate}
          disabled={loading}
        >
          {loading ? 'Generazione in corso…' : 'Genera anteprima'}
        </button>

        {hasMesh && (
          <button className="btn btn-secondary" onClick={handlePreviewCard}>
            Anteprima pagina QR
          </button>
        )}

        {hasMesh && (
          <div className="export-group">
            <button className="btn btn-export" onClick={handleExportSTL}>
              Scarica STL
            </button>
            <button className="btn btn-export btn-3mf" onClick={handleExport3MF}>
              Scarica 3MF bicolore
            </button>
          </div>
        )}

        {error && <p className="error-msg">{error}</p>}
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
  );
}
