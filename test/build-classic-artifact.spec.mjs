// Covers build-classic-artifact.mjs's CORE_SWAP/CORE_ADD splicing (#89), and
// pins the #104 regression: a stale CORE_ADD threw on every fresh build.
import { test, expect } from "@playwright/test";
import { buildClassicArtifact, CORE_SWAP, CORE_ADD } from "../scripts/build-classic-artifact.mjs";

function html(scriptBody) {
  return `<html><body><script>\n${scriptBody}</script></body></html>`;
}

function stubs(names, overrides = {}) {
  return names.map((name) => `  const ${name} = "${overrides[name] ?? `stub:${name}`}";\n`).join("");
}

function narrativeStubs(names, overrides = {}) {
  return names.map((name) => {
    if (name === "spawnBlackArmy") {
      return (
        "  function spawnBlackArmy() {\n" +
        "    // A run that has died once (hf7y/chezz#4) skips the scripted campaign\n" +
        "    const baseline = state.board.map(row => [...row]);\n" +
        "    // Neutral evasive piece (DESIGN-NOTES.md 2026-07-20 seed list, spec'd in\n" +
        "    if (!hasNeutralPiece(state.board)) spawnNeutralPiece(rng);\n" +
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
    narrativeStubs(CORE_SWAP, { legalMovesForPiece: "from-narrative" }) +
    narrativeStubs(CORE_ADD)
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
  const narrativeHtml = html(narrativeStubs(CORE_SWAP) + narrativeStubs(CORE_ADD));
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

test("a CORE_ADD name already defined in classic throws rather than duplicating it", () => {
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
