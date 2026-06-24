import * as path from 'path';
import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import * as mm from '../lib/mongodb-migrations';
import { connect as mongoConnect } from '../lib/utils';
import { Config, LogFn } from '../lib/types';

// Read-only migration fixtures live in the test source tree, which is separate
// from the compiled test output directory (test-out).
export const fixturesDir = path.resolve(__dirname, '..', 'test', 'migrations');

export const config: Config = {
  url: undefined,
  db: '_mm',
  collection: '_migrations',
  timeout: 200,
};

let mongod: MongoMemoryServer;

// Track every resource handed out during a test so `afterEach` can release it.
// Open connections keep the event loop alive and would otherwise hang the
// process after the suite finishes.
const openClients: MongoClient[] = [];
const openMigrators: mm.Migrator[] = [];

export interface BeforeEachResult {
  migrator: mm.Migrator;
  client: MongoClient;
  config: Config;
}

export const before = async (): Promise<void> => {
  mongod = await MongoMemoryServer.create();
  config.url = mongod.getUri();
};

// Create a Migrator that is automatically disposed (and its connection closed)
// during `afterEach`.
export const createMigrator = (logFn: LogFn = null, cfg: Config = config): mm.Migrator => {
  const migrator = new mm.Migrator(cfg, logFn);
  openMigrators.push(migrator);
  return migrator;
};

export const beforeEach = async (): Promise<BeforeEachResult> => {
  try {
    const client = await mongoConnect(config)
    openClients.push(client!);
    await client.db().collection(config.collection!).deleteMany({})
    const migrator = createMigrator(null);
    return { migrator, client: client!, config };
  }
  catch(err) {
    console.error(err);
    throw err;
  }
};

const disposeMigrator = (migrator: mm.Migrator): Promise<void> =>
  new Promise((resolve) => {
    // `dispose`'s callback fires whether the underlying connection resolved or
    // failed, so this always settles.
    migrator.dispose(() => resolve());
  });

export const afterEach = async (): Promise<void> => {
  await Promise.all(openMigrators.splice(0).map(disposeMigrator));
  await Promise.all(openClients.splice(0).map((client) => client.close()));
};

export const after = async (): Promise<void> => {
  await mongod?.stop();
};
