import { Leaf, RefreshCw } from "lucide-react";
import { ORDER_STATUS, REQUEST_STATUS } from "@/lib/constants";

export const LoadingState = ({ text = "Loading from your marketplace...", rows = 3 }) => (
  <div className="resource-list" data-testid="loading-state" aria-busy="true" aria-label={text}>
    {Array.from({ length: rows }).map((_, i) => <div className="skeleton list-skeleton" key={i} />)}
  </div>
);

export const ErrorState = ({ error, onRetry, title = "Couldn’t load that" }) => (
  <div className="state-box error-state" role="alert" data-testid="error-state">
    <div className="state-icon">!</div>
    <h2>{title}</h2>
    <p>{error?.message || String(error || "Something went wrong.")}</p>
    {onRetry && <button className="outline-button" onClick={onRetry} data-testid="retry-button"><RefreshCw size={15} /> Try again</button>}
  </div>
);

export const EmptyState = ({ title, text, action, onAction, testId = "empty-state" }) => (
  <div className="state-box empty-state" data-testid={testId}>
    <div className="state-icon leaf-icon"><Leaf /></div>
    <h2>{title}</h2>
    {text && <p>{text}</p>}
    {action && <button className="outline-button" onClick={onAction} data-testid="empty-state-action">{action}</button>}
  </div>
);

export const StatusBadge = ({ status, kind = "order" }) => {
  const map = kind === "request" ? REQUEST_STATUS : ORDER_STATUS;
  const meta = map[status] || { label: status || "—", tone: "muted" };
  return <span className={`status-badge tone-${meta.tone}`} data-testid={`status-badge-${status}`}>{meta.label}</span>;
};

export const InlineError = ({ error, testId = "inline-error" }) => (error ? <div className="error-box" role="alert" data-testid={testId}>{error.message || String(error)}</div> : null);

export const PageHeading = ({ eyebrow, title, children }) => (
  <div className="page-heading"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1></div>{children}</div>
);

export const Pagination = ({ pagination, page, onChange }) => {
  if (!pagination || pagination.pages <= 1) return null;
  return (
    <div className="pager" data-testid="pagination">
      <button className="outline-button compact" disabled={page <= 1} onClick={() => onChange(page - 1)} data-testid="pager-prev">Previous</button>
      <span>Page {pagination.page} of {pagination.pages} · {pagination.total} total</span>
      <button className="outline-button compact" disabled={page >= pagination.pages} onClick={() => onChange(page + 1)} data-testid="pager-next">Next</button>
    </div>
  );
};
