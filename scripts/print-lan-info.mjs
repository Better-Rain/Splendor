import os from 'node:os';

function getLanAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const [name, entries] of Object.entries(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family !== 'IPv4' || entry.internal) {
        continue;
      }

      if (entry.address.startsWith('169.254.')) {
        continue;
      }

      addresses.push({ name, address: entry.address });
    }
  }

  return addresses;
}

const addresses = getLanAddresses();

console.log('');
console.log('LAN test URLs');
console.log('-------------');

if (addresses.length === 0) {
  console.log('No LAN IPv4 address was detected.');
  console.log('Connect this computer to Wi-Fi or Ethernet, then run npm run dev:lan-info again.');
  process.exit(0);
}

for (const { name, address } of addresses) {
  console.log(`${name}:`);
  console.log(`  Phone page:  http://${address}:3000`);
  console.log(`  Server test: http://${address}:3001/health`);
}

console.log('');
console.log('If the phone cannot load the page:');
console.log('- Make sure the phone is on the same Wi-Fi/LAN, not cellular data or a guest network.');
console.log('- Open the Phone page URL above directly on the phone browser.');
console.log('- If it still fails, allow Node.js through Windows Firewall for this network profile.');
console.log('- Some routers enable AP/client isolation; disable it or use a normal LAN SSID.');
console.log('');
