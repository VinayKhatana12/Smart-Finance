import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor configuration for the Smart Finance Android app.
 *
 * The web assets come from `dist` (the same Vite build as the web app).
 * The API base URL is baked into the bundle at build time via Vite modes:
 *   web dev/prod:  same-origin `/api/v1` (Vite proxy / reverse proxy)
 *   android:       `vite build --mode capacitor` reads `.env.capacitor`
 *                  which must set VITE_API_URL to the deployed HTTPS backend.
 */
const config: CapacitorConfig = {
  appId: 'com.smartfinance.app',
  appName: 'Smart Finance',
  webDir: 'dist',
  android: {
    // The WebView may not be visible behind system bars on notched devices.
    adjustMarginsForEdgeToEdge: 'auto',
  },
  server: {
    // Never ship a live-reload configuration in release builds.
    androidScheme: 'https',
  },
};

export default config;
