/* ══════════════════════════════════════════
   Pedestal 이력 관리 — pedestal.js
   엑셀 "Pedestal 이력 관리" 양식(고객사↔인텍플러스 / 인텍플러스↔PSMP / 구매 그룹↔PSMP)을
   그대로 옮긴 수기 입력 표. 셀을 클릭해 직접 입력한다.
   - 텍스트 칸(text): 표 안에서 바로 입력
   - 기록 칸(rich): 클릭하면 팝업이 열려 글 + 이미지/파일 첨부(Drive, 붙여넣기 지원)를 함께 기록
   데이터: S.pedestalRows = [{id,mt,seq,cells:{key: 문자열 | {text,files:[]}}}]
   기본 50행은 화면에만 있는 빈 행이고, 처음 입력하는 순간 실제 행으로 저장된다.
══════════════════════════════════════════ */

var PD_MIN_ROWS=50;
var PD_MAX_MB=15;
var PD_GROUPS=[
  {label:'고객사 ↔ 인텍플러스',cols:[
    {key:'customer',label:'고객사',type:'text',w:120},
    {key:'productInfo',label:'제품 정보',type:'rich',w:130},
    {key:'productSize',label:'제품 Size',type:'text',w:100},
    {key:'productName',label:'제품명',type:'text',w:130},
    {key:'trayInfo',label:'Tray 정보',type:'rich',w:120},
    {key:'custQuote',label:'견적서',type:'rich',w:110},
    {key:'custPO',label:'발주서',type:'rich',w:110}
  ]},
  {label:'인텍플러스 ↔ PSMP',cols:[
    {key:'designDwg',label:'설계 도면',type:'rich',w:120},
    {key:'bom',label:'BOM List',type:'rich',w:110},
    {key:'psmpSN',label:'PSMP S/N',type:'text',w:120},
    {key:'psmpQuote',label:'견적서',type:'rich',w:110},
    {key:'psmpPO',label:'발주서',type:'rich',w:110}
  ]},
  {label:'구매 그룹 ↔ PSMP',cols:[
    {key:'dwgNo',label:'도번',type:'text',w:110},
    {key:'itemName',label:'품명',type:'text',w:120},
    {key:'spec',label:'규격',type:'text',w:120}
  ]}
];
var _pdCols=[]; PD_GROUPS.forEach(function(g){ g.cols.forEach(function(c){_pdCols.push(c);}); });
function _pdColByKey(k){ return _pdCols.find(function(c){return c.key===k;}); }

var _pdSearch='';
var _pdModal=null; // 열려 있는 기록 팝업 {rowId,key}

function _pdSortedRows(){
  return S.pedestalRows.slice().sort(function(a,b){return (a.seq||0)-(b.seq||0);});
}
function _pdNewRow(){
  var maxSeq=0; S.pedestalRows.forEach(function(r){ if((r.seq||0)>maxSeq) maxSeq=r.seq||0; });
  var row={id:genId('pd',S.pedestalRows),seq:maxSeq+1,cells:{}};
  S.pedestalRows.push(row);
  return row;
}
function _pdText(row,col){
  var c=row.cells&&row.cells[col.key];
  if(col.type==='rich') return (c&&c.text)||'';
  return (typeof c==='string')?c:'';
}
function _pdFiles(row,key){
  var c=row.cells&&row.cells[key];
  return (c&&c.files)||[];
}
function _pdRichCell(row,key){
  if(!row.cells) row.cells={};
  var c=row.cells[key];
  if(!c||typeof c!=='object') c=row.cells[key]={text:'',files:[]};
  if(!c.files) c.files=[];
  return c;
}
function _pdRowById(id){ return S.pedestalRows.find(function(r){return r.id===id;}); }

