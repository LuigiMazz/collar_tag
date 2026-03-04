/**
 * geometry.js  —  NO CSG, geometria diretta con ExtrudeGeometry
 *
 * Sistema di coordinate (mm):
 *   Disco orientato con facce piatte su XY, spessore lungo Z.
 *   Fronte (QR):   z = +thickness/2  = +1.75
 *   Retro (testo): z = -thickness/2  = -1.75
 *   Alto (foro):   y = +holeY
 *
 * Struttura solida a 3 strati (perfetta per 3MF bicolore):
 *
 *   ┌─ LAYER FRONT (engraveDepth) ─────────────────────┐
 *   │  border = disco − celle QR  (Colore 1)            │
 *   │  qrFill = sole celle QR     (Colore 2)            │
 *   ├─ BASE  (thickness − 2×engraveDepth) ─────────────┤
 *   │  disco pieno con foro        (Colore 1)           │
 *   ├─ LAYER BACK (engraveDepth) ──────────────────────┤
 *   │  border = disco              (Colore 1)           │
 *   │  textFill = testo in rilievo (Colore 2)           │
 *   └───────────────────────────────────────────────────┘
 *
 * Geometria piatta, watertight, stampabile.
 */

import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Costanti e Configurazione (mm)
// ---------------------------------------------------------------------------
export function getTagConfig(diameter = 30) {
  const radius = diameter / 2;
  const scale = diameter / 30;

  return {
    radius: radius,
    thickness: 3.6,
    holeRadius: 2,
    holeY: radius - 3, // Posiziona il foro a 3mm dal bordo superiore
    engraveDepth: 1.0,
    segments: 64,
    qrSize: 21 * scale + (scale > 1 ? (scale - 1) * 2 : 0), // Espande l'area QR più che proporzionalmente
    qrYOffset: -1.5 * scale,
    textW: 25 * scale,
    textH: 16 * scale,
    textYOffset: -2 * scale,
  };
}

export const MATERIALS = {
  white: { color: 0xffffff, metalness: 0.05, roughness: 0.65 },
  gold: { color: 0xd4af37, metalness: 0.85, roughness: 0.20 },
};

// ---------------------------------------------------------------------------
// Shape base del disco (cerchio con foro per l'anello)
// ---------------------------------------------------------------------------
function makeDiscShape(TAG) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, TAG.radius, 0, Math.PI * 2, false);
  const holePath = new THREE.Path();
  holePath.absarc(0, TAG.holeY, TAG.holeRadius, 0, Math.PI * 2, true);
  shape.holes.push(holePath);
  return shape;
}

const getExtrudeSettings = (TAG) => ({ bevelEnabled: false, curveSegments: TAG.segments });

// ---------------------------------------------------------------------------
// Strato base (pieno, senza incisioni)
// ---------------------------------------------------------------------------
function buildBase(discShape, TAG) {
  const h = TAG.thickness - TAG.engraveDepth * 2;
  const geo = new THREE.ExtrudeGeometry(discShape, { ...getExtrudeSettings(TAG), depth: h });
  // Centra su Z: da z=-(thickness/2)+engraveDepth a z=+(thickness/2)-engraveDepth
  geo.translate(0, 0, -(TAG.thickness / 2) + TAG.engraveDepth);
  return geo;
}

// ===========================================================================
// Geometrie per export STL — design IN RILIEVO (no overlap, mesh pulita)
//
// Struttura verticale (prima di geoToZ0):
//   z = -1.75 → -1.35  testo in rilievo (retro,  RAISE=0.4mm)
//   z = -1.35 → +1.35  corpo disco (2.7mm = thickness − engraveDepth)
//   z = +1.35 → +1.75  QR in rilievo  (fronte, RAISE=0.4mm)
//
// Dopo geoToZ0 (+1.75): z=0→0.4 testo | z=0.4→3.1 corpo | z=3.1→3.5 QR
// ===========================================================================


