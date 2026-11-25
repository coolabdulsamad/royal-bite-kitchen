import "@/lib/logger";
import "@/lib/apiAuth";
import { isNativeApp } from "@/lib/apiAuth";
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import { TRPCProvider } from "@/providers/trpc"
import { AuthProvider } from "@/lib/auth"
import App from './App.tsx'

// App-shell caching for the installed web app (PWA). Skipped in the Android
// shell — Capacitor serves the bundle from the device already.
if (import.meta.env.PROD && !isNativeApp() && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <TRPCProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </TRPCProvider>
    </BrowserRouter>
  </StrictMode>,
)
