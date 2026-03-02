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
import { Font, TextGeometry } from 'three-stdlib';
import helvetikerBoldJson from '../assets/helvetiker_bold.typeface.json';

const FONT = new Font(helvetikerBoldJson);

// ---------------------------------------------------------------------------
// Costanti (mm)
// ---------------------------------------------------------------------------
export const TAG = {
  radius:       15,     // raggio disco (Ø30mm)
  thickness:    3.5,    // spessore totale
  holeRadius:   2,      // raggio foro (Ø4mm)
  holeY:        12,     // posizione Y del foro (vicino al bordo superiore)
  engraveDepth: 0.8,    // profondità incisione
  segments:     64,     // segmenti per archi circolari
  qrSize:       20,     // dimensione area QR in mm
  qrYOffset:    -1,     // offset verticale QR (schiva il foro)
  textW:        22,     // larghezza area testo
  textH:        10,     // altezza area testo
  textYOffset:  -2,     // offset verticale testo
};

export const MATERIALS = {
  white: { color: 0xffffff, metalness: 0.05, roughness: 0.65 },
  gold:  { color: 0xd4af37, metalness: 0.85, roughness: 0.20 },
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
  const h   = TAG.thickness - TAG.engraveDepth * 2;
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

const RAISE = TAG.engraveDepth / 2;  // 0.4mm altezza rilievo

// Corpo export: 2.7mm (thickness - engraveDepth), solo foro anello
function buildBodyExport() {
  const h = TAG.thickness - TAG.engraveDepth;  // 2.7mm
  const geo = new THREE.ExtrudeGeometry(makeDiscShape(), { ...EXTRUDE, depth: h });
  geo.translate(0, 0, -(h / 2));               // centrato: z=-1.35 → z=+1.35
  return geo;
}

// QR in rilievo: celle che sporgono dalla faccia frontale (z=+1.35 → z=+1.75)
function buildQRFillExport(qrModules) {
  const size   = qrModules.length;
  const cellMm = TAG.qrSize / size;
  const startZ = (TAG.thickness - TAG.engraveDepth) / 2;  // +1.35
  const geos   = [];

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
  const size   = qrModules.length;
  const cellMm = TAG.qrSize / size;
  const depth  = TAG.thickness + RAISE;                               // 3.9mm (corpo + rilievo)
  const startZ = -(TAG.thickness / 2);                                // -1.75 (dal fondo corpo)
  const geos   = [];

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
  return buildTextBack(animalName, phone);
}

// ---------------------------------------------------------------------------
// buildTextBack — testo in rilievo sul retro (font vettoriale Helvetiker)
//
// Usato da STL export, 3MF export e preview.
// Produce testo in rilievo RAISE=0.4mm sul retro del disco (z=-1.75→-1.35).
// X-mirrored per leggibilità da retro; winding corretto.
// ---------------------------------------------------------------------------
function buildTextBack(name, phone) {
  const z0    = -(TAG.thickness / 2);  // -1.75: back face of disc
  const depth = RAISE;                  // 0.4mm raised from back face

  const lines  = [name.toUpperCase().slice(0, 14), phone.slice(0, 16)];
  const geos   = [];

  for (let i = 0; i < lines.length; i++) {
    const text = lines[i];
    if (!text) continue;

    const tg = new TextGeometry(text, {
      font:          FONT,
      size:          TAG.textH * 0.38,
      depth:         depth,
      curveSegments: 6,
      bevelEnabled:  false,
    });

    tg.computeBoundingBox();
    const bb = tg.boundingBox;
    const tw = bb.max.x - bb.min.x;
    const th = bb.max.y - bb.min.y;

    // Center horizontally, place at correct Y slot
    const xOff = -(bb.min.x + tw / 2);
    const ySlot = TAG.textYOffset + TAG.textH / 4 * (1 - i * 2);
    const yOff = ySlot - (bb.min.y + th / 2);

    tg.translate(xOff, yOff, z0);
    geos.push(tg);
  }

  if (geos.length === 0) return new THREE.BufferGeometry();

  // Merge into single non-indexed geometry
  let merged = mergeGeos(geos);

  // Scale to fit text area (uniform XY, don't scale Z/depth)
  merged.computeBoundingBox();
  const bb2 = merged.boundingBox;
  const bw  = bb2.max.x - bb2.min.x;
  const bh  = bb2.max.y - bb2.min.y;
  if (bw > 0 && bh > 0) {
    const s  = Math.min(TAG.textW / bw, TAG.textH / bh, 1.0) * 0.9;
    const cx = (bb2.min.x + bb2.max.x) / 2;
    const cy = (bb2.min.y + bb2.max.y) / 2;
    const pos = merged.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setX(i, cx + (pos.getX(i) - cx) * s);
      pos.setY(i, cy + (pos.getY(i) - cy) * s);
    }
    pos.needsUpdate = true;
  }

  // Mirror X for back-face readability (text reads correctly when tag is flipped)
  const pos = merged.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setX(i, -pos.getX(i));
  }
  // Fix triangle winding reversed by X-mirror (swap v1 ↔ v2 per triple)
  for (let i = 0; i < pos.count; i += 3) {
    const x1 = pos.getX(i + 1), y1 = pos.getY(i + 1), z1 = pos.getZ(i + 1);
    const x2 = pos.getX(i + 2), y2 = pos.getY(i + 2), z2 = pos.getZ(i + 2);
    pos.setXYZ(i + 1, x2, y2, z2);
    pos.setXYZ(i + 2, x1, y1, z1);
  }
  pos.needsUpdate = true;
  merged.computeVertexNormals();

  return merged;
}

