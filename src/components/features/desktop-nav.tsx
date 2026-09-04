"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_TABS } from "@/components/features/nav-tabs";

export function DesktopNav() {
  const pathname = usePathname();

  return (
    <nav
      className="hidden items-center gap-0.5 rounded-full bg-surface-tint p-1 md:flex"
      aria-label="Navegación principal"
    >
      {NAV_TABS.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-body-sm font-semibold transition-colors ${
              active ? "bg-primary-deep text-white" : "text-ink-soft hover:text-ink"
            }`}
          >
            <Icon className="h-4 w-4" active={active} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
