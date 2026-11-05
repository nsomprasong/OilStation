# Visual tokens and component grammar

## Extracted palette (OilStation main, 2026-11-05)

| Role | Value | Usage |
|---|---|---|
| page | #EAE7DF | warm neutral canvas |
| deep forest / navigation | #10271E | sidebar, toolbar, bottom dock |
| main surface | #F7F5EF | white-ivory cards |
| inset surface | #F0EDE5 | secondary cards and table heads |
| ink | #1B2A24 | primary body text |
| muted ink | #59685F | labels, descriptions |
| border | #CCD0C5 | normal controls and panels |
| soft border | #DDE0D6 | interior separators |
| main emerald | #194635 | primary CTA and title colour |
| deeper emerald | #174735 | active contrast |
| champagne gold | #BD9A5E | restrained edge/eyebrow |
| gold ink | #75572D | small gold text on pale backgrounds |
| green wash | #E3EBE1 | hover/info/selected quiet surface |
| input | #FFFDF8 | controls and warm highlights |
| success | #176143 | verified success only |
| warning | #87571E | attention / genuine caution |
| danger | #A13734 | destructive controls and failures |

Header text on green: #FFFDF8; muted copy #E1EEE5; gold breadcrumb #EBD7AD. On dark navigation: foreground #F7F5EF, muted foreground #C6D5CA.

**Approved gradients (proportions matter):**

~~~css
--os-gradient-page: linear-gradient(155deg,#F7F5EF 0%,#EAE7DF 54%,#E0EAE2 100%);
--os-gradient-menu: linear-gradient(170deg,#0E271D 0%,#174635 53%,#2B6049 100%);
--os-gradient-header: linear-gradient(112deg,#102D23 0%,#194635 50%,#2B634D 100%);
--os-gradient-gold: linear-gradient(135deg,#FFFDF8 0%,#EADFC6 100%);
~~~

The Login has a stronger standalone forest canvas: radial-gradient(ellipse at 46% 30%, #214535 0%, #12291F 43%, #0C1814 100%). Its hero uses radial-gradient(ellipse at 12% 12%, #214F3B 0%, #143126 47%, #0C1D17 100%).

## Geometry, layout, type

- Border radius: main 16px; inner cards 12px; controls 10px. Login frame 24px; pill sign-in buttons 999px.
- Spacing rhythm: 4, 8, 12, 16, 20, 24, 32px. Content inset card: 8px from parent panel. Prefer card separation to nested thick borders.
- Body: Noto Sans Thai, Inter, system-ui, Segoe UI, sans-serif; desktop ~15px, 1.6 line-height. Use readable 16px inputs on narrow mobile to prevent iOS zoom.
- Standard control height >=44px (login OAuth >=50px); one clear primary action per pane.
- Monetary data: font-variant-numeric: tabular-nums, Thai Baht unit and two decimal digits when source stores satang. Align numerical columns consistently.
- Desktop shell: left permission-filtered menu and one work area. Mobile at <=850px: no sidebar, five-position bottom dock, safe-area padding. The dock is centered and distributes fewer permitted destinations in the five-slot grid.
- Small phone <=480px: compact header, non-overflowing toolbar with credit + profile + logout; single-column forms, horizontal tab overflow.

## The gold-line signature

On green menu, green page headers and green card headers, show a **very fine sweeping gold line** (soft arc and/or 1px bottom rule) using pseudo-elements. Do not use gold swirls as a full wallpaper. Decoration must have pointer-events:none, z-order behind interactive contents, and not cover profile popovers. Mobile dock uses the same quiet signature.

Reference implementation:

~~~css
.fg-header { position:relative; isolation:isolate;
  color:#FFFDF8; background:linear-gradient(112deg,#102D23,#194635 50%,#2B634D);
}
.fg-header::before { content:""; position:absolute; inset:0; pointer-events:none; z-index:0;
  background:radial-gradient(ellipse 900px 270px at -180px 290px,
    transparent 88.42%,rgba(231,190,122,.26) 88.65% 88.88%,transparent 89.11%);
}
.fg-header::after { content:""; position:absolute; left:24px; right:24px; bottom:0;
  height:1px; pointer-events:none; z-index:0;
  background:linear-gradient(90deg,rgba(231,190,122,.26),rgba(231,190,122,.78) 32%,transparent 84%);
}
.fg-header>* { position:relative; z-index:1; }
~~~

For a different project, rename fg-header to a local component selector and use its own semantic token names; do not inject generic CSS that could affect unrelated components.

## Hierarchy and state

1. Primary content heading and task status.
2. One selected task pane and its contextual actions.
3. Supporting credit/record cards, summary, details.
4. Readable but quiet labels, notes and metadata.
5. Gold used only for premium brand identity and section boundaries, not for success.

A gradient is allowed on page/header/menu and active navigation, **not every card**. Never rely solely on green/red to signal success or failure.