// Corpo export: spessore centrale senza i due strati di incisione
function buildBodyExport(discShape, TAG, raise) {
  const depth = TAG.thickness - raise * 2;
  const geo = new THREE.ExtrudeGeometry(discShape, { ...getExtrudeSettings(TAG), depth });
  geo.translate(0, 0, -depth / 2);
  geo.computeVertexNormals();
  return geo;
}

// Back cap export: sottile strato posteriore (depth=RAISE) con fori per il testo
// Stessa logica di buildFrontBorder per le celle QR, ma sul retro con pixel testo.
// Il corpo export (buildBodyExport) copre lo spessore centrale;
// questo strato copre il retro tranne dove c'è il testo → testo negativo.
function buildBackCapExport(name, phone, phone2, TAG, raise) {
  const shape = cloneShapeWithHole(makeDiscShape(TAG), TAG);

  const lines = [
    name.toUpperCase().slice(0, 16),
    phone.slice(0, 16),
    phone2 ? phone2.slice(0, 16) : null
  ].filter(Boolean);

  const { scaledCellMm, yCenters } = calcTextLayout(lines, TAG);

  for (let li = 0; li < lines.length; li++) {
    const text = lines[li];
    if (!text) continue;

    const cellMm = scaledCellMm[li];
    const half = cellMm * 0.6;
    const n = text.length;
    const lineCols = n * FONT_COLS + (n - 1) * FONT_COL_GAP;
    const yCenter = yCenters[li];

    for (let ci = 0; ci < n; ci++) {
      const bitmap = BITMAP_FONT[text[ci]] ?? BITMAP_FONT[' '];
      const charColStart = ci * (FONT_COLS + FONT_COL_GAP);

      for (let r = 0; r < FONT_ROWS; r++) {
        for (let c = 0; c < FONT_COLS; c++) {
          if (!((bitmap[r] >> (FONT_COLS - 1 - c)) & 1)) continue;

          const pixCol = charColStart + c;
          const cxRaw = (-lineCols / 2 + pixCol + 0.5) * cellMm;
          const cx = -cxRaw;
          const cy = yCenter + (3 - r) * cellMm;

          if (Math.sqrt(cx * cx + cy * cy) > TAG.radius - 0.5) continue;

          addRectHole(shape, cx, cy, half * 2, half * 2);
        }
      }
    }
  }

  // Strato sottile: profondità = RAISE, posizionato alla faccia posteriore
  const geo = new THREE.ExtrudeGeometry(shape, { ...getExtrudeSettings(TAG), depth: raise });
  geo.translate(0, 0, -(TAG.thickness / 2));
  return geo;
}

// QR in rilievo: celle che sporgono dalla faccia frontale (z=+(h/2) → z=+(thickness/2))
function buildQRFillExport(qrModules, TAG, raise) {
  const size = qrModules.length;
  const cellMm = TAG.qrSize / size;
  const startZ = (TAG.thickness - raise * 2) / 2;
  const geos = [];

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!qrModules[row][col]) continue;
      const cx = (col - size / 2 + 0.5) * cellMm;
      const cy = -(row - size / 2 + 0.5) * cellMm + TAG.qrYOffset;
      if (Math.sqrt(cx * cx + cy * cy) > TAG.radius - 0.5) continue;

      const s = new THREE.Shape();
      const h = (cellMm + 0.02) / 2;
      s.moveTo(-h, -h); s.lineTo(h, -h); s.lineTo(h, h); s.lineTo(-h, h);
      s.closePath();

      const geo = new THREE.ExtrudeGeometry(s, { bevelEnabled: false, depth: raise });
      geo.translate(cx, cy, startZ);
      geos.push(geo);
    }
  }
  return mergeGeos(geos);
}

