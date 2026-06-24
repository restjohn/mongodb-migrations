exports.id = 'test2';

exports.up = function (done) {
  const coll = this.db.collection('test');
  coll.insertOne({ name: 'loki' }).then(() => done(), done);
};
