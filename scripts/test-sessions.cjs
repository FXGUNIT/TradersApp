const http = require('http');

function api(method, path, body, auth) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const headers = { 'Content-Type': 'application/json' };
    if (auth) headers['Authorization'] = 'Bearer ' + auth;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    const opts = { hostname: '127.0.0.1', port: 8788, path, method, headers, timeout: 5000 };
    const req = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: 'timeout' }); });
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  const r1 = await api('POST', '/admin/session', { password: 'TR@GODMODE2024', deviceFingerprint: 'tfp_test', deviceBrowser: 'TestBrowser', deviceOs: 'TestOS', deviceType: 'test', rememberDevice: false });
  console.log('r1 status:', r1.status, '| body:', r1.body);
  if (r1.status !== 200) {
    console.error('Session creation failed:', r1.body);
    return;
  }
  const parsed = JSON.parse(r1.body);
  if (!parsed.token) {
    console.error('No token in response:', parsed);
    return;
  }
  const token = parsed.token;
  console.log('Token:', token.substring(0, 12) + '...');

  const r2 = await api('GET', '/admin/sessions', null, token);
  console.log('List status:', r2.status, '| body:', r2.body);
  const sessions = JSON.parse(r2.body).sessions || [];
  console.log('Sessions:', sessions.length);
  sessions.forEach(s => console.log(' -', (s.id || '?').substring(0, 12) + '... |', s.device && s.device.browser, '| remembered:', s.device && s.device.rememberDevice));

  // Create extra sessions so we can test revoke (can't revoke the only session)
  for (let i = 0; i < 2; i++) {
    const extra = await api('POST', '/admin/session', { password: 'TR@GODMODE2024', deviceFingerprint: 'tfp_extra' + i, deviceBrowser: 'ExtraBrowser' + i, deviceOs: 'TestOS', deviceType: 'test', rememberDevice: true });
    console.log('Extra session', i, 'status:', extra.status);
  }

  // Refresh session list
  const r2b = await api('GET', '/admin/sessions', null, token);
  const allSessions = JSON.parse(r2b.body).sessions || [];
  console.log('\nAll sessions after adding extras:', allSessions.length);
  allSessions.forEach(s => console.log(' -', s.id + '... |', s.device && s.device.browser, '| remembered:', s.device && s.device.rememberDevice));

  if (allSessions.length > 1) {
    // Revoke an EXTRA session (not the one we're authenticated with)
    const extraSession = allSessions.find(s => s.device && s.device.fingerprint && s.device.fingerprint.startsWith('tfp_extra'));
    if (extraSession) {
      console.log('\nRevoking extra session by id:', extraSession.id + '...');
      const r3 = await api('DELETE', '/admin/sessions', { id: extraSession.id }, token);
      console.log('Revoke status:', r3.status, '| body:', r3.body);
      const r4 = await api('GET', '/admin/sessions', null, token);
      const remaining = JSON.parse(r4.body).sessions || [];
      console.log('After revoke:', remaining.length, 'sessions remaining (should be', allSessions.length - 1, ')');
    } else {
      console.log('\nNo extra session found to revoke');
    }
  }
}

main().catch(e => console.error('Error:', e.message));
