// Fix102 - Multi-file import — meerdere PDF bestanden tegelijk
// Fix104 - Mobiele import fix: files direct opslaan voor async (Android Chrome fix)
// Fix105 - Gratis limiet: max 1 PDF
import { useState, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { importeerBank } from '../hooks/useLocalDB';
import { parseerPDF, detectBankType } from '../services/pdfParser';
import Layout from '../components/Layout';
import Breadcrumb from '../components/Breadcrumb';
import { Upload, FileText, CheckCircle, AlertCircle, Loader, X, ArrowRight, Check } from 'lucide-react';

// ============ PDF TEKST EXTRACTOR ============
async function laadPdfJs() {
  if (window['pdfjs-dist/build/pdf']) return;
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function extractPDFText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const pdfjsLib = window['pdfjs-dist/build/pdf'];
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const typedArray = new Uint8Array(e.target.result);
        const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const groepen = new Map();
          for (const item of content.items) {
            if (!item.str.trim()) continue;
            const y = Math.round(item.transform[5]);
            const x = item.transform[4];
            if (!groepen.has(y)) groepen.set(y, []);
            groepen.get(y).push({ x, tekst: item.str });
          }
          const gesorteerdeY = [...groepen.keys()].sort((a, b) => b - a);
          const regels = gesorteerdeY.map(y => {
            const items = groepen.get(y).sort((a, b) => a.x - b.x);
            return items.map(i => i.tekst).join(' ');
          });
          fullText += regels.join('\n') + '\n';
        }
        resolve(fullText);
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error('Bestand lezen mislukt'));
    reader.readAsArrayBuffer(file);
  });
}

