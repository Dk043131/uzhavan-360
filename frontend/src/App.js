import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import "@/App.css";
import "@/styles/integration.css";
import { queryClient } from "@/lib/queryClient";
import { AuthProvider } from "@/context/AuthContext";
import { Shell } from "@/components/layout/Shell";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { EmptyState } from "@/components/common/States";
import MarketplacePage from "@/pages/MarketplacePage";
import ProductDetailPage from "@/pages/ProductDetailPage";
import FarmerProfilePage from "@/pages/FarmerProfilePage";
import AuthPage from "@/pages/AuthPage";
import BuyerRequestsPage from "@/pages/BuyerRequestsPage";
import BuyerOrdersPage from "@/pages/BuyerOrdersPage";
import OrderDetailPage from "@/pages/OrderDetailPage";
import NotificationsPage from "@/pages/NotificationsPage";
import ProfilePage from "@/pages/ProfilePage";
import ByproductsPage from "@/pages/ByproductsPage";
import UzhavanHistoryPage from "@/pages/UzhavanHistoryPage";
import FarmerHomePage from "@/pages/farmer/FarmerHomePage";
import FarmerProductsPage from "@/pages/farmer/FarmerProductsPage";
import FarmerInventoryPage from "@/pages/farmer/FarmerInventoryPage";
import FarmerRequestsPage from "@/pages/farmer/FarmerRequestsPage";
import FarmerOrdersPage from "@/pages/farmer/FarmerOrdersPage";
import FarmerInsightsPage from "@/pages/farmer/FarmerInsightsPage";
import { AdminAuditLogsPage, AdminOverviewPage, AdminUsersPage } from "@/pages/admin/AdminPages";

const BUYER = ["ROLE_BUYER"], FARMER = ["ROLE_FARMER"], ADMIN = ["ROLE_ADMIN"], ANY = ["ROLE_BUYER", "ROLE_FARMER", "ROLE_ADMIN"];
const guard = (roles, el) => <ProtectedRoute roles={roles}>{el}</ProtectedRoute>;

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route element={<Shell />}>
              <Route path="/" element={<MarketplacePage />} />
              <Route path="/search" element={<Navigate to="/" replace />} />
              <Route path="/product/:id" element={<ProductDetailPage />} />
              <Route path="/farmers/:id" element={<FarmerProfilePage />} />
              <Route path="/byproducts" element={<ByproductsPage />} />
              <Route path="/login" element={<AuthPage mode="login" />} />
              <Route path="/register" element={<AuthPage mode="register" />} />
              <Route path="/requests" element={guard(BUYER, <BuyerRequestsPage />)} />
              <Route path="/orders" element={guard(BUYER, <BuyerOrdersPage />)} />
              <Route path="/orders/:id" element={guard(["ROLE_BUYER", "ROLE_FARMER"], <OrderDetailPage />)} />
              <Route path="/notifications" element={guard(ANY, <NotificationsPage />)} />
              <Route path="/profile" element={guard(ANY, <ProfilePage />)} />
              <Route path="/uzhavan/history" element={guard(ANY, <UzhavanHistoryPage />)} />
              <Route path="/farmer" element={guard(FARMER, <FarmerHomePage />)} />
              <Route path="/farmer/products" element={guard(FARMER, <FarmerProductsPage />)} />
              <Route path="/farmer/products/:id" element={guard(FARMER, <FarmerInventoryPage />)} />
              <Route path="/farmer/requests" element={guard(FARMER, <FarmerRequestsPage />)} />
              <Route path="/farmer/orders" element={guard(FARMER, <FarmerOrdersPage />)} />
              <Route path="/farmer/insights" element={guard(FARMER, <FarmerInsightsPage />)} />
              <Route path="/admin" element={guard(ADMIN, <AdminOverviewPage />)} />
              <Route path="/admin/users" element={guard(ADMIN, <AdminUsersPage />)} />
              <Route path="/admin/audit-logs" element={guard(ADMIN, <AdminAuditLogsPage />)} />
              <Route path="*" element={<EmptyState title="Page not found" text="The page you’re looking for has moved." testId="not-found-state" />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
