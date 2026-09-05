#!/usr/bin/env node
// CLI wrapper around lib/strip-classic-html.mjs: reads classic's source
// index1.html on stdin, writes the stripped artifact to stdout. See
// bin/build-site.sh for the call site.
import { stripClassicHtml } from "./lib/strip-classic-html.mjs";

let input = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) input += chunk;

if (!input.trim()) {
  console.error("build-classic-artifact: no input on stdin");
  process.exit(2);
}

process.stdout.write(await stripClassicHtml(input));
