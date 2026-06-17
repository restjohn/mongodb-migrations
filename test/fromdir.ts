import { expect } from 'chai';
import { Collection, MongoClient } from 'mongodb';
import * as testsCommon from './common';

describe('Migrator from Directory', () => {
  let migrator: import('../lib/mongodb-migrations').Migrator;
  let client: MongoClient;
  let coll: Collection;

  before(() => {
    return testsCommon.before();
  });

  beforeEach((done) => {
    testsCommon.beforeEach((res) => {
      migrator = res.migrator;
      client = res.client;
      coll = client.db().collection('test');
      coll.deleteMany({}, () => {
        done();
      });
    });
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
