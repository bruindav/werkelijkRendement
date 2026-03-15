import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useBanken, useRekeningen, kopieerJaar } from '../hooks/useFirestore';
import { berekenPositieRendement, vergelijkMethoden, formatEuro, formatPct, FORFAITAIR_TARIEVEN } from '../services/berekening';
import { getDocs, getDoc, doc, collection } from 'firebase/firestore';
import { db } from '../services/firebase';
import { TrendingUp, TrendingDown, Building2, ArrowRight, Copy, AlertCircle, Settings } from 'lucide-react';

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

export default function Dashboard() {
  const { user, selectedYear, setSelectedYear } = useApp();
  const { banken } = useBanken(user?.uid, selectedYear);
  const [totalen, setTotalen] = useState(null);
  const [loadingTotalen, setLoadingTotalen] = useState(true);
  const [instellingen, setInstellingen] = useState(null);

  // Laad gebruikersinstellingen eenmalig (niet bij elke render opnieuw)
  useEffect(() => {
    if (!user?.uid) return;
    getDoc(doc(db, `users/${user.uid}/instellingen/box3`)).then(snap => {
      const data = snap.exists() ? snap.data() : {};
      setInstellingen(prev => {
        // Alleen updaten als de data echt veranderd is
        if (JSON.stringify(prev) === JSON.stringify(data)) return prev;
        return data;
      });
    });
  }, [user?.uid]);
  const [kopieerBezig, setKopieerBezig] = useState(false);
  const [kopieerSuccess, setKopieerSuccess] = useState(false);

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
      let aantalPosities = 0;
      const bankDetails = [];

      for (const bank of banken) {
        let bankJan1 = 0, bankDec31 = 0, bankRendement = 0;
        const bankRekeningen = [];

        const rekeningenSnap = await getDocs(
          collection(db, `users/${user.uid}/years/${selectedYear}/banks/${bank.id}/accounts`)
        );
        for (const rek of rekeningenSnap.docs) {
          const rekData = rek.data();
          let rekJan1 = 0, rekDec31 = 0, rekRendement = 0;

          if (rekData.type === 'beleggen' || !rekData.type) {
            const positiesSnap = await getDocs(
              collection(db, `users/${user.uid}/years/${selectedYear}/banks/${bank.id}/accounts/${rek.id}/positions`)
            );
            for (const pos of positiesSnap.docs) {
              const r = berekenPositieRendement(pos.data());
              rekJan1 += r.waardeJan1;
              rekDec31 += r.waardeDec31;
              rekRendement += r.totaalRendement;
              aantalPosities++;
              totaalBeleggenJan1 += r.waardeJan1;
            }
          } else {
            const d = rekData;
            if (d.jan1_saldo || d.dec31_saldo || d.ontvangen_rente) {
              rekJan1 = d.jan1_saldo || 0;
              rekDec31 = d.dec31_saldo || 0;
              rekRendement = (d.ontvangen_rente || 0) - (d.kosten || 0);
              aantalPosities++;
              totaalSparenJan1 += rekJan1;
            }
          }

          if (rekJan1 || rekDec31 || rekRendement) {
            bankRekeningen.push({
              id: rek.id,
              naam: rekData.naam,
              type: rekData.type || 'beleggen',
              jan1: rekJan1,
              dec31: rekDec31,
              rendement: rekRendement,
              volgorde: rekData.volgorde ?? 999,
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
      const vergelijk = vergelijkMethoden(totaalRendement, totaalVermogenJan1, selectedYear, instellingen, vermogenSplit);
      setTotalen({ totaalRendement, totaalVermogenJan1, totaalVermogenDec31, aantalPosities, vergelijk, vermogenSplit,
        bankDetails: bankDetails.sort((a, b) => a.volgorde - b.volgorde) });
      setLoadingTotalen(false);
    }

    laadTotalen();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, selectedYear, banken.length, banken.map(b => b.id).join(','), instellingen]);

  const handleKopieer = async () => {
    const vanJaar = selectedYear - 1;
    if (!window.confirm(`Gegevens van ${vanJaar} kopiëren naar ${selectedYear}? Bestaande gegevens van ${selectedYear} blijven behouden.`)) return;
    setKopieerBezig(true);
    try {
      await kopieerJaar(user.uid, vanJaar, selectedYear);
      setKopieerSuccess(true);
      setTimeout(() => setKopieerSuccess(false), 3000);
    } catch (err) {
      alert('Kopiëren mislukt: ' + err.message);
    }
    setKopieerBezig(false);
  };

  const rendementPositief = totalen?.totaalRendement >= 0;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 mt-1">Overzicht belastingjaar {selectedYear}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleKopieer}
            disabled={kopieerBezig}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Copy className="w-4 h-4" />
            {kopieerBezig ? 'Bezig...' : kopieerSuccess ? '✓ Gekopieerd!' : `Kopieer van ${selectedYear - 1}`}
          </button>
          <Link
            to="/instellingen"
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors"
          >
            <Settings className="w-4 h-4" />
            Instellingen
          </Link>
          <Link
            to={`/jaar/${selectedYear}`}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-4 py-2.5 text-sm font-medium transition-colors"
          >
            <Building2 className="w-4 h-4" />
            Beheer posities
          </Link>
        </div>
      </div>

      {/* Stats grid */}
      {loadingTotalen ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : totalen ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Vermogen 1 januari"
            value={formatEuro(totalen.totaalVermogenJan1)}
            color="blue"
            icon={<Building2 className="w-6 h-6" />}
          />
          <StatCard
            label="Vermogen 31 december"
            value={formatEuro(totalen.totaalVermogenDec31)}
            color="purple"
          />
          <StatCard
            label="Werkelijk rendement"
            value={formatEuro(totalen.totaalRendement)}
            sub={totalen.totaalVermogenJan1 > 0 ? formatPct((totalen.totaalRendement / totalen.totaalVermogenJan1) * 100) : ''}
            color={rendementPositief ? 'green' : 'red'}
            icon={rendementPositief ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
          />
          <StatCard
            label="Belasting (werkelijk)"
            value={formatEuro(totalen.vergelijk.werkelijk.belasting)}
            sub={`vs forfaitair: ${formatEuro(totalen.vergelijk.forfaitair.belasting)}`}
            color="red"
          />
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 text-center mb-8">
          <AlertCircle className="w-10 h-10 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400">Nog geen gegevens voor {selectedYear}.</p>
          <p className="text-slate-500 text-sm mt-1">
            Voeg banken en posities toe, of kopieer gegevens van {selectedYear - 1}.
          </p>
        </div>
      )}

      {/* Forfaitair vergelijk */}
      {totalen && (
        <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Forfaitair vs Werkelijk Rendement</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-900/50 rounded-xl p-4">
              <p className="text-sm text-slate-400 mb-1">Forfaitair rendement ({formatPct(totalen.vergelijk.forfaitair.forfaitairPercentage)})</p>
              <p className="text-xl font-bold text-white">{formatEuro(totalen.vergelijk.forfaitair.forfaitairRendement)}</p>
              <p className="text-sm text-slate-500 mt-1">Belasting: {formatEuro(totalen.vergelijk.forfaitair.belasting)}</p>
              {totalen.vergelijk.forfaitair.splitsing && (
                <div className="mt-2 space-y-0.5 text-xs text-slate-600">
                  <p>Sparen: {formatPct(totalen.vergelijk.forfaitair.splitsing.sparen.pct)} × {formatEuro(totalen.vergelijk.forfaitair.splitsing.sparen.belastbaar)}</p>
                  <p>Beleggen: {formatPct(totalen.vergelijk.forfaitair.splitsing.beleggen.pct)} × {formatEuro(totalen.vergelijk.forfaitair.splitsing.beleggen.belastbaar)}</p>
                  <p className="text-slate-500">Heffingsvrij: {formatEuro(totalen.vergelijk.forfaitair.heffingsvrij)}</p>
                </div>
              )}
            </div>
            <div className="bg-slate-900/50 rounded-xl p-4">
              <p className="text-sm text-slate-400 mb-1">Werkelijk rendement</p>
              <p className="text-xl font-bold text-white">{formatEuro(totalen.totaalRendement)}</p>
              <p className="text-sm text-slate-500 mt-1">Belasting: {formatEuro(totalen.vergelijk.werkelijk.belasting)}</p>
            </div>
            <div className={`rounded-xl p-4 ${totalen.vergelijk.voordeliigsteMethode === 'werkelijk' ? 'bg-emerald-900/30 border border-emerald-600/30' : 'bg-orange-900/30 border border-orange-600/30'}`}>
              <p className="text-sm text-slate-400 mb-1">Voordeligste methode</p>
              <p className={`text-xl font-bold ${totalen.vergelijk.voordeliigsteMethode === 'werkelijk' ? 'text-emerald-400' : 'text-orange-400'}`}>
                {totalen.vergelijk.voordeliigsteMethode === 'werkelijk' ? 'Werkelijk rendement ✓' : 'Forfaitair rendement ✓'}
              </p>
              <p className="text-sm text-slate-400 mt-1">Voordeel: {formatEuro(totalen.vergelijk.voordeel)}</p>
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
            {/* Kolomheaders */}
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
                  const typeEmoji = rek.type === 'beleggen' ? '📈' : rek.type === 'deposito' ? '🔒' : '🏦';
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
