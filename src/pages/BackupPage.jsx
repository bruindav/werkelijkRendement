// Backup & Restore pagina 
import { useState, useRef } from 'react';
import Layout from '../components/Layout';
import Breadcrumb from '../components/Breadcrumb';
import {
  exporteerBackup, importeerBackup, leesBestand,
  controleerWachtwoord, wisAlleData
} from '../services/backup';
import {
  Download, Upload, Shield, Eye, EyeOff, Check,
  AlertTriangle, Loader, Trash2, RefreshCw, Lock, Info
} from 'lucide-react';

function WachtwoordVeld({ label, value, onChange, placeholder }) {
  const [toon, setToon] = useState(false);
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <div className="relative">
        <input
          type={toon ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button type="button" onClick={() => setToon(!toon)}
          className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-200">
          {toon ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}

export default function BackupPage() {
  // Export state
  const [exportWw, setExportWw] = useState('');
  const [exportWwHerhaal, setExportWwHerhaal] = useState('');
  const [exportStatus, setExportStatus] = useState(null);
  const [exportResultaat, setExportResultaat] = useState(null);

  // Import state
  const [importBestand, setImportBestand] = useState(null);
  const [importBestandNaam, setImportBestandNaam] = useState('');
  const [importWw, setImportWw] = useState('');
  const [importModus, setImportModus] = useState('samenvoegen');
  const [importStatus, setImportStatus] = useState(null);
  const [importResultaat, setImportResultaat] = useState(null);
  const [importFout, setImportFout] = useState('');

  // Wis alles state
  const [wisBevestig, setWisBevestig] = useState(false);
  const [wisStatus, setWisStatus] = useState(null);

  const fileInputRef = useRef();

  // ============ EXPORT ============
  const handleExport = async () => {
    if (!exportWw) return;
    if (exportWw !== exportWwHerhaal) {
      setExportStatus('ww_mismatch');
      return;
    }
    if (exportWw.length < 6) {
      setExportStatus('ww_kort');
      return;
    }

    setExportStatus('bezig');
    try {
      const result = await exporteerBackup(exportWw);
      setExportResultaat(result);
      setExportStatus('klaar');
      setExportWw('');
      setExportWwHerhaal('');
    } catch (err) {
      setExportStatus('fout');
      console.error(err);
    }
  };

  // ============ IMPORT BESTAND KIEZEN ============
  const handleBestandKiezen = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const inhoud = await leesBestand(file);
    setImportBestand(inhoud);
    setImportBestandNaam(file.name);
    setImportStatus('bestand_geladen');
    setImportFout('');
    setImportResultaat(null);
    setImportWw('');
  };

  // ============ IMPORT ============
  const handleImport = async () => {
    if (!importBestand || !importWw) return;

    // Controleer wachtwoord snel
    if (!controleerWachtwoord(importBestand, importWw)) {
      setImportFout('Verkeerd wachtwoord.');
      return;
    }

    setImportStatus('bezig');
    setImportFout('');
    try {
      const result = await importeerBackup(importBestand, importWw, importModus);
      setImportResultaat(result);
      setImportStatus('klaar');
      setImportWw('');
    } catch (err) {
      setImportFout(err.message);
      setImportStatus('fout');
    }
  };

  // ============ WIS ALLES ============
  const handleWis = async () => {
    setWisStatus('bezig');
    await wisAlleData();
    setWisStatus('klaar');
    setWisBevestig(false);
    setTimeout(() => setWisStatus(null), 3000);
  };

  const exportKanVersturen = exportWw.length >= 6 && exportWw === exportWwHerhaal;

  return (
    <Layout>
      <div className="max-w-2xl">
        <Breadcrumb items={[{ label: 'Backup & Restore' }]} />

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-600/20 border border-blue-600/30 rounded-xl flex items-center justify-center">
            <Shield size={20} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Backup & Restore</h1>
            <p className="text-sm text-slate-400">Exporteer en importeer je gegevens — versleuteld met AES-256</p>
          </div>
        </div>

        {/* Info */}
        <div className="bg-blue-950/40 border border-blue-800/30 rounded-xl px-4 py-3 mb-6 flex gap-3">
          <Info size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-300">
            Je gegevens staan uitsluitend lokaal op dit apparaat. Maak regelmatig een backup
            zodat je bij een nieuwe telefoon of browser je data kunt herstellen.
            Bewaar je wachtwoord goed — zonder wachtwoord is de backup niet te openen.
          </p>
        </div>

        {/* ============ EXPORT ============ */}
        <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-5 mb-4">
          <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
            <Download size={16} className="text-emerald-400" /> Backup maken
          </h2>
          <p className="text-xs text-slate-400 mb-4">
            Kies een wachtwoord. Alle gegevens worden versleuteld in één bestand opgeslagen.
          </p>

          <div className="space-y-3">
            <WachtwoordVeld
              label="Wachtwoord (minimaal 6 tekens)"
              value={exportWw}
              onChange={v => { setExportWw(v); setExportStatus(null); }}
              placeholder="Kies een sterk wachtwoord"
            />
            <WachtwoordVeld
              label="Herhaal wachtwoord"
              value={exportWwHerhaal}
              onChange={v => { setExportWwHerhaal(v); setExportStatus(null); }}
              placeholder="Zelfde wachtwoord nogmaals"
            />

            {/* Sterkte indicator */}
            {exportWw.length > 0 && (
              <div className="flex gap-1">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
                    i < Math.min(4, Math.floor(exportWw.length / 3))
                      ? exportWw.length >= 12 ? 'bg-emerald-500'
                        : exportWw.length >= 8 ? 'bg-amber-500'
                        : 'bg-red-500'
                      : 'bg-slate-700'
                  }`} />
                ))}
                <span className="text-xs text-slate-500 ml-2">
                  {exportWw.length < 6 ? 'Te kort' : exportWw.length < 8 ? 'Matig' : exportWw.length < 12 ? 'Goed' : 'Sterk'}
                </span>
              </div>
            )}

            {exportStatus === 'ww_mismatch' && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <AlertTriangle size={12} /> Wachtwoorden komen niet overeen.
              </p>
            )}
            {exportStatus === 'ww_kort' && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <AlertTriangle size={12} /> Wachtwoord moet minimaal 6 tekens zijn.
              </p>
            )}

            <button
              onClick={handleExport}
              disabled={!exportKanVersturen || exportStatus === 'bezig'}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl px-5 py-2.5 text-sm font-medium transition-colors"
            >
              {exportStatus === 'bezig'
                ? <><Loader size={16} className="animate-spin" /> Bezig...</>
                : <><Download size={16} /> Backup downloaden</>}
            </button>

            {exportStatus === 'klaar' && exportResultaat && (
              <div className="flex items-start gap-2 bg-emerald-900/20 border border-emerald-700/30 rounded-xl px-4 py-3">
                <Check size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-emerald-300 font-medium">Backup opgeslagen!</p>
                  <p className="text-xs text-emerald-400/70 mt-1">
                    {exportResultaat.bestandsnaam}<br />
                    {exportResultaat.aantalBanken} banken · jaren: {exportResultaat.jaren.join(', ')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ============ IMPORT ============ */}
        <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-5 mb-4">
          <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
            <Upload size={16} className="text-blue-400" /> Backup terugzetten
          </h2>
          <p className="text-xs text-slate-400 mb-4">
            Kies een eerder gemaakt backup bestand en voer het wachtwoord in.
          </p>

          {/* Bestand kiezen */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".wr-backup,application/octet-stream"
            onChange={handleBestandKiezen}
            className="hidden"
          />

          {!importBestand ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600 border-dashed rounded-xl px-5 py-3 text-sm transition-colors w-full justify-center"
            >
              <Upload size={16} />
              Kies backup bestand (.wr-backup)
            </button>
          ) : (
            <div className="space-y-3">
              {/* Bestand info */}
              <div className="flex items-center gap-2 bg-slate-900/60 rounded-lg px-3 py-2">
                <Shield size={14} className="text-blue-400 flex-shrink-0" />
                <span className="text-sm text-slate-300 flex-1 truncate">{importBestandNaam}</span>
                <button onClick={() => { setImportBestand(null); setImportBestandNaam(''); setImportStatus(null); }}
                  className="text-slate-500 hover:text-red-400">
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Modus */}
              <div>
                <label className="block text-xs text-slate-400 mb-1">Importeer modus</label>
                <div className="flex gap-2">
                  {[
                    { val: 'samenvoegen', label: '＋ Samenvoegen', sub: 'Voeg toe naast bestaande data' },
                    { val: 'overschrijven', label: '↺ Overschrijven', sub: 'Verwijder alles, herstel backup' },
                  ].map(({ val, label, sub }) => (
                    <button key={val} onClick={() => setImportModus(val)}
                      className={`flex-1 p-2 rounded-xl border text-left transition-colors ${
                        importModus === val
                          ? val === 'overschrijven'
                            ? 'bg-red-900/30 border-red-700/50 text-white'
                            : 'bg-blue-900/30 border-blue-700/50 text-white'
                          : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}>
                      <p className="text-xs font-medium">{label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
                    </button>
                  ))}
                </div>
                {importModus === 'overschrijven' && (
                  <p className="text-xs text-amber-400 mt-2 flex items-center gap-1">
                    <AlertTriangle size={12} /> Alle huidige gegevens worden permanent verwijderd.
                  </p>
                )}
              </div>

              {/* Wachtwoord */}
              <WachtwoordVeld
                label="Wachtwoord"
                value={importWw}
                onChange={v => { setImportWw(v); setImportFout(''); setImportStatus(null); }}
                placeholder="Wachtwoord van de backup"
              />

              {importFout && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <AlertTriangle size={12} /> {importFout}
                </p>
              )}

              <button
                onClick={handleImport}
                disabled={!importWw || importStatus === 'bezig'}
                className={`flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl px-5 py-2.5 text-sm font-medium transition-colors ${
                  importModus === 'overschrijven'
                    ? 'bg-red-600 hover:bg-red-500'
                    : 'bg-blue-600 hover:bg-blue-500'
                }`}
              >
                {importStatus === 'bezig'
                  ? <><Loader size={16} className="animate-spin" /> Bezig...</>
                  : <><Upload size={16} /> Backup terugzetten</>}
              </button>

              {importStatus === 'klaar' && importResultaat && (
                <div className="flex items-start gap-2 bg-emerald-900/20 border border-emerald-700/30 rounded-xl px-4 py-3">
                  <Check size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-emerald-300 font-medium">Backup teruggezet!</p>
                    <p className="text-xs text-emerald-400/70 mt-1">
                      {importResultaat.aantalBanken} banken · {importResultaat.aantalRekeningen} rekeningen
                      · {importResultaat.aantalPosities} posities hersteld<br />
                      Jaren: {importResultaat.jaren.join(', ')}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Ga naar het dashboard om je gegevens te bekijken.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ============ WIS ALLES ============ */}
        <div className="bg-slate-800/40 border border-red-900/30 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
            <Trash2 size={16} className="text-red-400" /> Alle gegevens wissen
          </h2>
          <p className="text-xs text-slate-400 mb-4">
            Verwijder alle lokaal opgeslagen gegevens. Dit kan niet ongedaan worden gemaakt.
            Maak eerst een backup.
          </p>

          {!wisBevestig ? (
            <button onClick={() => setWisBevestig(true)}
              className="flex items-center gap-2 bg-slate-700 hover:bg-red-900/50 border border-slate-600 hover:border-red-700/50 text-slate-300 hover:text-red-300 rounded-xl px-4 py-2 text-sm transition-colors">
              <Trash2 size={14} /> Alle gegevens wissen
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-2 bg-red-900/20 border border-red-700/40 rounded-xl px-4 py-3">
                <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">
                  Weet je het zeker? Alle gegevens van alle jaren worden permanent verwijderd.
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={handleWis} disabled={wisStatus === 'bezig'}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-xl px-4 py-2 text-sm font-medium">
                  {wisStatus === 'bezig' ? <Loader size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Ja, alles verwijderen
                </button>
                <button onClick={() => setWisBevestig(false)}
                  className="text-slate-400 hover:text-white text-sm px-4 py-2">
                  Annuleren
                </button>
              </div>
            </div>
          )}

          {wisStatus === 'klaar' && (
            <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
              <Check size={12} /> Alle gegevens zijn gewist.
            </p>
          )}
        </div>
      </div>
    </Layout>
  );
}
