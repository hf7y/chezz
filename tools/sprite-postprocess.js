/* Turns one raw generated image into a chezz piece sprite.
 *
 * Deliberately a plain browser script, not a Node module: the only image
 * decoder/resampler this repo already has is the one inside the Playwright
 * chromium that `npm test` runs anyway. Doing the pixel work on a <canvas>
 * means the sprite pipeline adds ZERO new runtime dependencies (no pngjs, no
 * sharp, no Python/Pillow) -- tools/generate-pieces.mjs drives a headless page
 * and calls this, and test/sprite-postprocess.spec.mjs loads this exact same
 * file and asserts against it. One implementation, two consumers.
 *
 * Defines window.postprocessSprite(dataUri, opts) -> Promise<png data URI>.
 */
(() => {
  // The game's own monochrome ramp (index1.html's :root --ink/--panel/--pink/
  // --gold/--cream). Sprites quantize INTO this rather than carrying whatever
  // colors the generator felt like: the monochrome palette is a standing
  // design constraint (repeated explicit reporter ask, see FOCUS.md), so a
  // sprite that arrived faintly blue-grey would quietly violate it. Because
  // every output pixel is snapped to one of these, palette conformance is a
  // property of the pipeline, not of how well a prompt was followed.
  const PALETTE = [0x0a, 0x2e, 0x8a, 0xe8, 0xf2];

  // Background detection is a CHROMA key, not a brightness threshold: the
  // pieces themselves span the full black-to-white range (that's the whole
  // point of a monochrome ramp), so "dark pixels are background" would eat a
  // black king's body. The generator is told to put the piece on a saturated
  // magenta field instead -- a color that cannot occur in monochrome art, so
  // separating them needs no guesswork about the art's own tones.
  const SATURATION_THRESHOLD = 60; // max-min channel spread, 0..255

  const isBackground = (r, g, b) =>
    Math.max(r, g, b) - Math.min(r, g, b) > SATURATION_THRESHOLD;

  // Fit-to-canvas scale stops short of the full size, so the cropped content
  // sits with visible air around it instead of touching the sprite's own
  // edges -- otherwise the piece then sits flush against its board cell's
  // edges too, with no CSS padding to fall back on the way a Unicode glyph's
  // font metrics give it for free (tracker 2026-07-29T04:37:19: "no padding
  // in square").
  const FILL_FRACTION = 0.82;

  // Rec. 601 luma -- matches how the eye weights the channels, so a
  // mid-yellow and a mid-blue don't both collapse to the same grey.
  const luma = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

  const snapToPalette = (value) =>
    PALETTE.reduce((best, p) =>
      Math.abs(p - value) < Math.abs(best - value) ? p : best);

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("could not decode generated image"));
      img.src = src;
    });
  }

  function canvasOf(width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  /* Tight bounding box of everything that isn't the chroma-key field. The
   * generator returns a large canvas with the piece somewhere inside it and no
   * promise about margins, so cropping to content is what makes every sprite
   * in the set occupy its cell the same way -- without it, a king drawn small
   * in a big frame and a pawn drawn edge-to-edge would render at wildly
   * different apparent sizes on the board. */
  function contentBox(ctx, width, height) {
    const { data } = ctx.getImageData(0, 0, width, height);
    let minX = width, minY = height, maxX = -1, maxY = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (data[i + 3] < 128) continue;
        if (isBackground(data[i], data[i + 1], data[i + 2])) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (maxX < 0) return null; // nothing but background -- caller decides
    return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  }

  window.postprocessSprite = async function postprocessSprite(dataUri, opts = {}) {
    const size = opts.size || 32;
    const img = await loadImage(dataUri);

    const src = canvasOf(img.naturalWidth, img.naturalHeight);
    const srcCtx = src.getContext("2d", { willReadFrequently: true });
    srcCtx.drawImage(img, 0, 0);

    const box = contentBox(srcCtx, src.width, src.height);
    if (!box) throw new Error("generated image is entirely background -- nothing to crop");

    // Scaled to FIT the square (not stretched to fill it) and centered, so a
    // tall king and a squat pawn keep their real relative proportions instead
    // of every piece being distorted into the same silhouette. FILL_FRACTION
    // leaves margin on the maxed dimension rather than touching the canvas
    // edge -- see its own comment above.
    const scale = Math.min(size / box.width, size / box.height) * FILL_FRACTION;
    const drawWidth = Math.max(1, Math.round(box.width * scale));
    const drawHeight = Math.max(1, Math.round(box.height * scale));

    const out = canvasOf(size, size);
    const ctx = out.getContext("2d", { willReadFrequently: true });
    // Smoothing ON for the downsample itself: this is a big-to-small reduction,
    // where averaging is what preserves detail (nearest-neighbour would alias
    // thin features like a bishop's mitre slit away entirely). The pixel-art
    // look comes from the low target resolution plus the palette snap below,
    // and from image-rendering:pixelated when it's scaled back UP for display.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      src, box.x, box.y, box.width, box.height,
      Math.floor((size - drawWidth) / 2), Math.floor((size - drawHeight) / 2),
      drawWidth, drawHeight,
    );

    const image = ctx.getImageData(0, 0, size, size);
    const px = image.data;
    for (let i = 0; i < px.length; i += 4) {
      // Binary alpha, no partial transparency: the downsample blends piece
      // edges into the magenta field, and a half-transparent magenta fringe
      // would read as a colored halo around every piece on the board -- the
      // one thing a monochrome palette cannot have.
      if (px[i + 3] < 128 || isBackground(px[i], px[i + 1], px[i + 2])) {
        px[i] = px[i + 1] = px[i + 2] = px[i + 3] = 0;
        continue;
      }
      const grey = snapToPalette(luma(px[i], px[i + 1], px[i + 2]));
      px[i] = px[i + 1] = px[i + 2] = grey;
      px[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    return out.toDataURL("image/png");
  };

  window.SPRITE_PALETTE = PALETTE;
})();
