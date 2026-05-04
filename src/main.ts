import "./style.css";
import * as XLSX from "xlsx";
import cloudFactory from "d3-cloud";
import corpusDagbokExcelUrl from "../korpus_dagbok.xlsx?url";
import corpusSkrifterExcelUrl from "../korpus_skrifter.xlsx?url";

type CorpusRow = {
  dhlabid: string;
  urn: string;
  year: string;
  title: string;
};

type ConcordanceRow = {
  docid?: string | number;
  dhlabid?: string | number;
  urn?: string;
  conc?: string;
};

type FrequencyRow = {
  urn: string;
  word: string;
  freq: number;
  urncount: number;
  relfreq: number;
};

type VocabEntry = {
  word: string;
  reversed: string;
  totalFreq: number;
  docFreq: number;
  byDoc: Record<string, number>;
};

type VocabPayload = {
  generatedAt?: string;
  words?: VocabEntry[];
};

type VocabSearchRow = {
  word: string;
  totalFreq: number;
  docFreq: number;
};

type VocabCloudWord = {
  text: string;
  size: number;
  totalFreq: number;
  docFreq: number;
  x?: number;
  y?: number;
  rotate?: number;
};

type CorpusConfig = {
  id: string;
  label: string;
  fileName: string;
  excelUrl: string;
  vocabUrl: string;
};

const CORPORA: CorpusConfig[] = [
  {
    id: "skrifter",
    label: "Skrifter",
    fileName: "korpus_skrifter.xlsx",
    excelUrl: corpusSkrifterExcelUrl,
    vocabUrl: "./vocab-skrifter.json"
  },
  {
    id: "dagbok",
    label: "Dagbøker",
    fileName: "korpus_dagbok.xlsx",
    excelUrl: corpusDagbokExcelUrl,
    vocabUrl: "./vocab-dagbok.json"
  }
];
const DEFAULT_CORPUS_ID = CORPORA[0]?.id ?? "skrifter";
const corpusOptionsHtml = CORPORA.map(
  (corpusConfig) => `<option value="${escapeHtml(corpusConfig.id)}">${escapeHtml(corpusConfig.label)}</option>`
).join("");

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Missing #app");
const appRoot = app;
const showFatalError = (message: string): void => {
  appRoot.innerHTML = `
    <section class="panel">
      <h2>Kunne ikke laste appen</h2>
      <p class="muted">Det oppstod en feil i nettleseren.</p>
      <pre>${escapeHtml(message)}</pre>
    </section>
  `;
};

window.addEventListener("error", (event) => {
  const message = event.error instanceof Error ? event.error.stack || event.error.message : String(event.message);
  showFatalError(message);
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason instanceof Error ? event.reason.stack || event.reason.message : String(event.reason);
  showFatalError(reason);
});

