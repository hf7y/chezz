import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const GAME_URL = "file://" + path.join(root, "index1.html");

// An empty 9x8 board with a lone White King -- the minimal realistic
// starting point for testing spawn/search logic in isolation, without
// depending on whatever the real game's opening position happens to be.
export function emptyBoardWithKing(x = 4, y = 8) {
  const board = Array.from({ length: 9 }, () => Array(8).fill(""));
  board[y][x] = "K";
  return board;
}

export function fenRowsToBoard(fen) {
  return fen.split("-").map(row =>
    row.split("").flatMap(ch => "12345678".includes(ch) ? Array(Number(ch)).fill("") : ch)
  );
}
