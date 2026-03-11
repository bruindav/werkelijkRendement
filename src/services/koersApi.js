// Fix 6 - Via Firebase Cloud Function proxy (geen CORS, Yahoo Finance)

const FUNCTIONS_BASE = 'https://us-central1-werkelijkrendement.cloudfunctions.net';

/**
 * Zoek aandeel op naam of ticker
 */
export async function zoekAandeel(query) {
  try {
    const url = `${FUNCTIONS_BASE}/zoekAandeel?query=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.quotes) {
      return data.quotes
        .filter(q => ['EQUITY', 'ETF', 'MUTUALFUND'].includes(q.quoteType))
        .map(q => ({
          symbol: q.symbol,
          name: q.longname || q.shortname || q.symbol,
          type: q.quoteType,
          region: q.exchange,
          currency: q.currency || 'EUR',
        }));
    }
    return [];
  } catch (err) {
    console.error('Koers zoeken mislukt:', err);
    return [];
  }
}

/**
 * Haal historische koers op voor specifieke datum (YYYY-MM-DD)
 */
export async function haalHistorischeKoers(ticker, datum) {
  try {
    const doelDatum = new Date(datum);
    const period1 = Math.floor(doelDatum.getTime() / 1000) - 86400;
    const period2 = Math.floor(doelDatum.getTime() / 1000) + 86400 * 5;

    const url = `${FUNCTIONS_BASE}/haalKoers?ticker=${encodeURIComponent(ticker)}&period1=${period1}&period2=${period2}`;
    const res = await fetch(url);
    const data = await res.json();

    const result = data?.chart?.result?.[0];
    if (result) {
      const timestamps = result.timestamps || result.timestamp;
      const closes = result.indicators?.quote?.[0]?.close;

      if (timestamps && closes && timestamps.length > 0) {
        const idx = closes.findIndex(c => c !== null);
        if (idx >= 0) {
          return {
            datum: new Date(timestamps[idx] * 1000).toISOString().split('T')[0],
            slotkoers: closes[idx],
          };
        }
      }
    }
    return null;
  } catch (err) {
    console.error('Historische koers ophalen mislukt:', err);
    return null;
  }
}

/**
 * Haal huidige koers op
 */
export async function haalKoersOp(ticker) {
  try {
    const period2 = Math.floor(Date.now() / 1000);
    const period1 = period2 - 86400;
    const url = `${FUNCTIONS_BASE}/haalKoers?ticker=${encodeURIComponent(ticker)}&period1=${period1}&period2=${period2}`;
    const res = await fetch(url);
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (meta) {
      return {
        prijs: meta.regularMarketPrice,
        datum: new Date().toISOString().split('T')[0],
        currency: meta.currency,
      };
    }
    return null;
  } catch (err) {
    console.error('Koers ophalen mislukt:', err);
    return null;
  }
}
