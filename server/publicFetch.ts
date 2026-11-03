import dns from 'node:dns/promises';
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import ipaddr from 'ipaddr.js';

export function isPublicAddress(address: string) {
  if (!net.isIP(address)) return false;
  const ip = ipaddr.parse(address);
  if (ip.range() !== 'unicast') return false;
  if (ip.kind() === 'ipv6') {
    const v6 = ip as ipaddr.IPv6;
    return v6.match(ipaddr.IPv6.parse('2000::'), 3) &&
      !v6.match(ipaddr.IPv6.parse('2001::'), 23) &&
      !v6.match(ipaddr.IPv6.parse('2001:db8::'), 32) &&
      !v6.match(ipaddr.IPv6.parse('3fff::'), 20) &&
      !v6.match(ipaddr.IPv6.parse('2002::'), 16);
  }
  return true;
}
export function validateProductUrl(input: string): { isValid: boolean; error?: string; url?: URL } {
  try {
    if (typeof input !== 'string' || !input.trim() || input.length > 4096) throw new Error();
    const raw = input.trim();
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : 'https://' + raw);
    const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port ||
      (!net.isIP(host) && (!host.includes('.') || /(?:^|\.)(localhost|local|internal)$/.test(host))) ||
      (net.isIP(host) && !isPublicAddress(host))) throw new Error();
    return { isValid: true, url };
  } catch { return { isValid: false, error: 'Enter a public HTTP or HTTPS product URL.' }; }
}

export async function publicFetch(input: string, options: { headers: Record<string, string>; signal: AbortSignal }) {
  let url = input;
  for (let hop = 0; hop <= 3; hop++) {
    const check = validateProductUrl(url);
    if (!check.url) throw new Error(check.error);
    const target = check.url;
    const host = target.hostname.replace(/^\[|\]$/g, '');
    const addresses = net.isIP(host) ? [{ address: host, family: net.isIP(host) }] : await dns.lookup(host, { all: true });
    options.signal.throwIfAborted();
    if (!addresses.length || addresses.some(entry => !isPublicAddress(entry.address))) throw new Error('Non-public DNS answer.');
    const pinned = addresses[0];
    const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
      const transport = target.protocol === 'https:' ? https : http;
      const request = transport.get(target, {
        agent: false, family: pinned.family,
        lookup: (_hostname, _opts, cb) => cb(null, pinned.address, pinned.family),
        signal: options.signal, headers: { ...options.headers, 'Accept-Encoding': 'identity' },
      }, resolve);
      request.on('error', reject);
    });
    const status = response.statusCode || 500;
    if ([301,302,303,307,308].includes(status) && response.headers.location) {
      response.destroy();
      url = new URL(response.headers.location, target).href;
      continue;
    }
    if (response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity') {
      response.destroy();
      throw new Error('Compressed scraper responses are not supported.');
    }
    const chunks: Buffer[] = [];
    let received = 0;
    for await (const chunk of response) {
      received += chunk.length;
      if (received > 2 * 1024 * 1024) { response.destroy(); throw new Error('Product page is too large.'); }
      chunks.push(Buffer.from(chunk));
    }
    const body = Buffer.concat(chunks).toString('utf8');
    return { ok: status >= 200 && status < 300, status, text: async () => body, json: async () => JSON.parse(body) };
  }
  throw new Error('Too many product URL redirects.');
}
