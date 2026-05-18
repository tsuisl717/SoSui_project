/**
 * Server-side blob backend for encrypted message envelopes.
 *
 * Three modes, picked by env at boot:
 *   - PINATA_JWT set       → real IPFS (works across deployments)
 *   - BLOB_DIR set         → filesystem (persists on a single VPS)
 *   - default              → in-memory (single Next.js process, demo only)
 *
 * All backends are content-addressed: put(body) returns a CID derived from
 * the body's SHA-256.
 */
import "server-only";

export interface BlobBackend {
  put(body: string): Promise<string>;
  get(cid: string): Promise<string | null>;
}

async function sha256Hex(s: string): Promise<string> {
  const { createHash } = await import("crypto");
  return createHash("sha256").update(s).digest("hex");
}

class MemoryBackend implements BlobBackend {
  private get store(): Map<string, string> {
    const g = globalThis as any;
    return (g.__sosuiBlobStore ??= new Map());
  }
  async put(body: string) {
    const cid = "mem_" + (await sha256Hex(body)).slice(0, 48);
    this.store.set(cid, body);
    return cid;
  }
  async get(cid: string) {
    return this.store.get(cid) ?? null;
  }
}

class FileBackend implements BlobBackend {
  constructor(private dir: string) {}
  async put(body: string) {
    const cid = "file_" + (await sha256Hex(body)).slice(0, 48);
    const fs = await import("fs/promises");
    const path = await import("path");
    await fs.mkdir(this.dir, { recursive: true });
    await fs.writeFile(path.join(this.dir, cid), body, "utf8");
    return cid;
  }
  async get(cid: string) {
    if (!cid.startsWith("file_")) return null;
    const fs = await import("fs/promises");
    const path = await import("path");
    try {
      return await fs.readFile(path.join(this.dir, cid), "utf8");
    } catch {
      return null;
    }
  }
}

class PinataBackend implements BlobBackend {
  constructor(private jwt: string) {}
  async put(body: string) {
    const parsed = JSON.parse(body);
    const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pinataContent: parsed,
        pinataMetadata: { name: "sosui-msg" },
      }),
    });
    if (!res.ok) throw new Error(`Pinata put failed: ${res.status} ${await res.text()}`);
    const j = (await res.json()) as { IpfsHash: string };
    return j.IpfsHash;
  }

  async get(cid: string) {
    // Try the user's dedicated gateway first (always works for their pins),
    // then fall back to public IPFS gateways as defense in depth. The race
    // returns the first 200; others are aborted.
    const userGw = (process.env.PINATA_GATEWAY || "").replace(/\/$/, "");
    const gateways = [
      ...(userGw ? [userGw] : []),
      "https://ipfs.io",
      "https://dweb.link",
      "https://gateway.pinata.cloud", // last because it's flaky
    ];

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    try {
      return await Promise.any(
        gateways.map(async (gw) => {
          const res = await fetch(`${gw}/ipfs/${cid}`, {
            signal: ctrl.signal,
            cache: "no-store",
          });
          if (!res.ok) throw new Error(`${gw}: ${res.status}`);
          const body = await res.text();
          ctrl.abort(); // cancel the losers
          return body;
        })
      );
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}

let _backend: BlobBackend | null = null;

export function backend(): BlobBackend {
  if (_backend) return _backend;
  if (process.env.PINATA_JWT) {
    _backend = new PinataBackend(process.env.PINATA_JWT);
  } else if (process.env.BLOB_DIR) {
    _backend = new FileBackend(process.env.BLOB_DIR);
  } else {
    _backend = new MemoryBackend();
  }
  return _backend;
}
