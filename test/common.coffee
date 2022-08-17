mm = require '../src/mongodb-migrations'
mongoConnect = require('../src/utils').connect
{ MongoMemoryServer } = require('mongodb-memory-server')

config =
  url: null
  db: '_mm'
  collection: '_migrations'
  timeout: 200

mongod = null

exports.before = () ->
  mongod = await MongoMemoryServer.create()
  config.url = mongod.getUri()

exports.beforeEach = (done) ->
  mongoConnect config, (err, client) ->
    if err
      console.error err
      throw err
    client.db().collection(config.collection).remove {}, ->
      migrator = new mm.Migrator config, null
      done { migrator, client, config }

exports.after = () ->
  await mongod.stop()