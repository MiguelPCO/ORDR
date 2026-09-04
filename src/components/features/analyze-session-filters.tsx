"use client";

export function AnalyzeSessionFilters({
  allergiesExtra,
  onAllergiesExtraChange,
  dislikesExtra,
  onDislikesExtraChange,
  fatLimitG,
  onFatLimitGChange,
  carbLimitG,
  onCarbLimitGChange,
  profileFatLimitG,
  profileCarbLimitG,
}: {
  allergiesExtra: string;
  onAllergiesExtraChange: (value: string) => void;
  dislikesExtra: string;
  onDislikesExtraChange: (value: string) => void;
  fatLimitG: number | "";
  onFatLimitGChange: (value: number | "") => void;
  carbLimitG: number | "";
  onCarbLimitGChange: (value: number | "") => void;
  profileFatLimitG: number | null;
  profileCarbLimitG: number | null;
}) {
  return (
    <details className="rounded-md border border-foreground/20 px-3 py-2">
      <summary className="cursor-pointer text-sm font-medium">Más filtros</summary>
      <div className="mt-3 space-y-3">
        <div className="space-y-1">
          <label htmlFor="sessionAllergiesExtra" className="text-sm font-medium">
            Alergias extra para esta carta
          </label>
          <input
            id="sessionAllergiesExtra"
            value={allergiesExtra}
            onChange={(e) => onAllergiesExtraChange(e.target.value)}
            className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="sessionDislikesExtra" className="text-sm font-medium">
            No me gusta extra para esta carta
          </label>
          <input
            id="sessionDislikesExtra"
            value={dislikesExtra}
            onChange={(e) => onDislikesExtraChange(e.target.value)}
            className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label htmlFor="sessionFatLimitG" className="text-sm font-medium">
              Límite grasa (g)
            </label>
            <input
              id="sessionFatLimitG"
              type="number"
              placeholder={profileFatLimitG != null ? `perfil: ${profileFatLimitG} g` : "sin límite"}
              value={fatLimitG}
              onChange={(e) => onFatLimitGChange(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="sessionCarbLimitG" className="text-sm font-medium">
              Límite carbos (g)
            </label>
            <input
              id="sessionCarbLimitG"
              type="number"
              placeholder={profileCarbLimitG != null ? `perfil: ${profileCarbLimitG} g` : "sin límite"}
              value={carbLimitG}
              onChange={(e) => onCarbLimitGChange(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>
    </details>
  );
}
