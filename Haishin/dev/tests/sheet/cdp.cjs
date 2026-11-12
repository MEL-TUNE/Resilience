// 小さな CDP の道具（Chrome を headless で開き、ページを操作する）
const {spawn}=require('child_process');
const http=require('http');
async function launch(port=9333){
  const ch=spawn('google-chrome',['--headless=new','--no-sandbox','--disable-gpu','--remote-debugging-port='+port,'--user-data-dir=/tmp/chx'+port,'about:blank'],{stdio:'ignore'});
  for(let i=0;i<50;i++){await new Promise(r=>setTimeout(r,200));try{const j=await new Promise((res,rej)=>http.get('http://127.0.0.1:'+port+'/json',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)))}).on('error',rej));const pg=j.find(x=>x.type==='page');if(pg)return {ch,ws:pg.webSocketDebuggerUrl}}catch(_){}}
  throw Error('chrome did not start')
}
async function connect(url){
  const ws=new WebSocket(url);await new Promise(r=>ws.onopen=r);
  let id=0;const pend=new Map(),ev=[];
  ws.onmessage=m=>{const j=JSON.parse(m.data);if(j.id&&pend.has(j.id)){pend.get(j.id)(j);pend.delete(j.id)}else ev.push(j)};
  const send=(method,params={})=>new Promise((res,rej)=>{const i=++id;pend.set(i,j=>j.error?rej(Error(method+': '+j.error.message)):res(j.result));ws.send(JSON.stringify({id:i,method,params}))});
  const ev_=async(expr)=>{const r=await send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error('page: '+(r.exceptionDetails.exception?.description||r.exceptionDetails.text));return r.result.value};
  return {ws,send,eval:ev_,events:ev}
}
module.exports={launch,connect};
