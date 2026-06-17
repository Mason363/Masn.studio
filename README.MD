# Mason Chen — Interactive Terminal Portfolio

A single-page portfolio reimagined as a retro-futuristic terminal. It boots like a
console, types out a `whoami`, then drops you into an interactive 3D scene where the
name **MASON CHEN** is rendered as tactile letters you can click to morph through
eight distinct visual styles — all navigated with a custom, grid-snapping block cursor.

🔗 **Live:** [masn.studio](https://masn.studio) · [GitHub](https://github.com/Mason363) · [MakerWorld](https://makerworld.com/en/@roboting)

---

## Highlights

- **Boot sequence** — a command-line splash types `% whoami` character by character,
  then "scrolls" into the main stage in discrete, mechanical increments.
- **Interactive 3D type** — `MASON CHEN` is built procedurally with Three.js. Click
  (or arrow-key + `Space`/`Enter`) any letter to cycle it through 8 styles.
- **Custom block cursor** — the native pointer is hidden and replaced by a cursor that
  snaps to a strict 10×7 grid, locking onto letters and links as you move.
- **CRT atmosphere** — a full-screen canvas layers animated film grain and static for a
  vintage-monitor feel.
- **Forced landscape** — on portrait devices the whole UI rotates to render in landscape,
  with pointer coordinates transformed to match.

## The eight letter states

Each letter animates between these representations, in order:

| # | Style | Look |
|---|-------|------|
| 0 | Flat type | Clean white 2D glyph (default) |
| 1 | Extruded 3D | Shaded, tilted, beveled relief |
| 2 | CAD blueprint | Cyan wireframe that traces itself in |
| 3 | Voxel blocks | Terracotta-orange blocks that extrude out |
| 4 | Neon ASCII | Glowing green cylinder strokes |
| 5 | Chromatic print | CMY layers offset like misregistered ink |
| 6 | Signature | Golden cursive tube that "writes" itself |
| 7 | Glitch | White slices that flicker and slide apart |

## Controls

| Action | Result |
|--------|--------|
| Move mouse | Drive the snapping block cursor |
| Click a letter | Cycle that letter to its next style |
| Arrow keys | Move the cursor cell by cell across the grid |
| `Space` / `Enter` | Activate the focused letter (same as a click) |
| Click `GITHUB` / `MAKERWORLD` | Open the respective profile |

## Tech stack

- **[Vite](https://vitejs.dev/)** — dev server and build tooling
- **[Three.js](https://threejs.org/)** — WebGL rendering, `TextGeometry`, `FontLoader`
- Vanilla **HTML / CSS / ES modules** — no UI framework
- A second 2D `<canvas>` for the CRT grain layer

## Getting started

```bash
# install dependencies
npm install

# start the dev server (http://localhost:5173)
npm run dev

# build for production into dist/
npm run build

# preview the production build locally
npm run preview
```

> Best experienced on a desktop/laptop or a phone in landscape.

## Project structure

```
.
├── index.html                       # Page shell and stage markup
├── src/
│   ├── main.js                      # Stage flow, input handling, Three.js scene & states
│   └── style.css                    # Layout, CRT canvas, cursor, rotation handling
├── public/
│   ├── favicon.png                  # Rounded MC icon
│   └── fonts/
│       └── helvetiker_bold.typeface.json   # Font used to extrude the 3D letters
└── package.json
```

## Notes

- The 3D letters are generated entirely from procedural geometry and animation — there
  are no pre-made models.
- Hit-testing is grid-based: each letter "owns" a stable home cell so the cursor and
  click targets stay locked to it regardless of which style is animating.

## License

Personal project — all rights reserved. Feel free to explore the code for reference.