appRoot.innerHTML = `
  <h1>Garborg Korpus PWA</h1>
  <p class="muted">Velg mellom faste korpus med konkordans og ordliste/frekvens mot DH-lab API.</p>

  <section class="panel">
    <h2>1) Korpus</h2>
    <label for="corpus-select">Velg korpus</label>
    <select id="corpus-select">${corpusOptionsHtml}</select>
    <div class="row" style="margin-top:10px;">
      <button id="inspect-btn" type="button">Inspiser korpus</button>
      <button id="select-all-btn" type="button">Velg alle</button>
      <button id="clear-all-btn" type="button">Fjern alle</button>
    </div>
    <div class="status" id="corpus-status">Ingen fil lastet.</div>
    <div class="status" id="subcorpus-status">Subkorpus: 0 av 0 dokument valgt.</div>
    <div id="corpus-inspector" class="inspector hidden"></div>
  </section>

  <section class="panel">
    <h2>2) Konkordans</h2>
    <label for="query">Søkeord</label>
    <input id="query" type="text" placeholder="f.eks. jord" />
    <div class="row" style="margin-top:8px;">
      <div style="flex:1; min-width:120px;">
        <label for="window">Window</label>
        <input id="window" type="number" min="1" max="25" value="20" />
      </div>
      <div style="flex:1; min-width:120px;">
        <label for="limit">Limit</label>
        <input id="limit" type="number" min="1" max="2000" value="500" />
      </div>
    </div>
    <div style="margin-top:10px;">
      <button id="conc-btn">Kjør konkordans</button>
    </div>
    <div class="status" id="conc-status">Ikke kjort enda.</div>
    <div class="hits" id="conc-results"></div>
  </section>

  <section class="panel">
    <h2>3) Ordliste / frekvens</h2>
    <label for="words">Ord (komma, semikolon eller linjeskift)</label>
    <textarea id="words" placeholder="frihet, kvinne, arbeid"></textarea>
    <div class="row" style="margin-top:8px;">
      <div style="flex:1; min-width:120px;">
        <label for="cutoff">Cutoff</label>
        <input id="cutoff" type="number" min="0" value="0" />
      </div>
    </div>
    <div style="margin-top:10px;">
      <button id="freq-btn">Kjør frekvens</button>
    </div>
    <div class="status" id="freq-status">Ikke kjort enda.</div>
    <div id="freq-results"></div>
  </section>

  <section class="panel">
    <h2>4) Ordsøk i ferdig indeks</h2>
    <p class="muted">Søk i forhåndsberegnet ordliste med prefiks, suffiks, glob eller regex. Treffer filtreres mot valgt subkorpus.</p>
    <div class="row">
      <div style="flex:1; min-width:160px;">
        <label for="vocab-mode">Søkemodus</label>
        <select id="vocab-mode">
          <option value="prefix">Prefix</option>
          <option value="suffix">Suffix</option>
          <option value="glob">Glob (* og ?)</option>
          <option value="regex">Regex</option>
          <option value="contains">Inneholder</option>
        </select>
      </div>
      <div style="flex:2; min-width:220px;">
        <label for="vocab-pattern">Mønster</label>
        <input id="vocab-pattern" type="text" placeholder="f.eks. *skap eller ^for.*" />
      </div>
      <div style="flex:1; min-width:120px;">
        <label for="vocab-min-freq">Min frekvens</label>
        <input id="vocab-min-freq" type="number" min="1" value="1" />
      </div>
      <div style="flex:1; min-width:120px;">
        <label for="vocab-max-rows">Maks rader</label>
        <input id="vocab-max-rows" type="number" min="10" value="200" />
      </div>
      <div style="flex:1; min-width:140px;">
        <label for="vocab-view">Visning</label>
        <select id="vocab-view">
          <option value="list">Liste</option>
          <option value="cloud">Ordsky</option>
        </select>
      </div>
    </div>
    <div class="tool-row" id="vocab-shortcuts">
      <button type="button" class="secondary" data-mode="glob" data-pattern="*skap">*skap</button>
      <button type="button" class="secondary" data-mode="glob" data-pattern="for*">for*</button>
      <button type="button" class="secondary" data-mode="glob" data-pattern="*leg*">*leg*</button>
      <button type="button" class="secondary" data-mode="regex" data-pattern="^(u|o)\\w+">^(u|o)\\w+</button>
      <button type="button" class="secondary" id="vocab-clear-btn">Tøm</button>
    </div>
    <div class="tool-row" id="nynorsk-suffixes">
      <span class="muted" style="margin-right:6px;">Nynorsk-endinger:</span>
      <button type="button" class="secondary" data-mode="suffix" data-pattern="nad">-nad</button>
      <button type="button" class="secondary" data-mode="suffix" data-pattern="skap">-skap</button>
      <button type="button" class="secondary" data-mode="suffix" data-pattern="dom">-dom</button>
      <button type="button" class="secondary" data-mode="suffix" data-pattern="leik">-leik</button>
      <button type="button" class="secondary" data-mode="suffix" data-pattern="heit">-heit</button>
      <button type="button" class="secondary" data-mode="suffix" data-pattern="ande">-ande</button>
    </div>
    <div class="status" id="vocab-help">Tips: Velg suffiks for endinger, glob for jokertegn (* og ?), regex for avansert mønster.</div>
    <div style="margin-top:10px;">
      <button id="vocab-search-btn">Søk i indeks</button>
    </div>
    <div class="status" id="vocab-status">Laster ordindeks ...</div>
    <div id="vocab-results"></div>
    <div id="vocab-cloud"></div>
  </section>
`;

