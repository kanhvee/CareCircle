// POST {id, pass, action:'get'|'put', data?} -> passcode-protected shared profile
const { createHash } = require('crypto');
const { redis, enabled } = require('./_redis');
const h = (s) => createHash('sha256').update(String(s)).digest('hex');
module.exports = async (req, res) => {
  if (!enabled) return res.status(501).json({ error: 'No database configured' });
  const { id, pass, action, data } = req.body || {};
  if (!/^[a-z0-9-]{3,40}$/.test(id || '') || !pass) return res.status(400).json({ error: 'Bad request' });
  const raw = await redis(['GET', 'p:' + id]);
  const rec = raw ? JSON.parse(raw) : null;
  if (!rec) {
    if (action !== 'put') return res.status(404).json({ error: 'Not found' });
    await redis(['SET', 'p:' + id, JSON.stringify({ hash: h(pass), data })]);
    await redis(['SADD', 'profiles', id]);
    return res.json({ data });
  }
  if (rec.hash !== h(pass)) return res.status(401).json({ error: 'Wrong passcode' });
  if (action === 'put') {
    await redis(['SET', 'p:' + id, JSON.stringify({ hash: rec.hash, data })]);
    return res.json({ data });
  }
  res.json({ data: rec.data });
};
