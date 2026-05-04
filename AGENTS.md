# AGENTS.md

## Prosjektkontekst

- Dette repoet er en PWA for Garborg-korpus med konkordans og frekvenssøk mot DH-lab API-et.
- Appen er ikke generisk: dataene bestemmer operasjonene. Hold fast ved den modellen.

## Korpusoppsett

- Prosjektet bruker to faste korpusfiler:
  - `korpus_skrifter.xlsx`
  - `korpus_dagbok.xlsx`
- Brukeren skal kunne velge mellom disse to i UI-et.
- Ikke reintroduser `korpus.xlsx` som primærkilde uten eksplisitt beskjed fra brukeren.

## Grunnlagsdata

- `npm run build:vocab` skal generere ordindeks for begge korpus:
  - `public/vocab-skrifter.json`
  - `public/vocab-dagbok.json`
- Hvis et korpus endres, bør de tilhørende `vocab-*.json`-filene regenereres.

## Appforventninger

- `src/main.ts` laster riktig Excel-fil og riktig ordindeks ut fra valgt korpus.
- Konkordans, frekvens og indekssøk skal alltid kjøre mot aktivt korpus og aktivt subkorpus.
- Bevar enkelheten i UI-et; unngå å gjøre løsningen mer generell enn nødvendig.

## Når du fortsetter arbeidet

- Sjekk først om begge korpus fortsatt følger samme kolonnestruktur i Excel.
- Ved endringer i korpuslogikk: test med `npm run build:vocab` og `npm run build`.
- Vær oppmerksom på at git-treet kan inneholde pågående filomdøping eller andre brukerendringer; ikke rydd opp i slike uten å spørre.
