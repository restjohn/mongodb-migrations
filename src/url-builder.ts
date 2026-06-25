import { Config } from './types';

const buildHost = (opts: { host?: string; port?: number | string }): string => {
  let host = opts.host ?? '';
  if (opts.port) {
    host += ':' + opts.port;
  }
  return host;
};

export function buildMongoConnString(config: Config): string {
  if (config.url) {
    return config.url;
  }

  const hasUser = !!config.user;
  const { replicaset } = config;

  let s = 'mongodb://';

  if (hasUser) {
    s += config.user;
  }

  if (config.password) {
    if (!hasUser) {
      throw new Error('`password` provided but `user` is not');
    }
    s += ':' + config.password;
  }

  if (hasUser) {
    s += '@';
  }

  if (replicaset) {
    s += replicaset.members.map(buildHost).join(',');
  } else {
    s += buildHost(config);
  }

  s += '/';

  if (config.db) {
    s += config.db;
  }

  const params: string[] = [];

  if (replicaset) {
    params.push(`replicaSet=${replicaset.name}`);
  }

  if (config.ssl) {
    params.push('ssl=true');
  }

  if (config.authDatabase) {
    params.push(`authSource=${config.authDatabase}`);
  }

  if (params.length > 0) {
    s += '?' + params.join('&');
  }

  return s;
}