// ===========================================================================
// Geometrie per export 3MF — corpo pieno + QR pilastro + testo in rilievo
//
// Struttura verticale (prima di geoToZ0):
//   z = -1.75 → +1.75  corpo pieno (Color 1, 3.5mm)
//   z = -1.75 → +2.15  celle QR    (Color 2, pilastro 3.9mm: corpo + 0.4mm sporgente)
//   z = -1.75 → -1.35  pixel testo (Color 2, 0.4mm sovrapposto al fondo corpo)
//
// Dopo geoToZ0 (+1.75): corpo 0→3.5 | QR 0→3.9 | testo 0→0.4
// Bambu assegna priorità Color 2 nei voxel sovrapposti:
//   → QR visibile sul fronte come colore diverso + rilievo 0.4mm
//   → Testo visibile sul retro come colore diverso (rilievo 0.4mm)
// ===========================================================================

function build3MFBody(TAG) {
  const h = TAG.thickness;                                            // 3.5mm
  const geo = new THREE.ExtrudeGeometry(makeDiscShape(TAG), { ...getExtrudeSettings(TAG), depth: h });
  geo.translate(0, 0, -(h / 2));                                      // z = -1.75 → +1.75
  return geo;
}

function build3MFQRFill(qrModules, TAG, raise) {
  const size = qrModules.length;
  const cellMm = TAG.qrSize / size;
  const depth = TAG.thickness + raise;                               // 3.9mm (corpo + rilievo)
  const startZ = -(TAG.thickness / 2);                                // -1.75 (dal fondo corpo)
  const geos = [];

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!qrModules[row][col]) continue;
      const cx = (col - size / 2 + 0.5) * cellMm;
      const cy = -(row - size / 2 + 0.5) * cellMm + TAG.qrYOffset;
      if (Math.sqrt(cx * cx + cy * cy) > TAG.radius - 0.5) continue;

      const s = new THREE.Shape();
      const h = (cellMm + 0.02) / 2;
      s.moveTo(-h, -h); s.lineTo(h, -h); s.lineTo(h, h); s.lineTo(-h, h);
      s.closePath();

      const geo = new THREE.ExtrudeGeometry(s, { bevelEnabled: false, depth });
      geo.translate(cx, cy, startZ);
      geos.push(geo);
    }
  }
  return mergeGeos(geos);
}


// ---------------------------------------------------------------------------
// Bitmap font 5×7 (A-Z, 0-9, spazio e punteggiatura comune)
// Ogni voce: array di 7 valori — bit4=colonna-0 (sinistra), bit0=colonna-4 (destra)
// ---------------------------------------------------------------------------
const FONT_ROWS = 7;
const FONT_COLS = 5;
const FONT_COL_GAP = 1;   // pixel di gap tra caratteri adiacenti
// FONT_ROW_GAP rimosso — gap gestito in mm da calcTextLayout (LINE_GAP_MM)

 
const BITMAP_FONT = {
  'A': [14, 17, 17, 31, 17, 17, 17], 'B': [30, 17, 17, 30, 17, 17, 30],
  'C': [14, 17, 16, 16, 16, 17, 14], 'D': [30, 17, 17, 17, 17, 17, 30],
  'E': [31, 16, 16, 30, 16, 16, 31], 'F': [31, 16, 16, 30, 16, 16, 16],
  'G': [14, 17, 16, 23, 17, 17, 14], 'H': [17, 17, 17, 31, 17, 17, 17],
  'I': [14, 4, 4, 4, 4, 4, 14], 'J': [7, 2, 2, 2, 2, 18, 12],
  'K': [17, 18, 20, 24, 20, 18, 17], 'L': [16, 16, 16, 16, 16, 16, 31],
  'M': [17, 27, 21, 17, 17, 17, 17], 'N': [17, 25, 21, 19, 17, 17, 17],
  'O': [14, 17, 17, 17, 17, 17, 14], 'P': [30, 17, 17, 30, 16, 16, 16],
  'Q': [14, 17, 17, 17, 21, 19, 15], 'R': [30, 17, 17, 30, 20, 18, 17],
  'S': [15, 16, 16, 14, 1, 1, 30], 'T': [31, 4, 4, 4, 4, 4, 4],
  'U': [17, 17, 17, 17, 17, 17, 14], 'V': [17, 17, 17, 17, 10, 10, 4],
  'W': [17, 17, 17, 21, 27, 17, 17], 'X': [17, 10, 10, 4, 10, 10, 17],
  'Y': [17, 17, 10, 4, 4, 4, 4], 'Z': [31, 1, 2, 4, 8, 16, 31],
  '0': [14, 17, 19, 21, 25, 17, 14], '1': [4, 12, 4, 4, 4, 4, 14],
  '2': [14, 17, 1, 2, 4, 8, 31], '3': [14, 17, 1, 6, 1, 17, 14],
  '4': [2, 6, 10, 18, 31, 2, 2], '5': [31, 16, 16, 30, 1, 17, 14],
  '6': [14, 16, 16, 30, 17, 17, 14], '7': [31, 1, 2, 4, 8, 8, 8],
  '8': [14, 17, 17, 14, 17, 17, 14], '9': [14, 17, 17, 15, 1, 17, 14],
  ' ': [0, 0, 0, 0, 0, 0, 0], '.': [0, 0, 0, 0, 0, 12, 12],
  '-': [0, 0, 0, 31, 0, 0, 0], '+': [0, 4, 4, 31, 4, 4, 0],
  '/': [1, 1, 2, 4, 8, 16, 16], ':': [0, 4, 4, 0, 4, 4, 0],
  '?': [14, 17, 1, 2, 4, 0, 4],
};

