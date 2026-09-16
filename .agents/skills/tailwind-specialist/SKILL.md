---
name: tailwind-specialist
description: Master Tailwind CSS architecture, responsive design systems, fluid typography, utility-first patterns, and agency-grade UI components with zero CSS bloat.
risk: low
source_type: community
date_added: 2026-09-15
license: MIT
author: Antigravity Skills
---

# Tailwind CSS Specialist

Master Tailwind CSS architecture, responsive UI design systems, fluid layout composition, and agency-grade aesthetic engineering.

## When to Use

Use this skill when:
- Designing or implementing frontend interfaces using Tailwind CSS (v3 or v4).
- Creating custom Tailwind theme configurations, design tokens, color palettes, and typography scales.
- Refactoring bulky CSS stylesheets into clean, composable utility classes.
- Building complex, responsive layouts with Flexbox, CSS Grid, and adaptive breakpoints (`sm`, `md`, `lg`, `xl`, `2xl`).
- Crafting micro-interactions, smooth hover transitions, glassmorphism, dark/light themes, and dashboard widgets.

## Core Architectural Invariants

### 1. Token-Driven Design
- **Never use random arbitrary hex values** (`text-[#12d9a0]`, `bg-[#0f172a]`) when semantic tokens exist.
- Map brand and theme colors in `tailwind.config.js` or theme CSS variables (`bg-primary`, `text-muted`, `border-border`, `accent-gold`).
- Ensure consistent spacing: enforce the 4px/8px scale (`gap-2`, `gap-4`, `p-4`, `p-6`, `space-y-4`).

### 2. Layout & Responsive Hierarchy
- **Mobile-First Breakpoints**: Always define base styles for mobile, then layer upward (`w-full md:w-1/2 lg:w-1/3`).
- **CSS Grid for Dashboards**: Use `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4` for KPI cards and data grids.
- **Flexbox for Alignment**: Use `flex items-center justify-between gap-3` for headers, action bars, and list items.

### 3. Typography & Micro-Interactions
- **Font Pairing**: Use modern typography classes (`font-sans font-bold tracking-tight text-slate-900 dark:text-white`).
- **Interactive States**: Every clickable element must have subtle hover and focus feedback:
  - `transition-all duration-150 ease-in-out`
  - `hover:bg-opacity-90 active:scale-95`
  - `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2`
- **Soft Depth & Elevation**: Combine subtle borders with delicate drop shadows:
  - `border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md rounded-xl`

### 4. Component Patterns
- **Cards & Surfaces**:
  ```html
  <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
    <!-- Card Content -->
  </div>
  ```
- **Action Buttons**:
  ```html
  <button class="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-transform active:scale-95">
    <span>Salvar</span>
  </button>
  ```
- **KPI Indicators**:
  ```html
  <div class="flex items-center gap-2 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
    <span>🟢 No Prazo</span>
  </div>
  ```

## Anti-Patterns to Avoid
- **Class Soup Overload**: Do not paste 40 unorganized utility classes without structural grouping (Layout → Spacing → Typography → Colors → States).
- **Hardcoded Media Queries in CSS**: Leverage Tailwind's responsive prefixes (`md:`, `lg:`) instead of ad-hoc `@media` blocks.
- **Ignoring Dark Mode**: Always consider both light and dark modes (`bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100`).
- **Overriding with `!important`**: Use specific modifier classes or proper stacking context rather than `!` hacks.
