import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/hooks/queries";
import { notificationsApi } from "@/lib/api";
import { relTime } from "@/lib/constants";
import { EmptyState, ErrorState, LoadingState, PageHeading, Pagination } from "@/components/common/States";

const linkFor = (n, role) => {
  const farmer = role === "ROLE_FARMER";
  if (n.data?.orderId) return farmer ? "/farmer/orders" : `/orders/${n.data.orderId}`;
  if (n.data?.requestId) return farmer ? "/farmer/requests" : "/requests";
  if (n.data?.productId) return `/product/${n.data.productId}`;
  return null;
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const q = useNotifications({ page, limit: 20 }, Boolean(user));
  const refresh = () => qc.invalidateQueries({ queryKey: ["notifications"] });
  const open = async (n) => { if (!n.isRead) await notificationsApi.markRead(n._id).catch(() => {}); refresh(); const to = linkFor(n, user.role); if (to) navigate(to); };
  const readAll = async () => { await notificationsApi.markAllRead(); refresh(); };
  return (
    <div className="resource-page">
      <PageHeading eyebrow="Your Uzhavan" title="Notifications">{q.data?.items.some((n) => !n.isRead) && <button className="ghost-button" onClick={readAll} data-testid="mark-all-read-button"><CheckCheck size={15} /> Mark all read</button>}</PageHeading>
      {q.isLoading && <LoadingState />}
      {q.isError && <ErrorState error={q.error} onRetry={q.refetch} />}
      {q.data && q.data.items.length === 0 && <EmptyState title="All clear" text="Updates about requests, orders, and stock will appear here." />}
      {q.data && q.data.items.length > 0 && <div className="card-list" data-testid="notifications-list">{q.data.items.map((n) => <button key={n._id} className={`notif-row ${n.isRead ? "" : "unread"}`} onClick={() => open(n)} data-testid={`notification-${n._id}`}><div><strong>{n.title}</strong><p>{n.message}</p></div><time dateTime={n.createdAt}>{relTime(n.createdAt)}</time></button>)}</div>}
      {q.data && <Pagination pagination={q.data.pagination} page={page} onChange={setPage} />}
    </div>
  );
}
