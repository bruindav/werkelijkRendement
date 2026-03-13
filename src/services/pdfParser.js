// PDF Parser - volledig client-side met pdf.js
// Herkent: Centraal Beheer (sparen/deposito), Raisin, ABN AMRO
// Beleggingsoverzicht Centraal Beheer (meerdere jaren)

// ============ BEDRAG PARSER ============
function parseBedrag(s) {
  if (!s) return 0;
  const clean = String(s)
    .replace(/€/g, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim();
  return parseFloat(clean) || 0;
}

// ============ BANK DETECTIE ============
export function detectBankType(text) {
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
        rente_pct: 0,
        kosten: 0,
        notitie: '',
      });
    }
  }

  return { bank: 'Centraal Beheer', jaar, rekeningen, type: 'centraal_beheer' };
}

// ============ CENTRAAL BEHEER BELEGGEN (meerdere jaren) ============
function parseCBBeleggen(text) {
  const resultatenPerJaar = [];

  // Haal rekening nummer op
  const rekMatch = text.match(/Beleggingsrekening:\s*(\S+)/);
  const rekeningnummer = rekMatch ? rekMatch[1] : 'Beleggingsrekening';

  // Tabel regels: jaar + 5 bedragen
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

  return {
    bank: 'Centraal Beheer',
    type: 'cb_beleggen',
    meerdere_jaren: true,
    jaren: resultatenPerJaar,
  };
}

// ============ RAISIN ============
function parseRaisin(text) {
  const jaarMatch = text.match(/Jaaroverzicht (\d{4})/i);
  const jaar = jaarMatch ? parseInt(jaarMatch[1]) : null;
  const rekeningen = [];

  // Groepeer per partnerbank (voor de bank-structuur in de app)
  const bankGroepen = {};

  const pattern = /KENMERK:\s*(\S+)\s+EUR\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+[\d.,]+\s+[\d.,]+\s+[\d.,]+\nLAND:\s*(.+?)\nIBAN:\s*(\S+)\nBANK:\s*(.+?)\nOMSCHRIJVING:\s*(.+?)(?=\nKENMERK:|Saldomededeling|Over dit Financieel|$)/gms;

  for (const m of text.matchAll(pattern)) {
    const [, kenmerk, saldo_jan, saldo_dec, rente_bruto, land, iban, bank, omschrijving] = m;
    const omschr = omschrijving.trim().replace(/\n.*/s, '').trim();

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

    // Groepeer per partnerbank
    if (!bankGroepen[bankNaam]) bankGroepen[bankNaam] = [];
    bankGroepen[bankNaam].push(rec);
    rekeningen.push(rec);
  }

  return {
    bank: 'Raisin',
    jaar,
    rekeningen,
    bankGroepen, // voor groepering in de preview
    type: 'raisin',
  };
}

// ============ ABN AMRO ============
function parseAbnAmro(text) {
  const jaarMatch = text.match(/Jaaroverzicht (\d{4})/i);
  const jaar = jaarMatch ? parseInt(jaarMatch[1]) : null;
  const rekeningen = [];

  // Zoek IBAN regels met saldo's
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
      type: 'sparen',
      iban,
      jan1_saldo: parseBedrag(saldo1),
      dec31_saldo: parseBedrag(saldo2),
      ontvangen_rente: 0,
      rente_pct: 0,
      kosten: 0,
      notitie: '',
    });
  }

  return { bank: 'ABN AMRO', jaar, rekeningen, type: 'abn_amro' };
}

// ============ HOOFD PARSE FUNCTIE ============
export function parseerPDF(text) {
  const type = detectBankType(text);

  switch (type) {
    case 'centraal_beheer': return parseCentraalBeheer(text);
    case 'cb_beleggen':     return parseCBBeleggen(text);
    case 'raisin':          return parseRaisin(text);
    case 'abn_amro':        return parseAbnAmro(text);
    default:
      return { bank: 'Onbekend', jaar: null, rekeningen: [], type: 'onbekend',
               fout: 'Bank niet herkend. Ondersteund: Centraal Beheer, Raisin, ABN AMRO.' };
  }
}
