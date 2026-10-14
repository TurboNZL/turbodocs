import { desktop } from './settings.ts';

/** Unsaved changes in the open document. Navigation inside the app asks before leaving; closing the window asks in the main process. */
let dirty = false;
export const isDirty = () => dirty;
export function setDirty(on: boolean) { if (dirty !== on) { dirty = on; desktop()?.setDirty(on); } }
/** true when it is fine to leave the document */
export const confirmLeave = () => !dirty || window.confirm('This document has unsaved changes. Leave and lose them?');
