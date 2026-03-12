// Fix 11 - Spaarrekeningen & deposito's
import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useSpaargelden } from '../hooks/useFirestore';
import { PiggyBank, Plus, Trash2, Edit3, Check, X, ChevronLeft, ChevronDown, ChevronUp, Calendar, Percent, TrendingUp } from 'lucide-react';

const formatEuro = (v) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(v || 0);
const formatPct = (v) => `${(v || 0).toFixed(2)}%`;

const UITBETALING_OPTIES = [
  { value: 'maandelijks', label: 'Maandelijks' },
  { value: 'kwartaal', label: 'Per kwartaal' },
  { value: 'jaarlijks', label: 'Jaarlijks' },
  { value: 'einde_looptijd', label: 'Einde looptijd' },
  { value: 'bijgeschreven', label: 'Bijgeschreven op deposito' },
];

function SpaarForm({ onSave, onCancel, initial = {}, year }) {
  const [form, setForm] = useState({
    naam: initial.naam || '',
    type: initial.type || 'spaarrekening', // spaarrekening | deposito
    rente_pct: initial.rente_pct || '',
    jan1_saldo: initial.jan1_saldo || '',
    dec31_saldo: initial.dec31_saldo || '',
    deposito_einddatum: initial.deposito_einddatum || '',
    uitbetaling_type: initial.uitbetaling_type || 'jaarlijks',
    ontvangen_rente: initial.ontvangen_rente || '',
    kosten: initial.kosten || '',
    notitie: initial.notitie || '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Bereken verwachte rente op basis van saldo en percentage
  const berekenVerwachteRente = () => {
    const saldo = parseFloat(form.jan1_saldo);
    const pct = parseFloat(form.rente_pct);
    if (!isNaN(saldo) && !isNaN(pct)) {
      return (saldo * pct / 100).toFixed(2);
    }
    return null;
  };

  const verwacht = berekenVerwachteRente();

  const handleSave = () => {
    if (!form.naam) return;
    onSave({
      naam: form.naam,
      type: form.type,
      rente_pct: parseFloat(form.rente_pct) || 0,
      jan1_saldo: parseFloat(form.jan1_saldo) || 0,
      dec31_saldo: parseFloat(form.dec31_saldo) || 0,
      deposito_einddatum: form.deposito_einddatum || null,
      uitbetaling_type: form.uitbetaling_type,
      ontvangen_rente: parseFloat(form.ontvangen_rente) || 0,
      kosten: parseFloat(form.kosten) || 0,
      notitie: form.notitie || '',
    });
  };

  return (
    <div className="bg-slate-800 border border-slate-600 rounded-2xl p-5 space-y-5">
      {/* Type & Naam */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Type</label>
          <div className="flex gap-2">
            {['spaarrekening', 'deposito'].map(t => (
              <button key={t} onClick={() => set('type', t)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors capitalize ${
                  form.type === t ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                }`}>
                {t === 'spaarrekening' ? '🏦 Spaarrekening' : '🔒 Deposito'}
              </button>
            ))}
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-slate-400 mb-1">Naam</label>
          <input autoFocus value={form.naam} onChange={e => set('naam', e.target.value)}
            placeholder={form.type === 'deposito' ? 'bijv. ING Deposito 3 jaar' : 'bijv. ING Spaarrekening'}
            className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {/* Saldi */}
      <div>
        <p className="text-sm font-medium text-slate-300 mb-3">💰 Saldo {year}</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Saldo 1 januari (€)</label>
            <input type="number" step="0.01" value={form.jan1_saldo} onChange={e => set('jan1_saldo', e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Saldo 31 december (€)</label>
            <input type="number" step="0.01" value={form.dec31_saldo} onChange={e => set('dec31_saldo', e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      </div>

      {/* Rente */}
      <div>
        <p className="text-sm font-medium text-slate-300 mb-3">📈 Rente {year}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Rente % (per jaar)</label>
            <div className="relative">
              <input type="number" step="0.01" value={form.rente_pct} onChange={e => set('rente_pct', e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 pr-7 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <span className="absolute right-2 top-2 text-slate-400 text-sm">%</span>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Ontvangen rente (€)
              {verwacht && <span className="ml-1 text-emerald-500">≈ {verwacht} verwacht</span>}
            </label>
            <input type="number" step="0.01" value={form.ontvangen_rente} onChange={e => set('ontvangen_rente', e.target.value)}
              placeholder={verwacht || '0.00'}
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Uitbetaling</label>
            <select value={form.uitbetaling_type} onChange={e => set('uitbetaling_type', e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {UITBETALING_OPTIES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Kosten (€) <span className="text-slate-500">aftrekbaar</span></label>
            <input type="number" step="0.01" value={form.kosten} onChange={e => set('kosten', e.target.value)}
              className="w-full bg-slate-700 border border-red-900/40 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
        </div>
      </div>

      {/* Deposito extra velden */}
      {form.type === 'deposito' && (
        <div>
          <p className="text-sm font-medium text-slate-300 mb-3">🔒 Deposito details</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Einddatum deposito</label>
              <input type="date" value={form.deposito_einddatum} onChange={e => set('deposito_einddatum', e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Notitie</label>
              <input value={form.notitie} onChange={e => set('notitie', e.target.value)}
                placeholder="bijv. automatisch verlengd"
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button onClick={handleSave} disabled={!form.naam}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl px-4 py-2 text-sm font-medium">
          <Check className="w-4 h-4" /> Opslaan
        </button>
        <button onClick={onCancel} className="text-slate-400 hover:text-white text-sm px-3">Annuleren</button>
      </div>
    </div>
  );
}

function SpaarKaart({ spaar, year, onUpdate, onVerwijder }) {
  const [open, setOpen] = useState(false);
  const [bewerken, setBewerken] = useState(false);

  const rendement = (spaar.ontvangen_rente || 0) - (spaar.kosten || 0);
  const saldoGroei = (spaar.dec31_saldo || 0) - (spaar.jan1_saldo || 0);
  const isDeposito = spaar.type === 'deposito';

  // Check of deposito bijna afloopt
  const dagenTotEinde = spaar.deposito_einddatum
    ? Math.ceil((new Date(spaar.deposito_einddatum) - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  if (bewerken) {
    return (
      <SpaarForm
        initial={spaar}
        year={year}
        onSave={async (data) => { await onUpdate(spaar.id, data); setBewerken(false); }}
        onCancel={() => setBewerken(false)}
      />
    );
  }

  return (
    <div className="bg-slate-800/40 border border-slate-700 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-5 flex items-center gap-4 group">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isDeposito ? 'bg-amber-600/20 border border-amber-600/30' : 'bg-emerald-600/20 border border-emerald-600/30'
        }`}>
          {isDeposito ? <span className="text-xl">🔒</span> : <span className="text-xl">🏦</span>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-white">{spaar.naam}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              isDeposito ? 'bg-amber-900/40 text-amber-400' : 'bg-emerald-900/40 text-emerald-400'
            }`}>
              {isDeposito ? 'Deposito' : 'Spaarrekening'}
            </span>
            {spaar.rente_pct > 0 && (
              <span className="text-xs text-blue-400 flex items-center gap-0.5">
                <Percent className="w-3 h-3" />{spaar.rente_pct}%
              </span>
            )}
            {dagenTotEinde !== null && dagenTotEinde <= 90 && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                dagenTotEinde <= 30 ? 'bg-red-900/40 text-red-400' : 'bg-orange-900/40 text-orange-400'
              }`}>
                ⏰ Loopt af {dagenTotEinde <= 0 ? '(verlopen)' : `over ${dagenTotEinde} dagen`}
              </span>
            )}
          </div>
          <div className="flex gap-4 mt-1 text-sm">
            <span className="text-slate-400">Saldo: <span className="text-white">{formatEuro(spaar.dec31_saldo || spaar.jan1_saldo)}</span></span>
            <span className="text-emerald-400">Rente: {formatEuro(spaar.ontvangen_rente)}</span>
            {spaar.kosten > 0 && <span className="text-red-400">Kosten: -{formatEuro(spaar.kosten)}</span>}
            <span className={rendement >= 0 ? 'text-emerald-400 font-medium' : 'text-red-400 font-medium'}>
              Rendement: {formatEuro(rendement)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setBewerken(true)}
            className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-blue-400 transition-all p-2">
            <Edit3 className="w-4 h-4" />
          </button>
          <button onClick={() => onVerwijder(spaar)}
            className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all p-2">
            <Trash2 className="w-4 h-4" />
          </button>
          <button onClick={() => setOpen(!open)} className="text-slate-400 hover:text-white p-2">
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Detail */}
      {open && (
        <div className="border-t border-slate-700/50 p-5 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-900/50 rounded-xl p-3">
              <p className="text-xs text-slate-500">Saldo 1 jan</p>
              <p className="text-sm font-medium text-white mt-0.5">{formatEuro(spaar.jan1_saldo)}</p>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-3">
              <p className="text-xs text-slate-500">Saldo 31 dec</p>
              <p className="text-sm font-medium text-white mt-0.5">{formatEuro(spaar.dec31_saldo)}</p>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-3">
              <p className="text-xs text-slate-500">Saldogroei</p>
              <p className={`text-sm font-medium mt-0.5 ${saldoGroei >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatEuro(saldoGroei)}</p>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-3">
              <p className="text-xs text-slate-500">Rente %</p>
              <p className="text-sm font-medium text-blue-400 mt-0.5">{formatPct(spaar.rente_pct)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-900/50 rounded-xl p-3">
              <p className="text-xs text-slate-500">Ontvangen rente</p>
              <p className="text-sm font-medium text-emerald-400 mt-0.5">{formatEuro(spaar.ontvangen_rente)}</p>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-3">
              <p className="text-xs text-slate-500">Uitbetaling</p>
              <p className="text-sm font-medium text-white mt-0.5 capitalize">
                {UITBETALING_OPTIES.find(o => o.value === spaar.uitbetaling_type)?.label || '-'}
              </p>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-3">
              <p className="text-xs text-slate-500">Kosten</p>
              <p className="text-sm font-medium text-red-400 mt-0.5">-{formatEuro(spaar.kosten)}</p>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-3">
              <p className="text-xs text-slate-500">Netto rendement</p>
              <p className={`text-sm font-bold mt-0.5 ${rendement >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatEuro(rendement)}</p>
            </div>
          </div>

          {isDeposito && spaar.deposito_einddatum && (
            <div className="bg-amber-900/20 border border-amber-700/30 rounded-xl p-3 flex items-center gap-3">
              <Calendar className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <div>
                <p className="text-xs text-amber-400 font-medium">Deposito looptijd</p>
                <p className="text-sm text-white">
                  Einddatum: {new Date(spaar.deposito_einddatum).toLocaleDateString('nl-NL')}
                  {dagenTotEinde !== null && (
                    <span className="ml-2 text-amber-400">
                      ({dagenTotEinde <= 0 ? 'verlopen' : `nog ${dagenTotEinde} dagen`})
                    </span>
                  )}
                </p>
                {spaar.notitie && <p className="text-xs text-slate-400 mt-0.5">{spaar.notitie}</p>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SpaarpaginaLijst() {
  const { year, bankId, accountId } = useParams();
  const { user, setIsEditing } = useApp();
  const { spaargelden, loading, voegSpaargeldToe, updateSpaargeld, verwijderSpaargeld } =
    useSpaargelden(user?.uid, year, bankId, accountId);
  const [toonForm, setToonForm] = useState(false);

  const totaalRendement = spaargelden.reduce((sum, s) =>
    sum + (s.ontvangen_rente || 0) - (s.kosten || 0), 0);
  const totaalSaldo = spaargelden.reduce((sum, s) =>
    sum + (s.dec31_saldo || s.jan1_saldo || 0), 0);

  const openForm = () => { setToonForm(true); setIsEditing(true); };
  const sluitForm = () => { setToonForm(false); setIsEditing(false); };

  const handleVerwijder = async (s) => {
    if (window.confirm(`"${s.naam}" verwijderen?`)) {
      await verwijderSpaargeld(s.id);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <Link to={`/jaar/${year}/bank/${bankId}`} className="text-slate-400 hover:text-white flex items-center gap-1 text-sm">
          <ChevronLeft className="w-4 h-4" /> Terug
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <PiggyBank className="w-6 h-6 text-emerald-400" /> Spaargelden & Deposito's
          </h1>
          <p className="text-slate-400 mt-1">Belastingjaar {year}</p>
        </div>
        <button onClick={openForm}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-4 py-2.5 text-sm font-medium">
          <Plus className="w-4 h-4" /> Toevoegen
        </button>
      </div>

      {/* Totalen balk */}
      {spaargelden.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
            <p className="text-xs text-slate-500">Totaal saldo</p>
            <p className="text-xl font-bold text-white mt-1">{formatEuro(totaalSaldo)}</p>
          </div>
          <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
            <p className="text-xs text-slate-500">Totaal rendement (rente - kosten)</p>
            <p className={`text-xl font-bold mt-1 ${totaalRendement >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatEuro(totaalRendement)}
            </p>
          </div>
        </div>
      )}

      {toonForm && (
        <div className="mb-4">
          <SpaarForm year={year}
            onSave={async (data) => { await voegSpaargeldToe(data); sluitForm(); }}
            onCancel={sluitForm} />
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[...Array(2)].map((_, i) => <div key={i} className="h-24 bg-slate-800 rounded-2xl animate-pulse" />)}</div>
      ) : spaargelden.length === 0 && !toonForm ? (
        <div className="text-center py-16 bg-slate-800/30 border border-slate-700 rounded-2xl">
          <PiggyBank className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">Nog geen spaargelden of deposito's</p>
          <button onClick={openForm} className="mt-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-6 py-2.5 text-sm font-medium">
            <Plus className="w-4 h-4 inline mr-2" />Toevoegen
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {spaargelden.map(s => (
            <SpaarKaart key={s.id} spaar={s} year={year}
              onUpdate={updateSpaargeld}
              onVerwijder={handleVerwijder} />
          ))}
        </div>
      )}
    </div>
  );
}
