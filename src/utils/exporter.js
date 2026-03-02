/**
 * exporter.js
 *
 * exportSTL  → STL binario (geometria piatta, senza artefatti CSG)
 * export3MF  → 3MF bicolore: body + fill separati, allineati perfettamente
 *
 * Orientamento per slicer (Z-up, disc flat su XY):
 *   La geometria è già in XY plane con Z = spessore.
 *   Trasliamo solo Z + thickness/2 per portare la base a z=0.
 */

import { STLExporter } from 'three-stdlib';
import * as THREE from 'three';
import { TAG, mergeGeos } from './geometry.js';

const stlExporter = new STLExporter();

// ---------------------------------------------------------------------------
// exportSTL
// ---------------------------------------------------------------------------
export function exportSTL(tagMesh, filename = 'medaglietta') {
  // corpo centrale + back cap con fori testo + QR sporgente
  const bodyG = tagMesh._bodyGeoExport;
  if (!bodyG) { console.warn('exportSTL: _bodyGeoExport non trovato'); return; }

  const geos = [bodyG, tagMesh._backCapExport, tagMesh._qrFillGeoExport]
    .filter(Boolean)
    .map(geoToZ0);

  if (geos.length === 0) return;

  const geo = mergeGeos(geos);
  const exportMesh = new THREE.Mesh(geo);
  const stlData = stlExporter.parse(exportMesh, { binary: true });
  downloadBlob(stlData, `${filename}.stl`, 'application/octet-stream');
}


// ---------------------------------------------------------------------------
// export3MF
// ---------------------------------------------------------------------------
/**
 * @param {THREE.Group} tagMesh   group con _body3MF, _qrFill3MF, _textFill3MF
 * @param {string}      tagColor  (non usato nel 3MF — assegnazione colore via Bambu Studio)
 * @param {string}      fillColor (non usato nel 3MF)
 * @param {string}      filename  senza estensione
 *
 * Struttura 3MF bicolore per Bambu Studio:
 *   Object 2 → corpo pieno 2.2mm          (extruder 1)
 *   Object 3 → celle QR pilastro 2.6mm    (extruder 2) — sportono 0.4mm sul fronte
 *   Object 4 → pixel testo 0.4mm          (extruder 2) — sovrapposti al fondo corpo
 * Bambu assegna priorità a extruder 2 nei voxel sovrapposti → effetto bicolore.
 */
export function export3MF(
  tagMesh,
  tagColor = '#FFFFFF',
  fillColor = '#1A1A1A',
  filename = 'medaglietta'
) {
  // Usa geometrie 3MF (corpo pieno + overlap) se disponibili, altrimenti fallback STL-raised
  const bodyGeo = tagMesh._body3MF ?? tagMesh._bodyGeoExport;
  const qrGeo = tagMesh._qrFill3MF ?? tagMesh._qrFillGeoExport;
  const textGeo = tagMesh._textFill3MF ?? tagMesh._textFillGeoExport;

  if (!bodyGeo) {
    console.warn('export3MF: geometria corpo non trovata');
    exportSTL(tagMesh, filename);
    return;
  }

  const bodyExport = geoToZ0(bodyGeo);
  const qrExport = qrGeo ? geoToZ0(qrGeo) : null;
  const textExport = textGeo ? geoToZ0(textGeo) : null;

  const modelXml = build3DModel(bodyExport, qrExport, textExport);
  const modelSettingsXml = buildModelSettingsXml(!!qrExport, !!textExport);

  const enc = new TextEncoder();
  const zipData = createZip([
    { name: '[Content_Types].xml', data: enc.encode(CONTENT_TYPES_XML) },
    { name: '_rels/.rels', data: enc.encode(RELS_XML) },
    { name: '3D/3dmodel.model', data: enc.encode(modelXml) },
    { name: '3D/_rels/3dmodel.model.rels', data: enc.encode(RELS_3D_XML) },
    { name: 'Metadata/model_settings.config', data: enc.encode(modelSettingsXml) },
  ]);

  downloadBlob(
    zipData,
    `${filename}.3mf`,
    'application/vnd.ms-package.3dmanufacturing-3dmodel+xml'
  );
}

