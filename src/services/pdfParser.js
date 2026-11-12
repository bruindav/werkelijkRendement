// Versie: Fix144
// PDF Parser - volledig client-side met pdf.js
// Herkent: Centraal Beheer (sparen/deposito), Raisin, ABN AMRO, Evi (Van Lanschot)
// Fix101 - ABN AMRO parser herschreven voor nieuw PDF-formaat 2025

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
  if (text.includes('Meewind') || text.includes('Zeewind') || text.includes('MW0')) return 'meewind';
  if (text.includes('Beleggingsrekening') && text.includes('Centraal Beheer') && text.includes('totaal beleggingen')) return 'cb_beleggen_nieuw';
  if (text.includes('DEGIRO') && text.includes('Portefeuilleoverzicht')) return 'degiro';
  if (text.includes('Collin Crowdfund') || text.includes('JAAROPGAVE') && text.includes('Portefeuillewaarde')) return 'collin';
  if (text.includes('Evi') && text.includes('Van Lanschot')) return 'evi';
  if (text.includes('Fiscaal jaaroverzicht') && text.includes('Vermogen per')) return 'evi';
  if (text.includes('Centraal Beheer') || text.includes('RentePlús') || text.includes('RenteVast')) {
    if (text.includes('Beleggingsrekening') && text.includes('Waarde 1 januari')) return 'cb_beleggen';
    return 'centraal_beheer';
  }
  if (/ING Bank N\.V\./.test(text) && /ING (Betaalrekening|Oranje Spaarrekening|Spaarrekening|Deposito|Bonus)/i.test(text)) return 'ing';
  if (text.toLowerCase().includes('raisin')) return 'raisin';
  if (text.includes('ABN AMRO')) return 'abn_amro';
  return 'onbekend';
}

