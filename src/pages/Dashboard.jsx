// Fix116 - Dashboard: sparen/beleggen split, toggle bank specificatie
// Fix100 - getDoc Firebase vervangen door getInstellingen localDb
import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useBanken, getDashboardData } from '../hooks/useLocalDB';
import { berekenPositieRendement, vergelijkMethoden, formatEuro, formatPct, FORFAITAIR_TARIEVEN } from '../services/berekening';
import { getInstellingen } from '../services/localDb';
import { TrendingUp, TrendingDown, Building2, ArrowRight, AlertCircle } from 'lucide-react';

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

      {/* Vermogen — sparen + beleggen split met beide peildata */}
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Vermogen</p>
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">🏦 Sparen 1 jan</span>
            <span className="text-slate-300">{formatEuro(totalen.totaalSparenJan1)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">🏦 Sparen 31 dec</span>
            <span className="text-slate-300">{formatEuro(totalen.totaalSparenDec31)}</span>
          </div>
          <div className="flex justify-between text-xs mt-0.5">
            <span className="text-slate-500">📈 Beleggen 1 jan</span>
            <span className="text-slate-300">{formatEuro(totalen.totaalBeleggenJan1)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">📈 Beleggen 31 dec</span>
            <span className="text-slate-300">{formatEuro(totalen.totaalBeleggenDec31)}</span>
          </div>
          <div className="flex justify-between text-xs border-t border-slate-700/50 pt-1.5 mt-1">
            <span className="text-slate-400 font-medium">Totaal 1 jan</span>
            <span className="text-white font-bold">{formatEuro(totalen.totaalVermogenJan1)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-400 font-medium">Totaal 31 dec</span>
            <span className="text-white font-bold">{formatEuro(totalen.totaalVermogenDec31)}</span>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-700" />

      {/* Rendement — sparen + beleggen split */}
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Werkelijk rendement</p>
        <div className="space-y-1">
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
          <div className="flex justify-between text-xs border-t border-slate-700/50 pt-1.5 mt-0.5">
            <span className="text-slate-400 font-medium">Totaal</span>
            <span className={`font-bold ${rendementPositief ? 'text-emerald-400' : 'text-red-400'}`}>
              {rendementPositief ? '+' : ''}{formatEuro(totalen.totaalRendement)} ({formatPct(pct)})
            </span>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-700" />

      {/* Belasting */}
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <div className="flex gap-4 text-xs">
            <span className="text-slate-500">Werkelijk: <span className="text-red-400 font-medium">{formatEuro(totalen.vergelijk.werkelijk.belasting)}</span></span>
            <span className="text-slate-500">Forfaitair: <span className="text-slate-300">{formatEuro(totalen.vergelijk.forfaitair.belasting)}</span></span>
          </div>
        </div>
        <span className={`text-xs font-bold ml-3 ${totalen.vergelijk.voordeliigsteMethode === 'werkelijk' ? 'text-emerald-400' : 'text-amber-400'}`}>
          {totalen.vergelijk.voordeliigsteMethode === 'werkelijk' ? '✓ Werkelijk' : '✓ Forfaitair'}
        </span>
      </div>

    </div>
  );
}

export default function Dashboard() {
  const { user, selectedYear, setSelectedYear } = useApp();
  const { banken } = useBanken(user?.uid, selectedYear);
  const [totalen, setTotalen] = useState(null);
  const [loadingTotalen, setLoadingTotalen] = useState(true);
  const [instellingen, setInstellingen] = useState(null);
  const instellingenRef = useRef(null);

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
      setLoadingTotalen(true);
      let totaalRendement = 0;
      let totaalVermogenJan1 = 0;
      let totaalVermogenDec31 = 0;
      let totaalSparenJan1 = 0;
      let totaalBeleggenJan1 = 0;
      let totaalSparenDec31 = 0;
      let totaalBeleggenDec31 = 0;
      let totaalRendementSparen = 0;
      let totaalRendementBeleggen = 0;
      let aantalPosities = 0;
      const bankDetails = [];

      const allData = await getDashboardData(selectedYear);

      for (const bank of allData) {
        let bankJan1 = 0, bankDec31 = 0, bankRendement = 0;
        const bankRekeningen = [];

        for (const rek of bank.rekeningen) {
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
              rekDec31 = rek.dec31_saldo || 0;
              rekRendement = (rek.ontvangen_rente || 0) - (rek.kosten || 0);
              aantalPosities++;
              totaalSparenJan1 += rekJan1;
              totaalSparenDec31 += rekDec31;
              totaalRendementSparen += rekRendement;
            }
          }

          if (rekJan1 || rekDec31 || rekRendement) {
            bankRekeningen.push({
              id: rek.id,
              naam: rek.naam,
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
      setTotalen({ totaalRendement, totaalVermogenJan1, totaalVermogenDec31, aantalPosities, vergelijk, vermogenSplit,
        totaalSparenJan1, totaalSparenDec31, totaalBeleggenJan1, totaalBeleggenDec31,
        totaalRendementSparen, totaalRendementBeleggen,
        bankDetails: bankDetails.sort((a, b) => a.volgorde - b.volgorde) });
      setLoadingTotalen(false);
    }

    laadTotalen();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, selectedYear, banken.length, banken.map(b => b.id).join(',')]);

  const rendementPositief = totalen?.totaalRendement >= 0;
  const [mobieleKolom, setMobieleKolom] = useState('rendement'); // 'jan1' | 'dec31' | 'rendement'

  return (
    <div>
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 mt-1">Overzicht belastingjaar {selectedYear}</p>
      </div>

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
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">🏦 Sparen 1 jan</span>
                  <span className="text-slate-300">{formatEuro(totalen.totaalSparenJan1)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">🏦 Sparen 31 dec</span>
                  <span className="text-slate-300">{formatEuro(totalen.totaalSparenDec31)}</span>
                </div>
                <div className="flex justify-between text-xs mt-0.5">
                  <span className="text-slate-500">📈 Beleggen 1 jan</span>
                  <span className="text-slate-300">{formatEuro(totalen.totaalBeleggenJan1)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">📈 Beleggen 31 dec</span>
                  <span className="text-slate-300">{formatEuro(totalen.totaalBeleggenDec31)}</span>
                </div>
                <div className="flex justify-between text-xs border-t border-slate-700/50 pt-1.5 mt-1.5">
                  <span className="text-slate-400 font-medium">Totaal 1 jan</span>
                  <span className="text-white font-bold">{formatEuro(totalen.totaalVermogenJan1)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400 font-medium">Totaal 31 dec</span>
                  <span className="text-white font-bold">{formatEuro(totalen.totaalVermogenDec31)}</span>
                </div>
              </div>
            </div>

            {/* Werkelijk rendement blok */}
            <div className={`bg-gradient-to-br ${rendementPositief ? 'from-emerald-600/20 to-emerald-600/5 border-emerald-600/30' : 'from-red-600/20 to-red-600/5 border-red-600/30'} border rounded-2xl p-5`}>
              <p className="text-sm text-slate-400 mb-3 flex items-center gap-2">
                {rendementPositief ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
                Werkelijk rendement
              </p>
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
                <div className="flex justify-between text-xs border-t border-slate-700/50 pt-1.5 mt-1.5">
                  <span className="text-slate-400 font-medium">Totaal</span>
                  <span className={`font-bold ${rendementPositief ? 'text-emerald-400' : 'text-red-400'}`}>
                    {rendementPositief ? '+' : ''}{formatEuro(totalen.totaalRendement)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Rendement %</span>
                  <span className="text-slate-400">
                    {totalen.totaalVermogenJan1 > 0 ? formatPct((totalen.totaalRendement / totalen.totaalVermogenJan1) * 100) : '—'}
                  </span>
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

      {/* Forfaitair vergelijk */}
      {totalen && (
        <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8">
          <h2 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">Forfaitair vs Werkelijk</h2>

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
        </div>
      )}

      {/* Banken specificatie */}
      <div className="bg-slate-800/40 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Specificatie per bank</h2>
          <Link to={`/jaar/${selectedYear}`} className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1">
            Beheer <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

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
                { key: 'rendement', label: 'Rendement' },
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
            <div className="hidden sm:grid grid-cols-[1fr_120px_120px_100px_32px] gap-2 px-5 py-2 text-xs text-slate-500 border-b border-slate-800">
              <span>Rekening</span>
              <span className="text-right">1 januari</span>
              <span className="text-right">31 december</span>
              <span className="text-right">Rendement</span>
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
                    {mobieleKolom === 'jan1' && <span className="text-slate-300">{formatEuro(bank.jan1)}</span>}
                    {mobieleKolom === 'dec31' && <span className="text-slate-300">{formatEuro(bank.dec31)}</span>}
                    {mobieleKolom === 'rendement' && <span className={bank.rendement >= 0 ? 'text-emerald-400' : 'text-red-400'}>{bank.rendement >= 0 ? '+' : ''}{formatEuro(bank.rendement)}</span>}
                  </div>
                  <div className="hidden sm:flex items-center gap-6 text-sm">
                    <span className="w-[120px] text-right text-slate-300">{formatEuro(bank.jan1)}</span>
                    <span className="w-[120px] text-right text-slate-300">{formatEuro(bank.dec31)}</span>
                    <span className={`w-[100px] text-right font-medium ${bank.rendement >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {bank.rendement >= 0 ? '+' : ''}{formatEuro(bank.rendement)}
                    </span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 flex-shrink-0" />
                </Link>

                {/* Rekeningen onder de bank */}
                {bank.rekeningen.map(rek => {
                  const typeEmoji = rek.type === 'beleggen' ? '📈' : rek.type === 'deposito' ? '🔒' : rek.type === 'rekening-courant' ? '💳' : '🏦';
                  return (
                    <Link
                      key={rek.id}
                      to={rek.type === 'beleggen'
                        ? `/jaar/${selectedYear}/bank/${bank.id}/rekening/${rek.id}`
                        : `/jaar/${selectedYear}/bank/${bank.id}`}
                      className="flex items-center gap-3 px-5 py-2.5 pl-14 hover:bg-slate-900/30 transition-colors group"
                    >
                      <span className="text-base flex-shrink-0">{typeEmoji}</span>
                      <span className="text-sm text-slate-400 flex-1 truncate">{rek.naam}</span>
                      {/* Mobiel */}
                      <div className="sm:hidden text-xs">
                        {mobieleKolom === 'jan1' && <span className="text-slate-500">{formatEuro(rek.jan1)}</span>}
                        {mobieleKolom === 'dec31' && <span className="text-slate-500">{formatEuro(rek.dec31)}</span>}
                        {mobieleKolom === 'rendement' && <span className={rek.rendement >= 0 ? 'text-emerald-500/80' : 'text-red-500/80'}>{rek.rendement >= 0 ? '+' : ''}{formatEuro(rek.rendement)}</span>}
                      </div>
                      <div className="hidden sm:flex items-center gap-6 text-xs">
                        <span className="w-[120px] text-right text-slate-500">{formatEuro(rek.jan1)}</span>
                        <span className="w-[120px] text-right text-slate-500">{formatEuro(rek.dec31)}</span>
                        <span className={`w-[100px] text-right ${rek.rendement >= 0 ? 'text-emerald-500/80' : 'text-red-500/80'}`}>
                          {rek.rendement >= 0 ? '+' : ''}{formatEuro(rek.rendement)}
                        </span>
                      </div>
                      <div className="w-[18px] flex-shrink-0" />
                    </Link>
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
                  {mobieleKolom === 'rendement' && <span className={totalen.totaalRendement >= 0 ? 'text-emerald-400' : 'text-red-400'}>{totalen.totaalRendement >= 0 ? '+' : ''}{formatEuro(totalen.totaalRendement)}</span>}
                </div>
                <div className="hidden sm:flex items-center gap-6 text-sm">
                  <span className="w-[120px] text-right font-semibold text-white">{formatEuro(totalen.totaalVermogenJan1)}</span>
                  <span className="w-[120px] text-right font-semibold text-white">{formatEuro(totalen.totaalVermogenDec31)}</span>
                  <span className={`w-[100px] text-right font-bold ${totalen.totaalRendement >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {totalen.totaalRendement >= 0 ? '+' : ''}{formatEuro(totalen.totaalRendement)}
                  </span>
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
      </div>
    </div>
  );
}
