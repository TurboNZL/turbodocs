/// <reference types="vite/client" />
import type { DetailedHTMLProps, HTMLAttributes } from 'react';

declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'turbo-themes-picker': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & { variant?: 'select' | 'tiles'; floating?: boolean; sections?: string; label?: string };
    }
  }
}