// ---------------------------------------------------------------------------
// calcTextLayout — calcola cellMm per-linea e yCenters per buildTextPixels
// e buildBackCapExport.
//
// Ogni riga viene dimensionata indipendentemente per riempire textW:
//   "LUNA" (4 char) → cellMm ≈ 1.04mm  vs  "3331234567" (10 char) → 0.41mm
// Così il nome è visibilmente più grande del numero di telefono.
// Un hScale comune scala tutto se l'altezza totale supera textH.
// ---------------------------------------------------------------------------
function calcTextLayout(lines, TAG) {
  const LINE_GAP_MM = 1.5; // gap fisso in mm tra righe successive
  const safeRadius = TAG.radius - 0.5;

  const computeCellMm = (line, width) => {
    const n = line.length;
    const pixCols = n * FONT_COLS + Math.max(0, n - 1) * FONT_COL_GAP;
    return pixCols > 0 ? width / pixCols : 1;
  };

  // Primo passaggio: stima le posizioni Y usando textW (larghezza rettangolare)
  const roughCellMm = lines.map(line => computeCellMm(line, TAG.textW));
  const roughTotalH = roughCellMm.reduce((s, c) => s + FONT_ROWS * c, 0)
    + (lines.length - 1) * LINE_GAP_MM;
  const roughHScale = Math.min(1, TAG.textH / roughTotalH);
  const roughScaled = roughCellMm.map(c => c * roughHScale);
  const roughGap = LINE_GAP_MM * roughHScale;
  const roughTopY = TAG.textYOffset + (roughTotalH * roughHScale) / 2;

  let curTop = roughTopY;
  const roughYCenters = roughScaled.map(c => {
    const center = curTop - (FONT_ROWS * c) / 2;
    curTop -= FONT_ROWS * c + roughGap;
    return center;
  });

  // Secondo passaggio: per ciascuna riga, vincola la larghezza alla corda del cerchio
  // alla Y più estrema della riga (non il centro, ma il bordo in alto/basso dei caratteri)
  // poiché i pixel del font si estendono ±3*cellMm dal centro della riga.
  const lineCellMm = lines.map((line, i) => {
    const yc = roughYCenters[i];
    const rc = roughScaled[i];
    // La riga più estrema (più lontana dal centro del disco) è a |yc| + 3*rc
    const yExtremeMag = Math.abs(yc) + 3 * rc;
    const circleWidth = 2 * Math.sqrt(Math.max(0, safeRadius * safeRadius - yExtremeMag * yExtremeMag));
    const effectiveWidth = Math.min(TAG.textW, circleWidth);
    return computeCellMm(line, effectiveWidth);
  });

  // Layout finale con le dimensioni vincolate al cerchio
  const totalH = lineCellMm.reduce((s, c) => s + FONT_ROWS * c, 0)
    + (lines.length - 1) * LINE_GAP_MM;
  const hScale = Math.min(1, TAG.textH / totalH);
  const scaledCellMm = lineCellMm.map(c => c * hScale);
  const scaledGap = LINE_GAP_MM * hScale;

  const totalHScaled = totalH * hScale;
  const topY = TAG.textYOffset + totalHScaled / 2;

  curTop = topY;
  const yCenters = scaledCellMm.map(c => {
    const center = curTop - (FONT_ROWS * c) / 2;
    curTop -= FONT_ROWS * c + scaledGap;
    return center;
  });

  return { scaledCellMm, yCenters };
}

