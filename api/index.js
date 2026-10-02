import worker from '../dist/server/index.js';
import { put, get, del } from '@vercel/blob';
import { getVercelOidcToken } from '@vercel/oidc';

// Armazenamento persistente na Vercel.
// Usa OIDC + BLOB_STORE_ID (modo recomendado atual) e mantém compatibilidade
// com o token legado BLOB_READ_WRITE_TOKEN.
const blobToken = process.env.BLOB_READ_WRITE_TOKEN || '';
const blobStoreId = process.env.BLOB_STORE_ID || '';
const blobPrefix = 'fc-livros-magicos/';

// Fallback apenas para desenvolvimento/ambientes sem Blob conectado.
const memory = globalThis.__FC_LIVROS_BUCKET__ || (globalThis.__FC_LIVROS_BUCKET__ = new Map());

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
        const pathname = blobPrefix + key;
        const value = await readBlobJson(pathname);
        return value === null ? null : { json: async () => value };
      }
      if (!memory.has(key)) return null;
      const raw = memory.get(key);
      return { json: async () => JSON.parse(raw) };
    },

    async put(key, value) {
      if (storagePersistent) {
        await put(blobPrefix + key, String(value), {
          access: 'private',
          ...blobAuth,
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType: 'application/json; charset=utf-8',
          cacheControlMaxAge: 0,
        });
        return;
      }
      memory.set(key, String(value));
    },

    async delete(key) {
      if (storagePersistent) {
        await del(blobPrefix + key, blobAuth);
        return;
      }
      memory.delete(key);
    },
  };
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

    const body = await requestBody(req);
    const request = new Request(url, {
      method: req.method,
      headers: webHeaders(req),
      body,
    });

    const blobAuth = await resolveBlobAuth();
    const bucket = createBucket(blobAuth);

    const response = await worker.fetch(request, {
      ...process.env,
      BUCKET: bucket,
      STORAGE_PERSISTENT: bucket.storagePersistent ? '1' : '',
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
