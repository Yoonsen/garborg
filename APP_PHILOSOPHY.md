# Appfilosofi: Data som velger operasjoner

Denne appen følger en datasentrert modell:

- Ikke: et generisk program der bruker velger data.
- Men: et konkret datasett som bærer med seg relevante operasjoner.

## Kjerneidé

Tradisjonell modell:

- `Program(data)`

Modellen vi bruker her:

- `data -> λP. P(data)`

Der:

- `data` er korpuset (her: Garborg-korpus)
- `P` er et sett av operasjoner valgt for nettopp dette korpuset
- `P(data)` er appens faktiske funksjoner

## Konsekvenser for denne appen

- Korpuset er innebygd (ikke filopplasting i normal bruk).
- Operasjonene er valgt ut fra korpusets karakter:
  - konkordans (standard)
  - suffiks-/glob-/regex-søk i forhåndsindeksert ordliste (korpusspesifikt)
- Ytelse er en del av modellvalget:
  - forhåndsberegnet ordindeks (`vocab.json`)
  - raske oppslag mot lite/avgrenset datasett

## Hvorfor dette er nyttig

- Brukeren møter et verktøy som er laget for akkurat materialet.
- Operasjonene blir faglig meningsfulle, ikke bare teknisk tilgjengelige.
- Appen blir enklere i bruk fordi irrelevante valg fjernes.

## Praktisk tommelfingerregel

Når vi lager en ny korpusapp:

1. Identifiser hva som er særpreget i datasettet.
2. Velg operasjoner som uttrykker dette særpreget.
3. Bygg appen rundt disse operasjonene.
4. Unngå generiske input-mekanismer med mindre de trengs.

Kort sagt: Appen er en typeløfting av korpuset, der data bestemmer hvilke operasjoner som finnes.
