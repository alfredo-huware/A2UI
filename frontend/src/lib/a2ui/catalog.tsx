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
  component: A2UIComponent;
  /** props with bindings already resolved */
  props: Record<string, unknown>;
}

type Renderer = (ctx: RenderCtx) => React.ReactNode;

const text = (v: unknown, fallback = "") => (v == null ? fallback : String(v));

export const A2UI_CATALOG: Record<string, Renderer> = {
  Card: ({ props, renderChild }) => {
    const children = Array.isArray(props.children) 
      ? props.children 
      : (props.children?.explicitList ?? (props.child ? [props.child] : []));
    return (
      <div className="panel p-4 animate-fade-in flex flex-col h-full">
        {props.title ? <div className="mb-3 font-semibold">{text(props.title)}</div> : null}
        <div className="space-y-3">{children.map((id: string) => renderChild(id))}</div>
      </div>
    );
  },
  Text: ({ props }) => {
    const txt = props.text?.literalString ?? text(props.text);
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
  Icon: ({ props }) => (
    <Badge variant="secondary">
      {props.name?.literalString ?? text(props.name, "Icon")}
    </Badge>
  ),
  Button: ({ props, component, emit }) => {
    const action = props.action ?? (component as any).action;
    return (
      <Button
        variant={(props.variant as "default" | "secondary" | "outline" | "ghost" | "primary") === "primary" ? "default" : "secondary"}
        size="sm"
        onClick={() => emit({ componentId: component.id, event: "click", value: action })}
      >
        {text(props.child ?? props.label, "Submit")}
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
    const bindPath = (props.value as any)?.path;
    const bind = bindPath ? `$state${bindPath.replace(/\//g, ".")}` : component.bindings?.find((b) => b.prop === "value")?.source;
    const value = (bind ? resolveBinding(bind, state) : props.value) as string ?? "";
    return (
      <div className="space-y-1.5">
        {props.label ? <Label className="text-xs text-muted-foreground">{text(props.label)}</Label> : null}
        <Input
          value={value}
          placeholder={text(props.placeholder, "")}
          type={(props.type as string) ?? "text"}
          onChange={(e) => {
            if (bind) setState((s) => setNested(s, bind, e.target.value));
          }}
        />
      </div>
    );
  },
  TextField: (ctx) => A2UI_CATALOG.Input(ctx),
  Select: ({ props, component, setState, state }) => {
    const bindPath = (props.value as any)?.path;
    const bind = bindPath ? `$state${bindPath.replace(/\//g, ".")}` : component.bindings?.find((b) => b.prop === "value")?.source;
    const options = (props.options as Array<{ label: string; value: string }>) ?? [];
    const value = (bind ? resolveBinding(bind, state) : props.value) as string ?? "";
    return (
      <div className="space-y-1.5">
        {props.label ? <Label className="text-xs text-muted-foreground">{text(props.label)}</Label> : null}
        <Select value={value} onValueChange={(v) => bind && setState((s) => setNested(s, bind, v))}>
          <SelectTrigger><SelectValue placeholder={text(props.placeholder, "Select…")} /></SelectTrigger>
          <SelectContent>
            {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    );
  },
  ChoicePicker: (ctx) => A2UI_CATALOG.Select(ctx),
  Checkbox: ({ props, component, setState }) => {
    const bind = component.bindings?.find((b) => b.prop === "checked")?.source;
    const checked = Boolean(props.checked);
    return (
      <label className="inline-flex items-center gap-2 text-sm">
        <Checkbox
          checked={checked}
          onCheckedChange={(v) => bind && setState((s) => setNested(s, bind, Boolean(v)))}
        />
        <span>{text(props.label)}</span>
      </label>
    );
  },
  RadioGroup: ({ props, component, setState }) => {
    const bind = component.bindings?.find((b) => b.prop === "value")?.source;
    const options = (props.options as Array<{ label: string; value: string }>) ?? [];
    const value = (props.value as string) ?? "";
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
  Badge: ({ props }) => (
    <Badge variant={(props.variant as "default" | "secondary" | "outline" | "destructive") ?? "secondary"}>
      {text(props.label)}
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
