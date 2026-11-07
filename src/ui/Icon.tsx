import React from 'react';
import Svg, { Path, Circle, Rect, Line, Polyline } from 'react-native-svg';

// Feather-style stroke icons (24x24).
const P: Record<string, React.ReactNode> = {
  home: <><Path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></>,
  compass: <><Circle cx="12" cy="12" r="9" /><Path d="m15.5 8.5-2 5-5 2 2-5z" /></>,
  layers: <><Path d="m12 3 9 5-9 5-9-5z" /><Path d="m3 13 9 5 9-5" /></>,
  calendar: <><Rect x="3" y="5" width="18" height="16" rx="2" /><Line x1="3" y1="10" x2="21" y2="10" /><Line x1="8" y1="3" x2="8" y2="7" /><Line x1="16" y1="3" x2="16" y2="7" /></>,
  user: <><Circle cx="12" cy="8" r="4" /><Path d="M4 21a8 8 0 0 1 16 0" /></>,
  users: <><Circle cx="9" cy="8" r="3.5" /><Path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><Path d="M16 4.5a3.5 3.5 0 0 1 0 7" /><Path d="M18 14.5a6.5 6.5 0 0 1 3.5 5.5" /></>,
  bell: <><Path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7z" /><Path d="M10 20a2 2 0 0 0 4 0" /></>,
  search: <><Circle cx="11" cy="11" r="7" /><Line x1="21" y1="21" x2="16.5" y2="16.5" /></>,
  sliders: <><Line x1="4" y1="6" x2="20" y2="6" /><Line x1="4" y1="12" x2="20" y2="12" /><Line x1="4" y1="18" x2="20" y2="18" /><Circle cx="9" cy="6" r="2" fill="#0D1B18" /><Circle cx="15" cy="12" r="2" fill="#0D1B18" /><Circle cx="8" cy="18" r="2" fill="#0D1B18" /></>,
  back: <><Line x1="19" y1="12" x2="5" y2="12" /><Polyline points="12 19 5 12 12 5" /></>,
  chevronRight: <><Polyline points="9 6 15 12 9 18" /></>,
  chevronDown: <><Polyline points="6 9 12 15 18 9" /></>,
  plus: <><Line x1="12" y1="5" x2="12" y2="19" /><Line x1="5" y1="12" x2="19" y2="12" /></>,
  check: <><Polyline points="5 12.5 10 17.5 19 7.5" /></>,
  x: <><Line x1="6" y1="6" x2="18" y2="18" /><Line x1="18" y1="6" x2="6" y2="18" /></>,
  eye: <><Path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><Circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><Path d="M3 3l18 18" /><Path d="M10.6 6.2A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.5 6.8C3.8 8.6 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 4.2-.9" /><Path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>,
  mail: <><Rect x="3" y="5" width="18" height="14" rx="2" /><Polyline points="3 7 12 13 21 7" /></>,
  lock: <><Rect x="5" y="11" width="14" height="10" rx="2" /><Path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  phone: <><Path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" /></>,
  clock: <><Circle cx="12" cy="12" r="9" /><Polyline points="12 7 12 12 15.5 14" /></>,
  pin: <><Path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z" /><Circle cx="12" cy="10" r="2.5" /></>,
  tool: <><Path d="M14.5 6.5a4 4 0 0 0-5 5L3 18l3 3 6.5-6.5a4 4 0 0 0 5-5l-2.5 2.5-2.5-.5-.5-2.5z" /></>,
  cap: <><Path d="M2 9l10-5 10 5-10 5z" /><Path d="M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5" /></>,
  handshake: <><Path d="M3 11l4-4 4 2 3-2 3 2 4-1" /><Path d="M3 11l5 6a2 2 0 0 0 3 0l1-1" /><Path d="M21 8v5l-6 6a2 2 0 0 1-3 0" /></>,
  car: <><Path d="M5 16V11l2-5h10l2 5v5" /><Rect x="3" y="11" width="18" height="6" rx="2" /><Circle cx="7.5" cy="17.5" r="1.5" /><Circle cx="16.5" cy="17.5" r="1.5" /></>,
  heart: <><Path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z" /></>,
  stethoscope: <><Path d="M6 3v6a4 4 0 0 0 8 0V3" /><Path d="M10 13v2a5 5 0 0 0 10 0v-2" /><Circle cx="20" cy="11" r="2" /></>,
  tag: <><Path d="M3 12V4h8l10 10-8 8z" /><Circle cx="7.5" cy="8.5" r="1.3" /></>,
  gift: <><Rect x="3" y="9" width="18" height="12" rx="1" /><Path d="M12 9v12M3 13h18" /><Path d="M12 9c-2 0-4.5-1-4.5-3S10 3 12 9c2-6 4.5-4 4.5-3S14 9 12 9z" /></>,
  megaphone: <><Path d="M3 11v3h3l8 4V7L6 11z" /><Path d="M18 9a4 4 0 0 1 0 6" /></>,
  alert: <><Path d="M12 3 2 20h20z" /><Line x1="12" y1="10" x2="12" y2="14" /><Circle cx="12" cy="17.2" r=".6" /></>,
  shield: <><Path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><Polyline points="8.5 12 11 14.5 15.5 9.5" /></>,
  settings: <><Circle cx="12" cy="12" r="3" /><Path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
  logout: <><Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><Polyline points="16 17 21 12 16 7" /><Line x1="21" y1="12" x2="9" y2="12" /></>,
  star: <><Path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" /></>,
  building: <><Rect x="5" y="3" width="14" height="18" rx="1" /><Path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" /></>,
  key: <><Circle cx="8" cy="15" r="4" /><Path d="M11 12l9-9M16 7l3 3" /></>,
  copy: <><Rect x="9" y="9" width="11" height="11" rx="2" /><Path d="M5 15V6a2 2 0 0 1 2-2h9" /></>,
  trash: <><Path d="M4 7h16M10 11v6M14 11v6" /><Path d="M6 7l1 13h10l1-13M9 7V4h6v3" /></>,
  edit: <><Path d="M4 20h4L19 9l-4-4L4 16z" /><Path d="M14 6l4 4" /></>,
  camera: <><Path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><Circle cx="12" cy="13.5" r="3.5" /></>,
  flag: <><Path d="M5 21V4M5 4h11l-2 4 2 4H5" /></>,
  list: <><Line x1="8" y1="6" x2="21" y2="6" /><Line x1="8" y1="12" x2="21" y2="12" /><Line x1="8" y1="18" x2="21" y2="18" /><Circle cx="4" cy="6" r="1" /><Circle cx="4" cy="12" r="1" /><Circle cx="4" cy="18" r="1" /></>,
  bed: <><Path d="M3 18V6M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5" /><Circle cx="7" cy="11" r="1.5" /></>,
  dollar: <><Line x1="12" y1="3" x2="12" y2="21" /><Path d="M16.5 7.5C16 6 14.3 5 12 5c-2.5 0-4 1.2-4 3s1.5 2.6 4 3 4 1.2 4 3-1.7 3-4 3c-2.3 0-4-1-4.5-2.5" /></>,
};

export type IconName = keyof typeof P;

export function Icon({ name, size = 22, color = '#EAF6F2', strokeWidth = 1.8, fill }: {
  name: string; size?: number; color?: string; strokeWidth?: number; fill?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill ?? 'none'} stroke={color}
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {P[name] ?? P.alert}
    </Svg>
  );
}
