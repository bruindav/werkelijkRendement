// Fix103 - Help pagina
import { useState } from 'react';
import Layout from '../components/Layout';
import Breadcrumb from '../components/Breadcrumb';
import { HelpCircle, ChevronDown, ChevronUp, BookOpen, FileText,
         Upload, Building2, Calculator, Shield, TrendingUp, Repeat } from 'lucide-react';

function Accordion({ vraag, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`border rounded-xl overflow-hidden transition-colors ${open ? 'border-blue-600/40' : 'border-slate-700'}`}>
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-800/60 transition-colors">
        <span className="text-sm font-medium text-white">{vraag}</span>
        {open ? <ChevronUp size={16} className="text-slate-400 flex-shrink-0" />
               : <ChevronDown size={16} className="text-slate-400 flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm text-slate-300 leading-relaxed space-y-2 border-t border-slate-700 pt-3">
          {children}
        </div>
      )}
    </div>
  );
}

function Stap({ nr, titel, children }) {
  return (
    <div className="flex gap-4">
      <div className="w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
        {nr}
      </div>
      <div className="flex-1">
        <p className="font-medium text-white mb-1">{titel}</p>
        <p className="text-sm text-slate-400 leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

function Blok({ icon: Icon, kleur, titel, children }) {
  const kleuren = {
    blauw: 'bg-blue-600/10 border-blue-600/20',
    groen: 'bg-emerald-600/10 border-emerald-600/20',
    paars: 'bg-purple-600/10 border-purple-600/20',
    amber: 'bg-amber-600/10 border-amber-600/20',
  };
  const icoonKleur = { blauw: 'text-blue-400', groen: 'text-emerald-400', paars: 'text-purple-400', amber: 'text-amber-400' };
  return (
    <div className={`border rounded-2xl p-5 ${kleuren[kleur]}`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={18} className={icoonKleur[kleur]} />
        <h3 className="font-semibold text-white text-sm">{titel}</h3>
      </div>
      <div className="text-sm text-slate-300 space-y-1.5 leading-relaxed">
        {children}
      </div>
    </div>
  );
}

export default function HelpPage() {
  return (
    <Layout>
      <div className="max-w-2xl">
        <Breadcrumb items={[{ label: 'Help' }]} />

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-600/20 border border-blue-600/30 rounded-xl flex items-center justify-center">
            <HelpCircle size={20} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Hoe werkt de app?</h1>
            <p className="text-sm text-slate-400">Handleiding voor Werkelijk Rendement — Box 3 berekening</p>
          </div>
        </div>

        {/* Waarvoor is de app */}
        <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen size={16} className="text-blue-400" />
            <h2 className="font-semibold text-white">Waarvoor is deze app?</h2>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed mb-3">
            Werkelijk Rendement helpt je om je Box 3 belasting te berekenen op basis van
            <strong className="text-white"> werkelijk behaald rendement</strong> in plaats van het forfaitaire rendement
            dat de Belastingdienst standaard gebruikt. In veel gevallen is het werkelijke rendement lager,
            waardoor je minder belasting betaalt.
          </p>
          <p className="text-sm text-slate-300 leading-relaxed">
            De app berekent automatisch welke methode — werkelijk of forfaitair — voor jou voordeliger is.
          </p>
        </div>

        {/* Stappenplan */}
        <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-5 mb-6">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-blue-400" /> Aan de slag — stap voor stap
          </h2>
          <div className="space-y-5">
            <Stap nr="1" titel="Importeer je jaaroverzichten">
              Ga naar <strong className="text-white">Importeren</strong> en upload de PDF-jaaroverzichten
              van je bank(en). De app herkent automatisch ABN AMRO, Centraal Beheer, DEGIRO, Raisin,
              Evi (Van Lanschot), Meewind en Collin Crowdfund. Je kunt meerdere bestanden tegelijk uploaden.
            </Stap>
            <Stap nr="2" titel="Controleer en vul aan">
              Ga naar <strong className="text-white">Banken & Posities</strong> om de geïmporteerde
              gegevens te controleren. Voeg ontbrekende rekeningen of posities handmatig toe.
              Stel bij beleggingen de waarden op 1 januari en 31 december in.
            </Stap>
            <Stap nr="3" titel="Bekijk het dashboard">
              Het <strong className="text-white">Dashboard</strong> toont je totale vermogen,
              werkelijk rendement en de vergelijking met het forfaitaire rendement.
              Je ziet direct welke methode voordeliger is.
            </Stap>
            <Stap nr="4" titel="Exporteer voor je aangifte">
              Ga naar <strong className="text-white">Aangifte Export</strong> voor een overzicht
              dat je kunt gebruiken bij het invullen van je belastingaangifte.
            </Stap>
          </div>
        </div>

        {/* Uitleg per onderdeel */}
        <h2 className="font-semibold text-white mb-3 text-sm uppercase tracking-wide text-slate-400">Uitleg per onderdeel</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          <Blok icon={Upload} kleur="blauw" titel="Importeren">
            <p>Upload PDF-jaaroverzichten van je bank. Meerdere bestanden tegelijk mogelijk via slepen of het bestandsdialoog.</p>
            <p>Selecteer welke rekeningen je wilt importeren en voor welk jaar.</p>
          </Blok>
          <Blok icon={Building2} kleur="paars" titel="Banken & Posities">
            <p>Overzicht van al je banken en rekeningen. Klik op een bank om rekeningen te bekijken. Klik op een rekening om bedragen in te vullen.</p>
            <p>Beleggingsrekeningen: voeg posities toe met waarden per 1 jan en 31 dec.</p>
          </Blok>
          <Blok icon={Calculator} kleur="groen" titel="Rendement berekening">
            <p><strong className="text-white">Werkelijk rendement</strong> = koerswinst + dividend + rente − kosten.</p>
            <p><strong className="text-white">Forfaitair</strong> = vast % over je vermogen (sparen en beleggen hebben elk eigen tarief).</p>
          </Blok>
          <Blok icon={FileText} kleur="amber" titel="Aangifte Export">
            <p>Overzicht van alle gegevens voor je belastingaangifte, inclusief het geadviseerde bedrag om op te geven.</p>
            <p>Afdrukbaar of te gebruiken als naslagwerk bij het invullen.</p>
          </Blok>
        </div>

        {/* Tips */}
        <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-5 mb-6">
          <h2 className="font-semibold text-white mb-3 flex items-center gap-2">
            <Repeat size={16} className="text-blue-400" /> Handige tips
          </h2>
          <div className="space-y-2 text-sm text-slate-300">
            <p>📅 <strong className="text-white">Jaar kopiëren</strong> — Ga naar Instellingen → Kopiëren om posities van vorig jaar over te zetten. De dec31-waarden worden automatisch de jan1-waarden van het nieuwe jaar.</p>
            <p>🔁 <strong className="text-white">Maandelijkse aankopen</strong> — Bij een positie kun je een vast maandbedrag instellen. Met één klik worden 12 aankopen aangemaakt.</p>
            <p>📊 <strong className="text-white">Koersen ophalen</strong> — Voer een ticker-symbool in (bijv. ASML.AS) en klik op "Koersen ophalen" om automatisch de waarden op 1 jan en 31 dec te laden.</p>
            <p>💾 <strong className="text-white">Backup maken</strong> — Maak regelmatig een backup via Backup & Restore. Je gegevens staan alleen lokaal op dit apparaat.</p>
            <p>⚙️ <strong className="text-white">Tarieven aanpassen</strong> — De forfaitaire percentages staan ingesteld op de officiële Belastingdienst-tarieven. Je kunt ze aanpassen in Instellingen als de definitieve tarieven bekend zijn.</p>
          </div>
        </div>

        {/* Ticker uitleg */}
        <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-5 mb-6">
          <h2 className="font-semibold text-white mb-3 flex items-center gap-2">
            <TrendingUp size={16} className="text-blue-400" /> Ticker-symbolen per beurs
          </h2>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              ['🇳🇱 Nederland', '.AS', 'ASML.AS, PHIA.AS'],
              ['🇺🇸 Amerika', '(geen)', 'AAPL, MSFT, GOOGL'],
              ['🇩🇪 Duitsland', '.DE', 'SAP.DE, BMW.DE'],
              ['🇫🇷 Frankrijk', '.PA', 'MC.PA, AIR.PA'],
              ['🇬🇧 Verenigd Koninkrijk', '.L', 'SHEL.L, BP.L'],
              ['📊 ETF (Euronext)', '.AS', 'VWRL.AS, IWDA.AS'],
            ].map(([land, suffix, voorbeeld]) => (
              <div key={land} className="bg-slate-900/60 rounded-lg p-2.5">
                <p className="text-slate-300 mb-0.5">{land}</p>
                <p className="text-white font-mono">{voorbeeld}</p>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <h2 className="font-semibold text-white mb-3 text-sm uppercase tracking-wide text-slate-400">Veelgestelde vragen</h2>
        <div className="space-y-2 mb-6">
          <Accordion vraag="Mijn bank wordt niet herkend bij importeren. Wat nu?">
            <p>De app herkent momenteel: ABN AMRO, Centraal Beheer (sparen en beleggen), DEGIRO, Raisin, Evi (Van Lanschot), Meewind en Collin Crowdfund.</p>
            <p>Voor andere banken kun je gegevens handmatig invoeren via Banken & Posities → bank toevoegen → rekening toevoegen.</p>
          </Accordion>
          <Accordion vraag="Wat is het verschil tussen sparen, deposito en beleggen?">
            <p><strong className="text-white">Sparen</strong> — gewone spaarrekening met saldo en rente.</p>
            <p><strong className="text-white">Deposito</strong> — vastrentend product met vaste looptijd en rentepercentage. Wordt voor Box 3 als spaargeld behandeld.</p>
            <p><strong className="text-white">Beleggen</strong> — aandelen, ETF's, obligaties etc. Hier voer je posities in met waarden op 1 jan en 31 dec.</p>
          </Accordion>
          <Accordion vraag="Hoe werkt de forfaitaire berekening met sparen én beleggen?">
            <p>De Belastingdienst hanteert twee verschillende percentages: een lager tarief voor spaargeld en een hoger tarief voor beleggingen.</p>
            <p>De app verdeelt het heffingsvrij vermogen pro-rata over sparen en beleggen, en berekent vervolgens het forfaitaire rendement per categorie. Dit geeft een nauwkeuriger vergelijking dan één gemiddeld percentage.</p>
          </Accordion>
          <Accordion vraag="Mijn gegevens zijn verdwenen na het wissen van de browser-cache.">
            <p>De gegevens staan in de IndexedDB van je browser. Als je de cache, cookies of sitegegevens wist, worden ook de app-gegevens verwijderd.</p>
            <p>Maak daarom regelmatig een backup via <strong className="text-white">Backup & Restore</strong>. Met het backup-bestand kun je alles herstellen.</p>
          </Accordion>
          <Accordion vraag="Kan ik de app op meerdere apparaten gebruiken?">
            <p>Niet automatisch — gegevens staan lokaal per apparaat. Je kunt wel een backup maken op apparaat A en die inlezen op apparaat B via Backup & Restore.</p>
          </Accordion>
          <Accordion vraag="Wat moet ik doen als het berekende bedrag afwijkt van de Belastingdienst?">
            <p>Controleer of alle posities compleet zijn ingevuld: waarden op 1 jan én 31 dec, aankopen en verkopen, dividend en rente.</p>
            <p>Controleer ook de tarieven in Instellingen — de app gebruikt de officiële Belastingdienst-tarieven maar die kunnen door jou zijn aangepast.</p>
            <p>Deze app is een hulpmiddel, geen officieel belastingadvies. Bij twijfel raadpleeg een belastingadviseur.</p>
          </Accordion>
        </div>

        <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-4 flex items-center gap-3">
          <Shield size={18} className="text-blue-400 flex-shrink-0" />
          <p className="text-xs text-slate-400">
            Meer weten over hoe de app omgaat met jouw gegevens?
            Lees de <a href="/privacy" className="text-blue-400 hover:text-blue-300 underline">Privacy & Gegevensopslag</a> pagina.
          </p>
        </div>
      </div>
    </Layout>
  );
}
