
import LZString from 'lz-string';
import { compressWithDict, decompressWithDict } from './dictionary';

export function readCardHash() {
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

export function buildCardUrl(name, phone, phone2, description, minimal = false) {
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
