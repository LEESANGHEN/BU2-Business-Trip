/* ══════════════════════════════════════════
   Pedestal 이력 관리 — pedestal.js
   엑셀 "Pedestal 이력 관리" 양식(고객사↔인텍플러스 / 인텍플러스↔PSMP / 구매 그룹↔PSMP)을
   옮긴 수기 입력 표. 셀을 클릭해 직접 입력한다.
   - text 칸: 표 안에서 바로 입력
   - rich 칸: 클릭하면 팝업 — 글 + 이미지/파일 첨부(Drive, Ctrl+V 붙여넣기 지원)
   - doc 칸(견적서/발주서): rich + 번호·리비전·날짜·금액을 별도 칸으로 기록
   - 한 설비(행)에 구매 부품(도번/품명/규격)을 여러 줄 달 수 있다 (row.parts)
   - 프로젝트 관리 데이터와 연결(row.projectId) → 고객사/사이트/설비 정보 자동 입력
   데이터: S.pedestalRows = [{id,mt,seq,projectId,cells:{key: 문자열|{text,files,...}},parts:[{dwgNo,itemName,spec}]}]
   기본 50행은 화면에만 있는 빈 행이고, 처음 입력하는 순간 실제 행으로 저장된다.
══════════════════════════════════════════ */

var PD_MIN_ROWS=50;
var PD_MAX_MB=15;
var PD_CURRENCIES=['KRW','USD','CNY','JPY','TWD','EUR'];
var PD_GROUPS=[
  {label:'고객사 ↔ 인텍플러스',cols:[
    {key:'customer',label:'고객사',type:'text',w:100,dl:'pdDlCust'},
    {key:'site',label:'사이트',type:'text',w:100,dl:'pdDlSite'},
    {key:'equip',label:'설비 정보',type:'text',w:130,dl:'pdDlEquip'},
    {key:'productInfo',label:'제품 정보',type:'rich',w:130},
    {key:'productSize',label:'제품 Size',type:'text',w:90},
    {key:'productName',label:'제품명',type:'text',w:120},
    {key:'trayInfo',label:'Tray 정보',type:'rich',w:120},
    {key:'custQuote',label:'견적서',full:'고객사 견적서',type:'doc',w:150},
    {key:'custPO',label:'발주서',full:'고객사 발주서',type:'doc',w:150}
  ]},
  {label:'인텍플러스 ↔ PSMP',cols:[
    {key:'designDwg',label:'설계 도면',type:'rich',w:120},
    {key:'bom',label:'BOM List',type:'rich',w:110},
    {key:'psmpSN',label:'PSMP S/N',type:'text',w:120},
    {key:'psmpQuote',label:'견적서',full:'PSMP 견적서',type:'doc',w:150},
    {key:'psmpPO',label:'발주서',full:'PSMP 발주서',type:'doc',w:150}
  ]}
];
var PD_PART_COLS=[
  {key:'dwgNo',label:'도번',w:110},
  {key:'itemName',label:'품명',w:120},
  {key:'spec',label:'규격',w:120}
];
var PD_PART_GROUP='구매 그룹 ↔ PSMP';
var _pdCols=[]; PD_GROUPS.forEach(function(g){ g.cols.forEach(function(c){_pdCols.push(c);}); });
function _pdColByKey(k){ return _pdCols.find(function(c){return c.key===k;}); }

var _pdSearch='';
var _pdModal=null; // 열려 있는 기록 팝업 {rowId,key}

