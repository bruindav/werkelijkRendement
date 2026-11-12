// Versie: Fix140
// Fix109 - Valuta velden opslaan bij import
// Fix105 - Gratis limieten ingebouwd in voegBankToe en voegRekeningToe
// Lokale database hooks — vervangt useFirestore.js
// Dezelfde API als useFirestore zodat alle pagina's ongewijzigd blijven
// Data staat in IndexedDB (lokaal in de browser)

import { useState, useEffect, useCallback } from 'react';
import db, { genId, getBanken, getRekeningen, getPosities } from '../services/localDb';

// ============ HEEL JAAR LEEGMAKEN (Fix139) ============
// Telt wat er voor een jaar aan banken, rekeningen en posities staat
export async function telJaarData(jaar) {
  const y = String(jaar);
  return {
    banken: await db.banken.where('year').equals(y).count(),
    rekeningen: await db.rekeningen.filter(r => String(r.year) === y).count(),
    posities: await db.posities.filter(p => String(p.year) === y).count(),
  };
}

// Verwijdert ALLE banken, rekeningen en posities van één jaar (andere jaren blijven staan).
// Eigenaar/doel-keuzes (rekeningMeta) blijven bewaard, zodat die na opnieuw importeren weer gelden.
export async function verwijderJaarData(jaar) {
  const y = String(jaar);
  await db.transaction('rw', db.banken, db.rekeningen, db.posities, async () => {
    await db.posities.filter(p => String(p.year) === y).delete();
    await db.rekeningen.filter(r => String(r.year) === y).delete();
    await db.banken.where('year').equals(y).delete();
  });
}

export function jaarWaarschuwing(jaar, t) {
  return `Alle gegevens van ${jaar} verwijderen?\n\n` +
    `${t.banken} bank(en), ${t.rekeningen} rekening(en) en ${t.posities} positie(s) worden definitief gewist.\n` +
    `Dit kan niet ongedaan worden gemaakt (maak eventueel eerst een backup).\n\n` +
    `Andere jaren blijven ongewijzigd.`;
}

// ============ BANKEN ============
export function useBanken(_uid, year) {
  const [banken, setBanken] = useState([]);
  const [loading, setLoading] = useState(true);

  const laad = useCallback(async () => {
    if (!year) return;
    const lijst = await getBanken(String(year));
    setBanken(lijst);
    setLoading(false);
  }, [year]);

  useEffect(() => {
    laad();
  }, [laad]);

  const voegBankToe = async (data) => {
    const id = genId();
    const count = await db.banken.where('year').equals(String(year)).count();
    await db.banken.add({ id, year: String(year), volgorde: count, ...data });
    await laad();
    return { id };
  };

  const updateBank = async (id, data) => {
    await db.banken.update(id, data);
    await laad();
  };

  const verwijderBank = async (id) => {
    // Verwijder ook alle rekeningen en posities van deze bank
    const reks = await db.rekeningen.filter(r => r.bankId === id).toArray();
    for (const rek of reks) {
      await db.posities.where('rekeningId').equals(rek.id).delete();
    }
    await db.rekeningen.filter(r => r.bankId === id).delete();
    await db.banken.delete(id);
    await laad();
  };

  const slaVolgorde = async (gesorteerd) => {
    await Promise.all(gesorteerd.map((bank, i) =>
      db.banken.update(bank.id, { volgorde: i })
    ));
    await laad();
  };

  return { banken, loading, voegBankToe, updateBank, verwijderBank, slaVolgorde, herlaad: laad };
}

// ============ REKENINGEN ============
export function useRekeningen(_uid, year, bankId) {
  const [rekeningen, setRekeningen] = useState([]);
  const [loading, setLoading] = useState(true);

  const laad = useCallback(async () => {
    if (!year || !bankId) return;
    const lijst = await getRekeningen(String(year), bankId);
    setRekeningen(lijst);
    setLoading(false);
  }, [year, bankId]);

  useEffect(() => {
    laad();
  }, [laad]);

  const voegRekeningToe = async (data) => {
    const id = genId();
    const count = await db.rekeningen.filter(r => r.bankId === bankId && r.year === String(year)).count();
    await db.rekeningen.add({ id, year: String(year), bankId, volgorde: count, ...data });
    await laad();
    return { id };
  };

  const updateRekening = async (id, data) => {
    await db.rekeningen.update(id, data);
    await laad();
  };

  const verwijderRekening = async (id) => {
    await db.posities.where('rekeningId').equals(id).delete();
    await db.rekeningen.delete(id);
    await laad();
  };

  const slaVolgorde = async (gesorteerd) => {
    await Promise.all(gesorteerd.map((rek, i) =>
      db.rekeningen.update(rek.id, { volgorde: i })
    ));
    await laad();
  };

  return { rekeningen, loading, voegRekeningToe, updateRekening, verwijderRekening, slaVolgorde };
}

