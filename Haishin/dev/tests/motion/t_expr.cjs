const {launch,connect}=require('../sheet/cdp.cjs');const assert=require('assert');const fs=require('fs');
(async()=>{const {ch,ws}=await launch(9622);const P=await connect(ws);let fails=0;
const ok=async(n,f)=>{try{await f();console.log('PASS',n)}catch(e){fails++;console.log('FAIL',n,'\n   ',e.message)}};
try{await P.send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
const errs=[];P.ws.addEventListener('message',m=>{const j=JSON.parse(m.data);if(j.method==='Runtime.exceptionThrown')errs.push(j.params.exceptionDetails.exception?.description)});
await P.send('Runtime.enable');
await P.send('Page.navigate',{url:'http://127.0.0.1:8765/page.html'});await new Promise(r=>setTimeout(r,2500));
const E=P.eval;
await E(`window.$=s=>document.querySelector(s);window.$$=s=>[...document.querySelectorAll(s)];window.wait=ms=>new Promise(r=>setTimeout(r,ms));window.S=()=>__otonohaChars.state;true`);
await ok('キャラがあり、表情を足せる',async()=>{
  const r=await E(`(async()=>{const c=S().chars[S().charId];if(!c)return 'no char';$('#exprAdd').click();await wait(100);return {n:c.exprs.length,rows:$$('#exprList .expr-row').length}})()`);
  assert.equal(typeof r,'object',String(r));assert.ok(r.n>=1&&r.rows===r.n,JSON.stringify(r));
});
await ok('連動する動きを「いやいや」にすると、大きさ・速さの欄が出て、名前も変わる',async()=>{
  const r=await E(`(async()=>{const row=$$('#exprList .expr-row').at(-1);const sel=row.querySelector('[data-k=motion]');sel.value='iya';sel.dispatchEvent(new Event('change'));await wait(50);
    const m=row.querySelector('.expr-motion');const a=row.querySelector('[data-k=amt]');a.value='150';a.dispatchEvent(new Event('input'));const sp=row.querySelector('[data-k=spd]');sp.value='70';sp.dispatchEvent(new Event('input'));
    const e=S().chars[S().charId].exprs.at(-1);return {hidden:m.hidden,label:row.querySelector('[data-l=amt]').textContent,amt:e.amt,spd:e.spd,motion:e.motion,out:row.querySelector('[data-o=amt]').textContent}})()`);
  assert.equal(r.hidden,false);assert.equal(r.label,'いやいやの大きさ');assert.equal(r.amt,150);assert.equal(r.spd,70);assert.equal(r.motion,'iya');assert.equal(r.out,'150%');
});
await ok('「この表情を試す」で表情に切り替わり、表情のボタンも押された状態になる',async()=>{
  const r=await E(`(async()=>{const row=$$('#exprList .expr-row').at(-1);row.querySelector('[data-a=try]').click();await wait(50);
    const b=$$('#exprBar button').find(x=>x.getAttribute('aria-pressed')==='true');const t=row.querySelector('[data-a=try]');
    return {bar:b&&b.textContent,try:t.textContent,name:S().chars[S().charId].exprs.at(-1).name}})()`);
  assert.equal(r.bar,r.name);assert.match(r.try,/やめる/);
});
await ok('表情のボタンで通常に戻すと、試すボタンも戻る',async()=>{
  const r=await E(`(async()=>{$$('#exprBar button').find(x=>x.textContent==='通常').click();await wait(50);return $$('#exprList .expr-row').at(-1).querySelector('[data-a=try]').textContent})()`);
  assert.equal(r,'この表情を試す');
});
await ok('その場で調整に速さの4つ。動かすとキャラの値が変わる',async()=>{
  const r=await E(`(async()=>{$('#quickTune').open=true;await wait(300);const labs=$$('#quickTuneBody label').map(l=>l.firstChild.textContent.trim());
    const c=$('#qt_studioMotionWanderSpeed');c.value='150';c.dispatchEvent(new Event('input',{bubbles:true}));await wait(100);
    return {labs:labs.filter(x=>/速さ/.test(x)),v:S().motionWanderSpeed,cv:S().chars[S().charId].motionWanderSpeed}})()`);
  assert.deepEqual(r.labs,['歌うゆらぎの速さ','ぴょんぴょんの速さ','ガタガタの速さ','右往左往の速さ','いやいやの速さ','演出の速さ']);assert.equal(Number(r.v),150);
});
await new Promise(r=>setTimeout(r,1500));
await ok('読み直しても、いやいや・大きさ・速さが残る（以前は右往左往・いやいやが「動かさない」に戻っていた）',async()=>{
  await P.send('Page.reload');await new Promise(r=>setTimeout(r,3000));
  await E(`window.$=s=>document.querySelector(s);window.$$=s=>[...document.querySelectorAll(s)];window.S=()=>__otonohaChars.state;true`);
  const r=await E(`(()=>{const e=S().chars[S().charId].exprs.at(-1);return {m:e.motion,a:e.amt,s:e.spd,ws:S().motionWanderSpeed,sel:$$('#exprList .expr-row').at(-1).querySelector('[data-k=motion]').value}})()`);
  assert.deepEqual(r,{m:'iya',a:150,s:70,ws:150,sel:'iya'});
});
await ok('ページのエラーがない',async()=>assert.deepEqual(errs,[]));
}finally{ch.kill();console.log(fails?'FAILED '+fails:'ALL PASS')}})();
