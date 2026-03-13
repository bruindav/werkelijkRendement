import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import JaarOverzicht from './pages/JaarOverzicht';
import BankDetail from './pages/BankDetail';
import PositieLijst from './pages/PositieLijst';
import AangiftePage from './pages/AangiftePage';
import SpaarpaginaLijst from './pages/SpaarpaginaLijst';
import ImportPage from './pages/ImportPage';

function AuthGuardNoLayout({ children }) {
  const { user, loading } = useApp();
  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
    </div>
  );
  if (!user) return <Navigate to="/" replace />;
  return children;
}

function AuthGuard({ children }) {
  const { user, loading } = useApp();
  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
    </div>
  );
  if (!user) return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  const { user } = useApp();
  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/dashboard" element={<AuthGuard><Dashboard /></AuthGuard>} />
      <Route path="/jaar/:year" element={<AuthGuard><JaarOverzicht /></AuthGuard>} />
      <Route path="/jaar/:year/bank/:bankId" element={<AuthGuard><BankDetail /></AuthGuard>} />
      <Route path="/jaar/:year/bank/:bankId/rekening/:accountId" element={<AuthGuard><PositieLijst /></AuthGuard>} />
      <Route path="/jaar/:year/bank/:bankId/rekening/:accountId/sparen" element={<AuthGuard><SpaarpaginaLijst /></AuthGuard>} />
      <Route path="/aangifte/:year" element={<AuthGuard><AangiftePage /></AuthGuard>} />
      <Route path="/importeren" element={<AuthGuardNoLayout><ImportPage /></AuthGuardNoLayout>} />
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
