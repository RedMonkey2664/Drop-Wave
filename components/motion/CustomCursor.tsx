"use client";

/**
 * CustomCursor — a smooth two-part pointer: an exact ink dot plus a larger ring that
 * trails behind with spring easing. Uses mix-blend-mode: difference (white elements)
 * so it reads correctly over BOTH the light putty sections and the dark ink rooms,
 * staying perfectly on-theme/monochrome. Over links/buttons the ring expands.
 *
 * Only activates on fine pointers (mouse) with motion allowed — touch devices and
 * reduced-motion users keep the native cursor untouched. When active it hides the
 * native cursor while mounted and restores it on unmount.
 */

import { useEffect, useState } from "react";
import {
  motion as m,
  useMotionValue,
  useSpring,
  useReducedMotion,
} from "framer-motion";

export function CustomCursor() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [down, setDown] = useState(false);

  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const ringX = useSpring(x, { stiffness: 350, damping: 28, mass: 0.4 });
  const ringY = useSpring(y, { stiffness: 350, damping: 28, mass: 0.4 });

  useEffect(() => {
    const fine =
      typeof window !== "undefined" &&
      window.matchMedia("(pointer: fine)").matches;
    if (!fine || reduce) return;
    setActive(true);

    const prevCursor = document.body.style.cursor;
    document.body.style.cursor = "none";

    const move = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    const over = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      setHovering(!!t?.closest('a, button, [role="button"], input, label, [data-cursor]'));
    };
    const downH = () => setDown(true);
    const upH = () => setDown(false);

    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerover", over, { passive: true });
    window.addEventListener("pointerdown", downH, { passive: true });
    window.addEventListener("pointerup", upH, { passive: true });

    return () => {
      document.body.style.cursor = prevCursor;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerover", over);
      window.removeEventListener("pointerdown", downH);
      window.removeEventListener("pointerup", upH);
    };
  }, [reduce, x, y]);

  if (!active) return null;

  const ringScale = hovering ? 1.8 : down ? 0.7 : 1;

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999] mix-blend-difference" aria-hidden>
      {/* trailing ring */}
      <m.div
        className="absolute left-0 top-0 rounded-full border border-white"
        style={{ x: ringX, y: ringY, width: 34, height: 34, marginLeft: -17, marginTop: -17 }}
        animate={{ scale: ringScale, opacity: hovering ? 0.9 : 0.6 }}
        transition={{ type: "spring", stiffness: 300, damping: 22 }}
      />
      {/* exact dot */}
      <m.div
        className="absolute left-0 top-0 rounded-full bg-white"
        style={{ x, y, width: 6, height: 6, marginLeft: -3, marginTop: -3 }}
        animate={{ opacity: hovering ? 0 : 1 }}
        transition={{ duration: 0.15 }}
      />
    </div>
  );
}
