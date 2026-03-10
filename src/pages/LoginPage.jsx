import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const { loginWithGoogle, loginWithEmail, registerWithEmail } = useApp();
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmail = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isRegister) {
        await registerWithEmail(email, password);
      } else {
        await loginWithEmail(email, password);
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.message.includes('wrong-password') ? 'Verkeerd wachtwoord' :
               err.message.includes('user-not-found') ? 'Gebruiker niet gevonden' :
               err.message.includes('email-already') ? 'Email al in gebruik' :
               'Er ging iets mis. Probeer opnieuw.');
    }
    setLoading(false);
  };

  const handleGoogle = async () => {
    try {
      await loginWithGoogle();
      navigate('/dashboard');
    } catch (err) {
      setError('Google login mislukt');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500 rounded-2xl mb-4 shadow-lg shadow-blue-500/30">
            <span className="text-2xl">📊</span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Werkelijk Rendement</h1>
          <p className="text-slate-400 mt-2">Box 3 berekening voor uw belastingaangifte</p>
        </div>

        {/* Card */}
        <div className="bg-slate-800/60 backdrop-blur border border-slate-700 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-white mb-6">
            {isRegister ? 'Account aanmaken' : 'Inloggen'}
          </h2>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-300 rounded-lg px-4 py-3 mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleEmail} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">E-mailadres</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full bg-slate-700/50 border border-slate-600 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-500"
                placeholder="uw@email.nl"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Wachtwoord</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full bg-slate-700/50 border border-slate-600 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-500"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-xl px-4 py-3 transition-colors"
            >
              {loading ? 'Even geduld...' : (isRegister ? 'Account aanmaken' : 'Inloggen')}
            </button>
          </form>

          <div className="flex items-center my-5">
            <div className="flex-1 border-t border-slate-600" />
            <span className="px-3 text-slate-500 text-sm">of</span>
            <div className="flex-1 border-t border-slate-600" />
          </div>

          <button
            onClick={handleGoogle}
            className="w-full bg-white hover:bg-slate-100 text-slate-800 font-semibold rounded-xl px-4 py-3 transition-colors flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Inloggen met Google
          </button>

          <p className="text-center text-slate-400 text-sm mt-6">
            {isRegister ? 'Al een account? ' : 'Nog geen account? '}
            <button
              onClick={() => setIsRegister(!isRegister)}
              className="text-blue-400 hover:text-blue-300 font-medium"
            >
              {isRegister ? 'Inloggen' : 'Registreren'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
