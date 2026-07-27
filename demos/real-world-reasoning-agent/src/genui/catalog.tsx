/**
 * The Atlas A2UI catalog registry — maps a protocol `component` name to its
 * React implementation. Every entry resolves its props through
 * `resolveDynamic(node.prop, surface.dataModel, scope)`; an unknown component
 * name is handled by CatalogNode (renders a subtle "unsupported: X" chip, it
 * never throws).
 */
import type { FC } from 'react';
import type { ComponentNode } from './protocol';
import type { SurfaceState } from './store';
import { Column, Row, Card, Divider } from './components/Layout';
import { Text } from './components/Text';
import { Button } from './components/Button';
import { List } from './components/List';
import { ChoicePicker } from './components/ChoicePicker';
import { StatGrid } from './components/StatGrid';
import { PlaceCard } from './components/PlaceCard';
import { MapPreview } from './components/MapPreview';
import { AdCreative } from './components/AdCreative';
import { Image } from './components/Image';
import { Video } from './components/Video';
import { ProgressStatus } from './components/ProgressStatus';
import { RecoverableError } from './components/RecoverableError';
import { EvidenceSource } from './components/EvidenceSource';
import { RouteItinerary } from './components/RouteItinerary';
import { EtaSummary } from './components/EtaSummary';
import { ComparisonTable } from './components/ComparisonTable';
import { ConfirmationResult } from './components/ConfirmationResult';
import { GroundingAttribution } from './components/GroundingAttribution';
import { NextActions } from './components/NextActions';

export type CatalogComponent = FC<{ node: ComponentNode; surface: SurfaceState; scope?: string }>;

export const CATALOG: Record<string, CatalogComponent> = {
  Column,
  Row,
  Card,
  Divider,
  Text,
  Button,
  List,
  ChoicePicker,
  StatGrid,
  PlaceCard,
  MapPreview,
  AdCreative,
  Image,
  Video,
  // Atlas A2UI v0.9 subset — journey-proven additions (see promptGuide.ts).
  ProgressStatus,
  RecoverableError,
  EvidenceSource,
  RouteItinerary,
  EtaSummary,
  ComparisonTable,
  ConfirmationResult,
  GroundingAttribution,
  NextActions,
};