function geoToZ0(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.translate(0, 0, TAG.thickness / 2);
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------------------
// 3MF XML
// ---------------------------------------------------------------------------
const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
  <Default Extension="config" ContentType="application/xml"/>
</Types>`;

const RELS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" Target="/3D/3dmodel.model" Id="rel0"/>
</Relationships>`;

// Relazione tra 3dmodel.model e model_settings.config (richiesta da Bambu Studio)
const RELS_3D_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Type="http://schemas.bambulab.com/package/2021/model-settings" Target="/Metadata/model_settings.config" Id="rel-1"/>
</Relationships>`;

// Assegnazione estrusori per oggetto (Bambu Studio legge questo file)
function buildModelSettingsXml(hasQR, hasText) {
  let objs = `  <object id="2">\n    <metadata key="extruder" value="1"/>\n  </object>`;
  if (hasQR) objs += `\n  <object id="3">\n    <metadata key="extruder" value="2"/>\n  </object>`;
  if (hasText) objs += `\n  <object id="4">\n    <metadata key="extruder" value="2"/>\n  </object>`;
  return `<?xml version="1.0" encoding="utf-8"?>\n<config>\n${objs}\n</config>`;
}

function geoToXmlParts(geo) {
  const pos = geo.attributes.position;
  const vLines = [];
  const tLines = [];

  for (let i = 0; i < pos.count; i++) {
    vLines.push(
      `<vertex x="${pos.getX(i).toFixed(4)}" y="${pos.getY(i).toFixed(4)}" z="${pos.getZ(i).toFixed(4)}"/>`
    );
  }
  for (let i = 0; i < pos.count; i += 3) {
    tLines.push(`<triangle v1="${i}" v2="${i + 1}" v3="${i + 2}"/>`);
  }
  return { vLines, tLines };
}

function geoToObject(geo, objectId) {
  const { vLines, tLines } = geoToXmlParts(geo);
  return `    <object id="${objectId}" type="model">
      <mesh>
        <vertices>
          ${vLines.join('\n          ')}
        </vertices>
        <triangles>
          ${tLines.join('\n          ')}
        </triangles>
      </mesh>
    </object>`;
}

function build3DModel(bodyGeo, qrGeo, textGeo) {
  const bodyObj = geoToObject(bodyGeo, 2);
  const qrObj = qrGeo ? geoToObject(qrGeo, 3) : '';
  const textObj = textGeo ? geoToObject(textGeo, 4) : '';
  const buildQr = qrGeo ? '\n    <item objectid="3"/>' : '';
  const buildText = textGeo ? '\n    <item objectid="4"/>' : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US"
  xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
${bodyObj}
${qrObj}
${textObj}
  </resources>
  <build>
    <item objectid="2"/>${buildQr}${buildText}
  </build>
</model>`;
}

// ---------------------------------------------------------------------------
// ZIP STORE writer (no librerie)
// ---------------------------------------------------------------------------
const CRC32_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(data) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ data[i]) & 0xFF];
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function createZip(files) {
  const localParts = [], centralParts = [];
  let localOffset = 0;

  for (const { name, data } of files) {
    const nameBytes = new TextEncoder().encode(name);
    const crc = crc32(data), size = data.length;

    const local = new Uint8Array(30 + nameBytes.length + size);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true);
    lv.setUint16(6, 0, true); lv.setUint16(8, 0, true);
    lv.setUint16(10, 0, true); lv.setUint16(12, 0, true);
    lv.setUint32(14, crc, true); lv.setUint32(18, size, true); lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true); lv.setUint16(28, 0, true);
    local.set(nameBytes, 30); local.set(data, 30 + nameBytes.length);
    localParts.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true); cv.setUint16(10, 0, true); cv.setUint16(12, 0, true); cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true); cv.setUint32(20, size, true); cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true); cv.setUint16(30, 0, true); cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true); cv.setUint16(36, 0, true); cv.setUint32(38, 0, true);
    cv.setUint32(42, localOffset, true);
    central.set(nameBytes, 46);
    centralParts.push(central);

    localOffset += local.length;
  }

  const centralSize = centralParts.reduce((s, c) => s + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(4, 0, true); ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true); ev.setUint32(16, localOffset, true); ev.setUint16(20, 0, true);

  const all = [...localParts, ...centralParts, eocd];
  const total = all.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of all) { out.set(p, pos); pos += p.length; }
  return out;
}

// ---------------------------------------------------------------------------
// Download helper
// ---------------------------------------------------------------------------
function downloadBlob(data, filename, mimeType) {
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.target = '_blank'; // Try to bypass some insecure download blocks
  link.click();
  URL.revokeObjectURL(url);
}
