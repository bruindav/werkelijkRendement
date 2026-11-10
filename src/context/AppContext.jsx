// Versie: Fix126
// AppContext — lokale versie zonder Firebase Auth
// Gebruiker is altijd "ingelogd" — data staat lokaal op het apparaat
// Fix126: demo-modus (aparte database) + startkeuze voor nieuwe gebruikers
import { createContext, useContext, useEffect, useState } from 'react';
import db, { getProfiel, setProfiel } from '../services/localDb';
import { getModus, setModus, isDemo, DEMO_JAAR } from '../services/modus';
import { seedDemoData, resetDemoData, verwijderDemoDb } from '../services/demoData';

const AppContext = createContext(null);
const LOKALE_UID = 'lokaal';

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [keuzeNodig, setKeuzeNodig] = useState(false);
  const demo = isDemo();

  const bepaalStandaardJaar = () => {
    if (isDemo()) return DEMO_JAAR; // demo-data bevat 2024 en 2025
    const nu = new Date();
    const na31Mei = nu.getMonth() >= 5;
    return na31Mei ? nu.getFullYear() : nu.getFullYear() - 1;
  };

  const [selectedYear, setSelectedYear] = useState(bepaalStandaardJaar());
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    let actief = true;
    (async () => {
      try {
        const modus = getModus();

        if (modus === null) {
          // Bestaande gebruiker met echte data? Dan stil op 'echt' zetten.
          const aantal = await db.banken.count();
          if (aantal > 0) {
            setModus('echt');
          } else {
            if (actief) { setKeuzeNodig(true); setLoading(false); }
            return;
          }
        }

        if (modus === 'demo') await seedDemoData();

        const profiel = await getProfiel();
        if (profiel) {
          if (actief) setUser({ uid: LOKALE_UID, naam: profiel.naam || 'Gebruiker' });
        } else {
          await setProfiel({ naam: 'Gebruiker' });
          if (actief) setUser({ uid: LOKALE_UID, naam: 'Gebruiker' });
        }
      } finally {
        if (actief) setLoading(false);
      }
    })();
    return () => { actief = false; };
  }, []);

  const updateNaam = async (naam) => {
    await setProfiel({ naam });
    setUser(u => ({ ...u, naam }));
  };

  // 'demo' of 'echt' kiezen; herlaad zodat de juiste database geopend wordt
  const kiesModus = (modus) => {
    setModus(modus);
    window.location.reload();
  };

  // Demo verlaten: demo-database weg, terug naar echte gegevens (of startkeuze)
  const sluitDemoAf = async () => {
    await verwijderDemoDb();
    setModus(null);
    window.location.href = '/dashboard';
  };

  const resetDemo = async () => {
    await resetDemoData();
    window.location.href = '/dashboard';
  };

  return (
    <AppContext.Provider value={{
      user, loading, selectedYear, setSelectedYear,
      isEditing, setIsEditing, updateNaam,
      demo, keuzeNodig, kiesModus, sluitDemoAf, resetDemo,
      loginWithGoogle: null, loginWithEmail: null,
      registerWithEmail: null, logout: null,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
