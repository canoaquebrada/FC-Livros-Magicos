import worker from '../dist/server/index.js';
import { put, get, del, list } from '@vercel/blob';
import { getVercelOidcToken } from '@vercel/oidc';

const STYLE_IMAGE_SOURCES = {
  "jeans": "https://dnznrvs05pmza.cloudfront.net/gemini/gemini-3.1-flash-image/images/8d75e2e3-a6f3-4eec-8bf8-02dd78231aec/8a0177e2-7ccd-4a63-8bf9-01ac2eb89a0e/_couple__same_adult_couple_and_same_facial_identity__realist.png?_jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXlIYXNoIjoiNmY2OGU4YjQzYjczYzg5ZiIsImJ1Y2tldCI6InJ1bndheS10YXNrLWFydGlmYWN0cyIsInN0YWdlIjoicHJvZCIsImV4cCI6MTc5MTA0MDY5Mn0.gyGmx30O28GWtryYCy2AAaLJm9BB6cJtXP5iu5fx-J0",
  "claras": "https://dnznrvs05pmza.cloudfront.net/gemini/gemini-3.1-flash-image/images/7f7c5c08-dc4c-43ca-85db-d925cd965181/1ce2b3b4-2fd7-4a5e-b0da-7864fc1219ba/_couple__same_adult_couple_and_same_facial_identity__realist.png?_jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXlIYXNoIjoiYjNkOTQ5MDM3ZWFmMjEzZSIsImJ1Y2tldCI6InJ1bndheS10YXNrLWFydGlmYWN0cyIsInN0YWdlIjoicHJvZCIsImV4cCI6MTc5MTAwMDA2N30.zKYMa2mbiuFicONsIp-cikew-iXZ9cUdwsUo4Iz3vHg",
  "coloridas": "https://dnznrvs05pmza.cloudfront.net/gemini/gemini-3.1-flash-image/images/835affff-8af6-4471-a6de-5d461e8ada20/dcf6255b-5331-4df4-843f-432745cf7837/_couple__same_adult_couple_and_same_facial_identity__realist.png?_jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXlIYXNoIjoiNGMzOWE5M2E0MzNiOGUxYiIsImJ1Y2tldCI6InJ1bndheS10YXNrLWFydGlmYWN0cyIsInN0YWdlIjoicHJvZCIsImV4cCI6MTc5MTAyNjQ5MH0.9QSXBLSeErA1dxa3TMhffEhfif5DL2waJC5VbMzfbBY",
  "praia": "https://dnznrvs05pmza.cloudfront.net/gemini/gemini-3.1-flash-image/images/3e4da2eb-c239-4009-95bd-b5a2e0171151/ff82cd63-4a84-41f2-ba32-5844ef89de58/_couple__same_adult_couple_and_same_facial_identity__realist.png?_jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXlIYXNoIjoiODU3NzllMjdhYTMzNmZmZCIsImJ1Y2tldCI6InJ1bndheS10YXNrLWFydGlmYWN0cyIsInN0YWdlIjoicHJvZCIsImV4cCI6MTc5MTA1MjE5OX0.SgjnmAoS8DmM8DDMgLY7fJeZW4mH9MYuFJWJ5qfA4w4",
  "social": "https://dnznrvs05pmza.cloudfront.net/gemini/gemini-3.1-flash-image/images/b1c7275d-474f-4927-be38-4a4f0ddb34b1/63134ebb-32f5-4276-b566-583bdb1a8609/_couple__same_adult_couple_and_same_facial_identity__realist.png?_jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXlIYXNoIjoiNDcwMzY5M2EwYzFkZDI3MSIsImJ1Y2tldCI6InJ1bndheS10YXNrLWFydGlmYWN0cyIsInN0YWdlIjoicHJvZCIsImV4cCI6MTc5MTAyMTg4Mn0.-24KR3RQu9oN3MNxbfCHaeNn0uqQmNbTywvRX13Z_gs",
  "pb": "https://dnznrvs05pmza.cloudfront.net/gemini/gemini-3.1-flash-image/images/486a5c8f-975b-4320-ae0a-b462ee4be59c/80b7d722-3c5d-4610-b8a2-1b8d541832be/_couple__same_adult_couple_and_same_facial_identity__realist.png?_jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXlIYXNoIjoiNGIzYzc5MGE2NzVmOTJkYiIsImJ1Y2tldCI6InJ1bndheS10YXNrLWFydGlmYWN0cyIsInN0YWdlIjoicHJvZCIsImV4cCI6MTc5MTAyMjM0Nn0.n_vnqfMFaC2eSG_vpQwGIAh0H9YPAwBxqSeskF6ExAw"
};

