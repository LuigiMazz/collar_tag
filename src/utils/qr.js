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
  qr.addData(text);
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
