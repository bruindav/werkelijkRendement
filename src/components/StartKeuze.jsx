// Versie: Fix126
// Welkomstscherm voor nieuwe gebruikers: demo bekijken of zelf beginnen
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export default function StartKeuze() {
  const { kiesModus } = useApp();

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/30 mx-auto mb-4">
            <span className="text-2xl">📊</span>
          </div>
          <h1 className="text-2xl font-bold">Welkom bij Werkelijk Rendement</h1>
          <p className="text-slate-400 mt-2 text-sm">
            Bereken je werkelijke rendement in Box 3 en vergelijk het met het forfaitaire stelsel.
            Hoe wil je starten?
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <button
            onClick={() => kiesModus('demo')}
            className="text-left bg-slate-900 border border-slate-800 hover:border-blue-500/60 rounded-2xl p-5 transition-colors"
          >
            <div className="text-3xl mb-3">🎭</div>
            <p className="font-semibold text-white">Demo bekijken</p>
            <p className="text-sm text-slate-400 mt-1">
              Verken de app met realistische voorbeeldgegevens (spaargeld, deposito, beleggingen).
              Je kunt alles uitproberen en later weer verlaten.
            </p>
          </button>

          <button
            onClick={() => kiesModus('echt')}
            className="text-left bg-slate-900 border border-slate-800 hover:border-emerald-500/60 rounded-2xl p-5 transition-colors"
          >
            <div className="text-3xl mb-3">✏️</div>
            <p className="font-semibold text-white">Zelf beginnen</p>
            <p className="text-sm text-slate-400 mt-1">
              Start met een lege app en voer je eigen gegevens in of importeer ze.
              Alles blijft lokaal op dit apparaat.
            </p>
          </button>
        </div>

        <p className="text-xs text-slate-500 text-center mt-6">
          De demo gebruikt een aparte opslag: je eigen gegevens worden nooit aangeraakt of overschreven.
        </p>
        <div className="flex justify-center gap-4 text-xs text-slate-500 mt-3">
          <Link to="/privacy" className="hover:text-slate-300">Privacy</Link>
          <Link to="/disclaimer" className="hover:text-slate-300">Disclaimer</Link>
          <Link to="/help" className="hover:text-slate-300">Help</Link>
        </div>
      </div>
    </div>
  );
}
