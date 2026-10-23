/**
 * Katman sırası: açılır menü (OVERLAY_Z) < modal < iç içe modal < onay < toast.
 * Açılır menüler için bkz. `overlay-layer.ts`.
 */
export const MODAL_Z = {
  base: 9000,
  nested: 9100,
  confirm: 10000,
  toast: 10100,
} as const;

export type ModalLayer = keyof typeof MODAL_Z;
