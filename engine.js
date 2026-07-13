// engine.js — ChessRPG move engine (9-rank board, rows 0-8)
// White pieces: uppercase (K Q R B N P)
// Black pieces: lowercase (k q r b n p)
// Row 0 is the "exit" row (top), row 8 is the bottom where white starts.

function legalMovesForPiece(board, piece, fromX, fromY) {
  const moves = [];
  const lower = piece.toLowerCase();
  const isWhite = piece === piece.toUpperCase();

  const ROWS = 9;
  const COLS = 8;

  function inBounds(x, y) {
    return x >= 0 && x < COLS && y >= 0 && y < ROWS;
  }

  function isEmpty(x, y) {
    return inBounds(x, y) && board[y][x] === "";
  }

  function isEnemy(x, y) {
    if (!inBounds(x, y)) return false;
    const target = board[y][x];
    if (!target) return false;
    return isWhite
      ? target === target.toLowerCase()
      : target === target.toUpperCase();
  }

  function isFriendly(x, y) {
    if (!inBounds(x, y)) return false;
    const target = board[y][x];
    if (!target) return false;
    return isWhite
      ? target === target.toUpperCase()
      : target === target.toLowerCase();
  }

  // Slide in a direction, pushing moves until blocked
  function slide(dx, dy) {
    let x = fromX + dx;
    let y = fromY + dy;
    while (inBounds(x, y)) {
      if (isFriendly(x, y)) break;
      moves.push({ x, y });
      if (isEnemy(x, y)) break;
      x += dx;
      y += dy;
    }
  }

  // Step to a single square if not friendly
  function step(dx, dy) {
    const x = fromX + dx;
    const y = fromY + dy;
    if (inBounds(x, y) && !isFriendly(x, y)) {
      moves.push({ x, y });
    }
  }

  if (lower === "r") {
    slide(1, 0); slide(-1, 0); slide(0, 1); slide(0, -1);
  }

  else if (lower === "b") {
    slide(1, 1); slide(-1, 1); slide(1, -1); slide(-1, -1);
  }

  else if (lower === "q") {
    slide(1, 0); slide(-1, 0); slide(0, 1); slide(0, -1);
    slide(1, 1); slide(-1, 1); slide(1, -1); slide(-1, -1);
  }

  else if (lower === "k") {
    const dirs = [
      [1,0],[-1,0],[0,1],[0,-1],
      [1,1],[-1,1],[1,-1],[-1,-1]
    ];
    for (const [dx, dy] of dirs) step(dx, dy);
  }

  else if (lower === "n") {
    const jumps = [
      [2,1],[2,-1],[-2,1],[-2,-1],
      [1,2],[1,-2],[-1,2],[-1,-2]
    ];
    for (const [dx, dy] of jumps) step(dx, dy);
  }

  else if (lower === "p") {
    if (isWhite) {
      // White pawns move up (decreasing y)
      if (isEmpty(fromX, fromY - 1)) {
        moves.push({ x: fromX, y: fromY - 1 });
        // Double move from row 7 (white's starting rank on 9-rank board)
        if (fromY === 7 && isEmpty(fromX, fromY - 2)) {
          moves.push({ x: fromX, y: fromY - 2 });
        }
      }
      // Captures
      if (isEnemy(fromX - 1, fromY - 1)) moves.push({ x: fromX - 1, y: fromY - 1 });
      if (isEnemy(fromX + 1, fromY - 1)) moves.push({ x: fromX + 1, y: fromY - 1 });
    } else {
      // Black pawns move down (increasing y)
      if (isEmpty(fromX, fromY + 1)) {
        moves.push({ x: fromX, y: fromY + 1 });
        // Double move from rank 8 (black's starting row on 9-rank board)
        if (fromY === 1 && isEmpty(fromX, fromY + 2)) {
          moves.push({ x: fromX, y: fromY + 2 });
        }
      }
      // Captures
      if (isEnemy(fromX - 1, fromY + 1)) moves.push({ x: fromX - 1, y: fromY + 1 });
      if (isEnemy(fromX + 1, fromY + 1)) moves.push({ x: fromX + 1, y: fromY + 1 });
    }
  }

  // Row 0 (rank 9) is the exit row that carries pieces to the next floor — enemy
  // pieces may never move onto it.
  // TODO: once a player's own piece reaches row 0, it should probably be locked
  // there (unable to move again) until the floor transition happens — not
  // implemented yet, it can still move freely for now.
  return isWhite ? moves : moves.filter(m => m.y !== 0);
}

