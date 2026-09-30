import { useQuery } from "@tanstack/react-query";
import { uzhavanApi } from "@/lib/api";
import { EmptyState, ErrorState, LoadingState, PageHeading } from "@/components/common/States";
import { AuditTable } from "./admin/AdminPages";

export default function UzhavanHistoryPage() {
  const q = useQuery({ queryKey: ["uzhavan-audit"], queryFn: uzhavanApi.auditLog });
  return (
    <div className="resource-page">
      <PageHeading eyebrow="Ask ROOT" title="Your assistant activity" />
      <p className="muted">Every command you gave ROOT, which tool it chose, and whether the marketplace executed it.</p>
      {q.isLoading && <LoadingState />}
      {q.isError && <ErrorState error={q.error} onRetry={q.refetch} />}
      {q.data && q.data.length === 0 && <EmptyState title="No activity yet" text="Open Ask ROOT and try “show my orders”." />}
      {q.data && q.data.length > 0 && <AuditTable items={q.data} />}
    </div>
  );
}
