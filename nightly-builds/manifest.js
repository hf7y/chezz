// Nightly-builds manifest (priority queue item 9, .scheduler/FOCUS.md).
// A plain array of { date, label, file, note } -- one entry per kept-but-
// not-merged over-cap build. Appended to by hand (or by a future nightly
// run), never generated. `file` is relative to this folder.
//
// A <script src> instead of fetch("manifest.json"): this folder is served
// both from GitHub Pages (https) and loaded directly off disk in tests
// (file://), and Chromium blocks same-origin fetch() from a file:// page --
// a plain script tag has no such restriction in either context.
window.NIGHTLY_BUILDS = [];
