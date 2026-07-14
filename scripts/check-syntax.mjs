// Syntax-only guard for the inline <script> in index1.html -- this file has
// no build step, so a typo here would otherwise only surface by opening it
// in a browser. Extracts the script block and hands it to `node --check`,
// which parses without executing (so it doesn't matter that `document` etc.
// aren't defined outside a browser).
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const html = readFileSync(path.join(root, "index1.html"), "utf8");
const match = html.match(/<script>([\s\S]*?)<\/script>/);

if (!match) {
  console.error("check-syntax: no <script> block found in index1.html");
  process.exit(1);
}

const tmp = path.join(os.tmpdir(), "chezz-inline-script-check.js");
writeFileSync(tmp, match[1]);
execFileSync(process.execPath, ["--check", tmp], { stdio: "inherit" });
console.log("check-syntax: index1.html inline <script> OK");
