/* ══════════════════════════════════════════
   첨부파일 미리보기 — filepreview.js
   "+ 파일 추가"로 올린 파일(Pedestal 이력 관리, 셋업 진행 기록)을 현재 창 위에 겹쳐 열어서 본다.
   - 이미지: 그대로 표시
   - Drive에 올라간 그 밖의 모든 형식(PDF, Word/Excel/PowerPoint, 영상/음성, 텍스트 등): Google Drive 미리보기 화면으로 표시
   - 앱에 포함된 기준 양식(.xlsx): 표로 표시
   - 링크 첨부: 새 탭에서 연다. 미리보기가 안 되는 형식은 안내 후 다운로드로 연결
══════════════════════════════════════════ */
var FP_IMG_RE=/\.(png|jpe?g|gif|bmp|webp|svg|ico|tiff?)$/i;
var FP_XLS_RE=/\.(xlsx|xlsm)$/i;

function _fpIsStatic(f){ return String(f&&f.id).indexOf('ref-')===0; }
function _fpIsLink(f){ return !!(f&&(f.link||String(f.id).indexOf('link-')===0)); }
function _fpAbs(u){ try{ return new URL(u,location.href).href; }catch(e){ return u; } }
function _fpIsImage(f){ return /^image\//.test(f.mimeType||'')||FP_IMG_RE.test(f.name||''); }
function _fpSize(b){
  if(!b&&b!==0) return '';
  if(b<1024) return b+'B';
  if(b<1024*1024) return Math.round(b/1024)+'KB';
  return (b/1024/1024).toFixed(1)+'MB';
}
function closeFilePreview(){
  var ov=document.getElementById('fpOverlay'); if(ov) ov.remove();
  document.removeEventListener('keydown',_fpKey,true);
}
function _fpKey(e){ if(e.key==='Escape'){ e.stopPropagation(); closeFilePreview(); } }

function openFilePreview(f){
  if(!f) return;
  if(_fpIsLink(f)){ window.open(f.downloadUrl||f.viewUrl,'_blank','noopener'); return; }
  closeFilePreview();
  var st=_fpIsStatic(f);
  var dl=st?_fpAbs(f.downloadUrl):(f.downloadUrl||f.viewUrl||'#');
  var openUrl=st?_fpAbs(f.viewUrl||f.downloadUrl):(f.viewUrl||dl);
  var ov=document.createElement('div'); ov.id='fpOverlay'; ov.className='fp-overlay';
  ov.innerHTML='<div class="fp-box"><div class="fp-head">'
    +'<span class="fp-name" title="'+_esc(f.name||'')+'">'+_esc(f.name||'')+'</span>'
    +'<span class="fp-meta">'+_esc(_fpSize(f.size))+'</span><span class="fp-sp"></span>'
    +'<a class="btn sm" href="'+_esc(dl)+'" target="_blank" rel="noopener" style="text-decoration:none">다운로드</a>'
    +'<a class="btn sm" href="'+_esc(openUrl)+'" target="_blank" rel="noopener" style="text-decoration:none">새 탭에서 열기</a>'
    +'<button class="btn sm pri" onclick="closeFilePreview()">닫기</button></div>'
    +'<div class="fp-body" id="fpBody"><div class="fp-msg">불러오는 중...</div></div></div>';
  ov.addEventListener('mousedown',function(e){ if(e.target===ov) closeFilePreview(); });
  document.body.appendChild(ov);
  document.addEventListener('keydown',_fpKey,true);
  var body=document.getElementById('fpBody');
  var driveEmbed='https://drive.google.com/file/d/'+encodeURIComponent(f.id)+'/preview';
  function frame(src){ body.innerHTML='<iframe class="fp-frame" src="'+_esc(src)+'" allow="autoplay; fullscreen" allowfullscreen></iframe>'; }
  function msg(h){ body.innerHTML='<div class="fp-msg">'+h+'</div>'; }

  if(_fpIsImage(f)){
    var src=st?_fpAbs(f.downloadUrl):'https://drive.google.com/thumbnail?id='+encodeURIComponent(f.id)+'&sz=w2400';
    var img=new Image();
    img.className='fp-img'; img.alt=f.name||'';
    img.onload=function(){ body.innerHTML=''; body.appendChild(img); };
    img.onerror=function(){ if(st) msg('이미지를 불러올 수 없습니다.'); else frame(driveEmbed); };
    img.src=src;
    return;
  }
  if(st&&FP_DWG_RE.test(f.name||'')){ _fpDwg(f,body,st,dl); return; }
  if(st){
    if(FP_XLS_RE.test(f.name||'')){
      fetch(dl,{cache:'no-store'}).then(function(r){ if(!r.ok) throw new Error('불러오지 못했습니다.'); return r.arrayBuffer(); })
        .then(function(buf){
          return new Promise(function(res){ _ensureExcelJS(res); }).then(function(){
            var wb=new ExcelJS.Workbook(); return wb.xlsx.load(buf).then(function(){ return wb; });
          });
        })
        .then(function(wb){
          var saved=typeof _pdXl!=='undefined'?_pdXl:null;
          var ws=wb.worksheets[0];
          _pdXl={wb:wb,ws:ws,ctx:null,fileId:f.id,fileName:f.name,lastRow:_pdXlLastRow(ws)+2};
          var html=_pdXlGridHtml().replace(/ contenteditable="plaintext-only"/g,'');
          _pdXl=saved;
          body.innerHTML='<div class="fp-xl">'+html+'</div>';
        })
        .catch(function(e){ msg('미리보기를 만들지 못했습니다: '+_esc(e&&e.message||e)); });
      return;
    }
    frame(dl); // 앱에 포함된 그 밖의 파일은 브라우저가 직접 보여줄 수 있는 형식(PDF/텍스트 등)이면 그대로 표시
    return;
  }
  if(FP_DWG_RE.test(f.name||'')){ _fpDwg(f,body,st,dl); return; }
  // Drive에 올라간 파일 — Drive 미리보기가 PDF, Office 문서, 영상/음성, 텍스트 등 대부분의 형식을 처리한다
  frame(driveEmbed);
  // 미리보기를 지원하지 않는 형식(압축 파일 등)은 Drive가 안내 화면을 보여주므로 별도 안내를 아래에 덧붙인다
  var tip=document.createElement('div'); tip.className='fp-tip';
  tip.textContent='미리보기가 되지 않는 형식(압축 파일, 설계 도면 원본 등)은 다운로드해서 열어 주세요.';
  body.appendChild(tip);
}

/* ── DWG 도면 미리보기 ──
   브라우저는 DWG를 직접 못 읽으므로, 파일을 서버에 올리지 않고 이 브라우저 안에서 변환한다(오픈소스 LibreDwg의 WebAssembly 버전).
   변환 엔진은 처음 한 번만 내려받고(약 10MB), 변환한 도면은 SVG로 그려서 마우스 휠 확대/축소와 끌어서 이동을 지원한다.
   매우 큰 도면은 변환에 시간이 걸릴 수 있다. */
var FP_DWG_RE=/\.dwg$/i;
var _fpLibPromise=null;
function _fpLoadDwgLib(){
  if(_fpLibPromise) return _fpLibPromise;
  var base='https://cdn.jsdelivr.net/npm/@mlightcad/libredwg-web@0.8.0';
  _fpLibPromise=import(base+'/dist/libredwg-web.js').then(function(m){
    return m.LibreDwg.create(base+'/wasm').then(function(lib){ return {m:m,lib:lib}; });
  });
  _fpLibPromise.catch(function(){ _fpLibPromise=null; });
  return _fpLibPromise;
}
function _fpBytes(f,st,dl){
  if(st) return fetch(dl).then(function(r){ if(!r.ok) throw new Error('파일을 불러오지 못했습니다.'); return r.arrayBuffer(); });
  var url=getSheetsUrl(); if(!url) return Promise.reject(new Error('Sheets 연동 URL이 설정되어 있지 않습니다.'));
  return fetch(url,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({action:'getFile',fileId:f.id})})
    .then(function(r){return r.json();})
    .then(function(d){
      if(d.error) throw new Error(d.error);
      var bin=atob(d.base64Data), buf=new Uint8Array(bin.length);
      for(var i=0;i<bin.length;i++) buf[i]=bin.charCodeAt(i);
      return buf.buffer;
    });
}
function _fpDwg(f,body,st,dl){
  var stage=function(t){ if(document.getElementById('fpBody')===body) body.innerHTML='<div class="fp-msg">'+t+'</div>'; };
  stage('DWG 도면을 불러오는 중... (처음에는 변환 엔진을 내려받느라 10~30초 걸릴 수 있습니다)');
  Promise.all([_fpLoadDwgLib(),_fpBytes(f,st,dl)]).then(function(r){
    stage('도면을 변환하는 중...');
    return new Promise(function(res){ setTimeout(res,50); }).then(function(){
      var lib=r[0].lib, m=r[0].m;
      var dwg=lib.dwg_read_data(r[1],m.Dwg_File_Type.DWG);
      if(!dwg) throw new Error('DWG 파일을 읽을 수 없습니다(지원하지 않는 버전이거나 손상된 파일일 수 있습니다).');
      var db=lib.convert(dwg), svg=lib.dwg_to_svg(db);
      try{ lib.dwg_free(dwg); }catch(e){}
      return String(svg);
    });
  }).then(function(svgText){
    if(document.getElementById('fpBody')!==body) return; // 그 사이 창을 닫았으면 그리지 않는다
    _fpShowSvg(body,svgText);
  }).catch(function(e){
    if(document.getElementById('fpBody')!==body) return;
    body.innerHTML='<div class="fp-msg">도면을 미리보기로 열지 못했습니다: '+_esc(e&&e.message||e)+'<br><br>상단의 <b>다운로드</b>로 받아서 CAD 프로그램에서 열어 주세요.</div>';
  });
}
function _fpShowSvg(body,svgText){
  var doc=new DOMParser().parseFromString(svgText,'image/svg+xml'), svg=doc.documentElement;
  if(!svg||svg.nodeName.toLowerCase()!=='svg'||doc.querySelector('parsererror')){ body.innerHTML='<div class="fp-msg">도면 변환 결과를 표시할 수 없습니다.</div>'; return; }
  svg.removeAttribute('width'); svg.removeAttribute('height');
  svg.setAttribute('preserveAspectRatio','xMidYMid meet');
  var vb=(svg.getAttribute('viewBox')||'').split(/[\s,]+/).map(Number);
  if(vb.length!==4||vb.some(isNaN)){ vb=[0,0,1000,1000]; svg.setAttribute('viewBox',vb.join(' ')); }
  var home=vb.slice();
  body.innerHTML='<div class="fp-dwg-bar"><span>휠: 확대/축소 · 끌기: 이동</span><button class="btn sm" id="fpDwgFit">전체 보기</button><button class="btn sm" id="fpDwgBg">배경 전환</button></div><div class="fp-dwg" id="fpDwg"></div>';
  var box=document.getElementById('fpDwg'); box.appendChild(document.importNode(svg,true));
  var el=box.querySelector('svg');
  function apply(){ el.setAttribute('viewBox',vb.join(' ')); }
  // 변환기가 주는 viewBox는 도면 밖 여백이 클 때가 있어서, 실제 그려진 범위에 맞춰 처음 화면을 맞춘다
  try{
    var bb=el.getBBox();
    if(bb&&bb.width>0&&bb.height>0){ vb=[bb.x-bb.width*0.03,bb.y-bb.height*0.03,bb.width*1.06,bb.height*1.06]; home=vb.slice(); apply(); }
  }catch(e){}
  function ptAt(ev){ var p=el.createSVGPoint(); p.x=ev.clientX; p.y=ev.clientY; return p.matrixTransform(el.getScreenCTM().inverse()); }
  box.addEventListener('wheel',function(ev){
    ev.preventDefault();
    var k=ev.deltaY<0?0.85:1/0.85, p=ptAt(ev);
    vb=[p.x-(p.x-vb[0])*k,p.y-(p.y-vb[1])*k,vb[2]*k,vb[3]*k]; apply();
  },{passive:false});
  var drag=null;
  box.addEventListener('mousedown',function(ev){ drag={x:ev.clientX,y:ev.clientY,vb:vb.slice()}; box.classList.add('grab'); });
  window.addEventListener('mousemove',function mv(ev){
    if(!document.getElementById('fpDwg')){ window.removeEventListener('mousemove',mv); return; }
    if(!drag) return;
    var ctm=el.getScreenCTM(); if(!ctm) return;
    vb=[drag.vb[0]-(ev.clientX-drag.x)/ctm.a,drag.vb[1]-(ev.clientY-drag.y)/ctm.d,drag.vb[2],drag.vb[3]]; apply();
  });
  window.addEventListener('mouseup',function(){ drag=null; var b=document.getElementById('fpDwg'); if(b) b.classList.remove('grab'); });
  document.getElementById('fpDwgFit').onclick=function(){ vb=home.slice(); apply(); };
  var white=false;
  document.getElementById('fpDwgBg').onclick=function(){
    white=!white; box.style.background=white?'#fff':'#17171c';
    box.classList.toggle('inv',white); // 흰 배경에서는 흰색 선이 안 보이므로 색을 반전
  };
}
