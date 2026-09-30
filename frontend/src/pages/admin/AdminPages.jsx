import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { useAdminAuditLogs, useAdminOverview, useAdminUsers } from "@/hooks/queries";
import { adminApi } from "@/lib/api";
import { money, qty, relTime } from "@/lib/constants";
import { EmptyState, ErrorState, InlineError, LoadingState, PageHeading, Pagination } from "@/components/common/States";

const AdminTabs = ({ active }) => (
  <div className="tabs-row" role="tablist" data-testid="admin-tabs">{[["/admin", "Overview"], ["/admin/users", "Users & verification"], ["/admin/audit-logs", "AI audit logs"]].map(([to, l]) => <Link key={to} to={to} role="tab" aria-selected={active === to} className={active === to ? "active" : ""} style={{ textDecoration: "none", display: "inline-flex" }} data-testid={`admin-tab-${to.split("/").pop() || "overview"}`}>{l}</Link>)}</div>
);

export function AdminOverviewPage() {
  const q = useAdminOverview();
  return (
    <div className="resource-page">
      <PageHeading eyebrow="Administration" title="Platform overview" />
      <AdminTabs active="/admin" />
      {q.isLoading && <LoadingState />}
      {q.isError && <ErrorState error={q.error} onRetry={q.refetch} />}
      {q.data && (
        <div data-testid="admin-overview">
          <div className="kpi-grid" style={{ marginTop: 18 }}>
            {[["Users", q.data.users.total, `${q.data.users.farmers} farmers · ${q.data.users.buyers} buyers`], ["Verified farmers", q.data.users.verifiedFarmers, "of " + q.data.users.farmers], ["Active listings", q.data.products.activeWithStock, `${q.data.products.total} total`], ["Orders", q.data.orders.total, `${q.data.orders.completed} completed`], ["Gross farmgate value", money(q.data.orders.grossCompletedValue), qty(q.data.orders.grossFulfilledQuantity) + " fulfilled"], ["Requests", q.data.requests.total, "all time"], ["Ledger entries", q.data.inventory.totalLedgerTransactions, "inventory moves"], ["AI actions logged", q.data.aiObservability.totalAuditLogs, `${q.data.notifications.totalDispatched} notifications`]].map(([l, v, s]) => <div className="kpi-card" key={l} data-testid={`admin-kpi-${l.toLowerCase().replace(/\s+/g, "-")}`}><span>◎</span><strong>{v}</strong><small>{l}</small><small className="muted">{s}</small></div>)}
          </div>
          <h3 className="section-title">Orders by status</h3>
          <div className="meta-grid">{Object.entries(q.data.orders.statusBreakdown).length === 0 ? <p className="muted">No orders yet.</p> : Object.entries(q.data.orders.statusBreakdown).map(([s, c]) => <div key={s}><span>{s.replace(/_/g, " ").toLowerCase()}</span><strong>{c}</strong></div>)}</div>
          <p className="disclaimer">Snapshot generated {relTime(q.data.timestamp)} · refreshes every 30 s.</p>
        </div>
      )}
    </div>
  );
}

