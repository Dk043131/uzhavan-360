import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, byproductsApi, demandApi, farmersApi, inventoryApi, marketplaceApi, notificationsApi, ordersApi, productsApi, requestsApi, usersApi } from "@/lib/api";

export const keys = {
  marketplace: (p) => ["marketplace", p],
  product: (id) => ["product", id],
  myProducts: ["my-products"],
  farmer: (id) => ["farmer", id],
  requests: (p) => ["requests", p],
  orders: (p) => ["orders", p],
  order: (id) => ["order", id],
  notifications: (p) => ["notifications", p],
  history: (id) => ["inventory-history", id],
  byproducts: (p) => ["byproducts", p],
  myByproducts: ["my-byproducts"],
  demand: (k, p) => ["demand", k, p],
  admin: (k, p) => ["admin", k, p],
  profile: ["profile"],
};

const POLL = 30000;

// Invalidate and immediately refetch active queries — the backend is the source of truth.
export function useInvalidateCommerce() {
  const qc = useQueryClient();
  return () => {
    const keys = ["marketplace", "product", "my-products", "requests", "orders", "order", "notifications", "inventory-history", "demand", "admin", "farmer"];
    keys.forEach((k) => {
      qc.invalidateQueries({ queryKey: [k] });
      qc.refetchQueries({ queryKey: [k], type: "active" });
    });
  };
}

export const useMarketplace = (params) => useQuery({ queryKey: keys.marketplace(params), queryFn: ({ signal }) => marketplaceApi.search(params, signal), placeholderData: (prev) => prev, staleTime: 15000 });
export const useProduct = (id) => useQuery({ queryKey: keys.product(id), queryFn: () => productsApi.get(id).then((d) => d.product), enabled: Boolean(id) });
export const useFarmer = (id) => useQuery({ queryKey: keys.farmer(id), queryFn: () => farmersApi.get(id), enabled: Boolean(id) });
export const useMyProducts = (enabled = true) => useQuery({ queryKey: keys.myProducts, queryFn: () => productsApi.mine().then((d) => d.products), enabled });
export const useRequests = (params, enabled = true) => useQuery({ queryKey: keys.requests(params), queryFn: () => requestsApi.list(params), enabled, refetchInterval: POLL });
export const useOrders = (params, enabled = true) => useQuery({ queryKey: keys.orders(params), queryFn: () => ordersApi.list(params), enabled, refetchInterval: POLL });
export const useOrder = (id) => useQuery({ queryKey: keys.order(id), queryFn: () => ordersApi.get(id).then((d) => d.order), enabled: Boolean(id), refetchInterval: POLL });
export const useNotifications = (params, enabled = true) => useQuery({ queryKey: keys.notifications(params), queryFn: () => notificationsApi.list(params), enabled, refetchInterval: POLL });
export const useInventoryHistory = (productId) => useQuery({ queryKey: keys.history(productId), queryFn: () => inventoryApi.history(productId).then((d) => d.history), enabled: Boolean(productId) });
export const useByproducts = (params) => useQuery({ queryKey: keys.byproducts(params), queryFn: () => byproductsApi.search(params), placeholderData: (p) => p });
export const useMyByproducts = (enabled = true) => useQuery({ queryKey: keys.myByproducts, queryFn: () => byproductsApi.mine().then((d) => d.byproducts), enabled });
export const useDemandSignals = (params) => useQuery({ queryKey: keys.demand("signals", params), queryFn: () => demandApi.signals(params) });
export const useDecisionSupport = (params, enabled) => useQuery({ queryKey: keys.demand("decision", params), queryFn: () => demandApi.decisionSupport(params), enabled });
export const useMatchSupply = (params, enabled) => useQuery({ queryKey: keys.demand("match", params), queryFn: () => demandApi.matchSupply(params), enabled });
export const useAdminOverview = () => useQuery({ queryKey: keys.admin("overview"), queryFn: adminApi.overview, refetchInterval: POLL });
export const useAdminUsers = (params) => useQuery({ queryKey: keys.admin("users", params), queryFn: () => adminApi.users(params), placeholderData: (p) => p });
export const useAdminAuditLogs = (params) => useQuery({ queryKey: keys.admin("audit", params), queryFn: () => adminApi.auditLogs(params), placeholderData: (p) => p });
export const useProfile = (enabled) => useQuery({ queryKey: keys.profile, queryFn: () => usersApi.profile().then((d) => d.user), enabled });

// Generic mutation that refetches authoritative state after the backend responds.
export function useCommerceMutation(mutationFn, options = {}) {
  const invalidate = useInvalidateCommerce();
  return useMutation({ mutationFn, ...options, onSuccess: (...args) => { invalidate(); options.onSuccess?.(...args); } });
}