// ---------------------------------------------------------------------------
// Border layer fronte: disco − celle QR  (Colore 1, parte del body)
// ---------------------------------------------------------------------------
function buildFrontBorder(discShape, qrModules) {
  const shape   = cloneShapeWithHole(discShape);
  const size    = qrModules.length;
  const cellMm  = TAG.qrSize / size;

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
  const size   = qrModules.length;
  const cellMm = TAG.qrSize / size;
  const geos   = [];

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!qrModules[row][col]) continue;
      const cx = (col - size / 2 + 0.5) * cellMm;
      const cy = -(row - size / 2 + 0.5) * cellMm + TAG.qrYOffset;
      if (Math.sqrt(cx * cx + cy * cy) > TAG.radius - 0.5) continue;

      const cellShape = new THREE.Shape();
      const h = (cellMm - 0.08) / 2, v = h;
      cellShape.moveTo(-h, -v); cellShape.lineTo(h, -v);
      cellShape.lineTo(h, v);  cellShape.lineTo(-h, v);
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
// Text fill preview: testo in rilievo sul retro (Colore 2)
// ---------------------------------------------------------------------------
function buildTextFill(name, phone) {
  return buildTextBack(name, phone);
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
  const normals   = new Float32Array(totalVerts * 3);
  let vOff = 0;

  for (const g of nonIndexed) {
    const pos = g.attributes.position;
    const nrm = g.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      positions[(vOff + i) * 3]     = pos.getX(i);
      positions[(vOff + i) * 3 + 1] = pos.getY(i);
      positions[(vOff + i) * 3 + 2] = pos.getZ(i);
      if (nrm) {
        normals[(vOff + i) * 3]     = nrm.getX(i);
        normals[(vOff + i) * 3 + 1] = nrm.getY(i);
        normals[(vOff + i) * 3 + 2] = nrm.getZ(i);
      }
    }
    vOff += pos.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal',   new THREE.BufferAttribute(normals,   3));
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
  const baseGeo        = buildBase(discShape);
  const frontBorderGeo = buildFrontBorder(discShape, qrModules);
  const backBorderGeo  = buildBackBorder(discShape);

  // --- Geometrie del riempimento (Colore 2) ---
  const qrFillGeo   = buildQRFill(qrModules);
  const textFillGeo = buildTextFill(animalName, phone);

  const allBodyGeos = [baseGeo, frontBorderGeo, backBorderGeo].map(g => {
    const ni = g.index ? g.toNonIndexed() : g.clone();
    ni.computeVertexNormals();
    return ni;
  });
  const allFillGeos = [qrFillGeo, textFillGeo].filter(
    g => g.attributes.position?.count > 0
  );

  const bodyMerged = mergeGeos(allBodyGeos);
  const fillMerged = allFillGeos.length > 0 ? mergeGeos(allFillGeos) : null;

  // Preview: due mesh separate con materiali distinti
  const group = new THREE.Group();

  const bodyMesh = new THREE.Mesh(bodyMerged, material);
  bodyMesh.castShadow    = true;
  bodyMesh.receiveShadow = true;
  group.add(bodyMesh);

  if (fillMerged) {
    const fillMaterial = new THREE.MeshStandardMaterial({
      color:     0x1a1a1a,
      metalness: 0.05,
      roughness: 0.85,
    });
    const fillMesh = new THREE.Mesh(fillMerged, fillMaterial);
    fillMesh.castShadow    = true;
    fillMesh.receiveShadow = true;
    fillMesh.renderOrder   = 1;  // render sopra il body per evitare z-fighting sul retro
    group.add(fillMesh);
  }

  // Geometrie per STL: corpo 2.7mm + QR sporgente + testo in rilievo (retro)
  const exportBody = buildBodyExport();
  const exportQR   = buildQRFillExport(qrModules);
  const exportText = buildTextBack(animalName, phone);

  group._bodyGeoExport     = exportBody;
  group._qrFillGeoExport   = exportQR.attributes.position?.count   > 0 ? exportQR   : null;
  group._textFillGeoExport = exportText.attributes.position?.count > 0 ? exportText : null;

  // Geometrie per 3MF: corpo pieno 3.5mm + QR pilastro + testo in rilievo (overlap → bicolore)
  const body3mf = build3MFBody();
  const qr3mf   = build3MFQRFill(qrModules);
  const text3mf = build3MFTextFill(animalName, phone);

  group._body3MF     = body3mf;
  group._qrFill3MF   = qr3mf.attributes.position?.count   > 0 ? qr3mf   : null;
  group._textFill3MF = text3mf.attributes.position?.count > 0 ? text3mf : null;

  return group;
}
