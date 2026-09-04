import { BottomTabBar } from "@/components/features/bottom-tab-bar";
import { DesktopNav } from "@/components/features/desktop-nav";
import { ThemeToggle } from "@/components/features/theme-toggle";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="grid grid-cols-[1fr_auto_1fr] items-center border-b border-line px-4 py-3">
        <span className="font-display text-sm font-semibold text-brand">ORDR</span>
        <DesktopNav />
        <div className="justify-self-end">
          <ThemeToggle />
        </div>
      </header>
      <div className="flex-1 pb-20 md:pb-0">{children}</div>
      <BottomTabBar />
    </div>
  );
}
