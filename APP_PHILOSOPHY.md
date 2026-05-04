# Appfilosofi: Data som velger operasjoner

Denne appen følger en datasentrert modell:

- Ikke: et generisk program der bruker velger data.
- Men: et konkret datasett som bærer med seg relevante operasjoner.

Dette er også en videreføring av en notebook-måte å arbeide på:

- I Jupyter starter man gjerne med materialet og oppgaven, og lar operasjonene vokse fram derfra.
- I mange apper blir dette snudd: appen tilbyr generelle verktøy, og brukeren må selv velge data og arbeidsform.
- Her forsøker vi å slå disse to sammen: appen får notebookens nærhet til oppgaven, men i en mer stabil og tilgjengelig form.

## Kjerneidé

Tradisjonell modell:

- `Program(data)`

Modellen vi bruker her:

- `data -> λP. P(data)`

Der:

- `data` er korpuset (her: Garborg-korpus)
- `P` er et sett av operasjoner valgt for nettopp dette korpuset
- `P(data)` er appens faktiske funksjoner

Det betyr at dataene i praksis typeløftes til å bli en velger av algoritmer. Vi starter ikke med et lager av generelle algoritmer som så får avgjøre hvilke data som kan brukes. Vi starter med et konkret materiale, og lar materialets form, skala og faglige spørsmål avgjøre hvilke operasjoner som hører hjemme i appen.

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
- Appen blir en konkret videreføring av analysearbeidet, ikke et generisk skall rundt det.

## Praktisk tommelfingerregel

Når vi lager en ny korpusapp:

1. Identifiser hva som er særpreget i datasettet.
2. Velg operasjoner som uttrykker dette særpreget.
3. Bygg appen rundt disse operasjonene.
4. Unngå generiske input-mekanismer med mindre de trengs.

Kort sagt: Appen er en typeløfting av korpuset, der data bestemmer hvilke operasjoner og algoritmer som finnes, i stedet for at et ferdig sett algoritmer bestemmer hvilke data som passer inn.
