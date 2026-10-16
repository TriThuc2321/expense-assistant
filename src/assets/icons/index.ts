import type { SVGProps } from 'react';

import dynamic from 'next/dynamic';

export const FlagUSIcon = dynamic<SVGProps<SVGSVGElement>>(
  () => import('./flag-us.svg'),
);
export const FlagVNIcon = dynamic<SVGProps<SVGSVGElement>>(
  () => import('./flag-vi.svg'),
);
export const LogoIcon = dynamic<SVGProps<SVGSVGElement>>(
  () => import('./logo.svg'),
);
export const LogoHorizontalIcon = dynamic<SVGProps<SVGSVGElement>>(
  () => import('./logo-horizontal.svg'),
);
