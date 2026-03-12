// Fix 13 - Breadcrumb + startdatum + rente-op-rente berekening
import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useSpaargelden, useBank, useRekening } from '../hooks/useFirestore';
import Breadcrumb from '../components/Breadcrumb';
import { PiggyBank, Plus, Trash2, Edit3, Check, X, ChevronDown, ChevronUp, Calendar, Percent, Calculator } from 'lucide-react';

const formatEuro = (v) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(v || 0);
const formatPct = (v) => `${(v || 0).toFixed(3)}%`;

const UITBETALING_OPTIES = [
  { value: 'maandelijks',      label: 'Maandelijks' },
  { value: 'kwartaal',         label: 'Per kwartaal' },
  { value: 'jaarlijks',        label: 'Jaarlijks' },
  { value: 'einde_looptijd',   label: 'Einde looptijd' },
  { value: 'bijgeschreven',    label: 'Bijgeschreven (rente op rente)' },
];

// Bereken verwachte rente voor een jaar
function berekenJaarrente(saldo, rentePct, uitbetalingType) {
  if (!saldo || !rentePct) return { rente: 0, eindbedrag: saldo || 0 };
  const r = rentePct / 100;

  if (uitbetalingType === 'bijgeschreven') {
    // Dagelijks samengesteld
    const eindbedrag = saldo * Math.pow(1 + r / 365, 365);
    return { rente: eindbedrag - saldo, eindbedrag };
  } else if (uitbetalingType === 'maandelijks') {
    const eindbedrag = saldo * Math.pow(1 + r / 12, 12);
    return { rente: eindbedrag - saldo, eindbedrag };
  } else if (uitbetalingType === 'kwartaal') {
    const eindbedrag = saldo * Math.pow(1 + r / 4, 4);
    return { rente: eindbedrag - saldo, eindbedrag };
  } else {
    // Jaarlijks of einde looptijd: enkelvoudig
    return { rente: saldo * r, eindbedrag: saldo + saldo * r };
  }
}

// Bereken verwacht eindbedrag deposito met rente-op-rente
function berekenDepositoEindbedrag(inleg, rentePct, startdatum, einddatum, uitbetalingType) {
  if (!inleg || !rentePct || !startdatum || !einddatum) return null;
  const start = new Date(startdatum);
  const eind = new Date(einddatum);
  const dagenTotaal = Math.max(0, (eind - start) / (1000 * 60 * 60 * 24));
  const jaren = dagenTotaal / 365;
  const r = rentePct / 100;

  let eindbedrag;
  if (uitbetalingType === 'bijgeschreven') {
    eindbedrag = inleg * Math.pow(1 + r / 365, dagenTotaal);
  } else if (uitbetalingType === 'jaarlijks' || uitbetalingType === 'einde_looptijd') {
    eindbedrag = inleg * Math.pow(1 + r, jaren);
  } else if (uitbetalingType === 'maandelijks') {
    eindbedrag = inleg * Math.pow(1 + r / 12, jaren * 12);
  } else {
    eindbedrag = inleg * (1 + r * jaren);
  }
  return { eindbedrag, totalRente: eindbedrag - inleg, jaren: jaren.toFixed(1) };
}

