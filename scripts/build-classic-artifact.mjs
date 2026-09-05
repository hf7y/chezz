// hf7y/chezz#89: "one engine source; a fix to it changes both artifacts."
//
// Classic and narrative used to be two independently hand-edited files on
// separate branches -- which is exactly how classic fell behind narrative's
// own bugfixes (the King-safety refactor, deterministic search, tuning),
// per research/engine/2026-09-05-classic-core-vs-narrative-extend.md. That
// research measured, function by function, which of narrative's code is
// pure board/move/search computation (CORE) vs. presentation or narrative
// feature (terrain, drag-step, campaign, death/respawn, leaderboard/chat)
// that has no business in classic.
//
// This script does NOT touch index1.html (narrative). It reads narrative's
// current CORE functions/consts and splices them into classic's own shell
// (still fetched from the chezz-classic branch, which owns everything
// classic actually differs on: HTML/CSS, the Apps Script leaderboard,
// promotion UI, click/drag handling, stalemate-reset). A future engine fix
// in index1.html therefore reaches classic's next build automatically --
// no manual port, no divergence to notice months later.
//
// Scope is deliberately narrow: CORE_SWAP/CORE_ADD is exactly the set the
// research measured as byte-identical-or-improved pure computation. Terrain
// and drag-step are NOT in this set -- porting them to classic is real,
// separate future work (the research's own recommendation), not implied by
// this mechanism.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// Verbatim from narrative -- replaces classic's same-named definition.
const CORE_SWAP = [
  "legalMovesForPiece", "kingSafeAfterMove", "isLegalMove", "legalMovesFrom",
  "attackersOf", "findWhiteKing", "moveDangerLevel", "hasAnyLegalMove",
  "whiteSurvivesNextMove", "spendFromPool", "autoPromote", "applyMove",
  "getBlackMoveRuthless", "spawnBlackArmy", "checkFloorProgression",
];
// Not present in classic today -- added verbatim from narrative because a
// CORE_SWAP entry above now depends on them (isEnemy/isFriendly's inert
// terrain check, spawnBlackArmy's now-hoisted isSafeSquare/isDefendedSquare
// and its armyCost helper, evaluateBoard's now-hoisted pieceValues).
const CORE_ADD = [
  "TERRAIN_WALL", "TERRAIN_HOLE", "isTerrain",
  "isSafeSquare", "isDefendedSquare", "pieceValues", "armyCost",
];

function run(cmd, args) {
  return execFileSync(cmd, args, { cwd: root, encoding: "utf8" });
}

function splitScript(html) {
  const open = html.indexOf("<script>");
  const close = html.indexOf("</script>", open);
  if (open === -1 || close === -1) throw new Error("could not find <script>...</script>");
  const scriptStart = open + "<script>".length;
  return {
    head: html.slice(0, scriptStart),
    body: html.slice(scriptStart, close),
    tail: html.slice(close),
  };
}

// Every function/const this file cares about is declared at exactly 2-space
// indent, in both files, consistently -- confirmed by hand against both
// sources before writing this. A top-level entry runs from its declaration
// line to the line before the next one (or end of script for the last).
function parseTopLevel(body) {
  const lines = body.split("\n");
  const declRe = /^  (?:function\s+([A-Za-z_$][\w$]*)|const\s+([A-Za-z_$][\w$]*)\s*=)/;
  const starts = [];
  lines.forEach((line, i) => {
    const m = line.match(declRe);
    if (m) starts.push({ name: m[1] || m[2], line: i });
  });
  const byName = new Map();
  const order = [];
  starts.forEach((s, i) => {
    const endLine = i + 1 < starts.length ? starts[i + 1].line : lines.length;
    const text = lines.slice(s.line, endLine).join("\n");
    if (byName.has(s.name)) throw new Error(`duplicate top-level name "${s.name}" in source`);
    byName.set(s.name, text);
    order.push(s.name);
  });
  return { byName, order, preamble: lines.slice(0, starts[0]?.line ?? lines.length).join("\n") };
}

function cutBetween(text, startNeedle, endNeedle, label) {
  const startIdx = text.indexOf(startNeedle);
  if (startIdx === -1) throw new Error(`${label}: start marker not found -- narrative's shape changed, re-check this transform`);
  const endIdx = text.indexOf(endNeedle, startIdx);
  if (endIdx === -1) throw new Error(`${label}: end marker not found -- narrative's shape changed, re-check this transform`);
  return text.slice(0, startIdx) + text.slice(endIdx);
}

function mustReplace(text, needle, replacement, label) {
  if (!text.includes(needle)) throw new Error(`${label}: expected text not found -- narrative's shape changed, re-check this transform`);
  return text.replace(needle, replacement);
}

