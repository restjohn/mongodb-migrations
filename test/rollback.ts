import { expect } from 'chai';
import { Collection, MongoClient } from 'mongodb';
import * as testsCommon from './common';

describe('Migrator Rollback', () => {
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

  after(() => {
    return testsCommon.after();
  });

  it('should cleanup the migrations collection properly', (done) => {
    const dir = testsCommon.fixturesDir;
    const migrationsCol = client.db().collection('_migrations');

    migrator.runFromDir(dir, (err) => {
      if (err) {
        return done(err);
      }
      migrationsCol
        .countDocuments()
        .then((count) => {
          expect(count).to.equal(3);
          migrator.rollback((err) => {
            if (err) {
              return done(err);
            }
            coll
              .countDocuments()
              .then((count) => {
                expect(count).to.equal(0);
                return migrationsCol.countDocuments();
              })
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
