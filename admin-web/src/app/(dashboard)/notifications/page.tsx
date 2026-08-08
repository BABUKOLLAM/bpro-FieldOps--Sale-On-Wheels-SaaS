import { apiGet } from "@/lib/api";

type NotificationLog = {
  id: string;
  user: string | null;
  user_username: string;
  title: string;
  body: string;
  channel: "fcm" | "console";
  device_count: number;
  created_at: string;
};

type PaginatedResponse = { count: number; results: NotificationLog[] };

export default async function NotificationsPage() {
  const data = await apiGet<PaginatedResponse>("/api/notifications/logs/");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Push Notifications</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Every push notification the system has attempted (FR-18). Without an FCM server key configured, these are
          delivered to the server console instead of a real device — visible below either way.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <th className="px-4 py-2.5">Title</th>
              <th className="px-4 py-2.5">Recipient</th>
              <th className="px-4 py-2.5">Channel</th>
              <th className="px-4 py-2.5">Devices</th>
              <th className="px-4 py-2.5">Sent</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.results.map((n) => (
              <tr key={n.id}>
                <td className="px-4 py-2.5">
                  <p className="font-medium text-slate-900 dark:text-slate-50">{n.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{n.body}</p>
                </td>
                <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">{n.user_username || "—"}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      n.channel === "fcm"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                        : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {n.channel === "fcm" ? "FCM" : "Console (no FCM key)"}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">{n.device_count}</td>
                <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                  {new Date(n.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
            {data.results.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                  No notifications sent yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
