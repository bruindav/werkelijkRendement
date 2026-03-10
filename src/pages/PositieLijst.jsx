import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { usePosities } from '../hooks/useFirestore';
import { berekenPositieRendement, formatEuro, formatPct } from '../services/berekening';
import { zoekAandeel, haalKoersOp, haalHistorischeKoers } from '../services/koersApi';
import { Plus, Trash2, ChevronLeft, ChevronDown, ChevronUp, Search, TrendingUp, TrendingDown, Edit3, Check, X, Loader } from 'lucide-react';

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

function PositieForm({ onSave, onCancel, year }) {
  const [form, setForm] = useState({
    naam: '', type: 'aandeel', ticker: '', isin: '',
    jan1_aantal: '', jan1_prijs: '', jan1_waarde: '',
    dec31_aantal: '', dec31_prijs: '', dec31_waarde: '',
    dividend: '', rente: '',
  });
  const [loadingKoers, setLoadingKoers] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Auto bereken waarde
  const berekenWaarde = (prefix) => {
    const aantal = parseFloat(form[`${prefix}_aantal`]);
    const prijs = parseFloat(form[`${prefix}_prijs`]);
    if (!isNaN(aantal) && !isNaN(prijs)) {
      set(`${prefix}_waarde`, (aantal * prijs).toFixed(2));
    }
  };

  const haalKoersen = async () => {
    if (!form.ticker) return;
    setLoadingKoers(true);
    try {
      const jan1Datum = `${year}-01-02`; // Eerste handelsdag
      const dec31Datum = `${year}-12-31`;
      const [jan1, dec31] = await Promise.all([
        haalHistorischeKoers(form.ticker, jan1Datum),
        haalHistorischeKoers(form.ticker, dec31Datum),
      ]);
      if (jan1) {
        set('jan1_prijs', jan1.slotkoers.toString());
        if (form.jan1_aantal) set('jan1_waarde', (parseFloat(form.jan1_aantal) * jan1.slotkoers).toFixed(2));
      }
      if (dec31) {
        set('dec31_prijs', dec31.slotkoers.toString());
        if (form.dec31_aantal) set('dec31_waarde', (parseFloat(form.dec31_aantal) * dec31.slotkoers).toFixed(2));
      }
    } catch (e) {}
    setLoadingKoers(false);
  };

  const handleSelectAandeel = (r) => {
    set('naam', r.name);
    set('ticker', r.symbol);
  };

  const numField = (label, key, prefix) => (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <input
        type="number"
        step="0.01"
        value={form[key]}
        onChange={e => set(key, e.target.value)}
        onBlur={() => prefix && berekenWaarde(prefix)}
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
      aankopen: [], verkopen: [],
    });
  };

  return (
    <div className="bg-slate-900 border border-blue-600/30 rounded-2xl p-6 space-y-5">
      <h3 className="font-semibold text-white">Nieuwe positie toevoegen</h3>

      {/* Zoeker */}
      <div>
        <label className="block text-xs text-slate-400 mb-2">Zoek via ticker / naam (optioneel)</label>
        <KoersZoeker onSelect={handleSelectAandeel} />
      </div>

      {/* Basis info */}
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
            placeholder="bijv. ASML"
            className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">ISIN</label>
          <input value={form.isin} onChange={e => set('isin', e.target.value)}
            placeholder="bijv. NL0010273215"
            className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {/* Koersen ophalen */}
      {form.ticker && (
        <button onClick={haalKoersen} disabled={loadingKoers}
          className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 disabled:opacity-50">
          {loadingKoers ? <Loader className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Koersen automatisch ophalen voor {year}
        </button>
      )}

      {/* 1 januari */}
      <div>
        <p className="text-sm font-medium text-slate-300 mb-3">Waarden per 1 januari {year}</p>
        <div className="grid grid-cols-3 gap-3">
          {numField('Aantal', 'jan1_aantal', 'jan1')}
          {numField('Prijs (€)', 'jan1_prijs', 'jan1')}
          {numField('Waarde (€)', 'jan1_waarde', null)}
        </div>
      </div>

      {/* 31 december */}
      <div>
        <p className="text-sm font-medium text-slate-300 mb-3">Waarden per 31 december {year}</p>
        <div className="grid grid-cols-3 gap-3">
          {numField('Aantal', 'dec31_aantal', 'dec31')}
          {numField('Prijs (€)', 'dec31_prijs', 'dec31')}
          {numField('Waarde (€)', 'dec31_waarde', null)}
        </div>
      </div>

      {/* Inkomen */}
      <div>
        <p className="text-sm font-medium text-slate-300 mb-3">Inkomen</p>
        <div className="grid grid-cols-2 gap-3">
          {numField('Dividend ontvangen (€)', 'dividend', null)}
          {numField('Rente ontvangen (€)', 'rente', null)}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button onClick={handleSave} disabled={!form.naam}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl px-5 py-2.5 text-sm font-medium">
          <Check className="w-4 h-4" /> Opslaan
        </button>
        <button onClick={onCancel} className="text-slate-400 hover:text-white text-sm px-4 py-2.5">
          Annuleren
        </button>
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
          <label className="text-xs text-slate-400 block mb-1">Prijs (€)</label>
          <input type="number" step="0.01" value={prijs} onChange={e => setPrijs(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Totaal (€)</label>
          <div className="bg-slate-700/50 border border-slate-700 text-slate-300 rounded-lg px-2 py-1.5 text-sm">
            {totaal.toFixed(2)}
          </div>
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

function PositieKaart({ positie, onUpdate, onVerwijder }) {
  const [open, setOpen] = useState(false);
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

  return (
    <div className="bg-slate-800/40 border border-slate-700 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-4 flex items-center gap-3 cursor-pointer" onClick={() => setOpen(!open)}>
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${pos ? 'bg-emerald-400' : 'bg-red-400'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white">{positie.naam}</span>
            <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">{positie.type}</span>
            {positie.ticker && <span className="text-xs text-blue-400 font-mono">{positie.ticker}</span>}
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm">
            <span className="text-slate-400">Waarde 1/1: {formatEuro(r.waardeJan1)}</span>
            <span className="text-slate-400">31/12: {formatEuro(r.waardeDec31)}</span>
            <span className={`font-medium ${pos ? 'text-emerald-400' : 'text-red-400'}`}>
              {pos ? '+' : ''}{formatEuro(r.totaalRendement)} ({formatPct(r.rendementPct)})
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={(e) => { e.stopPropagation(); onVerwijder(positie.id); }}
            className="text-slate-600 hover:text-red-400 p-1.5 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
          {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </div>

      {/* Detail */}
      {open && (
        <div className="border-t border-slate-700 p-4 space-y-4">
          {/* Koers detail */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: '1 jan - Aantal', val: positie.jan1_aantal },
              { label: '1 jan - Prijs', val: formatEuro(positie.jan1_prijs) },
              { label: '31 dec - Aantal', val: positie.dec31_aantal },
              { label: '31 dec - Prijs', val: formatEuro(positie.dec31_prijs) },
            ].map(({ label, val }) => (
              <div key={label} className="bg-slate-900/50 rounded-xl p-3">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="text-sm font-medium text-white mt-0.5">{val}</p>
              </div>
            ))}
          </div>

          {/* Rendement detail */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
              <p className="text-xs text-slate-500">Totaal rendement</p>
              <p className={`text-sm font-bold mt-0.5 ${pos ? 'text-emerald-400' : 'text-red-400'}`}>{formatEuro(r.totaalRendement)}</p>
            </div>
          </div>

          {/* Aankopen */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-slate-300">Aankopen ({positie.aankopen?.length || 0})</p>
              <button onClick={() => setToonAankoop(!toonAankoop)} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                <Plus className="w-3 h-3" /> Toevoegen
              </button>
            </div>
            {toonAankoop && <TransactieForm type="aankoop" onSave={t => voegTransactieToe('aankopen', t)} onCancel={() => setToonAankoop(false)} />}
            {positie.aankopen?.length > 0 && (
              <div className="space-y-1 mt-2">
                {positie.aankopen.map((a, i) => (
                  <div key={i} className="flex items-center justify-between bg-slate-900/50 rounded-lg px-3 py-2 text-sm">
                    <span className="text-slate-400">{a.datum}</span>
                    <span className="text-slate-300">{a.aantal} × {formatEuro(a.prijs)}</span>
                    <span className="text-emerald-400 font-medium">{formatEuro(a.totaal)}</span>
                    <button onClick={() => verwijderTransactie('aankopen', i)} className="text-slate-600 hover:text-red-400 ml-2"><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Verkopen */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-slate-300">Verkopen ({positie.verkopen?.length || 0})</p>
              <button onClick={() => setToonVerkoop(!toonVerkoop)} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                <Plus className="w-3 h-3" /> Toevoegen
              </button>
            </div>
            {toonVerkoop && <TransactieForm type="verkoop" onSave={t => voegTransactieToe('verkopen', t)} onCancel={() => setToonVerkoop(false)} />}
            {positie.verkopen?.length > 0 && (
              <div className="space-y-1 mt-2">
                {positie.verkopen.map((v, i) => (
                  <div key={i} className="flex items-center justify-between bg-slate-900/50 rounded-lg px-3 py-2 text-sm">
                    <span className="text-slate-400">{v.datum}</span>
                    <span className="text-slate-300">{v.aantal} × {formatEuro(v.prijs)}</span>
                    <span className="text-red-400 font-medium">{formatEuro(v.totaal)}</span>
                    <button onClick={() => verwijderTransactie('verkopen', i)} className="text-slate-600 hover:text-red-400 ml-2"><X className="w-3 h-3" /></button>
                  </div>
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
  const { user } = useApp();
  const { posities, loading, voegPositieToe, updatePositie, verwijderPositie } = usePosities(user?.uid, year, bankId, accountId);
  const [toonForm, setToonForm] = useState(false);

  const totaal = posities.reduce((acc, p) => {
    const r = berekenPositieRendement(p);
    return { rendement: acc.rendement + r.totaalRendement, vermogen: acc.vermogen + r.waardeJan1 };
  }, { rendement: 0, vermogen: 0 });

  return (
    <div>
      <div className="flex items-center gap-2 mb-2 text-sm text-slate-400">
        <Link to={`/jaar/${year}`} className="hover:text-white">Banken</Link>
        <span>/</span>
        <Link to={`/jaar/${year}/bank/${bankId}`} className="hover:text-white">Rekeningen</Link>
        <span>/</span>
        <span className="text-slate-300">Posities</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Posities</h1>
          <p className="text-slate-400 mt-1">
            {posities.length} posities · Vermogen 1/1: {formatEuro(totaal.vermogen)} ·
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
          <PositieForm year={year} onSave={async (data) => { await voegPositieToe(data); setToonForm(false); }} onCancel={() => setToonForm(false)} />
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-slate-800 rounded-2xl animate-pulse" />)}</div>
      ) : posities.length === 0 && !toonForm ? (
        <div className="text-center py-16 bg-slate-800/30 border border-slate-700 rounded-2xl">
          <TrendingUp className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">Nog geen posities</p>
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
              onUpdate={updatePositie}
              onVerwijder={(id) => window.confirm('Positie verwijderen?') && verwijderPositie(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
