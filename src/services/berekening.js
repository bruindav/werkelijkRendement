// Forfaitaire percentages per jaar (Belastingdienst)
export const FORFAITAIR_TARIEVEN = {
  2021: { spaargeld: 0.0003, beleggingen: 0.0556, schulden: 0.0246, belasting: 0.31 },
  2022: { spaargeld: 0.0000, beleggingen: 0.0565, schulden: 0.0228, belasting: 0.31 },
  2023: { spaargeld: 0.0092, beleggingen: 0.0666, schulden: 0.0236, belasting: 0.32 },
  2024: { spaargeld: 0.0103, beleggingen: 0.0604, schulden: 0.0247, belasting: 0.36 },
  2025: { spaargeld: 0.0103, beleggingen: 0.0604, schulden: 0.0247, belasting: 0.36 },
};

export const HEFFINGSVRIJ_VERMOGEN = {
  2021: 50000,
  2022: 50650,
  2023: 57000,
  2024: 57000,
  2025: 57000,
};

/**
 * Bereken werkelijk rendement per positie
 */
// Fix 9 - Kosten meegenomen in rendement berekening
export function berekenPositieRendement(positie) {
  const waardeJan1 = positie.jan1_waarde || 0;
  const waardeDec31 = positie.dec31_waarde || 0;

  const totaalAankopen = (positie.aankopen || []).reduce((sum, a) => sum + (a.totaal || 0), 0);
  const totaalVerkopen = (positie.verkopen || []).reduce((sum, v) => sum + (v.totaal || 0), 0);

  const koersresultaat = waardeDec31 - waardeJan1 + totaalVerkopen - totaalAankopen;
  const inkomen = (positie.dividend || 0) + (positie.rente || 0);
  const kosten = positie.kosten || 0;
  const totaalRendement = koersresultaat + inkomen - kosten;
  const rendementPct = waardeJan1 > 0 ? (totaalRendement / waardeJan1) * 100 : 0;

  return {
    waardeJan1,
    waardeDec31,
    totaalAankopen,
    totaalVerkopen,
    koersresultaat,
    inkomen,
    kosten,
    totaalRendement,
    rendementPct,
  };
}

/**
 * Aggregeer rendement over alle posities in een rekening
 */
export function berekenRekeningTotaal(posities) {
  return posities.reduce((acc, positie) => {
    const r = berekenPositieRendement(positie);
    return {
      waardeJan1: acc.waardeJan1 + r.waardeJan1,
      waardeDec31: acc.waardeDec31 + r.waardeDec31,
      totaalAankopen: acc.totaalAankopen + r.totaalAankopen,
      totaalVerkopen: acc.totaalVerkopen + r.totaalVerkopen,
      koersresultaat: acc.koersresultaat + r.koersresultaat,
      inkomen: acc.inkomen + r.inkomen,
      totaalRendement: acc.totaalRendement + r.totaalRendement,
    };
  }, {
    waardeJan1: 0, waardeDec31: 0, totaalAankopen: 0,
    totaalVerkopen: 0, koersresultaat: 0, inkomen: 0, totaalRendement: 0
  });
}

/**
 * Bereken forfaitair rendement
 */
export function berekenForfaitair(vermogenJan1, jaar, type = 'beleggingen') {
  const tarieven = FORFAITAIR_TARIEVEN[jaar] || FORFAITAIR_TARIEVEN[2024];
  const heffingsvrij = HEFFINGSVRIJ_VERMOGEN[jaar] || 57000;
  const belastbaarVermogen = Math.max(0, vermogenJan1 - heffingsvrij);
  const forfaitairRendement = belastbaarVermogen * tarieven[type];
  const belasting = forfaitairRendement * tarieven.belasting;

  return {
    vermogenJan1,
    heffingsvrij,
    belastbaarVermogen,
    forfaitairPercentage: tarieven[type] * 100,
    forfaitairRendement,
    belastingPercentage: tarieven.belasting * 100,
    belasting,
  };
}

/**
 * Bereken werkelijke belasting
 */
export function berekenWerkelijkeBelasting(werkelijkRendement, jaar) {
  const tarieven = FORFAITAIR_TARIEVEN[jaar] || FORFAITAIR_TARIEVEN[2024];
  const belasting = Math.max(0, werkelijkRendement) * tarieven.belasting;
  return { belasting, percentage: tarieven.belasting * 100 };
}

/**
 * Vergelijk werkelijk vs forfaitair
 */
export function vergelijkMethoden(werkelijkRendement, vermogenJan1, jaar) {
  const werkelijk = berekenWerkelijkeBelasting(werkelijkRendement, jaar);
  const forfaitair = berekenForfaitair(vermogenJan1, jaar);

  const voordeel = forfaitair.belasting - werkelijk.belasting;
  const voordeliigsteMethode = voordeel > 0 ? 'werkelijk' : 'forfaitair';

  return {
    werkelijk,
    forfaitair,
    voordeel: Math.abs(voordeel),
    voordeliigsteMethode,
  };
}

export function formatEuro(amount) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(amount || 0);
}

export function formatPct(pct) {
  return `${(pct || 0).toFixed(2)}%`;
}