// 화면에만 있는 빈 행(v숫자)을 처음 건드리는 순간 실제 행으로 만든다. 위쪽 빈 행도 같이 만들어서
// 표시 순서(No)가 입력한 행의 위치와 어긋나지 않게 한다
function _pdResolveRow(tr){
  var rid=tr.getAttribute('data-rid');
  var real=_pdRowById(rid);
  if(real) return real;
  var idx=parseInt(tr.getAttribute('data-idx'),10)||0;
  var rows=_pdSortedRows();
  while(rows.length<=idx){ _pdNewRow(); rows=_pdSortedRows(); }
  var trs=document.querySelectorAll('#pdTbody tr.pd-row');
  rows.forEach(function(r,i){ if(trs[i]) trs[i].setAttribute('data-rid',r.id); });
  return rows[idx];
}

function _pdRichCellHtml(row,col){
  var files=_pdFiles(row,col.key), text=_pdText(row,col);
  var snip=text.replace(/\s+/g,' ').trim();
  return '<td class="pd-rich-td" data-k="'+col.key+'" onclick="openPedestalCell(this,\''+col.key+'\')">'
    +'<div class="pd-rich">'
    +(files.length?'<span class="pd-clip">📎 '+files.length+'</span>':'')
    +'<span class="pd-snip">'+(snip?_esc(snip):'<span style="color:var(--tx-faint)">+</span>')+'</span>'
    +'</div></td>';
}
function _pdRowHtml(row,idx,isReal){
  var h='<tr class="pd-row" data-rid="'+(isReal?_esc(row.id):'v'+idx)+'" data-idx="'+idx+'">';
  h+='<td class="pd-no">'+(idx+1)+'</td>';
  _pdCols.forEach(function(col){
    if(col.type==='rich'){ h+=_pdRichCellHtml(row,col); }
    else{
      h+='<td data-k="'+col.key+'"><input class="pd-in" type="text" value="'+_esc(_pdText(row,col))+'" onchange="pdSetText(this,\''+col.key+'\')" autocomplete="off"></td>';
    }
  });
  h+='<td class="pd-delcell">'+(isReal?'<button class="pd-del" onclick="pdDeleteRow(this)" title="이 행 삭제">×</button>':'')+'</td>';
  return h+'</tr>';
}

function _pdTableHtml(){
  var h='<table class="pd-table" id="pdTable"><thead>';
  h+='<tr class="pd-h1"><th rowspan="2" class="pd-no">No</th>';
  PD_GROUPS.forEach(function(g){ h+='<th colspan="'+g.cols.length+'">'+_esc(g.label)+'</th>'; });
  h+='<th rowspan="2" class="pd-delcell"></th></tr>';
  h+='<tr class="pd-h2">';
  _pdCols.forEach(function(c){ h+='<th style="min-width:'+c.w+'px">'+_esc(c.label)+'</th>'; });
  h+='</tr></thead><tbody id="pdTbody"></tbody></table>';
  return h;
}

function renderPedestalBody(){
  var tb=document.getElementById('pdTbody'); if(!tb) return;
  var real=_pdSortedRows();
  var q=_pdSearch, html='';
  if(q){
    real.forEach(function(row,i){
      var hay=_pdCols.map(function(c){return _pdText(row,c);}).join(' ').toLowerCase();
      if(hay.indexOf(q)>=0) html+=_pdRowHtml(row,i,true);
    });
    if(!html) html='<tr><td colspan="'+(_pdCols.length+2)+'" style="padding:30px;text-align:center;color:var(--tx-muted)">검색 결과가 없습니다.</td></tr>';
  }else{
    real.forEach(function(row,i){ html+=_pdRowHtml(row,i,true); });
    for(var i=real.length;i<PD_MIN_ROWS;i++) html+=_pdRowHtml({cells:{}},i,false);
  }
  tb.innerHTML=html;
}

