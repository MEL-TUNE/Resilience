  /* 歌うときの口パク（0.11.3）：オケがマイクに混ざる（AG03 で混ぜる・iPhone でマイクを2つ開けない）ときに、
     歌っている間だけ「口が開く音量」を上げる。オケの音だけでは口が開かず、歌声で開くように。
     state.songTh＝{on：使う, db：歌うときの口が開く音量, mode：本番の「歌の口パク」ボタンが押されている}
     使う音量は max(いつもの口が開く音量, db)。歌の口パクが効くのは、ボタンが押されているときか、伴奏タブを取り込んで歌い始めを見つけたとき（PC）。 */
  var micDbNow=-99;
  function songThActive(){
    const s=state.songTh;if(!s||!s.on)return false;
    return s.mode||(typeof karaSinging!=='undefined'&&karaSinging===true)
  }
  function mouthTh(){return songThActive()?Math.max(state.threshold,state.songTh.db):state.threshold}
  function songThRender(){
    const s=state.songTh||(state.songTh={on:false,db:-30,mode:false});
    const on=E('songThOn'),db=E('songThDb'),val=E('songThVal'),bar=E('songThBar'),btn=E('songThBtn');
    if(on)on.checked=s.on;
    if(db){db.value=s.db;db.disabled=!s.on}
    if(val)val.textContent=String(s.db).replace('-','−')+' dB';
    if(E('songThMeasure'))E('songThMeasure').disabled=!s.on;
    if(bar)bar.hidden=!s.on;
    if(btn){btn.classList.toggle('selected',s.mode);btn.setAttribute('aria-pressed',String(s.mode));btn.textContent=s.mode?'歌の口パク：オン':'歌の口パク：オフ'}
  }
  if(E('songThOn')){
    E('songThOn').addEventListener('change',e=>{state.songTh.on=e.target.checked;if(!state.songTh.on)state.songTh.mode=false;songThRender();save()});
    E('songThDb').addEventListener('input',e=>{state.songTh.db=Math.max(-65,Math.min(-5,Math.round(Number(e.target.value)||-30)));songThRender();save()});
    E('songThBtn').addEventListener('click',()=>{state.songTh.mode=!state.songTh.mode;songThRender();save()});
    let measuring=false;
    E('songThMeasure').addEventListener('click',()=>{
      if(measuring)return;
      const info=E('songThInfo');
      if(typeof micLive==='function'&&!micLive()){info.textContent='先にマイクを入れてください（本番の帯の「マイク」）。';return}
      measuring=true;const vals=[];info.textContent='測っています…（5秒・声を出さずに、オケだけ流してください）';
      const t=setInterval(()=>{vals.push(micDbNow)},100);
      setTimeout(()=>{
        clearInterval(t);measuring=false;
        const v=vals.filter(x=>x>-98).sort((a,b)=>a-b);
        if(v.length<10){info.textContent='マイクの音を拾えませんでした。';return}
        const p95=v[Math.min(v.length-1,Math.floor(v.length*.95))];
        if(p95<-60){info.textContent='オケの音がほとんど入っていませんでした（'+Math.round(p95)+' dB）。いつもの口が開く音量のままで足りそうです。';return}
        state.songTh.db=Math.max(-65,Math.min(-5,Math.round(p95+4)));
        info.textContent='オケの大きいところ：'+Math.round(p95)+' dB。歌うときの口が開く音量を '+state.songTh.db+' dB にしました。';
        songThRender();save()
      },5000)
    });
  }