// ---------------------------------------------------------------------------
// buildTextPixels — testo pixellato sul retro (bitmap 5×7)
// Usato da preview, STL export, 3MF export.
// Ogni lettera è un grid di cubetti, come le celle QR.
// X-mirroring incorporato nella posizione dei pixel (no post-process di winding).
// ---------------------------------------------------------------------------
function buildTextPixels(name, phone, phone2, TAG) {
  const z0 = -(TAG.thickness / 2);  // -1.75: faccia retro del disco
  const depth = TAG.engraveDepth;

  const lines = [
    name.toUpperCase().slice(0, 16),
    phone.slice(0, 16),
    phone2 ? phone2.slice(0, 16) : null
  ].filter(Boolean);

  const { scaledCellMm, yCenters } = calcTextLayout(lines, TAG);

  const geos = [];

  for (let li = 0; li < lines.length; li++) {
    const text = lines[li];
    if (!text) continue;

    const c = scaledCellMm[li];
    const half = c * 0.55; // leggero overlap per coprire underextrusion FDM
    const n = text.length;
    const lineCols = n * FONT_COLS + (n - 1) * FONT_COL_GAP;
    const yCenter = yCenters[li];

    for (let ci = 0; ci < n; ci++) {
      const bitmap = BITMAP_FONT[text[ci]] ?? BITMAP_FONT[' '];
      const charColStart = ci * (FONT_COLS + FONT_COL_GAP);

      for (let r = 0; r < FONT_ROWS; r++) {
        for (let col = 0; col < FONT_COLS; col++) {
          if (!((bitmap[r] >> (FONT_COLS - 1 - col)) & 1)) continue;

          const pixCol = charColStart + col;
          const cxRaw = (-lineCols / 2 + pixCol + 0.5) * c;
          const cx = -cxRaw; // specchiato → leggibile da retro
          const cy = yCenter + (3 - r) * c;

          if (Math.sqrt(cx * cx + cy * cy) > TAG.radius - 0.5) continue;

          const s = new THREE.Shape();
          s.moveTo(cx - half, cy - half);
          s.lineTo(cx + half, cy - half);
          s.lineTo(cx + half, cy + half);
          s.lineTo(cx - half, cy + half);
          s.closePath();

          const geo = new THREE.ExtrudeGeometry(s, { bevelEnabled: false, depth });
          geo.translate(0, 0, z0);
          geos.push(geo);
        }
      }
    }
  }

  return mergeGeos(geos);
}

// ---------------------------------------------------------------------------
// Border layer fronte: disco − celle QR  (Colore 1, parte del body)
// ---------------------------------------------------------------------------
function buildFrontBorder(discShape, qrModules, TAG) {
  const shape = cloneShapeWithHole(discShape, TAG);
  const size = qrModules.length;
  const cellMm = TAG.qrSize / size;

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!qrModules[row][col]) continue;
      const cx = (col - size / 2 + 0.5) * cellMm;
      const cy = -(row - size / 2 + 0.5) * cellMm + TAG.qrYOffset;
      // Solo le celle effettivamente dentro il disco (evita path invalidi)
      if (Math.sqrt(cx * cx + cy * cy) > TAG.radius - 0.5) continue;
      addRectHole(shape, cx, cy, cellMm - 0.04, cellMm - 0.04);
    }
  }

  const geo = new THREE.ExtrudeGeometry(shape, { ...getExtrudeSettings(TAG), depth: TAG.engraveDepth });
  geo.translate(0, 0, TAG.thickness / 2 - TAG.engraveDepth);
  return geo;
}

