import { useState, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { importeerBank } from '../hooks/useLocalDB';
import { parseerPDF, detectBankType } from '../services/pdfParser';
import Layout from '../components/Layout';
import Breadcrumb from '../components/Breadcrumb';
import { Upload, FileText, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Loader, X, ArrowRight } from 'lucide-react';

// ============ PDF TEKST EXTRACTOR (via pdf.js CDN) ============
async function extractPDFText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const pdfjsLib = window['pdfjs-dist/build/pdf'];
        if (!pdfjsLib) {
          reject(new Error('PDF.js niet geladen'));
          return;
        }
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        const typedArray = new Uint8Array(e.target.result);
        const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
        let fullText = '';

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          
          // 2-pass Y-grouping: verzamel eerst ALLE items, groepeer dan op Y.
          // pdf.js geeft items soms niet in regel-volgorde, dus we sorteren zelf.
          // transform[5] = bottom-up Y coordinaat (hogere waarde = hoger op pagina)
          const groepen = new Map();
          for (const item of content.items) {
            if (!item.str.trim()) continue;
            const y = Math.round(item.transform[5]);
            const x = item.transform[4];
            if (!groepen.has(y)) groepen.set(y, []);
            groepen.get(y).push({ x, tekst: item.str });
          }
          
          // Sorteer Y-groepen: hoog y = hoog op pagina = eerste regel
          const gesorteerdeY = [...groepen.keys()].sort((a, b) => b - a);
          const regels = gesorteerdeY.map(y => {
            const items = groepen.get(y).sort((a, b) => a.x - b.x);
            return items.map(i => i.tekst).join(' ');
          });
          
          fullText += regels.join('\n') + '\n';
        }

        resolve(fullText);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Bestand lezen mislukt'));
    reader.readAsArrayBuffer(file);
  });
}

