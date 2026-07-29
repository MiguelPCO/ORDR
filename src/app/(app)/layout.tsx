import { BottomTabBar } from "@/components/features/bottom-tab-bar";
import { ThemeToggle } from "@/components/features/theme-toggle";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <span className="text-sm font-semibold text-brand">ORDR</span>
        <ThemeToggle />
      </header>
      <div className="flex-1 pb-20">{children}</div>
      <BottomTabBar />
    </div>
  );
}
