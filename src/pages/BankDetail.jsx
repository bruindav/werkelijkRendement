// Fix 12 - Rekeningen met type: beleggen / sparen / deposito
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useRekeningen, useBank } from '../hooks/useFirestore';
import Breadcrumb from '../components/Breadcrumb';
import { CreditCard, TrendingUp, PiggyBank, Lock, Plus, Trash2, ArrowRight, X, Check, Edit3 } from 'lucide-react';

const REKENING_TYPES = [
  { value: 'beleggen',     label: 'Beleggingsrekening', icon: TrendingUp, kleur: 'purple', emoji: '📈' },
  { value: 'sparen',       label: 'Spaarrekening',      icon: PiggyBank,  kleur: 'emerald', emoji: '🏦' },
  { value: 'deposito',     label: 'Deposito',           icon: Lock,       kleur: 'amber',   emoji: '🔒' },
];

const typeInfo = (type) => REKENING_TYPES.find(t => t.value === type) || REKENING_TYPES[0];

function RekeningForm({ onSave, onCancel, initial = {} }) {
  const [naam, setNaam] = useState(initial.naam || '');
  const [type, setType] = useState(initial.type || 'beleggen');
  const [kosten, setKosten] = useState(initial.kosten || '');

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-4">
      {/* Type kiezen */}
      <div>
        <label className="block text-xs text-slate-400 mb-2">Type rekening</label>
        <div className="flex gap-2 flex-wrap">
          {REKENING_TYPES.map(t => (
            <button key={t.value} onClick={() => setType(t.value)}
              className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-colors text-center ${
                type === t.value
                  ? `bg-${t.kleur}-600/30 border border-${t.kleur}-500/50 text-${t.kleur}-300`
                  : 'bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700'
              }`}>
              <span className="block text-base mb-0.5">{t.emoji}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Naam + kosten */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex-1">
          <label className="block text-xs text-slate-400 mb-1">Naam rekening</label>
          <input autoFocus value={naam} onChange={e => setNaam(e.target.value)}
            placeholder={`bijv. ${typeInfo(type).label} ING`}
            className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={e => e.key === 'Enter' && naam && onSave({ naam, type, kosten: parseFloat(kosten) || 0 })} />
        </div>
        <div className="w-full sm:w-36">
          <label className="block text-xs text-slate-400 mb-1">Kosten (€) <span className="text-slate-500">aftrekbaar</span></label>
          <input type="number" step="0.01" value={kosten} onChange={e => setKosten(e.target.value)}
            placeholder="0.00"
            className="w-full bg-slate-800 border border-red-900/40 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={() => naam && onSave({ naam, type, kosten: parseFloat(kosten) || 0 })} disabled={!naam}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg px-3 py-2">
            <Check className="w-4 h-4" />
          </button>
          <button onClick={onCancel} className="text-slate-400 hover:text-white rounded-lg px-3 py-2">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function RekeningRij({ rek, year, bankId, onUpdate, onVerwijder }) {
  const [bewerken, setBewerken] = useState(false);
  const info = typeInfo(rek.type);
  const formatEuro = (v) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(v || 0);

  // Bepaal de doel-URL op basis van het type
  const doelUrl = rek.type === 'beleggen'
    ? `/jaar/${year}/bank/${bankId}/rekening/${rek.id}`
    : `/jaar/${year}/bank/${bankId}/rekening/${rek.id}/sparen`;

  if (bewerken) {
    return (
      <div className="mb-1">
        <RekeningForm
          initial={rek}
          onSave={async (data) => { await onUpdate(rek.id, data); setBewerken(false); }}
          onCancel={() => setBewerken(false)}
        />
      </div>
    );
  }

  return (
    <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-4 sm:p-5 flex items-center gap-3 group">
      <Link to={doelUrl} className="flex items-center gap-4 flex-1">
        <div className={`w-11 h-11 bg-${info.kleur}-600/20 border border-${info.kleur}-600/30 rounded-xl flex items-center justify-center text-xl`}>
          {info.emoji}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold text-white">{rek.naam}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full bg-${info.kleur}-900/40 text-${info.kleur}-400`}>
              {info.label}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            {rek.type === 'beleggen' ? 'Klik om posities te beheren' :
             rek.type === 'deposito' ? 'Klik om deposito te beheren' : 'Klik om spaargeld te beheren'}
            {rek.kosten > 0 && <span className="ml-2 text-red-400">· Kosten: -{formatEuro(rek.kosten)}</span>}
          </p>
        </div>
      </Link>
      <div className="flex items-center gap-1">
        <Link to={doelUrl} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mr-2">
          Beheer <ArrowRight className="w-4 h-4" />
        </Link>
        <button onClick={() => setBewerken(true)}
          className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-blue-400 transition-all p-2">
          <Edit3 className="w-4 h-4" />
        </button>
        <button onClick={() => onVerwijder(rek)}
          className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all p-2">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function BankDetail() {
  const { year, bankId } = useParams();
  const { user } = useApp();
  const bank = useBank(user?.uid, year, bankId);
  const { rekeningen, loading, voegRekeningToe, updateRekening, verwijderRekening } = useRekeningen(user?.uid, year, bankId);
  const [toonForm, setToonForm] = useState(false);

  const handleVerwijder = async (rek) => {
    if (window.confirm(`Rekening "${rek.naam}" verwijderen? Alle data wordt ook verwijderd.`)) {
      await verwijderRekening(rek.id);
    }
  };

  return (
    <div>
      <Breadcrumb items={[
        { label: `Jaar ${year}`, to: `/jaar/${year}` },
        { label: bank?.naam || 'Bank', to: `/jaar/${year}/bank/${bankId}` },
        { label: 'Rekeningen' },
      ]} />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">{bank?.naam || 'Rekeningen'}</h1>
          <p className="text-slate-400 mt-1">Belastingjaar {year}</p>
        </div>
        <button onClick={() => setToonForm(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-4 py-2.5 text-sm font-medium">
          <Plus className="w-4 h-4" /> Rekening toevoegen
        </button>
      </div>

      {toonForm && (
        <div className="mb-4">
          <RekeningForm
            onSave={async (data) => { await voegRekeningToe(data); setToonForm(false); }}
            onCancel={() => setToonForm(false)} />
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[...Array(2)].map((_, i) => <div key={i} className="h-20 bg-slate-800 rounded-2xl animate-pulse" />)}</div>
      ) : rekeningen.length === 0 && !toonForm ? (
        <div className="text-center py-16 bg-slate-800/30 border border-slate-700 rounded-2xl">
          <CreditCard className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">Nog geen rekeningen</p>
          <p className="text-slate-500 text-sm mt-1">Voeg een beleggings-, spaar- of depositorekening toe</p>
          <button onClick={() => setToonForm(true)} className="mt-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-6 py-2.5 text-sm font-medium">
            <Plus className="w-4 h-4 inline mr-2" />Rekening toevoegen
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rekeningen.map(rek => (
            <RekeningRij key={rek.id} rek={rek} year={year} bankId={bankId} onUpdate={updateRekening} onVerwijder={handleVerwijder} />
          ))}
        </div>
      )}
    </div>
  );
}
