import { z } from "zod";

/**
 * A2UI v0.9 (subset) — a flat list of components addressed by ID, with explicit
 * separation between UI structure, app state, and rendering. We model:
 *   - components: list of { id, type, props, children? }  (children are IDs)
 *   - root: id of the root component
 *   - state: per-tree state object that components can bind to via $state.path
 *   - dataBindings: optional map of { propPath: "$state.path" } per component
 */

export const A2UIBinding = z.object({
  /** dot-path within component.props (e.g. "value") */
  prop: z.string(),
  /** "$state.user.name" */
  source: z.string(),
});

export const A2UIComponent = z.object({
  id: z.string(),
  weight: z.number().optional(),
  component: z.record(z.string(), z.unknown()),
});
export type A2UIComponent = z.infer<typeof A2UIComponent>;

export const A2UITree = z.object({
  version: z.string().optional(),
  root: z.string(),
  components: z.array(A2UIComponent),
  state: z.record(z.string(), z.unknown()).optional(),
  /** Optional surface id so multiple A2UI trees in one assistant turn don't collide. */
  surfaceId: z.string().optional(),
});
export type A2UITree = z.infer<typeof A2UITree>;

/** Action emitted when a user interacts with an A2UI component. */
export interface A2UIAction {
  surfaceId?: string;
  componentId: string;
  event: string; // "click" | "submit" | "change" | ...
  value?: unknown;
  /** snapshot of the per-tree state at the time of action */
  state?: Record<string, unknown>;
}
