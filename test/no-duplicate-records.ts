import { expect } from 'chai';
import { Collection, MongoClient } from 'mongodb';
import * as testsCommon from './common';

describe('Migrations Collection', () => {
  let migrator: import('../lib/mongodb-migrations').Migrator;
  let client: MongoClient;
  let coll: Collection;
  let migrationColl: Collection;

  before(() => {
    return testsCommon.before();
  });

  beforeEach((done) => {
    testsCommon.beforeEach((res) => {
      migrator = res.migrator;
      client = res.client;
      migrationColl = client.db().collection(res.config.collection!);
      coll = client.db().collection('test');
      coll.deleteMany({}, () => {
        done();
      });
    });
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
