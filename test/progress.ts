import { expect } from 'chai';
import { Config, LogFn } from '../lib/types';
import * as testsCommon from './common';

describe('Migrator Progress Reporting', () => {
  let config: Config;

  before(() => {
    return testsCommon.before();
  });

  beforeEach(async () => {
    const resources = await testsCommon.beforeEach()
    config = resources.config;
  });

  afterEach(() => {
    return testsCommon.afterEach();
  });

  after(() => {
    return testsCommon.after();
  });

  it('should call back the progress parameter', (done) => {
    const messages: string[] = [];
    const log: LogFn = (level, message) => {
      if (level === 'user') {
        messages.push(message as string);
      }
    };

    const migrator = testsCommon.createMigrator(log);

    migrator.add({
      id: '1',
      up(cb) {
        this.log('1');
        cb();
      },
    });
    migrator.add({
      id: '2',
      up(cb) {
        this.log('2');
        cb();
      },
    });

    let resultsCount = 0;

    migrator.migrate(
      (err) => {
        if (err) {
          return done(err);
        }
      },
      (migrationId, migrationRes) => {
        const status = migrationRes?.status;
        if (status !== 'ok') {
          const message = `Error running ${migrationId}, result is ${status}`;
          return done(new Error(message));
        }
        resultsCount += 1;
        if (resultsCount === 2) {
          return done();
        }
      }
    );
  });
});
