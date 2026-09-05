// hf7y/chezz#90: the classic artifact ships stripped; the chezz-classic
// source it's built from keeps every comment. Line-based on purpose --
// only comment lines that are a WHOLE line (after trimming) are dropped,
// so a trailing `/* note */` after real code on the same line is left
// alone rather than risking a regex eating code that precedes it.
export function stripHtml(source) {
  const lines = source.split("\n");
  const out = [];
  let state = null; // null | "block" (/* */) | "html" (<!-- -->)

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (state === "block") {
      if (trimmed.endsWith("*/")) state = null;
      continue;
    }
    if (state === "html") {
      if (trimmed.endsWith("-->")) state = null;
      continue;
    }
    if (trimmed === "") continue;
    if (trimmed.startsWith("//")) continue;
    if (trimmed.startsWith("/*")) {
      if (!(trimmed.endsWith("*/") && trimmed.length > 2)) state = "block";
      continue;
    }
    if (trimmed.startsWith("<!--")) {
      if (!(trimmed.endsWith("-->") && trimmed.length > 6)) state = "html";
      continue;
    }

    out.push(trimmed);
  }

  return out.join("\n") + "\n";
}

// CLI mode -- stdin to stdout -- so bin/build-site.sh can pipe the classic
// artifact through this without a second, shell-only reimplementation.
if (import.meta.url === `file://${process.argv[1]}`) {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  process.stdout.write(stripHtml(Buffer.concat(chunks).toString("utf8")));
}
