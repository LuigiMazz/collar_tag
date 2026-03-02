/**
 * qr.js
 * Wrapper per qrcode-generator.
 * Restituisce la matrice 2D di moduli (0 = bianco, 1 = nero)
 * usata da buildQREngraveMeshes() in geometry.js.
 */

import qrcode from 'qrcode-generator';

/**
 * Genera la matrice binaria del QR code per un dato URL/testo.
 *
 * @param {string} text  - testo da codificare (es. URL, testo libero)
 * @param {number} [typeNumber=0] - tipo QR (0 = auto-detect)
 * @param {string} [errorLevel='M'] - livello correzione errori (L, M, Q, H)
 * @returns {number[][]} matrice 2D: 1 = modulo nero, 0 = modulo bianco
 */
export function generateQRMatrix(text, typeNumber = 0, errorLevel = 'M') {
  const qr = qrcode(typeNumber, errorLevel);

  // Optimization: Multi-segment encoding
  // If we have our "Extreme" marker '#e:', we split the URL.
  // Segment 1: URL prefix including #e: (Byte mode)
  // Segment 2: Data (AlphaNum mode - much more dense)
  const markers = ['#e:', '#*'];
  const marker = markers.find(m => text.includes(m));

  if (marker) {
    const parts = text.split(marker);
    let prefix = parts[0] + marker;
    const data = parts.slice(1).join(marker).toUpperCase();

    // Segment 1: URL Prefix (Byte mode for protocol)
    // If the prefix itself is Alphanumeric (common for domain/path), use Alphanumeric
    if (/^[0-9A-Z $%*+\-./:]+$/.test(prefix.toUpperCase())) {
      qr.addData(prefix.toUpperCase(), 'Alphanumeric');
    } else {
      qr.addData(prefix, 'Byte');
    }

    // Segment 2: Data
    // We try to use ONE single Alphanumeric segment for all data to avoid 
    // the ~15bit overhead of switching modes between fields.
    if (/^[0-9A-Z $%*+\-./:]+$/.test(data)) {
      qr.addData(data, 'Alphanumeric');
    } else {
      // Fallback: Smart splitting (existing logic)
      const dataParts = data.split(':');
      for (let i = 0; i < dataParts.length; i++) {
        const part = dataParts[i];
        if (/^\d+$/.test(part) && part.length >= 7) {
          qr.addData(part, 'Numeric');
        } else if (/^[0-9A-Z $%*+\-./:]+$/.test(part)) {
          qr.addData(part, 'Alphanumeric');
        } else {
          qr.addData(part, 'Byte');
        }
        if (i < dataParts.length - 1) qr.addData(':', 'Alphanumeric');
      }
    }
  } else {
    qr.addData(text);
  }

  qr.make();

  const count = qr.getModuleCount();
  const matrix = [];

  for (let row = 0; row < count; row++) {
    matrix[row] = [];
    for (let col = 0; col < count; col++) {
      matrix[row][col] = qr.isDark(row, col) ? 1 : 0;
    }
  }

  return matrix;
}