const corpusSelect = must<HTMLSelectElement>("#corpus-select");
const inspectBtn = must<HTMLButtonElement>("#inspect-btn");
const selectAllBtn = must<HTMLButtonElement>("#select-all-btn");
const clearAllBtn = must<HTMLButtonElement>("#clear-all-btn");
const corpusStatus = must<HTMLDivElement>("#corpus-status");
const subcorpusStatus = must<HTMLDivElement>("#subcorpus-status");
const corpusInspector = must<HTMLDivElement>("#corpus-inspector");
const concBtn = must<HTMLButtonElement>("#conc-btn");
const queryInput = must<HTMLInputElement>("#query");
const windowInput = must<HTMLInputElement>("#window");
const limitInput = must<HTMLInputElement>("#limit");
const concStatus = must<HTMLDivElement>("#conc-status");
const concResults = must<HTMLDivElement>("#conc-results");
const wordsInput = must<HTMLTextAreaElement>("#words");
const cutoffInput = must<HTMLInputElement>("#cutoff");
const freqBtn = must<HTMLButtonElement>("#freq-btn");
const freqStatus = must<HTMLDivElement>("#freq-status");
const freqResults = must<HTMLDivElement>("#freq-results");
const vocabMode = must<HTMLSelectElement>("#vocab-mode");
const vocabPattern = must<HTMLInputElement>("#vocab-pattern");
const vocabMinFreq = must<HTMLInputElement>("#vocab-min-freq");
const vocabMaxRows = must<HTMLInputElement>("#vocab-max-rows");
const vocabView = must<HTMLSelectElement>("#vocab-view");
const vocabSearchBtn = must<HTMLButtonElement>("#vocab-search-btn");
const vocabClearBtn = must<HTMLButtonElement>("#vocab-clear-btn");
const vocabShortcuts = must<HTMLDivElement>("#vocab-shortcuts");
const nynorskSuffixes = must<HTMLDivElement>("#nynorsk-suffixes");
const vocabStatus = must<HTMLDivElement>("#vocab-status");
const vocabResults = must<HTMLDivElement>("#vocab-results");
const vocabCloud = must<HTMLDivElement>("#vocab-cloud");
const vocabHelp = must<HTMLDivElement>("#vocab-help");

let corpus: CorpusRow[] = [];
let byId = new Map<string, CorpusRow>();
let byUrn = new Map<string, CorpusRow>();
let selectedDhlabids = new Set<string>();
const selectedDhlabidsByCorpus = new Map<string, Set<string>>();
let inspectorOpen = false;
let vocabIndex: VocabEntry[] = [];
let lastVocabRows: VocabSearchRow[] = [];
let vocabCloudRenderToken = 0;
let activeCorpusId = DEFAULT_CORPUS_ID;
let corpusLoadToken = 0;
let vocabLoadToken = 0;

corpusSelect.value = DEFAULT_CORPUS_ID;
void switchCorpus(DEFAULT_CORPUS_ID);

corpusSelect.addEventListener("change", () => {
  void switchCorpus(corpusSelect.value);
});

inspectBtn.addEventListener("click", () => {
  inspectorOpen = !inspectorOpen;
  inspectBtn.textContent = inspectorOpen ? "Skjul inspeksjon" : "Inspiser korpus";
  corpusInspector.classList.toggle("hidden", !inspectorOpen);
  if (inspectorOpen) renderCorpusInspector();
});

selectAllBtn.addEventListener("click", () => {
  selectedDhlabids = new Set(corpus.map((row) => row.dhlabid));
  updateSubcorpusStatus();
  if (inspectorOpen) renderCorpusInspector();
});

clearAllBtn.addEventListener("click", () => {
  selectedDhlabids = new Set();
  updateSubcorpusStatus();
  if (inspectorOpen) renderCorpusInspector();
});

corpusInspector.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (target.type !== "checkbox" || !target.dataset.dhlabid) return;
  const id = target.dataset.dhlabid;
  if (target.checked) {
    selectedDhlabids.add(id);
  } else {
    selectedDhlabids.delete(id);
  }
  updateSubcorpusStatus();
});

