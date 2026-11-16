/* Handleiding Fill: inhoud. Opmaak en knop zitten in handleiding.js (gedeeld met Loop en Pass). */
window.RS_HANDLEIDING = {
  app: "Fill",
  bijgewerkt: "16 november 2026",
  zoekVoorbeeld: "bijgevuld, krat, unTill",
  intro: "Fill laat zien wat er in de koelingen bijgevuld moet worden. De kassa (unTill) telt elke verkoop mee, jij vult bij en vinkt af. Het onderdeel van het scherm waar je nu bent staat open.",
  knop: { voor: "#themebtn", klasse: "themebtn", inhoud: "?", stijl: "font-family:var(--font-display);font-weight:700;font-size:1.15rem;color:var(--accent)" },
  context: function () {
    var t = document.querySelector("#tabs [aria-selected='true']");
    if (!t || document.getElementById("app").hidden) return "inloggen";
    var tab = t.getAttribute("data-tab");
    if (tab === "instellingen") {
      var s = document.querySelector(".subnav [aria-current='true']");
      var sec = s ? s.getAttribute("data-sec") : "dranken";
      return { dranken: "set-dranken", koelingen: "set-koelingen", volgorde: "set-volgorde", koppeling: "set-koppeling", uitsluiten: "set-uitsluiten", algemeen: "set-algemeen" }[sec] || "set-dranken";
    }
    return { koelingen: "bijvullen", pakken: "pakken", dashboard: "dashboard", analyse: "analyse", magazijn: "magazijn" }[tab] || null;
  },
  secties: [
    { id: "inloggen", icoon: "🔑", titel: "Inloggen, account maken en wachtwoord vergeten", zoek: "wachtwoord vergeten herstellink mail account aanmaken team toegang uitloggen",
      tekst: `<ol><li>Nieuw? Tik op <b>Nog geen account? Maak er een aan</b> en kies een e-mailadres en een wachtwoord van minstens 8 tekens.</li>
<li>Vraag de beheerder om jouw e-mailadres toe te voegen bij <b>Instellingen › Weergave en team › Team</b>. Pas dan zie je de koelingen.</li>
<li>Laat <b>Ingelogd blijven op dit apparaat</b> aangevinkt op de vaste tablet, dan hoef je niet steeds opnieuw in te loggen.</li></ol>
<p><b>Wachtwoord vergeten?</b> Vul je e-mail in en tik op <b>Wachtwoord vergeten?</b>. Je krijgt een mail met een herstellink. Open die, kies twee keer hetzelfde nieuwe wachtwoord (minstens 8 tekens) en tik op <b>Wachtwoord opslaan</b>.</p>
<p class="rsh-let">Een herstellink werkt maar één keer. Werkt hij niet meer, vraag dan op het inlogscherm een nieuwe aan.</p>
<p class="rsh-tip">Zet Fill op het beginscherm: in Safari via Delen › Zet op beginscherm, in Chrome via het menu › App installeren. Dan opent hij als een gewone app.</p>` },

    { id: "bijvullen", icoon: "🧊", titel: "Bijvullen: wat moet erbij?", zoek: "koeling afvinken vinkje bijgevuld erbij blokjes looproute kleur rood oranje",
      tekst: `<p>Bovenaan zie je hoe vol alle koelingen samen zijn en hoeveel stuks en flessen er bij moeten. Daaronder staat elke koeling, genummerd in de volgorde van je looproute.</p>
<ul><li>Per drank zie je een <b>blokjesbalk</b>: elk blokje is een plek in de koeling. Groen is goed, oranje is bijna leeg (60% of minder), rood is leeg (30% of minder).</li>
<li>Het grote getal is <b>hoeveel erbij moet</b>. Is dat een heel krat, doos of tray, dan staat dat eronder.</li>
<li>Wijn en sterke drank tellen in glazen of shots: “12 glazen verkocht · 5 = 1 fles” betekent dat er ruim 2 flessen uit zijn.</li></ul>
<ol><li>Vul de drank bij tot de koeling vol is.</li>
<li>Tik op het <b>vinkje</b> achter de drank. Hij staat dan weer op vol en verdwijnt uit de lijst.</li>
<li>Alles in één koeling gedaan? Tik onderaan op <b>Hele koeling bijgevuld</b>.</li></ol>
<p class="rsh-tip">Per ongeluk afgevinkt? Tik meteen op <b>Ongedaan maken</b> in de melding onderin.</p>
<p>Met de knoppen bovenaan kies je <b>Per koeling</b> of <b>Alles samen</b> (één lijst), en <b>Volgorde van pakken</b> of <b>Hardst nodig eerst</b>.</p>` },

    { id: "signalen", icoon: "⏱", titel: "Waarschuwingen: bijna op of loopt hard", zoek: "signaal melding waarschuwing bijna op loopt hard vuur klok verbergen",
      tekst: `<p>Bovenaan het bijvulscherm verschijnt soms een gekleurde balk:</p>
<ul><li><b>⏱ … is over ±20 min op</b>: de koeling is bijna leeg en bij het huidige tempo is hij snel op.</li>
<li><b>🔥 loopt hard</b>: de drank gaat het laatste uur veel sneller dan normaal voor deze dag en tijd.</li></ul>
<p>Tik op <b>Bijgevuld</b> als je hem hebt aangevuld, of op <b>✕</b> om de waarschuwing een uur te verbergen.</p>` },

    { id: "pakken", icoon: "📦", titel: "Pakken in het magazijn", zoek: "pakken magazijn pakbon krat ophalen voorraad",
      tekst: `<p>Op <b>Pakken</b> staat alles wat je in één keer uit het magazijn moet halen, opgeteld over alle koelingen. Je ziet per drank hoeveel kratten of stuks, voor welke koeling, en hoeveel er nog op voorraad is.</p>
<ol><li>Pak alles wat op de lijst staat.</li><li>Loop langs de koelingen en vul bij.</li><li>Vink af op het tabblad <b>Bijvullen</b>.</li></ol>
<p class="rsh-tip">Kies <b>Volgorde van pakken</b> om in één rondje door het magazijn te lopen.</p>` },

    { id: "magazijn", icoon: "🏷", titel: "Magazijnvoorraad en bestellen", zoek: "voorraad bestellen levering bijna op +1 krat stand",
      tekst: `<p>De voorraad in het magazijn loopt vanzelf mee: als je bijvult, gaat hij omlaag.</p>
<ul><li><b>Bestel</b> (rood): bestel het aantal dat erbij staat.</li><li><b>Bijna op</b> (oranje): houd in de gaten.</li></ul>
<ol><li>Levering binnen? Tik op <b>+1 krat</b> (of doos/tray) per binnengekomen verpakking.</li><li>Klopt de stand niet? Typ het echte aantal in het vakje.</li></ol>
<p class="rsh-let">Bijvullen kan altijd, ook als hier 0 staat. Een verkeerde voorraad houdt niemand tegen, maar het bestellijstje klopt dan niet.</p>` },

    { id: "dashboard", icoon: "📊", titel: "Dashboard", zoek: "dashboard score cijfers vandaag week weer",
      tekst: `<p>Het dashboard laat zien hoe het bijvullen gaat: hoe vol elke koeling nu is, hoeveel er is bijgevuld, de <b>bijvulscore</b> (hoe vaak een koeling leeg stond en hoe snel er werd bijgevuld) en wanneer het druk is.</p>
<p>Kies bovenaan <b>Vandaag</b>, <b>Week</b> of <b>30 dagen</b>. Een dag loopt van 06:00 tot 06:00, zodat een late avond bij één dag hoort. Het weerblok voorspelt de drukte op basis van eerdere dagen met vergelijkbaar weer.</p>` },

    { id: "analyse", icoon: "📈", titel: "Analyse van de verkoop", zoek: "analyse verkoop toppers stille dranken samen besteld koelruimte wijn",
      tekst: `<p>Analyse rekent met de echte kassaverkopen (glazen, flesjes, shots). Kies <b>dag</b>, <b>week</b> of <b>maand</b>.</p>
<ul><li><b>Toppers</b> en <b>Stille dranken</b>: wat goed en wat slecht verkoopt.</li>
<li><b>Koelruimte tegen verkoop</b>: krijgt een drank genoeg plek in de koeling voor wat hij verkoopt?</li>
<li><b>Vaak samen besteld</b>, <b>Per weekdag</b> en <b>Verkoop per uur</b>: wanneer en wat er gedronken wordt.</li></ul>` },

    { id: "set-dranken", icoon: "🥤", titel: "Instellingen › Dranken op scherm", zoek: "drank toevoegen vulstand vol nu verpakking per fles verbergen koeling verplaatsen",
      tekst: `<p>Kies bovenaan een koeling. Per drank stel je in:</p>
<ul><li><b>Op scherm</b>: vinkje uit = drank verbergen (bijv. buiten het seizoen).</li><li><b>Koeling</b>: in welke koeling hij staat.</li>
<li><b>Verpakking</b>: krat, doos of tray, en hoeveel erin zit.</li><li><b>Per fles</b>: hoeveel verkopen samen één fles zijn (5 glazen wijn = 1 fles; fris en bier = 1).</li>
<li><b>Nu</b>: wat er nu echt in de koeling staat. Klopt het scherm niet, typ dan de echte stand.</li><li><b>Vol</b>: hoeveel erin hoort (de vulstand).</li></ul>
<p>Nieuwe drank? Tik op <b>+ Nieuwe drank</b> en kies meteen het kassa-artikel uit unTill, dan telt hij direct mee.</p>` },

    { id: "set-koelingen", icoon: "❄️", titel: "Instellingen › Koelingen", zoek: "koeling toevoegen verwijderen looproute volgorde naam",
      tekst: `<p>Hier geef je koelingen een naam en omschrijving en zet je ze in de volgorde van je looproute: koeling 1 vul je als eerste.</p>
<p class="rsh-let">Een koeling kan pas weg als er geen dranken meer in staan. Verplaats ze eerst bij Dranken op scherm.</p>` },

    { id: "set-volgorde", icoon: "↕️", titel: "Instellingen › Pakvolgorde", zoek: "pakvolgorde magazijn volgorde nummer",
      tekst: `<p>Zet de dranken in de volgorde waarin ze in het magazijn staan. Typ een nummer om een drank direct naar die plek te zetten. Deze volgorde gebruikt Fill bij <b>Volgorde van pakken</b>.</p>` },

    { id: "set-koppeling", icoon: "🔗", titel: "Instellingen › unTill-koppeling", zoek: "untill kassa koppelen artikel factor telt niet mee",
      tekst: `<p>Elk kassa-artikel uit unTill moet aan een drank gekoppeld zijn, anders telt het niet mee. Onder <b>Nog te koppelen</b> staan verkochte artikelen die nog nergens bij horen, meest verkocht bovenaan.</p>
<p><b>Factor</b> = hoeveel glazen, shots of stuks één verkoop is: glas wijn 1, groot glas 1,4, hele fles 5.</p>` },

    { id: "set-uitsluiten", icoon: "🚫", titel: "Instellingen › Niet meetellen", zoek: "personeel tafel niet meetellen uitsluiten grote fles",
      tekst: `<p>Aanslagen van gekozen dranken op gekozen tafels tellen niet mee in Fill: de koeling gaat er niet van omlaag. Handig voor een personeelstafel waar fris uit een grote fles komt.</p>
<p class="rsh-let">Dit geldt alleen voor nieuwe aanslagen, niet met terugwerkende kracht.</p>` },

    { id: "set-algemeen", icoon: "⚙️", titel: "Instellingen › Weergave en team", zoek: "pushmelding melding iphone team toevoegen thema donker licht uitloggen",
      tekst: `<ul><li><b>Pushmeldingen</b>: krijg een melding als een drank hard loopt of bijna op is, ook als de app dicht is. Op de iPhone werkt dit alleen vanuit de app op je beginscherm.</li>
<li><b>Team</b>: wie mag inloggen. Laat iemand eerst zelf een account aanmaken en zet daarna het e-mailadres hier.</li>
<li><b>Licht of donker</b>: geldt alleen voor dit apparaat. Kan ook met de ronde knop rechtsboven.</li></ul>` },

    { id: "status", icoon: "🟢", titel: "Statusbalk en laatste verkopen", zoek: "untill live fout demo verbinden laatste verkopen bijgewerkt",
      tekst: `<p>Rechtsboven staat of de kassa gekoppeld is:</p>
<ul><li><b>unTill live · bijgewerkt 21:14</b>: alles werkt, verkopen komen binnen.</li>
<li><b>unTill-koppeling geeft een fout</b>: de verkopen komen even niet door. Vul op het oog bij en meld het aan de beheerder als het blijft.</li>
<li><b>Demoverkoop</b>: de kassa is nog niet gekoppeld; de cijfers zijn niet echt.</li></ul>
<p>Rechtsonder (of linksonder op een telefoon) staat <b>Laatste verkopen</b>: de laatste aanslagen uit de kassa. Tik erop om hem in of uit te klappen.</p>` },
  ],
  vragen: [
    { id: "v-klopt-niet", icoon: "❓", titel: "Het scherm zegt dat er iets bij moet, maar de koeling is vol", zoek: "klopt niet stand verkeerd",
      tekst: `<p>Tik op het vinkje: dan staat hij weer op vol. Gebeurt het vaak bij dezelfde drank, controleer dan de koppeling en de factor bij <b>Instellingen › unTill-koppeling</b>, of de vulstand bij <b>Dranken op scherm</b>.</p>` },
    { id: "v-niet-omlaag", icoon: "❓", titel: "Een drank gaat niet omlaag bij verkoop", zoek: "telt niet mee niet gekoppeld",
      tekst: `<p>Waarschijnlijk is het kassa-artikel niet gekoppeld. Kijk bij <b>Instellingen › unTill-koppeling › Nog te koppelen</b>. Kijk ook of de drank niet bij <b>Niet meetellen</b> staat.</p>` },
    { id: "v-niets", icoon: "❓", titel: "Er gebeurt helemaal niets meer", zoek: "vastgelopen werkt niet bevroren",
      tekst: `<p>Kijk rechtsboven naar de statusbalk. Staat er een fout, of “Verbinden…”? Controleer de wifi en ververs de pagina (omlaag vegen of opnieuw openen). Helpt dat niet, meld het aan de beheerder.</p>` },
    { id: "v-uit", icoon: "❓", titel: "Ik weet mijn wachtwoord niet meer", zoek: "wachtwoord vergeten uitgelogd herstellink",
      tekst: `<p>Tik op het inlogscherm op <b>Wachtwoord vergeten?</b> en volg de link in de mail. Geen mail gekregen? Kijk in je spam, of vraag de beheerder. Zet op de vaste tablet altijd <b>Ingelogd blijven op dit apparaat</b> aan.</p>` },
  ],
};
