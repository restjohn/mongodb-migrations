import { Db, MongoClientOptions } from 'mongodb';

export interface ReplicaSetMember {
  host: string;
  port?: number;
}

export interface ReplicaSetConfig {
  name: string;
  members: ReplicaSetMember[];
}

export interface Config {
  url?: string;
  user?: string;
  password?: string;
  host?: string;
  port?: number | string;
  db?: string;
  collection?: string;
  timeout?: number;
  ssl?: boolean;
  authDatabase?: string;
  replicaset?: ReplicaSetConfig;
  options?: MongoClientOptions;
  // Used by the CLI config file
  directory?: string;
}

export type MigrationId = string | number;

export type Direction = 'up' | 'down';

export interface MigrationContext {
  db: Db;
  log: (msg: string) => void;
}

// `done` is `any` because migrations commonly pass it straight to a MongoDB
// driver method as a node-style callback (which is invoked with `(err, result)`),
// as well as calling it directly as `done(err)`.
export type MigrationFn = (
  this: MigrationContext,
  done: (err?: any) => void
) => void;

export interface Migration {
  id: MigrationId;
  up?: MigrationFn;
  down?: MigrationFn;
}

export interface MigrationResult {
  status: 'ok' | 'skip' | 'error';
  reason?: string;
  code?: string;
  error?: Error;
}

export type ResultMap = { [id: string]: MigrationResult };

export type LogFn = ((src: string, ...args: unknown[]) => void) | null;

export type DoneCallback = (err?: Error | null, result?: ResultMap) => void;

export type ProgressCallback = (id: MigrationId, res: MigrationResult) => void;
