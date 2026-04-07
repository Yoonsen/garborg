import fs from "node:fs/promises";
import path from "node:path";
import XLSX from "xlsx";

const ROOT = process.cwd();
const CORPUS_XLSX = path.join(ROOT, "korpus.xlsx");
const OUT_FILE = path.join(ROOT, "public", "vocab.json");
const API_BASE = "https://api.nb.no/dhlab";
const CUTOFF = Number(process.env.CUTOFF || 0);

async function main() {
  const corpus = readCorpus(CORPUS_XLSX);
  if (!corpus.length) {
    throw new Error("Fant ingen korpusrader med urn + dhlabid.");
  }

  const urns = corpus.map((row) => row.urn);
  const dhlabidByUrn = new Map(corpus.map((row) => [row.urn, row.dhlabid]));

  console.log(`Korpusdokument: ${urns.length}`);
  console.log(`Henter hele vokabularet fra /frequencies (cutoff=${CUTOFF}) ...`);
  const frequencyRows = await fetchCorpusFrequencies(urns, CUTOFF);
  const perWord = new Map();
  for (const row of frequencyRows) {
    const word = row.word;
    const docId = normalizeDocId(row.id, dhlabidByUrn);
    if (!word || !docId) continue;
    const freq = row.freq;
    let entry = perWord.get(word);
    if (!entry) {
      entry = { totalFreq: 0, byDoc: {} };
      perWord.set(word, entry);
    }
    entry.totalFreq += freq;
    entry.byDoc[docId] = (entry.byDoc[docId] || 0) + freq;
  }

  const wordsOut = Array.from(perWord.entries())
    .map(([word, data]) => ({
      word,
      reversed: reverse(word),
      totalFreq: data.totalFreq,
      docFreq: Object.keys(data.byDoc).length,
      byDoc: data.byDoc
    }))
    .filter((row) => row.totalFreq > 0)
    .sort((a, b) => b.totalFreq - a.totalFreq);

  const payload = {
    generatedAt: new Date().toISOString(),
    source: {
      endpointFrequencies: `${API_BASE}/frequencies`,
      corpusSize: corpus.length,
      cutoff: CUTOFF
    },
    words: wordsOut
  };

  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify(payload), "utf8");
  console.log(`Skrev ${wordsOut.length} ord til ${path.relative(ROOT, OUT_FILE)}`);
}

function readCorpus(filePath) {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
  return rows
    .map((row) => {
      const dhlabid = String(row.dhlabid || row.id || row.docid || "").trim();
      const urn = String(row.urn || row.URN || "").trim();
      if (!dhlabid || !urn) return null;
      return { dhlabid, urn };
    })
    .filter(Boolean);
}

async function fetchCorpusFrequencies(urns, cutoff) {
  const res = await fetch(`${API_BASE}/frequencies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ urns, cutoff, words: null })
  });
  if (!res.ok) {
    throw new Error(`frequencies feilet (${res.status})`);
  }
  const data = await res.json();
  if (!Array.isArray(data)) return [];

  // words=null response is nested per document:
  // [
  //   [[docIdOrUrn, word, freq], ...],
  //   [[docIdOrUrn, word, freq], ...]
  // ]
  const rows = [];
  for (const docRows of data) {
    if (!Array.isArray(docRows)) continue;
    for (const tuple of docRows) {
      if (!Array.isArray(tuple) || tuple.length < 3) continue;
      rows.push({
        id: tuple[0],
        word: String(tuple[1] || ""),
        freq: Number(tuple[2] || 0)
      });
    }
  }
  return rows;
}

function normalizeDocId(rawId, dhlabidByUrn) {
  if (rawId === null || rawId === undefined) return "";
  const asString = String(rawId).trim();
  if (!asString) return "";
  if (/^\d+(\.0+)?$/.test(asString)) {
    return asString.replace(/\.0+$/, "");
  }
  return dhlabidByUrn.get(asString) || "";
}

function reverse(word) {
  return Array.from(word).reverse().join("");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