function renderPedestalTab(){
  var wrap=document.getElementById('pdWrap'); if(!wrap) return;
  var prev=wrap.querySelector('.pm-body-scroll');
  var sTop=prev?prev.scrollTop:0, sLeft=prev?prev.scrollLeft:0;
  var html='<div class="pm-fixed-header"><div class="pm-ctrl-bar">'
    +'<div class="pm-ctrl-group"><span style="font-size:11px;color:#666">🔍</span>'
    +'<input class="pm-search" type="text" placeholder="고객사/제품명/S/N/도번/품명 검색..." autocomplete="off" oninput="pdSearch(this.value)" value="'+_esc(_pdSearch)+'"></div>'
    +'<div style="flex:1"></div>'
    +'<span style="font-size:11px;color:var(--tx-muted)">셀을 클릭해 직접 입력 · 📎 칸은 클릭하면 글/이미지/파일을 함께 기록</span>'
    +'<button class="btn pri sm" onclick="pdAddRows(10)">+ 행 10개 추가</button>'
    +'</div></div>'
    +'<div class="pm-body-scroll">'+_pdTableHtml()+'</div>';
  wrap.innerHTML=html;
  renderPedestalBody();
  var sc=wrap.querySelector('.pm-body-scroll');
  if(sc){ sc.scrollTop=sTop; sc.scrollLeft=sLeft; }
}
// 시트 동기화 완료 등으로 renderAll()이 불릴 때, 입력 중이거나 팝업이 열려 있으면 건드리지 않는다
function renderPedestalTabIfIdle(){
  var wrap=document.getElementById('pdWrap');
  if(!wrap) return;
  if(wrap.contains(document.activeElement)&&document.activeElement.tagName==='INPUT') return;
  var mc=document.getElementById('mc'); if(mc&&mc.innerHTML) return;
  renderPedestalTab();
}

function pdSearch(v){ _pdSearch=v.trim().toLowerCase(); renderPedestalBody(); }

function pdSetText(inp,key){
  var tr=inp.closest('tr');
  var val=inp.value.trim();
  var cur=null;
  var rid=tr.getAttribute('data-rid');
  var existing=_pdRowById(rid);
  if(existing){ var c=existing.cells&&existing.cells[key]; cur=(typeof c==='string')?c:''; }
  if(!existing&&!val) return; // 빈 행에 빈 값 → 아무 것도 안 함
  if(existing&&val===cur) return;
  var row=_pdResolveRow(tr);
  if(!row.cells) row.cells={};
  row.cells[key]=val;
  _touch(row); saveData();
}

function pdAddRows(n){
  var rows=_pdSortedRows();
  var target=Math.max(rows.length,PD_MIN_ROWS)+n; // 화면에 보이는 빈 행까지 실제 행으로 만들고 n개 더 추가
  while(S.pedestalRows.length<target) _pdNewRow();
  S.pedestalRows.forEach(function(r){ if(!r.mt) _touch(r); });
  saveData();
  _pdSearch=''; renderPedestalTab();
  var sc=document.querySelector('#pdWrap .pm-body-scroll'); if(sc) sc.scrollTop=sc.scrollHeight;
}

function _pdDeleteFilesOnDrive(row){
  var url=getSheetsUrl(); if(!url) return;
  Object.keys(row.cells||{}).forEach(function(k){
    _pdFiles(row,k).forEach(function(f){
      fetch(url,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({action:'deleteFile',fileId:f.id})}).catch(function(){});
    });
  });
}
function pdDeleteRow(btn){
  var tr=btn.closest('tr');
  var row=_pdRowById(tr.getAttribute('data-rid'));
  if(!row) return;
  var hasData=Object.keys(row.cells||{}).some(function(k){
    var c=row.cells[k]; return typeof c==='string'?!!c:!!(c&&(c.text||(c.files&&c.files.length)));
  });
  if(!confirm('No.'+((parseInt(tr.getAttribute('data-idx'),10)||0)+1)+' 행을 삭제할까요?'+(hasData?'\n입력한 내용과 첨부파일도 함께 삭제됩니다.':''))) return;
  _pdDeleteFilesOnDrive(row);
  S.pedestalRows=S.pedestalRows.filter(function(r){return r.id!==row.id;});
  _markDeleted('pedestalRows',row.id);
  saveData(); renderPedestalBody();
}

