// Not a correctness test -- a tuning harness. Answers a narrower, cleaner
// question than the full-campaign playtest: given a starting force (King +
// N pawns, or a carried-over force from a previous stage), can White
// capture a specific enemy piece/pair within a fixed move budget? Iterates
// material upward until it can, then chains the surviving force into the
// next encounter -- if a knight falls to N pawns, and (knight + carryover)
// falls to a rook, that chain *is* the natural difficulty progression,
// rather than something to guess at with hand-placed FEN.
//
// Reliability caveat, confirmed by a direct check: a POSITIVE result
// ("captured: true") is solid evidence -- a strategy the proxy actually
// found and executed is a real existence proof, regardless of how weak the
// proxy is. A NEGATIVE result ("ran-out-of-moves") is much weaker evidence
// -- even Queen vs. an identical enemy Queen (fair material, no king to
// distract either side) failed at 20 moves, then failed AGAIN at 60 moves
// and at a deeper search, and twice lost outright (White's own King
// captured) rather than merely stalling. That means this proxy's shallow
// search and simple material-only eval have real defensive/tactical blind
// spots -- treat "couldn't find it in N moves" as "inconclusive," not as
// proof the material is insufficient, especially for the Rook/Queen
// results below.
import { test } from "@playwright/test";
import { GAME_URL } from "./helpers.mjs";

const MAX_WHITE_MOVES = 20; // per the user's proposed upper bound
const MAX_PAWNS_TO_TRY = 8;

