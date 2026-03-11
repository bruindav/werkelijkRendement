// Fix 8 - Bank naam wijzigen
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useBanken } from '../hooks/useFirestore';
import { Building2, Plus, Trash2, ArrowRight, X, Check, Edit3 } from 'lucide-react';

function BankForm({ onSave, onCancel, initial = {} }) {
  const [naam, setNaam] = useState(initial.naam || '');
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 flex gap-3 items-center">
      <input autoFocus value={naam} onChange={e => setNaam(e.target.value)}
        placeholder="Naam bank / broker (bijv. ING, DeGiro...)"
        className="flex-1 bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        onKeyDown={e => e.key === 'Enter' && naam && onSave({ naam })} />
      <button onClick={() => naam && onSave({ naam })} disabled={!naam}
        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg px-3 py-2">
        <Check className="w-4 h-4" />
      </button>
      <button onClick={onCancel} className="text-slate-400 hover:text-white rounded-lg px-3 py-2">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

function BankRij({ bank, year, onUpdate, onVerwijder }) {
  const [bewerken, setBewerken] = useState(false);

  if (bewerken) {
    return (
      <div className="mb-1">
        <BankForm
          initial={bank}
          onSave={async (data) => { await onUpdate(bank.id, data); setBewerken(false); }}
          onCancel={() => setBewerken(false)}
        />
      </div>
    );
  }

  return (
    <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-5 flex items-center justify-between group">
      <Link to={`/jaar/${year}/bank/${bank.id}`} className="flex items-center gap-4 flex-1">
        <div className="w-11 h-11 bg-blue-600/20 border border-blue-600/30 rounded-xl flex items-center justify-center">
          <Building2 className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <p className="font-semibold text-white">{bank.naam}</p>
          <p className="text-sm text-slate-500">Klik om rekeningen te bekijken</p>
        </div>
      </Link>
      <div className="flex items-center gap-1">
        <Link to={`/jaar/${year}/bank/${bank.id}`}
          className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mr-2">
          Beheer <ArrowRight className="w-4 h-4" />
        </Link>
        <button onClick={() => setBewerken(true)}
          className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-blue-400 transition-all p-2" title="Naam wijzigen">
          <Edit3 className="w-4 h-4" />
        </button>
        <button onClick={() => onVerwijder(bank)}
          className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all p-2" title="Verwijderen">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function JaarOverzicht() {
  const { year } = useParams();
  const { user } = useApp();
  const { banken, loading, voegBankToe, updateBank, verwijderBank } = useBanken(user?.uid, year);
  const [toonForm, setToonForm] = useState(false);

  const handleVerwijder = async (bank) => {
    if (window.confirm(`Bank "${bank.naam}" verwijderen? Alle rekeningen en posities worden ook verwijderd.`)) {
      await verwijderBank(bank.id);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Banken & Brokers</h1>
          <p className="text-slate-400 mt-1">Belastingjaar {year}</p>
        </div>
        <button onClick={() => setToonForm(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-4 py-2.5 text-sm font-medium">
          <Plus className="w-4 h-4" /> Bank toevoegen
        </button>
      </div>

      {toonForm && (
        <div className="mb-4">
          <BankForm onSave={async (data) => { await voegBankToe(data); setToonForm(false); }} onCancel={() => setToonForm(false)} />
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-slate-800 rounded-2xl animate-pulse" />)}</div>
      ) : banken.length === 0 && !toonForm ? (
        <div className="text-center py-16 bg-slate-800/30 border border-slate-700 rounded-2xl">
          <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">Nog geen banken toegevoegd</p>
          <button onClick={() => setToonForm(true)} className="mt-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-6 py-2.5 text-sm font-medium">
            <Plus className="w-4 h-4 inline mr-2" />Bank toevoegen
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {banken.map(bank => (
            <BankRij key={bank.id} bank={bank} year={year} onUpdate={updateBank} onVerwijder={handleVerwijder} />
          ))}
        </div>
      )}
    </div>
  );
}
