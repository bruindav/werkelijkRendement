// Versie: Fix117
// Fix117 - Disclaimer pagina
import Layout from '../components/Layout';
import Breadcrumb from '../components/Breadcrumb';
import { AlertTriangle, FileText, Scale, User, ExternalLink } from 'lucide-react';

function Sectie({ titel, children }) {
  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold text-white mb-2">{titel}</h2>
      <div className="text-sm text-slate-300 leading-relaxed space-y-2">
        {children}
      </div>
    </div>
  );
}

export default function DisclaimerPage() {
  const datum = '18 maart 2026';

  return (
    <Layout>
      <div className="max-w-2xl">
        <Breadcrumb items={[{ label: 'Disclaimer' }]} />

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-amber-500/20 border border-amber-500/30 rounded-xl flex items-center justify-center">
            <Scale size={20} className="text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Disclaimer</h1>
            <p className="text-sm text-slate-400">Werkelijk Rendement · versie 1.0 · {datum}</p>
          </div>
        </div>

        {/* Kernboodschap */}
        <div className="bg-amber-900/20 border border-amber-700/40 rounded-2xl p-5 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-200 leading-relaxed">
              Werkelijk Rendement is een <strong>hulpmiddel</strong> voor het berekenen van uw Box 3 rendement.
              De app is geen belastingadviseur en de uitkomsten zijn <strong>niet juridisch bindend</strong>.
              U bent zelf verantwoordelijk voor de juistheid van uw belastingaangifte.
            </p>
          </div>
        </div>

        <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-6 space-y-6">

          <Sectie titel="1. Geen belastingadvies">
            <p>
              De informatie en berekeningen die Werkelijk Rendement produceert, hebben uitsluitend een
              indicatief karakter. De app verstrekt geen belastingadvies en kan een gecertificeerd
              belastingadviseur of accountant niet vervangen.
            </p>
            <p>
              Bij twijfel over uw belastingaangifte of de toepassing van de Box 3 wetgeving op uw
              persoonlijke situatie, raadpleegt u een erkend belastingadviseur of de Belastingdienst.
            </p>
          </Sectie>

          <Sectie titel="2. Verantwoordelijkheid van de gebruiker">
            <p>
              U bent als gebruiker volledig en uitsluitend verantwoordelijk voor:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
              <li>de juistheid en volledigheid van de door u ingevoerde gegevens;</li>
              <li>de interpretatie van de berekeningen en overzichten die de app genereert;</li>
              <li>de beslissingen die u neemt op basis van de uitkomsten van de app;</li>
              <li>de inhoud van uw belastingaangifte bij de Belastingdienst.</li>
            </ul>
          </Sectie>

          <Sectie titel="3. Uitsluiting van aansprakelijkheid">
            <p>
              De ontwikkelaar van Werkelijk Rendement aanvaardt <strong className="text-white">geen enkele aansprakelijkheid</strong> voor:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-300 pl-2">
              <li>onjuiste, onvolledige of verouderde berekeningen;</li>
              <li>fouten als gevolg van onjuist ingevoerde gegevens door de gebruiker;</li>
              <li>wijzigingen in belastingwetgeving die niet (tijdig) in de app zijn verwerkt;</li>
              <li>belastingaanslagen, boetes, rente of andere financiële consequenties die voortvloeien uit gebruik van de app;</li>
              <li>verlies van lokaal opgeslagen gegevens door het wissen van de browser of een defect apparaat.</li>
            </ul>
          </Sectie>

          <Sectie titel="4. Geen garantie op correctheid">
            <p>
              Hoewel de app is ontworpen om de Box 3 wetgeving zo nauwkeurig mogelijk te implementeren,
              kunnen de gepresenteerde forfaitaire percentages, heffingsvrije bedragen en belastingtarieven
              afwijken van de definitief vastgestelde bedragen door de Belastingdienst.
            </p>
            <p>
              De definitieve tarieven voor een belastingjaar kunnen door de wetgever worden aangepast
              na publicatie van de app. U dient de door de app gebruikte tarieven altijd te verifiëren
              via de officiële website van de Belastingdienst (
              <a href="https://www.belastingdienst.nl" target="_blank" rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-0.5">
                belastingdienst.nl <ExternalLink size={11} className="inline" />
              </a>).
            </p>
          </Sectie>

          <Sectie titel="5. Gebruik van de app">
            <p>
              Door gebruik te maken van Werkelijk Rendement verklaart u kennis te hebben genomen
              van en in te stemmen met deze disclaimer. Indien u niet akkoord gaat met de inhoud
              van deze disclaimer, verzoeken wij u de app niet te gebruiken.
            </p>
          </Sectie>

          <Sectie titel="6. Wijzigingen">
            <p>
              De ontwikkelaar behoudt zich het recht voor deze disclaimer te allen tijde te wijzigen.
              De meest actuele versie is beschikbaar via het menu van de app.
            </p>
          </Sectie>

        </div>

        <p className="text-xs text-slate-600 mt-4 text-center">
          Werkelijk Rendement · Zeist, Nederland · {datum}
        </p>
      </div>
    </Layout>
  );
}
