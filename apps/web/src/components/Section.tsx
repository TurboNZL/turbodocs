import type { ReactNode } from 'react';

/** A titled panel (Settings uses one per topic). The title is the first child of a `.card.bt-panel`, which the styles rely on. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="card bt-panel space-y-4 p-5"><h2 className="bt-panel-title font-semibold">{title}</h2>{children}</section>;
}
