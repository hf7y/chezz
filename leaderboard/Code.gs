// Chezz leaderboard + bug-report backend -- bind this to the
// "Chezz_Leaderboard" Google Sheet (Extensions > Apps Script, paste this in,
// replacing the boilerplate) then Deploy > New deployment > type "Web app" >
// Execute as "Me" > Who has access "Anyone" > Deploy. The resulting /exec
// URL is the one endpoint the game (or anything else) calls for submitting
// scores, submitting bug reports, and reading the leaderboard.
//
// Submit a score:
//   fetch(WEB_APP_URL, {
//     method: "POST",
//     headers: { "Content-Type": "text/plain" }, // avoids a CORS preflight
//     body: JSON.stringify({ type: "score", name, floor, rank, dateKey, history }),
//   });
//   `history` is optional and unused today -- reserved for a future replay
//   log (move list / FEN sequence) so a suspicious high score can be
//   audited later. Send it as any JSON-serializable value, or omit it.
//
// Submit a bug report (lands on its own "BugReports" tab in the same sheet).
// New reports always start life with status "open". `kind` ("bug" or
// "feature") keeps defects and ideas apart from the moment they're filed,
// rather than leaving triage to guess intent from free text later --
// defaults to "bug" if omitted:
//   fetch(WEB_APP_URL, {
//     method: "POST",
//     headers: { "Content-Type": "text/plain" },
//     body: JSON.stringify({ type: "bug", kind, name, url, description }),
//   });
//
// Mark a bug report resolved (reopen it, or reclassify its kind) once it's
// been worked on, so the next read doesn't re-surface something already
// handled. Matched by its exact timestamp string, as returned by scope=bugs
// below:
//   fetch(WEB_APP_URL, {
//     method: "POST",
//     headers: { "Content-Type": "text/plain" },
//     body: JSON.stringify({ type: "resolve", timestamp, status, note, reportType }),
//   });
//   `status` defaults to "resolved" if omitted -- pass "open" instead to
//   reopen it. `note` is optional free text, e.g. a commit hash or one-line
//   summary of what was done. `reportType` is optional -- pass "feature" to
//   reclassify a report filed as a bug (or vice versa) once triage reveals
//   its actual kind; a feature idea shouldn't sit in the bug queue under
//   status "open" waiting on a decision nobody's obligated to make.
//
// Read the leaderboard:
//   fetch(WEB_APP_URL + "?scope=today&dateKey=" + todayKey())  -- today's board
//   fetch(WEB_APP_URL + "?scope=all")                          -- all-time board
//   Both accept &limit=N (default 20). Response is a JSON array, highest
//   rank first: [{ timestamp, dateKey, name, floor, rank }, ...]
//   (history is intentionally not included in read results, to keep the
//   leaderboard payload small -- look it up in the sheet directly if needed.)
//
// Read bug reports (newest first):
//   fetch(WEB_APP_URL + "?scope=bugs")  -- accepts &limit=N (default 20),
//   &status=open|resolved|all (default "open" -- the whole point of
//   tracking status is that a routine sweep shouldn't have to re-read
//   reports already dealt with; pass status=all to see everything), and
//   &type=bug|feature|all (default "bug" -- a routine bug sweep should see
//   defects to fix, not the feature backlog; pass type=feature to read
//   ideas instead, or type=all for everything regardless of kind).
//
// Record a sweep run (every /bug-sweep run posts this once, at the end,
// even when it fixed nothing -- the game UI reads it back to show "last
// swept" proof of life). A single overwritten record, not an appended row:
// nothing ever needs sweep *history*, just the latest one, so this lives in
// Script Properties instead of growing its own sheet:
//   fetch(WEB_APP_URL, {
//     method: "POST",
//     headers: { "Content-Type": "text/plain" },
//     body: JSON.stringify({ type: "sweep-status", fetched, fixed, reclassified, leftOpen }),
//   });
//   `timestamp` is stamped server-side (not client-supplied) so it can't
//   drift from whatever clock the sweep runner happens to have.
//
// Read the last sweep status:
//   fetch(WEB_APP_URL + "?scope=sweep-status")
//   Response: { timestamp, fetched, fixed, reclassified, leftOpen } or
//   null if no sweep has ever reported in.
//   Response: [{ timestamp, name, url, description, status, note, type }, ...]

