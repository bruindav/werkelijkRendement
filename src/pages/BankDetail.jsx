// Fix106 - Rekening-courant type toegevoegd
// Fix105 - Gratis limiet: max 2 rekeningen per bank
// Fix 20 - Spaar/deposito inline in BankDetail, geen apart niveau
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useRekeningen, useBank } from '../hooks/useLocalDB';
import Breadcrumb from '../components/Breadcrumb';
import { CreditCard, TrendingUp, PiggyBank, Lock, Plus, Trash2, ArrowRight,
         X, Check, Edit3, ChevronDown, ChevronUp, Calculator, Percent } from 'lucide-react';
import { useLicentie } from '../hooks/useLicentie';
import DragLijst, { DragHandle } from '../components/DragLijst';

const fmt = (v) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(v || 0);

const REKENING_TYPES = [
  { value: 'beleggen', label: 'Beleggingsrekening', icon: TrendingUp, kleur: 'purple', emoji: '📈' },
  { value: 'sparen',   label: 'Spaarrekening',      icon: PiggyBank,  kleur: 'emerald', emoji: '🏦' },
  { value: 'deposito', label: 'Deposito',            icon: Lock,       kleur: 'amber',   emoji: '🔒' },
];
const typeInfo = (type) => REKENING_TYPES.find(t => t.value === type) || REKENING_TYPES[0];

const UITBETALING_OPTIES = [
  { value: 'maandelijks',    label: 'Maandelijks' },
  { value: 'kwartaal',       label: 'Per kwartaal' },
  { value: 'jaarlijks',      label: 'Jaarlijks' },
  { value: 'einde_looptijd', label: 'Einde looptijd' },
  { value: 'bijgeschreven',  label: 'Bijgeschreven (rente op rente)' },
];

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

