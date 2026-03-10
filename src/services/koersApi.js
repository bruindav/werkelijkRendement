const ALPHA_VANTAGE_KEY = import.meta.env.VITE_ALPHA_VANTAGE_KEY || 'demo';

/**
 * Zoek aandeel info op via ticker symbool
 */
export async function zoekAandeel(query) {
  try {
    const url = `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(query)}&apikey=${ALPHA_VANTAGE_KEY}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.bestMatches) {
      return data.bestMatches.map(m => ({
        symbol: m['1. symbol'],
        name: m['2. name'],
        type: m['3. type'],
        region: m['4. region'],
        currency: m['8. currency'],
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
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${ticker}&apikey=${ALPHA_VANTAGE_KEY}`;
    const res = await fetch(url);
    const data = await res.json();

    const quote = data['Global Quote'];
    if (quote && quote['05. price']) {
      return {
        prijs: parseFloat(quote['05. price']),
        datum: quote['07. latest trading day'],
        wijziging: parseFloat(quote['10. change percent']),
      };
    }
    return null;
  } catch (err) {
    console.error('Koers ophalen mislukt:', err);
    return null;
  }
}

/**
 * Haal historische koers op voor specifieke datum
 */
export async function haalHistorischeKoers(ticker, datum) {
  try {
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${ticker}&outputsize=full&apikey=${ALPHA_VANTAGE_KEY}`;
    const res = await fetch(url);
    const data = await res.json();

    const timeSeries = data['Time Series (Daily)'];
    if (timeSeries) {
      // Zoek dichtstbijzijnde handeldag
      const datums = Object.keys(timeSeries).sort();
      const doelDatum = datum; // 'YYYY-MM-DD'

      // Vind de datum die het dichtst bij ligt (op of na de gevraagde datum)
      const gevondenDatum = datums.find(d => d >= doelDatum) || datums[datums.length - 1];
      const dagData = timeSeries[gevondenDatum];

      if (dagData) {
        return {
          datum: gevondenDatum,
          slotkoers: parseFloat(dagData['4. close']),
          open: parseFloat(dagData['1. open']),
          hoog: parseFloat(dagData['2. high']),
          laag: parseFloat(dagData['3. low']),
        };
      }
    }
    return null;
  } catch (err) {
    console.error('Historische koers ophalen mislukt:', err);
    return null;
  }
}
