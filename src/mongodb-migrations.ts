import * as fs from 'fs';
import * as path from 'path';
import Promise from 'bluebird';
import _ from 'lodash';
import mkdirp from 'mkdirp';
import { MongoClient, Collection } from 'mongodb';
import { repeatString, connect as mongoConnect, normalizeConfig } from './utils';
import migrationStub = require('./migration-stub');
import {
  Config,
  Direction,
  DoneCallback,
  Migration,
  MigrationContext,
  MigrationId,
  MigrationResult,
  LogFn,
  ProgressCallback,
  ResultMap,
} from './types';

const defaultLog: LogFn = (src: string, ...args: unknown[]): void => {
  const pad = repeatString(' ', src === 'system' ? 4 : 2);
  console.log(pad, ...args);
};

interface LoadedMigration {
  number: number | null;
  module: Migration;
}

class Migrator {
  private _isDisposed: boolean;
  private _m: Migration[];
  private _result: ResultMap;
  private _dbReady: Promise<void>;
  private _client!: MongoClient;
  private _collName: string;
  private _timeout?: number;
  private _ranMigrations?: { [id: string]: boolean };
  private _lastDirection?: Direction;
  log: LogFn;

  constructor(dbConfig: Config, logFn?: LogFn) {
    // this will throw in case of invalid values
    dbConfig = normalizeConfig(dbConfig);

    this._isDisposed = false;
    this._m = [];
    this._result = {};

    this._dbReady = Promise.fromCallback<MongoClient>((cb) => {
      mongoConnect(dbConfig, cb);
    }).then((client) => {
      this._client = client;
    });

    this._collName = dbConfig.collection as string;
    this._timeout = dbConfig.timeout;

    if (logFn !== undefined) {
      this.log = logFn;
    } else {
      this.log = defaultLog;
    }
  }

  add(m: Migration): void {
    // m must be an { id, up, down } object
    this._m.push(m);
  }

  bulkAdd(array: Migration[]): void {
    // array must be an Array of { id, up, down } objects
    this._m = this._m.concat(array);
  }

  private _coll(): Collection {
    return this._client.db().collection(this._collName);
  }

  private _runWhenReady(
    direction: Direction,
    cb: DoneCallback,
    progress?: ProgressCallback
  ): void {
    if (this._isDisposed) {
      return cb(new Error('This migrator is disposed and cannot be used anymore'));
    }
    const onSuccess = () => {
      this._ranMigrations = {};
      this._coll()
        .find()
        .toArray((err, docs) => {
          if (err) {
            return cb(err);
          }
          for (const doc of docs ?? []) {
            this._ranMigrations![doc.id] = true;
          }
          this._run(direction, cb, progress);
        });
    };
    const onError = (err: Error) => cb(err);
    this._dbReady.then(onSuccess, onError);
  }

