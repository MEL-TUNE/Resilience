/* ===================== 動画の入れ物（WebM / MP4）を組み立てる ===================== */

const Mux=(()=>{
 
  const te=new TextEncoder();
 
  const u=(n,bytes)=>{
    const a=new Uint8Array(bytes);
    for(let i=bytes-1;i>=0;i--){
      a[i]=n%256;
      n=Math.floor(n/256)
    }
    return a
  };
 
  const cat=parts=>{
    let n=0;
    for(const p of parts)n+=p.length;
    const o=new Uint8Array(n);
    let off=0;
    for(const p of parts){
      o.set(p,off);
      off+=p.length
    }
    return o
  };
 
  const total=parts=>parts.reduce((s,p)=>s+p.length,0);
 /* ---- WebM (Matroska) ---- */
 
  const vint=n=>{
    for(let len=1;len<=8;len++){
      if(n<Math.pow(2,7*len)-1){
        const a=u(n,len);
        a[0]|=0x80>>(len-1);
        return a
      }
    }
    throw Error('size')
  };
 
  const idb=id=>u(id,Math.ceil(id.toString(16).length/2));
 
  const el=(id,data)=>{
    const d=Array.isArray(data)?cat(data):data;
    return cat([idb(id),vint(d.length),d])
  };
 
  const uintEl=(id,n)=>{
    let b=1;
    while(n>=Math.pow(2,8*b))b++;
    return el(id,u(n,b))
  };
 
  const uint8El=(id,n)=>el(id,u(n,8));
 
  const floatEl=(id,f)=>{
    const b=new Uint8Array(8);
    new DataView(b.buffer).setFloat64(0,f);
    return el(id,b)
  };
 
  const strEl=(id,s)=>el(id,te.encode(s));
 
  function opusHead(channels,sampleRate,preSkip=312){
    const b=new Uint8Array(19),
      v=new DataView(b.buffer);
    b.set(te.encode('OpusHead'));
    v.setUint8(8,1);
    v.setUint8(9,channels);
    v.setUint16(10,preSkip,true);
    v.setUint32(12,sampleRate,true);
    v.setInt16(16,0,true);
    v.setUint8(18,0);
    return b
  }
 
  function webm({video,audio,durationMs}){
  
    const head=audio.description&&audio.description.length>=19&&String.fromCharCode(...audio.description.slice(0,8))==='OpusHead'?audio.description:opusHead(audio.channels,audio.sampleRate);
  
    const preSkip=new DataView(head.buffer,head.byteOffset).getUint16(10,true);
  
    const ebml=el(0x1A45DFA3,[uintEl(0x4286,1),uintEl(0x42F7,1),uintEl(0x42F2,4),uintEl(0x42F3,8),strEl(0x4282,'webm'),uintEl(0x4287,4),uintEl(0x4285,2)]);
  
    const info=el(0x1549A966,[uintEl(0x2AD7B1,1000000),strEl(0x4D80,'kissa-studio'),strEl(0x5741,'kissa-studio'),floatEl(0x4489,durationMs)]);
  
    const tracks=el(0x1654AE6B,[
   el(0xAE,[uintEl(0xD7,1),uintEl(0x73C5,1),uintEl(0x83,1),strEl(0x86,video.codec),el(0xE0,[uintEl(0xB0,video.width),uintEl(0xBA,video.height)])]),
   el(0xAE,[
        uintEl(0xD7,2),
        uintEl(0x73C5,2),
        uintEl(0x83,2),
        strEl(0x86,'A_OPUS'),
        el(0x63A2,head),
        uintEl(0x56AA,Math.round(preSkip/48000*1e9)),
        uintEl(0x56BB,80000000),
        el(0xE1,[floatEl(0xB5,48000),uintEl(0x9F,audio.channels)])
      ])]);
  
    const blocks=[...video.chunks.map(c=>({...c,track:1})),...audio.chunks.map(c=>({...c,track:2,key:true}))].map(b=>({...b,ms:Math.max(0,Math.round(b.ts/1000))})).sort((a,b)=>a.ms-b.ms||a.track-b.track);
  
    const clusters=[],
      cueList=[];
    let cur=null;
  
    const close=()=>{
      if(cur){
        clusters.push({ms:cur.ms,cue:cur.cue,bytes:el(0x1F43B675,[uintEl(0xE7,cur.ms),...cur.blocks])})
      }
    };
  
    for(const b of blocks){
   
      if(!cur||(b.track===1&&b.key)||b.ms-cur.ms>30000){
        close();
        cur={ms:b.ms,cue:b.track===1&&b.key,blocks:[]}
      }
   
      const hdr=new Uint8Array(4);
      hdr[0]=0x80|b.track;
      new DataView(hdr.buffer).setInt16(1,b.ms-cur.ms);
      hdr[3]=b.key?0x80:0;
   
      cur.blocks.push(el(0xA3,cat([hdr,b.data])));
  
    }
  
    close();
  
    const seek=(id,pos)=>el(0x4DBB,[el(0x53AB,idb(id)),uint8El(0x53AC,pos)]);
  
    const seekLen=el(0x114D9B74,[seek(0x1549A966,0),seek(0x1654AE6B,0),seek(0x1C53BB6B,0)]).length;
  
    const posInfo=seekLen,
      posTracks=posInfo+info.length;
    let pos=posTracks+tracks.length;
  
    for(const c of clusters){
      if(c.cue)cueList.push(el(0xBB,[uintEl(0xB3,c.ms),el(0xB7,[uintEl(0xF7,1),uint8El(0xF1,pos)])]));
      pos+=c.bytes.length
    }
  
    const cues=el(0x1C53BB6B,cueList.length?cueList:[el(0xBB,[uintEl(0xB3,0),el(0xB7,[uintEl(0xF7,1),uint8El(0xF1,posTracks+tracks.length)])])]);
  
    const seekHead=el(0x114D9B74,[seek(0x1549A966,posInfo),seek(0x1654AE6B,posTracks),seek(0x1C53BB6B,pos)]);
  
    const body=[seekHead,info,tracks,...clusters.map(c=>c.bytes),cues];
  
    const segSize=u(total(body),8);
    segSize[0]=0x01;
  
    return [ebml,cat([idb(0x18538067),segSize]),...body];
 
  }
 /* ---- MP4 (H.264 + AAC) ---- */
 
  const box=(type,...parts)=>{
    const body=cat(parts.flat());
    return cat([u(body.length+8,4),te.encode(type),body])
  };
 
  const fbox=(type,v,flags,...parts)=>box(type,u(v,1),u(flags,3),...parts);
 
  const MATRIX=cat([0x00010000,0,0,0,0x00010000,0,0,0,0x40000000].map(x=>u(x,4)));
 
  const rle=list=>{
    const out=[];
    for(const d of list){
      const last=out[out.length-1];
      if(last&&last[1]===d)last[0]++;else out.push([1,d])
    }
    return out
  };
 
  function aacConfig(sampleRate,channels){
    const rates=[96000,88200,64000,48000,44100,32000,24000,22050,16000,12000,11025,8000,7350];
    const fi=rates.indexOf(sampleRate);
    return new Uint8Array([(2<<3)|(fi>>1),((fi&1)<<7)|(channels<<3)])
  }
 
  function desc(tag,body){
    return cat([new Uint8Array([tag,body.length]),body])
  }
 
  function mp4({video,audio,durationMs}){
  
    const vs=video.chunks,
      as=audio.chunks,
      VTS=90000,
      ATS=audio.sampleRate;
  
    const order=[...vs.map((c,i)=>({c,t:1,i})),...as.map((c,i)=>({c,t:2,i}))].sort((a,b)=>a.c.ts-b.c.ts||a.t-b.t);
  
    const dataSize=total(order.map(o=>o.c.data));
  
    const large=dataSize+16>0xFFFFFFFF, 
      co64=dataSize+(1<<24)>0xFFFFFFFF;
  
    const vDur=vs.map((c,i)=>Math.max(1,Math.round(((i+1<vs.length?vs[i+1].ts:durationMs*1000)-c.ts)*VTS/1e6)));
  
    const aDur=as.map((c,i)=>i+1<as.length?Math.max(1,Math.round((as[i+1].ts-c.ts)*ATS/1e6)):1024);
  
    const asc=aacConfig(audio.sampleRate,audio.channels);
  
    function build(offsets){
   
      const stco=list=>co64?fbox('co64',0,0,u(list.length,4),...list.map(x=>u(x,8))):fbox('stco',0,0,u(list.length,4),...list.map(x=>u(x,4)));
   
      const stts=d=>{
        const r=rle(d);
        return fbox('stts',0,0,u(r.length,4),...r.map(([n,v])=>cat([u(n,4),u(v,4)])))
      };
   
      const stsc=fbox('stsc',0,0,u(1,4),u(1,4),u(1,4),u(1,4));
   
      const stsz=list=>fbox('stsz',0,0,u(0,4),u(list.length,4),...list.map(c=>u(c.data.length,4)));
   
      const dinf=box('dinf',fbox('dref',0,0,u(1,4),fbox('url ',0,1)));
   
      const hdlr=(t,name)=>fbox('hdlr',0,0,u(0,4),te.encode(t),new Uint8Array(12),te.encode(name+'\0'));
   
      const tkhd=(id,dur,vol,w,h)=>fbox('tkhd',0,3,u(0,4),u(0,4),u(id,4),u(0,4),u(dur,4),new Uint8Array(8),u(0,2),u(0,2),u(vol,2),u(0,2),MATRIX,u(w*65536,4),u(h*65536,4));
   
      const mdhd=(ts,dur)=>fbox('mdhd',0,0,u(0,4),u(0,4),u(ts,4),u(dur,4),u(0x55C4,2),u(0,2));
   
      const avc1=box('avc1',new Uint8Array(6),u(1,2),new Uint8Array(16),u(video.width,2),u(video.height,2),u(0x00480000,4),u(0x00480000,4),u(0,4),u(1,2),new Uint8Array(32),u(0x18,2),u(0xFFFF,2),box('avcC',video.description));
   
      const esds=fbox('esds',0,0,desc(3,cat([u(1,2),u(0,1),desc(4,cat([u(0x40,1),u(0x15,1),u(0,3),u(audio.bitrate||192000,4),u(audio.bitrate||192000,4),desc(5,asc)])),desc(6,new Uint8Array([2]))])));
   
      const mp4a=box('mp4a',new Uint8Array(6),u(1,2),new Uint8Array(8),u(audio.channels,2),u(16,2),u(0,2),u(0,2),u(ATS*65536,4),esds);
   
      const keys=vs.map((c,i)=>c.key?i+1:0).filter(Boolean);
   
      const vTrak=box('trak',tkhd(1,durationMs,0,video.width,video.height),box('mdia',mdhd(VTS,vDur.reduce((a,b)=>a+b,0)),hdlr('vide','VideoHandler'),box('minf',fbox('vmhd',0,1,new Uint8Array(8)),dinf,box('stbl',fbox('stsd',0,0,u(1,4),avc1),stts(vDur),fbox('stss',0,0,u(keys.length,4),...keys.map(k=>u(k,4))),stsc,stsz(vs),stco(offsets.v)))));
   
      const aTrak=box('trak',tkhd(2,durationMs,0x0100,0,0),box('mdia',mdhd(ATS,aDur.reduce((a,b)=>a+b,0)),hdlr('soun','SoundHandler'),box('minf',fbox('smhd',0,0,u(0,4)),dinf,box('stbl',fbox('stsd',0,0,u(1,4),mp4a),stts(aDur),stsc,stsz(as),stco(offsets.a)))));
   
      const mvhd=fbox('mvhd',0,0,u(0,4),u(0,4),u(1000,4),u(durationMs,4),u(0x00010000,4),u(0x0100,2),new Uint8Array(10),MATRIX,new Uint8Array(24),u(3,4));
   
      return box('moov',mvhd,vTrak,aTrak);
  
    }
  
    const ftyp=box('ftyp',te.encode('isom'),u(0x200,4),te.encode('isom'),te.encode('iso2'),te.encode('avc1'),te.encode('mp41'));
  
    const mdatHead=large?cat([u(1,4),te.encode('mdat'),u(dataSize+16,8)]):cat([u(dataSize+8,4),te.encode('mdat')]);
  
    const zero={v:vs.map(()=>0),a:as.map(()=>0)};
  
    const base=ftyp.length+build(zero).length+mdatHead.length;
  
    const offsets={v:[],a:[]};
    let off=base;
    for(const o of order){
      (o.t===1?offsets.v:offsets.a)[o.i]=off;
      off+=o.c.data.length
    }
  
    return [ftyp,build(offsets),mdatHead,...order.map(o=>o.c.data)];
 
  }
 
  const stripAdts=d=>d.length>9&&d[0]===0xFF&&(d[1]&0xF6)===0xF0?d.subarray((d[1]&1)?7:9):d;
 
  return {webm,mp4,stripAdts};

})();
