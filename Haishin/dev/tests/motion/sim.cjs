// 30-drawing.js の avatarPose を取り出して、時間ごとの dx・dy・傾きを書き出す
const fs=require('fs');
const src=fs.readFileSync(process.argv[2],'utf8');
const a=src.indexOf("  let motion='still'"),b=src.indexOf('  const avCache');
const code=src.slice(a,b);
const W=1280,H=720;
const geoH=+process.env.GH||612;
const st={x:0,y:0,scale:85,motionAmt:100,motionSing:100,motionSingSpeed:100,motionHop:100,motionShake:100,motionWander:100,motionIya:100,bounce:true,expr:''};
const out={};
for(const m of ['sing','hop','shake','wander','iya']){
  const f=new Function('W','H','state','curChar','selfSpeak','avatarGeom','effMotionOf','curExprObj',code.replace(/effMotion\(\)/g,'effMotionOf()')+';return {avatarPose,set:v=>{motion=v}}');
  let i=0;const api=f(W,H,st,()=>({mode:'multi'}),()=>false,()=>({cx:W/2,bottom:H,w:300,h:geoH,faceY:H-geoH*.86}),()=>(i<420?m:'still'),()=>null);
  const rows=[];
  for(i=0;i<=600;i++){const now=1000+i*1000/60;const p=api.avatarPose(now,false);rows.push([i/60,p.dx,p.dy,p.rot*180/Math.PI])}
  out[m]=rows;
}
fs.writeFileSync(process.argv[3],JSON.stringify(out));