concBtn.addEventListener("click", async () => {
  const query = queryInput.value.trim();
  if (!query) {
    concStatus.textContent = "Skriv inn et sokeord.";
    return;
  }
  const selectedRows = getSelectedCorpusRows();
  const dhlabids = selectedRows
    .map((row) => Number.parseInt(row.dhlabid, 10))
    .filter((id) => Number.isFinite(id));

  if (!dhlabids.length) {
    concStatus.textContent = "Ingen gyldige dhlabid i valgt subkorpus.";
    return;
  }

  const windowSize = clamp(Number.parseInt(windowInput.value, 10) || 20, 1, 25);
  const limit = clamp(Number.parseInt(limitInput.value, 10) || 500, 1, 2000);
  concBtn.disabled = true;
  concStatus.textContent = "Henter konkordanser ...";
  concResults.innerHTML = "";

  try {
    const response = await fetch("https://api.nb.no/dhlab/conc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        dhlabids,
        window: windowSize,
        limit,
        html_formatting: true
      })
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    const rows = normalizeConcordanceRows(payload);
    concStatus.textContent = `Fant ${rows.length} treff i ${selectedRows.length} valgte dokument.`;
    renderConcordance(rows, query);
  } catch (error) {
    concStatus.textContent = `Feil: ${toError(error)}`;
  } finally {
    concBtn.disabled = false;
  }
});

freqBtn.addEventListener("click", async () => {
  const words = parseWords(wordsInput.value);
  const selectedRows = getSelectedCorpusRows();
  const urns = selectedRows.map((row) => row.urn).filter(Boolean);
  if (!urns.length) {
    freqStatus.textContent = "Ingen URN-er i valgt subkorpus.";
    return;
  }
  if (!words.length) {
    freqStatus.textContent = "Legg inn minst ett ord.";
    return;
  }

  const cutoff = Math.max(0, Number.parseInt(cutoffInput.value, 10) || 0);
  freqBtn.disabled = true;
  freqStatus.textContent = "Henter frekvenser ...";
  freqResults.innerHTML = "";

  try {
    const response = await fetch("https://api.nb.no/dhlab/frequencies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urns, words, cutoff })
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    const rows = normalizeFrequencies(payload);
    freqStatus.textContent = `Mottok ${rows.length} frekvensrader for ${selectedRows.length} valgte dokument.`;
    renderFrequencies(rows);
  } catch (error) {
    freqStatus.textContent = `Feil: ${toError(error)}`;
  } finally {
    freqBtn.disabled = false;
  }
});

vocabSearchBtn.addEventListener("click", () => {
  runVocabSearch();
});

vocabClearBtn.addEventListener("click", () => {
  vocabPattern.value = "";
  lastVocabRows = [];
  vocabResults.innerHTML = "";
  vocabCloud.innerHTML = "";
  vocabStatus.textContent = formatVocabLoadedStatus();
});

vocabPattern.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    runVocabSearch();
  }
});

vocabMode.addEventListener("change", () => {
  updateVocabHelpAndPlaceholder();
});

vocabView.addEventListener("change", () => {
  renderVocabOutput(lastVocabRows);
});

vocabShortcuts.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) return;
  const mode = target.dataset.mode;
  const pattern = target.dataset.pattern;
  if (!mode || pattern === undefined) return;
  setVocabQuery(mode, pattern, true);
});

nynorskSuffixes.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) return;
  const mode = target.dataset.mode;
  const pattern = target.dataset.pattern;
  if (!mode || pattern === undefined) return;
  setVocabQuery(mode, pattern, true);
});

if ("serviceWorker" in navigator) {
  // Keep this app cache-safe for fast iteration and avoid stale UI in Chrome.
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  });
}

async function switchCorpus(corpusId: string): Promise<void> {
  const corpusConfig = getCorpusConfig(corpusId);
  if (corpus.length) {
    selectedDhlabidsByCorpus.set(activeCorpusId, new Set(selectedDhlabids));
  }

  activeCorpusId = corpusConfig.id;
  corpusSelect.value = corpusConfig.id;
  resetOutputsForCorpusChange();
  await Promise.all([loadCorpus(corpusConfig), loadVocabIndex(corpusConfig)]);
}

function getCorpusConfig(corpusId: string): CorpusConfig {
  const corpusConfig = CORPORA.find((item) => item.id === corpusId);
  if (!corpusConfig) {
    throw new Error(`Ukjent korpus: ${corpusId}`);
  }
  return corpusConfig;
}

function getActiveCorpusConfig(): CorpusConfig {
  return getCorpusConfig(activeCorpusId);
}

function resetOutputsForCorpusChange(): void {
  concStatus.textContent = "Ikke kjort enda.";
  concResults.innerHTML = "";
  freqStatus.textContent = "Ikke kjort enda.";
  freqResults.innerHTML = "";
  lastVocabRows = [];
  vocabResults.innerHTML = "";
  vocabCloud.innerHTML = "";
  vocabStatus.textContent = "Laster ordindeks ...";
}

