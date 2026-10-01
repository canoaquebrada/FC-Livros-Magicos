// Verificação de renderização do cliente sem navegador: executa o script de
// worker/page.html em um DOM simulado, uma vez por etapa, e confere títulos,
// indicador de progresso, ids usados pelo script, revisão e prompts das cenas.
// Uso: npm run smoke (requer apenas Node 20+).
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const html=await readFile('worker/page.html','utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const staticIds=new Set([...html.matchAll(/id="([a-zA-Z][a-zA-Z0-9-]*)"/g)].map(match=>match[1]));
const slugs=[...html.matchAll(/slug:'([a-z]+)'/g)].map(match=>match[1]);
function makeElement(id){
  return {id,style:{},dataset:{},hidden:false,textContent:'',innerHTML:'',value:'',disabled:false,width:320,height:320,
    addEventListener(){},setPointerCapture(){},setAttribute(){},appendChild(){},focus(){},click(){},
    getContext(){return{clearRect(){},fillRect(){},drawImage(){},beginPath(){},arc(){},stroke(){},setLineDash(){},putImageData(){},getImageData(){return{data:new Uint8ClampedArray(4)}},filter:'none'}},
    getBoundingClientRect(){return{width:320,height:320}},toDataURL(){return'data:image/jpeg;base64,AAAA'}};
}
const touched=new Set();const contentIds=new Set();
function start(stepIndex){
  const elements=new Map();
  const get=id=>{touched.add(id);if(!elements.has(id))elements.set(id,makeElement(id));return elements.get(id)};
  get('boot').textContent=JSON.stringify({step:stepIndex,explicit:true});
  const context={document:{getElementById:get,querySelectorAll:()=>[],createElement:()=>makeElement('novo'),addEventListener(){},body:makeElement('body')},
    window:{addEventListener(){},scrollTo(){},print(){}},history:{pushState(){}},location:{pathname:'/criar/'+(slugs[stepIndex]||'idade')},
    fetch:()=>Promise.reject(new Error('offline')),confirm:()=>true,setTimeout,clearTimeout,console,Math,JSON,Promise,Date,
    Image:class{constructor(){this.width=120;this.height=120}set src(value){}get src(){return''}},FileReader:class{readAsDataURL(){}},
    Blob:class{constructor(parts){this.parts=parts}},URL:{createObjectURL:()=>'blob:x',revokeObjectURL(){}}};
  context.globalThis=context;
  vm.createContext(context);
  new vm.Script(script,{filename:'page.html'}).runInContext(context);
  const content=get('content').innerHTML;
  for(const match of content.matchAll(/id="([a-zA-Z][a-zA-Z0-9-]*)"/g))contentIds.add(match[1]);
  return {context,get,content};
}
const failures=[];
if((html.match(/Português \(BR\)/g)||[]).length<1)failures.push('Português (BR) não está disponível');
if(!html.includes('id="visit-count"'))failures.push('rodapé sem contador de visitas');
if((html.match(/const languages=\[/g)||[]).length!==1)failures.push('configuração de idioma inválida');
const titles=slugs.map((slug,index)=>{
  const {get,content}=start(index);
  const title=/<h1>([^<]*)<\/h1>/.exec(content);
  if(!title)failures.push('etapa '+(index+1)+': sem título');
  if(get('progress-bar').style.width!==Math.round((index+1)/12*100)+'%')failures.push('etapa '+(index+1)+': barra de progresso errada');
  if(!get('eyebrow').textContent.includes('PASSO '+(index+1)+' DE 12'))failures.push('etapa '+(index+1)+': indicador de passo errado');
  if(content.length<200)failures.push('etapa '+(index+1)+': conteúdo curto demais');
  return title?title[1]:'?';
});
const missing=[...touched].filter(id=>!staticIds.has(id)&&!contentIds.has(id)&&id!=='boot');
if(missing.length)failures.push('ids ausentes no HTML: '+missing.join(', '));
const full=start(11).context;
new vm.Script(`data.name='Levi';data.gender='Menino';data.years='5';data.age='0 a 5 anos';data.theme='Dinossauros';data.feeling='Coragem';data.style='Aquarela';data.language='Português (BR)';data.objective='Guardar esta fase';data.photo='data:image/jpeg;base64,AAAA';data.cast=[{kind:'Bichinho',name:'Mel',detail:'cachorro',photo:''}];data.dedication='Com amor';data.details='A praia';data.whatsapp='123';globalThis.__a={valid:valid(),review:stepContent()};data.whatsapp='(85) 99999-9999';globalThis.__b={valid:valid(),hint:hintText()};step=10;render();globalThis.__c=document.getElementById('content').innerHTML;step=11;shopInfo={shop:'FC Livros Mágicos',price:'R$ 49,90',pix:'pix@exemplo.com',pixCopyPaste:'000201PIXTESTE123456789',whatsappConfigured:true};orderSent={code:'ABCD1234EF56',link:'https://exemplo.test/pedido/ABCD1234EF56?t=abc',waLink:'https://wa.me/5511999999999?text=oi',summary:'*Pedido ABCD1234EF56*',price:'R$ 49,90',pix:'pix@exemplo.com',pixCopyPaste:'000201PIXTESTE123456789',notified:{sent:false},whatsappConfigured:true};render();globalThis.__d=document.getElementById('content').innerHTML;`).runInContext(full);
const first=full.__a;const second=full.__b;const reveal=full.__c;const sent=full.__d;
for(const match of sent.matchAll(/id="([a-zA-Z][a-zA-Z0-9-]*)"/g))contentIds.add(match[1]);
if(first.valid)failures.push('WhatsApp inválido aceito na revisão');
if(!second.valid||second.hint!=='')failures.push('WhatsApp válido recusado na revisão');
if(first.review.includes('book-page'))failures.push('a revisão do cliente ainda exibe páginas de produção');
for(const marker of ['whatsapp','Mel','Aquarela','Português (BR)','Com amor'])if(!first.review.includes(marker))failures.push('revisão sem "'+marker+'"');
if(!first.review.includes('Personagens que vão aparecer')||!first.review.includes('Bichinho')||!first.review.includes('cachorro'))failures.push('revisão não mostra os personagens completos');
if((first.review.match(/data-step="5"/g)||[]).length!==1)failures.push('revisão sem atalho de edição da criança');
if(!first.review.includes('send-order')||!first.review.includes('FINALIZAR E ENVIAR NO WHATSAPP')||!first.review.includes('Seu livro está quase pronto'))failures.push('revisão sem CTA forte do WhatsApp');
if(!first.review.includes('PAGAR AGORA VIA PIX')||!first.review.includes('pix-code')||!first.review.includes('000201PIXTESTE123456789'))failures.push('revisão sem Pix Copia e Cola');
if(first.review.includes('Baixar minhas respostas')||first.review.includes('id="export"'))failures.push('revisão ainda oferece download das respostas do cliente');
for(const leak of ['book-pdf','Gerar história','Orientação para ilustração','Baixar briefing','generate','Prompt:'])if(first.review.includes(leak))failures.push('revisão expõe material de produção: '+leak);
if(!orderBlockCheck(sent))failures.push('bloco do pedido enviado sem código, link do WhatsApp ou cópia do resumo');
for(const leak of ['book-pdf','Gerar história','Orientação para ilustração','generate'])if(sent.includes(leak))failures.push('pós-envio expõe material de produção: '+leak);
function orderBlockCheck(html){return html.includes('ABCD1234EF56')&&html.includes('https://wa.me/5511999999999?text=oi')&&html.includes('copy-order')&&html.includes('open-whatsapp')&&html.includes('Abrir WhatsApp e concluir')}
if(!reveal.includes('reveal-range')||!reveal.includes('book-photo'))failures.push('etapa de prévia sem comparação antes/depois');
if(failures.length){console.error('Falhas:\n - '+failures.join('\n - '));process.exit(1)}
console.log('Renderização das 12 etapas, prévia e revisão (sem material de produção) ok:');
titles.forEach((title,index)=>console.log('  '+(index+1)+'. /criar/'+slugs[index]+' -> '+title));
