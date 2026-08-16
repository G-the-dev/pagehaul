"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { EASE } from "./ui/motion-primitives";

/**
 * Dark and light, remembered.
 *
 * The class is applied by a small script in the document head before anything
 * paints, so the page never flashes the wrong theme. This component only reads
 * that decision and lets you change it.
 *
 * Three states are stored, not two: "dark", "light", or nothing at all, which
 * means follow the system. Someone who has never touched the toggle keeps
 * following their machine even if they change it later.
 */
export function ThemeToggle() {
  const [isLight, setIsLight] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setIsLight(document.documentElement.classList.contains("light"));
    setReady(true);
  }, []);

  function toggle(e: React.MouseEvent<HTMLButtonElement>) {
    const next = !isLight;
    const apply = () => {
      setIsLight(next);
      const root = document.documentElement;
      // Our tokens key off .light, the shadcn components off .dark, so both
      // move together or the theme applies only halfway.
      root.classList.toggle("light", next);
      root.classList.toggle("dark", !next);
      root.style.colorScheme = next ? "light" : "dark";
      try {
        localStorage.setItem("theme", next ? "light" : "dark");
      } catch {
        // Private browsing can refuse storage. The toggle still works for
        // this visit; it just will not be remembered.
      }
    };

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => { ready: Promise<void> };
    };

    if (reduce || !doc.startViewTransition) {
      // No view transitions here. Let every colour glide for a moment rather
      // than snap; under reduced motion, snap is the right answer.
      if (!reduce) {
        const root = document.documentElement;
        root.classList.add("theme-turning");
        window.setTimeout(() => root.classList.remove("theme-turning"), 650);
      }
      apply();
      return;
    }

    // The new theme washes out of the toggle itself, an expanding circle over
    // a page that holds still beneath it. The origin is the button, not the
    // pointer, so a keyboard activation blooms from the same place.
    const r = e.currentTarget.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );

    const vt = doc.startViewTransition(apply);
    vt.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${radius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 720,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          pseudoElement: "::view-transition-new(root)",
        },
      );
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isLight ? "Switch to dark theme" : "Switch to light theme"}
      className="relative grid h-8 w-8 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
    >
      {/* Rendered only after mount, because the server cannot know which theme
          this visitor has chosen and guessing causes a hydration mismatch. */}
      {ready && (
        <motion.span
          key={isLight ? "sun" : "moon"}
          initial={{ opacity: 0, rotate: -35, scale: 0.7 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          transition={{ duration: 0.32, ease: EASE }}
          className="grid place-items-center"
        >
          {isLight ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </motion.span>
      )}
    </button>
  );
}