const SLIDE_DIRS = {
  r: [[1,0],[-1,0],[0,1],[0,-1]],
  b: [[1,1],[-1,1],[1,-1],[-1,-1]],
  q: [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]],
};

// Fork bonus: does the piece now at (x, y) attack 2+ enemy pieces at once?
// The opponent can only save the most valuable one, so the second-best target
// is what we should expect to actually net — plus a little extra if the King
// is one of the forked pieces. `valueOf(piece)` must return a comparable
// magnitude for any piece character, including "K"/"k".
function findForkBonus(board, piece, x, y, valueOf) {
  const attacked = legalMovesForPiece(board, piece, x, y).map(m => board[m.y][m.x]).filter(Boolean);
  if (attacked.length < 2) return 0;
  const values = attacked.map(valueOf).sort((a, b) => b - a);
  const kingChar = piece === piece.toUpperCase() ? "k" : "K";
  return values[1] + (attacked.includes(kingChar) ? valueOf(kingChar) * 0.5 : 0);
}

// Skewer bonus: sliding toward a valuable piece with a less-valuable one lined
// up directly behind it on the same line — once the front piece moves, the
// back one falls.
function findSkewerBonus(board, piece, x, y, valueOf) {
  const dirs = SLIDE_DIRS[piece.toLowerCase()];
  if (!dirs) return 0;
  let bonus = 0;
  for (const [dx, dy] of dirs) {
    let cx = x + dx, cy = y + dy;
    const hits = [];
    while (cx >= 0 && cx < 8 && cy >= 0 && cy < 9) {
      const p2 = board[cy][cx];
      if (p2) {
        if ((p2 === p2.toUpperCase()) === (piece === piece.toUpperCase())) break; // a friendly piece fully blocks the ray
        hits.push(p2);
        if (hits.length === 2) break;
      }
      cx += dx; cy += dy;
    }
    if (hits.length === 2 && valueOf(hits[0]) >= valueOf(hits[1])) bonus += valueOf(hits[1]);
  }
  return bonus;
}

// Auto-promotion, mirrored for both colors: a pawn reaching its far rank
// (row 1 for White, row 8 for Black) promotes by spending one captured
// piece of the matching type from the opponent out of `capturedPool` (the
// same shared bank `state.captured` tracks in index.html) — never a free
// promotion. Picks the strongest available type (queen first) since a
// rational player facing this game's no-check rules never prefers a weaker
// piece when a stronger one is banked. Leaves the pawn a pawn if nothing
// promotable has been captured yet.
function autoPromote(piece, toY, capturedPool) {
  if (piece === "P" && toY === 1) {
    for (const t of ["q", "r", "b", "n"]) {
      const idx = capturedPool.indexOf(t);
      if (idx !== -1) {
        return { piece: t.toUpperCase(), capturedPool: capturedPool.slice(0, idx) + capturedPool.slice(idx + 1) };
      }
    }
  } else if (piece === "p" && toY === 8) {
    for (const t of ["Q", "R", "B", "N"]) {
      const idx = capturedPool.indexOf(t);
      if (idx !== -1) {
        return { piece: t.toLowerCase(), capturedPool: capturedPool.slice(0, idx) + capturedPool.slice(idx + 1) };
      }
    }
  }
  return { piece, capturedPool };
}

function findWhiteKing(board) {
  for (let y = 0; y < 9; y++)
    for (let x = 0; x < 8; x++)
      if (board[y][x] === "K") return { x, y };
  return null;
}

