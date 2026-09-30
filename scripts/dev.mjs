// Servidor local de desenvolvimento: adapta o Worker ESM gerado em dist/server/index.js
// para o http do Node e simula o binding R2 (BUCKET) com arquivos em .local-r2/.
// Uso: npm run build && npm run dev  ->  http://localhost:8787
// Somente para uso local: este adaptador não deve ser publicado.
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import worker from '../dist/server/index.js';

// Carrega .env (se existir) sem sobrescrever variáveis já definidas no shell.
try{const raw=await readFile('.env','utf8');for(const line of raw.split(/\r?\n/)){const match=line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(match&&process.env[match[1]]===undefined)process.env[match[1]]=match[2].replace(/^["']|["']$/g,'')}}catch{}

const PORT=Number(process.env.PORT||8787);
const DATA=path.resolve('.local-r2');
const fileFor=key=>path.join(DATA,...key.split('/').map(part=>part.replace(/[^a-zA-Z0-9._-]/g,'_')));

const BUCKET={
  async get(key){try{const raw=await readFile(fileFor(key),'utf8');return{json:async()=>JSON.parse(raw)}}catch{return null}},
  async put(key,value){const file=fileFor(key);await mkdir(path.dirname(file),{recursive:true});await writeFile(file,value)},
  async delete(key){await rm(fileFor(key),{force:true})}
};

const ENV={BUCKET,SHOP_NAME:process.env.SHOP_NAME,WHATSAPP_NUMBER:process.env.WHATSAPP_NUMBER,PRICE_LABEL:process.env.PRICE_LABEL,PIX_KEY:process.env.PIX_KEY,ORDER_SECRET:process.env.ORDER_SECRET,ADMIN_TOKEN:process.env.ADMIN_TOKEN,WHATSAPP_TOKEN:process.env.WHATSAPP_TOKEN,WHATSAPP_PHONE_ID:process.env.WHATSAPP_PHONE_ID,AI_PROVIDER:process.env.AI_PROVIDER,AI_API_KEY:process.env.AI_API_KEY,AI_MODEL:process.env.AI_MODEL,OPENAI_API_KEY:process.env.OPENAI_API_KEY};

const readBody=req=>new Promise((resolve,reject)=>{const chunks=[];req.on('data',chunk=>chunks.push(chunk));req.on('end',()=>resolve(Buffer.concat(chunks)));req.on('error',reject)});
const headersOf=req=>Object.entries(req.headers).flatMap(([name,value])=>value===undefined?[]:Array.isArray(value)?value.map(item=>[name,item]):[[name,String(value)]]);

createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost:'+PORT);
    const body=['GET','HEAD'].includes(req.method)?undefined:await readBody(req);
    const response=await worker.fetch(new Request(url,{method:req.method,headers:headersOf(req),body}),ENV);
    res.statusCode=response.status;
    for(const [name,value] of response.headers)if(name.toLowerCase()!=='set-cookie')res.setHeader(name,value);
    const cookies=typeof response.headers.getSetCookie==='function'?response.headers.getSetCookie():[response.headers.get('set-cookie')].filter(Boolean);
    if(cookies.length)res.setHeader('set-cookie',cookies.map(cookie=>cookie.replace(/;\s*Secure/gi,'')));
    res.end(Buffer.from(await response.arrayBuffer()));
  }catch(error){
    console.error('Falha na requisição local:',error);
    res.statusCode=500;
    res.end('Erro interno do servidor local');
  }
}).listen(PORT,()=>console.log('FC Livros Mágicos em http://localhost:'+PORT+'\nDados locais: '+DATA));
