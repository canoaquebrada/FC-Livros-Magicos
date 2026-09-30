const STEP_SLUGS=['idade','foto','tema','sentimentos','estilo','estrela','objetivo','personagens','idioma','dedicatoria','revelacao','revisao'];
const LAST_STEP=STEP_SLUGS.length-1;
const BOOT_TAG='<script type="application/json" id="boot">{"step":0,"explicit":false}</script>';
const MAX_BODY=14000000;
const ROUTES=new Map([['/',0],['/criar',0],...STEP_SLUGS.map((slug,index)=>['/criar/'+slug,index])]);
const json=(v,status=200,extra={})=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...extra}});
const photoOk=(value,max)=>!value||(typeof value==='string'&&value.length<=max&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value));
const castOk=cast=>cast===undefined||(Array.isArray(cast)&&cast.length<=6&&cast.every(item=>Boolean(item)&&typeof item.name==='string'&&item.name.length<=60&&['Pessoa','Bichinho','Objeto'].includes(item.kind)&&typeof item.detail==='string'&&item.detail.length<=60&&photoOk(item.photo,2000000)));
const draftOk=body=>{const data=body&&body.data;return Boolean(data)&&typeof data.name==='string'&&data.name.length<=100&&Number.isInteger(body.step)&&body.step>=0&&body.step<=LAST_STEP&&photoOk(data.photo,7000000)&&castOk(data.cast)&&(!data.whatsapp||(typeof data.whatsapp==='string'&&data.whatsapp.length<=30))};
const page=(step,explicit)=>HTML.replace(BOOT_TAG,`<script type="application/json" id="boot">${JSON.stringify({step,explicit})}</script>`);
export default {async fetch(request,env){
const url=new URL(request.url);const match=(request.headers.get('cookie')||'').match(/(?:^|;\s*)fc_session=([a-f0-9]{64})(?:;|$)/);let token=match?.[1];let cookie={};
if(!token){token=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');cookie={'set-cookie':`fc_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`}}
try{
if(url.pathname==='/api/draft'){
if(!env.BUCKET)return json({error:'Salvamento indisponível'},503,cookie);
const key='briefings/'+token+'.json';
if(request.method==='GET'){const object=await env.BUCKET.get(key);return json(object?await object.json():null,200,cookie)}
if(request.method==='PUT'){
if(request.headers.get('origin')!==url.origin)return json({error:'Origem inválida'},403);
if(!request.headers.get('content-type')?.includes('application/json'))return json({error:'Formato inválido'},415);
const raw=await request.text();
if(raw.length>MAX_BODY)return json({error:'Arquivo muito grande'},413);
let body;try{body=JSON.parse(raw)}catch{return json({error:'Dados inválidos'},400)}
if(!draftOk(body))return json({error:'Dados inválidos'},400);
await env.BUCKET.put(key,JSON.stringify(body),{httpMetadata:{contentType:'application/json'}});
return json({saved:true},200,cookie)}
return json({error:'Método não permitido'},405)}
if(url.pathname==='/api/admin/book'||url.pathname==='/api/admin/pdf'){
const settings=orderSettings(env);
if(!settings.admin)return json({error:'Administração não configurada: defina ADMIN_TOKEN.'},503,cookie);
if(url.searchParams.get('token')!==settings.admin)return json({error:'Token inválido'},403,cookie);
const record=await readOrderRecord(env,url.searchParams.get('code')||'');
if(!record)return json({error:'Pedido não encontrado'},404,cookie);
if(url.pathname==='/api/admin/pdf'){
if(request.method!=='GET'&&request.method!=='HEAD')return json({error:'Método não permitido'},405);
if(!record.story)return json({error:'Gere a história antes de baixar o PDF.'},404,cookie);
const bytes=composeBookPdf(record.briefing,record.story);
return new Response(request.method==='HEAD'?null:bytes,{headers:{'content-type':'application/pdf','content-disposition':'attachment; filename="'+pdfFileName(record.briefing)+'"','cache-control':'no-store',...cookie}})}
if(request.method!=='POST')return json({error:'Método não permitido'},405);
let story;try{story=await generateStory(record.briefing,env)}catch(error){return json({error:'Não foi possível gerar agora: '+error.message},502,cookie)}
record.story=story;record.storyGeneratedAt=story.generatedAt;record.storyProvider=story.provider;
await env.BUCKET.put('orders/'+record.code+'.json',JSON.stringify(record),{httpMetadata:{contentType:'application/json'}});
return json({ok:true,code:record.code,story},200,cookie)}
if(url.pathname==='/api/admin/status'){
const settings=orderSettings(env);
if(!settings.admin)return json({error:'Administração não configurada: defina ADMIN_TOKEN.'},503,cookie);
if(url.searchParams.get('token')!==settings.admin)return json({error:'Token inválido'},403,cookie);
if(request.method!=='POST')return json({error:'Método não permitido'},405,cookie);
if(!request.headers.get('content-type')?.includes('application/json'))return json({error:'Formato inválido'},415,cookie);
let body;try{body=await request.json()}catch{return json({error:'Dados inválidos'},400,cookie)}
const record=await updateOrderStatus(env,url.searchParams.get('code')||'',body&&body.status);
if(!record)return json({error:'Pedido ou status inválido'},400,cookie);
return json({ok:true,code:record.code,status:record.status,updatedAt:record.updatedAt},200,cookie)}
if(url.pathname==='/api/shop'){const settings=orderSettings(env);return json({shop:settings.shop,price:settings.price,pix:settings.pix,whatsappConfigured:Boolean(settings.whatsapp),adminConfigured:Boolean(settings.admin),storagePersistent:Boolean(settings.storagePersistent)},200,cookie)}
if(url.pathname==='/api/order'){
if(!env.BUCKET)return json({error:'Pedidos indisponíveis'},503,cookie);
const settings=orderSettings(env);
if(request.method==='POST'){
if(request.headers.get('origin')!==url.origin)return json({error:'Origem inválida'},403);
const draftObject=await env.BUCKET.get('briefings/'+token+'.json');
if(!draftObject)return json({error:'Preencha o formulário antes de enviar o pedido.'},400,cookie);
const draft=await draftObject.json();
const briefing=(draft&&draft.data)||{};
const missing=requiredBriefingFields(briefing);
if(missing.length)return json({error:'Faltam informações: '+missing.join(', ')+'.'},400,cookie);
const customerWhatsapp=cleanText(briefing.whatsapp).replace(/[^0-9]/g,'');if(customerWhatsapp.length<10||customerWhatsapp.length>15)return json({error:'Informe um WhatsApp válido com DDD para enviar o pedido.'},400,cookie);
const code=orderCode();
const accessToken=await orderAccessToken(code,settings.secret);
const link=url.origin+orderLink(code,accessToken);
const summary=orderSummary(briefing,code,settings,link);
const record={code,accessToken,status:'novo',total:settings.price,createdAt:new Date().toISOString(),briefing,summary,story:null,notified:{sent:false,reason:''}};
try{record.notified=await sendOrderToWhatsApp(settings,summary,briefing.photo)}catch(error){record.notified={sent:false,reason:error.message}}
await saveOrderRecord(env,record);
return json({code,link,waLink:orderWhatsAppLink(settings,summary),summary,shop:settings.shop,price:settings.price,pix:settings.pix,whatsappConfigured:Boolean(settings.whatsapp),painelConfigured:Boolean(settings.admin),notified:record.notified},200,cookie)}
return json({error:'Método não permitido'},405)}
if(url.pathname.startsWith('/pedido/')){
if(!env.BUCKET)return json({error:'Pedidos indisponíveis'},503,cookie);
const settings=orderSettings(env);
const record=await readOrderRecord(env,decodeURIComponent(url.pathname.slice('/pedido/'.length)));
const access=url.searchParams.get('t')||'';
const allowed=Boolean(record)&&(access===record.accessToken||(settings.admin&&access===settings.admin));
if(!allowed)return new Response(orderNotFoundHtml(),{status:404,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex, nofollow',...cookie}});
return new Response(orderPageHtml(record,settings,url.origin,Boolean(settings.admin&&access===settings.admin)),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex, nofollow','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; form-action 'none'; base-uri 'none'",...cookie}})}
if(url.pathname==='/painel'){
const settings=orderSettings(env);
if(!settings.admin)return json({error:'Painel não configurado: defina ADMIN_TOKEN.'},503,cookie);
if(url.searchParams.get('token')!==settings.admin)return json({error:'Token inválido'},403,cookie);
if(!env.BUCKET)return json({error:'Pedidos indisponíveis'},503,cookie);
const remove=orderCleanCode(url.searchParams.get('apagar')||'');
if(remove)await deleteOrderRecord(env,remove);
return new Response(painelHtml(await orderIndex(env),settings,settings.admin,url.origin),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex, nofollow','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; base-uri 'none'",...cookie}})}
if(url.pathname.startsWith('/api/'))return json({error:'Não encontrado'},404);
if(!['GET','HEAD'].includes(request.method))return new Response('Método não permitido',{status:405});
const path=url.pathname.length>1?(url.pathname.replace(/\/+$/,'')||'/'):url.pathname;
const route=ROUTES.get(path);
const explicit=route!==undefined&&path.startsWith('/criar/');
return new Response(request.method==='HEAD'?null:page(route===undefined?0:route,explicit),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'same-origin','content-security-policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",...cookie}})
}catch(e){console.error('Briefing request failed',e.message);return json({error:'Não foi possível concluir. Tente novamente.'},500,cookie)}}};
