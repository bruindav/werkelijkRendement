import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../services/firebase';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

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
      loginWithGoogle, loginWithEmail, registerWithEmail, logout
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
