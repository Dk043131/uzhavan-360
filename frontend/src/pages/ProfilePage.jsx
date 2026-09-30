import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, ChevronRight, Leaf, LogOut, ShieldCheck } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useProfile } from "@/hooks/queries";
import { usersApi } from "@/lib/api";
import { BUSINESS_TYPES } from "@/lib/constants";
import { ErrorState, InlineError, LoadingState } from "@/components/common/States";

export default function ProfilePage() {
  const { user, signOut, refreshUser } = useAuth();
  const navigate = useNavigate();
  const q = useProfile(Boolean(user));
  const [editing, setEditing] = useState(false);
  const logout = async () => {
    await signOut();
    navigate("/login");
  };
  if (q.isLoading) return <LoadingState />;
  if (q.isError) return <ErrorState error={q.error} onRetry={q.refetch} />;
  const p = q.data;
  const isFarmer = p.role === "ROLE_FARMER";
  return (
    <div className="profile-page">
      <div className="profile-header"><div className="big-avatar">{(p.name || "U")[0]}</div><div><span className="eyebrow">{p.role.replace("ROLE_", "").toLowerCase()} account</span><h1 data-testid="profile-name">{p.name}</h1><p className="muted">{p.phone}{p.email ? ` · ${p.email}` : ""}</p></div></div>
      <div className="data-card">
        <div className="data-card-head"><h3>{isFarmer ? "Farm details" : "Buyer details"}</h3><button className="ghost-button" onClick={() => setEditing(!editing)} data-testid="profile-edit-button">{editing ? "Close" : "Edit"}</button></div>
        {!editing && (isFarmer ? <div className="meta-grid"><div><span>Farm</span><strong>{p.farmDetails?.farmName || "—"}</strong></div><div><span>Village</span><strong>{p.farmDetails?.address?.village || "—"}</strong></div><div><span>District</span><strong>{p.farmDetails?.address?.district || "—"}</strong></div><div><span>Verified</span><strong>{p.isVerified ? "Yes" : "Pending admin review"}</strong></div></div> : <div className="meta-grid"><div><span>Business type</span><strong>{p.buyerDetails?.businessType || "—"}</strong></div><div><span>No-shows</span><strong>{p.buyerDetails?.noShowCount ?? 0}</strong></div></div>)}
        {editing && <ProfileForm profile={p} onSaved={async () => { await q.refetch(); await refreshUser(); setEditing(false); }} />}
      </div>
      <div className="profile-sections">
        <Link to="/notifications" className="profile-row" data-testid="profile-notifications-link"><Bell />Notifications<ChevronRight /></Link>
        <Link to="/byproducts" className="profile-row" data-testid="profile-byproducts-link"><Leaf />Byproducts<ChevronRight /></Link>
        <Link to="/uzhavan/history" className="profile-row" data-testid="profile-ai-audit-link"><ShieldCheck />Ask Uzhavan activity log<ChevronRight /></Link>
        <button className="profile-row danger-row" onClick={logout} data-testid="profile-logout-button"><LogOut />Log out<ChevronRight /></button>
      </div>
    </div>
  );
}

function ProfileForm({ profile, onSaved }) {
  const isFarmer = profile.role === "ROLE_FARMER";
  const [f, setF] = useState({ name: profile.name || "", email: profile.email || "", farmName: profile.farmDetails?.farmName || "", bio: profile.farmDetails?.bio || "", village: profile.farmDetails?.address?.village || "", district: profile.farmDetails?.address?.district || "", pincode: profile.farmDetails?.address?.pincode || "", businessType: profile.buyerDetails?.businessType || "HOUSEHOLD" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = useMutation({ mutationFn: () => usersApi.update(isFarmer ? { name: f.name, email: f.email || undefined, farmDetails: { farmName: f.farmName, bio: f.bio, address: { village: f.village, district: f.district, state: "Tamil Nadu", pincode: f.pincode } } } : { name: f.name, email: f.email || undefined, buyerDetails: { businessType: f.businessType } }), onSuccess: onSaved });
  return (
    <form className="form-grid" onSubmit={(e) => { e.preventDefault(); save.mutate(); }} data-testid="profile-form">
      <label>Name<input required value={f.name} onChange={set("name")} data-testid="profile-name-input" /></label>
      <label>Email<input type="email" value={f.email} onChange={set("email")} data-testid="profile-email-input" /></label>
      {isFarmer ? <>
        <label>Farm name<input value={f.farmName} onChange={set("farmName")} data-testid="profile-farm-name-input" /></label>
        <label>Village<input value={f.village} onChange={set("village")} data-testid="profile-village-input" /></label>
        <label>District<input value={f.district} onChange={set("district")} data-testid="profile-district-input" /></label>
        <label>Pincode<input value={f.pincode} onChange={set("pincode")} data-testid="profile-pincode-input" /></label>
        <label className="span-2">Farm story<textarea rows={3} value={f.bio} onChange={set("bio")} data-testid="profile-bio-input" /></label>
      </> : <label>Business type<select value={f.businessType} onChange={set("businessType")} data-testid="profile-business-type-select">{BUSINESS_TYPES.map((b) => <option key={b}>{b}</option>)}</select></label>}
      <div className="span-2"><InlineError error={save.error} testId="profile-error" /></div>
      <div className="dialog-actions span-2"><button className="primary-button" disabled={save.isPending} data-testid="profile-save-button">{save.isPending ? "Saving..." : "Save changes"}</button></div>
    </form>
  );
}
