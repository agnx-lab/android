// 场景：安卓宏（D4）— 触控/按键步骤序列；落盘 host.storage；回放经 host.android.runCommand。
import type { AndroidHostCommand, WorkspaceAppHostApi } from "@getagnx/app-sdk";
import { ANDROID_APP_ID } from "./constants";

export const ANDROID_MACROS_STORAGE_KEY = "macros-v1";

export type AndroidMacroStep =
  | { type: "tap"; x: number; y: number }
  | {
      type: "swipe";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      durationMs?: number;
    }
  | { type: "text"; text: string }
  | { type: "button"; button: string }
  | { type: "wait"; ms: number };

export interface AndroidMacro {
  id: string;
  name: string;
  steps: AndroidMacroStep[];
  updatedAt: number;
}

interface MacrosBlob {
  version: 1;
  macros: AndroidMacro[];
}

function asObject(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function buttonToCommand(button: string): AndroidHostCommand | null {
  const key = button.trim().toLowerCase();
  if (key === "home") return { action: "navigate_home" };
  if (key === "back") return { action: "navigate_back" };
  if (key === "recents" || key === "recent") return { action: "navigate_recents" };
  if (key === "power") return { action: "input_keyevent", keycode: "KEYCODE_POWER" };
  if (key === "volume_up") return { action: "input_keyevent", keycode: "KEYCODE_VOLUME_UP" };
  if (key === "volume_down") return { action: "input_keyevent", keycode: "KEYCODE_VOLUME_DOWN" };
  return null;
}

function parseStep(raw: unknown): AndroidMacroStep | null {
  const o = asObject(raw);
  const type = asOptionalString(o.type);
  if (!type) return null;
  if (type === "tap") {
    const x = asNumber(o.x);
    const y = asNumber(o.y);
    if (x == null || y == null) return null;
    return { type: "tap", x, y };
  }
  if (type === "swipe") {
    const x1 = asNumber(o.x1);
    const y1 = asNumber(o.y1);
    const x2 = asNumber(o.x2);
    const y2 = asNumber(o.y2);
    if (x1 == null || y1 == null || x2 == null || y2 == null) return null;
    const durationMs = asNumber(o.durationMs) ?? undefined;
    return { type: "swipe", x1, y1, x2, y2, durationMs };
  }
  if (type === "text") {
    const text = asOptionalString(o.text);
    if (!text) return null;
    return { type: "text", text };
  }
  if (type === "button") {
    const button = asOptionalString(o.button);
    if (!button || !buttonToCommand(button)) return null;
    return { type: "button", button };
  }
  if (type === "wait") {
    const ms = asNumber(o.ms);
    if (ms == null || ms < 0) return null;
    return { type: "wait", ms: Math.min(Math.floor(ms), 30_000) };
  }
  return null;
}

export function parseMacroSteps(raw: unknown): AndroidMacroStep[] | null {
  if (!Array.isArray(raw) || raw.length === 0) {
    return null;
  }
  const steps: AndroidMacroStep[] = [];
  for (const item of raw) {
    const step = parseStep(item);
    if (!step) {
      return null;
    }
    steps.push(step);
  }
  return steps;
}

async function readBlob(host: WorkspaceAppHostApi): Promise<MacrosBlob> {
  try {
    const raw = await host.storage.readJson(ANDROID_APP_ID, ANDROID_MACROS_STORAGE_KEY);
    const o = asObject(raw);
    const macrosRaw = Array.isArray(o.macros) ? o.macros : [];
    const macros: AndroidMacro[] = [];
    for (const item of macrosRaw) {
      const m = asObject(item);
      const id = asOptionalString(m.id);
      const name = asOptionalString(m.name);
      const steps = parseMacroSteps(m.steps);
      const updatedAt = asNumber(m.updatedAt) ?? Date.now();
      if (!id || !name || !steps) continue;
      macros.push({ id, name, steps, updatedAt });
    }
    return { version: 1, macros };
  } catch {
    return { version: 1, macros: [] };
  }
}

async function writeBlob(host: WorkspaceAppHostApi, blob: MacrosBlob): Promise<void> {
  await host.storage.writeJson(ANDROID_APP_ID, ANDROID_MACROS_STORAGE_KEY, blob);
}

export async function listAndroidMacros(host: WorkspaceAppHostApi): Promise<AndroidMacro[]> {
  const blob = await readBlob(host);
  return blob.macros.slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getAndroidMacro(
  host: WorkspaceAppHostApi,
  id: string,
): Promise<AndroidMacro | null> {
  const blob = await readBlob(host);
  return blob.macros.find((m) => m.id === id) ?? null;
}

export async function saveAndroidMacro(
  host: WorkspaceAppHostApi,
  input: { id?: string; name: string; steps: AndroidMacroStep[] },
): Promise<AndroidMacro> {
  const blob = await readBlob(host);
  const id =
    input.id?.trim() ||
    `macro_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const next: AndroidMacro = {
    id,
    name: input.name.trim(),
    steps: input.steps,
    updatedAt: Date.now(),
  };
  const idx = blob.macros.findIndex((m) => m.id === id);
  if (idx >= 0) {
    blob.macros[idx] = next;
  } else {
    blob.macros.push(next);
  }
  await writeBlob(host, blob);
  return next;
}

export async function deleteAndroidMacro(host: WorkspaceAppHostApi, id: string): Promise<boolean> {
  const blob = await readBlob(host);
  const before = blob.macros.length;
  blob.macros = blob.macros.filter((m) => m.id !== id);
  if (blob.macros.length === before) {
    return false;
  }
  await writeBlob(host, blob);
  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runAndroidMacroSteps(
  host: WorkspaceAppHostApi,
  sessionId: string,
  steps: AndroidMacroStep[],
): Promise<{ ok: boolean; error?: string; stepIndex?: number }> {
  const android = host.android;
  if (!android) {
    return { ok: false, error: "host.android_unavailable" };
  }
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    if (step.type === "wait") {
      await sleep(step.ms);
      continue;
    }
    let command: AndroidHostCommand | null = null;
    if (step.type === "tap") {
      command = { action: "input_tap", x: step.x, y: step.y };
    } else if (step.type === "swipe") {
      command = {
        action: "input_swipe",
        x1: step.x1,
        y1: step.y1,
        x2: step.x2,
        y2: step.y2,
        durationMs: step.durationMs,
      };
    } else if (step.type === "text") {
      command = { action: "input_text", text: step.text };
    } else if (step.type === "button") {
      command = buttonToCommand(step.button);
    }
    if (!command) {
      return { ok: false, error: "unsupported_step", stepIndex: i };
    }
    const result = await android.runCommand(sessionId, command);
    if (!result.ok) {
      return {
        ok: false,
        error: result.error?.message ?? "command_failed",
        stepIndex: i,
      };
    }
  }
  return { ok: true };
}
