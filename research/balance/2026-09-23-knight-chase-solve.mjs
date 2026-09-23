// Exhaustive solver for "can a lone White King force the capture of a lone
// Black Knight confined to 'The Knight' narrative stage's board?" -- issue
// hf7y/chezz#120's queued question, research/balance/README.md.
//
// This is NOT a simulation/playtest of the game's actual AI
// (getBlackMoveRuthless). It's a direct retrograde solve of the reduced
// (King, Knight, side-to-move) state graph under the EXACT movement rules
// in index1.html (legalMovesForPiece, kingSafeAfterMove, attackersOf),
// assuming Black plays a perfect adversarial evasion (the worst case for
// White, i.e. the real "material sufficiency" question: is White's material
// *sufficient*, not "does the shipped bot happen to find it"). Standard
// attractor/backward-induction algorithm for finite two-player reachability
// games -- exact, not heuristic.
//
// Board mirrors index1.html: BOARD_COLS=8, BOARD_ROWS=9, EXIT_ROW=0.
// "The Knight" stage: rows[] index 3 (board row 4) has the knight at col 3;
// rows[] index 5 (board row 6) is the wallRow "###11###" -> wall at cols
// 0,1,2,5,6,7, open gap at cols 3,4. shift=0 (the authored layout; see the
// script's own comment on why other cyclic shifts are out of scope).

const COLS = 8, ROWS = 9, EXIT_ROW = 0;
const WALL_ROW = 6;
const WALL_COLS = new Set([0, 1, 2, 5, 6, 7]); // shift=0; gap at 3,4

const KING_STEPS = [];
for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (dx || dy) KING_STEPS.push([dx, dy]);
const KNIGHT_JUMPS = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];

function inBounds(x, y) { return x >= 0 && x < COLS && y >= 0 && y < ROWS; }
function isWall(x, y) { return y === WALL_ROW && WALL_COLS.has(x); }
function isSquare(x, y) { return inBounds(x, y) && !isWall(x, y); }

// Raw king destinations: on-board, non-wall. (Matches legalMovesForPiece's
// `step`, which only excludes friendly/terrain -- no other white piece
// exists in this fight.)
function kingRawMoves(kx, ky) {
  const out = [];
  for (const [dx, dy] of KING_STEPS) {
    const x = kx + dx, y = ky + dy;
    if (isSquare(x, y)) out.push([x, y]);
  }
  return out;
}

// Knight destinations, with the EXIT_ROW filter real legalMovesForPiece
// applies to every Black piece ("Enemy pieces may never move onto the exit
// row").
function knightRawMoves(nx, ny) {
  const out = [];
  for (const [dx, dy] of KNIGHT_JUMPS) {
    const x = nx + dx, y = ny + dy;
    if (isSquare(x, y) && y !== EXIT_ROW) out.push([x, y]);
  }
  return out;
}

// Squares the knight attacks, for kingSafeAfterMove's mirror -- same
// EXIT_ROW exclusion, since attackersOf calls the same legalMovesForPiece.
function knightAttackSet(nx, ny) {
  const set = new Set();
  for (const [x, y] of knightRawMoves(nx, ny)) set.add(x + "," + y);
  return set;
}

function key(kx, ky, nx, ny, turn) { return `${kx},${ky},${nx},${ny},${turn}`; }

// Enumerate every reachable state and its outgoing edges in one pass, plus
// reverse edges, so the attractor algorithm below can do predecessor
// lookups without a second board-scan per state.
const squares = [];
for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (isSquare(x, y)) squares.push([x, y]);
const knightSquares = squares.filter(([, y]) => y !== EXIT_ROW); // knight never legally occupies row 0

const nodes = new Map(); // key -> { turn, isCapture (for 'w' nodes), succ: [keys], predEdgesResolved }
const white = { win: new Set() };
const black = { win: new Set(), remaining: new Map() };

function whiteNode(kx, ky, nx, ny) {
  const k = key(kx, ky, nx, ny, "w");
  if (nodes.has(k)) return k;
  const attacks = knightAttackSet(nx, ny);
  let capture = false;
  const succ = [];
  for (const [tx, ty] of kingRawMoves(kx, ky)) {
    if (tx === nx && ty === ny) { capture = true; continue; } // terminal win, no successor state
    if (attacks.has(tx + "," + ty)) continue; // hangs the King -- illegal (King-only rule)
    succ.push(key(tx, ty, nx, ny, "b"));
  }
  nodes.set(k, { turn: "w", capture, succ });
  return k;
}

