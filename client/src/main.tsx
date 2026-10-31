import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { ToastProvider } from './components/ui/Toaster';
import { router } from './App';
import './index.css';

// Android hardware back button: navigate in-app when possible, otherwise let
// the app minimize. Only active inside the native shell (no-op on web).
void (async () => {
  const cap = (window as unknown as { Capacitor?: { isNativePlatform: () => boolean } }).Capacitor;
  if (!/android/i.test(navigator.userAgent) || !cap?.isNativePlatform()) return;
  const { App } = await import('@capacitor/app');
  App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) window.history.back();
    else App.exitApp();
  });
})();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
