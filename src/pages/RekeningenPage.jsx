// Versie: Fix134
// Rekeningenoverzicht: alle rekeningen gegroepeerd per soort, met saldo's en rente/dividend
import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import db from '../services/localDb';
import { formatEuro } from '../services/berekening';
import Breadcrumb from '../components/Breadcrumb';
import { Landmark, PiggyBank, Lock, TrendingUp, Wallet } from 'lucide-react';

const GROEPEN = [
  { type: 'rekening-courant', titel: 'Rekening courant', icon: Wallet },
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

function RekeningKaart({ r, eindLabel, vw }) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
      <div className="mb-3">
        <p className="text-white font-medium leading-tight">{r.naam}</p>
        <p className="text-xs text-slate-500 mt-0.5">
          {r.bankNaam}{r.rekeningnummer ? ` · ${r.rekeningnummer}` : ''}
        </p>
      </div>
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

  useEffect(() => {
    let actief = true;
    (async () => {
      const [dit, vorig] = await Promise.all([laadJaar(selectedYear), laadJaar(Number(selectedYear) - 1)]);
      if (actief) setData({ dit, vorig });
    })();
    return () => { actief = false; };
  }, [selectedYear]);

  const huidigJaar = Number(selectedYear) === new Date().getFullYear();
  const eindLabel = huidigJaar ? 'Saldo actueel' : 'Saldo eind jaar';

  if (!data) return <div className="h-40 bg-slate-800 rounded-2xl animate-pulse" />;

  const bekend = GROEPEN.map(g => g.type);
  const groepen = [...GROEPEN, { type: '__overig', titel: 'Overig', icon: Landmark }]
    .map(g => ({
      ...g,
      rekeningen: data.dit
        .filter(r => g.type === '__overig' ? !bekend.includes(r.type) : r.type === g.type)
        .sort((a, b) => (a.bankNaam + a.naam).localeCompare(b.bankNaam + b.naam, 'nl', { sensitivity: 'base' })),
    }))
    .filter(g => g.rekeningen.length > 0);

  const metVerwacht = (rs) => rs.map(r => ({ r, vw: verwacht(r, data.vorig) }));
  const som = (rs, f) => rs.reduce((t, x) => t + f(x), 0);
  const alle = metVerwacht(data.dit);

  return (
    <div>
      <Breadcrumb items={[{ label: 'Rekeningen' }]} />
      <h1 className="text-2xl font-bold text-white">Rekeningen</h1>
      <p className="text-slate-400 mt-1 mb-6">Overzicht per soort rekening · {selectedYear}</p>

      {groepen.length === 0 ? (
        <div className="text-center py-16 bg-slate-800/30 border border-slate-700 rounded-2xl">
          <p className="text-slate-400">Geen rekeningen in {selectedYear}.</p>
          <p className="text-slate-500 text-sm mt-1">Importeer een jaaroverzicht of voeg een bank toe.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {groepen.map(g => {
            const items = metVerwacht(g.rekeningen);
            const Icon = g.icon;
            return (
              <section key={g.type}>
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
                  {items.map(({ r, vw }) => <RekeningKaart key={r.id} r={r} eindLabel={eindLabel} vw={vw} />)}
                </div>
                <div className="flex justify-end gap-4 text-xs mt-2 text-slate-400">
                  <span>Ontvangen: <span className="text-emerald-400">{formatEuro(som(g.rekeningen, r => r.ontvangen))}</span></span>
                  <span>Verwacht: <span className="text-sky-300">{formatEuro(som(items, x => x.vw?.bedrag || 0))}</span></span>
                </div>
              </section>
            );
          })}

          <section className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4">
            <h2 className="text-white font-semibold mb-3">Totaal alle rekeningen</h2>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Cijfer label="Saldo begin jaar">{formatEuro(som(data.dit, r => r.begin))}</Cijfer>
              <Cijfer label={eindLabel}>{formatEuro(som(data.dit, r => r.eind))}</Cijfer>
              <Cijfer label="Ontvangen rente / dividend"><span className="text-emerald-400">{formatEuro(som(data.dit, r => r.ontvangen))}</span></Cijfer>
              <Cijfer label="Verwacht rente / dividend"><span className="text-sky-300">{formatEuro(som(alle, x => x.vw?.bedrag || 0))}</span></Cijfer>
            </div>
          </section>

          <p className="text-xs text-slate-500">
            Verwacht: spaar-, deposito- en betaalrekeningen = saldo × rentepercentage (alleen als dat percentage bekend is);
            beleggingsrekeningen = ontvangen dividend/rente van het vorige jaar. Het zijn schattingen, geen garanties.
          </p>
        </div>
      )}
    </div>
  );
}
