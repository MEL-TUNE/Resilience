/* 映像の向き・立ち絵の動きボタン・画像生成AI用のプロンプト */

  function applyAspect(){
    const v=state.aspect==='portrait';
    W=v?720:1280;
    H=v?1280:720;
    if(canvas.width!==W||canvas.height!==H){
      canvas.width=W;
      canvas.height=H;
      for(const p of particles)p.beh=''
    }
    document.body.dataset.studioAspect=state.aspect;
    E('studioAspect').value=state.aspect;
    applyPerfLabel()
  }

  E('studioAspect').onchange=e=>{
    if(mediaRecorder&&mediaRecorder.state!=='inactive'){
      e.target.value=state.aspect;
      toast('収録中は映像の向きを変えられません');
      return
    }
    state.aspect=e.target.value==='portrait'?'portrait':'landscape';
    save();
    applyAspect();
    if(outputWindow&&!outputWindow.closed)try{
      outputWindow.resizeTo(W>H?1280:450,W>H?760:840)
    }catch(_){}
    toast(W>H?'横向き（1280×720）にしました':'縦向き（720×1280）にしました')
  };

  function setMotion(m){
    motion=MOTION_LABEL[m]?m:'still';
    document.querySelectorAll('[data-motion]').forEach(b=>{
      const on=b.dataset.motion===motion;
      b.classList.toggle('selected',on);
      b.setAttribute('aria-pressed',String(on))
    })
  }

  document.querySelectorAll('[data-motion]').forEach(b=>b.onclick=()=>setMotion(b.dataset.motion));

  const PROMPT_GUIDE={
    flutter:'薄く平たい形。真上からやや斜め上に見た向き。回転したり裏返ったりしても不自然に見えない、左右対称に近い輪郭。',
    leaf:'葉や花びらのように平たい形。柄や茎を下側に短く残す。左右に揺れながら落ちても自然な向き。',
    rise:'丸みのある形。真正面から見た向き。回転しても見た目がほぼ変わらない形。',
    snow:'小さく軽そうな形。中心から放射状、または中心対称に近い輪郭。',
    roll:'真横から見た向き。重心が画像のちょうど中心に来るよう配置し、転がって回転しても不自然に見えない丸みのある輪郭。'
  };

  function imagePrompt(){
    const motif=E('promptMotif').value.trim()||'（モチーフ名）',
      mv=E('promptMotion').value,
      color=E('promptColor').value.trim();
    return `配信画面の演出で、画面上を舞わせる「${motif}」の素材画像を1枚作ってください。

【必須条件】
・背景は完全な透過（透過PNG）。白い背景や市松模様を描き込まない
・${motif}を1つだけ、画像の中央に配置し、上下左右に約10％の余白を残して全体を収める
・正方形、1024×1024
・文字、ロゴ、枠線、署名、地面の影、背景の小物は入れない

【画風】
・大人向けアニメイラストの繊細な立ち絵と並べても浮かない、上品で洗練された描写
・細い線、またはごく淡い輪郭。太い黒の縁取り、原色のベタ塗り、幼児向けクリップアート調にはしない
・淡い陰影、柔らかな反射光、ほんのりとした透明感
・画面では直径20〜80ピクセルほどの小ささで表示されるため、縮小してもシルエットが判別できる形にする

【形と向き】
${PROMPT_GUIDE[mv]||PROMPT_GUIDE.flutter}

【色】
${color||'モチーフ本来の色を、彩度をやや抑えて上品に'}

色や形の違うバリエーションが欲しいときは、1枚の画像に並べず、別々の画像として1枚ずつ作ってください。`
  }

  E('promptMotion').value='flutter';
  E('promptCopy').onclick=()=>copy(imagePrompt());
  E('promptPreview').onclick=()=>{
    E('promptOut').textContent=imagePrompt();
    E('promptOut').hidden=false
  };
