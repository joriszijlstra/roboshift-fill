# RoboShift Fill

Bijvulscherm voor de horeca (eerste klant: Eetcafé de Kwikkel). Statische site: geen build-stap, gewoon de bestanden in deze map hosten.

- `index.html`, `app.js` (scherm), `analyse.js`, `weer.js`, `style.css`, `weer.css`, `sw.js` (pushmeldingen)
- `config.js`: publieke Supabase-sleutels (project `bijvulscherm`)
- `supabase.js`: Supabase JS-client (gebundeld)

Data en logica staan in Supabase (tabellen, SQL-functies, edge functions zoals `untill-sync`).

Live: https://kwikkel-bijvulscherm.netlify.app (handmatig gedeployed).
