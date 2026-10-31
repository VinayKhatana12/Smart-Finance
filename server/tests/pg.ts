import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import EmbeddedPostgres from 'embedded-postgres';

export interface TestDatabase {
  url: string;
  stop: () => Promise<void>;
}

async function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.listen(0, '127.0.0.1', () => {
      const port = (probe.address() as AddressInfo).port;
      probe.close(() => resolve(port));
    });
  });
}

/**
 * A private PostgreSQL instance for the integration tests.
 *
 * - If TEST_DATABASE_URL is set, that database is used as-is (CI / local server).
 * - Otherwise an embedded Postgres (matching the app's PG18 line) is started on a
 *   scratch data directory with its own credentials, so the suite needs no setup.
 */
export async function startTestDatabase(): Promise<TestDatabase> {
  const external = process.env.TEST_DATABASE_URL;
  if (external) {
    return { url: external, stop: async () => undefined };
  }

  const port = await freePort();
  // A unique directory per call: suites run sequentially in the same process
  // pool, and Windows keeps the previous instance's files locked for a moment.
  const databaseDir = path.join(os.tmpdir(), `smartfinance-test-pg-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  const pg = new EmbeddedPostgres({
    databaseDir,
    user: 'sf_test',
    password: 'sf_test',
    port,
    persistent: false,
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('smartfinance_test');

  return {
    url: `postgres://sf_test:sf_test@127.0.0.1:${port}/smartfinance_test`,
    stop: async () => {
      // With persistent:false the library deletes its own data dir on stop; on
      // Windows that rmdir can race a lingering file lock. Postgres has exited
      // either way, so a failed cleanup must never fail the suite.
      try {
        await pg.stop();
      } catch {
        /* cleanup raced the OS; the instance itself is down */
      }
      try {
        fs.rmSync(databaseDir, { recursive: true, force: true });
      } catch {
        /* the OS clears the temp dir */
      }
    },
  };
}
