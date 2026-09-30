import{mkdir,readFile,writeFile,copyFile}from'node:fs/promises';import{existsSync}from'node:fs';
// O Worker gerado é um único módulo ESM: HTML embutido + módulos do worker na ordem abaixo.
await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});
const html=await readFile('worker/page.html','utf8');
const modules=['worker/story.js','worker/pdf.js','worker/order.js','worker/server.js'];
const parts=[];
for(const file of modules){const code=await readFile(file,'utf8');parts.push('// ---- '+file+' ----\n'+code.trim()+'\n')}
await writeFile('dist/server/index.js','const HTML='+JSON.stringify(html)+';\n'+parts.join('\n'));
if(existsSync('.openai/hosting.json'))await copyFile('.openai/hosting.json','dist/.openai/hosting.json');else console.log('Aviso: .openai/hosting.json não encontrado; manifesto de hosting não foi copiado.');