// ============ BEDRAG FORMATTER ============
const fmt = (n) => n == null ? '-' : `€ ${Number(n).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ============ REKENING PREVIEW KAART ============
function RekeningKaart({ rec, index, geselecteerd, onToggle }) {
  const typeKleur = rec.type === 'deposito'
    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
    : rec.type === 'beleggen'
    ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';

  return (
    <div className={`border rounded-xl transition-all ${geselecteerd
      ? 'border-blue-500/60 bg-blue-950/30'
      : 'border-slate-700 bg-slate-800/40 opacity-60'}`}>
      <div className="p-3 flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={() => onToggle(index)}
          className={`mt-0.5 w-5 h-5 rounded flex-shrink-0 border-2 flex items-center justify-center transition-colors ${
            geselecteerd ? 'bg-blue-600 border-blue-600' : 'border-slate-500 bg-transparent'
          }`}
        >
          {geselecteerd && <CheckCircle size={12} className="text-white" />}
        </button>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-white text-sm font-medium truncate">{rec.naam}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${typeKleur}`}>{rec.type}</span>
          </div>

          {rec.posities && rec.posities.length > 0 ? (
            // Evi-stijl: toon individuele fondsen
            <div className="mt-2 space-y-1">
              {rec.posities.map((pos, pi) => (
                <div key={pi} className="flex justify-between text-xs bg-slate-900/60 rounded-lg px-3 py-1.5">
                  <span className="text-slate-300 truncate mr-4">{pos.naam}</span>
                  <div className="flex gap-3 flex-shrink-0 text-right">
                    <span className="text-slate-400">{fmt(pos.jan1_waarde)}</span>
                    <span className="text-white">→ {fmt(pos.dec31_waarde)}</span>
                    {pos.dividend > 0 && <span className="text-emerald-400">div {fmt(pos.dividend)}</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : rec.type === 'beleggen' ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 text-xs">
              <div className="bg-slate-900/60 rounded-lg p-2">
                <div className="text-slate-400 mb-0.5">1 jan</div>
                <div className="text-white font-medium">{fmt(rec.jan1_waarde)}</div>
              </div>
              <div className="bg-slate-900/60 rounded-lg p-2">
                <div className="text-slate-400 mb-0.5">31 dec</div>
                <div className="text-white font-medium">{fmt(rec.dec31_waarde)}</div>
              </div>
              <div className="bg-slate-900/60 rounded-lg p-2">
                <div className="text-slate-400 mb-0.5">Aankopen</div>
                <div className="text-white font-medium">{fmt(rec.aankopen_totaal)}</div>
              </div>
              <div className="bg-slate-900/60 rounded-lg p-2">
                <div className="text-slate-400 mb-0.5">Dividend</div>
                <div className="text-emerald-400 font-medium">{fmt(rec.dividend_totaal)}</div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2 text-xs">
              <div className="bg-slate-900/60 rounded-lg p-2">
                <div className="text-slate-400 mb-0.5">Saldo 1 jan</div>
                <div className="text-white font-medium">{fmt(rec.jan1_saldo)}</div>
              </div>
              <div className="bg-slate-900/60 rounded-lg p-2">
                <div className="text-slate-400 mb-0.5">Saldo 31 dec</div>
                <div className="text-white font-medium">{fmt(rec.dec31_saldo)}</div>
              </div>
              <div className="bg-slate-900/60 rounded-lg p-2">
                <div className="text-slate-400 mb-0.5">Rente ontvangen</div>
                <div className="text-emerald-400 font-medium">{fmt(rec.ontvangen_rente)}</div>
              </div>
            </div>
          )}

          {rec.rente_pct > 0 && (
            <div className="mt-1 text-xs text-slate-400">
              {rec.rente_pct}% p.j.
              {rec.looptijd_maanden ? ` · ${rec.looptijd_maanden} maanden` : ''}
              {rec.land ? ` · ${rec.land}` : ''}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ HOOFD COMPONENT ============
export default function ImportPage() {
  const { user } = useApp();
  const navigate = useNavigate();
  const fileInputRef = useRef();

  const [stap, setStap] = useState('upload'); // upload | preview | importeren | klaar
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState('');
  const [parseResultaat, setParseResultaat] = useState(null);
  const [geselecteerd, setGeselecteerd] = useState({});
  const [importJaar, setImportJaar] = useState(new Date().getFullYear() - 1);
  const [voortgang, setVoortgang] = useState({ gedaan: 0, totaal: 0, huidig: '' });
  const [geimporteerd, setGeimporteerd] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  // ============ PDF LADEN ============
  const verwerkBestand = async (file) => {
    if (!file || file.type !== 'application/pdf') {
      setFout('Selecteer een PDF-bestand.');
      return;
    }

    setBezig(true);
    setFout('');
    setParseResultaat(null);

    try {
      // Laad pdf.js dynamisch
      if (!window['pdfjs-dist/build/pdf']) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      const tekst = await extractPDFText(file);
      // parseerPDF herkent alle banken inclusief Evi (na Y-grouping werkt alles tekst-gebaseerd)
      const resultaat = parseerPDF(tekst);

      if (resultaat.type === 'onbekend') {
        setFout(resultaat.fout || 'Bank niet herkend in dit PDF-bestand.');
        setBezig(false);
        return;
      }

      // Bij meerdere jaren (CB Beleggen): gebruik het eerste jaar als startpunt
      if (resultaat.meerdere_jaren) {
        const jarenNummers = resultaat.jaren.map(j => j.jaar);
        setImportJaar(jarenNummers[jarenNummers.length - 1] || importJaar);
      } else if (resultaat.jaar) {
        setImportJaar(resultaat.jaar);
      }

      // Initialiseer selectie (alles aan)
      const initSel = {};
      if (resultaat.meerdere_jaren) {
        resultaat.jaren.forEach((j, i) => { initSel[i] = true; });
      } else {
        (resultaat.rekeningen || []).forEach((_, i) => { initSel[i] = true; });
      }
      setGeselecteerd(initSel);
      setParseResultaat(resultaat);
      setStap('preview');
    } catch (err) {
      setFout(`Fout bij verwerken: ${err.message}`);
    }

    setBezig(false);
  };

  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) verwerkBestand(file);
  };

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) verwerkBestand(file);
  }, []);

  const toggleRekening = (i) => {
    setGeselecteerd(prev => ({ ...prev, [i]: !prev[i] }));
  };

  const selecteerAlles = () => {
    const n = parseResultaat.meerdere_jaren
      ? parseResultaat.jaren.length
      : parseResultaat.rekeningen.length;
    const nieuweStaat = {};
    for (let i = 0; i < n; i++) nieuweStaat[i] = true;
    setGeselecteerd(nieuweStaat);
  };

  const deselecteerAlles = () => setGeselecteerd({});

  // ============ IMPORT NAAR FIRESTORE ============
  const doImport = async () => {
    setStap('importeren');
    setFout('');
    let totaalGedaan = 0;
    let totaalItems = 0;
    let aangemaakteRekeningen = 0;

    try {
      if (parseResultaat.meerdere_jaren) {
        // CB Beleggen: elk geselecteerd jaar afzonderlijk importeren
        const geselecteerdeJaren = parseResultaat.jaren.filter((_, i) => geselecteerd[i]);
        totaalItems = geselecteerdeJaren.length;

        for (const { jaar, rekening } of geselecteerdeJaren) {
          setVoortgang({ gedaan: totaalGedaan, totaal: totaalItems, huidig: `${jaar} - ${rekening.naam}` });
          await importeerBank(jaar, { naam: parseResultaat.bank }, [rekening]);
          totaalGedaan++;
          aangemaakteRekeningen++;
        }
      } else {
        const geselRekeningen = parseResultaat.rekeningen.filter((_, i) => geselecteerd[i]);
        totaalItems = geselRekeningen.length;

        // Bij Raisin: groepeer per partnerbank
        if (parseResultaat.type === 'raisin') {
          const groepen = {};
          for (const rec of geselRekeningen) {
            const bankNaam = rec.bank_naam || 'Raisin';
            if (!groepen[bankNaam]) groepen[bankNaam] = [];
            groepen[bankNaam].push(rec);
          }
          for (const [bankNaam, recs] of Object.entries(groepen)) {
            setVoortgang({ gedaan: totaalGedaan, totaal: totaalItems, huidig: `Raisin – ${bankNaam}` });
            await importeerBank(importJaar, { naam: `Raisin – ${bankNaam}` }, recs);
            totaalGedaan += recs.length;
            aangemaakteRekeningen += recs.length;
          }
        } else {
          setVoortgang({ gedaan: totaalGedaan, totaal: totaalItems, huidig: parseResultaat.bank });
          await importeerBank(importJaar, { naam: parseResultaat.bank }, geselRekeningen);
          totaalGedaan += geselRekeningen.length;
          aangemaakteRekeningen += geselRekeningen.length;
        }
      }

      setVoortgang({ gedaan: totaalItems, totaal: totaalItems, huidig: 'Klaar!' });
      setGeimporteerd({ jaar: importJaar, aantal: aangemaakteRekeningen });
      setStap('klaar');
    } catch (err) {
      setFout(`Import mislukt: ${err.message}`);
      setStap('preview');
    }
  };


  // ============ RENDER ============
  const aantalGeselecteerd = Object.values(geselecteerd).filter(Boolean).length;
  const totaalRekeningen = parseResultaat?.meerdere_jaren
    ? parseResultaat.jaren.length
    : (parseResultaat?.rekeningen?.length || 0);

  return (
    <Layout user={user}>
      <div className="max-w-3xl mx-auto">
        <Breadcrumb items={[{ label: 'Importeren' }]} />

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-600/20 border border-blue-600/30 rounded-xl flex items-center justify-center">
            <Upload size={20} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Jaaroverzicht importeren</h1>
            <p className="text-sm text-slate-400">Upload een PDF van Centraal Beheer, Raisin of ABN AMRO</p>
          </div>
        </div>

        {/* Foutmelding */}
        {fout && (
          <div className="mb-4 bg-red-900/30 border border-red-700/50 rounded-xl p-4 flex gap-3">
            <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-300">{fout}</div>
          </div>
        )}

        {/* STAP 1: UPLOAD */}
        {stap === 'upload' && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
              dragOver
                ? 'border-blue-500 bg-blue-950/40'
                : 'border-slate-600 hover:border-slate-500 bg-slate-800/20 hover:bg-slate-800/40'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={onFileChange}
              className="hidden"
            />
            {bezig ? (
              <div className="flex flex-col items-center gap-3">
                <Loader size={40} className="text-blue-400 animate-spin" />
                <p className="text-slate-300">PDF verwerken...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-slate-700/60 rounded-2xl flex items-center justify-center">
                  <FileText size={32} className="text-slate-400" />
                </div>
                <div>
                  <p className="text-white font-medium mb-1">Sleep PDF hierheen of klik om te kiezen</p>
                  <p className="text-slate-400 text-sm">Ondersteunde banken: Centraal Beheer · Raisin · ABN AMRO</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STAP 2: PREVIEW */}
        {stap === 'preview' && parseResultaat && (
          <div className="space-y-4">
            {/* Bank badge + jaar selector */}
            <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-white font-semibold">{parseResultaat.bank}</span>
                  <span className="text-xs bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full">
                    ✓ Herkend
                  </span>
                  {parseResultaat.meerdere_jaren && (
                    <span className="text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full">
                      Meerdere jaren
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-400">
                  {aantalGeselecteerd} van {totaalRekeningen} {parseResultaat.meerdere_jaren ? 'jaren' : 'rekeningen'} geselecteerd
                </p>
              </div>

              {!parseResultaat.meerdere_jaren && (
                <div className="flex items-center gap-2">
                  <label className="text-sm text-slate-400 whitespace-nowrap">Importeer als jaar:</label>
                  <select
                    value={importJaar}
                    onChange={e => setImportJaar(parseInt(e.target.value))}
                    className="bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {[2021, 2022, 2023, 2024, 2025, 2026].map(j => (
                      <option key={j} value={j}>{j}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Selecteer alles / geen */}
            <div className="flex items-center gap-3">
              <button onClick={selecteerAlles} className="text-xs text-blue-400 hover:text-blue-300">Alles selecteren</button>
              <span className="text-slate-600">·</span>
              <button onClick={deselecteerAlles} className="text-xs text-slate-400 hover:text-slate-300">Geen</button>
              <button
                onClick={() => { setStap('upload'); setParseResultaat(null); setFout(''); }}
                className="ml-auto text-xs text-slate-400 hover:text-slate-300 flex items-center gap-1"
              >
                <X size={12} /> Ander bestand
              </button>
            </div>

            {/* Rekeningen lijst */}
            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              {parseResultaat.meerdere_jaren ? (
                parseResultaat.jaren.map((j, i) => (
                  <RekeningKaart
                    key={i}
                    rec={{ ...j.rekening, naam: `${j.jaar} – ${j.rekening.naam}` }}
                    index={i}
                    geselecteerd={!!geselecteerd[i]}
                    onToggle={toggleRekening}
                  />
                ))
              ) : (
                parseResultaat.rekeningen.map((rec, i) => (
                  <RekeningKaart
                    key={i}
                    rec={rec}
                    index={i}
                    geselecteerd={!!geselecteerd[i]}
                    onToggle={toggleRekening}
                  />
                ))
              )}
            </div>

            {/* Import knop */}
            <div className="pt-2">
              <button
                onClick={doImport}
                disabled={aantalGeselecteerd === 0}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl px-6 py-3 font-medium transition-colors"
              >
                <ArrowRight size={18} />
                {aantalGeselecteerd} {parseResultaat.meerdere_jaren ? 'jaar' : 'rekening(en)'} importeren
                {!parseResultaat.meerdere_jaren && ` (${importJaar})`}
              </button>
              <p className="text-xs text-slate-500 mt-2">
                Er wordt een nieuwe bank aangemaakt in je overzicht voor {parseResultaat.meerdere_jaren ? 'elk geselecteerd jaar' : `jaar ${importJaar}`}.
              </p>
            </div>
          </div>
        )}

        {/* STAP 3: BEZIG MET IMPORTEREN */}
        {stap === 'importeren' && (
          <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-8 text-center">
            <Loader size={40} className="text-blue-400 animate-spin mx-auto mb-4" />
            <p className="text-white font-medium mb-2">Importeren...</p>
            {voortgang.totaal > 0 && (
              <>
                <div className="w-full bg-slate-700 rounded-full h-2 mb-3">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${(voortgang.gedaan / voortgang.totaal) * 100}%` }}
                  />
                </div>
                <p className="text-sm text-slate-400 truncate">{voortgang.huidig}</p>
                <p className="text-xs text-slate-500 mt-1">{voortgang.gedaan} / {voortgang.totaal}</p>
              </>
            )}
          </div>
        )}

        {/* STAP 4: KLAAR */}
        {stap === 'klaar' && geimporteerd && (
          <div className="bg-slate-800/40 border border-green-700/40 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-green-400" />
            </div>
            <h2 className="text-white text-xl font-bold mb-2">Import geslaagd!</h2>
            <p className="text-slate-300 mb-1">
              <span className="text-white font-semibold">{geimporteerd.aantal} rekening(en)</span> geïmporteerd
            </p>
            <p className="text-slate-400 text-sm mb-6">
              Je vindt de gegevens nu terug in je jaaroverzicht.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => navigate(`/jaar/${geimporteerd.jaar}`)}
                className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-6 py-2.5 font-medium"
              >
                <ArrowRight size={16} />
                Ga naar {geimporteerd.jaar}
              </button>
              <button
                onClick={() => { setStap('upload'); setParseResultaat(null); setGeimporteerd(null); setFout(''); }}
                className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl px-6 py-2.5 text-sm"
              >
                <Upload size={16} />
                Nog een PDF importeren
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
