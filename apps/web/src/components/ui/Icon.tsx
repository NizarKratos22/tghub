import type { SVGProps } from 'react';

/** Round-capped 1.75px strokes on a 24px grid — drawn for TG Hub, not pulled from an icon pack. */
const PATHS = {
  search: 'M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13ZM15.5 15.5 21 21',
  bell: 'M6 16V10.5a6 6 0 0 1 12 0V16l1.5 2h-15L6 16ZM10 21h4',
  menu: 'M3.5 6h17M3.5 12h17M3.5 18h11',
  close: 'M5.5 5.5l13 13M18.5 5.5l-13 13',
  arrowRight: 'M4 12h15M13 6l6 6-6 6',
  arrowLeft: 'M20 12H5M11 6l-6 6 6 6',
  arrowUpRight: 'M7 17 17 7M9 7h8v8',
  chevronDown: 'm6 9 6 6 6-6',
  chevronLeft: 'm15 6-6 6 6 6',
  chevronRight: 'm9 6 6 6-6 6',
  check: 'm4.5 12.5 4.5 4.5L19.5 6.5',
  star: 'm12 3.5 2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6-4.6-4.1 6.1-.6L12 3.5Z',
  clock: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18ZM12 7v5l3.5 2',
  cpu: 'M7 7h10v10H7zM10 10h4v4h-4zM9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4',
  radar: 'M12 21a9 9 0 1 1 9-9M12 16a4 4 0 1 1 4-4M12 12l7-7',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0V4ZM8 6H4.5v1.5A3.5 3.5 0 0 0 8 11M16 6h3.5v1.5A3.5 3.5 0 0 1 16 11M12 13v4M8 21h8M9.5 17h5v4h-5z',
  user: 'M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8ZM4.5 20.5c1.2-3.8 4-5.5 7.5-5.5s6.3 1.7 7.5 5.5',
  users: 'M9 4.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7ZM2.5 20c.9-3.4 3.4-5 6.5-5s5.6 1.6 6.5 5M16 4.8a3.5 3.5 0 0 1 0 6.4M18 15.4c1.6.7 2.8 2.2 3.5 4.6',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  plus: 'M12 5v14M5 12h14',
  trash: 'M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13M10 11v5M14 11v5',
  refresh: 'M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4',
  bolt: 'M13 3 5 14h6l-1 7 8-11h-6l1-7Z',
  shield: 'M12 3 4.5 6v6c0 4.5 3.2 7.6 7.5 9 4.3-1.4 7.5-4.5 7.5-9V6L12 3Z',
  settings: 'M4 7h10M18 7h2M4 17h4M12 17h8M14 4v6M8 14v6',
  gamepad: 'M7 8h10a4 4 0 0 1 4 4v3a3 3 0 0 1-5.4 1.8L14 15h-4l-1.6 1.8A3 3 0 0 1 3 15v-3a4 4 0 0 1 4-4ZM8 11v3M6.5 12.5h3M15.5 12h.01M17.5 13.5h.01',
  map: 'M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20V6.5ZM9 4v13.5M15 6.5V20',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  sun: 'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8ZM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z',
  store: 'M4 9.5 5.5 4h13L20 9.5a2.67 2.67 0 0 1-5.33 0 2.67 2.67 0 0 1-5.34 0 2.67 2.67 0 0 1-5.33 0ZM5.5 12.5V20h13v-7.5M10 20v-4.5h4V20',
  message: 'M4 5h16v11H9.5L5 19.5V16H4V5ZM8 9.5h8M8 12.5h5',
  send: 'M21 3 10.5 13.5M21 3l-6.5 18-4-7.5L3 9.5 21 3Z',
  heart: 'M12 19.5s-7.5-4.5-7.5-10A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.5c0 5.5-7.5 10-7.5 10Z',
  tag: 'M3.5 11.5V4h7.5l9.5 9.5-7.5 7.5-9.5-9.5ZM8 8h.01',
  image: 'M4 5h16v14H4zM4 16l4.5-4.5 4 4 2.5-2.5L20 18M15.5 8.5h.01',
  camera: 'M4 8h3l1.5-2.5h7L17 8h3v11H4V8ZM12 10.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z',
  mapPin: 'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11ZM12 7.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  flag: 'M5 21V4M5 4h12l-2.5 4.5L17 13H5',
  edit: 'M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12ZM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  filter: 'M4 6h16M7 12h10M10 18h4',
  box: 'M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5v-9ZM3.5 7.5 12 12l8.5-4.5M12 12v9',
  code: 'm8 7-5 5 5 5M16 7l5 5-5 5M13.5 4l-3 16',
  car: 'M4 15v-3.5L6 6h12l2 5.5V15H4ZM4 11.5h16M6 15v3M18 15v3M7.5 13.25h.01M16.5 13.25h.01',
  building: 'M4 21V5l8-2v18M12 8h8v13M2.5 21h19M7.5 8h1M7.5 12h1M7.5 16h1M15.5 12h1M15.5 16h1',
  shirt: 'M8 3.5 4 6l-1.5 4.5L6 12v8.5h12V12l3.5-1.5L20 6l-4-2.5a4 4 0 0 1-8 0Z',
  monitor: 'M3 4.5h18v12H3zM8.5 20.5h7M12 16.5v4',
  keyboard: 'M2.5 6.5h19v11h-19zM6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M7.5 14h9',
  headset: 'M4 15v-3a8 8 0 0 1 16 0v3M4 14h3v6H4zM17 14h3v6h-3z',
  tower: 'M7 3h10v18H7zM10 7h4M10 10h4M12 16.5h.01',
  disc: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18ZM12 9.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z',
  layers: 'm12 3 9 5-9 5-9-5 9-5ZM3 12.5l9 5 9-5M3 16.5l9 5 9-5',
  layout: 'M3.5 4.5h17v15h-17zM3.5 9h17M9 9v10.5',
  wrench: 'M15 3.5a5 5 0 0 0-5.3 6.9L3.5 16.6a2.1 2.1 0 0 0 3 3l6.2-6.2a5 5 0 0 0 6.9-5.3l-3 3-2.6-.7-.7-2.6 3-3Z',
  key: 'M14.5 3.5a6 6 0 1 1-4.2 10.2L4 20H3.5v-3l1.5-.5V15h1.5v-1.5H8l1.3-1.3A6 6 0 0 1 14.5 3.5ZM16 7.5h.01',
  globe: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18ZM3 12h18M12 3c2.5 2.7 3.5 5.7 3.5 9s-1 6.3-3.5 9c-2.5-2.7-3.5-5.7-3.5-9s1-6.3 3.5-9Z',
  download: 'M12 4v12M7 11l5 5 5-5M4 20h16',
  upload: 'M12 16V4M7 9l5-5 5 5M4 15v5h16v-5',
  inbox: 'M3.5 13.5 6 5h12l2.5 8.5v6h-17v-6ZM3.5 13.5H9l1 2h4l1-2h5.5',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  more: 'M5.5 12h.01M12 12h.01M18.5 12h.01',
  info: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18ZM12 11v5.5M12 7.5h.01',
  alert: 'M12 4 2.5 20h19L12 4ZM12 10v4.5M12 17.5h.01',
  sort: 'M7 4v16M3.5 16.5 7 20l3.5-3.5M17 20V4M13.5 7.5 17 4l3.5 3.5',
  home: 'M3.5 11 12 4l8.5 7M5.5 9.5V20h13V9.5M10 20v-5.5h4V20',
} as const;

export type IconName = keyof typeof PATHS;

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
  filled?: boolean;
  title?: string;
}

/** Icons that point somewhere; they mirror under dir="rtl" (see globals.css). */
const DIRECTIONAL = new Set<IconName>(['arrowLeft', 'arrowRight', 'chevronLeft', 'chevronRight', 'send']);

export function Icon({ name, size = 18, filled = false, title, className, ...rest }: IconProps) {
  return (
    <svg
      className={DIRECTIONAL.has(name) ? (className ? `${className} dir-flip` : 'dir-flip') : className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      <path d={PATHS[name]} />
    </svg>
  );
}
