// Instellingen — Box 3 tarieven, heffingsvrij vermogen, partner
import { useState, useEffect } from 'react';
import { getInstellingen, setInstellingen as saveInstellingen } from '../services/localDb';
import { useApp } from '../context/AppContext';
import Layout from '../components/Layout';
import Breadcrumb from '../components/Breadcrumb';
import { Settings, Save, RotateCcw, Check, Users, User, Copy, ArrowRight, AlertTriangle, Loader, ChevronDown } from 'lucide-react';
import { FORFAITAIR_TARIEVEN, HEFFINGSVRIJ_VERMOGEN } from '../services/berekening';
import { kopieerJaar, controleerJaarLeeg } from '../hooks/useLocalDB';

const JAREN = [2021, 2022, 2023, 2024, 2025, 2026];

const DEFAULT_INSTELLINGEN = {
  partner: false,            // true = heffingsvrij × 2
  tarieven: {},              // overschrijf per jaar: { 2025: { spaargeld, beleggingen, schulden, belasting } }
  heffingsvrij: {},          // overschrijf per jaar: { 2025: 57000 }
};

function berekenDefault(jaar) {
  const t = FORFAITAIR_TARIEVEN[jaar] || FORFAITAIR_TARIEVEN[2025];
  const h = HEFFINGSVRIJ_VERMOGEN[jaar] || 57000;
  return { ...t, heffingsvrij: h };
}

