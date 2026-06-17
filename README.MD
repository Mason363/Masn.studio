# Mason Chen | Interactive Terminal Portfolio

A experimental portfolio landing page built as an immersive terminal-inspired experience.

The site uses a retro-futuristic interface, custom cursor snapping, animated stage transitions, and an interactive 3D text scene to showcase a designer/developer aesthetic with dynamic visual states.

## 🚀 What it does

- Displays a command-line inspired splash screen with a typewriter effect for the `whoami` prompt.
- Transitions into a full-screen interactive stage after a snappy scroll animation.
- Renders `MASON CHEN` as a row of 3D letters using Three.js.
- Supports hover and click interactions on letters to cycle between multiple visual states.
- Includes two external link targets: GitHub and MakerWorld.
- Forces landscape orientation on mobile and shows a warning overlay in portrait mode.

## ✨ Visual effects

### Background
- Full-screen canvas with CRT-like grain and static noise.
- Subtle animated flicker for a vintage terminal atmosphere.

### Cursor
- Completely custom cursor overlay replaces the native pointer.
- Cursor snaps to a strict 10x7 grid for a mechanical, terminal-like feel.
- Hovering over interactive elements causes the cursor to lock onto the target and trigger a blink state.

### Stage transition
- Typewriter animation reveals `whoami` character by character.
- After typing completes, the page scrolls in five discrete viewport increments into the second stage.
- Stage 2 hides the initial terminal command and initializes the 3D scene.

### 3D letter states
Each letter in `MASON CHEN` can be clicked or activated with keyboard controls to cycle through 8 visual states:

1. Flat white 2D text
2. Extruded 3D text with shading and tilt
3. Cyan CAD-style blueprint wireframe
4. Orange voxel block structure
5. Neon green ANSI-style cylinder strokes
6. CMY design overlay with chromatic offsets
7. Golden cursive signature tubing
8. Glitchy horizontal slice animation

## 🧠 Interaction

- Mouse movement controls the custom snapping cursor.
- Clicking a letter cycles it through the available visual states.
- Keyboard arrow keys move the cursor through the same 10x7 snap grid.
- `Space` or `Enter` on a letter triggers the same state-cycle action.
- Clicking in the link zones opens external profiles:
  - `GITHUB` opens `https://github.com/Mason363`
  - `MAKERWORLD` opens `https://makerworld.com/en/@roboting`

## 🛠️ Tech stack

- HTML5
- CSS3
- JavaScript (ES Modules)
- Three.js for 3D rendering
- `three/examples/jsm/loaders/FontLoader.js`
- `three/examples/jsm/geometries/TextGeometry.js`

## 📁 Project structure

- `index.html` — main landing page structure
- `src/style.css` — visual styling, layout, and overlay behavior
- `src/main.js` — animation logic, input handling, Three.js scene setup
- `public/fonts/helvetiker_bold.typeface.json` — font asset for 3D text rendering

## 💡 Notes

- Designed for a modern desktop/laptop viewport and landscape mobile orientation.
- Pointer events are handled in a custom way to preserve the terminal-style cursor experience.
- The 3D scene is built from procedural groups and animations rather than relying on pre-made models.

## 📌 How to run

```bash
npx run dev
```

Then open `http://localhost:300`. (or whatever port you hosted it on)

## 🔗 Links

- GitHub: https://github.com/Mason363
- MakerWorld: https://makerworld.com/en/@roboting
