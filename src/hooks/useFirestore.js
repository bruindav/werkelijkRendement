import { useState, useEffect } from 'react';
import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  onSnapshot, setDoc, query, orderBy
} from 'firebase/firestore';
import { db } from '../services/firebase';

// Base path voor user data
const userPath = (uid) => `users/${uid}`;
const yearPath = (uid, year) => `users/${uid}/years/${year}`;
const banksPath = (uid, year) => `users/${uid}/years/${year}/banks`;
const accountsPath = (uid, year, bankId) => `${banksPath(uid, year)}/${bankId}/accounts`;
const positionsPath = (uid, year, bankId, accountId) =>
  `${accountsPath(uid, year, bankId)}/${accountId}/positions`;

// ============ BANKEN ============
export function useBanken(uid, year) {
  const [banken, setBanken] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid || !year) return;
    const ref = collection(db, banksPath(uid, year));
    const unsub = onSnapshot(ref, (snap) => {
      setBanken(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [uid, year]);

  const voegBankToe = (data) => addDoc(collection(db, banksPath(uid, year)), data);
  const updateBank = (id, data) => updateDoc(doc(db, banksPath(uid, year), id), data);
  const verwijderBank = (id) => deleteDoc(doc(db, banksPath(uid, year), id));

  return { banken, loading, voegBankToe, updateBank, verwijderBank };
}

// ============ REKENINGEN ============
export function useRekeningen(uid, year, bankId) {
  const [rekeningen, setRekeningen] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid || !year || !bankId) return;
    const ref = collection(db, accountsPath(uid, year, bankId));
    const unsub = onSnapshot(ref, (snap) => {
      setRekeningen(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [uid, year, bankId]);

  const voegRekeningToe = (data) => addDoc(collection(db, accountsPath(uid, year, bankId)), data);
  const updateRekening = (id, data) => updateDoc(doc(db, accountsPath(uid, year, bankId), id), data);
  const verwijderRekening = (id) => deleteDoc(doc(db, accountsPath(uid, year, bankId), id));

  return { rekeningen, loading, voegRekeningToe, updateRekening, verwijderRekening };
}

// ============ POSITIES ============
export function usePosities(uid, year, bankId, accountId) {
  const [posities, setPosities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid || !year || !bankId || !accountId) return;
    const ref = collection(db, positionsPath(uid, year, bankId, accountId));
    const unsub = onSnapshot(ref, (snap) => {
      setPosities(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [uid, year, bankId, accountId]);

  const voegPositieToe = (data) =>
    addDoc(collection(db, positionsPath(uid, year, bankId, accountId)), {
      ...data,
      aankopen: data.aankopen || [],
      verkopen: data.verkopen || [],
      dividend: data.dividend || 0,
      rente: data.rente || 0,
    });
  const updatePositie = (id, data) =>
    updateDoc(doc(db, positionsPath(uid, year, bankId, accountId), id), data);
  const verwijderPositie = (id) =>
    deleteDoc(doc(db, positionsPath(uid, year, bankId, accountId), id));

  return { posities, loading, voegPositieToe, updatePositie, verwijderPositie };
}

// ============ JAAR KOPIËREN ============
export async function kopieerJaar(uid, vanJaar, naarJaar) {
  const bankenSnap = await getDocs(collection(db, banksPath(uid, vanJaar)));

  for (const bankDoc of bankenSnap.docs) {
    const nieuweBankRef = await addDoc(
      collection(db, banksPath(uid, naarJaar)),
      bankDoc.data()
    );

    const rekeningenSnap = await getDocs(
      collection(db, accountsPath(uid, vanJaar, bankDoc.id))
    );

    for (const rekDoc of rekeningenSnap.docs) {
      const nieuweRekRef = await addDoc(
        collection(db, accountsPath(uid, naarJaar, nieuweBankRef.id)),
        rekDoc.data()
      );

      const positiesSnap = await getDocs(
        collection(db, positionsPath(uid, vanJaar, bankDoc.id, rekDoc.id))
      );

      for (const posDoc of positiesSnap.docs) {
        const pos = posDoc.data();
        // Zet dec31 van vorig jaar als jan1 van nieuw jaar
        await addDoc(
          collection(db, positionsPath(uid, naarJaar, nieuweBankRef.id, nieuweRekRef.id)),
          {
            ...pos,
            jan1_aantal: pos.dec31_aantal || 0,
            jan1_prijs: pos.dec31_prijs || 0,
            jan1_waarde: pos.dec31_waarde || 0,
            dec31_aantal: 0,
            dec31_prijs: 0,
            dec31_waarde: 0,
            aankopen: [],
            verkopen: [],
            dividend: 0,
            rente: 0,
          }
        );
      }
    }
  }
}
