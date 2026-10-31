import '@testing-library/jest-dom/vitest';

// jsdom lacks matchMedia; the landing page's reduced-motion check uses it.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

// jsdom does not implement IntersectionObserver; the landing page's reveal
// sections only need an inert observer in tests.
class FakeIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds: ReadonlyArray<number> = [];
  disconnect(): void {}
  observe(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  unobserve(): void {}
}
window.IntersectionObserver =
  window.IntersectionObserver ?? (FakeIntersectionObserver as unknown as typeof IntersectionObserver);
