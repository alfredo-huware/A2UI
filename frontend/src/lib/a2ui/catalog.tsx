import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import type { A2UIComponent, A2UIAction } from "./types";
import { resolveBinding } from "./binding";

export interface RenderCtx {
  state: Record<string, unknown>;
  setState: (updater: (s: Record<string, unknown>) => Record<string, unknown>) => void;
  emit: (action: Omit<A2UIAction, "state">) => void;
  renderChild: (id: string) => React.ReactNode;
  hasComponent: (id: string) => boolean;
  component: A2UIComponent;
  /** props with bindings already resolved */
  props: Record<string, unknown>;
}

type Renderer = (ctx: RenderCtx) => React.ReactNode;

/**
 * A2UI v0.8 wraps most scalar props in `{ literalString | literalNumber | literalBoolean | literalArray | path }`.
 * `asText` extracts a printable string; `bindPathOf` returns the `$state.foo.bar` form for two-way bindings.
 */
function asText(v: unknown, fallback = ""): string {
  if (v == null) return fallback;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.literalString === "string") return o.literalString;
    if (typeof o.literalNumber === "number") return String(o.literalNumber);
    if (typeof o.literalBoolean === "boolean") return String(o.literalBoolean);
    return fallback;
  }
  return fallback;
}

function bindPathOf(v: unknown): string | null {
  if (v && typeof v === "object" && typeof (v as { path?: unknown }).path === "string") {
    const p = (v as { path: string }).path;
    return `$state${p.replace(/\//g, ".")}`;
  }
  return null;
}

function resolveValue(v: unknown, state: Record<string, unknown>): unknown {
  const bind = bindPathOf(v);
  if (bind) return resolveBinding(bind, state);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("literalString" in o) return o.literalString;
    if ("literalNumber" in o) return o.literalNumber;
    if ("literalBoolean" in o) return o.literalBoolean;
    if ("literalArray" in o) return o.literalArray;
  }
  return v;
}

const text = (v: unknown, fallback = "") => asText(v, fallback);

