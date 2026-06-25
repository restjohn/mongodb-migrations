import { expect } from 'chai';
import { Collection, MongoClient } from 'mongodb';
import * as testsCommon from './common';
import type { Migrator} from '../lib/mongodb-migrations'

describe('Migrator from Directory', () => {
  let migrator: Migrator;
  let client: MongoClient;
  let coll: Collection;

  before(() => {
    return testsCommon.before();
  });

  beforeEach(async () => {
    const resources = await testsCommon.beforeEach();
    migrator = resources.migrator
    client = resources.client
    coll = client.db().collection('test')
    return coll.deleteMany({})
  });

  afterEach(() => {
    return testsCommon.afterEach();
  });

  after(() => {
    return testsCommon.after();
  });

  it('should run migrations from directory', (done) => {
    migrator.runFromDir(testsCommon.fixturesDir, (err) => {
      if (err) {
        return done(err);
      }
      coll
        .countDocuments({ name: 'tobi' })
        .then((count) => {
          expect(count).to.equal(1);
          return coll.countDocuments({ name: 'loki' });
        })
        .then((count) => {
          expect(count).to.equal(1);
          return coll.countDocuments({ ok: 1 });
        })
        .then((count) => {
          expect(count).to.equal(2);
          migrator.rollback((err) => {
            if (err) {
              return done(err);
            }
            coll
              .countDocuments()
              .then((count) => {
                expect(count).to.equal(0);
                done();
              })
              .catch((err) => done(err));
          });
        })
        .catch((err) => done(err));
    });
  });
});
