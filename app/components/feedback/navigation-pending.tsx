import { LoaderCircle } from "lucide-react";
import { useEffect } from "react";
import { useNavigation } from "react-router";

export function NavigationPending() {
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";
  const saving = Boolean(navigation.formMethod && navigation.formMethod.toUpperCase() !== "GET");

  useEffect(() => {
    if (busy) {
      document.documentElement.setAttribute("aria-busy", "true");
    } else {
      document.documentElement.removeAttribute("aria-busy");
    }
    return () => document.documentElement.removeAttribute("aria-busy");
  }, [busy]);

  if (!busy) return null;

  return (
    <>
      <div
        aria-hidden="true"
        className="fixed inset-0 z-[90] cursor-progress bg-background/10 backdrop-blur-[1px]"
        data-testid="navigation-blocker"
      />
      <div className="fixed inset-x-0 top-0 z-[100] h-1 overflow-hidden bg-primary/20">
        <div className="h-full w-2/3 animate-pulse rounded-r-full bg-primary" />
      </div>
      <div
        aria-live="polite"
        className="fixed bottom-5 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-3 rounded-full border bg-card px-5 py-3 font-bold text-foreground shadow-lg sm:bottom-auto sm:left-auto sm:right-6 sm:top-6 sm:translate-x-0"
        role="status"
      >
        <LoaderCircle aria-hidden="true" className="size-5 animate-spin text-primary" />
        {saving ? "Guardando cambios…" : "Cargando…"}
      </div>
    </>
  );
}
