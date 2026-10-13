import { useSyncExternalStore } from 'react';
import type { OpenRequest } from './settings.ts';

/** Files that were opened this session (newest first), shared by the layout (which routes them) and Home (which lists them). */
let list: OpenRequest[] = [];
const subs = new Set<() => void>();
export const addOpened = (r: OpenRequest) => { list = [r, ...list.filter((x) => x.path !== r.path)]; subs.forEach((f) => f()); };
export const useOpened = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => list);

export const viewUrl = (path: string) => `/view?path=${encodeURIComponent(path)}`;
