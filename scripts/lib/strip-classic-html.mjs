// hf7y/chezz#90: "Build step now: ship stripped, keep source" (Zach,
// 2026-09-04). Comments and indentation are 24,635 + 6,781 of classic's
// 70,822 measured bytes -- none of it a feature -- so this strips comments
// and whitespace only. compress/mangle stay off: this is not a minifier
// swapping in shorter names or restructured logic, only the byte cost of
// human-readable formatting.
import { minify } from "html-minifier-terser";

export async function stripClassicHtml(html) {
  return minify(html, {
    collapseWhitespace: true,
    removeComments: true,
    minifyCSS: true,
    minifyJS: { compress: false, mangle: false, format: { comments: false } },
  });
}
