exports.id = 'test1';

exports.up = function (done) {
  const coll = this.db.collection('test');
  coll.insertOne({ name: 'tobi' }).then(() => done(), done);
};

exports.down = function (done) {
  const coll = this.db.collection('test');
  coll.deleteMany({}).then(() => done(), done);
};
