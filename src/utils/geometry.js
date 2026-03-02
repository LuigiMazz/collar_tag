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
// Costanti (mm)
// ---------------------------------------------------------------------------
export const TAG = {
  radius: 15,     // raggio disco (Ø30mm)
  thickness: 3.6,    // spessore totale
  holeRadius: 2,      // raggio foro (Ø4mm)
  holeY: 12,     // posizione Y del foro (vicino al bordo superiore)
  engraveDepth: 1.0,    // profondità incisione
  segments: 64,     // segmenti per archi circolari
  qrSize: 20,     // dimensione area QR in mm
  qrYOffset: -1,     // offset verticale QR (schiva il foro)
  textW: 24,     // larghezza area testo
  textH: 12,     // altezza area testo
  textYOffset: -2,     // offset verticale testo
};

export const MATERIALS = {
  white: { color: 0xffffff, metalness: 0.05, roughness: 0.65 },
  gold: { color: 0xd4af37, metalness: 0.85, roughness: 0.20 },
};

// ---------------------------------------------------------------------------
// Shape base del disco (cerchio con foro per l'anello)
// ---------------------------------------------------------------------------
function makeDiscShape() {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, TAG.radius, 0, Math.PI * 2, false);
  const holePath = new THREE.Path();
  holePath.absarc(0, TAG.holeY, TAG.holeRadius, 0, Math.PI * 2, true);
  shape.holes.push(holePath);
  return shape;
}

const EXTRUDE = { bevelEnabled: false, curveSegments: TAG.segments };

// ---------------------------------------------------------------------------
// Strato base (pieno, senza incisioni)
// ---------------------------------------------------------------------------
function buildBase(discShape) {
  const h = TAG.thickness - TAG.engraveDepth * 2;
  const geo = new THREE.ExtrudeGeometry(discShape, { ...EXTRUDE, depth: h });
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

const RAISE = TAG.engraveDepth;  // 1.0mm altezza rilievo (inciso profondamente nel bicolore)

// Corpo export: spessore centrale senza i due strati di incisione
function buildBodyExport() {
  const h = TAG.thickness - RAISE * 2;
  const geo = new THREE.ExtrudeGeometry(makeDiscShape(), { ...EXTRUDE, depth: h });
  geo.translate(0, 0, -(h / 2));               // centrato: z=-(h/2) → z=+(h/2)
  return geo;
}

// Back cap export: sottile strato posteriore (depth=RAISE) con fori per il testo
// Stessa logica di buildFrontBorder per le celle QR, ma sul retro con pixel testo.
// Il corpo export (buildBodyExport) copre lo spessore centrale;
// questo strato copre il retro tranne dove c'è il testo → testo negativo.
function buildBackCapExport(name, phone) {
  const shape = cloneShapeWithHole(makeDiscShape());

  const lines = [name.toUpperCase().slice(0, 16), phone.slice(0, 16)];

  const maxLen = Math.max(...lines.map(l => l.length), 1);
  const totalPixCols = maxLen * FONT_COLS + (maxLen - 1) * FONT_COL_GAP;
  const totalPixRows = FONT_ROWS * 2 + FONT_ROW_GAP;
  const cellMm = Math.min(TAG.textW / totalPixCols, TAG.textH / totalPixRows);

  const yOffsetFromCenter = (FONT_ROWS + FONT_ROW_GAP) / 2 * cellMm;
  const yCenters = [
    TAG.textYOffset + yOffsetFromCenter,
    TAG.textYOffset - yOffsetFromCenter,
  ];

  const half = cellMm * 0.45;

  for (let li = 0; li < lines.length; li++) {
    const text = lines[li];
    if (!text) continue;

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
  const geo = new THREE.ExtrudeGeometry(shape, { ...EXTRUDE, depth: RAISE });
  geo.translate(0, 0, -(TAG.thickness / 2));
  return geo;
}

// QR in rilievo: celle che sporgono dalla faccia frontale (z=+(h/2) → z=+(thickness/2))
function buildQRFillExport(qrModules) {
  const size = qrModules.length;
  const cellMm = TAG.qrSize / size;
  const startZ = (TAG.thickness - RAISE * 2) / 2;
  const geos = [];

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!qrModules[row][col]) continue;
      const cx = (col - size / 2 + 0.5) * cellMm;
      const cy = -(row - size / 2 + 0.5) * cellMm + TAG.qrYOffset;
      if (Math.sqrt(cx * cx + cy * cy) > TAG.radius - 0.5) continue;

      const s = new THREE.Shape();
      const h = (cellMm - 0.04) / 2;
      s.moveTo(-h, -h); s.lineTo(h, -h); s.lineTo(h, h); s.lineTo(-h, h);
      s.closePath();

      const geo = new THREE.ExtrudeGeometry(s, { bevelEnabled: false, depth: RAISE });
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

function build3MFBody() {
  const h = TAG.thickness;                                            // 3.5mm
  const geo = new THREE.ExtrudeGeometry(makeDiscShape(), { ...EXTRUDE, depth: h });
  geo.translate(0, 0, -(h / 2));                                      // z = -1.75 → +1.75
  return geo;
}

function build3MFQRFill(qrModules) {
  const size = qrModules.length;
  const cellMm = TAG.qrSize / size;
  const depth = TAG.thickness + RAISE;                               // 3.9mm (corpo + rilievo)
  const startZ = -(TAG.thickness / 2);                                // -1.75 (dal fondo corpo)
  const geos = [];

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!qrModules[row][col]) continue;
      const cx = (col - size / 2 + 0.5) * cellMm;
      const cy = -(row - size / 2 + 0.5) * cellMm + TAG.qrYOffset;
      if (Math.sqrt(cx * cx + cy * cy) > TAG.radius - 0.5) continue;

      const s = new THREE.Shape();
      const h = (cellMm - 0.04) / 2;
      s.moveTo(-h, -h); s.lineTo(h, -h); s.lineTo(h, h); s.lineTo(-h, h);
      s.closePath();

      const geo = new THREE.ExtrudeGeometry(s, { bevelEnabled: false, depth });
      geo.translate(cx, cy, startZ);
      geos.push(geo);
    }
  }
  return mergeGeos(geos);
}

