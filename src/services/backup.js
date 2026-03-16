// Backup & Restore service
// Exporteert alle lokale data als AES-256 encrypted bestand
// Importeert en decrypteert backup bestanden

import CryptoJS from 'crypto-js';
import db, { getInstellingen, setInstellingen, getProfiel, setProfiel, getBanken, getRekeningen, getPosities, genId } from './localDb';

const BACKUP_VERSIE = '1.0';
const BESTAND_EXTENSIE = '.wr-backup';

// ============ EXPORTEER ============

export async function exporteerBackup(wachtwoord) {
  // Verzamel alle data
  const profiel = await getProfiel() || {};
  const instellingen = await getInstellingen() || {};

  // Alle banken over alle jaren
  const alleBanken = await db.banken.toArray();
  const jaren = [...new Set(alleBanken.map(b => b.year))];

  const bankenMetData = [];

  for (const bank of alleBanken) {
    const rekeningen = await db.rekeningen
      .filter(r => r.bankId === bank.id)
      .toArray();

    const rekeningenMetData = [];
    for (const rek of rekeningen) {
      const posities = await db.posities
        .filter(p => p.rekeningId === rek.id)
        .toArray();
      rekeningenMetData.push({ ...rek, posities });
    }

    bankenMetData.push({ ...bank, rekeningen: rekeningenMetData });
  }

  const backupData = {
    versie: BACKUP_VERSIE,
    datum: new Date().toISOString(),
    app: 'WerkelijkRendement',
    profiel: { naam: profiel.naam || 'Gebruiker' },
    instellingen,
    jaren,
    banken: bankenMetData,
  };

  const jsonString = JSON.stringify(backupData);

  // Versleutel met AES-256
  const encrypted = CryptoJS.AES.encrypt(jsonString, wachtwoord).toString();

  // Voeg verificatiehash toe zodat we bij import kunnen controleren
  // of het wachtwoord klopt (zonder de data te decrypten)
  const hash = CryptoJS.SHA256(wachtwoord + 'werkelijkrendement').toString();

  const bestandInhoud = JSON.stringify({
    v: BACKUP_VERSIE,
    h: hash.substring(0, 16), // eerste 16 chars als snelle check
    d: encrypted,
  });

  // Download als bestand
  const datum = new Date().toISOString().split('T')[0];
  const bestandsnaam = `werkelijkrendement-backup-${datum}${BESTAND_EXTENSIE}`;

  const blob = new Blob([bestandInhoud], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = bestandsnaam;
  a.click();
  URL.revokeObjectURL(url);

  return {
    bestandsnaam,
    aantalBanken: alleBanken.length,
    aantalJaren: jaren.length,
    jaren: jaren.sort(),
  };
}

// ============ CONTROLEER WACHTWOORD ============
// Snel controleren of wachtwoord klopt zonder alles te decrypten
export function controleerWachtwoord(bestandInhoud, wachtwoord) {
  try {
    const parsed = JSON.parse(bestandInhoud);
    const verwachteHash = CryptoJS.SHA256(wachtwoord + 'werkelijkrendement').toString();
    return parsed.h === verwachteHash.substring(0, 16);
  } catch {
    return false;
  }
}

// ============ IMPORTEER ============
export async function importeerBackup(bestandInhoud, wachtwoord, modus = 'samenvoegen') {
  // modus: 'samenvoegen' = voeg toe naast bestaande data
  //        'overschrijven' = verwijder alles en vervang

  let parsed;
  try {
    parsed = JSON.parse(bestandInhoud);
  } catch {
    throw new Error('Ongeldig backup bestand — geen geldig formaat.');
  }

  if (parsed.app !== 'WerkelijkRendement' && parsed.v !== BACKUP_VERSIE) {
    throw new Error('Dit is geen WerkelijkRendement backup bestand.');
  }

  // Verifieer wachtwoord
  if (!controleerWachtwoord(bestandInhoud, wachtwoord)) {
    throw new Error('Verkeerd wachtwoord. Probeer opnieuw.');
  }

  // Decrypteer
  let backupData;
  try {
    const decrypted = CryptoJS.AES.decrypt(parsed.d, wachtwoord);
    const jsonString = decrypted.toString(CryptoJS.enc.Utf8);
    if (!jsonString) throw new Error('Decryptie mislukt');
    backupData = JSON.parse(jsonString);
  } catch {
    throw new Error('Decryptie mislukt. Controleer het wachtwoord.');
  }

  if (modus === 'overschrijven') {
    // Wis alle bestaande data
    await db.banken.clear();
    await db.rekeningen.clear();
    await db.posities.clear();
  }

  // Herstel profiel en instellingen
  if (backupData.profiel) {
    await setProfiel(backupData.profiel);
  }
  if (backupData.instellingen) {
    await setInstellingen(backupData.instellingen);
  }

  // Bij samenvoegen: maak ID-mapping zodat er geen conflicten zijn
  let aantalBanken = 0;
  let aantalRekeningen = 0;
  let aantalPosities = 0;

  for (const bank of backupData.banken || []) {
    const nieuwBankId = genId();

    // Controleer of bank al bestaat (bij samenvoegen)
    if (modus === 'samenvoegen') {
      const bestaand = await db.banken
        .filter(b => b.naam === bank.naam && b.year === bank.year)
        .first();
      if (bestaand) continue; // Sla over als al bestaat
    }

    await db.banken.add({
      ...bank,
      id: nieuwBankId,
      rekeningen: undefined, // niet opslaan als veld
    });
    aantalBanken++;

    for (const rek of bank.rekeningen || []) {
      const nieuwRekId = genId();
      await db.rekeningen.add({
        ...rek,
        id: nieuwRekId,
        bankId: nieuwBankId,
        posities: undefined,
      });
      aantalRekeningen++;

      for (const pos of rek.posities || []) {
        await db.posities.add({
          ...pos,
          id: genId(),
          rekeningId: nieuwRekId,
          bankId: nieuwBankId,
        });
        aantalPosities++;
      }
    }
  }

  return {
    aantalBanken,
    aantalRekeningen,
    aantalPosities,
    jaren: backupData.jaren || [],
    datum: backupData.datum,
  };
}

// ============ LEES BESTAND ============
export function leesBestand(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Bestand lezen mislukt'));
    reader.readAsText(file);
  });
}

// ============ DATABASE WISSEN ============
export async function wisAlleData() {
  await db.banken.clear();
  await db.rekeningen.clear();
  await db.posities.clear();
  await db.instellingen.clear();
}
