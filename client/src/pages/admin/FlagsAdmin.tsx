import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { adminFetch } from "../Admin";
import { cn } from "@/lib/utils";

const FLAG_LABELS: Record<string, string> = {
  comments: "Comments section",
  notifications: "Notification center",
  onboarding: "Onboarding tour",
  auto_source: "Auto server racing",
  watchlist: "Watchlist",
  history: "Watch history",
};

export default function FlagsAdmin() {
  const [flags, setFlags] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    adminFetch<{ flags: Record<string, boolean> }>("/api/admin/flags").then((d) => setFlags(d.flags));
  }, []);

  const toggle = async (name: string, enabled: boolean) => {
    const d = await adminFetch<{ flags: Record<string, boolean> }>(`/api/admin/flags/${name}`, {
      method: "POST",
      body: JSON.stringify({ enabled }),
    });
    setFlags(d.flags);
  };

  if (!flags) return <Loader2 className="mx-auto mt-20 h-8 w-8 animate-spin text-primary" />;

  return (
    <div className="space-y-2">
      <p className="mb-3 text-sm text-muted-foreground">
        Kill switches for major features. Evaluated server-side; changes apply immediately.
      </p>
      {Object.entries(flags).map(([name, enabled]) => (
        <div key={name} className="flex items-center gap-3 rounded-2xl border border-border/50 bg-card/60 p-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">{FLAG_LABELS[name] ?? name}</p>
            <p className="text-[11px] text-muted-foreground">{name}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => void toggle(name, !enabled)}
            className={cn(
              "relative h-7 w-12 shrink-0 rounded-full transition",
              enabled ? "bg-primary" : "bg-muted",
            )}
          >
            <span
              className={cn(
                "absolute top-1 h-5 w-5 rounded-full bg-white transition-all",
                enabled ? "left-6" : "left-1",
              )}
            />
          </button>
        </div>
      ))}
    </div>
  );
}