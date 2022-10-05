path = require 'path'
mm = require '../src/mongodb-migrations'
testsCommon = require './common'

describe 'Migrator Rollback', ->
  migrator = null
  client = null
  coll = null

  before () ->
    testsCommon.before()

  beforeEach (done) ->
    testsCommon.beforeEach (res) ->
      {migrator, client} = res
      coll = client.db().collection 'test'
      coll.deleteMany {}, ->
        done()

  after () ->
    testsCommon.after()

  it 'should cleanup the migrations collection properly', (done) ->
    dir = path.join __dirname, 'migrations'
    migrationsCol = client.db().collection '_migrations'

    migrator.runFromDir dir, (err, res) ->
      return done(err) if err
      migrationsCol.countDocuments().then (count) ->
        count.should.be.equal 4
        migrator.rollback (err, res) ->
          return done(err) if err
          coll.countDocuments().then (count) ->
            count.should.be.equal 0

            migrationsCol.countDocuments().then (count) ->
              count.should.be.equal 0
              done()
