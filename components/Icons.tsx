/** Thin line icons in the style of the brand board. 24×24, stroke = currentColor. */
const paths = {
  mountain: "M2 19 9 8l3.5 5L15 9l7 10Z M7.6 10.2 9 8l1.6 2.4",
  sea: "M2 9c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2 M2 14c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2 M2 19c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2",
  palm: "M12 9c-.2 4.5-.8 8.6-2 12 M12 9C9.5 6.5 6 6.5 3.5 8.5 M12 9c-1-3.2-3.6-5-6.6-5 M12 9c.6-3.2 3-5.2 6-5.6 M12 9c3-1.4 6.4-.6 8.5 1.8 M12 9c2 1 3.4 3 3.6 5.4 M12 9c-2 1-3.4 3-3.8 5.2",
  sun: "M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z M12 2v2.5 M12 19.5V22 M2 12h2.5 M19.5 12H22 M4.9 4.9l1.8 1.8 M17.3 17.3l1.8 1.8 M4.9 19.1l1.8-1.8 M17.3 6.7l1.8-1.8",
  sauna: "M3 21h18 M5 21v-6h14v6 M5 18h14 M9 12c-1.2-1.4 1.2-2.6 0-4 M12.5 12c-1.2-1.4 1.2-2.6 0-4 M16 12c-1.2-1.4 1.2-2.6 0-4",
  bed: "M3 19V7 M3 15h18v4 M21 15v-3a3 3 0 0 0-3-3h-7v6 M6.5 12.5a1.5 1.5 0 1 0 0-.01",
  kitchen: "M4 11h16 M5 11v6a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-6 M2 11h2 M20 11h2 M9 7.5c0-1 1-1 1-2 M13 7.5c0-1 1-1 1-2",
  sofa: "M4 11V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3 M2 13a2 2 0 0 1 4 0v2h12v-2a2 2 0 0 1 4 0v5H2Z M5 18v2 M19 18v2",
  ski: "M5 20 19 4 M8 21 21 7 M3 17l3 3 M7 13l2 2 M15 11l-2-2",
  parking: "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z M9.5 17V7h3.5a3 3 0 0 1 0 6H9.5",
  key: "M14.5 3.5a6 6 0 1 1-3.9 10.5L4 20.5 M6.5 18l2 2 M8.5 16l1.5 1.5 M16 8a.5.5 0 1 0 0-.01",
  umbrella: "M12 3a9 9 0 0 1 9 8H3a9 9 0 0 1 9-8Z M12 11v8a2 2 0 0 1-4 0 M2 21h20",
  leaf: "M5 19c0-8 6-14 15-14 0 9-6 15-14 15 M5 19 13 11",
  terrace: "M3 10h18 M4 10V7l8-4 8 4v3 M6 10v10 M18 10v10 M10 14h4 M12 14v6 M3 20h18",
  pin: "M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z M12 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z",
  plane: "M10.5 13.5 3 11l1.5-1.5 8 .5 4-4.5a2 2 0 0 1 3 3l-4.5 4 .5 8L14 22l-2.5-7.5L8 18v2.5L6.5 22 5 19l-3-1.5L3.5 16H6Z",
  chat: "M4 5h16v11H9l-5 4Z M8 9.5h8 M8 12.5h5",
  calendar: "M4 6h16v14H4Z M4 10h16 M8 3v4 M16 3v4",
  star: "M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.8Z",
  arrow: "M5 12h14 M13 6l6 6-6 6",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7Z",
  check: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M8 12.5l2.6 2.6L16 9.5",
  tag: "M3 12V4h8l10 10-8 8Z M7.5 8a.5.5 0 1 0 0-.01",
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 24, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
