import { expect } from 'chai';
import * as mm from '../lib/mongodb-migrations';
import { Config } from '../lib/types';
import * as testsCommon from './common';

describe('Migrator Dispose', () => {
  let config: Config;

  before(() => {
    return testsCommon.before();
  });

  beforeEach((done) => {
    testsCommon.beforeEach((res) => {
      config = res.config;
      done();
    });
  });

  after(() => {
    return testsCommon.after();
  });

  it('should be disposable', (done) => {
    const migrator = new mm.Migrator(config, null);
    const dir = testsCommon.fixturesDir;
    migrator.runFromDir(dir, (err) => {
      if (err) {
        return done(err);
      }
      migrator.dispose((err) => {
        if (err) {
          return done(err);
        }
        migrator.rollback((err) => {
          expect(err).to.exist;
          expect(err!.toString()).to.match(/disposed/);
          done();
        });
      });
    });
  });
});
