# Garborg Korpus PWA

PWA for:
- konkordans via `POST https://api.nb.no/dhlab/conc`
- ordliste/frekvens via `POST https://api.nb.no/dhlab/frequencies`

Se også: `APP_PHILOSOPHY.md` for prinsippet "data som velger operasjoner".

## Lokal utvikling

```bash
npm install
npm run build:vocab   # generer vocab-filer for begge korpus (anbefalt)
npm run dev
```

## Bruk

1. Appen lar brukeren velge mellom `korpus_skrifter.xlsx` og `korpus_dagbok.xlsx`.
2. Kjør konkordanssok pa `dhlabid`-utvalget i valgt korpus.
3. Kjør frekvens pa `urn`-utvalget i valgt korpus.

Korpusa er faste i denne versjonen.

## Ferdig ordindeks

Appen kan bruke forhåndsberegnede ordindekser (`public/vocab-skrifter.json` og `public/vocab-dagbok.json`) for raskt prefix/suffix/regex/glob-sok.

Generer indeks:

```bash
npm run build:vocab
```

Valgfrie env-variabler:
- `CUTOFF` (default `0`, min frekvens per ord i hvert dokument)

## Deploy

GitHub Actions workflow ligger i `.github/workflows/deploy-pages.yml`.
