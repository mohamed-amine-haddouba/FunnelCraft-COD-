# Implementation Plan: Global Theme Toggle & Unified Dark Brand Styling

## 1. Overview
Enforce the dark brand aesthetic across all builder, dashboard, modal, and input components, provide a global Light/Dark mode switcher via a new `ThemeContext`, and fix the bright Canvas editor surroundings to match the Deep Night (`#0D131E`) theme.

---

## 2. Changes to Implement

### Step 1: Create `src/context/ThemeContext.tsx`
- Create `ThemeContext` managing `'dark' | 'light'`.
- Default to `'dark'`.
- Persist user preference in `localStorage` (`'funnelcraft_theme'`).
- Toggle the `dark` class on `document.documentElement` dynamically.
- Export `ThemeProvider` and `useTheme()`.

### Step 2: Update `src/index.css`
- Configure `:root` (light) and `.dark` (dark) variables for `--bg-primary`, `--bg-surface`, `--text-primary`, and `--accent`.
- Remove legacy CSS rules that forced `select`, `select option`, `aside input`, and `textarea` to `background-color: #ffffff !important` and dark text.
- Replace with theme-adaptive styling: in dark mode, inputs/selects use `#0F172A` / `#131B2A` with `#F8FAFC` text and `#1E293B` borders.

### Step 3: Add Sun/Moon Toggle to `src/components/HeaderNav.tsx`
- Import `useTheme` from `../context/ThemeContext`.
- Add a toggle button with `Sun` and `Moon` icons from `lucide-react`.
- Place the button in the top header right next to the user profile and language controls.
- Style with subtle glow and smooth transition.

### Step 4: Fix Builder Canvas Background in `src/components/CanvasRenderer.tsx`
- Replace `bg-[#f8fafc]` and light radial background in `CanvasRenderer.tsx` with `#0D131E` and a subtle dark radial grid pattern (`#1E293B`).
- Also update `App.tsx` scraped view container background from `bg-slate-100` to `#0D131E`.

### Step 5: Wrap App with `ThemeProvider`
- In `src/App.tsx`, wrap the application tree in `<ThemeProvider>`.

---

## 3. Verification & Testing
- Run `npx tsc --noEmit` to verify type safety.
- Run `npm run build` to verify clean compilation.
- Verify toggle switches between dark and light modes, and inputs/selects in OrdersDashboard and PropertiesSidebar render with dark styling.
