import { expect } from 'chai';
import * as path from 'path';
import * as fs from 'fs';
import rimraf from 'rimraf';
import * as testsCommon from './common';

describe('Migrations Builder', () => {
  let migrator: import('../lib/mongodb-migrations').Migrator;
  const dir = path.join(__dirname, 'created-migrations');

  before(() => {
    return testsCommon.before();
  });

  beforeEach((done) => {
    testsCommon.beforeEach((res) => {
      migrator = res.migrator;
      rimraf(dir, done);
    });
  });

  after(() => {
    return testsCommon.after();
  });

  it('should create migration stubs for JS', (done) => {
    migrator.create(dir, 'test1', (err) => {
      if (err) {
        return done(err);
      }
      expect(fs.existsSync(path.join(dir, '1-test1.js'))).to.be.true;
      migrator.create(dir, 'test2', (err) => {
        if (err) {
          return done(err);
        }
        expect(fs.existsSync(path.join(dir, '2-test2.js'))).to.be.true;
        done();
      });
    });
  });
});
