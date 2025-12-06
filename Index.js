<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Mii Generator</title>
<style>
body { margin:0; font-family:sans-serif; background:#f2f2f2; color:#071025; }
.topbar { background:#071025; color:white; padding:10px; text-align:center; }
.controls { display:flex; justify-content:center; gap:10px; flex-wrap:wrap; padding:10px; }
.btn { padding:8px 12px; background:#0a73ff; color:white; border:none; border-radius:6px; cursor:pointer; }
.btn:disabled { background:#888; cursor:not-allowed; }
.canvas-wrap { display:flex; justify-content:center; padding:8px; }
canvas { background:white; border:1px solid #888; max-width:100%; height:auto; }
.status { text-align:center; margin:4px 0; font-size:0.9em; }
.info { text-align:center; font-size:0.9em; margin-top:4px; }
</style>
</head>
<body>
<div class="topbar">
<h1>Mii Generator</h1>
<div class="status" id="status">Loading models…</div>
</div>

<div class="controls">
<label class="btn">Choose Photo
<input type="file" accept="image/*" id="photoInput" style="display:none">
</label>
<button class="btn" id="autoBtn" disabled>Auto Generate</button>
<button class="btn" id="exportBtn">Export PNG</button>
</div>

<div class="canvas-wrap">
<canvas id="miiCanvas" width="400" height="400"></canvas>
</div>

<div class="info" id="featureInfo">Upload a front-facing photo</div>

<script src="https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js"></script>
<script>
(async()=>{
const canvas=document.getElementById('miiCanvas');
const ctx=canvas.getContext('2d');
const dpr=window.devicePixelRatio||1;
canvas.width*=dpr; canvas.height*=dpr; ctx.scale(dpr,dpr);

let photo=null;
let parts=[];

const statusEl=document.getElementById('status');
const featureInfo=document.getElementById('featureInfo');
const autoBtn=document.getElementById('autoBtn');
const exportBtn=document.getElementById('exportBtn');
const photoInput=document.getElementById('photoInput');

const library={
  heads:[{id:1,src:'https://i.imgur.com/8Qzq9sD.png',name:'Head1'}],
  hairs:[{id:1,src:'https://i.imgur.com/TcHkTQu.png',name:'Hair1'}],
  eyes:[{id:1,src:'https://i.imgur.com/NrOa3Od.png',name:'Eyes1'}],
  mouths:[{id:1,src:'https://i.imgur.com/EFz1zOv.png',name:'Mouth1'}],
  noses:[{id:1,src:'https://i.imgur.com/8v7Xc7s.png',name:'Nose1'}],
  glasses:[]
};

statusEl.textContent='Loading face models…';
const MODEL_URL='https://raw.githubusercontent.com/justadudewhohacks/face-api.js-models/master/weights';
await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
await faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL);
statusEl.textContent='Models ready';
autoBtn.disabled=false;

function renderCanvas(){
  ctx.clearRect(0,0,canvas.width/dpr,canvas.height/dpr);
  ctx.save();
  const cw=canvas.width/dpr, ch=canvas.height/dpr;
  ctx.translate(cw/2,ch/2);
  if(photo){
    const iw=photo.naturalWidth, ih=photo.naturalHeight;
    const r=Math.min(cw/iw,ch/ih);
    ctx.drawImage(photo,-iw*r/2,-ih*r/2,iw*r,ih*r);
  }
  for(const p of parts){
    if(!p.image) continue;
    ctx.save();
    ctx.translate(p.x,p.y);
    ctx.rotate((p.rot||0)*Math.PI/180);
    ctx.scale(p.scale||1,p.scale||1);
    ctx.drawImage(p.image,-(p.width||64)/2,-(p.height||64)/2,p.width||64,p.height||64);
    ctx.restore();
  }
  ctx.restore();
}

photoInput.onchange=(e)=>{
  const file=e.target.files[0];
  if(!file) return;
  const url=URL.createObjectURL(file);
  const img=new Image();
  img.onload=()=>{ photo=img; URL.revokeObjectURL(url); renderCanvas(); featureInfo.textContent='Photo loaded. Tap "Auto Generate"'; };
  img.src=url;
};

function addPart(category,item,pos,scale=1){
  const img=new Image();
  img.onload=()=>{
    parts.push({id:Date.now()+Math.random(),image:img,x:pos.x,y:pos.y,scale,rot:0,width:img.naturalWidth,height:img.naturalHeight});
    renderCanvas();
  };
  img.src=item.src;
}

function avgPoints(arr){ const s=arr.reduce((a,p)=>({x:a.x+p.x,y:a.y+p.y}),{x:0,y:0}); return {x:s.x/arr.length,y:s.y/arr.length}; }
function dist(a,b){ return Math.hypot(a.x-b.x,a.y-b.y); }
function toCanvasCoords(px,py){ const cw=canvas.width/dpr,ch=canvas.height/dpr,r=Math.min(cw/photo.naturalWidth,ch/photo.naturalHeight); return {x:px*r-cw/2,y:py*r-ch/2}; }

autoBtn.onclick=async()=>{
  if(!photo) return alert('Upload a photo first');
  statusEl.textContent='Detecting face…';
  const detection=await faceapi.detectSingleFace(photo,new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks(true);
  if(!detection){ statusEl.textContent='No face detected'; return alert('No face detected'); }
  const lm=detection.landmarks;
  const le=avgPoints(lm.getLeftEye());
  const re=avgPoints(lm.getRightEye());
  const nose=lm.getNose()[3]||lm.getNose()[0];
  const jaw=lm.getJawOutline(), chin=jaw[jaw.length-1];
  if(Math.abs((le.x+re.x)/2 - nose.x)>50){ alert('Use a frontal face photo'); return; }

  const cmEye=toCanvasCoords((le.x+re.x)/2,(le.y+re.y)/2);
  const cmMouth=toCanvasCoords(avgPoints(lm.getMouth()).x,avgPoints(lm.getMouth()).y);
  const cmNose=toCanvasCoords(nose.x,nose.y);
  const cmChin=toCanvasCoords(chin.x,chin.y);
  const faceHeight=dist({x:nose.x,y:nose.y},{x:chin.x,y:chin.y});
  const baseScale=Math.max(0.6,Math.min(2.4,faceHeight/photo.naturalHeight*4));

  addPart('heads',library.heads[0],{x:0,y:-10},baseScale);
  addPart('eyes',library.eyes[0],cmEye,baseScale*0.6);
  addPart('mouths',library.mouths[0],cmMouth,baseScale*0.45);
  addPart('hairs',library.hairs[0],{x:cmEye.x,y:cmEye.y-faceHeight*0.35/dpr},baseScale*1.05);
  addPart('noses',library.noses[0],cmNose,baseScale*0.4);

  statusEl.textContent='Mii generated';
  featureInfo.textContent=`Face height: ${Math.round(faceHeight)}`;
};

exportBtn.onclick=()=>{
  const exportCanvas=document.createElement('canvas');
  const size=512;
  exportCanvas.width=size; exportCanvas.height=size;
  const ectx=exportCanvas.getContext('2d');
  ectx.fillStyle='#071025'; ectx.fillRect(0,0,size,size);
  if(photo) ectx.drawImage(photo,0,0,size,size);
  for(const p of parts){ if(!p.image) continue; ectx.save(); ectx.translate(size/2+p.x,size/2+p.y); ectx.rotate((p.rot||0)*Math.PI/180); ectx.scale(p.scale||1,p.scale||1); ectx.drawImage(p.image,-(p.width||64)/2,-(p.height||64)/2,p.width||64,p.height||64); ectx.restore(); }
  exportCanvas.toBlob(blob=>{ const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='mii.png'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); },'image/png');
};
})();
</script>
</body>
</html>
