// Versie: Fix125
import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { getAangifteData } from '../hooks/useLocalDB';
import { getInstellingen } from '../services/localDb';
import { berekenPositieRendement, vergelijkMethoden, formatEuro, formatEuroGeheel, formatPct, FORFAITAIR_TARIEVEN } from '../services/berekening';
import Layout from '../components/Layout';
import Breadcrumb from '../components/Breadcrumb';
import { FileText, Printer, CheckCircle, AlertCircle, Copy, Check } from 'lucide-react';

function KopieerbaarVeld({ label, waarde, toelichting }) {
  const [gekopieerd, setGekopieerd] = useState(false);
  const kopieer = () => {
    const tekst = typeof waarde === 'string' ? waarde.replace(/[€\s.]/g, '').replace(',', '.') : String(waarde);
    navigator.clipboard?.writeText(tekst);
    setGekopieerd(true);
    setTimeout(() => setGekopieerd(false), 1500);
  };
  return (
    <div className="flex items-center justify-between py-2.5 px-4 rounded-xl bg-slate-900/50 group">
      <div>
        <span className="text-slate-300 text-sm">{label}</span>
        {toelichting && <p className="text-xs text-slate-500 mt-0.5">{toelichting}</p>}
      </div>
      <div className="flex items-center gap-2">
        <span className="font-semibold text-white">{waarde}</span>
        <button onClick={kopieer}
          className="opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity text-slate-500 hover:text-blue-400 p-1"
          title="Kopieer getal">
          {gekopieerd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

export default function AangiftePage() {
  const { user, selectedYear } = useApp();
  const year = selectedYear;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) { setLoading(false); return; }

    async function laadData() {
      setLoading(true);
      const instellingen = await getInstellingen();
      const allData = await getAangifteData(String(year));

      let totaalRendement = 0;
      let totaalVermogenJan1 = 0, totaalVermogenDec31 = 0;
      let totaalSparenJan1 = 0, totaalBeleggenJan1 = 0;
      let totaalDividend = 0, totaalRente = 0, totaalKoersresultaat = 0;
      const bankenDetail = [];

      for (const bank of allData) {
        let bankJan1 = 0, bankDec31 = 0, bankRendement = 0;
        const rekenDetails = [];

        for (const rek of bank.rekeningen) {
          let rekJan1 = 0, rekDec31 = 0, rekRendement = 0;

          if (rek.type === 'beleggen' || !rek.type) {
            for (const pos of rek.posities || []) {
              const r = berekenPositieRendement(pos);
              rekJan1 += r.waardeJan1;
              rekDec31 += r.waardeDec31;
              rekRendement += r.totaalRendement;
              totaalBeleggenJan1 += r.waardeJan1;
              totaalDividend += r.inkomen || 0;
              totaalKoersresultaat += r.koersresultaat || 0;
            }
          } else {
            if (rek.jan1_saldo || rek.dec31_saldo || rek.ontvangen_rente) {
              rekJan1 = rek.jan1_saldo || 0;
              rekDec31 = rek.dec31_saldo || 0;
              rekRendement = (rek.ontvangen_rente || 0) - (rek.kosten || 0);
              totaalSparenJan1 += rekJan1;
              totaalRente += rek.ontvangen_rente || 0;
            }
          }

          if (rekJan1 || rekDec31 || rekRendement) {
            rekenDetails.push({ naam: rek.naam, type: rek.type || 'beleggen', jan1: rekJan1, dec31: rekDec31, rendement: rekRendement });
            bankJan1 += rekJan1;
            bankDec31 += rekDec31;
            bankRendement += rekRendement;
          }
        }

        if (bankJan1 || bankDec31 || bankRendement) {
          bankenDetail.push({ ...bank, jan1: bankJan1, dec31: bankDec31, rendement: bankRendement, rekeningen: rekenDetails });
          totaalVermogenJan1 += bankJan1;
          totaalVermogenDec31 += bankDec31;
          totaalRendement += bankRendement;
        }
      }

      const vermogenSplit = { sparen: totaalSparenJan1, beleggen: totaalBeleggenJan1 };
      const vergelijk = vergelijkMethoden(totaalRendement, totaalVermogenJan1, year, instellingen, vermogenSplit);
      const tarieven = FORFAITAIR_TARIEVEN[year] || FORFAITAIR_TARIEVEN[2024];
      const heffingsvrij = vergelijk.forfaitair?.heffingsvrij || 57000;

      setData({ totaalRendement, totaalVermogenJan1, totaalVermogenDec31, totaalSparenJan1, totaalBeleggenJan1,
        totaalDividend, totaalRente, totaalKoersresultaat, vergelijk, bankenDetail, tarieven, heffingsvrij });
      setLoading(false);
    }

    laadData();
  }, [user?.uid, year]);

  const typeEmoji = (type) => type === 'beleggen' ? '📈' : type === 'deposito' ? '🔒' : type === 'rekening-courant' ? '💳' : '🏦';

  return (
    <Layout>
      <div className="max-w-3xl">
        <Breadcrumb items={[{ label: 'Aangifte Export' }]} />

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white">Aangifte Export</h1>
            <p className="text-slate-400 text-sm mt-0.5">Belastingjaar {year} — overzicht voor Mijn Belastingdienst</p>
          </div>
          <button onClick={() => window.print()}
            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl px-4 py-2 text-sm">
            <Printer className="w-4 h-4" /> Afdrukken
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : !data || data.totaalVermogenJan1 === 0 ? (
          <div className="text-center py-16 bg-slate-800/30 border border-slate-700 rounded-2xl">
            <AlertCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">Geen gegevens gevonden voor {year}.</p>
            <p className="text-slate-500 text-sm mt-1">Voeg banken en posities toe via Banken & Posities.</p>
          </div>
        ) : (
          <>
            {(() => {
              const werkelijk = data.vergelijk.voordeliigsteMethode === 'werkelijk';
              return (
                <div className={`rounded-2xl p-4 mb-5 border flex items-start gap-3 ${werkelijk ? 'bg-emerald-900/20 border-emerald-600/30' : 'bg-amber-900/20 border-amber-600/30'}`}>
                  <CheckCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${werkelijk ? 'text-emerald-400' : 'text-amber-400'}`} />
                  <div>
                    <p className={`font-semibold text-sm ${werkelijk ? 'text-emerald-300' : 'text-amber-300'}`}>
                      Advies: kies {werkelijk ? 'werkelijk rendement' : 'forfaitair rendement'}
                    </p>
                    <p className="text-slate-400 text-sm mt-0.5">Besparing: {formatEuro(data.vergelijk.voordeel)} belasting.</p>
                  </div>
                </div>
              );
            })()}

            <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-5 mb-4">
              <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" /> Vermogen op 1 januari {year}
              </h2>
              <div className="space-y-1.5">
                <KopieerbaarVeld label="🏦 Spaargeld / deposito's" waarde={formatEuro(data.totaalSparenJan1)} />
                <KopieerbaarVeld label="📈 Beleggingen" waarde={formatEuro(data.totaalBeleggenJan1)} />
                <div className="flex items-center justify-between py-2.5 px-4 rounded-xl bg-blue-900/20 border border-blue-700/30">
                  <span className="text-sm font-medium text-blue-200">Totaal bezittingen</span>
                  <span className="font-bold text-white">{formatEuro(data.totaalVermogenJan1)}</span>
                </div>
                <KopieerbaarVeld label="Heffingsvrij vermogen" waarde={formatEuro(data.heffingsvrij)}
                  toelichting="Standaard bedrag — pas aan in Instellingen bij fiscaal partner" />
                <div className="flex items-center justify-between py-2.5 px-4 rounded-xl bg-slate-900/60">
                  <span className="text-sm text-slate-300">Belastbaar vermogen</span>
                  <span className="font-bold text-white">{formatEuro(Math.max(0, data.totaalVermogenJan1 - data.heffingsvrij))}</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-5 mb-4">
              <h2 className="text-sm font-semibold text-white mb-3">Werkelijk rendement {year}</h2>
              <div className="space-y-1.5">
                {data.totaalRente > 0 && <KopieerbaarVeld label="Rente ontvangen" waarde={formatEuro(data.totaalRente)} />}
                {data.totaalDividend > 0 && <KopieerbaarVeld label="Dividend ontvangen" waarde={formatEuro(data.totaalDividend)} />}
                {data.totaalKoersresultaat !== 0 && <KopieerbaarVeld label="Koersresultaat" waarde={formatEuro(data.totaalKoersresultaat)} />}
                <div className="flex items-center justify-between py-2.5 px-4 rounded-xl bg-blue-900/20 border border-blue-700/30">
                  <span className="text-sm font-medium text-blue-200">Totaal werkelijk rendement</span>
                  <span className={`font-bold ${data.totaalRendement >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {data.totaalRendement >= 0 ? '+' : ''}{formatEuro(data.totaalRendement)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-5 mb-4">
              <h2 className="text-sm font-semibold text-white mb-3">Belasting {year} ({data.tarieven.belasting * 100}%)</h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'werkelijk', label: 'Werkelijk rendement', bedrag: data.vergelijk.werkelijk.belasting, sub: `over ${formatEuro(data.totaalRendement)}` },
                  { key: 'forfaitair', label: `Forfaitair (${formatPct(data.vergelijk.forfaitair.forfaitairPercentage)})`, bedrag: data.vergelijk.forfaitair.belasting, sub: `over ${formatEuro(data.vergelijk.forfaitair.forfaitairRendement)}` },
                ].map(({ key, label, bedrag, sub }) => (
                  <div key={key} className={`rounded-xl p-4 border ${data.vergelijk.voordeliigsteMethode === key ? 'bg-emerald-900/20 border-emerald-600/30' : 'bg-slate-900/50 border-slate-700'}`}>
                    <p className="text-xs text-slate-400 mb-1">{label}</p>
                    <p className="text-lg font-bold text-white">{formatEuro(bedrag)}</p>
                    <p className="text-xs text-slate-500 mt-1">{sub}</p>
                    {data.vergelijk.voordeliigsteMethode === key && <p className="text-xs text-emerald-400 mt-1 font-medium">✓ Voordeligst</p>}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-800/40 border border-slate-700 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-700">
                <h2 className="text-sm font-semibold text-white">Specificatie per instelling</h2>
              </div>
              <div className="divide-y divide-slate-800">
                {data.bankenDetail.map(bank => (
                  <div key={bank.id}>
                    <div className="flex items-center justify-between px-5 py-3 bg-slate-900/30">
                      <span className="font-medium text-white text-sm">{bank.naam}</span>
                      <div className="flex gap-4 text-xs text-slate-400">
                        <span>1 jan: <span className="text-white">{formatEuroGeheel(bank.jan1)}</span></span>
                        <span>Rendement: <span className={bank.rendement >= 0 ? 'text-emerald-400' : 'text-red-400'}>{formatEuro(bank.rendement)}</span></span>
                      </div>
                    </div>
                    {bank.rekeningen.map((rek, i) => (
                      <div key={i} className="flex items-center justify-between px-5 py-2 pl-10 text-xs">
                        <span className="text-slate-400">{typeEmoji(rek.type)} {rek.naam}</span>
                        <div className="flex gap-4 text-slate-500">
                          <span>1 jan: <span className="text-slate-300">{formatEuro(rek.jan1)}</span></span>
                          <span className={rek.rendement >= 0 ? 'text-emerald-500/70' : 'text-red-500/70'}>{rek.rendement >= 0 ? '+' : ''}{formatEuro(rek.rendement)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
