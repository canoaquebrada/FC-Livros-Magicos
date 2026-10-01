import{mkdir,readFile,writeFile,copyFile}from'node:fs/promises';import{existsSync}from'node:fs';
// O Worker gerado é um único módulo ESM: HTML embutido + módulos do worker na ordem abaixo.
await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});await mkdir('public',{recursive:true});
const html=await readFile('worker/page.html','utf8');
const quizHtml=await readFile('worker/quiz.html','utf8');
const modules=['worker/story.js','worker/pdf.js','worker/order.js','worker/server.js'];
const parts=[];
for(const file of modules){const code=await readFile(file,'utf8');parts.push('// ---- '+file+' ----\n'+code.trim()+'\n')}
await writeFile('dist/server/index.js','const HTML='+JSON.stringify(html)+';\nconst QUIZ_HTML='+JSON.stringify(quizHtml)+';\n'+parts.join('\n'));
// A Vercel exige que o outputDirectory exista após o build.
// As rotas reais continuam sendo atendidas pela Function em /api via vercel.json.
await writeFile('public/index.html','<!doctype html><meta charset="utf-8"><title>FC Livros Mágicos</title><p>FC Livros Mágicos</p>');
if(existsSync('.openai/hosting.json'))await copyFile('.openai/hosting.json','dist/.openai/hosting.json');else console.log('Aviso: .openai/hosting.json não encontrado; manifesto de hosting não foi copiado.');
