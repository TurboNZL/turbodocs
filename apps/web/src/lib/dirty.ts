import { desktop } from './settings.ts';

/** Unsaved changes in the open document. Navigation inside the app asks before leaving; closing the window asks in the main process. */
let dirty = false;
export const isDirty = () => dirty;
export function setDirty(on: boolean) { if (dirty !== on) { dirty = on; desktop()?.setDirty(on); } }
/** The open document registers what to do when the person agrees to lose their changes (drop its crash backup, so it is not offered back). */
let onDiscard: (() => void) | null = null;
export const setLeaveHook = (f: (() => void) | null) => { onDiscard = f; };
/** true when it is fine to leave the document */
export function confirmLeave(): boolean {
  if (!dirty) return true;
  if (!window.confirm('This document has unsaved changes. Leave and lose them?')) return false;
  onDiscard?.();
  return true;
}
