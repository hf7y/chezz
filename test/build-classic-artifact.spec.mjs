/* Covers scripts/build-classic-artifact.mjs's CORE_SWAP/CORE_ADD splicing --
 * the mechanism hf7y/chezz#89 introduced so a narrative engine fix reaches
 * classic without a manual port.
 *
 * Regression for a real bug: CORE_ADD assumed its names were NOT YET defined
 * in classic. Once #104 one-time-ported them into classic's own shell, every
 * check-size run started throwing ("classic already defines ...") because
 * the list was never moved to CORE_SWAP -- caught 2026-09-05 running
 * check-size fresh against current main, not by any test, since nothing
 * exercised this module directly.
 *
 * Fixtures are built from the module's REAL CORE_SWAP/CORE_ADD lists (every
 * entry needs a stub, or the module's own "narrative/classic no longer
 * defines" guards fire before the behavior under test runs), with specific
 * entries overridden per test.
 */
import { test, expect } from "@playwright/test";
import { buildClassicArtifact, CORE_SWAP, CORE_ADD } from "../scripts/build-classic-artifact.mjs";

function html(scriptBody) {
  return `<html><body><script>\n${scriptBody}</script></body></html>`;
}

// Every name as `const NAME = "value";` -- satisfies the module's top-level
// parser (function-or-const) regardless of whether the real definition is a
// function, since the parser only cares about the declaration line's shape.
function stubs(names, overrides = {}) {
  return names.map((name) => `  const ${name} = "${overrides[name] ?? `stub:${name}`}";\n`).join("");
}

// transformSpecialCases operates on NARRATIVE's copy of these two names only
// (classic's copy of both is fully replaced, so its content is irrelevant)
// and requires exact needles -- generic stubs() output doesn't contain them.
function narrativeStubs(names, overrides = {}) {
  return names.map((name) => {
    if (name === "spawnBlackArmy") {
      return (
        "  function spawnBlackArmy() {\n" +
        "    // A run that has died once (hf7y/chezz#4) skips the scripted campaign\n" +
        "    const baseline = state.board.map(row => [...row]);\n" +
        "    if (state.diedOnce) placeDeathGate();\n" +
        "    state.spawned = true;\n" +
        "    floorJustSpawned = true;\n" +
        "  }\n"
      );
    }
    if (name === "checkFloorProgression") {
      return (
        "  function checkFloorProgression() {\n" +
        '    playEarcon("floorClear");\n' +
        "  }\n"
      );
    }
    return `  const ${name} = "${overrides[name] ?? `stub:${name}`}";\n`;
  }).join("");
}

test("a CORE_SWAP name keeps classic's position but takes narrative's value", () => {
  const narrativeHtml = html(
    "  const classicOnly = \"unused\";\n" +
    narrativeStubs(CORE_SWAP, { legalMovesForPiece: "from-narrative" })
  );
  const classicHtml = html(
    "  const classicOnly = \"c1\";\n" +
    stubs(CORE_SWAP, { legalMovesForPiece: "from-classic" })
  );
  const out = buildClassicArtifact({ narrativeHtml, classicHtml });
  const classicOnlyIdx = out.indexOf("classicOnly");
  const swappedIdx = out.indexOf("legalMovesForPiece");
  expect(classicOnlyIdx).toBeGreaterThan(-1);
  expect(swappedIdx).toBeGreaterThan(classicOnlyIdx);
  expect(out).toContain("from-narrative");
  expect(out).not.toContain("from-classic");
});

test("throws if classic no longer defines a CORE_SWAP name (renamed or removed)", () => {
  const narrativeHtml = html(narrativeStubs(CORE_SWAP));
  const classicHtml = html(stubs(CORE_SWAP.filter((n) => n !== "legalMovesForPiece")));
  expect(() => buildClassicArtifact({ narrativeHtml, classicHtml })).toThrow(
    /classic no longer defines "legalMovesForPiece"/
  );
});

test("throws if narrative no longer defines a CORE_SWAP name", () => {
  const narrativeHtml = html(narrativeStubs(CORE_SWAP.filter((n) => n !== "legalMovesForPiece")));
  const classicHtml = html(stubs(CORE_SWAP));
  expect(() => buildClassicArtifact({ narrativeHtml, classicHtml })).toThrow(
    /narrative no longer defines "legalMovesForPiece"/
  );
});

test("a CORE_ADD name already defined in classic throws rather than duplicating it -- the #104 regression", () => {
  // Recreates the exact pre-fix shape: a name still listed in CORE_ADD (here
  // simulated via isTerrain, which really did move out of CORE_ADD once
  // classic gained its own copy) that classic's fixture already defines.
  if (CORE_ADD.length === 0) {
    test.skip(true, "CORE_ADD is empty today -- nothing to simulate a duplicate against");
  }
  const staleAddName = CORE_ADD[0];
  const narrativeHtml = html(narrativeStubs(CORE_SWAP) + narrativeStubs(CORE_ADD));
  const classicHtml = html(stubs(CORE_SWAP) + `  const ${staleAddName} = "already-in-classic";\n`);
  expect(() => buildClassicArtifact({ narrativeHtml, classicHtml })).toThrow(
    new RegExp(`classic already defines "${staleAddName}" -- CORE_ADD is stale`)
  );
});

test("CORE_ADD and CORE_SWAP never name the same thing twice", () => {
  const overlap = CORE_ADD.filter((name) => CORE_SWAP.includes(name));
  expect(overlap).toEqual([]);
});
