"use client";

import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import {
  ambienceStarted,
  pauseAmbience,
  resumeAmbience,
  startAmbience,
} from "@/lib/ambience";
import { track } from "@/lib/analytics";

const KEY = "pagehaul.ambience";

/**
 * The ambience, and the one switch that controls it.
 *
 * On by default, remembered when turned off. The browser will not let sound
 * start before a gesture, so "plays when you enter" really means "plays from
 * your first click or key press", fading in from silence. Leaving the tab
 * fades it out rather than cutting it; coming back fades it in again — both
 * handled here, on visibilitychange, because this component is mounted on
 * every page that plays.
 */
export function AmbienceToggle() {
  const [on, setOn] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let enabled = true;
    try {
      enabled = localStorage.getItem(KEY) !== "off";
    } catch {
      /* private browsing; stay with the default */
    }
    setOn(enabled);
    setReady(true);

    if (enabled) {
      // The first gesture of the visit starts the pad. Once is enough.
      const begin = () => {
        startAmbience();
        window.removeEventListener("pointerdown", begin);
        window.removeEventListener("keydown", begin);
      };
      window.addEventListener("pointerdown", begin);
      window.addEventListener("keydown", begin);
      return () => {
        window.removeEventListener("pointerdown", begin);
        window.removeEventListener("keydown", begin);
      };
    }
  }, []);

  // Away and back. The preference is re-read rather than closed over, so a
  // toggle click after mount is respected without re-subscribing.
  useEffect(() => {
    const onVisibility = () => {
      if (!ambienceStarted()) return;
      let enabled = true;
      try {
        enabled = localStorage.getItem(KEY) !== "off";
      } catch {
        /* keep default */
      }
      if (document.visibilityState === "hidden") pauseAmbience(1.2);
      else if (enabled) resumeAmbience(1.6);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const toggle = () => {
    const next = !on;
    setOn(next);
    try {
      localStorage.setItem(KEY, next ? "on" : "off");
    } catch {
      /* still applies for this visit */
    }
    // The click that flips it on is itself the gesture the browser wants.
    if (next) {
      if (ambienceStarted()) resumeAmbience(1);
      else startAmbience();
    } else {
      pauseAmbience(0.6);
    }
    track("ambience", { on: next });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={on ? "Turn the music off" : "Turn the music on"}
      className="relative grid h-8 w-8 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
    >
      {/* Rendered only after mount — the server cannot know this visitor's
          stored preference, and guessing causes a hydration mismatch. */}
      {ready &&
        (on ? (
          <Volume2 className="h-3.5 w-3.5" />
        ) : (
          <VolumeX className="h-3.5 w-3.5" />
        ))}
    </button>
  );
}