function build3MFTextFill(animalName, phone) {
  return buildTextPixels(animalName, phone);
}

// ---------------------------------------------------------------------------
// Bitmap font 5×7 (A-Z, 0-9, spazio e punteggiatura comune)
// Ogni voce: array di 7 valori — bit4=colonna-0 (sinistra), bit0=colonna-4 (destra)
// ---------------------------------------------------------------------------
const FONT_ROWS = 7;
const FONT_COLS = 5;
const FONT_COL_GAP = 1;   // pixel di gap tra caratteri adiacenti
const FONT_ROW_GAP = 4;   // riga vuota tra le due righe di testo

/* eslint-disable no-multi-spaces */
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
/* eslint-enable no-multi-spaces */

// ---------------------------------------------------------------------------
// buildTextPixels — testo pixellato sul retro (bitmap 5×7)
// Usato da preview, STL export, 3MF export.
// Ogni lettera è un grid di cubetti, come le celle QR.
// X-mirroring incorporato nella posizione dei pixel (no post-process di winding).
// ---------------------------------------------------------------------------
function buildTextPixels(name, phone) {
  const z0 = -(TAG.thickness / 2);  // -1.75: faccia retro del disco
  const depth = RAISE;                  // 0.4mm

  const lines = [name.toUpperCase().slice(0, 16), phone.slice(0, 16)];

  // Calcola cellMm per fittare entrambe le righe nell'area textW × textH
  const maxLen = Math.max(...lines.map(l => l.length), 1);
  const totalPixCols = maxLen * FONT_COLS + (maxLen - 1) * FONT_COL_GAP;
  const totalPixRows = FONT_ROWS * 2 + FONT_ROW_GAP;
  const cellMm = Math.min(TAG.textW / totalPixCols, TAG.textH / totalPixRows);

  // Centri Y delle due righe (simmetrico attorno a TAG.textYOffset)
  const yOffsetFromCenter = (FONT_ROWS + FONT_ROW_GAP) / 2 * cellMm;
  const yCenters = [
    TAG.textYOffset + yOffsetFromCenter,   // riga 0 (nome)
    TAG.textYOffset - yOffsetFromCenter,   // riga 1 (telefono)
  ];

  const half = cellMm * 0.45;  // mezzo lato pixel (5% di gap per chiarezza)
  const geos = [];

  for (let li = 0; li < lines.length; li++) {
    const text = lines[li];
    if (!text) continue;

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
          // cxRaw: posizione non-specchiata (leggibile da fronte)
          const cxRaw = (-lineCols / 2 + pixCol + 0.5) * cellMm;
          // cx: specchiato → leggibile da retro; la Shape stessa rimane CCW (no fix winding)
          const cx = -cxRaw;
          const cy = yCenter + (3 - r) * cellMm;

          // Scarta pixel fuori dal disco
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
function buildFrontBorder(discShape, qrModules) {
  const shape = cloneShapeWithHole(discShape);
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

  const geo = new THREE.ExtrudeGeometry(shape, { ...EXTRUDE, depth: TAG.engraveDepth });
  geo.translate(0, 0, TAG.thickness / 2 - TAG.engraveDepth);
  return geo;
}

// ---------------------------------------------------------------------------
// QR fill: sole celle QR (Colore 2)
// ---------------------------------------------------------------------------
function buildQRFill(qrModules) {
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
      const h = (cellMm - 0.08) / 2, v = h;
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
function buildBackBorder(discShape) {
  const geo = new THREE.ExtrudeGeometry(discShape, { ...EXTRUDE, depth: TAG.engraveDepth });
  geo.translate(0, 0, -TAG.thickness / 2);
  return geo;
}

// ---------------------------------------------------------------------------
// Text fill preview: testo pixellato sul retro (Colore 2)
// ---------------------------------------------------------------------------
function buildTextFill(name, phone) {
  return buildTextPixels(name, phone);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clona una Shape con le sue holes (Deep clone) */
function cloneShapeWithHole(src) {
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
function mergeGeos(geos) {
  if (geos.length === 0) return new THREE.BufferGeometry();

  const nonIndexed = geos.map(g => {
    const ni = g.index ? g.toNonIndexed() : g.clone();
    ni.computeVertexNormals();
    return ni;
  });

  let totalVerts = 0;
  for (const g of nonIndexed) totalVerts += g.attributes.position.count;

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  let vOff = 0;

  for (const g of nonIndexed) {
    const pos = g.attributes.position;
    const nrm = g.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      positions[(vOff + i) * 3] = pos.getX(i);
      positions[(vOff + i) * 3 + 1] = pos.getY(i);
      positions[(vOff + i) * 3 + 2] = pos.getZ(i);
      if (nrm) {
        normals[(vOff + i) * 3] = nrm.getX(i);
        normals[(vOff + i) * 3 + 1] = nrm.getY(i);
        normals[(vOff + i) * 3 + 2] = nrm.getZ(i);
      }
    }
    vOff += pos.count;
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
 * @param {string}     animalName
 * @param {string}     phone
 * @param {'white'|'gold'} [colorKey='white']
 */
export function buildTagMesh(qrModules, animalName, phone, colorKey = 'white') {
  const matOpts = MATERIALS[colorKey] ?? MATERIALS.white;
  const material = new THREE.MeshStandardMaterial(matOpts);

  const discShape = makeDiscShape();

  // --- Geometrie del corpo (Colore 1) ---
  const baseGeo = buildBase(discShape);
  const frontBorderGeo = buildFrontBorder(discShape, qrModules);
  const backBorderGeo = buildBackBorder(discShape);

  // --- Geometrie del riempimento (Colore 2) ---
  const qrFillGeo = buildQRFill(qrModules);
  const textFillGeo = buildTextFill(animalName, phone);

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
  const exportBody = buildBodyExport();
  const exportBackCap = buildBackCapExport(animalName, phone);
  const exportQR = buildQRFillExport(qrModules);

  group._bodyGeoExport = exportBody;
  group._backCapExport = exportBackCap;
  group._qrFillGeoExport = exportQR.attributes.position?.count > 0 ? exportQR : null;

  // Geometrie per 3MF: corpo pieno 3.5mm + QR pilastro + testo in rilievo (overlap → bicolore)
  const body3mf = build3MFBody();
  const qr3mf = build3MFQRFill(qrModules);
  const text3mf = build3MFTextFill(animalName, phone);

  group._body3MF = body3mf;
  group._qrFill3MF = qr3mf.attributes.position?.count > 0 ? qr3mf : null;
  group._textFill3MF = text3mf.attributes.position?.count > 0 ? text3mf : null;

  return group;
}
