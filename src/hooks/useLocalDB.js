// Lokale database hooks — vervangt useFirestore.js 
// Dezelfde API als useFirestore zodat alle pagina's ongewijzigd blijven
// Data staat in IndexedDB (lokaal in de browser)

import { useState, useEffect, useCallback } from 'react';
import db, { genId, getBanken, getRekeningen, getPosities } from '../services/localDb';

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

  return { banken, loading, voegBankToe, updateBank, verwijderBank, slaVolgorde };
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
      if (rek.type === 'beleggen' || !rek.type) {
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
// Voeg een bank + rekeningen toe vanuit de importeer-pagina
export async function importeerBank(jaar, bankData, rekeningRows) {
  const bankId = genId();
  const count = await db.banken.where('year').equals(String(jaar)).count();
  await db.banken.add({ id: bankId, year: String(jaar), volgorde: count, naam: bankData.naam, ...bankData });

  for (const rek of rekeningRows) {
    const rekId = genId();
    const rekCount = await db.rekeningen.filter(r => r.bankId === bankId).count();
    await db.rekeningen.add({
      id: rekId,
      bankId,
      year: String(jaar),
      volgorde: rekCount,
      naam: rek.weergave_naam || rek.naam,
      type: rek.type,
      rekeningnummer: rek.rekeningnummer || rek.iban || '',
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
    });

    // Posities (beleggen)
    if (rek.type === 'beleggen') {
      const positieLijst = rek.posities || [];
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
          rente: 0, kosten: 0,
        });
      }
    }
  }
  return bankId;
}

// ============ STUBS VOOR BACKWARD COMPAT ============
// SpaarpaginaLijst is niet meer bereikbaar maar de file bestaat nog
export function useSpaargelden() {
  return { spaargelden: [], loading: false,
    voegSpaargeldToe: async () => {}, updateSpaargeld: async () => {},
    verwijderSpaargeld: async () => {} };
}