// Armazenamento persistente na Vercel.
// Usa OIDC + BLOB_STORE_ID (modo recomendado atual) e mantém compatibilidade
// com o token legado BLOB_READ_WRITE_TOKEN.
const blobToken = process.env.BLOB_READ_WRITE_TOKEN || '';
const blobStoreId = process.env.BLOB_STORE_ID || '';
const blobPrefix = 'fc-livros-magicos/';
const supabaseUrl = process.env.SUPABASE_URL || 'https://jsttcmfwsqqsfzlnwqlm.supabase.co';
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_MHjsH7bJlaFwIGzXihUFFg_JribCp_9';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzdHRjbWZ3c3Fxc2Z6bG53cWxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzOTQzNjYsImV4cCI6MjA5Nzk3MDM2Nn0.xWmCJ4bzy2GpslHwARwvputYaptKNFcJQBCAxeIdMqU';
const supabaseMediaBucket = 'fc-previews';

function createSupabaseBucket() {
  const secret = process.env.ADMIN_TOKEN || '';
  const enabled = Boolean(supabaseUrl && supabaseKey && secret);

  async function rpc(name, payload) {
    if (!enabled) throw new Error('Supabase persistent store is not configured');
    const response = await fetch(supabaseUrl + '/rest/v1/rpc/' + name, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'apikey': supabaseKey,
      },
      body: JSON.stringify(payload),
    });
    const raw = await response.text();
    if (!response.ok) throw new Error('Supabase RPC ' + name + ' failed: ' + response.status + ' ' + raw.slice(0, 300));
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return raw; }
  }


  function mediaHeaders(contentType) {
    return {
      apikey: supabaseKey,
      authorization: 'Bearer ' + supabaseAnonKey,
      'x-fc-storage-secret': secret,
      ...(contentType ? {'content-type': contentType} : {}),
    };
  }

  async function toMediaBytes(value) {
    const raw = String(value || '');
    const data = raw.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (data) return { bytes: Buffer.from(data[2], 'base64'), contentType: data[1] };
    if (/^https?:\/\//i.test(raw)) {
      const response = await fetch(raw);
      if (!response.ok) throw new Error('Could not download generated image: ' + response.status);
      return { bytes: Buffer.from(await response.arrayBuffer()), contentType: (response.headers.get('content-type') || 'image/jpeg').split(';')[0] };
    }
    throw new Error('Unsupported media value');
  }

  const media = {
    async putImage(id, kind, value) {
      if (!enabled) return null;
      const source = await toMediaBytes(value);
      const ext = source.contentType === 'image/png' ? 'png' : source.contentType === 'image/webp' ? 'webp' : 'jpg';
      const path = String(id).replace(/[^A-Za-z0-9_-]/g, '') + '/' + String(kind).replace(/[^a-z]/gi, '') + '.' + ext;
      const endpoint = supabaseUrl + '/storage/v1/object/' + supabaseMediaBucket + '/' + path;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {...mediaHeaders(source.contentType), 'x-upsert': 'true'},
        body: source.bytes,
      });
      const raw = await response.text();
      if (!response.ok) throw new Error('Supabase Storage upload failed: ' + response.status + ' ' + raw.slice(0, 250));
      return 'media://' + path;
    },
    async getImage(ref) {
      const path = String(ref || '').replace(/^media:\/\//, '');
      if (!path) return null;
      const response = await fetch(supabaseUrl + '/storage/v1/object/authenticated/' + supabaseMediaBucket + '/' + path, {
        headers: mediaHeaders(),
      });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error('Supabase Storage read failed: ' + response.status);
      return {
        bytes: Buffer.from(await response.arrayBuffer()),
        contentType: (response.headers.get('content-type') || 'image/jpeg').split(';')[0],
      };
    },
    async deleteImage(ref) {
      const path = String(ref || '').replace(/^media:\/\//, '');
      if (!path) return;
      const response = await fetch(supabaseUrl + '/storage/v1/object/' + supabaseMediaBucket + '/' + path, {
        method: 'DELETE',
        headers: {...mediaHeaders('application/json')},
      });
      if (!response.ok && response.status !== 404) throw new Error('Supabase Storage delete failed: ' + response.status);
    },
  };

  return {
    storagePersistent: enabled,
    provider: 'supabase',
    media,

    async get(key) {
      const value = await rpc('fc_store_get', { p_secret: secret, p_key: String(key) });
      if (value == null) return null;
      const raw = typeof value === 'string' ? value : String(value);
      return { json: async () => JSON.parse(raw) };
    },

    async put(key, value) {
      await rpc('fc_store_put', {
        p_secret: secret,
        p_key: String(key),
        p_value: String(value),
      });
    },

    async delete(key) {
      await rpc('fc_store_delete', { p_secret: secret, p_key: String(key) });
    },

    async list(prefix, limit = 500) {
      const rows = await rpc('fc_store_list', {
        p_secret: secret,
        p_prefix: String(prefix || ''),
        p_limit: Math.max(1, Math.min(500, Number(limit) || 500)),
      });
      return (Array.isArray(rows) ? rows : []).map(row => ({
        key: String(row.key || ''),
        uploadedAt: row.uploaded_at || null,
      }));
    },
  };
}