test("find minimal material for each canonical piece, chained", async ({ page }) => {
  test.setTimeout(10 * 60 * 1000);
  page.on("console", m => { if (m.text().startsWith("PROGRESS")) console.log(m.text()); });
  await page.goto(GAME_URL);

  const results = await page.evaluate(([maxWhiteMoves, maxPawns]) => {
    const VALUES = { K: 0, Q: 9, R: 5, B: 3, N: 3, P: 1, M: 16, C: 10, A: 9,
                      k: 0, q: -9, r: -5, b: -3, n: -3, p: -1, m: -16, c: -10, a: -9 };
    const KING_SAFETY_WEIGHT = 0.3; // mild -- the goal here is capturing, not escaping

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

    function evalBoard(board) {
      let score = 0, whiteKingAlive = false, whiteKingY = 0;
      for (let y = 0; y < board.length; y++) {
        for (const c of board[y]) {
          if (!c) continue;
          score += VALUES[c] || 0;
          if (c === "K") { whiteKingAlive = true; whiteKingY = y; }
        }
      }
      if (!whiteKingAlive) return -100000;
      score += (8 - whiteKingY) * KING_SAFETY_WEIGHT; // mild pull toward safety, not escape
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
      const NOISE_MARGIN = 0.25; // tighter than the campaign proxy -- fewer near-ties to oscillate between
      const near = scored.filter(s => s.score >= bestScore - NOISE_MARGIN);
      return near[Math.floor(rng() * near.length)].mv;
    }

    function makeRng(seed) {
      let h = seed >>> 0;
      return () => { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; return h / 4294967296; };
    }

    // whiteSetup: array of {piece, x, y}. blackSetup: array of {piece, x, y}.
    // Returns whether every black piece was captured within maxWhiteMoves
    // White moves (each followed by a real Black reply), and the resulting
    // board (White's surviving force) if so.
    function captureTest(whiteSetup, blackSetup, seed) {
      const rng = makeRng(seed);
      let board = Array.from({ length: 9 }, () => Array(8).fill(""));
      for (const { piece, x, y } of whiteSetup) board[y][x] = piece;
      for (const { piece, x, y } of blackSetup) board[y][x] = piece;
      let pool = "";
      const depth = 3;

      for (let move = 0; move < maxWhiteMoves; move++) {
        const wm = bestWhiteMove(board, pool, depth, rng);
        if (!wm) return { captured: false, reason: "white-stuck" };
        const applied = applyMove(board, wm, pool);
        board = applied.nextBoard; pool = applied.pool;
        if (!board.flat().some(c => c && !isWhitePiece(c))) {
          return { captured: true, movesUsed: move + 1, board };
        }

        const bm = getBlackMoveRuthless(board, pool, 10); // fixed mid-campaign floor for search depth
        if (bm) {
          const applied2 = applyMove(board, bm, pool);
          board = applied2.nextBoard; pool = applied2.pool;
          if (!board.flat().includes("K")) return { captured: false, reason: "king-captured" };
        }
      }
      return { captured: false, reason: "ran-out-of-moves" };
    }

    // Extracts the surviving *composition* (piece types), not exact squares
    // -- carrying over exact ending squares would make the next test's
    // difficulty an artifact of wherever the last fight happened to end
    // (e.g. the King ending up already adjacent to where the next piece
    // gets placed), not a fair reflection of the material carried over. A
    // new floor starts the army back at a standard formation regardless of
    // where the previous one left off.
    function compositionFromBoard(board) {
      const pieces = [];
      for (const row of board) for (const c of row) if (c && isWhitePiece(c) && c !== "K") pieces.push(c);
      return pieces;
    }

    // Places the King at its usual start plus every piece in `pieces`
    // fanned out across row 7, overflowing to row 6 if there are more than
    // 7 (a lone King's up to 7-pawn allotment plus a promoted piece or two).
    function standardArmy(pieces) {
      const setup = [{ piece: "K", x: 4, y: 8 }];
      const cols = [3, 5, 2, 6, 1, 7, 0];
      pieces.forEach((piece, i) => {
        const y = i < cols.length ? 7 : 6;
        setup.push({ piece, x: cols[i % cols.length], y });
      });
      return setup;
    }

    // Finds the smallest force -- basePieces (piece chars, King implied)
    // plus 0..maxExtraPawns additional pawns, always re-placed via
    // standardArmy -- that captures blackSetup within budget. Tries
    // several seeds per material level so one lucky/unlucky RNG draw
    // doesn't decide the answer.
    function findMinimalForce(basePieces, blackSetup, maxExtraPawns, label) {
      for (let extra = 0; extra <= maxExtraPawns; extra++) {
        const setup = standardArmy(basePieces.concat(Array(extra).fill("P")));
        for (let seed = 1; seed <= 3; seed++) {
          const result = captureTest(setup, blackSetup, extra * 100 + seed);
          console.log(`PROGRESS ${label}: extra=${extra} seed=${seed} -> ${JSON.stringify({ captured: result.captured, reason: result.reason, movesUsed: result.movesUsed })}`);
          if (result.captured) return { extra, setup, result };
        }
      }
      return null;
    }

    const CENTER_SQUARE = { x: 4, y: 4 };
    const report = {};

    // Step 1: minimal pawns (from a lone King) to beat a solo Knight.
    const knight = findMinimalForce([], [{ piece: "n", ...CENTER_SQUARE }], maxPawns, "knight");
    report.knight = knight && { extraPawns: knight.extra, movesUsed: knight.result.movesUsed };

    // Step 2: chain -- NOT the literal surviving composition (the N pawns
    // spent beating the Knight are often sacrificed/consumed along the way
    // -- confirmed by logging: the actual surviving force was empty). Per
    // the user's framing, the *captured* Knight becomes an owned Knight via
    // promotion, carried forward alongside the same N pawns it took to win
    // that fight -- construct that force directly rather than hoping the
    // sim organically produces the promotion (it needs a pawn to reach the
    // promotion row at the right moment, which a short isolated fight may
    // never trigger).
    const knightForce = knight ? ["N"].concat(Array(knight.extra).fill("P")) : [];
    const rook = findMinimalForce(knightForce, [{ piece: "r", ...CENTER_SQUARE }], maxPawns, "rook (from Knight + N pawns)");
    report.rook = rook && { extraPawnsBeyondKnightForce: rook.extra, movesUsed: rook.result.movesUsed };

    // Step 3: does the SAME Knight+N-pawns force (escalating independently,
    // not from the rook-beating force) handle two Bishops? Tests the user's
    // specific claim that two Bishops should be a stronger encounter than a
    // solo Rook -- i.e., should need more material than the rook did.
    const bishops = findMinimalForce(knightForce, [{ piece: "b", x: 2, y: 4 }, { piece: "b", x: 6, y: 4 }], maxPawns, "two bishops (from Knight + N pawns)");
    report.twoBishops = bishops && { extraPawnsBeyondKnightForce: bishops.extra, movesUsed: bishops.result.movesUsed };

    // Step 4: does material *type* matter more than quantity for cornering
    // a lone Rook? Pawns alone (even 8 of them, on top of a Knight) failed
    // outright. Try qualitatively different forces instead -- pieces with
    // their own long-range or coordinated control, rather than more slow
    // material.
    const rookVariants = {
      "two Knights": ["N", "N"],
      "Knight + Bishop": ["N", "B"],
      "own Rook": ["R"],
      "two Bishops (opposite-color)": ["B", "B"],
      "Queen": ["Q"],
    };
    report.rookByForceType = {};
    for (const [label, pieces] of Object.entries(rookVariants)) {
      let found = null;
      for (let seed = 1; seed <= 3 && !found; seed++) {
        const result = captureTest(standardArmy(pieces), [{ piece: "r", ...CENTER_SQUARE }], seed);
        console.log(`PROGRESS rook vs ${label}: seed=${seed} -> ${JSON.stringify({ captured: result.captured, reason: result.reason, movesUsed: result.movesUsed })}`);
        if (result.captured) found = result;
      }
      report.rookByForceType[label] = found ? { movesUsed: found.movesUsed } : null;
    }

    // Step 5: is the Rook uniquely hard, or does a solo enemy Queen resist
    // everything but a Queen too (an even worse bottleneck, since Queen
    // covers both rook- and bishop-lines from wherever it stands)?
    const queenVariants = {
      "two Knights": ["N", "N"],
      "Knight + Bishop": ["N", "B"],
      "own Rook": ["R"],
      "own Rook + Knight": ["R", "N"],
      "two Bishops (opposite-color)": ["B", "B"],
      "Queen": ["Q"],
    };
    report.queenByForceType = {};
    for (const [label, pieces] of Object.entries(queenVariants)) {
      let found = null;
      for (let seed = 1; seed <= 3 && !found; seed++) {
        const result = captureTest(standardArmy(pieces), [{ piece: "q", ...CENTER_SQUARE }], seed);
        console.log(`PROGRESS queen vs ${label}: seed=${seed} -> ${JSON.stringify({ captured: result.captured, reason: result.reason, movesUsed: result.movesUsed })}`);
        if (result.captured) found = result;
      }
      report.queenByForceType[label] = found ? { movesUsed: found.movesUsed } : null;
    }

    return report;
  }, [MAX_WHITE_MOVES, MAX_PAWNS_TO_TRY]);

  console.log("SUMMARY: " + JSON.stringify(results, null, 2));
});