function transformSpecialCases(narrative) {
  const out = new Map(narrative.byName);

  // spawnBlackArmy needs three edits, found by diffing it whole against
  // classic's current version rather than guessing:
  //  1. drop the scripted-campaign branch -- NARRATIVE_STAGES/
  //     placeScriptedStage don't exist in classic and never should (no
  //     campaign there, per hf7y/chezz#95).
  //  2. drop the death-gate call -- placeDeathGate is narrative's roguelike
  //     death feature, undefined in classic (would throw ReferenceError).
  //  3. keep classic's own `floorStart = boardToFen()` checkpoint --
  //     narrative dropped it because narrative's stalemate handling is the
  //     death/respawn system instead, but classic's own checkStalemate
  //     (untouched, classic-only) still reads floorStart.
  let spawn = out.get("spawnBlackArmy");
  spawn = cutBetween(
    spawn,
    "    // A run that has died once (hf7y/chezz#4) skips the scripted campaign",
    "    const baseline = state.board.map(row => [...row]);",
    "spawnBlackArmy -> campaign branch"
  );
  const spawnEnd = "    state.spawned = true;\n    floorJustSpawned = true;\n  }";
  const deathGateLine = "    if (state.diedOnce) placeDeathGate();\n" + spawnEnd;
  if (!spawn.includes(deathGateLine)) throw new Error("spawnBlackArmy -> death gate / floorStart: expected text not found -- narrative's shape changed, re-check this transform");
  const newSpawnEnd = "    state.spawned = true;\n    floorJustSpawned = true;\n    floorStart = boardToFen();\n  }";
  // Everything after spawnBlackArmy's OWN closing brace is capturedBankValue/
  // placeDeathGate/etc.'s leading doc-comments (narrative-only functions
  // this build never includes) -- truncate there instead of dragging them
  // in front of whatever classic entry comes next.
  spawn = spawn.slice(0, spawn.indexOf(deathGateLine)) + newSpawnEnd + "\n";
  out.set("spawnBlackArmy", spawn);

  // checkFloorProgression: drop the earcon call -- classic has no audio
  // pipeline.
  const cfp = mustReplace(out.get("checkFloorProgression"), '    playEarcon("floorClear");\n', "", "checkFloorProgression -> playEarcon");
  out.set("checkFloorProgression", cfp);

  return out;
}

export function buildClassicArtifact({ narrativeHtml, classicHtml }) {
  const narrativeSplit = splitScript(narrativeHtml);
  const classicSplit = splitScript(classicHtml);

  const narrative = parseTopLevel(narrativeSplit.body);
  const classic = parseTopLevel(classicSplit.body);

  for (const name of [...CORE_SWAP, ...CORE_ADD]) {
    if (!narrative.byName.has(name)) throw new Error(`narrative no longer defines "${name}" -- update CORE_SWAP/CORE_ADD`);
  }
  for (const name of CORE_SWAP) {
    if (!classic.byName.has(name)) throw new Error(`classic no longer defines "${name}" -- it may have been renamed or removed`);
  }
  for (const name of CORE_ADD) {
    if (classic.byName.has(name)) throw new Error(`classic already defines "${name}" -- CORE_ADD is stale, this should be a CORE_SWAP now`);
  }

  const narrativeCore = transformSpecialCases(narrative);

  const addBlock = CORE_ADD.map((name) => narrativeCore.get(name)).join("\n");
  const outEntries = [];
  let addInserted = false;
  for (const name of classic.order) {
    if (!addInserted) {
      outEntries.push(addBlock);
      addInserted = true;
    }
    outEntries.push(CORE_SWAP.includes(name) ? narrativeCore.get(name) : classic.byName.get(name));
  }

  const newBody = classic.preamble + "\n" + outEntries.join("\n");
  return classicSplit.head + newBody + classicSplit.tail;
}

const CLASSIC_BRANCH = process.env.CLASSIC_BRANCH || "chezz-classic";

export function fetchClassicSource() {
  run("git", ["fetch", "--depth=1", "origin", `+refs/heads/${CLASSIC_BRANCH}:refs/remotes/origin/${CLASSIC_BRANCH}`]);
  return run("git", ["show", `origin/${CLASSIC_BRANCH}:index1.html`]);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { readFileSync } = await import("node:fs");
  const narrativeHtml = readFileSync(path.join(root, "index1.html"), "utf8");
  const classicHtml = fetchClassicSource();
  const artifact = buildClassicArtifact({ narrativeHtml, classicHtml });
  process.stdout.write(artifact);
}
