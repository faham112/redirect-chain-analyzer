const dns = require('dns').promises;
const ipaddr = require('ipaddr.js');
const { URL } = require('url');

const BLOCKED_CIDRS = [
  '0.0.0.0/8',
  '10.0.0.0/8',
  '127.0.0.0/8',
  '169.254.0.0/16',
  '172.16.0.0/12',
  '192.168.0.0/16',
  '224.0.0.0/4',
  '240.0.0.0/4',
  '::1/128',
  'fc00::/7',
  'fe80::/10',
  'ff00::/8'
];

const METADATA_IPS = new Set([
  '169.254.169.254',
  'fd00:ec2::254',
  'metadata.google.internal'
]);

const ALLOWED_PORTS = (process.env.ALLOWED_PORTS || '80,443').split(',').map(Number);

function isPrivateOrReserved(ip) {
  if (!ip) return true;
  try {
    const addr = ipaddr.parse(ip);
    if (addr.range() === 'loopback' || addr.range() === 'linkLocal' || addr.range() === 'uniqueLocal' || addr.range() === 'unspecified' || addr.range() === 'multicast' || addr.range() === 'reserved') {
      return true;
    }
    for (const cidr of BLOCKED_CIDRS) {
      if (addr.match(ipaddr.parseCIDR(cidr))) return true;
    }
    return false;
  } catch {
    return true;
  }
}

function isMetadataEndpoint(hostname, ip) {
  if (METADATA_IPS.has(ip) || METADATA_IPS.has(hostname.toLowerCase())) return true;
  if (hostname.toLowerCase().includes('metadata') && (hostname.includes('google') || hostname.includes('aws') || hostname.includes('azure'))) return true;
  return false;
}

async function resolveAndValidate(hostname) {
  if (!hostname || typeof hostname !== 'string') {
    throw new Error('Invalid hostname');
  }

  const lower = hostname.toLowerCase();
  if (lower === 'localhost' || lower.endsWith('.local') || lower.endsWith('.internal') || lower === 'metadata') {
    throw new Error('Blocked hostname');
  }

  let addresses;
  try {
    addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch (err) {
    throw new Error(`DNS resolution failed: ${err.message}`);
  }

  if (!addresses || addresses.length === 0) {
    throw new Error('No DNS records found');
  }

  for (const { address } of addresses) {
    if (isPrivateOrReserved(address) || isMetadataEndpoint(hostname, address)) {
      throw new Error(`Blocked IP address: ${address}`);
    }
  }

  return addresses[0].address;
}

function validateUrl(input) {
  if (!input || typeof input !== 'string') {
    throw new Error('URL is required');
  }

  let url;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error('Invalid URL format');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only HTTP and HTTPS protocols are allowed');
  }

  if (!url.hostname) {
    throw new Error('Missing hostname');
  }

  const port = url.port ? parseInt(url.port, 10) : (url.protocol === 'https:' ? 443 : 80);
  if (!ALLOWED_PORTS.includes(port)) {
    throw new Error(`Port ${port} is not allowed`);
  }

  return url;
}

async function validateDestination(urlString) {
  const url = validateUrl(urlString);
  const ip = await resolveAndValidate(url.hostname);
  return { url, ip };
}

module.exports = {
  validateUrl,
  validateDestination,
  resolveAndValidate,
  isPrivateOrReserved,
  isMetadataEndpoint
};
