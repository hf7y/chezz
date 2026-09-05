// hf7y/chezz#90. Only drops WHOLE comment lines -- a trailing `/* note */`
// after real code stays.
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

// CLI mode: stdin to stdout, for bin/build-site.sh.
if (import.meta.url === `file://${process.argv[1]}`) {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  process.stdout.write(stripHtml(Buffer.concat(chunks).toString("utf8")));
}
