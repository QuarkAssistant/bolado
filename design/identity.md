# Bolado v2 — Visual Identity: "NOITE DE JOGO"

Spec mandate: `docs/spec-v2.md` §9 — *"improve the visuals as well!!!"*
Implementation: `src/styles/tokens.css` (vocabulary) + `src/styles/components.css` (`.bld-*` grammar).
Living proof: `design/mock.html` (static composition), `design/screens/` (rendered).

---

## 1. The identity in words

**Bolado looks like a night match you snuck into.** The whole game lives under
stadium floodlights: every surface is a green-black field tone (never neutral
gray), and every piece of text is warm chalk white — the color of halide lamps
on line markings. Light always comes from above and falls hard.

Three cultural registers do the talking:

1. **Botequim poster** — headlines, buttons, and toasts are heavy italic Kanit,
   uppercase, skewed −6° to −8°, slapped on with a hard 4px offset shadow. A
   primary button should feel like slamming a domino on a bar table. BORA.
2. **Álbum de figurinhas** — Cartas de Boleiro are stickers, not UI cards:
   a rarity-colored border wraps a matte dark paper face; the pictogram sits
   on a sunburst-ray portrait (the radial backdrop of vintage stickers); paper
   grain on everything. Lendária is gold *foil* — hot specular whites
   alternating with brass around the border, engraved interference lines, a
   diagonal glint, holographic micro-lines on the face. Foil stays BRIGHT;
   mostly-dark gold reads as cheap plastic.
3. **90s TV grafismo** — the match is a broadcast: chunky near-square score
   bug with a chamfered competition tab, scanlines, hot tabular digits, and a
   red "AO VIVO" ticker. Card effects interrupt play as poster-chip toasts.

**Color is rationed like prize money.** Gold belongs to coins and lendária
only — when the glory screen finally goes gold, it pays off everything the
game withheld. Red means death: Z4, run over, danger actions, nothing else.
Flag blue appears in exactly one place: the rara seal. Everything else is
field green and chalk.

**Motion is fast and physical** — 90/140/200ms, overshoot easing on dice and
toasts, nothing slower than 200ms ever. `prefers-reduced-motion` collapses all
of it to end states via the `.bld-anim` kill-switch in tokens.css.

## 2. Do / Don't

**DO**
- Keep every dark on the green-black `--bld-field-*` scale; the night must
  read *green* next to a true-gray dark theme.
- Skew display type (Kanit italic, uppercase) and counter-skew its content
  (`> span { skewX(+6deg) }`) so glyphs stay true.
- Use the hard poster shadow (`--bld-shadow-poster`) for anything punchy;
  use the soft lift (`--bld-shadow-lift`) only for stickers/objects.
- Put grain (`.bld-grain`, face `::after`) on big flat darks.
- Make gold GLOW (`--bld-glow-gold`) when money or legend is on screen.
- State stakes in chalk labels: "VITÓRIA PAGA 🪙4 · DERROTA: FIM DA RUN".
- Give every card effect its toast the moment it fires (legibility is law).

**DON'T**
- No neutral grays, no pure #fff except specular hits (`--bld-flood-0`).
- No gold outside coins/lendária/glory; no red outside danger/death/Z4.
- No stock gradients (blue→purple etc.), no glassmorphism/backdrop-blur.
- No rounded-friendly corners on broadcast chrome — score bug and ticker
  stay near-square (`--bld-radius-hard: 3px`); only stickers get 12px.
- No dull foil: if the lendária border averages darker than `--bld-gold-400`,
  it has failed.
- No motion over 200ms; no animation without the `.bld-anim` hook.
- No invented font weights — only what's loaded (Kanit 600–900, Barlow
  Semi Condensed 500–800).

## 3. Screen composition

**O Mercado (shop)** — top bar: wordmark left, run pips center (dots = group
matches, gold diamonds = mata-mata bosses), coin wallet right. One `.bld-shop`
frame with a chalk-dashed inner rule holds three stacked sections: dice draft
row (the die is the biggest tactile object on screen), card offer row (3
figurinhas, lendária glowing), squad strip (shirt tokens, new signings rimmed
gold). One full-width BORA primary button closes the screen. Hierarchy: dice →
cards → squad → BORA.

**Transmissão (match)** — broadcast viewport on a darkened pitch hint
(center circle, floodlight falloff). Score bug pinned top-left like a real TV
bug; card-effect toasts slam into the center; ticker pinned bottom with the
red AO VIVO tag; skip control bottom-right. Stakes are stated above the
viewport before kickoff.

**Verdicts** — death: floodlights cut, red emergency wash from above, red
strap, the diagnosis line ("o que faltou"), then the biggest button in the
game: BORA DE NOVO. Glory: all the rationed gold at once — gold wash, gold
strap, gold scoreline — and the share button, because the screenshot is the
marketing.

## 4. Measured contrast (WCAG, from token hexes)

| Pair (usage) | Ratio | AA (4.5:1 text) |
|---|---|---|
| flood-100 on field-900 — primary text | 15.99:1 | pass |
| flood-100 on field-850 — text on card face | 15.20:1 | pass |
| flood-300 on field-850 — card effect text | 10.90:1 | pass |
| flood-500 on field-900 — muted labels | 6.96:1 | pass |
| field-950 on flood-100 — primary button text | 16.81:1 | pass |
| gold-300 on field-900 — coin numerals | 12.78:1 | pass |
| gold-ink on gold-400 — gold strap / rarity chip | 9.44:1 | pass |
| flood-0 on red-600 — danger button text | 5.23:1 | pass |
| red-300 on field-950 — danger text | 8.47:1 | pass |
| blue-300 on blue-700 — rara seal chip | 4.85:1 | pass |
| field-300 on field-900 — success text | 8.51:1 | pass |
| gold-200 on field-850 — lendária name | 14.04:1 | pass |
| flood-0 on field-950 — score bug digits | 19.13:1 | pass |

Rule of thumb baked into the scale: chalk text ≥ flood-300 on any field
surface; flood-500 is the floor and only for labels/microcopy.

## 5. Iteration log (self-critique)

**v1 → v2 (the foil pass).** Rendered v1 and judged it against §2: the score
bug, buttons, dice, pips, and verdict screens held the bar, but the figurinha
failed twice. (a) The lendária border averaged `gold-600` — dull olive,
exactly the "cheap foil" failure; reworked the conic to alternate specular
white and brass with thin dark interference stops, added engraved
micro-lines and a harder diagonal glint. (b) The card anatomy read as a
generic UI panel (small emoji in a corner, dead space); restructured to true
sticker anatomy — sunburst-ray portrait zone with the pictogram as
centerpiece, rarity chip pinned in the portrait, centered name band. Re-rendered:
all three rarities now read as album stickers at 168px and the foil reads
metallic in a static screenshot.