async function loadCorpus(corpusConfig: CorpusConfig): Promise<void> {
  const token = ++corpusLoadToken;
  corpusStatus.textContent = `Laster ${corpusConfig.label.toLowerCase()} fra ${corpusConfig.fileName} ...`;
  try {
    const response = await fetch(corpusConfig.excelUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const buffer = await response.arrayBuffer();
    const rows = parseExcelBuffer(buffer);
    if (token !== corpusLoadToken || corpusConfig.id !== activeCorpusId) return;
    setCorpus(rows, `${corpusConfig.label} lastet`, corpusConfig.id);
  } catch (error) {
    if (token !== corpusLoadToken || corpusConfig.id !== activeCorpusId) return;
    setCorpus([], `Kunne ikke laste ${corpusConfig.label.toLowerCase()}`, corpusConfig.id);
    corpusStatus.textContent =
      `Kunne ikke laste ${corpusConfig.label.toLowerCase()} automatisk (${toError(error)}).`;
  }
}

function parseExcelBuffer(buffer: ArrayBuffer): CorpusRow[] {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("Fant ingen ark i Excel-filen.");
  const sheet = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  return raw
    .map((row) => mapRow(row))
    .filter((row): row is CorpusRow => row !== null);
}

function mapRow(row: Record<string, unknown>): CorpusRow | null {
  const dhlabid = pickValue(row, ["dhlabid", "id", "docid", "Unnamed: 0"]);
  const urn = pickValue(row, ["urn", "URN"]);
  if (!dhlabid || !urn) return null;
  const year = pickValue(row, ["year", "aar", "år"]);
  const title = pickValue(row, ["title", "tittel"]);
  return { dhlabid, urn, year, title };
}

function pickValue(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) {
      return String(row[key]).trim();
    }
  }
  return "";
}

function normalizeConcordanceRows(payload: unknown): ConcordanceRow[] {
  if (Array.isArray(payload)) {
    return payload as ConcordanceRow[];
  }
  if (!payload || typeof payload !== "object") return [];
  const table = payload as Record<string, Record<string, unknown>>;
  const ids = new Set<string>();
  for (const key of ["docid", "dhlabid", "urn", "conc"]) {
    const col = table[key];
    if (!col || typeof col !== "object") continue;
    Object.keys(col).forEach((idx) => ids.add(idx));
  }
  return Array.from(ids)
    .sort((a, b) => Number(a) - Number(b))
    .map((idx) => ({
      docid: table.docid?.[idx] as string | number | undefined,
      dhlabid: table.dhlabid?.[idx] as string | number | undefined,
      urn: table.urn?.[idx] as string | undefined,
      conc: table.conc?.[idx] as string | undefined
    }));
}

function renderConcordance(rows: ConcordanceRow[], query: string): void {
  if (!rows.length) {
    concResults.innerHTML = "<div class='muted'>Ingen treff.</div>";
    return;
  }
  const html = rows
    .slice(0, 500)
    .map((row) => {
      const id = String(row.docid ?? row.dhlabid ?? "");
      const meta = byId.get(id);
      const urn = row.urn ?? meta?.urn ?? "";
      const title = meta?.title || "(uten tittel)";
      const year = meta?.year || "";
      const link = urn
        ? `https://www.nb.no/items/${encodeURIComponent(urn)}?searchText=${encodeURIComponent(query)}`
        : "";
      return `
        <div class="hit">
          <div class="hit-title">${escapeHtml(title)} ${year ? `(${escapeHtml(year)})` : ""} ${link ? `- <a href="${link}" target="_blank" rel="noreferrer">NB</a>` : ""}</div>
          <div class="hit-frag">${row.conc ?? ""}</div>
        </div>
      `;
    })
    .join("");
  concResults.innerHTML = html;
}

function normalizeFrequencies(payload: unknown): FrequencyRow[] {
  if (!Array.isArray(payload)) return [];
  return payload.map((row) => {
    const tuple = row as [string, string, number, number];
    const idOrUrn = String(tuple[0] ?? "");
    const urn = byUrn.has(idOrUrn) ? idOrUrn : (byId.get(idOrUrn)?.urn ?? idOrUrn);
    const word = String(tuple[1] ?? "");
    const freq = Number(tuple[2] ?? 0);
    const urncount = Number(tuple[3] ?? 0);
    const relfreq = urncount ? freq / urncount : 0;
    return { urn, word, freq, urncount, relfreq };
  });
}

