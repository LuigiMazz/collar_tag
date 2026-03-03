import * as THREE from 'three';
import { STLExporter } from 'three-stdlib';

const stlExporter = new STLExporter();

// Simulate mergeGeos
function mergeGeos(geos) {
  if (geos.length === 0) return new THREE.BufferGeometry();
  const nonIndexed = geos.map(g => {
    const ni = g.index ? g.toNonIndexed() : g.clone();
    ni.computeVertexNormals();
    return ni;
  });
  let totalVerts = 0;
  for (const g of nonIndexed) {
    totalVerts += Math.floor(g.attributes.position.count / 3) * 3;
  }
  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  let vOff = 0;
  for (const g of nonIndexed) {
    const pos = g.attributes.position;
    const count = Math.floor(pos.count / 3) * 3;
    for (let i = 0; i < count; i++) {
      positions[(vOff + i) * 3] = pos.getX(i);
      positions[(vOff + i) * 3 + 1] = pos.getY(i);
      positions[(vOff + i) * 3 + 2] = pos.getZ(i);
    }
    vOff += count;
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  return merged;
}

// Simulate geoToZ0
function geoToZ0(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.translate(0, 0, 1.8);
  g.computeVertexNormals();
  return g;
}

const bodyG = new THREE.BoxGeometry(10, 10, 2);
const qrFill = mergeGeos([new THREE.BoxGeometry(2, 2, 2)]);

function exportSTL() {
  const geos = [bodyG, qrFill].filter(Boolean).map(geoToZ0);
  const geo = mergeGeos(geos);
  const exportMesh = new THREE.Mesh(geo);
  const stlData = stlExporter.parse(exportMesh, { binary: true });
  console.log("STL parsed successfully, size:", stlData.byteLength);
}

try {
  console.log("First export:");
  exportSTL();
  console.log("Second export:");
  exportSTL();
} catch (e) {
  console.error(e);
}
