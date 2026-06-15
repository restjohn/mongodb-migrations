import { MongoClient } from 'mongodb';
import _ from 'lodash';
import * as urlBuilder from './url-builder';
import { Config } from './types';

const DEFAULT_COLLECTION = '_migrations';

export type ConnectCallback = (err?: Error, client?: MongoClient) => void;

const validateConnSettings = (config: Config): void => {
  if (config.url) {
    return;
  }

  const { replicaset } = config;
  if (!replicaset) {
    if (!config.host) {
      throw new Error('`host` is required when `replicaset` is not set');
    }
  } else {
    if (!(_.isObject(replicaset) && !_.isArray(replicaset))) {
      throw new Error('`replicaset` is not an object');
    }
    if (!replicaset.name) {
      throw new Error('`replicaset.name` is not set');
    }
    if (!_.isArray(replicaset.members)) {
      throw new Error('`replicaset.members` is not set or is not an array');
    }
    replicaset.members.forEach((m) => {
      if (!m?.host) {
        throw new Error('each of `replicaset.members` must have `host` set');
      }
    });
  }

  if (!config.db) {
    throw new Error('`db` is not set');
  }

  if (config.password && !config.user) {
    throw new Error('`password` provided but `user` is not');
  }

  if (config.authDatabase && !config.user) {
    throw new Error('`authDatabase` provided but `user` is not');
  }
};

export function normalizeConfig(config: Config): Config {
  if (!(_.isObject(config) && !_.isArray(config))) {
    throw new Error('`config` is not provided or is not an object');
  }

  _.defaults(config, {
    collection: DEFAULT_COLLECTION,
  });

  validateConnSettings(config);

  return config;
}

export function connect(config: Config, cb: ConnectCallback): void {
  const options = config.options ?? {};
  const url = urlBuilder.buildMongoConnString(config);
  MongoClient.connect(url, options, cb);
}

export function repeatString(str: string, n: number): string {
  return Array(n + 1).join(str);
}
