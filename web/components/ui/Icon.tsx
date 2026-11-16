const paths = {
  search: <><circle cx="9" cy="9" r="5.5" /><path d="M13.2 13.2 L17 17" /></>,
  chevron: <path d="M7 4 L13 10 L7 16" />,
  down: <path d="M5 8 L10 13 L15 8" />,
  check: <path d="M4 10.5 L8 14.5 L16 6" />,
  x: <path d="M5 5 L15 15 M15 5 L5 15" />,
  alert: <><path d="M10 3 L18 17 H2 Z" /><path d="M10 8 V11.5 M10 14 V14.2" /></>,
  info: <><circle cx="10" cy="10" r="7.5" /><path d="M10 9 V14 M10 6.2 V6.4" /></>,
  shop: <path d="M3 8 L4.5 3.5 H15.5 L17 8 V16.5 H3 Z M3 8 H17 M8 16.5 V11.5 H12 V16.5" />,
  doc: <path d="M5 2.5 H12 L15.5 6 V17.5 H5 Z M12 2.5 V6 H15.5 M7.5 10 H13 M7.5 13 H13" />,
  book: <path d="M3 4 H8 A2 2 0 0 1 10 6 V17 A2 2 0 0 0 8 15 H3 Z M17 4 H12 A2 2 0 0 0 10 6 V17 A2 2 0 0 1 12 15 H17 Z" />,
  gear: <><circle cx="10" cy="10" r="2.5" /><path d="M10 2.5 V4.5 M10 15.5 V17.5 M2.5 10 H4.5 M15.5 10 H17.5 M4.7 4.7 L6.1 6.1 M13.9 13.9 L15.3 15.3 M4.7 15.3 L6.1 13.9 M13.9 6.1 L15.3 4.7" /></>,
  download: <path d="M10 3 V13 M6 9 L10 13 L14 9 M3.5 16.5 H16.5" />,
  refresh: <path d="M16 10 A6 6 0 1 1 13.5 5.2 M16 3.5 V6.5 H13" />,
  plus: <path d="M10 4 V16 M4 10 H16" />,
  lock: <path d="M5 9 H15 V17 H5 Z M7 9 V6.5 A3 3 0 0 1 13 6.5 V9" />,
  menu: <path d="M3.5 5.5 H16.5 M3.5 10 H16.5 M3.5 14.5 H16.5" />,
  eye: <><path d="M2 10 C4.5 5.5 15.5 5.5 18 10 C15.5 14.5 4.5 14.5 2 10 Z" /><circle cx="10" cy="10" r="2.5" /></>,
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 18, color = "currentColor", className }: { name: IconName; size?: number; color?: string; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      aria-hidden="true"
      className={className}
      style={{ flex: "none", fill: "none", stroke: color, strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" }}
    >
      {paths[name]}
    </svg>
  );
}
