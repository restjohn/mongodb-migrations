path = require 'path'
mm = require '../src/mongodb-migrations'
testsCommon = require './common'

describe 'Migrator from Directory', ->
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

  it 'should run migrations from directory', (done) ->
    dir = path.join __dirname, 'migrations'
    migrator.runFromDir dir, (err, res) ->
      return done(err) if err
      coll.find({name: 'tobi'}).count (err, count) ->
        return done(err) if err
        count.should.be.equal 1

        coll.find({name: 'loki'}).count (err, count) ->
          return done(err) if err
          count.should.be.equal 1

          coll.find({ok: 1}).count (err, count) ->
            return done(err) if err
            count.should.be.equal 3

            migrator.rollback (err, res) ->
              return done(err) if err
              coll.find().count (err, count) ->
                return done(err) if err
                count.should.be.equal 0
                done()
