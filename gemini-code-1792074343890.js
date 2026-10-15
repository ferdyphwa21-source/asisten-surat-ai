const crypto = require('crypto');

function generateCode(daysValid = 30, secretKey = process.env.SECRET_KEY || 'default-secret-key') {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomId = crypto.randomBytes(2).toString('hex').toUpperCase(); // 4 karakter
  const expireTimestamp = Date.now() + daysValid * 24 * 60 * 60 * 1000;
  
  const payload = `${dateStr}-${randomId}-${expireTimestamp}`;
  const hmac = crypto.createHmac('sha256', secretKey).update(payload).digest('hex').substring(0, 8).toUpperCase();
  
  return `SURAT-${payload}-${hmac}`;
}

function verifyCode(code, secretKey = process.env.SECRET_KEY || 'default-secret-key') {
  if (!code || !code.startsWith('SURAT-')) return { valid: false, reason: 'Format kode salah' };
  
  const parts = code.replace('SURAT-', '').split('-');
  if (parts.length !== 4) return { valid: false, reason: 'Format kode tidak valid' };
  
  const [dateStr, randomId, expireTimestampStr, hmac] = parts;
  const expireTimestamp = parseInt(expireTimestampStr, 10);
  
  const payload = `${dateStr}-${randomId}-${expireTimestampStr}`;
  const expectedHmac = crypto.createHmac('sha256', secretKey).update(payload).digest('hex').substring(0, 8).toUpperCase();
  
  if (hmac !== expectedHmac) return { valid: false, reason: 'Kode tidak valid/palsu' };
  if (Date.now() > expireTimestamp) return { valid: false, reason: 'Kode sudah kadaluwarsa' };
  
  return { valid: true, codeId: randomId, expiresAt: new Date(expireTimestamp) };
}

module.exports = { generateCode, verifyCode };