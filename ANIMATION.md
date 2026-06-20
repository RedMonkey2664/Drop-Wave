# ANIMATION.md — DropWave Motion System

> Motion is the product's signature. This file defines every signature animation, the
> tokens behind them, and the performance/accessibility rules. Pair with DESIGN.md.

---

## 1. Motion philosophy

The whole system is built on **one physical idea: a drop hitting water.** Falling,
impact, ripple, settle. Every animation is a variation of that — so the app feels like a
single coherent object, not a pile of effects.

**Rules**
1. **Motion must mean something.** Pairing, connecting, transferring, succeeding — those
   earn animation. Decoration for its own sake does not.
2. **Spring physics over linear easing** for anything interactive (it feels liquid/alive).
3. **60fps or it's broken.** Animate `transform` and `opacity` only. Never animate
   width/height/top/left in hot paths.
4. **Calm by default, alive on action.** The resting state is still and dark.
5. **Always provide a reduced-motion fallback.** No exceptions.

---

## 2. Motion tokens (put in `lib/theme/tokens.ts`)

```ts
export const motion = {
  duration: {
    instant: 0.12,
    fast:    0.24,
    base:    0.4,
    slow:    0.7,
    ambient: 2.4,   // looping background ripples
  },
  ease: {
    // liquid, slightly overshooting
    liquid:   [0.22, 1, 0.36, 1],     // easeOutQuint-ish
    splash:   [0.34, 1.56, 0.64, 1],  // overshoot for impact
    settle:   [0.4, 0, 0.2, 1],       // standard settle
  },
  spring: {
    soft:   { type: "spring", stiffness: 120, damping: 18 },
    snappy: { type: "spring", stiffness: 320, damping: 26 },
    bouncy: { type: "spring", stiffness: 260, damping: 12 },
  },
} as const;
```

Use these everywhere instead of hardcoded numbers, so timing is tunable in one place.

---

## 3. Signature animations

### 3.1 Hero — "The Drop"
**Where:** landing hero. **Loops** subtly (every ~6s) or plays on load.
**Sequence:**
1. A droplet falls from top center (translateY, `ease.liquid`, ~0.7s) with slight scale
   stretch (surface tension).
2. **Impact:** quick squash, then an **expanding ripple ring** (scale 0→large,
   opacity 1→0, `ease.liquid`, ~1.2s).
3. The ripple **morphs into the device radar** (the rings become the radar's pulse rings).
**Implementation:** SVG + Framer Motion, or a `<canvas>` ripple if you need many rings
cheaply. Prefer transform/opacity. Keep it GPU-friendly.

### 3.2 Pairing — "Radar Pulse"
**Where:** sender waiting for a peer; landing radar.
**Behavior:** 2–3 concentric rings continuously emanate outward from center (scale + fade,
staggered, `duration.ambient`, infinite). A center droplet/logo gently bobs.
**Meaning:** "broadcasting, looking for a device."

### 3.3 Connect — "Splash"
**Where:** the moment two devices pair.
**Behavior:** radar rings snap inward and collapse into a bright droplet, which **splashes**
outward (`ease.splash`, overshoot) into a settled "connected" state. Brief success-color
bloom. One-shot, ~0.6s, very satisfying.

### 3.4 Transfer — "Liquid Fill"
**Where:** per-file progress.
**Behavior:** progress is shown as a **rising liquid level** inside each file card, with a
subtle **animated wave** on the surface (SVG path morph or CSS, looping). Percent in mono
counts up. Speed shimmer optional.
**Note:** drive the fill height from real transfer progress, not a fake timer.

### 3.5 File-in-flight — "Traveling Drop" (optional, desktop)
**Where:** transfer screen with both devices shown.
**Behavior:** the file becomes a glowing drop that travels along a curved fluid path from
sender to receiver, leaving a faint trail. Use `offsetPath`/motion path. Skip on mobile if
it costs frames.

### 3.6 Success — "Settle"
**Where:** transfer complete.
**Behavior:** a final splash + ripple, card border blooms to `success`, a checkmark draws
in (SVG path length). Then everything settles to calm. ~0.8s.

---

## 4. Micro-interactions (apply broadly)

| Element            | Interaction                                                        |
|--------------------|--------------------------------------------------------------------|
| Buttons            | Press → **ripple** from pointer + scale 0.97 (`spring.snappy`).     |
| Primary CTA        | Idle → very slow gradient shimmer; hover → glow intensifies.       |
| Cards              | Hover → lift 4px + soft colored shadow + faint liquid sheen.        |
| File drop zone     | Drag-over → border pulses aqua, subtle ripple at cursor.            |
| Toggles / tabs     | Selection slides with `spring.soft`; ink-drop fill.                |
| Page transitions   | Crossfade + 12px rise, `ease.liquid`, `duration.base`.             |
| List items         | Enter with **staggered** reveal (50–60ms apart).                   |
| Toasts             | Drop in from top with a small bounce (`spring.bouncy`).            |

---

## 5. Orchestration patterns (Framer Motion)

- Use **`variants` + `staggerChildren`** for any group reveal (feature grid, file list,
  trust badges).
- Use **`layout`** animations for reflowing lists (files added/removed) — but test for
  jank on mobile; disable if it drops frames.
- Use **`AnimatePresence`** for mount/unmount (pairing → connected → transfer).
- Gate scroll reveals with **`whileInView` + `viewport={{ once: true }}`** so they fire
  once and don't thrash.

Example reveal:
```tsx
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: motion.duration.base, ease: motion.ease.liquid } },
};
```

---

## 6. Performance rules (enforce these)

- Animate **only** `transform` and `opacity` in any frequently-running animation.
- Put looping/ambient animations behind `will-change: transform` sparingly; remove after.
- Cap concurrent ripple rings (e.g. max 3) — pool/recycle nodes for canvas ripples.
- The **liquid-fill wave** must be cheap: prefer a single SVG path morph or CSS transform,
  not per-frame React re-renders. Drive it with Framer Motion values / requestAnimationFrame.
- Never block the main thread with file chunking — keep transfer work off the render path
  (streams / web worker), so animation stays smooth during transfer.
- Test the **traveling-drop** and **layout** animations on a real mid-range phone; if they
  cost frames, downgrade them on mobile.

---

## 7. Accessibility — `prefers-reduced-motion`

When reduced motion is requested, provide calm equivalents:

| Signature anim   | Reduced-motion fallback                          |
|------------------|--------------------------------------------------|
| Hero drop/ripple | Static droplet logo, gentle opacity fade-in.     |
| Radar pulse      | Static rings + a quiet opacity breathe (or none). |
| Splash connect   | Simple crossfade to connected state.             |
| Liquid fill      | Standard flat progress bar, no wave.             |
| Traveling drop   | Disabled entirely.                               |
| Micro-interactions| Keep instant scale/opacity, drop ripples/bounce.|

Implementation:
```tsx
const reduce = useReducedMotion();
// branch variants/transitions on `reduce`
```
Never convey state through motion alone — always pair with color + text/icon so the app is
fully usable with motion off.

---

## 8. Build note

Per CLAUDE.md build order: **ship functional transfer first**, then layer these in. When
adding motion, do it in this priority order:
1. Micro-interactions (buttons, cards, page transitions) — biggest polish-per-effort.
2. Radar pulse + splash connect (the pairing moment).
3. Liquid-fill progress.
4. Hero drop.
5. Traveling drop (last, optional).
