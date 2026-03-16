// AppContext — lokale versie zonder Firebase Auth 
// Gebruiker is altijd "ingelogd" — data staat lokaal op het apparaat
import { createContext, useContext, useEffect, useState } from 'react';
import { getProfiel, setProfiel } from '../services/localDb';

const AppContext = createContext(null);
const LOKALE_UID = 'lokaal';

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const bepaalStandaardJaar = () => {
    const nu = new Date();
    const na31Mei = nu.getMonth() >= 5;
    return na31Mei ? nu.getFullYear() : nu.getFullYear() - 1;
  };

  const [selectedYear, setSelectedYear] = useState(bepaalStandaardJaar());
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    getProfiel().then(profiel => {
      if (profiel) {
        setUser({ uid: LOKALE_UID, naam: profiel.naam || 'Gebruiker' });
      } else {
        setProfiel({ naam: 'Gebruiker' }).then(() => {
          setUser({ uid: LOKALE_UID, naam: 'Gebruiker' });
        });
      }
      setLoading(false);
    });
  }, []);

  const updateNaam = async (naam) => {
    await setProfiel({ naam });
    setUser(u => ({ ...u, naam }));
  };

  return (
    <AppContext.Provider value={{
      user, loading, selectedYear, setSelectedYear,
      isEditing, setIsEditing, updateNaam,
      loginWithGoogle: null, loginWithEmail: null,
      registerWithEmail: null, logout: null,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
