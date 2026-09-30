import worker from '../dist/server/index.js';

// Adaptador para Vercel Functions. O projeto original usa um binding R2 (BUCKET).
// Na Vercel, este fallback em memória serve apenas para demonstração/preview.
// Para produção, conecte um armazenamento persistente e substitua este BUCKET.
const memory = globalThis.__FC_LIVROS_BUCKET__ || (globalThis.__FC_LIVROS_BUCKET__ = new Map());
const BUCKET = {
  async get(key) {
    if (!memory.has(key)) return null;
    const raw = memory.get(key);
    return { json: async () => JSON.parse(raw) };
  },
  async put(key, value) {
    memory.set(key, String(value));
  },
  async delete(key) {
    memory.delete(key);
  },
};

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
    const body = await requestBody(req);
    const request = new Request(url, {
      method: req.method,
      headers: webHeaders(req),
      body,
    });

    const response = await worker.fetch(request, { ...process.env, BUCKET });
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
