import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Bell, CheckCircle2, ChevronRight, Clock3, LayoutDashboard, Leaf, LogOut, MapPin, Menu, MessageCircle, ShieldCheck, ShoppingBasket, Sprout, UserRound, X } from "lucide-react";
import { useAuth, homeFor } from "@/context/AuthContext";
import { useNotifications } from "@/hooks/queries";
import { useLocationPref } from "@/hooks/useLocationPref";
import { API_BASE } from "@/lib/api";
import { LOGOUT } from "@/constants/testIds";
import { LocationPicker } from "./LocationPicker";
import { AssistantPanel } from "@/components/uzhavan/AssistantPanel";
import { Brand } from "@/components/common/Brand";

export function Shell() {
  const { user, isAuthenticated, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const loc = useLocationPref();
  const [locationOpen, setLocationOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [accountMenu, setAccountMenu] = useState(false);
  const accountMenuRef = useRef(null);

  const unread = useNotifications({ unreadOnly: true, limit: 1 }, isAuthenticated);
  const unreadCount = unread.data?.pagination?.total || 0;

  useEffect(() => {
    setMobileMenu(false);
    setAccountMenu(false);
  }, [pathname]);

  useEffect(() => {
    if (!accountMenu) return undefined;
    const handleOutsideClick = (e) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target)) {
        setAccountMenu(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [accountMenu]);

  const logout = async () => {
    setAccountMenu(false);
    setMobileMenu(false);
    await signOut();
    navigate("/login");
  };

  const isFarmer = user?.role === "ROLE_FARMER";
  const isAdmin = user?.role === "ROLE_ADMIN";
  const workspace = isFarmer ? { to: "/farmer", label: "Farm workspace" } : isAdmin ? { to: "/admin", label: "Admin" } : { to: "/orders", label: "My orders" };

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand" aria-label="Uzhavan 360 home" data-testid="brand-home-link"><Brand testId="header-application-logo" /></Link>
        <button className="location-chip" onClick={() => setLocationOpen(true)} data-testid="location-picker-button"><MapPin size={16} /><span>{loc.place?.name || "Choose location"}</span><ChevronRight size={15} /></button>
        <nav className="desktop-nav" data-testid="desktop-navigation">
          <NavLink to="/" end data-testid="nav-marketplace-link">Marketplace</NavLink>
          {isAuthenticated && <NavLink to={workspace.to} data-testid="nav-workspace-link">{workspace.label}</NavLink>}
          {isAuthenticated && !isAdmin && <NavLink to={isFarmer ? "/farmer/requests" : "/requests"} data-testid="nav-requests-link">Requests</NavLink>}
          <NavLink to="/byproducts" data-testid="nav-byproducts-link">Byproducts</NavLink>
        </nav>
        <div className="top-actions">
          {isAuthenticated && <Link to="/notifications" className="icon-button" aria-label={`Notifications, ${unreadCount} unread`} data-testid="notifications-link"><Bell size={19} />{unreadCount > 0 && <span className="notification-dot" data-testid="notifications-unread-dot" />}</Link>}
          {isAuthenticated ? (
            <div className="account-menu-container" ref={accountMenuRef}>
              <button
                className="avatar-button"
                onClick={() => setAccountMenu(!accountMenu)}
                aria-label="Account menu"
                aria-expanded={accountMenu}
                aria-haspopup="menu"
                data-testid="account-menu-button"
              >
                {(user.name || "U")[0].toUpperCase()}
              </button>
              {accountMenu && (
                <div className="account-dropdown" role="menu" data-testid="account-dropdown-menu">
                  <div className="account-dropdown-header">
                    <strong data-testid="account-dropdown-username">{user.name}</strong>
                    <span className="role-badge">{user.role?.replace("ROLE_", "").toLowerCase()}</span>
                    <small className="muted">{user.phone}</small>
                  </div>
                  <div className="account-dropdown-divider" />
                  <NavLink to={workspace.to} onClick={() => setAccountMenu(false)} data-testid="dropdown-workspace-link">
                    {workspace.label}
                  </NavLink>
                  {isFarmer && (
                    <NavLink to="/farmer/products" onClick={() => setAccountMenu(false)} data-testid="dropdown-products-link">
                      My produce & stock
                    </NavLink>
                  )}
                  <NavLink to="/profile" onClick={() => setAccountMenu(false)} data-testid="dropdown-profile-link">
                    <UserRound size={15} /> Profile & settings
                  </NavLink>
                  <div className="account-dropdown-divider" />
                  <button
                    type="button"
                    onClick={logout}
                    className="dropdown-logout-button"
                    data-testid={LOGOUT.button}
                  >
                    <LogOut size={15} /> Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link className="login-link" to="/login" data-testid="login-link">Log in</Link>
          )}
          <button className="mobile-menu-btn" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Menu" data-testid="mobile-menu-button">{mobileMenu ? <X /> : <Menu />}</button>
        </div>
      </header>
      {mobileMenu && (
        <div className="mobile-menu" data-testid="mobile-navigation">
          <NavLink to="/" end data-testid="mobile-marketplace-link">Marketplace</NavLink>
          {isAuthenticated && <NavLink to={workspace.to} data-testid="mobile-workspace-link">{workspace.label}</NavLink>}
          {isAuthenticated && !isAdmin && <NavLink to={isFarmer ? "/farmer/requests" : "/requests"} data-testid="mobile-requests-link">Requests</NavLink>}
          {isAuthenticated && !isAdmin && <NavLink to={isFarmer ? "/farmer/orders" : "/orders"} data-testid="mobile-orders-link">Orders</NavLink>}
          <NavLink to="/byproducts" data-testid="mobile-byproducts-link">Byproducts</NavLink>
          {isAuthenticated && <NavLink to="/profile" data-testid="mobile-profile-link">Profile</NavLink>}
          {isAuthenticated ? (
            <button type="button" onClick={logout} data-testid="mobile-logout-button">
              <LogOut size={15} /> Log out
            </button>
          ) : (
            <NavLink to="/login" data-testid="mobile-login-link">Log in</NavLink>
          )}
        </div>
      )}
      {!API_BASE && <div className="config-banner" data-testid="api-config-banner">The marketplace API URL is not configured. Set REACT_APP_API_URL in the frontend env file.</div>}
      <main className="main-content"><Outlet context={{ place: loc.place, openLocation: () => setLocationOpen(true) }} /></main>
      {isAuthenticated && <button className="ask-fab" onClick={() => setAssistantOpen(true)} data-testid="ask-uzhavan-button"><MessageCircle size={18} /> Ask ROOT</button>}
      <nav className="bottom-nav" data-testid="mobile-bottom-navigation">
        <NavLink to="/" end data-testid="bottom-home-link"><ShoppingBasket /><span>Market</span></NavLink>
        {isFarmer ? <NavLink to="/farmer" end data-testid="bottom-farm-link"><LayoutDashboard /><span>Farm</span></NavLink> : isAdmin ? <NavLink to="/admin" end data-testid="bottom-admin-link"><ShieldCheck /><span>Admin</span></NavLink> : <NavLink to="/requests" data-testid="bottom-requests-link"><Clock3 /><span>Requests</span></NavLink>}
        {isAdmin ? <NavLink to="/admin/users" data-testid="bottom-users-link"><UserRound /><span>Users</span></NavLink> : <NavLink to={isFarmer ? "/farmer/orders" : "/orders"} data-testid="bottom-orders-link"><CheckCircle2 /><span>Orders</span></NavLink>}
        {isFarmer ? <NavLink to="/farmer/products" data-testid="bottom-products-link"><Sprout /><span>Produce</span></NavLink> : <NavLink to="/byproducts" data-testid="bottom-byproducts-link"><Leaf /><span>Byproducts</span></NavLink>}
        <NavLink to={isAuthenticated ? "/profile" : "/login"} data-testid="bottom-profile-link"><UserRound /><span>{isAuthenticated ? "Profile" : "Log in"}</span></NavLink>
      </nav>
      <LocationPicker open={locationOpen} onClose={() => setLocationOpen(false)} cities={loc.cities} onChoose={loc.choose} onUseDevice={loc.useDevice} />
      {isAuthenticated && <AssistantPanel open={assistantOpen} onClose={() => setAssistantOpen(false)} />}
      {isAuthenticated && homeFor(user.role) && null}
    </div>
  );
}
