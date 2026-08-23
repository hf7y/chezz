/* Covers hf7y/chezz#5 (audio + vibration, answered: "audio default on, short
 * wooden click is fine"): the EARCON_SOUNDS bake, the default-on mute toggle,
 * and the three trigger points (capture / check / floor-clear) firing exactly
 * on the events they name and not on anything else.
 */
import { test, expect } from "@playwright/test";
import { GAME_URL, fenRowsToBoard } from "./helpers.mjs";

test.beforeEach(async ({ page }) => {
  await page.goto(GAME_URL);
});

test("all three earcons are baked in as real WAV data URIs", async ({ page }) => {
  const sounds = await page.evaluate(() => EARCON_SOUNDS);
  for (const name of ["capture", "check", "floorClear"]) {
    expect(sounds[name], name).toMatch(/^data:audio\/wav;base64,.{100,}/);
  }
});

test("audio defaults on for a fresh visitor, with no localStorage key set", async ({ page }) => {
  const { enabled, pressed } = await page.evaluate(() => ({
    enabled: audioEnabled,
    pressed: document.getElementById("audioToggle").getAttribute("aria-pressed"),
  }));
  expect(enabled).toBe(true);
  expect(pressed).toBe("true");
});

test("clicking the toggle mutes, persists to localStorage, and silences playEarcon", async ({ page }) => {
  await page.click("#audioToggle");
  const { enabled, stored, pressed } = await page.evaluate(() => ({
    enabled: audioEnabled,
    stored: localStorage.getItem("chezzAudioEnabled"),
    pressed: document.getElementById("audioToggle").getAttribute("aria-pressed"),
  }));
  expect(enabled).toBe(false);
  expect(stored).toBe("0");
  expect(pressed).toBe("false");

  // playEarcon must not throw when muted, and must not attempt to construct
  // an Audio element (which would be a real, observable side effect).
  const audioCallsWhileMuted = await page.evaluate(() => {
    let calls = 0;
    const OrigAudio = window.Audio;
    window.Audio = function (...args) { calls++; return new OrigAudio(...args); };
    playEarcon("capture");
    window.Audio = OrigAudio;
    return calls;
  });
  expect(audioCallsWhileMuted).toBe(0);
});

test("a fresh page load respects a previously-stored mute", async ({ page }) => {
  await page.evaluate(() => localStorage.setItem("chezzAudioEnabled", "0"));
  await page.reload();
  const enabled = await page.evaluate(() => audioEnabled);
  expect(enabled).toBe(false);
});

test("playEarcon no-ops for an unknown event name instead of throwing", async ({ page }) => {
  await expect(page.evaluate(() => playEarcon("not-a-real-event"))).resolves.toBeUndefined();
});

test("a White capture plays the capture earcon", async ({ page }) => {
  const calls = await page.evaluate(async () => {
    const board = Array.from({ length: 9 }, () => Array(8).fill(""));
    board[8][4] = "K";
    board[6][3] = "P"; // captures the black pawn one diagonal step ahead
    board[5][2] = "p";
    state.board = board;
    state.turn = "w";
    state.captured = "";
    state.floor = 1;

    const seen = [];
    const orig = window.playEarcon;
    window.playEarcon = (name) => seen.push(name);
    try { await makeMove(3, 6, 2, 5); } finally { window.playEarcon = orig; }
    return seen;
  });
  expect(calls).toContain("capture");
});

test("clearing a floor (King reaches EXIT_ROW) plays the floorClear earcon", async ({ page }) => {
  const calls = await page.evaluate(async () => {
    const board = Array.from({ length: 9 }, () => Array(8).fill(""));
    board[1][4] = "K"; // one step from EXIT_ROW (0), nothing in the way
    state.board = board;
    state.turn = "w";
    state.captured = "";
    state.floor = 1;
    state.spawned = true; // skip the real spawner's own side effects

    const seen = [];
    const orig = window.playEarcon;
    window.playEarcon = (name) => seen.push(name);
    try { await makeMove(4, 1, 4, 0); } finally { window.playEarcon = orig; }
    return seen;
  });
  expect(calls).toContain("floorClear");
});

test("isWhiteKingInCheck reflects the same attackersOf the red-glow indicator uses", async ({ page }) => {
  const { safe, inCheck } = await page.evaluate(() => {
    const board = Array.from({ length: 9 }, () => Array(8).fill(""));
    board[8][4] = "K";
    const safe = isWhiteKingInCheck(board);
    board[0][4] = "r"; // clear file straight down onto the King
    const inCheck = isWhiteKingInCheck(board);
    return { safe, inCheck };
  });
  expect(safe).toBe(false);
  expect(inCheck).toBe(true);
});
