// Fix 6 - Firebase Cloud Function als Yahoo Finance proxy
const functions = require('firebase-functions');
const fetch = require('node-fetch');

const YAHOO_CHART = 'https://query1.finance.yahoo.com/v8/finance/chart';
const YAHOO_SEARCH = 'https://query2.finance.yahoo.com/v1/finance/search';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://werkelijkrendement.web.app',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Zoek aandeel op ticker/naam
exports.zoekAandeel = functions.https.onRequest(async (req, res) => {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.set(k, v));
  if (req.method === 'OPTIONS') return res.status(204).send('');

  try {
    const { query } = req.query;
    const url = `${YAHOO_SEARCH}?q=${encodeURIComponent(query)}&quotesCount=8&newsCount=0`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Haal historische koers op
exports.haalKoers = functions.https.onRequest(async (req, res) => {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.set(k, v));
  if (req.method === 'OPTIONS') return res.status(204).send('');

  try {
    const { ticker, period1, period2 } = req.query;
    const url = `${YAHOO_CHART}/${ticker}?interval=1d&period1=${period1}&period2=${period2}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
