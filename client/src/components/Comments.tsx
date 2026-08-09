/**
 * BGC Comment section — dark premium, mobile-first, guest-identity based.
 *
 * Comments are keyed per episode (`${anilistId}:${episodeNumber}`), owned by
 * the visitor's stable guest id (same identity that drives avatars), and
 * persisted server-side in data/comments.json. Ownership, rate limits,
 * sanitization and moderation are all enforced on the backend.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDownWideNarrow,
  CornerDownRight,
  Eye,
  Heart,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Pin,
  Send,
  Shield,
  Trash2,
  X,
} from "lucide-react";
import {
  deleteComment,
  editComment,
  moderateComment,
  fetchComments,
  postComment,
  reportComment,
  toggleLike,
  type ApiComment,
  type CommentSort,
} from "@/lib/api";
import { buildAvatarSvg, getGuestId } from "@/lib/avatar";
import { getProfileName } from "@/lib/profile";
import { cn } from "@/lib/utils";

const MAX_LEN = 1000;

function timeAgo(ts: number): string {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(ts).toLocaleDateString();
}

function AvatarImg({ guestId, size = 36 }: { guestId: string; size?: number }) {
  const src = useMemo(() => {
    try {
      return `data:image/svg+xml;utf8,${encodeURIComponent(buildAvatarSvg(guestId))}`;
    } catch {
      return "";
    }
  }, [guestId]);
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      className="shrink-0 rounded-full border border-border/60 bg-muted"
      style={{ width: size, height: size }}
    />
  );
}

/* ------------------------------- composer --------------------------------- */

function Composer({
  placeholder,
  initial = "",
  autoFocus = true,
  compact = false,
  onSubmit,
  onCancel,
  submitting,
}: {
  placeholder: string;
  initial?: string;
  autoFocus?: boolean;
  compact?: boolean;
  onSubmit: (body: string, spoiler: boolean) => Promise<void> | void;
  onCancel?: () => void;
  submitting: boolean;
}) {
  const [body, setBody] = useState(initial);
  const [spoiler, setSpoiler] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  const autosize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  const remaining = MAX_LEN - body.length;
  const canSend = body.trim().length > 0 && remaining >= 0 && !submitting;

  const submit = () => {
    if (!canSend) return;
    void onSubmit(body.trim(), spoiler);
    setBody("");
    setSpoiler(false);
    requestAnimationFrame(autosize);
  };

  return (
    <div className="space-y-2">
      <textarea
        ref={ref}
        value={body}
        rows={compact ? 2 : 3}
        maxLength={MAX_LEN + 200}
        onChange={(e) => {
          setBody(e.target.value);
          autosize();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(
          "w-full resize-none rounded-2xl border border-border/60 bg-background/60 px-4 py-3",
          "text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/70",
          "outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/25",
        )}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setSpoiler((v) => !v)}
          aria-pressed={spoiler}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
            spoiler
              ? "border-amber-400/60 bg-amber-400/15 text-amber-300"
              : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground",
          )}
        >
          <Eye className="h-3.5 w-3.5" />
          Spoiler
        </button>
        <span
          className={cn(
            "ml-auto text-[11px] tabular-nums",
            remaining < 0 ? "text-destructive" : "text-muted-foreground/70",
          )}
        >
          {remaining}
        </span>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-border/60 px-4 py-1.5 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={!canSend}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground transition",
            canSend ? "hover:brightness-110" : "cursor-not-allowed opacity-50",
          )}
        >
          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Post
        </button>
      </div>
    </div>
  );
}

/* ------------------------------ single comment ---------------------------- */