const fmt = (n) => n == null ? '-' : `€ ${Number(n).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ============ BESTAND KAART ============
function BestandKaart({ item, onVerwijder, onToggleRekening, onJaarChange }) {
  const { bestandsnaam, status, fout, resultaat, geselecteerd, importJaar } = item;

  const statusKleur = {
    laden: 'border-slate-700',
    herkend: 'border-blue-600/40',
    fout: 'border-red-700/40',
    geimporteerd: 'border-emerald-700/40',
  }[status] || 'border-slate-700';

  const totaalRekeningen = resultaat?.meerdere_jaren
    ? resultaat.jaren.length
    : (resultaat?.rekeningen?.length || 0);
  const aantalGeselecteerd = Object.values(geselecteerd).filter(Boolean).length;

  return (
    <div className={`border rounded-2xl overflow-hidden transition-all ${statusKleur} bg-slate-800/40`}>
      {/* Header */}
      <div className="p-4 flex items-center gap-3">
        <div className="flex-shrink-0">
          {status === 'laden' && <Loader size={18} className="text-slate-400 animate-spin" />}
          {status === 'herkend' && <FileText size={18} className="text-blue-400" />}
          {status === 'fout' && <AlertCircle size={18} className="text-red-400" />}
          {status === 'geimporteerd' && <CheckCircle size={18} className="text-emerald-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{bestandsnaam}</p>
          {status === 'laden' && <p className="text-xs text-slate-500">Verwerken...</p>}
          {status === 'herkend' && resultaat && (
            <p className="text-xs text-slate-400">
              {resultaat.bank} · {resultaat.meerdere_jaren ? `${totaalRekeningen} jaren` : `${totaalRekeningen} rekening(en)`}
              {resultaat.jaar ? ` · ${resultaat.jaar}` : ''}
            </p>
          )}
          {status === 'fout' && <p className="text-xs text-red-400">{fout}</p>}
          {status === 'geimporteerd' && <p className="text-xs text-emerald-400">Geïmporteerd ✓</p>}
        </div>
        {status !== 'laden' && status !== 'geimporteerd' && (
          <button onClick={onVerwijder} className="text-slate-500 hover:text-red-400 p-1 flex-shrink-0">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Rekeningen + jaar selector */}
      {status === 'herkend' && resultaat && (
        <div className="border-t border-slate-700 px-4 pb-4 pt-3 space-y-3">
          {/* Jaar */}
          {!resultaat.meerdere_jaren && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 whitespace-nowrap">Importeer als jaar:</label>
              <select value={importJaar} onChange={e => onJaarChange(parseInt(e.target.value))}
                className="bg-slate-700 border border-slate-600 text-white rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500">
                {[2021,2022,2023,2024,2025,2026].map(j => <option key={j} value={j}>{j}</option>)}
              </select>
            </div>
          )}

          {/* Rekeningen checkboxen */}
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {resultaat.meerdere_jaren
              ? resultaat.jaren.map((j, i) => (
                <label key={i} className="flex items-center gap-2 cursor-pointer group">
                  <input type="checkbox" checked={!!geselecteerd[i]}
                    onChange={() => onToggleRekening(i)}
                    className="rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-0" />
                  <span className="text-xs text-slate-300 group-hover:text-white">
                    {j.jaar} — {j.rekening.naam}
                  </span>
                </label>
              ))
              : resultaat.rekeningen.map((rec, i) => (
                <label key={i} className="flex items-center gap-2 cursor-pointer group">
                  <input type="checkbox" checked={!!geselecteerd[i]}
                    onChange={() => onToggleRekening(i)}
                    className="rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-0" />
                  <span className="text-xs text-slate-300 group-hover:text-white truncate">
                    {rec.naam}
                    {rec.type && <span className="ml-1 text-slate-500">({rec.type})</span>}
                  </span>
                  {rec.jan1_saldo > 0 && (
                    <span className="text-xs text-slate-500 ml-auto flex-shrink-0">{fmt(rec.jan1_saldo)}</span>
                  )}
                </label>
              ))
            }
          </div>
          <p className="text-xs text-slate-500">{aantalGeselecteerd} van {totaalRekeningen} geselecteerd</p>
        </div>
      )}
    </div>
  );
}

// ============ HOOFD COMPONENT ============
export default function ImportPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef();
  const [bestanden, setBestanden] = useState([]); // array van { id, bestandsnaam, file, status, resultaat, geselecteerd, importJaar, fout }
  const [importStatus, setImportStatus] = useState(null); // null | 'bezig' | 'klaar'
  const [importResultaat, setImportResultaat] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const defaultJaar = () => {
    const nu = new Date();
    return nu.getMonth() >= 5 ? nu.getFullYear() : nu.getFullYear() - 1;
  };

  // ============ VERWERK BESTANDEN ============
  const verwerkBestanden = async (files) => {
    // files is al een Array (vanuit onFileChange) of FileList (vanuit drop)
    const fileArray = (Array.isArray(files) ? files : Array.from(files))
      .filter(f => f.type === 'application/pdf' || f.name?.toLowerCase().endsWith('.pdf'));

    if (fileArray.length === 0) return;

    // Maak nieuw[] direct aan en zet in state VOORDAT we async laden
    const nieuw = fileArray.map(f => ({
      id: Math.random().toString(36).slice(2),
      bestandsnaam: f.name,
      file: f,
      status: 'laden',
      resultaat: null,
      geselecteerd: {},
      importJaar: defaultJaar(),
      fout: '',
    }));
    setBestanden(prev => [...prev, ...nieuw]);

    // Nu pas async dingen doen
    await laadPdfJs();

    // Verwerk elk bestand
    for (const item of nieuw) {
      try {
        const tekst = await extractPDFText(item.file);
        const resultaat = parseerPDF(tekst);

        if (resultaat.type === 'onbekend') {
          setBestanden(prev => prev.map(b => b.id === item.id
            ? { ...b, status: 'fout', fout: resultaat.fout || 'Bank niet herkend' }
            : b));
          continue;
        }

        // Init jaar en selectie
        let jaar = defaultJaar();
        if (resultaat.meerdere_jaren) {
          jaar = resultaat.jaren[resultaat.jaren.length - 1]?.jaar || jaar;
        } else if (resultaat.jaar) {
          jaar = resultaat.jaar;
        }

        const initSel = {};
        const n = resultaat.meerdere_jaren ? resultaat.jaren.length : (resultaat.rekeningen?.length || 0);
        for (let i = 0; i < n; i++) initSel[i] = true;

        setBestanden(prev => prev.map(b => b.id === item.id
          ? { ...b, status: 'herkend', resultaat, geselecteerd: initSel, importJaar: jaar }
          : b));
      } catch (err) {
        setBestanden(prev => prev.map(b => b.id === item.id
          ? { ...b, status: 'fout', fout: err.message }
          : b));
      }
    }
  };

  const onFileChange = (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    // Kopieer File objecten direct naar array VOOR e.target.value reset
    // Android Chrome geeft file referenties vrij na een async await
    const fileArray = Array.from(files);
    e.target.value = '';
    verwerkBestanden(fileArray);
  };

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) verwerkBestanden(e.dataTransfer.files);
  }, []);

  const verwijderBestand = (id) => setBestanden(prev => prev.filter(b => b.id !== id));

  const toggleRekening = (id, idx) => {
    setBestanden(prev => prev.map(b => b.id === id
      ? { ...b, geselecteerd: { ...b.geselecteerd, [idx]: !b.geselecteerd[idx] } }
      : b));
  };

  const setJaar = (id, jaar) => {
    setBestanden(prev => prev.map(b => b.id === id ? { ...b, importJaar: jaar } : b));
  };

  // ============ IMPORTEER ALLES ============
  const doImport = async () => {
    setImportStatus('bezig');
    let totaal = 0;

    for (const item of bestanden) {
      if (item.status !== 'herkend' || !item.resultaat) continue;
      const { resultaat, geselecteerd, importJaar } = item;

      try {
        if (resultaat.meerdere_jaren) {
          const geselecteerdeJaren = resultaat.jaren.filter((_, i) => geselecteerd[i]);
          for (const { jaar, rekening } of geselecteerdeJaren) {
            await importeerBank(jaar, { naam: resultaat.bank }, [rekening]);
            totaal++;
          }
        } else if (resultaat.type === 'raisin') {
          const groepen = {};
          resultaat.rekeningen.forEach((rec, i) => {
            if (!geselecteerd[i]) return;
            const bankNaam = rec.bank_naam || 'Raisin';
            if (!groepen[bankNaam]) groepen[bankNaam] = [];
            groepen[bankNaam].push(rec);
          });
          for (const [bankNaam, recs] of Object.entries(groepen)) {
            await importeerBank(importJaar, { naam: `Raisin – ${bankNaam}` }, recs);
            totaal += recs.length;
          }
        } else {
          const geselRekeningen = resultaat.rekeningen.filter((_, i) => geselecteerd[i]);
          if (geselRekeningen.length > 0) {
            await importeerBank(importJaar, { naam: resultaat.bank }, geselRekeningen);
            totaal += geselRekeningen.length;
          }
        }

        setBestanden(prev => prev.map(b => b.id === item.id ? { ...b, status: 'geimporteerd' } : b));
      } catch (err) {
        setBestanden(prev => prev.map(b => b.id === item.id
          ? { ...b, status: 'fout', fout: `Import mislukt: ${err.message}` }
          : b));
      }
    }

    setImportResultaat({ totaal });
    setImportStatus('klaar');
  };

  const resetAlles = () => {
    setBestanden([]);
    setImportStatus(null);
    setImportResultaat(null);
  };

  const aantalKlaar = bestanden.filter(b => b.status === 'herkend').length;
  const aantalGeselecteerd = bestanden
    .filter(b => b.status === 'herkend')
    .reduce((sum, b) => sum + Object.values(b.geselecteerd).filter(Boolean).length, 0);

  return (
    <Layout>
      <div className="max-w-2xl">
        <Breadcrumb items={[{ label: 'Importeren' }]} />

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-600/20 border border-blue-600/30 rounded-xl flex items-center justify-center">
            <Upload size={20} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Jaaroverzichten importeren</h1>
            <p className="text-sm text-slate-400">Upload meerdere PDF's tegelijk — Centraal Beheer, Raisin, DEGIRO, Evi, ABN AMRO, Meewind, Collin</p>
          </div>
        </div>

        {/* Drop zone — input buiten label, gekoppeld via htmlFor/id (iOS Safari fix) */}
        <input
          ref={fileInputRef}
          id="pdf-file-input"
          type="file"
          accept=".pdf,application/pdf"
          multiple
          onChange={onFileChange}
          className="hidden"
          style={{ display: 'none' }}
        />
        <label
          htmlFor="pdf-file-input"
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all mb-4 flex flex-col items-center ${
            dragOver
              ? 'border-blue-500 bg-blue-950/40'
              : 'border-slate-600 hover:border-slate-500 bg-slate-800/20 hover:bg-slate-800/40'
          }`}
        >
          <Upload size={28} className="text-slate-500 mb-2" />
          <p className="text-slate-300 text-sm font-medium">Tik om bestanden te kiezen</p>
          <p className="text-slate-500 text-xs mt-1">Of sleep PDF's hierheen · meerdere bestanden tegelijk</p>
        </label>

        {/* Bestandenlijst */}
        {bestanden.length > 0 && (
          <div className="space-y-3 mb-4">
            {bestanden.map(item => (
              <BestandKaart
                key={item.id}
                item={item}
                onVerwijder={() => verwijderBestand(item.id)}
                onToggleRekening={(idx) => toggleRekening(item.id, idx)}
                onJaarChange={(jaar) => setJaar(item.id, jaar)}
              />
            ))}
          </div>
        )}

        {/* Actie balk */}
        {aantalKlaar > 0 && importStatus !== 'klaar' && (
          <div className="flex items-center gap-3 p-4 bg-slate-800/60 border border-slate-700 rounded-2xl">
            <div className="flex-1">
              <p className="text-sm text-white">
                {aantalGeselecteerd} rekening(en) uit {aantalKlaar} bestand(en) klaar om te importeren
              </p>
            </div>
            <button
              onClick={doImport}
              disabled={aantalGeselecteerd === 0 || importStatus === 'bezig'}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl px-5 py-2.5 text-sm font-medium flex-shrink-0"
            >
              {importStatus === 'bezig'
                ? <><Loader size={16} className="animate-spin" /> Bezig...</>
                : <><ArrowRight size={16} /> Alles importeren</>}
            </button>
          </div>
        )}

        {/* Klaar */}
        {importStatus === 'klaar' && importResultaat && (
          <div className="p-5 bg-emerald-900/20 border border-emerald-700/30 rounded-2xl">
            <div className="flex items-center gap-3 mb-3">
              <CheckCircle size={20} className="text-emerald-400" />
              <p className="text-white font-medium">Import geslaagd!</p>
            </div>
            <p className="text-sm text-emerald-300/80 mb-4">
              {importResultaat.totaal} rekening(en) geïmporteerd.
            </p>
            <div className="flex gap-3">
              <button onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-4 py-2 text-sm font-medium">
                <ArrowRight size={16} /> Naar dashboard
              </button>
              <button onClick={resetAlles}
                className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl px-4 py-2 text-sm">
                <Upload size={16} /> Meer importeren
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
