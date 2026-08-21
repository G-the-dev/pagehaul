"use client";

import { useEffect, useState } from "react";

/**
 * Which theme the paint is under, watched live. Canvas-drawn things cannot
 * inherit CSS variables, so anything that draws its own pixels asks here
 * and recolours when the class on the root flips.
 */
export function useIsLight(): boolean {
  const [light, setLight] = useState(false);
  useEffect(() => {
    const read = () =>
      setLight(document.documentElement.classList.contains("light"));
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => mo.disconnect();
  }, []);
  return light;
}
