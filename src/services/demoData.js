// Versie: Fix126
// Realistische (fictieve) voorbeelddata voor de demo-modus.
// Alle namen, rekeningnummers en bedragen zijn verzonnen.
// 2024 en 2025: de 31-dec-waarden van 2024 zijn de 1-jan-waarden van 2025.

import Dexie from 'dexie';
import db, { genId, setProfiel } from './localDb';
import { DB_NAAM_DEMO } from './modus';

// ---- helpers ----
const pos = (o) => ({
  type: 'fonds', isin: '', ticker: '', rente: 0, kosten: 0, dividend: 0,
  aankopen: [], verkopen: [], valuta: 'EUR',
  jan1_aantal: 0, jan1_prijs: 0, dec31_aantal: 0, dec31_prijs: 0,
  ...o,
});

function bouwJaar(jaar) {
  const j25 = jaar === 2025;

  const beleggingen = [
    pos({
      naam: 'Wereld Aandelen ETF', type: 'etf', isin: 'IE00DEMO0001', ticker: 'WRLD',
      jan1_waarde: j25 ? 52000 : 41000, dec31_waarde: j25 ? 56500 : 52000,
      jan1_aantal: j25 ? 400 : 340, jan1_prijs: j25 ? 130 : 120.59,
      dec31_aantal: j25 ? 422.2 : 400, dec31_prijs: j25 ? 133.82 : 130,
      aankopen: j25
        ? [
            { datum: '2025-03-03', aantal: 7.4, prijs: 135.14, totaal: 1000 },
            { datum: '2025-06-02', aantal: 7.4, prijs: 135.14, totaal: 1000 },
            { datum: '2025-09-01', aantal: 7.4, prijs: 135.14, totaal: 1000 },
          ]
        : [
            { datum: '2024-02-01', aantal: 25, prijs: 120, totaal: 3000 },
            { datum: '2024-08-01', aantal: 35, prijs: 85.7, totaal: 3000 },
          ],
      kosten: j25 ? 45 : 38,
    }),
    pos({
      naam: 'Europees Dividend Fonds', isin: 'NL00DEMO0002', ticker: 'EDIV',
      jan1_waarde: j25 ? 18500 : 16800, dec31_waarde: j25 ? 18900 : 18500,
      dividend: j25 ? 640 : 610,
    }),
    pos({
      naam: 'US Tech Inc. (USD)', type: 'aandeel', isin: 'US00DEMO0003', ticker: 'UTEC',
      jan1_waarde: j25 ? 9800 : 7200, dec31_waarde: j25 ? 9600 : 9800,
      dividend: j25 ? 55 : 40,
      valuta: 'USD',
      ...(j25
        ? {
            jan1_aantal: 50, jan1_prijs: 196, jan1_koers_lokaal: 203.49,
            dec31_aantal: 58, dec31_prijs: 165.52, dec31_koers_lokaal: 193.66,
            aankopen: [{ datum: '2025-05-12', aantal: 8, prijs: 187.5, totaal: 1500 }],
          }
        : {
            jan1_aantal: 50, jan1_prijs: 144, jan1_koers_lokaal: 157.1,
            dec31_aantal: 50, dec31_prijs: 196, dec31_koers_lokaal: 203.49,
          }),
    }),
    pos({
      naam: 'Nederlands Industrieel N.V.', type: 'aandeel', isin: 'NL00DEMO0004', ticker: 'NIND',
      jan1_waarde: j25 ? 6500 : 5800, dec31_waarde: j25 ? 0 : 6500,
      jan1_aantal: 100, jan1_prijs: j25 ? 65 : 58,
      dec31_aantal: j25 ? 0 : 100, dec31_prijs: j25 ? 0 : 65,
      dividend: j25 ? 180 : 170,
      verkopen: j25 ? [{ datum: '2025-09-15', aantal: 100, prijs: 69, totaal: 6900 }] : [],
    }),
  ];

  return [
    {
      naam: 'Voorbeeldbank',
      rekeningen: [
        {
          naam: 'Oranje Spaarrekening', type: 'sparen', rekeningnummer: 'NL00 DEMO 0123 4567 89',
          jan1_saldo: j25 ? 18000 : 21000, dec31_saldo: j25 ? 12450 : 18000,
          ontvangen_rente: j25 ? 300 : 520, rente_pct: j25 ? 1.8 : 2.4,
          uitbetaling_type: 'jaarlijks',
        },
        {
          naam: 'Termijndeposito 36 mnd', type: 'deposito', rekeningnummer: 'NL00 DEMO 0987 6543 21',
          jan1_saldo: j25 ? 20800 : 20000, dec31_saldo: j25 ? 21632 : 20800,
          ontvangen_rente: j25 ? 832 : 800, rente_pct: 4,
          deposito_startdatum: '2023-06-01', deposito_einddatum: '2026-06-01',
          uitbetaling_type: 'bijgeschreven', looptijd_maanden: 36,
        },
        {
          naam: 'Betaalrekening', type: 'rekening-courant', rekeningnummer: 'NL00 DEMO 0555 1212 34',
          jan1_saldo: j25 ? 4200 : 3800, dec31_saldo: j25 ? 5100 : 4200,
          ontvangen_rente: 0, rente_pct: 0,
        },
      ],
    },
    {
      naam: 'Demo Broker',
      rekeningen: [
        {
          naam: 'Beleggingsrekening', type: 'beleggen', rekeningnummer: 'DB-1000234',
          posities: beleggingen,
        },
      ],
    },
  ];
}

async function schrijfJaar(jaar) {
  const y = String(jaar);
  const banken = bouwJaar(jaar);
  for (let b = 0; b < banken.length; b++) {
    const bankId = genId();
    await db.banken.add({ id: bankId, year: y, volgorde: b, naam: banken[b].naam });
    for (let r = 0; r < banken[b].rekeningen.length; r++) {
      const { posities = [], ...rek } = banken[b].rekeningen[r];
      const rekId = genId();
      await db.rekeningen.add({
        kenmerk: '', notitie: '', kosten: 0,
        ...rek, id: rekId, bankId, year: y, volgorde: r,
      });
      for (const p of posities) {
        await db.posities.add({ ...p, id: genId(), rekeningId: rekId, bankId, year: y });
      }
    }
  }
}

// Idempotent: vult de demo-database alleen als die nog leeg is
export async function seedDemoData() {
  if ((await db.banken.count()) > 0) return;
  await setProfiel({ naam: 'Demo gebruiker' });
  await schrijfJaar(2024);
  await schrijfJaar(2025);
}

// Demo terugzetten naar de beginstand
export async function resetDemoData() {
  await db.transaction('rw', db.banken, db.rekeningen, db.posities, db.instellingen, async () => {
    await db.banken.clear();
    await db.rekeningen.clear();
    await db.posities.clear();
    await db.instellingen.clear();
  });
  await seedDemoData();
}

// Demo-database helemaal verwijderen (bij verlaten van demo)
export async function verwijderDemoDb() {
  db.close();
  await Dexie.delete(DB_NAAM_DEMO);
}
