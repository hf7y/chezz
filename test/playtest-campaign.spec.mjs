// Not a correctness test -- a playtesting harness. Simulates full campaign
// runs (floor 1 through the boss, continuously -- White's army carries over
// floor to floor via survivors + captured-pawn promotion, exactly like real
// play) using a lightweight standalone minimax for White (there's no shipped
// White AI; the real game expects a human) against the real, unmodified
// getBlackMoveRuthless. Logs results; meant to be read by a human tuning
// NARRATIVE_STAGES, not part of CI signal (it always "passes").
//
// Caveat, confirmed by observation: this proxy can itself stall on trivially
// easy floors (seen on the plain 2-pawn "Two to take" floor, at both 60 and
// 100 plies) -- almost certainly oscillating between two near-equally-scored
// moves rather than the floor being genuinely hard. Treat a "stalled" result
// as a real difficulty signal only when it's consistent across a stage that
// isn't otherwise trivial, not as proof on its own -- cross-check against
// how much material/plies similar-or-easier stages needed.
import { test } from "@playwright/test";
import { GAME_URL } from "./helpers.mjs";

const RUNS = 8;
const MAX_PLIES_PER_FLOOR = 60; // safety valve against one floor never resolving

test("playtest the full campaign, continuously", async ({ page }) => {
  test.setTimeout(10 * 60 * 1000);
  page.on("console", m => { if (m.text().startsWith("PROGRESS")) console.log(m.text()); });
  await page.goto(GAME_URL);

  const results = await page.evaluate(([runs, maxPliesPerFloor]) => {
    // A simple, self-contained minimax for White -- not the shipped engine's
    // sophistication, just a reasonable proxy for "a player who doesn't hang
    // pieces and pushes toward the exit," good enough to compare relative
    // difficulty across the campaign.
    const VALUES = { K: 0, Q: 9, R: 5, B: 3, N: 3, P: 1, M: 16, C: 10, A: 9,
                      k: 0, q: -9, r: -5, b: -3, n: -3, p: -1, m: -16, c: -10, a: -9 };
    const EXIT_BONUS = 100;
    const KING_PROGRESS_WEIGHT = 2; // reward White's King for being closer to row 0

    function collect(board, forWhite) {
      const moves = [];
      for (let y = 0; y < board.length; y++) {
        for (let x = 0; x < board[y].length; x++) {
          const piece = board[y][x];
          if (!piece || isWhitePiece(piece) !== forWhite) continue;
          for (const m of legalMovesForPiece(board, piece, x, y)) {
            moves.push({ piece, fromX: x, fromY: y, toX: m.x, toY: m.y });
          }
        }
      }
      return moves;
    }

    // Only pieces literally on row 0 (the exit row) when the King also
    // arrives there carry over to the next floor (see newFloor/
    // checkFloorProgression) -- a straggler elsewhere is abandoned. This
    // proxy needs to actively shepherd its own surviving pieces to the
    // exit, not just rush the King there, or it'll never accumulate an
    // army no matter how much material it captures.
    const STRAGGLER_PENALTY = 3; // per non-King White piece not yet on row 0 while the King already is
    function evalBoard(board) {
      let score = 0, whiteKingY = -1, blackAlive = false;
      const otherWhiteYs = [];
      for (let y = 0; y < board.length; y++) {
        for (const c of board[y]) {
          if (!c) continue;
          score += VALUES[c] || 0;
          if (c === "K") whiteKingY = y;
          else if (isWhitePiece(c)) otherWhiteYs.push(y);
          if (c !== c.toUpperCase()) blackAlive = true;
        }
      }
      if (whiteKingY === -1) return -100000; // White's King captured -- catastrophic, dominates
      score += (8 - whiteKingY) * KING_PROGRESS_WEIGHT;
      for (const y of otherWhiteYs) {
        score += (8 - y) * KING_PROGRESS_WEIGHT;
        if (whiteKingY === 0 && y !== 0) score -= STRAGGLER_PENALTY;
      }
      if (!blackAlive) score += 5;
      return score;
    }

    function whiteSearch(board, pool, depth, alpha, beta, whiteToMove) {
      const moves = collect(board, whiteToMove);
      if (depth === 0 || !moves.length) return evalBoard(board);
      let best = whiteToMove ? -Infinity : Infinity;
      for (const mv of moves) {
        const { nextBoard, pool: nextPool } = applyMove(board, mv, pool);
        const val = whiteSearch(nextBoard, nextPool, depth - 1, alpha, beta, !whiteToMove);
        if (whiteToMove) { if (val > best) best = val; if (val > alpha) alpha = val; }
        else { if (val < best) best = val; if (val < beta) beta = val; }
        if (beta <= alpha) break;
      }
      return best;
    }

    function bestWhiteMove(board, pool, depth, rng) {
      const moves = collect(board, true);
      if (!moves.length) return null;
      let bestScore = -Infinity;
      const scored = moves.map(mv => {
        const { nextBoard, pool: nextPool } = applyMove(board, mv, pool);
        const score = whiteSearch(nextBoard, nextPool, depth - 1, -Infinity, Infinity, false);
        if (score > bestScore) bestScore = score;
        return { mv, score };
      });
      // Random pick among near-best moves -- a stand-in for varied reasonable
      // human play, not perfect engine play, so runs aren't all identical.
      const NOISE_MARGIN = 0.5;
      const near = scored.filter(s => s.score >= bestScore - NOISE_MARGIN);
      return near[Math.floor(rng() * near.length)].mv;
    }

    function makeRng(seed) {
      let h = seed >>> 0;
      return () => { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; return h / 4294967296; };
    }

    // Runs one full campaign attempt, using the real state/spawnBlackArmy/
    // newFloor machinery (not a parallel reimplementation), so floor
    // transitions carry White's army over exactly like real play.
    function simulate(seed) {
      const rng = makeRng(seed);
      state.board = Array.from({ length: 9 }, () => Array(8).fill(""));
      state.board[8][4] = "K";
      state.captured = "";
      state.floor = 1;
      state.lastSpawnBudget = 0;
      spawnBlackArmy();

      const depth = 3;
      let totalPlies = 0;
      const floorLog = [];

      while (state.floor <= NARRATIVE_STAGES.length) {
        const whiteArmyAtStart = state.board.flat().filter(c => c && isWhitePiece(c)).join("");
        const poolAtStart = state.captured;
        let pliesThisFloor = 0;
        let clearedFloor = false;
        while (pliesThisFloor < maxPliesPerFloor) {
          const wm = bestWhiteMove(state.board, state.captured, depth, rng);
          if (!wm) return { outcome: "white-stuck", floor: state.floor, totalPlies, floorLog };
          const applied = applyMove(state.board, wm, state.captured);
          state.board = applied.nextBoard; state.captured = applied.pool;
          pliesThisFloor++; totalPlies++;
          if (wm.piece === "K" && wm.toY === 0) { clearedFloor = true; break; }

          const bm = getBlackMoveRuthless(state.board, state.captured, state.floor);
          if (bm) {
            const applied2 = applyMove(state.board, bm, state.captured);
            state.board = applied2.nextBoard; state.captured = applied2.pool;
            pliesThisFloor++; totalPlies++;
            if (!state.board.flat().includes("K")) {
              return { outcome: "king-captured", floor: state.floor, totalPlies, floorLog };
            }
          }
        }
        floorLog.push({ floor: state.floor, army: whiteArmyAtStart, pool: poolAtStart, plies: pliesThisFloor, cleared: clearedFloor });
        if (!clearedFloor) return { outcome: "stalled", floor: state.floor, totalPlies, floorLog };

        // Mirrors checkFloorProgression/newFloor exactly (survivors carry
        // over, a captured pawn backfills each, floor increments).
        newFloor(boardToFen().split("-")[0]);
      }
      return { outcome: "beat-the-campaign", floor: state.floor, totalPlies, floorLog };
    }

    const outcomesByDeathFloor = {};
    const outcomeCounts = {};
    for (let i = 0; i < runs; i++) {
      const result = simulate(i * 7919 + 1);
      outcomeCounts[result.outcome] = (outcomeCounts[result.outcome] || 0) + 1;
      if (result.outcome !== "beat-the-campaign") {
        outcomesByDeathFloor[result.floor] = (outcomesByDeathFloor[result.floor] || 0) + 1;
      }
      console.log("PROGRESS run " + i + ": " + JSON.stringify(result));
    }
    return { outcomeCounts, outcomesByDeathFloor, runs };
  }, [RUNS, MAX_PLIES_PER_FLOOR]);

  console.log("SUMMARY: " + JSON.stringify(results, null, 2));
});
