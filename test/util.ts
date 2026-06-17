import { expect } from 'chai';
import { normalizeConfig } from '../lib/utils';
import { Config } from '../lib/types';

describe('Utils', function() {
  describe('normalizeConfig', function() {
    it('should throw without config', function() {
      expect(() => normalizeConfig(undefined as unknown as Config)).to.throw(
        '`config` is not provided or is not an object'
      );
    });

    it('should allow config with proper url', function() {
      const config: Config = {
        url: 'mongodb://aaa.bb.ccc:27101/some-db?ssl=true',
      };

      expect(normalizeConfig(config)).to.deep.equal(config);
    });

    it('should set default collection', function() {
      const config: Config = {
        url: 'mongodb://aaa.bb.ccc:27101/some-db?ssl=true',
      };

      expect(normalizeConfig(config).collection).to.equal('_migrations');
    });

    it('should throw with wrong replicaset 1', function() {
      expect(() => normalizeConfig({ replicaset: 7 } as unknown as Config)).to.throw(
        '`replicaset` is not an object'
      );
    });

    it('should throw with wrong replicaset 2', function() {
      expect(() => normalizeConfig({ replicaset: {} } as unknown as Config)).to.throw(
        '`replicaset.name` is not set'
      );
    });

    it('should throw with wrong replicaset 3', function() {
      expect(() =>
        normalizeConfig({ replicaset: { name: 'x' } } as unknown as Config)
      ).to.throw('`replicaset.members` is not set or is not an array');
    });

    it('should throw with wrong replicaset 4', function() {
      expect(() =>
        normalizeConfig({
          replicaset: { name: 'x', members: 'lol' },
        } as unknown as Config)
      ).to.throw('`replicaset.members` is not set or is not an array');
    });

    it('should throw with wrong replicaset 5', function() {
      expect(() =>
        normalizeConfig({
          replicaset: { name: 'x', members: [{ xost: 'x' }] },
        } as unknown as Config)
      ).to.throw('each of `replicaset.members` must have `host` set');
    });

    it('should throw without host and replicaset', function() {
      expect(() => normalizeConfig({} as unknown as Config)).to.throw(
        '`host` is required when `replicaset` is not set'
      );
    });

    it('should throw without db', function() {
      expect(() => normalizeConfig({ host: 'localhost' } as Config)).to.throw(
        '`db` is not set'
      );
    });

    it('should throw with password but without username', function() {
      expect(() =>
        normalizeConfig({
          host: 'localhost',
          db: '_mm',
          password: 'very secret password',
        } as Config)
      ).to.throw('`password` provided but `user` is not');
    });

    it('should throw with authDatabase but without username', function() {
      expect(() =>
        normalizeConfig({
          host: 'localhost',
          db: '_mm',
          authDatabase: 'admin',
        } as Config)
      ).to.throw('`authDatabase` provided but `user` is not');
    });
  });
});