export default function InstellingenPage() {
  const { user } = useApp();
  const [instellingen, setInstellingen] = useState(null);
  const [loading, setLoading] = useState(true);
  const [opgeslagen, setOpgeslagen] = useState(false);
  const [selectedJaar, setSelectedJaar] = useState(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState('tarieven'); // 'tarieven' | 'kopieren'

  // Kopiëren state
  const [vanJaar, setVanJaar] = useState(new Date().getFullYear() - 1);
  const [naarJaar, setNaarJaar] = useState(new Date().getFullYear());
  const [kopieerStatus, setKopieerStatus] = useState(null); // null | 'checking' | 'leeg' | 'bezet' | 'bezig' | 'klaar' | 'fout'
  const [kopieerFout, setKopieerFout] = useState('');

  // Laad instellingen
  useEffect(() => {
    if (!user?.uid) return;
    getInstellingen().then(data => {
      setInstellingen(data ? { ...DEFAULT_INSTELLINGEN, ...data } : { ...DEFAULT_INSTELLINGEN });
      setLoading(false);
    });
  }, []);

  const sla = async () => {
    await saveInstellingen(instellingen);
    setOpgeslagen(true);
    setTimeout(() => setOpgeslagen(false), 2000);
  };

  const setTarief = (jaar, veld, waarde) => {
    setInstellingen(prev => ({
      ...prev,
      tarieven: {
        ...prev.tarieven,
        [jaar]: {
          ...(prev.tarieven?.[jaar] || {}),
          [veld]: parseFloat(waarde) || 0,
        }
      }
    }));
  };

  const setHeffingsvrij = (jaar, waarde) => {
    setInstellingen(prev => ({
      ...prev,
      heffingsvrij: { ...prev.heffingsvrij, [jaar]: parseFloat(waarde) || 0 }
    }));
  };

  const resetJaar = (jaar) => {
    setInstellingen(prev => ({
      ...prev,
      tarieven: { ...prev.tarieven, [jaar]: undefined },
      heffingsvrij: { ...prev.heffingsvrij, [jaar]: undefined },
    }));
  };

  const handleKopieerCheck = async () => {
    setKopieerStatus('checking');
    setKopieerFout('');
    try {
      const leeg = await controleerJaarLeeg(user.uid, naarJaar);
      setKopieerStatus(leeg ? 'leeg' : 'bezet');
    } catch (err) {
      setKopieerStatus('fout');
      setKopieerFout(err.message);
    }
  };

  const handleKopieer = async () => {
    setKopieerStatus('bezig');
    try {
      await kopieerJaar(user.uid, vanJaar, naarJaar);
      setKopieerStatus('klaar');
    } catch (err) {
      setKopieerStatus('fout');
      setKopieerFout(err.message);
    }
  };

  if (loading || !instellingen) {
    return <div className="animate-pulse h-64 bg-slate-800 rounded-2xl" />;
  }

  // Actieve waarden voor geselecteerd jaar (eigen instelling of standaard)
  const def = berekenDefault(selectedJaar);
  const eigen = instellingen.tarieven?.[selectedJaar] || {};
  const eigenHvv = instellingen.heffingsvrij?.[selectedJaar];
  const heeftEigenInstelling = Object.keys(eigen).length > 0 || eigenHvv !== undefined;

  const actueel = {
    spaargeld:    eigen.spaargeld    ?? def.spaargeld,
    beleggingen:  eigen.beleggingen  ?? def.beleggingen,
    schulden:     eigen.schulden     ?? def.schulden,
    belasting:    eigen.belasting    ?? def.belasting,
    heffingsvrij: eigenHvv           ?? def.heffingsvrij,
  };

  const hvvEffectief = actueel.heffingsvrij * (instellingen.partner ? 2 : 1);

  return (
    <Layout>
    <div className="max-w-2xl">
      <Breadcrumb items={[{ label: 'Instellingen' }]} />

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-slate-700/60 border border-slate-600 rounded-xl flex items-center justify-center">
          <Settings size={20} className="text-slate-300" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Instellingen</h1>
          <p className="text-sm text-slate-400">Tarieven, heffingsvrij vermogen en jaar kopiëren</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900/60 rounded-xl p-1 mb-6">
        {[
          { key: 'tarieven', label: 'Box 3 tarieven', icon: Settings },
          { key: 'kopieren', label: 'Jaar kopiëren', icon: Copy },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === key ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}>
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab: Tarieven */}
      {activeTab === 'tarieven' && (<>

      {/* Partner instelling */}
      <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-5 mb-4">
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Users size={16} className="text-blue-400" /> Fiscaal partnerschap
        </h2>
        <div className="flex gap-3">
          {[
            { val: false, label: 'Alleen', icon: User, sub: '1× heffingsvrij' },
            { val: true,  label: 'Met fiscaal partner', icon: Users, sub: '2× heffingsvrij' },
          ].map(({ val, label, icon: Icon, sub }) => (
            <button key={String(val)}
              onClick={() => setInstellingen(p => ({ ...p, partner: val }))}
              className={`flex-1 flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                instellingen.partner === val
                  ? 'bg-blue-600/20 border-blue-500/50 text-white'
                  : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-600'
              }`}>
              <Icon size={18} className={instellingen.partner === val ? 'text-blue-400' : ''} />
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-slate-500">{sub}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Jaar selector */}
      <div className="flex gap-1 mb-4 bg-slate-900/60 rounded-xl p-1 flex-wrap">
        {JAREN.map(j => (
          <button key={j} onClick={() => setSelectedJaar(j)}
            className={`flex-1 py-1.5 px-2 rounded-lg text-sm font-medium transition-colors ${
              selectedJaar === j ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}>
            {j}
            {(instellingen.tarieven?.[j] || instellingen.heffingsvrij?.[j]) && (
              <span className="ml-1 text-xs text-blue-300">★</span>
            )}
          </button>
        ))}
      </div>

      {/* Tarieven voor geselecteerd jaar */}
      <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">Tarieven {selectedJaar}</h2>
          <div className="flex items-center gap-2">
            {heeftEigenInstelling && (
              <span className="text-xs text-blue-400 bg-blue-900/30 border border-blue-800/40 px-2 py-0.5 rounded-full">
                Aangepast
              </span>
            )}
            {heeftEigenInstelling && (
              <button onClick={() => resetJaar(selectedJaar)}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1">
                <RotateCcw size={12} /> Reset naar standaard
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { key: 'spaargeld',   label: 'Rendement spaargeld %',    kleur: 'emerald', hint: 'Forfaitair % voor spaargeld/deposito' },
            { key: 'beleggingen', label: 'Rendement beleggingen %',   kleur: 'blue',    hint: 'Forfaitair % voor beleggingen' },
            { key: 'belasting',   label: 'Belastingtarief box 3 %',   kleur: 'red',     hint: 'Percentage over het forfaitair rendement' },
            { key: 'schulden',    label: 'Rendement schulden %',      kleur: 'amber',   hint: 'Negatief forfaitair % voor schulden' },
          ].map(({ key, label, kleur, hint }) => (
            <div key={key}>
              <label className="block text-xs text-slate-400 mb-1">
                {label}
                <span className="ml-1 text-slate-600">({hint})</span>
              </label>
              <div className="relative">
                <input
                  type="number" step="0.001"
                  value={((actueel[key] || 0) * 100).toFixed(3)}
                  onChange={e => setTarief(selectedJaar, key, (parseFloat(e.target.value) || 0) / 100)}
                  className={`w-full bg-slate-700 border text-white rounded-lg px-3 py-2 pr-7 text-sm focus:outline-none focus:ring-2 focus:ring-${kleur}-500 ${
                    eigen[key] !== undefined ? `border-${kleur}-600/60` : 'border-slate-600'
                  }`}
                />
                <span className="absolute right-2.5 top-2 text-slate-400 text-sm">%</span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Standaard: {(def[key] * 100).toFixed(3)}%
              </p>
            </div>
          ))}
        </div>

        {/* Heffingsvrij vermogen */}
        <div className="mt-4 pt-4 border-t border-slate-700">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Heffingsvrij vermogen {selectedJaar} (per persoon, €)
              </label>
              <input
                type="number" step="1"
                value={actueel.heffingsvrij}
                onChange={e => setHeffingsvrij(selectedJaar, e.target.value)}
                className={`w-full bg-slate-700 border text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  eigenHvv !== undefined ? 'border-blue-600/60' : 'border-slate-600'
                }`}
              />
              <p className="text-xs text-slate-600 mt-0.5">
                Standaard: €{def.heffingsvrij.toLocaleString('nl-NL')}
              </p>
            </div>
            <div className="bg-slate-900/60 rounded-xl p-3">
              <p className="text-xs text-slate-500 mb-1">Effectief heffingsvrij vermogen</p>
              <p className="text-lg font-bold text-white">
                €{hvvEffectief.toLocaleString('nl-NL')}
              </p>
              <p className="text-xs text-slate-500">
                {instellingen.partner ? `2× €${actueel.heffingsvrij.toLocaleString('nl-NL')} (met partner)` : `1 persoon`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Overzicht alle jaren */}
      <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-white mb-3">Overzicht tarieven alle jaren</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-700">
                <th className="text-left pb-2">Jaar</th>
                <th className="text-right pb-2">Sparen</th>
                <th className="text-right pb-2">Beleggen</th>
                <th className="text-right pb-2">Belasting</th>
                <th className="text-right pb-2">Heffingsvrij</th>
              </tr>
            </thead>
            <tbody>
              {JAREN.map(j => {
                const d = berekenDefault(j);
                const e = instellingen.tarieven?.[j] || {};
                const eh = instellingen.heffingsvrij?.[j];
                const isAangepast = Object.keys(e).length > 0 || eh !== undefined;
                return (
                  <tr key={j}
                    onClick={() => setSelectedJaar(j)}
                    className={`border-b border-slate-800 cursor-pointer transition-colors ${
                      selectedJaar === j ? 'bg-blue-950/30' : 'hover:bg-slate-900/30'
                    }`}>
                    <td className="py-2 font-medium text-white">
                      {j} {isAangepast && <span className="text-blue-400 ml-1">★</span>}
                    </td>
                    <td className="py-2 text-right text-slate-300">
                      {((e.spaargeld ?? d.spaargeld) * 100).toFixed(2)}%
                    </td>
                    <td className="py-2 text-right text-slate-300">
                      {((e.beleggingen ?? d.beleggingen) * 100).toFixed(2)}%
                    </td>
                    <td className="py-2 text-right text-slate-300">
                      {((e.belasting ?? d.belasting) * 100).toFixed(0)}%
                    </td>
                    <td className="py-2 text-right text-slate-300">
                      €{((eh ?? d.heffingsvrij) * (instellingen.partner ? 2 : 1)).toLocaleString('nl-NL')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <button onClick={sla}
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-6 py-3 font-medium transition-colors">
        {opgeslagen ? <Check size={18} /> : <Save size={18} />}
        {opgeslagen ? 'Opgeslagen!' : 'Instellingen opslaan'}
      </button>
      </>)}

      {/* Tab: Kopiëren */}
      {activeTab === 'kopieren' && (
        <div className="space-y-4">
          <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
              <Copy size={16} className="text-blue-400" /> Jaar kopiëren
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Kopieer banken, rekeningen en posities van het ene jaar naar het andere.
              Beleggingsposities worden overgezet met de 31 dec waarden als nieuwe 1 jan waarden.
              Spaar- en depositorekeningen worden gekopieerd met dezelfde instellingen.
            </p>

            {/* Van / Naar selectors */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1">
                <label className="block text-xs text-slate-400 mb-1">Van jaar</label>
                <select value={vanJaar} onChange={e => { setVanJaar(parseInt(e.target.value)); setKopieerStatus(null); }}
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {[2021,2022,2023,2024,2025,2026].map(j => <option key={j} value={j}>{j}</option>)}
                </select>
              </div>
              <div className="flex items-end pb-2">
                <ArrowRight size={18} className="text-slate-500" />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-slate-400 mb-1">Naar jaar</label>
                <select value={naarJaar} onChange={e => { setNaarJaar(parseInt(e.target.value)); setKopieerStatus(null); }}
                  className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {[2021,2022,2023,2024,2025,2026].map(j => <option key={j} value={j}>{j}</option>)}
                </select>
              </div>
            </div>

            {vanJaar === naarJaar && (
              <p className="text-xs text-amber-400 mb-3">⚠️ Van- en naar-jaar zijn hetzelfde.</p>
            )}

            {/* Stap 1: Controleer knop */}
            {kopieerStatus === null && vanJaar !== naarJaar && (
              <button onClick={handleKopieerCheck}
                className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl px-4 py-2.5 text-sm font-medium">
                <Copy size={16} /> Controleer jaar {naarJaar}
              </button>
            )}

            {/* Checking */}
            {kopieerStatus === 'checking' && (
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <Loader size={16} className="animate-spin" /> Jaar {naarJaar} controleren...
              </div>
            )}

            {/* Jaar is leeg — veilig kopiëren */}
            {kopieerStatus === 'leeg' && (
              <div className="space-y-3">
                <div className="flex items-start gap-2 bg-emerald-900/20 border border-emerald-700/30 rounded-xl px-4 py-3">
                  <Check size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-emerald-300">
                    Jaar {naarJaar} is leeg — je kunt veilig kopiëren van {vanJaar}.
                  </p>
                </div>
                <button onClick={handleKopieer}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-5 py-2.5 text-sm font-medium">
                  <Copy size={16} /> Kopieer {vanJaar} → {naarJaar}
                </button>
              </div>
            )}

            {/* Jaar heeft al data — waarschuwing */}
            {kopieerStatus === 'bezet' && (
              <div className="space-y-3">
                <div className="flex items-start gap-2 bg-amber-900/20 border border-amber-700/40 rounded-xl px-4 py-3">
                  <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-amber-300 font-medium">Jaar {naarJaar} heeft al gegevens</p>
                    <p className="text-xs text-amber-400/70 mt-0.5">
                      De gegevens van {vanJaar} worden toegevoegd naast de bestaande gegevens van {naarJaar}.
                      Er wordt niets overschreven of verwijderd.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleKopieer}
                    className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl px-5 py-2.5 text-sm font-medium">
                    <Copy size={16} /> Toch kopiëren naar {naarJaar}
                  </button>
                  <button onClick={() => setKopieerStatus(null)}
                    className="text-slate-400 hover:text-white text-sm px-4 py-2.5">
                    Annuleren
                  </button>
                </div>
              </div>
            )}

            {/* Bezig */}
            {kopieerStatus === 'bezig' && (
              <div className="flex items-center gap-3 text-slate-300 text-sm">
                <Loader size={18} className="animate-spin text-blue-400" />
                Kopiëren van {vanJaar} naar {naarJaar}...
              </div>
            )}

            {/* Klaar */}
            {kopieerStatus === 'klaar' && (
              <div className="flex items-start gap-2 bg-emerald-900/20 border border-emerald-700/30 rounded-xl px-4 py-3">
                <Check size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-emerald-300 font-medium">Gekopieerd!</p>
                  <p className="text-xs text-emerald-400/70 mt-0.5">
                    Banken en posities van {vanJaar} zijn toegevoegd aan {naarJaar}.
                  </p>
                  <button onClick={() => setKopieerStatus(null)}
                    className="text-xs text-blue-400 hover:text-blue-300 mt-2">
                    Nog een keer kopiëren
                  </button>
                </div>
              </div>
            )}

            {/* Fout */}
            {kopieerStatus === 'fout' && (
              <div className="flex items-start gap-2 bg-red-900/20 border border-red-700/40 rounded-xl px-4 py-3">
                <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-red-300">Er ging iets mis</p>
                  <p className="text-xs text-red-400/70 mt-0.5">{kopieerFout}</p>
                  <button onClick={() => setKopieerStatus(null)} className="text-xs text-slate-400 hover:text-white mt-2">
                    Opnieuw proberen
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
    </Layout>
  );
}
