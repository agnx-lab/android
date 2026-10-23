// 场景：com.agnx.android first-party 壳 — 打开入口 + Agent 工具；投屏引擎仍由宿主承载。
import type { WorkspaceAppHostApi, WorkspaceAppModule } from "@agnx-lab/app-sdk";
import { registerAndroidAgentTools } from "./agent-tools";
import { AndroidIcon } from "./android-icon";
import {
  ANDROID_APP_ID,
  ANDROID_OPEN_COMMAND_ID,
  ANDROID_OPEN_SHORTCUT_HELP_ID,
} from "./constants";

export const appId = ANDROID_APP_ID;

function openAndroidTab(
  host: WorkspaceAppHostApi,
  context?: {
    serverId?: string;
    workspaceId?: string;
    currentPathname?: string | null;
  },
): void {
  const open = host.android?.openTab;
  if (typeof open !== "function") {
    return;
  }
  open({
    serverId: context?.serverId,
    workspaceId: context?.workspaceId,
    currentPathname: context?.currentPathname,
  });
}

export function activate(host: WorkspaceAppHostApi): void {
  registerAndroidAgentTools(host);

  host.registerCommand({
    id: "android.agent-context",
    appId: ANDROID_APP_ID,
    title: "安卓 Agent Context",
    keywords: ["android", "agent context", "安卓工具", "android tools"],
    icon: AndroidIcon,
    run: () => {
      host.ui.openAppAgentContext({ appId: ANDROID_APP_ID });
    },
  });

  // 只驱动命令面板「子应用」行 / 快捷键展示；不要再往宿主 WORKSPACE_ACTION 双重注册打开入口。
  host.registerCommand({
    id: ANDROID_OPEN_COMMAND_ID,
    appId: ANDROID_APP_ID,
    title: "安卓投屏",
    keywords: [
      "android",
      "adb",
      "安卓",
      "手机",
      "投屏",
      "设备",
      "android device",
      "scrcpy",
      "打开安卓",
      "安卓设备",
    ],
    icon: AndroidIcon,
    // 复用宿主已注册的 ⇧⌘A help，避免再绑同一套 combo 导致连开两个 Tab（Cmd/Ctrl+Shift+A）。
    shortcutHelpId: ANDROID_OPEN_SHORTCUT_HELP_ID,
    sidebarAction: {
      defaultVisible: true,
      label: "安卓投屏",
      order: 35,
    },
    run: (context) => {
      openAndroidTab(host, context);
    },
  });
}

const moduleExport: WorkspaceAppModule = {
  appId: ANDROID_APP_ID,
  activate,
};

export default moduleExport;

export {
  ANDROID_APP_ID,
  ANDROID_OPEN_COMMAND_ID,
  ANDROID_OPEN_SHORTCUT_HELP_ID,
} from "./constants";
export { AndroidIcon } from "./android-icon";