function SpaarForm({ onSave, onCancel, initial = {}, rekeningType, year }) {
  const isDeposito = rekeningType === 'deposito';
  const [form, setForm] = useState({
    rente_pct:          initial.rente_pct || '',
    jan1_saldo:         initial.jan1_saldo || '',
    dec31_saldo:        initial.dec31_saldo || '',
    deposito_startdatum: initial.deposito_startdatum || '',
    deposito_einddatum: initial.deposito_einddatum || '',
    uitbetaling_type:   initial.uitbetaling_type || (isDeposito ? 'bijgeschreven' : 'jaarlijks'),
    ontvangen_rente:    initial.ontvangen_rente || '',
    kosten:             initial.kosten || '',
    notitie:            initial.notitie || '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Auto-bereken rente voor dit jaar
  const autoRente = () => {
    const saldo = parseFloat(form.jan1_saldo);
    const pct = parseFloat(form.rente_pct);
    if (isNaN(saldo) || isNaN(pct)) return;
    const { rente } = berekenJaarrente(saldo, pct, form.uitbetaling_type);
    set('ontvangen_rente', rente.toFixed(2));
    if (!form.dec31_saldo) {
      const eindbedrag = form.uitbetaling_type === 'bijgeschreven'
        ? saldo + rente
        : saldo;
      set('dec31_saldo', eindbedrag.toFixed(2));
    }
  };

  // Berekening voor deposito eindbedrag
  const depositoCalc = isDeposito
    ? berekenDepositoEindbedrag(
        parseFloat(form.jan1_saldo),
        parseFloat(form.rente_pct),
        form.deposito_startdatum,
        form.deposito_einddatum,
        form.uitbetaling_type
      )
    : null;

  // Verwachte rente dit jaar (enkelvoudig voor display)
  const verwachtRenteJaar = (() => {
    const saldo = parseFloat(form.jan1_saldo);
    const pct = parseFloat(form.rente_pct);
    if (isNaN(saldo) || isNaN(pct)) return null;
    return berekenJaarrente(saldo, pct, form.uitbetaling_type).rente;
  })();

  const handleSave = () => {
    onSave({
      rente_pct:           parseFloat(form.rente_pct) || 0,
      jan1_saldo:          parseFloat(form.jan1_saldo) || 0,
      dec31_saldo:         parseFloat(form.dec31_saldo) || 0,
      deposito_startdatum: form.deposito_startdatum || null,
      deposito_einddatum:  form.deposito_einddatum || null,
      uitbetaling_type:    form.uitbetaling_type,
      ontvangen_rente:     parseFloat(form.ontvangen_rente) || 0,
      kosten:              parseFloat(form.kosten) || 0,
      notitie:             form.notitie || '',
    });
  };

  const inp = (label, key, extra = {}) => (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <input type={extra.type || 'number'} step={extra.step || '0.01'} value={form[key]}
        onChange={e => set(key, e.target.value)}
        placeholder={extra.placeholder || ''}
        className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  );

  return (
    <div className="bg-slate-800 border border-slate-600 rounded-2xl p-5 space-y-5">

      {/* Saldi */}
      <div>
        <p className="text-sm font-medium text-slate-300 mb-3">💰 Saldo {year}</p>
        <div className="grid grid-cols-2 gap-3">
          {inp(`Saldo 1 januari (€)`, 'jan1_saldo')}
          {inp(`Saldo 31 december (€)`, 'dec31_saldo')}
        </div>
      </div>

      {/* Deposito datums */}
      {isDeposito && (
        <div>
          <p className="text-sm font-medium text-slate-300 mb-3">🔒 Looptijd deposito</p>
          <div className="grid grid-cols-2 gap-3">
            {inp('Startdatum', 'deposito_startdatum', { type: 'date' })}
            {inp('Einddatum', 'deposito_einddatum', { type: 'date' })}
          </div>
        </div>
      )}

      {/* Rente */}
      <div>
        <p className="text-sm font-medium text-slate-300 mb-3">📈 Rente</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Rente % (per jaar)</label>
            <div className="relative">
              <input type="number" step="0.001" value={form.rente_pct}
                onChange={e => set('rente_pct', e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 pr-7 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <span className="absolute right-2 top-2 text-slate-400 text-sm">%</span>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Uitbetaling</label>
            <select value={form.uitbetaling_type} onChange={e => set('uitbetaling_type', e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {UITBETALING_OPTIES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Ontvangen rente {year} (€)
              {verwachtRenteJaar !== null &&
                <span className="ml-1 text-emerald-500 text-xs">≈ {formatEuro(verwachtRenteJaar)}</span>}
            </label>
            <div className="flex gap-1">
              <input type="number" step="0.01" value={form.ontvangen_rente}
                onChange={e => set('ontvangen_rente', e.target.value)}
                placeholder="0.00"
                className="flex-1 bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button onClick={autoRente} title="Auto-bereken"
                className="bg-emerald-700/50 hover:bg-emerald-700 text-emerald-300 rounded-lg px-2 text-xs flex items-center gap-1">
                <Calculator className="w-3 h-3" /> Auto
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Kosten (€) <span className="text-slate-500">aftrekbaar</span></label>
            <input type="number" step="0.01" value={form.kosten}
              onChange={e => set('kosten', e.target.value)} placeholder="0.00"
              className="w-full bg-slate-700 border border-red-900/40 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
        </div>
      </div>

      {/* Deposito eindbedrag preview */}
      {isDeposito && depositoCalc && (
        <div className="bg-amber-900/20 border border-amber-700/30 rounded-xl p-4">
          <p className="text-xs text-amber-400 font-medium mb-2 flex items-center gap-1">
            <Calculator className="w-3.5 h-3.5" /> Verwacht eindbedrag op einddatum ({depositoCalc.jaren} jaar)
          </p>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-slate-500">Inleg</p>
              <p className="text-white font-medium">{formatEuro(form.jan1_saldo)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Totale rente</p>
              <p className="text-emerald-400 font-medium">{formatEuro(depositoCalc.totalRente)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Eindbedrag</p>
              <p className="text-white font-bold">{formatEuro(depositoCalc.eindbedrag)}</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {form.uitbetaling_type === 'bijgeschreven'
              ? '* Berekend met dagelijks samengestelde rente (rente over rente)'
              : form.uitbetaling_type === 'jaarlijks' || form.uitbetaling_type === 'einde_looptijd'
              ? '* Berekend met jaarlijks samengestelde rente'
              : '* Berekend met samengestelde rente'}
          </p>
        </div>
      )}

      {/* Notitie */}
      <div>
        <label className="block text-xs text-slate-400 mb-1">Notitie</label>
        <input value={form.notitie} onChange={e => set('notitie', e.target.value)}
          placeholder="bijv. automatisch verlengd, bank-garantie..."
          className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div className="flex gap-3 pt-1">
        <button onClick={handleSave}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-4 py-2 text-sm font-medium">
          <Check className="w-4 h-4" /> Opslaan
        </button>
        <button onClick={onCancel} className="text-slate-400 hover:text-white text-sm px-3">Annuleren</button>
      </div>
    </div>
  );
}

function SpaarKaart({ spaar, rekeningType, year, onUpdate, onVerwijder }) {
  const [open, setOpen] = useState(false);
  const [bewerken, setBewerken] = useState(false);
  const isDeposito = rekeningType === 'deposito';

  const rendement = (spaar.ontvangen_rente || 0) - (spaar.kosten || 0);

  const dagenTotEinde = spaar.deposito_einddatum
    ? Math.ceil((new Date(spaar.deposito_einddatum) - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  const depositoCalc = isDeposito
    ? berekenDepositoEindbedrag(
        spaar.jan1_saldo,
        spaar.rente_pct,
        spaar.deposito_startdatum,
        spaar.deposito_einddatum,
        spaar.uitbetaling_type
      )
    : null;

  if (bewerken) {
    return (
      <SpaarForm
        initial={spaar}
        rekeningType={rekeningType}
        year={year}
        onSave={async (data) => { await onUpdate(spaar.id, data); setBewerken(false); }}
        onCancel={() => setBewerken(false)}
      />
    );
  }

  return (
    <div className="bg-slate-800/40 border border-slate-700 rounded-2xl overflow-hidden">
      <div className="p-5 flex items-center gap-4 group">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {spaar.rente_pct > 0 && (
              <span className="text-sm text-blue-400 flex items-center gap-1">
                <Percent className="w-3.5 h-3.5" />{spaar.rente_pct}% p.j.
              </span>
            )}
            {spaar.uitbetaling_type && (
              <span className="text-xs text-slate-500">
                {UITBETALING_OPTIES.find(o => o.value === spaar.uitbetaling_type)?.label}
              </span>
            )}
            {dagenTotEinde !== null && dagenTotEinde <= 90 && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                dagenTotEinde <= 30 ? 'bg-red-900/40 text-red-400' : 'bg-orange-900/40 text-orange-400'
              }`}>
                ⏰ {dagenTotEinde <= 0 ? 'Verlopen!' : `Loopt af over ${dagenTotEinde} dagen`}
              </span>
            )}
          </div>
          <div className="flex gap-4 mt-1 flex-wrap text-sm">
            <span className="text-slate-400">Saldo: <span className="text-white">{formatEuro(spaar.jan1_saldo)}</span></span>
            <span className="text-emerald-400">Rente: +{formatEuro(spaar.ontvangen_rente)}</span>
            {spaar.kosten > 0 && <span className="text-red-400">Kosten: -{formatEuro(spaar.kosten)}</span>}
            <span className={`font-medium ${rendement >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              Rendement: {formatEuro(rendement)}
            </span>
            {depositoCalc && (
              <span className="text-amber-400">Eindbedrag: {formatEuro(depositoCalc.eindbedrag)}</span>
            )}
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
              <p className="text-xs text-slate-500">Rente ontvangen</p>
              <p className="text-sm font-medium text-emerald-400 mt-0.5">{formatEuro(spaar.ontvangen_rente)}</p>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-3">
              <p className="text-xs text-slate-500">Netto rendement</p>
              <p className={`text-sm font-bold mt-0.5 ${rendement >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatEuro(rendement)}</p>
            </div>
          </div>

          {isDeposito && (spaar.deposito_startdatum || spaar.deposito_einddatum) && (
            <div className="bg-amber-900/20 border border-amber-700/30 rounded-xl p-4 space-y-2">
              <p className="text-xs text-amber-400 font-medium flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Looptijd deposito
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                {spaar.deposito_startdatum && (
                  <div>
                    <p className="text-xs text-slate-500">Startdatum</p>
                    <p className="text-white">{new Date(spaar.deposito_startdatum).toLocaleDateString('nl-NL')}</p>
                  </div>
                )}
                {spaar.deposito_einddatum && (
                  <div>
                    <p className="text-xs text-slate-500">Einddatum</p>
                    <p className="text-white">{new Date(spaar.deposito_einddatum).toLocaleDateString('nl-NL')}</p>
                  </div>
                )}
                {depositoCalc && (
                  <>
                    <div>
                      <p className="text-xs text-slate-500">Totale rente</p>
                      <p className="text-emerald-400 font-medium">{formatEuro(depositoCalc.totalRente)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Verwacht eindbedrag</p>
                      <p className="text-white font-bold">{formatEuro(depositoCalc.eindbedrag)}</p>
                    </div>
                  </>
                )}
              </div>
              {spaar.notitie && <p className="text-xs text-slate-400">{spaar.notitie}</p>}
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
  const bank = useBank(user?.uid, year, bankId);
  const rekening = useRekening(user?.uid, year, bankId, accountId);
  const { spaargelden, loading, voegSpaargeldToe, updateSpaargeld, verwijderSpaargeld } =
    useSpaargelden(user?.uid, year, bankId, accountId);
  const [toonForm, setToonForm] = useState(false);

  const rekeningType = rekening?.type || 'sparen';
  const isDeposito = rekeningType === 'deposito';

  const totaalRendement = spaargelden.reduce((sum, s) => sum + (s.ontvangen_rente || 0) - (s.kosten || 0), 0);

  const openForm = () => { setToonForm(true); setIsEditing(true); };
  const sluitForm = () => { setToonForm(false); setIsEditing(false); };

  const handleVerwijder = async (s) => {
    if (window.confirm(`Verwijderen?`)) await verwijderSpaargeld(s.id);
  };

  return (
    <div>
      <Breadcrumb items={[
        { label: `Jaar ${year}`, to: `/jaar/${year}` },
        { label: bank?.naam || 'Bank', to: `/jaar/${year}/bank/${bankId}` },
        { label: rekening?.naam || (isDeposito ? 'Deposito' : 'Spaarrekening') },
      ]} />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            {isDeposito ? '🔒' : '🏦'} {rekening?.naam || (isDeposito ? 'Deposito' : 'Spaarrekening')}
          </h1>
          <p className="text-slate-400 mt-1">Belastingjaar {year}</p>
        </div>
        {spaargelden.length === 0 && !toonForm ? null : (
          <button onClick={openForm}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-4 py-2.5 text-sm font-medium">
            <Plus className="w-4 h-4" /> {isDeposito ? 'Deposito toevoegen' : 'Saldo toevoegen'}
          </button>
        )}
      </div>

      {spaargelden.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
            <p className="text-xs text-slate-500">Saldo 31 december</p>
            <p className="text-xl font-bold text-white mt-1">
              {formatEuro(spaargelden.reduce((s, x) => s + (x.dec31_saldo || x.jan1_saldo || 0), 0))}
            </p>
          </div>
          <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
            <p className="text-xs text-slate-500">Totaal rendement {year}</p>
            <p className={`text-xl font-bold mt-1 ${totaalRendement >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatEuro(totaalRendement)}
            </p>
          </div>
        </div>
      )}

      {toonForm && (
        <div className="mb-4">
          <SpaarForm year={year} rekeningType={rekeningType}
            onSave={async (data) => { await voegSpaargeldToe(data); sluitForm(); }}
            onCancel={sluitForm} />
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[...Array(1)].map((_, i) => <div key={i} className="h-24 bg-slate-800 rounded-2xl animate-pulse" />)}</div>
      ) : spaargelden.length === 0 && !toonForm ? (
        <div className="text-center py-16 bg-slate-800/30 border border-slate-700 rounded-2xl">
          <PiggyBank className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">Nog geen gegevens</p>
          <button onClick={openForm} className="mt-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-6 py-2.5 text-sm font-medium">
            <Plus className="w-4 h-4 inline mr-2" />{isDeposito ? 'Deposito toevoegen' : 'Saldo toevoegen'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {spaargelden.map(s => (
            <SpaarKaart key={s.id} spaar={s} rekeningType={rekeningType} year={year}
              onUpdate={updateSpaargeld} onVerwijder={handleVerwijder} />
          ))}
        </div>
      )}
    </div>
  );
}