// ============ POSITIES ============
export function usePosities(_uid, year, bankId, rekeningId) {
  const [posities, setPosities] = useState([]);
  const [loading, setLoading] = useState(true);

  const laad = useCallback(async () => {
    if (!rekeningId) return;
    const lijst = await getPosities(rekeningId);
    setPosities(lijst);
    setLoading(false);
  }, [rekeningId]);

  useEffect(() => {
    laad();
  }, [laad]);

  const voegPositieToe = async (data) => {
    const id = genId();
    await db.posities.add({
      id,
      rekeningId,
      bankId,
      year: String(year),
      aankopen: [],
      verkopen: [],
      dividend: 0,
      rente: 0,
      ...data,
    });
    await laad();
    return { id };
  };

  const updatePositie = async (id, data) => {
    await db.posities.update(id, data);
    await laad();
  };

  const verwijderPositie = async (id) => {
    await db.posities.delete(id);
    await laad();
  };

  return { posities, loading, voegPositieToe, updatePositie, verwijderPositie };
}

// ============ SINGLE DOCUMENT HOOKS (voor breadcrumbs) ============
export function useBank(_uid, year, bankId) {
  const [bank, setBank] = useState(null);

  useEffect(() => {
    if (!bankId) return;
    db.banken.get(bankId).then(setBank);
  }, [bankId]);

  return bank;
}

export function useRekening(_uid, year, bankId, rekeningId) {
  const [rekening, setRekening] = useState(null);

  useEffect(() => {
    if (!rekeningId) return;
    db.rekeningen.get(rekeningId).then(setRekening);
  }, [rekeningId]);

  return rekening;
}

// ============ JAAR KOPIËREN ============
export async function controleerJaarLeeg(_uid, jaar) {
  const banken = await db.banken.where('year').equals(String(jaar)).toArray();
  return banken.length === 0;
}

export async function kopieerJaar(_uid, vanJaar, naarJaar) {
  const banken = await db.banken.where('year').equals(String(vanJaar)).toArray();
  const count = await db.banken.where('year').equals(String(naarJaar)).count();

  for (const bank of banken) {
    const nieuwBankId = genId();
    await db.banken.add({
      ...bank,
      id: nieuwBankId,
      year: String(naarJaar),
      volgorde: (bank.volgorde ?? 0) + count,
    });

    const rekeningen = await db.rekeningen
      .filter(r => r.bankId === bank.id && r.year === String(vanJaar))
      .toArray();

    for (const rek of rekeningen) {
      const nieuwRekId = genId();
      await db.rekeningen.add({
        ...rek,
        id: nieuwRekId,
        bankId: nieuwBankId,
        year: String(naarJaar),
        // Spaar/deposito: saldo's resetten, instellingen bewaren
        jan1_saldo: rek.dec31_saldo || 0,
        dec31_saldo: 0,
        ontvangen_rente: 0,
      });

      const posities = await db.posities
        .filter(p => p.rekeningId === rek.id)
        .toArray();

      for (const pos of posities) {
        await db.posities.add({
          ...pos,
          id: genId(),
          rekeningId: nieuwRekId,
          bankId: nieuwBankId,
          year: String(naarJaar),
          // Zet dec31 waarden als jan1 van nieuw jaar
          jan1_aantal: pos.dec31_aantal || 0,
          jan1_prijs: pos.dec31_prijs || 0,
          jan1_waarde: pos.dec31_waarde || 0,
          dec31_aantal: 0,
          dec31_prijs: 0,
          dec31_waarde: 0,
          aankopen: [],
          verkopen: [],
          dividend: 0,
          rente: 0,
          maandelijks_bedrag: pos.maandelijks_bedrag || 0,
        });
      }
    }
  }
}