const SCORES_SHEET_NAME = "Scores";
const SCORES_HEADERS = ["timestamp", "dateKey", "name", "floor", "rank", "history"];
const BUGS_SHEET_NAME = "BugReports";
// `type` appended at the end (not inserted between existing columns) so
// rows written before this column existed keep every other value at its
// original index -- getBugReports_ treats a blank type as DEFAULT_BUG_TYPE,
// the same backward-compat trick already used for status/note below.
const BUGS_HEADERS = ["timestamp", "name", "url", "description", "status", "note", "type"];
const DEFAULT_BUG_STATUS = "open";
const DEFAULT_BUG_TYPE = "bug";
const MAX_NAME_LENGTH = 40;
const MAX_TEXT_LENGTH = 2000; // bug report url/description/note
const DEFAULT_LIMIT = 20;
const SWEEP_STATUS_KEY = "sweepStatus";

function getOrCreateSheet_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);
  return sheet;
}

// BugReports predates the status/note columns, and later the type column --
// for a sheet created before either change, the header row is missing them
// (existing rows are untouched; getBugReports_ treats a blank status/type as
// DEFAULT_BUG_STATUS/DEFAULT_BUG_TYPE). Backfilling just the header cells
// here means a sheet that already has data never needs a manual migration
// to start using a newly added column going forward.
function getBugsSheet_() {
  const sheet = getOrCreateSheet_(BUGS_SHEET_NAME, BUGS_HEADERS);
  const headerRow = sheet.getRange(1, 1, 1, BUGS_HEADERS.length);
  const headers = headerRow.getValues()[0];
  BUGS_HEADERS.forEach((h, i) => { if (headers[i] !== h) sheet.getRange(1, i + 1).setValue(h); });
  return sheet;
}

