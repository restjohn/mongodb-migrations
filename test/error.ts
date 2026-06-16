import { expect } from 'chai';
import { Collection, MongoClient } from 'mongodb';
import * as testsCommon from './common';

describe('Migrator Errors Handling', () => {
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

  it('should run migrations and stop on the first error', (done) => {
    migrator.add({ id: '1', up: (cb) => cb(null) });
    migrator.add({ id: '2', up: (cb) => cb(null) });
    migrator.add({ id: '3', up: (cb) => cb(new Error('Some error')) });
    migrator.add({ id: '4', up: (cb) => cb(null) });
    migrator.migrate((err, res) => {
      expect(err!.toString()).to.match(/Some error$/);

      expect(res).to.be.ok;

      expect(res!['1']).to.be.ok;
      expect(res!['1'].status).to.equal('ok');

      expect(res!['2']).to.be.ok;
      expect(res!['2'].status).to.equal('ok');

      expect(res!['3']).to.be.ok;
      expect(res!['3'].status).to.equal('error');
      expect(res!['3'].error!.toString()).to.match(/Some error$/);

      expect(res!['4']).to.be.undefined;

      done();
    });
  });
});
