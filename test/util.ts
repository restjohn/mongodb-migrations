{ normalizeConfig } = require '../src/utils'

describe 'Utils', ->

    describe 'normalizeConfig', ->
        it 'should throw without config', (done) ->
            normalizeConfig.should.throw('`config` is not provided or is not an object')
            done()

        it 'should allow config with proper url', (done) ->
          config =
            url: 'mongodb://aaa.bb.ccc:27101/some-db?ssl=true'

          normalizeConfig(config).should.be.deepEqual(config)
          done()

        it 'should set default collection', (done) ->
          config =
            url: 'mongodb://aaa.bb.ccc:27101/some-db?ssl=true'

          normalizeConfig(config).collection.should.be.equal('_migrations')
          done()

        it 'should throw with wrong replicaset 1', (done) ->
            normalizeConfig.bind(null, {
                replicaset: 7
            }).should.throw('`replicaset` is not an object')
            done()

        it 'should throw with wrong replicaset 2', (done) ->
            normalizeConfig.bind(null, {
                replicaset: {}
            }).should.throw('`replicaset.name` is not set')
            done()

        it 'should throw with wrong replicaset 3', (done) ->
            normalizeConfig.bind(null, {
                replicaset: {
                    name: 'x'
                }
            }).should.throw('`replicaset.members` is not set or is not an array')
            done()

        it 'should throw with wrong replicaset 4', (done) ->
            normalizeConfig.bind(null, {
                replicaset: {
                    name: 'x',
                    members: 'lol'
                }
            }).should.throw('`replicaset.members` is not set or is not an array')
            done()

        it 'should throw with wrong replicaset 5', (done) ->
            normalizeConfig.bind(null, {
                replicaset: {
                    name: 'x',
                    members: [{ xost: 'x' }]
                }
            }).should.throw('each of `replicaset.members` must have `host` set')
            done()

        it 'should throw without host and replicaset', (done) ->
            normalizeConfig.bind(null, {
            }).should.throw('`host` is required when `replicaset` is not set')
            done()

        it 'should throw without db', (done) ->
            normalizeConfig.bind(null, {
                host: 'localhost'
            }).should.throw('`db` is not set')
            done()

        it 'should throw with password but without username', (done) ->
            normalizeConfig.bind(null, {
                host: 'localhost',
                db: '_mm',
                password: 'very secret password'
            }).should.throw('`password` provided but `user` is not')
            done()

        it 'should throw with authDatabase but without username', (done) ->
            normalizeConfig.bind(null, {
                host: 'localhost',
                db: '_mm',
                authDatabase: 'admin'
            }).should.throw('`authDatabase` provided but `user` is not')
            done()
