// Fix 9 - Auto aantal berekenen + kosten per positie
// Fix 7 - Dec31 koers fix + transacties bewerkbaar
// Fix 3 - Ticker uitleg notatie per land
// Fix 3 - Ticker info note toegevoegd
// Fix 1 - Bewerken knop + jaar zichtbaar
import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { usePosities, useBank, useRekening } from '../hooks/useLocalDB';
import Breadcrumb from '../components/Breadcrumb';
import { berekenPositieRendement, formatEuro, formatPct } from '../services/berekening';
import { zoekAandeel, haalKoersenVoorJaar, haalHistorischeKoers } from '../services/koersApi';
import { Plus, Trash2, ChevronDown, ChevronUp, Search, TrendingUp, Edit3, Check, X, Loader, Calendar, Repeat, Info } from 'lucide-react';

const TYPES = ['aandeel', 'obligatie', 'etf', 'anders'];

function KoersZoeker({ onSelect }) {
  const [query, setQuery] = useState('');
  const [resultaten, setResultaten] = useState([]);
  const [loading, setLoading] = useState(false);

  const zoek = async () => {
    if (!query) return;
    setLoading(true);
    const r = await zoekAandeel(query);
    setResultaten(r);
    setLoading(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && zoek()}
          placeholder="Zoek op naam of ticker (bijv. ASML, Apple...)"
          className="flex-1 bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button onClick={zoek} disabled={loading} className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-3 py-2">
          {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </button>
      </div>
      {resultaten.length > 0 && (
        <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
          {resultaten.map(r => (
            <button
              key={r.symbol}
              onClick={() => { onSelect(r); setResultaten([]); setQuery(''); }}
              className="w-full text-left px-4 py-2.5 hover:bg-slate-800 flex items-center justify-between border-b border-slate-800 last:border-0"
            >
              <div>
                <span className="text-white text-sm font-medium">{r.name}</span>
                <span className="text-slate-400 text-xs ml-2">{r.region}</span>
              </div>
              <span className="text-blue-400 text-xs font-mono">{r.symbol}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


// Ticker notatie info — popup in plaats van altijd-zichtbare lijst
function TickerInfoPopup() {
  const [open, setOpen] = useState(false);
  const voorbeelden = [
    { vlag: '🇳🇱', land: 'Nederland', suffix: '.AS', ex: 'ASML.AS' },
    { vlag: '🇺🇸', land: 'Amerika',   suffix: '',    ex: 'AAPL, MSFT' },
    { vlag: '🇩🇪', land: 'Duitsland', suffix: '.DE', ex: 'SAP.DE' },
    { vlag: '🇫🇷', land: 'Frankrijk', suffix: '.PA', ex: 'MC.PA' },
    { vlag: '🇬🇧', land: 'UK',        suffix: '.L',  ex: 'SHEL.L' },
    { vlag: '📊',  land: 'ETF',       suffix: '.AS', ex: 'VWRL.AS' },
  ];
  return (
    <div className="relative mt-1.5">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
      >
        <Info className="w-3.5 h-3.5" />
        Ticker notatie uitleg
      </button>
      {open && (
        <>
          {/* Klik buiten om te sluiten */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-6 z-20 w-64 bg-slate-800 border border-slate-600 rounded-xl shadow-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-slate-300">💡 Ticker notatie per land</p>
              <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-300">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-1.5">
              {voorbeelden.map(({ vlag, land, suffix, ex }) => (
                <div key={land} className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">{vlag} {land}{suffix ? ` (${suffix})` : ''}</span>
                  <span className="text-xs font-mono text-slate-300">{ex}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-600 mt-2 pt-2 border-t border-slate-700">
              Gebruik de zoekbalk hierboven om de juiste ticker te vinden.
            </p>
          </div>
        </>
      )}
    </div>
  );
}


// ============ VALUTA DEFINITIE ============
const VALUTA_LIJST = [
  { code: 'EUR', label: 'Euro',            symbool: '€', ticker: null },
  { code: 'USD', label: 'US Dollar',       symbool: '$', ticker: 'EURUSD=X' },
  { code: 'GBP', label: 'Brits Pond',      symbool: '£', ticker: 'EURGBP=X' },
  { code: 'CHF', label: 'Zwitserse Frank', symbool: 'Fr', ticker: 'EURCHF=X' },
  { code: 'JPY', label: 'Japanse Yen',     symbool: '¥', ticker: 'EURJPY=X' },
  { code: 'CAD', label: 'Canadese Dollar', symbool: 'C$', ticker: 'EURCAD=X' },
];

// Bereken EUR waarde vanuit lokale valuta
function lokaalNaarEur(lokaalBedrag, wisselkoers) {
  if (!wisselkoers || !lokaalBedrag) return null;
  return parseFloat(lokaalBedrag) * wisselkoers;
}

function PositieForm({ onSave, onCancel, year, initial = null }) {
  // invoerModus: 'EUR' = direct in euro, 'lokaal' = in vreemde valuta met omrekening
  const [invoerModus, setInvoerModus] = useState(
    initial?.valuta && initial.valuta !== 'EUR' ? 'lokaal' : 'EUR'
  );
  const [form, setForm] = useState({
    naam: initial?.naam || '',
    type: initial?.type || 'aandeel',
    ticker: initial?.ticker || '',
    isin: initial?.isin || '',
    valuta: initial?.valuta || 'USD', // valuta voor lokale modus
    jan1_aantal: initial?.jan1_aantal || '',
    jan1_prijs: initial?.jan1_prijs || '',
    jan1_waarde: initial?.jan1_waarde || '',
    dec31_aantal: initial?.dec31_aantal || '',
    dec31_prijs: initial?.dec31_prijs || '',
    dec31_waarde: initial?.dec31_waarde || '',
    dividend: initial?.dividend || '',
    rente: initial?.rente || '',
    kosten: initial?.kosten || '',
    maandelijks_bedrag: initial?.maandelijks_bedrag || '',
  });
  // Lokale invoervelden (in vreemde valuta) — apart van EUR-velden
  const [lokaal, setLokaal] = useState({
    jan1_koers: initial?.jan1_koers_lokaal ? String(initial.jan1_koers_lokaal) : '',
    jan1_aantal: initial?.jan1_aantal ? String(initial.jan1_aantal) : '',
    dec31_koers: initial?.dec31_koers_lokaal ? String(initial.dec31_koers_lokaal) : '',
    dec31_aantal: initial?.dec31_aantal ? String(initial.dec31_aantal) : '',
  });
  const [loadingKoers, setLoadingKoers] = useState(false);
  const [wisselkoersen, setWisselkoersen] = useState({
    jan1: initial?.valuta !== 'EUR' && initial?.jan1_prijs && initial?.jan1_koers_lokaal
      ? initial.jan1_prijs / initial.jan1_koers_lokaal : null,
    dec31: initial?.valuta !== 'EUR' && initial?.dec31_prijs && initial?.dec31_koers_lokaal
      ? initial.dec31_prijs / initial.dec31_koers_lokaal : null,
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const berekenWaarde = (prefix) => {
    const aantal = parseFloat(form[`${prefix}_aantal`]);
    const prijs = parseFloat(form[`${prefix}_prijs`]);
    if (!isNaN(aantal) && !isNaN(prijs)) {
      set(`${prefix}_waarde`, (aantal * prijs).toFixed(2));
    }
  };

  const berekenAantal = (prefix) => {
    const waarde = parseFloat(form[`${prefix}_waarde`]);
    const prijs = parseFloat(form[`${prefix}_prijs`]);
    const aantal = parseFloat(form[`${prefix}_aantal`]);
    // Bereken aantal als waarde en prijs bekend zijn maar aantal leeg/0
    if (!isNaN(waarde) && !isNaN(prijs) && prijs > 0 && (isNaN(aantal) || aantal === 0)) {
      set(`${prefix}_aantal`, (waarde / prijs).toFixed(4));
    }
    // Bereken waarde als aantal en prijs bekend zijn maar waarde leeg/0
    if (!isNaN(aantal) && !isNaN(prijs) && prijs > 0 && (isNaN(waarde) || waarde === 0)) {
      set(`${prefix}_waarde`, (aantal * prijs).toFixed(2));
    }
  };

  // Haal aandeelkoersen op (+ wisselkoers als lokale modus)
  const haalKoersen = async () => {
    if (!form.ticker) return;
    setLoadingKoers(true);
    try {
      // Haal wisselkoers op als in lokale modus
      let wk = wisselkoersen;
      if (invoerModus === 'lokaal') {
        const valutaInfo = VALUTA_LIJST.find(v => v.code === form.valuta);
        if (valutaInfo?.ticker) {
          const wkJan = await haalHistorischeKoers(valutaInfo.ticker, `${year}-01-02`);
          const wkDec = await haalHistorischeKoers(valutaInfo.ticker, `${year}-12-30`);
          wk = {
            jan1:  wkJan  ? 1 / wkJan.slotkoers  : null,
            dec31: wkDec  ? 1 / wkDec.slotkoers  : null,
          };
          setWisselkoersen(wk);
        }
      }
      // Haal aandeelkoersen op
      const { jan1, dec31 } = await haalKoersenVoorJaar(form.ticker, year);
      if (invoerModus === 'lokaal') {
        // Sla lokale koers op, bereken EUR live
        if (jan1) setLokaal(l => ({ ...l, jan1_koers: jan1.slotkoers.toString() }));
        if (dec31) setLokaal(l => ({ ...l, dec31_koers: dec31.slotkoers.toString() }));
      } else {
        if (jan1) {
          set('jan1_prijs', jan1.slotkoers.toString());
          if (form.jan1_aantal) set('jan1_waarde', (parseFloat(form.jan1_aantal) * jan1.slotkoers).toFixed(2));
        }
        if (dec31) {
          set('dec31_prijs', dec31.slotkoers.toString());
          if (form.dec31_aantal) set('dec31_waarde', (parseFloat(form.dec31_aantal) * dec31.slotkoers).toFixed(2));
        }
      }
    } catch (e) { console.error('Koersen ophalen mislukt:', e); }
    setLoadingKoers(false);
  };

  // Haal alleen wisselkoers op (als geen ticker bekend)
  const haalAlleenWisselkoers = async () => {
    const valutaInfo = VALUTA_LIJST.find(v => v.code === form.valuta);
    if (!valutaInfo?.ticker) return;
    setLoadingKoers(true);
    try {
      const wkJan  = await haalHistorischeKoers(valutaInfo.ticker, `${year}-01-02`);
      const wkDec  = await haalHistorischeKoers(valutaInfo.ticker, `${year}-12-30`);
      setWisselkoersen({
        jan1:  wkJan  ? 1 / wkJan.slotkoers  : null,
        dec31: wkDec  ? 1 / wkDec.slotkoers  : null,
      });
    } catch (e) { console.error('Wisselkoers ophalen mislukt:', e); }
    setLoadingKoers(false);
  };

  // Live EUR waarden vanuit lokale invoer
  const eurJan1Waarde  = wisselkoersen.jan1  && lokaal.jan1_aantal  && lokaal.jan1_koers
    ? lokaalNaarEur(parseFloat(lokaal.jan1_koers)  * parseFloat(lokaal.jan1_aantal),  1)
    : null;
  const eurDec31Waarde = wisselkoersen.dec31 && lokaal.dec31_aantal && lokaal.dec31_koers
    ? lokaalNaarEur(parseFloat(lokaal.dec31_koers) * parseFloat(lokaal.dec31_aantal), 1)
    : null;
  const eurJan1Koers   = wisselkoersen.jan1  && lokaal.jan1_koers
    ? lokaalNaarEur(parseFloat(lokaal.jan1_koers),  wisselkoersen.jan1)  : null;
  const eurDec31Koers  = wisselkoersen.dec31 && lokaal.dec31_koers
    ? lokaalNaarEur(parseFloat(lokaal.dec31_koers), wisselkoersen.dec31) : null;

  const handleSelectAandeel = (r) => {
    set('naam', r.name);
    set('ticker', r.symbol);
  };

  const numField = (label, key, prefix, isWaarde = false) => (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <input
        type="number" step="0.01" value={form[key]}
        onChange={e => set(key, e.target.value)}
        onBlur={() => {
          if (prefix) {
            if (isWaarde) berekenAantal(prefix);
            else berekenWaarde(prefix);
          }
        }}
        className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );

  const handleSave = () => {
    if (!form.naam) return;
    let saveData;
    if (invoerModus === 'lokaal' && wisselkoersen.jan1) {
      // Bereken EUR waarden vanuit lokale koers
      const j1Aantal = parseFloat(lokaal.jan1_aantal) || 0;
      const j1Koers  = parseFloat(lokaal.jan1_koers)  || 0;
      const d31Aantal = parseFloat(lokaal.dec31_aantal) || 0;
      const d31Koers  = parseFloat(lokaal.dec31_koers)  || 0;
      const j1EurKoers  = j1Koers  * (wisselkoersen.jan1  || 0);
      const d31EurKoers = d31Koers * (wisselkoersen.dec31 || wisselkoersen.jan1 || 0);
      saveData = {
        naam: form.naam, type: form.type, ticker: form.ticker, isin: form.isin,
        valuta: form.valuta,
        jan1_aantal: j1Aantal,
        jan1_prijs: parseFloat(j1EurKoers.toFixed(4)),
        jan1_waarde: parseFloat((j1Aantal * j1EurKoers).toFixed(2)),
        dec31_aantal: d31Aantal,
        dec31_prijs: parseFloat(d31EurKoers.toFixed(4)),
        dec31_waarde: parseFloat((d31Aantal * d31EurKoers).toFixed(2)),
        jan1_koers_lokaal: j1Koers,
        dec31_koers_lokaal: d31Koers,
        dividend: parseFloat(form.dividend) || 0,
        rente: parseFloat(form.rente) || 0,
        kosten: parseFloat(form.kosten) || 0,
        maandelijks_bedrag: parseFloat(form.maandelijks_bedrag) || 0,
      };
    } else {
      saveData = {
        naam: form.naam, type: form.type, ticker: form.ticker, isin: form.isin,
        valuta: 'EUR',
        jan1_aantal: parseFloat(form.jan1_aantal) || 0,
        jan1_prijs: parseFloat(form.jan1_prijs) || 0,
        jan1_waarde: parseFloat(form.jan1_waarde) || 0,
        dec31_aantal: parseFloat(form.dec31_aantal) || 0,
        dec31_prijs: parseFloat(form.dec31_prijs) || 0,
        dec31_waarde: parseFloat(form.dec31_waarde) || 0,
        dividend: parseFloat(form.dividend) || 0,
        rente: parseFloat(form.rente) || 0,
        kosten: parseFloat(form.kosten) || 0,
        maandelijks_bedrag: parseFloat(form.maandelijks_bedrag) || 0,
      };
    }
    onSave(saveData);
  };

  return (
    <div className="bg-slate-900 border border-blue-600/30 rounded-2xl p-6 space-y-5">
      <div className="flex items-center gap-2 bg-blue-600/20 border border-blue-600/30 rounded-xl px-4 py-2.5">
        <Calendar className="w-4 h-4 text-blue-400" />
        <span className="text-blue-300 text-sm font-medium">
          {initial ? 'Positie bewerken' : 'Nieuwe positie toevoegen'} — belastingjaar <strong>{year}</strong>
        </span>
      </div>

      {!initial && (
        <div>
          <label className="block text-xs text-slate-400 mb-2">Zoek via ticker / naam (optioneel)</label>
          <KoersZoeker onSelect={handleSelectAandeel} />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs text-slate-400 mb-1">Naam *</label>
          <input value={form.naam} onChange={e => set('naam', e.target.value)}
            placeholder="bijv. ASML Holding"
            className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Type</label>
          <select value={form.type} onChange={e => set('type', e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Ticker symbool</label>
          <input value={form.ticker} onChange={e => set('ticker', e.target.value)}
            placeholder="bijv. ASML.AS"
            className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <TickerInfoPopup />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">ISIN</label>
          <input value={form.isin} onChange={e => set('isin', e.target.value)}
            placeholder="bijv. NL0010273215"
            className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {form.ticker && (
        <button onClick={haalKoersen} disabled={loadingKoers}
          className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 disabled:opacity-50">
          {loadingKoers ? <Loader className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Koersen ophalen 1 jan + 31 dec
        </button>
      )}

      {/* Invoer modus tabs: EUR of Lokale valuta */}
      <div>
        <div className="flex gap-1 bg-slate-900/60 rounded-xl p-1 mb-3">
          {[
            { key: 'EUR', label: '€ Invoer in euro' },
            { key: 'lokaal', label: '💱 Invoer in andere valuta' },
          ].map(({ key, label }) => (
            <button key={key} type="button"
              onClick={() => setInvoerModus(key)}
              className={`flex-1 py-1.5 px-3 rounded-lg text-sm font-medium transition-colors ${
                invoerModus === key ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* MODUS EUR */}
        {invoerModus === 'EUR' && (
          <div className="bg-slate-900/40 rounded-xl overflow-hidden">
            <div className="grid grid-cols-[auto_1fr_1fr] text-xs text-slate-500 border-b border-slate-800">
              <div className="px-3 py-2 w-20" />
              <div className="px-3 py-2 text-right border-l border-slate-800">1 jan {year}</div>
              <div className="px-3 py-2 text-right border-l border-slate-800">31 dec {year}</div>
            </div>
            {[
              { label: 'Aantal', j: 'jan1_aantal', d: 'dec31_aantal', step: '0.001', onBlur: (p) => berekenWaarde(p) },
              { label: 'Koers (€)', j: 'jan1_prijs', d: 'dec31_prijs', step: '0.0001', onBlur: (p) => berekenWaarde(p) },
              { label: 'Waarde (€)', j: 'jan1_waarde', d: 'dec31_waarde', step: '0.01', onBlur: (p) => berekenAantal(p) },
            ].map(({ label, j, d, step, onBlur }, ri) => (
              <div key={label} className={`grid grid-cols-[auto_1fr_1fr] ${ri < 2 ? 'border-b border-slate-800/60' : ''}`}>
                <div className="px-3 py-2 w-20 text-xs text-slate-400 flex items-center">{label}</div>
                {[{ key: j, prefix: 'jan1' }, { key: d, prefix: 'dec31' }].map(({ key, prefix }) => (
                  <div key={key} className="px-2 py-1.5 border-l border-slate-800/60">
                    <input type="number" step={step} value={form[key]}
                      onChange={e => set(key, e.target.value)}
                      onBlur={() => onBlur(prefix)}
                      className="w-full bg-slate-700 border border-slate-600 text-white rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* MODUS LOKAAL (USD etc.) */}
        {invoerModus === 'lokaal' && (
          <div className="space-y-3">
            {/* Valuta keuze */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400">Valuta:</span>
              <div className="flex gap-1 flex-wrap">
                {VALUTA_LIJST.filter(v => v.code !== 'EUR').map(v => (
                  <button key={v.code} type="button"
                    onClick={() => { set('valuta', v.code); setWisselkoersen({ jan1: null, dec31: null }); }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
                      form.valuta === v.code
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                    }`}>
                    {v.symbool} {v.code}
                  </button>
                ))}
              </div>
              <button type="button" onClick={haalAlleenWisselkoers} disabled={loadingKoers}
                className="ml-auto flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50">
                {loadingKoers ? <Loader className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                Wisselkoers ophalen
              </button>
            </div>

            {/* Wisselkoers status */}
            {wisselkoersen.jan1 && (
              <div className="flex gap-4 text-xs text-amber-400/80 bg-amber-900/20 rounded-lg px-3 py-2">
                <span>1 jan: 1 {form.valuta} = €{wisselkoersen.jan1.toFixed(4)}</span>
                {wisselkoersen.dec31 && <span>31 dec: 1 {form.valuta} = €{wisselkoersen.dec31.toFixed(4)}</span>}
              </div>
            )}
            {!wisselkoersen.jan1 && (
              <p className="text-xs text-slate-500 bg-slate-900/40 rounded-lg px-3 py-2">
                Klik "Wisselkoers ophalen" om de EUR/{form.valuta} koers voor {year} op te halen.
                Daarna zie je live de EUR-waarden terwijl je invoert.
              </p>
            )}

            {/* Invoertabel lokale modus */}
            <div className="bg-slate-900/40 rounded-xl overflow-hidden">
              <div className="grid grid-cols-[auto_1fr_1fr] text-xs text-slate-500 border-b border-slate-800">
                <div className="px-3 py-2 w-24" />
                <div className="px-3 py-2 text-right border-l border-slate-800">1 jan {year}</div>
                <div className="px-3 py-2 text-right border-l border-slate-800">31 dec {year}</div>
              </div>
              {/* Aantal */}
              <div className="grid grid-cols-[auto_1fr_1fr] border-b border-slate-800/60">
                <div className="px-3 py-2 w-24 text-xs text-slate-400 flex items-center">Aantal</div>
                <div className="px-2 py-1.5 border-l border-slate-800/60">
                  <input type="number" step="0.001" value={lokaal.jan1_aantal}
                    onChange={e => setLokaal(l => ({ ...l, jan1_aantal: e.target.value }))}
                    className="w-full bg-slate-700 border border-slate-600 text-white rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div className="px-2 py-1.5 border-l border-slate-800/60">
                  <input type="number" step="0.001" value={lokaal.dec31_aantal}
                    onChange={e => setLokaal(l => ({ ...l, dec31_aantal: e.target.value }))}
                    className="w-full bg-slate-700 border border-slate-600 text-white rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
              </div>
              {/* Koers in lokale valuta */}
              <div className="grid grid-cols-[auto_1fr_1fr] border-b border-slate-800/60">
                <div className="px-3 py-2 w-24 text-xs text-slate-400 flex items-center">Koers {form.valuta}</div>
                <div className="px-2 py-1.5 border-l border-slate-800/60">
                  <input type="number" step="0.0001" value={lokaal.jan1_koers}
                    onChange={e => setLokaal(l => ({ ...l, jan1_koers: e.target.value }))}
                    placeholder={`${form.valuta} prijs`}
                    className="w-full bg-slate-700 border border-amber-700/40 text-white rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500" />
                </div>
                <div className="px-2 py-1.5 border-l border-slate-800/60">
                  <input type="number" step="0.0001" value={lokaal.dec31_koers}
                    onChange={e => setLokaal(l => ({ ...l, dec31_koers: e.target.value }))}
                    placeholder={`${form.valuta} prijs`}
                    className="w-full bg-slate-700 border border-amber-700/40 text-white rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500" />
                </div>
              </div>
              {/* Live EUR koers */}
              <div className="grid grid-cols-[auto_1fr_1fr] border-b border-slate-800/60 bg-slate-800/30">
                <div className="px-3 py-2 w-24 text-xs text-slate-500 flex items-center">Koers €</div>
                <div className="px-3 py-2 text-right text-xs border-l border-slate-800/60 text-emerald-400/80">
                  {eurJan1Koers ? `€${eurJan1Koers.toFixed(2)}` : <span className="text-slate-600">—</span>}
                </div>
                <div className="px-3 py-2 text-right text-xs border-l border-slate-800/60 text-emerald-400/80">
                  {eurDec31Koers ? `€${eurDec31Koers.toFixed(2)}` : <span className="text-slate-600">—</span>}
                </div>
              </div>
              {/* Live EUR waarde */}
              <div className="grid grid-cols-[auto_1fr_1fr] bg-slate-800/30">
                <div className="px-3 py-2 w-24 text-xs text-slate-500 flex items-center">Waarde €</div>
                <div className="px-3 py-2 text-right text-sm font-semibold border-l border-slate-800/60 text-white">
                  {eurJan1Waarde ? `€${eurJan1Waarde.toFixed(2)}` : <span className="text-slate-600 text-xs font-normal">—</span>}
                </div>
                <div className="px-3 py-2 text-right text-sm font-semibold border-l border-slate-800/60 text-white">
                  {eurDec31Waarde ? `€${eurDec31Waarde.toFixed(2)}` : <span className="text-slate-600 text-xs font-normal">—</span>}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div>
        <p className="text-sm font-medium text-slate-300 mb-3">💰 Inkomen & Kosten in {year}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {numField('Dividend ontvangen (€)', 'dividend', null)}
          {numField('Rente ontvangen (€)', 'rente', null)}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Kosten (€) <span className="text-slate-500">aftrekbaar</span></label>
            <input type="number" step="0.01" value={form.kosten}
              onChange={e => set('kosten', e.target.value)}
              placeholder="0.00"
              className="w-full bg-slate-700 border border-red-900/40 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            <p className="text-xs text-slate-500 mt-1">Transactie- of beheerskosten</p>
          </div>
        </div>
      </div>

      {/* Automatische maandelijkse aankoop instelling */}
      <div className="bg-blue-950/30 border border-blue-800/30 rounded-xl p-4">
        <p className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
          <Repeat className="w-4 h-4 text-blue-400" /> Automatische maandelijkse aankoop
        </p>
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
          <div className="flex-1 max-w-xs">
            <label className="block text-xs text-slate-400 mb-1">
              Bedrag per maand (€) <span className="text-slate-500">— koers/aantal onbekend</span>
            </label>
            <input type="number" step="0.01" value={form.maandelijks_bedrag}
              onChange={e => set('maandelijks_bedrag', e.target.value)}
              placeholder="bijv. 100 — leeg = niet actief"
              className="w-full bg-slate-700 border border-blue-600/40 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {parseFloat(form.maandelijks_bedrag) > 0 && (
            <div className="bg-blue-950/60 border border-blue-800/40 rounded-lg px-3 py-2 text-xs text-blue-300">
              <Repeat className="w-3 h-3 inline mr-1" />
              12 × €{parseFloat(form.maandelijks_bedrag).toFixed(2)} = <span className="font-medium text-white">€{(12 * parseFloat(form.maandelijks_bedrag)).toFixed(2)}</span>/jaar
            </div>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Sla dit op om later met één klik alle maandelijkse aankopen te genereren.
        </p>
      </div>

      <div className="flex gap-3 pt-2">
        <button onClick={handleSave} disabled={!form.naam}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl px-5 py-2.5 text-sm font-medium">
          <Check className="w-4 h-4" /> {initial ? 'Wijzigingen opslaan' : 'Toevoegen'}
        </button>
        <button onClick={onCancel} className="text-slate-400 hover:text-white text-sm px-4 py-2.5">
          Annuleren
        </button>
      </div>
    </div>
  );
}


function TransactieRij({ transactie, type, kleur, jaar, onUpdate, onVerwijder }) {
  const [bewerken, setBewerken] = useState(false);

  if (bewerken) {
    // Gebruik hetzelfde TransactieForm als bij aanmaken, maar met initial waarden
    return (
      <TransactieForm
        type={type}
        year={jaar}
        initial={transactie}
        onSave={(transacties) => {
          // Bij bewerken altijd eerste item nemen
          onUpdate(Array.isArray(transacties) ? transacties[0] : transacties);
          setBewerken(false);
        }}
        onCancel={() => setBewerken(false)}
      />
    );
  }

  const heeftAantalPrijs = transactie.aantal > 0 && transactie.prijs > 0;
  const isAuto = transactie.auto;

  return (
    <div className="flex items-center gap-x-3 gap-y-1 bg-slate-900/50 rounded-lg px-3 py-2 text-sm">
      <span className="text-slate-400 text-xs flex-shrink-0">{transactie.datum}</span>
      <span className="flex-1 text-xs text-slate-300">
        {heeftAantalPrijs
          ? `${transactie.aantal} × ${formatEuro(transactie.prijs)}`
          : <span className="text-slate-500 italic">bedrag</span>
        }
      </span>
      <span className={`text-${kleur}-400 font-medium text-sm flex-shrink-0`}>{formatEuro(transactie.totaal)}</span>
      {isAuto && (
        <span className="text-xs bg-blue-900/40 text-blue-400 border border-blue-800/40 px-1.5 py-0.5 rounded-full flex items-center gap-1 flex-shrink-0">
          <Repeat className="w-2.5 h-2.5" />
        </span>
      )}
      <div className="flex gap-1 flex-shrink-0">
        <button onClick={() => setBewerken(true)} className="text-slate-500 hover:text-blue-400 active:text-blue-400 p-1"><Edit3 className="w-3.5 h-3.5" /></button>
        <button onClick={onVerwijder} className="text-slate-500 hover:text-red-400 active:text-red-400 p-1"><X className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );
}

function TransactieForm({ type, onSave, onCancel, year, initial = null }) {
  const detectModus = () => {
    if (!initial) return 'enkel';
    if (initial.auto) return 'maandelijks';
    if (initial.aantal === 0 && initial.prijs === 0) return 'bedrag';
    return 'enkel';
  };

  const standaardDatum = year ? `${year}-01-01` : '';

  const [modus, setModus] = useState(detectModus());
  const [datum, setDatum] = useState(initial?.datum || standaardDatum);
  const [aantal, setAantal] = useState(initial?.aantal > 0 ? String(initial.aantal) : '');
  const [prijs, setPrijs] = useState(initial?.prijs > 0 ? String(initial.prijs) : '');
  const [bedrag, setBedrag] = useState(
    initial && initial.aantal === 0 ? String(initial.totaal || '') : ''
  );
  const [maandBedrag, setMaandBedrag] = useState('');
  const [startMaand, setStartMaand] = useState('1');
  const [eindMaand, setEindMaand] = useState('12');
  const totaal = parseFloat(aantal) * parseFloat(prijs) || 0;
  // Valuta voor transacties
  const [transValuta, setTransValuta] = useState('EUR');
  const [transWisselkoers, setTransWisselkoers] = useState(null); // EUR per 1 vreemde munt
  const [loadingTransWk, setLoadingTransWk] = useState(false);
  const lokaalTotaal = parseFloat(aantal) * parseFloat(prijs) || 0;
  const eurTotaal = transValuta !== 'EUR' && transWisselkoers
    ? lokaalTotaal * transWisselkoers : null;

  const haalTransWisselkoers = async () => {
    const valutaInfo = VALUTA_LIJST.find(v => v.code === transValuta);
    if (!valutaInfo?.ticker || !datum) return;
    setLoadingTransWk(true);
    try {
      const wk = await haalHistorischeKoers(valutaInfo.ticker, datum);
      setTransWisselkoers(wk ? 1 / wk.slotkoers : null);
    } catch (e) { console.error(e); }
    setLoadingTransWk(false);
  };

  const maanden = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Aug','Sep','Okt','Nov','Dec'];

  const handleOpslaan = () => {
    if (modus === 'maandelijks') {
      const start = parseInt(startMaand);
      const eind = parseInt(eindMaand);
      const bedragVal = parseFloat(maandBedrag) || 0;
      const transacties = [];
      for (let m = start; m <= eind; m++) {
        const maandStr = String(m).padStart(2, '0');
        transacties.push({ datum: `${year}-${maandStr}-01`, aantal: 0, prijs: 0, totaal: bedragVal, auto: true });
      }
      onSave(transacties);
    } else if (modus === 'bedrag') {
      onSave([{ datum, aantal: 0, prijs: 0, totaal: parseFloat(bedrag) || 0 }]);
    } else {
      // Bij vreemde valuta: sla EUR totaal op
      const eurTot = transValuta !== 'EUR' && transWisselkoers ? eurTotaal : totaal;
      onSave([{
        datum,
        aantal: parseFloat(aantal) || 0,
        prijs: transValuta !== 'EUR' && transWisselkoers
          ? parseFloat((parseFloat(prijs) * transWisselkoers).toFixed(4))
          : parseFloat(prijs) || 0,
        totaal: eurTot || 0,
        ...(transValuta !== 'EUR' ? { valuta: transValuta, koers_lokaal: parseFloat(prijs) || 0 } : {}),
      }]);
    }
  };

  const kanOpslaan = modus === 'maandelijks'
    ? parseFloat(maandBedrag) > 0
    : modus === 'bedrag'
    ? datum && parseFloat(bedrag) > 0
    : datum && (aantal || prijs);

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 mt-2">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-slate-300">{type === 'aankoop' ? 'Aankoop' : 'Verkoop'} toevoegen</p>
        {type === 'aankoop' && (
          <div className="flex gap-1 bg-slate-900 rounded-lg p-0.5 text-xs">
            {[['enkel','Enkel'],['bedrag','Alleen bedrag'],['maandelijks','Maandelijks']].map(([v, l]) => (
              <button key={v} onClick={() => setModus(v)}
                className={`px-2 py-1 rounded-md transition-colors ${modus === v ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                {l}
              </button>
            ))}
          </div>
        )}
      </div>

      {modus === 'maandelijks' && (
        <div className="space-y-3">
          <div className="bg-blue-950/40 border border-blue-800/30 rounded-xl p-3">
            <div className="flex items-center gap-2 text-blue-400 text-xs mb-3">
              <Repeat className="w-3.5 h-3.5" />
              Genereert één aankoop per maand voor het opgegeven bedrag
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Bedrag per maand (€)</label>
                <input type="number" step="0.01" value={maandBedrag} onChange={e => setMaandBedrag(e.target.value)}
                  placeholder="bijv. 100"
                  className="w-full bg-slate-700 border border-blue-600/40 text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Van maand</label>
                <select value={startMaand} onChange={e => setStartMaand(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {maanden.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Tot en met maand</label>
                <select value={eindMaand} onChange={e => setEindMaand(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {maanden.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                </select>
              </div>
            </div>
            {parseFloat(maandBedrag) > 0 && (
              <p className="text-xs text-slate-400 mt-2">
                → {parseInt(eindMaand) - parseInt(startMaand) + 1} aankopen × €{parseFloat(maandBedrag).toFixed(2)} = <span className="text-white font-medium">€{((parseInt(eindMaand) - parseInt(startMaand) + 1) * parseFloat(maandBedrag)).toFixed(2)}</span> totaal
              </p>
            )}
          </div>
        </div>
      )}

      {modus === 'bedrag' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Datum</label>
            <input type="date" value={datum} onChange={e => setDatum(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Bedrag (€) <span className="text-slate-500">koers/aantal onbekend</span></label>
            <input type="number" step="0.01" value={bedrag} onChange={e => setBedrag(e.target.value)}
              placeholder="bijv. 100.00"
              className="w-full bg-slate-700 border border-blue-600/40 text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      )}

      {modus === 'enkel' && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Datum</label>
              <input type="date" value={datum} onChange={e => setDatum(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Aantal</label>
              <input type="number" step="0.001" value={aantal} onChange={e => setAantal(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">
                Koers {transValuta !== 'EUR' ? transValuta : '(€)'}
              </label>
              <input type="number" step="0.0001" value={prijs} onChange={e => setPrijs(e.target.value)}
                className={`w-full bg-slate-700 border text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 ${
                  transValuta !== 'EUR' ? 'border-amber-700/50 focus:ring-amber-500' : 'border-slate-600 focus:ring-blue-500'
                }`} />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Totaal (€)</label>
              <div className={`border rounded-lg px-2 py-1.5 text-sm font-medium ${
                transValuta !== 'EUR' && eurTotaal
                  ? 'bg-emerald-900/20 border-emerald-700/40 text-emerald-300'
                  : 'bg-slate-700/50 border-slate-700 text-slate-300'
              }`}>
                {transValuta !== 'EUR' && eurTotaal
                  ? `€${eurTotaal.toFixed(2)}`
                  : totaal > 0 ? `€${totaal.toFixed(2)}` : '—'}
              </div>
            </div>
          </div>
          {/* Valuta toggle — compact onder de velden */}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-slate-500">Valuta:</span>
            <div className="flex gap-1">
              <button type="button" onClick={() => { setTransValuta('EUR'); setTransWisselkoers(null); }}
                className={`px-2 py-0.5 rounded text-xs transition-colors ${transValuta === 'EUR' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}>
                € EUR
              </button>
              {VALUTA_LIJST.filter(v => v.code !== 'EUR').map(v => (
                <button key={v.code} type="button"
                  onClick={() => { setTransValuta(v.code); setTransWisselkoers(null); }}
                  className={`px-2 py-0.5 rounded text-xs transition-colors ${transValuta === v.code ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}>
                  {v.symbool} {v.code}
                </button>
              ))}
            </div>
            {transValuta !== 'EUR' && (
              <button type="button" onClick={haalTransWisselkoers} disabled={loadingTransWk || !datum}
                className="ml-auto flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50">
                {loadingTransWk ? <Loader className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                Koers {datum ? datum.slice(0,10) : ''}
              </button>
            )}
            {transValuta !== 'EUR' && transWisselkoers && (
              <span className="text-xs text-amber-400/70 ml-1">
                1 {transValuta} = €{transWisselkoers.toFixed(4)}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-2 mt-3">
        <button onClick={handleOpslaan} disabled={!kanOpslaan}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg px-3 py-1.5 text-xs font-medium flex items-center gap-1">
          <Check className="w-3 h-3" />
          {modus === 'maandelijks'
            ? `${parseInt(eindMaand) - parseInt(startMaand) + 1} aankopen genereren`
            : 'Toevoegen'}
        </button>
        <button onClick={onCancel} className="text-slate-400 text-xs px-2">Annuleren</button>
      </div>
    </div>
  );
}

function PositieKaart({ positie, year, onUpdate, onVerwijder }) {
  const [open, setOpen] = useState(false);
  const [bewerken, setBewerken] = useState(false);
  const [toonAankoop, setToonAankoop] = useState(false);
  const [toonVerkoop, setToonVerkoop] = useState(false);
  const [toonAankoopDetail, setToonAankoopDetail] = useState(false);
  const [toonVerkoopDetail, setToonVerkoopDetail] = useState(false);

  const r = berekenPositieRendement(positie);
  const pos = r.totaalRendement >= 0;

  const voegTransactieToe = async (type, transacties) => {
    // transacties is altijd een array (enkelvoudig of meerdere)
    const nieuw = Array.isArray(transacties) ? transacties : [transacties];
    const huidig = positie[type] || [];
    await onUpdate(positie.id, { [type]: [...huidig, ...nieuw] });
    type === 'aankopen' ? setToonAankoop(false) : setToonVerkoop(false);
  };

  const verwijderTransactie = async (type, idx) => {
    const huidig = [...(positie[type] || [])];
    huidig.splice(idx, 1);
    await onUpdate(positie.id, { [type]: huidig });
  };

  const updateTransactie = async (type, idx, nieuw) => {
    const huidig = [...(positie[type] || [])];
    huidig[idx] = nieuw;
    await onUpdate(positie.id, { [type]: huidig });
  };

  const handleBewerkenOpslaan = async (data) => {
    await onUpdate(positie.id, data);
    setBewerken(false);
  };

  if (bewerken) {
    return (
      <PositieForm
        year={year}
        initial={positie}
        onSave={handleBewerkenOpslaan}
        onCancel={() => setBewerken(false)}
      />
    );
  }

  return (
    <div className="bg-slate-800/40 border border-slate-700 rounded-2xl overflow-hidden">
      <div className="p-4 flex items-start gap-3 cursor-pointer" onClick={() => setOpen(!open)}>
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${pos ? 'bg-emerald-400' : 'bg-red-400'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white">{positie.naam}</span>
            <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">{positie.type}</span>
            {positie.valuta && positie.valuta !== 'EUR' && (
              <span className="text-xs bg-amber-900/40 text-amber-400 border border-amber-700/40 px-2 py-0.5 rounded-full">
                💱 {positie.valuta}
              </span>
            )}
            {positie.maandelijks_bedrag > 0 && (
              <span className="text-xs bg-blue-900/40 text-blue-400 border border-blue-800/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Repeat className="w-2.5 h-2.5" /> €{positie.maandelijks_bedrag}/mnd
              </span>
            )}
            {positie.ticker && <span className="text-xs text-blue-400 font-mono">{positie.ticker}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm">
            <span className="text-slate-400">1/1/{year}: {formatEuro(r.waardeJan1)}</span>
            <span className="text-slate-400">31/12/{year}: {formatEuro(r.waardeDec31)}</span>
            <span className={`font-medium ${pos ? 'text-emerald-400' : 'text-red-400'}`}>
              {pos ? '+' : ''}{formatEuro(r.totaalRendement)} ({formatPct(r.rendementPct)})
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => setBewerken(true)}
            className="text-slate-500 hover:text-blue-400 p-1.5 transition-colors" title="Bewerken">
            <Edit3 className="w-4 h-4" />
          </button>
          <button onClick={() => onVerwijder(positie.id)}
            className="text-slate-500 hover:text-red-400 p-1.5 transition-colors" title="Verwijderen">
            <Trash2 className="w-4 h-4" />
          </button>
          <div className="pl-1">
            {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </div>
        </div>
      </div>

      {open && (
        <div className="border-t border-slate-700 p-3 space-y-3">

          {/* Waarden tabel — compact 3-koloms op mobiel */}
          <div className="bg-slate-900/50 rounded-xl overflow-hidden">
            <div className="grid grid-cols-3 text-xs text-slate-500 border-b border-slate-800">
              <div className="px-3 py-2"></div>
              <div className="px-3 py-2 text-right border-l border-slate-800">1 jan</div>
              <div className="px-3 py-2 text-right border-l border-slate-800">31 dec</div>
            </div>
            {positie.jan1_aantal > 0 || positie.dec31_aantal > 0 ? (
              <div className="grid grid-cols-3 text-sm border-b border-slate-800/60">
                <div className="px-3 py-2 text-slate-400 text-xs flex items-center">Aantal</div>
                <div className="px-3 py-2 text-right text-white border-l border-slate-800/60">{positie.jan1_aantal}</div>
                <div className="px-3 py-2 text-right text-white border-l border-slate-800/60">{positie.dec31_aantal}</div>
              </div>
            ) : null}
            {positie.jan1_prijs > 0 || positie.dec31_prijs > 0 ? (
              <div className="grid grid-cols-3 text-sm border-b border-slate-800/60">
                <div className="px-3 py-2 text-slate-400 text-xs flex items-center">
                  Koers {positie.valuta && positie.valuta !== 'EUR' && (
                    <span className="ml-1 text-amber-500/70">€</span>
                  )}
                </div>
                <div className="px-3 py-2 text-right border-l border-slate-800/60">
                  <div className="text-white">{formatEuro(positie.jan1_prijs)}</div>
                  {positie.valuta !== 'EUR' && positie.jan1_koers_lokaal > 0 && (
                    <div className="text-xs text-amber-500/70">{positie.valuta} {positie.jan1_koers_lokaal.toFixed(2)}</div>
                  )}
                </div>
                <div className="px-3 py-2 text-right border-l border-slate-800/60">
                  <div className="text-white">{formatEuro(positie.dec31_prijs)}</div>
                  {positie.valuta !== 'EUR' && positie.dec31_koers_lokaal > 0 && (
                    <div className="text-xs text-amber-500/70">{positie.valuta} {positie.dec31_koers_lokaal.toFixed(2)}</div>
                  )}
                </div>
              </div>
            ) : null}
            <div className="grid grid-cols-3 text-sm">
              <div className="px-3 py-2 text-slate-400 text-xs flex items-center">Waarde</div>
              <div className="px-3 py-2 text-right font-medium text-white border-l border-slate-800/60">{formatEuro(r.waardeJan1)}</div>
              <div className="px-3 py-2 text-right font-medium text-white border-l border-slate-800/60">{formatEuro(r.waardeDec31)}</div>
            </div>
          </div>

          {/* Inkomen & kosten — één compacte regel */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs">
            <span className="text-slate-500">
              Koersresultaat: <span className={r.koersresultaat >= 0 ? 'text-emerald-400' : 'text-red-400'}>{formatEuro(r.koersresultaat)}</span>
            </span>
            {positie.dividend > 0 && (
              <span className="text-slate-500">Dividend: <span className="text-white">{formatEuro(positie.dividend)}</span></span>
            )}
            {positie.rente > 0 && (
              <span className="text-slate-500">Rente: <span className="text-white">{formatEuro(positie.rente)}</span></span>
            )}
            {r.kosten > 0 && (
              <span className="text-slate-500">Kosten: <span className="text-red-400">-{formatEuro(r.kosten)}</span></span>
            )}
            <span className="text-slate-500">
              Totaal: <span className={`font-semibold ${pos ? 'text-emerald-400' : 'text-red-400'}`}>{formatEuro(r.totaalRendement)}</span>
            </span>
          </div>

          {/* Aankopen + Verkopen — ingeklapt met totaal, uitklappen voor details */}
          {(['aankopen', 'verkopen']).map(transType => {
            const isAankoop = transType === 'aankopen';
            const lijst = positie[transType] || [];
            const totaalBedrag = lijst.reduce((s, t) => s + (t.totaal || 0), 0);
            const kleur = isAankoop ? 'emerald' : 'red';
            const toonForm = isAankoop ? toonAankoop : toonVerkoop;
            const setToon = isAankoop ? setToonAankoop : setToonVerkoop;
            const [uitgeklapt, setUitgeklapt] = isAankoop
              ? [toonAankoopDetail, setToonAankoopDetail]
              : [toonVerkoopDetail, setToonVerkoopDetail];

            return (
              <div key={transType}>
                {/* Samengevouwen rij */}
                <div className="flex items-center gap-2 py-1.5">
                  <button
                    onClick={() => setUitgeklapt(!uitgeklapt)}
                    className="flex items-center gap-2 flex-1 text-left"
                  >
                    {uitgeklapt
                      ? <ChevronUp className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                      : <ChevronDown className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />}
                    <span className="text-sm font-medium text-slate-300">
                      {isAankoop ? 'Aankopen' : 'Verkopen'}
                    </span>
                    {lijst.length > 0 && (
                      <span className={`text-xs bg-${kleur}-900/40 text-${kleur}-400 px-1.5 py-0.5 rounded-full`}>
                        {lijst.length}
                      </span>
                    )}
                  </button>
                  {totaalBedrag > 0 && (
                    <span className={`text-sm font-semibold text-${kleur}-400`}>
                      {isAankoop ? '' : '-'}{formatEuro(totaalBedrag)}
                    </span>
                  )}
                  {isAankoop && positie.maandelijks_bedrag > 0 && (
                    <button
                      onClick={() => {
                        const bestaand = positie.aankopen || [];
                        const heeftAl = bestaand.some(a => a.auto && a.datum?.startsWith(year));
                        if (heeftAl && !window.confirm('Er zijn al automatische aankopen voor dit jaar. Opnieuw genereren?')) return;
                        const nieuw = Array.from({length: 12}, (_, i) => ({
                          datum: `${year}-${String(i+1).padStart(2,'0')}-01`,
                          aantal: 0, prijs: 0, totaal: positie.maandelijks_bedrag, auto: true,
                        }));
                        const zonder = bestaand.filter(a => !(a.auto && a.datum?.startsWith(year)));
                        onUpdate(positie.id, { aankopen: [...zonder, ...nieuw] });
                      }}
                      className="text-xs bg-blue-600/20 text-blue-400 border border-blue-600/30 rounded-full px-1.5 py-0.5 flex items-center gap-0.5 flex-shrink-0"
                      title="Genereer maandelijkse aankopen"
                    >
                      <Repeat className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    onClick={() => { setToon(!toonForm); setUitgeklapt(true); }}
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 flex-shrink-0"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                {/* Formulier */}
                {toonForm && (
                  <TransactieForm
                    type={isAankoop ? 'aankoop' : 'verkoop'}
                    year={year}
                    onSave={t => voegTransactieToe(transType, t)}
                    onCancel={() => setToon(false)}
                  />
                )}

                {/* Detail regels — alleen als uitgeklapt */}
                {uitgeklapt && lijst.length > 0 && (
                  <div className="space-y-1 mt-1">
                    {lijst.map((t, i) => (
                      <TransactieRij
                        key={i}
                        transactie={t}
                        type={isAankoop ? 'aankoop' : 'verkoop'}
                        kleur={kleur}
                        jaar={year}
                        onUpdate={(nieuw) => updateTransactie(transType, i, nieuw)}
                        onVerwijder={() => verwijderTransactie(transType, i)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

        </div>
      )}
    </div>
  );
}

export default function PositieLijst() {
  const { year, bankId, accountId } = useParams();
  const { user, setIsEditing } = useApp();
  const bank = useBank(user?.uid, year, bankId);
  const rekening = useRekening(user?.uid, year, bankId, accountId);
  const { posities, loading, voegPositieToe, updatePositie, verwijderPositie } = usePosities(user?.uid, year, bankId, accountId);
  const [toonForm, setToonForm] = useState(false);

  const totaal = posities.reduce((acc, p) => {
    const r = berekenPositieRendement(p);
    return { rendement: acc.rendement + r.totaalRendement, vermogen: acc.vermogen + r.waardeJan1 };
  }, { rendement: 0, vermogen: 0 });

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-2 text-sm text-slate-400">
        <Link to={`/jaar/${year}`} className="hover:text-white">Banken</Link>
        <span>/</span>
        <Link to={`/jaar/${year}/bank/${bankId}`} className="hover:text-white">Rekeningen</Link>
        <span>/</span>
        <span className="text-slate-300">Posities</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-blue-950/60 border border-blue-800/40 rounded-xl px-4 py-2.5 mb-4">
        <Calendar className="w-4 h-4 text-blue-400" />
        <span className="text-blue-300 text-sm">
          Je bekijkt en bewerkt gegevens voor belastingjaar <strong className="text-white">{year}</strong>
        </span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Posities</h1>
          <p className="text-slate-400 mt-1">
            {posities.length} posities · Vermogen 1/1/{year}: {formatEuro(totaal.vermogen)} ·
            <span className={`ml-1 ${totaal.rendement >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              Rendement: {formatEuro(totaal.rendement)}
            </span>
          </p>
        </div>
        <button onClick={() => setToonForm(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-4 py-2.5 text-sm font-medium">
          <Plus className="w-4 h-4" /> Positie toevoegen
        </button>
      </div>

      {toonForm && (
        <div className="mb-4">
          <PositieForm
            year={year}
            onSave={async (data) => { await voegPositieToe(data); setToonForm(false); }}
            onCancel={() => setToonForm(false)}
          />
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-slate-800 rounded-2xl animate-pulse" />)}</div>
      ) : posities.length === 0 && !toonForm ? (
        <div className="text-center py-16 bg-slate-800/30 border border-slate-700 rounded-2xl">
          <TrendingUp className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">Nog geen posities voor {year}</p>
          <p className="text-slate-500 text-sm mt-1">Voeg een positie toe of kopieer vanuit een vorig jaar via het dashboard</p>
          <button onClick={() => setToonForm(true)} className="mt-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-6 py-2.5 text-sm font-medium">
            <Plus className="w-4 h-4 inline mr-2" />Positie toevoegen
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {posities.map(p => (
            <PositieKaart
              key={p.id}
              positie={p}
              year={year}
              onUpdate={updatePositie}
              onVerwijder={(id) => window.confirm('Positie verwijderen?') && verwijderPositie(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

