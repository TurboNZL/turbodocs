import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Popover } from '../editor/Popover.tsx';

/**
 * A toolbar that is always one row: its groups are laid out in a line, and the ones that do not fit in the width go behind a "More" button (⋮) that opens
 * them in a panel. Resizing the window moves groups in and out. Put the most used groups first; `pinned` stays at the right end whatever the width.
 */
export function OverflowBar({ groups, pinned, label = 'Toolbar', className = '' }: { groups: ReactNode[]; pinned?: ReactNode; label?: string; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(groups.length);
  const count = groups.length;
  // measure with everything drawn; keep the groups whose right edge is inside the row (leaving room for the More button)
  useLayoutEffect(() => {
    const el = box.current; if (!el || fit !== count) return;
    const kids = [...el.querySelectorAll<HTMLElement>(':scope > [data-g]')];
    const room = el.clientWidth - (pinned ? (el.querySelector<HTMLElement>(':scope > [data-pin]')?.offsetWidth ?? 0) + 8 : 0);
    let n = kids.length;
    for (let i = 0; i < kids.length; i++) { const right = kids[i].offsetLeft + kids[i].offsetWidth; if (right > room - (i < kids.length - 1 ? 36 : 0)) { n = i; break; } }
    if (n < kids.length) setFit(Math.max(1, n));
  });
  useLayoutEffect(() => {
    const el = box.current; if (!el) return;
    let w = el.clientWidth;
    const ro = new ResizeObserver(() => { if (el.clientWidth !== w) { w = el.clientWidth; setFit(count); } });
    ro.observe(el); return () => ro.disconnect();
  }, [count]);
  const shown = Math.min(fit, count);
  return (
    <div ref={box} role="toolbar" aria-label={label} className={`tb-bar bt-top relative flex flex-nowrap items-center gap-1 px-2 py-1 ${className}`}>
      {groups.slice(0, shown).map((g, i) => <div key={i} data-g className="inline-flex shrink-0 items-center gap-px">{g}{i < count - 1 && <span className="mx-1 h-5 w-px self-center bg-line" aria-hidden />}</div>)}
      {shown < count && (
        <div data-more className="shrink-0">
          <Popover label="More tools" trigger={<MoreHorizontal size={16} />} align="right">
            {() => <div className="flex max-w-[min(42rem,90vw)] flex-wrap items-center gap-1 p-1">{groups.slice(shown).map((g, i) => <div key={i} className="inline-flex items-center gap-px">{g}</div>)}</div>}
          </Popover>
        </div>
      )}
      {pinned && <><span className="flex-1" /><div data-pin className="shrink-0">{pinned}</div></>}
    </div>
  );
}
