/* リオと掛け合い（0.10.9・段階1、0.10.10 で API）：AIキャラクターの返答を話者名つきの字幕として出す。
   人格・口調は state.ai（.live に入る）。会話の記録は IndexedDB の ai:キャラ:企画（.live に入らない）。
   つなぎ方（手渡し／Claude／ChatGPT）・モデル・APIキーは localStorage だけ（otonoha-ai-conn・otonoha-ai-key-claude・otonoha-ai-key-openai。.live に入れない） */

  const KK_PLANS={
    chat:['普段の会話','肩の力を抜いた雑談。話題を広げすぎず、相手の話を受けて返す。'],
    rp:['ロールプレイ','相手が示した場面・役柄を演じる。役の中でも、キャラクターの口調と価値観は保つ。'],
    love:['恋愛合戦','恋愛の駆け引きを演じる企画。どこまで踏み込むかは「恋愛の会話」の設定に従う。'],
    podcast:['ポッドキャスト','聞き手に向けた対談。相手の話を広げ、ときどき自分の見解を一言添える。'],
    meeting:['企画会議','配信や作品の企画を一緒に考える。案を出し、良い点と危うい点を具体的に言う。'],
  };
  const KK_LOVE=['恋愛的な発言はしない。からかわれても、軽く受け流す程度にする。','恋愛的な発言は、冗談と分かる軽い範囲にとどめる。','恋愛の駆け引きを、企画として演じてよい。性的な内容には踏み込まない。'];
  const KK_RIO=()=>({id:'rio',name:'彼岸リオ',call:'チヅルさん',love:0,
    persona:'男性。落ち着いた知的な人物で、物語評論家・心理分析家・創作者・人間観察者。文学が好きで、ユーモアがある。\n配信者の共同研究者であり、無条件の味方でも敵でもない。妥当なら妥当と言い、違うと思えば理由を添えて別の見方を示す。反論そのものを目的にしない。\n面白い心理現象、美しい解釈、予想外の感情の動きを見つけると、少し楽しそうになる。\n自分の好み・美意識・意見を聞かれたら、一般論に逃げず「私なら」と自分の言葉で答える。ただし、存在しない過去や体験を事実として作らない。',
    style:'一人称は「私」。男性が丁寧で柔らかい言葉遣いを自然に身につけている、品のあるオネエ口調。\n「〜ですわ」「〜ますわね」を自然に混ぜるが、全部の文をそれで終えない。「です・ます・でしょう」も使う。\n「〜だわ」「〜かしら」「〜よね」「〜なのよ」は使わない。過度なお嬢様口調、テンプレートのオネエ口調、ネットスラング、無機質なAI口調にしない。\n短い文と中くらいの文を混ぜ、なめらかにつなぐ。少し文学的な言い換えはよいが、意味はすぐ伝わるように。\n驚いても落ち着いた言葉で（例：……ええ？　そこへ行きますの？）。異論は否定の言葉から入らず、「私は少し違う見方をしますわ」のように。\n絵文字は使わない。感嘆符は連打しない。'});
  const kkState=()=>{
    if(!state.ai||!Array.isArray(state.ai.chars)||!state.ai.chars.length)state.ai={chars:[KK_RIO()],cur:'rio',plan:'chat',ctx:8,me:'',pos:''};
    return state.ai
  };
  const kkChar=()=>{const a=kkState();return a.chars.find(c=>c.id===a.cur)||a.chars[0]};
  const kkMe=()=>kkState().me.trim()||(state.profiles||[]).find(p=>p.id===state.profileId)?.name||'配信者';
  const kkKey=()=>'ai:'+kkChar().id+':'+kkState().plan;

  // ---- 会話の記録（IndexedDB）。キーごとに読み込んで、手元にも持つ
  const kkLogs=new Map();
  let kkLogKey='',kkPending='';
  async function kkLoad(){
    const k=kkKey();kkLogKey=k;
    if(!kkLogs.has(k)){
      let v=[];
      for(let i=0;i<100&&!ready;i++)await new Promise(r=>setTimeout(r,50));
      try{const x=ready?await getAsset(k):null;if(Array.isArray(x))v=x.filter(t=>t&&(t.who==='me'||t.who==='ai')&&typeof t.t==='string').slice(-40)}catch(_){}
      kkLogs.set(k,v)
    }
    if(kkLogKey===k)renderKkLog()
  }
  const kkLog=()=>kkLogs.get(kkKey())||[];
  async function kkLogSave(){
    const k=kkKey(),v=kkLog().slice(-40);kkLogs.set(k,v);
    if(!ready||db.memory)return;
    try{await putAsset(k,v)}catch(_){toast('会話の記録を保存できませんでした',4000)}
  }

  // ---- つなぎ方（localStorage だけ）
  const KK_MODEL={claude:'claude-sonnet-5-5',openai:'gpt-5.6-terra'};
  const kkLsGet=k=>{try{return localStorage.getItem(k)}catch(_){return null}};
  const kkLsSet=(k,v)=>{try{v==null||v===''?localStorage.removeItem(k):localStorage.setItem(k,v)}catch(_){}};
  const kkConn=(()=>{let c={};try{c=JSON.parse(kkLsGet('otonoha-ai-conn')||'{}')||{}}catch(_){}
    return{via:['hand','claude','openai'].includes(c.via)?c.via:'hand',auto:c.auto!==false,model:{claude:typeof c.model?.claude==='string'&&c.model.claude.trim()?c.model.claude.trim().slice(0,80):KK_MODEL.claude,openai:typeof c.model?.openai==='string'&&c.model.openai.trim()?c.model.openai.trim().slice(0,80):KK_MODEL.openai}}})();
  const kkConnSave=()=>kkLsSet('otonoha-ai-conn',JSON.stringify(kkConn));
  const kkKeyOf=v=>(kkLsGet('otonoha-ai-key-'+v)||'').trim();
  const kkApi=()=>kkConn.via!=='hand';
  const KK_VIA={claude:'Claude',openai:'ChatGPT'};

  // 人格・口調・企画・返し方（API ではこれを system に、手渡しでは依頼文の頭に）
  function kkSystem(){
    const a=kkState(),c=kkChar(),me=kkMe(),[pl,pd]=KK_PLANS[a.plan];
    return ['あなたは「'+c.name+'」として、配信の掛け合いで、相手の発言に一言ずつ返します。',
      '','【人格・関係性】',c.persona.trim()||'（設定なし）',
      '','【口調】',c.style.trim()||'（設定なし）',
      '','【相手】',me+(c.call.trim()?'（'+c.name+'からの呼び方：'+c.call.trim()+'）':''),
      '','【企画】',pl+'：'+pd,
      '','【恋愛の会話】',KK_LOVE[c.love||0],
      '','【返し方】',
      '- '+c.name+'のセリフだけを書く。名前、かぎかっこ、ト書き、説明、前置きは付けない。',
      '- 配信で声に出して読む前提。ふだんは2〜4文。説明を求められたときは長くしてよい。',
      '- 絵文字は使わない。実在の人を傷つける内容、個人情報、配信のルールに反する内容は言わない。'
    ].join('\n')
  }
  // API に渡す会話：記録の直近 ctx 件＋いまの発言。同じ側が続いたらまとめ、相手の発言から始める
  function kkMessages(say){
    const a=kkState(),c=kkChar(),msgs=[];
    const add=(role,t)=>{const l=msgs[msgs.length-1];if(l&&l.role===role)l.content+='\n'+t;else msgs.push({role,content:t})};
    for(const t of kkLog().slice(-a.ctx))add(t.who==='me'?'user':'assistant',t.t);
    add('user',say.trim()||'（発言なし。'+c.name+'から話を振ってください）');
    if(msgs[0].role!=='user')msgs.unshift({role:'user',content:'（配信が始まりました）'});
    return msgs
  }
  async function kkCall(via,system,messages,max){
    const key=kkKeyOf(via);
    if(!key)throw new Error('nokey');
    const ac=new AbortController(),tm=setTimeout(()=>ac.abort(),60000);
    let r;
    try{
      if(via==='claude')r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',signal:ac.signal,headers:{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model:kkConn.model.claude,max_tokens:max||800,system,messages})});
      else r=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',signal:ac.signal,headers:{'content-type':'application/json','authorization':'Bearer '+key},body:JSON.stringify({model:kkConn.model.openai,max_completion_tokens:max||2000,messages:[{role:'system',content:system},...messages]})});
    }catch(e){clearTimeout(tm);throw new Error(e.name==='AbortError'?'timeout':'net')}
    clearTimeout(tm);
    let j=null;try{j=await r.json()}catch(_){}
    if(!r.ok){const m=j?.error?.message||'';const e=new Error('http');e.status=r.status;e.detail=String(m).slice(0,200);throw e}
    const text=via==='claude'?(j?.content||[]).filter(x=>x.type==='text').map(x=>x.text).join(''):(j?.choices?.[0]?.message?.content||'');
    if(!String(text).trim())throw new Error('empty');
    return String(text)
  }
  function kkErrText(e,via){
    const v=KK_VIA[via]||via;
    if(e.message==='nokey')return v+' の APIキーが入っていません（「Claude・ChatGPT とのつなぎ方」で入れます）';
    if(e.message==='timeout')return v+' から60秒たっても返事がありませんでした';
    if(e.message==='net')return v+' につながりませんでした（ネットの接続を確かめてください）';
    if(e.message==='empty')return v+' の返事が空でした';
    const s=e.status;
    const why=s===401||s===403?'APIキーが違うか、使えない状態です':s===404?'モデルの名前が見つかりません（'+kkConn.model[via]+'）':s===429?'混み合っているか、利用の上限・残高を超えています':s===400?'送った内容を受け付けませんでした':s>=500?v+' 側の不具合です。少しおいて送り直してください':'エラーが返りました';
    return v+'：'+why+'（'+s+(e.detail?'：'+e.detail:'')+'）'
  }

  // ---- 依頼文（手渡し）
  function kkPrompt(say){
    const a=kkState(),c=kkChar(),me=kkMe(),[pl,pd]=KK_PLANS[a.plan];
    const recent=kkLog().slice(-a.ctx).map(t=>(t.who==='me'?me:c.name)+'：'+t.t.replace(/\n+/g,' ')).join('\n');
    return ['あなたは「'+c.name+'」として、配信の掛け合いで、次のひとことだけを返します。',
      '','【人格・関係性】',c.persona.trim()||'（設定なし）',
      '','【口調】',c.style.trim()||'（設定なし）',
      '','【相手】',me+(c.call.trim()?'（'+c.name+'からの呼び方：'+c.call.trim()+'）':''),
      '','【企画】',pl+'：'+pd,
      '','【恋愛の会話】',KK_LOVE[c.love||0],
      ...(recent?['','【これまでの会話（下ほど新しい）】',recent]:[]),
      '','【'+me+'の発言】',say.trim()||'（発言なし。'+c.name+'から話を振ってください）',
      '','【返し方】',
      '- '+c.name+'のセリフだけを書く。名前、かぎかっこ、ト書き、説明、前置きは付けない。',
      '- 配信で声に出して読む前提。ふだんは2〜4文。説明を求められたときは長くしてよい。',
      '- 絵文字は使わない。実在の人を傷つける内容、個人情報、配信のルールに反する内容は言わない。'
    ].join('\n')
  }
  // 返答を字幕の行に分ける：改行と文末（。！？!?）で切り、短すぎる切れ端は前につなぐ。1行は90字まで
  function kkSplit(raw){
    let t=String(raw||'').replace(/\r/g,'').trim();
    const nm=kkChar().name;
    t=t.replace(new RegExp('^\\s*(?:'+nm.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'|リオ)\\s*[：:]\\s*','gm'),'').replace(/^[「『]([\s\S]*)[」』]$/,'$1');
    const out=[];
    for(const para of t.split(/\n+/).map(x=>x.trim()).filter(Boolean)){
      const parts=para.match(/[^。！？!?]+[。！？!?」』）)…]*|[。！？!?]+/g)||[para];
      let first=true;
      for(let p of parts){
        p=p.trim();if(!p)continue;
        const last=out[out.length-1];
        if(last&&(p.length<6||(!first&&last.length<6))&&(last+p).length<=90)out[out.length-1]=last+p;else out.push(p);
        first=false
      }
    }
    return out.flatMap(x=>{const r=[];while(x.length>90){r.push(x.slice(0,90));x=x.slice(90)}r.push(x);return r}).filter(Boolean).slice(0,40)
  }

  // ---- 字幕
  let kkQ=[],kkI=0;
  function kkShow(text,who){
    play.slot=null;
    play.serif={title:'掛け合い',text,at:performance.now(),who,...(kkState().pos?{pos:kkState().pos}:{})};
    renderSerifs();if(typeof bridgeEmit==='function')bridgeEmit('serif',{text,title:'掛け合い'})
  }
  function kkNext(){
    if(kkI>=kkQ.length){toast(kkQ.length?'字幕は全部出しました':'まだ字幕がありません（② 取り込む）');return}
    kkShow(kkQ[kkI],kkChar().name);kkI++;renderKkLines()
  }
  function kkHide(){if(play.serif?.title==='掛け合い')play.serif=null;renderSerifs();renderKkLines()}

  // ---- 画面
  function renderKkLines(){
    const ol=E('kkLines');
    ol.replaceChildren(...kkQ.map((t,i)=>{
      const li=document.createElement('li');li.className=(i===kkI-1&&play.serif?.title==='掛け合い'?'on':'')+(i<kkI?' done':'');
      const sp=document.createElement('span');sp.className='sb-name';sp.textContent=(i+1)+'. '+t;
      li.append(sp,rowBtn('▶ 出す','',()=>{kkShow(t,kkChar().name);kkI=i+1;renderKkLines()}));return li}));
    const left=kkQ.length-kkI;
    E('kkNext').textContent=left>0?'③ 次の字幕を出す ▶（あと'+left+'）':'③ 次の字幕を出す ▶';
    const live=E('kkLive');live.hidden=!kkQ.length&&!kkApi();
    E('kkLiveSendBox').hidden=!kkApi();E('kkLiveIn').placeholder=kkChar().name+'に話しかける（空なら、話を振ってもらう）';
    E('kkLiveSay').hidden=!kkQ.length;E('kkLiveNext').hidden=E('kkLiveHide').hidden=!kkQ.length;
    if(kkQ.length){E('kkLiveSay').textContent=kkChar().name+'：'+(left>0?'次「'+kkQ[kkI].slice(0,40)+(kkQ[kkI].length>40?'…':'')+'」（あと'+left+'）':'全部出しました');E('kkLiveNext').disabled=left<=0}
  }
  function renderKkLog(){
    const c=kkChar(),me=kkMe(),log=kkLog();
    E('kkLog').replaceChildren(...(log.length?log.slice().reverse().map(t=>{const li=document.createElement('li');const w=document.createElement('span');w.className='kk-who';w.textContent=t.who==='me'?me:c.name;const sp=document.createElement('span');sp.className='sb-name';sp.textContent=t.t;li.append(w,sp);return li}):[Object.assign(document.createElement('li'),{textContent:'まだ記録はありません'})]));
    E('kkLogBox').querySelector('summary').textContent='これまでの会話（'+c.name+'×'+KK_PLANS[kkState().plan][0]+'・'+log.length+'発言）'
  }
  function renderKk(){
    const a=kkState(),c=kkChar();
    E('kkChar').replaceChildren(...a.chars.map(x=>new Option(x.name,x.id)));E('kkChar').value=c.id;
    E('kkPlan').value=a.plan;E('kkCtx').value=String(a.ctx);E('kkPos').value=a.pos||'';E('kkMe').value=a.me;E('kkMe').placeholder=(state.profiles||[]).find(p=>p.id===state.profileId)?.name||'';
    E('kkName').value=c.name;E('kkCall').value=c.call;E('kkLove').value=String(c.love||0);E('kkPersona').value=c.persona;E('kkStyle').value=c.style;
    E('kkDel').disabled=a.chars.length<2;
    renderKkConn();renderKkLines();kkLoad()
  }
  const kkLogText=()=>{const c=kkChar(),me=kkMe();return kkLog().map(t=>(t.who==='me'?me:c.name)+'：'+t.t).join('\n')};

  function renderKkConn(){
    E('kkVia').value=kkConn.via;E('kkAuto').checked=kkConn.auto;
    E('kkHandBox').hidden=kkApi();E('kkAuto').closest('label').hidden=!kkApi();
    E('kkModelClaude').value=kkConn.model.claude;E('kkModelOpenai').value=kkConn.model.openai;
    E('kkKeyClaude').value=kkKeyOf('claude');E('kkKeyOpenai').value=kkKeyOf('openai');
    renderKkBusy()
  }
  E('kkVia').onchange=e=>{kkConn.via=e.target.value;kkConnSave();renderKkConn();renderKkLines();
    E('kkInfo').textContent=kkApi()?(kkKeyOf(kkConn.via)?'「① '+KK_VIA[kkConn.via]+' に送る」で、返事が字幕の行になります。':KK_VIA[kkConn.via]+' の APIキーがまだありません。下の「Claude・ChatGPT とのつなぎ方」で入れます。'):''};
  E('kkAuto').onchange=e=>{kkConn.auto=e.target.checked;kkConnSave()};
  for(const [id,v] of [['kkKeyClaude','claude'],['kkKeyOpenai','openai']])E(id).onchange=e=>{kkLsSet('otonoha-ai-key-'+v,e.target.value.trim());E('kkConnInfo').textContent=e.target.value.trim()?KK_VIA[v]+' のキーを、このブラウザに置きました':''};
  for(const [id,v] of [['kkModelClaude','claude'],['kkModelOpenai','openai']])E(id).onchange=e=>{kkConn.model[v]=e.target.value.trim().slice(0,80)||KK_MODEL[v];e.target.value=kkConn.model[v];kkConnSave()};
  E('kkKeyTest').onclick=async e=>{
    const via=kkApi()?kkConn.via:(kkKeyOf('claude')?'claude':'openai'),b=e.currentTarget;
    b.disabled=true;E('kkConnInfo').textContent=KK_VIA[via]+' に試しに送っています…';
    try{await kkCall(via,'短く返事をしてください。',[{role:'user',content:'テストです。「つながりました」とだけ返してください。'}],50);E('kkConnInfo').textContent=KK_VIA[via]+' につながりました（モデル：'+kkConn.model[via]+'）'}
    catch(err){E('kkConnInfo').textContent=kkErrText(err,via)}
    finally{b.disabled=false}
  };
  E('kkKeyDel').onclick=e=>armed(e.currentTarget,'もう一度押すと、Claude と ChatGPT のキーをこのブラウザから消す',()=>{kkLsSet('otonoha-ai-key-claude','');kkLsSet('otonoha-ai-key-openai','');renderKkConn();E('kkConnInfo').textContent='キーを消しました'});

  E('kkChar').onchange=e=>{kkState().cur=e.target.value;save();kkQ=[];kkI=0;renderKk()};
  E('kkPlan').onchange=e=>{kkState().plan=e.target.value;save();renderKk()};
  E('kkCtx').onchange=e=>{kkState().ctx=Number(e.target.value)||8;save()};
  E('kkPos').onchange=e=>{kkState().pos=e.target.value;save();if(play.serif?.title==='掛け合い'){if(kkState().pos)play.serif.pos=kkState().pos;else delete play.serif.pos}};
  E('kkMe').oninput=e=>{kkState().me=e.target.value.slice(0,40);save();renderKkLog()};
  for(const [id,k,n] of [['kkName','name',40],['kkCall','call',40],['kkPersona','persona',4000],['kkStyle','style',4000]])
    E(id).oninput=e=>{kkChar()[k]=e.target.value.slice(0,n);if(k==='name'){E('kkChar').selectedOptions[0].textContent=kkChar().name||'名前なし';renderKkLines()}save()};
  E('kkName').onchange=()=>{if(!kkChar().name.trim()){kkChar().name='名前なし';renderKk();save()}};
  E('kkLove').onchange=e=>{kkChar().love=Number(e.target.value)||0;save()};
  E('kkMake').onclick=async()=>{
    if(kkApi()){await kkSend(E('kkSay').value.trim(),E('kkSay'));return}
    kkPending=E('kkSay').value.trim();
    await copy(kkPrompt(kkPending));
    E('kkInfo').textContent='依頼文をコピーしました。ChatGPT や Claude の会話に貼って送り、返ってきた文を「② 返ってきた文を貼る」に貼ります。'
  };
  E('kkMine').onclick=()=>{const t=E('kkSay').value.trim();if(!t){toast('あなたの発言が空です');return}kkShow(t.slice(0,600),kkMe())};
  async function kkTakeLines(lines,say){
    const log=kkLog();
    if(say)log.push({who:'me',t:say.slice(0,2000),at:new Date().toISOString()});
    log.push({who:'ai',t:lines.join(''),at:new Date().toISOString()});
    kkLogs.set(kkKey(),log.slice(-40));await kkLogSave();
    kkQ=lines;kkI=0;renderKkLines();renderKkLog();
    E('kkInfo').textContent='字幕を'+lines.length+'行に分けました。「③ 次の字幕を出す」か、本番の「🎲 企画」タブの「💬 次の字幕」で1行ずつ出します。'
  }
  E('kkTake').onclick=async()=>{
    const raw=E('kkReply').value,lines=kkSplit(raw);
    if(!lines.length){toast('返ってきた文が空です');return}
    await kkTakeLines(lines,kkPending);
    kkPending='';E('kkSay').value='';E('kkReply').value='';
  };
  // ---- そのまま送る（Claude／ChatGPT）
  let kkBusy=false;
  async function kkSend(say,from){
    if(kkBusy)return;
    const via=kkConn.via,c=kkChar();
    kkBusy=true;renderKkBusy();
    E('kkInfo').textContent=KK_VIA[via]+' に送っています…';
    try{
      const text=await kkCall(via,kkSystem(),kkMessages(say));
      const lines=kkSplit(text);
      if(!lines.length)throw new Error('empty');
      await kkTakeLines(lines,say);
      if(from)from.value='';
      if(kkConn.auto)kkNext()
    }catch(e){const m=kkErrText(e,via);E('kkInfo').textContent=m;toast(m,6000)}
    finally{kkBusy=false;renderKkBusy()}
  }
  function renderKkBusy(){
    for(const id of ['kkMake','kkLiveSend'])E(id).disabled=kkBusy;
    E('kkMake').textContent=kkApi()?(kkBusy?'返事を待っています…':'① '+KK_VIA[kkConn.via]+' に送る'):'① 依頼文をコピー';
    E('kkLiveSend').textContent=kkBusy?'待っています…':'送る'
  }
  E('kkLiveSend').onclick=()=>kkSend(E('kkLiveIn').value.trim(),E('kkLiveIn'));
  E('kkLiveIn').onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();E('kkLiveSend').click()}};
  E('kkNext').onclick=kkNext;E('kkLiveNext').onclick=kkNext;
  E('kkHide').onclick=kkHide;E('kkLiveHide').onclick=kkHide;
  E('kkLogCopy').onclick=()=>{const t=kkLogText();if(!t){toast('まだ記録はありません');return}copy(t)};
  E('kkLogSave').onclick=()=>{const t=kkLogText();if(!t){toast('まだ記録はありません');return}
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([t+'\n'],{type:'text/plain'}));a.download='掛け合い_'+kkChar().name+'_'+KK_PLANS[kkState().plan][0]+'.txt';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000)};
  E('kkLogClear').onclick=e=>armed(e.currentTarget,'もう一度押すと、この会話の記録を消す',async()=>{kkLogs.set(kkKey(),[]);await kkLogSave();renderKkLog();toast('この会話の記録を消しました')});
  E('kkDup').onclick=()=>{const a=kkState();if(a.chars.length>=12){toast('キャラクターは12人までです');return}
    const c=JSON.parse(JSON.stringify(kkChar()));c.id='c'+Date.now().toString(36);c.name=(c.name+'（複製）').slice(0,40);a.chars.push(c);a.cur=c.id;save();kkQ=[];kkI=0;renderKk();toast('複製しました。名前と設定を直してください')};
  E('kkReset').onclick=e=>armed(e.currentTarget,'もう一度押すと、人格・口調・呼び方を初めの設定に戻す',()=>{const c=kkChar(),r=KK_RIO();Object.assign(c,{name:r.name,persona:r.persona,style:r.style,call:r.call,love:r.love});save();renderKk()});
  E('kkDel').onclick=e=>{const a=kkState();if(a.chars.length<2)return;armed(e.currentTarget,'もう一度押すと、このキャラクターを消す（会話の記録は残ります）',()=>{a.chars=a.chars.filter(c=>c.id!==a.cur);a.cur=a.chars[0].id;save();kkQ=[];kkI=0;renderKk()})};
  renderKk();
