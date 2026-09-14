var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  ANDROID_APP_ID: () => ANDROID_APP_ID,
  ANDROID_OPEN_COMMAND_ID: () => ANDROID_OPEN_COMMAND_ID,
  ANDROID_OPEN_SHORTCUT_HELP_ID: () => ANDROID_OPEN_SHORTCUT_HELP_ID,
  AndroidIcon: () => AndroidIcon,
  activate: () => activate,
  appId: () => appId,
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);

// src/constants.ts
var ANDROID_APP_ID = "com.agnx.android";
var ANDROID_OPEN_COMMAND_ID = "android.open";
var ANDROID_OPEN_SHORTCUT_HELP_ID = "workspace-command-android";

// src/macros.ts
var ANDROID_MACROS_STORAGE_KEY = "macros-v1";
function asObject(raw) {
  return raw && typeof raw === "object" ? raw : {};
}
function asOptionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : void 0;
}
function asNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function buttonToCommand(button) {
  const key = button.trim().toLowerCase();
  if (key === "home") return { action: "navigate_home" };
  if (key === "back") return { action: "navigate_back" };
  if (key === "recents" || key === "recent") return { action: "navigate_recents" };
  if (key === "power") return { action: "input_keyevent", keycode: "KEYCODE_POWER" };
  if (key === "volume_up") return { action: "input_keyevent", keycode: "KEYCODE_VOLUME_UP" };
  if (key === "volume_down") return { action: "input_keyevent", keycode: "KEYCODE_VOLUME_DOWN" };
  return null;
}
function parseStep(raw) {
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
    const durationMs = asNumber(o.durationMs) ?? void 0;
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
    return { type: "wait", ms: Math.min(Math.floor(ms), 3e4) };
  }
  return null;
}
function parseMacroSteps(raw) {
  if (!Array.isArray(raw) || raw.length === 0) {
    return null;
  }
  const steps = [];
  for (const item of raw) {
    const step = parseStep(item);
    if (!step) {
      return null;
    }
    steps.push(step);
  }
  return steps;
}
async function readBlob(host) {
  try {
    const raw = await host.storage.readJson(ANDROID_APP_ID, ANDROID_MACROS_STORAGE_KEY);
    const o = asObject(raw);
    const macrosRaw = Array.isArray(o.macros) ? o.macros : [];
    const macros = [];
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
async function writeBlob(host, blob) {
  await host.storage.writeJson(ANDROID_APP_ID, ANDROID_MACROS_STORAGE_KEY, blob);
}
async function listAndroidMacros(host) {
  const blob = await readBlob(host);
  return blob.macros.slice().sort((a, b) => b.updatedAt - a.updatedAt);
}
async function getAndroidMacro(host, id) {
  const blob = await readBlob(host);
  return blob.macros.find((m) => m.id === id) ?? null;
}
async function saveAndroidMacro(host, input) {
  const blob = await readBlob(host);
  const id = input.id?.trim() || `macro_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const next = {
    id,
    name: input.name.trim(),
    steps: input.steps,
    updatedAt: Date.now()
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
async function deleteAndroidMacro(host, id) {
  const blob = await readBlob(host);
  const before = blob.macros.length;
  blob.macros = blob.macros.filter((m) => m.id !== id);
  if (blob.macros.length === before) {
    return false;
  }
  await writeBlob(host, blob);
  return true;
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function runAndroidMacroSteps(host, sessionId, steps) {
  const android = host.android;
  if (!android) {
    return { ok: false, error: "host.android_unavailable" };
  }
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (step.type === "wait") {
      await sleep(step.ms);
      continue;
    }
    let command = null;
    if (step.type === "tap") {
      command = { action: "input_tap", x: step.x, y: step.y };
    } else if (step.type === "swipe") {
      command = {
        action: "input_swipe",
        x1: step.x1,
        y1: step.y1,
        x2: step.x2,
        y2: step.y2,
        durationMs: step.durationMs
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
        stepIndex: i
      };
    }
  }
  return { ok: true };
}

// src/agent-tools.ts
function isSessionError(value) {
  return "ok" in value && value.ok === false;
}
function asObject2(raw) {
  return raw && typeof raw === "object" ? raw : {};
}
function asOptionalString2(value) {
  return typeof value === "string" && value.trim() ? value.trim() : void 0;
}
function asNumber2(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function requireAndroid(host) {
  if (!host.android) {
    return null;
  }
  return host.android;
}
var SESSION_SELECT_PROPERTIES = {
  sessionId: { type: "string", description: "daemon \u4F1A\u8BDD id\uFF1B\u5DF2\u77E5\u65F6\u4F18\u5148\u3002" },
  tabTitle: {
    type: "string",
    description: "\u5DE5\u4F5C\u533A\u5B89\u5353 Tab \u6807\u9898\uFF08\u7528\u6237\u91CD\u547D\u540D\u6216\u8BBE\u5907\u578B\u53F7\uFF09\uFF0C\u652F\u6301\u6A21\u7CCA\u5339\u914D\u3002"
  },
  tab: {
    type: "string",
    description: "tabTitle \u522B\u540D\u3002"
  },
  tabId: { type: "string", description: "\u5DE5\u4F5C\u533A tabId\u3002" },
  androidId: { type: "string", description: "\u6295\u5C4F Tab \u5B9E\u4F53 androidId\u3002" },
  deviceId: { type: "string", description: "ADB serial\uFF1B\u65E0\u6253\u5F00\u4F1A\u8BDD\u65F6\u53EF\u7528\u6765 createSession\u3002" },
  createIfMissing: {
    type: "boolean",
    description: "\u65E0\u5339\u914D\u5DF2\u6253\u5F00\u4F1A\u8BDD\u65F6\u662F\u5426\u65B0\u5EFA\u3002\u9ED8\u8BA4\uFF1A\u65E0\u6253\u5F00\u4F1A\u8BDD\u6216\u8BE5 device \u672A\u6253\u5F00\u65F6\u624D\u65B0\u5EFA\u3002"
  }
};
async function resolveSessionId(host, input) {
  const android = requireAndroid(host);
  if (!android) {
    return { ok: false, error: "host.android_unavailable" };
  }
  const createIfMissingRaw = input.createIfMissing;
  let createIfMissing;
  if (createIfMissingRaw === true) {
    createIfMissing = true;
  } else if (createIfMissingRaw === false) {
    createIfMissing = false;
  }
  const result = await android.resolveSession({
    sessionId: asOptionalString2(input.sessionId),
    androidId: asOptionalString2(input.androidId),
    tabId: asOptionalString2(input.tabId),
    tabTitle: asOptionalString2(input.tabTitle) ?? asOptionalString2(input.tab),
    deviceId: asOptionalString2(input.deviceId),
    createIfMissing
  });
  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      message: result.message,
      candidates: result.candidates
    };
  }
  return {
    sessionId: result.sessionId,
    source: result.source,
    title: result.title,
    tabId: result.tabId,
    androidId: result.androidId
  };
}
function buttonToCommand2(button) {
  const key = button.trim().toLowerCase();
  if (key === "home") return { action: "navigate_home" };
  if (key === "back") return { action: "navigate_back" };
  if (key === "recents" || key === "recent") return { action: "navigate_recents" };
  if (key === "power") return { action: "input_keyevent", keycode: "KEYCODE_POWER" };
  if (key === "volume_up") return { action: "input_keyevent", keycode: "KEYCODE_VOLUME_UP" };
  if (key === "volume_down") return { action: "input_keyevent", keycode: "KEYCODE_VOLUME_DOWN" };
  return null;
}
function registerAndroidAgentTools(host) {
  return host.registerAgentTools({
    appId: ANDROID_APP_ID,
    availability: "always",
    tools: [
      {
        name: "android_list_devices",
        description: "\u5217\u51FA\u5DF2\u8FDE\u63A5\u7684 Android \u8BBE\u5907\uFF08\u7ECF Agnx host.android / daemon ADB\uFF09\u3002",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false
        },
        execute: async () => {
          const android = requireAndroid(host);
          if (!android) {
            return { ok: false, error: "host.android_unavailable" };
          }
          const devices = await android.listDevices();
          return { ok: true, devices };
        }
      },
      {
        name: "android_list_open_sessions",
        description: "\u5217\u51FA\u5DE5\u4F5C\u533A\u5DF2\u6253\u5F00\u4E14\u5DF2\u8FDE\u63A5\u7684\u5B89\u5353\u6295\u5C4F\uFF08\u542B Tab \u6807\u9898 / tabId / sessionId\uFF09\u3002\u64CD\u63A7\u524D\u5148\u770B\u8FD9\u4E2A\u6216 list_workspace_tabs\uFF0C\u6309 Tab \u540D\u9009\u673A\u3002",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false
        },
        execute: async () => {
          const android = requireAndroid(host);
          if (!android) {
            return { ok: false, error: "host.android_unavailable" };
          }
          const sessions = await android.listOpenTabSessions();
          return { ok: true, sessions };
        }
      },
      {
        name: "android_screenshot",
        description: "\u622A\u53D6\u8BBE\u5907\u5C4F\u5E55 PNG\uFF08dataUrl\uFF09\u3002\u4F18\u5148\u7ED1\u5DF2\u6253\u5F00\u6295\u5C4F\uFF1A\u53EF\u4F20 tabTitle\uFF08Tab \u540D\uFF09/ tabId / sessionId\uFF1B\u7701\u7565\u5219\u7528 focused \u5B89\u5353 Tab\u3002\u52FF\u5728\u5DF2\u6709\u6295\u5C4F\u65F6\u76F2\u76EE\u65B0\u5EFA\u4F1A\u8BDD\u3002",
        inputSchema: {
          type: "object",
          properties: { ...SESSION_SELECT_PROPERTIES },
          additionalProperties: false
        },
        execute: async (raw) => {
          const input = asObject2(raw);
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
            screenshotDataUrl: result.screenshotDataUrl
          };
        }
      },
      {
        name: "android_tap",
        description: "\u5728\u8BBE\u5907\u5750\u6807 (x,y) \u70B9\u51FB\u3002\u5750\u6807\u4E3A\u8BBE\u5907\u50CF\u7D20\uFF08\u4E0E Inspect/\u6295\u5C4F\u4E00\u81F4\uFF09\u3002\u9009\u673A\u4F1A\u8BDD\u540C screenshot\uFF08tabTitle / focused\uFF09\u3002",
        inputSchema: {
          type: "object",
          properties: {
            ...SESSION_SELECT_PROPERTIES,
            x: { type: "number" },
            y: { type: "number" }
          },
          required: ["x", "y"],
          additionalProperties: false
        },
        execute: async (raw) => {
          const input = asObject2(raw);
          const android = requireAndroid(host);
          if (!android) {
            return { ok: false, error: "host.android_unavailable" };
          }
          const x = asNumber2(input.x);
          const y = asNumber2(input.y);
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
            y
          });
          return {
            ok: result.ok,
            sessionId: session.sessionId,
            source: session.source,
            title: session.title,
            error: result.error
          };
        }
      },
      {
        name: "android_swipe",
        description: "\u5728\u8BBE\u5907\u50CF\u7D20\u5750\u6807\u95F4\u6ED1\u52A8 (x1,y1)\u2192(x2,y2)\u3002\u53EF\u9009 durationMs\u3002\u9009\u673A\u540C screenshot\u3002",
        inputSchema: {
          type: "object",
          properties: {
            ...SESSION_SELECT_PROPERTIES,
            x1: { type: "number" },
            y1: { type: "number" },
            x2: { type: "number" },
            y2: { type: "number" },
            durationMs: { type: "number" }
          },
          required: ["x1", "y1", "x2", "y2"],
          additionalProperties: false
        },
        execute: async (raw) => {
          const input = asObject2(raw);
          const android = requireAndroid(host);
          if (!android) {
            return { ok: false, error: "host.android_unavailable" };
          }
          const x1 = asNumber2(input.x1);
          const y1 = asNumber2(input.y1);
          const x2 = asNumber2(input.x2);
          const y2 = asNumber2(input.y2);
          if (x1 == null || y1 == null || x2 == null || y2 == null) {
            return { ok: false, error: "swipe_coords_required" };
          }
          const durationMs = asNumber2(input.durationMs) ?? void 0;
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
            durationMs
          });
          return {
            ok: result.ok,
            sessionId: session.sessionId,
            source: session.source,
            title: session.title,
            error: result.error
          };
        }
      },
      {
        name: "android_send_text",
        description: "\u5411\u5F53\u524D\u7126\u70B9\u8F93\u5165\u6587\u672C\uFF08input_text\uFF09\u3002\u9009\u673A\u540C screenshot\u3002",
        inputSchema: {
          type: "object",
          properties: {
            ...SESSION_SELECT_PROPERTIES,
            text: { type: "string" }
          },
          required: ["text"],
          additionalProperties: false
        },
        execute: async (raw) => {
          const input = asObject2(raw);
          const android = requireAndroid(host);
          if (!android) {
            return { ok: false, error: "host.android_unavailable" };
          }
          const text = asOptionalString2(input.text);
          if (!text) {
            return { ok: false, error: "text_required" };
          }
          const session = await resolveSessionId(host, input);
          if (isSessionError(session)) {
            return session;
          }
          const result = await android.runCommand(session.sessionId, {
            action: "input_text",
            text
          });
          return {
            ok: result.ok,
            sessionId: session.sessionId,
            source: session.source,
            title: session.title,
            error: result.error
          };
        }
      },
      {
        name: "android_press_button",
        description: "\u6309\u4E0B\u5BFC\u822A/\u97F3\u91CF\u952E\uFF1Ahome | back | recents | power | volume_up | volume_down\u3002\u9009\u673A\u540C screenshot\u3002",
        inputSchema: {
          type: "object",
          properties: {
            ...SESSION_SELECT_PROPERTIES,
            button: { type: "string" }
          },
          required: ["button"],
          additionalProperties: false
        },
        execute: async (raw) => {
          const input = asObject2(raw);
          const android = requireAndroid(host);
          if (!android) {
            return { ok: false, error: "host.android_unavailable" };
          }
          const button = asOptionalString2(input.button);
          if (!button) {
            return { ok: false, error: "button_required" };
          }
          const command = buttonToCommand2(button);
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
            error: result.error
          };
        }
      },
      {
        name: "android_macro_list",
        description: "\u5217\u51FA\u5DF2\u4FDD\u5B58\u7684\u5B89\u5353\u5B8F\uFF08id/name/\u6B65\u9AA4\u6570/\u66F4\u65B0\u65F6\u95F4\uFF09\u3002\u843D\u76D8 host.storage macros-v1\u3002",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false
        },
        execute: async () => {
          const macros = await listAndroidMacros(host);
          return {
            ok: true,
            macros: macros.map((m) => ({
              id: m.id,
              name: m.name,
              stepCount: m.steps.length,
              updatedAt: m.updatedAt
            }))
          };
        }
      },
      {
        name: "android_macro_get",
        description: "\u8BFB\u53D6\u5355\u4E2A\u5B8F\u7684\u5B8C\u6574\u6B65\u9AA4\uFF08tap/swipe/text/button/wait\uFF09\u3002",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string" }
          },
          required: ["id"],
          additionalProperties: false
        },
        execute: async (raw) => {
          const id = asOptionalString2(asObject2(raw).id);
          if (!id) {
            return { ok: false, error: "id_required" };
          }
          const macro = await getAndroidMacro(host, id);
          if (!macro) {
            return { ok: false, error: "macro_not_found", id };
          }
          return { ok: true, macro };
        }
      },
      {
        name: "android_macro_save",
        description: "\u4FDD\u5B58/\u8986\u76D6\u5B8F\u3002steps: [{type:tap,x,y}|{type:swipe,x1,y1,x2,y2,durationMs?}|{type:text,text}|{type:button,button}|{type:wait,ms}]\u3002\u53EF\u9009 id \u8986\u76D6\u3002",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            steps: { type: "array" }
          },
          required: ["name", "steps"],
          additionalProperties: false
        },
        execute: async (raw) => {
          const input = asObject2(raw);
          const name = asOptionalString2(input.name);
          if (!name) {
            return { ok: false, error: "name_required" };
          }
          const steps = parseMacroSteps(input.steps);
          if (!steps) {
            return { ok: false, error: "invalid_steps" };
          }
          const macro = await saveAndroidMacro(host, {
            id: asOptionalString2(input.id),
            name,
            steps
          });
          return { ok: true, macro };
        }
      },
      {
        name: "android_macro_run",
        description: "\u6309 id \u56DE\u653E\u5B8F\u6B65\u9AA4\u3002\u9009\u673A\u540C screenshot\uFF08tabTitle / focused / sessionId\uFF09\u3002",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string" },
            ...SESSION_SELECT_PROPERTIES
          },
          required: ["id"],
          additionalProperties: false
        },
        execute: async (raw) => {
          const input = asObject2(raw);
          const id = asOptionalString2(input.id);
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
            macroId: id
          };
        }
      },
      {
        name: "android_macro_delete",
        description: "\u5220\u9664\u5B8F\u3002\u7834\u574F\u6027\u64CD\u4F5C\uFF0C\u9700\u8981 confirm:true\u3002",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string" },
            confirm: { type: "boolean" }
          },
          required: ["id", "confirm"],
          additionalProperties: false
        },
        execute: async (raw) => {
          const input = asObject2(raw);
          if (input.confirm !== true) {
            return {
              ok: false,
              error: "confirm_required",
              message: "Destructive action requires confirm: true"
            };
          }
          const id = asOptionalString2(input.id);
          if (!id) {
            return { ok: false, error: "id_required" };
          }
          const deleted = await deleteAndroidMacro(host, id);
          if (!deleted) {
            return { ok: false, error: "macro_not_found", id };
          }
          return { ok: true, deletedId: id };
        }
      }
    ]
  });
}

// src/android-icon.tsx
var import_react_native_svg = __toESM(require("react-native-svg"));
var import_jsx_runtime = require("react/jsx-runtime");
function AndroidIcon(props) {
  const size = typeof props.size === "number" ? props.size : Number(props.size) || 16;
  const color = props.color ?? "currentColor";
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react_native_svg.default, { width: size, height: size, viewBox: "0 0 24 24", fill: color, accessibilityRole: "image", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    import_react_native_svg.Path,
    {
      d: "M17.6 9.48 19.44 6.3c.16-.31.04-.69-.26-.85a.637.637 0 0 0-.83.22l-1.88 3.24a11.43 11.43 0 0 0-8.94 0L5.65 5.67a.643.643 0 0 0-.87-.2.642.642 0 0 0-.27.83l1.84 3.18C4.56 11.54 3.25 14.04 3 17h18c-.25-2.96-1.56-5.46-3.4-7.52ZM7 15.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Zm10 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Z",
      fill: color
    }
  ) });
}

// src/index.ts
var appId = ANDROID_APP_ID;
function openAndroidTab(host, context) {
  const open = host.android?.openTab;
  if (typeof open !== "function") {
    return;
  }
  open({
    serverId: context?.serverId,
    workspaceId: context?.workspaceId,
    currentPathname: context?.currentPathname
  });
}
function activate(host) {
  registerAndroidAgentTools(host);
  host.registerCommand({
    id: "android.agent-context",
    appId: ANDROID_APP_ID,
    title: "\u5B89\u5353 Agent Context",
    keywords: ["android", "agent context", "\u5B89\u5353\u5DE5\u5177", "android tools"],
    icon: AndroidIcon,
    run: () => {
      host.ui.openAppAgentContext({ appId: ANDROID_APP_ID });
    }
  });
  host.registerCommand({
    id: ANDROID_OPEN_COMMAND_ID,
    appId: ANDROID_APP_ID,
    title: "\u5B89\u5353\u6295\u5C4F",
    keywords: [
      "android",
      "adb",
      "\u5B89\u5353",
      "\u624B\u673A",
      "\u6295\u5C4F",
      "\u8BBE\u5907",
      "android device",
      "scrcpy",
      "\u6253\u5F00\u5B89\u5353",
      "\u5B89\u5353\u8BBE\u5907"
    ],
    icon: AndroidIcon,
    // 复用宿主已注册的 ⇧⌘A help，避免再绑同一套 combo 导致连开两个 Tab（Cmd/Ctrl+Shift+A）。
    shortcutHelpId: ANDROID_OPEN_SHORTCUT_HELP_ID,
    sidebarAction: {
      defaultVisible: true,
      label: "\u5B89\u5353\u6295\u5C4F",
      order: 35
    },
    run: (context) => {
      openAndroidTab(host, context);
    }
  });
}
var moduleExport = {
  appId: ANDROID_APP_ID,
  activate
};
var index_default = moduleExport;
