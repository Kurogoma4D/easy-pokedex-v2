# Brand & icon assets

Retro handheld Pokédex branding (DA-3). All marks are pixel art drawn on an
integer dot grid and colored from the design tokens in
`apps/web/src/styles/tokens.css`.

## Sources (edit these)

- `app-icon.svg` — the dot-matrix Poké Ball on a lit LCD screen framed by the
  console bezel. Single source for the favicon and every PNG app-icon size.
- `logo-mark.svg` — the standalone Poké Ball mark (no bezel), for reference. The
  in-app logo is the `app-logo` Angular component, which inlines the same mark
  and pairs it with the wordmark in the pixel display font.

## Generated (do not hand-edit)

`favicon.ico`, `apple-touch-icon.png`, `icon-192.png`, and `icon-512.png` are
rasterized from `app-icon.svg`. Regenerate after editing the SVG:

```sh
cd apps/web/public
for s in 16 32 48 180 192 512; do
  rsvg-convert -w "$s" -h "$s" icons/app-icon.svg -o "/tmp/icon-$s.png"
done
magick /tmp/icon-16.png /tmp/icon-32.png /tmp/icon-48.png favicon.ico
cp /tmp/icon-180.png icons/apple-touch-icon.png
cp /tmp/icon-192.png icons/icon-192.png
cp /tmp/icon-512.png icons/icon-512.png
```

Tools: `rsvg-convert` (librsvg) and `magick` (ImageMagick).

## UI icons

Inline-SVG UI icons (globe, search, filter, chevrons, close) live in
`apps/web/src/app/shared/icon/`. They render through the `app-icon` component,
inherit `currentColor`, and size to `1em`, so they theme with the tokens.
