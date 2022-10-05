path = require 'path'
mm = require '../src/mongodb-migrations'
testsCommon = require './common'

describe 'Migrator Dispose', ->
  config = null

  before () ->
    testsCommon.before()

  beforeEach (done) ->
    testsCommon.beforeEach (res) ->
      { config } = res
      done()

  after () ->
    testsCommon.after()

  it 'should be disposable', (done) ->
    migrator = new mm.Migrator config, null
    dir = path.join __dirname, 'migrations'
    migrator.runFromDir dir, (err, res) ->
      return done(err) if err
      migrator.dispose (err) ->
        return done(err) if err
        migrator.rollback (err) ->
          (err?).should.be.ok()
          err.toString().should.match /disposed/
          done()
