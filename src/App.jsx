// Versie: Fix126
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import JaarOverzicht from './pages/JaarOverzicht';
import BankDetail from './pages/BankDetail';
import PositieLijst from './pages/PositieLijst';
import AangiftePage from './pages/AangiftePage';
import SpaarpaginaLijst from './pages/SpaarpaginaLijst';
import ImportPage from './pages/ImportPage';
import InstellingenPage from './pages/InstellingenPage';
import BackupPage from './pages/BackupPage';
import PrivacyPage from './pages/PrivacyPage';
import HelpPage from './pages/HelpPage';
import DisclaimerPage from './pages/DisclaimerPage';
import StartKeuze from './components/StartKeuze';

const Laden = () => (
  <div className="min-h-screen bg-slate-950 flex items-center justify-center">
    <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
  </div>
);

function AuthGuardNoLayout({ children }) {
  const { loading } = useApp();
  if (loading) return <Laden />;
  return children;
}

function AuthGuard({ children }) {
  const { loading } = useApp();
  if (loading) return <Laden />;
  return <Layout>{children}</Layout>;
}

const OPEN_PADEN = ['/privacy', '/disclaimer', '/help'];

function AppRoutes() {
  const { keuzeNodig, loading } = useApp();
  const { pathname } = useLocation();
  // Nieuwe gebruiker: eerst kiezen tussen demo en zelf beginnen
  if (!loading && keuzeNodig && !OPEN_PADEN.includes(pathname)) return <StartKeuze />;
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<AuthGuard><Dashboard /></AuthGuard>} />
      <Route path="/jaar/:year" element={<AuthGuard><JaarOverzicht /></AuthGuard>} />
      <Route path="/jaar/:year/bank/:bankId" element={<AuthGuard><BankDetail /></AuthGuard>} />
      <Route path="/jaar/:year/bank/:bankId/rekening/:accountId" element={<AuthGuard><PositieLijst /></AuthGuard>} />
      <Route path="/jaar/:year/bank/:bankId/rekening/:accountId/sparen" element={<AuthGuard><SpaarpaginaLijst /></AuthGuard>} />
      <Route path="/aangifte/:year" element={<AuthGuard><AangiftePage /></AuthGuard>} />
      <Route path="/importeren" element={<AuthGuardNoLayout><ImportPage /></AuthGuardNoLayout>} />
      <Route path="/instellingen" element={<AuthGuardNoLayout><InstellingenPage /></AuthGuardNoLayout>} />
      <Route path="/backup" element={<AuthGuardNoLayout><BackupPage /></AuthGuardNoLayout>} />
      <Route path="/privacy" element={<AuthGuardNoLayout><PrivacyPage /></AuthGuardNoLayout>} />
      <Route path="/help" element={<AuthGuardNoLayout><HelpPage /></AuthGuardNoLayout>} />
      <Route path="/disclaimer" element={<AuthGuardNoLayout><DisclaimerPage /></AuthGuardNoLayout>} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <AppRoutes />
      </AppProvider>
    </BrowserRouter>
  );
}
