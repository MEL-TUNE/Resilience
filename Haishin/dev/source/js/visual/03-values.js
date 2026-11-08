/* 設定画面の入力と値の結び付け（renderValues）、企画メモ（台本・段落） */

  const bindings={
    studioThreshold:'threshold',
    studioHold:'hold',
    studioMouthMode:'mouthMode',
    studioFlapMin:'flapMin',
    studioFlapMax:'flapMax',
    studioBlink:'blink',
    studioScale:'scale',
    studioX:'x',
    studioY:'y',
    studioBounce:'bounce',
    studioEffect:'effect',
    studioCount:'count',
    studioSpeed:'speed',
    studioFxSize:'fxSize',
    studioFxOpacity:'fxOpacity',
    studioBg:'bg',
    planTitle:'title',
    planCue:'cue',
    planPrompt:'prompt',
    planScript:'script',
    planShow:'show',
    studioMotionAmt:'motionAmt',
    studioMotionSing:'motionSing',
    studioMotionSingSpeed:'motionSingSpeed',
    studioMotionHop:'motionHop',
    studioMotionShake:'motionShake',
    studioMotionWander:'motionWander',
    studioMotionIya:'motionIya',
    studioImageMotion:'imageMotion'
  };

  function renderValues(){
    renderEffectOptions();
for(const [id,k]of Object.entries(bindings)){
      const el=E(id);
      if(el.type==='checkbox')el.checked=state[k];else el.value=state[k]
    }
    E('thresholdValue').textContent=state.threshold+' dB';
    E('holdValue').textContent=state.hold+' ms';
    renderFlapValues();
    {
      const sv=E('scaleVal');
      if(sv)sv.textContent=Math.round(state.scale)+'%';
      const yv=E('yVal');
      if(yv)yv.textContent=Math.round(state.y)+'%'
    }
    renderParagraph();
    renderSongs();
    renderPlays();
    renderSlot();
    renderPon();
    renderBgList();
    renderAud();
    renderVoiceRec();
    renderKara();
    renderCharUI();
    renderSceneForm?.();
    renderMotionOut()
  }

  for(const[id,k]of Object.entries(bindings)){
    const el=E(id);
    el.addEventListener('input',()=>{
      state[k]=el.type==='checkbox'?el.checked:el.type==='range'?Number(el.value):el.value;
      if(k==='script')paragraph=0;
      E('thresholdValue').textContent=state.threshold+' dB';
      E('holdValue').textContent=state.hold+' ms';
      if(k==='flapMin'&&state.flapMax<state.flapMin){state.flapMax=state.flapMin;E('studioFlapMax').value=state.flapMax}
      if(k==='flapMax'&&state.flapMin>state.flapMax){state.flapMin=state.flapMax;E('studioFlapMin').value=state.flapMin}
      renderFlapValues();
      if(k==='script')renderParagraph();
      save()
    })
  }

  function renderFlapValues(){
    E('flapMinValue').textContent=state.flapMin+' ms';
    E('flapMaxValue').textContent=state.flapMax+' ms'
  }

  function paragraphs(){
    return state.script.split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean)
  }

  function renderParagraph(){
    const p=paragraphs();
    paragraph=Math.max(0,Math.min(paragraph,Math.max(0,p.length-1)));
    E('planCurrent').textContent=p.length?`${paragraph+1} / ${p.length}\n\n${p[paragraph]}`:'台本を入力すると、段落ごとに確認できます。';
    E('planNext').disabled=paragraph>=p.length-1
  }

  E('planNext').onclick=()=>{
    paragraph++;
    renderParagraph()
  };
  E('planReset').onclick=()=>{
    paragraph=0;
    renderParagraph()
  };

  async function copy(text){
    try{
      await navigator.clipboard.writeText(text);
      toast('コピーしました')
    }catch{
      const t=document.createElement('textarea');
      t.value=text;
      document.body.append(t);
      t.select();
      const ok=document.execCommand('copy');
      t.remove();
      toast(ok?'コピーしました':'コピーできませんでした。本文を選択してコピーしてください',4000)
    }
  }

  E('planCopy').onclick=()=>copy(`企画：${state.title||'未設定'}\n進行：${state.cue||'未設定'}\n\n${state.prompt}\n\n【台本・ここまでの内容】\n${state.script}\n\nこれは配信・収録用の企画です。上の指定に沿って、次の応答・進行案を作成してください。`);
