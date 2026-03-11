// Fix 4 - CORS proxy voor Yahoo Finance

const PROXY = 'https://api.allorigins.win/raw?url=';
const YAHOO_CHART = 'https://query1.finance.yahoo.com/v8/finance/chart';
const YAHOO_SEARCH = 'https://query2.finance.yahoo.com/v1/finance/search';

function proxyUrl(url) {
  return `${PROXY}${encodeURIComponent(url)}`;
}

/**
 * Zoek aandeel info op via naam of ticker
 */
export async function zoekAandeel(query) {
  try {
    const url = `${YAHOO_SEARCH}?q=${encodeURIComponent(query)}&quotesCount=8&newsCount=0&listsCount=0`;
    const res = await fetch(proxyUrl(url));
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
 * Haal huidige koers op
 */
export async function haalKoersOp(ticker) {
  try {
    const url = `${YAHOO_CHART}/${ticker}?interval=1d&range=1d`;
    const res = await fetch(proxyUrl(url));
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (meta) {
      return {
        prijs: meta.regularMarketPrice,
        datum: new Date(meta.regularTradingPeriodEndDate * 1000).toISOString().split('T')[0],
        currency: meta.currency,
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
    const doelDatum = new Date(datum);
    const van = Math.floor(doelDatum.getTime() / 1000) - 86400;
    const tot = Math.floor(doelDatum.getTime() / 1000) + 86400 * 5;

    const url = `${YAHOO_CHART}/${ticker}?interval=1d&period1=${van}&period2=${tot}`;
    const res = await fetch(proxyUrl(url));
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
