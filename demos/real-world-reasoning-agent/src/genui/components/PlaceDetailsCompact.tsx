/**
 * PlaceDetailsCompact — official Maps Agentic UI Toolkit (MAUI) component alias
 * for PlaceCard with orientation support ('horizontal' | 'vertical') and Places UI Kit.
 */
import type { FC } from 'react';
import type { ComponentNode } from '../protocol';
import type { SurfaceState } from '../store';
import { PlaceCard } from './PlaceCard';

export const PlaceDetailsCompact: FC<{ node: ComponentNode; surface: SurfaceState; scope?: string }> = (props) => {
  return <PlaceCard {...props} />;
};
