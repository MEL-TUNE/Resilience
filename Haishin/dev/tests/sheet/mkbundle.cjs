// ページの中で動く「Apps Script のまね」を作る（fetch を横取りして、版3のコードを模擬シートで動かす）
const fs=require('fs');
const dir=__dirname+'/';
let mock=fs.readFileSync(dir+'mockgas.cjs','utf8').replace("const fs = require('fs');","").replace(/module\.exports[^\n]*/,'')
  .replace("const code = fs.readFileSync(process.env.GS || __dirname + '/../../otonoha-sheet.gs', 'utf8')","const code = window.__GS");
const fx=fs.readFileSync(dir+'fx_part.json','utf8');
const gs=fs.readFileSync(__dirname+'/../../otonoha-sheet.gs','utf8');
const t=fs.readFileSync(dir+'t_gas.cjs','utf8');
const build=t.slice(t.indexOf('const blank'),t.indexOf('let G = build()'));
const out=`(()=>{window.__GS=${JSON.stringify(gs)};const fx=${fx};
${mock}
${build}
const G=build();window.__G=G;
localStorage.setItem('otonoha-sheet-link',JSON.stringify({url:'https://script.google.com/macros/s/TESTDEPLOY/exec',key:'testkey123456',name:'【試験用】歌枠管理シート'}));
const of=window.fetch.bind(window);
window.__calls=[];
window.fetch=async(u,o={})=>{
  if(!String(u).startsWith('https://script.google.com/'))return of(u,o);
  let p;
  if(o.method==='POST')p=JSON.parse(o.body);else{const q=new URL(u).searchParams;p=Object.fromEntries(q)}
  window.__calls.push({op:p.op,method:o.method||'GET'});
  await new Promise(r=>setTimeout(r,60));
  const txt=G.api.doPost({postData:{contents:JSON.stringify(p)}});
  return new Response(typeof txt==='string'?txt:txt.t,{status:200});
};})();`;
fs.writeFileSync(__dirname+'/bundle.js',out);console.log('bundle',out.length);
