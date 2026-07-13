// Chezz leaderboard backend -- bind this to the "Chezz_Leaderboard" Google
// Sheet (Extensions > Apps Script, paste this in, replacing the boilerplate)
// then Deploy > New deployment > type "Web app" > Execute as "Me" > Who has
// access "Anyone" > Deploy. The resulting /exec URL is the one endpoint the
// game (or anything else) calls for both submitting and reading scores.
//
// Submit a score:
//   fetch(WEB_APP_URL, {
//     method: "POST",
//     headers: { "Content-Type": "text/plain" }, // avoids a CORS preflight
//     body: JSON.stringify({ name, floor, rank, dateKey, history }),
//   });
//   `history` is optional and unused today -- reserved for a future replay
//   log (move list / FEN sequence) so a suspicious high score can be
//   audited later. Send it as any JSON-serializable value, or omit it.
//
// Read the leaderboard:
//   fetch(WEB_APP_URL + "?scope=today&dateKey=" + todayKey())  -- today's board
//   fetch(WEB_APP_URL + "?scope=all")                          -- all-time board
//   Both accept &limit=N (default 20). Response is a JSON array, highest
//   rank first: [{ timestamp, dateKey, name, floor, rank }, ...]
//   (history is intentionally not included in read results, to keep the
//   leaderboard payload small -- look it up in the sheet directly if needed.)

const SHEET_NAME = "Scores";
const HEADERS = ["timestamp", "dateKey", "name", "floor", "rank", "history"];
const MAX_NAME_LENGTH = 40;
const DEFAULT_LIMIT = 20;

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
  return sheet;
}

function doPost(e) {
  const sheet = getSheet_();
  const body = JSON.parse(e.postData.contents);

  const name = String(body.name || "anonymous").slice(0, MAX_NAME_LENGTH);
  const floor = Number(body.floor) || 0;
  const rank = Number(body.rank) || 0;
  const dateKey = String(body.dateKey || "");
  const history = body.history !== undefined ? JSON.stringify(body.history) : "";

  sheet.appendRow([new Date(), dateKey, name, floor, rank, history]);

  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const sheet = getSheet_();
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
