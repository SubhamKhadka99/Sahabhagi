import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type AppNotification, type NotificationType } from "../lib/api";

const ICON: Record<NotificationType, string> = {
  status_change: "🔔",
  resolved_ack: "✅",
  progress_note: "📋",
};

interface Props {
  onOpenReport: (reportId: string) => void;
}

export default function NotificationsBell({ onOpenReport }: Props) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  function refresh() {
    api.notifications.list().then(setNotifications).catch(() => {});
  }

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 20_000);
    return () => clearInterval(iv);
  }, []);

  const unread = notifications.filter(n => !n.read).length;

  async function handleOpen(n: AppNotification) {
    setOpen(false);
    onOpenReport(n.reportId);
    if (!n.read) {
      try {
        const updated = await api.notifications.markRead(n.id);
        setNotifications(prev => prev.map(x => x.id === n.id ? updated : x));
      } catch {
        // non-critical — leave it unread, will retry next refresh
      }
    }
  }

  async function handleMarkAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    try {
      await api.notifications.markAllRead();
    } catch {
      refresh();
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="relative p-2 muted hover:text-heading rounded-lg transition"
        aria-label="Notifications"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-1">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[1500]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-[1600] w-80 max-w-[85vw] surface rounded-2xl shadow-2xl overflow-hidden animate-scale-in origin-top-right">
            <div className="flex items-center justify-between px-4 py-3 border-b border-subtle">
              <h3 className="heading font-semibold text-sm">Notifications</h3>
              {unread > 0 && (
                <button onClick={() => void handleMarkAllRead()} className="text-xs text-[#00B4D8] hover:underline">
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 && (
                <p className="text-xs muted text-center py-10 px-4">
                  No notifications yet. You'll be notified here when a report you filed or upvoted changes status.
                </p>
              )}
              {notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => void handleOpen(n)}
                  className={`w-full flex gap-2.5 text-left px-4 py-3 border-b border-subtle last:border-0 transition hover:bg-slate-50 dark:hover:bg-white/5 ${!n.read ? "bg-[#00B4D8]/5" : ""}`}
                >
                  <span className="text-base flex-shrink-0 mt-0.5">{ICON[n.type]}</span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs ${!n.read ? "font-semibold heading" : "body-text"}`}>{n.title}</p>
                    <p className="text-xs muted mt-0.5 line-clamp-2">{n.body}</p>
                    <p className="text-[10px] muted-2 mt-1">{new Date(n.timestamp).toLocaleString()}</p>
                  </div>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-[#00B4D8] flex-shrink-0 mt-1.5" />}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