// Fallback apenas para desenvolvimento/ambientes sem Blob conectado.
const memory = globalThis.__FC_LIVROS_BUCKET__ || (globalThis.__FC_LIVROS_BUCKET__ = new Map());
const blobHealth = globalThis.__FC_LIVROS_BLOB_HEALTH__ || (globalThis.__FC_LIVROS_BLOB_HEALTH__ = { checkedAt: 0, ok: null, lastError: '' });

async function usableBlobAuth(blobAuth) {
  if (!blobAuth) return null;
  const now = Date.now();
  if (blobHealth.ok !== null && now - blobHealth.checkedAt < 60000) return blobHealth.ok ? blobAuth : null;
  try {
    await get(blobPrefix + 'analytics/visits.json', {
      access: 'private',
      ...blobAuth,
      useCache: false,
    });
    blobHealth.ok = true;
    blobHealth.lastError = '';
    blobHealth.checkedAt = now;
    return blobAuth;
  } catch (error) {
    blobHealth.ok = false;
    blobHealth.checkedAt = now;
    blobHealth.lastError = error && error.message ? error.message : String(error || '');
    console.error('Vercel Blob unavailable; using temporary memory fallback:', blobHealth.lastError);
    return null;
  }
}


async function resolveBlobAuth() {
  if (blobToken) return { token: blobToken };
  if (!blobStoreId) return null;
  try {
    const oidcToken = await getVercelOidcToken();
    return oidcToken ? { oidcToken, storeId: blobStoreId } : null;
  } catch (error) {
    console.error('Vercel Blob OIDC unavailable', error && error.message ? error.message : error);
    return null;
  }
}

function createBucket(blobAuth) {
  const storagePersistent = Boolean(blobAuth);

  async function readBlobJson(pathname) {
    const result = await get(pathname, {
      access: 'private',
      ...blobAuth,
      useCache: false,
    });
    if (!result) return null;
    const raw = await new Response(result.stream).text();
    return JSON.parse(raw);
  }

  return {
    storagePersistent,

    async get(key) {
      if (storagePersistent) {
        try {
          const pathname = blobPrefix + key;
          const value = await readBlobJson(pathname);
          return value === null ? null : { json: async () => value };
        } catch (error) {
          console.error('Blob get failed; falling back to memory:', error && error.message ? error.message : error);
        }
      }
      if (!memory.has(key)) return null;
      const raw = memory.get(key);
      return { json: async () => JSON.parse(raw) };
    },

    async put(key, value) {
      if (storagePersistent) {
        try {
          await put(blobPrefix + key, String(value), {
            access: 'private',
            ...blobAuth,
            addRandomSuffix: false,
            allowOverwrite: true,
            contentType: 'application/json; charset=utf-8',
            cacheControlMaxAge: 0,
          });
          return;
        } catch (error) {
          console.error('Blob put failed; falling back to memory:', error && error.message ? error.message : error);
        }
      }
      memory.set(key, String(value));
    },

    async delete(key) {
      if (storagePersistent) {
        try {
          await del(blobPrefix + key, blobAuth);
          return;
        } catch (error) {
          console.error('Blob delete failed; falling back to memory:', error && error.message ? error.message : error);
        }
      }
      memory.delete(key);
    },

    async list(prefix, limit = 500) {
      const cleanPrefix = String(prefix || '');
      const max = Math.max(1, Math.min(500, Number(limit) || 500));
      if (storagePersistent) {
        try {
          const items = [];
          let cursor;
          do {
            const page = await list({
              ...blobAuth,
              prefix: blobPrefix + cleanPrefix,
              limit: Math.min(1000, max - items.length),
              cursor,
            });
            for (const blob of page.blobs || []) {
              if (items.length >= max) break;
              const pathname = String(blob.pathname || '');
              items.push({
                key: pathname.startsWith(blobPrefix) ? pathname.slice(blobPrefix.length) : pathname,
                uploadedAt: blob.uploadedAt || null,
              });
            }
            cursor = page.hasMore && items.length < max ? page.cursor : undefined;
          } while (cursor && items.length < max);
          return items;
        } catch (error) {
          console.error('Blob list failed; falling back to memory:', error && error.message ? error.message : error);
        }
      }
      return [...memory.keys()]
        .filter(key => String(key).startsWith(cleanPrefix))
        .slice(0, max)
        .map(key => ({ key: String(key), uploadedAt: null }));
    },
  };
}

