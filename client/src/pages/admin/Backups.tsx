import { useEffect, useState } from "react";
import { Archive, Loader2 } from "lucide-react";
import { adminFetch } from "../Admin";

export default function Backups() {
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = () => {
    adminFetch<{ files: string[] }>("/api/admin/backups")
      .then((d) => setFiles(d.files))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const create = async () => {
    setCreating(true);
    setMessage(null);
    try {
      const d = await adminFetch<{ file: string }>("/api/admin/backup", { method: "POST" });
      setMessage(`Backup created: ${d.file}`);
      load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Backup failed");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
        <h3 className="text-sm font-extrabold">Site data backups</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Snapshots all persistent data (comments, notifications, reports, flags, audit log) into
          /root/backups on the VPS. Restore is manual-only by design — no one-click destructive actions.
        </p>
        <button
          type="button"
          disabled={creating}
          onClick={() => void create()}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-xs font-bold text-primary-foreground transition hover:brightness-110 disabled:opacity-50"
        >
          {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
          Create backup now
        </button>
        {message && <p className="mt-2 break-all text-xs text-muted-foreground">{message}</p>}
      </div>

      <div className="mt-4 space-y-1.5">
        {loading ? (
          <Loader2 className="mx-auto mt-8 h-6 w-6 animate-spin text-primary" />
        ) : files.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">No backups yet.</p>
        ) : (
          files.map((f) => (
            <div key={f} className="rounded-xl border border-border/40 bg-card/50 px-4 py-2.5 text-xs text-muted-foreground">
              {f}
            </div>
          ))
        )}
      </div>
    </div>
  );
}