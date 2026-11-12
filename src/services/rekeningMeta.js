// Versie: Fix136
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
  };
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