  private _run(direction: Direction, done: DoneCallback, progress?: ProgressCallback): void {
    let m: Migration[];
    if (direction === 'down') {
      m = _(this._m)
        .reverse()
        .filter((mig) => {
          const status = this._result[mig.id]?.status;
          return !!status && status !== 'skip';
        })
        .value();
    } else {
      direction = 'up';
      this._result = {};
      m = this._m;
    }
    this._lastDirection = direction;

    const logFn = this.log;
    const log = (src: string) => (msg: string) => {
      if (logFn) {
        logFn(src, msg);
      }
    };
    const userLog = log('user');
    const systemLog = log('system');

    let i = 0;
    const l = m.length;
    const migrationsCollection = this._coll();

    const migrationsCollectionUpdatePromises: Promise<unknown>[] = [];

    const handleMigrationDone = (id: MigrationId) => {
      const p =
        direction === 'up'
          ? Promise.fromCallback((cb) => migrationsCollection.insertOne({ id }, cb))
          : Promise.fromCallback((cb) => migrationsCollection.deleteMany({ id }, cb));
      migrationsCollectionUpdatePromises.push(p);
    };

    const allDone = (err?: Error | null) => {
      Promise.all(migrationsCollectionUpdatePromises).then(() => {
        done(err, this._result);
      });
    };

    const runOne = (): void => {
      if (i >= l) {
        return allDone();
      }
      const migration = m[i];
      i += 1;

      const migrationDone = (res: MigrationResult) => {
        this._result[migration.id] = res;
        _.defer(() => {
          progress?.(migration.id, res);
        });
        let msg = `Migration '${migration.id}': ${res.status}`;
        if (res.status === 'skip') {
          msg += ` (${res.reason})`;
        }
        systemLog(msg);
        if (res.status === 'error') {
          systemLog('  ' + res.error);
        }
        if (
          res.status === 'ok' ||
          (res.status === 'skip' && !!res.code && ['no_up', 'no_down'].includes(res.code))
        ) {
          handleMigrationDone(migration.id);
        }
      };

      const fn = migration[direction];
      const id = migration.id;

      let skipReason: string | null = null;
      let skipCode: string | null = null;
      if (!fn) {
        skipReason = `no migration function for direction ${direction}`;
        skipCode = `no_${direction}`;
      }
      if (direction === 'up' && id in this._ranMigrations!) {
        skipReason = 'migration already ran';
        skipCode = 'already_ran';
      }
      if (direction === 'down' && !(id in this._result)) {
        skipReason = "migration wasn't in the recent `migrate` run";
        skipCode = 'not_in_recent_migrate';
      }
      if (skipReason) {
        migrationDone({ status: 'skip', reason: skipReason, code: skipCode ?? undefined });
        return runOne();
      }

      let isCallbackCalled = false;
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      if (this._timeout) {
        timeoutId = setTimeout(() => {
          isCallbackCalled = true;
          const err = new Error('migration timed-out');
          migrationDone({ status: 'error', error: err });
          allDone(err);
        }, this._timeout);
      }

      const context: MigrationContext = { db: this._client.db(), log: userLog };
      fn!.call(context, (err?: Error | null) => {
        if (isCallbackCalled) {
          return;
        }
        clearTimeout(timeoutId);

        if (err) {
          migrationDone({ status: 'error', error: err });
          allDone(err);
        } else {
          migrationDone({ status: 'ok' });
          runOne();
        }
      });
    };

    runOne();
  }

  migrate(done: DoneCallback, progress?: ProgressCallback): void {
    this._runWhenReady('up', done, progress);
  }

  rollback(done: DoneCallback, progress?: ProgressCallback): void {
    if (this._lastDirection !== 'up') {
      return done(new Error('Rollback can only be ran after migrate'));
    }
    this._runWhenReady('down', done, progress);
  }

  private _loadMigrationFiles(
    dir: string,
    cb: (err: Error | null, files?: LoadedMigration[]) => void
  ): void {
    mkdirp(dir, 0o0774, (err) => {
      if (err) {
        return cb(err);
      }
      fs.readdir(dir, (err, files) => {
        if (err) {
          return cb(err);
        }
        const loaded = files
          .filter((f) => path.extname(f) === '.js' && !f.startsWith('.'))
          .map((f) => {
            const match = f.match(/^(\d+)/);
            const n = match ? parseInt(match[1], 10) : null;
            return { number: n, name: f };
          })
          .filter((f) => !!f.name)
          .sort((f1, f2) => (f1.number ?? 0) - (f2.number ?? 0))
          .map((f) => {
            const fileName = path.join(dir, f.name);
            return { number: f.number, module: require(fileName) as Migration };
          });
        cb(null, loaded);
      });
    });
  }

  runFromDir(dir: string, done: DoneCallback, progress?: ProgressCallback): void {
    this._loadMigrationFiles(dir, (err, files) => {
      if (err) {
        return done(err);
      }
      this.bulkAdd(_.map(files ?? [], 'module') as Migration[]);
      this.migrate(done, progress);
    });
  }

  create(dir: string, id: string, done: (err?: Error | null) => void): void {
    this._loadMigrationFiles(dir, (err, files) => {
      if (err) {
        return done(err);
      }
      const maxNum = _.maxBy(files ?? [], 'number')?.number ?? 0;
      const nextNum = maxNum + 1;
      const slug = (id || '').toLowerCase().replace(/\s+/, '-');
      const fileName = path.join(dir, `${nextNum}-${slug}.js`);
      const body = migrationStub(id);
      fs.writeFile(fileName, body, done);
    });
  }

  dispose(cb?: (err?: Error | null) => void): void {
    this._isDisposed = true;
    const onSuccess = () => {
      try {
        this._client.close();
        cb?.(null);
      } catch (e) {
        cb?.(e as Error);
      }
    };
    this._dbReady.then(onSuccess, cb);
  }
}

export { Migrator };
