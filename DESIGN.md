# Design Brief

## Direction

Arcade Cabinet — a pixel-perfect retro Pac-Man game with a black void stage, neon-blue maze walls, and the classic 1980s ghost palette rendered on a full-viewport canvas.

## Tone

CRT-era arcade maximalism executed with conviction: pure black stage, glowing neon outlines, sharp pixel edges, no soft modern gradients — the cabinet glow is the whole aesthetic.

## Differentiation

The maze itself is the hero — double-line neon-blue walls with bloom, scanned CRT texture, and four ghosts with their canonical colors create an unmistakable arcade silhouette on a true-black void.

## Color Palette

| Token        | OKLCH          | Role                                   |
| ------------ | -------------- | -------------------------------------- |
| background   | 0 0 0          | Pure black void stage                  |
| foreground   | 0.95 0.02 90   | Warm white HUD text / pellets           |
| card         | 0.12 0.02 250  | Overlay panels (start/game-over)       |
| primary      | 0.88 0.17 90   | Pac-Man yellow — CTAs, score accents    |
| accent       | 0.62 0.18 250  | Neon blue — maze walls, active states   |
| secondary    | 0.62 0.18 250  | Neon blue surfaces                     |
| muted        | 0.18 0.03 250  | Inactive HUD zones                      |
| destructive  | 0.58 0.21 27   | Blinky red — death / game-over          |
| chart-1..5   | ghost palette  | Blinky red, Pinky pink, Inky cyan, Clyde orange, frightened blue |

## Typography

- Display: Space Grotesk — game title, screen headings (geometric retro-tech)
- Mono: JetBrains Mono — HUD scores, level, labels (arcade readout feel)
- Scale: hero `text-5xl md:text-7xl font-bold tracking-tight`, h2 `text-3xl md:text-5xl`, label `text-sm font-semibold tracking-widest uppercase font-mono`, body `text-base font-mono`

## Elevation & Depth

No drop shadows on cards — depth comes from neon glow (`neon-glow` utility on maze + accents) and the fixed CRT scanline/vignette body texture. Overlays are flat near-black panels with neon-blue borders.

## Structural Zones

| Zone      | Background              | Border                  | Notes                                       |
| --------- | ----------------------- | ----------------------- | ------------------------------------------- |
| HUD top   | transparent over black  | —                       | Mono text, yellow score glow, lives as wedges |
| Canvas    | pure black              | neon-blue wall lines    | Centerpiece; `pixel-crisp` rendering          |
| Overlay   | card (0.12 0.02 250)    | accent neon-blue        | Start / game-over / level-transition panels  |
| Controls  | muted/40 on touch only  | accent neon-blue        | D-pad arrows, hidden on desktop              |

## Spacing & Rhythm

Tight arcade density — HUD hugs the canvas top, overlays center with `p-6`, control pad anchors bottom with `gap-2`. Section gaps are minimal; the maze fills available viewport.

## Component Patterns

- Buttons: sharp `radius` 0.125rem, primary yellow fill + `neon-glow-yellow`, hover brightens
- Cards/overlays: flat near-black, neon-blue 1px border, `neon-glow` on the panel
- Badges/lives: yellow Pac-Man wedge icons, mono labels with `text-glow-blue`
- Badges: sharp corners, mono uppercase, neon-blue outline

## Motion

- Entrance: overlays fade/scale in 0.2s; level intro flashes maze walls
- Decorative: `ghost-flicker` (frightened blue blink), `pacman-chomp` (mouth open/close), `power-pellet-pulse` (corner pellets), `scanline-drift` (subtle CRT)
- Hover: buttons brighten + intensify glow 0.18s

## Constraints

- Dark mode only — `.dark` mirrors `:root`; no light theme
- No raw hex/rgb in components — semantic OKLCH tokens only (canvas drawing may use literals)
- No rounded modern cards — sharp 0.125rem radius, neon outlines, no soft shadows
- Ghost colors fixed to chart-1..5 tokens; never recolored

## Signature Detail

The neon-blue maze walls rendered with a real bloom glow against true black, paired with a fixed CRT scanline + vignette over the whole viewport — the screen itself feels like a lit arcade cabinet, not a web page.
