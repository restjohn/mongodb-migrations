import { expect } from 'chai';
import { normalizeConfig } from '../lib/utils';
import { Config } from '../lib/types';

describe('Utils', () => {
  describe('normalizeConfig', () => {
    it('should throw without config', (done) => {
      expect(() => normalizeConfig(undefined as unknown as Config)).to.throw(
        '`config` is not provided or is not an object'
      );
      done();
    });

    it('should allow config with proper url', (done) => {
      const config: Config = {
        url: 'mongodb://aaa.bb.ccc:27101/some-db?ssl=true',
      };

      expect(normalizeConfig(config)).to.deep.equal(config);
      done();
    });

    it('should set default collection', (done) => {
      const config: Config = {
        url: 'mongodb://aaa.bb.ccc:27101/some-db?ssl=true',
      };

      expect(normalizeConfig(config).collection).to.equal('_migrations');
      done();
    });

    it('should throw with wrong replicaset 1', (done) => {
      expect(() => normalizeConfig({ replicaset: 7 } as unknown as Config)).to.throw(
        '`replicaset` is not an object'
      );
      done();
    });

    it('should throw with wrong replicaset 2', (done) => {
      expect(() => normalizeConfig({ replicaset: {} } as unknown as Config)).to.throw(
        '`replicaset.name` is not set'
      );
      done();
    });

    it('should throw with wrong replicaset 3', (done) => {
      expect(() =>
        normalizeConfig({ replicaset: { name: 'x' } } as unknown as Config)
      ).to.throw('`replicaset.members` is not set or is not an array');
      done();
    });

    it('should throw with wrong replicaset 4', (done) => {
      expect(() =>
        normalizeConfig({
          replicaset: { name: 'x', members: 'lol' },
        } as unknown as Config)
      ).to.throw('`replicaset.members` is not set or is not an array');
      done();
    });

    it('should throw with wrong replicaset 5', (done) => {
      expect(() =>
        normalizeConfig({
          replicaset: { name: 'x', members: [{ xost: 'x' }] },
        } as unknown as Config)
      ).to.throw('each of `replicaset.members` must have `host` set');
      done();
    });

    it('should throw without host and replicaset', (done) => {
      expect(() => normalizeConfig({} as unknown as Config)).to.throw(
        '`host` is required when `replicaset` is not set'
      );
      done();
    });

    it('should throw without db', (done) => {
      expect(() => normalizeConfig({ host: 'localhost' } as Config)).to.throw(
        '`db` is not set'
      );
      done();
    });

    it('should throw with password but without username', (done) => {
      expect(() =>
        normalizeConfig({
          host: 'localhost',
          db: '_mm',
          password: 'very secret password',
        } as Config)
      ).to.throw('`password` provided but `user` is not');
      done();
    });

    it('should throw with authDatabase but without username', (done) => {
      expect(() =>
        normalizeConfig({
          host: 'localhost',
          db: '_mm',
          authDatabase: 'admin',
        } as Config)
      ).to.throw('`authDatabase` provided but `user` is not');
      done();
    });
  });
});
