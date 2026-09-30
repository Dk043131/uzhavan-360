import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth, homeFor } from "@/context/AuthContext";
import { BUSINESS_TYPES, CITIES } from "@/lib/constants";
import { Brand } from "@/components/common/Brand";

export default function AuthPage({ mode }) {
  const login = mode === "login";
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();
  const [form, setForm] = useState({ phone: "", password: "", name: "", role: "ROLE_BUYER", email: "", farmName: "", village: "", district: "Coimbatore", businessType: "HOUSEHOLD", city: CITIES[0].name });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError("");
    try {
      let user;
      if (login) user = await auth.login({ phone: form.phone, password: form.password });
      else {
        const city = CITIES.find((c) => c.name === form.city) || CITIES[0];
        const payload = { name: form.name, phone: form.phone, password: form.password, role: form.role, email: form.email || undefined };
        if (form.role === "ROLE_FARMER") payload.farmDetails = { farmName: form.farmName || `${form.name}'s Farm`, address: { village: form.village, district: form.district, state: "Tamil Nadu" }, latitude: city.lat, longitude: city.lng };
        else payload.buyerDetails = { businessType: form.businessType };
        user = await auth.register(payload);
      }
      navigate(location.state?.from || homeFor(user.role), { replace: true });
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-visual"><Brand large testId={`${mode}-application-logo`} /><div><span className="eyebrow light">Direct from the soil</span><h1>Good food starts with a good connection.</h1><p>Meet the farmers behind your freshest harvests.</p></div></div>
      <form className="auth-form" onSubmit={submit} data-testid={`${mode}-form`} noValidate>
        <span className="eyebrow">Welcome to Uzhavan 360</span><h1>{login ? "Welcome back" : "Join the harvest"}</h1>
        <p className="muted">{login ? "Log in with your mobile number." : "Create your account and trade closer to home."}</p>
        {error && <div className="error-box" role="alert" data-testid="auth-error-message">{error}</div>}
        {!login && <>
          <label>Full name<input required value={form.name} onChange={set("name")} data-testid="register-name-input" /></label>
          <div className="role-toggle" role="radiogroup" aria-label="Account type"><button type="button" role="radio" aria-checked={form.role === "ROLE_BUYER"} className={form.role === "ROLE_BUYER" ? "selected" : ""} onClick={() => setForm({ ...form, role: "ROLE_BUYER" })} data-testid="buyer-role-button">I’m buying</button><button type="button" role="radio" aria-checked={form.role === "ROLE_FARMER"} className={form.role === "ROLE_FARMER" ? "selected" : ""} onClick={() => setForm({ ...form, role: "ROLE_FARMER" })} data-testid="farmer-role-button">I’m farming</button></div>
        </>}
        <label>Phone number<input required inputMode="numeric" pattern="[6-9][0-9]{9}" value={form.phone} onChange={set("phone")} placeholder="10-digit mobile number" data-testid={`${mode}-phone-input`} /></label>
        {!login && <label>Email <span>(optional)</span><input type="email" value={form.email} onChange={set("email")} data-testid="register-email-input" /></label>}
        <label>Password<input required minLength={6} type="password" value={form.password} onChange={set("password")} data-testid={`${mode}-password-input`} /></label>
        {!login && form.role === "ROLE_FARMER" && <>
          <label>Farm name<input value={form.farmName} onChange={set("farmName")} placeholder="e.g. Murugan Organic Farms" data-testid="register-farm-name-input" /></label>
          <label>Village<input value={form.village} onChange={set("village")} data-testid="register-village-input" /></label>
          <label>District<input value={form.district} onChange={set("district")} data-testid="register-district-input" /></label>
          <label>Nearest city (sets your farm map location)<select value={form.city} onChange={set("city")} data-testid="register-city-select">{CITIES.map((c) => <option key={c.name}>{c.name}</option>)}</select></label>
        </>}
        {!login && form.role === "ROLE_BUYER" && <label>Buying as<select value={form.businessType} onChange={set("businessType")} data-testid="register-business-type-select">{BUSINESS_TYPES.map((b) => <option key={b} value={b}>{b.charAt(0) + b.slice(1).toLowerCase()}</option>)}</select></label>}
        <button className="primary-button full-width" disabled={busy} data-testid={`${mode}-submit-button`}>{busy ? "Please wait..." : login ? "Log in" : "Create account"}</button>
        <p className="auth-switch">{login ? "New to the market?" : "Already have an account?"} <Link to={login ? "/register" : "/login"} data-testid="auth-switch-link">{login ? "Create an account" : "Log in"}</Link></p>
      </form>
    </div>
  );
}
