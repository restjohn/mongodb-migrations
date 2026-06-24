import * as fs from 'fs/promises'
import _ from 'lodash'
import { mkdirpNative as mkdirp } from 'mkdirp'
import { MongoClient } from 'mongodb'
import * as path from 'path'
import {
  Config,
  Direction,
  DoneCallback,
  LogFn,
  Migration,
  MigrationId,
  MigrationResult,
  ProgressCallback,
  ResultMap,
} from './types'
import { connect as mongoConnect, normalizeConfig, repeatString } from './utils'
import migrationStub = require('./migration-stub')

const defaultLog: LogFn = (src: string, ...args: unknown[]): void => {
  const pad = repeatString(' ', src === 'system' ? 4 : 2)
  console.log(pad, ...args)
}

interface LoadedMigration {
  number: number | null;
  module: Migration;
}

class Migrator {

  readonly log: LogFn

  private readonly _collName: string
  private readonly _timeout?: number
  private readonly _dbReady: Promise<MongoClient>
  private _isDisposed: boolean = false
  private _steps: Migration[] = []
  private _result: ResultMap = {}
  private _ranMigrations: { [id: string]: boolean } = {}
  private _lastDirection?: Direction

  constructor(dbConfig: Config, logFn?: LogFn) {
    // this will throw in case of invalid values
    dbConfig = normalizeConfig(dbConfig)
    this._collName = dbConfig.collection as string
    this._timeout = dbConfig.timeout
    if (logFn !== undefined) {
      this.log = logFn
    } else {
      this.log = defaultLog
    }
    this._dbReady = mongoConnect(dbConfig)
  }

  add(m: Migration): void {
    this._steps.push(m)
  }

  bulkAdd(array: Migration[]): void {
    this._steps = this._steps.concat(array)
  }

  private async _runWhenReady(
    direction: Direction,
    progress?: ProgressCallback
  ): Promise<void> {
    if (this._isDisposed) {
      throw new Error('This migrator is disposed and cannot be used anymore')
    }

    this._lastDirection = direction
    const steps = direction === 'down' ? this._steps.slice().reverse() : this._steps.slice()
    const logFn = this.log
    const log = (src: string) => (msg: string) => {
      if (logFn) {
        logFn(src, msg)
      }
    }
    const userLog = log('user')
    const systemLog = log('system')
    const db = await this._dbReady.then(x => x.db())
    const migrationsCollection = db.collection(this._collName)

    const recordMigration = direction === 'down' ?
      async (id: MigrationId): Promise<unknown> => migrationsCollection.deleteMany({ id }) :
      async (id: MigrationId): Promise<unknown> => migrationsCollection.insertOne({ id })

    const pastMigrations = await migrationsCollection.find().toArray()
    for (const pastMigration of pastMigrations ?? []) {
      this._ranMigrations[pastMigration.id] = true
    }

    const runStep = async (migration: Migration): Promise<MigrationResult> => {
      systemLog('running migration ' + migration.id)
      const fn = migration[direction]
      const id = migration.id
      if (!fn) {
        return { status: 'skip', reason: `no ${direction} migration function`, code: `no_${direction}` }
      }
      if (direction === 'up' && id in this._ranMigrations) {
        return { status: 'skip', reason: 'migration already ran', code: 'already_ran' }
      }
      if (direction === 'down') {
        if (!this._result[id]) {
          return { status: 'skip', reason: 'migration absent from recent migrate', code: 'not_in_recent_migrate' }
        }
        else if (this._result[id].status === 'skip') {
          return { status: 'skip', reason: 'migration skipped in recent migrate', code: 'not_in_recent_migrate' }
        }
      }
      return new Promise<MigrationResult>((resolve, reject) => {
        const timeoutId = setTimeout(async () => {
          if (this._timeout) {
            // error only if a timeout was actually specified
            resolve({ status: 'error', error: Error('migration timeout') })
          }
        }, this._timeout || 0)
        const context = { db, log: userLog }
        fn.call(context, (error?: Error | null) => {
          clearTimeout(timeoutId)
          if (error) {
            systemLog(`migration error - ${migration.id}: ` + String(error))
            resolve({ status: 'error', error })
          } else {
            resolve({ status: 'ok' })
          }
        })
      })
    }

    while (steps.length > 0) {
      const step = steps.shift()!
      const stepResult = await runStep(step)
      this._result[step.id] = stepResult
      const stepMessage = `Migration '${step.id}': ${stepResult.status}` +
        (stepResult.status === 'skip' ? ` (${stepResult.reason})` : '') +
        (stepResult.error ? String(stepResult.error) : '')
      systemLog(stepMessage)
      if (stepResult.error) {
        throw stepResult.error;
      }
      if (
        stepResult.status === 'ok' ||
        (stepResult.status === 'skip' && [ 'no_up', 'no_down' ].includes(stepResult.code || ''))
      ) {
        /*
         TODO: only recording the migration on successful completion could be a logical hole.  even if an error
         occurred during a migration step, the step could have made modifications to the database.  not recording
         the migration will leave the migration step out of the next rollback, inhibiting the step from undoing any
         partial modifications.
         */
        await recordMigration(step.id)
      }
      // TODO: remove lodash call
      _.defer(() => {
        progress?.(step.id, stepResult)
      })
    }
  }

