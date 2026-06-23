#!/usr/bin/env node

// A CLI utility for mongodb-migrations

import * as fs from 'fs';
import * as path from 'path';
import './nomnom.d.ts'
import optparser = require('nomnom');
import _ from 'lodash';

import * as mm from '..';
import { connect } from '../lib/utils';
import { Config } from '../lib/types';

const Migrator = mm.Migrator;

const debug = !!process.env.DEBUG;

const defaults = {
  directory: 'migrations',
};

const dir = process.cwd();

let config: Config | null = null;

interface Opts {
  config?: string;
  _: string[];
}

const readConfig = (fileName?: string | null): void => {
  if (config) {
    return;
  }

  if (!fileName) {
    for (const ext of ['json', 'js']) {
      fileName = `mm-config.${ext}`;
      if (fs.existsSync(path.join(dir, fileName))) {
        break;
      }
      fileName = null;
    }
  }

  if (!fileName) {
    exit('Config file not specified, default not found');
  }

  try {
    fileName = path.join(dir, fileName as string);
    config = _.assign({}, defaults, require(fileName)) as Config;
  } catch (e) {
    exit(fileName + ' cannot be imported', e as Error);
  }
};

const cwd = (): string => path.join(dir, (config as Config).directory as string);

const createMigrator = (): mm.Migrator => new Migrator(config as Config);

const runMigrations = (opts: Opts): void => {
  readConfig(opts.config);
  createMigrator().runFromDir(cwd(), exit);
};

const createMigration = (opts: Opts): void => {
  readConfig(opts.config);
  const id = opts._.slice(1).join(' ');
  if (!id) {
    exit('Migration ID is required');
  }
  createMigrator().create(cwd(), id, exit);
};

const exit = (msg?: string | Error | null, err?: any): void => {
  if (msg) {
    console.error('Error: ' + msg);
    if (debug && err?.stack) {
      console.error(err.stack);
    }
    process.exit(1);
  }
  process.exit(0);
};

const dedupe = (opts: Opts): void => {
  readConfig(opts.config);
  connect(config as Config)
    .then((client) => {
      return client.db().collection((config as Config).collection as string);
    })
    .then((coll) => {
      console.log('Loading the list of migration records...');
      return coll
        .find({})
        .toArray()
        .then((docs) => {
          console.log(`Found total of ${docs.length} records. Detecting uniques`);
          const knownIds: { [id: string]: boolean } = {};
          const mongoIdsToRemove: unknown[] = [];
          let uniqueIds = 0;
          docs.forEach((d) => {
            if (knownIds[d.id]) {
              mongoIdsToRemove.push(d._id);
            } else {
              knownIds[d.id] = true;
              uniqueIds += 1;
            }
          });
          console.log(
            `Found ${uniqueIds} unique records. ${mongoIdsToRemove.length} to remove`
          );
          if (debug) {
            console.log(mongoIdsToRemove);
          }
          return mongoIdsToRemove;
        })
        .then((mongoIdsToRemove) => {
          return coll.deleteMany({ _id: { $in: mongoIdsToRemove } });
        });
    })
    .then(() => {
      console.log('Done');
      exit();
    })
    .catch((err: Error) => {
      exit(err.message, err);
    });
};

optparser.script('mm').option('config', {
  metavar: 'FILE',
  help: 'The name of the file in the current directory, can be .js or .json.',
});

optparser.command('migrate').callback(runMigrations);

optparser.nocommand().callback(runMigrations);

optparser.command('create').callback(createMigration);

optparser
  .command('dedupe')
  .help(
    'Remove duplicate entries from the migrations collection. Fixes the regression introduced by 0.8.0 and fixed in 0.8.2.'
  )
  .callback(dedupe);

optparser.parse();
