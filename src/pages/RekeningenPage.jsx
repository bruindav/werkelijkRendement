// Versie: Fix137
// Rekeningenoverzicht: alle rekeningen gegroepeerd per soort, met saldo's en rente/dividend
import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import db from '../services/localDb';
import { formatEuro } from '../services/berekening';
import Breadcrumb from '../components/Breadcrumb';
import { laadHoudersMap, laadMeta, slaRekeningMetaOp, slaFilterOp, metaSleutel, bepaalEigenaar, EIGENAREN } from '../services/rekeningMeta';
import { Landmark, PiggyBank, Lock, TrendingUp, Wallet, Banknote, Pencil, Check, X } from 'lucide-react';

const GROEPEN = [
  { type: 'rekening-courant', titel: 'Rekening courant', icon: Wallet },
  { type: 'geldrekening', titel: 'Geldrekening', icon: Banknote },
  { type: 'sparen', titel: 'Spaarrekening', icon: PiggyBank },
  { type: 'deposito', titel: 'Deposito', icon: Lock },
  { type: 'beleggen', titel: 'Beleggingsrekening', icon: TrendingUp },
];

const norm = (t) => String(t || '').trim().toLowerCase().replace(/\s+/g, ' ');
const normNr = (t) => String(t || '').replace(/\s+/g, '').toLowerCase();

async function laadJaar(jaar) {
  const y = String(jaar);
  const banken = await db.banken.where('year').equals(y).toArray();
  const rekeningen = await db.rekeningen.filter(r => String(r.year) === y).toArray();
  const posities = await db.posities.filter(p => String(p.year) === y).toArray();
  return rekeningen.map(r => {
    const bank = banken.find(b => b.id === r.bankId);
    const pos = posities.filter(p => p.rekeningId === r.id);
    const isBel = r.type === 'beleggen';
    return {
      ...r,
      bankNaam: bank?.naam || '',
      sleutelBron: bank?.naam || '',
      begin: isBel ? pos.reduce((t, p) => t + (p.jan1_waarde || 0), 0) : (r.jan1_saldo || 0),
      eind: isBel ? pos.reduce((t, p) => t + (p.dec31_waarde || 0), 0) : (r.dec31_saldo || 0),
      ontvangen: isBel ? pos.reduce((t, p) => t + (p.dividend || 0) + (p.rente || 0), 0) : (r.ontvangen_rente || 0),
    };
  });
}

// Verwacht: spaar/deposito/rc = saldo × rente%; beleggen = dividend/rente van vorig jaar
function verwacht(r, vorigJaar) {
  if (r.type === 'beleggen') {
    const nr = normNr(r.rekeningnummer);
    const vorig = vorigJaar.find(v => v.type === 'beleggen' && norm(v.bankNaam) === norm(r.bankNaam) &&
      (nr && normNr(v.rekeningnummer) ? normNr(v.rekeningnummer) === nr : norm(v.naam) === norm(r.naam)));
    if (vorig && vorig.ontvangen > 0) return { bedrag: vorig.ontvangen, bron: 'o.b.v. vorig jaar' };
    return r.ontvangen > 0 ? { bedrag: r.ontvangen, bron: 'o.b.v. dit jaar' } : null;
  }
  if (r.rente_pct > 0) {
    const saldo = r.eind || r.begin;
    return { bedrag: saldo * r.rente_pct / 100, bron: `${String(r.rente_pct).replace('.', ',')}% over saldo` };
  }
  return null;
}