// ============ CENTRAAL BEHEER SPAREN ============
function parseCentraalBeheer(text) {
  const jaarMatch = text.match(/jaaroverzicht (\d{4})/i);
  const jaar = jaarMatch ? parseInt(jaarMatch[1]) : null;
  const rekeningen = [];

  const blokken = text.split(/Je jaaroverzicht \d{4}\s*\n?/);
  for (const blok of blokken.slice(1)) {
    const lines = blok.trim().split('\n');
    const naam = lines[0]?.trim();
    if (!naam || naam.length < 3) continue;
    const rekMatch = blok.match(/Rekeningnummer:\s*([A-Z0-9][A-Z0-9 ]*?)\s*(?:\n|Op naam|$)/);
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

// ============ ING ============
// Jaaroverzicht: per product een blok "ING <Product>: <nummer> <naam>", gevolgd door
// "Saldo op 01-01-2025 x", "Saldo op 31-12-2025 y" en (sparen) "Rente, ontvangen in 2025 z".
function parseIng(text) {
  const jaarMatch = text.match(/Jaaroverzicht (\d{4})/i);
  const jaar = jaarMatch ? parseInt(jaarMatch[1]) : null;
  const rekeningen = [];
  const hMatch = text.match(/\n\s*(?:Mw|Mevr|Mevrouw|Dhr|De heer|Hr)\.?\s+([A-Z][^\n]{2,60}?)\s*\n/);
  const houders = hMatch ? hMatch[1].replace(/^([A-Z])\s+/, '$1. ').trim() : '';

  const blokken = text.split(/^\s*ING\s+(?=[A-Za-zÀ-ÿ ]+:)/m).slice(1);
  for (const blok of blokken) {
    const kop = blok.split('\n')[0];
    const [productRaw, rest = ''] = [kop.slice(0, kop.indexOf(':')).trim(), kop.slice(kop.indexOf(':') + 1).trim()];
    const nrMatch = rest.match(/^(NL\d{2}\s?[A-Z]{4}(?:\s?\d{4}){2}\s?\d{2}|[A-Z]?\s?\d[\d\- ]*\d)/);
    const rekeningnummer = nrMatch ? nrMatch[1].trim() : '';
    const p = productRaw.toLowerCase();
    const jan = blok.match(/Saldo op 01-01-\d{4}\s+(-?[\d.,]+)/);
    const dec = blok.match(/Saldo op 31-12-\d{4}\s+(-?[\d.,]+)/);
    const rente = blok.match(/Rente,? ontvangen in \d{4}\s+(-?[\d.,]+)/);
    if (!jan && !dec) continue;
    const type = p.includes('betaal') ? 'rekening-courant' : p.includes('deposito') ? 'deposito' : 'sparen';
    rekeningen.push({
      naam: `ING ${productRaw}${rekeningnummer ? ` (${rekeningnummer})` : ''}`,
      weergave_naam: `ING ${productRaw}`,
      type, rekeningnummer,
      jan1_saldo: jan ? parseBedrag(jan[1]) : 0,
      dec31_saldo: dec ? parseBedrag(dec[1]) : 0,
      ontvangen_rente: rente ? parseBedrag(rente[1]) : 0,
      rente_pct: 0, kosten: 0, notitie: '',
    });
  }
  return { bank: 'ING', jaar, rekeningen, type: 'ing', houders };
}

// ============ ABN AMRO ============
function parseAbnAmro(text) {
  const jaarMatch = text.match(/Jaaroverzicht (\d{4})/i);
  const jaar = jaarMatch ? parseInt(jaarMatch[1]) : null;
  const rekeningen = [];

  // Na Y-grouping staat het formaat:
  // "NL43 ABNA 0476 7127 85"  ← IBAN op eigen regel
  // "354,30 1.361,15"          ← bedragen op volgende regel
  // "Priverekening"            ← naam daarna
  // Ook creditcard: nummer → bedragen → naam
  const lines = text.split('\n');
  const ibanPat = /^(NL\d{2}[\s]*[A-Z]{4}[\d\s]+|\d{8,})$/;
  const bedragPat = /^-?[\d.,]+(?:\s+-?[\d.,]+)+$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!ibanPat.test(line)) continue;

    const iban = line.replace(/\s/g, '');
    let bedragen = [], naam = '';

    // Fix138: alleen kijken tot de VOLGENDE rekening begint, en de eerste bedragenregel nemen.
    // (Eerder werd doorgelezen tot in de volgende rekening, waardoor twee rekeningen dezelfde bedragen kregen.)
    for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
      const volgende = lines[j].trim();
      if (ibanPat.test(volgende)) break;
      if (bedragPat.test(volgende)) {
        if (bedragen.length) continue;
        bedragen = volgende.split(/\s+/).map(s => {
          const neg = s.startsWith('-');
          const v = parseFloat(s.replace('-','').replace(/\./g,'').replace(',','.')) || 0;
          return neg ? -v : v;
        });
      } else if (volgende && volgende.length > 1 && !naam) {
        naam = volgende;
      }
    }

    if (!bedragen.length) continue;

    // Sla header-regels over
    const skipNamen = new Set(['Saldo', 'Betalen', 'sparen', 'Ontvangen', 'rente']);
    if (skipNamen.has(naam)) continue;

    rekeningen.push({
      naam: naam ? `${naam} (${iban})` : iban,
      weergave_naam: naam || iban,
      type: /priv[eé]rekening|betaalrekening|zakelijk|creditcard/i.test(naam) ? 'rekening-courant' : 'sparen',
      iban,
      rekeningnummer: iban,
      jan1_saldo: bedragen[0] || 0,
      dec31_saldo: bedragen[1] || 0,
      ontvangen_rente: bedragen[2] || 0,
      rente_pct: 0, kosten: 0, notitie: '',
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
  const divBinnen = text.match(/Dividend binnenland([\s\S]+?)Dividend buitenland/);
  const divBuiten = text.match(/Dividend buitenland([\s\S]+?)(?:Het spaartegoed|De jaaropgave|$)/);
  const divBlokken = [divBinnen?.[1], divBuiten?.[1]].filter(Boolean);
  // Bruto dividend totalen (binnen + buiten) — vangt ook dividend op dat niet aan een fonds te koppelen is
  const totaalBruto = (blok) => parseBedrag(blok?.match(/Totaal\s+€\s*([\d.,]+)/)?.[1] || '0');
  const dividendTotaal = totaalBruto(divBinnen?.[1]) + totaalBruto(divBuiten?.[1]);

  const parseSecieFondsen = (blok, target) => {
    if (!blok) return;
    for (const line of blok.split('\n')) {
      // Patroon: naam (met of zonder spaties) gevolgd door €bedrag
      // Werkt voor zowel "Robeco Global Stars F EUR € 1.349,57" als "RobecoONENeutraal €8.336,31"
      const m = line.match(/^([A-Z][A-Za-z0-9 \-]+?)\s+€\s*([\d.,]+)$/);
      if (m) {
        const naam = m[1].trim();
        const skip = new Set(['Totaalbeleggingen', 'Totaal beleggingen', 'Totaal', 'Spaartegoed', 'Fonds', 'Waarde']);
        if (!skip.has(naam) && !naam.toLowerCase().startsWith('totaal')) {
          // maakLeesbaar: alleen nodig als naam aaneengeplakt is (geen spaties)
          const leesbaar = naam.includes(' ') ? naam : maakLeesbaar(naam);
          target[leesbaar] = parseBedrag(m[2]);
        }
      }
    }
  };

  parseSecieFondsen(janMatch?.[1], fondsenJan);
  parseSecieFondsen(decMatch?.[1], fondsenDec);

  // Dividenden: "FondsNaam €17,36 €2,60 €14,76" (naam kan spaties bevatten)
  for (const blok of divBlokken) {
    for (const line of blok.split('\n')) {
      const m = line.match(/^([A-Z][A-Za-z0-9 \-]+?)\s+€\s*([\d.,]+)\s+€\s*([\d.,]+)\s+€\s*([\d.,]+)/);
      if (m) {
        const naam = m[1].trim();
        if (naam !== 'Totaal' && naam !== 'Bruto dividend') {
          const leesbaar = naam.includes(' ') ? naam : maakLeesbaar(naam);
          dividendenBruto[leesbaar] = (dividendenBruto[leesbaar] || 0) + parseBedrag(m[2]);
        }
      }
    }
  }

  // Spaartegoed (cash op de Evi-rekening) en ontvangen rente op sparen
  const spaarJan = parseBedrag(janMatch?.[1]?.match(/Spaartegoed\s+€\s*([\d.,]+)/)?.[1] || '0');
  const spaarDec = parseBedrag(text.match(/Vermogen per 31-12-\d{4}[\s\S]*?Spaartegoed\s+€\s*([\d.,]+)/)?.[1] || '0');
  const renteSparen = parseBedrag(text.match(/Ontvangen rente dit jaar\s+Sparen\s+€\s*([\d.,]+)/)?.[1] || '0');

  // Bouw posities
  const alleNamen = new Set([...Object.keys(fondsenJan), ...Object.keys(fondsenDec)]);
  const skip = new Set(['Fonds', 'Waarde', 'Totaalbeleggingen', 'Totaal', 'Spaartegoed']);
  const posities = [];

  for (const naam of [...alleNamen].sort()) {
    if (skip.has(naam)) continue;
    // Dividend koppelen (exact match of prefix-match van 20 chars)
    let div = 0;
    for (const [dn, dv] of Object.entries(dividendenBruto)) {
      const n1 = naam.substring(0, 25).toLowerCase();
      const n2 = dn.substring(0, 25).toLowerCase();
      if (n1 === n2 || naam === dn || n1.startsWith(n2.substring(0,15)) || n2.startsWith(n1.substring(0,15))) {
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

  const rekeningen = [{
    naam: `Beleggingsrekening (${rekeningnummer})`,
    weergave_naam: 'Beleggingsrekening',
    type: 'beleggen',
    rekeningnummer,
    dividend_totaal: dividendTotaal,
    posities,
  }];

  // Spaartegoed + rente als aparte spaarrekening (hoort bij het vermogen in het jaaroverzicht)
  if (spaarJan > 0 || spaarDec > 0 || renteSparen > 0) {
    rekeningen.push({
      naam: `Spaartegoed (${rekeningnummer})`,
      weergave_naam: 'Spaartegoed',
      type: 'sparen',
      rekeningnummer,
      jan1_saldo: spaarJan,
      dec31_saldo: spaarDec,
      ontvangen_rente: renteSparen,
      rente_pct: 0, kosten: 0,
      notitie: 'Evi spaartegoed',
    });
  }

  return {
    bank: 'Evi (Van Lanschot)',
    type: 'evi',
    jaar,
    rekeningen,
  };
}

// ============ HOOFD PARSE FUNCTIE ============
// Fix135: rekeninghouder(s) uit het jaaroverzicht halen (voor eigenaar: ik / partner / samen)
const NAAM = String.raw`(?:[A-Z]\.){1,5}\s?(?:(?:de|van|der|den|ten|ter|het|'t)\s)*[A-Z][A-Za-z'\-]+|[A-Z][a-z]+(?:\s[A-Z][a-z]+)*(?:\s(?:de|van|der|den|ten|ter|het))*\s[A-Z][A-Za-z'\-]+`;
export function vindHouders(text) {
  const t = String(text || '');
  // ABN AMRO: "De heer D.R. de Bruin en/of de heer E.A. Vrijvogel"
  const enOf = t.match(new RegExp(String.raw`(?:De heer|Mevrouw|Dhr\.|Mevr\.)\s+(${NAAM})\s+en\/of[\s\S]{0,80}?(?:heer|mevrouw)\s+(${NAAM})`));
  if (enOf) return `${enOf[1].trim()}, ${enOf[2].trim()}`;
  const lijst = t.match(new RegExp(String.raw`Rekeninghouder\(s\)\s+((?:${NAAM})(?:\s*[,&]\s*(?:${NAAM}))*)`));
  if (lijst) return lijst[1].trim();
  const opNaam = t.match(new RegExp(String.raw`Op naam van:\s*(?:de heer|mevrouw|mevr\.|dhr\.)?\s*(${NAAM})`, 'i'));
  if (opNaam) return opNaam[1].trim();
  const aanhef = t.match(new RegExp(String.raw`(?:Dhr\.|Mevr\.|Mw\.|De heer|Mevrouw)\s+(${NAAM})`));
  if (aanhef) return aanhef[1].trim();
  const naamVeld = t.match(new RegExp(String.raw`Naam:\s*(${NAAM})`));
  if (naamVeld) return naamVeld[1].trim();
  return '';
}

export function parseerPDF(text) {
  const resultaat = parseerPDFBasis(text);
  const houders = resultaat?.houders || vindHouders(text);
  if (houders && resultaat) {
    const zet = (rs) => (rs || []).forEach(r => { r.houders = houders; });
    zet(resultaat.rekeningen);
    (resultaat.jaren || []).forEach(j => zet(j.rekeningen));
    resultaat.houders = houders;
  }
  return resultaat;
}

function parseerPDFBasis(text) {
  const type = detectBankType(text);
  switch (type) {
    case 'centraal_beheer': return parseCentraalBeheer(text);
    case 'cb_beleggen':     return parseCBBeleggen(text);
    case 'ing':             return parseIng(text);
    case 'raisin':          return parseRaisin(text);
    case 'abn_amro':        return parseAbnAmro(text);
    case 'evi':             return parseEviTekst(text);
    case 'degiro':          return parseDegiro(text);
    case 'collin':          return parseCollin(text);
    case 'meewind':         return parseMeewind(text);
    case 'cb_beleggen_nieuw': return parseCBBeleggenNieuw(text);
    default:
      return { bank: 'Onbekend', jaar: null, rekeningen: [], type: 'onbekend',
               fout: 'Bank niet herkend. Ondersteund: Centraal Beheer, ING, Raisin, ABN AMRO, Evi, DEGIRO, Collin, Meewind.' };
  }
}

// Evi heeft geen aparte async parser meer nodig - werkt via parseerPDF
export async function parseEviPDF(file) {
  // Fallback: niet meer nodig, maar exporteren voor backwards compat
  return null;
}

// ============ DEGIRO ============
// Fix106 - DEGIRO: Flatex Geldrekening als aparte rekening-courant
// Fix109 - DEGIRO: USD/GBP koers opslaan als EUR-equivalent, valuta bewaren
function parseDegiro(text) {
  const jaarMatch = text.match(/jaaroverzicht (\d{4})/i);
  const jaar = jaarMatch ? parseInt(jaarMatch[1]) : null;
  const accountMatch = text.match(/Account:\s*(\S+)/);
  const account = accountMatch ? accountMatch[1] : '';

  // Dividend totaal bruto
  // Fix131: dividend en couponrente uit hun eigen sectie lezen (niet de eerste 'Totaal' in het document)
  const divSectie = text.match(/Dividend in EUR([\s\S]*?)(?:Ontvangen couponrente|Overige rente|$)/)?.[1] || '';
  const divMatch = divSectie.match(/Totaal\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)/)
    || text.match(/Totaal\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)/);
  const divBruto = divMatch ? parseBedrag(divMatch[1]) : 0;

  const couponSectie = text.match(/Ontvangen couponrente in EUR([\s\S]*?)(?:Overige rente|$)/)?.[1] || '';
  const couponMatch = couponSectie.match(/Totaal\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)/);
  const couponBruto = couponMatch ? parseBedrag(couponMatch[1]) : 0;

  // Rente op de Flatex geldrekening (betaald = kosten, ontvangen = rente)
  const flatexBetaald = parseBedrag(text.match(/Totaal betaalde rente\s+(-?[\d.,]+)/)?.[1] || '0');
  const flatexOntvangen = parseBedrag(text.match(/Totaal ontvangen rente\s+(-?[\d.,]+)/)?.[1] || '0');

  function parseBlok(label, eindLabel) {
    const pat = new RegExp(
      label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
      '([\\s\\S]+?)' +
      (eindLabel ? eindLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : 'Totale portefeuille\\s?waarde'),
      ''
    );
    const blokMatch = text.match(pat);
    if (!blokMatch) return [];

    const posities = [];
    for (const line of blokMatch[1].split('\n')) {
      const l = line.trim();

      // Cash regel
      const cashM = l.match(/^(CASH[^€\d]+?)\s+Valuta\s+([\d.,]+)$/);
      if (cashM) {
        posities.push({ naam: 'Cash & Cash Fund', isin: '', type: 'valuta',
          aantal: 0, koers: 0, waarde_eur: parseBedrag(cashM[2]) });
        continue;
      }
      // Positie met ISIN
      const posM = l.match(
        /^(.+?)\s+([A-Z]{2}[A-Z0-9]{9,10})\s+(?:(Aandeel|ETF|Obligatie|Fonds)\s+)?(\d+)\s+([\d.,]+)\s+([\d.,]+)\s+(EUR|USD|GBP)\s+([\d.,]+)$/
      );
      if (posM) {
        const [, naam, isin, ptype, aantalStr, koersLok, , valuta, waarde_eur] = posM;
        const aantalNum = parseInt(aantalStr);
        const waardeEur = parseBedrag(waarde_eur);
        // EUR-equivalent koers: waarde_eur / aantal (zodat koers × aantal = waarde klopt)
        const koersEur = aantalNum > 0 ? waardeEur / aantalNum : 0;
        posities.push({
          naam: naam.trim(), isin, type: (ptype || 'aandeel').toLowerCase(),
          aantal: aantalNum,
          koers: koersEur,              // EUR koers (voor correcte berekening)
          koers_lokaal: parseBedrag(koersLok), // originele USD/GBP koers
          valuta: valuta,               // 'EUR', 'USD' of 'GBP'
          waarde_eur: waardeEur,
        });
      }
    }
    return posities;
  }

  const janPosties = parseBlok('Portefeuilleoverzicht per 1-1-', 'Portefeuilleoverzicht per 31-12-');
  const decPosties = parseBlok('Portefeuilleoverzicht per 31-12-', null);

  // Koppel jan en dec op ISIN/naam, bouw posities
  // Verwijder cash/valuta posities VOOR de koppeling — die komen als rekening-courant terug
  const janBelegging = janPosties.filter(p => p.type !== 'valuta');
  const decBelegging = decPosties.filter(p => p.type !== 'valuta');

  const posities = [];
  const decMap = new Map(decBelegging.map(p => [p.isin || p.naam, p]));

  for (const jan of janBelegging) {
    const dec = decMap.get(jan.isin || jan.naam) || {};
    // Dividend per positie: niet beschikbaar per aandeel in DEGIRO PDF,
    // verdeeld over totaal — Cash positie krijgt 0
    posities.push({
      naam: jan.naam,
      isin: jan.isin,
      type: jan.isin ? (jan.type === 'etf' ? 'etf' : jan.type === 'obligatie' ? 'obligatie' : 'aandeel') : 'overig',
      jan1_waarde: jan.waarde_eur,
      jan1_aantal: jan.aantal,
      jan1_prijs: jan.koers,           // EUR-equivalent koers
      dec31_waarde: dec.waarde_eur || 0,
      dec31_aantal: dec.aantal || 0,
      dec31_prijs: dec.koers || 0,     // EUR-equivalent koers
      valuta: jan.valuta || 'EUR',
      jan1_koers_lokaal: jan.koers_lokaal || 0,   // USD/GBP koers voor display
      dec31_koers_lokaal: dec.koers_lokaal || 0,
      dividend: 0,
    });
    decMap.delete(jan.isin || jan.naam);
  }
  // Posities die alleen in dec staan (nieuw gekocht)
  for (const dec of decMap.values()) {
    posities.push({
      naam: dec.naam, isin: dec.isin,
      type: dec.isin ? (dec.type === 'etf' ? 'etf' : dec.type === 'obligatie' ? 'obligatie' : 'aandeel') : 'overig',
      jan1_waarde: 0, jan1_aantal: 0, jan1_prijs: 0,
      dec31_waarde: dec.waarde_eur, dec31_aantal: dec.aantal, dec31_prijs: dec.koers,
      valuta: dec.valuta || 'EUR',
      jan1_koers_lokaal: 0,
      dec31_koers_lokaal: dec.koers_lokaal || 0,
      dividend: 0,
    });
  }

  // Flatex Geldrekening (kassaldo) — apart opvoeren als rekening-courant
  // De saldi staan in het Flatex jaarverslag sectie
  const flatexMatch = text.match(
    /EUR\s+\(([A-Z0-9]+)\)\s+([\d.,]+)\s+EUR\s+([\d.,]+)\s+EUR/
  );
  const flatexIban    = flatexMatch ? flatexMatch[1] : '';
  const flatexJan1    = flatexMatch ? parseBedrag(flatexMatch[2]) : 0;
  const flatexDec31   = flatexMatch ? parseBedrag(flatexMatch[3]) : 0;

  // posities bevat al geen cash (gefilterd voor de koppeling)
  const beleggingPosities = posities;

  const rekeningen = [];

  // Rekening-courant (Flatex Geldrekening) — alleen als er data is
  if (flatexJan1 > 0 || flatexDec31 > 0) {
    rekeningen.push({
      naam: `Flatex Geldrekening (${flatexIban || account})`,
      weergave_naam: 'Flatex Geldrekening',
      type: 'rekening-courant',
      rekeningnummer: flatexIban || account,
      jan1_saldo:  flatexJan1,
      dec31_saldo: flatexDec31,
      ontvangen_rente: flatexOntvangen,
      rente_pct: 0, kosten: flatexBetaald,
      notitie: 'DEGIRO kassaldo / flatexDEGIRO Geldrekening',
    });
  }

  // Beleggingsrekening
  rekeningen.push({
    naam: `Beleggingsrekening (${account})`,
    weergave_naam: 'Beleggingsrekening',
    type: 'beleggen',
    rekeningnummer: account,
    dividend_totaal: divBruto,
    rente_totaal: couponBruto,
    posities: beleggingPosities,
  });

  return { bank: 'DEGIRO', type: 'degiro', jaar, rekeningen };
}

// ============ COLLIN CROWDFUND ============
function parseCollin(text) {
  const jaarMatch = text.match(/JAAROPGAVE (\d{4})/i);
  const jaar = jaarMatch ? parseInt(jaarMatch[1]) : null;
  const rekMatch = text.match(/courant nummer:\s*(\d+)/i);
  const rekeningnummer = rekMatch ? rekMatch[1] : '';

  // ---- 1. Rekening Courant (spaarrekening) ----
  const rcJanM  = text.match(/Stand 1-1-\d{4}\s+€\s*([\d.,]+)/);
  const rcDecM  = text.match(/Stand 31-12-\d{4}\s+€\s*([\d.,]+)/);
  const renteM  = text.match(/Ontvangen rente\s+€\s*([\d.,]+)/);

  const rcJan  = rcJanM  ? parseBedrag(rcJanM[1])  : 0;
  const rcDec  = rcDecM  ? parseBedrag(rcDecM[1])  : 0;
  const rente  = renteM  ? parseBedrag(renteM[1])  : 0;

  // ---- 2. Investeringsportefeuille (beleggingsrekening) ----
  const invBlok = text.match(/Investeringsportefeuille([\s\S]+?)(?:Toelichting|$)/);
  const blok = invBlok ? invBlok[1] : '';

  const janWaardeM  = blok.match(/1-1-\d{4}[\s\S]+?Portefeuillewaarde\s+€\s*([\d.,]+)/);
  const decWaardeM  = blok.match(/31-12-\d{4}[\s\S]+?Portefeuillewaarde\s+€\s*([\d.,]+)/);
  const aankopenM   = blok.match(/Ge[ïi]nvesteerd \+ ingeschreven\s+€\s*([\d.,]+)/);
  const afgelostM   = blok.match(/Afgelost\s+€\s*-?([\d.,]+)/);
  const afgeboektM  = blok.match(/Afgeboekt\s+€\s*-?([\d.,]+)/);

  const janWaarde = janWaardeM ? parseBedrag(janWaardeM[1]) : 0;
  const decWaarde = decWaardeM ? parseBedrag(decWaardeM[1]) : 0;
  const aankopen  = aankopenM  ? parseBedrag(aankopenM[1])  : 0;
  const afgelost  = afgelostM  ? parseBedrag(afgelostM[1])  : 0;
  const afgeboekt = afgeboektM ? parseBedrag(afgeboektM[1]) : 0;
  const verkopen  = afgelost + afgeboekt;

  const rekeningen = [];

  // Rekening courant alleen toevoegen als er saldo is
  if (rcJan > 0 || rcDec > 0 || rente > 0) {
    rekeningen.push({
      naam: `Rekening Courant (${rekeningnummer})`,
      weergave_naam: 'Rekening Courant',
      type: 'sparen',
      rekeningnummer,
      jan1_saldo: rcJan,
      dec31_saldo: rcDec,
      ontvangen_rente: rente,
      rente_pct: 0,
      kosten: 0,
      notitie: 'Collin Crowdfund rekening-courant',
    });
  }

  // Investeringsportefeuille
  rekeningen.push({
    naam: `Investeringsportefeuille (${rekeningnummer})`,
    weergave_naam: 'Investeringsportefeuille',
    type: 'beleggen',
    rekeningnummer,
    posities: [{
      naam: 'Collin Crowdfund leningen',
      isin: '', type: 'overig',
      jan1_waarde: janWaarde,
      jan1_aantal: 0, jan1_prijs: 0,
      dec31_waarde: decWaarde,
      dec31_aantal: 0, dec31_prijs: 0,
      aankopen_totaal: aankopen,
      verkopen_totaal: verkopen,
      dividend: rente,
    }]
  });

  return { bank: 'Collin Crowdfund', type: 'collin', jaar, rekeningen };
}


// ============ CENTRAAL BEHEER BELEGGEN (nieuw formaat - totaalwaarden) ============
function parseCBBeleggenNieuw(text) {
  const jaarMatch = text.match(/jaaroverzicht (\d{4})/i);
  const jaar = jaarMatch ? parseInt(jaarMatch[1]) : null;

  const rekMatch = text.match(/Rekeningnummer:\s*(NL[\d\s A-Z]+?)(?:\n|Op naam)/);
  const rekeningnummer = rekMatch ? rekMatch[1].trim() : '';

  // Twee "Waarde 01-01-YYYY totaal beleggingen" regels: eerste = jan, tweede = dec (volgend jaar)
  const waarden = [...text.matchAll(/Waarde 01-01-\d{4} totaal beleggingen\s+€\s*([\d.,]+)/g)]
    .map(m => parseBedrag(m[1]));

  const divMatch = text.match(/Bruto uitgekeerd dividend\s+€\s*([\d.,]+)/);

  return {
    bank: 'Centraal Beheer',
    type: 'cb_beleggen_nieuw',
    jaar,
    rekeningen: [{
      naam: `Beleggingsrekening (${rekeningnummer})`,
      weergave_naam: 'Beleggingsrekening',
      type: 'beleggen',
      rekeningnummer,
      posities: [{
        naam: 'Beleggingsrekening totaal',
        isin: '', type: 'fonds',
        jan1_waarde: waarden[0] || 0,
        jan1_aantal: 0, jan1_prijs: 0,
        dec31_waarde: waarden[1] || 0,
        dec31_aantal: 0, dec31_prijs: 0,
        dividend: divMatch ? parseBedrag(divMatch[1]) : 0,
      }]
    }]
  };
}

// ============ MEEWIND ============
function parseMeewind(text) {
  const datumMatch = text.match(/per 31-12-(\d{4})/);
  const jaar = datumMatch ? parseInt(datumMatch[1]) : null;

  const rekMatch = text.match(/(MW\d+)/);
  const rekeningnummer = rekMatch ? rekMatch[1] : '';

  const totaalJan = text.match(/Totaal vermogen per 01-01-\d{4}\s+€\s*([\d.,]+)/);
  const totaalDec = text.match(/Totaal vermogen per 31-12-\d{4}\s+€\s*([\d.,]+)/);

  // Per fonds: "Naam Aantal € Koers € Waarde" — twee keer (jan en dec)
  const fondsRegel = /^([A-Z][A-Za-z ]+?)\s+([\d,]+)\s+€\s*([\d.,]+)\s+€\s*([\d.,]+)$/gm;
  const allFondsen = [...text.matchAll(fondsRegel)].map(m => ({
    naam: m[1].trim(),
    aantal: parseFloat(m[2].replace(',', '.')),
    koers: parseBedrag(m[3]),
    waarde: parseBedrag(m[4]),
  }));

  // Fondsen komen 2x voor: eerste helft = jan, tweede helft = dec
  // Splits op basis van Totaal vermogen per 01-01 vs 31-12
  const janBlok = text.match(/Totaal vermogen per 01-01[\s\S]+?(?=Totaal vermogen per 31-12)/)?.[0] || '';
  const decBlok = text.match(/Totaal vermogen per 31-12[\s\S]+?(?=Uitkeringen|Bruto|$)/)?.[0] || '';

  const parseFondsBlok = (blok) => {
    const posities = [];
    const re = /^([A-Z][A-Za-z ]+?)\s+([\d,]+)\s+€\s*([\d.,]+)\s+€\s*([\d.,]+)$/gm;
    for (const m of blok.matchAll(re)) {
      posities.push({
        naam: m[1].trim(),
        aantal: parseFloat(m[2].replace(',', '.')),
        koers: parseBedrag(m[3]),
        waarde: parseBedrag(m[4]),
      });
    }
    return posities;
  };

  const janFondsen = parseFondsBlok(janBlok);
  const decFondsen = parseFondsBlok(decBlok);

  // Bouw posities door jan en dec te koppelen op naam
  const decMap = new Map(decFondsen.map(f => [f.naam, f]));
  const posities = janFondsen.map(jan => {
    const dec = decMap.get(jan.naam) || {};
    return {
      naam: jan.naam,
      isin: '', type: 'fonds',
      jan1_waarde: jan.waarde, jan1_aantal: jan.aantal, jan1_prijs: jan.koers,
      dec31_waarde: dec.waarde || 0, dec31_aantal: dec.aantal || 0, dec31_prijs: dec.koers || 0,
      dividend: 0,
    };
  });
  // Fondsen alleen in dec
  for (const [naam, dec] of decMap) {
    if (!janFondsen.find(f => f.naam === naam)) {
      posities.push({
        naam, isin: '', type: 'fonds',
        jan1_waarde: 0, jan1_aantal: 0, jan1_prijs: 0,
        dec31_waarde: dec.waarde, dec31_aantal: dec.aantal, dec31_prijs: dec.koers,
        dividend: 0,
      });
    }
  }

  const divMatch = text.match(/Bruto dividenduitkering:\s+€\s*([\d.,]+)/);

  // Fix131: dividend per fonds uit het blok 'Bruto dividenduitkering' (t/m Kapitaalvermindering/Ingehouden)
  const uitkBlok = text.match(/Bruto dividenduitkering:[^\n]*\n([\s\S]*?)(?:Kapitaalvermindering|Ingehouden)/)?.[1] || '';
  const normNaam = (n) => n.toLowerCase().replace(/^[-•\s]+/, '').replace(/\s+/g, ' ').trim();
  for (const regel of uitkBlok.split('\n')) {
    const m = regel.match(/^[-•\s]*(.+?)\s+€\s*([\d.,]+)$/);
    if (!m) continue;
    const doel = posities.find(p => normNaam(p.naam) === normNaam(m[1]));
    if (doel) doel.dividend = parseBedrag(m[2]);
  }

  return {
    bank: 'Meewind',
    type: 'meewind',
    jaar,
    rekeningen: [{
      naam: `Meewind portefeuille (${rekeningnummer})`,
      weergave_naam: 'Meewind portefeuille',
      type: 'beleggen',
      rekeningnummer,
      dividend_totaal: divMatch ? parseBedrag(divMatch[1]) : 0,
      posities,
    }]
  };
}