function blackNode(kx, ky, nx, ny) {
  const k = key(kx, ky, nx, ny, "b");
  if (nodes.has(k)) return k;
  const moves = knightRawMoves(nx, ny);
  const succ = moves.length
    ? moves.map(([tx, ty]) => key(kx, ky, tx, ty, "w"))
    : [key(kx, ky, nx, ny, "w")]; // no legal knight move -> turn passes back to White (state.turn = "w" unconditionally in the real code)
  nodes.set(k, { turn: "b", succ });
  return k;
}

// Build the full graph (BFS from every possible (king,knight) pair, since
// we want the complete table, not just one starting position).
const queue = [];
for (const [kx, ky] of squares) {
  for (const [nx, ny] of knightSquares) {
    if (kx === nx && ky === ny) continue; // can't start on the same square
    queue.push(whiteNode(kx, ky, nx, ny));
    queue.push(blackNode(kx, ky, nx, ny));
  }
}
// Expand successors transitively (whiteNode/blackNode above only create the
// two nodes for a given (k,n) pair; walk the graph to create every node
// their successors mention too).
let frontier = [...nodes.keys()];
while (frontier.length) {
  const next = [];
  for (const k of frontier) {
    const [kx, ky, nx, ny, turn] = k.split(",");
    const KX = +kx, KY = +ky, NX = +nx, NY = +ny;
    const node = nodes.get(k);
    for (const sk of node.succ) {
      if (!nodes.has(sk)) {
        const [skx, sky, snx, sny, sturn] = sk.split(",");
        if (sturn === "w") whiteNode(+skx, +sky, +snx, +sny); else blackNode(+skx, +sky, +snx, +sny);
        next.push(sk);
      }
    }
  }
  frontier = next;
}

// Reverse edges.
const preds = new Map();
for (const [k, node] of nodes) {
  for (const sk of node.succ) {
    if (!preds.has(sk)) preds.set(sk, []);
    preds.get(sk).push(k);
  }
}

// Attractor / backward-induction: white nodes are OR (win if any successor
// wins, or an immediate capture exists); black nodes are AND (win only if
// EVERY successor wins -- including the size-1 "knight has no move, turn
// passes" case, which is naturally correct with an AND over one edge).
const win = new Set();
const remaining = new Map(); // black-node key -> count of successors not yet proven winning
const bfsQueue = [];

for (const [k, node] of nodes) {
  if (node.turn === "w") {
    if (node.capture) { win.add(k); bfsQueue.push(k); }
  } else {
    remaining.set(k, node.succ.length);
  }
}

let head = 0;
while (head < bfsQueue.length) {
  const v = bfsQueue[head++];
  const ps = preds.get(v) || [];
  for (const u of ps) {
    if (win.has(u)) continue;
    const node = nodes.get(u);
    if (node.turn === "w") {
      win.add(u); bfsQueue.push(u);
    } else {
      const left = remaining.get(u) - 1;
      remaining.set(u, left);
      if (left === 0) { win.add(u); bfsQueue.push(u); }
    }
  }
}

// --- Report ---
let whiteTotal = 0, whiteWin = 0;
for (const [k, node] of nodes) {
  if (node.turn !== "w") continue;
  whiteTotal++;
  if (win.has(k)) whiteWin++;
}
console.log(`Total states: ${nodes.size}, White-to-move states: ${whiteTotal}, forced-win-for-White: ${whiteWin} (${(100 * whiteWin / whiteTotal).toFixed(2)}%)`);

// The stage's authored starting shape: knight at (3, 4) (col d, board row 4).
// Report the verdict for every King square reachable from home (rows 7-8)
// against that knight start, plus a scan of ALL king/knight pairs for any
// White-to-move loss to characterize the failure mode if one exists.
const NKX = 3, NKY = 4;
console.log(`\n-- Knight fixed at authored start (col d, row 4) --`);
for (let ky = 7; ky <= 8; ky++) {
  for (let kx = 0; kx < COLS; kx++) {
    if (!isSquare(kx, ky)) continue;
    const k = key(kx, ky, NKX, NKY, "w");
    console.log(`King (${kx},${ky}) vs Knight (${NKX},${NKY}), White to move: ${win.has(k) ? "FORCED WIN" : "NOT a forced win"}`);
  }
}

const losses = [];
for (const [k, node] of nodes) {
  if (node.turn === "w" && !win.has(k)) losses.push(k);
}
console.log(`\nWhite-to-move LOSING states (Black can evade forever, or White is deadlocked): ${losses.length}`);
if (losses.length) {
  console.log("Sample (up to 20):");
  losses.slice(0, 20).forEach(k => console.log("  " + k));
  // Classify: is it a deadlock (zero legal king moves) or a genuine evasion loop?
  let deadlocks = 0;
  for (const k of losses) {
    const node = nodes.get(k);
    if (node.succ.length === 0 && !node.capture) deadlocks++;
  }
  console.log(`Of which immediate King deadlocks (zero legal moves): ${deadlocks}`);
}