function CommentItem({
  comment,
  depth,
  isAdmin,
  adminToken,
  onAction,
  onReplyPosted,
}: {
  comment: ApiComment;
  depth: number;
  isAdmin: boolean;
  adminToken: string;
  onAction: (fn: () => Promise<unknown>) => Promise<void>;
  onReplyPosted: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reported, setReported] = useState(comment.reportedByMe);
  const [submitting, setSubmitting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const deleted = !comment.body;
  const spoilerHidden = comment.isSpoiler && !revealed && !deleted;

  return (
    <div className={cn(depth > 0 && "ml-3 border-l border-border/40 pl-3 sm:ml-6 sm:pl-4")}>
      <div
        className={cn(
          "rounded-2xl border p-3.5 transition sm:p-4",
          comment.isPinned
            ? "border-primary/40 bg-primary/[0.07]"
            : "border-border/40 bg-card/60",
          comment.mine && !comment.isPinned && "border-primary/25",
        )}
      >
        {/* header row */}
        <div className="flex items-center gap-2.5">
          <AvatarImg guestId={comment.guestId} size={depth > 0 ? 30 : 36} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="truncate text-sm font-bold text-foreground">{comment.name}</span>
              {comment.isPinned && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">
                  <Pin className="h-2.5 w-2.5" /> Pinned
                </span>
              )}
              {comment.mine && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  You
                </span>
              )}
              <span className="text-[11px] text-muted-foreground/70">
                {timeAgo(comment.createdAt)}
                {comment.updatedAt > comment.createdAt + 2000 && " · edited"}
              </span>
            </div>
          </div>

          {/* overflow menu */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              aria-label="Comment options"
              onClick={() => setMenuOpen((v) => !v)}
              className="rounded-full p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-9 z-20 w-40 overflow-hidden rounded-xl border border-border/60 bg-popover shadow-xl">
                {comment.mine && !deleted && (
                  <>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-xs font-semibold text-foreground transition hover:bg-muted"
                      onClick={() => {
                        setEditing(true);
                        setMenuOpen(false);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-xs font-semibold text-destructive transition hover:bg-muted"
                      onClick={() => {
                        setMenuOpen(false);
                        void onAction(() => deleteComment(comment.id));
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </>
                )}
                {!comment.mine && (
                  <button
                    type="button"
                    disabled={reported}
                    className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-xs font-semibold text-foreground transition hover:bg-muted disabled:opacity-50"
                    onClick={() => {
                      setMenuOpen(false);
                      setReported(true);
                      void onAction(() => reportComment(comment.id));
                    }}
                  >
                    <AlertTriangle className="h-3.5 w-3.5" /> {reported ? "Reported" : "Report"}
                  </button>
                )}
                {isAdmin && (
                  <>
                    <div className="border-t border-border/50 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Moderation
                    </div>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-xs font-semibold text-foreground transition hover:bg-muted"
                      onClick={() => {
                        setMenuOpen(false);
                        void onAction(() =>
                          moderateComment(comment.id, "pin", !comment.isPinned, adminToken),
                        );
                      }}
                    >
                      <Pin className="h-3.5 w-3.5" /> {comment.isPinned ? "Unpin" : "Pin"}
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-xs font-semibold text-destructive transition hover:bg-muted"
                      onClick={() => {
                        setMenuOpen(false);
                        void onAction(() => deleteComment(comment.id));
                      }}
                    >
                      <Shield className="h-3.5 w-3.5" /> Remove
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* body */}
        <div className="mt-2.5">
          {deleted ? (
            <p className="text-sm italic text-muted-foreground/70">Comment removed</p>
          ) : editing ? (
            <Composer
              compact
              autoFocus
              placeholder="Edit your comment…"
              initial={comment.body}
              submitting={submitting}
              onCancel={() => setEditing(false)}
              onSubmit={async (body) => {
                setSubmitting(true);
                try {
                  await onAction(() => editComment(comment.id, body));
                  setEditing(false);
                } finally {
                  setSubmitting(false);
                }
              }}
            />
          ) : spoilerHidden ? (
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="flex w-full items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3.5 py-2.5 text-left text-xs font-semibold text-amber-300 transition hover:bg-amber-400/15"
            >
              <Eye className="h-3.5 w-3.5" /> Spoiler — tap to reveal
            </button>
          ) : (
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
              {comment.body}
            </p>
          )}
        </div>

        {/* actions */}
        {!deleted && (
          <div className="mt-2.5 flex items-center gap-1">
            <button
              type="button"
              aria-label={comment.likedByMe ? "Unlike" : "Like"}
              aria-pressed={comment.likedByMe}
              onClick={() => void onAction(() => toggleLike(comment.id))}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition",
                comment.likedByMe
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Heart className={cn("h-3.5 w-3.5", comment.likedByMe && "fill-current")} />
              {comment.likeCount > 0 && <span className="tabular-nums">{comment.likeCount}</span>}
            </button>
            {depth === 0 && (
              <button
                type="button"
                onClick={() => setReplying((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <CornerDownRight className="h-3.5 w-3.5" /> Reply
              </button>
            )}
          </div>
        )}

        {/* inline reply composer */}
        {replying && (
          <div className="mt-3">
            <Composer
              compact
              autoFocus
              placeholder={`Reply to ${comment.name}…`}
              submitting={submitting}
              onCancel={() => setReplying(false)}
              onSubmit={async (body, spoiler) => {
                setSubmitting(true);
                try {
                  await onAction(() =>
                    postComment({
                      content: comment.content,
                      name: getProfileName(getGuestId()),
                      body,
                      parentId: comment.id,
                      isSpoiler: spoiler,
                    }),
                  );
                  setReplying(false);
                  onReplyPosted();
                } finally {
                  setSubmitting(false);
                }
              }}
            />
          </div>
        )}
      </div>

      {/* replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-2 space-y-2">
          {comment.replyCount > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="ml-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary transition hover:brightness-110 sm:ml-6"
            >
              <MessageSquare className="h-3 w-3" />
              {expanded
                ? `Hide ${comment.replyCount} ${comment.replyCount === 1 ? "reply" : "replies"}`
                : `View ${comment.replyCount} ${comment.replyCount === 1 ? "reply" : "replies"}`}
            </button>
          )}
          {expanded &&
            comment.replies.map((r) => (
              <CommentItem
                key={r.id}
                comment={r}
                depth={depth + 1}
                isAdmin={isAdmin}
                adminToken={adminToken}
                onAction={onAction}
                onReplyPosted={onReplyPosted}
              />
            ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ section shell ------------------------------ */

const SORTS: { id: CommentSort; label: string }[] = [
  { id: "top", label: "Top" },
  { id: "newest", label: "Newest" },
  { id: "oldest", label: "Oldest" },
  { id: "replies", label: "Most replied" },
];

export default function Comments({ contentKey }: { contentKey: string }) {
  const [sort, setSort] = useState<CommentSort>(
    () => (localStorage.getItem("bgc:comment-sort") as CommentSort) || "newest",
  );
  const [page, setPage] = useState(1);
  const [comments, setComments] = useState<ApiComment[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const myId = getGuestId();
  const adminToken = sessionStorage.getItem("bgc:admin-token") ?? "";
  const isAdmin = adminToken.length > 0;

  const load = useCallback(
    async (p: number, append: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchComments(contentKey, sort, p);
        setTotal(res.total);
        setPages(res.pages);
        setPage(res.page);
        setComments((prev) => (append ? [...prev, ...res.comments] : res.comments));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load comments");
      } finally {
        setLoading(false);
      }
    },
    [contentKey, sort],
  );

  useEffect(() => {
    void load(1, false);
  }, [load]);

  /** Run a mutation, then refresh the first page so ordering stays correct. */
  const runAction = useCallback(
    async (fn: () => Promise<unknown>) => {
      try {
        await fn();
        setNotice(null);
        await load(1, false);
      } catch (e) {
        setNotice(e instanceof Error ? e.message : "Something went wrong");
      }
    },
    [load],
  );

  const changeSort = (s: CommentSort) => {
    setSort(s);
    localStorage.setItem("bgc:comment-sort", s);
  };

  return (
    <section aria-label="Comments" className="mt-10">
      <div className="flex items-center gap-3">
        <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-foreground sm:text-xl">
          <MessageSquare className="h-5 w-5 text-primary" />
          Comments
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold tabular-nums text-muted-foreground">
            {total}
          </span>
        </h2>
        <div className="ml-auto flex items-center gap-1.5">
          <ArrowDownWideNarrow className="h-4 w-4 text-muted-foreground" />
          <div className="flex overflow-hidden rounded-full border border-border/60">
            {SORTS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => changeSort(s.id)}
                aria-pressed={sort === s.id}
                className={cn(
                  "px-3 py-1.5 text-[11px] font-bold transition sm:text-xs",
                  sort === s.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* composer */}
      <div className="mt-4 rounded-2xl border border-border/40 bg-card/60 p-3.5 sm:p-4">
        <div className="flex gap-3">
          <AvatarImg guestId={myId} size={38} />
          <div className="min-w-0 flex-1">
            <Composer
              placeholder={`Comment as ${getProfileName(myId)}…`}
              submitting={posting}
              onSubmit={async (body, spoiler) => {
                setPosting(true);
                try {
                  await postComment({
                    content: contentKey,
                    name: getProfileName(getGuestId()),
                    body,
                    isSpoiler: spoiler,
                  });
                  await load(1, false);
                } catch (e) {
                  setNotice(e instanceof Error ? e.message : "Failed to post");
                } finally {
                  setPosting(false);
                }
              }}
            />
          </div>
        </div>
      </div>

      {notice && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-xs font-semibold text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" /> {notice}
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setNotice(null)}
            className="ml-auto rounded-full p-1 hover:bg-destructive/20"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* list */}
      <div className="mt-4 space-y-2.5">
        {loading && comments.length === 0 ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-border/40 bg-card/60 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading comments…
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-6 text-center text-sm font-semibold text-destructive">
            {error}
            <button
              type="button"
              onClick={() => void load(1, false)}
              className="mt-2 block w-full text-xs text-muted-foreground underline"
            >
              Try again
            </button>
          </div>
        ) : comments.length === 0 ? (
          <div className="rounded-2xl border border-border/40 bg-card/60 px-4 py-10 text-center">
            <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="mt-2 text-sm font-semibold text-foreground">No comments yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Be the first to share your thoughts on this episode.</p>
          </div>
        ) : (
          comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              depth={0}
              isAdmin={isAdmin}
              adminToken={adminToken}
              onAction={runAction}
              onReplyPosted={() => void load(1, false)}
            />
          ))
        )}
      </div>

      {page < pages && (
        <button
          type="button"
          disabled={loading}
          onClick={() => void load(page + 1, true)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-border/60 py-2.5 text-sm font-bold text-foreground transition hover:border-primary/50 hover:text-primary disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Load more comments
        </button>
      )}
    </section>
  );
}
