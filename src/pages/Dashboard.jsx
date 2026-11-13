// Versie: Fix137
// Fix116 - Dashboard: sparen/beleggen split, toggle bank specificatie
// Fix100 - getDoc Firebase vervangen door getInstellingen localDb
import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useBanken, getDashboardData } from '../hooks/useLocalDB';
import { berekenPositieRendement, vergelijkMethoden, formatEuro, formatEuroGeheel, formatPct, FORFAITAIR_TARIEVEN } from '../services/berekening';
import { eindeSaldo, depositoStatus, looptijdOntbreekt } from '../services/depositoEinde';
import { getInstellingen } from '../services/localDb';
import { laadMeta, laadHoudersMap, bepaalEigenaar, metaSleutel, slaRekeningMetaOp, EIGENAREN } from '../services/rekeningMeta';
import { TrendingUp, TrendingDown, Building2, ArrowRight, AlertCircle, ChevronDown } from 'lucide-react';

const YEARS = [2021, 2022, 2023, 2024, 2025, 2026];

function StatCard({ label, value, sub, color = 'blue', icon }) {
  const colors = {
    blue: 'from-blue-600/20 to-blue-600/5 border-blue-600/30 text-blue-400',
    green: 'from-emerald-600/20 to-emerald-600/5 border-emerald-600/30 text-emerald-400',
    red: 'from-red-600/20 to-red-600/5 border-red-600/30 text-red-400',
    purple: 'from-purple-600/20 to-purple-600/5 border-purple-600/30 text-purple-400',
  };
  return (
    <div className={`bg-gradient-to-br ${colors[color]} border rounded-2xl p-5`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
        </div>
        {icon && <div className="opacity-60">{icon}</div>}
      </div>
    </div>
  );
}

// Compacte mobiele samenvatting — één kaart met alles
function MobieleSamenvatting({ totalen, rendementPositief, selectedYear }) {
  const pct = totalen.totaalVermogenJan1 > 0
    ? (totalen.totaalRendement / totalen.totaalVermogenJan1) * 100 : 0;
  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4 mb-6 sm:hidden space-y-3">

      {/* Vermogen — tabel met 1 jan / 31 dec kolommen */}
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Vermogen</p>
        <div className="grid grid-cols-[auto_1fr_1fr] text-xs gap-y-1">
          {/* Header */}
          <div />
          <div className="text-right text-slate-500 pb-1">1 jan</div>
          <div className="text-right text-slate-500 pb-1">31 dec</div>
          {/* Sparen */}
          <div className="text-slate-400 pr-2">🏦 Sparen</div>
          <div className="text-right text-slate-300">{formatEuroGeheel(totalen.totaalSparenJan1)}</div>
          <div className="text-right text-slate-300">{formatEuroGeheel(totalen.totaalSparenDec31)}</div>
          {/* Beleggen */}
          <div className="text-slate-400 pr-2 mt-0.5">📈 Beleggen</div>
          <div className="text-right text-slate-300 mt-0.5">{formatEuroGeheel(totalen.totaalBeleggenJan1)}</div>
          <div className="text-right text-slate-300 mt-0.5">{formatEuroGeheel(totalen.totaalBeleggenDec31)}</div>
          {/* Scheidingslijn */}
          <div className="col-span-3 border-t border-slate-700/50 my-1" />
          {/* Totaal */}
          <div className="text-slate-400 font-medium pr-2">Totaal</div>
          <div className="text-right text-white font-bold">{formatEuroGeheel(totalen.totaalVermogenJan1)}</div>
          <div className="text-right text-white font-bold">{formatEuroGeheel(totalen.totaalVermogenDec31)}</div>
        </div>
      </div>

      <div className="border-t border-slate-700" />

      {/* Rendement — werkelijk vs forfaitair tabel */}
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Rendement</p>
        <div className="grid grid-cols-[auto_1fr_1fr] text-xs gap-y-1">
          <div />
          <div className="text-right text-slate-500 pb-1">Werkelijk</div>
          <div className="text-right text-slate-500 pb-1">Forfaitair</div>
          {/* Sparen */}
          <div className="text-slate-400 pr-2">🏦 Sparen</div>
          <div className={`text-right ${totalen.totaalRendementSparen >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {totalen.totaalRendementSparen >= 0 ? '+' : ''}{formatEuroGeheel(totalen.totaalRendementSparen)}
          </div>
          <div className="text-right text-slate-400">
            {totalen.vergelijk.forfaitair.splitsing
              ? formatEuroGeheel(totalen.vergelijk.forfaitair.splitsing.sparen.rendement)
              : '—'}
          </div>
          {/* Beleggen */}
          <div className="text-slate-400 pr-2 mt-0.5">📈 Beleggen</div>
          <div className={`text-right mt-0.5 ${totalen.totaalRendementBeleggen >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {totalen.totaalRendementBeleggen >= 0 ? '+' : ''}{formatEuroGeheel(totalen.totaalRendementBeleggen)}
          </div>
          <div className="text-right text-slate-400 mt-0.5">
            {totalen.vergelijk.forfaitair.splitsing
              ? formatEuroGeheel(totalen.vergelijk.forfaitair.splitsing.beleggen.rendement)
              : '—'}
          </div>
          {/* Scheidingslijn */}
          <div className="col-span-3 border-t border-slate-700/50 my-1" />
          {/* Totaal */}
          <div className="text-slate-400 font-medium pr-2">Totaal</div>
          <div className={`text-right font-bold ${rendementPositief ? 'text-emerald-400' : 'text-red-400'}`}>
            {rendementPositief ? '+' : ''}{formatEuroGeheel(totalen.totaalRendement)}
          </div>
          <div className="text-right text-slate-400 font-medium">
            {formatEuroGeheel(totalen.vergelijk.forfaitair.forfaitairRendement)}
          </div>
          {/* % rij */}
          <div className="text-slate-500 pr-2 mt-0.5">%</div>
          <div className="text-right text-slate-500 mt-0.5">
            {totalen.totaalVermogenJan1 > 0 ? formatPct((totalen.totaalRendement / totalen.totaalVermogenJan1) * 100) : '—'}
          </div>
          <div className="text-right text-slate-500 mt-0.5">
            {formatPct(totalen.vergelijk.forfaitair.forfaitairPercentage)}
          </div>
        </div>
      </div>



    </div>
  );
}

export default function Dashboard() {
  const { user, selectedYear, setSelectedYear } = useApp();
  const { banken } = useBanken(user?.uid, selectedYear);
  const [totalen, setTotalen] = useState(null);
  const [loadingTotalen, setLoadingTotalen] = useState(true);
  const heeftTotalen = useRef(false);
  const [instellingen, setInstellingen] = useState(null);
  const instellingenRef = useRef(null);
  const [eigenaarInfo, setEigenaarInfo] = useState({ meta: null, houders: {} });
  useEffect(() => {
    let actief = true;
    Promise.all([laadMeta(), laadHoudersMap()]).then(([meta, houders]) => { if (actief) setEigenaarInfo({ meta, houders }); }).catch(() => {});
    return () => { actief = false; };
  }, [selectedYear]);
  const [dashFilter, setDashFilter] = useState(() => {
    try { return { eigenaar: 'alle', type: 'alle', doel: 'alle', ...JSON.parse(localStorage.getItem('wr_dashfilter') || '{}') }; }
    catch { return { eigenaar: 'alle', type: 'alle', doel: 'alle' }; }
  });
  const zetDashFilter = (nieuw) => {
    const f = { ...dashFilter, ...nieuw };
    setDashFilter(f);
    try { localStorage.setItem('wr_dashfilter', JSON.stringify(f)); } catch { /* geen opslag */ }
  };
  const filterActief = dashFilter.eigenaar !== 'alle' || dashFilter.type !== 'alle' || dashFilter.doel !== 'alle';
  const eigenaarIdVan = (rek, bankNaam) => {
    if (!eigenaarInfo.meta) return null;
    const r = { ...rek, houders: rek.houders || eigenaarInfo.houders[metaSleutel(rek, bankNaam)] || '' };
    return bepaalEigenaar(r, eigenaarInfo.meta, bankNaam);
  };
  const [doelEdit, setDoelEdit] = useState(null);   // id van rekening waarvan het doel wordt gekozen
  const [nieuwDoel, setNieuwDoel] = useState('');
  const bestaandeDoelen = [...new Set(Object.values(eigenaarInfo.meta?.rekeningen || {}).map(x => x.doel).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'nl', { sensitivity: 'base' }));
  const kiesDoel = async (rek, bankNaam, doel) => {
    const sleutel = metaSleutel(rek, bankNaam);
    const huidig = eigenaarInfo.meta?.rekeningen[sleutel] || {};
    await slaRekeningMetaOp(sleutel, { eigenaar: huidig.eigenaar || null, doel: (doel || '').trim() });
    const meta = await laadMeta();
    setEigenaarInfo(prev => ({ ...prev, meta }));
    setDoelEdit(null); setNieuwDoel('');
  };
  const doelVan = (rek, bankNaam) => eigenaarInfo.meta?.rekeningen[metaSleutel(rek, bankNaam)]?.doel || '';
  const rekMagTonen = (rek, bankNaam) => {
    if (dashFilter.eigenaar !== 'alle' && eigenaarIdVan(rek, bankNaam) !== dashFilter.eigenaar) return false;
    if (dashFilter.type !== 'alle' && (rek.type || 'beleggen') !== dashFilter.type) return false;
    if (dashFilter.doel !== 'alle') {
      const doel = doelVan(rek, bankNaam);
      if (dashFilter.doel === '__geen' ? !!doel : doel !== dashFilter.doel) return false;
    }
    return true;
  };
  const eigenaarVan = (rek, bankNaam) => {
    if (!eigenaarInfo.meta) return null;
    const r = { ...rek, houders: rek.houders || eigenaarInfo.houders[metaSleutel(rek, bankNaam)] || '' };
    const id = bepaalEigenaar(r, eigenaarInfo.meta, bankNaam);
    return EIGENAREN.find(e => e.id === id)?.label || null;
  };

  // Laad gebruikersinstellingen eenmalig (niet bij elke render opnieuw)
  useEffect(() => {
    getInstellingen().then(data => {
      const inst = data ? { ...data } : {};
      instellingenRef.current = inst;
      setInstellingen(prev => {
        if (JSON.stringify(prev) === JSON.stringify(inst)) return prev;
        return inst;
      });
    });
  }, []);

  // Bereken totalen door alle posities op te halen
  useEffect(() => {
    if (!user?.uid || banken.length === 0) {
      setLoadingTotalen(false);
      setTotalen(null);
      return;
    }

    async function laadTotalen() {
      // Alleen de eerste keer een laadscherm tonen; bij herberekenen (filter, doel kiezen) blijft de pagina staan
      if (!heeftTotalen.current) setLoadingTotalen(true);
      let totaalRendement = 0;
      let totaalVermogenJan1 = 0;
      let totaalVermogenDec31 = 0;
      let totaalSparenJan1 = 0;
      let totaalBeleggenJan1 = 0;
      let totaalSparenDec31 = 0;
      let totaalBeleggenDec31 = 0;
      let totaalRendementSparen = 0;
      let totaalRendementBeleggen = 0;
      let totaalEinde = 0;
      let aantalPosities = 0;
      const bankDetails = [];

      const allData = await getDashboardData(selectedYear);

      for (const bank of allData) {
        let bankJan1 = 0, bankDec31 = 0, bankRendement = 0, bankEinde = 0;
        const bankRekeningen = [];

        for (const rek of bank.rekeningen) {
          if (!rekMagTonen(rek, bank.naam)) continue;
          const dStatus = depositoStatus(rek, selectedYear);
          if (dStatus?.status === 'voorbij') continue;   // deposito was al verlopen vóór 1 jan van dit jaar
          let rekJan1 = 0, rekDec31 = 0, rekRendement = 0;

          if (rek.type === 'beleggen' || !rek.type) {
            for (const pos of rek.posities || []) {
              const r = berekenPositieRendement(pos);
              rekJan1 += r.waardeJan1;
              rekDec31 += r.waardeDec31;
              rekRendement += r.totaalRendement;
              aantalPosities++;
              totaalBeleggenJan1 += r.waardeJan1;
              totaalBeleggenDec31 += r.waardeDec31;
              totaalRendementBeleggen += r.totaalRendement;
            }
          } else {
            if (rek.jan1_saldo || rek.dec31_saldo || rek.ontvangen_rente) {
              rekJan1 = rek.jan1_saldo || 0;
              rekDec31 = dStatus?.status === 'verlopen' ? 0 : (rek.dec31_saldo || 0);   // verlopen deposito: saldo 31 dec is 0
              rekRendement = (rek.ontvangen_rente || 0) - (rek.kosten || 0);
              aantalPosities++;
              totaalSparenJan1 += rekJan1;
              totaalSparenDec31 += rekDec31;
              totaalRendementSparen += rekRendement;
            }
          }

          if (rekJan1 || rekDec31 || rekRendement) {
            const ein = eindeSaldo(rek, selectedYear, rekDec31);
            bankEinde += ein.bedrag;
            totaalEinde += ein.bedrag;
            bankRekeningen.push({
              einde: ein.bedrag,
              eindeOnbekend: ein.onbekend,
              geenLooptijd: looptijdOntbreekt(rek),
              verlopen: dStatus?.status === 'verlopen' ? dStatus.datum : '',
              id: rek.id,
              naam: rek.naam,
              rekeningnummer: rek.rekeningnummer,
              kenmerk: rek.kenmerk,
              houders: rek.houders,
              type: rek.type || 'beleggen',
              jan1: rekJan1,
              dec31: rekDec31,
              rendement: rekRendement,
              volgorde: rek.volgorde ?? 999,
            });
            bankJan1 += rekJan1;
            bankDec31 += rekDec31;
            bankRendement += rekRendement;
          }
        }

        if (bankJan1 || bankDec31 || bankRendement) {
          bankDetails.push({
            id: bank.id,
            naam: bank.naam,
            jan1: bankJan1,
            dec31: bankDec31,
            rendement: bankRendement,
            einde: bankEinde,
            volgorde: bank.volgorde ?? 999,
            rekeningen: bankRekeningen.sort((a, b) => a.volgorde - b.volgorde),
          });
        }

        totaalRendement += bankRendement;
        totaalVermogenJan1 += bankJan1;
        totaalVermogenDec31 += bankDec31;
      }

      const vermogenSplit = { sparen: totaalSparenJan1, beleggen: totaalBeleggenJan1 };
      const vergelijk = vergelijkMethoden(totaalRendement, totaalVermogenJan1, selectedYear, instellingenRef.current, vermogenSplit);
      setTotalen({ totaalEinde, totaalRendement, totaalVermogenJan1, totaalVermogenDec31, aantalPosities, vergelijk, vermogenSplit,
        totaalSparenJan1, totaalSparenDec31, totaalBeleggenJan1, totaalBeleggenDec31,
        totaalRendementSparen, totaalRendementBeleggen,
        bankDetails: bankDetails.sort((a, b) => String(a.naam || '').localeCompare(String(b.naam || ''), 'nl', { sensitivity: 'base' })) });
      heeftTotalen.current = true;
      setLoadingTotalen(false);
    }

    laadTotalen();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, selectedYear, banken.length, banken.map(b => b.id).join(','), dashFilter, eigenaarInfo]);

  const [dicht, setDicht] = useState(() => {
    try { return JSON.parse(localStorage.getItem('wr_dashdicht') || '{}'); } catch { return {}; }
  });
  const toggle = (k) => setDicht(prev => {
    const n = { ...prev, [k]: !prev[k] };
    try { localStorage.setItem('wr_dashdicht', JSON.stringify(n)); } catch { /* geen opslag */ }
    return n;
  });
  const Chevron = ({ k }) => <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${dicht[k] ? '-rotate-90' : ''}`} />;

  const rendementPositief = totalen?.totaalRendement >= 0;
  const [mobieleKolom, setMobieleKolom] = useState('rendement'); // 'jan1' | 'dec31' | 'rendement'

  return (
    <div>
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 mt-1">Overzicht belastingjaar {selectedYear}{filterActief ? ' · gefilterd' : ''}</p>
      </div>

      <button onClick={() => toggle('stats')} className="flex items-center gap-2 mb-3 text-slate-300 text-sm font-semibold">
        <Chevron k="stats" /> Samenvatting
      </button>
      {!dicht.stats && (<>
      {/* Stats — mobiel: compacte kaart, desktop: 4 blokken */}
      {loadingTotalen ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 sm:h-28 bg-slate-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : totalen ? (
        <>
          {/* Mobiele compacte samenvatting */}
          <MobieleSamenvatting
            totalen={totalen}
            rendementPositief={rendementPositief}
            selectedYear={selectedYear}
          />
          {/* Desktop: blokken (verborgen op mobiel) */}
          <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {/* Vermogen blok */}
            <div className="bg-gradient-to-br from-blue-600/20 to-blue-600/5 border border-blue-600/30 rounded-2xl p-5">
              <p className="text-sm text-slate-400 mb-3 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-400" /> Vermogen
              </p>
              <div className="grid grid-cols-[auto_1fr_1fr] text-xs gap-y-1">
                <div />
                <div className="text-right text-slate-500 pb-1">1 jan</div>
                <div className="text-right text-slate-500 pb-1">31 dec</div>
                <div className="text-slate-400 pr-3">🏦 Sparen</div>
                <div className="text-right text-slate-300">{formatEuroGeheel(totalen.totaalSparenJan1)}</div>
                <div className="text-right text-slate-300">{formatEuroGeheel(totalen.totaalSparenDec31)}</div>
                <div className="text-slate-400 pr-3 mt-0.5">📈 Beleggen</div>
                <div className="text-right text-slate-300 mt-0.5">{formatEuroGeheel(totalen.totaalBeleggenJan1)}</div>
                <div className="text-right text-slate-300 mt-0.5">{formatEuroGeheel(totalen.totaalBeleggenDec31)}</div>
                <div className="col-span-3 border-t border-slate-700/50 my-1.5" />
                <div className="text-slate-400 font-medium pr-3">Totaal</div>
                <div className="text-right text-white font-bold">{formatEuroGeheel(totalen.totaalVermogenJan1)}</div>
                <div className="text-right text-white font-bold">{formatEuroGeheel(totalen.totaalVermogenDec31)}</div>
              </div>
            </div>

            {/* Rendement blok — werkelijk vs forfaitair */}
            <div className={`bg-gradient-to-br ${rendementPositief ? 'from-emerald-600/20 to-emerald-600/5 border-emerald-600/30' : 'from-red-600/20 to-red-600/5 border-red-600/30'} border rounded-2xl p-5`}>
              <p className="text-sm text-slate-400 mb-3 flex items-center gap-2">
                {rendementPositief ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
                Rendement
              </p>
              <div className="grid grid-cols-[auto_1fr_1fr] text-xs gap-y-1.5">
                <div />
                <div className="text-right text-slate-500 pb-1">Werkelijk</div>
                <div className="text-right text-slate-500 pb-1">Forfaitair</div>
                <div className="text-slate-400 pr-3">🏦 Sparen</div>
                <div className={`text-right ${totalen.totaalRendementSparen >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {totalen.totaalRendementSparen >= 0 ? '+' : ''}{formatEuroGeheel(totalen.totaalRendementSparen)}
                </div>
                <div className="text-right text-slate-400">
                  {totalen.vergelijk.forfaitair.splitsing
                    ? formatEuroGeheel(totalen.vergelijk.forfaitair.splitsing.sparen.rendement)
                    : '—'}
                </div>
                <div className="text-slate-400 pr-3">📈 Beleggen</div>
                <div className={`text-right ${totalen.totaalRendementBeleggen >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {totalen.totaalRendementBeleggen >= 0 ? '+' : ''}{formatEuroGeheel(totalen.totaalRendementBeleggen)}
                </div>
                <div className="text-right text-slate-400">
                  {totalen.vergelijk.forfaitair.splitsing
                    ? formatEuroGeheel(totalen.vergelijk.forfaitair.splitsing.beleggen.rendement)
                    : '—'}
                </div>
                <div className="col-span-3 border-t border-slate-700/50 my-0.5" />
                <div className="text-slate-400 font-medium pr-3">Totaal</div>
                <div className={`text-right font-bold ${rendementPositief ? 'text-emerald-400' : 'text-red-400'}`}>
                  {rendementPositief ? '+' : ''}{formatEuroGeheel(totalen.totaalRendement)}
                </div>
                <div className="text-right text-slate-400 font-medium">
                  {formatEuroGeheel(totalen.vergelijk.forfaitair.forfaitairRendement)}
                </div>
                <div className="text-slate-500 pr-3">%</div>
                <div className="text-right text-slate-500">
                  {totalen.totaalVermogenJan1 > 0 ? formatPct((totalen.totaalRendement / totalen.totaalVermogenJan1) * 100) : '—'}
                </div>
                <div className="text-right text-slate-500">
                  {formatPct(totalen.vergelijk.forfaitair.forfaitairPercentage)}
                </div>
              </div>
            </div>

            {/* Belasting blok */}
            <div className="bg-gradient-to-br from-red-600/20 to-red-600/5 border border-red-600/30 rounded-2xl p-5">
              <p className="text-sm text-slate-400 mb-3">Belasting</p>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Werkelijk</span>
                  <span className="text-red-400 font-medium">{formatEuro(totalen.vergelijk.werkelijk.belasting)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Forfaitair</span>
                  <span className="text-slate-300">{formatEuro(totalen.vergelijk.forfaitair.belasting)}</span>
                </div>
                <div className="flex justify-between text-xs border-t border-slate-700/50 pt-1.5 mt-1.5">
                  <span className="text-slate-400 font-medium">Voordeligst</span>
                  <span className={`font-bold text-xs ${totalen.vergelijk.voordeliigsteMethode === 'werkelijk' ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {totalen.vergelijk.voordeliigsteMethode === 'werkelijk' ? '✓ Werkelijk' : '✓ Forfaitair'}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Voordeel</span>
                  <span className="text-emerald-400">-{formatEuro(totalen.vergelijk.voordeel)}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 text-center mb-8">
          <AlertCircle className="w-10 h-10 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400">Nog geen gegevens voor {selectedYear}.</p>
          <p className="text-slate-500 text-sm mt-1">
            Voeg banken en posities toe via 'Posities', of kopieer gegevens via Instellingen → Kopiëren.
          </p>
        </div>
      )}

      </>)}

      {/* Forfaitair vergelijk */}
      {totalen && (
        <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8">
          <button onClick={() => toggle('forfaitair')} className="flex items-center gap-2 text-base sm:text-lg font-semibold text-white w-full text-left">
            <Chevron k="forfaitair" /> Forfaitair vs Werkelijk
          </button>
          {!dicht.forfaitair && (<div className="mt-3 sm:mt-4">

          {/* Mobiel: compacte tabel-stijl */}
          <div className="sm:hidden space-y-2">
            <div className="flex items-center justify-between py-2 border-b border-slate-700/50">
              <div>
                <p className="text-xs text-slate-400">Forfaitair rendement</p>
                <p className="text-xs text-slate-600">{formatPct(totalen.vergelijk.forfaitair.forfaitairPercentage)} over belastbaar vermogen</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-white">{formatEuro(totalen.vergelijk.forfaitair.forfaitairRendement)}</p>
                <p className="text-xs text-amber-500/80">belasting: {formatEuro(totalen.vergelijk.forfaitair.belasting)}</p>
              </div>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-700/50">
              <div>
                <p className="text-xs text-slate-400">Werkelijk rendement</p>
                <p className="text-xs text-slate-600">werkelijk behaald dit jaar</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-white">{formatEuro(totalen.totaalRendement)}</p>
                <p className="text-xs text-amber-500/80">belasting: {formatEuro(totalen.vergelijk.werkelijk.belasting)}</p>
              </div>
            </div>
            <div className={`flex items-center justify-between py-2 px-3 rounded-xl ${totalen.vergelijk.voordeliigsteMethode === 'werkelijk' ? 'bg-emerald-900/30' : 'bg-amber-900/30'}`}>
              <span className="text-xs text-slate-400">Voordeligst</span>
              <div className="text-right">
                <span className={`text-sm font-bold ${totalen.vergelijk.voordeliigsteMethode === 'werkelijk' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {totalen.vergelijk.voordeliigsteMethode === 'werkelijk' ? '✓ Werkelijk' : '✓ Forfaitair'}
                </span>
                <span className="text-xs text-slate-500 ml-2">-{formatEuro(totalen.vergelijk.voordeel)}</span>
              </div>
            </div>
            {totalen.vergelijk.forfaitair.splitsing && (
              <div className="text-xs text-slate-600 pt-1 space-y-0.5">
                <p>Sparen {formatPct(totalen.vergelijk.forfaitair.splitsing.sparen.pct)} · Beleggen {formatPct(totalen.vergelijk.forfaitair.splitsing.beleggen.pct)} · Heffingsvrij {formatEuro(totalen.vergelijk.forfaitair.heffingsvrij)}</p>
              </div>
            )}
          </div>

          {/* Desktop: 3 blokken */}
          <div className="hidden sm:grid sm:grid-cols-3 gap-6">
            {/* Forfaitair kolom */}
            <div className="bg-slate-900/50 rounded-xl p-4">
              <p className="text-sm text-slate-400 mb-3">Forfaitair rendement</p>
              {totalen.vergelijk.forfaitair.splitsing ? (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">🏦 Sparen ({formatPct(totalen.vergelijk.forfaitair.splitsing.sparen.pct)})</span>
                    <span className="text-slate-300">{formatEuro(totalen.vergelijk.forfaitair.splitsing.sparen.rendement)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">📈 Beleggen ({formatPct(totalen.vergelijk.forfaitair.splitsing.beleggen.pct)})</span>
                    <span className="text-slate-300">{formatEuro(totalen.vergelijk.forfaitair.splitsing.beleggen.rendement)}</span>
                  </div>
                  <div className="flex justify-between text-xs border-t border-slate-700/50 pt-1.5 mt-1">
                    <span className="text-slate-400 font-medium">Totaal rendement</span>
                    <span className="text-white font-bold">{formatEuro(totalen.vergelijk.forfaitair.forfaitairRendement)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Belasting</span>
                    <span className="text-red-400">{formatEuro(totalen.vergelijk.forfaitair.belasting)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Heffingsvrij</span>
                    <span>{formatEuro(totalen.vergelijk.forfaitair.heffingsvrij)}</span>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-xl font-bold text-white">{formatEuro(totalen.vergelijk.forfaitair.forfaitairRendement)}</p>
                  <p className="text-sm text-slate-500 mt-1">Belasting: {formatEuro(totalen.vergelijk.forfaitair.belasting)}</p>
                </>
              )}
            </div>
            {/* Werkelijk kolom */}
            <div className="bg-slate-900/50 rounded-xl p-4">
              <p className="text-sm text-slate-400 mb-3">Werkelijk rendement</p>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">🏦 Sparen</span>
                  <span className={totalen.totaalRendementSparen >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                    {totalen.totaalRendementSparen >= 0 ? '+' : ''}{formatEuro(totalen.totaalRendementSparen)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">📈 Beleggen</span>
                  <span className={totalen.totaalRendementBeleggen >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                    {totalen.totaalRendementBeleggen >= 0 ? '+' : ''}{formatEuro(totalen.totaalRendementBeleggen)}
                  </span>
                </div>
                <div className="flex justify-between text-xs border-t border-slate-700/50 pt-1.5 mt-1">
                  <span className="text-slate-400 font-medium">Totaal rendement</span>
                  <span className={`font-bold ${rendementPositief ? 'text-emerald-400' : 'text-red-400'}`}>
                    {rendementPositief ? '+' : ''}{formatEuro(totalen.totaalRendement)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Belasting</span>
                  <span className="text-red-400">{formatEuro(totalen.vergelijk.werkelijk.belasting)}</span>
                </div>
              </div>
            </div>
            {/* Voordeel kolom */}
            <div className={`rounded-xl p-4 ${totalen.vergelijk.voordeliigsteMethode === 'werkelijk' ? 'bg-emerald-900/30 border border-emerald-600/30' : 'bg-orange-900/30 border border-orange-600/30'}`}>
              <p className="text-sm text-slate-400 mb-3">Voordeligste methode</p>
              <p className={`text-xl font-bold ${totalen.vergelijk.voordeliigsteMethode === 'werkelijk' ? 'text-emerald-400' : 'text-orange-400'}`}>
                {totalen.vergelijk.voordeliigsteMethode === 'werkelijk' ? 'Werkelijk ✓' : 'Forfaitair ✓'}
              </p>
              <p className="text-sm text-slate-500 mt-2">Voordeel: {formatEuro(totalen.vergelijk.voordeel)}</p>
              <div className="mt-3 pt-3 border-t border-slate-700/30 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Forfaitaire belasting</span>
                  <span className="text-slate-400">{formatEuro(totalen.vergelijk.forfaitair.belasting)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Werkelijke belasting</span>
                  <span className="text-slate-400">{formatEuro(totalen.vergelijk.werkelijk.belasting)}</span>
                </div>
              </div>
            </div>
          </div>
          </div>)}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 mb-5">
        {[
          { sleutel: 'eigenaar', label: 'Eigenaar', opties: [['alle', 'Alle'], ...EIGENAREN.map(e => [e.id, e.label])] },
          { sleutel: 'type', label: 'Type rekening', opties: [['alle', 'Alle'], ['rekening-courant', 'Rekening courant'], ['geldrekening', 'Geldrekening'], ['sparen', 'Spaarrekening'], ['deposito', 'Deposito'], ['beleggen', 'Beleggingsrekening']] },
          { sleutel: 'doel', label: 'Doel', opties: [['alle', 'Alle'], ['__geen', 'Geen doel'], ...[...new Set(Object.values(eigenaarInfo.meta?.rekeningen || {}).map(x => x.doel).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'nl', { sensitivity: 'base' })).map(x => [x, x])] },
        ].map(f => (
          <label key={f.sleutel} className="text-xs text-slate-400 flex flex-col gap-1">
            {f.label}
            <select value={dashFilter[f.sleutel]} onChange={e => zetDashFilter({ [f.sleutel]: e.target.value })}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-2 py-1.5">
              {f.opties.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        ))}
        {filterActief && (
          <button onClick={() => zetDashFilter({ eigenaar: 'alle', type: 'alle', doel: 'alle' })}
            className="text-xs text-amber-300 hover:text-amber-200 pb-2">Filter wissen</button>
        )}
      </div>

      {/* Banken specificatie */}
      <div className="bg-slate-800/40 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <button onClick={() => toggle('banken')} className="flex items-center gap-2 text-lg font-semibold text-white text-left">
            <Chevron k="banken" /> Specificatie per bank
          </button>
          <Link to={`/jaar/${selectedYear}`} className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1">
            Beheer <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {!dicht.banken && (<>
        {banken.length === 0 ? (
          <p className="text-slate-500 text-center py-8">Nog geen banken toegevoegd</p>
        ) : loadingTotalen ? (
          <div className="p-5 space-y-2">
            {[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-slate-700 rounded-lg animate-pulse" />)}
          </div>
        ) : totalen?.bankDetails?.length > 0 ? (
          <div>
            {/* Mobiele kolom toggle */}
            <div className="flex sm:hidden gap-1 px-4 py-2 border-b border-slate-800 bg-slate-900/30">
              {[
                { key: 'jan1', label: '1 jan' },
                { key: 'dec31', label: '31 dec' },
                { key: 'einde', label: 'Einde' },
                { key: 'rendement', label: 'Rendement' },
                { key: 'kenmerk', label: 'FDA' },
              ].map(({ key, label }) => (
                <button key={key} onClick={() => setMobieleKolom(key)}
                  className={`flex-1 py-1 rounded-lg text-xs font-medium transition-colors ${
                    mobieleKolom === key ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'
                  }`}>
                  {label}
                </button>
              ))}
            </div>

            {/* Desktop kolomheaders */}
            <div className="hidden sm:grid grid-cols-[1fr_120px_120px_120px_100px_150px_6px] gap-6 px-5 py-2 text-xs text-slate-500 border-b border-slate-800">
              <span>Rekening</span>
              <span className="text-right">1 januari</span>
              <span className="text-right">31 december</span>
              <span className="text-right" title="Verwacht saldo op einddatum (deposito's incl. rente)">Einde</span>
              <span className="text-right">Rendement</span>
              <span className="text-right">Kenmerk</span>
              <span></span>
            </div>

            {totalen.bankDetails.map(bank => (
              <div key={bank.id} className="border-b border-slate-800 last:border-0">
                {/* Bank header */}
                <Link to={`/jaar/${selectedYear}/bank/${bank.id}`}
                  className="flex items-center gap-3 px-5 py-3 bg-slate-900/30 hover:bg-slate-900/60 transition-colors group">
                  <div className="w-7 h-7 bg-blue-600/20 border border-blue-600/30 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <span className="font-semibold text-white flex-1 text-sm">{bank.naam}</span>
                  {/* Mobiel: toon geselecteerde kolom */}
                  <div className="sm:hidden text-sm font-medium">
                    {mobieleKolom === 'jan1' && <span className="text-white">{formatEuro(bank.jan1)}</span>}
                    {mobieleKolom === 'dec31' && <span className="text-white">{formatEuro(bank.dec31)}</span>}
                    {mobieleKolom === 'einde' && <span className="text-white">{formatEuro(bank.einde)}</span>}
                    {mobieleKolom === 'rendement' && <span className={bank.rendement >= 0 ? 'text-emerald-400' : 'text-red-400'}>{bank.rendement >= 0 ? '+' : ''}{formatEuro(bank.rendement)}</span>}
                  </div>
                  <div className="hidden sm:flex items-center gap-6 text-sm shrink-0">
                    <span className="w-[120px] shrink-0 text-right text-white">{formatEuro(bank.jan1)}</span>
                    <span className="w-[120px] shrink-0 text-right text-white">{formatEuro(bank.dec31)}</span>
                    <span className="w-[120px] shrink-0 text-right text-white">{formatEuro(bank.einde)}</span>
                    <span className={`w-[100px] shrink-0 text-right font-medium ${bank.rendement >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {bank.rendement >= 0 ? '+' : ''}{formatEuro(bank.rendement)}
                    </span>
                    <span className="w-[150px] shrink-0" />
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 flex-shrink-0" />
                </Link>

                {/* Rekeningen onder de bank */}
                {bank.rekeningen.map(rek => {
                  const typeEmoji = rek.type === 'beleggen' ? '📈' : rek.type === 'deposito' ? '🔒' : (rek.type === 'rekening-courant') ? '💳' : rek.type === 'geldrekening' ? '💶' : '🏦';
                  return (
                    <React.Fragment key={rek.id}>
                    <Link
                      to={rek.type === 'beleggen'
                        ? `/jaar/${selectedYear}/bank/${bank.id}/rekening/${rek.id}`
                        : `/jaar/${selectedYear}/bank/${bank.id}?rekening=${rek.id}`}
                      className="flex items-center gap-3 px-5 py-2.5 pl-14 hover:bg-slate-900/30 transition-colors group"
                    >
                      <span className="text-base flex-shrink-0">{typeEmoji}</span>
                      {(() => { const e = eigenaarVan(rek, bank.naam); const letter = e ? e[0] : '?'; return (
                        <span title={e || 'Eigenaar onbekend'} className={`w-4 h-4 flex items-center justify-center rounded text-[9px] font-bold flex-shrink-0 ${e ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-800 text-slate-600'}`}>{letter}</span>
                      ); })()}
                      <span className="text-sm text-slate-200 flex-1 leading-tight break-words">{rek.naam}
                        {rek.verlopen && <span className="ml-2 align-middle text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-300 whitespace-nowrap">Verlopen {rek.verlopen}</span>}
                        {(() => { const dl = doelVan(rek, bank.naam); return (
                          <button type="button" title="Doel kiezen of wijzigen"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setNieuwDoel(''); setDoelEdit(doelEdit === rek.id ? null : rek.id); }}
                            className={`ml-2 align-middle text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap border ${dl ? 'bg-sky-500/15 border-sky-500/30 text-sky-300' : 'border-dashed border-slate-600 text-slate-500 hover:text-slate-300'}`}>
                            {dl ? `🎯 ${dl}` : '+ doel'}
                          </button>
                        ); })()}
                        {rek.geenLooptijd && <span title="Importeer de Raisin-productsheet of vul start-/einddatum in" className="ml-2 align-middle text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-300 whitespace-nowrap">Looptijd onbekend</span>}
                      </span>
                      {/* Mobiel */}
                      <div className="sm:hidden text-xs">
                        {mobieleKolom === 'jan1' && <span className="text-slate-200">{formatEuro(rek.jan1)}</span>}
                        {mobieleKolom === 'dec31' && <span className="text-slate-200">{formatEuro(rek.dec31)}</span>}
                        {mobieleKolom === 'einde' && <span className={rek.eindeOnbekend ? 'text-slate-600 italic' : 'text-slate-200'} title={rek.eindeOnbekend ? 'Einddatum onbekend' : ''}>{formatEuro(rek.einde)}</span>}
                        {mobieleKolom === 'kenmerk' && <span className="text-xs font-mono text-slate-300">{rek.kenmerk || '–'}</span>}
                        {mobieleKolom === 'rendement' && <span className={rek.rendement >= 0 ? 'text-emerald-400' : 'text-red-400'}>{rek.rendement >= 0 ? '+' : ''}{formatEuro(rek.rendement)}</span>}
                      </div>
                      <div className="hidden sm:flex items-center gap-6 text-xs shrink-0">
                        <span className="w-[120px] shrink-0 text-right text-slate-200">{formatEuro(rek.jan1)}</span>
                        <span className="w-[120px] shrink-0 text-right text-slate-200">{formatEuro(rek.dec31)}</span>
                        <span className={`w-[120px] shrink-0 text-right ${rek.eindeOnbekend ? 'text-slate-600 italic' : 'text-slate-200'}`} title={rek.eindeOnbekend ? 'Einddatum onbekend' : ''}>{formatEuro(rek.einde)}</span>
                        <span className={`w-[100px] shrink-0 text-right ${rek.rendement >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {rek.rendement >= 0 ? '+' : ''}{formatEuro(rek.rendement)}
                        </span>
                        <span className={`w-[150px] shrink-0 text-right text-xs font-mono truncate text-slate-300`} title={rek.kenmerk || ''}>{rek.kenmerk || ''}</span>
                      </div>
                      <div className="w-[18px] flex-shrink-0" />
                    </Link>
                    {doelEdit === rek.id && (
                      <div className="pl-14 pr-5 pb-3 -mt-1 bg-slate-900/30">
                        <p className="text-[11px] text-slate-400 mb-1.5">Doel voor {rek.naam}</p>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {bestaandeDoelen.map(dl => (
                            <button key={dl} onClick={() => kiesDoel(rek, bank.naam, dl)}
                              className={`text-xs px-2.5 py-1 rounded-full border ${doelVan(rek, bank.naam) === dl ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-200 hover:border-slate-500'}`}>{dl}</button>
                          ))}
                          {doelVan(rek, bank.naam) && (
                            <button onClick={() => kiesDoel(rek, bank.naam, '')} className="text-xs px-2.5 py-1 rounded-full border border-slate-700 text-slate-400 hover:text-white">Geen doel</button>
                          )}
                          {bestaandeDoelen.length === 0 && <span className="text-xs text-slate-500">Nog geen doelen – typ er een hieronder.</span>}
                        </div>
                        <div className="flex gap-2">
                          <input value={nieuwDoel} onChange={e => setNieuwDoel(e.target.value)} placeholder="Nieuw doel, bijv. Hypotheek"
                            onKeyDown={e => e.key === 'Enter' && nieuwDoel.trim() && kiesDoel(rek, bank.naam, nieuwDoel)}
                            className="flex-1 min-w-0 bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                          <button onClick={() => nieuwDoel.trim() && kiesDoel(rek, bank.naam, nieuwDoel)} disabled={!nieuwDoel.trim()}
                            className="text-sm px-3 py-1.5 rounded-lg bg-blue-600 text-white disabled:opacity-40">OK</button>
                          <button onClick={() => { setDoelEdit(null); setNieuwDoel(''); }} className="text-sm px-2 text-slate-400 hover:text-white">Sluiten</button>
                        </div>
                      </div>
                    )}
                    </React.Fragment>
                  );
                })}
              </div>
            ))}

            {/* Totaalregel */}
            {totalen && (
              <div className="flex items-center gap-3 px-5 py-3 bg-slate-900/50 border-t border-slate-700">
                <span className="text-sm font-semibold text-slate-300 flex-1">Totaal</span>
                {/* Mobiel */}
                <div className="sm:hidden text-sm font-bold">
                  {mobieleKolom === 'jan1' && <span className="text-white">{formatEuro(totalen.totaalVermogenJan1)}</span>}
                  {mobieleKolom === 'dec31' && <span className="text-white">{formatEuro(totalen.totaalVermogenDec31)}</span>}
                  {mobieleKolom === 'einde' && <span className="text-white">{formatEuro(totalen.totaalEinde)}</span>}
                  {mobieleKolom === 'rendement' && <span className={totalen.totaalRendement >= 0 ? 'text-emerald-400' : 'text-red-400'}>{totalen.totaalRendement >= 0 ? '+' : ''}{formatEuro(totalen.totaalRendement)}</span>}
                </div>
                <div className="hidden sm:flex items-center gap-6 text-sm shrink-0">
                  <span className="w-[120px] shrink-0 text-right font-semibold text-white">{formatEuro(totalen.totaalVermogenJan1)}</span>
                  <span className="w-[120px] shrink-0 text-right font-semibold text-white">{formatEuro(totalen.totaalVermogenDec31)}</span>
                  <span className="w-[120px] shrink-0 text-right font-semibold text-white">{formatEuro(totalen.totaalEinde)}</span>
                  <span className={`w-[100px] shrink-0 text-right font-bold ${totalen.totaalRendement >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {totalen.totaalRendement >= 0 ? '+' : ''}{formatEuro(totalen.totaalRendement)}
                  </span>
                  <span className="w-[150px] shrink-0" />
                </div>
                <div className="w-[18px] flex-shrink-0" />
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2 p-5">
            {banken.map(bank => (
              <Link key={bank.id} to={`/jaar/${selectedYear}/bank/${bank.id}`}
                className="flex items-center justify-between p-4 bg-slate-900/50 hover:bg-slate-900 rounded-xl transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-600/20 border border-blue-600/30 rounded-lg flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-blue-400" />
                  </div>
                  <span className="font-medium text-white">{bank.naam}</span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500" />
              </Link>
            ))}
          </div>
        )}
        </>)}
      </div>
    </div>
  );
}
