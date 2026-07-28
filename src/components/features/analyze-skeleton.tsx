export function AnalyzeSkeleton() {
  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 px-4 py-10">
      <p className="text-sm text-foreground/60">Analizando carta… puede tardar un minuto.</p>
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse rounded-lg border border-foreground/10 p-4">
            <div className="flex items-center justify-between">
              <div className="h-4 w-40 rounded bg-foreground/10" />
              <div className="h-4 w-16 rounded bg-foreground/10" />
            </div>
            <div className="mt-3 h-3 w-full rounded bg-foreground/10" />
            <div className="mt-2 h-3 w-2/3 rounded bg-foreground/10" />
          </div>
        ))}
      </div>
    </main>
  );
}