/* ── 데이터 헬퍼 ── */
function _pdSortedRows(){
  return S.pedestalRows.slice().sort(function(a,b){return (a.seq||0)-(b.seq||0);});
}
function _pdNewRow(){
  var maxSeq=0; S.pedestalRows.forEach(function(r){ if((r.seq||0)>maxSeq) maxSeq=r.seq||0; });
  var row={id:genId('pd',S.pedestalRows),seq:maxSeq+1,cells:{}};
  S.pedestalRows.push(row);
  return row;
}
function _pdRowById(id){ return S.pedestalRows.find(function(r){return r.id===id;}); }
function _pdText(row,col){
  var c=row.cells&&row.cells[col.key];
  if(col.type==='text') return (typeof c==='string')?c:'';
  return (c&&typeof c==='object'&&c.text)||'';
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
// 예전 형식(도번/품명/규격을 cells에 한 줄로 저장)도 읽을 수 있게 한다
function _pdParts(row){
  if(Array.isArray(row.parts)&&row.parts.length) return row.parts;
  var c=row.cells||{};
  return [{dwgNo:(typeof c.dwgNo==='string'?c.dwgNo:''),itemName:(typeof c.itemName==='string'?c.itemName:''),spec:(typeof c.spec==='string'?c.spec:'')}];
}
function _pdEnsureParts(row){
  if(!Array.isArray(row.parts)||!row.parts.length){
    row.parts=_pdParts(row).map(function(p){return {dwgNo:p.dwgNo,itemName:p.itemName,spec:p.spec};});
    if(row.cells){ delete row.cells.dwgNo; delete row.cells.itemName; delete row.cells.spec; }
  }
  return row.parts;
}
function _pdProject(row){
  return row.projectId?S.masterProjects.find(function(m){return m.id===row.projectId;}):null;
}
function _pdFmtDate(d){ return d?fmtFull(d):''; }
function _pdFmtAmount(c){
  if(!c||c.amount===undefined||c.amount==='') return '';
  var n=Number(String(c.amount).replace(/,/g,''));
  return (isNaN(n)?String(c.amount):n.toLocaleString('ko-KR'))+' '+(c.currency||'KRW');
}
function _pdDocSummary(c){
  if(!c||typeof c!=='object') return '';
  var parts=[];
  if(c.no) parts.push(c.no);
  if(c.rev) parts.push(/^rev/i.test(c.rev)?c.rev:'Rev.'+c.rev);
  var amt=_pdFmtAmount(c); if(amt) parts.push(amt);
  if(c.date) parts.push(_pdFmtDate(c.date));
  return parts.join(' · ');
}
// 검색용: 한 행의 모든 글자(칸 + 견적/발주 정보 + 부품)를 합친다
function _pdSearchText(row){
  var out=[];
  _pdCols.forEach(function(col){
    out.push(_pdText(row,col));
    if(col.type==='doc'){ var c=row.cells&&row.cells[col.key]; if(c) out.push(c.no||'',c.rev||'',c.amount||'',c.date||''); }
  });
  _pdParts(row).forEach(function(p){ out.push(p.dwgNo||'',p.itemName||'',p.spec||''); });
  var mp=_pdProject(row); if(mp) out.push(mp.serial||'',mp.projectName||'',mp.customer||'');
  return out.join(' ').toLowerCase();
}

// 화면에만 있는 빈 행(v숫자)을 처음 건드리는 순간 실제 행으로 만든다. 위쪽 빈 행도 같이 만들어서
// 표시 순서(No)가 입력한 행의 위치와 어긋나지 않게 한다
function _pdResolveRow(tr){
  var real=_pdRowById(tr.getAttribute('data-rid'));
  if(real) return real;
  var idx=parseInt(tr.getAttribute('data-idx'),10)||0;
  var rows=_pdSortedRows();
  while(rows.length<=idx){ _pdNewRow(); rows=_pdSortedRows(); }
  var i=-1;
  document.querySelectorAll('#pdTbody tr').forEach(function(t){
    if(t.classList.contains('pd-row')) i++;
    if(rows[i]) t.setAttribute('data-rid',rows[i].id);
  });
  return rows[idx];
}

/* ── 렌더 ── */
function _pdDocCellHtml(row,col){
  var c=row.cells&&row.cells[col.key];
  var files=_pdFiles(row,col.key), sum=_pdDocSummary(c), memo=_pdText(row,col).replace(/\s+/g,' ').trim();
  var body=sum?_esc(sum):(memo?_esc(memo):'<span style="color:var(--tx-faint)">+</span>');
  return '<td class="pd-rich-td" data-k="'+col.key+'" rowspan="__RS__" onclick="openPedestalCell(this,\''+col.key+'\')">'
    +'<div class="pd-rich">'+(files.length?'<span class="pd-clip">📎 '+files.length+'</span>':'')+'<span class="pd-snip">'+body+'</span></div></td>';
}
function _pdRichCellHtml(row,col){
  var files=_pdFiles(row,col.key), snip=_pdText(row,col).replace(/\s+/g,' ').trim();
  return '<td class="pd-rich-td" data-k="'+col.key+'" rowspan="__RS__" onclick="openPedestalCell(this,\''+col.key+'\')">'
    +'<div class="pd-rich">'+(files.length?'<span class="pd-clip">📎 '+files.length+'</span>':'')
    +'<span class="pd-snip">'+(snip?_esc(snip):'<span style="color:var(--tx-faint)">+</span>')+'</span></div></td>';
}
function _pdMainCellHtml(row,col){
  if(col.type==='doc') return _pdDocCellHtml(row,col);
  if(col.type==='rich') return _pdRichCellHtml(row,col);
  return '<td data-k="'+col.key+'" rowspan="__RS__"><input class="pd-in" type="text" value="'+_esc(_pdText(row,col))+'"'
    +(col.dl?' list="'+col.dl+'"':'')+' onchange="pdSetText(this,\''+col.key+'\')" autocomplete="off"></td>';
}
function _pdLinkCellHtml(row){
  var mp=_pdProject(row);
  var label, tip;
  if(row.projectId&&mp){ label=_esc(mp.serial||'연결됨'); tip=_esc((mp.customer||'')+' · '+(mp.projectName||'')+(mp.serial?' · '+mp.serial:'')); }
  else if(row.projectId){ label='삭제됨'; tip='연결된 프로젝트가 삭제되었습니다'; }
  else { label='<span style="color:var(--tx-faint)">🔗</span>'; tip='프로젝트 관리 데이터와 연결'; }
  return '<td class="pd-link" rowspan="__RS__" title="'+tip+'" onclick="openPedestalLink(this)"><div class="pd-link-in'+(row.projectId?' on':'')+'">'+label+'</div></td>';
}
function _pdPartCellsHtml(part){
  return PD_PART_COLS.map(function(pc){
    return '<td><input class="pd-in" type="text" value="'+_esc(part[pc.key]||'')+'" onchange="pdSetPart(this,\''+pc.key+'\')" autocomplete="off"></td>';
  }).join('');
}
function _pdRowHtml(row,idx,isReal){
  var parts=_pdParts(row), n=1; // 부품은 한 줄만 표시
  var rid=isReal?_esc(row.id):'v'+idx;
  var attrs=' data-rid="'+rid+'" data-idx="'+idx+'"';
  var h='<tr class="pd-row"'+attrs+' data-pi="0">';
  h+='<td class="pd-no" rowspan="'+n+'">'+(idx+1)+'</td>';
  h+=_pdLinkCellHtml(row).replace('__RS__',n);
  _pdCols.forEach(function(col){ h+=_pdMainCellHtml(row,col).replace('__RS__',n); });
  h+=_pdPartCellsHtml(parts[0]);
  h+='<td class="pd-delcell" rowspan="'+n+'">'
    +(isReal?'<button class="pd-del" onclick="pdDeleteRow(this)" title="이 행 삭제">×</button>':'')+'</td></tr>';
  return h;
}

function _pdTableHtml(){
  var h='<table class="pd-table" id="pdTable"><thead>';
  h+='<tr class="pd-h1"><th rowspan="2" class="pd-no">No</th><th rowspan="2" class="pd-link" style="min-width:76px">프로젝트<br>연결</th>';
  PD_GROUPS.forEach(function(g){ h+='<th colspan="'+g.cols.length+'">'+_esc(g.label)+'</th>'; });
  h+='<th colspan="3">'+_esc(PD_PART_GROUP)+'</th>';
  h+='<th rowspan="2" class="pd-delcell"></th></tr>';
  h+='<tr class="pd-h2">';
  _pdCols.forEach(function(c){ h+='<th style="min-width:'+c.w+'px">'+_esc(c.label)+'</th>'; });
  PD_PART_COLS.forEach(function(c){ h+='<th style="min-width:'+c.w+'px">'+_esc(c.label)+'</th>'; });
  h+='</tr></thead><tbody id="pdTbody"></tbody></table>';
  return h;
}

function _pdDatalistsHtml(){
  var cust={}, site={}, equip={};
  S.masterProjects.forEach(function(mp){
    var c=mp.customer||'', u=c.indexOf('_');
    var cn=u>0?c.slice(0,u):c, sn=u>0?c.slice(u+1):'';
    if(cn) cust[cn]=1; if(sn) site[sn]=1; if(mp.projectName) equip[mp.projectName]=1;
  });
  function dl(id,obj){ return '<datalist id="'+id+'">'+Object.keys(obj).sort().map(function(k){return '<option value="'+_esc(k)+'">';}).join('')+'</datalist>'; }
  return dl('pdDlCust',cust)+dl('pdDlSite',site)+dl('pdDlEquip',equip);
}

function renderPedestalBody(){
  var tb=document.getElementById('pdTbody'); if(!tb) return;
  var real=_pdSortedRows();
  var q=_pdSearch, html='';
  if(q){
    real.forEach(function(row,i){ if(_pdSearchText(row).indexOf(q)>=0) html+=_pdRowHtml(row,i,true); });
    if(!html) html='<tr><td colspan="'+(_pdCols.length+PD_PART_COLS.length+3)+'" style="padding:30px;text-align:center;color:var(--tx-muted)">검색 결과가 없습니다.</td></tr>';
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
    +'<input class="pm-search" type="text" placeholder="고객사/설비/S/N/도번/품명 검색..." autocomplete="off" oninput="pdSearch(this.value)" value="'+_esc(_pdSearch)+'"></div>'
    +'<div style="flex:1"></div>'
    +'<span style="font-size:11px;color:var(--tx-muted)">셀을 클릭해 직접 입력 · 📎 칸은 클릭하면 글/이미지/파일 기록</span>'
    +'<button class="btn sm" onclick="pdExportExcel()">⬇ 엑셀 내보내기</button>'
    +'<button class="btn pri sm" onclick="pdAddRows(10)">+ 행 10개 추가</button>'
    +'</div></div>'
    +'<div class="pm-body-scroll">'+_pdDatalistsHtml()+_pdTableHtml()+'</div>';
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

/* ── 편집: 텍스트 칸 / 부품 ── */
function pdSetText(inp,key){
  var tr=inp.closest('tr'), val=inp.value.trim();
  var existing=_pdRowById(tr.getAttribute('data-rid'));
  if(existing){ var c=existing.cells&&existing.cells[key]; if(val===((typeof c==='string')?c:'')) return; }
  else if(!val) return; // 빈 행에 빈 값 → 아무 것도 안 함
  var row=_pdResolveRow(tr);
  if(!row.cells) row.cells={};
  row.cells[key]=val;
  _touch(row); saveData();
}
function pdSetPart(inp,field){
  var tr=inp.closest('tr'), val=inp.value.trim();
  var pi=parseInt(tr.getAttribute('data-pi'),10)||0;
  var existing=_pdRowById(tr.getAttribute('data-rid'));
  if(existing){ var cur=(_pdParts(existing)[pi]||{})[field]||''; if(val===cur) return; }
  else if(!val) return;
  var row=_pdResolveRow(tr);
  var parts=_pdEnsureParts(row);
  if(!parts[pi]) return;
  parts[pi][field]=val;
  _touch(row); saveData();
}
function pdAddRows(n){
  var target=Math.max(_pdSortedRows().length,PD_MIN_ROWS)+n; // 화면에 보이는 빈 행까지 실제 행으로 만들고 n개 더 추가
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
function _pdRowHasData(row){
  var cells=Object.keys(row.cells||{}).some(function(k){
    var c=row.cells[k];
    return typeof c==='string'?!!c:!!(c&&(c.text||c.no||c.amount||c.date||c.rev||(c.files&&c.files.length)));
  });
  return cells||!!row.projectId||_pdParts(row).some(function(p){return p.dwgNo||p.itemName||p.spec;});
}
function pdDeleteRow(btn){
  var tr=btn.closest('tr');
  var row=_pdRowById(tr.getAttribute('data-rid'));
  if(!row) return;
  if(!confirm('No.'+((parseInt(tr.getAttribute('data-idx'),10)||0)+1)+' 행을 삭제할까요?'+(_pdRowHasData(row)?'\n입력한 내용과 첨부파일도 함께 삭제됩니다.':''))) return;
  _pdDeleteFilesOnDrive(row);
  S.pedestalRows=S.pedestalRows.filter(function(r){return r.id!==row.id;});
  _markDeleted('pedestalRows',row.id);
  saveData(); renderPedestalBody();
}

/* ── 프로젝트 관리 데이터와 연결 ── */
function openPedestalLink(td){
  var row=_pdResolveRow(td.closest('tr'));
  _pdModal={rowId:row.id,key:'__link'};
  var mp=_pdProject(row);
  var html='<div class="mtit">프로젝트 관리 데이터와 연결</div>'
    +'<div style="font-size:11px;color:var(--tx-muted);margin-bottom:8px">고르면 고객사 / 사이트 / 설비 정보가 자동으로 채워집니다(이미 입력한 값은 덮어씁니다). 연결을 해제하면 자동으로 채워진 이 3개 항목도 함께 지워집니다.</div>'
    +(mp?'<div style="font-size:12px;margin-bottom:8px">현재 연결: <b>'+_esc(mp.serial||'(시리얼 없음)')+'</b> · '+_esc(mp.customer||'')+' · '+_esc(mp.projectName||'')+' <button class="btn sm red" onclick="pdLinkProject(\'\')">연결 해제</button></div>':'')
    +'<input type="text" id="pd_link_q" placeholder="시리얼 / 고객사 / 설비명 검색..." oninput="_pdRenderLinkList()" autocomplete="off" style="margin-bottom:8px">'
    +'<div id="pd_link_list" style="max-height:300px;overflow-y:auto;display:flex;flex-direction:column;gap:4px"></div>'
    +'<div class="mfoot"><button class="btn sm pri" onclick="cm()">닫기</button></div>';
  mw(html,true);
  _pdRenderLinkList();
  var q=document.getElementById('pd_link_q'); if(q) q.focus();
}
function _pdRenderLinkList(){
  var el=document.getElementById('pd_link_list'); if(!el) return;
  var q=((document.getElementById('pd_link_q')||{}).value||'').trim().toLowerCase();
  var list=S.masterProjects.filter(function(mp){
    if(!q) return true;
    return [mp.serial,mp.customer,mp.projectName,mp.prodUnit,mp.customerUnit].join(' ').toLowerCase().indexOf(q)>=0;
  }).sort(function(a,b){
    return String(a.customer||'').localeCompare(String(b.customer||''),'ko')||String(a.projectName||'').localeCompare(String(b.projectName||''),'ko');
  });
  var shown=list.slice(0,150);
  el.innerHTML=shown.map(function(mp){
    var idAttr=String(mp.id).replace(/'/g,"\\'");
    return '<div class="pd-linkitem" onclick="pdLinkProject(\''+idAttr+'\')">'
      +'<span style="min-width:100px;color:#7aafee">'+_esc(mp.serial||'(시리얼 없음)')+'</span>'
      +'<span style="flex:1">'+_esc(mp.customer||'')+' · '+_esc(mp.projectName||'')+'</span>'
      +'<span style="color:var(--tx-faint)">'+_esc(mp.prodUnit||'')+'</span></div>';
  }).join('')+(list.length>shown.length?'<div style="font-size:11px;color:var(--tx-faint);padding:6px">… '+(list.length-shown.length)+'건 더 있음 — 검색어로 좁혀주세요</div>':'')
    +(!list.length?'<div style="font-size:12px;color:var(--tx-faint);padding:10px">일치하는 프로젝트가 없습니다.</div>':'');
}
function pdLinkProject(projectId){
  if(!_pdModal) return;
  var row=_pdRowById(_pdModal.rowId); if(!row) return;
  if(!projectId){
    delete row.projectId;
    // 연결할 때 자동으로 채워진 고객사 / 사이트 / 설비 정보도 함께 지운다
    if(row.cells){ delete row.cells.customer; delete row.cells.site; delete row.cells.equip; }
  }else{
    var mp=S.masterProjects.find(function(m){return m.id===projectId;}); if(!mp) return;
    row.projectId=mp.id;
    if(!row.cells) row.cells={};
    var c=mp.customer||'', u=c.indexOf('_');
    row.cells.customer=u>0?c.slice(0,u):c;
    row.cells.site=u>0?c.slice(u+1):'';
    row.cells.equip=mp.projectName||'';
  }
  _touch(row); saveData(); cm(); _pdModal=null; renderPedestalBody();
}

/* ── 기록 칸 팝업 (글 + 첨부파일, 견적/발주는 번호·리비전·날짜·금액 포함) ── */
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
function _pdDocFieldsHtml(c){
  c=c||{};
  var label=function(t){return '<label class="fl">'+t+'</label>';};
  var cur=c.currency||'KRW';
  var opts=PD_CURRENCIES.map(function(k){return '<option value="'+k+'"'+(k===cur?' selected':'')+'>'+k+'</option>';}).join('');
  return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
    +'<div class="fg">'+label('번호')+'<input type="text" value="'+_esc(c.no||'')+'" onchange="pdSaveDocField(\'no\',this.value)" placeholder="견적/발주 번호" autocomplete="off"></div>'
    +'<div class="fg">'+label('리비전')+'<input type="text" value="'+_esc(c.rev||'')+'" onchange="pdSaveDocField(\'rev\',this.value)" placeholder="예: Rev.2" autocomplete="off"></div>'
    +'<div class="fg">'+label('날짜')+'<input type="date" value="'+_esc(c.date||'')+'" onchange="pdSaveDocField(\'date\',this.value)"></div>'
    +'<div class="fg">'+label('금액')+'<div style="display:flex;gap:6px"><input type="text" value="'+_esc(c.amount||'')+'" onchange="pdSaveDocField(\'amount\',this.value)" placeholder="숫자만" autocomplete="off">'
    +'<select style="width:78px" onchange="pdSaveDocField(\'currency\',this.value)">'+opts+'</select></div></div>'
    +'</div>';
}
function openPedestalCell(td,key){
  var tr=td.closest('tr');
  var row=_pdResolveRow(tr);
  var col=_pdColByKey(key);
  _pdModal={rowId:row.id,key:key};
  var idx=parseInt(tr.getAttribute('data-idx'),10)||0;
  var cust=_pdText(row,_pdColByKey('customer'));
  var isDoc=col.type==='doc';
  var html='<div class="mtit">'+_esc(col.full||col.label)+' — No.'+(idx+1)+(cust?' · '+_esc(cust):'')+'</div>'
    +(isDoc?_pdDocFieldsHtml(row.cells&&row.cells[key]):'')
    +'<div class="fg"><label class="fl">'+(isDoc?'메모':'내용 (직접 입력)')+'</label>'
    +'<textarea id="pd_cell_text" rows="'+(isDoc?3:6)+'" style="width:100%;box-sizing:border-box;resize:vertical;background:var(--bg-deep);color:var(--tx-primary);border:1px solid var(--bd-main);border-radius:6px;padding:8px;font-size:12px;font-family:inherit" placeholder="글로 기록하세요. 캡처한 이미지는 여기에 Ctrl+V로 바로 붙여넣을 수 있습니다." onchange="pdSaveCellText(this.value)" onpaste="pdOnPaste(event)">'+_esc(_pdText(row,col))+'</textarea></div>'
    +'<div class="fg"><label class="fl">첨부파일 (이미지/파일, 최대 '+PD_MAX_MB+'MB)</label>'
    +'<div id="pd_cell_files" style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px">'+_pdFilesHtml(row,key)+'</div>'
    +'<button class="btn sm" onclick="pdPickFiles()">+ 파일 추가</button>'
    +'<span id="pd_cell_status" style="font-size:11px;color:var(--tx-muted);margin-left:8px"></span></div>'
    +'<div class="mfoot"><button class="btn sm pri" onclick="cm()">닫기</button></div>';
  mw(html);
}
function _pdRefreshCell(rowId,key){
  var row=_pdRowById(rowId), col=_pdColByKey(key);
  var tr=document.querySelector('#pdTbody tr.pd-row[data-rid="'+rowId+'"]');
  if(!row||!col||!tr) return;
  var td=tr.querySelector('td[data-k="'+key+'"]');
  if(td) td.outerHTML=_pdMainCellHtml(row,col).replace('__RS__',_pdParts(row).length);
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
function pdSaveDocField(field,val){
  if(!_pdModal) return;
  var row=_pdRowById(_pdModal.rowId); if(!row) return;
  var c=_pdRichCell(row,_pdModal.key);
  val=String(val).trim();
  if((c[field]||'')===val) return;
  c[field]=val;
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
      found=true; _pdUploadFile(new File([f],'pasted-'+Date.now()+'.'+ext,{type:it.type}));
    }
  });
  if(found) e.preventDefault();
}
function _pdUploadFile(file){
  var ctx=_pdModal; if(!ctx) return;
  var setSt=function(t){ var el=document.getElementById('pd_cell_status'); if(el&&_pdModal&&_pdModal.rowId===ctx.rowId&&_pdModal.key===ctx.key) el.textContent=t; };
  if(file.size>PD_MAX_MB*1024*1024){ alert(file.name+' 파일이 '+PD_MAX_MB+'MB를 초과하여 업로드할 수 없습니다.'); return; }
  var url=getSheetsUrl();
  if(!url){ alert('Sheets 연동 URL이 설정되어 있지 않아 파일을 업로드할 수 없습니다.'); return; }
  setSt(file.name+' 업로드 중...');
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

/* ── 엑셀 내보내기 (부품 여러 줄은 세로 병합) ── */
function pdExportExcel(){ _ensureExcelJS(_pdDoExport); }
function _pdDoExport(){
  var wb=new ExcelJS.Workbook();
  wb.creator='BU2 출장 일정 관리'; wb.created=new Date();
  var ws=wb.addWorksheet('Pedestal 이력 관리');
  var thin={style:'thin',color:{argb:'FF000000'}};
  var border={top:thin,bottom:thin,left:thin,right:thin};

  // 열 정의: main=true는 부품이 여러 줄이어도 한 번만 쓰고 세로 병합, v(row,idx,part)가 값
  var ec=[];
  ec.push({g:'',l:'No',w:6,main:true,v:function(r,i){return i+1;}});
  ec.push({g:'',l:'프로젝트 시리얼',w:16,main:true,v:function(r){var m=_pdProject(r);return m?(m.serial||''):'';}});
  var firstGroupIdx=ec.length;
  PD_GROUPS.forEach(function(g){
    g.cols.forEach(function(col){
      if(col.type==='doc'){
        [['no','번호',14],['rev','리비전',9],['date','날짜',12],['amount','금액',16],['memo','메모/첨부',22]].forEach(function(f){
          ec.push({g:g.label,l:col.label+' '+f[1],w:f[2],main:true,files:f[0]==='memo'?col.key:null,v:function(r){
            var c=r.cells&&r.cells[col.key];
            if(f[0]==='memo') return _pdMemoWithFiles(r,col);
            if(!c) return '';
            if(f[0]==='amount') return _pdFmtAmount(c);
            if(f[0]==='date') return _pdFmtDate(c.date);
            return c[f[0]]||'';
          }});
        });
      }else if(col.type==='rich'){
        ec.push({g:g.label,l:col.label,w:col.w/6+8,main:true,files:col.key,v:function(r){return _pdMemoWithFiles(r,col);}});
      }else{
        ec.push({g:g.label,l:col.label,w:col.w/6+4,main:true,v:function(r){return _pdText(r,col);}});
      }
    });
  });
  PD_PART_COLS.forEach(function(pc){
    ec.push({g:PD_PART_GROUP,l:pc.label,w:pc.w/6+4,main:false,v:function(r,i,p){return (p&&p[pc.key])||'';}});
  });

  // 헤더 2줄 (그룹 / 열 이름)
  var hr1=ws.getRow(1), hr2=ws.getRow(2);
  ec.forEach(function(c,i){ hr2.getCell(i+1).value=c.l; hr1.getCell(i+1).value=c.g||c.l; });
  var gi=0;
  while(gi<ec.length){
    var gj=gi; while(gj+1<ec.length&&ec[gj+1].g===ec[gi].g&&ec[gi].g) gj++;
    if(!ec[gi].g){ ws.mergeCells(1,gi+1,2,gi+1); }
    else if(gj>gi){ ws.mergeCells(1,gi+1,1,gj+1); }
    gi=gj+1;
  }
  [1,2].forEach(function(rn){ ws.getRow(rn).eachCell(function(cell){
    cell.font={name:'맑은 고딕',size:10,bold:true};
    cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFE7E6E6'}};
    cell.alignment={vertical:'middle',horizontal:'center',wrapText:true};
    cell.border=border;
  }); });
  ec.forEach(function(c,i){ ws.getColumn(i+1).width=c.w; });

  // 데이터
  var cur=3;
  _pdSortedRows().forEach(function(row,idx){
    var parts=_pdParts(row), n=parts.length, start=cur;
    parts.forEach(function(p,pi){
      var r=ws.getRow(cur+pi);
      ec.forEach(function(c,ci){
        if(c.main&&pi>0) return;
        var val=c.v(row,idx,p);
        var cell=r.getCell(ci+1);
        if(c.files){
          var fl=_pdFiles(row,c.files);
          cell.value=fl.length?{text:String(val),hyperlink:fl[0].viewUrl||fl[0].downloadUrl}:val;
        }else cell.value=val;
      });
    });
    if(n>1) ec.forEach(function(c,ci){ if(c.main) ws.mergeCells(start,ci+1,start+n-1,ci+1); });
    for(var k=0;k<n;k++){
      ws.getRow(start+k).eachCell({includeEmpty:true},function(cell,cn){
        cell.font={name:'맑은 고딕',size:10,color:cell.value&&cell.value.hyperlink?{argb:'FF0563C1'}:undefined};
        cell.alignment={vertical:'middle',horizontal:'center',wrapText:true};
        cell.border=border;
      });
    }
    cur+=n;
  });
  // 빈 칸이어도 엑셀 양식처럼 50행까지 테두리 유지
  var total=_pdSortedRows().reduce(function(a,r){return a+_pdParts(r).length;},0);
  for(var e=total;e<PD_MIN_ROWS;e++){
    var rr=ws.getRow(cur++);
    ec.forEach(function(c,ci){ var cell=rr.getCell(ci+1); if(ci===0) cell.value=_pdSortedRows().length+(e-total)+1; cell.border=border; cell.alignment={vertical:'middle',horizontal:'center'}; });
  }
  ws.views=[{state:'frozen',ySplit:2}];

  wb.xlsx.writeBuffer().then(function(buf){
    var blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    var url=URL.createObjectURL(blob), a=document.createElement('a');
    var d=new Date();
    a.href=url; a.download='Pedestal이력관리_'+d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')+'.xlsx';
    a.click(); setTimeout(function(){URL.revokeObjectURL(url);},1000);
  });
}
function _pdMemoWithFiles(row,col){
  var t=_pdText(row,col), fl=_pdFiles(row,col.key);
  return t+(fl.length?(t?'\n':'')+'[첨부] '+fl.map(function(f){return f.name;}).join(', '):'');
}
