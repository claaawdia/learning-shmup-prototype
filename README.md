# learning-shmup-prototype

Browser-based 2D scrolling shooter roguelite prototype with learning/hacking events.

## Current prototype goal

A tiny playable vertical slice that proves the core loop:

- fly a ship through a short level section
- shoot simple enemies
- enter a learning gate
- solve a quick math task
- receive a meaningful reward for the rest of the run segment

## Tech

- Phaser 3
- TypeScript
- Vite

## Local development

```bash
npm install
npm run dev
```

Then open the local Vite URL in your browser.

## Prototype controls

- Arrow keys: move
- Space: shoot
- Fly into the yellow learning gate
- In the learning scene: Up/Down + Enter

## Next steps

- replace placeholder graphics with simple ship/enemy sprites
- add a short segment system
- add one English learning mode
- add a proper reward and run-state layer
- add a cleaner scene transition into the hack/learning mode
