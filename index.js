// Cloud Functions - Yahoo Finance proxy + PDF Import
const functions = require('firebase-functions');
const fetch = require('node-fetch');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const YAHOO_CHART = 'https://query1.finance.yahoo.com/v8/finance/chart';
const YAHOO_SEARCH = 'https://query2.finance.yahoo.com/v1/finance/search';

// ============ BESTAANDE FUNCTIES ============
exports.zoekAandeel = functions.https.onRequest(async (req, res) => {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.set(k, v));
  if (req.method === 'OPTIONS') return res.status(204).send('');
  try {
    const { query } = req.query;
    const url = `${YAHOO_SEARCH}?q=${encodeURIComponent(query)}&quotesCount=8&newsCount=0`;
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

exports.haalKoers = functions.https.onRequest(async (req, res) => {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.set(k, v));
  if (req.method === 'OPTIONS') return res.status(204).send('');
  try {
    const { ticker, period1, period2 } = req.query;
    const url = `${YAHOO_CHART}/${ticker}?interval=1d&period1=${period1}&period2=${period2}`;
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ PDF IMPORT FUNCTIE ============
exports.parseerJaaroverzicht = functions
  .runWith({ memory: '512MB', timeoutSeconds: 60 })
  .https.onRequest(async (req, res) => {
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.set(k, v));
    if (req.method === 'OPTIONS') return res.status(204).send('');

    try {
      const { tekst } = req.body;
      if (!tekst) return res.status(400).json({ error: 'Geen tekst meegegeven' });

      const bankType = detectBankType(tekst);
      let result;

      if (bankType === 'centraal_beheer') result = parseCentraalBeheer(tekst);
      else if (bankType === 'raisin') result = parseRaisin(tekst);
      else if (bankType === 'abn_amro') result = parseAbnAmro(tekst);
      else result = { bank: 'Onbekend', jaar: null, rekeningen: [], error: 'Bank niet herkend' };

      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

// ============ PARSE HULPFUNCTIES ============
function parseBedrag(s) {
  if (!s) return 0;
  const clean = s.replace(/€/g, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.').trim();
  return parseFloat(clean) || 0;
}

function detectBankType(text) {
  if (text.includes('Centraal Beheer') || text.includes('RentePlús') || text.includes('RenteVast')) return 'centraal_beheer';
  if (text.toLowerCase().includes('raisin')) return 'raisin';
  if (text.includes('ABN AMRO')) return 'abn_amro';
  return 'onbekend';
}

function parseCentraalBeheer(text) {
  const jaarMatch = text.match(/jaaroverzicht (\d{4})/i);
  const jaar = jaarMatch ? parseInt(jaarMatch[1]) : null;
  const rekeningen = [];

  const blokken = text.split(/Je jaaroverzicht \d{4}\n/);
  for (const blok of blokken.slice(1)) {
    const lines = blok.trim().split('\n');
    const naam = lines[0]?.trim();
    const rekMatch = blok.match(/Rekeningnummer:\s*(.+)/);
    const rekeningnummer = rekMatch ? rekMatch[1].trim() : '';
    const saldi = [...blok.matchAll(/Saldo 01-01-\d{4}\s*€\s*([\d.,]+)/g)].map(m => parseBedrag(m[1]));
    const renteMatch = blok.match(/Totaal ontvangen rente in \d{4}\s*€\s*([\d.,]+)/);

    if (saldi.length >= 1 && renteMatch) {
      rekeningen.push({
        naam: naam + (rekeningnummer ? ` (${rekeningnummer})` : ''),
        type: naam?.includes('Vast') ? 'deposito' : 'sparen',
        rekeningnummer,
        jan1_saldo: saldi[0] || 0,
        dec31_saldo: saldi[1] || saldi[0] || 0,
        ontvangen_rente: parseBedrag(renteMatch[1]),
        rente_pct: 0,
      });
    }
  }
  return { bank: 'Centraal Beheer', jaar, rekeningen };
}

function parseRaisin(text) {
  const jaarMatch = text.match(/Jaaroverzicht (\d{4})/i);
  const jaar = jaarMatch ? parseInt(jaarMatch[1]) : null;
  const rekeningen = [];

  const pattern = /KENMERK:\s*(\S+)\s+EUR\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+[\d.,]+\s+[\d.,]+\s+[\d.,]+\nLAND:\s*(.+?)\nIBAN:\s*(\S+)\nBANK:\s*(.+?)\nOMSCHRIJVING:\s*(.+?)(?=\nKENMERK:|Saldomededeling|$)/gms;

  for (const m of text.matchAll(pattern)) {
    const [, kenmerk, saldo_jan, saldo_dec, rente_bruto, land, iban, bank, omschrijving] = m;
    const omschr = omschrijving.trim();
    const renteMatch = omschr.match(/(\d+[.,]\d+)%/);
    const maandenMatch = omschr.match(/(\d+) MAANDEN/);
    const isDeposito = omschr.toUpperCase().includes('DEPOSITO');

    rekeningen.push({
      naam: `${bank.trim()} - ${omschr}`,
      type: isDeposito ? 'deposito' : 'sparen',
      bank_naam: bank.trim(),
      land: land.trim(),
      iban: iban.trim(),
      kenmerk: kenmerk.trim(),
      rente_pct: renteMatch ? parseFloat(renteMatch[1].replace(',', '.')) : 0,
      looptijd_maanden: maandenMatch ? parseInt(maandenMatch[1]) : null,
      jan1_saldo: parseBedrag(saldo_jan),
      dec31_saldo: parseBedrag(saldo_dec),
      ontvangen_rente: parseBedrag(rente_bruto),
    });
  }
  return { bank: 'Raisin', jaar, rekeningen };
}

function parseAbnAmro(text) {
  const jaarMatch = text.match(/Jaaroverzicht (\d{4})/i);
  const jaar = jaarMatch ? parseInt(jaarMatch[1]) : null;
  const rekeningen = [];

  const lines = text.split('\n');
  for (let i = 0; i < lines.length - 1; i++) {
    const ibanMatch = lines[i].match(/^(NL\d{2}\s*[A-Z]{4}\s*[\d\s]{10,})/);
    if (ibanMatch) {
      const iban = ibanMatch[1].replace(/\s/g, '');
      const naam = lines[i + 1]?.trim();
      const bedragen = lines[i].match(/[\d.,]+/g) || [];
      if (bedragen.length >= 2) {
        rekeningen.push({
          naam: `${naam} (${iban})`,
          type: 'sparen',
          iban,
          jan1_saldo: parseBedrag(bedragen[bedragen.length - 2]),
          dec31_saldo: parseBedrag(bedragen[bedragen.length - 1]),
          ontvangen_rente: 0,
        });
      }
    }
  }
  return { bank: 'ABN AMRO', jaar, rekeningen };
}
