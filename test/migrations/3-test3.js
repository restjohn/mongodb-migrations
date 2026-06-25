exports.id = 'test3';

exports.up = function (done) {
  const coll = this.db.collection('test');
  coll.updateMany({ name: { $in: ['loki', 'tobi'] } }, { $set: { ok: 1 } }, { multi: true }).then(() => done(), done);
};