  async migrate(done: DoneCallback, progress?: ProgressCallback): Promise<void> {
    try {
      this._result = {}
      await this._runWhenReady('up', progress)
      done(null, this._result)
    } catch (err) {
      done(err as Error, this._result)
    }
  }

  /**
   * TODO: This method currently has no path of invocation from the CLI.  Further, this requires
   * `_lastMigration` to equal `'up'`, and the migrations to rollback must already have an entry in this migrator's
   * `_result` dictionary, i.e., this migrator must have already run a forward migration in order to run a
   * rollback, so running a rollback from the CLI is impossible without modification.  The rollback logic always rolls
   * back all migrations that this migrator ran, instead of one at a time.  This rollback functionality needs much
   * improvement.
   */
  async rollback(done: DoneCallback, progress?: ProgressCallback): Promise<void> {
    if (this._lastDirection !== 'up') {
      return done(new Error('Rollback can only be ran after migrate'))
    }
    try {
      await this._runWhenReady('down', progress)
      done(null, this._result)
    } catch (err) {
      done(err as Error)
    }
  }

  private async _loadMigrationFiles(dir: string): Promise<LoadedMigration[]> {
    await mkdirp(dir, 0o0774)
    const files = await fs.readdir(dir)
    return files
      .filter((f) => path.extname(f) === '.js' && !f.startsWith('.'))
      .map((f) => {
        const match = f.match(/^(\d+)/)
        const n = match ? parseInt(match[1], 10) : null
        return { number: n, name: f }
      })
      .filter((f) => !!f.name)
      .sort((f1, f2) => (f1.number ?? 0) - (f2.number ?? 0))
      .map((f) => {
        const fileName = path.join(dir, f.name)
        return { number: f.number, module: require(fileName) as Migration }
      })
  }

  runFromDir(dir: string, done: DoneCallback, progress?: ProgressCallback): void {
    this._loadMigrationFiles(dir)
      .then(loadedMigrations => {
        this.bulkAdd(loadedMigrations.map(x => x.module) as Migration[])
        this.migrate(done, progress)
      })
      .catch(err => done(err as Error, this._result))
  }

  create(dir: string, id: string, done: (err?: Error | null) => void): void {
    this._loadMigrationFiles(dir)
      .then(loadedMigrations => {
        const maxNum = _.maxBy(loadedMigrations ?? [], 'number')?.number ?? 0
        const nextNum = maxNum + 1
        const slug = (id || '').toLowerCase().replace(/\s+/, '-')
        const fileName = path.join(dir, `${nextNum}-${slug}.js`)
        const body = migrationStub(id)
        return fs.writeFile(fileName, body)
      })
      .then(() => done(null))
      .catch(err => done(err as Error))
  }

  async dispose(cb?: (err?: Error | null) => void): Promise<void> {
    this._isDisposed = true
    try {
      await this._dbReady.then(x => x.close())
    } catch (err) {
      return void (cb?.(err as Error))
    }
    cb?.(null)
  }
}

export { Migrator }