async function styleImageResponse(name, blobAuth) {
  const clean = String(name || '').toLowerCase();
  const source = STYLE_IMAGE_SOURCES[clean];
  if (!source) return new Response('Not found', { status: 404 });
  if (!blobAuth) {
    const remote = await fetch(source);
    if (!remote.ok) return new Response('Image unavailable', { status: 502 });
    return new Response(await remote.arrayBuffer(), {
      status: 200,
      headers: {
        'content-type': remote.headers.get('content-type') || 'image/png',
        'cache-control': 'public, max-age=3600',
        'x-content-type-options': 'nosniff',
      },
    });
  }

  const pathname = blobPrefix + 'style-images/' + clean + '.png';
  let existing;
  try {
    existing = await get(pathname, { access: 'private', ...blobAuth, useCache: false });
  } catch (error) {
    console.error('Style image Blob read failed; serving source directly:', error && error.message ? error.message : error);
    const remote = await fetch(source);
    if (!remote.ok) return new Response('Image unavailable', { status: 502 });
    return new Response(await remote.arrayBuffer(), {
      status: 200,
      headers: {
        'content-type': remote.headers.get('content-type') || 'image/png',
        'cache-control': 'public, max-age=3600',
        'x-content-type-options': 'nosniff',
      },
    });
  }
  if (existing) {
    return new Response(existing.stream, {
      status: 200,
      headers: {
        'content-type': existing.blob?.contentType || 'image/png',
        'cache-control': 'public, max-age=86400',
        'x-content-type-options': 'nosniff',
      },
    });
  }

  const remote = await fetch(source);
  if (!remote.ok) return new Response('Image unavailable', { status: 502 });
  const bytes = await remote.arrayBuffer();
  await put(pathname, bytes, {
    access: 'private',
    ...blobAuth,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: remote.headers.get('content-type') || 'image/png',
    cacheControlMaxAge: 31536000,
  });

  return new Response(bytes, {
    status: 200,
    headers: {
      'content-type': remote.headers.get('content-type') || 'image/png',
      'cache-control': 'public, max-age=86400',
      'x-content-type-options': 'nosniff',
    },
  });
}

function requestBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function webHeaders(req) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers || {})) {
    if (value == null) continue;
    if (Array.isArray(value)) value.forEach(item => headers.append(name, String(item)));
    else headers.set(name, String(value));
  }
  return headers;
}

export default async function handler(req, res) {
  try {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host || 'localhost';
    const url = new URL(req.url || '/', `${proto}://${host}`);
    const routedPath = url.searchParams.get('__path');
    if (routedPath !== null) {
      url.pathname = '/' + routedPath.replace(/^\/+/, '');
      url.searchParams.delete('__path');
    }

    const supabaseBucket = createSupabaseBucket();
    const resolvedBlobAuth = supabaseBucket.storagePersistent ? null : await resolveBlobAuth();
    const blobAuth = supabaseBucket.storagePersistent ? null : await usableBlobAuth(resolvedBlobAuth);
    if (url.pathname === '/api/style-image') {
      const response = await styleImageResponse(url.searchParams.get('name'), blobAuth);
      res.statusCode = response.status;
      for (const [name, value] of response.headers) res.setHeader(name, value);
      return res.end(Buffer.from(await response.arrayBuffer()));
    }

    const body = await requestBody(req);
    const request = new Request(url, {
      method: req.method,
      headers: webHeaders(req),
      body,
    });

    const bucket = supabaseBucket.storagePersistent ? supabaseBucket : createBucket(blobAuth);

    const response = await worker.fetch(request, {
      ...process.env,
      BUCKET: bucket,
      STORAGE_PERSISTENT: bucket.storagePersistent ? '1' : '',
      STORAGE_PROVIDER: bucket.provider || (bucket.storagePersistent ? 'vercel-blob' : 'memory'),
      MEDIA: supabaseBucket.media || null,
    });
    res.statusCode = response.status;

    const setCookies = [];
    for (const [name, value] of response.headers) {
      if (name.toLowerCase() === 'set-cookie') setCookies.push(value);
      else res.setHeader(name, value);
    }
    if (setCookies.length) res.setHeader('set-cookie', setCookies);

    if (req.method === 'HEAD') return res.end();
    const bytes = Buffer.from(await response.arrayBuffer());
    res.end(bytes);
  } catch (error) {
    console.error('Vercel adapter failed', error);
    res.statusCode = 500;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end('Erro interno do servidor');
  }
}
