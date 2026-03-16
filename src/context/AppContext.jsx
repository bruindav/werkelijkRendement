// Fix 10 - isEditing state toegevoegd voor jaar-switch blokkering
import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../services/firebase';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // Standaard jaar: vorig jaar tot 1 juni van het huidige jaar, daarna huidig jaar
  const bepaalStandaardJaar = () => {
    const nu = new Date();
    const huidigJaar = nu.getFullYear();
    const na31Mei = nu.getMonth() >= 5; // maand 5 = juni (0-indexed)
    return na31Mei ? huidigJaar : huidigJaar - 1;
  };
  const [selectedYear, setSelectedYear] = useState(bepaalStandaardJaar());
  const [isEditing, setIsEditing] = useState(false); // true als er een form open staat

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  const loginWithGoogle = () => signInWithPopup(auth, googleProvider);
  const loginWithEmail = (email, pw) => signInWithEmailAndPassword(auth, email, pw);
  const registerWithEmail = (email, pw) => createUserWithEmailAndPassword(auth, email, pw);
  const logout = () => signOut(auth);

  return (
    <AppContext.Provider value={{
      user, loading, selectedYear, setSelectedYear,
      isEditing, setIsEditing,
      loginWithGoogle, loginWithEmail, registerWithEmail, logout
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
