import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, Pin, PinOff, ShieldCheck, Trash2 } from "lucide-react";
import { adminFetch, timeAgo } from "../Admin";
import { cn } from "@/lib/utils";

interface AdminComment {
  id: string;
  content: string;
  name: string;
  body: string;
  isSpoiler: boolean;
  isPinned: boolean;
  isHidden: boolean;
  isDeleted: boolean;
  likeCount: number;
  reportCount: number;
  createdAt: number;
}

const FILTERS = ["newest", "reported", "hidden", "deleted"] as const;

export default function CommentsAdmin() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("newest");
  const [items, setItems] = useState<AdminComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const load = (f = filter, p = 1) => {
    setLoading(true);
    adminFetch<{ comments: AdminComment[]; pages: number }>(`/api/admin/comments?filter=${f}&page=${p}`)
      .then((d) => {
        setItems(d.comments);
        setPages(d.pages);
        setPage(p);
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => load(filter, 1), [filter]);

  const act = async (id: string, action: string) => {
    await adminFetch(`/api/admin/comments/${id}/${action}`, { method: "POST" });
    load(filter, page);
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-bold capitalize transition",
              filter === f ? "bg-primary text-primary-foreground" : "border border-border/60 text-muted-foreground hover:text-foreground",
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <Loader2 className="mx-auto mt-16 h-8 w-8 animate-spin text-primary" />
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-border/50 bg-card/60 p-8 text-center text-sm text-muted-foreground">
          No {filter} comments.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((c) => (
            <div key={c.id} className={cn("rounded-2xl border p-4", c.isHidden ? "border-amber-400/30 bg-amber-400/5" : "border-border/50 bg-card/60")}>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-bold">{c.name}</span>
                <span className="text-muted-foreground">{c.content} · {timeAgo(c.createdAt)}</span>
                {c.isPinned && <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">Pinned</span>}
                {c.isHidden && <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">Hidden</span>}
                {c.reportCount > 0 && <span className="rounded-full bg-red-400/20 px-2 py-0.5 text-[10px] font-bold text-red-300">{c.reportCount} reports</span>}
                <span className="ml-auto text-muted-foreground">♥ {c.likeCount}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-foreground/90">{c.body || <em className="text-muted-foreground">deleted</em>}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {c.isHidden ? (
                  <ModBtn onClick={() => act(c.id, "unhide")} icon={Eye} label="Unhide" />
                ) : (
                  <ModBtn onClick={() => act(c.id, "hide")} icon={EyeOff} label="Hide" />
                )}
                {c.isPinned ? (
                  <ModBtn onClick={() => act(c.id, "unpin")} icon={PinOff} label="Unpin" />
                ) : (
                  <ModBtn onClick={() => act(c.id, "pin")} icon={Pin} label="Pin" />
                )}
                {c.reportCount > 0 && <ModBtn onClick={() => act(c.id, "resolve")} icon={ShieldCheck} label="Resolve reports" />}
                {!c.isDeleted && (
                  <ModBtn onClick={() => { if (confirm("Delete this comment?")) void act(c.id, "delete"); }} icon={Trash2} label="Delete" danger />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          {Array.from({ length: pages }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => load(filter, i + 1)}
              className={cn("h-8 w-8 rounded-full text-xs font-bold", page === i + 1 ? "bg-primary text-primary-foreground" : "border border-border/60 text-muted-foreground")}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ModBtn({ onClick, icon: Icon, label, danger }: { onClick: () => void; icon: typeof Eye; label: string; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-bold transition",
        danger ? "border-red-400/40 text-red-300 hover:bg-red-400/10" : "border-border/60 text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-3 w-3" /> {label}
    </button>
  );
}