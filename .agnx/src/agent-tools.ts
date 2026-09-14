// 场景：安卓子应用向 Agent 暴露设备/截图/触控工具（Context VFS；对标 Another MCP 目录）。
import type { AndroidHostCommand, WorkspaceAppHostApi } from "@getagnx/app-sdk";
import { ANDROID_APP_ID } from "./constants";
import {
  deleteAndroidMacro,
  getAndroidMacro,
  listAndroidMacros,
  parseMacroSteps,
  runAndroidMacroSteps,
  saveAndroidMacro,
} from "./macros";

type SessionResolve =
  | { sessionId: string; source?: string; title?: string; tabId?: string; androidId?: string }
  | { ok: false; error: string; message?: string; candidates?: unknown };

function isSessionError(value: SessionResolve): value is { ok: false; error: string } {
  return "ok" in value && value.ok === false;
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

function requireAndroid(host: WorkspaceAppHostApi) {
  if (!host.android) {
    return null;
  }
  return host.android;
}

const SESSION_SELECT_PROPERTIES = {
  sessionId: { type: "string", description: "daemon 会话 id；已知时优先。" },
  tabTitle: {
    type: "string",
    description: "工作区安卓 Tab 标题（用户重命名或设备型号），支持模糊匹配。",
  },
  tab: {
    type: "string",
    description: "tabTitle 别名。",
  },
  tabId: { type: "string", description: "工作区 tabId。" },
  androidId: { type: "string", description: "投屏 Tab 实体 androidId。" },
  deviceId: { type: "string", description: "ADB serial；无打开会话时可用来 createSession。" },
  createIfMissing: {
    type: "boolean",
    description: "无匹配已打开会话时是否新建。默认：无打开会话或该 device 未打开时才新建。",
  },
} as const;

async function resolveSessionId(
  host: WorkspaceAppHostApi,
  input: Record<string, unknown>,
): Promise<SessionResolve> {
  const android = requireAndroid(host);
  if (!android) {
    return { ok: false, error: "host.android_unavailable" };
  }

  const createIfMissingRaw = input.createIfMissing;
  let createIfMissing: boolean | undefined;
  if (createIfMissingRaw === true) {
    createIfMissing = true;
  } else if (createIfMissingRaw === false) {
    createIfMissing = false;
  }

  const result = await android.resolveSession({
    sessionId: asOptionalString(input.sessionId),
    androidId: asOptionalString(input.androidId),
    tabId: asOptionalString(input.tabId),
    tabTitle: asOptionalString(input.tabTitle) ?? asOptionalString(input.tab),
    deviceId: asOptionalString(input.deviceId),
    createIfMissing,
  });

  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      message: result.message,
      candidates: result.candidates,
    };
  }

  return {
    sessionId: result.sessionId,
    source: result.source,
    title: result.title,
    tabId: result.tabId,
    androidId: result.androidId,
  };
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

