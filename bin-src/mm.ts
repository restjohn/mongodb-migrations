#!/usr/bin/env node

// A CLI utility for mongodb-migrations

import * as fs from 'fs';
import * as path from 'path';
import { program as cli, Command } from 'commander';
import * as mm from '..';
import { connect } from '../lib/utils';
import { Config } from '../lib/types';

const Migrator = mm.Migrator;

const debug = !!process.env.DEBUG;

const defaults = {
  directory: 'migrations',
};

const dir = process.cwd();

interface BaseOptions {
  config: Config;
}

const readConfig = (fileName?: string | null): Config => {
  if (!fileName) {
    for (const ext of ['json', 'js']) {
      fileName = `mm-config.${ext}`;
      if (fs.existsSync(path.join(dir, fileName))) {
        break;
      }
      fileName = null;
    }
  }
  try {
    fileName = path.join(dir, fileName as string);
    console.log('loading config', fileName);
    return Object.assign({}, defaults, require(fileName)) as Config;
  } catch (e) {
    return exit(fileName + ' cannot be imported', e as Error);
  }
};

const cwd = (config: Config): string => path.join(dir, config.directory as string);

const createMigrator = (config: Config): mm.Migrator => new Migrator(config);

const runMigrations = function(opts: BaseOptions): void {
  console.log('parsed options:', opts)
  createMigrator(opts.config).runFromDir(cwd(opts.config), exit);
};

const createMigration = function(id: string, opts: BaseOptions): void {
  if (!id) {
    exit('Migration ID is required');
  }
  createMigrator(opts.config).create(cwd(opts.config), id, exit);
};

const exit = (msg?: string | Error | null, err?: any): never => {
  if (msg) {
    console.error('Error: ' + msg);
    if (debug && err?.stack) {
      console.error(err.stack);
    }
    process.exit(1);
  }
  process.exit(0);
};

const dedupe = (opts: BaseOptions): void => {
  const { config } = opts;
  connect(config)
    .then((client) => {
      return client.db().collection(config.collection as string);
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

function withGlobalOptions(action: (...args: any[]) => any): (this: Command, ...args: any[]) => any {
  return function() {
    const opts = this.optsWithGlobals()
    if (typeof opts.config !== 'string') {
      return exit('Config file not specified, default not found');
    }
    const { config: configPath } = opts;
    const config = readConfig(configPath)
    action(...this.processedArgs, { config })
  }
}

cli.name('mm')
  .configureHelp({ showGlobalOptions: true })
  .option('--config <file>', 'The name of the file in the current directory; can be .js or .json.  Look for mm-config.js, mm-config.json if unspecified.')

cli.command('migrate', { isDefault: true })
  .description('Apply all migrations that have not yet run.')
  .action(withGlobalOptions(runMigrations));

cli.command('create')
  .description('Create a new migration script.')
  .argument('<migration_id>', '')
  .action(withGlobalOptions(createMigration));

cli
  .command('dedupe')
  .description('Remove duplicate entries from the migrations collection. Fixes the regression introduced by 0.8.0 and fixed in 0.8.2.')
  .action(withGlobalOptions(dedupe));

cli.parse();
