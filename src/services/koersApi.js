// Fix 5 - Financial Modeling Prep API (gratis, geen CORS)
// Gratis API key aanvragen op: https://financialmodelingprep.com/register
// 250 calls per dag gratis

const FMP_BASE = 'https://financialmodelingprep.com/api/v3';
const FMP_KEY = import.meta.env.VITE_FMP_KEY || 'demo';

/**
 * Zoek aandeel op naam of ticker
 */
export async function zoekAandeel(query) {
  try {
    const url = `${FMP_BASE}/search?query=${encodeURIComponent(query)}&limit=8&apikey=${FMP_KEY}`;
    const res = await fetch(url);
    const data = await res.json();

    if (Array.isArray(data)) {
      return data.map(q => ({
        symbol: q.symbol,
        name: q.name,
        type: q.stockExchange,
        region: q.exchangeShortName,
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
 * Haal huidige koers op
 */
export async function haalKoersOp(ticker) {
  try {
    const url = `${FMP_BASE}/quote-short/${ticker}?apikey=${FMP_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (Array.isArray(data) && data[0]) {
      return {
        prijs: data[0].price,
        datum: new Date().toISOString().split('T')[0],
      };
    }
    return null;
  } catch (err) {
    console.error('Koers ophalen mislukt:', err);
    return null;
  }
}

/**
 * Haal historische koers op voor specifieke datum (YYYY-MM-DD)
 */
export async function haalHistorischeKoers(ticker, datum) {
  try {
    // Haal koersen op rondom de gevraagde datum
    const doelDatum = new Date(datum);
    const vanDatum = new Date(doelDatum);
    vanDatum.setDate(vanDatum.getDate() - 5);
    const totDatum = new Date(doelDatum);
    totDatum.setDate(totDatum.getDate() + 5);

    const van = vanDatum.toISOString().split('T')[0];
    const tot = totDatum.toISOString().split('T')[0];

    const url = `${FMP_BASE}/historical-price-full/${ticker}?from=${van}&to=${tot}&apikey=${FMP_KEY}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.historical && data.historical.length > 0) {
      // Sorteer op datum en pak dichtstbijzijnde
      const gesorteerd = data.historical.sort((a, b) => 
        Math.abs(new Date(a.date) - doelDatum) - Math.abs(new Date(b.date) - doelDatum)
      );
      return {
        datum: gesorteerd[0].date,
        slotkoers: gesorteerd[0].close,
      };
    }
    return null;
  } catch (err) {
    console.error('Historische koers ophalen mislukt:', err);
    return null;
  }
}