const Engine = {
  isLegalMove(board, fromX, fromY, toX, toY) {
    const piece = board[fromY][fromX];
    if (!piece) return false;
    return legalMovesForPiece(board, piece, fromX, fromY)
      .some(m => m.x === toX && m.y === toY);
  },

  // All legal destination squares for the piece on (fromX, fromY)
  legalMovesFrom(board, fromX, fromY) {
    const piece = board[fromY][fromX];
    return piece ? legalMovesForPiece(board, piece, fromX, fromY) : [];
  },

  // Squares of every byWhite-colored piece that can legally move onto (x, y)
  attackersOf(board, x, y, byWhite) {
    const attackers = [];
    for (let ay = 0; ay < 9; ay++) {
      for (let ax = 0; ax < 8; ax++) {
        const piece = board[ay][ax];
        if (!piece || (piece === piece.toUpperCase()) !== byWhite) continue;
        if (legalMovesForPiece(board, piece, ax, ay).some(m => m.x === x && m.y === y)) {
          attackers.push({ x: ax, y: ay });
        }
      }
    }
    return attackers;
  },

  findWhiteKing,
  autoPromote,

  getBlackMovePerformant(board) {
    const moves = [];
    const pieceValues = { p: 100, n: 300, b: 300, r: 500, q: 900 };

    // Find White King's current position
    const initialKing = findWhiteKing(board);

    // 1. Gather all legal moves for Black
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 8; x++) {
        const piece = board[y][x];
        if (!piece || piece !== piece.toLowerCase()) continue;

        const legal = legalMovesForPiece(board, piece, x, y);
        for (const move of legal) {
          // Clone the board to simulate the resulting position
          const nextBoard = board.map(row => [...row]);
          const target = nextBoard[move.y][move.x];
          
          nextBoard[move.y][move.x] = piece;
          nextBoard[y][x] = ""; 

          let score = 0;

          // --- MATERIAL EVALUATION ---
          if (target) {
            if (target === "K") score += 500000; // Immediate win
            else score += (pieceValues[target.toLowerCase()] || 100) * 10;
          }

          // --- POSITION EVALUATION ---
          const nextKing = findWhiteKing(nextBoard) || initialKing;
          if (nextKing) {
            // Priority #1: Keep the King away from Row 0 (The escape hatch)
            score -= (8 - nextKing.y) * 1000; 

            // Priority #2: Black pieces swarm around the king to choke his moves
            const distAfter = Math.abs(move.x - nextKing.x) + Math.abs(move.y - nextKing.y);
            score += (16 - distAfter) * 15;
          }

          // Blockade bonus
          if (move.y === 1) score += 150;
          if (move.y === 2) score += 100;

          // --- TACTICAL AWARENESS: forks & skewers ---
          const valueOf = p => (p === "K" ? 1000 : (pieceValues[p.toLowerCase()] || 100));
          score += findForkBonus(nextBoard, piece, move.x, move.y, valueOf) * 5;
          score += findSkewerBonus(nextBoard, piece, move.x, move.y, valueOf) * 3;

          // --- LOOKAHEAD DEFENSE MATRIX ---
          let hangingPenalty = 0;
          for (let wy = 0; wy < 9; wy++) {
            for (let wx = 0; wx < 8; wx++) {
              const wPiece = nextBoard[wy][wx];
              if (wPiece && wPiece === wPiece.toUpperCase()) {
                const wMoves = legalMovesForPiece(nextBoard, wPiece, wx, wy);
                for (const wm of wMoves) {
                  // If White can capture our moved piece on the next turn
                  if (wm.x === move.x && wm.y === move.y) {
                    hangingPenalty = Math.max(hangingPenalty, pieceValues[piece.toLowerCase()]);
                  }
                  // Ultimate disaster: White King can step onto Row 0 next turn
                  if (wPiece === "K" && wm.y === 0) {
                    score -= 100000;
                  }
                }
              }
            }
          }
          // Scaled to match the material-evaluation bonus above (also *10), so a
          // capture that gets recaptured nets out to its true material loss instead
          // of still looking profitable — this is what stops e.g. a knight (300)
          // diving in to take a defended pawn (100) for a net loss.
          score -= hangingPenalty * 10;

          moves.push({ fromX: x, fromY: y, toX: move.x, toY: move.y, score });
        }
      }
    }

    if (!moves.length) return null;

    // Select best move
    let bestScore = -Infinity;
    for (const m of moves) {
      if (m.score > bestScore) bestScore = m.score;
    }
    const candidates = moves.filter(m => m.score === bestScore);
    return candidates[Math.floor(Math.random() * candidates.length)];
  },

  // capturedPool mirrors index.html's `state.captured`: every piece either
  // side has ever captured, spent one at a time on promotions. Needed here
  // so the search can correctly simulate promotion (and what it costs) deep
  // in the tree instead of just leaving pawns stuck on the back rank.
  getBlackMoveRuthless(board, capturedPool) {
    capturedPool = capturedPool || "";

    // How many plies deep to search: Black's move, White's reply, Black's
    // follow-up. Deliberately just raw material + king-safety search with
    // no tactical special-casing (no fork/skewer pattern-matching) — a
    // sacrifice's real cost shows up on the board itself (the piece gets
    // recaptured) instead of needing a hand-coded bonus to approximate it.
    // The old depth-1 "White's single best reply" let Black hang a piece
    // for free whenever a *bigger*, unrelated capture existed elsewhere:
    // White's one reply spent on grabbing the bigger prize left the
    // sacrificed piece looking safe, because nothing in the search ever
    // reached the ply where White comes back for it. Raw depth alone still
    // isn't enough once an exchange runs deeper than the horizon, though —
    // that's what the quiescence search below is for. Iteratively deepened
    // (below) past MIN_DEPTH as far as the time budget allows, rather than
    // a single fixed depth, so quiet multi-move threats (not just capture
    // sequences) get a chance to show up too.
    const MIN_DEPTH = 3; // always completed in full, regardless of the deadline
    const MAX_DEPTH = 8;
    const SEARCH_DEADLINE_MS = 1200;
    const deadline = Date.now() + SEARCH_DEADLINE_MS;
    let hitDeadline = false;

    const pieceValues = {
      'k': 100000, 'q': 900, 'r': 500, 'b': 300, 'n': 300, 'p': 100,
      'K': -100000, 'Q': -900, 'R': -500, 'B': -300, 'N': -300, 'P': -100
    };

    // Dominant over any realistic material/positional sum (so White escaping
    // is always treated as catastrophic), but unlike a flat -Infinity it still
    // has the underlying position's eval added on top -- otherwise every lost
    // line ties exactly, and the final pick among them becomes arbitrary.
    const WHITE_ESCAPE_PENALTY = -500000;

    // Static evaluation of any given board state
    function evaluateBoard(b) {
      let total = 0;
      let wKing = null;
      const blackPieces = [];

      for (let y = 0; y < 9; y++) {
        for (let x = 0; x < 8; x++) {
          const piece = b[y][x];
          if (!piece) continue;

          // Material balance
          total += pieceValues[piece];

          if (piece === "K") wKing = { x, y };

          // Positional weights
          if (piece === piece.toLowerCase()) {
            if (y === 1) total += 50;
            if (y === 2) total += 30;
            blackPieces.push({ x, y });
          }
        }
      }

      // Main objective weight. Kept well below material values (100-900) so a
      // single King step never outweighs an actual capture — at 2000 it did,
      // which meant White's best response effectively always "chose" to just
      // shuffle the King forward instead of taking a free recapture, so Black's
      // bad trades were never punished. The literal reach-row-0 case is still
      // covered by WHITE_ESCAPE_PENALTY below, this term is only the gradual approach.
      if (wKing) {
        total -= (8 - wKing.y) * 150;

        // Swarm pressure: black pieces are worth more the closer they crowd the King
        for (const bp of blackPieces) {
          const dist = Math.abs(bp.x - wKing.x) + Math.abs(bp.y - wKing.y);
          total += (16 - dist) * 5;
        }
      } else {
        total += 500000;
      }

      return total;
    }

    function collectMoves(b, whiteToMove) {
      const moves = [];
      for (let y = 0; y < 9; y++) {
        for (let x = 0; x < 8; x++) {
          const piece = b[y][x];
          if (!piece || (piece === piece.toUpperCase()) !== whiteToMove) continue;
          for (const m of legalMovesForPiece(b, piece, x, y)) {
            moves.push({ piece, fromX: x, fromY: y, toX: m.x, toY: m.y });
          }
        }
      }
      // Move ordering for alpha-beta: try captures (biggest victim first) before
      // quiet moves, since examining the strongest replies first prunes far more
      // of the tree than a static natural-order scan would.
      moves.sort((a, c) => {
        const at = b[a.toY][a.toX], ct = b[c.toY][c.toX];
        return (ct ? Math.abs(pieceValues[ct]) : -1) - (at ? Math.abs(pieceValues[at]) : -1);
      });
      return moves;
    }

    function applyMove(b, mv, pool) {
      const nextBoard = b.map(row => [...row]);
      const target = nextBoard[mv.toY][mv.toX];
      if (target) pool += target;
      nextBoard[mv.fromY][mv.fromX] = "";
      const promo = autoPromote(mv.piece, mv.toY, pool);
      nextBoard[mv.toY][mv.toX] = promo.piece;
      return { nextBoard, pool: promo.capturedPool };
    }

    // Quiescence search: a plain static eval at the search horizon can badly
    // misjudge a position mid-exchange — it has no idea whether the capture
    // that just happened is about to be recaptured one ply later (the
    // "horizon effect"). So instead of evaluating immediately once the main
    // search bottoms out, keep searching, but ONLY through captures, until
    // the position settles. Once a capture lands on a square, only further
    // recaptures on that SAME square continue the thread — unrelated
    // captures elsewhere get examined once the main search reaches them as
    // an actual move, not smuggled in here. That's what keeps this cheap:
    // an exchange is bounded by however many pieces attack one square
    // (rarely more than 2-3), not by every capture on the board.
    function quiesce(b, alpha, beta, whiteToMove, pool, targetSquare) {
      const standPat = evaluateBoard(b);

      // Delta pruning: even winning the single most valuable piece sitting
      // on the target square couldn't close the gap to alpha/beta, so don't
      // even bother generating moves.
      if (targetSquare) {
        const victim = b[targetSquare.y][targetSquare.x];
        const bestPossibleGain = (victim ? Math.abs(pieceValues[victim]) : 0) + 150;
        if (whiteToMove && standPat - bestPossibleGain >= beta) return standPat;
        if (!whiteToMove && standPat + bestPossibleGain <= alpha) return standPat;
      }

      let captures = collectMoves(b, whiteToMove).filter(mv => b[mv.toY][mv.toX]);
      if (targetSquare) captures = captures.filter(mv => mv.toX === targetSquare.x && mv.toY === targetSquare.y);

      if (whiteToMove) {
        if (standPat <= alpha) return standPat;
        if (standPat < beta) beta = standPat;
        for (const mv of captures) {
          const { nextBoard, pool: nextPool } = applyMove(b, mv, pool);
          const val = (mv.piece === "K" && mv.toY === 0)
            ? WHITE_ESCAPE_PENALTY + evaluateBoard(nextBoard)
            : quiesce(nextBoard, alpha, beta, false, nextPool, { x: mv.toX, y: mv.toY });
          if (val < beta) beta = val;
          if (beta <= alpha) return alpha;
        }
        return beta;
      }

      if (standPat >= beta) return standPat;
      if (standPat > alpha) alpha = standPat;
      for (const mv of captures) {
        const { nextBoard, pool: nextPool } = applyMove(b, mv, pool);
        const val = quiesce(nextBoard, alpha, beta, true, nextPool, { x: mv.toX, y: mv.toY });
        if (val > alpha) alpha = val;
        if (beta <= alpha) return beta;
      }
      return alpha;
    }

    // Full alternating minimax with alpha-beta pruning: Black maximizes the
    // (Black-positive/White-negative) evaluation, White minimizes it.
    function search(b, depth, alpha, beta, whiteToMove, pool) {
      if (depth === 0) return quiesce(b, alpha, beta, whiteToMove, pool, null);
      if (Date.now() > deadline) { hitDeadline = true; return quiesce(b, alpha, beta, whiteToMove, pool, null); }

      const moves = collectMoves(b, whiteToMove);
      // No legal moves isn't a terminal state here (the real game just skips
      // the turn) -- passing it straight to quiesce/eval made the search
      // treat "steer into a position where I have zero moves" as a good
      // outcome, since it cut the lookahead short right there and hid
      // however many more free turns the opponent would actually get. Burn a
      // ply and let the other side move instead, so a real continuation
      // still gets evaluated.
      if (!moves.length) return search(b, depth - 1, alpha, beta, !whiteToMove, pool);

      if (whiteToMove) {
        let best = Infinity;
        for (const mv of moves) {
          const { nextBoard, pool: nextPool } = applyMove(b, mv, pool);
          const val = (mv.piece === "K" && mv.toY === 0)
            ? WHITE_ESCAPE_PENALTY + evaluateBoard(nextBoard) // dominant, but still lets material break ties among lost lines
            : search(nextBoard, depth - 1, alpha, beta, false, nextPool);
          if (val < best) best = val;
          if (val < beta) beta = val;
          if (beta <= alpha) break;
        }
        return best;
      }

      let best = -Infinity;
      for (const mv of moves) {
        const { nextBoard, pool: nextPool } = applyMove(b, mv, pool);
        const val = search(nextBoard, depth - 1, alpha, beta, true, nextPool);
        if (val > best) best = val;
        if (val > alpha) alpha = val;
        if (beta <= alpha) break;
      }
      return best;
    }

    // Root Generation for one depth — evaluated without pruning against each
    // other so all moves tying for the maximum are collected for the random
    // pick below.
    function searchRoot(depth) {
      const candidates = [];
      let maxEvaluation = -Infinity;
      for (const mv of collectMoves(board, false)) {
        const { nextBoard, pool } = applyMove(board, mv, capturedPool);
        const moveValue = search(nextBoard, depth - 1, -Infinity, Infinity, true, pool);
        const candidate = { fromX: mv.fromX, fromY: mv.fromY, toX: mv.toX, toY: mv.toY, score: moveValue };

        if (moveValue > maxEvaluation) {
          maxEvaluation = moveValue;
          candidates.length = 0;
          candidates.push(candidate);
        } else if (moveValue === maxEvaluation) {
          candidates.push(candidate);
        }
      }
      return candidates;
    }

    // Iterative deepening: always finish MIN_DEPTH in full (it's cheap and
    // bounded), then keep going one ply deeper as long as time allows. A
    // depth attempt that runs into the deadline partway through is a mix of
    // fully- and partially-searched root moves -- not a fair comparison --
    // so it's thrown away entirely rather than trusted, falling back to the
    // last depth that finished clean.
    let bestCandidates = searchRoot(MIN_DEPTH);
    for (let depth = MIN_DEPTH + 1; depth <= MAX_DEPTH; depth++) {
      if (Date.now() > deadline) break;
      hitDeadline = false;
      const attempt = searchRoot(depth);
      if (hitDeadline || !attempt.length) break;
      bestCandidates = attempt;
    }

    if (!bestCandidates.length) return null;

    // Deterministic tie-break, seeded from the position itself (same LCG
    // pattern as index.html's spawnBlackArmy) rather than Math.random() --
    // replaying the exact same position (e.g. from a saved/audited URL)
    // must always pick the same move among ties.
    let seed = hashStr(board.map(row => row.map(c => c || ".").join("")).join("|") + "|" + capturedPool);
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return bestCandidates[Math.floor((seed / 4294967296) * bestCandidates.length)];
  }
};