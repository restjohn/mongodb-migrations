import { expect } from 'chai';
import { Collection, MongoClient } from 'mongodb';
import * as mm from '../lib/mongodb-migrations';
import * as testsCommon from './common';

describe('Migrator', () => {
  let migrator: mm.Migrator;
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

  it('should exist', (done) => {
    expect(migrator).to.be.ok;
    expect(client.db()).to.be.ok;
    done();
  });

  it('should set default migrations collection', (done) => {
    const config1 = {
      host: 'localhost',
      port: 27017,
      db: '_mm',
    };
    const m1 = new mm.Migrator(config1, null);
    expect((m1 as any)._collName).to.equal('_migrations');
    const config2 = {
      host: 'localhost',
      port: 27017,
      db: '_mm',
      collection: '_custom',
    };
    const m2 = new mm.Migrator(config2, null);
    expect((m2 as any)._collName).to.equal('_custom');
    done();
  });

  it('should run migrations and return result', (done) => {
    migrator.add({
      id: '1',
      up: (cb) => coll.insertOne({ name: 'tobi' }, cb),
    });
    migrator.migrate((err, res) => {
      if (err) {
        return done(err);
      }
      expect(res).to.be.ok;
      expect(res!['1']).to.be.ok;
      expect(res!['1'].status).to.equal('ok');
      coll
        .countDocuments({ name: 'tobi' })
        .then((count) => {
          expect(count).to.equal(1);
          done();
        })
        .catch((err) => done(err));
    });
  });

  it('should timeout migration and return error', (done) => {
    migrator.add({
      id: '1',
      up: (cb) => {
        setTimeout(cb, 300);
      },
    });
    migrator.migrate((err) => {
      if (!err) {
        return done(new Error('migration should have failed'));
      }
      expect(err.message).to.equal('migration timed-out');
      done();
    });
  });

  it('should allow rollback', (done) => {
    migrator.add({
      id: 1,
      up: (cb) => coll.insertOne({ name: 'tobi' }, cb),
      down: (cb) =>
        coll.updateMany({ name: 'tobi' }, { $set: { name: 'loki' } }, cb),
    });
    migrator.migrate((err) => {
      if (err) {
        return done(err);
      }
      migrator.rollback((err) => {
        if (err) {
          return done(err);
        }
        coll
          .countDocuments({ name: 'tobi' })
          .then((count) => {
            expect(count).to.equal(0);
            return coll.countDocuments({ name: 'loki' });
          })
          .then((count) => {
            expect(count).to.equal(1);
            done();
          })
          .catch((err) => done(err));
      });
    });
  });

  it('should skip on consequent runs', (done) => {
    migrator.add({
      id: 1,
      up: (cb) => coll.insertOne({ name: 'tobi' }, cb),
      down: (cb) =>
        coll.updateMany({ name: 'tobi' }, { $set: { name: 'loki' } }, cb),
    });
    migrator.migrate((err, res) => {
      if (err) {
        return done(err);
      }
      expect(res!['1']).to.be.ok;
      expect(res!['1'].status).to.equal('ok');
      migrator.migrate((err, res) => {
        if (err) {
          return done(err);
        }
        expect(res!['1']).to.be.ok;
        expect(res!['1'].status).to.equal('skip');
        done();
      });
    });
  });
});