// ============ DASHBOARD HELPERS ============
// Haal alle data op voor het dashboard (vervangt de inline getDocs in Dashboard.jsx)
export async function getDashboardData(year) {
  const banken = await getBanken(String(year));
  const result = [];

  for (const bank of banken) {
    const reks = await getRekeningen(String(year), bank.id);
    const rekData = [];

    for (const rek of reks) {
      if (rek.type === 'beleggen') {
        const pos = await getPosities(rek.id);
        rekData.push({ ...rek, posities: pos });
      } else {
        rekData.push({ ...rek, posities: [] });
      }
    }
    result.push({ ...bank, rekeningen: rekData });
  }
  return result;
}

// ============ AANGIFTE HELPER ============
export async function getAangifteData(year) {
  return getDashboardData(year);
}

// ============ IMPORT HELPERS ============
// Fix131 - Dividend/rente uit jaaroverzichten: parsers leveren totalen (dividend_totaal,
// rente_totaal) en soms dividend per positie. Het deel dat niet per positie bekend is
// komt op een aparte regel zodat het totaal altijd klopt met het jaaroverzicht.
const INKOMSTEN_POSITIE_NAAM = 'Ontvangen dividend & rente (totaal)';
const r2 = (n) => Math.round((n || 0) * 100) / 100;

function inkomstenRest(rek, posities) {
  const somDiv = posities.reduce((t, p) => t + (p.dividend || 0), 0);
  const somRente = posities.reduce((t, p) => t + (p.rente || 0), 0);
  return {
    dividend: r2((rek.dividend_totaal || 0) - somDiv),
    rente: r2((rek.rente_totaal || 0) - somRente),
  };
}

// Bestaande rekening (al eerder geïmporteerd) aanvullen met dividend/rente als daar nog niets staat
async function vulInkomstenAan(bestaand, rek, normFn) {
  if (bestaand.type === 'beleggen' && rek.type === 'beleggen') {
    const pos = await db.posities.where('rekeningId').equals(bestaand.id).toArray();
    const huidig = pos.reduce((t, p) => t + (p.dividend || 0) + (p.rente || 0), 0);
    const nieuwTotaal = Math.max(
      (rek.dividend_totaal || 0) + (rek.rente_totaal || 0),
      (rek.posities || []).reduce((t, p) => t + (p.dividend || 0) + (p.rente || 0), 0));
    if (huidig > 0.005 || nieuwTotaal <= 0.005) return false;

    // 1. dividend per positie, waar de naam overeenkomt
    for (const np of rek.posities || []) {
      if (!np.dividend) continue;
      const match = pos.find(p => normFn(p.naam) === normFn(np.naam));
      if (match) {
        match.dividend = np.dividend;
        await db.posities.update(match.id, { dividend: np.dividend });
      }
    }
    // 2. rest op aparte regel
    const rest = inkomstenRest(rek, pos);
    if (rest.dividend > 0.005 || rest.rente > 0.005) {
      await db.posities.add({
        id: genId(), rekeningId: bestaand.id, bankId: bestaand.bankId, year: bestaand.year,
        naam: INKOMSTEN_POSITIE_NAAM, type: 'overig', isin: '', ticker: '',
        jan1_waarde: 0, dec31_waarde: 0, jan1_aantal: 0, jan1_prijs: 0, dec31_aantal: 0, dec31_prijs: 0,
        aankopen: [], verkopen: [],
        dividend: Math.max(0, rest.dividend), rente: Math.max(0, rest.rente), kosten: 0, valuta: 'EUR',
      });
    }
    return true;
  }
  // Spaar/deposito/rekening-courant: rente en kosten invullen als ze nog leeg zijn
  const update = {};
  if (!(bestaand.ontvangen_rente > 0) && rek.ontvangen_rente > 0) update.ontvangen_rente = rek.ontvangen_rente;
  if (!(bestaand.kosten > 0) && rek.kosten > 0) update.kosten = rek.kosten;
  if (Object.keys(update).length === 0) return false;
  await db.rekeningen.update(bestaand.id, update);
  return true;
}

