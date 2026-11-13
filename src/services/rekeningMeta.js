// Versie: Fix154
// Eigenaar (ik / partner / samen) en doel per rekening — blijft bewaard over jaren heen.
// Opgeslagen in de instellingen-tabel onder id 'rekeningMeta' (zit dus ook in de lokale database).
// Sleutel per rekening = soort + rekeningnummer (of bank + naam als er geen nummer is),
// zodat dezelfde rekening in elk jaar dezelfde eigenaar/doel heeft.

import db from './localDb';

const ID = 'rekeningMeta';
const norm = (t) => String(t || '').trim().toLowerCase().replace(/\s+/g, ' ');
const normNr = (t) => String(t || '').replace(/\s+/g, '').toLowerCase();

export const EIGENAREN = [
  { id: 'ik', label: 'Ik' },
  { id: 'partner', label: 'Partner' },
  { id: 'samen', label: 'Samen' },
];

export function metaSleutel(rek, bankNaam) {
  // Raisin: alle potjes delen één IBAN, het kenmerk (FDA_...) is uniek per rekening
  if (rek.kenmerk) return `${rek.type}|kenmerk:${normNr(rek.kenmerk)}`;
  const nr = normNr(rek.rekeningnummer);
  return nr
    ? `${rek.type}|nr:${nr}`
    : `${rek.type}|${norm(bankNaam)}|${norm(rek.naam)}`;
}

// Meerdere namen in 'houders' ("D.R. de Bruin, E.A. Vrijvogel") = gezamenlijke rekening
export function meerdereHouders(houders) {
  const h = String(houders || '');
  return /,|;| en | & /i.test(h) && h.trim().length > 0;
}

// "D.R. de Bruin" en "Dave Richard de Bruin" = dezelfde persoon: sleutel = eerste initiaal + achternaam
const TUSSEN = ['de', 'van', 'der', 'den', 'ten', 'ter', 'het', "'t", 'te'];
export function persoonSleutel(houders) {
  const delen = String(houders || '').trim().split(/\s+/).filter(Boolean);
  if (delen.length === 0) return '';
  let i = delen.length - 1;
  const achternaam = [delen[i].toLowerCase()];
  while (i > 1 && TUSSEN.includes(delen[i - 1].toLowerCase())) { i--; achternaam.unshift(delen[i].toLowerCase()); }
  return `${delen[0][0].toLowerCase()} ${achternaam.join(' ')}`;
}

export async function laadMeta() {
  const doc = await db.instellingen.get(ID);
  return {
    rekeningen: doc?.rekeningen || {},   // sleutel -> { eigenaar, doel }
    houders: doc?.houders || {},         // persoonsleutel (initiaal + achternaam) -> eigenaar (geleerd)
    filter: doc?.filter || { eigenaar: 'alle', doel: 'alle' },   // laatst gekozen filter
    handmatig: doc?.handmatig || {},     // sleutelHandmatig -> handmatig ingevulde velden (blijven bestaan na jaar leegmaken)
  };
}

// ---- Handmatig ingevulde velden per rekening (los van het jaar bewaard) ----
// Sleutel zonder type, zodat een handmatig gewijzigd type de koppeling niet breekt.
const HANDMATIG_VELDEN = ['type', 'deposito_startdatum', 'deposito_einddatum', 'startbedrag', 'uitbetaling_type', 'rente_pct', 'kosten', 'notitie', 'looptijd_maanden', 'partnerbank'];

export function sleutelHandmatig(rek, bankNaam) {
  if (rek.kenmerk) return `kenmerk:${normNr(rek.kenmerk)}`;
  const nr = normNr(rek.rekeningnummer);
  return nr ? `nr:${nr}` : `${norm(bankNaam)}|${norm(rek.naam)}`;
}

export async function slaHandmatigOp(rek, bankNaam) {
  const meta = await laadMeta();
  const rec = {};
  for (const k of HANDMATIG_VELDEN) if (rek[k] !== undefined && rek[k] !== null && rek[k] !== '') rec[k] = rek[k];
  meta.handmatig[sleutelHandmatig(rek, bankNaam)] = rec;
  await bewaar(meta);
}

export async function haalHandmatig(rek, bankNaam) {
  const meta = await laadMeta();
  return meta.handmatig[sleutelHandmatig(rek, bankNaam)] || null;
}

// Alles wat bewaard is over één rekening wissen (eigenaar, doel, handmatige velden)
export async function wisBewaardeGegevens(rek, bankNaam) {
  const meta = await laadMeta();
  delete meta.handmatig[sleutelHandmatig(rek, bankNaam)];
  delete meta.rekeningen[metaSleutel(rek, bankNaam)];
  await bewaar(meta);
}

async function bewaar(meta) {
  await db.instellingen.put({ id: ID, ...meta });
}

export async function slaRekeningMetaOp(sleutel, { eigenaar, doel }, houders) {
  const meta = await laadMeta();
  meta.rekeningen[sleutel] = { eigenaar: eigenaar || null, doel: (doel || '').trim() };
  // Leer: dezelfde houdertekst bij een volgende import krijgt dezelfde eigenaar
  if (houders && eigenaar && !meerdereHouders(houders)) meta.houders[persoonSleutel(houders)] = eigenaar;
  await bewaar(meta);
}

export async function slaFilterOp(filter) {
  const doc = await db.instellingen.get(ID);
  await bewaar({ ...(doc || {}), id: ID, filter });
}

// Effectieve eigenaar: expliciet gekozen > geleerd via houdernaam > meerdere houders = samen
export function bepaalEigenaar(rek, meta, bankNaam) {
  const expliciet = meta.rekeningen[metaSleutel(rek, bankNaam)]?.eigenaar;
  if (expliciet) return expliciet;
  if (rek.houders) {
    const geleerd = meta.houders[persoonSleutel(rek.houders)];
    if (geleerd) return geleerd;
    if (meerdereHouders(rek.houders)) return 'samen';
  }
  return null;
}

// Rekeninghouder(s) kunnen in een ander jaar bekend zijn (bijv. na kopiëren van een jaar):
// zoek per rekening de houders in alle jaren.
export async function laadHoudersMap() {
  const [banken, rekeningen] = await Promise.all([db.banken.toArray(), db.rekeningen.toArray()]);
  const map = {};
  for (const r of rekeningen) {
    if (!r.houders) continue;
    const bank = banken.find(b => b.id === r.bankId);
    map[metaSleutel(r, bank?.naam || '')] = r.houders;
  }
  return map;
}



// Productsheet (Raisin): gegevens bewaren onder het FDA-kenmerk en toepassen op alle bestaande
// rekeningen met dat kenmerk. Rekeningen die later worden geïmporteerd krijgen ze automatisch.
export async function pasProductsheetToe(sheet) {
  const velden = {};
  for (const k of ['startbedrag', 'looptijd_maanden', 'rente_pct', 'deposito_startdatum', 'deposito_einddatum', 'partnerbank']) {
    if (sheet[k]) velden[k] = sheet[k];
  }
  const sleutel = `kenmerk:${normNr(sheet.kenmerk)}`;
  const meta = await laadMeta();
  meta.handmatig[sleutel] = { ...(meta.handmatig[sleutel] || {}), ...velden };
  await bewaar(meta);
  const bestaand = await db.rekeningen.filter(r => r.kenmerk && normNr(r.kenmerk) === normNr(sheet.kenmerk)).toArray();
  for (const r of bestaand) await db.rekeningen.update(r.id, velden);
  return bestaand.length;
}
