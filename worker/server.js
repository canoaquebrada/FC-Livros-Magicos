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
if(request.method==='GET'){await registerQuizVisit(env,token);await registerQuizJourneyVisit(env,token,request,url)}
return new Response(request.method==='HEAD'?null:QUIZ_HTML,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'same-origin','x-robots-tag':'noindex, nofollow','content-security-policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://dnznrvs05pmza.cloudfront.net https://d2ol7oe51mr4n9.cloudfront.net; connect-src 'self'; frame-src https://pay.finaliza.shop; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",...cookie}})}
if(url.pathname==='/api/quiz-event'){
if(request.method!=='POST')return json({error:'Método não permitido'},405,cookie);
const requestOrigin=request.headers.get('origin');if(requestOrigin&&requestOrigin!==url.origin)return json({error:'Origem inválida'},403,cookie);
if(!request.headers.get('content-type')?.includes('application/json'))return json({error:'Formato inválido'},415,cookie);
let body;try{body=await request.json()}catch{return json({error:'Dados inválidos'},400,cookie)}
const record=await registerQuizJourneyEvent(env,token,body&&body.event);
return record?json({ok:true},200,cookie):json({error:'Evento inválido'},400,cookie)}
if(url.pathname==='/api/quiz-limit'){
if(request.method!=='GET')return json({error:'Método não permitido'},405,cookie);
const settings=await resolvedOrderSettings(env);
const storeNumber=cleanText(settings.whatsapp).replace(/[^0-9]/g,'');
const waLink=storeNumber?'https://wa.me/'+storeNumber+'?text='+encodeURIComponent('Olá! Atingi o limite de prévias no site da FC Artes Digitais e gostaria de solicitar liberação para gerar novamente.'):'';
return json({...publicQuizGenerationStatus(await quizGenerationStatus(env,token)),waLink},200,cookie)}
if(url.pathname==='/api/preview'){
if(request.method!=='POST')return json({error:'Método não permitido'},405,cookie);
const requestOrigin=request.headers.get('origin');if(requestOrigin&&requestOrigin!==url.origin)return json({error:'Origem inválida'},403,cookie);
if(!request.headers.get('content-type')?.includes('application/json'))return json({error:'Formato inválido'},415,cookie);
const raw=await request.text();if(raw.length>9000000)return json({error:'A foto ficou grande demais. Escolha outra imagem.'},413,cookie);
let body;try{body=JSON.parse(raw)}catch{return json({error:'Dados inválidos'},400,cookie)}
const typeMap={
  casal:'casal romântico',
  familia:'família',
  infantil:'retrato infantil',
  pet:'retrato de pet',
  caricatura:'caricatura digital',
  homenagem:'homenagem afetiva'
};
const styleMap={
  studio:'estúdio profissional com fundo clean e iluminação suave',
  praia:'praia bonita com luz natural',
  jeans:'ensaio moderno com roupas jeans elegantes e camiseta clara',
  cartoon:'arte ilustrada moderna, sofisticada e bem acabada',
  casal_jeans:'Casal Jeans',
  casal_claras:'Casal Roupas Claras',
  casal_coloridas:'Casal Roupas Coloridas',
  casal_praia:'Casal Praia Romântica',
  casal_social:'Casal Social Elegante',
  casal_pb:'Casal Preto e Branco'
};

const photoIdentityPrompt={
  casal:'CASAL: mantenha exatamente as duas pessoas da foto, sem trocar, misturar, duplicar ou remover ninguém. Preserve individualmente o rosto de cada pessoa, idade aparente, formato facial, cabelo, linha do cabelo, sobrancelhas, olhos, nariz, boca, dentes quando visíveis, tom e textura natural da pele, formato corporal e diferença de altura/proporção entre os dois. O resultado deve continuar claramente reconhecível como o mesmo casal.',
  familia:'FAMÍLIA: mantenha exatamente todas as pessoas que aparecem na foto de referência, sem criar, duplicar, apagar ou substituir ninguém. Preserve a identidade facial de cada integrante separadamente, idade aparente, cabelo, tom de pele, formato corporal, diferença de altura e proporção entre adultos e crianças. Não fundir rostos, braços, mãos ou corpos.',
  infantil:'INFANTIL: preserve rigorosamente a identidade da criança e sua idade aparente. Não envelhecer, rejuvenescer, adultizar ou modificar o formato real do rosto. Manter cabelo, olhos, nariz, boca, tom de pele, expressão natural e proporções infantis. Roupas, pose e produção devem ser adequadas à idade, sem maquiagem adulta, sensualização ou aparência de adulto.',
  pet:'PET: preserve rigorosamente o mesmo animal da foto. Manter espécie, raça ou tipo aparente, formato do focinho, olhos, orelhas, pelagem, cores, manchas, marcas características, porte, patas, cauda e proporções reais. Não transformar o pet em outro animal, não humanizar a anatomia, não criar patas extras e não duplicar o animal.',
  caricatura:'CARICATURA: transforme o mesmo sujeito da foto em uma caricatura digital moderna e premium, mantendo máxima semelhança e reconhecimento. Estilize de forma leve e elegante, sem deformar exageradamente rosto, corpo ou características pessoais. Preserve idade aparente, cabelo, olhos, nariz, boca, tom de pele e traços marcantes. Se houver mais de uma pessoa ou pet, preservar cada identidade separadamente.',
  homenagem:'HOMENAGEM: criar uma composição afetiva, respeitosa, delicada e elegante usando exclusivamente os sujeitos presentes na foto de referência. Preserve rigorosamente rosto, idade aparente, cabelo, tom de pele e proporções de cada pessoa ou características do pet. Não inventar pessoas, parentes ou animais. Não adicionar asas, auréolas, figuras religiosas, textos ou símbolos que não tenham sido solicitados.'
};

const commonStylePromptMap={
  studio:'ESTILO ESTÚDIO PROFISSIONAL: retrato fotográfico realista em estúdio, fundo clean neutro em branco, cinza claro ou bege suave, iluminação principal softbox ampla e preenchimento delicado, aparência de lente 85 mm, pele natural, nitidez nos olhos e acabamento editorial premium. Pose natural e elegante, sem aparência artificial.',
  praia:'ESTILO PRAIA: retrato fotográfico realista em praia bonita e limpa, mar e areia ao fundo, luz natural suave de manhã ou fim de tarde, céu equilibrado e cores naturais. Integrar o sujeito ao cenário com sombras e direção de luz coerentes, sem aparência de recorte ou colagem.',
  jeans:'ESTILO JEANS: para pessoas, usar roupas modernas e elegantes em jeans azul combinadas com peças neutras claras, sem estampas chamativas; composição de ensaio profissional casual e sofisticado. Para pet, NÃO colocar roupa humana: manter o animal natural e usar apenas cenário editorial em tons de jeans/azul ou, no máximo, um acessório simples e confortável como bandana ou coleira.',
  cartoon:'ESTILO ARTE ILUSTRADA: ilustração digital premium, moderna e sofisticada, traços limpos, acabamento semelhante a pintura digital/vetorial de alta qualidade, iluminação suave, volumes bem definidos e cores harmoniosas. Manter alta semelhança com a referência e evitar aparência infantilizada, genérica ou exageradamente deformada.'
};

const couplePromptMap={
  casal_jeans:'ENSAIO CASAL JEANS: foto profissional romântica e realista em estúdio. Os dois usam looks coordenados em jeans azul com peças neutras brancas ou claras, elegantes e sem estampas fortes. Fundo cinza neutro ou cinza azulado, iluminação softbox suave, pele natural, nitidez facial e acabamento editorial. A pose deve seguir SOMENTE a posição escolhida abaixo.',
  casal_claras:'ENSAIO CASAL ROUPAS CLARAS: foto profissional romântica, delicada e realista. Os dois usam roupas elegantes em branco, off-white, creme ou bege, sem transparência e sem estampas fortes. Fundo claro clean em branco, bege suave ou cinza muito claro, iluminação macia, pele natural e acabamento premium. A pose deve seguir SOMENTE a posição escolhida abaixo.',
  casal_coloridas:'ENSAIO CASAL ROUPAS COLORIDAS: foto profissional romântica e realista com roupas sofisticadas em cores harmoniosas e complementares, como verde, vinho, azul, terracota ou vermelho elegante, sem estampas exageradas. Fundo de estúdio neutro ou quente, iluminação suave e acabamento editorial. A pose deve seguir SOMENTE a posição escolhida abaixo.',
  casal_praia:'ENSAIO CASAL PRAIA ROMÂNTICA: foto profissional realista na praia, com mar e areia ao fundo, luz natural suave de manhã ou fim de tarde e sombras coerentes. Roupas leves, elegantes e harmoniosas, apropriadas para praia sem exageros. Composição afetiva e natural, sem aparência de montagem. A pose deve seguir SOMENTE a posição escolhida abaixo.',
  casal_social:'ENSAIO CASAL SOCIAL ELEGANTE: retrato sofisticado e realista em estúdio premium. Homem com camisa social, blazer ou terno elegante; mulher com vestido discreto, conjunto sofisticado ou roupa social elegante, sem transparência e sem excesso de decote. Fundo cinza, grafite, bege escuro ou preto suave; iluminação cinematográfica de estúdio. A pose deve seguir SOMENTE a posição escolhida abaixo.',
  casal_pb:'ENSAIO CASAL PRETO E BRANCO: retrato profissional monocromático, elegante e atemporal. Iluminação suave de estúdio, contraste equilibrado, textura natural da pele e detalhes preservados no cabelo e nas roupas. A imagem final deve ser integralmente em preto e branco, sem cor seletiva. A pose deve seguir SOMENTE a posição escolhida abaixo.'
};

const couplePoseMap={
  '1':'POSIÇÃO 1 — ABRAÇO DE PÉ: casal de pé, lado a lado e levemente voltado para a câmera, abraçados de frente ou pela cintura, corpos próximos, mãos naturais e expressão romântica. Não sentar nenhum dos dois.',
  '2':'POSIÇÃO 2 — ELE SENTADO, ELA ATRÁS: homem sentado à frente; mulher em pé ou levemente inclinada atrás dele, abraçando-o pelos ombros e pelo peito. Os dois olhando para a câmera. Não inverter as posições.',
  '3':'POSIÇÃO 3 — FRENTE A FRENTE: casal de pé frente a frente, rostos próximos, testas ou narizes quase encostando, mãos naturais no rosto, braço ou cintura do parceiro, expressão delicada. Não transformar em beijo nem esconder os rostos.',
  '4':'POSIÇÃO 4 — ABRAÇO POR TRÁS: homem em pé atrás da mulher, abraçando-a pela cintura ou parte superior do tronco; mulher à frente, ambos visíveis e com rostos livres. Não sentar o homem e não inverter quem fica atrás.',
  '5':'POSIÇÃO 5 — SENTADOS JUNTOS: casal sentado lado a lado em banco, cadeira, sofá ou chão adequado ao cenário, corpos próximos e abraçados, pernas e mãos anatomicamente naturais, expressão relaxada e romântica.'
};

function photoStylePrompt(type,style){
  if(type==='casal')return couplePromptMap[style]||'';
  const base=commonStylePromptMap[style]||'';
  if(type==='homenagem'&&style==='cartoon')return 'ESTILO HOMENAGEM ILUSTRADA: pintura digital elegante e sensível, acabamento artístico sofisticado, luz suave e atmosfera acolhedora. Evitar caricatura cômica ou exagerada. Manter máxima fidelidade às pessoas ou pets da referência.';
  if(type==='caricatura'&&style==='studio')return 'CARICATURA EM ESTÚDIO: caricatura digital premium com aparência de retrato profissional, fundo clean neutro, iluminação suave de estúdio, traços bem definidos e estilização moderada. Não transformar em fotografia; manter claramente o acabamento ilustrado.';
  if(type==='caricatura'&&style==='praia')return 'CARICATURA NA PRAIA: caricatura digital premium mantendo os mesmos traços e identidade, com cenário de praia bonito, luz natural suave, cores equilibradas e integração coerente entre personagem e fundo.';
  if(type==='caricatura'&&style==='jeans')return 'CARICATURA JEANS: caricatura digital premium com roupa jeans moderna e elegante para pessoas, fundo sofisticado e iluminação suave. Se o sujeito for pet, não vestir roupa humana; usar apenas elementos visuais em tons de azul/jeans.';
  if(type==='caricatura'&&style==='cartoon')return 'CARICATURA DIGITAL PREMIUM: desenho moderno e sofisticado, traços limpos, volumes suaves, alta semelhança facial e estilização controlada. Não exagerar cabeça, olhos, nariz, boca ou corpo. Resultado elegante, não cômico.';
  return base;
}

const typeLabel=typeMap[body.type],styleLabel=styleMap[body.style];
const poseKey=cleanText(body.pose);
const allowedStyle=body.type==='casal'?Boolean(couplePromptMap[body.style]):Boolean(commonStylePromptMap[body.style]);
const customerName=cleanText(body.customerName).slice(0,80);
let customerWhatsapp=cleanText(body.customerWhatsapp).replace(/[^0-9]/g,'');
if((customerWhatsapp.length===10||customerWhatsapp.length===11)&&!customerWhatsapp.startsWith('55'))customerWhatsapp='55'+customerWhatsapp;
if(customerWhatsapp&&(customerWhatsapp.length<12||customerWhatsapp.length>15))customerWhatsapp='';
if(!customerWhatsapp)return json({error:'Informe um WhatsApp válido com DDD para gerar a prévia.'},400,cookie);

if(!typeLabel||!styleLabel||!allowedStyle||!photoOk(body.photo,8000000)||(body.type==='casal'&&!couplePoseMap[poseKey]))return json({error:'Escolha uma foto, um estilo e uma posição válidos.'},400,cookie);
const settings=await resolvedOrderSettings(env);
const storeNumber=cleanText(settings.whatsapp).replace(/[^0-9]/g,'');
const poseText=body.type==='casal'&&poseKey?' · Posição '+poseKey:'';
const waText='Olá! Eu gerei uma prévia no site da FC Artes Digitais. Tipo: '+typeLabel+'. Estilo: '+styleLabel+poseText+'. Quero finalizar meu pedido.';
const unlockWaText='Olá! Gostei da prévia que gerei no site da FC Artes Digitais. Quero receber a foto final SEM marca d’água. Tipo: '+typeLabel+'. Estilo: '+styleLabel+poseText+'.';
const waLink=storeNumber?'https://wa.me/'+storeNumber+'?text='+encodeURIComponent(waText):'';
const unlockWaLink=storeNumber?'https://wa.me/'+storeNumber+'?text='+encodeURIComponent(unlockWaText):'';
const baseUrl=(cleanText(env.QUACKAPI_BASE_URL)||'https://quackapi.erlancarreira.com.br').replace(/\/+$/,'');
const apiKey=cleanText(env.QUACKAPI_API_KEY);
const model=cleanText(env.QUACKAPI_MODEL)||'duckai/gpt-5.6-luna';
if(!apiKey)return json({preview:body.photo,demo:true,provider:'quackapi',reason:'missing_key',waLink,unlockWaLink,rateLimit:publicQuizGenerationStatus(await quizGenerationStatus(env,token))},200,cookie);
const rateLimit=await consumeQuizGeneration(env,token);
if(!rateLimit.allowed){
  const error=rateLimit.reason==='blocked'?'As novas gerações foram bloqueadas pelo atendimento. Fale conosco no WhatsApp para solicitar liberação.':rateLimit.reason==='daily_limit'?'Você já usou suas 3 prévias gratuitas de hoje. Fale conosco no WhatsApp para continuar.':'Aguarde '+Math.max(1,Math.ceil((rateLimit.retryAfterSeconds||0)/60))+' minuto(s) antes de gerar outra prévia.';
  return json({error,rateLimit:publicQuizGenerationStatus(rateLimit),waLink,unlockWaLink},429,cookie);
}
const identityInstruction=photoIdentityPrompt[body.type]||'';
const styleInstruction=photoStylePrompt(body.type,body.style);
const poseInstruction=body.type==='casal'?' '+couplePoseMap[poseKey]:'';
const prompt=[
  'TAREFA: edite a foto enviada e devolva UMA ÚNICA NOVA IMAGEM final, nunca uma colagem, grade, antes/depois ou várias opções.',
  'REFERÊNCIA OBRIGATÓRIA: use exclusivamente a foto enviada como referência do sujeito. Preserve máxima fidelidade visual e não invente uma nova identidade.',
  identityInstruction,
  styleInstruction,
  poseInstruction,
  'QUALIDADE: composição fotográfica ou ilustrada profissional conforme o estilo escolhido, iluminação coerente, alta nitidez no rosto/olhos, mãos e dedos anatomicamente corretos, braços e pernas completos quando visíveis, perspectiva consistente e fundo bem integrado.',
  'RESTRIÇÕES: não trocar rostos; não misturar feições entre pessoas; não duplicar nem remover sujeitos; não criar pessoas ou pets extras; não mudar gênero, idade aparente, etnia, cor da pele ou características marcantes; não afinar ou engordar o corpo sem pedido; não adicionar tatuagens, piercings, óculos, barba, acessórios ou objetos inexistentes sem necessidade do estilo.',
  'SAÍDA: sem letras, legendas, molduras, logotipos, marcas d’água ou assinatura. Conteúdo apropriado para todas as idades.'
].filter(Boolean).join(' ');

let generated;
try{
const response=await fetch(baseUrl+'/v1/images/generations',{method:'POST',headers:{authorization:'Bearer '+apiKey,'content-type':'application/json'},body:JSON.stringify({model,prompt,image:body.photo,response_format:'b64_json',size:'1024x1024'})});
if(!response.ok){
const detail=(await response.text()).slice(0,800);
console.error('QuackAPI image generation failed',response.status,detail);
await refundQuizGeneration(env,token,rateLimit);
return json({preview:body.photo,demo:true,provider:'quackapi',reason:'generation_failed',status:response.status,waLink,unlockWaLink,rateLimit:publicQuizGenerationStatus(await quizGenerationStatus(env,token))},200,cookie);
}
generated=await response.json();
}catch(error){
console.error('QuackAPI image request failed',error&&error.message?error.message:error);
await refundQuizGeneration(env,token,rateLimit);
return json({preview:body.photo,demo:true,provider:'quackapi',reason:'request_failed',waLink,unlockWaLink,rateLimit:publicQuizGenerationStatus(await quizGenerationStatus(env,token))},200,cookie);
}
const item=generated&&generated.data&&generated.data[0];
if(!item){await refundQuizGeneration(env,token,rateLimit);return json({preview:body.photo,demo:true,provider:'quackapi',reason:'empty_response',waLink,unlockWaLink,rateLimit:publicQuizGenerationStatus(await quizGenerationStatus(env,token))},200,cookie);}
if(typeof item.b64_json==='string'&&item.b64_json.length>50){const preview='data:image/jpeg;base64,'+item.b64_json;const saved=await saveQuizPreviewRecord(env,{sessionToken:token,customerName,customerWhatsapp,type:typeLabel,style:styleLabel,pose:body.type==='casal'?poseKey:'',model,provider:'quackapi',original:body.photo,preview,revisedPrompt:item.revised_prompt||'',status:'gerada'});return json({preview,demo:false,provider:'quackapi',model,revisedPrompt:item.revised_prompt||'',previewId:saved&&saved.id?saved.id:'',waLink,unlockWaLink,rateLimit:publicQuizGenerationStatus({...rateLimit,allowed:true,reason:'accepted',retryAfterSeconds:0})},200,cookie)}
if(typeof item.url==='string'&&item.url){const preview=item.url;const saved=await saveQuizPreviewRecord(env,{sessionToken:token,customerName,customerWhatsapp,type:typeLabel,style:styleLabel,pose:body.type==='casal'?poseKey:'',model,provider:'quackapi',original:body.photo,preview,revisedPrompt:item.revised_prompt||'',status:'gerada'});return json({preview,demo:false,provider:'quackapi',model,revisedPrompt:item.revised_prompt||'',previewId:saved&&saved.id?saved.id:'',waLink,unlockWaLink,rateLimit:publicQuizGenerationStatus({...rateLimit,allowed:true,reason:'accepted',retryAfterSeconds:0})},200,cookie)}
if(item.id){
try{
const imageResponse=await fetch(baseUrl+'/v1/images/content/'+encodeURIComponent(item.id),{headers:{authorization:'Bearer '+apiKey}});
if(imageResponse.ok){
const imageBytes=new Uint8Array(await imageResponse.arrayBuffer());
let binary='';for(let i=0;i<imageBytes.length;i+=8192)binary+=String.fromCharCode(...imageBytes.subarray(i,i+8192));
const contentType=(imageResponse.headers.get('content-type')||'image/jpeg').split(';')[0];
const preview='data:'+contentType+';base64,'+btoa(binary);const saved=await saveQuizPreviewRecord(env,{sessionToken:token,customerName,customerWhatsapp,type:typeLabel,style:styleLabel,pose:body.type==='casal'?poseKey:'',model,provider:'quackapi',original:body.photo,preview,revisedPrompt:item.revised_prompt||'',status:'gerada'});return json({preview,demo:false,provider:'quackapi',model,revisedPrompt:item.revised_prompt||'',previewId:saved&&saved.id?saved.id:'',waLink,unlockWaLink,rateLimit:publicQuizGenerationStatus({...rateLimit,allowed:true,reason:'accepted',retryAfterSeconds:0})},200,cookie);
}
}catch(error){console.error('QuackAPI image content fetch failed',error&&error.message?error.message:error)}
}
await refundQuizGeneration(env,token,rateLimit);
return json({preview:body.photo,demo:true,provider:'quackapi',reason:'unsupported_image_response',waLink,unlockWaLink,rateLimit:publicQuizGenerationStatus(await quizGenerationStatus(env,token))},200,cookie)}
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
if(url.pathname==='/api/admin/preview-image'){
const settings=await resolvedOrderSettings(env);
if(!settings.admin)return json({error:'Administração não configurada: defina ADMIN_TOKEN.'},503,cookie);
if(url.searchParams.get('token')!==settings.admin)return json({error:'Token inválido'},403,cookie);
if(request.method!=='GET'&&request.method!=='HEAD')return json({error:'Método não permitido'},405,cookie);
const record=await readQuizPreviewRecord(env,url.searchParams.get('id')||'');
if(!record)return json({error:'Prévia não encontrada'},404,cookie);
const kind=url.searchParams.get('kind')==='original'?'original':'preview';
const value=cleanText(record[kind]);
if(!value)return json({error:'Imagem não encontrada'},404,cookie);
if(/^media:\/\//i.test(value)){
  if(!env.MEDIA||typeof env.MEDIA.getImage!=='function')return json({error:'Storage de imagem indisponível'},503,cookie);
  const media=await env.MEDIA.getImage(value);
  if(!media)return json({error:'Imagem não encontrada'},404,cookie);
  return new Response(request.method==='HEAD'?null:media.bytes,{headers:{'content-type':media.contentType||'image/jpeg','cache-control':'private, no-store','content-disposition':url.searchParams.get('download')==='1'?'attachment; filename="fc-previa-'+orderCleanCode(record.id||'foto')+'.jpg"':'inline',...cookie}})
}
if(/^https?:\/\//i.test(value)){const remote=await fetch(value);if(!remote.ok)return json({error:'Imagem indisponível'},502,cookie);const bytes=new Uint8Array(await remote.arrayBuffer());return new Response(request.method==='HEAD'?null:bytes,{headers:{'content-type':remote.headers.get('content-type')||'image/jpeg','cache-control':'private, no-store','content-disposition':url.searchParams.get('download')==='1'?'attachment; filename="fc-previa-'+orderCleanCode(record.id||'foto')+'.jpg"':'inline',...cookie}})}
const match=value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
if(!match)return json({error:'Formato de imagem inválido'},415,cookie);
const bytes=Uint8Array.from(atob(match[2]),ch=>ch.charCodeAt(0));
return new Response(request.method==='HEAD'?null:bytes,{headers:{'content-type':match[1],'cache-control':'private, no-store','content-disposition':url.searchParams.get('download')==='1'?'attachment; filename="fc-previa-'+orderCleanCode(record.id||'foto')+'.jpg"':'inline',...cookie}})}
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
if(url.pathname==='/api/admin/preview-status'){
const settings=await resolvedOrderSettings(env);
if(!settings.admin)return json({error:'Administração não configurada'},503,cookie);
if(url.searchParams.get('token')!==settings.admin)return json({error:'Token inválido'},403,cookie);
if(request.method!=='POST')return json({error:'Método não permitido'},405,cookie);
let body;try{body=await request.json()}catch{return json({error:'Dados inválidos'},400,cookie)}
const updated=await updateQuizPreviewCrmStatus(env,body&&body.id,body&&body.status);
if(!updated)return json({error:'Prévia ou status inválido'},400,cookie);
return json({ok:true,item:updated},200,cookie)}
if(url.pathname==='/api/admin/quiz-access'){
const settings=await resolvedOrderSettings(env);
if(!settings.admin)return json({error:'Administração não configurada: defina ADMIN_TOKEN.'},503,cookie);
if(url.searchParams.get('token')!==settings.admin)return json({error:'Token inválido'},403,cookie);
if(request.method!=='POST')return json({error:'Método não permitido'},405,cookie);
if(!request.headers.get('content-type')?.includes('application/json'))return json({error:'Formato inválido'},415,cookie);
let body;try{body=await request.json()}catch{return json({error:'Dados inválidos'},400,cookie)}
const sessionToken=cleanText(body&&body.sessionToken).slice(0,64),mode=cleanText(body&&body.mode);
if(!/^[a-f0-9]{64}$/.test(sessionToken)||!['auto','allowed','blocked'].includes(mode))return json({error:'Controle inválido'},400,cookie);
const access=await setQuizGenerationMode(env,sessionToken,mode);
return json({ok:true,access},200,cookie)}
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
if(url.pathname==='/api/quiz-visits'){const stats=await quizVisitStats(env);return json(stats,200,cookie)}
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
const remove=orderCleanCode(url.searchParams.get('apagar')||'');
if(remove)await deleteOrderRecord(env,remove);
const view=url.searchParams.get('view')||'quiz-clients';
if(view==='quiz-clients'){
const removePreview=orderCleanCode(url.searchParams.get('apagarPreview')||'');
if(removePreview)await deleteQuizPreviewRecord(env,removePreview);
return new Response(quizClientsAdminHtml(await quizClientsWithGenerationAccess(env),settings,settings.admin,await quizJourneyAnalytics(env),await quizVisitStats(env)),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex, nofollow','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data: https:; base-uri 'none'",...cookie}})}
if(view==='previews'){
const removePreview=orderCleanCode(url.searchParams.get('apagarPreview')||'');
if(removePreview)await deleteQuizPreviewRecord(env,removePreview);
return new Response(previewAdminHtml(await quizPreviewIndex(env),settings,settings.admin),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex, nofollow','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data: https:; base-uri 'none'",...cookie}})}
if(view==='config'){
const info={aiConfigured:Boolean(cleanText(env.AI_API_KEY)||cleanText(env.OPENAI_API_KEY))};
return new Response(adminSettingsHtml(settings,settings.admin,info),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex, nofollow','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data: https:; base-uri 'none'",...cookie}})}
return new Response(painelHtml(await orderIndex(env),settings,settings.admin,url.origin,await draftIndex(env),await visitStats(env),await funnelStats(env),await quizVisitStats(env)),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex, nofollow','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data: https:; base-uri 'none'",...cookie}})}
if(url.pathname.startsWith('/api/'))return json({error:'Não encontrado'},404);
if(!['GET','HEAD'].includes(request.method))return new Response('Método não permitido',{status:405});
const path=url.pathname.length>1?(url.pathname.replace(/\/+$/,'')||'/'):url.pathname;
const route=ROUTES.get(path);
const explicit=route!==undefined&&path.startsWith('/criar/');
if(request.method==='GET'){await registerVisit(env,token);await registerFunnelStep(env,token,route===undefined?0:route)}
return new Response(request.method==='HEAD'?null:page(route===undefined?0:route,explicit),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'same-origin','content-security-policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",...cookie}})
}catch(e){console.error('Briefing request failed',e.message);return json({error:'Não foi possível concluir. Tente novamente.'},500,cookie)}}};