/* ── 기록 칸 팝업 (글 + 첨부파일) ── */
function _pdIsImage(f){
  return /^image\//.test(f.mimeType||'')||/\.(png|jpe?g|gif|bmp|webp)$/i.test(f.name||'');
}
function _pdFormatSize(b){
  if(!b&&b!==0) return '';
  if(b<1024) return b+'B';
  if(b<1024*1024) return Math.round(b/1024)+'KB';
  return (b/1024/1024).toFixed(1)+'MB';
}
function _pdFilesHtml(row,key){
  var files=_pdFiles(row,key);
  if(!files.length) return '<div style="font-size:11px;color:var(--tx-faint)">첨부된 파일이 없습니다.</div>';
  return files.map(function(f){
    var fid=String(f.id).replace(/'/g,"\\'");
    var thumb=_pdIsImage(f)
      ?'<a href="'+_esc(f.viewUrl||'#')+'" target="_blank" rel="noopener"><img class="pd-thumb" loading="lazy" src="https://drive.google.com/thumbnail?id='+encodeURIComponent(f.id)+'&sz=w160" alt=""></a>'
      :'<div class="pd-thumb" style="display:flex;align-items:center;justify-content:center;font-size:20px">📄</div>';
    return '<div class="pd-file">'+thumb
      +'<div style="flex:1;min-width:0"><div class="pd-fname" title="'+_esc(f.name||'')+'">'+_esc(f.name||'')+'</div><div style="font-size:10px;color:var(--tx-faint)">'+_pdFormatSize(f.size)+'</div></div>'
      +'<a href="'+_esc(f.downloadUrl||f.viewUrl||'#')+'" target="_blank" rel="noopener" class="btn sm" style="text-decoration:none">다운로드</a>'
      +'<button class="btn sm red" onclick="pdDeleteFile(\''+fid+'\')">삭제</button></div>';
  }).join('');
}
function openPedestalCell(td,key){
  var tr=td.closest('tr');
  var row=_pdResolveRow(tr);
  var col=_pdColByKey(key);
  _pdModal={rowId:row.id,key:key};
  var idx=parseInt(tr.getAttribute('data-idx'),10)||0;
  var cust=_pdText(row,_pdColByKey('customer'));
  var html='<div class="mtit">'+_esc(col.label)+' — No.'+(idx+1)+(cust?' · '+_esc(cust):'')+'</div>'
    +'<div class="fg"><label class="fl">내용 (직접 입력)</label>'
    +'<textarea id="pd_cell_text" rows="6" style="width:100%;box-sizing:border-box;resize:vertical;background:var(--bg-deep);color:var(--tx-primary);border:1px solid var(--bd-main);border-radius:6px;padding:8px;font-size:12px;font-family:inherit" placeholder="글로 기록하세요. 캡처한 이미지는 여기에 Ctrl+V로 바로 붙여넣을 수 있습니다." onchange="pdSaveCellText(this.value)" onpaste="pdOnPaste(event)">'+_esc(_pdText(row,col))+'</textarea></div>'
    +'<div class="fg"><label class="fl">첨부파일 (이미지/파일, 최대 '+PD_MAX_MB+'MB)</label>'
    +'<div id="pd_cell_files" style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px">'+_pdFilesHtml(row,key)+'</div>'
    +'<button class="btn sm" onclick="pdPickFiles()">+ 파일 추가</button>'
    +'<span id="pd_cell_status" style="font-size:11px;color:var(--tx-muted);margin-left:8px"></span></div>'
    +'<div class="mfoot"><button class="btn sm pri" onclick="cm()">닫기</button></div>';
  mw(html);
}
function _pdRefreshCell(rowId,key){
  var row=_pdRowById(rowId), col=_pdColByKey(key);
  var tr=document.querySelector('#pdTbody tr[data-rid="'+rowId+'"]');
  if(!row||!col||!tr) return;
  var td=tr.querySelector('td[data-k="'+key+'"]');
  if(td) td.outerHTML=_pdRichCellHtml(row,col);
}
function _pdRefreshModalFiles(ctx){
  if(!_pdModal||_pdModal.rowId!==ctx.rowId||_pdModal.key!==ctx.key) return;
  var el=document.getElementById('pd_cell_files'), row=_pdRowById(ctx.rowId);
  if(el&&row) el.innerHTML=_pdFilesHtml(row,ctx.key);
}
function pdSaveCellText(val){
  if(!_pdModal) return;
  var row=_pdRowById(_pdModal.rowId); if(!row) return;
  var c=_pdRichCell(row,_pdModal.key);
  if(c.text===val.trim()) return;
  c.text=val.trim();
  _touch(row); saveData(); _pdRefreshCell(_pdModal.rowId,_pdModal.key);
}
function pdPickFiles(){
  var inp=document.createElement('input');
  inp.type='file'; inp.multiple=true;
  inp.onchange=function(){ Array.prototype.slice.call(inp.files||[]).forEach(_pdUploadFile); };
  inp.click();
}
function pdOnPaste(e){
  var items=(e.clipboardData&&e.clipboardData.items)||[];
  var found=false;
  Array.prototype.forEach.call(items,function(it){
    if(it.kind==='file'&&/^image\//.test(it.type)){
      var f=it.getAsFile(); if(!f) return;
      var ext=(it.type.split('/')[1]||'png').replace('jpeg','jpg');
      var named=new File([f],'pasted-'+Date.now()+'.'+ext,{type:it.type});
      found=true; _pdUploadFile(named);
    }
  });
  if(found) e.preventDefault();
}
function _pdUploadFile(file){
  var ctx=_pdModal; if(!ctx) return;
  var st=document.getElementById('pd_cell_status');
  var setSt=function(t){ var el=document.getElementById('pd_cell_status'); if(el&&_pdModal&&_pdModal.rowId===ctx.rowId&&_pdModal.key===ctx.key) el.textContent=t; };
  if(file.size>PD_MAX_MB*1024*1024){ alert(file.name+' 파일이 '+PD_MAX_MB+'MB를 초과하여 업로드할 수 없습니다.'); return; }
  var url=getSheetsUrl();
  if(!url){ alert('Sheets 연동 URL이 설정되어 있지 않아 파일을 업로드할 수 없습니다.'); return; }
  if(st) st.textContent=file.name+' 업로드 중...';
  var reader=new FileReader();
  reader.onload=function(){
    var b64=String(reader.result).split(',')[1]||'';
    fetch(url,{method:'POST',headers:{'Content-Type':'text/plain'},
      body:JSON.stringify({action:'uploadFile',fileName:file.name,mimeType:file.type||'application/octet-stream',base64Data:b64})})
    .then(function(r){return r.json();})
    .then(function(data){
      if(data.error){ alert('업로드 실패: '+data.error); setSt(''); return; }
      var row=_pdRowById(ctx.rowId); if(!row){ setSt(''); return; }
      _pdRichCell(row,ctx.key).files.push({id:data.fileId,name:data.name,size:data.size,downloadUrl:data.downloadUrl,viewUrl:data.viewUrl,mimeType:file.type||'',uploadedAt:Date.now()});
      _touch(row); saveData();
      _pdRefreshCell(ctx.rowId,ctx.key); _pdRefreshModalFiles(ctx); setSt('');
    })
    .catch(function(){ alert('업로드 응답이 정상적이지 않습니다. (서버가 막 깨어나는 중일 수 있어요) 잠시 후 다시 시도해주세요.'); setSt(''); });
  };
  reader.readAsDataURL(file);
}
function pdDeleteFile(fileId){
  if(!_pdModal||!confirm('첨부파일을 삭제할까요?')) return;
  var ctx=_pdModal, row=_pdRowById(ctx.rowId); if(!row) return;
  var c=_pdRichCell(row,ctx.key);
  c.files=c.files.filter(function(f){return String(f.id)!==String(fileId);});
  _touch(row); saveData();
  _pdRefreshCell(ctx.rowId,ctx.key); _pdRefreshModalFiles(ctx);
  var url=getSheetsUrl();
  if(url) fetch(url,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({action:'deleteFile',fileId:fileId})}).catch(function(){});
}