export function registerAndroidAgentTools(host: WorkspaceAppHostApi): () => void {
  return host.registerAgentTools({
    appId: ANDROID_APP_ID,
    availability: "always",
    tools: [
      {
        name: "android_list_devices",
        description: "列出已连接的 Android 设备（经 Agnx host.android / daemon ADB）。",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        execute: async () => {
          const android = requireAndroid(host);
          if (!android) {
            return { ok: false, error: "host.android_unavailable" };
          }
          const devices = await android.listDevices();
          return { ok: true, devices };
        },
      },
      {
        name: "android_list_open_sessions",
        description:
          "列出工作区已打开且已连接的安卓投屏（含 Tab 标题 / tabId / sessionId）。操控前先看这个或 list_workspace_tabs，按 Tab 名选机。",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        execute: async () => {
          const android = requireAndroid(host);
          if (!android) {
            return { ok: false, error: "host.android_unavailable" };
          }
          const sessions = await android.listOpenTabSessions();
          return { ok: true, sessions };
        },
      },
      {
        name: "android_screenshot",
        description:
          "截取设备屏幕 PNG（dataUrl）。优先绑已打开投屏：可传 tabTitle（Tab 名）/ tabId / sessionId；省略则用 focused 安卓 Tab。勿在已有投屏时盲目新建会话。",
        inputSchema: {
          type: "object",
          properties: { ...SESSION_SELECT_PROPERTIES },
          additionalProperties: false,
        },
        execute: async (raw) => {
          const input = asObject(raw);
          const android = requireAndroid(host);
          if (!android) {
            return { ok: false, error: "host.android_unavailable" };
          }
          const session = await resolveSessionId(host, input);
          if (isSessionError(session)) {
            return session;
          }
          const result = await android.runCommand(session.sessionId, { action: "screenshot" });
          return {
            ok: result.ok,
            sessionId: session.sessionId,
            source: session.source,
            title: session.title,
            error: result.error,
            screenshotDataUrl: result.screenshotDataUrl,
          };
        },
      },
      {
        name: "android_tap",
        description:
          "在设备坐标 (x,y) 点击。坐标为设备像素（与 Inspect/投屏一致）。选机会话同 screenshot（tabTitle / focused）。",
        inputSchema: {
          type: "object",
          properties: {
            ...SESSION_SELECT_PROPERTIES,
            x: { type: "number" },
            y: { type: "number" },
          },
          required: ["x", "y"],
          additionalProperties: false,
        },
        execute: async (raw) => {
          const input = asObject(raw);
          const android = requireAndroid(host);
          if (!android) {
            return { ok: false, error: "host.android_unavailable" };
          }
          const x = asNumber(input.x);
          const y = asNumber(input.y);
          if (x == null || y == null) {
            return { ok: false, error: "x_y_required" };
          }
          const session = await resolveSessionId(host, input);
          if (isSessionError(session)) {
            return session;
          }
          const result = await android.runCommand(session.sessionId, {
            action: "input_tap",
            x,
            y,
          });
          return {
            ok: result.ok,
            sessionId: session.sessionId,
            source: session.source,
            title: session.title,
            error: result.error,
          };
        },
      },
      {
        name: "android_swipe",
        description: "在设备像素坐标间滑动 (x1,y1)→(x2,y2)。可选 durationMs。选机同 screenshot。",
        inputSchema: {
          type: "object",
          properties: {
            ...SESSION_SELECT_PROPERTIES,
            x1: { type: "number" },
            y1: { type: "number" },
            x2: { type: "number" },
            y2: { type: "number" },
            durationMs: { type: "number" },
          },
          required: ["x1", "y1", "x2", "y2"],
          additionalProperties: false,
        },
        execute: async (raw) => {
          const input = asObject(raw);
          const android = requireAndroid(host);
          if (!android) {
            return { ok: false, error: "host.android_unavailable" };
          }
          const x1 = asNumber(input.x1);
          const y1 = asNumber(input.y1);
          const x2 = asNumber(input.x2);
          const y2 = asNumber(input.y2);
          if (x1 == null || y1 == null || x2 == null || y2 == null) {
            return { ok: false, error: "swipe_coords_required" };
          }
          const durationMs = asNumber(input.durationMs) ?? undefined;
          const session = await resolveSessionId(host, input);
          if (isSessionError(session)) {
            return session;
          }
          const result = await android.runCommand(session.sessionId, {
            action: "input_swipe",
            x1,
            y1,
            x2,
            y2,
            durationMs,
          });
          return {
            ok: result.ok,
            sessionId: session.sessionId,
            source: session.source,
            title: session.title,
            error: result.error,
          };
        },
      },
      {
        name: "android_send_text",
        description: "向当前焦点输入文本（input_text）。选机同 screenshot。",
        inputSchema: {
          type: "object",
          properties: {
            ...SESSION_SELECT_PROPERTIES,
            text: { type: "string" },
          },
          required: ["text"],
          additionalProperties: false,
        },
        execute: async (raw) => {
          const input = asObject(raw);
          const android = requireAndroid(host);
          if (!android) {
            return { ok: false, error: "host.android_unavailable" };
          }
          const text = asOptionalString(input.text);
          if (!text) {
            return { ok: false, error: "text_required" };
          }
          const session = await resolveSessionId(host, input);
          if (isSessionError(session)) {
            return session;
          }
          const result = await android.runCommand(session.sessionId, {
            action: "input_text",
            text,
          });
          return {
            ok: result.ok,
            sessionId: session.sessionId,
            source: session.source,
            title: session.title,
            error: result.error,
          };
        },
      },
      {
        name: "android_press_button",
        description:
          "按下导航/音量键：home | back | recents | power | volume_up | volume_down。选机同 screenshot。",
        inputSchema: {
          type: "object",
          properties: {
            ...SESSION_SELECT_PROPERTIES,
            button: { type: "string" },
          },
          required: ["button"],
          additionalProperties: false,
        },
        execute: async (raw) => {
          const input = asObject(raw);
          const android = requireAndroid(host);
          if (!android) {
            return { ok: false, error: "host.android_unavailable" };
          }
          const button = asOptionalString(input.button);
          if (!button) {
            return { ok: false, error: "button_required" };
          }
          const command = buttonToCommand(button);
          if (!command) {
            return { ok: false, error: "unsupported_button", button };
          }
          const session = await resolveSessionId(host, input);
          if (isSessionError(session)) {
            return session;
          }
          const result = await android.runCommand(session.sessionId, command);
          return {
            ok: result.ok,
            sessionId: session.sessionId,
            source: session.source,
            title: session.title,
            error: result.error,
          };
        },
      },
      {
        name: "android_macro_list",
        description: "列出已保存的安卓宏（id/name/步骤数/更新时间）。落盘 host.storage macros-v1。",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        execute: async () => {
          const macros = await listAndroidMacros(host);
          return {
            ok: true,
            macros: macros.map((m) => ({
              id: m.id,
              name: m.name,
              stepCount: m.steps.length,
              updatedAt: m.updatedAt,
            })),
          };
        },
      },
      {
        name: "android_macro_get",
        description: "读取单个宏的完整步骤（tap/swipe/text/button/wait）。",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
          additionalProperties: false,
        },
        execute: async (raw) => {
          const id = asOptionalString(asObject(raw).id);
          if (!id) {
            return { ok: false, error: "id_required" };
          }
          const macro = await getAndroidMacro(host, id);
          if (!macro) {
            return { ok: false, error: "macro_not_found", id };
          }
          return { ok: true, macro };
        },
      },
      {
        name: "android_macro_save",
        description:
          "保存/覆盖宏。steps: [{type:tap,x,y}|{type:swipe,x1,y1,x2,y2,durationMs?}|{type:text,text}|{type:button,button}|{type:wait,ms}]。可选 id 覆盖。",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            steps: { type: "array" },
          },
          required: ["name", "steps"],
          additionalProperties: false,
        },
        execute: async (raw) => {
          const input = asObject(raw);
          const name = asOptionalString(input.name);
          if (!name) {
            return { ok: false, error: "name_required" };
          }
          const steps = parseMacroSteps(input.steps);
          if (!steps) {
            return { ok: false, error: "invalid_steps" };
          }
          const macro = await saveAndroidMacro(host, {
            id: asOptionalString(input.id),
            name,
            steps,
          });
          return { ok: true, macro };
        },
      },
      {
        name: "android_macro_run",
        description: "按 id 回放宏步骤。选机同 screenshot（tabTitle / focused / sessionId）。",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string" },
            ...SESSION_SELECT_PROPERTIES,
          },
          required: ["id"],
          additionalProperties: false,
        },
        execute: async (raw) => {
          const input = asObject(raw);
          const id = asOptionalString(input.id);
          if (!id) {
            return { ok: false, error: "id_required" };
          }
          const macro = await getAndroidMacro(host, id);
          if (!macro) {
            return { ok: false, error: "macro_not_found", id };
          }
          const session = await resolveSessionId(host, input);
          if (isSessionError(session)) {
            return session;
          }
          const result = await runAndroidMacroSteps(host, session.sessionId, macro.steps);
          return {
            ...result,
            sessionId: session.sessionId,
            source: session.source,
            title: session.title,
            macroId: id,
          };
        },
      },
      {
        name: "android_macro_delete",
        description: "删除宏。破坏性操作，需要 confirm:true。",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string" },
            confirm: { type: "boolean" },
          },
          required: ["id", "confirm"],
          additionalProperties: false,
        },
        execute: async (raw) => {
          const input = asObject(raw);
          if (input.confirm !== true) {
            return {
              ok: false,
              error: "confirm_required",
              message: "Destructive action requires confirm: true",
            };
          }
          const id = asOptionalString(input.id);
          if (!id) {
            return { ok: false, error: "id_required" };
          }
          const deleted = await deleteAndroidMacro(host, id);
          if (!deleted) {
            return { ok: false, error: "macro_not_found", id };
          }
          return { ok: true, deletedId: id };
        },
      },
    ],
  });
}
