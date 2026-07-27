import type { FC } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { ScenarioId, ToolDefinition } from '@/lib/types';

export interface ScenarioModule {
  id: ScenarioId;
  title: string;
  tagline: string;
  /** Landing-card call-to-action label (falls back to 'Open'). */
  cta?: string;
  /** Composer placeholder text (falls back to `Ask Atlas — ${title}…`). */
  placeholder?: string;
  icon: LucideIcon;
  accent: string;
  mapMode: '2d' | '3d';
  systemPrompt: string;
  tools: ToolDefinition[];
  suggestions: string[];
  Panel: FC;
  /**
   * Whether `Panel` currently has something worth showing.
   *
   * The workspace sits behind a disclosure so an empty panel does not compete
   * with the agent's answer — but once the recipe has actually built something
   * (an itinerary, a dossier, creatives), keeping it collapsed hides the result
   * behind a click. A recipe answers for its own store; omitting it just means
   * the workspace always starts collapsed.
   *
   * This is a hook: it is called from a component subscribed to the recipe's
   * store, so the disclosure opens the moment content arrives.
   */
  useWorkspacePopulated?: () => boolean;
  MapLayer: FC;
  Overlay?: FC;
  onEnter?: () => void;
  onExit?: () => void;
  onPlaceSelect?: (place: google.maps.places.Place) => void | Promise<void>;
}
