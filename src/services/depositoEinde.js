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

// true als dit een deposito is waarvan geen einddatum (of startdatum + looptijd) bekend is
export function looptijdOntbreekt(rek) {
  if (rek.type !== 'deposito') return false;
  const d = bepaalEinddatum(rek);
  return !d || isNaN(d);
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
  if (t === 'bijgeschreven') bedrag = dec31 * Math.pow(1 + r / 365, dagen);        // tussentijds bijgeschreven
  else if (['jaarlijks', 'maandelijks', 'kwartaal'].includes(t)) bedrag = dec31;    // rente wordt uitgekeerd
  else bedrag = dec31 * (1 + r * dagen / 365);                                       // pas bij einde looptijd
  return { bedrag, onbekend: false };
}

// Status van een deposito in een jaar:
//  'voorbij'  = einddatum ligt vóór 1 januari van het jaar → niet meer tonen in dat jaar
//  'verlopen' = einddatum t/m peildatum (standaard 31 december) → saldo is 0, wel tonen
// Geeft { status, datum } of null (geen deposito / einddatum onbekend / nog lopend).
export function depositoStatus(rek, jaar, peil) {
  if (rek.type !== 'deposito') return null;
  const eind = bepaalEinddatum(rek);
  if (!eind || isNaN(eind)) return null;
  const jan1 = new Date(Number(jaar), 0, 1);
  const einde = peil || new Date(Number(jaar), 11, 31);
  const datum = eind.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  if (eind < jan1) return { status: 'voorbij', datum };
  if (eind <= einde) return { status: 'verlopen', datum };
  return null;
}

// Deposito waarvan de einddatum vandaag al voorbij is (ook als het in het gekozen jaar nog liep).
// Geeft de einddatum als tekst, of '' als het niet (of nog niet) is verlopen.
export function inmiddelsVerlopen(rek) {
  if (rek.type !== 'deposito') return '';
  const eind = bepaalEinddatum(rek);
  if (!eind || isNaN(eind) || eind >= new Date()) return '';
  return eind.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
