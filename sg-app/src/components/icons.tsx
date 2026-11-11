import type { ReactNode } from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

type IconProps = { color: string; size?: number; strokeWidth?: number };

function Icon({ color, size = 20, strokeWidth = 2, children }: IconProps & { children: ReactNode }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <G fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
        {children}
      </G>
    </Svg>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <Circle cx="16" cy="7" r="2" />
      <Circle cx="10" cy="17" r="2" />
    </Icon>
  );
}

export function SendIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M5 12h14" />
      <Path d="M13 6l6 6-6 6" />
    </Icon>
  );
}

export function MicIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Rect x="9" y="3" width="6" height="11" rx="3" />
      <Path d="M5 11a7 7 0 0 0 14 0" />
      <Path d="M12 18v3" />
    </Icon>
  );
}

export function BackIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M15 6l-6 6 6 6" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M5 12l5 5 9-9" />
    </Icon>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z" />
      <Path d="M9 12l2 2 4-4" />
    </Icon>
  );
}

export function GlassesIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Circle cx="6" cy="15" r="3.5" />
      <Circle cx="18" cy="15" r="3.5" />
      <Path d="M9.5 15h5" />
      <Path d="M2.5 15L4 7h2" />
      <Path d="M21.5 15L20 7h-2" />
    </Icon>
  );
}
