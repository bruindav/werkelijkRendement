import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useBanken, getAangifteData } from '../hooks/useLocalDB';
import { berekenPositieRendement, vergelijkMethoden, formatEuro, formatPct, HEFFINGSVRIJ_VERMOGEN, FORFAITAIR_TARIEVEN } from '../services/berekening';

import { FileText, Printer, CheckCircle, AlertCircle } from 'lucide-react';

export default function AangiftePage() {
  const { year } = useParams();
  const { user } = useApp();
  const { banken } = useBanken(user?.uid, year);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid || banken.length === 0) { setLoading(false); return; }

    async function laadData() {
      setLoading(true);
      let totaalRendement = 0, totaalVermogenJan1 = 0, totaalVermogenDec31 = 0;
      let totaalDividend = 0, totaalRente = 0, totaalKoersresultaat = 0;
      const bankenDetail = [];

      const allData = await getAangifteData(year);

      for (const bank of allData) {
        let bankRendement = 0, bankVermogen = 0;
        for (const rek of bank.rekeningen) {
          for (const pos of rek.posities || []) {
            const r = berekenPositieRendement(pos);
            bankRendement += r.totaalRendement;
            bankVermogen += r.waardeJan1;
            totaalRendement += r.totaalRendement;
            totaalVermogenJan1 += r.waardeJan1;
            totaalVermogenDec31 += r.waardeDec31;
            totaalDividend += r.inkomen;
            totaalKoersresultaat += r.koersresultaat;
          }
        }
        bankenDetail.push({ ...bank, rendement: bankRendement, vermogen: bankVermogen });
      }

      const vergelijk = vergelijkMethoden(totaalRendement, totaalVermogenJan1, parseInt(year));
      const heffingsvrij = HEFFINGSVRIJ_VERMOGEN[year] || 57000;
      const tarieven = FORFAITAIR_TARIEVEN[year] || FORFAITAIR_TARIEVEN[2024];

      setData({
        totaalRendement, totaalVermogenJan1, totaalVermogenDec31,
        totaalDividend, totaalRente, totaalKoersresultaat,
        vergelijk, bankenDetail, heffingsvrij, tarieven
      });
      setLoading(false);
    }

    laadData();
  }, [year]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
    </div>
  );

  if (!data) return (
    <div className="text-center py-16 bg-slate-800/30 border border-slate-700 rounded-2xl">
      <AlertCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
      <p className="text-slate-400">Geen gegevens gevonden voor {year}</p>
    </div>
  );

  const voordeelWerkelijk = data.vergelijk.voordeliigsteMethode === 'werkelijk';

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Aangifte Export</h1>
          <p className="text-slate-400 mt-1">Belastingjaar {year} — Overzicht voor Mijn Belastingdienst</p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl px-4 py-2.5 text-sm font-medium"
        >
          <Printer className="w-4 h-4" /> Afdrukken / PDF
        </button>
      </div>

      {/* Advies banner */}
      <div className={`rounded-2xl p-5 mb-6 border ${voordeelWerkelijk ? 'bg-emerald-900/30 border-emerald-600/40' : 'bg-orange-900/30 border-orange-600/40'}`}>
        <div className="flex items-start gap-3">
          <CheckCircle className={`w-6 h-6 flex-shrink-0 mt-0.5 ${voordeelWerkelijk ? 'text-emerald-400' : 'text-orange-400'}`} />
          <div>
            <p className={`font-semibold ${voordeelWerkelijk ? 'text-emerald-300' : 'text-orange-300'}`}>
              Advies: Kies voor {voordeelWerkelijk ? 'werkelijk rendement' : 'forfaitair rendement'}
            </p>
            <p className="text-slate-400 text-sm mt-1">
              U bespaart {formatEuro(data.vergelijk.voordeel)} belasting door de{' '}
              {voordeelWerkelijk ? 'werkelijk rendement' : 'forfaitaire'} methode te kiezen.
            </p>
          </div>
        </div>
      </div>

      {/* Hoofdoverzicht - wat u invult in de aangifte */}
      <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-400" />
          In te vullen in Mijn Belastingdienst — Box 3
        </h2>
        <div className="space-y-3">
          {[
            { label: 'Waarde bezittingen op 1 januari', value: formatEuro(data.totaalVermogenJan1), highlight: true },
            { label: 'Heffingsvrij vermogen', value: formatEuro(data.heffingsvrij), sub: `(${year})` },
            { label: 'Belastbaar vermogen', value: formatEuro(Math.max(0, data.totaalVermogenJan1 - data.heffingsvrij)), highlight: true },
            { label: 'Werkelijk rendement (totaal)', value: formatEuro(data.totaalRendement), highlight: true },
            { label: '— waarvan koersresultaat', value: formatEuro(data.totaalKoersresultaat) },
            { label: '— waarvan dividend / rente', value: formatEuro(data.totaalDividend) },
            { label: `Belastingtarief (${year})`, value: `${data.tarieven.belasting * 100}%` },
            { label: 'Te betalen belasting (werkelijk)', value: formatEuro(data.vergelijk.werkelijk.belasting), highlight: true, color: 'red' },
            { label: 'Te betalen belasting (forfaitair)', value: formatEuro(data.vergelijk.forfaitair.belasting), color: 'orange' },
          ].map(({ label, value, sub, highlight, color }) => (
            <div key={label} className={`flex items-center justify-between py-2.5 px-4 rounded-xl ${highlight ? 'bg-slate-900/80' : 'bg-slate-900/30'}`}>
              <span className="text-slate-300 text-sm">{label} {sub && <span className="text-slate-500 text-xs">{sub}</span>}</span>
              <span className={`font-semibold ${color === 'red' ? 'text-red-400' : color === 'orange' ? 'text-orange-400' : 'text-white'}`}>
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Per bank */}
      <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Uitsplitsing per bank / broker</h2>
        <div className="space-y-2">
          {data.bankenDetail.map(bank => (
            <div key={bank.id} className="flex items-center justify-between py-3 px-4 bg-slate-900/50 rounded-xl">
              <span className="text-slate-300">{bank.naam}</span>
              <div className="flex gap-6 text-sm">
                <span className="text-slate-400">Vermogen 1/1: <span className="text-white">{formatEuro(bank.vermogen)}</span></span>
                <span className="text-slate-400">Rendement: <span className={bank.rendement >= 0 ? 'text-emerald-400' : 'text-red-400'}>{formatEuro(bank.rendement)}</span></span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Vergelijking tabel */}
      <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Vergelijking methoden</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-700">
                <th className="text-left py-2 font-medium">Methode</th>
                <th className="text-right py-2 font-medium">Rendement</th>
                <th className="text-right py-2 font-medium">Belasting ({data.tarieven.belasting * 100}%)</th>
                <th className="text-right py-2 font-medium">Voordeel</th>
              </tr>
            </thead>
            <tbody>
              <tr className={`border-b border-slate-800 ${voordeelWerkelijk ? 'text-emerald-300' : 'text-slate-300'}`}>
                <td className="py-3">Werkelijk rendement {voordeelWerkelijk && '✓ Voordeligst'}</td>
                <td className="text-right py-3">{formatEuro(data.totaalRendement)}</td>
                <td className="text-right py-3">{formatEuro(data.vergelijk.werkelijk.belasting)}</td>
                <td className="text-right py-3">{voordeelWerkelijk ? formatEuro(data.vergelijk.voordeel) : '—'}</td>
              </tr>
              <tr className={!voordeelWerkelijk ? 'text-emerald-300' : 'text-slate-300'}>
                <td className="py-3">Forfaitair rendement ({formatPct(data.vergelijk.forfaitair.forfaitairPercentage)}) {!voordeelWerkelijk && '✓ Voordeligst'}</td>
                <td className="text-right py-3">{formatEuro(data.vergelijk.forfaitair.forfaitairRendement)}</td>
                <td className="text-right py-3">{formatEuro(data.vergelijk.forfaitair.belasting)}</td>
                <td className="text-right py-3">{!voordeelWerkelijk ? formatEuro(data.vergelijk.voordeel) : '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
