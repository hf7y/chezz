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
// Submit a bug report (lands on its own "BugReports" tab in the same sheet):
//   fetch(WEB_APP_URL, {
//     method: "POST",
//     headers: { "Content-Type": "text/plain" },
//     body: JSON.stringify({ type: "bug", name, url, description }),
//   });
//
// Read the leaderboard (scores only -- bug reports aren't exposed here):
//   fetch(WEB_APP_URL + "?scope=today&dateKey=" + todayKey())  -- today's board
//   fetch(WEB_APP_URL + "?scope=all")                          -- all-time board
//   Both accept &limit=N (default 20). Response is a JSON array, highest
//   rank first: [{ timestamp, dateKey, name, floor, rank }, ...]
//   (history is intentionally not included in read results, to keep the
//   leaderboard payload small -- look it up in the sheet directly if needed.)

const SCORES_SHEET_NAME = "Scores";
const SCORES_HEADERS = ["timestamp", "dateKey", "name", "floor", "rank", "history"];
const BUGS_SHEET_NAME = "BugReports";
const BUGS_HEADERS = ["timestamp", "name", "url", "description"];
const MAX_NAME_LENGTH = 40;
const MAX_TEXT_LENGTH = 2000; // bug report url/description
const DEFAULT_LIMIT = 20;

function getOrCreateSheet_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);
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
  const sheet = getOrCreateSheet_(BUGS_SHEET_NAME, BUGS_HEADERS);
  const name = String(body.name || "anonymous").slice(0, MAX_NAME_LENGTH);
  const url = String(body.url || "").slice(0, MAX_TEXT_LENGTH);
  const description = String(body.description || "").slice(0, MAX_TEXT_LENGTH);

  sheet.appendRow([new Date(), name, url, description]);

  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
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

  const scope = (e.parameter.scope || "all");
  if (scope === "today") {
    const dateKey = e.parameter.dateKey || "";
    entries = entries.filter(x => x.dateKey === dateKey);
  }

  entries.sort((a, b) => b.rank - a.rank);
  const limit = Number(e.parameter.limit) || DEFAULT_LIMIT;
  const top = entries.slice(0, limit);

  return ContentService.createTextOutput(JSON.stringify(top))
    .setMimeType(ContentService.MimeType.JSON);
}
