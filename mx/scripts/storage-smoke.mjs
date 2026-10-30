// Production-only integration smoke test for the isolated MX Supabase Edge storage.
// Runs at build time, creates disposable data and removes it.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const base = (process.env.SUPABASE_URL || '').replace(/\/+$/,'');
const key = process.env.SUPABASE_PUBLISHABLE_KEY || '';
const secret = process.env.SUPABASE_MX_STORAGE_SECRET || '';
if (!base || !key || !secret) throw Error('MX Supabase environment is not configured');
const endpoint = base + '/functions/v1/fc-mx-storage';
const headers = {apikey:key,'x-fc-mx-storage-secret':secret};
async function send(action, params, method='POST') {
  const response = await fetch(endpoint + '?action=' + encodeURIComponent(action), {
    method,headers:{...headers,'content-type':'application/json'},body:JSON.stringify(params),
    signal:AbortSignal.timeout(20000),
  });
  if(!response.ok)throw Error('MX storage '+action+' returned HTTP '+response.status);
  return response.json();
}
const health=await fetch(endpoint+'?action=health',{headers,signal:AbortSignal.timeout(20000)});
if (!health.ok) throw Error('MX Supabase gateway unavailable: HTTP '+health.status);
const state=await health.json();
assert.equal(state.store,'fc_mx_objects');
assert.equal(state.bucket,'fc-previews-mx');
const id=randomUUID().replaceAll('-','');
const recordKey='checks/deployment-'+id+'.json';
const imagePath='check'+id+'/preview.png';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aYl8AAAAASUVORK5CYII=','base64');
let recordCreated=false,imageCreated=false;
try{
  const value=JSON.stringify({kind:'deployment-test',id});
  await send('put',{key:recordKey,value});recordCreated=true;
  assert.equal(await send('get',{key:recordKey}),value);
  assert((await send('list',{prefix:'checks/deployment-'+id,limit:5})).some(item=>item.key===recordKey));
  const putImage=await fetch(endpoint+'?action=media-put&path='+encodeURIComponent(imagePath), {
    method:'POST',headers:{...headers,'content-type':'image/png'},body:png,signal:AbortSignal.timeout(25000),
  });
  if(!putImage.ok)throw Error('MX storage media-put returned HTTP '+putImage.status);
  imageCreated=true;
  assert.equal((await putImage.json()).ref,'media://'+imagePath);
  const getImage=await fetch(endpoint+'?action=media-get&path='+encodeURIComponent(imagePath),{
    headers,signal:AbortSignal.timeout(25000),
  });
  if(!getImage.ok)throw Error('MX storage media-get returned HTTP '+getImage.status);
  assert(Buffer.from(await getImage.arrayBuffer()).equals(png),'MX image persisted bytes differ');
  console.log('MX Supabase persistent KV + private image upload/read: OK');
}finally{
  if(imageCreated){
    const response=await fetch(endpoint+'?action=media-delete&path='+encodeURIComponent(imagePath),{
      method:'DELETE',headers,signal:AbortSignal.timeout(20000),
    });
    if(!response.ok)console.error('MX image cleanup failed with status '+response.status);
  }
  if(recordCreated)await send('delete',{key:recordKey});
}
