/**
 * Shared split-screen shell for Login, Register, and Staff Login.
 * Left: cream form card. Right: Unsplash photo + teal overlay + copy.
 * Below ~900px: short teal banner above the form (no literal split).
 */

import './AuthLayout.css';

function AuthSplitLayout({ visual, children, formWide = false }) {
  return (
    <main className="auth-shell">
      <aside className="auth-banner" aria-hidden="false">
        <p className="auth-banner-brand">Healio</p>
        <p className="auth-banner-line">{visual.line}</p>
      </aside>

      <div className="auth-form-panel">
        <div
          className={
            formWide ? 'auth-form-inner auth-form-inner--wide' : 'auth-form-inner'
          }
        >
          {children}
        </div>
      </div>

      <aside className="auth-brand-panel" aria-label="About Healio">
        <img
          className="auth-brand-photo"
          src={visual.imageUrl}
          alt=""
          width={1400}
          height={933}
          decoding="async"
        />
        <div className="auth-brand-overlay" aria-hidden="true" />
        <div className="auth-brand-inner">
          <p className="auth-brand-name">Healio</p>
          <p className="auth-brand-line">{visual.line}</p>
          <p className="auth-brand-meta">{visual.meta}</p>
        </div>
      </aside>
    </main>
  );
}

export default AuthSplitLayout;
