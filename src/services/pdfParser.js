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
  if (text.includes('Evi') && (text.includes('Van Lanschot') || text.includes('Fiscaal jaaroverzicht'))) return 'evi';
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
  // Evi heeft speciale parser (positie-gebaseerd), wordt apart afgehandeld via parseEviPDF
  // Als toch via text: geef hint terug
  const type = detectBankType(text);

  switch (type) {
    case 'centraal_beheer': return parseCentraalBeheer(text);
    case 'evi':             return { bank: 'Evi (Van Lanschot)', type: 'evi', jaar: null, rekeningen: [],
                                    _requiresEviParser: true };
    case 'cb_beleggen':     return parseCBBeleggen(text);
    case 'raisin':          return parseRaisin(text);
    case 'abn_amro':        return parseAbnAmro(text);
    default:
      return { bank: 'Onbekend', jaar: null, rekeningen: [], type: 'onbekend',
               fout: 'Bank niet herkend. Ondersteund: Centraal Beheer, Raisin, ABN AMRO.' };
  }
}

// ============ EVI (VAN LANSCHOT) ============
// Evi plakt woorden aaneeen in de PDF. We gebruiken positie-info van pdf.js
// om fondsnamen (links) te koppelen aan bedragen (rechts).
// pdf.js geeft ons via getTextContent() items met transform [sx,0,0,sy,tx,ty]
// waarbij tx = x-positie en ty = y-positie.

function maakLeesbaar(naam) {
  // RobecoGlobalStarsEquitiesFund-EURG -> Robeco Global Stars Equities Fund - EUR G
  let s = naam.replace(/([a-z])([A-Z])/g, '$1 $2');
  s = s.replace(/([A-Z]{2,})([A-Z][a-z])/g, '$1 $2');
  s = s.replace(/-/g, ' - ').replace(/  +/g, ' ').trim();
  return s;
}

export async function parseEviPDF(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const pdfjsLib = window['pdfjs-dist/build/pdf'];
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(e.target.result) }).promise;

        let jaar = null;
        let rekeningnummer = '';
        const fondsenJan = {};
        const fondsenDec = {};
        const dividendenBruto = {};
        let sectie = null;

        for (let p = 1; p <= pdf.numPages; p++) {
          const page = await pdf.getPage(p);
          const content = await page.getTextContent();

          // Bouw een lijst van woorden met x/y posities
          const items = content.items.map(item => ({
            tekst: item.str.trim(),
            x: item.transform[4],
            y: item.transform[5],
          })).filter(i => i.tekst.length > 0);

          for (let i = 0; i < items.length; i++) {
            const { tekst, x, y } = items[i];

            // Jaar detectie
            const jaarM = tekst.match(/jaar(\d{4})/i);
            if (jaarM && !jaar) jaar = parseInt(jaarM[1]);

            // Rekeningnummer
            if (!rekeningnummer && /^\d{6,}$/.test(tekst) && x > 200) {
              rekeningnummer = tekst;
            }

            // Sectie wissels
            if (tekst === 'Vermogen') {
              const nxt2 = items[i + 2]?.tekst || '';
              if (nxt2.includes('01-01')) sectie = 'jan';
              else if (nxt2.includes('31-12')) sectie = 'dec';
            }
            if (tekst === 'Dividend') {
              const nxt = items[i + 1]?.tekst?.toLowerCase() || '';
              if (nxt.includes('binnen')) sectie = 'div';
              else if (nxt.includes('buiten')) sectie = null;
            }

            // Bedrag detectie (x > 400 of ~241 voor dividend)
            if (tekst.startsWith('€')) {
              const bedrag = parseBedrag(tekst);

              if (sectie === 'jan' && x > 400) {
                // Zoek fondsNaam op zelfde y
                const fonds = items.find(it => Math.abs(it.y - y) < 4 && it.x < 250 && it.tekst.startsWith('Robeco'));
                if (fonds) fondsenJan[fonds.tekst] = bedrag;
              } else if (sectie === 'dec' && x > 400) {
                const fonds = items.find(it => Math.abs(it.y - y) < 4 && it.x < 250 && it.tekst.startsWith('Robeco'));
                if (fonds) fondsenDec[fonds.tekst] = bedrag;
              } else if (sectie === 'div' && Math.abs(x - 241) < 40) {
                // Bruto dividend = eerste kolom; zoek fonds op zelfde of vorige y
                for (const dy of [0, -10, -12, -14]) {
                  const fonds = items.find(it => Math.abs(it.y - (y + dy)) < 6 && it.x < 200 && it.tekst.startsWith('Robeco'));
                  if (fonds) { dividendenBruto[fonds.tekst] = bedrag; break; }
                }
              }
            }
          }
        }

        // Bouw posities
        const alleNamen = new Set([...Object.keys(fondsenJan), ...Object.keys(fondsenDec)]);
        const skip = new Set(['Fonds', 'Waarde', 'Totaalbeleggingen', 'Totaal', 'Spaartegoed']);
        const posities = [];

        for (const naam of [...alleNamen].sort()) {
          if (skip.has(naam)) continue;
          // Dividend koppelen via prefix-match
          let div = 0;
          for (const [dn, dv] of Object.entries(dividendenBruto)) {
            if (naam.startsWith(dn.substring(0, Math.min(dn.length, 25))) ||
                dn.startsWith(naam.substring(0, Math.min(naam.length, 25)))) {
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

        resolve({
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
        });
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error('Leesfout'));
    reader.readAsArrayBuffer(file);
  });
}
