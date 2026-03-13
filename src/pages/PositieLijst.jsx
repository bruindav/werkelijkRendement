// Fix 9 - Auto aantal berekenen + kosten per positie
// Fix 7 - Dec31 koers fix + transacties bewerkbaar
// Fix 3 - Ticker uitleg notatie per land
// Fix 3 - Ticker info note toegevoegd
// Fix 1 - Bewerken knop + jaar zichtbaar
import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { usePosities, useBank, useRekening } from '../hooks/useFirestore';
import Breadcrumb from '../components/Breadcrumb';
import { berekenPositieRendement, formatEuro, formatPct } from '../services/berekening';
import { zoekAandeel, haalKoersenVoorJaar } from '../services/koersApi';
import { Plus, Trash2, ChevronDown, ChevronUp, Search, TrendingUp, Edit3, Check, X, Loader, Calendar } from 'lucide-react';

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

function PositieForm({ onSave, onCancel, year, initial = null }) {
  const [form, setForm] = useState({
    naam: initial?.naam || '',
    type: initial?.type || 'aandeel',
    ticker: initial?.ticker || '',
    isin: initial?.isin || '',
    jan1_aantal: initial?.jan1_aantal || '',
    jan1_prijs: initial?.jan1_prijs || '',
    jan1_waarde: initial?.jan1_waarde || '',
    dec31_aantal: initial?.dec31_aantal || '',
    dec31_prijs: initial?.dec31_prijs || '',
    dec31_waarde: initial?.dec31_waarde || '',
    dividend: initial?.dividend || '',
    rente: initial?.rente || '',
    kosten: initial?.kosten || '',
  });
  const [loadingKoers, setLoadingKoers] = useState(false);

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

  const haalKoersen = async () => {
    if (!form.ticker) return;
    setLoadingKoers(true);
    try {
      const { jan1, dec31 } = await haalKoersenVoorJaar(form.ticker, year);
      if (jan1) {
        set('jan1_prijs', jan1.slotkoers.toString());
        if (form.jan1_aantal) set('jan1_waarde', (parseFloat(form.jan1_aantal) * jan1.slotkoers).toFixed(2));
      }
      if (dec31) {
        set('dec31_prijs', dec31.slotkoers.toString());
        if (form.dec31_aantal) set('dec31_waarde', (parseFloat(form.dec31_aantal) * dec31.slotkoers).toFixed(2));
      }
    } catch (e) { console.error('Koersen ophalen mislukt:', e); }
    setLoadingKoers(false);
  };

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
    onSave({
      naam: form.naam, type: form.type, ticker: form.ticker, isin: form.isin,
      jan1_aantal: parseFloat(form.jan1_aantal) || 0,
      jan1_prijs: parseFloat(form.jan1_prijs) || 0,
      jan1_waarde: parseFloat(form.jan1_waarde) || 0,
      dec31_aantal: parseFloat(form.dec31_aantal) || 0,
      dec31_prijs: parseFloat(form.dec31_prijs) || 0,
      dec31_waarde: parseFloat(form.dec31_waarde) || 0,
      dividend: parseFloat(form.dividend) || 0,
      rente: parseFloat(form.rente) || 0,
      kosten: parseFloat(form.kosten) || 0,
    });
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
          <div className="mt-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 space-y-1">
            <p className="text-xs font-medium text-slate-400">💡 Ticker notatie:</p>
            <p className="text-xs text-slate-500">🇳🇱 Nederlandse aandelen: <span className="text-slate-300 font-mono">ASML.AS</span>, <span className="text-slate-300 font-mono">PHIA.AS</span></p>
            <p className="text-xs text-slate-500">🇺🇸 Amerikaanse aandelen: <span className="text-slate-300 font-mono">AAPL</span>, <span className="text-slate-300 font-mono">MSFT</span></p>
            <p className="text-xs text-slate-500">🇩🇪 Duitse aandelen: <span className="text-slate-300 font-mono">SAP.DE</span>, <span className="text-slate-300 font-mono">BMW.DE</span></p>
            <p className="text-xs text-slate-500">🇫🇷 Franse aandelen: <span className="text-slate-300 font-mono">MC.PA</span>, <span className="text-slate-300 font-mono">AIR.PA</span></p>
            <p className="text-xs text-slate-500">📊 ETF: <span className="text-slate-300 font-mono">VWRL.AS</span>, <span className="text-slate-300 font-mono">IWDA.AS</span></p>
          </div>
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

      <div>
        <p className="text-sm font-medium text-slate-300 mb-3">📅 Waarden per 1 januari {year}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {numField('Aantal', 'jan1_aantal', 'jan1')}
          {numField('Prijs (€)', 'jan1_prijs', 'jan1')}
          {numField('Waarde (€)', 'jan1_waarde', 'jan1', true)}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-slate-300 mb-3">📅 Waarden per 31 december {year}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {numField('Aantal', 'dec31_aantal', 'dec31')}
          {numField('Prijs (€)', 'dec31_prijs', 'dec31')}
          {numField('Waarde (€)', 'dec31_waarde', 'dec31', true)}
        </div>
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


function TransactieRij({ transactie, kleur, onUpdate, onVerwijder }) {
  const [bewerken, setBewerken] = useState(false);
  const [datum, setDatum] = useState(transactie.datum);
  const [aantal, setAantal] = useState(transactie.aantal);
  const [prijs, setPrijs] = useState(transactie.prijs);
  const totaal = parseFloat(aantal) * parseFloat(prijs) || 0;

  const handleOpslaan = () => {
    onUpdate({ datum, aantal: parseFloat(aantal), prijs: parseFloat(prijs), totaal });
    setBewerken(false);
  };

  if (bewerken) {
    return (
      <div className="bg-slate-800 border border-blue-600/40 rounded-lg px-3 py-2">
        <div className="grid grid-cols-2 gap-2 mb-2">
          <input type="date" value={datum} onChange={e => setDatum(e.target.value)}
            className="bg-slate-700 border border-slate-600 text-white rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <input type="number" step="0.001" value={aantal} onChange={e => setAantal(e.target.value)}
            placeholder="Aantal"
            className="bg-slate-700 border border-slate-600 text-white rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <input type="number" step="0.01" value={prijs} onChange={e => setPrijs(e.target.value)}
            placeholder="Prijs"
            className="bg-slate-700 border border-slate-600 text-white rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <div className="bg-slate-700/50 border border-slate-700 text-slate-300 rounded px-2 py-1 text-xs">{totaal.toFixed(2)}</div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleOpslaan} className="bg-blue-600 hover:bg-blue-500 text-white rounded px-2 py-1 text-xs flex items-center gap-1">
            <Check className="w-3 h-3" /> Opslaan
          </button>
          <button onClick={() => setBewerken(false)} className="text-slate-400 text-xs px-2">Annuleren</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-x-3 gap-y-1 bg-slate-900/50 rounded-lg px-3 py-2 text-sm group">
      <span className="text-slate-400">{transactie.datum}</span>
      <span className="text-slate-300">{transactie.aantal} × {formatEuro(transactie.prijs)}</span>
      <span className={`text-${kleur}-400 font-medium`}>{formatEuro(transactie.totaal)}</span>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => setBewerken(true)} className="text-slate-500 hover:text-blue-400 p-0.5"><Edit3 className="w-3 h-3" /></button>
        <button onClick={onVerwijder} className="text-slate-500 hover:text-red-400 p-0.5"><X className="w-3 h-3" /></button>
      </div>
    </div>
  );
}

function TransactieForm({ type, onSave, onCancel }) {
  const [datum, setDatum] = useState('');
  const [aantal, setAantal] = useState('');
  const [prijs, setPrijs] = useState('');
  const totaal = parseFloat(aantal) * parseFloat(prijs) || 0;

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 mt-2">
      <p className="text-sm font-medium text-slate-300 mb-3">{type === 'aankoop' ? 'Aankoop' : 'Verkoop'} toevoegen</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
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
          <label className="text-xs text-slate-400 block mb-1">Prijs (€)</label>
          <input type="number" step="0.01" value={prijs} onChange={e => setPrijs(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Totaal (€)</label>
          <div className="bg-slate-700/50 border border-slate-700 text-slate-300 rounded-lg px-2 py-1.5 text-sm">{totaal.toFixed(2)}</div>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={() => onSave({ datum, aantal: parseFloat(aantal), prijs: parseFloat(prijs), totaal })}
          disabled={!datum || !aantal || !prijs}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg px-3 py-1.5 text-xs font-medium flex items-center gap-1">
          <Check className="w-3 h-3" /> Toevoegen
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

  const r = berekenPositieRendement(positie);
  const pos = r.totaalRendement >= 0;

  const voegTransactieToe = async (type, transactie) => {
    const huidig = positie[type] || [];
    await onUpdate(positie.id, { [type]: [...huidig, transactie] });
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
        <div className="border-t border-slate-700 p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: `1 jan ${year} - Aantal`, val: positie.jan1_aantal },
              { label: `1 jan ${year} - Prijs`, val: formatEuro(positie.jan1_prijs) },
              { label: `31 dec ${year} - Aantal`, val: positie.dec31_aantal },
              { label: `31 dec ${year} - Prijs`, val: formatEuro(positie.dec31_prijs) },
            ].map(({ label, val }) => (
              <div key={label} className="bg-slate-900/50 rounded-xl p-3">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="text-sm font-medium text-white mt-0.5">{val}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-slate-900/50 rounded-xl p-3">
              <p className="text-xs text-slate-500">Koersresultaat</p>
              <p className={`text-sm font-medium mt-0.5 ${r.koersresultaat >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatEuro(r.koersresultaat)}</p>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-3">
              <p className="text-xs text-slate-500">Dividend</p>
              <p className="text-sm font-medium text-white mt-0.5">{formatEuro(positie.dividend)}</p>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-3">
              <p className="text-xs text-slate-500">Rente</p>
              <p className="text-sm font-medium text-white mt-0.5">{formatEuro(positie.rente)}</p>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-3">
              <p className="text-xs text-slate-500">Kosten (aftrekbaar)</p>
              <p className="text-sm font-medium text-red-400 mt-0.5">-{formatEuro(r.kosten)}</p>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-3 col-span-2 sm:col-span-1">
              <p className="text-xs text-slate-500">Totaal rendement</p>
              <p className={`text-sm font-bold mt-0.5 ${pos ? 'text-emerald-400' : 'text-red-400'}`}>{formatEuro(r.totaalRendement)}</p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
              <p className="text-sm font-medium text-slate-300">Aankopen ({positie.aankopen?.length || 0})</p>
              <button onClick={() => setToonAankoop(!toonAankoop)} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                <Plus className="w-3 h-3" /> Toevoegen
              </button>
            </div>
            {toonAankoop && <TransactieForm type="aankoop" onSave={t => voegTransactieToe('aankopen', t)} onCancel={() => setToonAankoop(false)} />}
            {positie.aankopen?.length > 0 && (
              <div className="space-y-1 mt-2">
                {positie.aankopen.map((a, i) => (
                  <TransactieRij
                    key={i}
                    transactie={a}
                    kleur="emerald"
                    onUpdate={(t) => updateTransactie('aankopen', i, t)}
                    onVerwijder={() => verwijderTransactie('aankopen', i)}
                  />
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
              <p className="text-sm font-medium text-slate-300">Verkopen ({positie.verkopen?.length || 0})</p>
              <button onClick={() => setToonVerkoop(!toonVerkoop)} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                <Plus className="w-3 h-3" /> Toevoegen
              </button>
            </div>
            {toonVerkoop && <TransactieForm type="verkoop" onSave={t => voegTransactieToe('verkopen', t)} onCancel={() => setToonVerkoop(false)} />}
            {positie.verkopen?.length > 0 && (
              <div className="space-y-1 mt-2">
                {positie.verkopen.map((v, i) => (
                  <TransactieRij
                    key={i}
                    transactie={v}
                    kleur="red"
                    onUpdate={(t) => updateTransactie('verkopen', i, t)}
                    onVerwijder={() => verwijderTransactie('verkopen', i)}
                  />
                ))}
              </div>
            )}
          </div>
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

