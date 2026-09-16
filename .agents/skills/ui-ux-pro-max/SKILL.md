---
name: ui-ux-pro-max
description: >
  AI-powered design intelligence toolkit with searchable databases of UI styles, color palettes,
  font pairings, chart types, GSAP animations, and UX guidelines. Use when you need design
  inspiration, color palette recommendations, typography pairings, UI style references
  (glassmorphism, brutalism, minimalism), chart type guidance, icon recommendations, or
  GSAP animation skeletons. Trigger on "what color palette", "font pairing", "UI style for",
  "best chart for", "design inspiration", "gsap animation", "icon set", or "UX best practice".
---

# UI UX Pro Max — Design Intelligence Toolkit

Searchable database of curated UI/UX design resources. Use the search script to query design data.

## Search Command

```bash
python3 src/ui-ux-pro-max/scripts/search.py "<query>" --domain <domain> [-n <max_results>]
```

**Domain options:**
| Domain | What it returns |
|--------|----------------|
| `style` | UI styles (glassmorphism, minimalism, brutalism) + CSS keywords & AI prompts |
| `typography` | Font pairings with Google Fonts imports |
| `color` | Color palettes by product type |
| `chart` | Chart types and library recommendations |
| `ux` | Best practices and anti-patterns |
| `icons` | Icon recommendations (Phosphor, Heroicons, Lucide) with import code |
| `gsap` | GSAP animation skeletons (hover, scroll reveal, stagger, page transition, parallax) |
| `product` | Product type recommendations (SaaS, e-commerce, portfolio) |
| `landing` | Page structure and CTA strategies |
| `react` | React/Next.js performance patterns |
| `web` | Web/app interface guidelines |
| `google-fonts` | Individual Google Fonts lookup |

## Design System Mode (Advanced)

```bash
python3 src/ui-ux-pro-max/scripts/search.py "<query>" --design-system --variance <1-10> --motion <1-10> --density <1-10>
```

- `--variance` (1-10): minimal/centered → bold/asymmetric
- `--motion` (1-10): attaches matching GSAP snippet
- `--density` (1-10): spacious → dense/dashboard layout

## Stack-Specific Search

```bash
python3 src/ui-ux-pro-max/scripts/search.py "<query>" --stack <stack>
```

Available stacks: `html-tailwind` (default), `react`, `nextjs`, `astro`, `vue`, `nuxtjs`, `svelte`, `swiftui`, `react-native`, `flutter`, `shadcn`, `threejs`, `angular`

## Workflow

1. Run search to get design recommendations for the user's product type/style
2. Apply the typography, color, and style recommendations to the component/page
3. Use GSAP snippets for animations when motion is needed
4. Reference icon recommendations for consistent iconography

## Data Location

All canonical CSV databases are at: `src/ui-ux-pro-max/data/`
Stack-specific guidelines at: `src/ui-ux-pro-max/data/stacks/`
