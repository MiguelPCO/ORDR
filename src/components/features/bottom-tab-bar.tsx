"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function AnalyzeIcon({ className, active }: { className?: string; active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path
        d="M4 8V6a2 2 0 0 1 2-2h2M4 16v2a2 2 0 0 0 2 2h2M20 8V6a2 2 0 0 0-2-2h-2M20 16v2a2 2 0 0 1-2 2h-2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3.5" strokeLinecap="round" strokeLinejoin="round" fill={active ? "currentColor" : "none"} />
    </svg>
  );
}

function ProfileIcon({ className, active }: { className?: string; active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <circle cx="12" cy="8" r="3.2" strokeLinecap="round" strokeLinejoin="round" fill={active ? "currentColor" : "none"} />
      <path d="M5 20c1.2-3.5 4-5 7-5s5.8 1.5 7 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HistoryIcon({ className, active }: { className?: string; active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <circle cx="12" cy="12" r="8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 8v4l3 2" strokeLinecap="round" strokeLinejoin="round" />
      {active && <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />}
    </svg>
  );
}

function LogIcon({ className, active }: { className?: string; active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <rect x="4" y="4" width="16" height="16" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 9h8M8 13h5" strokeLinecap="round" strokeLinejoin="round" />
      {active && <path d="M8 17l1.5 1.5L12 16" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

const TABS: Array<{ href: string; label: string; Icon: typeof AnalyzeIcon }> = [
  { href: "/analyze", label: "Analizar", Icon: AnalyzeIcon },
  { href: "/log", label: "Registro", Icon: LogIcon },
  { href: "/profile", label: "Perfil", Icon: ProfileIcon },
  { href: "/history", label: "Historial", Icon: HistoryIcon },
];

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-10 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
      aria-label="Navegación principal"
    >
      {TABS.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-caption transition-colors ${
              active ? "font-semibold text-primary-deep" : "font-medium text-ink-soft"
            }`}
          >
            <Icon className="h-5 w-5" active={active} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
