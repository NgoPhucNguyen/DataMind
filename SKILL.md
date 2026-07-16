---
name: minimalist-ui
description: Clean editorial-style interfaces. Warm monochrome palette, typographic contrast, flat bento grids, muted pastels. No gradients, no heavy shadows.
---

# Protocol: Premium Utilitarian Minimalism UI Architect

## 1. Protocol Overview
Name: Premium Utilitarian Minimalism & Editorial UI
Description: An advanced frontend engineering directive for generating highly refined, ultra-minimalist, "document-style" web interfaces analogous to top-tier workspace platforms. This protocol strictly enforces a high-contrast warm monochrome palette, bespoke typographic hierarchies, meticulous structural macro-whitespace, bento-grid layouts, and an ultra-flat component architecture with deliberate muted pastel accents. It actively rejects standard generic SaaS design trends.

## 2. Absolute Negative Constraints (Banned Elements)
The AI must strictly avoid the following generic web development defaults:
- DO NOT use the "Inter", "Roboto", or "Open Sans" typefaces.
- DO NOT use generic, thin-line icon libraries like "Lucide", "Feather", or standard "Heroicons".
- DO NOT use Tailwind's default heavy drop shadows (e.g., `shadow-md`, `shadow-lg`, `shadow-xl`). Shadows must be practically non-existent or heavily customized to be ultra-diffuse and low opacity (< 0.05).
- DO NOT use primary colored backgrounds for large elements or sections (e.g., no bright blue, green, or red hero sections).
- DO NOT use gradients, neon colors, or 3D glassmorphism (beyond subtle navbar blurs).
- DO NOT use `rounded-full` (pill shapes) for large containers, cards, or primary buttons.
- DO NOT use emojis anywhere in code, markup, text content, headings, or alt text. Replace with proper icons or clean SVG primitives.
- DO NOT use generic placeholder names like "John Doe", "Acme Corp", or "Lorem Ipsum". Use realistic, contextual content.
- DO NOT use AI copywriting clichés: "Elevate", "Seamless", "Unleash", "Next-Gen", "Game-changer", "Delve". Write plain, specific language.

## 3. Typographic Architecture
The interface must rely on extreme typographic contrast and premium font selection to establish an editorial feel.

> **Vietnamese Language Note:** Standard Western fonts (SF Pro, Geist, Helvetica) suffer from diacritic misalignment at small/large sizes in Vietnamese UIs, causing marks to overlap or trigger system font fallback. Always prefer the Vietnamese-optimized stack below.

- Primary Sans-Serif (Body, UI, Buttons, Data Grids): **`Be Vietnam Pro`** as the primary choice, with **`Plus Jakarta Sans`** as fallback. Target: `font-family: 'Be Vietnam Pro', 'Plus Jakarta Sans', 'Geist Sans', sans-serif`. `Be Vietnam Pro` is engineered by Vietnamese designers specifically for precise diacritic spacing — marks never collide at `text-xs` (12px) on data tables or break at display sizes. Delivers the same clean, tech-forward feel as SF Pro or Geist.
- Editorial Serif (Hero Headings & Quotes): **`Newsreader`** as the primary choice, with **`Lora`** as fallback. Target: `font-family: 'Newsreader', 'Lora', 'Instrument Serif', serif`. These avoid the broken-stroke issue of standard Western serifs when rendering heavy Vietnamese diacritics. Apply tight tracking (`letter-spacing: -0.02em` to `-0.04em`) and tight line-height (`1.15`).
- Monospace (Code, Keystrokes, Meta-data): Target: `font-family: 'Geist Mono', 'SF Mono', 'JetBrains Mono', monospace`.
- Text Colors: Body text must never be absolute black (`#000000`). Use off-black with a green undertone (`#121A14`) with a generous `line-height` of `1.6` for legibility. Secondary text should be muted sage (`#626C65`).
- Rendering: Always set `-webkit-font-smoothing: antialiased` on `body` to ensure Vietnamese diacritics render crisply on retina displays.

## 4. Color Palette (Muted Green + Warm Monochrome)
Color is a scarce resource, utilized only for semantic meaning or subtle accents. For DataMind-style data products, replace the neutral warm monochrome base with a **Nordic/Sage Green** palette — avoid neon or bright SaaS greens entirely.

| Role | Hex | Usage |
|---|---|---|
| **Canvas / Background** | `#FBFBFA` | Warm off-white, never pure `#FFFFFF` — reduces eye strain on long analytical sessions. |
| **Primary Text** | `#121A14` | Off-black with a deep green undertone. More alive than neutral charcoal. |
| **Muted / Secondary Text** | `#626C65` | Sage-tinted gray for labels, captions, metadata. |
| **Deep Forest Green** | `#1B4324` | Primary accent: emphasized text, positive growth indicators, button borders, active nav states. |
| **Pale Sage Green** | `#EAF2EB` | Secondary accent: tag backgrounds, cleaned-data row highlights, hovered card states. |
| **Primary Surface (Cards)** | `#FFFFFF` or `#F9F9F8` | Card backgrounds over the warm canvas. |
| **Structural Borders / Dividers** | `#EAEAEA` or `rgba(0,0,0,0.06)` | 1px borders for bento cards, dividers, table cells. |

