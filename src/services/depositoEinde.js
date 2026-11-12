// Versie: Fix149
// Verwacht saldo op einddatum van een deposito (incl. rente), gerekend vanaf 31 december van het gekozen jaar.
// Gebruikt einddatum, of startdatum + looptijd. Zonder datum: onbekend (saldo 31 dec blijft staan).

function bepaalEinddatum(rek) {
  if (rek.deposito_einddatum) return new Date(rek.deposito_einddatum);
  if (rek.deposito_startdatum && rek.looptijd_maanden) {
    const d = new Date(rek.deposito_startdatum);
    d.setMonth(d.getMonth() + Number(rek.looptijd_maanden));
    return d;
  }
  return null;
}

export function eindeSaldo(rek, jaar, dec31) {
  if (rek.type !== 'deposito') return { bedrag: dec31, onbekend: false };
  const eind = bepaalEinddatum(rek);
  const pct = Number(rek.rente_pct) || 0;
  if (!eind || isNaN(eind) || !pct) return { bedrag: dec31, onbekend: true };
  const dagen = Math.max(0, (eind - new Date(Number(jaar), 11, 31)) / 86400000);
  const r = pct / 100;
  const t = rek.uitbetaling_type;
  let bedrag;
  if (t === 'bijgeschreven') bedrag = dec31 * Math.pow(1 + r / 365, dagen);
  else if (t === 'jaarlijks' || t === 'einde_looptijd') bedrag = dec31 * Math.pow(1 + r, dagen / 365);
  else if (t === 'maandelijks') bedrag = dec31 * Math.pow(1 + r / 12, (dagen / 365) * 12);
  else bedrag = dec31 * (1 + r * dagen / 365);
  return { bedrag, onbekend: false };
}
