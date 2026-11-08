/* 設定の点検（sanitize）：読み込んだ設定・ファイルの値を、使える範囲と形にそろえる */

  function sanitize(v){
    v=v&&typeof v==='object'&&!Array.isArray(v)?v:{};
    const out={...defaults};
    for(const k of ['threshold','hold','scale','x','y','count','speed','fxSize','fxOpacity']){
      const ranges={threshold:[-65,-5],hold:[40,600],scale:[10,500],x:[-300,300],y:[-200,500],count:[5,100],speed:[10,150],fxSize:[35,200],fxOpacity:[10,100]};
      const n=Number(v[k]);
      if(Number.isFinite(n))out[k]=Math.max(ranges[k][0],Math.min(ranges[k][1],n))
    }
    for(const k of ['blink','bounce','show'])if(typeof v[k]==='boolean')out[k]=v[k];
    for(const k of ['title','cue','prompt','script'])if(typeof v[k]==='string')out[k]=v[k].slice(0,150000);
    if(['none','spring','summer','autumn','winter'].includes(v.effect)||/^p:[a-z0-9]{1,24}$/.test(v.effect))out.effect=v.effect;
    if(['cafe','transparent','green','blue','black','image'].includes(v.bg))out.bg=v.bg;
    if(Array.isArray(v.songs))out.songs=v.songs.slice(0,300).filter(x=>x&&typeof x.title==='string').map(x=>({title:x.title.slice(0,200),artist:String(x.artist||'').slice(0,200)}));
    {const S=(x,n)=>String(x??'').slice(0,n),iso=x=>typeof x==='string'&&/^\d{4}-\d\d-\d\dT/.test(x)?x.slice(0,30):'';
     if(Array.isArray(v.repertoire))out.repertoire=v.repertoire.filter(x=>x&&typeof x.title==='string'&&x.title).slice(0,3000).map(x=>({id:S(x.id,16)||Math.random().toString(36).slice(2,10),title:S(x.title,200),artist:S(x.artist,200),memo:S(x.memo,200),count:Math.max(0,Math.floor(Number(x.count)||0)),last:iso(x.last),...(()=>{const o={};
       const http=u=>{const t=S(u,500);return /^https?:\/\//i.test(t)?t:''};
       if(Array.isArray(x.srcs))o.srcs=x.srcs.filter(y=>y&&typeof y==='object').slice(0,8).map(y=>({u:http(y.u),n:S(y.n,200),by:S(y.by,120),k:S(y.k,20),kind:S(y.kind,30),f:http(y.f)})).filter(y=>y.u||y.n);
       if(x.useSrc)o.useSrc=S(x.useSrc,500);if(x.sk)o.sk=S(x.sk,420);if(x.w)o.w=S(x.w,200);return o})()}));
     if(Array.isArray(v.singLog))out.singLog=v.singLog.filter(x=>x&&typeof x.title==='string'&&iso(x.t)).map(x=>{const o={id:S(x.id,16)||Math.random().toString(36).slice(2,10),t:iso(x.t),title:S(x.title,200),artist:S(x.artist,200),sess:S(x.sess,16),start:iso(x.start)||iso(x.t),off:Math.max(0,Math.floor(Number(x.off)||0)),prof:S(x.prof,40)};if(Number.isFinite(Number(x.off0)))o.off0=Math.max(0,Math.floor(Number(x.off0)));if(x.ts!==null&&x.ts!==undefined&&Number.isFinite(Number(x.ts)))o.ts=Math.max(0,Math.floor(Number(x.ts)));if(x.src)o.src=S(x.src,500);return o});
     if(Array.isArray(v.legacyVideos))out.legacyVideos=v.legacyVideos.filter(x=>x&&typeof x.id==='string'&&/^[a-z0-9]{1,16}$/.test(x.id)).slice(0,60).map(x=>({id:x.id,name:S(x.name,120)||'otonoha.mp4',size:Math.max(0,Number(x.size)||0),type:S(x.type,40),at:iso(x.at),missing:x.missing===true}));
     out.singSess=v.singSess&&typeof v.singSess==='object'&&iso(v.singSess.start)?{id:S(v.singSess.id,16),start:iso(v.singSess.start),prof:S(v.singSess.prof,40)}:null}
    out.assetNames=v.assetNames&&typeof v.assetNames==='object'?v.assetNames:{};
    out.scenes={};
    for(const k of ['standby','away','end'])out.scenes[k]=sceneClean(k,v.scenes&&typeof v.scenes==='object'?v.scenes[k]:null);
    if(typeof v.restoreBgm==='boolean')out.restoreBgm=v.restoreBgm;
    if(typeof v.sceneFont==='string'&&/^[a-z]{1,16}$/.test(v.sceneFont))out.sceneFont=v.sceneFont;
    if(['hold','flap'].includes(v.mouthMode))out.mouthMode=v.mouthMode;
    for(const [k,lo,hi] of [['flapMin',40,400],['flapMax',40,600]])if(Number.isFinite(Number(v[k])))out[k]=Math.max(lo,Math.min(hi,Math.round(Number(v[k]))));
    if(out.flapMax<out.flapMin)out.flapMax=out.flapMin;
    if(typeof v.sinkId==='string')out.sinkId=v.sinkId.slice(0,300);
    if(['landscape','portrait','x34'].includes(v.aspect))out.aspect=v.aspect;
    for(const k of ['motionAmt','motionSing','motionSingSpeed','motionHop','motionShake','motionWander','motionIya']){
      const n=Number(v[k]);
      if(Number.isFinite(n))out[k]=Math.max(CHAR_RANGES[k][0],Math.min(CHAR_RANGES[k][1],n))
    }
    if(['flutter','leaf','rise','snow','roll'].includes(v.imageMotion))out.imageMotion=v.imageMotion;
    if(Array.isArray(v.karaChannels))out.karaChannels=v.karaChannels.slice(0,60).filter(x=>x&&typeof x==='object').map(x=>({name:String(x.name||'').slice(0,80),url:String(x.url||'').slice(0,300),memo:String(x.memo||'').slice(0,300)}));
    if(['popup','tab','newtab'].includes(v.karaOpen))out.karaOpen=v.karaOpen;
    if(['recent','name','count'].includes(v.repSort))out.repSort=v.repSort;
    {const S=(x,n)=>String(x??'').slice(0,n);
    out.sessInfo={};
    if(v.sessInfo&&typeof v.sessInfo==='object'&&!Array.isArray(v.sessInfo))for(const [k,x] of Object.entries(v.sessInfo).slice(0,2000))if(/^[a-z0-9]{1,16}$/.test(k)&&x&&typeof x==='object'){out.sessInfo[k]={url:S(x.url,500)};if(x.sheet&&typeof x.sheet==='object')out.sessInfo[k].sheet={id:S(x.sheet.id,60),at:iso(x.sheet.at)}}
    if(typeof v.descHead==='string')out.descHead=v.descHead.slice(0,200);
    if(['blank','rec','skip'].includes(v.descEmpty))out.descEmpty=v.descEmpty;
    if(['off','now','list'].includes(v.setlistShow))out.setlistShow=v.setlistShow;
    if(['tl','tr','bl','br'].includes(v.setlistPos))out.setlistPos=v.setlistPos;
    if([0,15,30,60,120].includes(v.setlistTime))out.setlistTime=v.setlistTime;
    out.setlistSize=Math.max(50,Math.min(200,Math.round(Number(v.setlistSize)||100)));
    out.setlistHide=S(v.setlistHide,16);
    if(Array.isArray(v.apps))out.apps=v.apps.filter(a=>a&&/^[a-z0-9]{1,16}$/.test(a.id)&&(a.kind==='file'||(a.kind==='url'&&/^https?:\/\//.test(a.url)))).slice(0,12).map(a=>({id:a.id,kind:a.kind,name:S(a.name,40)||'アプリ',...(a.kind==='url'?{url:S(a.url,2000)}:{file:S(a.file,120),store:a.store!==false})}));
    out.apps.forEach((a,i)=>{const s=v.apps.find(x=>x&&x.id===a.id)||{};a.bridge=s.bridge!==false;a.bridgeMore=s.bridgeMore===true});
    out.appSel=out.apps.some(a=>a.id===v.appSel)?v.appSel:'';
    if(v.aud&&typeof v.aud==='object'&&Array.isArray(v.aud.cast)){
      const a=v.aud;
      out.aud={streamer:S(a.streamer,40),topic:S(a.topic,2000),max:[1,2,3,4,5].includes(a.max)?a.max:3,show:a.show!==false,pos:a.pos==='left'?'left':'right',life:Math.max(5,Math.min(60,Number(a.life)||14)),
        recent:(Array.isArray(a.recent)?a.recent:[]).slice(0,8).map(r=>({event:S(r?.event,400),comments:(Array.isArray(r?.comments)?r.comments:[]).slice(0,5).map(c=>({name:S(c?.name,40),text:S(c?.text,140)}))})),
        cast:a.cast.filter(c=>c&&typeof c.id==='string'&&c.core&&typeof c.core==='object').slice(0,5).map(c=>({id:S(c.id,24),enabled:c.enabled!==false,core:Object.fromEntries(['name','role','firstPerson','secondPerson','voice','summary','boundaries'].map(k=>[k,S(c.core[k],500)])),display:{icon:S(c.display?.icon,4),color:/^#[0-9a-f]{6}$/i.test(c.display?.color)?c.display.color:'#f4e6d8'},tuning:Object.fromEntries(Object.entries(c.tuning||{}).filter(([k,x])=>/^[a-z]{2,20}$/.test(k)).map(([k,x])=>[k,Math.max(0,Math.min(100,Number(x)||0))])),lexicon:Object.fromEntries(Object.entries(c.lexicon||{}).filter(([k,x])=>/^[a-z]{2,20}$/.test(k)&&Array.isArray(x)).map(([k,x])=>[k,x.slice(0,20).map(s=>S(s,120))]))}))}
    }
    if(v.slot&&typeof v.slot==='object'){const c=v.slot;out.slot={aName:S(c.aName,20)||'役柄',bName:S(c.bName,20)||'セリフ',dur:Math.max(0,Math.min(10,Number(c.dur)||0)),se:S(c.se,40),use:(Array.isArray(c.use)?c.use:[]).filter(x=>typeof x==='string'&&/^[a-z0-9]{1,16}$/.test(x)).slice(0,100),look:c.look==='bubble'?'bubble':'machine',aiNote:S(c.aiNote,2000),pos:['left','right'].includes(c.pos)?c.pos:'center',size:Math.max(30,Math.min(90,Math.round(Number(c.size)||62))),color:['theme','custom'].includes(c.color)?c.color:'classic',colors:(Array.isArray(c.colors)?c.colors:[]).slice(0,5).map(x=>/^#[0-9a-f]{6}$/i.test(x)?x.toLowerCase():'#000000')}}
    if(v.pon&&typeof v.pon==='object'){const c=v.pon;out.pon={hide:(Array.isArray(c.hide)?c.hide:[]).filter(x=>typeof x==='string'&&/^(?:[sa]:[a-z0-9]{1,16}|slot|wheel|dice)$/.test(x)).slice(0,300),app:c.app==='page'?'page':'window',serif:typeof c.serif==='string'&&/^(?:none|all|s:[a-z0-9]{1,16})$/.test(c.serif)?c.serif:'all'}}
    if(v.vr&&typeof v.vr==='object'&&Array.isArray(v.vr.lines)){
      const r=v.vr;
      out.vr={speaker:S(r.speaker,30)||'speaker',trim:r.trim!==false,autoNext:r.autoNext!==false,lines:r.lines.filter(l=>l&&/^[a-z0-9]{1,16}$/.test(l.id)).slice(0,2000).map(l=>({id:l.id,text:S(l.text,300),...(l.done?{done:true,secs:Number(l.secs)||0,rate:Number(l.rate)||48000,notes:(Array.isArray(l.notes)?l.notes:[]).slice(0,4).map(n=>S(n,40))}:{})}))};
      out.vr.cur=Math.max(0,Math.min(out.vr.lines.length-1,Number(r.cur)||0))
    }
    if(['overlay','side'].includes(v.appLayout))out.appLayout=v.appLayout;
    if(['tl','tr','bl','br'].includes(v.appPos))out.appPos=v.appPos;
    out.appSize=Math.max(15,Math.min(70,Math.round(Number(v.appSize)||35)));
    if(['char','stage'].includes(v.appView))out.appView=v.appView;
    if(typeof v.appMsc==='boolean')out.appMsc=v.appMsc;
    {const n=(x,lo,hi,df)=>{const k=Number(x);return Number.isFinite(k)?Math.max(lo,Math.min(hi,Math.round(k))):df};out.appCX=n(v.appCX,0,100,100);out.appCY=n(v.appCY,0,100,100);out.appCSize=n(v.appCSize,15,90,42)}
    if(Array.isArray(v.serifs))out.serifs=v.serifs.filter(s=>s&&/^[a-z0-9]{1,16}$/.test(s.id)).slice(0,100).map(s=>({id:s.id,title:S(s.title,80)||'シチュエーション',lines:(Array.isArray(s.lines)?s.lines:[]).slice(0,300).map(x=>S(x,300)),...(Number.isInteger(s.pos)?{pos:s.pos}:{})}));
    out.serifSel=out.serifs.some(s=>s.id===v.serifSel)?v.serifSel:'';
    if(['bottom','top','left','right'].includes(v.serifPos))out.serifPos=v.serifPos;
    out.serifName=v.serifName!==false;
    out.diceN=[1,2,3].includes(v.diceN)?v.diceN:1;
    out.diceF=[4,6,8,10,12,20,100].includes(v.diceF)?v.diceF:6;
    if(typeof v.wheelItems==='string')out.wheelItems=v.wheelItems.slice(0,2000);
    if(['center','left','right'].includes(v.playPos))out.playPos=v.playPos;
    if(v.playLay&&typeof v.playLay==='object'){out.playLay={};for(const a of ['landscape','portrait','x34']){const o=v.playLay[a];if(!o||typeof o!=='object')continue;const r={};for(const k of ['slot','wheel','dice']){const q=o[k];if(!q)continue;const x=Number(q.x),y=Number(q.y),s=Number(q.s);if([x,y,s].every(Number.isFinite))r[k]={x:Math.max(0,Math.min(100,x)),y:Math.max(0,Math.min(100,y)),s:Math.max(30,Math.min(200,s))}}out.playLay[a]=r}}}
    {
      const n=Number(v.karaVol);
      if(Number.isFinite(n))out.karaVol=Math.max(0,Math.min(150,n))
    }
    if(typeof v.karaSuppress==='boolean')out.karaSuppress=v.karaSuppress;
    if(typeof v.karaAutoFade==='boolean')out.karaAutoFade=v.karaAutoFade;
    if(typeof v.karaFadeEnv==='boolean')out.karaFadeEnv=v.karaFadeEnv;
    {
      const fs={},
        src=v.fxSeason&&typeof v.fxSeason==='object'?v.fxSeason:{},
        R={count:[5,100],speed:[10,150],fxSize:[35,200],fxOpacity:[10,100]};
      for(const e of ['spring','summer','autumn','winter']){
        const x=src[e]&&typeof src[e]==='object'?src[e]:{},
          o={};
        for(const k in R){
          const n=Number(x[k]);
          o[k]=Number.isFinite(n)?Math.max(R[k][0],Math.min(R[k][1],n)):out[k]
        }
        o.imageMotion=['flutter','leaf','rise','snow','roll'].includes(x.imageMotion)?x.imageMotion:out.imageMotion;
        fs[e]=o
      }
      out.fxSeason=fs;

      const MV=['flutter','leaf','rise','snow','roll'],mk=(x,id,name)=>{const o={id,name:String(name||'画像のプリセット').slice(0,30)};for(const k in R){const n=Number(x[k]);o[k]=Number.isFinite(n)?Math.max(R[k][0],Math.min(R[k][1],n)):out[k]}o.imageMotion=MV.includes(x.imageMotion)?x.imageMotion:'flutter';return o};
      out.fxPresets=[];
      if(Array.isArray(v.fxPresets)){const seenP=new Set();for(const x of v.fxPresets.slice(0,30)){if(!x||typeof x!=='object'||typeof x.id!=='string'||!/^[a-z0-9]{1,24}$/.test(x.id)||seenP.has(x.id))continue;seenP.add(x.id);out.fxPresets.push(mk(x,x.id,x.name))}}
      else out.fxPresets.push(mk({imageMotion:out.imageMotion},'img','好きな画像'))
      const okP=e=>!/^p:/.test(e)||out.fxPresets.some(p=>'p:'+p.id===e);
      if(!okP(out.effect))out.effect='none';
      for(const k of ['standby','away','end'])if(!okP(out.scenes[k].effect))out.scenes[k].effect='keep'
    }
out.fps=[10,15,30].includes(Number(v.fps))?Number(v.fps):30;
    out.light=v.light===true;
    out.vidFormat=v.vidFormat==='webm'?'webm':'mp4';
    out.vidQuality=[4.5,8,16].includes(Number(v.vidQuality))?Number(v.vidQuality):8;
    {const MV=['float','sway','hop','run','shake','still','play','walk'],num=(x,a,b,df)=>{const n=Number(x);return Number.isFinite(n)?Math.max(a,Math.min(b,n)):df},seenM=new Set();out.mascots=[];
     if(Array.isArray(v.mascots))for(const m of v.mascots.slice(0,600)){if(!m||typeof m!=='object'||typeof m.id!=='string'||!/^[a-z0-9]{1,12}$/.test(m.id)||seenM.has(m.id))continue;seenM.add(m.id);out.mascots.push({id:m.id,name:String(m.name||'マスコット').slice(0,20),show:m.show!==false,talk:m.talk===true,motion:MV.includes(m.motion)?m.motion:'float',amp:num(m.amp,0,200,100),speed:num(m.speed,20,300,100),size:num(m.size,3,90,22),x:num(m.x,-100,100,60),y:num(m.y,-100,100,40),tilt:num(m.tilt,-180,180,0),pos:aspectPosClean(m.pos,'msc'),kind:m.kind==='mini'?'mini':'mascot',owner:typeof m.owner==='string'&&/^[a-z0-9]{1,16}$/.test(m.owner)?m.owner:''})}
     
     out.speaker=typeof v.speaker==='string'&&(v.speaker==='self'||out.mascots.some(m=>m.id===v.speaker))?v.speaker:'self';
     out.sceneBoost=num(v.sceneBoost,0,12,6)}
    if(Array.isArray(v.profiles))out.profiles=v.profiles.slice(0,20).filter(p=>p&&typeof p==='object'&&typeof p.id==='string'&&/^[a-z0-9]{1,24}$/.test(p.id)).map(p=>({
      id:p.id,
      name:String(p.name||'名義').slice(0,40),
      chars:Array.isArray(p.chars)?p.chars.filter(c=>typeof c==='string'&&/^[a-z0-9]{1,24}$/.test(c)).slice(0,60):[],
      cur:typeof p.cur==='string'?p.cur:'',
      snap:p.snap&&typeof p.snap==='object'?p.snap:{},
      mscShow:Array.isArray(p.mscShow)?p.mscShow.filter(x=>typeof x==='string'&&/^[a-z0-9]{1,12}$/.test(x)).slice(0,4):null,
      ...(()=>{const n=(x,lo,hi,df)=>{const k=Number(x);return Number.isFinite(k)?Math.max(lo,Math.min(hi,Math.round(k))):df},bgs={},bgSel={};
        for(const a of ['landscape','portrait','x34']){
          bgs[a]=(Array.isArray(p.bgs?.[a])?p.bgs[a]:[]).filter(b=>b&&typeof b.id==='string'&&/^[a-z0-9]{1,16}$/.test(b.id)).slice(0,10).map(b=>({id:b.id,name:String(b.name||'背景').slice(0,40),x:n(b.x,0,100,50),y:n(b.y,0,100,50),z:n(b.z,100,300,100)}));
          const s=p.bgSel?.[a];bgSel[a]=typeof s==='string'&&bgs[a].some(b=>b.id===s)?s:''}
        return {bgs,bgSel}})()
    }));
    if(v.chars&&typeof v.chars==='object'){
      out.chars={};
      for(const[id,c]of Object.entries(v.chars).slice(0,1200))if(/^[a-z0-9]{1,24}$/.test(id)&&c&&typeof c==='object')out.chars[id]=cleanChar(c)
    }
    if(typeof v.profileId==='string')out.profileId=v.profileId.slice(0,24);
    if(typeof v.charId==='string')out.charId=v.charId.slice(0,24);
    if(['fade','cut'].includes(v.switchFx))out.switchFx=v.switchFx;
    if(['s','m','l'].includes(v.padSize))out.padSize=v.padSize;
    out.fmt=STATE_FMT;
    return out
  }

  state=sanitize(state);
