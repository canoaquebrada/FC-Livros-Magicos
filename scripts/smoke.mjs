// Smoke test do funil enxuto de 5 etapas.
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const html=await readFile('worker/page.html','utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const staticIds=new Set([...html.matchAll(/id="([a-zA-Z][a-zA-Z0-9-]*)"/g)].map(m=>m[1]));
const slugs=[...html.matchAll(/slug:'([a-z]+)'/g)].map(m=>m[1]);
const failures=[];
if(slugs.length!==5)failures.push('o funil não tem exatamente 5 etapas');
if(slugs.join(',')!=='crianca,historia,personagens,personalizacao,finalizar')failures.push('ordem das 5 etapas incorreta: '+slugs.join(','));
if(!html.includes('id="visit-count"'))failures.push('rodapé sem contador de visitas');
if(html.includes("slug:'sentimentos'")||html.includes("slug:'idioma'")||html.includes("slug:'revelacao'"))failures.push('etapas antigas ainda estão no funil');

function makeElement(id){
  return {id,style:{},dataset:{},hidden:false,textContent:'',innerHTML:'',value:'',disabled:false,width:320,height:320,
    addEventListener(){},setPointerCapture(){},setAttribute(){},appendChild(){},focus(){},select(){},click(){},
    getContext(){return{clearRect(){},fillRect(){},drawImage(){},beginPath(){},arc(){},stroke(){},setLineDash(){},putImageData(){},getImageData(){return{data:new Uint8ClampedArray(4)}},filter:'none'}},
    getBoundingClientRect(){return{width:320,height:320}},toDataURL(){return'data:image/jpeg;base64,AAAA'}};
}
const touched=new Set(),contentIds=new Set();
function start(stepIndex){
  const elements=new Map();
  const get=id=>{touched.add(id);if(!elements.has(id))elements.set(id,makeElement(id));return elements.get(id)};
  get('boot').textContent=JSON.stringify({step:stepIndex,explicit:true});
  const context={document:{getElementById:get,querySelectorAll:()=>[],createElement:()=>makeElement('novo'),addEventListener(){},body:makeElement('body')},
    window:{addEventListener(){},scrollTo(){},print(){},open(){return{location:{},close(){}}}},history:{pushState(){}},location:{pathname:'/criar/'+(slugs[stepIndex]||'crianca')},
    fetch:()=>Promise.reject(new Error('offline')),confirm:()=>true,setTimeout,clearTimeout,console,Math,JSON,Promise,Date,
    navigator:{clipboard:{writeText:()=>Promise.resolve()}},
    Image:class{constructor(){this.width=120;this.height=120}set src(value){}get src(){return''}},FileReader:class{readAsDataURL(){}},
    Blob:class{constructor(parts){this.parts=parts}},URL:{createObjectURL:()=>'blob:x',revokeObjectURL(){}}};
  context.globalThis=context;
  vm.createContext(context);
  new vm.Script(script,{filename:'page.html'}).runInContext(context);
  const content=get('content').innerHTML;
  for(const match of content.matchAll(/id="([a-zA-Z][a-zA-Z0-9-]*)"/g))contentIds.add(match[1]);
  return {context,get,content};
}
const contents=[];
slugs.forEach((slug,index)=>{
  const run=start(index);contents.push(run.content);
  const title=/<h1>([^<]*)<\/h1>/.exec(run.content);
  if(!title)failures.push('etapa '+(index+1)+' sem título');
  if(run.get('progress-bar').style.width!==Math.round((index+1)/5*100)+'%')failures.push('progresso errado na etapa '+(index+1));
  if(!run.get('eyebrow').textContent.includes('PASSO '+(index+1)+' DE 5'))failures.push('indicador errado na etapa '+(index+1));
  if(run.content.length<180)failures.push('conteúdo curto na etapa '+(index+1));
});
if(!contents[0].includes('Nome no livro')||!contents[0].includes('Faixa etária')||!contents[0].includes('id="photo"'))failures.push('etapa Criança não reúne nome, idade e foto');
if(!contents[1].includes('Sobre o que')&&!contents[1].includes('Escolha a história'))failures.push('etapa História sem tema');
if(!contents[1].includes('id="style"')||!contents[1].includes('Cartoon mágico'))failures.push('estilo padrão não está dentro da História');
if(!contents[2].includes('Adicionar ao elenco'))failures.push('etapa Personagens ausente');
if(!contents[3].includes('Dê o toque final')||!contents[3].includes('dedication')||!contents[3].includes('details'))failures.push('etapa Personalização incompleta');

const final=start(4).context;
new vm.Script(`data.name='Levi';data.age='0 a 5 anos';data.years='5';data.gender='Menino';data.photo='data:image/jpeg;base64,AAAA';data.theme='Dinossauros';data.feeling='Coragem';data.style='Cartoon mágico';data.objective='Guardar esta fase';data.cast=[{kind:'Bichinho',name:'Mel',detail:'cachorro',photo:''}];data.language='Português (BR)';data.dedication='Com amor';data.details='A praia';data.whatsapp='(85) 99999-9999';shopInfo={shop:'FC Livros Mágicos',price:'R$ 49,90',pix:'pix@exemplo.com',pixCopyPaste:'000201PIXTESTE123456789',whatsappConfigured:true};step=4;render();globalThis.__final=document.getElementById('content').innerHTML;orderSent={code:'ABCD1234EF56',link:'https://exemplo.test/pedido/ABCD1234EF56?t=abc',waLink:'https://wa.me/5511999999999?text=oi',summary:'*Pedido ABCD1234EF56*',price:'R$ 49,90',pix:'pix@exemplo.com',pixCopyPaste:'000201PIXTESTE123456789',notified:{sent:false}};render();globalThis.__sent=document.getElementById('content').innerHTML;`).runInContext(final);
const review=final.__final,sent=final.__sent;
for(const marker of ['Personagens que vão aparecer','Mel','Prévia do personagem','reveal-range','Seu WhatsApp','FINALIZAR E ENVIAR NO WHATSAPP'])if(!review.includes(marker))failures.push('finalização sem "'+marker+'"');
if(!review.includes('PAGAR AGORA VIA PIX')||!review.includes('000201PIXTESTE123456789'))failures.push('finalização sem Pix Copia e Cola');
if(review.includes('Que sentimento a história deve deixar?')||review.includes('Em que língua o livro será lido?'))failures.push('tela final expõe etapas removidas');
if(!sent.includes('Abrir WhatsApp e concluir')||!sent.includes('ABCD1234EF56'))failures.push('pós-envio incompleto');

const missing=[...touched].filter(id=>!staticIds.has(id)&&!contentIds.has(id)&&id!=='boot');
if(missing.length)failures.push('ids ausentes no HTML: '+missing.join(', '));
if(failures.length){console.error('Falhas:\n - '+failures.join('\n - '));process.exit(1)}
console.log('Funil enxuto de 5 etapas validado:');
slugs.forEach((slug,index)=>console.log('  '+(index+1)+'. /criar/'+slug));
