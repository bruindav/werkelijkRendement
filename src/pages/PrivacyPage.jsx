// Fix103 - Privacy pagina
import Layout from '../components/Layout';
import Breadcrumb from '../components/Breadcrumb';
import { Shield, HardDrive, Lock, Eye, Server, Smartphone, CheckCircle } from 'lucide-react';

function Sectie({ icon: Icon, kleur, titel, children }) {
  const kleuren = {
    blauw:   'bg-blue-600/10 border-blue-600/20 text-blue-400',
    groen:   'bg-emerald-600/10 border-emerald-600/20 text-emerald-400',
    paars:   'bg-purple-600/10 border-purple-600/20 text-purple-400',
    amber:   'bg-amber-600/10 border-amber-600/20 text-amber-400',
    slate:   'bg-slate-700/40 border-slate-600/40 text-slate-300',
  };
  return (
    <div className={`border rounded-2xl p-5 mb-4 ${kleuren[kleur]}`}>
      <div className="flex items-center gap-3 mb-3">
        <Icon size={20} />
        <h2 className="font-semibold text-white">{titel}</h2>
      </div>
      <div className="text-sm text-slate-300 space-y-2 leading-relaxed">
        {children}
      </div>
    </div>
  );
}

function Punt({ children }) {
  return (
    <div className="flex items-start gap-2">
      <CheckCircle size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <Layout>
      <div className="max-w-2xl">
        <Breadcrumb items={[{ label: 'Privacy & Gegevens' }]} />

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-600/20 border border-blue-600/30 rounded-xl flex items-center justify-center">
            <Shield size={20} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Privacy & Gegevensopslag</h1>
            <p className="text-sm text-slate-400">Hoe de app omgaat met jouw financiële gegevens</p>
          </div>
        </div>

        {/* Kernboodschap */}
        <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-2xl p-5 mb-6">
          <p className="text-emerald-300 font-medium text-sm mb-1">
            ✓ Jouw gegevens verlaten nooit jouw apparaat
          </p>
          <p className="text-sm text-slate-300 leading-relaxed">
            Werkelijk Rendement slaat alle gegevens uitsluitend lokaal op in jouw browser.
            Er is geen server, geen database in de cloud, en geen account nodig.
            Niemand anders — ook de ontwikkelaar niet — heeft toegang tot jouw financiële gegevens.
          </p>
        </div>

        <Sectie icon={HardDrive} kleur="blauw" titel="Waar staan jouw gegevens?">
          <Punt>Alle gegevens worden opgeslagen in de <strong className="text-white">IndexedDB</strong> van jouw browser — een lokale database op jouw eigen apparaat.</Punt>
          <Punt>Dit is vergelijkbaar met hoe een app op je telefoon zijn data opslaat: alleen toegankelijk op dit apparaat, in deze browser.</Punt>
          <Punt>Er wordt niets verstuurd naar externe servers. Er is geen internetverbinding nodig om de app te gebruiken (behalve voor het ophalen van beurskoersen).</Punt>
        </Sectie>

        <Sectie icon={Lock} kleur="groen" titel="Beveiliging van jouw backup">
          <Punt>Als je een backup maakt, wordt het bestand versleuteld met <strong className="text-white">AES-256</strong> — dezelfde encryptiestandaard die banken gebruiken.</Punt>
          <Punt>Zonder het door jou gekozen wachtwoord is de backup volledig onleesbaar, ook voor de ontwikkelaar.</Punt>
          <Punt>Bewaar je wachtwoord goed: er is geen "wachtwoord vergeten" optie — de data is dan niet meer te openen.</Punt>
        </Sectie>

        <Sectie icon={Server} kleur="paars" titel="Wat wordt er wél via internet gedaan?">
          <p>De app maakt gebruik van twee externe diensten voor specifieke functies:</p>
          <div className="mt-2 space-y-2">
            <div className="bg-slate-900/60 rounded-xl p-3">
              <p className="text-white text-xs font-medium mb-0.5">Beurskoersen (Yahoo Finance)</p>
              <p className="text-slate-400 text-xs">Als je automatisch de koersen van 1 jan en 31 dec ophaalt voor een aandeel, wordt alleen de <em>ticker-naam</em> (bijv. ASML.AS) verstuurd. Er worden geen persoonsgegevens meegestuurd.</p>
            </div>
            <div className="bg-slate-900/60 rounded-xl p-3">
              <p className="text-white text-xs font-medium mb-0.5">Firebase Hosting</p>
              <p className="text-slate-400 text-xs">De app wordt gehost via Firebase. Dit betekent dat Google de app-bestanden (code, afbeeldingen) serveert, maar géén toegang heeft tot jouw gegevens — die staan immers lokaal.</p>
            </div>
          </div>
        </Sectie>

        <Sectie icon={Smartphone} kleur="amber" titel="Overstappen naar een nieuw apparaat">
          <Punt>Jouw gegevens staan op dit apparaat in deze browser. Ze zijn <strong className="text-white">niet automatisch beschikbaar</strong> op een ander apparaat.</Punt>
          <Punt>Gebruik <strong className="text-white">Backup & Restore</strong> om een versleuteld bestand te maken en dat op het nieuwe apparaat in te lezen.</Punt>
          <Punt>Als je de browser-cache wist of een andere browser gebruikt, zijn de gegevens niet meer zichtbaar. Zorg altijd voor een actuele backup.</Punt>
        </Sectie>

        <Sectie icon={Eye} kleur="slate" titel="Wat de app niet doet">
          <Punt>Geen tracking, geen cookies voor analysedoeleinden.</Punt>
          <Punt>Geen advertenties, geen doorverkoop van gegevens.</Punt>
          <Punt>Geen account of registratie vereist.</Punt>
          <Punt>Geen automatische synchronisatie naar externe servers.</Punt>
          <Punt>Geen toegang tot jouw bankrekening of financiële instellingen.</Punt>
        </Sectie>

        <div className="text-xs text-slate-600 mt-4 pb-4">
          Werkelijk Rendement is een hulpmiddel voor het invullen van je belastingaangifte.
          De berekeningen zijn indicatief — raadpleeg een belastingadviseur voor officieel advies.
        </div>
      </div>
    </Layout>
  );
}
