"use client";

import { useEffect, useRef } from "react";

type EscapeEntry = {
  id: number;
  z: number;
  close: () => void;
};

const stack: EscapeEntry[] = [];
let nextId = 0;
let listenerAttached = false;

function onDocumentKeyDown(e: KeyboardEvent) {
  if (e.key !== "Escape" || stack.length === 0) return;
  const top = stack.reduce((best, cur) => (cur.z >= best.z ? cur : best));
  e.preventDefault();
  e.stopImmediatePropagation();
  top.close();
}

function ensureListener() {
  if (listenerAttached) return;
  listenerAttached = true;
  document.addEventListener("keydown", onDocumentKeyDown, true);
}

/**
 * Escape ile yalnızca en üstteki (en yüksek z) katman kapanır.
 */
export function useOverlayEscape(
  active: boolean,
  onClose: () => void,
  z: number,
  enabled = true
) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active || !enabled) return;
    ensureListener();
    const id = ++nextId;
    const entry: EscapeEntry = {
      id,
      z,
      close: () => onCloseRef.current(),
    };
    stack.push(entry);
    return () => {
      const idx = stack.findIndex((e) => e.id === id);
      if (idx >= 0) stack.splice(idx, 1);
    };
  }, [active, enabled, z]);
}