// ============ REKENING NAAM FORM ============
function RekeningForm({ onSave, onCancel, initial = {} }) {
  const [naam, setNaam] = useState(initial.naam || '');
  const [rekeningnummer, setRekeningnummer] = useState(initial.rekeningnummer || '');
  const [type, setType] = useState(initial.type || 'beleggen');
  const [kosten, setKosten] = useState(initial.kosten || '');

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-4">
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
              <span className="block text-base mb-0.5">{t.emoji}</span>{t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Naam rekening</label>
          <input autoFocus value={naam} onChange={e => setNaam(e.target.value)}
            placeholder={`bijv. ${typeInfo(type).label} ING`}
            className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={e => e.key === 'Enter' && naam && onSave({ naam, rekeningnummer, type, kosten: parseFloat(kosten) || 0 })} />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Rekeningnummer / IBAN <span className="text-slate-500">(optioneel)</span></label>
          <input value={rekeningnummer} onChange={e => setRekeningnummer(e.target.value)}
            placeholder="bijv. NL12 ABCD 0123..."
            className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {type !== 'beleggen' && (
          <div>
            <label className="block text-xs text-slate-400 mb-1">Kosten (€) <span className="text-slate-500">aftrekbaar</span></label>
            <input type="number" step="0.01" value={kosten} onChange={e => setKosten(e.target.value)}
              placeholder="0.00"
              className="w-full bg-slate-800 border border-red-900/40 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <button onClick={() => naam && onSave({ naam, rekeningnummer, type, kosten: parseFloat(kosten) || 0 })} disabled={!naam}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg px-4 py-2 text-sm flex items-center gap-1">
          <Check className="w-4 h-4" /> Opslaan
        </button>
        <button onClick={onCancel} className="text-slate-400 hover:text-white text-sm px-3">Annuleren</button>
      </div>
    </div>
  );
}

// ============ SPAAR/DEPOSITO INLINE FORM ============
function SpaarDepositoForm({ rek, year, onSave, onCancel }) {
  const isDeposito = rek.type === 'deposito';
  const [form, setForm] = useState({
    rente_pct:           rek.rente_pct || '',
    startbedrag:         rek.startbedrag || '',
    jan1_saldo:          rek.jan1_saldo || '',
    dec31_saldo:         rek.dec31_saldo || '',
    deposito_startdatum: rek.deposito_startdatum || '',
    deposito_einddatum:  rek.deposito_einddatum || '',
    uitbetaling_type:    rek.uitbetaling_type || (isDeposito ? 'bijgeschreven' : 'jaarlijks'),
    ontvangen_rente:     rek.ontvangen_rente || '',
    kosten:              rek.kosten || '',
    notitie:             rek.notitie || '',
    kenmerk:             rek.kenmerk || '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const basis = parseFloat(form.startbedrag) || parseFloat(form.jan1_saldo);
  const depositoCalc = isDeposito
    ? berekenDepositoEindbedrag(basis, parseFloat(form.rente_pct),
        form.deposito_startdatum, form.deposito_einddatum, form.uitbetaling_type)
    : null;

  // Verwachte rente dit jaar
  const verwachtRente = (() => {
    const s = parseFloat(form.jan1_saldo), p = parseFloat(form.rente_pct);
    if (isNaN(s) || isNaN(p)) return null;
    const r = p / 100;
    if (form.uitbetaling_type === 'bijgeschreven') return s * (Math.pow(1 + r / 365, 365) - 1);
    if (form.uitbetaling_type === 'maandelijks')   return s * (Math.pow(1 + r / 12, 12) - 1);
    return s * r;
  })();

  const autoRente = () => {
    if (verwachtRente !== null) {
      set('ontvangen_rente', verwachtRente.toFixed(2));
      if (!form.dec31_saldo && form.uitbetaling_type === 'bijgeschreven')
        set('dec31_saldo', (parseFloat(form.jan1_saldo) + verwachtRente).toFixed(2));
    }
  };

  const inp = (label, key, opts = {}) => (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <input type={opts.type || 'number'} step={opts.step || '0.01'}
        value={form[key]} onChange={e => set(key, e.target.value)}
        placeholder={opts.placeholder || ''}
        className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  );

  return (
    <div className="border-t border-slate-700 bg-slate-900/60 p-4 space-y-4">
      {/* Saldi */}
      <div>
        <p className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">💰 Saldo {year}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {inp('Saldo 1 januari (€)', 'jan1_saldo')}
          {inp('Saldo 31 december (€)', 'dec31_saldo')}
        </div>
      </div>

      {/* Deposito looptijd + startbedrag */}
      {isDeposito && (
        <div>
          <p className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">🔒 Looptijd deposito</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {inp('Startdatum', 'deposito_startdatum', { type: 'date' })}
            {inp('Einddatum', 'deposito_einddatum', { type: 'date' })}
          </div>
          <div className="mt-3">
            <label className="block text-xs text-slate-400 mb-1">
              Startbedrag / inleg (€) <span className="text-slate-500">— basis voor eindbedrag berekening</span>
            </label>
            <input type="number" step="0.01" value={form.startbedrag}
              onChange={e => set('startbedrag', e.target.value)}
              placeholder={form.jan1_saldo ? `Leeg = gebruik saldo 1 jan (${form.jan1_saldo})` : 'bijv. 5000'}
              className="w-full sm:w-64 bg-slate-700 border border-amber-700/40 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
          </div>
        </div>
      )}

      {/* Rente */}
      <div>
        <p className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">📈 Rente</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
              {verwachtRente !== null &&
                <span className="ml-1 text-emerald-500 text-xs">≈ {fmt(verwachtRente)}</span>}
            </label>
            <div className="flex gap-1">
              <input type="number" step="0.01" value={form.ontvangen_rente}
                onChange={e => set('ontvangen_rente', e.target.value)} placeholder="0.00"
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div><p className="text-xs text-slate-500">Inleg / startbedrag</p>
              <p className="text-white font-medium">{fmt(basis)}</p></div>
            <div><p className="text-xs text-slate-500">Totale rente</p>
              <p className="text-emerald-400 font-medium">{fmt(depositoCalc.totalRente)}</p></div>
            <div><p className="text-xs text-slate-500">Eindbedrag</p>
              <p className="text-white font-bold">{fmt(depositoCalc.eindbedrag)}</p></div>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {form.uitbetaling_type === 'bijgeschreven' ? '* Dagelijks samengestelde rente'
              : form.uitbetaling_type === 'jaarlijks' || form.uitbetaling_type === 'einde_looptijd'
              ? '* Jaarlijks samengestelde rente' : '* Samengestelde rente'}
          </p>
        </div>
      )}

      {/* Kenmerk + Notitie */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Kenmerk <span className="text-slate-500">(bijv. Raisin product ID)</span></label>
          <input value={form.kenmerk} onChange={e => set('kenmerk', e.target.value)}
            placeholder="bijv. FDA_121_929_128_236"
            className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Notitie</label>
          <input value={form.notitie} onChange={e => set('notitie', e.target.value)}
            placeholder="bijv. automatisch verlengd, garantiebank..."
            className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      <div className="flex gap-3 pt-1">
        <button onClick={() => onSave({
          rente_pct:           parseFloat(form.rente_pct) || 0,
          startbedrag:         parseFloat(form.startbedrag) || 0,
          jan1_saldo:          parseFloat(form.jan1_saldo) || 0,
          dec31_saldo:         parseFloat(form.dec31_saldo) || 0,
          deposito_startdatum: form.deposito_startdatum || null,
          deposito_einddatum:  form.deposito_einddatum || null,
          uitbetaling_type:    form.uitbetaling_type,
          ontvangen_rente:     parseFloat(form.ontvangen_rente) || 0,
          kosten:              parseFloat(form.kosten) || 0,
          notitie:             form.notitie || '',
          kenmerk:             form.kenmerk || '',
        })}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-4 py-2 text-sm font-medium">
          <Check className="w-4 h-4" /> Opslaan
        </button>
        <button onClick={onCancel} className="text-slate-400 hover:text-white text-sm px-3">Annuleren</button>
      </div>
    </div>
  );
}


// ============ INLINE EDIT HELPERS ============
function NaamInlineEdit({ rek, onUpdate }) {
  const [waarde, setWaarde] = useState(rek.naam);
  const [bezig, setBezig] = useState(false);
  return (
    <div className="flex gap-1">
      <input value={waarde} onChange={e => setWaarde(e.target.value)}
        onBlur={async () => {
          if (waarde !== rek.naam && waarde.trim()) {
            setBezig(true);
            await onUpdate(rek.id, { naam: waarde.trim() });
            setBezig(false);
          }
        }}
        className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      {bezig && <span className="text-slate-500 text-xs self-center">...</span>}
    </div>
  );
}

function RekeningnummerInlineEdit({ rek, onUpdate }) {
  const [waarde, setWaarde] = useState(rek.rekeningnummer || '');
  return (
    <input value={waarde} onChange={e => setWaarde(e.target.value)}
      onBlur={async () => { if (waarde !== (rek.rekeningnummer || '')) await onUpdate(rek.id, { rekeningnummer: waarde }); }}
      placeholder="NL12 BANK 0123..."
      className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
  );
}

// ============ REKENING RIJ ============
// Eén klik opent het volledige formulier (naam + type + bedragen)
function RekeningRij({ rek, year, bankId, onUpdate, onVerwijder, dragHandleProps }) {
  const [open, setOpen] = useState(false);
  const info = typeInfo(rek.type);

  const heeftData = (rek.jan1_saldo || rek.dec31_saldo || rek.ontvangen_rente);
  const dagenTotEinde = rek.deposito_einddatum
    ? Math.ceil((new Date(rek.deposito_einddatum) - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  // Gecombineerde save: naam/type-velden + bedragen in één update
  const handleSaveAlles = async (data) => {
    await onUpdate(rek.id, data);
    setOpen(false);
  };

  if (rek.type === 'beleggen') {
    // Beleggingsrekening: klik → posities pagina, potlood → naam bewerken
    return (
      <div className={`border rounded-2xl overflow-hidden transition-all ${
        open ? 'border-blue-600/40 bg-slate-800/60' : 'border-slate-700 bg-slate-800/40'
      }`}>
        <div className="p-4 flex items-center gap-2">
          <DragHandle dragHandleProps={dragHandleProps} />
          <Link to={`/jaar/${year}/bank/${bankId}/rekening/${rek.id}`} className="flex items-center gap-4 flex-1 min-w-0">
            <div className="w-11 h-11 bg-purple-600/20 border border-purple-600/30 rounded-xl flex items-center justify-center text-xl flex-shrink-0">📈</div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-white">{rek.naam}</p>
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-900/40 text-purple-400">Beleggingsrekening</span>
              </div>
              {rek.rekeningnummer && <p className="text-xs text-slate-500 font-mono mt-0.5">{rek.rekeningnummer}</p>}
              <p className="text-xs text-slate-500 mt-0.5">Klik voor posities →</p>
            </div>
          </Link>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
              title="Naam / instellingen bewerken"
              className="text-slate-600 hover:text-blue-400 active:text-blue-400 transition-colors p-2 rounded-lg hover:bg-blue-950/40">
              <Edit3 className="w-4 h-4" />
            </button>
            <button onClick={() => onVerwijder(rek)}
              className="text-slate-600 hover:text-red-400 active:text-red-400 transition-colors p-2 rounded-lg hover:bg-red-950/40">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        {open && (
          <div className="border-t border-slate-700">
            <RekeningForm initial={rek}
              onSave={handleSaveAlles}
              onCancel={() => setOpen(false)} />
          </div>
        )}
      </div>
    );
  }

  // Spaar of deposito: één klik opent gecombineerd formulier
  return (
    <div className={`border rounded-2xl overflow-hidden transition-all ${
      open ? 'border-blue-600/40 bg-slate-800/60' : 'border-slate-700 bg-slate-800/40'
    }`}>
      {/* Header rij — klik om te bewerken */}
      <div className="p-4 flex items-start gap-2">
        <DragHandle dragHandleProps={dragHandleProps} />
        <button onClick={() => setOpen(!open)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
          <div className={`w-11 h-11 bg-${info.kleur}-600/20 border border-${info.kleur}-600/30 rounded-xl flex items-center justify-center text-xl flex-shrink-0`}>
            {info.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-white">{rek.naam}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full bg-${info.kleur}-900/40 text-${info.kleur}-400`}>
                {info.label}
              </span>
            </div>
            {rek.rekeningnummer && <p className="text-xs text-slate-500 font-mono mt-0.5">{rek.rekeningnummer}</p>}
            {heeftData ? (
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs">
                {rek.jan1_saldo > 0 && (
                  <span className="text-slate-400">1 jan: <span className="text-white">{fmt(rek.jan1_saldo)}</span></span>
                )}
                {rek.dec31_saldo > 0 && (
                  <span className="text-slate-400">31 dec: <span className="text-white">{fmt(rek.dec31_saldo)}</span></span>
                )}
                {rek.rente_pct > 0 && (
                  <span className="text-blue-400 flex items-center gap-0.5">
                    <Percent className="w-3 h-3" />{rek.rente_pct}%
                  </span>
                )}
                {rek.ontvangen_rente > 0 && (
                  <span className="text-emerald-400">rente: {fmt(rek.ontvangen_rente)}</span>
                )}
                {dagenTotEinde !== null && dagenTotEinde > 0 && (
                  <span className="text-amber-400">{dagenTotEinde}d tot einde</span>
                )}
                {dagenTotEinde !== null && dagenTotEinde <= 0 && (
                  <span className="text-red-400">Verlopen</span>
                )}
                {rek.kenmerk && (
                  <span className="text-slate-500 font-mono text-xs">[{rek.kenmerk}]</span>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500 mt-0.5">Klik om gegevens in te vullen</p>
            )}
          </div>
          <div className="text-slate-500 flex-shrink-0 ml-2 mt-1">
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>
        <button onClick={(e) => { e.stopPropagation(); onVerwijder(rek); }}
          title="Verwijderen"
          className="text-slate-600 hover:text-red-400 active:text-red-400 transition-colors p-2 rounded-lg hover:bg-red-950/40 flex-shrink-0">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Gecombineerd formulier: naam/type bovenin, bedragen eronder */}
      {open && (
        <>
          {/* Naam/type/rekeningnummer sectie */}
          <div className="border-t border-slate-700 bg-slate-900/40 px-4 pt-4 pb-2">
            <p className="text-xs font-medium text-slate-400 mb-3 uppercase tracking-wide">🏷️ Rekening</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Naam</label>
                <NaamInlineEdit rek={rek} onUpdate={onUpdate} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Rekeningnummer / IBAN</label>
                <RekeningnummerInlineEdit rek={rek} onUpdate={onUpdate} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Type</label>
                <div className="flex gap-1">
                  {REKENING_TYPES.filter(t => t.value !== 'beleggen').map(t => (
                    <button key={t.value}
                      onClick={() => onUpdate(rek.id, { type: t.value })}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors text-center ${
                        rek.type === t.value
                          ? `bg-${t.kleur}-600/30 border border-${t.kleur}-500/50 text-${t.kleur}-300`
                          : 'bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700'
                      }`}>
                      {t.emoji} {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {/* Bedragen/rente sectie */}
          <SpaarDepositoForm
            rek={rek}
            year={year}
            onSave={async (data) => { await onUpdate(rek.id, data); setOpen(false); }}
            onCancel={() => setOpen(false)}
          />
        </>
      )}
    </div>
  );
}

// ============ HOOFD PAGINA ============
export default function BankDetail() {
  const { year, bankId } = useParams();
  const { user } = useApp();
  const bank = useBank(user?.uid, year, bankId);
  const { rekeningen, loading, voegRekeningToe, updateRekening, verwijderRekening, slaVolgorde } = useRekeningen(user?.uid, year, bankId);
  const { proActief, limieten } = useLicentie();
  const [limietFout, setLimietFout] = useState('');
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
        { label: bank?.naam || 'Bank' },
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
            onSave={async (data) => {
              try {
                await voegRekeningToe(data);
                setToonForm(false);
                setLimietFout('');
              } catch(e) {
                if (e.message.startsWith('LIMIET')) setLimietFout('rekeningen');
                else throw e;
              }
            }}
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
        <>
        {limietFout === 'rekeningen' && (
          <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl px-4 py-3 flex items-start gap-3 mb-2">
            <Lock size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-amber-300 font-medium">Gratis limiet bereikt</p>
              <p className="text-xs text-amber-400/70 mt-0.5">
                De gratis versie ondersteunt max {limieten?.maxRekeningen} rekeningen per bank.
              </p>
              <a href="/licentie" className="text-xs text-blue-400 hover:text-blue-300 mt-1 inline-block">
                Upgrade naar Pro →
              </a>
            </div>
            <button onClick={() => setLimietFout('')} className="text-slate-500 hover:text-white">
              <X size={14} />
            </button>
          </div>
        )}

        <DragLijst
          items={rekeningen}
          onVolgorde={slaVolgorde}
          renderItem={(rek, dragHandleProps) => (
            <RekeningRij
              key={rek.id}
              rek={rek}
              year={year}
              bankId={bankId}
              onUpdate={updateRekening}
              onVerwijder={handleVerwijder}
              dragHandleProps={dragHandleProps}
            />
          )}
        />
        </>
      )}
    </div>
  );
}
