const U = process.env.UPSTASH_REDIS_REST_URL, T = process.env.UPSTASH_REDIS_REST_TOKEN;
exports.enabled = !!(U && T);
exports.redis = async (cmd) => {
  const r = await fetch(U, { method: 'POST', headers: { Authorization: `Bearer ${T}` }, body: JSON.stringify(cmd) });
  return (await r.json()).result;
};
