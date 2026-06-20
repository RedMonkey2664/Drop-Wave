# DESIGN.md — DropWave Visual Identity

> The look-and-feel contract. Pair this with ANIMATION.md (motion) and CLAUDE.md (build).

---

## 1. Design philosophy

**Cinematic dark-luxury, built around the metaphor of a DROP.**

Every visual decision references water and the act of dropping: ripples, falling drops,
expanding pulses, surface tension, liquid gradients. The benchmark feel is
**Apple × Linear × SpaceX**, with a fluid twist that no competitor (Snapdrop, PairDrop)
has — they are utilitarian and plain; DropWave is premium and alive.

**Principles**
1. **Calm, then alive.** Mostly still, dark, spacious — motion appears where it means
   something (pairing, transfer, success).
2. **Restraint over decoration.** Glassmorphism and glows are seasoning, not the meal.
3. **One idea, repeated.** The droplet/ripple shows up in the logo, the loader, the
   progress bar, the success state — a coherent system, not random effects.
4. **Trust through clarity.** Privacy/offline/encrypted states are visually legible.

---

## 2. Color system

Dark-first. Define all of these as tokens in `lib/theme/tokens.ts`.

### Base (near-black canvas)
| Token            | Hex        | Use                                   |
|------------------|------------|---------------------------------------|
| `bg-abyss`       | `#06060A`  | App background (deepest)              |
| `bg-surface`     | `#0A0A0F`  | Cards / panels base                  |
| `bg-elevated`    | `#12121A`  | Raised surfaces, modals              |
| `border-subtle`  | `#1E1E2A`  | Hairline borders                     |

### Accent (the "water" palette)
| Token            | Hex        | Use                                   |
|------------------|------------|---------------------------------------|
| `aqua`           | `#00E5FF`  | Primary accent (signal cyan)         |
| `aqua-deep`      | `#0091EA`  | Aqua gradient end                    |
| `violet`         | `#6C63FF`  | Secondary accent (electric violet)   |
| `violet-deep`    | `#4A3FE0`  | Violet gradient end                  |

### Text
| Token            | Hex        | Use                                   |
|------------------|------------|---------------------------------------|
| `text-primary`   | `#F5F7FA`  | Headlines, key copy                  |
| `text-secondary` | `#A8AEBF`  | Body, descriptions                   |
| `text-muted`     | `#5A6072`  | Labels, captions                     |

### Semantic
| Token            | Hex        | Use                                   |
|------------------|------------|---------------------------------------|
| `success`        | `#2EE6A8`  | Transfer complete, connected         |
| `warning`        | `#FFB547`  | Connection unstable                  |
| `error`          | `#FF5C7A`  | Failed / unsupported                 |

### Signature gradients
- **Liquid Glow** (primary): `linear-gradient(135deg, #00E5FF 0%, #6C63FF 100%)`
- **Ripple Halo** (radial, for pulses): `radial-gradient(circle, rgba(0,229,255,0.35) 0%, rgba(108,99,255,0) 70%)`
- Use gradients on key CTAs, the logo mark, progress fill, and connection pulses — never
  on large flat backgrounds.

---

## 3. Typography

- **Display / Headings:** a geometric, modern sans with character — **Syne**, **Clash
  Display**, or **Space Grotesk**. (Syne pairs well with the brand's premium feel.)
- **Body / UI:** **Inter** — clean, legible at small sizes.
- **Mono (room codes, file sizes, speeds):** **JetBrains Mono** or **Geist Mono**.

**Scale (fluid, clamp-based)**
| Role        | Size (desktop)     | Weight | Tracking |
|-------------|--------------------|--------|----------|
| Hero        | clamp 3rem–5.5rem  | 700    | -0.02em  |
| H1          | 2.5rem             | 700    | -0.02em  |
| H2          | 1.75rem            | 600    | -0.01em  |
| Body        | 1rem–1.125rem      | 400    | 0        |
| Label/mono  | 0.8125rem          | 500    | 0.02em   |

Generous line-height on body (1.6). Tight on display (1.05).

---

## 4. Logo & iconography

- **Logo mark:** a stylized **droplet inside a concentric pulse ring** — droplet rendered
  with the Liquid Glow gradient, ring as a thin aqua stroke. Works as favicon, PWA icon,
  and animated loader.
- **Icons:** line icons, 1.5px stroke, rounded caps (Lucide). Keep them quiet — the
  motion carries the personality, not the icons.

---

## 5. Layout & spacing

- **Spacing scale (8px base):** 4, 8, 12, 16, 24, 32, 48, 64, 96, 128.
- **Generous negative space.** The dark canvas should breathe; content sits in focused
  islands.
- **Max content width:** ~1120px; pairing/transfer screens are more centered/focused
  (~560px column).
- **Radius:** cards `20px`, buttons `14px`, pills `999px`. Soft, liquid-friendly corners.
- **Mobile-first**, but desktop must feel intentional (drag-drop zone, wider radar).

---

## 6. Surfaces & depth (glassmorphism — used sparingly)

- Glass cards: `bg-surface` at ~70% opacity + `backdrop-blur(20px)` + 1px `border-subtle`
  + a faint inner top highlight.
- Elevation via **soft colored shadows**, not hard black:
  `0 8px 40px rgba(0,229,255,0.08)` for accented elements.
- Avoid stacking many glass layers — one or two max per view.

---

## 7. Key screens — visual intent

**Landing / Hero**
- Near-black canvas. Centered droplet animation (see ANIMATION.md) that ripples into a
  device radar. Headline + tagline + two large CTAs ("Send" / "Receive").
- Trust row beneath: small badges — *Offline · No accounts · End-to-end encrypted ·
  Works iPhone ↔ Windows.*

**Pairing (sender)**
- Focused column. QR code on a glass card with a soft glow; room code in mono beneath.
- Radar pulse animation around the card while waiting for a peer.

**Pairing (receiver)**
- Camera viewfinder framed in a rounded glass window; scan-line guide. "Enter code
  instead" link for fallback.

**Transfer**
- Each file as a card with a **liquid fill** progress (a rising wave). Speed + size in
  mono. On complete: a **splash** + success color.

**Received files**
- Clean list; download buttons; Web Share on mobile. Quiet, organized, satisfying.

---

## 8. States (don't skip these)

- **Empty:** before files chosen — inviting drop zone with a gentle floating droplet.
- **Waiting:** radar pulsing, "Looking for a device…"
- **Connected:** splash + steady connection indicator.
- **Error/unsupported:** calm, helpful, never alarming red walls — explain the fix.
- **Reduced motion:** all of the above degrade to crossfades/static (see ANIMATION.md).

---

## 9. Do / Don't

**Do:** keep it dark, spacious, coherent; let one motion idea (the drop) unify everything;
make trust signals legible; tune everything from tokens.

**Don't:** rainbow gradients; cluttered dashboards; heavy glass everywhere; flashy motion
with no meaning; tiny low-contrast text; implying features the browser can't deliver.
