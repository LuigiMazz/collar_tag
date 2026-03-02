
/**
 * dictionary.js
 * Semplice dizionario per comprimere termini comuni nelle note mediche.
 */

const DICTIONARY = {
    // Patologie e Condizioni
    "ALLERGICO": "A1",
    "DIABETE": "D1",
    "CARDIOPATICO": "C1",
    "EPILESSIA": "E1",
    "AGGRESSIVO": "G1",
    "PAUROSO": "S1",
    "CIECO": "B1",
    "SORDO": "Z1",
    "STERILIZZATO": "T1",
    "VACCINATO": "X1",

    // Azioni e Richieste
    "PROPRIETARIO": "P1",
    "CONTATTARE": "K1",
    "URGENZA": "U1",
    "MICROCHIP": "M1",
    "VETERINARIO": "V1",
    "CHIAMA": "H1",
    "AIUTO": "Y1",
    "CERCASI": "J1",
    "RICOMPENSA": "R1",
    "ZONA": "Z2",
    "PADRONI": "P2",
    "PIACERE": "K2",
    "LONTANO": "L1",
    "CASA": "C2",
    "TROVATO": "J2",
    "TROPPO": "O1",
    "DALLA": "H2",
    "MIA": "M2",
    "MIEI": "M3",
    "QUESTO": "Q3",
    "TUTTI": "T2",

    // Altro
    "GATTO": "Q1",
    "CANE": "Q2",
    "MANGIA": "W1",
    "SOLO": "W2"
};

const REVERSE_DICTIONARY = Object.fromEntries(
    Object.entries(DICTIONARY).map(([k, v]) => [v, k])
);

/**
 * Comprime una stringa usando il dizionario (case-insensitive).
 */
export function compressWithDict(text) {
    if (!text) return "";
    let result = text.toUpperCase();
    for (const [word, code] of Object.entries(DICTIONARY)) {
        const regex = new RegExp("\\b" + word + "\\b", "g");
        result = result.replace(regex, code);
    }
    return result;
}

/**
 * Decomprime una stringa usando il dizionario.
 */
export function decompressWithDict(text) {
    if (!text) return "";
    let result = text;
    for (const [code, word] of Object.entries(REVERSE_DICTIONARY)) {
        const regex = new RegExp(code, "g");
        result = result.replace(regex, word);
    }
    return result;
}