function renderFrequencies(rows: FrequencyRow[]): void {
  if (!rows.length) {
    freqResults.innerHTML = "<div class='muted'>Ingen frekvensdata.</div>";
    return;
  }

  const perWord = new Map<string, { total: number; docs: number }>();
  for (const row of rows) {
    const prev = perWord.get(row.word) ?? { total: 0, docs: 0 };
    perWord.set(row.word, { total: prev.total + row.freq, docs: prev.docs + 1 });
  }
  const sorted = Array.from(perWord.entries()).sort((a, b) => b[1].total - a[1].total);
  const tableRows = sorted
    .map(([word, stat]) => {
      return `<tr><td>${escapeHtml(word)}</td><td>${stat.total}</td><td>${stat.docs}</td></tr>`;
    })
    .join("");
  freqResults.innerHTML = `
    <table>
      <thead>
        <tr><th>Ord</th><th>Total frekvens</th><th>Dokumenter med treff</th></tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
  `;
}

function setCorpus(rows: CorpusRow[], statusPrefix: string, corpusId: string): void {
  corpus = rows;
  byId = new Map(rows.map((row) => [row.dhlabid, row]));
  byUrn = new Map(rows.map((row) => [row.urn, row]));
  const savedSelection = selectedDhlabidsByCorpus.get(corpusId);
  if (savedSelection?.size) {
    selectedDhlabids = new Set(rows.map((row) => row.dhlabid).filter((id) => savedSelection.has(id)));
  } else {
    selectedDhlabids = new Set(rows.map((row) => row.dhlabid));
  }
  corpusStatus.textContent = `${statusPrefix}: ${rows.length} rader.`;
  updateSubcorpusStatus();
  if (inspectorOpen) renderCorpusInspector();
}

function getSelectedCorpusRows(): CorpusRow[] {
  if (selectedDhlabids.size === 0) return [];
  return corpus.filter((row) => selectedDhlabids.has(row.dhlabid));
}

function updateSubcorpusStatus(): void {
  subcorpusStatus.textContent =
    `Subkorpus i ${getActiveCorpusConfig().label}: ${selectedDhlabids.size} av ${corpus.length} dokument valgt.`;
}