function Cijfer({ label, children, sub }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-white">{children}</p>
      {sub && <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function RekeningKaart({ r, eindLabel, vw, eigenaar, doel, doelen, onOpslaan }) {
  const [bewerk, setBewerk] = useState(false);
  const [keuze, setKeuze] = useState(eigenaar);
  const [doelTekst, setDoelTekst] = useState(doel);
  const eigenaarLabel = EIGENAREN.find(e => e.id === eigenaar)?.label;

  const opslaan = async () => {
    await onOpslaan(r, { eigenaar: keuze, doel: doelTekst });
    setBewerk(false);
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-white font-medium leading-tight">{r.naam}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {r.bankNaam}{r.rekeningnummer ? ` · ${r.rekeningnummer}` : ''}
          </p>
          {r.kenmerk && <p className="text-xs text-slate-500 font-mono mt-0.5">{r.kenmerk}</p>}
          <div className="flex flex-wrap gap-1.5 mt-2">
            <span className={`text-[11px] px-2 py-0.5 rounded-full ${eigenaarLabel ? 'bg-blue-500/15 text-blue-300' : 'bg-slate-800 text-slate-500'}`}>
              {eigenaarLabel || 'Eigenaar?'}
            </span>
            {doel && <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300">🎯 {doel}</span>}
          </div>
        </div>
        {!bewerk && (
          <button onClick={() => { setKeuze(eigenaar); setDoelTekst(doel); setBewerk(true); }}
            className="p-1.5 text-slate-500 hover:text-white" title="Eigenaar en doel wijzigen">
            <Pencil className="w-4 h-4" />
          </button>
        )}
      </div>

      {bewerk && (
        <div className="mb-3 p-3 rounded-lg bg-slate-800/60 space-y-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">Van wie</p>
            <div className="flex gap-2">
              {EIGENAREN.map(e => (
                <button key={e.id} onClick={() => setKeuze(e.id)}
                  className={`flex-1 text-sm py-1.5 rounded-lg border ${keuze === e.id ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-700 text-slate-300'}`}>
                  {e.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">Doel (optioneel)</p>
            <input list="doelen-lijst" value={doelTekst} onChange={e => setDoelTekst(e.target.value)}
              placeholder="bijv. Verbouwing, Pensioen, Buffer"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
            <datalist id="doelen-lijst">{doelen.map(d => <option key={d} value={d} />)}</datalist>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setBewerk(false)} className="px-3 py-1.5 text-sm text-slate-400 flex items-center gap-1"><X className="w-4 h-4" />Annuleer</button>
            <button onClick={opslaan} className="px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-1"><Check className="w-4 h-4" />Opslaan</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Cijfer label="Saldo begin jaar">{formatEuro(r.begin)}</Cijfer>
        <Cijfer label={eindLabel}>{formatEuro(r.eind)}</Cijfer>
        <Cijfer label={r.type === 'beleggen' ? 'Ontvangen dividend' : 'Ontvangen rente'}>
          <span className="text-emerald-400">{formatEuro(r.ontvangen)}</span>
        </Cijfer>
        <Cijfer label={r.type === 'beleggen' ? 'Verwacht dividend' : 'Verwachte rente'} sub={vw?.bron}>
          {vw ? <span className="text-sky-300">{formatEuro(vw.bedrag)}</span> : <span className="text-slate-600">–</span>}
        </Cijfer>
      </div>
    </div>
  );
}

export default function RekeningenPage() {
  const { selectedYear } = useApp();
  const [data, setData] = useState(null);
  const [meta, setMeta] = useState(null);

  useEffect(() => {
    let actief = true;
    (async () => {
      const [dit, vorig, m, houdersMap] = await Promise.all([laadJaar(selectedYear), laadJaar(Number(selectedYear) - 1), laadMeta(), laadHoudersMap()]);
      for (const r of dit) if (!r.houders) r.houders = houdersMap[metaSleutel(r, r.bankNaam)] || '';
      if (actief) { setData({ dit, vorig }); setMeta(m); }
    })();
    return () => { actief = false; };
  }, [selectedYear]);

  const huidigJaar = Number(selectedYear) === new Date().getFullYear();
  const eindLabel = huidigJaar ? 'Saldo actueel' : 'Saldo eind jaar';

  if (!data || !meta) return <div className="h-40 bg-slate-800 rounded-2xl animate-pulse" />;

  const metaVan = (r) => ({
    eigenaar: bepaalEigenaar(r, meta, r.bankNaam),
    doel: meta.rekeningen[metaSleutel(r, r.bankNaam)]?.doel || '',
  });
  const doelen = [...new Set(Object.values(meta.rekeningen).map(x => x.doel).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'nl', { sensitivity: 'base' }));

  const opslaan = async (r, waarden) => {
    await slaRekeningMetaOp(metaSleutel(r, r.bankNaam), waarden, r.houders);
    setMeta(await laadMeta());
  };
  const filter = meta.filter;
  const zetFilter = async (nieuw) => {
    const f = { ...filter, ...nieuw };
    setMeta(m => ({ ...m, filter: f }));
    await slaFilterOp(f); // onthouden
  };
  const eigenaarOK = (r) => filter.eigenaar === 'alle' || metaVan(r).eigenaar === filter.eigenaar;
  const doelOK = (r) => filter.doel === 'alle' || (filter.doel === '__geen' ? !metaVan(r).doel : metaVan(r).doel === filter.doel);
  const zichtbaar = data.dit.filter(r => eigenaarOK(r) && doelOK(r));
  const filterActief = filter.eigenaar !== 'alle' || filter.doel !== 'alle';

  const sorteer = (rs) => rs.sort((a, b) =>
    (a.bankNaam + a.naam).localeCompare(b.bankNaam + b.naam, 'nl', { sensitivity: 'base' }));

  // Altijd gegroepeerd per soort rekening
  const bekend = GROEPEN.map(g => g.type);
  const groepen = [...GROEPEN, { type: '__overig', titel: 'Overig', icon: Landmark }]
    .map(g => ({
      key: g.type, titel: g.titel, icon: g.icon,
      rekeningen: sorteer(zichtbaar.filter(r => g.type === '__overig' ? !bekend.includes(r.type) : r.type === g.type)),
    }))
    .filter(g => g.rekeningen.length > 0);

  const metVerwacht = (rs) => rs.map(r => ({ r, vw: verwacht(r, data.vorig) }));
  const som = (rs, f) => rs.reduce((t, x) => t + f(x), 0);
  const alle = metVerwacht(zichtbaar);

  return (
    <div>
      <Breadcrumb items={[{ label: 'Rekeningen' }]} />
      <h1 className="text-2xl font-bold text-white">Rekeningen</h1>
      <p className="text-slate-400 mt-1 mb-4">Overzicht per rekening · {selectedYear}</p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-6">
        <label className="flex items-center gap-2 text-xs text-slate-500">
          Van
          <select value={filter.eigenaar} onChange={e => zetFilter({ eigenaar: e.target.value })}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white">
            <option value="alle">Alle</option>
            {EIGENAREN.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-500">
          Doel
          <select value={filter.doel} onChange={e => zetFilter({ doel: e.target.value })}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white max-w-[12rem]">
            <option value="alle">Alle</option>
            {doelen.map(d => <option key={d} value={d}>{d}</option>)}
            <option value="__geen">Geen doel</option>
          </select>
        </label>
        {filterActief && (
          <button onClick={() => zetFilter({ eigenaar: 'alle', doel: 'alle' })}
            className="text-xs text-amber-300 hover:text-amber-200 flex items-center gap-1">
            <X className="w-3.5 h-3.5" /> Filter wissen{data.dit.length > zichtbaar.length ? ` (${data.dit.length - zichtbaar.length} rekening(en) verborgen)` : ''}
          </button>
        )}
      </div>

      {groepen.length === 0 ? (
        <div className="text-center py-16 bg-slate-800/30 border border-slate-700 rounded-2xl">
          <p className="text-slate-400">{filterActief ? 'Geen rekeningen met dit filter.' : `Geen rekeningen in ${selectedYear}.`}</p>
          <p className="text-slate-500 text-sm mt-1">{filterActief ? 'Pas het filter aan of wis het.' : 'Importeer een jaaroverzicht of voeg een bank toe.'}</p>
        </div>
      ) : (
        <div className="space-y-8">
          {groepen.map(g => {
            const items = metVerwacht(g.rekeningen);
            const Icon = g.icon;
            return (
              <section key={g.key}>
                <div className="flex items-center justify-between mb-3 gap-3">
                  <h2 className="flex items-center gap-2 text-white font-semibold">
                    <Icon className="w-4 h-4 text-blue-400" /> {g.titel}
                    <span className="text-xs text-slate-500 font-normal">({g.rekeningen.length})</span>
                  </h2>
                  <p className="text-xs text-slate-400 text-right">
                    {formatEuro(som(g.rekeningen, r => r.begin))} → <span className="text-white font-medium">{formatEuro(som(g.rekeningen, r => r.eind))}</span>
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {items.map(({ r, vw }) => {
                    const m = metaVan(r);
                    return <RekeningKaart key={r.id} r={r} eindLabel={eindLabel} vw={vw}
                      eigenaar={m.eigenaar} doel={m.doel} doelen={doelen} onOpslaan={opslaan} />;
                  })}
                </div>
                <div className="flex justify-end gap-4 text-xs mt-2 text-slate-400">
                  <span>Ontvangen: <span className="text-emerald-400">{formatEuro(som(g.rekeningen, r => r.ontvangen))}</span></span>
                  <span>Verwacht: <span className="text-sky-300">{formatEuro(som(items, x => x.vw?.bedrag || 0))}</span></span>
                </div>
              </section>
            );
          })}

          <section className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4">
            <h2 className="text-white font-semibold mb-3">{filterActief ? 'Totaal gefilterde rekeningen' : 'Totaal alle rekeningen'}</h2>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Cijfer label="Saldo begin jaar">{formatEuro(som(zichtbaar, r => r.begin))}</Cijfer>
              <Cijfer label={eindLabel}>{formatEuro(som(zichtbaar, r => r.eind))}</Cijfer>
              <Cijfer label="Ontvangen rente / dividend"><span className="text-emerald-400">{formatEuro(som(zichtbaar, r => r.ontvangen))}</span></Cijfer>
              <Cijfer label="Verwacht rente / dividend"><span className="text-sky-300">{formatEuro(som(alle, x => x.vw?.bedrag || 0))}</span></Cijfer>
            </div>
          </section>

          <p className="text-xs text-slate-500">
            Verwacht: spaar-, deposito- en betaalrekeningen = saldo × rentepercentage (alleen als dat percentage bekend is);
            beleggingsrekeningen = ontvangen dividend/rente van het vorige jaar. Het zijn schattingen, geen garanties.
            Eigenaar en doel gelden voor alle jaren en worden onthouden. Heeft een rekening één houder, kies dan eenmalig Ik of Partner: andere rekeningen met dezelfde naam worden daarna automatisch ingevuld.
          </p>
        </div>
      )}
    </div>
  );
}