function getScoresSheet_() {
  const sheet = getOrCreateSheet_(SCORES_SHEET_NAME, SCORES_HEADERS);
  // Google Sheets auto-detects date-like text (e.g. a bare "7-13") and
  // silently converts it to a real date cell, which then never string-
  // matches the same value again in doGet's "today" filter. Force the
  // whole dateKey column to plain text so a write can never be coerced,
  // regardless of what format the client happens to send.
  const dateKeyCol = SCORES_HEADERS.indexOf("dateKey") + 1;
  sheet.getRange(2, dateKeyCol, Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat("@");
  return sheet;
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  if (body.type === "bug") return submitBugReport_(body);
  if (body.type === "resolve") return resolveBugReport_(body);
  if (body.type === "sweep-status") return recordSweepStatus_(body);
  return submitScore_(body);
}

function submitScore_(body) {
  const sheet = getScoresSheet_();
  const name = String(body.name || "anonymous").slice(0, MAX_NAME_LENGTH);
  const floor = Number(body.floor) || 0;
  const rank = Number(body.rank) || 0;
  const dateKey = String(body.dateKey || "");
  const history = body.history !== undefined ? JSON.stringify(body.history) : "";

  sheet.appendRow([new Date(), dateKey, name, floor, rank, history]);

  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function submitBugReport_(body) {
  const sheet = getBugsSheet_();
  const name = String(body.name || "anonymous").slice(0, MAX_NAME_LENGTH);
  const url = String(body.url || "").slice(0, MAX_TEXT_LENGTH);
  const description = String(body.description || "").slice(0, MAX_TEXT_LENGTH);
  const kind = body.kind === "feature" ? "feature" : DEFAULT_BUG_TYPE;

  sheet.appendRow([new Date(), name, url, description, DEFAULT_BUG_STATUS, "", kind]);

  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function recordSweepStatus_(body) {
  const status = {
    timestamp: new Date().toISOString(),
    fetched: Number(body.fetched) || 0,
    fixed: Number(body.fixed) || 0,
    reclassified: Number(body.reclassified) || 0,
    leftOpen: Number(body.leftOpen) || 0,
  };
  PropertiesService.getScriptProperties().setProperty(SWEEP_STATUS_KEY, JSON.stringify(status));

  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSweepStatus_() {
  const raw = PropertiesService.getScriptProperties().getProperty(SWEEP_STATUS_KEY);
  return ContentService.createTextOutput(raw || "null")
    .setMimeType(ContentService.MimeType.JSON);
}

// Timestamp is the row's natural key: it's already unique per report (the
// sheet's own timestamp column, ms-precision, exactly what scope=bugs hands
// back), so there's no separate id column to keep in sync. Scans rather
// than indexes it -- BugReports is small enough that this is unlikely to
// ever matter.
function resolveBugReport_(body) {
  const sheet = getBugsSheet_();
  const rows = sheet.getDataRange().getValues();
  const header = rows[0];
  const timestampCol = header.indexOf("timestamp");
  const statusCol = header.indexOf("status");
  const noteCol = header.indexOf("note");
  const typeCol = header.indexOf("type");
  const target = String(body.timestamp || "");

  for (let i = 1; i < rows.length; i++) {
    const cell = rows[i][timestampCol];
    const rowTimestamp = cell instanceof Date ? cell.toISOString() : String(cell);
    if (rowTimestamp !== target) continue;

    sheet.getRange(i + 1, statusCol + 1).setValue(String(body.status || "resolved"));
    if (body.note !== undefined) sheet.getRange(i + 1, noteCol + 1).setValue(String(body.note).slice(0, MAX_TEXT_LENGTH));
    if (body.reportType !== undefined) sheet.getRange(i + 1, typeCol + 1).setValue(String(body.reportType));
    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "no bug report with that timestamp" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const scope = (e.parameter.scope || "all");
  const limit = Number(e.parameter.limit) || DEFAULT_LIMIT;

  if (scope === "bugs") return getBugReports_(limit, e.parameter.status || DEFAULT_BUG_STATUS, e.parameter.type || DEFAULT_BUG_TYPE);
  if (scope === "sweep-status") return getSweepStatus_();

  const sheet = getScoresSheet_();
  const rows = sheet.getDataRange().getValues();
  const [header, ...data] = rows;
  const col = name => header.indexOf(name);

  let entries = data.map(r => ({
    timestamp: r[col("timestamp")],
    dateKey: r[col("dateKey")],
    name: r[col("name")],
    floor: r[col("floor")],
    rank: r[col("rank")],
  }));

  if (scope === "today") {
    const dateKey = e.parameter.dateKey || "";
    entries = entries.filter(x => x.dateKey === dateKey);
  }

  entries.sort((a, b) => b.rank - a.rank);
  const top = entries.slice(0, limit);

  return ContentService.createTextOutput(JSON.stringify(top))
    .setMimeType(ContentService.MimeType.JSON);
}

function getBugReports_(limit, statusFilter, typeFilter) {
  const sheet = getBugsSheet_();
  const rows = sheet.getDataRange().getValues();
  const [header, ...data] = rows;
  const col = name => header.indexOf(name);

  let entries = data.map(r => ({
    timestamp: r[col("timestamp")],
    name: r[col("name")],
    url: r[col("url")],
    description: r[col("description")],
    status: r[col("status")] || DEFAULT_BUG_STATUS,
    note: r[col("note")] || "",
    type: r[col("type")] || DEFAULT_BUG_TYPE,
  }));
  if (statusFilter && statusFilter !== "all") entries = entries.filter(x => x.status === statusFilter);
  if (typeFilter && typeFilter !== "all") entries = entries.filter(x => x.type === typeFilter);
  entries.reverse(); // newest first
  const top = entries.slice(0, limit);

  return ContentService.createTextOutput(JSON.stringify(top))
    .setMimeType(ContentService.MimeType.JSON);
}