export const A2UI_CATALOG: Record<string, Renderer> = {
  Card: ({ props, renderChild, state }) => {
    const children = Array.isArray(props.children)
      ? props.children
      : (props.children?.explicitList ?? (props.child ? [props.child] : []));
    return (
      <div className="panel p-4 animate-fade-in flex flex-col h-full">
        {props.title ? <div className="mb-3 font-semibold">{asText(resolveValue(props.title, state))}</div> : null}
        <div className="space-y-3">{children.map((id: string) => renderChild(id))}</div>
      </div>
    );
  },
  Text: ({ props, state }) => {
    const txt = asText(resolveValue(props.text, state));
    const hint = (props.usageHint ?? props.variant) as string;
    
    if (hint?.startsWith("h")) {
      const level = Math.min(6, Math.max(1, parseInt(hint.slice(1)) || 2));
      const Tag = (`h${level}` as unknown) as keyof JSX.IntrinsicElements;
      const sizes = ["text-2xl", "text-xl", "text-lg", "text-base", "text-sm", "text-sm"];
      return <Tag className={`font-semibold tracking-tight ${sizes[level - 1]}`}>{txt}</Tag>;
    }
    
    return (
      <p className={`text-sm leading-relaxed ${hint === "muted" ? "text-muted-foreground" : "text-foreground"}`}>
        {txt}
      </p>
    );
  },
  Icon: ({ props, state }) => (
    <Badge variant="secondary">
      {asText(resolveValue(props.name, state), "Icon")}
    </Badge>
  ),
  Button: ({ props, component, emit, renderChild, hasComponent }) => {
    const action = props.action ?? (component as any).action;
    const isPrimary = props.primary === true || props.variant === "primary";
    const childRef = typeof props.child === "string" ? props.child : null;
    const childIsComponent = childRef !== null && hasComponent(childRef);
    return (
      <Button
        variant={isPrimary ? "default" : "secondary"}
        size="sm"
        onClick={() => emit({ componentId: component.id, event: "click", value: action })}
      >
        {childIsComponent
          ? renderChild(childRef!)
          : text(props.child ?? props.label, "Submit")}
      </Button>
    );
  },
  Column: ({ props, renderChild }) => {
    const children = Array.isArray(props.children) ? props.children : (props.children?.explicitList ?? []);
    return (
      <div className="flex flex-col" style={{ gap: (props.gap as string) ?? "0.75rem" }}>
        {children.map((id: string) => renderChild(id))}
      </div>
    );
  },
  Row: ({ props, renderChild }) => {
    const children = Array.isArray(props.children) ? props.children : (props.children?.explicitList ?? []);
    const justify = props.distribution === "spaceBetween" ? "justify-between" : "justify-start";
    return (
      <div className={`flex items-center flex-wrap ${justify}`} style={{ gap: (props.gap as string) ?? "0.5rem" }}>
        {children.map((id: string) => renderChild(id))}
      </div>
    );
  },
  Stack: ({ props, renderChild }) => {
    const children = Array.isArray(props.children) ? props.children : (props.children?.explicitList ?? []);
    return (
      <div className="flex flex-col" style={{ gap: (props.gap as string) ?? "0.75rem" }}>
        {children.map((id: string) => renderChild(id))}
      </div>
    );
  },
  List: ({ props, component, renderChild }) => {
    const children = Array.isArray(props.children) ? props.children : (props.children?.explicitList ?? component.children ?? []);
    return (
      <ul className="space-y-1.5 list-disc pl-5 text-sm">
        {children.map((id: string) => <li key={id}>{renderChild(id)}</li>)}
      </ul>
    );
  },
  Input: ({ props, component, setState, state }) => {
    // v0.8 schema uses `text` for the value spec; LLM shortcuts often use `value`.
    const valueSpec = props.text ?? props.value;
    const bind = bindPathOf(valueSpec) ?? component.bindings?.find((b) => b.prop === "value")?.source;
    const resolved = bind ? resolveBinding(bind, state) : resolveValue(valueSpec, state);
    const value = resolved == null ? "" : String(resolved);
    const labelText = asText(resolveValue(props.label, state));
    const inputType =
      props.textFieldType === "number"
        ? "number"
        : props.textFieldType === "date"
        ? "date"
        : props.textFieldType === "obscured"
        ? "password"
        : (props.type as string) ?? "text";
    return (
      <div className="space-y-1.5">
        {labelText ? <Label className="text-xs text-muted-foreground">{labelText}</Label> : null}
        <Input
          value={value}
          placeholder={asText(resolveValue(props.placeholder, state))}
          type={inputType}
          onChange={(e) => {
            if (bind) setState((s) => setNested(s, bind, e.target.value));
          }}
        />
      </div>
    );
  },
  TextField: (ctx) => A2UI_CATALOG.Input(ctx),
  Select: ({ props, component, setState, state }) => {
    // v0.8 MultipleChoice uses `selections` (array spec); LLM shortcuts/v0.9 use `value`.
    const valueSpec = props.value ?? props.selections;
    const bind = bindPathOf(valueSpec) ?? component.bindings?.find((b) => b.prop === "value")?.source;
    const rawOptions = (props.options as Array<Record<string, unknown>>) ?? [];
    const options = rawOptions.map((o) => ({
      value: String(o.value ?? ""),
      label: asText(resolveValue(o.label, state), String(o.value ?? "")),
    }));
    const resolvedSel = bind ? resolveBinding(bind, state) : resolveValue(valueSpec, state);
    const value = Array.isArray(resolvedSel)
      ? String(resolvedSel[0] ?? "")
      : resolvedSel == null
      ? ""
      : String(resolvedSel);
    const labelText = asText(resolveValue(props.label, state));
    const isArrayBind =
      Array.isArray(resolvedSel) ||
      (valueSpec != null && typeof valueSpec === "object" && "literalArray" in (valueSpec as Record<string, unknown>));
    const writeBind = (v: string) => {
      if (!bind) return;
      // If the source spec was an array (MultipleChoice.selections), preserve array shape.
      setState((s) => setNested(s, bind, isArrayBind ? [v] : v));
    };
    return (
      <div className="space-y-1.5">
        {labelText ? <Label className="text-xs text-muted-foreground">{labelText}</Label> : null}
        <Select value={value} onValueChange={writeBind}>
          <SelectTrigger><SelectValue placeholder={asText(resolveValue(props.placeholder, state), "Select…")} /></SelectTrigger>
          <SelectContent>
            {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    );
  },
  ChoicePicker: (ctx) => A2UI_CATALOG.Select(ctx),
  MultipleChoice: (ctx) => {
    // v0.8 supports `variant: "checkbox" | "radio" | "dropdown"`.
    const variant = ctx.props.variant as string | undefined;
    if (variant === "checkbox") return A2UI_CATALOG.CheckboxGroup(ctx);
    if (variant === "radio") return A2UI_CATALOG.RadioGroup(ctx);
    return A2UI_CATALOG.Select(ctx);
  },
  CheckboxGroup: ({ props, component, setState, state }) => {
    // Multi-select checkbox list. `selections` is a literalArray or path
    // pointing to an array of selected values.
    const valueSpec = props.value ?? props.selections;
    const bind = bindPathOf(valueSpec) ?? component.bindings?.find((b) => b.prop === "value")?.source;
    const rawOptions = (props.options as Array<Record<string, unknown>>) ?? [];
    const options = rawOptions.map((o) => ({
      value: String(o.value ?? ""),
      label: asText(resolveValue(o.label, state), String(o.value ?? "")),
    }));
    const resolved = bind ? resolveBinding(bind, state) : resolveValue(valueSpec, state);
    const selected = new Set<string>(
      Array.isArray(resolved) ? resolved.map((v) => String(v)) : [],
    );
    const labelText = asText(resolveValue(props.label, state));
    const toggle = (val: string, checked: boolean) => {
      if (!bind) return;
      const next = new Set(selected);
      if (checked) next.add(val); else next.delete(val);
      setState((s) => setNested(s, bind, Array.from(next)));
    };
    return (
      <div className="space-y-2">
        {labelText ? <Label className="text-xs text-muted-foreground">{labelText}</Label> : null}
        <div className="space-y-1.5">
          {options.map((o) => (
            <label key={o.value} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={selected.has(o.value)}
                onCheckedChange={(v) => toggle(o.value, Boolean(v))}
              />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      </div>
    );
  },
  Checkbox: ({ props, component, setState, state }) => {
    // v0.8 schema uses `value` ({ literalBoolean | path }); shortcut uses `checked`.
    const valueSpec = props.value ?? props.checked;
    const bind = bindPathOf(valueSpec) ?? component.bindings?.find((b) => b.prop === "checked")?.source;
    const resolved = bind ? resolveBinding(bind, state) : resolveValue(valueSpec, state);
    const checked = Boolean(resolved);
    return (
      <label className="inline-flex items-center gap-2 text-sm">
        <Checkbox
          checked={checked}
          onCheckedChange={(v) => bind && setState((s) => setNested(s, bind, Boolean(v)))}
        />
        <span>{asText(resolveValue(props.label, state))}</span>
      </label>
    );
  },
  CheckBox: (ctx) => A2UI_CATALOG.Checkbox(ctx),
  RadioGroup: ({ props, component, setState, state }) => {
    const valueSpec = props.value;
    const bind = bindPathOf(valueSpec) ?? component.bindings?.find((b) => b.prop === "value")?.source;
    const rawOptions = (props.options as Array<Record<string, unknown>>) ?? [];
    const options = rawOptions.map((o) => ({
      value: String(o.value ?? ""),
      label: asText(resolveValue(o.label, state), String(o.value ?? "")),
    }));
    const resolved = bind ? resolveBinding(bind, state) : resolveValue(valueSpec, state);
    const value = resolved == null ? "" : String(resolved);
    return (
      <RadioGroup value={value} onValueChange={(v) => bind && setState((s) => setNested(s, bind, v))} className="space-y-1.5">
        {options.map((o) => (
          <label key={o.value} className="flex items-center gap-2 text-sm">
            <RadioGroupItem value={o.value} /> {o.label}
          </label>
        ))}
      </RadioGroup>
    );
  },
  Form: ({ props, component, renderChild, emit, state }) => {
    const data = component.component?.Form as any;
    const children = data?.children?.explicitList ?? [];
    return (
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          emit({ componentId: component.id, event: "submit", value: state });
        }}
      >
        <div className="space-y-3">{children.map((id: string) => renderChild(id))}</div>
        {props.submitLabel !== false ? (
          <Button type="submit" size="sm">{text(props.submitLabel, "Submit")}</Button>
        ) : null}
      </form>
    );
  },
  Divider: () => <Separator />,
  Badge: ({ props, state }) => (
    <Badge variant={(props.variant as "default" | "secondary" | "outline" | "destructive") ?? "secondary"}>
      {asText(resolveValue(props.label, state))}
    </Badge>
  ),
  Spinner: () => (
    <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
    </div>
  ),
};

function setNested(obj: Record<string, unknown>, source: string, value: unknown): Record<string, unknown> {
  // local copy of binding setter to avoid extra import cycles
  if (!source.startsWith("$state")) return obj;
  const path = source.slice("$state".length).replace(/^\./, "");
  if (!path) return (typeof value === "object" && value ? (value as Record<string, unknown>) : obj);
  const keys = path.split(".");
  const next: Record<string, unknown> = { ...obj };
  let cursor: Record<string, unknown> = next;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    const existing = cursor[k];
    cursor[k] = existing && typeof existing === "object" ? { ...(existing as Record<string, unknown>) } : {};
    cursor = cursor[k] as Record<string, unknown>;
  }
  cursor[keys[keys.length - 1]] = value;
  return next;
}
