import type { ITemplateBlock } from '../../editor/template/index'

export const PALETTE_DRAG_MIME = 'application/x-canvas-editor-blocks'

export type PaletteDragPayload =
  | { kind: 'type'; type: ITemplateBlock['type'] }
  | { kind: 'blocks'; blocks: ITemplateBlock[] }

let activePaletteDragPayload: PaletteDragPayload | null = null

export function setActivePaletteDragPayload(payload: PaletteDragPayload | null) {
  activePaletteDragPayload = payload
}

export function getActivePaletteDragPayload(): PaletteDragPayload | null {
  return activePaletteDragPayload
}

export function clearActivePaletteDragPayload() {
  activePaletteDragPayload = null
}