function renderCorpusInspector(): void {
  if (!corpus.length) {
    corpusInspector.innerHTML = "<div class='muted'>Ingen korpusdata lastet.</div>";
    return;
  }

  const rows = corpus
    .map((row) => {
      const checked = selectedDhlabids.has(row.dhlabid) ? "checked" : "";
      return `
        <tr>
          <td><input type="checkbox" data-dhlabid="${escapeHtml(row.dhlabid)}" ${checked} /></td>
          <td>${escapeHtml(row.title || "(uten tittel)")}</td>
          <td>${escapeHtml(row.year || "")}</td>
          <td><code>${escapeHtml(row.dhlabid)}</code></td>
          <td><code>${escapeHtml(row.urn)}</code></td>
        </tr>
      `;
    })
    .join("");

  corpusInspector.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Velg</th>
          <th>Tittel</th>
          <th>År</th>
          <th>dhlabid</th>
          <th>URN</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

async function loadVocabIndex(corpusConfig: CorpusConfig): Promise<void> {
  const token = ++vocabLoadToken;
  try {
    const response = await fetch(corpusConfig.vocabUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = (await response.json()) as VocabPayload;
    if (token !== vocabLoadToken || corpusConfig.id !== activeCorpusId) return;
    vocabIndex = Array.isArray(payload.words) ? payload.words : [];
    vocabStatus.textContent = formatVocabLoadedStatus();
    updateVocabHelpAndPlaceholder();
  } catch (error) {
    if (token !== vocabLoadToken || corpusConfig.id !== activeCorpusId) return;
    vocabIndex = [];
    vocabStatus.textContent =
      `Ingen ferdig ordindeks funnet for ${corpusConfig.label.toLowerCase()} (${toError(error)}). Kjør npm run build:vocab og deploy på nytt.`;
  }
}

function formatVocabLoadedStatus(): string {
  return `Ordindeks for ${getActiveCorpusConfig().label.toLowerCase()} lastet: ${vocabIndex.length} ord.`;
}

function setVocabQuery(mode: string, pattern: string, autoRun: boolean): void {
  vocabMode.value = mode;
  vocabPattern.value = pattern;
  updateVocabHelpAndPlaceholder();
  if (autoRun) runVocabSearch();
}

function updateVocabHelpAndPlaceholder(): void {
  const mode = vocabMode.value;
  if (mode === "suffix") {
    vocabPattern.placeholder = "f.eks. skap eller heit";
    vocabHelp.textContent = "Suffiks-modus: skriv ending uten stjerne, f.eks. skap gir ord som ender på -skap.";
    return;
  }
  if (mode === "glob") {
    vocabPattern.placeholder = "f.eks. *skap, for*, *leg*";
    vocabHelp.textContent = "Glob-modus: * = mange tegn, ? = ett tegn.";
    return;
  }
  if (mode === "regex") {
    vocabPattern.placeholder = "f.eks. ^(u|o)\\w+";
    vocabHelp.textContent = "Regex-modus: bruk JavaScript-regex; søket skiller ikke mellom store og små bokstaver.";
    return;
  }
  if (mode === "prefix") {
    vocabPattern.placeholder = "f.eks. for";
    vocabHelp.textContent = "Prefiks-modus: finner ord som starter med mønsteret.";
    return;
  }
  vocabPattern.placeholder = "f.eks. leg";
  vocabHelp.textContent = "Inneholder-modus: finner ord som inneholder mønsteret.";
}

function runVocabSearch(): void {
  if (!vocabIndex.length) {
    vocabStatus.textContent = "Ordindeks mangler.";
    lastVocabRows = [];
    vocabResults.innerHTML = "";
    vocabCloud.innerHTML = "";
    return;
  }
  const pattern = vocabPattern.value.trim();
  const mode = vocabMode.value;
  const minFreq = Math.max(1, Number.parseInt(vocabMinFreq.value, 10) || 1);
  const maxRows = Math.max(10, Number.parseInt(vocabMaxRows.value, 10) || 200);

  if (!pattern) {
    vocabStatus.textContent = "Skriv inn et mønster.";
    lastVocabRows = [];
    vocabResults.innerHTML = "";
    vocabCloud.innerHTML = "";
    return;
  }

  let matcher;
  try {
    matcher = createMatcher(mode, pattern);
  } catch (error) {
    vocabStatus.textContent = `Ugyldig mønster: ${toError(error)}`;
    lastVocabRows = [];
    vocabResults.innerHTML = "";
    vocabCloud.innerHTML = "";
    return;
  }

  const selectedRows = getSelectedCorpusRows();
  const selectedSet = new Set(selectedRows.map((row) => row.dhlabid));
  const filtered = [];

  for (const entry of vocabIndex) {
    if (!matcher(entry)) continue;
    let total = 0;
    let docs = 0;
    for (const [docId, freq] of Object.entries(entry.byDoc || {})) {
      if (!selectedSet.has(docId)) continue;
      total += Number(freq || 0);
      docs += 1;
    }
    if (total < minFreq) continue;
    filtered.push({
      word: entry.word,
      totalFreq: total,
      docFreq: docs
    });
  }

  filtered.sort((a, b) => b.totalFreq - a.totalFreq || a.word.localeCompare(b.word, "nb"));
  const rows = filtered.slice(0, maxRows);
  vocabStatus.textContent =
    `Fant ${filtered.length} ord (viser ${rows.length}) i ${selectedRows.length} valgte dokument i ${getActiveCorpusConfig().label.toLowerCase()}.`;

  if (!rows.length) {
    lastVocabRows = [];
    vocabResults.innerHTML = "<div class='muted'>Ingen treff i ordindeks.</div>";
    vocabCloud.innerHTML = "";
    return;
  }

  lastVocabRows = rows;
  renderVocabOutput(rows);
}

function renderVocabOutput(rows: VocabSearchRow[]): void {
  if (!rows.length) {
    vocabResults.innerHTML = "";
    vocabCloud.innerHTML = "";
    return;
  }

  const view = vocabView.value;
  if (view === "cloud") {
    vocabResults.innerHTML = "";
    renderVocabCloud(rows);
    return;
  }

  renderVocabTable(rows);
  vocabCloud.innerHTML = "";
}

function renderVocabTable(rows: VocabSearchRow[]): void {
  const body = rows
    .map((row) => `<tr><td>${escapeHtml(row.word)}</td><td>${row.totalFreq}</td><td>${row.docFreq}</td></tr>`)
    .join("");
  vocabResults.innerHTML = `
    <table>
      <thead>
        <tr><th>Ord</th><th>Total frekvens</th><th>Dokumenter</th></tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

function createMatcher(mode: string, pattern: string): (entry: VocabEntry) => boolean {
  if (mode === "prefix") {
    const needle = pattern.toLowerCase();
    return (entry) => entry.word.toLowerCase().startsWith(needle);
  }
  if (mode === "suffix") {
    const needle = pattern.toLowerCase();
    const reversedNeedle = reverse(needle);
    return (entry) => entry.reversed.toLowerCase().startsWith(reversedNeedle);
  }
  if (mode === "contains") {
    const needle = pattern.toLowerCase();
    return (entry) => entry.word.toLowerCase().includes(needle);
  }
  if (mode === "glob") {
    const regex = globToRegex(pattern);
    return (entry) => regex.test(entry.word);
  }
  if (mode === "regex") {
    const regex = new RegExp(pattern, "i");
    return (entry) => regex.test(entry.word);
  }
  throw new Error(`Ukjent modus: ${mode}`);
}

function globToRegex(globPattern: string): RegExp {
  const escaped = globPattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`, "i");
}

function renderVocabCloud(rows: VocabSearchRow[]): void {
  const cloudRows = rows.slice(0, 120);
  if (!cloudRows.length) {
    vocabCloud.innerHTML = "";
    return;
  }

  const freqs = cloudRows.map((row) => row.totalFreq);
  const minFreq = Math.min(...freqs);
  const maxFreq = Math.max(...freqs);
  const spread = Math.max(1, maxFreq - minFreq);
  const width = Math.max(460, Math.min(980, appRoot.clientWidth - 40));
  const height = Math.max(340, Math.round(width * 0.5));
  const token = ++vocabCloudRenderToken;

  const words: VocabCloudWord[] = cloudRows.map((row) => {
    const ratio = (row.totalFreq - minFreq) / spread;
    return {
      text: row.word,
      size: Math.round(12 + ratio * 34),
      totalFreq: row.totalFreq,
      docFreq: row.docFreq
    };
  });

  vocabCloud.innerHTML = `
    <h3>Ordsky</h3>
    <div class="word-cloud"><div class="muted">Tegner ordsky ...</div></div>
  `;

  const cloudLayout = cloudFactory<VocabCloudWord>()
    .size([width, height])
    .words(words)
    .padding(2)
    .rotate(() => (Math.random() < 0.18 ? 90 : 0))
    .font("Inter, system-ui, sans-serif")
    .fontSize((word) => word.size)
    .random(() => Math.random())
    .on("end", (placedWords) => {
      if (token !== vocabCloudRenderToken) return;
      const svgWords = placedWords.filter((word) => typeof word.x === "number" && typeof word.y === "number");
      const svgMarkup = svgWords
        .map((word, index) => {
          const ratio = (word.totalFreq - minFreq) / spread;
          const alpha = 0.5 + ratio * 0.5;
          const hue = 200 + ((index * 23) % 70);
          return `<text x="${word.x}" y="${word.y}" transform="rotate(${word.rotate || 0},${word.x},${word.y})" style="font-size:${word.size}px;opacity:${alpha};fill:hsl(${hue} 70% 28%);" title="frekvens: ${word.totalFreq}, dokumenter: ${word.docFreq}">${escapeHtml(word.text)}</text>`;
        })
        .join("");

      vocabCloud.innerHTML = `
        <h3>Ordsky</h3>
        <div class="word-cloud">
          <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Ordsky fra indekssøk">
            <rect x="0" y="0" width="${width}" height="${height}" fill="transparent"></rect>
            <g transform="translate(${Math.round(width / 2)} ${Math.round(height / 2)})">
              ${svgMarkup}
            </g>
          </svg>
        </div>
      `;
    });

  cloudLayout.start();
}

function parseWords(raw: string): string[] {
  return raw
    .split(/[\n,;]+/g)
    .map((w) => w.trim())
    .filter(Boolean);
}

function must<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Mangler element: ${selector}`);
  return element;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function toError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function reverse(word: string): string {
  return Array.from(word).reverse().join("");
}