// ---------------------------------------------------------------------------
// QR fill: sole celle QR (Colore 2)
// ---------------------------------------------------------------------------
function buildQRFill(qrModules, TAG) {
  const size = qrModules.length;
  const cellMm = TAG.qrSize / size;
  const geos = [];

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!qrModules[row][col]) continue;
      const cx = (col - size / 2 + 0.5) * cellMm;
      const cy = -(row - size / 2 + 0.5) * cellMm + TAG.qrYOffset;
      if (Math.sqrt(cx * cx + cy * cy) > TAG.radius - 0.5) continue;

      const cellShape = new THREE.Shape();
      const h = (cellMm + 0.02) / 2, v = h; // Overlap per preview
      cellShape.moveTo(-h, -v); cellShape.lineTo(h, -v);
      cellShape.lineTo(h, v); cellShape.lineTo(-h, v);
      cellShape.closePath();

      const geo = new THREE.ExtrudeGeometry(cellShape, {
        bevelEnabled: false,
        depth: TAG.engraveDepth,
      });
      geo.translate(cx, cy, TAG.thickness / 2 - TAG.engraveDepth);
      geos.push(geo);
    }
  }

  return mergeGeos(geos);
}

// ---------------------------------------------------------------------------
// Border layer retro: disco pieno (Colore 1) — senza fori testo
// Il testo (Colore 2) viene renderizzato sopra con renderOrder=1
// ---------------------------------------------------------------------------
function buildBackBorder(discShape, TAG) {
  const geo = new THREE.ExtrudeGeometry(discShape, { ...getExtrudeSettings(TAG), depth: TAG.engraveDepth });
  geo.translate(0, 0, -TAG.thickness / 2);
  return geo;
}

// ---------------------------------------------------------------------------
// Text fill preview: testo pixellato sul retro (Colore 2)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clona una Shape con le sue holes (Deep clone) */
function cloneShapeWithHole(src, TAG) {
  const copy = new THREE.Shape(src.getPoints(TAG.segments));
  copy.holes = src.holes.map(h => new THREE.Path(h.getPoints(32)));
  return copy;
}

/** Aggiunge un rettangolo come hole a una Shape */
function addRectHole(shape, cx, cy, w, h) {
  const hw = w / 2, hh = h / 2;
  const path = new THREE.Path();
  path.moveTo(cx - hw, cy - hh);
  path.lineTo(cx + hw, cy - hh);
  path.lineTo(cx + hw, cy + hh);
  path.lineTo(cx - hw, cy + hh);
  path.closePath();
  shape.holes.push(path);
}

