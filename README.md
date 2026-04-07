# Garborg Korpus PWA

PWA for:
- konkordans via `POST https://api.nb.no/dhlab/conc`
- ordliste/frekvens via `POST https://api.nb.no/dhlab/frequencies`

Se også: `APP_PHILOSOPHY.md` for prinsippet "data som velger operasjoner".

## Lokal utvikling

```bash
npm install
npm run build:vocab   # generer public/vocab.json (anbefalt)
npm run dev
```

## Bruk

1. Appen laster `korpus.xlsx` automatisk ved oppstart.
2. Kjør konkordanssok pa `dhlabid`-utvalget.
3. Kjør frekvens pa `urn`-utvalget.

Korpus er fast (`korpus.xlsx`) i denne versjonen.

## Ferdig ordindeks

Appen kan bruke en forhåndsberegnet ordindeks (`public/vocab.json`) for raskt prefix/suffix/regex/glob-sok.

Generer indeks:

```bash
npm run build:vocab
```

Valgfrie env-variabler:
- `CUTOFF` (default `0`, min frekvens per ord i hvert dokument)

## Deploy

GitHub Actions workflow ligger i `.github/workflows/deploy-pages.yml`.
