export const Brand = ({ testId, large = false }) => (
  <span className={`brand brand-identity${large ? " brand-identity-large" : ""}`}>
    <img
      className="brand-logo"
      src="/brand/uzhavan-360-logo.webp"
      alt="Uzhavan 360 — Connecting farms, nourishing lives"
      width={large ? 144 : 44}
      height={large ? 144 : 44}
      data-testid={testId}
    />
    {!large && <span className="brand-name" aria-hidden="true">Uzhavan <em>360</em></span>}
  </span>
);