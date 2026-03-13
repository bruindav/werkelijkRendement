// PDF Parser - volledig client-side met pdf.js
// Herkent: Centraal Beheer (sparen/deposito), Raisin, ABN AMRO, Evi (Van Lanschot)

// ============ BEDRAG PARSER ============
function parseBedrag(s) {
  if (!s) return 0;
  const clean = String(s)
    .replace(/€/g, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.').trim();
  return parseFloat(clean) || 0;
}

function maakLeesbaar(naam) {
  let s = naam.replace(/([a-z])([A-Z])/g, '$1 $2');
  s = s.replace(/([A-Z]{2,})([A-Z][a-z])/g, '$1 $2');
  s = s.replace(/-/g, ' - ').replace(/  +/g, ' ').trim();
  return s;
}

// ============ BANK DETECTIE ============
export function detectBankType(text) {
  if (text.includes('Evi') && text.includes('Van Lanschot')) return 'evi';
  if (text.includes('Fiscaal jaaroverzicht') && text.includes('Vermogen per')) return 'evi';
  if (text.includes('Centraal Beheer') || text.includes('RentePlús') || text.includes('RenteVast')) {
    if (text.includes('Beleggingsrekening') && text.includes('Waarde 1 januari')) return 'cb_beleggen';
    return 'centraal_beheer';
  }
  if (text.toLowerCase().includes('raisin')) return 'raisin';
  if (text.includes('ABN AMRO')) return 'abn_amro';
  return 'onbekend';
}

// ============ CENTRAAL BEHEER SPAREN ============
function parseCentraalBeheer(text) {
  const jaarMatch = text.match(/jaaroverzicht (\d{4})/i);
  const jaar = jaarMatch ? parseInt(jaarMatch[1]) : null;
  const rekeningen = [];

  const blokken = text.split(/Je jaaroverzicht \d{4}\n/);
  for (const blok of blokken.slice(1)) {
    const lines = blok.trim().split('\n');
    const naam = lines[0]?.trim();
    if (!naam || naam.length < 3) continue;
    const rekMatch = blok.match(/Rekeningnummer:\s*(.+)/);
    const rekeningnummer = rekMatch ? rekMatch[1].trim() : '';
    const saldi = [...blok.matchAll(/Saldo 01-01-\d{4}\s*€\s*([\d.,]+)/g)].map(m => parseBedrag(m[1]));
    const renteMatch = blok.match(/Totaal ontvangen rente in \d{4}\s*€\s*([\d.,]+)/);
    if (saldi.length >= 1 && renteMatch) {
      rekeningen.push({
        naam: naam + (rekeningnummer ? ` (${rekeningnummer})` : ''),
        weergave_naam: naam,
        type: naam.includes('Vast') ? 'deposito' : 'sparen',
        rekeningnummer,
        jan1_saldo: saldi[0] || 0,
        dec31_saldo: saldi[1] || saldi[0] || 0,
        ontvangen_rente: parseBedrag(renteMatch[1]),
        rente_pct: 0, kosten: 0, notitie: '',
      });
    }
  }
  return { bank: 'Centraal Beheer', jaar, rekeningen, type: 'centraal_beheer' };
}

// ============ CENTRAAL BEHEER BELEGGEN ============
function parseCBBeleggen(text) {
  const rekMatch = text.match(/Beleggingsrekening:\s*(\S+)/);
  const rekeningnummer = rekMatch ? rekMatch[1] : 'Beleggingsrekening';
  const resultatenPerJaar = [];
  const regelPattern = /^(\d{4})\s+€\s*([\d.,]+)\s+€\s*([\d.,]+)\s+€\s*([\d.,]+)\s+€\s*([\d.,]+)\s+€\s*([\d.,]+)/gm;
  for (const m of text.matchAll(regelPattern)) {
    const [, jaar, waarde_jan, waarde_dec, aankopen, verkopen, dividend] = m;
    resultatenPerJaar.push({
      jaar: parseInt(jaar),
      rekening: {
        naam: `Beleggingsrekening (${rekeningnummer})`,
        weergave_naam: 'Beleggingsrekening',
        type: 'beleggen',
        rekeningnummer,
        jan1_waarde: parseBedrag(waarde_jan),
        dec31_waarde: parseBedrag(waarde_dec),
        aankopen_totaal: parseBedrag(aankopen),
        verkopen_totaal: parseBedrag(verkopen),
        dividend_totaal: parseBedrag(dividend),
      }
    });
  }
  return { bank: 'Centraal Beheer', type: 'cb_beleggen', meerdere_jaren: true, jaren: resultatenPerJaar };
}

// ============ RAISIN ============
function parseRaisin(text) {
  const jaarMatch = text.match(/Jaaroverzicht (\d{4})/i);
  const jaar = jaarMatch ? parseInt(jaarMatch[1]) : null;
  const rekeningen = [];
  const bankGroepen = {};

  // Na Y-grouping staat elke rij op één lijn:
  // "KENMERK: FDA_121_929_128_236 EUR 0,00 5.000,00 0,00 0,00 0,00 0,00"
  // "LAND: Duitsland"
  // "IBAN: DE02503302002355109006"
  // "BANK: Aareal Bank"
  // "OMSCHRIJVING: DEPOSITO 84 MAANDEN 3.00%"
  const pattern = /KENMERK:\s*(\S+)\s+EUR\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+[\d.,]+\s+[\d.,]+\s+[\d.,]+[\s\S]*?LAND:\s*(.+?)\n[\s\S]*?IBAN:\s*(\S+)\n[\s\S]*?BANK:\s*(.+?)\n[\s\S]*?OMSCHRIJVING:\s*(.+?)(?=\nKENMERK:|\nSaldomededeling|$)/gm;

  for (const m of text.matchAll(pattern)) {
    const [, kenmerk, saldo_jan, saldo_dec, rente_bruto, land, iban, bank, omschrijving] = m;
    const omschr = omschrijving.trim().split('\n')[0].trim();
    const renteMatch = omschr.match(/(\d+[.,]\d+)%/);
    const maandenMatch = omschr.match(/(\d+)\s*MAANDEN/i);
    const isDeposito = omschr.toUpperCase().includes('DEPOSITO');
    const bankNaam = bank.trim();

    const rec = {
      naam: `${bankNaam} - ${omschr}`,
      weergave_naam: omschr,
      type: isDeposito ? 'deposito' : 'sparen',
      bank_naam: bankNaam,
      land: land.trim(),
      iban: iban.trim(),
      kenmerk: kenmerk.trim(),
      rente_pct: renteMatch ? parseFloat(renteMatch[1].replace(',', '.')) : 0,
      looptijd_maanden: maandenMatch ? parseInt(maandenMatch[1]) : null,
      jan1_saldo: parseBedrag(saldo_jan),
      dec31_saldo: parseBedrag(saldo_dec),
      ontvangen_rente: parseBedrag(rente_bruto),
      kosten: 0,
      notitie: `${land.trim()} - ${iban.trim()}`,
    };

    if (!bankGroepen[bankNaam]) bankGroepen[bankNaam] = [];
    bankGroepen[bankNaam].push(rec);
    rekeningen.push(rec);
  }

  return { bank: 'Raisin', jaar, rekeningen, bankGroepen, type: 'raisin' };
}

// ============ ABN AMRO ============
function parseAbnAmro(text) {
  const jaarMatch = text.match(/Jaaroverzicht (\d{4})/i);
  const jaar = jaarMatch ? parseInt(jaarMatch[1]) : null;
  const rekeningen = [];
  const ibanPattern = /(NL\d{2}\s+[A-Z]{4}\s+[\d\s]+)\n(.+?)\n\s*([\d.,]+)\s+([\d.,]+)/gm;
  for (const m of text.matchAll(ibanPattern)) {
    const [, iban_raw, naam, saldo1, saldo2] = m;
    const iban = iban_raw.replace(/\s/g, '');
    if (!iban.startsWith('NL')) continue;
    const naamClean = naam.trim();
    if (naamClean.length < 2) continue;
    rekeningen.push({
      naam: `${naamClean} (${iban})`,
      weergave_naam: naamClean,
      type: 'sparen', iban,
      jan1_saldo: parseBedrag(saldo1),
      dec31_saldo: parseBedrag(saldo2),
      ontvangen_rente: 0, rente_pct: 0, kosten: 0, notitie: '',
    });
  }
  return { bank: 'ABN AMRO', jaar, rekeningen, type: 'abn_amro' };
}

// ============ EVI (VAN LANSCHOT) - tekst-gebaseerd na Y-grouping ============
function parseEviTekst(text) {
  // Na Y-grouping ziet de tekst er zo uit:
  // "Vermogen per 01-01-2025"
  // "Fonds Waarde"
  // "RobecoGlobalStarsEquitiesFund-EURG €1.349,57"
  // ...
  // "Vermogen per 31-12-2025"
  // ...

  const jaarMatch = text.match(/jaaroverzicht.*?(\d{4})/i)
    || text.match(/jaar\s+(\d{4})/i)
    || text.match(/(\d{4})/);
  const jaar = jaarMatch ? parseInt(jaarMatch[1]) : null;

  // Rekeningnummer: staat op eigen rij na "Rekeningnummer"
  const rekMatch = text.match(/Rekeningnummer\s+(\d{6,})/i);
  const rekeningnummer = rekMatch ? rekMatch[1] : '';

  const fondsenJan = {};
  const fondsenDec = {};
  const dividendenBruto = {};

  // Split in secties
  const janMatch = text.match(/Vermogen per 01-01-\d{4}([\s\S]+?)Vermogen per 31-12-/);
  const decMatch = text.match(/Vermogen per 31-12-\d{4}([\s\S]+?)(?:Ontvangen rente|$)/);
  const divMatch = text.match(/Dividend binnenland([\s\S]+?)Dividend buitenland/);

  const parseSecieFondsen = (blok, target) => {
    if (!blok) return;
    for (const line of blok.split('\n')) {
      // Patroon: "FondsNaamAaneengeplakt €1.234,56"
      const m = line.match(/^([A-Z][A-Za-z0-9\-]+)\s+€([\d.,]+)$/);
      if (m) {
        const naam = m[1].trim();
        const skip = new Set(['Totaalbeleggingen', 'Totaal', 'Spaartegoed', 'Fonds']);
        if (!skip.has(naam)) {
          target[naam] = parseBedrag(m[2]);
        }
      }
    }
  };

  parseSecieFondsen(janMatch?.[1], fondsenJan);
  parseSecieFondsen(decMatch?.[1], fondsenDec);

  // Dividenden: "FondsNaam €17,36 €2,60 €14,76"
  if (divMatch) {
    for (const line of divMatch[1].split('\n')) {
      const m = line.match(/^([A-Z][A-Za-z0-9\-]+)\s+€([\d.,]+)\s+€([\d.,]+)\s+€([\d.,]+)/);
      if (m && m[1] !== 'Totaal') {
        dividendenBruto[m[1]] = parseBedrag(m[2]); // bruto dividend
      }
    }
  }

  // Bouw posities
  const alleNamen = new Set([...Object.keys(fondsenJan), ...Object.keys(fondsenDec)]);
  const skip = new Set(['Fonds', 'Waarde', 'Totaalbeleggingen', 'Totaal', 'Spaartegoed']);
  const posities = [];

  for (const naam of [...alleNamen].sort()) {
    if (skip.has(naam)) continue;
    // Dividend matchen via prefix
    let div = 0;
    for (const [dn, dv] of Object.entries(dividendenBruto)) {
      if (naam.startsWith(dn.substring(0, 20)) || dn.startsWith(naam.substring(0, 20))) {
        div = dv; break;
      }
    }
    posities.push({
      naam: maakLeesbaar(naam),
      naam_raw: naam,
      type: 'fonds',
      jan1_waarde: fondsenJan[naam] || 0,
      dec31_waarde: fondsenDec[naam] || 0,
      dividend: div,
    });
  }

  return {
    bank: 'Evi (Van Lanschot)',
    type: 'evi',
    jaar,
    rekeningen: [{
      naam: `Beleggingsrekening (${rekeningnummer})`,
      weergave_naam: 'Beleggingsrekening',
      type: 'beleggen',
      rekeningnummer,
      posities,
    }]
  };
}

// ============ HOOFD PARSE FUNCTIE ============
export function parseerPDF(text) {
  const type = detectBankType(text);
  switch (type) {
    case 'centraal_beheer': return parseCentraalBeheer(text);
    case 'cb_beleggen':     return parseCBBeleggen(text);
    case 'raisin':          return parseRaisin(text);
    case 'abn_amro':        return parseAbnAmro(text);
    case 'evi':             return parseEviTekst(text);
    default:
      return { bank: 'Onbekend', jaar: null, rekeningen: [], type: 'onbekend',
               fout: 'Bank niet herkend. Ondersteund: Centraal Beheer, Raisin, ABN AMRO, Evi.' };
  }
}

// Evi heeft geen aparte async parser meer nodig - werkt via parseerPDF
export async function parseEviPDF(file) {
  // Fallback: niet meer nodig, maar exporteren voor backwards compat
  return null;
}