// Voeg een bank + rekeningen toe vanuit de importeer-pagina
export async function importeerBank(jaar, bankData, rekeningRows) {
  const norm = (t) => String(t || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const normNr = (t) => String(t || '').replace(/\s+/g, '').toLowerCase();

  // Fix130: bestaande bank (zelfde jaar + naam) hergebruiken i.p.v. dubbel aanmaken,
  // zodat banken met een jaaroverzicht per rekening gewoon kunnen worden aangevuld.
  const bankenInJaar = await db.banken.where('year').equals(String(jaar)).toArray();
  const bestaandeBank = bankenInJaar.find(b => norm(b.naam) === norm(bankData.naam));

  let bankId;
  if (bestaandeBank) {
    bankId = bestaandeBank.id;
  } else {
    bankId = genId();
    // Fix132: nieuwe bank alfabetisch tussen de bestaande banken plaatsen (bestaande volgorde blijft)
    const opVolgorde = [...bankenInJaar].sort((a, b) => (a.volgorde ?? 999) - (b.volgorde ?? 999));
    let invoegIdx = opVolgorde.findIndex(b => String(b.naam || '').localeCompare(String(bankData.naam || ''), 'nl', { sensitivity: 'base' }) > 0);
    if (invoegIdx === -1) invoegIdx = opVolgorde.length;
    opVolgorde.splice(invoegIdx, 0, { id: bankId, nieuw: true });
    for (let i = 0; i < opVolgorde.length; i++) {
      if (opVolgorde[i].nieuw) continue;
      if (opVolgorde[i].volgorde !== i) await db.banken.update(opVolgorde[i].id, { volgorde: i });
    }
    await db.banken.add({ id: bankId, year: String(jaar), volgorde: invoegIdx, naam: bankData.naam, ...bankData });
  }

  const bestaandeRek = await db.rekeningen.filter(r => r.bankId === bankId).toArray();
  const toegevoegd = [];
  const overgeslagen = [];
  const bijgewerkt = [];

  for (const rek of rekeningRows) {
    const naam = rek.weergave_naam || rek.naam;
    const nr = normNr(rek.rekeningnummer || rek.iban);

    // Dubbel = zelfde type en zelfde rekeningnummer, of (zonder nummer) zelfde type + naam
    // Saldo-rekeningen (sparen/deposito/rc/geld) onderling gelijk behandelen bij hetzelfde nummer
    const SALDO_TYPES = ['sparen', 'deposito', 'rekening-courant', 'geldrekening'];
    const zelfdeSoort = (r) => r.type === rek.type || (nr && SALDO_TYPES.includes(r.type) && SALDO_TYPES.includes(rek.type));
    let dubbele = bestaandeRek.find(r =>
      zelfdeSoort(r) && (
        nr && normNr(r.rekeningnummer)
          ? normNr(r.rekeningnummer) === nr
          : norm(r.naam) === norm(naam)));
    // Herstel: eerder met een verkeerd (gedeeld) rekeningnummer geïmporteerd? Herken aan identieke bedragen.
    if (!dubbele && nr && SALDO_TYPES.includes(rek.type)) {
      const zelfdeBedragen = bestaandeRek.find(r => SALDO_TYPES.includes(r.type) && normNr(r.rekeningnummer) !== nr
        && Math.abs((r.jan1_saldo || 0) - (rek.jan1_saldo || 0)) < 0.005
        && Math.abs((r.dec31_saldo || 0) - (rek.dec31_saldo || 0)) < 0.005
        && Math.abs((r.ontvangen_rente || 0) - (rek.ontvangen_rente || 0)) < 0.005);
      if (zelfdeBedragen) {
        await db.rekeningen.update(zelfdeBedragen.id, { rekeningnummer: rek.rekeningnummer || rek.iban });
        zelfdeBedragen.rekeningnummer = rek.rekeningnummer || rek.iban;
        bijgewerkt.push(naam || 'rekening');
        continue;
      }
    }
    if (dubbele) {
      if (rek.houders && !dubbele.houders) await db.rekeningen.update(dubbele.id, { houders: rek.houders });
      // Eerder geïmporteerd zonder dividend/rente? Dan alsnog aanvullen.
      if (await vulInkomstenAan(dubbele, rek, norm)) bijgewerkt.push(naam || 'rekening');
      else overgeslagen.push(naam || 'rekening');
      continue;
    }

    const rekId = genId();
    const rekCount = bestaandeRek.length;
    const nieuweRek = {
      id: rekId,
      bankId,
      year: String(jaar),
      volgorde: rekCount,
      naam,
      type: rek.type,
      rekeningnummer: rek.rekeningnummer || rek.iban || '',
      houders: rek.houders || '',
      kenmerk: rek.kenmerk || '',
      // Spaar/deposito velden direct op rekening
      jan1_saldo: rek.jan1_saldo || 0,
      dec31_saldo: rek.dec31_saldo || 0,
      ontvangen_rente: rek.ontvangen_rente || 0,
      rente_pct: rek.rente_pct || 0,
      kosten: rek.kosten || 0,
      notitie: rek.notitie || '',
      ...(rek.looptijd_maanden ? { looptijd_maanden: rek.looptijd_maanden } : {}),
      ...(rek.land ? { land: rek.land } : {}),
    };
    await db.rekeningen.add(nieuweRek);
    bestaandeRek.push(nieuweRek);
    toegevoegd.push(naam || 'rekening');

    // Posities (beleggen)
    if (rek.type === 'beleggen') {
      const positieLijst = [...(rek.posities || [])];
      if (positieLijst.length === 0 && (rek.jan1_waarde || rek.dec31_waarde)) {
        // Eén totaalpositie
        positieLijst.push({
          naam: rek.weergave_naam || 'Beleggingsrekening',
          type: 'fonds', isin: '',
          jan1_waarde: rek.jan1_waarde || 0,
          dec31_waarde: rek.dec31_waarde || 0,
          jan1_aantal: 0, jan1_prijs: 0,
          dec31_aantal: 0, dec31_prijs: 0,
          aankopen: rek.aankopen_totaal > 0
            ? [{ datum: `${jaar}-01-01`, aantal: 0, prijs: 0, totaal: rek.aankopen_totaal }] : [],
          verkopen: rek.verkopen_totaal > 0
            ? [{ datum: `${jaar}-12-31`, aantal: 0, prijs: 0, totaal: rek.verkopen_totaal }] : [],
          dividend: rek.dividend_totaal || 0,
          rente: 0, kosten: 0,
        });
      }
      // Dividend/rente dat niet per positie bekend is: aparte regel zodat het totaal klopt
      const rest = inkomstenRest(rek, positieLijst);
      if (rest.dividend > 0.005 || rest.rente > 0.005) {
        positieLijst.push({
          naam: INKOMSTEN_POSITIE_NAAM, type: 'overig',
          jan1_waarde: 0, dec31_waarde: 0,
          dividend: Math.max(0, rest.dividend), rente: Math.max(0, rest.rente),
        });
      }
      for (const pos of positieLijst) {
        await db.posities.add({
          id: genId(),
          rekeningId: rekId,
          bankId,
          year: String(jaar),
          naam: pos.naam,
          type: pos.type || 'fonds',
          isin: pos.isin || '',
          ticker: pos.ticker || '',
          jan1_waarde: pos.jan1_waarde || 0,
          dec31_waarde: pos.dec31_waarde || 0,
          jan1_aantal: pos.jan1_aantal || 0,
          jan1_prijs: pos.jan1_prijs || 0,
          dec31_aantal: pos.dec31_aantal || 0,
          dec31_prijs: pos.dec31_prijs || 0,
          aankopen: pos.aankopen || [],
          verkopen: pos.verkopen || [],
          dividend: pos.dividend || 0,
          rente: pos.rente || 0, kosten: pos.kosten || 0,
          // Valuta info (voor USD/GBP posities)
          valuta: pos.valuta || 'EUR',
          jan1_koers_lokaal: pos.jan1_koers_lokaal || 0,
          dec31_koers_lokaal: pos.dec31_koers_lokaal || 0,
        });
      }
    }
  }
  // Lege bank (alles dubbel en zelf aangemaakt) opruimen
  if (!bestaandeBank && toegevoegd.length === 0) await db.banken.delete(bankId);
  return { bankId, toegevoegd, overgeslagen, bijgewerkt };
}

// ============ STUBS VOOR BACKWARD COMPAT ============
// SpaarpaginaLijst is niet meer bereikbaar maar de file bestaat nog
export function useSpaargelden() {
  return { spaargelden: [], loading: false,
    voegSpaargeldToe: async () => {}, updateSpaargeld: async () => {},
    verwijderSpaargeld: async () => {} };
}
