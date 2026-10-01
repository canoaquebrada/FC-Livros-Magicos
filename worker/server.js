const STEP_SLUGS=['crianca','historia','personagens','personalizacao','finalizar'];
const LAST_STEP=STEP_SLUGS.length-1;
const BOOT_TAG='<script type="application/json" id="boot">{"step":0,"explicit":false}</script>';
const MAX_BODY=14000000;
const LEGACY_ROUTES={idade:0,foto:0,estrela:0,tema:1,sentimentos:1,estilo:1,objetivo:3,personagens:2,idioma:3,dedicatoria:3,revelacao:4,revisao:4};
const ROUTES=new Map([['/',0],['/criar',0],...STEP_SLUGS.map((slug,index)=>['/criar/'+slug,index]),...Object.entries(LEGACY_ROUTES).map(([slug,index])=>['/criar/'+slug,index])]);
const json=(v,status=200,extra={})=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...extra}});
const photoOk=(value,max)=>!value||(typeof value==='string'&&value.length<=max&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value));
const castOk=cast=>cast===undefined||(Array.isArray(cast)&&cast.length<=6&&cast.every(item=>Boolean(item)&&typeof item.name==='string'&&item.name.length<=60&&['Pessoa','Bichinho','Objeto'].includes(item.kind)&&typeof item.detail==='string'&&item.detail.length<=60&&photoOk(item.photo,2000000)));
const draftOk=body=>{const data=body&&body.data;return Boolean(data)&&typeof data.name==='string'&&data.name.length<=100&&Number.isInteger(body.step)&&body.step>=0&&body.step<=LAST_STEP&&photoOk(data.photo,7000000)&&castOk(data.cast)&&(!data.whatsapp||(typeof data.whatsapp==='string'&&data.whatsapp.length<=30))};
const page=(step,explicit)=>HTML.replace(BOOT_TAG,`<script type="application/json" id="boot">${JSON.stringify({step,explicit})}</script>`);
export default {async fetch(request,env){
const url=new URL(request.url);const match=(request.headers.get('cookie')||'').match(/(?:^|;\s*)fc_session=([a-f0-9]{64})(?:;|$)/);let token=match?.[1];let cookie={};
if(!token){token=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');cookie={'set-cookie':`fc_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`}}
try{
if(url.pathname==='/quiz'||url.pathname==='/quiz/'){
if(!['GET','HEAD'].includes(request.method))return new Response('Método não permitido',{status:405});
if(request.method==='GET'){await registerVisit(env,token)}
return new Response(request.method==='HEAD'?null:QUIZ_HTML,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'same-origin','x-robots-tag':'noindex, nofollow','content-security-policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",...cookie}})}
if(url.pathname==='/api/preview'){
if(request.method!=='POST')return json({error:'Método não permitido'},405,cookie);
const requestOrigin=request.headers.get('origin');if(requestOrigin&&requestOrigin!==url.origin)return json({error:'Origem inválida'},403,cookie);
if(!request.headers.get('content-type')?.includes('application/json'))return json({error:'Formato inválido'},415,cookie);
const raw=await request.text();if(raw.length>9000000)return json({error:'A foto ficou grande demais. Escolha outra imagem.'},413,cookie);
let body;try{body=JSON.parse(raw)}catch{return json({error:'Dados inválidos'},400,cookie)}
const typeMap={casal:'casal romântico',familia:'família',infantil:'retrato infantil',pet:'retrato de pet',caricatura:'caricatura digital',homenagem:'homenagem afetiva'};
const styleMap={studio:'estúdio profissional com fundo clean e iluminação suave',praia:'praia bonita com luz natural',jeans:'ensaio moderno com roupas jeans elegantes e camiseta clara',cartoon:'arte ilustrada moderna, sofisticada e bem acabada'};
const typeLabel=typeMap[body.type],styleLabel=styleMap[body.style];
if(!typeLabel||!styleLabel||!photoOk(body.photo,8000000))return json({error:'Escolha uma foto, um tipo e um estilo válidos.'},400,cookie);
const settings=await resolvedOrderSettings(env);
const storeNumber=cleanText(settings.whatsapp).replace(/[^0-9]/g,'');
const waText='Olá! Eu gerei uma prévia no site da FC Artes Digitais. Tipo: '+typeLabel+'. Estilo: '+styleLabel+'. Quero finalizar meu pedido.';
const waLink=storeNumber?'https://wa.me/'+storeNumber+'?text='+encodeURIComponent(waText):'';
const provider=cleanText(env.AI_PROVIDER).toLowerCase();
const apiKey=cleanText(env.OPENAI_API_KEY)||(provider==='openai'?cleanText(env.AI_API_KEY):'');
if(!apiKey)return json({preview:body.photo,demo:true,waLink},200,cookie);
const matchPhoto=body.photo.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
if(!matchPhoto)return json({error:'Formato da foto não suportado.'},400,cookie);
const bytes=Uint8Array.from(atob(matchPhoto[2]),c=>c.charCodeAt(0));
const prompt='Use a imagem enviada exclusivamente como referência da identidade da pessoa ou pet. Crie uma prévia profissional de '+typeLabel+' no estilo '+styleLabel+'. Preserve ao máximo rosto, idade aparente, cabelo, tom de pele, formato do rosto e características reais. Composição elegante, iluminação profissional, aparência natural e comercial. Não adicionar texto, logotipo ou marca d’água. Manter conteúdo apropriado para todas as idades, sem nudez ou conteúdo sexual.';
const form=new FormData();
form.append('model','gpt-image-2');
form.append('image[]',new Blob([bytes],{type:matchPhoto[1]}),'foto-cliente.'+(matchPhoto[1]==='image/png'?'png':matchPhoto[1]==='image/webp'?'webp':'jpg'));
form.append('prompt',prompt);
form.append('size','1024x1024');
form.append('quality','low');
form.append('output_format','jpeg');
let response;
try{response=await fetch('https://api.openai.com/v1/images/edits',{method:'POST',headers:{authorization:'Bearer '+apiKey},body:form})}catch(error){console.error('Preview API connection failed',error.message);return json({preview:body.photo,demo:true,waLink},200,cookie)}
if(!response.ok){const detail=(await response.text()).slice(0,500);console.error('Preview generation failed',response.status,detail);return json({preview:body.photo,demo:true,waLink},200,cookie)}
let generated;try{generated=await response.json()}catch{return json({preview:body.photo,demo:true,waLink},200,cookie)}
const b64=generated&&generated.data&&generated.data[0]&&generated.data[0].b64_json;
if(!b64)return json({preview:body.photo,demo:true,waLink},200,cookie);
const format=generated.output_format==='png'?'png':generated.output_format==='webp'?'webp':'jpeg';
return json({preview:'data:image/'+format+';base64,'+b64,demo:false,waLink},200,cookie)}
if(url.pathname==='/api/draft'){
if(!env.BUCKET)return json({error:'Salvamento indisponível'},503,cookie);
const key='briefings/'+token+'.json';
if(request.method==='GET'){const object=await env.BUCKET.get(key);if(!object)return json(null,200,cookie);const saved=await object.json();if(saved&&saved.data){saved.data.language='Português (BR)';if(!saved.data.style)saved.data.style='Cartoon mágico';if(!saved.data.objective)saved.data.objective='Guardar esta fase';if(saved.data.theme&&!saved.data.feeling)saved.data.feeling='Amizade';if(Number(saved.step)>LAST_STEP)saved.step=LAST_STEP}return json(saved,200,cookie)}
if(request.method==='PUT'){
if(request.headers.get('origin')!==url.origin)return json({error:'Origem inválida'},403);
if(!request.headers.get('content-type')?.includes('application/json'))return json({error:'Formato inválido'},415);
const raw=await request.text();
if(raw.length>MAX_BODY)return json({error:'Arquivo muito grande'},413);
let body;try{body=JSON.parse(raw)}catch{return json({error:'Dados inválidos'},400)}
if(!draftOk(body))return json({error:'Dados inválidos'},400);
body.data.language='Português (BR)';
if(!body.data.style)body.data.style='Cartoon mágico';
if(!body.data.objective)body.data.objective='Guardar esta fase';
if(body.data.theme&&!body.data.feeling)body.data.feeling='Amizade';
body.updatedAt=new Date().toISOString();
await env.BUCKET.put(key,JSON.stringify(body),{httpMetadata:{contentType:'application/json'}});
await saveDraftIndex(env,token,body);
await registerFunnelStep(env,token,body.step);
return json({saved:true},200,cookie)}
return json({error:'Método não permitido'},405)}
if(url.pathname==='/api/admin/book'||url.pathname==='/api/admin/pdf'){
const settings=await resolvedOrderSettings(env);
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
const settings=await resolvedOrderSettings(env);
if(!settings.admin)return json({error:'Administração não configurada: defina ADMIN_TOKEN.'},503,cookie);
if(url.searchParams.get('token')!==settings.admin)return json({error:'Token inválido'},403,cookie);
if(request.method!=='POST')return json({error:'Método não permitido'},405,cookie);
if(!request.headers.get('content-type')?.includes('application/json'))return json({error:'Formato inválido'},415,cookie);
let body;try{body=await request.json()}catch{return json({error:'Dados inválidos'},400,cookie)}
const record=await updateOrderStatus(env,url.searchParams.get('code')||'',body&&body.status);
if(!record)return json({error:'Pedido ou status inválido'},400,cookie);
return json({ok:true,code:record.code,status:record.status,updatedAt:record.updatedAt},200,cookie)}
if(url.pathname==='/api/admin/settings'){
const settings=await resolvedOrderSettings(env);
if(!settings.admin)return json({error:'Administração não configurada: defina ADMIN_TOKEN.'},503,cookie);
if(url.searchParams.get('token')!==settings.admin)return json({error:'Token inválido'},403,cookie);
if(!env.BUCKET)return json({error:'Armazenamento indisponível'},503,cookie);
if(request.method==='GET')return json({shop:settings.shop,whatsapp:settings.whatsapp,price:settings.price,pix:settings.pix,pixCopyPaste:settings.pixCopyPaste||'',storagePersistent:Boolean(settings.storagePersistent),whatsappCloudConfigured:Boolean(settings.token&&settings.phoneId),aiConfigured:Boolean(cleanText(env.AI_API_KEY)||cleanText(env.OPENAI_API_KEY))},200,cookie);
if(request.method!=='POST')return json({error:'Método não permitido'},405,cookie);
const requestOrigin=request.headers.get('origin');if(requestOrigin&&requestOrigin!==url.origin)return json({error:'Origem inválida'},403,cookie);
if(!request.headers.get('content-type')?.includes('application/json'))return json({error:'Formato inválido'},415,cookie);
let body;try{body=await request.json()}catch{return json({error:'Dados inválidos'},400,cookie)}
const clean=sanitizeAdminPreferences(body);
if(!clean.shop)return json({error:'Informe o nome da loja.'},400,cookie);
if(clean.whatsapp&&clean.whatsapp.length<12)return json({error:'Informe um WhatsApp válido com DDI e DDD.'},400,cookie);
if(!clean.price)return json({error:'Informe o preço.'},400,cookie);
await saveAdminPreferences(env,clean);
const updated=await resolvedOrderSettings(env);
return json({ok:true,shop:updated.shop,whatsapp:updated.whatsapp,price:updated.price,pix:updated.pix,pixCopyPaste:updated.pixCopyPaste||'',storagePersistent:Boolean(updated.storagePersistent)},200,cookie)}
if(url.pathname==='/api/shop'){const settings=await resolvedOrderSettings(env);return json({shop:settings.shop,price:settings.price,pix:settings.pix,pixCopyPaste:settings.pixCopyPaste||'',whatsappConfigured:Boolean(settings.whatsapp),adminConfigured:Boolean(settings.admin),storagePersistent:Boolean(settings.storagePersistent)},200,cookie)}
if(url.pathname==='/api/visits'){const stats=await visitStats(env);return json(stats,200,cookie)}
if(url.pathname==='/api/order'){
if(!env.BUCKET)return json({error:'Pedidos indisponíveis'},503,cookie);
const settings=await resolvedOrderSettings(env);
if(request.method==='POST'){
if(request.headers.get('origin')!==url.origin)return json({error:'Origem inválida'},403);
const draftObject=await env.BUCKET.get('briefings/'+token+'.json');
if(!draftObject)return json({error:'Preencha o formulário antes de enviar o pedido.'},400,cookie);
const draft=await draftObject.json();
const briefing=(draft&&draft.data)||{};
briefing.language='Português (BR)';
if(!briefing.style)briefing.style='Cartoon mágico';
if(!briefing.objective)briefing.objective='Guardar esta fase';
if(briefing.theme&&!briefing.feeling)briefing.feeling='Amizade';
const missing=requiredBriefingFields(briefing);
if(missing.length)return json({error:'Faltam informações: '+missing.join(', ')+'.'},400,cookie);
const customerWhatsapp=cleanText(briefing.whatsapp).replace(/[^0-9]/g,'');if(customerWhatsapp.length<10||customerWhatsapp.length>15)return json({error:'Informe um WhatsApp válido com DDD para enviar o pedido.'},400,cookie);
const code=orderCode();
const accessToken=await orderAccessToken(code,settings.secret);
const link=url.origin+orderLink(code,accessToken);
const summary=orderSummary(briefing,code,settings,link);
const record={code,accessToken,status:'novo',total:settings.price,createdAt:new Date().toISOString(),briefing,summary,story:null,notified:{sent:false,reason:''}};
try{record.notified=await sendOrderToWhatsApp(settings,summary,briefing)}catch(error){record.notified={sent:false,reason:error.message}}
await saveOrderRecord(env,record);
await registerFunnelOrder(env,token);
await removeDraftIndex(env,token);
return json({code,link,waLink:orderWhatsAppLink(settings,summary),summary,shop:settings.shop,price:settings.price,pix:settings.pix,pixCopyPaste:settings.pixCopyPaste||'',whatsappConfigured:Boolean(settings.whatsapp),painelConfigured:Boolean(settings.admin),notified:record.notified},200,cookie)}
return json({error:'Método não permitido'},405)}
if(url.pathname.startsWith('/pedido/')){
if(!env.BUCKET)return json({error:'Pedidos indisponíveis'},503,cookie);
const settings=await resolvedOrderSettings(env);
const record=await readOrderRecord(env,decodeURIComponent(url.pathname.slice('/pedido/'.length)));
const access=url.searchParams.get('t')||'';
const allowed=Boolean(record)&&(access===record.accessToken||(settings.admin&&access===settings.admin));
if(!allowed)return new Response(orderNotFoundHtml(),{status:404,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex, nofollow',...cookie}});
return new Response(orderPageHtml(record,settings,url.origin,Boolean(settings.admin&&access===settings.admin)),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex, nofollow','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; form-action 'none'; base-uri 'none'",...cookie}})}
if(url.pathname==='/painel'){
const settings=await resolvedOrderSettings(env);
if(!settings.admin)return json({error:'Painel não configurado: defina ADMIN_TOKEN.'},503,cookie);
if(url.searchParams.get('token')!==settings.admin)return json({error:'Token inválido'},403,cookie);
if(!env.BUCKET)return json({error:'Pedidos indisponíveis'},503,cookie);
const view=url.searchParams.get('view')||'dashboard';
if(view==='config'){
const info={aiConfigured:Boolean(cleanText(env.AI_API_KEY)||cleanText(env.OPENAI_API_KEY))};
return new Response(adminSettingsHtml(settings,settings.admin,info),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex, nofollow','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src data:; base-uri 'none'",...cookie}})}
const remove=orderCleanCode(url.searchParams.get('apagar')||'');
if(remove)await deleteOrderRecord(env,remove);
return new Response(painelHtml(await orderIndex(env),settings,settings.admin,url.origin,await draftIndex(env),await visitStats(env),await funnelStats(env)),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex, nofollow','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src data:; base-uri 'none'",...cookie}})}
if(url.pathname.startsWith('/api/'))return json({error:'Não encontrado'},404);
if(!['GET','HEAD'].includes(request.method))return new Response('Método não permitido',{status:405});
const path=url.pathname.length>1?(url.pathname.replace(/\/+$/,'')||'/'):url.pathname;
const route=ROUTES.get(path);
const explicit=route!==undefined&&path.startsWith('/criar/');
if(request.method==='GET'){await registerVisit(env,token);await registerFunnelStep(env,token,route===undefined?0:route)}
return new Response(request.method==='HEAD'?null:page(route===undefined?0:route,explicit),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'same-origin','content-security-policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",...cookie}})
}catch(e){console.error('Briefing request failed',e.message);return json({error:'Não foi possível concluir. Tente novamente.'},500,cookie)}}};
