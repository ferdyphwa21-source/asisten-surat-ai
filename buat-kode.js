const { generateCode } = require('./kode.js');

const days = parseInt(process.argv[2], 10) || 30;
const count = parseInt(process.argv[3], 10) || 1;
const secretKey = process.env.SECRET_KEY || 'default-secret-key';

console.log(`--- Menghasilkan ${count} Kode Premium (${days} Hari) ---`);
for (let i = 0; i < count; i++) {
  console.log(generateCode(days, secretKey));
}