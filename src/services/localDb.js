// Lokale database — vervangt Firebase Firestore
// Gebruikt Dexie.js als wrapper rond IndexedDB
// Data staat 100% lokaal in de browser van de gebruiker

import Dexie from 'dexie';

// ============ DATABASE SCHEMA ============
// Spiegelt de Firestore structuur maar plat (genormaliseerd)
// Firestore: users/{uid}/years/{year}/banks/{bankId}/accounts/{accountId}/positions/{posId}
// Lokaal:    één tabel per entiteit met samengestelde sleutels

const db = new Dexie('werkelijkRendement');

db.version(1).stores({
  // Profiel & instellingen (één record per "gebruiker" — lokaal is er maar één)
  profiel:      'id, naam',                                          // id='lokaal'
  instellingen: 'id',                                                // id='box3'

  // Data
  banken:      '++id, year, volgorde',
  rekeningen:  '++id, bankId, year, volgorde',
  posities:    '++id, rekeningId, bankId, year',
  // (spaargelden staan als velden direct op de rekening — geen aparte tabel nodig)
});

export default db;

// ============ HULPFUNCTIES ============

// Genereer een UUID-achtige string als ID
export function genId() {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}

// Haal alle banken op voor een jaar, gesorteerd op volgorde
export async function getBanken(year) {
  const lijst = await db.banken.where('year').equals(year).toArray();
  return lijst.sort((a, b) => (a.volgorde ?? 999) - (b.volgorde ?? 999));
}

// Haal alle rekeningen op voor een bank
export async function getRekeningen(year, bankId) {
  const lijst = await db.rekeningen
    .where('[year+bankId]').equals([year, bankId])
    .toArray()
    .catch(() =>
      // Fallback als compound index niet werkt (eerste keer)
      db.rekeningen.filter(r => r.year === year && r.bankId === bankId).toArray()
    );
  return lijst.sort((a, b) => (a.volgorde ?? 999) - (b.volgorde ?? 999));
}

// Haal alle posities op voor een rekening
export async function getPosities(rekeningId) {
  return db.posities.where('rekeningId').equals(rekeningId).toArray();
}

// Profiel ophalen of aanmaken
export async function getProfiel() {
  return db.profiel.get('lokaal');
}

export async function setProfiel(data) {
  return db.profiel.put({ id: 'lokaal', ...data });
}

// Instellingen ophalen / opslaan
export async function getInstellingen() {
  return db.instellingen.get('box3');
}

export async function setInstellingen(data) {
  return db.instellingen.put({ id: 'box3', ...data });
}
