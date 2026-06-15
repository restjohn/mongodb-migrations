import * as path from 'path';
import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import * as mm from '../lib/mongodb-migrations';
import { connect as mongoConnect } from '../lib/utils';
import { Config } from '../lib/types';

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

export interface BeforeEachResult {
  migrator: mm.Migrator;
  client: MongoClient;
  config: Config;
}

export const before = async (): Promise<void> => {
  mongod = await MongoMemoryServer.create();
  config.url = mongod.getUri();
};

export const beforeEach = (done: (res: BeforeEachResult) => void): void => {
  mongoConnect(config, (err, client) => {
    if (err) {
      console.error(err);
      throw err;
    }
    client!
      .db()
      .collection(config.collection!)
      .deleteMany({}, () => {
        const migrator = new mm.Migrator(config, null);
        done({ migrator, client: client!, config });
      });
  });
};

export const after = async (): Promise<void> => {
  await mongod.stop();
};
