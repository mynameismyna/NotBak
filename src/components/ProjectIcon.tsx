"use client";

import {
  DEFAULT_PROJECT_ICON_KEY,
  normalizeProjectIconKey,
  type ProjectIconKey,
} from "@/lib/project-icons";

const PRIVATE_ICON_KEY = "private" as const;
export type DisplayProjectIconKey = ProjectIconKey | typeof PRIVATE_ICON_KEY;

function IconSvg({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      viewBox="0 0 24 24"
      aria-hidden
    >
      {children}
    </svg>
  );
}

const ICON_PATHS: Record<DisplayProjectIconKey, React.ReactNode> = {
  folder: (
  <>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
  </>
  ),
  briefcase: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6V5a2 2 0 012-2h0a2 2 0 012 2v1m-8 0h12a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2zm3 7h4" />
  ),
  database: (
    <>
      <ellipse cx="12" cy="6" rx="8" ry="3" />
      <path strokeLinecap="round" d="M4 6v5c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 11v5c0 1.7 3.6 3 8 3s8-1.3 8-3v-5" />
    </>
  ),
  code: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
  ),
  truck: (
    <>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16h13v-5l3-3h2v8h-2M3 16v2m13-2v2M7 18a1 1 0 11-2 0 1 1 0 012 0zm10 0a1 1 0 11-2 0 1 1 0 012 0z" />
    </>
  ),
  store: (
    <>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 10h16M6 10V7l2-3h8l2 3v3M5 10l1 9h12l1-9" />
    </>
  ),
  users: (
    <>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1M12 12a4 4 0 100-8 4 4 0 000 8zm8 8v-1a3 3 0 00-2-2.83M16 3.13a4 4 0 010 7.75" />
    </>
  ),
  chart: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 19V5m0 14h16M8 17V9m4 8V7m4 10v-4" />
  ),
  wrench: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.7 6.3a4 4 0 010 5.7L8 18H5v-3l6.7-6.7a4 4 0 015.7-5.7l-2.5 2.5 2.5 2.5 2.5-2.5z" />
  ),
  globe: (
    <>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18z" />
      <path strokeLinecap="round" d="M3 12h18M12 3c2.5 2.5 4 5.5 4 9s-1.5 6.5-4 9c-2.5-2.5-4-5.5-4-9s1.5-6.5 4-9z" />
    </>
  ),
  shield: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z" />
  ),
  package: (
    <>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
      <path strokeLinecap="round" d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
    </>
  ),
  building: (
    <>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 21V5a1 1 0 011-1h5v17M14 21V9h5a1 1 0 011 1v11M9 8h1M9 12h1M9 16h1M16 12h1M16 16h1" />
    </>
  ),
  mail: (
    <>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16v12H4V6z" />
      <path strokeLinecap="round" d="M4 7l8 6 8-6" />
    </>
  ),
  clipboard: (
    <>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      <path strokeLinecap="round" d="M9 12h6M9 16h4" />
    </>
  ),
  layers: (
    <>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l9 5-9 5-9-5 9-5zm0 8l9 5-9 5-9-5 9-5z" />
    </>
  ),
  cart: (
    <>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h15l-1.5 9H8L6 6zm0 0L5 3H2M9 20a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2z" />
    </>
  ),
  target: (
    <>
      <path strokeLinecap="round" d="M12 12m-9 0a9 9 0 1018 0 9 9 0 10-18 0z" />
      <path strokeLinecap="round" d="M12 12m-5 0a5 5 0 1010 0 5 5 0 10-10 0z" />
      <path strokeLinecap="round" d="M12 12m-1 0a1 1 0 102 0 1 1 0 10-2 0z" />
    </>
  ),
  private: (
    <>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V8a4 4 0 00-8 0v3M6 11h12v9H6v-9z" />
    </>
  ),
};

export function ProjectIcon({
  iconKey,
  className = "w-4 h-4",
  boxClassName,
}: {
  iconKey: string | null | undefined;
  className?: string;
  /** Dolu kutu içinde gösterim (kart başlığı). */
  boxClassName?: string;
}) {
  const key: DisplayProjectIconKey =
    iconKey === PRIVATE_ICON_KEY
      ? PRIVATE_ICON_KEY
      : normalizeProjectIconKey(iconKey);

  const paths = ICON_PATHS[key] ?? ICON_PATHS[DEFAULT_PROJECT_ICON_KEY];

  const icon = <IconSvg className={className}>{paths}</IconSvg>;

  if (!boxClassName) return icon;

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-md bg-indigo-50 text-indigo-700 ${boxClassName}`}
    >
      {icon}
    </span>
  );
}

export function PrivateProjectIcon({
  className = "w-4 h-4",
  boxClassName = "w-8 h-8",
}: {
  className?: string;
  boxClassName?: string;
}) {
  return <ProjectIcon iconKey={PRIVATE_ICON_KEY} className={className} boxClassName={boxClassName} />;
}