/** Merge array di BufferGeometry in una singola geometria non-indexed */
export function mergeGeos(geos) {
  if (geos.length === 0) return new THREE.BufferGeometry();

  const nonIndexed = geos.map(g => {
    const ni = g.index ? g.toNonIndexed() : g.clone();
    ni.computeVertexNormals();
    return ni;
  });

  let totalVerts = 0;
  for (const g of nonIndexed) {
    const count = g.attributes.position.count;
    totalVerts += Math.floor(count / 3) * 3;
  }

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  let vOff = 0;

  for (const g of nonIndexed) {
    const pos = g.attributes.position;
    const nrm = g.attributes.normal;
    const count = Math.floor(pos.count / 3) * 3;
    for (let i = 0; i < count; i++) {
      positions[(vOff + i) * 3] = pos.getX(i);
      positions[(vOff + i) * 3 + 1] = pos.getY(i);
      positions[(vOff + i) * 3 + 2] = pos.getZ(i);
      if (nrm) {
        normals[(vOff + i) * 3] = nrm.getX(i);
        normals[(vOff + i) * 3 + 1] = nrm.getY(i);
        normals[(vOff + i) * 3 + 2] = nrm.getZ(i);
      }
    }
    vOff += count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  return merged;
}

// ---------------------------------------------------------------------------
// Builder principale
// ---------------------------------------------------------------------------

/**
 * Costruisce la mesh della medaglietta (senza CSG).
 *
 * @param {number[][]} qrModules
 * @param {string}     name
 * @param {string}     phone
 * @param {string}     phone2
 * @param {'white'|'gold'} [colorKey='white']
 */
export function buildTagMesh(qrModules, name, phone, phone2, colorKey = 'white', diameter = 30) {
  const TAG = getTagConfig(diameter);
  const RAISE = TAG.engraveDepth; // Altezza rilievo per export STL, usiamo engraveDepth per coerenza

  const matOpts = MATERIALS[colorKey] ?? MATERIALS.white;
  const material = new THREE.MeshStandardMaterial(matOpts);

  const discShape = makeDiscShape(TAG);

  // --- Geometrie del corpo (Colore 1) ---
  const baseGeo = buildBase(discShape, TAG);
  const frontBorderGeo = buildFrontBorder(discShape, qrModules, TAG);
  const backBorderGeo = buildBackBorder(discShape, TAG);

  // --- Geometrie del riempimento (Colore 2) ---
  const qrFillGeo = buildQRFill(qrModules, TAG);
  const textFillGeo = buildTextPixels(name, phone, phone2, TAG);

  const allBodyGeos = [baseGeo, frontBorderGeo, backBorderGeo].map(g => {
    const ni = g.index ? g.toNonIndexed() : g.clone();
    ni.computeVertexNormals();
    return ni;
  });

  const bodyMerged = mergeGeos(allBodyGeos);

  // Preview: corpo + QR fill (fronte) + testo fill (retro) come mesh separate
  const group = new THREE.Group();

  const bodyMesh = new THREE.Mesh(bodyMerged, material);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  group.add(bodyMesh);

  const fillMatOpts = { color: 0x1a1a1a, metalness: 0.05, roughness: 0.85 };

  // QR fill — faccia FRONTE (z=+1.35→+1.75): renderOrder=1 per vincere z-test su frontBorder
  if (qrFillGeo.attributes.position?.count > 0) {
    const qrMesh = new THREE.Mesh(qrFillGeo, new THREE.MeshStandardMaterial(fillMatOpts));
    qrMesh.castShadow = true;
    qrMesh.receiveShadow = true;
    qrMesh.renderOrder = 1;
    group.add(qrMesh);
  }

  // Testo fill — faccia RETRO (z=-1.75→-1.35): renderOrder=0, polygonOffset per z-fighting
  // NON usa renderOrder=1 così resta occultato dalla faccia frontale del disco
  if (textFillGeo.attributes.position?.count > 0) {
    const textMat = new THREE.MeshStandardMaterial({
      ...fillMatOpts,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const textMesh = new THREE.Mesh(textFillGeo, textMat);
    textMesh.castShadow = true;
    textMesh.receiveShadow = true;
    group.add(textMesh);
  }

  // Geometrie per STL: corpo centrale + back cap con fori testo + QR sporgente
  const exportBody = buildBodyExport(discShape, TAG, RAISE);
  const exportBackCap = buildBackCapExport(name, phone, phone2, TAG, RAISE);
  const exportQR = buildQRFillExport(qrModules, TAG, RAISE);

  group._bodyGeoExport = exportBody;
  group._backCapExport = exportBackCap;
  group._qrFillGeoExport = exportQR.attributes.position?.count > 0 ? exportQR : null;

  // Geometrie per 3MF: corpo pieno 3.5mm + QR pilastro + testo in rilievo (overlap → bicolore)
  const body3mf = build3MFBody(TAG);
  const qr3mf = build3MFQRFill(qrModules, TAG, RAISE);
  const text3mf = buildTextPixels(name, phone, phone2, TAG);

  group._body3MF = body3mf;
  group._qrFill3MF = qr3mf.attributes.position?.count > 0 ? qr3mf : null;
  group._textFill3MF = text3mf.attributes.position?.count > 0 ? text3mf : null;

  return group;
}
