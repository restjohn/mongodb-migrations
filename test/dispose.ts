import { expect } from 'chai'
import { Config } from '../lib/types'
import * as testsCommon from './common'

describe('Migrator Dispose', () => {
  let config: Config;

  before(() => {
    return testsCommon.before();
  });

  beforeEach(async () => {
    const resources = await testsCommon.beforeEach();
    config = resources.config
  });

  afterEach(() => {
    return testsCommon.afterEach();
  });

  after(() => {
    return testsCommon.after();
  });

  it('should be disposable', (done) => {
    const migrator = testsCommon.createMigrator(null, config);
    migrator.runFromDir(testsCommon.fixturesDir, (err) => {
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
