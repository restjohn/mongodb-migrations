import { expect } from 'chai';
import { Collection, MongoClient } from 'mongodb';
import * as testsCommon from './common';
import type { Migrator } from '../lib/mongodb-migrations'

describe('Migrations Collection', () => {
  let migrator: Migrator;
  let client: MongoClient;
  let coll: Collection;
  let migrationColl: Collection;

  before(() => {
    return testsCommon.before();
  });

  beforeEach(async () => {
    const resources = await testsCommon.beforeEach()
    migrator = resources.migrator;
    client = resources.client;
    migrationColl = client.db().collection(resources.config.collection!);
    coll = client.db().collection('test');
    return coll.deleteMany({});
  });

  afterEach(() => {
    return testsCommon.afterEach();
  });

  after(() => {
    return testsCommon.after();
  });

  it('should run migrations and only record them once', (done) => {
    migrator.add({
      id: 'm1',
      up: (cb) => coll.insertOne({ name: 'tobi' }, cb),
    });
    migrator.migrate((err) => {
      if (err) {
        return done(err);
      }
      coll
        .countDocuments({ name: 'tobi' })
        .then((count) => {
          expect(count).to.equal(1);
          return migrationColl.countDocuments({});
        })
        .then((count) => {
          expect(count).to.equal(1);

          // run again
          migrator.migrate((err) => {
            if (err) {
              return done(err);
            }
            coll
              .countDocuments({ name: 'tobi' })
              .then((count) => {
                expect(count).to.equal(1);
                return migrationColl.countDocuments({});
              })
              .then((count) => {
                // ensure that we didn't create the duplicate
                expect(count).to.equal(1);
                done();
              })
              .catch((err) => done(err));
          });
        })
        .catch((err) => done(err));
    });
  });
});