export function AdminUsersPage() {
  const qc = useQueryClient();
  const [role, setRole] = useState("ROLE_FARMER");
  const [isVerified, setVerified] = useState("");
  const [page, setPage] = useState(1);
  const q = useAdminUsers({ role, isVerified, page, limit: 20 });
  const verify = useMutation({ mutationFn: ({ id, v }) => adminApi.verify(id, v), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }) });
  return (
    <div className="resource-page">
      <PageHeading eyebrow="Administration" title="Users & verification" />
      <AdminTabs active="/admin/users" />
      <div className="filters-bar"><select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} aria-label="Role" data-testid="admin-role-select"><option value="">All roles</option><option value="ROLE_FARMER">Farmers</option><option value="ROLE_BUYER">Buyers</option><option value="ROLE_ADMIN">Admins</option></select><select value={isVerified} onChange={(e) => { setVerified(e.target.value); setPage(1); }} aria-label="Verification" data-testid="admin-verified-select"><option value="">Any verification</option><option value="true">Verified</option><option value="false">Unverified</option></select></div>
      <InlineError error={verify.error} testId="admin-verify-error" />
      {q.isLoading && <LoadingState />}
      {q.isError && <ErrorState error={q.error} onRetry={q.refetch} />}
      {q.data && q.data.items.length === 0 && <EmptyState title="No users match" />}
      {q.data && q.data.items.length > 0 && <div className="table-wrap"><table className="data-table" data-testid="admin-users-table"><thead><tr><th>Name</th><th>Phone</th><th>Role</th><th>Details</th><th>Joined</th><th>Verification</th></tr></thead><tbody>{q.data.items.map((u) => <tr key={u._id} data-testid={`admin-user-${u._id}`}><td><strong>{u.name}</strong></td><td>{u.phone}</td><td>{u.role.replace("ROLE_", "")}</td><td className="muted">{u.role === "ROLE_FARMER" ? [u.farmDetails?.farmName, u.farmDetails?.address?.district].filter(Boolean).join(" · ") : u.buyerDetails?.businessType}</td><td>{relTime(u.createdAt)}</td><td>{u.role === "ROLE_FARMER" ? <button className={u.isVerified ? "ghost-button" : "primary-button compact"} disabled={verify.isPending} onClick={() => verify.mutate({ id: u._id, v: !u.isVerified })} data-testid={`verify-toggle-${u._id}`}>{u.isVerified ? <><ShieldOff size={14} /> Revoke</> : <><ShieldCheck size={14} /> Verify</>}</button> : <span className="muted">—</span>}</td></tr>)}</tbody></table></div>}
      {q.data && <Pagination pagination={q.data.pagination} page={page} onChange={setPage} />}
    </div>
  );
}

export function AdminAuditLogsPage() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const q = useAdminAuditLogs({ status, page, limit: 20 });
  return (
    <div className="resource-page">
      <PageHeading eyebrow="Administration" title="Uzhavan AI audit logs" />
      <AdminTabs active="/admin/audit-logs" />
      <div className="filters-bar"><select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status" data-testid="audit-status-select"><option value="">All outcomes</option>{["SUCCESS", "FAILED", "UNAUTHORIZED", "CONFIRMATION_PENDING"].map((s) => <option key={s}>{s}</option>)}</select></div>
      {q.isLoading && <LoadingState />}
      {q.isError && <ErrorState error={q.error} onRetry={q.refetch} />}
      {q.data && q.data.items.length === 0 && <EmptyState title="No AI activity yet" text="Every Ask Uzhavan command and tool call is recorded here." />}
      {q.data && q.data.items.length > 0 && <AuditTable items={q.data.items} showUser />}
      {q.data && <Pagination pagination={q.data.pagination} page={page} onChange={setPage} />}
    </div>
  );
}

export function AuditTable({ items, showUser }) {
  const tone = { SUCCESS: "tone-success", FAILED: "tone-danger", UNAUTHORIZED: "tone-danger", CONFIRMATION_PENDING: "tone-pending" };
  return <div className="table-wrap"><table className="data-table" data-testid="audit-table"><thead><tr><th>When</th>{showUser && <th>User</th>}<th>Command</th><th>Tool</th><th>Outcome</th><th>Details</th></tr></thead><tbody>{items.map((l) => <tr key={l._id} data-testid={`audit-row-${l._id}`}><td>{relTime(l.createdAt)}</td>{showUser && <td className="muted">{String(l.userId).slice(-6)} · {l.authorizationResult?.userRole?.replace("ROLE_", "")}</td>}<td>{l.userCommand}</td><td>{l.toolSelected || l.detectedIntent}</td><td><span className={`status-badge ${tone[l.status] || "tone-muted"}`}>{l.status}</span></td><td className="muted">{l.errorInfo || (l.toolArguments && Object.keys(l.toolArguments).length ? JSON.stringify(l.toolArguments) : "")}</td></tr>)}</tbody></table></div>;
}
