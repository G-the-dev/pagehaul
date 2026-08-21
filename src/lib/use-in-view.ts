"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Whether an element is anywhere near the viewport. Decorative animation
 * has no business running off screen: a page with four looping visuals and
 * four shader canvases below the fold was spending its scroll budget on
 * pixels nobody could see.
 */
export function useInView<T extends HTMLElement>(
  rootMargin = "160px",
): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => setInView(e.isIntersecting),
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);
  return [ref, inView];
}
