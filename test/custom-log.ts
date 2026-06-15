import { expect } from 'chai';
import * as mm from '../lib/mongodb-migrations';
import { Config, LogFn } from '../lib/types';
import * as testsCommon from './common';

describe('Migrator Logging', () => {
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

  it('should allow custom logging', (done) => {
    const messages: string[] = [];
    const log: LogFn = (level, message) => {
      if (level === 'user') {
        messages.push(message as string);
      }
    };

    const migrator = new mm.Migrator(config, log);

    migrator.add({
      id: '1',
      up(cb) {
        this.log('1');
        this.log('2');
        cb();
      },
    });
    migrator.migrate((err, res) => {
      if (err) {
        return done(err);
      }
      expect(res!['1']).to.be.ok;
      expect(messages).to.have.lengthOf(2);
      expect(messages[0]).to.equal('1');
      expect(messages[1]).to.equal('2');
      done();
    });
  });
});
