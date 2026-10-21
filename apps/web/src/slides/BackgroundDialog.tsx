import { useState } from 'react';
import { Dialog } from '../components/Dialog.tsx';
import { Select } from '../components/Select.tsx';
import { ColourField, HexBox } from '../components/ColourField.tsx';
import { COLOURS } from '../editor/fonts.ts';
import { SlideStage } from './SlideCanvas.tsx';
import { isDarkImage } from './pptx.ts';
import type { Deck, Gradient, Slide } from './model.ts';

export type Backdrop = Pick<Slide, 'bg' | 'bgGrad' | 'bgImage' | 'bgDark'>;
const PRESET_COLOURS = ['#ffffff', '#f4f1e8', '#e9ecef', '#dbe9f9', '#d3f0e6', '#fde8d0', '#26292e', '#0b2545', '#1f6f5c', '#7a2e1d', '#000000'];
const GRADIENTS: Gradient[] = [
  { from: '#ffffff', to: '#cfd8e3', angle: 180 }, { from: '#fdfbfb', to: '#ebedee', angle: 135 }, { from: '#a1c4fd', to: '#c2e9fb', angle: 135 }, { from: '#fbc2eb', to: '#a6c1ee', angle: 135 },
  { from: '#43cea2', to: '#185a9d', angle: 135 }, { from: '#f12711', to: '#f5af19', angle: 90 }, { from: '#0f2027', to: '#2c5364', angle: 180 }, { from: '#232526', to: '#414345', angle: 180 },
];
const ANGLES = [[90, '→ left to right'], [135, '↘ corner to corner'], [180, '↓ top to bottom'], [225, '↙ corner to corner'], [270, '← right to left'], [315, '↖ corner to corner'], [0, '↑ bottom to top'], [45, '↗ corner to corner']] as const;

/** Change background (as in Google Slides): a colour, a gradient or a picture, shown live on a small slide, for this slide or all of them. */
export function BackgroundDialog({ slide, deck, onApply, onClose }: { slide: Slide; deck: Deck; onApply: (b: Backdrop, all: boolean) => void; onClose: () => void }) {
  const [draft, setDraft] = useState<Backdrop>({ bg: slide.bg, bgGrad: slide.bgGrad, bgImage: slide.bgImage, bgDark: slide.bgDark });
  const [all, setAll] = useState(false);
  const [error, setError] = useState('');
  const colour = (c: string) => setDraft({ bg: c });
  const grad = (g: Gradient) => setDraft({ bgGrad: g });
  const image = (file: File | undefined) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|gif|webp|bmp)$/.test(file.type)) { setError('Choose a PNG, JPEG, GIF, WebP or BMP picture.'); return; }
    const r = new FileReader();
    r.onload = async () => { const src = String(r.result); setError(''); setDraft({ bgImage: src, bgDark: await isDarkImage(src) }); };
    r.readAsDataURL(file);
  };
  const preview: Slide = { id: 'preview', els: [], notes: '', ...draft };
  const g = draft.bgGrad;
  return (
    <Dialog title="Background" wide onClose={onClose} footer={<>
      <button className="btn mr-auto" onClick={() => setDraft({})}>Reset</button>
      <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />Apply to all slides</label>
      <button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-accent" onClick={() => onApply(draft, all)}>Done</button></>}>
      <div className="grid gap-4 text-sm md:grid-cols-[auto_minmax(0,1fr)]">
        <div className="justify-self-center"><SlideStage slide={preview} deck={deck} scale={260 / deck.w} /></div>
        <div className="grid content-start gap-4">
          <section aria-label="Colour"><div className="mb-1 font-medium">Colour</div>
            <div className="flex flex-wrap items-center gap-1">
              {PRESET_COLOURS.map((c) => <button key={c} type="button" aria-label={`Background ${c}`} title={c} className={`h-6 w-6 rounded border ${draft.bg === c && !draft.bgGrad && !draft.bgImage ? 'border-accent ring-2 ring-accent' : 'border-line'}`} style={{ background: c }} onClick={() => colour(c)} />)}
              <HexBox value={draft.bg ?? '#ffffff'} onPick={colour} className="ml-1" />
            </div>
            <div className="mt-1 flex flex-wrap gap-1">{COLOURS.map((c) => <button key={c} type="button" aria-label={`Background ${c}`} title={c} className="h-5 w-5 rounded border border-line" style={{ background: c }} onClick={() => colour(c)} />)}</div>
          </section>
          <section aria-label="Gradient"><div className="mb-1 font-medium">Gradient</div>
            <div className="flex flex-wrap gap-1.5">
              {GRADIENTS.map((x, i) => <button key={i} type="button" aria-label={`Gradient ${i + 1}`} className="h-6 w-10 rounded border border-line" style={{ background: `linear-gradient(${x.angle}deg, ${x.from}, ${x.to})` }} onClick={() => grad(x)} />)}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              From <ColourField label="Gradient from" value={g?.from ?? '#ffffff'} onChange={(c) => grad({ from: c, to: g?.to ?? '#cfd8e3', angle: g?.angle ?? 180 })} />
              to <ColourField label="Gradient to" value={g?.to ?? '#cfd8e3'} onChange={(c) => grad({ from: g?.from ?? '#ffffff', to: c, angle: g?.angle ?? 180 })} />
              <Select label="Gradient direction" className="!w-52" value={g?.angle ?? 180} options={ANGLES.map(([v, l]) => ({ value: v as number, label: l }))} onChange={(v) => grad({ from: g?.from ?? '#ffffff', to: g?.to ?? '#cfd8e3', angle: v })} />
            </div>
          </section>
          <section aria-label="Image"><div className="mb-1 font-medium">Image</div>
            <div className="flex items-center gap-2">
              <label className="btn cursor-pointer">Choose image…<input type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/bmp" hidden aria-label="Background image" onChange={(e) => { image(e.target.files?.[0]); e.target.value = ''; }} /></label>
              {draft.bgImage && <button className="btn" onClick={() => setDraft({})}>Remove image</button>}
            </div>
            {error && <p role="alert" className="mt-1 text-bad">{error}</p>}
          </section>
        </div>
      </div>
    </Dialog>
  );
}
