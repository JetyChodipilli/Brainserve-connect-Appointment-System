import BrainServeApp from "./brainserve-app";
import AppErrorBoundary from "./app-error-boundary";
import { Database, LockKeyhole, ShieldAlert } from "lucide-react";

export default function Home() {
  const backendConfigured = Boolean(
      process.env.NEXT_PUBLIC_API_BASE_URL?.trim(),
  );

  const browserPreviewEnabled =
      !backendConfigured &&
      process.env.NEXT_PUBLIC_BROWSER_PREVIEW === "true" &&
      import.meta.env.VITE_BRAINSERVE_LOCKED !== "1";

  if (!backendConfigured && !browserPreviewEnabled) {
    return (
        <main className="backend-required-page">
          <section
              className="backend-required-card glass-panel"
              aria-labelledby="backend-required-title"
          >
            <div className="backend-required-icon">
              <ShieldAlert size={30} />
            </div>

            <span className="eyebrow">SECURE BACKEND REQUIRED</span>

            <h1 id="backend-required-title">
              BrainServe Connect is temporarily unavailable.
            </h1>

            <p>
              Browser Preview authentication has been disabled. PostgreSQL-backed
              identity, role permissions, OTP verification and company records
              must be connected before staff access can continue.
            </p>

            <div className="backend-required-status">
              <Database size={19} />

              <span>
              <strong>Backend connection pending</strong>

              <small>
                No local browser account or OTP fallback is active.
              </small>
            </span>
            </div>

            <div className="backend-required-status">
              <LockKeyhole size={19} />

              <span>
              <strong>Your records remain protected</strong>

              <small>
                Try again after the administrator completes the backend
                deployment.
              </small>
            </span>
            </div>
          </section>
        </main>
    );
  }

  return (
      <AppErrorBoundary>
        <BrainServeApp browserPreviewEnabled={browserPreviewEnabled} />
      </AppErrorBoundary>
  );
}
