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

  it('should run migrations and stop on the first error', async () => {
    migrator.add({ id: '1', up: (cb) => cb(null) });
    migrator.add({ id: '2', up: (cb) => cb(null) });
    migrator.add({ id: '3', up: (cb) => cb(new Error('Some error')) });
    migrator.add({ id: '4', up: (cb) => cb(null) });
    return migrator.migrate((err, res) => {
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
    });
  });
});
