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
    // 매우 큰 도면은 화면에 올리면 브라우저가 느려질 수 있어 먼저 확인한다
    if(svgText.length>30*1024*1024){
      body.innerHTML='<div class="fp-msg">매우 큰 도면입니다(변환 결과 '+Math.round(svgText.length/1048576)+'MB). 화면에 올리면 확대/이동이 느리거나 브라우저가 잠시 멈출 수 있습니다.<br><br><button class="btn pri" id="fpDwgGo">그래도 열기</button></div>';
      document.getElementById('fpDwgGo').onclick=function(){ body.innerHTML='<div class="fp-msg">도면을 그리는 중...</div>'; setTimeout(function(){ _fpShowSvg(body,svgText); },50); };
      return;
    }
    _fpShowSvg(body,svgText);
  }).catch(function(e){
    if(document.getElementById('fpBody')!==body) return;
    body.innerHTML='<div class="fp-msg">도면을 미리보기로 열지 못했습니다: '+_esc(e&&e.message||e)+'<br><br>상단의 <b>다운로드</b>로 받아서 CAD 프로그램에서 열어 주세요.</div>';
  });
}
function _fpShowSvg(body,svgText){
  // 변환기가 글자 내용을 이스케이프하지 않아 "<页 数>" 같은 글자가 있으면 XML이 깨진다 — 글자 안의 <, & 를 안전하게 바꾼다
  svgText=svgText.replace(/(<text\b[^>]*>)([\s\S]*?)(<\/text>)/g,function(m,a,b,c){
    return a+b.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g,'&amp;').replace(/<(?!\/?tspan\b)/g,'&lt;')+c;
  });
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

/* ── DWG → PDF 변환 (DWG를 올리면 같은 칸에 PDF도 함께 올리기 위한 변환기) ──
   도면 데이터(선·호·원·치수·글자·블록)를 SVG를 거치지 않고 곧바로 캔버스에 그려서, 흰 배경 이미지로 PDF 한 장에 담는다.
   SVG 글자열을 만들지 않으므로 도면이 아무리 커도(블록 수십만 개) 변환할 수 있고, 실제로 도면에서 쓰이는 블록만 그린다.
   글자/선은 이미지로 들어간다(PDF에서 검색·복사는 안 됨). */
