// 场景：Android 官方机器人 logo（Material 风格），供子应用命令/侧栏用；吃主题 color。
import Svg, { Path } from "react-native-svg";

/** 符合 WorkspaceAppIcon 函数签名；fill 跟宿主 theme.colors。 */
export function AndroidIcon(props: {
  size?: number | string;
  color?: string;
  absoluteStrokeWidth?: boolean;
}) {
  const size = typeof props.size === "number" ? props.size : Number(props.size) || 16;
  const color = props.color ?? "currentColor";
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} accessibilityRole="image">
      <Path
        d="M17.6 9.48 19.44 6.3c.16-.31.04-.69-.26-.85a.637.637 0 0 0-.83.22l-1.88 3.24a11.43 11.43 0 0 0-8.94 0L5.65 5.67a.643.643 0 0 0-.87-.2.642.642 0 0 0-.27.83l1.84 3.18C4.56 11.54 3.25 14.04 3 17h18c-.25-2.96-1.56-5.46-3.4-7.52ZM7 15.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Zm10 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Z"
        fill={color}
      />
    </Svg>
  );
}
