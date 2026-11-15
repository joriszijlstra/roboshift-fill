# RoboShift Fill

Bijvulscherm voor de horeca (eerste klant: Eetcafé de Kwikkel). Statische site: geen build-stap, gewoon de bestanden in deze map hosten.

- `index.html`, `app.js` (scherm), `analyse.js`, `weer.js`, `style.css`, `weer.css`, `sw.js` (pushmeldingen)
- `config.js`: publieke Supabase-sleutels (project `bijvulscherm`)
- `supabase.js`: Supabase JS-client (gebundeld)

Data en logica staan in Supabase (tabellen, SQL-functies, edge functions zoals `untill-sync`).

Live: https://fill.roboshift.nl (GitHub Pages, branch `main`, map `/`; het bestand `CNAME` zet het domein). DNS bij Strato: CNAME `fill` -> `joriszijlstra.github.io`.

Oud adres: https://kwikkel-bijvulscherm.netlify.app (handmatig gedeployed), blijft draaien tot de overstap definitief is.

Na een domeinwissel: in Supabase (Authentication > URL Configuration) het nieuwe adres bij de Redirect URLs zetten, anders werken bevestigings- en herstelmails niet. Inloggen en pushmeldingen zijn per adres, dus op elk toestel opnieuw.
