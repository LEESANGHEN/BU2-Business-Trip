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
  // Drive에 올라간 파일 — Drive 미리보기가 PDF, Office 문서, 영상/음성, 텍스트 등 대부분의 형식을 처리한다
  frame(driveEmbed);
  // 미리보기를 지원하지 않는 형식(압축 파일 등)은 Drive가 안내 화면을 보여주므로 별도 안내를 아래에 덧붙인다
  var tip=document.createElement('div'); tip.className='fp-tip';
  tip.textContent='미리보기가 되지 않는 형식(압축 파일, 설계 도면 원본 등)은 다운로드해서 열어 주세요.';
  body.appendChild(tip);
}
