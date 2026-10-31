import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Express } from 'express';

export interface TestServer {
  url: string;
  close: () => Promise<void>;
}

/**
 * Binds the app to a real, listening server before any supertest call.
 * Supertest's agent path reads app.address() right after listen(0), which
 * races the async bind — a pre-listened server removes the race entirely.
 */
export async function startTestServer(app: Express): Promise<TestServer> {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}
