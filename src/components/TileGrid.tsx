"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import type { Asset } from "@/lib/types";
import { AssetTile } from "./AssetTile";

/**
 * The results grid, rendering only the rows you can see.
 *
 * A scan of a busy site returns several hundred files, and every one of them
 * used to be a mounted tile with an image element and its own layout. At 343
 * tiles that was 4,812 DOM nodes, and scrolling on a throttled machine spent
 * 41ms on the average bad frame — visibly short of sixty.
 *
 * Tiles are a uniform height, which is what makes this simple: the row height
 * follows from the column width, so there is nothing to measure per item and
 * no guessing at offsets. The page keeps its own scrollbar, so the window is
 * the scroll container rather than a nested one, and nothing about how the
 * grid looks or behaves changes.
 */

/** Matches the Tailwind columns this grid used before it was virtualised. */
function columnsFor(width: number): number {
  // The container opens out on a 2xl screen; a seventh column keeps the
  // tiles near the same size instead of inflating six of them. The bar sits
  // where the widened padding still leaves room for it on a 1920 display.
  if (width >= 1500) return 7;
  if (width >= 1280) return 6;
  if (width >= 1024) return 5;
  if (width >= 640) return 3;
  return 2;
}

const GAP = 12;
/** Name row under the 4:3 thumbnail. Measured from a real tile on mount. */
const NAME_ROW_FALLBACK = 36;

export function TileGrid({
  assets,
  onOpen,
  onMeasure,
}: {
  assets: Asset[];
  onOpen: (a: Asset) => void;
  onMeasure: (id: string, w: number, h: number) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [nameRow, setNameRow] = useState(NAME_ROW_FALLBACK);
  const [offsetTop, setOffsetTop] = useState(0);

  // Width drives both the column count and the row height, so it has to come
  // from the element rather than from the window.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const read = () => {
      setWidth(el.getBoundingClientRect().width);
      setOffsetTop(el.getBoundingClientRect().top + window.scrollY);
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    window.addEventListener("resize", read);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", read);
    };
  }, []);

  // The label strip is a fixed height whatever the column width, so one real
  // measurement is enough and keeps the arithmetic honest across themes.
  useEffect(() => {
    const tile = listRef.current?.querySelector("[data-tile]");
    const media = tile?.querySelector("[data-tile-media]");
    if (!tile || !media) return;
    const h =
      tile.getBoundingClientRect().height - media.getBoundingClientRect().height;
    if (h > 8 && h < 120) setNameRow(Math.round(h));
  }, [width, assets.length]);

  const cols = columnsFor(width || 1280);
  const colWidth = width ? (width - GAP * (cols - 1)) / cols : 0;
  const rowHeight = colWidth ? colWidth * 0.75 + nameRow + GAP : 200;
  const rows = Math.ceil(assets.length / cols);

  // Rows kept mounted beyond the viewport. Images load eagerly the moment they
  // mount, so this band is a preload buffer: the wider it is, the more lead the
  // optimizer gets before a tile is actually seen. Six rows is roughly the
  // second the optimizer needs at a normal scroll speed. Video-heavy results
  // stay narrow, because a mounted video is a decode waiting to happen, not a
  // cheap prefetch.
  const heavy = assets.filter((a) => a.kind === "video").length > assets.length / 2;
  const virtualizer = useWindowVirtualizer({
    count: rows,
    estimateSize: () => rowHeight,
    overscan: heavy ? 3 : 7,
    scrollMargin: offsetTop,
  });

  // Row height changes with the viewport; the virtualizer has to be told.
  useEffect(() => {
    virtualizer.measure();
  }, [rowHeight, virtualizer]);

  const items = virtualizer.getVirtualItems();

  return (
    <div ref={listRef} className="relative w-full">
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {items.map((row) => {
          const from = row.index * cols;
          const slice = assets.slice(from, from + cols);
          return (
            <div
              key={row.key}
              className="absolute left-0 grid w-full gap-3"
              style={{
                top: row.start - virtualizer.options.scrollMargin,
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              }}
            >
              {slice.map((a) => (
                <Cell key={a.id} asset={a} onOpen={onOpen} onMeasure={onMeasure} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * One tile in one cell.
 *
 * Its own component so the click handler is created per asset rather than per
 * render — an inline arrow in the row would be a new function every scroll
 * step, and the memo on AssetTile would never hold.
 */
const Cell = memo(function Cell({
  asset,
  onOpen,
  onMeasure,
}: {
  asset: Asset;
  onOpen: (a: Asset) => void;
  onMeasure: (id: string, w: number, h: number) => void;
}) {
  const open = useCallback(() => onOpen(asset), [onOpen, asset]);
  return (
    <div data-tile>
      <AssetTile
        asset={asset}
        selected={false}
        selectable={false}
        onToggle={open}
        onMeasure={onMeasure}
      />
    </div>
  );
});