- Accent Spot Colors (semantic tags only): Use exclusively highly desaturated, washed-out pastels.
  - Pale Green (Primary — Cleaned/Positive): `#EAF2EB` (Text: `#1B4324`)
  - Pale Red (Error/Warning): `#FDEBEC` (Text: `#9F2F2D`)
  - Pale Blue (Info): `#E1F3FE` (Text: `#1F6C9F`)
  - Pale Yellow (Caution): `#FBF3DB` (Text: `#956400`)

## 5. Component Specifications
- Bento Box Feature Grids:
  - Utilize asymmetrical CSS Grid layouts.
  - Cards must have exactly `border: 1px solid #EAEAEA`.
  - Border-radius must be crisp: `8px` or `12px` maximum.
  - Internal padding must be generous (e.g., `24px` to `40px`).
- Primary Call-To-Action (Buttons):
  - Solid background `#111111`, text `#FFFFFF`. 
  - Slight border-radius (`4px` to `6px`). No box-shadow. 
  - Hover state should be a subtle color shift to `#333333` or a micro-scale `transform: scale(0.98)`.
- Tags & Status Badges:
  - Pill-shaped (`border-radius: 9999px`), very small typography (`text-xs`), uppercase with wide tracking (`letter-spacing: 0.05em`).
  - Background must use the defined Muted Pastels.
- Accordions (FAQ):
  - Strip all container boxes. Separate items only with a `border-bottom: 1px solid #EAEAEA`.
  - Use a clean, sharp `+` and `-` icon for the toggle state.
- Keystroke Micro-UIs:
  - Render shortcuts as physical keys using `<kbd>` tags: `border: 1px solid #EAEAEA`, `border-radius: 4px`, `background: #F7F6F3`, using the Monospace font.
- Faux-OS Window Chrome:
  - When mocking up software, wrap it in a minimalist container with a white top bar containing three small, light gray circles (replicating macOS window controls).

## 6. Iconography & Imagery Directives
- System Icons: Use "Phosphor Icons (Bold or Fill weights)" or "Radix UI Icons" for a technical, slightly thicker-stroke aesthetic. Standardize stroke width across all icons.
- Illustrations: Monochromatic, rough continuous-line ink sketches on a white background, featuring a single offset geometric shape filled with a muted pastel color.
- Photography: Use high-quality, desaturated images with a warm tone. Apply subtle overlays (`opacity: 0.04` warm grain) to blend photos into the monochrome palette. Never use oversaturated stock photos. Use reliable placeholders like `https://picsum.photos/seed/{context}/1200/800` when real assets are unavailable.
- Hero & Section Backgrounds: Sections should not feel empty and flat. Use subtle full-width background imagery at very low opacity, soft radial light spots (`radial-gradient` with warm tones at `opacity: 0.03`), or minimal geometric line patterns to add depth without breaking the clean aesthetic.

## 7. Subtle Motion & Micro-Animations
Motion should feel invisible — present but never distracting. The goal is quiet sophistication, not spectacle.
- Scroll Entry: Elements fade in gently as they enter the viewport. Use `translateY(12px)` + `opacity: 0` resolving over `600ms` with `cubic-bezier(0.16, 1, 0.3, 1)`. Use `IntersectionObserver`, never `window.addEventListener('scroll')`.
- Hover States: Cards lift with an ultra-subtle shadow shift (`box-shadow` transitioning from `0 0 0` to `0 2px 8px rgba(0,0,0,0.04)` over `200ms`). Buttons respond with `scale(0.98)` on `:active`.
- Staggered Reveals: Lists and grid items enter with a cascade delay (`animation-delay: calc(var(--index) * 80ms)`). Never mount everything at once.
- Background Ambient Motion: Optional. A single, very slow-moving radial gradient blob (`animation-duration: 20s+`, `opacity: 0.02-0.04`) drifting behind hero sections. Must be applied to a `position: fixed; pointer-events: none` layer. Never on scrolling containers.
- Performance: Animate exclusively via `transform` and `opacity`. No layout-triggering properties (`top`, `left`, `width`, `height`). Use `will-change: transform` sparingly and only on actively animating elements.

## 8. Execution Protocol
When tasked with writing frontend code (HTML, React, Tailwind, Vue) or designing a layout:
1. Establish the macro-whitespace first. Use massive vertical padding between sections (e.g., `py-24` or `py-32` in Tailwind).
2. Constrain the main typography content width to `max-w-4xl` or `max-w-5xl`.
3. Apply the custom typographic hierarchy and monochromatic color variables immediately.
4. Ensure every card, divider, and border adheres strictly to the `1px solid #EAEAEA` rule.
5. Add scroll-entry animations to all major content blocks.
6. Ensure sections have visual depth through imagery, ambient gradients, or subtle textures — no empty flat backgrounds.
7. Provide code that reflects this high-end, uncluttered, editorial aesthetic natively without requiring manual adjustments.