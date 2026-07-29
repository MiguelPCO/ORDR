import { BottomTabBar } from "@/components/features/bottom-tab-bar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-foreground/10 px-4 py-3">
        <span className="text-sm font-semibold text-brand">ORDR</span>
      </header>
      <div className="flex-1 pb-20">{children}</div>
      <BottomTabBar />
    </div>
  );
}
