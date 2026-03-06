# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server (Vite HMR)
npm run build     # Production build
npm run lint      # ESLint (flat config, ESLint 9)
npm run preview   # Preview production build
```

No test suite is configured.

## Architecture

**PawTag 3D** follows a modular React pattern to ensure scalability and maintainability.

### Core Structure
- `App.jsx`: Main entry point, handles high-level routing (Editor vs. PetCard).
- `src/hooks/`: Custom hooks for state management.
  - `useTagEditor.js`: Encapsulates all editor state and business logic.
  - `useCardHash.js`: Manages reactive URL hash updates.
- `src/components/TagEditor/`: Modular UI components for the editor.
  - `Sidebar.jsx`: Form inputs and primary controls.
  - `WelcomeWizard.jsx`: Onboarding flow.
  - `TutorialModal.jsx`: Export and NFC instructions.

### Routing (hash-based)
- Managed by `useCardHash.js`.
- URL encoding includes dictionary encoding, lz-string, and pipe-delimited strategies to minimize QR complexity.

### 3D Geometry Pipeline (`src/utils/geometry.js`)
- All geometry built with `ExtrudeGeometry` — **no CSG**.
- Coordinate system in mm: disc on XY plane, front face at +Z, back face at -Z.
- Use `buildTagMesh()` to generate the `THREE.Group`.

### Export (`src/utils/exporter.js`)
- **STL**: Merged binary STL.
- **3MF**: Multi-material export with `model_settings.config`.

### Preview (`src/components/TagScene.jsx`)
- React Three Fiber canvas with OrbitControls and static lighting.
- Z-fighting prevention: QR fill uses `renderOrder=1`; text fill uses `polygonOffset`.

### i18n (`src/i18n.js`)
- 5 languages: IT, EN, ES, FR, DE via JSON files in `src/locales/`
- Auto-detected from browser/localStorage via `i18next-browser-languagedetector`

### NFC Mode
- Optional: writes URL to NFC tag via Web NFC API (`NDEFReader`)
- Requires 25mm coin-cell NFC tags
- When enabled, adds a cavity to the 3D model for embedding the NFC tag

## Key Constraints
- `three-csg-ts` is installed but **not used** — do not introduce CSG operations
- All geometry dimensions are in millimeters matching real print dimensions
- The `BITMAP_FONT` in `geometry.js` defines printable characters; adding new chars requires editing that constant
