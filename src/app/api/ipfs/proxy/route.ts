import { NextRequest, NextResponse } from 'next/server';

const GATEWAYS = [
  // Custom Pinata gateway (preferred)
  'https://brown-naked-reindeer-865.mypinata.cloud/ipfs/',
  // Common public gateways (fallbacks)

  'https://gateway.pinata.cloud/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://dweb.link/ipfs/'
];

function extractHash(input: string): string | null {
  if (!input) return null;
  try {
    if (input.startsWith('ipfs://')) {
      const h = input.slice(7);
      return h ? h.split('/')[0] : null;
    }
    if (input.includes('/ipfs/')) {
      const m = input.match(/\/ipfs\/([^/?#]+)/);
      return m ? m[1] : null;
    }
    // Direct CID
    if (/^(Qm|bafy)[A-Za-z0-9]+/.test(input)) return input;
    // Full URL
    const u = new URL(input);
    const m = u.pathname.match(/\/ipfs\/([^/?#]+)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

// Simple in-memory fastest-gateway cache (best-effort; may reset between deploys)
const fastestCache: Map<string, string> = new Map();

async function fetchWithTimeout(url: string, timeoutMs = 4000, init: RequestInit = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' });
    return res;
  } finally {
    clearTimeout(t);
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const u = searchParams.get('u') || '';
    const cid = searchParams.get('cid') || '';

    const targetsSet: Set<string> = new Set();

    if (u) {
      // Try the provided URL first
      targetsSet.add(u);
      const hash = extractHash(u);
      if (hash) {
        // Add gateway fallbacks
        for (const gw of GATEWAYS) targetsSet.add(`${gw}${hash}`);
        // Prefer fastest gateway if known
        const known = fastestCache.get(hash);
        if (known) targetsSet.add(known);
      }
    } else if (cid) {
      for (const gw of GATEWAYS) targetsSet.add(`${gw}${cid}`);
      const known = fastestCache.get(cid);
      if (known) targetsSet.add(known);
    } else {
      return NextResponse.json({ error: 'Missing u or cid parameter' }, { status: 400 });
    }

    const targets = Array.from(targetsSet);
    let lastError: any = null;

    // Race all targets and stream the first successful response
    const controllers: AbortController[] = [];
    const racePromises = targets.map((target) => new Promise<{ res: Response, target: string }>(async (resolve, reject) => {
      const controller = new AbortController();
      controllers.push(controller);
      try {
        const res = await fetchWithTimeout(target, 5000, { signal: controller.signal });
        if (res.ok) {
          resolve({ res, target });
        } else {
          reject(new Error(`Upstream ${res.status}`));
        }
      } catch (e) {
        reject(e);
      }
    }));

    try {
      const { res, target } = await Promise.any(racePromises);
      // Abort other pending requests
      controllers.forEach((c) => { try { c.abort(); } catch {} });

      // Store fastest gateway for this CID for next time
      const hash = extractHash(u || cid) || '';
      if (hash) {
        try {
          const fastestGw = target.includes('/ipfs/') ? target.split('/ipfs/')[0] + '/ipfs/' : target;
          fastestCache.set(hash, fastestGw + hash);
        } catch {}
      }

      const contentType = res.headers.get('content-type') || 'application/octet-stream';
      const body = res.body; // Stream directly
      return new NextResponse(body, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          // Aggressive cache for CDN; content is immutable by CID
          'Cache-Control': 'public, max-age=31536000, immutable, s-maxage=31536000, stale-while-revalidate=86400',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (err) {
      lastError = err;
      return NextResponse.json({ error: `Failed to fetch IPFS content`, detail: String(lastError || '') }, { status: 502 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: 'Proxy error', detail: err?.message || String(err) }, { status: 500 });
  }
}
