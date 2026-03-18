// Versie: Fix117
// Fix103b - Secundaire nav items (Help + Privacy) correct gerenderd in sidebar
// Fix 10 - Jaar switchen navigeert mee
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { LayoutDashboard, Building2, FileText, Upload, Settings, Shield, HelpCircle, Lock, Scale, ChevronDown, Menu, X } from 'lucide-react';

const YEARS = [2021, 2022, 2023, 2024, 2025, 2026];

export default function Layout({ children }) {
  const { user, logout, selectedYear, setSelectedYear, isEditing } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleYearChange = (newYear) => {
    if (isEditing) {
      alert('Sla eerst je wijzigingen op voordat je van jaar wisselt.');
      return;
    }
    setSelectedYear(Number(newYear));
    // Als we op een jaar-specifieke pagina zitten, switch naar hetzelfde pad maar nieuw jaar
    const path = location.pathname;
    const jaarMatch = path.match(/^\/jaar\/(\d{4})(.*)/);
    if (jaarMatch) {
      const rest = jaarMatch[2];
      // Extraheer alleen bank en rekening, niet dieper (posities mogen wisselen)
      const parts = rest.split('/').filter(Boolean); // ['bank', bankId, 'rekening', rekId]
      if (parts.length >= 2) {
        // We zitten op bank of rekening niveau — navigeer naar jaar/bank lijst
        navigate(`/jaar/${newYear}`);
      } else {
        navigate(`/jaar/${newYear}`);
      }
    } else if (path.startsWith('/aangifte/')) {
      navigate(`/aangifte/${newYear}`);
    }
    // dashboard en andere pagina's: geen navigatie nodig
  };

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: `/jaar/${selectedYear}`, icon: Building2, label: 'Banken & Posities' },
    { to: `/aangifte/${selectedYear}`, icon: FileText, label: 'Aangifte Export' },
    { to: '/importeren', icon: Upload, label: 'Importeren', exact: true },
    { to: '/instellingen', icon: Settings, label: 'Instellingen', exact: true },
    { to: '/backup', icon: Shield, label: 'Backup & Restore', exact: true },
  ];

  // Secundaire nav items — onderaan sidebar
  const navItemsSecundair = [
    { to: '/help', icon: HelpCircle, label: 'Help', exact: true },
    { to: '/privacy', icon: Lock, label: 'Privacy & Gegevens', exact: true },
    { to: '/disclaimer', icon: Scale, label: 'Disclaimer', exact: true },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white flex">
      {/* Sidebar - desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 border-r border-slate-800 fixed h-full">
        {/* Logo */}
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/30">
              <span className="text-lg">📊</span>
            </div>
            <div>
              <p className="font-bold text-white leading-tight">Werkelijk</p>
              <p className="text-xs text-slate-400">Rendement Box 3</p>
            </div>
          </div>
        </div>

        {/* Jaar selector */}
        <div className="p-4 border-b border-slate-800">
          <label className="text-xs text-slate-500 uppercase tracking-wider font-medium block mb-2">Belastingjaar</label>
          <div className="relative">
            <select
              value={selectedYear}
              onChange={e => handleYearChange(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => {
            const active = location.pathname === to || location.pathname.startsWith(to.split('/').slice(0,3).join('/'));
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  active
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Secundaire nav — Help en Privacy */}
        <div className="px-4 pb-2 border-t border-slate-800 pt-3">
          {navItemsSecundair.map(({ to, icon: Icon, label }) => {
            const active = location.pathname === to;
            return (
              <Link key={to} to={to}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors ${
                  active ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/60'
                }`}>
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </Link>
            );
          })}
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">📊</span>
          <span className="font-bold">Werkelijk Rendement</span>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="text-slate-400">
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-slate-900 pt-16">
          <div className="p-4 border-b border-slate-800">
            <label className="text-xs text-slate-500 uppercase tracking-wider font-medium block mb-2">Belastingjaar</label>
            <select
              value={selectedYear}
              onChange={e => { handleYearChange(e.target.value); setMobileOpen(false); }}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2"
            >
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <nav className="p-4 space-y-1">
            {navItems.map(({ to, icon: Icon, label }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-300 hover:bg-slate-800"
              >
                <Icon className="w-5 h-5" /> {label}
              </Link>
            ))}
          </nav>
          {/* Secundaire nav mobiel */}
          <div className="p-4 border-t border-slate-800 space-y-1">
            {navItemsSecundair.map(({ to, icon: Icon, label }) => (
              <Link key={to} to={to} onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white text-sm">
                <Icon className="w-5 h-5" /> {label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 md:ml-64 pt-16 md:pt-0 min-h-screen overflow-x-hidden">
        <div className="p-4 md:p-8 max-w-6xl mx-auto w-full min-w-0">
          {children}
        </div>
      </main>
    </div>
  );
}
