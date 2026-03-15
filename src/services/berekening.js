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

// Helper: haal tarieven op (eigen instelling of standaard Belastingdienst)
export function getTarieven(jaar, instellingen = null) {
  const standaard = FORFAITAIR_TARIEVEN[jaar] || FORFAITAIR_TARIEVEN[2025];
  if (!instellingen?.tarieven?.[jaar]) return standaard;
  return { ...standaard, ...instellingen.tarieven[jaar] };
}

// Helper: haal heffingsvrij op (incl. partner-verdubbeling)
export function getHeffingsvrij(jaar, instellingen = null) {
  const standaard = HEFFINGSVRIJ_VERMOGEN[jaar] || 57000;
  const eigen = instellingen?.heffingsvrij?.[jaar] ?? standaard;
  const partner = instellingen?.partner ? 2 : 1;
  return eigen * partner;
}

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
export function berekenForfaitair(vermogenJan1, jaar, type = 'beleggingen', instellingen = null) {
  const tarieven = getTarieven(jaar, instellingen);
  const heffingsvrij = getHeffingsvrij(jaar, instellingen);
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
export function berekenWerkelijkeBelasting(werkelijkRendement, jaar, instellingen = null) {
  const tarieven = getTarieven(jaar, instellingen);
  const belasting = Math.max(0, werkelijkRendement) * tarieven.belasting;
  return { belasting, percentage: tarieven.belasting * 100 };
}

/**
 * Vergelijk werkelijk vs forfaitair
 * instellingen: { tarieven: {jaar: {...}}, heffingsvrij: {jaar: n}, partner: bool }
 */
export function vergelijkMethoden(werkelijkRendement, vermogenJan1, jaar, instellingen = null, vermogenSplit = null) {
  const werkelijk = berekenWerkelijkeBelasting(werkelijkRendement, jaar, instellingen);

  // Forfaitair met sparen/beleggen split als beschikbaar
  let forfaitair;
  if (vermogenSplit && (vermogenSplit.sparen > 0 || vermogenSplit.beleggen > 0)) {
    forfaitair = berekenForfaitairSplit(vermogenSplit.sparen, vermogenSplit.beleggen, jaar, instellingen);
  } else {
    forfaitair = berekenForfaitair(vermogenJan1, jaar, 'beleggingen', instellingen);
  }

  const voordeel = forfaitair.belasting - werkelijk.belasting;
  const voordeliigsteMethode = voordeel > 0 ? 'werkelijk' : 'forfaitair';

  return {
    werkelijk,
    forfaitair,
    voordeel: Math.abs(voordeel),
    voordeliigsteMethode,
  };
}

/**
 * Forfaitair met aparte sparen/beleggen percentages
 */
export function berekenForfaitairSplit(vermogenSparen, vermogenBeleggen, jaar, instellingen = null) {
  const tarieven = getTarieven(jaar, instellingen);
  const heffingsvrij = getHeffingsvrij(jaar, instellingen);

  const totaalVermogen = vermogenSparen + vermogenBeleggen;
  const belastbaarTotaal = Math.max(0, totaalVermogen - heffingsvrij);

  // Verdeel heffingsvrij pro-rata over sparen en beleggen
  const fracSparen = totaalVermogen > 0 ? vermogenSparen / totaalVermogen : 0;
  const fracBeleggen = totaalVermogen > 0 ? vermogenBeleggen / totaalVermogen : 0;

  const belastbaarSparen = belastbaarTotaal * fracSparen;
  const belastbaarBeleggen = belastbaarTotaal * fracBeleggen;

  const rendementSparen = belastbaarSparen * tarieven.spaargeld;
  const rendementBeleggen = belastbaarBeleggen * tarieven.beleggingen;
  const forfaitairRendement = rendementSparen + rendementBeleggen;
  const belasting = forfaitairRendement * tarieven.belasting;

  return {
    vermogenJan1: totaalVermogen,
    heffingsvrij,
    belastbaarVermogen: belastbaarTotaal,
    forfaitairPercentage: totaalVermogen > 0
      ? ((rendementSparen + rendementBeleggen) / totaalVermogen) * 100 : 0,
    forfaitairRendement,
    belastingPercentage: tarieven.belasting * 100,
    belasting,
    // Extra info voor display
    splitsing: {
      sparen: { vermogen: vermogenSparen, belastbaar: belastbaarSparen, rendement: rendementSparen, pct: tarieven.spaargeld * 100 },
      beleggen: { vermogen: vermogenBeleggen, belastbaar: belastbaarBeleggen, rendement: rendementBeleggen, pct: tarieven.beleggingen * 100 },
    }
  };
}


export function formatEuro(amount) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(amount || 0);
}

export function formatPct(pct) {
  return `${(pct || 0).toFixed(2)}%`;
}

// Fix 11 - Berekening werkelijk rendement voor spaargeld/deposito
export function berekenSpaarRendement(spaar) {
  const ontvangen_rente = spaar.ontvangen_rente || 0;
  const kosten = spaar.kosten || 0;
  const nettoRendement = ontvangen_rente - kosten;
  const jan1_saldo = spaar.jan1_saldo || 0;
  const rendementPct = jan1_saldo > 0 ? (nettoRendement / jan1_saldo) * 100 : 0;

  return {
    jan1_saldo,
    dec31_saldo: spaar.dec31_saldo || 0,
    ontvangen_rente,
    kosten,
    nettoRendement,
    rendementPct,
  };
}
