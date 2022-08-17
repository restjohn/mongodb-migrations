mm = require '../src/mongodb-migrations'
testsCommon = require './common'

describe 'Migrations Collection', ->
  migrator = null
  client = null
  coll = null
  migrationColl = null

  before () ->
    testsCommon.before()

  beforeEach (done) ->
    testsCommon.beforeEach (res) ->
      {migrator, client, config} = res
      migrationColl = client.db().collection(config.collection)
      coll = client.db().collection 'test'
      coll.deleteMany {}, ->
        done()

  after () ->
    testsCommon.after()

  it 'should run migrations and only record them once', (done) ->
    migrator.add
      id: 'm1'
      up: (cb) ->
        coll.insertOne name: 'tobi', cb
    migrator.migrate (err, res) ->
      return done(err) if err
      coll.countDocuments({name: 'tobi'}).then (count) ->
        count.should.be.equal 1
        migrationColl.countDocuments({}).then (count) ->
          count.should.be.equal 1

          # run again
          migrator.migrate (err, res) ->
            return done(err) if err
            coll.countDocuments({name: 'tobi'}).then (count) ->
              count.should.be.equal 1
              migrationColl.countDocuments({}).then (count) ->
                # ensure that we didn't create the duplicate
                count.should.be.equal 1
                done()
