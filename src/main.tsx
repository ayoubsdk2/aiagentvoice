import { enforceSessionPersistencePolicy } from "./lib/session-persistence";
// Run BEFORE any module that touches the Supabase client (which reads
// localStorage for an existing session at import time).
enforceSessionPersistencePolicy();

// Initialize OpenTelemetry scaffold (no-op until VITE_OTEL_EXPORTER_OTLP_ENDPOINT is set).
import "./lib/observability";

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
