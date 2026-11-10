// Versie: Fix126
// Bepaalt of de app in demo-modus of echte modus draait.
// De keuze staat in localStorage ('wr_modus': 'demo' | 'echt' | leeg).
// Demo gebruikt een APARTE database, zodat echte gegevens nooit worden aangeraakt.

const SLEUTEL = 'wr_modus';

export const DB_NAAM_ECHT = 'werkelijkRendement';
export const DB_NAAM_DEMO = 'werkelijkRendement_demo';
export const DEMO_JAAR = 2025;

export function getModus() {
  try { return localStorage.getItem(SLEUTEL); } catch { return null; }
}

export function setModus(modus) {
  try {
    if (modus) localStorage.setItem(SLEUTEL, modus);
    else localStorage.removeItem(SLEUTEL);
  } catch { /* localStorage niet beschikbaar */ }
}

export function isDemo() {
  return getModus() === 'demo';
}