function _fpLoadScript(src){
  return new Promise(function(res,rej){
    var s=document.createElement('script'); s.src=src; s.onload=res;
    s.onerror=function(){ rej(new Error('PDF 변환 도구를 불러오지 못했습니다.')); };
    document.head.appendChild(s);
  });
}
function _fpLoadJsPdf(){ return window.jspdf?Promise.resolve():_fpLoadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'); }
function _fpIsDwg(f){ return FP_DWG_RE.test((f&&f.name)||''); }

// AutoCAD 색 번호(ACI) 0~256 → RGB (6자리 16진수 × 257개)
var FP_ACI='000000ff0000ffff0000ff0000ffff0000ffff00ffffffff808080c0c0c0ff0000ff7f7fcc0000cc6666990000994c4c7f00007f3f3f4c00004c2626ff3f00ff9f7fcc3300cc7f66992600995f4c7f1f007f4f3f4c13004c2f26ff7f00ffbf7fcc6600cc9966994c0099724c7f3f007f5f3f4c26004c3926ffbf00ffdf7fcc9900ccb26699720099854c7f5f007f6f3f4c39004c4226ffff00ffff7fcccc00cccc6698980098984c7f7f007f7f3f4c4c004c4c26bfff00dfff7f99cc00b2cc6672980085984c5f7f006f7f3f394c00424c267fff00bfff7f66cc0099cc664c980072984c3f7f005f7f3f264c00394c263fff009fff7f33cc007fcc662698005f984c1f7f004f7f3f134c002f4c2600ff007fff7f00cc0066cc660098004c984c007f003f7f3f004c00264c2600ff3f7fff9f00cc3366cc7f0098264c985f007f1f3f7f4f004c13264c2f00ff7f7fffbf00cc6666cc9900984c4c9872007f3f3f7f5f004c26264c3900ffbf7fffdf00cc9966ccb20098724c9885007f5f3f7f6f004c39264c4200ffff7fffff00cccc66cccc0098984c9898007f7f3f7f7f004c4c264c4c00bfff7fdfff0099cc66b2cc0072984c8598005f7f3f6f7f00394c26424c007fff7fbfff0066cc6699cc004c984c7298003f7f3f5f7f00264c26394c003fff7f9fff0033cc667fcc0026984c5f98001f7f3f4f7f00134c262f4c0000ff7f7fff0000cc6666cc0000984c4c9800007f3f3f7f00004c26264c3f00ff9f7fff3300cc7f66cc2600985f4c981f007f4f3f7f13004c2f264c7f00ffbf7fff6600cc9966cc4c0098724c983f007f5f3f7f26004c39264cbf00ffdf7fff9900ccb266cc720098854c985f007f6f3f7f39004c42264cff00ffff7fffcc00cccc66cc980098984c987f007f7f3f7f4c004c4c264cff00bfff7fdfcc0099cc66b2980072984c857f005f7f3f6f4c00394c2642ff007fff7fbfcc0066cc669998004c984c727f003f7f3f5f4c00264c2639ff003fff7f9fcc0033cc667f980026984c5f7f001f7f3f4f4c00134c262f3333335b5b5b848484adadadd6d6d6ffffff000000';
function _fpAci(i){ return parseInt(FP_ACI.substr(i*6,6)||'000000',16); }
// 흰 배경에 그리므로 흰색 계열은 검정으로, 너무 밝은 색은 어둡게 바꿔 선이 보이게 한다
var _fpColCache={};
function _fpCss(ci){
  if(_fpColCache[ci]) return _fpColCache[ci];
  var v=(ci===7||ci===256||ci==null)?0xffffff:_fpAci(ci), r=(v>>16)&255, g=(v>>8)&255, b=v&255, css;
  if(r>235&&g>235&&b>235) css='#000';
  else{
    var lum=(0.299*r+0.587*g+0.114*b)/255;
    if(lum>0.55){ var k=0.45/lum; r=Math.round(r*k); g=Math.round(g*k); b=Math.round(b*k); }
    css='rgb('+r+','+g+','+b+')';
  }
  return (_fpColCache[ci]=css);
}

// 도면 범위를 재기 위한 가짜 캔버스(그리기 명령을 받아 좌표 범위만 계산한다)
function _fpMeasureCtx(){
  var M=[1,0,0,1,0,0], stack=[], bb={x0:Infinity,y0:Infinity,x1:-Infinity,y1:-Infinity};
  function pt(x,y){
    var X=M[0]*x+M[2]*y+M[4], Y=M[1]*x+M[3]*y+M[5];
    if(isFinite(X)&&isFinite(Y)){ if(X<bb.x0)bb.x0=X; if(X>bb.x1)bb.x1=X; if(Y<bb.y0)bb.y0=Y; if(Y>bb.y1)bb.y1=Y; }
  }
  function mul(a,b,c,d,e,f){
    var m=M; M=[m[0]*a+m[2]*b, m[1]*a+m[3]*b, m[0]*c+m[2]*d, m[1]*c+m[3]*d, m[0]*e+m[2]*f+m[4], m[1]*e+m[3]*f+m[5]];
  }
  function sc(){ return Math.sqrt(Math.abs(M[0]*M[3]-M[1]*M[2]))||1; }
  return {
    bb:bb,
    save:function(){ stack.push(M.slice()); }, restore:function(){ M=stack.pop()||M; },
    translate:function(x,y){ mul(1,0,0,1,x,y); },
    rotate:function(a){ var c=Math.cos(a), s=Math.sin(a); mul(c,s,-s,c,0,0); },
    scale:function(x,y){ mul(x,0,0,y,0,0); },
    beginPath:function(){}, closePath:function(){}, stroke:function(){}, fill:function(){},
    moveTo:pt, lineTo:pt,
    arc:function(cx,cy,r){ var k=sc(); var X=M[0]*cx+M[2]*cy+M[4], Y=M[1]*cx+M[3]*cy+M[5]; pt(cx+r,cy); pt(cx-r,cy); pt(cx,cy+r); pt(cx,cy-r); void k;void X;void Y; },
    ellipse:function(cx,cy,rx,ry){ var r=Math.max(rx,ry); pt(cx+r,cy); pt(cx-r,cy); pt(cx,cy+r); pt(cx,cy-r); },
    fillText:function(){ pt(0,0); }
  };
}

function _fpDbCanvas(db,longSide,onStage){
  var say=onStage||function(){};
  var layers={}, blocks={};
  ((db.tables&&db.tables.LAYER&&db.tables.LAYER.entries)||[]).forEach(function(l){ layers[l.name]=l; });
  var msName=null;
  ((db.tables&&db.tables.BLOCK_RECORD&&db.tables.BLOCK_RECORD.entries)||[]).forEach(function(b){ blocks[b.name]=b; });
  var FONT='"SimSun","Microsoft YaHei","Malgun Gothic","Noto Sans CJK KR",sans-serif';

  function clean(s){
    return String(s||'').replace(/\\U\+([0-9A-Fa-f]{4})/g,function(_,h){ return String.fromCharCode(parseInt(h,16)); })
      .replace(/\\P/g,'\n').replace(/\\[LOlo]/g,'').replace(/\\[Ff][^;]*;/g,'').replace(/\\S([^;^\/#]*)[\^\/#]([^;]*);/g,'$1/$2')
      .replace(/\\[KkCcHhWwTtAaQq][^;]*;?/g,'').replace(/\\[a-zA-Z]+;?/g,'').replace(/[{}]/g,'')
      .replace(/%%[dD]/g,'°').replace(/%%[pP]/g,'±').replace(/%%[cC]/g,'Ø').replace(/%%%/g,'%').replace(/\\\\/g,'\\');
  }
  function bspline(t,deg,pts,knots,w){
    var n=pts.length-1, k=-1;
    for(var i=deg;i<=n;i++){ if(t>=knots[i]&&t<knots[i+1]){ k=i; break; } }
    if(k<0) k=n;
    var d=[], j, r;
    for(j=0;j<=deg;j++){ var p=pts[j+k-deg], ww=w?(w[j+k-deg]||1):1; d.push([p.x*ww,p.y*ww,ww]); }
    for(r=1;r<=deg;r++){
      for(j=deg;j>=r;j--){
        var den=knots[j+1+k-r]-knots[j+k-deg], a=den?(t-knots[j+k-deg])/den:0;
        d[j]=[(1-a)*d[j-1][0]+a*d[j][0],(1-a)*d[j-1][1]+a*d[j][1],(1-a)*d[j-1][2]+a*d[j][2]];
      }
    }
    var q=d[deg]; return {x:q[0]/(q[2]||1),y:q[1]/(q[2]||1)};
  }
  function bulgeTo(ctx,p1,p2,b){
    var dx=p2.x-p1.x, dy=p2.y-p1.y, len=Math.sqrt(dx*dx+dy*dy);
    if(!b||!len){ ctx.lineTo(p2.x,p2.y); return; }
    var off=(len/2)*(1-b*b)/(2*b), cx=(p1.x+p2.x)/2-dy/len*off, cy=(p1.y+p2.y)/2+dx/len*off;
    var r=Math.sqrt((p1.x-cx)*(p1.x-cx)+(p1.y-cy)*(p1.y-cy));
    ctx.arc(cx,cy,r,Math.atan2(p1.y-cy,p1.x-cx),Math.atan2(p2.y-cy,p2.x-cx),b<0);
  }
  function poly(ctx,v,closed){
    if(!v||!v.length) return;
    ctx.moveTo(v[0].x,v[0].y);
    for(var i=1;i<v.length;i++) bulgeTo(ctx,v[i-1],v[i],v[i-1].bulge);
    if(closed&&v.length>2) bulgeTo(ctx,v[v.length-1],v[0],v[v.length-1].bulge);
  }

  // 모든 그리기는 이 함수 하나로 한다(범위 계산용 가짜 캔버스와 실제 캔버스에 똑같이 적용)
  function draw(ctx,ents,st){
    for(var n=0;n<ents.length;n++){
      var e=ents[n]; if(!e||e.isVisible===false) continue;
      var ly=layers[e.layer];
      if(ly&&(ly.off||ly.frozen)) continue;
      if(/^defpoints$/i.test(e.layer||'')) continue;
      var ci=e.colorIndex;
      if(ci==null||ci===256) ci=(ly&&ly.colorIndex!=null&&ly.colorIndex!==256)?ly.colorIndex:7;
      else if(ci===0) ci=st.color;
      var css=_fpCss(ci), flip=e.extrusionDirection&&e.extrusionDirection.z<0;
      if(flip){ ctx.save(); ctx.scale(-1,1); }
      ctx.strokeStyle=css; ctx.fillStyle=css; ctx.lineWidth=st.lw/st.sc;
      try{ drawOne(ctx,e,st,ci); }catch(err){ /* 한 요소가 이상해도 나머지는 계속 그린다 */ }
      if(flip) ctx.restore();
    }
  }
  function drawOne(ctx,e,st,ci){
    var i, t=e.type;
    if(t==='LINE'){
      ctx.beginPath(); ctx.moveTo(e.startPoint.x,e.startPoint.y); ctx.lineTo(e.endPoint.x,e.endPoint.y); ctx.stroke();
    }else if(t==='ARC'){
      ctx.beginPath(); ctx.arc(e.center.x,e.center.y,e.radius,e.startAngle,e.endAngle,false); ctx.stroke();
    }else if(t==='CIRCLE'){
      ctx.beginPath(); ctx.arc(e.center.x,e.center.y,e.radius,0,Math.PI*2,false); ctx.stroke();
    }else if(t==='ELLIPSE'){
      var mx=e.majorAxisEndPoint.x, my=e.majorAxisEndPoint.y, rx=Math.sqrt(mx*mx+my*my), a0=e.startAngle, a1=e.endAngle;
      if(Math.abs(a1-a0)<1e-9||Math.abs(a1-a0-Math.PI*2)<1e-9){ a0=0; a1=Math.PI*2; }
      ctx.beginPath(); ctx.ellipse(e.center.x,e.center.y,rx,rx*e.axisRatio,Math.atan2(my,mx),a0,a1,false); ctx.stroke();
    }else if(t==='LWPOLYLINE'||t==='POLYLINE'){
      var vs=e.vertices; if(typeof vs==='string') return;
      ctx.beginPath(); poly(ctx,vs,!!((e.flag&512)||(e.flag&1))); ctx.stroke();
    }else if(t==='SPLINE'){
      var cp=e.controlPoints, deg=e.degree, kn=e.knots, pts=[];
      if(cp&&cp.length>deg&&kn&&kn.length>=cp.length+deg+1){
        var d0=kn[deg], d1=kn[kn.length-1-deg];
        for(i=deg;i<kn.length-deg-1;i++){
          if(kn[i+1]===kn[i]) continue;
          for(var s=0;s<=20;s++){
            var u=kn[i]+(kn[i+1]-kn[i])*s/20; if(u>=d1) u=d1-(d1-d0)*1e-12;
            pts.push(bspline(u,deg,cp,kn,e.weights&&e.weights.length?e.weights:null));
          }
        }
      }else if(e.fitPoints&&e.fitPoints.length>1) pts=e.fitPoints;
      if(pts.length>1){ ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y); for(i=1;i<pts.length;i++) ctx.lineTo(pts[i].x,pts[i].y); ctx.stroke(); }
    }else if(t==='SOLID'){
      ctx.beginPath(); ctx.moveTo(e.corner1.x,e.corner1.y); ctx.lineTo(e.corner2.x,e.corner2.y);
      if(e.corner4) ctx.lineTo(e.corner4.x,e.corner4.y); if(e.corner3) ctx.lineTo(e.corner3.x,e.corner3.y);
      ctx.closePath(); ctx.fill();
    }else if(t==='HATCH'){
      if(!e.solidFill||!e.boundaryPaths) return;
      ctx.beginPath();
      e.boundaryPaths.forEach(function(bp){
        if(bp.vertices&&bp.vertices.length){ poly(ctx,bp.vertices,true); ctx.closePath(); }
        else if(bp.edges&&bp.edges.length){
          bp.edges.forEach(function(ed,k){
            if(ed.start&&ed.end){ if(k===0) ctx.moveTo(ed.start.x,ed.start.y); ctx.lineTo(ed.end.x,ed.end.y); }
            else if(ed.center&&ed.radius!=null){ ctx.arc(ed.center.x,ed.center.y,ed.radius,ed.startAngle||0,ed.endAngle==null?Math.PI*2:ed.endAngle,ed.isCCW===false); }
          });
          ctx.closePath();
        }
      });
      ctx.fill('evenodd');
    }else if(t==='MTEXT'||t==='TEXT'){
      var lines=clean(e.text).split('\n'), h=e.textHeight; if(!(h>0)||!lines.length) return;
      var ip=t==='MTEXT'?e.insertionPoint:e.startPoint, rot=e.rotation||0;
      if(t==='MTEXT'&&e.direction&&(e.direction.x||e.direction.y)&&!rot) rot=Math.atan2(e.direction.y,e.direction.x);
      var ap=t==='MTEXT'?(e.attachmentPoint||1):1, al=(ap-1)%3, va=Math.floor((ap-1)/3);
      if(t==='TEXT'){
        al=e.halign===1?1:(e.halign===2?2:0); if(al&&e.endPoint&&(e.endPoint.x||e.endPoint.y)) ip=e.endPoint;
        va=3;
      }
      var gap=h*1.4*(t==='MTEXT'?(e.lineSpacing||1):1), total=(lines.length-1)*gap;
      ctx.save(); ctx.translate(ip.x,ip.y); ctx.rotate(rot); ctx.scale(h,-h);
      ctx.font='1px '+FONT; ctx.textAlign=al===1?'center':(al===2?'right':'left'); ctx.textBaseline=va===3?'alphabetic':(va===1?'middle':'top');
      var y0=va===1?-total/h/2:0;
      for(i=0;i<lines.length;i++) ctx.fillText(lines[i],0,y0+i*gap/h);
      ctx.restore();
    }else if(t==='DIMENSION'){
      var db2=blocks[e.name]; if(db2&&db2.entities&&st.depth<10) draw(ctx,db2.entities,{color:ci,lw:st.lw,sc:st.sc,depth:st.depth+1});
    }else if(t==='INSERT'){
      var blk=blocks[e.name]; if(!blk||!blk.entities||st.depth>=10) return;
      var sx=e.xScale||1, sy=e.yScale||1, cols=Math.max(1,e.columnCount||1), rows=Math.max(1,e.rowCount||1), bp=blk.basePoint||{x:0,y:0};
      if(cols*rows>2500) { cols=1; rows=1; }
      for(var r=0;r<rows;r++) for(var c=0;c<cols;c++){
        ctx.save();
        ctx.translate(e.insertionPoint.x,e.insertionPoint.y); ctx.rotate(e.rotation||0);
        ctx.translate(c*(e.columnSpacing||0),r*(e.rowSpacing||0)); ctx.scale(sx,sy); ctx.translate(-bp.x,-bp.y);
        draw(ctx,blk.entities,{color:ci,lw:st.lw,sc:st.sc*Math.sqrt(Math.abs(sx*sy))||st.sc,depth:st.depth+1});
        ctx.restore();
      }
    }
  }

  // 모델 공간(실제 도면 본체) 요소 목록
  var ms=db.entities;
  if(!ms||!ms.length){
    var cand=null; Object.keys(blocks).forEach(function(k){ if(/^\*model_space$/i.test(k)) cand=blocks[k]; });
    ms=cand&&cand.entities||[];
  }
  say('도면 범위를 계산하는 중...');
  var mc=_fpMeasureCtx(); draw(mc,ms,{color:7,lw:1,sc:1,depth:0});
  var bb=mc.bb;
  if(!isFinite(bb.x0)||!(bb.x1>bb.x0||bb.y1>bb.y0)) throw new Error('도면에 그릴 내용이 없습니다.');
  var bw=Math.max(bb.x1-bb.x0,1e-6), bh=Math.max(bb.y1-bb.y0,1e-6), pad=Math.max(bw,bh)*0.02;
  var vw=bw+pad*2, vh=bh+pad*2, s0=longSide/Math.max(vw,vh);
  var W=Math.max(200,Math.round(vw*s0)), H=Math.max(200,Math.round(vh*s0));
  while(W*H>64e6){ longSide*=0.9; s0=longSide/Math.max(vw,vh); W=Math.max(200,Math.round(vw*s0)); H=Math.max(200,Math.round(vh*s0)); }
  var cv=document.createElement('canvas'); cv.width=W; cv.height=H;
  var cx=cv.getContext('2d'); cx.fillStyle='#fff'; cx.fillRect(0,0,W,H);
  cx.lineJoin='round'; cx.lineCap='round';
  cx.setTransform(s0,0,0,-s0,(-(bb.x0-pad))*s0,(bb.y1+pad)*s0);
  say('도면을 그리는 중...');
  draw(cx,ms,{color:7,lw:Math.max(1.4,Math.max(W,H)/4500),sc:s0,depth:0});
  return cv;
}

function fpDwgToPdfFile(buf,pdfName,onStage){
  var say=onStage||function(){};
  return Promise.all([_fpLoadDwgLib(),_fpLoadJsPdf()]).then(function(r){
    say('도면을 읽는 중... (큰 도면은 1분 가까이 걸릴 수 있습니다)');
    return new Promise(function(res){ setTimeout(res,50); }).then(function(){
      var lib=r[0].lib, m=r[0].m;
      var dwg=lib.dwg_read_data(buf,m.Dwg_File_Type.DWG);
      if(!dwg) throw new Error('DWG 파일을 읽을 수 없습니다(지원하지 않는 버전이거나 손상된 파일일 수 있습니다).');
      var db=lib.convert(dwg);
      try{ lib.dwg_free(dwg); }catch(e){}
      return new Promise(function(res){ setTimeout(res,30); }).then(function(){ return db; });
    });
  }).then(function(db){
    var cv=_fpDbCanvas(db,8000,say);
    say('PDF를 만드는 중...');
    return new Promise(function(res){ setTimeout(res,30); }).then(function(){
      var pw=1190, ph=Math.max(200,Math.round(pw*cv.height/cv.width)); // A3 가로 기준 폭
      var pdf=new window.jspdf.jsPDF({orientation:pw>=ph?'l':'p',unit:'pt',format:[pw,ph],compress:true});
      pdf.addImage(cv.toDataURL('image/jpeg',0.92),'JPEG',0,0,pw,ph,undefined,'FAST');
      cv.width=cv.height=1;
      return new File([pdf.output('blob')],pdfName,{type:'application/pdf'});
    });
  });
}
