// Cron: emails missed doses + appointments in the next 24h to every member with an email.
const { redis, enabled } = require('./_redis');
module.exports = async (req, res) => {
  const s = process.env.CRON_SECRET;
  if (s && req.headers.authorization !== `Bearer ${s}` && req.query.key !== s) return res.status(401).end();
  if (!enabled || !process.env.RESEND_API_KEY) return res.status(501).json({ error: 'Set Upstash + RESEND_API_KEY' });
  let sent = 0;
  for (const id of (await redis(['SMEMBERS', 'profiles'])) || []) {
    const rec = JSON.parse(await redis(['GET', 'p:' + id]));
    const d = rec.data, tz = d.tz || 'Asia/Kolkata';
    const day = new Date().toLocaleDateString('en-CA', { timeZone: tz });
    const tom = new Date(Date.now() + 864e5).toLocaleDateString('en-CA', { timeZone: tz });
    const hm = new Date().toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
    const missed = [], dueSoon = [];
    for (const m of d.meds.filter((m) => !m.pending))
      for (const t of m.times) {
        if (d.log[`${day}|${m.id}|${t}`]) continue;
        (t < hm ? missed : dueSoon).push(`${m.name} ${m.dose || ''} at ${t}`);
      }
    const appts = d.appts.filter((a) => [day, tom].includes(a.dt.slice(0, 10))).map((a) => `${a.title} with ${a.doctor || 'doctor'} on ${a.dt.replace('T', ' ')}`);
    if (!missed.length && !appts.length && !dueSoon.length) continue;
    const li = (t, a) => (a.length ? `<h3>${t}</h3><ul>${a.map((x) => `<li>${x}</li>`).join('')}</ul>` : '');
    const html = `<h2>CareCircle update for ${d.name}</h2>${li('Missed medications', missed)}${li('Still due today', dueSoon)}${li('Upcoming appointments', appts)}`;
    const to = d.members.map((m) => m.email).filter(Boolean);
    if (!to.length) continue;
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.RESEND_FROM || 'CareCircle <onboarding@resend.dev>', to, subject: `CareCircle: update for ${d.name}`, html }),
    });
    sent++;
  }
  res.json({ sent });
};
