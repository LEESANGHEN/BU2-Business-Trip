/* ══════════════════════════════════════════
   Pedestal 이력 관리 — pedestal.js
   엑셀 "Pedestal 이력 관리" 양식(고객사↔인텍플러스 / 인텍플러스↔PSMP / 구매 그룹↔PSMP)을
   옮긴 수기 입력 표. 셀을 클릭해 직접 입력한다.
   - text 칸: 표 안에서 바로 입력
   - rich 칸: 클릭하면 팝업 — 글 + 이미지/파일 첨부(Drive, Ctrl+V 붙여넣기 지원)
   - doc 칸(견적서/발주서): rich + 번호·리비전·날짜·금액을 별도 칸으로 기록
   - 한 설비(행)에 구매 부품(도번/품명/규격)을 여러 줄 달 수 있다 (row.parts)
   - (프로젝트 연결 열은 2026-11-03에 화면에서 제거했다)
   데이터: S.pedestalRows = [{id,mt,seq,projectId,cells:{key: 문자열|{text,files,...}},parts:[{dwgNo,itemName,spec}]}]
   기본 50행은 화면에만 있는 빈 행이고, 처음 입력하는 순간 실제 행으로 저장된다.
══════════════════════════════════════════ */

var PD_MIN_ROWS=50;
var PD_MAX_MB=15;
var PD_CURRENCIES=['KRW','USD','CNY','JPY','TWD','EUR'];
var PD_GROUPS=[
  {label:'고객사 ↔ 인텍플러스',cols:[
    {key:'customer',label:'고객사',type:'text',w:100,ac:1},
    {key:'site',label:'사이트',type:'text',w:100,ac:1},
    {key:'equip',label:'설비 정보',type:'text',w:130,ac:1},
    {key:'custReqDate',label:'고객사 요청 출하일',type:'date',w:130},
    {key:'hqInPlanDate',label:'입고 예정일',type:'date',w:130},
    {key:'hqInDate',label:'본사 입고일',type:'date',w:120},
    {key:'crossDockPlanDate',label:'출하 예정일',type:'date',w:130}, // 예전 "크로스독 납품 예상일" — 저장 키는 그대로라 입력된 날짜가 이어진다
    {key:'realShipDate',label:'출하일',type:'date',w:120},
    // 제품 정보 / Tray 정보 열은 2026-11-03에 화면에서 제거했다(이미 올려 둔 파일은 행 데이터에 그대로 남아 있음)
    {key:'productSize',label:'제품 Size',type:'text',w:90,ac:1},
    {key:'productName',label:'Pedestal 정보',type:'obj',fld:'text',w:130}, // 예전 "제품명" 칸 — 저장 키는 그대로. 2026-11-03부터 팝업·파일 없이 칸에 바로 글자만 입력(cells.productName.text; 이미 올려 둔 파일은 행 데이터에 남아 있음)
    // Conversion Kit Part List / 고객사 견적서 열은 2026-11-03에 화면에서 제거했다(이미 올려 둔 파일은 행 데이터에 그대로 남아 있음)
    {key:'custPO',label:'발주 번호',full:'고객사 발주 번호',type:'obj',fld:'no',w:150} // 예전 "발주서" 칸 — 저장 키는 그대로(번호는 cells.custPO.no), 번호만 바로 입력
  ]},
  {label:'인텍플러스 ↔ PSMP',cols:[
    // 컨셉 도면 / 설계 도면 / 설계 Part List 열은 2026-11-03에 화면에서 제거했다(이미 올려 둔 파일은 행 데이터에 그대로 남아 있음)
    {key:'psmpSN',label:'PSMP S/N',type:'text',w:120},
    // PSMP 견적서 열도 2026-11-03에 화면에서 제거했다(데이터는 그대로)
    {key:'psmpPO',label:'발주 번호',full:'PSMP 발주 번호',type:'obj',fld:'no',w:150} // 예전 "발주서" 칸 — 저장 키는 그대로(번호는 cells.psmpPO.no), 번호만 바로 입력
  ]}
];
var PD_PART_COLS=[
  {key:'dwgNo',label:'도번',w:110},
  {key:'itemName',label:'품명',w:120,ac:1}
]; // '규격' 열은 2026-11-03에 화면에서 제거(부품 데이터의 spec 값은 그대로 남아 있음)
var PD_PART_GROUP='구매 그룹 필요 정보';
var _pdCols=[]; PD_GROUPS.forEach(function(g){ g.cols.forEach(function(c){_pdCols.push(c);}); });
function _pdColByKey(k){ return _pdCols.find(function(c){return c.key===k;}); }

var _pdSearch='';
var _pdModal=null; // 열려 있는 기록 팝업 {rowId,key}

/* ── 분류(필터) · 정렬 — 프로젝트 관리 탭과 같은 방식 ──
   고객사 / 사이트 / 입고월 / 출하월은 다중 선택, 입고월·출하월은 "년/월 ~ 년/월" 기간으로도 거를 수 있다.
   입고월 = 본사 입고일(없으면 입고 예정일)의 월, 출하월 = 출하일(없으면 출하 예정일, 그것도 없으면 고객사 요청 출하일)의 월.
   출하일(realShipDate)이 기록된 행은 '완료'로 보고 연녹색으로 채우며, '진행중만 보기'(기본 On)에서는 숨기고 끄면 맨 아래에 모아 보여준다.
   글자/날짜 열의 머리글을 누르면 오름차순 → 내림차순 → 입력 순서(No) 순으로 정렬한다. */
var PD_NONE='(미입력)';
var PD_MS_LABEL={customer:'고객사',site:'사이트',inMonth:'입고월',shipMonth:'출하월'};
var PD_MS_MONTH={inMonth:1,shipMonth:1};
var _pdMS={customer:[],site:[],inMonth:[],shipMonth:[]};
var _pdRg={};            // 입고월/출하월 기간 {key:{from,to}} ('YYYY-MM')
var _pdSortKey='', _pdSortAsc=true; // 빈 값 = 입력 순서
var _pdHideDone=true;    // 진행중만 보기(출하일이 기록된 완료 행 숨김) — 프로젝트 관리처럼 기본 On
function _pdIsDone(row){ return !!_pdCellStr(row,'realShipDate'); }
function _pdCellStr(row,key){ var c=row.cells&&row.cells[key]; return typeof c==='string'?c.trim():''; }
function _pdMsVal(row,key){
  if(key==='customer'||key==='site') return _pdCellStr(row,key);
  var d=(key==='inMonth')
    ?(_pdCellStr(row,'hqInDate')||_pdCellStr(row,'hqInPlanDate'))
    :(_pdCellStr(row,'realShipDate')||_pdCellStr(row,'crossDockPlanDate')||_pdCellStr(row,'custReqDate'));
  return d?d.slice(0,7):'';
}
function _pdRange(key){ var r=_pdRg[key]; return (r&&(r.from||r.to))?r:null; }
function _pdViewActive(){
  if(_pdSearch||_pdSortKey) return true;
  return Object.keys(_pdMS).some(function(k){ return _pdMS[k].length||_pdRange(k); });
}
function _pdRowPass(row){
  var any=false;
  for(var k in _pdMS){
    var sel=_pdMS[k], rg=_pdRange(k);
    if(!sel.length&&!rg) continue;
    any=true;
    var v=_pdMsVal(row,k);
    if(sel.length&&sel.indexOf(v||PD_NONE)<0) return false;
    if(rg&&!(v&&(!rg.from||v>=rg.from)&&(!rg.to||v<=rg.to))) return false;
  }
  if(any&&!_pdRowHasData(row)) return false; // 분류 중에는 완전히 빈 행을 숨긴다
  return true;
}
function _pdMsOptions(key){
  var arr=[], blank=false;
  S.pedestalRows.forEach(function(r){
    if(!_pdRowHasData(r)) return;
    var v=_pdMsVal(r,key); if(!v) blank=true; else if(arr.indexOf(v)<0) arr.push(v);
  });
  if(PD_MS_MONTH[key]) arr.sort(); else arr.sort(function(a,b){return a.localeCompare(b,'ko');});
  if(blank) arr.push(PD_NONE);
  return arr;
}
function _pdRangeText(r){ return (r.from||'')+' ~ '+(r.to||''); }
function _pdMsSummary(key){
  var sel=_pdMS[key], rg=_pdRange(key);
  if(rg&&!sel.length) return _pdRangeText(rg);
  var s=!sel.length?'전체':(sel.length===1?sel[0]:sel.length+'개 선택');
  return rg?(s+' + '+_pdRangeText(rg)):s;
}
function _pdMsOptionsHtml(key){
  var sel=_pdMS[key], rg=_pdRange(key)||{from:'',to:''}, html='';
  if(PD_MS_MONTH[key]){
    html+='<div class="pm-ms-range" onclick="event.stopPropagation()"><div class="pm-ms-range-h">기간 직접 설정 (년/월 ~ 년/월)</div>'
      +'<div class="pm-ms-range-row"><input type="month" id="pdRg_'+key+'_f" value="'+_esc(rg.from||'')+'" onchange="pdMsRange(\''+key+'\')">'
      +'<span>~</span><input type="month" id="pdRg_'+key+'_t" value="'+_esc(rg.to||'')+'" onchange="pdMsRange(\''+key+'\')">'
      +'<button type="button" class="btn sm" onclick="pdMsRangeClear(\''+key+'\')" title="기간 지우기">지우기</button></div></div>';
  }
  html+='<label class="pm-ms-opt all"><input type="checkbox" '+(!sel.length&&!_pdRange(key)?'checked':'')+' onchange="pdMsClearAll(\''+key+'\')">전체</label>';
  _pdMsOptions(key).forEach(function(v){
    html+='<label class="pm-ms-opt"><input type="checkbox" data-v="'+_esc(v)+'" '+(sel.indexOf(v)>=0?'checked':'')+' onchange="pdMsToggle(\''+key+'\',this.getAttribute(\'data-v\'))">'+_esc(v)+'</label>';
  });
  return html;
}
function _pdMsHtml(key){
  return '<div class="pm-ctrl-group"><span class="pm-ctrl-label">'+PD_MS_LABEL[key]+'</span><div class="pm-ms-wrap">'
    +'<button type="button" class="pm-ms-trigger" onclick="pdMsTogglePanel(\''+key+'\')"><span id="pdMsLbl_'+key+'">'+_esc(_pdMsSummary(key))+'</span> ▾</button>'
    +'<div class="pm-ms-panel" id="pdMsPanel_'+key+'" style="display:none">'+_pdMsOptionsHtml(key)+'</div></div></div>';
}
function _pdMsRefresh(key){
  var p=document.getElementById('pdMsPanel_'+key); if(p) p.innerHTML=_pdMsOptionsHtml(key);
  var l=document.getElementById('pdMsLbl_'+key); if(l) l.textContent=_pdMsSummary(key);
}
function pdMsTogglePanel(key){
  var panel=document.getElementById('pdMsPanel_'+key); if(!panel) return;
  var open=panel.style.display==='none';
  document.querySelectorAll('.pm-ms-panel').forEach(function(p){p.style.display='none';});
  if(open){ _pdMsRefresh(key); panel.style.display='block'; } // 열 때 최신 입력값으로 목록을 다시 만든다
}
function pdMsToggle(key,v){
  var a=_pdMS[key], i=a.indexOf(v);
  if(i>=0) a.splice(i,1); else a.push(v);
  _pdMsRefresh(key); renderPedestalBody();
}
function pdMsClearAll(key){
  _pdMS[key]=[]; delete _pdRg[key];
  _pdMsRefresh(key);
  var p=document.getElementById('pdMsPanel_'+key); if(p) p.style.display='none';
  renderPedestalBody();
}
function pdMsRange(key){
  var f=document.getElementById('pdRg_'+key+'_f'), t2=document.getElementById('pdRg_'+key+'_t');
  var a=(f&&f.value)||'', b=(t2&&t2.value)||'';
  if(a&&b&&a>b){ var x=a; a=b; b=x; if(f) f.value=a; if(t2) t2.value=b; } // 거꾸로 넣으면 자동으로 바로잡는다
  if(a||b) _pdRg[key]={from:a,to:b}; else delete _pdRg[key];
  var l=document.getElementById('pdMsLbl_'+key); if(l) l.textContent=_pdMsSummary(key);
  var all=document.querySelector('#pdMsPanel_'+key+' .pm-ms-opt.all input'); if(all) all.checked=(!_pdMS[key].length&&!_pdRange(key));
  renderPedestalBody();
}
function pdMsRangeClear(key){
  delete _pdRg[key];
  var f=document.getElementById('pdRg_'+key+'_f'), t2=document.getElementById('pdRg_'+key+'_t'); if(f) f.value=''; if(t2) t2.value='';
  pdMsRange(key);
}
function pdSetSort(ev,key){
  if(ev&&ev.target&&ev.target.closest&&ev.target.closest('.pd-rz')) return; // 너비 조절 손잡이를 끌 때는 정렬하지 않는다
  if(_pdSortKey!==key){ _pdSortKey=key; _pdSortAsc=true; }
  else if(_pdSortAsc) _pdSortAsc=false;
  else _pdSortKey='';
  renderPedestalTab();
}
// 분류·정렬·검색을 모두 풀고 입력 순서로 되돌린다
function _pdClearView(){
  _pdSearch=''; _pdSortKey=''; _pdSortAsc=true; _pdRg={};
  Object.keys(_pdMS).forEach(function(k){ _pdMS[k]=[]; });
}
function pdResetView(){ _pdClearView(); renderPedestalTab(); }
// 진행중만 보기: 켜는 순간 검색·분류·정렬을 비운다(프로젝트 관리와 같음). 끄면 현재 필터는 그대로 두고 완료 행을 맨 아래에 보여준다
function pdToggleDone(){
  _pdHideDone=!_pdHideDone;
  if(_pdHideDone) _pdClearView();
  renderPedestalTab();
}
document.addEventListener('click',function(e){ // 드롭다운 바깥을 누르면 닫는다(projects.js에도 같은 처리가 있으나 이 탭만 열려 있어도 동작하게 한다)
  if(e.target.closest&&e.target.closest('.pm-ms-wrap')) return;
  document.querySelectorAll('.pm-ms-panel').forEach(function(p){p.style.display='none';});
});

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
  if(col.type==='obj') return (typeof c==='string')?c:((c&&c[col.fld||'no'])||''); // 예전에 팝업(메모·파일·번호)으로 입력하던 칸: 지금은 한 필드(발주 번호=no, Pedestal 정보=text)만 칸에 바로 보여준다 — 나머지 메모·파일·날짜는 데이터에 남아 있지만 화면에는 쓰지 않는다
  if(typeof c==='string') return c; // 글자 칸이었다가 파일 칸으로 바뀐 열(제품명→Pedestal 정보)의 기존 값도 글 내용으로 보여준다
  if(col.type==='text'||col.type==='date') return '';
  return (c&&typeof c==='object'&&c.text)||'';
}
// Part List 칸에는 모든 행에 기본으로 들어가는 기준(Reference) 엑셀 양식이 있다.
// 정적 파일이라 행마다 복사본을 저장하지 않고, 행이 직접 지우기 전까지는 화면에서 기본값으로 보여준다.
// 이 칸의 파일은 id가 'ref-'로 시작하며 Drive 삭제 요청을 보내지 않는다.
var PD_DEFAULT_FILES={partList:[{id:'ref-partlist',name:'Change Kit Part List.xlsx',size:23235,
  downloadUrl:'ref/Change_Kit_Part_List.xlsx',viewUrl:'ref/Change_Kit_Part_List.xlsx',
  mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}]};
function _pdIsStaticFile(f){ return String(f&&f.id).indexOf('ref-')===0; }
function _pdFiles(row,key){
  var c=row.cells&&row.cells[key];
  if(c&&c.files) return c.files;
  return (!c&&PD_DEFAULT_FILES[key])||[];
}
function _pdRichCell(row,key){
  if(!row.cells) row.cells={};
  var c=row.cells[key];
  if(typeof c==='string') c=row.cells[key]={text:c,files:[]};
  else if(!c||typeof c!=='object') c=row.cells[key]={text:'',files:(PD_DEFAULT_FILES[key]||[]).slice()};
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
// 한 행에 프로젝트를 여러 개 연결할 수 있다(row.projectIds). 예전의 단일 연결(row.projectId)도 읽는다
function _pdProjectIds(row){
  if(Array.isArray(row.projectIds)) return row.projectIds;
  return row.projectId?[row.projectId]:[];
}
function _pdProjects(row){
  return _pdProjectIds(row).map(function(id){return S.masterProjects.find(function(m){return m.id===id;});}).filter(Boolean);
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
  _pdProjects(row).forEach(function(mp){ out.push(mp.serial||'',mp.projectName||'',mp.customer||''); });
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
  var files=col.nofile?[]:_pdFiles(row,col.key), snip=_pdText(row,col).replace(/\s+/g,' ').trim();
  return '<td class="pd-rich-td" data-k="'+col.key+'" rowspan="__RS__" onclick="openPedestalCell(this,\''+col.key+'\')">'
    +'<div class="pd-rich">'+(files.length?'<span class="pd-clip">📎 '+files.length+'</span>':'')
    +'<span class="pd-snip">'+(snip?_esc(snip):'<span style="color:var(--tx-faint)">+</span>')+'</span></div></td>';
}
function _pdMainCellHtml(row,col){
  if(col.type==='doc') return _pdDocCellHtml(row,col);
  if(col.type==='rich') return _pdRichCellHtml(row,col);
  if(col.type==='obj'){ var ov=_pdText(row,col); return '<td data-k="'+col.key+'" rowspan="__RS__"><input class="pd-in" type="text" value="'+_esc(ov)+'" title="'+_esc(ov)+'" onchange="pdSetObj(this,\''+col.key+'\',\''+(col.fld||'no')+'\')" autocomplete="off"></td>'; }
  if(col.type==='date') return '<td data-k="'+col.key+'" rowspan="__RS__"><input class="pd-in" type="date" value="'+_esc(_pdText(row,col))+'" onchange="pdSetText(this,\''+col.key+'\')"></td>';
  return '<td data-k="'+col.key+'" rowspan="__RS__"><input class="pd-in" type="text" value="'+_esc(_pdText(row,col))+'"'
    +(col.ac?' oninput="pdAc(this,\x27cell\x27,\x27'+col.key+'\x27)" onfocus="pdAcHide()" onkeydown="pdAcKey(event)" onblur="pdAcHide()"':'')+' onchange="pdSetText(this,\''+col.key+'\')" autocomplete="off"></td>';
}
function _pdLinkCellHtml(row){
  var ids=_pdProjectIds(row), mps=_pdProjects(row);
  var label, tip;
  if(mps.length){
    label=_esc(mps[0].serial||'연결됨')+(mps.length>1?'<br><span style="font-weight:400">외 '+(mps.length-1)+'대</span>':'');
    tip=_esc(mps.map(function(m){return (m.serial||'(시리얼 없음)')+' · '+(m.customer||'')+' · '+(m.projectName||'');}).join('\n'));
  }
  else if(ids.length){ label='삭제됨'; tip='연결된 프로젝트가 삭제되었습니다'; }
  else { label='<span style="color:var(--tx-faint)">🔗</span>'; tip='프로젝트 관리 데이터와 연결'; }
  return '<td class="pd-link" rowspan="__RS__" title="'+tip+'" onclick="openPedestalLink(this)"><div class="pd-link-in'+(ids.length?' on':'')+'">'+label+'</div></td>';
}
function _pdPartCellsHtml(part){
  return PD_PART_COLS.map(function(pc){
    return '<td><input class="pd-in" type="text" value="'+_esc(part[pc.key]||'')+'"'+(pc.ac?' oninput="pdAc(this,\x27part\x27,\x27'+pc.key+'\x27)" onfocus="pdAcHide()" onkeydown="pdAcKey(event)" onblur="pdAcHide()"':'')+' onchange="pdSetPart(this,\''+pc.key+'\')" autocomplete="off"></td>';
  }).join('');
}
function _pdRowHtml(row,idx,isReal,no){
  var parts=_pdParts(row), n=1; // 부품은 한 줄만 표시
  var rid=isReal?_esc(row.id):'v'+idx;
  if(no==null) no=idx+1; // 표시 번호(No)는 필터·정렬과 무관하게 화면에 보이는 순서대로 1부터, idx는 데이터상 위치
  var attrs=' data-rid="'+rid+'" data-idx="'+idx+'" data-no="'+no+'"';
  var h='<tr class="pd-row'+(isReal&&_pdIsDone(row)?' pd-done':'')+'"'+attrs+' data-pi="0">';
  h+='<td class="pd-no" rowspan="'+n+'">'+no+'</td>';
  _pdCols.forEach(function(col){ h+=_pdMainCellHtml(row,col).replace('__RS__',n); });
  h+=_pdPartCellsHtml(parts[0]);
  h+='<td class="pd-delcell" rowspan="'+n+'">'
    +(isReal?'<button class="pd-del" onclick="pdDeleteRow(this)" title="이 행 삭제">×</button>':'')+'</td></tr>';
  return h;
}

/* ── 열 너비 조절: 머리글 오른쪽 끝을 끌어서 조절, 더블클릭하면 기본 너비로. 너비는 이 브라우저에 저장된다 ── */
var PD_COLW_KEY='bu2_pd_colw';
function _pdColWMap(){ try{ return JSON.parse(localStorage.getItem(PD_COLW_KEY)||'{}')||{}; }catch(e){ return {}; } }
function _pdSaveColW(k,w){ try{ var m=_pdColWMap(); if(w==null) delete m[k]; else m[k]=w; localStorage.setItem(PD_COLW_KEY,JSON.stringify(m)); }catch(e){} }
var _pdAutoW=null;
function _pdColW(c,m){ var v=m[c.key]; if(typeof v==='number'&&v>=40) return v; return (_pdAutoW&&_pdAutoW[c.key])||c.w; }
// 저장된 너비가 없는 열은 머리글·입력된 글자 길이에 맞춰 너비를 정한다(글자를 캔버스로 재서 계산)
function _pdComputeAutoW(){
  var ff=getComputedStyle(document.body).fontFamily||'sans-serif';
  var cv=document.createElement('canvas').getContext('2d');
  function mw(s,font){ cv.font=font; return cv.measureText(String(s||'')).width; }
  var body='12px '+ff, head='bold 11px '+ff, rows=_pdSortedRows(), out={}, tmp=document.createElement('div');
  function hdr(c){ var t=(c.lh||c.label||'').replace(/<br\s*\/?>/gi,'|').replace(/<[^>]+>/g,''); var w=0; t.split('|').forEach(function(l){ w=Math.max(w,mw(l,head)); }); return w+26; }
  _pdCols.forEach(function(col){
    if(col.type==='date'){ out[col.key]=Math.max(132,Math.ceil(hdr(col))); return; }
    var w=hdr(col);
    rows.forEach(function(row){
      tmp.innerHTML='<table><tbody><tr>'+_pdMainCellHtml(row,col).replace('__RS__',1)+'</tr></tbody></table>';
      var td=tmp.querySelector('td'); if(!td) return;
      var texts=[td.textContent]; [].forEach.call(td.querySelectorAll('input'),function(i){ texts.push(i.value); });
      texts.forEach(function(t){ t=String(t||'').replace(/\s+/g,' ').trim(); if(t) w=Math.max(w,mw(t,body)+24); });
    });
    var cap=(col.type==='rich'||col.type==='doc')?300:260;
    out[col.key]=Math.max(60,Math.min(cap,Math.ceil(w)));
  });
  PD_PART_COLS.forEach(function(c){
    var w=hdr(c);
    rows.forEach(function(row){ var p=_pdParts(row)[0]||{}; var t=p[c.key]; if(t) w=Math.max(w,mw(t,body)+24); });
    out[c.key]=Math.max(60,Math.min(240,Math.ceil(w)));
  });
  return out;
}
// 저장해 둔 너비를 모두 지우고 자동 너비로 다시 맞춘다
function pdAutoFitAll(){
  try{ localStorage.removeItem(PD_COLW_KEY); }catch(e){}
  renderPedestalTab();
}
(function(){ // 이 방식으로 바꾼 뒤 처음 열 때 한 번, 예전에 저장된 너비를 지워 자동 너비를 적용한다
  try{ if(!localStorage.getItem('bu2_pd_colw_auto_v1')){ localStorage.removeItem('bu2_pd_colw'); localStorage.setItem('bu2_pd_colw_auto_v1','1'); } }catch(e){}
})();
function _pdSetTableW(){
  var t=document.getElementById('pdTable'); if(!t) return;
  var sum=0; [].forEach.call(t.querySelectorAll('col'),function(c){ sum+=parseFloat(c.style.width)||0; });
  t.style.width=sum+'px'; t.style.minWidth=sum+'px';
}
(function(){
  var drag=null;
  document.addEventListener('mousedown',function(ev){
    var h=ev.target.closest&&ev.target.closest('.pd-rz'); if(!h) return;
    var col=document.querySelector('#pdTable col[data-ck="'+h.getAttribute('data-ck')+'"]'); if(!col) return;
    drag={col:col,k:h.getAttribute('data-ck'),x:ev.clientX,w:parseFloat(col.style.width)||100};
    document.body.classList.add('pd-resizing'); ev.preventDefault(); ev.stopPropagation();
  },true);
  document.addEventListener('mousemove',function(ev){
    if(!drag) return;
    var w=Math.max(50,Math.round(drag.w+ev.clientX-drag.x)); drag.col.style.width=w+'px'; drag.cur=w; _pdSetTableW();
  });
  document.addEventListener('mouseup',function(){
    if(!drag) return;
    if(drag.cur) _pdSaveColW(drag.k,drag.cur);
    drag=null; document.body.classList.remove('pd-resizing');
  });
  document.addEventListener('dblclick',function(ev){
    var h=ev.target.closest&&ev.target.closest('.pd-rz'); if(!h) return;
    var k=h.getAttribute('data-ck'), def=_pdColByKey(k)||PD_PART_COLS.find(function(c){return c.key===k;});
    var col=document.querySelector('#pdTable col[data-ck="'+k+'"]');
    if(def&&col){ col.style.width=((_pdAutoW&&_pdAutoW[k])||def.w)+'px'; _pdSaveColW(k,null); _pdSetTableW(); }
  });
})();

function _pdTableHtml(){
  _pdAutoW=_pdComputeAutoW();
  var cw=_pdColWMap();
  var h='<table class="pd-table" id="pdTable"><colgroup><col style="width:44px">';
  _pdCols.forEach(function(c){ h+='<col data-ck="'+c.key+'" style="width:'+_pdColW(c,cw)+'px">'; });
  PD_PART_COLS.forEach(function(c){ h+='<col data-ck="'+c.key+'" style="width:'+_pdColW(c,cw)+'px">'; });
  h+='<col style="width:34px"></colgroup><thead>';
  h+='<tr class="pd-h1"><th rowspan="2" class="pd-no">No</th>';
  PD_GROUPS.forEach(function(g){ h+='<th colspan="'+g.cols.length+'">'+_esc(g.label)+'</th>'; });
  h+='<th colspan="'+PD_PART_COLS.length+'">'+_esc(PD_PART_GROUP)+'</th>';
  h+='<th rowspan="2" class="pd-delcell"></th></tr>';
  h+='<tr class="pd-h2">';
  _pdCols.forEach(function(c){
    var sortable=(c.type==='text'||c.type==='date'), on=(_pdSortKey===c.key);
    h+='<th'+(sortable?' class="pd-sortable'+(on?' on':'')+'" onclick="pdSetSort(event,\''+c.key+'\')" title="클릭: 정렬 (오름차순 → 내림차순 → 입력 순서)"':'')+'>'
      +(c.lh||_esc(c.label))+(on?(_pdSortAsc?' ▲':' ▼'):'')
      +'<div class="pd-rz" data-ck="'+c.key+'" title="끌어서 너비 조절 · 더블클릭: 기본 너비"></div></th>';
  });
  PD_PART_COLS.forEach(function(c){ h+='<th>'+_esc(c.label)+'<div class="pd-rz" data-ck="'+c.key+'" title="끌어서 너비 조절 · 더블클릭: 기본 너비"></div></th>'; });
  h+='</tr></thead><tbody id="pdTbody"></tbody></table>';
  return h;
}

function renderPedestalBody(){
  var tb=document.getElementById('pdTbody'); if(!tb) return;
  var real=_pdSortedRows();
  var q=_pdSearch, html='';
  // 검색·분류·정렬 중에는 화면 전용 빈 행(v숫자)을 그리지 않는다 — 표시 순서가 입력 순서와 달라지면 빈 행을 실제 행으로 만들 때 위치가 어긋난다
  var filt=_pdViewActive();
  var items=real.map(function(row,i){return {row:row,i:i,done:_pdIsDone(row)};}).filter(function(it){
    if(_pdHideDone&&it.done) return false;
    return !filt||((!q||_pdSearchText(it.row).indexOf(q)>=0)&&_pdRowPass(it.row));
  });
  if(filt&&_pdSortKey){
    var k=_pdSortKey, dir=_pdSortAsc?1:-1;
    items.sort(function(a,b){
      var x=_pdCellStr(a.row,k), y=_pdCellStr(b.row,k);
      if(!x&&!y) return a.i-b.i;
      if(!x) return 1; if(!y) return -1; // 비어 있는 칸은 정렬 방향과 상관없이 맨 아래
      var c=x.localeCompare(y,'ko',{numeric:true});
      return c?c*dir:a.i-b.i;
    });
  }
  // 완료(출하일 기록) 행은 정렬과 상관없이 맨 아래로 — 진행중만 보기를 껐을 때 보인다
  items=items.filter(function(it){return !it.done;}).concat(items.filter(function(it){return it.done;}));
  items.forEach(function(it,n){ html+=_pdRowHtml(it.row,it.i,true,n+1); });
  if(!filt) for(var i=real.length;i<PD_MIN_ROWS;i++) html+=_pdRowHtml({cells:{}},i,false,items.length+(i-real.length)+1);
  if(!html) html='<tr><td colspan="'+(_pdCols.length+PD_PART_COLS.length+2)+'" style="padding:30px;text-align:center;color:var(--tx-muted)">조건에 맞는 행이 없습니다.</td></tr>';
  var cnt=document.getElementById('pdCount');
  if(cnt) cnt.textContent=(filt||_pdHideDone)?items.length+' / '+real.filter(_pdRowHasData).length+'건':'';
  tb.innerHTML=html;
}

function renderPedestalTab(){
  var wrap=document.getElementById('pdWrap'); if(!wrap) return;
  var prev=wrap.querySelector('.pm-body-scroll');
  var sTop=prev?prev.scrollTop:0, sLeft=prev?prev.scrollLeft:0;
  var html='<div class="pm-fixed-header"><div class="pm-ctrl-bar">'
    +'<div class="pm-ctrl-group"><span style="font-size:11px;color:#666">🔍</span>'
    +'<input class="pm-search" type="text" placeholder="고객사/설비/S/N/도번/품명 검색..." autocomplete="off" oninput="pdSearch(this.value)" value="'+_esc(_pdSearch)+'"></div>'
    +'<div class="pm-ctrl-sep"></div>'+_pdMsHtml('customer')
    +'<div class="pm-ctrl-sep"></div>'+_pdMsHtml('site')
    +'<div class="pm-ctrl-sep"></div>'+_pdMsHtml('inMonth')
    +'<div class="pm-ctrl-sep"></div>'+_pdMsHtml('shipMonth')
    +'<div class="pm-ctrl-sep"></div><div class="pm-ctrl-group"><button class="pm-filter-btn'+(_pdHideDone?' on':'')+'" onclick="pdToggleDone()" title="출하일이 기록된 완료 행을 숨김(끄면 완료 행이 맨 아래에 녹색으로 표시)">진행중만 보기</button></div>'
    +'<span id="pdCount" style="font-size:11px;color:var(--tx-muted);margin-left:6px"></span>'
    +'<button class="btn sm" onclick="pdResetView()" title="분류·정렬·검색을 모두 풀고 입력 순서로 되돌림">↺ 분류 초기화</button>'
    +'<div style="flex:1"></div>'
    +'<span style="font-size:11px;color:var(--tx-muted)">셀을 클릭해 직접 입력 · 머리글 클릭: 정렬</span>'
    +'<button class="btn sm" onclick="pdAutoFitAll()" title="모든 열의 너비를 입력된 글자 수에 맞춰 다시 정렬">↔ 열 너비 자동 맞춤</button>'
    +'<button class="btn sm" onclick="pdExportExcel()">⬇ 엑셀 내보내기</button>'
    +'<button class="btn pri sm" onclick="pdAddRows(10)">+ 행 10개 추가</button>'
    +'</div></div>'
    +'<div class="pm-body-scroll">'+_pdTableHtml()+'</div>';
  wrap.innerHTML=html;
  _pdSetTableW();
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

/* ── 입력 자동완성: 이 표에 이미 기입된 값을 제안 (초성 검색 지원) ──
   콤보박스처럼 목록에서 고르는 게 아니라 직접 입력이 기본이고, 입력하는 동안 비슷한 기존 값이 있으면 아래에 제안한다.
   한글 값은 초성만으로도 찾는다 (예: 고객사 칸에 ㅇㅇㅌㅍㄹㅅ → 인텍플러스). 영문 값은 일부 글자로 찾는다. */
var PD_CHO='ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
var _pdAcState={input:null,items:[],sel:-1};
function _pdChoseong(ch){
  var c=ch.charCodeAt(0);
  if(c>=0xAC00&&c<=0xD7A3) return PD_CHO[Math.floor((c-0xAC00)/588)];
  return ch;
}
function _pdIsJamo(ch){ var c=ch.charCodeAt(0); return c>=0x3131&&c<=0x314E; }
// 질문 q가 값 v의 어딘가에 들어 있는지: 일반 글자는 그대로, 초성(ㄱ~ㅎ)은 해당 글자의 초성과 비교
function _pdAcMatch(v,q){
  v=v.toLowerCase(); q=q.toLowerCase();
  if(v.indexOf(q)>=0) return true;
  for(var i=0;i+q.length<=v.length;i++){
    var ok=true;
    for(var j=0;j<q.length;j++){
      var qc=q[j], vc=v[i+j];
      if(_pdIsJamo(qc)?(_pdChoseong(vc)!==qc):(qc!==vc)){ ok=false; break; }
    }
    if(ok) return true;
  }
  return false;
}
function _pdAcCandidates(kind,key){
  var freq={};
  S.pedestalRows.forEach(function(row){
    if(kind==='cell'){
      var c=row.cells&&row.cells[key]; if(typeof c==='string'&&c) freq[c]=(freq[c]||0)+1;
    }else{
      _pdParts(row).forEach(function(p){ var v=p[key]; if(v) freq[v]=(freq[v]||0)+1; });
    }
  });
  return Object.keys(freq).sort(function(a,b){return freq[b]-freq[a]||a.localeCompare(b,'ko');});
}
function _pdAcBox(){
  var b=document.getElementById('pdAcBox');
  if(!b){
    b=document.createElement('div'); b.id='pdAcBox'; b.className='pd-ac';
    b.addEventListener('mousedown',function(e){
      e.preventDefault(); // 입력칸의 포커스를 유지
      var it=e.target.closest('.pd-ac-item'); if(it) pdAcPick(parseInt(it.getAttribute('data-i'),10));
    });
    document.body.appendChild(b);
  }
  return b;
}
function pdAcHide(){
  var b=document.getElementById('pdAcBox'); if(b) b.style.display='none';
  _pdAcState.input=null; _pdAcState.items=[]; _pdAcState.sel=-1;
}
function pdAc(inp,kind,key){
  var q=inp.value.trim();
  if(!q){ pdAcHide(); return; }
  var items=_pdAcCandidates(kind,key).filter(function(v){ return v!==inp.value&&_pdAcMatch(v,q); }).slice(0,8);
  if(!items.length){ pdAcHide(); return; }
  _pdAcState.input=inp; _pdAcState.items=items; _pdAcState.sel=-1;
  var b=_pdAcBox(), r=inp.getBoundingClientRect();
  b.innerHTML=items.map(function(v,i){return '<div class="pd-ac-item" data-i="'+i+'">'+_esc(v)+'</div>';}).join('');
  b.style.minWidth=Math.max(r.width,120)+'px';
  b.style.left=Math.round(r.left)+'px';
  b.style.top=Math.round(r.bottom+2)+'px';
  b.style.display='block';
}
function _pdAcHighlight(){
  document.querySelectorAll('#pdAcBox .pd-ac-item').forEach(function(el,i){ el.classList.toggle('on',i===_pdAcState.sel); });
}
function pdAcKey(e){
  var st=_pdAcState; if(!st.input||!st.items.length||e.isComposing) return;
  if(e.key==='ArrowDown'){ e.preventDefault(); st.sel=(st.sel+1)%st.items.length; _pdAcHighlight(); }
  else if(e.key==='ArrowUp'){ e.preventDefault(); st.sel=(st.sel-1+st.items.length)%st.items.length; _pdAcHighlight(); }
  else if(e.key==='Enter'&&st.sel>=0){ e.preventDefault(); pdAcPick(st.sel); }
  else if(e.key==='Escape'){ pdAcHide(); }
}
function pdAcPick(i){
  var inp=_pdAcState.input, v=_pdAcState.items[i]; if(!inp||v===undefined) return;
  inp.value=v;
  pdAcHide();
  inp.dispatchEvent(new Event('change',{bubbles:true})); // onchange 핸들러가 저장한다
}
// 표를 스크롤하면 제안 목록이 어긋나므로 닫는다
window.addEventListener('scroll',function(){ pdAcHide(); },true);

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
  if(key==='realShipDate') tr.classList.toggle('pd-done',_pdIsDone(row)); // 바로 녹색으로 바뀐다(진행중만 보기에서는 다음에 화면을 다시 그릴 때 숨겨진다)
}
// 발주 번호·Pedestal 정보 칸: 입력한 글자만 cells[key][fld](no 또는 text)에 저장한다(기존 메모·파일·날짜는 건드리지 않는다)
function pdSetObj(inp,key,fld){
  var tr=inp.closest('tr'), val=inp.value.trim();
  var existing=_pdRowById(tr.getAttribute('data-rid'));
  if(existing){ var cur=existing.cells&&existing.cells[key]; var curV=(typeof cur==='string')?cur:((cur&&cur[fld])||''); if(val===curV) return; }
  else if(!val) return;
  var row=_pdResolveRow(tr);
  _pdRichCell(row,key)[fld]=val;
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
  _pdClearView(); renderPedestalTab(); // 새 행이 맨 아래에 보이도록 분류·정렬을 푼다
  var sc=document.querySelector('#pdWrap .pm-body-scroll'); if(sc) sc.scrollTop=sc.scrollHeight;
}

function _pdDeleteFilesOnDrive(row){
  var url=getSheetsUrl(); if(!url) return;
  Object.keys(row.cells||{}).forEach(function(k){
    _pdFiles(row,k).forEach(function(f){
      if(_pdIsStaticFile(f)) return;
      fetch(url,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({action:'deleteFile',fileId:f.id})}).catch(function(){});
    });
  });
}
function _pdRowHasData(row){
  var cells=Object.keys(row.cells||{}).some(function(k){
    var c=row.cells[k];
    return typeof c==='string'?!!c:!!(c&&(c.text||c.no||c.amount||c.date||c.rev||(c.files&&c.files.length)));
  });
  return cells||_pdProjectIds(row).length>0||_pdParts(row).some(function(p){return p.dwgNo||p.itemName||p.spec;});
}
function pdDeleteRow(btn){
  var tr=btn.closest('tr');
  var row=_pdRowById(tr.getAttribute('data-rid'));
  if(!row) return;
  if(!confirm('No.'+(tr.getAttribute('data-no')||((parseInt(tr.getAttribute('data-idx'),10)||0)+1))+' 행을 삭제할까요?'+(_pdRowHasData(row)?'\n입력한 내용과 첨부파일도 함께 삭제됩니다.':''))) return;
  _pdDeleteFilesOnDrive(row);
  S.pedestalRows=S.pedestalRows.filter(function(r){return r.id!==row.id;});
  _markDeleted('pedestalRows',row.id);
  saveData(); renderPedestalBody();
}

/* ── 프로젝트 관리 데이터와 연결 (여러 개 묶기 가능) ── */
function openPedestalLink(td){
  var row=_pdResolveRow(td.closest('tr'));
  _pdModal={rowId:row.id,key:'__link'};
  var html='<div class="mtit">프로젝트 관리 데이터와 연결</div>'
    +'<div style="font-size:11px;color:var(--tx-muted);margin-bottom:8px">같은 발주로 묶을 설비를 모두 체크하세요. 고객사 / 사이트 / 설비 정보는 체크한 프로젝트에 맞춰 자동으로 채워집니다(이미 입력한 값은 덮어씁니다). 모두 해제하면 자동으로 채워진 이 3개 항목도 함께 지워집니다.</div>'
    +'<div id="pd_link_sel" style="font-size:12px;margin-bottom:8px"></div>'
    +'<div style="display:flex;gap:6px;margin-bottom:8px"><input type="text" id="pd_link_q" placeholder="시리얼 / 고객사 / 설비명 검색..." oninput="_pdRenderLinkList()" autocomplete="off" style="flex:1">'
    +'<button class="btn sm" onclick="pdLinkAllShown()">검색 결과 모두 선택</button></div>'
    +'<div id="pd_link_list" style="max-height:300px;overflow-y:auto;display:flex;flex-direction:column;gap:4px"></div>'
    +'<div class="mfoot"><button class="btn sm red" onclick="pdLinkClear()">모두 해제</button><button class="btn sm pri" onclick="pdLinkClose()">완료</button></div>';
  mw(html,true);
  _pdRenderLinkList();
  var q=document.getElementById('pd_link_q'); if(q) q.focus();
}
function _pdLinkFiltered(){
  var q=((document.getElementById('pd_link_q')||{}).value||'').trim().toLowerCase();
  // 숨긴 프로젝트는 목록에서 빼되, 이 행에 이미 연결돼 있는 것은 해제할 수 있도록 남긴다
  var row=_pdModal&&_pdRowById(_pdModal.rowId), linked=row?_pdProjectIds(row):[];
  return S.masterProjects.filter(function(mp){
    if(mp.hidden&&linked.indexOf(mp.id)<0) return false;
    if(!q) return true;
    return [mp.serial,mp.customer,mp.projectName,mp.prodUnit,mp.customerUnit].join(' ').toLowerCase().indexOf(q)>=0;
  }).sort(function(a,b){
    return String(a.customer||'').localeCompare(String(b.customer||''),'ko')||String(a.projectName||'').localeCompare(String(b.projectName||''),'ko')||String(a.serial||'').localeCompare(String(b.serial||''));
  });
}
function _pdRenderLinkList(){
  var el=document.getElementById('pd_link_list'); if(!el) return;
  var row=_pdModal&&_pdRowById(_pdModal.rowId);
  var sel={}; (row?_pdProjectIds(row):[]).forEach(function(id){sel[id]=1;});
  var list=_pdLinkFiltered(), shown=list.slice(0,150);
  el.innerHTML=shown.map(function(mp){
    var idAttr=String(mp.id).replace(/'/g,"\\'");
    return '<label class="pd-linkitem"><input type="checkbox"'+(sel[mp.id]?' checked':'')+' onchange="pdToggleLink(\''+idAttr+'\',this.checked)">'
      +'<span style="min-width:100px;color:#7aafee">'+_esc(mp.serial||'(시리얼 없음)')+'</span>'
      +'<span style="flex:1">'+_esc(mp.customer||'')+' · '+_esc(mp.projectName||'')+'</span>'
      +'<span style="color:var(--tx-faint)">'+_esc(mp.prodUnit||'')+'</span></label>';
  }).join('')+(list.length>shown.length?'<div style="font-size:11px;color:var(--tx-faint);padding:6px">… '+(list.length-shown.length)+'건 더 있음 — 검색어로 좁혀주세요</div>':'')
    +(!list.length?'<div style="font-size:12px;color:var(--tx-faint);padding:10px">일치하는 프로젝트가 없습니다.</div>':'');
  var st=document.getElementById('pd_link_sel');
  if(st){
    var n=row?_pdProjects(row).length:0;
    st.innerHTML=n?'선택됨 <b>'+n+'대</b>: '+_esc(_pdProjects(row).map(function(m){return m.serial||'(시리얼 없음)';}).join(', ')):'<span style="color:var(--tx-faint)">선택된 프로젝트가 없습니다.</span>';
  }
}
// 연결된 프로젝트 목록으로 고객사 / 사이트 / 설비 정보를 다시 계산한다
function _pdApplyLinks(row){
  var mps=_pdProjects(row);
  if(!row.cells) row.cells={};
  if(!mps.length){ delete row.cells.customer; delete row.cells.site; delete row.cells.equip; return; }
  var custs=[], sites=[], equips=[], eqCount={};
  mps.forEach(function(mp){
    var c=mp.customer||'', u=c.indexOf('_');
    var cn=u>0?c.slice(0,u):c, sn=u>0?c.slice(u+1):'';
    if(cn&&custs.indexOf(cn)<0) custs.push(cn);
    if(sn&&sites.indexOf(sn)<0) sites.push(sn);
    var en=mp.projectName||'';
    if(en){ if(!eqCount[en]){ eqCount[en]=0; equips.push(en); } eqCount[en]++; }
  });
  row.cells.customer=custs.join(' / ');
  row.cells.site=sites.join(', ');
  row.cells.equip=equips.map(function(n){return eqCount[n]>1?n+' ×'+eqCount[n]:n;}).join(', ');
}
function _pdSetLinks(ids){
  var row=_pdModal&&_pdRowById(_pdModal.rowId); if(!row) return;
  row.projectIds=ids; delete row.projectId;
  _pdApplyLinks(row);
  _touch(row); saveData();
  _pdRenderLinkList(); renderPedestalBody();
}
function pdToggleLink(projectId,on){
  var row=_pdModal&&_pdRowById(_pdModal.rowId); if(!row) return;
  var ids=_pdProjectIds(row).filter(function(id){return id!==projectId;});
  if(on) ids.push(projectId);
  _pdSetLinks(ids);
}
function pdLinkAllShown(){
  var row=_pdModal&&_pdRowById(_pdModal.rowId); if(!row) return;
  var ids=_pdProjectIds(row).slice();
  _pdLinkFiltered().slice(0,150).forEach(function(mp){ if(ids.indexOf(mp.id)<0) ids.push(mp.id); });
  _pdSetLinks(ids);
}
function pdLinkClear(){ _pdSetLinks([]); }
function pdLinkClose(){ cm(); _pdModal=null; renderPedestalBody(); }

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
      +'<button class="btn sm" onclick="pdPreviewFile(\x27'+fid+'\x27)">미리보기</button>'
      +(_fpIsDwg(f)?'<button class="btn sm" onclick="pdDwgToPdf(\x27'+fid+'\x27)" title="이 DWG를 PDF로 바꿔 같은 칸에 추가">PDF 변환</button>':'')
      +(_pdIsXlsx(f)?'<button class="btn sm pri" onclick="pdEditFile(\''+fid+'\')">편집</button>':'')
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
  var no=tr.getAttribute('data-no')||((parseInt(tr.getAttribute('data-idx'),10)||0)+1);
  var cust=_pdText(row,_pdColByKey('customer'));
  var isDoc=col.type==='doc';
  var html='<div class="mtit">'+_esc(col.full||col.label)+' — No.'+no+(cust?' · '+_esc(cust):'')+'</div>'
    +(isDoc?_pdDocFieldsHtml(row.cells&&row.cells[key]):'')
    +'<div class="fg"><label class="fl">'+(isDoc?'메모':'내용 (직접 입력)')+'</label>'
    +'<textarea id="pd_cell_text" rows="'+(isDoc?9:18)+'" style="width:100%;box-sizing:border-box;resize:vertical;background:var(--bg-deep);color:var(--tx-primary);border:1px solid var(--bd-main);border-radius:6px;padding:8px;font-size:12px;font-family:inherit" placeholder="'+(col.nofile?'글로 기록하세요.':'글로 기록하세요. 캡처한 이미지는 여기에 Ctrl+V로 바로 붙여넣을 수 있습니다.')+'" onchange="pdSaveCellText(this.value)"'+(col.nofile?'':' onpaste="pdOnPaste(event)"')+'>'+_esc(_pdText(row,col))+'</textarea></div>'
    +(col.nofile?'':'<div class="fg"><label class="fl">첨부파일 (이미지/파일, 최대 '+PD_MAX_MB+'MB)</label>'
    +'<div id="pd_cell_files" style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px">'+_pdFilesHtml(row,key)+'</div>'
    +'<button class="btn sm" onclick="pdPickFiles()">+ 파일 추가</button>'
    +'<span id="pd_cell_status" style="font-size:11px;color:var(--tx-muted);margin-left:8px"></span></div>')
    +'<div class="mfoot"><button class="btn sm pri" onclick="cm()">닫기</button></div>';
  mw(html);
  // 기록 팝업은 기본 모달의 3배 크기(가로 460→1380px, 화면 폭이 모자라면 화면에 맞춤, 입력창 높이도 3배)
  var mdl=document.querySelector('#mc .modal'); if(mdl) mdl.classList.add('pd-xl');
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
function _pdUploadFile(file,ctxIn){
  var ctx=ctxIn||_pdModal; if(!ctx) return;
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
      if(_fpIsDwg(file)) _pdMakePdf(file,ctx); // DWG를 올리면 같은 칸에 PDF도 함께 올린다
    })
    .catch(function(){ alert('업로드 응답이 정상적이지 않습니다. (서버가 막 깨어나는 중일 수 있어요) 잠시 후 다시 시도해주세요.'); setSt(''); });
  };
  reader.readAsDataURL(file);
}
function pdPreviewFile(fileId){
  var ctx=_pdModal; if(!ctx) return;
  var row=_pdRowById(ctx.rowId); if(!row) return;
  var f=_pdFiles(row,ctx.key).find(function(x){return String(x.id)===String(fileId);});
  if(f) openFilePreview(f);
}
// DWG 파일을 PDF로 바꿔 같은 칸에 올린다(올릴 때 자동 실행되고, 이미 올린 DWG는 목록의 "PDF 변환" 버튼으로 실행)
function _pdMakePdf(file,ctx){
  var setSt=function(t){ var el=document.getElementById('pd_cell_status'); if(el&&_pdModal&&_pdModal.rowId===ctx.rowId&&_pdModal.key===ctx.key) el.textContent=t; };
  setSt(file.name+' PDF 변환 중...');
  var get=file.arrayBuffer?file.arrayBuffer():Promise.reject(new Error('파일을 읽을 수 없습니다.'));
  get.then(function(buf){ return fpDwgToPdfFile(buf,file.name.replace(/\.dwg$/i,'')+'.pdf',setSt); })
    .then(function(pdf){ _pdUploadFile(pdf,ctx); })
    .catch(function(e){ setSt(''); alert('DWG는 올렸지만 PDF 변환은 하지 못했습니다: '+(e&&e.message||e)); });
}
function pdDwgToPdf(fileId){
  var ctx=_pdModal; if(!ctx) return;
  var row=_pdRowById(ctx.rowId); if(!row) return;
  var f=_pdFiles(row,ctx.key).find(function(x){return String(x.id)===String(fileId);}); if(!f) return;
  var base=f.name.replace(/\.dwg$/i,'');
  if(_pdFiles(row,ctx.key).some(function(x){return x.name===base+'.pdf';})&&!confirm(base+'.pdf 가 이미 있습니다. 한 번 더 만들까요?')) return;
  var setSt=function(t){ var el=document.getElementById('pd_cell_status'); if(el) el.textContent=t; };
  setSt(f.name+' 불러오는 중...');
  _fpBytes(f,false,'').then(function(buf){ return fpDwgToPdfFile(buf,base+'.pdf',setSt); })
    .then(function(pdf){ _pdUploadFile(pdf,ctx); })
    .catch(function(e){ setSt(''); alert('PDF 변환에 실패했습니다: '+(e&&e.message||e)); });
}
function pdDeleteFile(fileId){
  if(!_pdModal||!confirm('첨부파일을 삭제할까요?')) return;
  var ctx=_pdModal, row=_pdRowById(ctx.rowId); if(!row) return;
  var c=_pdRichCell(row,ctx.key);
  c.files=c.files.filter(function(f){return String(f.id)!==String(fileId);});
  _touch(row); saveData();
  _pdRefreshCell(ctx.rowId,ctx.key); _pdRefreshModalFiles(ctx);
  var url=getSheetsUrl();
  if(url&&String(fileId).indexOf('ref-')!==0) fetch(url,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({action:'deleteFile',fileId:fileId})}).catch(function(){});
}

/* ── 첨부 엑셀(.xlsx) 앱 안에서 편집 ──
   파일을 불러와 표로 보여주고, 저장하면 수정본을 새 파일로 Drive에 올려 그 칸의 첨부파일을 교체한다.
   기본 제공 양식(ref-)은 원본을 그대로 두고 이 행 전용 복사본이 만들어진다. */
var PD_XLSX_MIME='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
var _pdXl=null; // {wb,ws,ctx,fileId,fileName,lastRow}
function _pdIsXlsx(f){ return /\.xlsx$/i.test(f.name||''); }
function _pdB64ToBuf(b64){
  var bin=atob(b64), buf=new Uint8Array(bin.length);
  for(var i=0;i<bin.length;i++) buf[i]=bin.charCodeAt(i);
  return buf.buffer;
}
function _pdFetchFileBuffer(f){
  if(_pdIsStaticFile(f)) return fetch(new URL(f.downloadUrl,location.href).href,{cache:'no-store'}).then(function(r){ if(!r.ok) throw new Error('파일을 불러오지 못했습니다.'); return r.arrayBuffer(); });
  var url=getSheetsUrl(); if(!url) return Promise.reject(new Error('Sheets 연동 URL이 설정되어 있지 않습니다.'));
  return fetch(url,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({action:'getFile',fileId:f.id})})
    .then(function(r){return r.json();})
    .then(function(d){ if(d.error) throw new Error(d.error); return _pdB64ToBuf(d.base64Data); });
}
function _pdXlText(cell){
  var v=cell.value;
  if(v===null||v===undefined) return '';
  if(typeof v==='object'){
    if(v.richText) return v.richText.map(function(t){return t.text;}).join('');
    if(v.result!==undefined&&v.result!==null) return String(v.result);
    if(v.text!==undefined) return String(v.text);
    if(v instanceof Date) return v.toISOString().slice(0,10);
    return '';
  }
  return String(v);
}
function _pdXlLastRow(ws){
  var last=1;
  ws.eachRow({includeEmpty:false},function(row,n){ row.eachCell({includeEmpty:false},function(c){ if(_pdXlText(c)!=='') last=Math.max(last,n); }); });
  return last;
}
function _pdXlCellCss(cell){
  var css='', s=cell.style||{};
  if(s.fill&&s.fill.fgColor&&s.fill.fgColor.argb) css+='background:#'+s.fill.fgColor.argb.slice(-6)+';color:#111;';
  if(s.font&&s.font.bold) css+='font-weight:700;';
  var h=s.alignment&&s.alignment.horizontal; if(h==='center'||h==='centerContinuous') css+='text-align:center;'; else if(h==='right') css+='text-align:right;';
  return css;
}
function pdEditFile(fileId){
  var ctx=_pdModal; if(!ctx) return;
  var row=_pdRowById(ctx.rowId); if(!row) return;
  var f=_pdFiles(row,ctx.key).find(function(x){return String(x.id)===String(fileId);}); if(!f) return;
  var setSt=function(t){ var el=document.getElementById('pd_cell_status'); if(el) el.textContent=t; };
  setSt('파일 불러오는 중...');
  Promise.all([_pdFetchFileBuffer(f),new Promise(function(res){_ensureExcelJS(res);})]).then(function(r){
    var wb=new ExcelJS.Workbook();
    return wb.xlsx.load(r[0]).then(function(){ return wb; });
  }).then(function(wb){
    setSt('');
    _pdXl={wb:wb,ws:wb.worksheets[0],ctx:{rowId:ctx.rowId,key:ctx.key},fileId:f.id,fileName:f.name,lastRow:0};
    _pdXl.lastRow=_pdXlLastRow(_pdXl.ws)+4;
    _pdOpenXlEditor();
  }).catch(function(e){ setSt(''); alert('엑셀 파일을 열 수 없습니다: '+(e&&e.message||e)); });
}
function _pdXlGridHtml(){
  var ws=_pdXl.ws, ncol=Math.max(ws.columnCount,5), nrow=_pdXl.lastRow;
  var spans={}, covered={};
  Object.keys(ws._merges||{}).forEach(function(k){
    var m=ws._merges[k].model; if(!m) return;
    spans[m.top+','+m.left]={rs:m.bottom-m.top+1,cs:m.right-m.left+1};
    for(var r=m.top;r<=m.bottom;r++) for(var c=m.left;c<=m.right;c++) if(r!==m.top||c!==m.left) covered[r+','+c]=1;
  });
  var h='<table class="pd-xl"><thead><tr><th></th>';
  for(var c=1;c<=ncol;c++) h+='<th style="min-width:'+Math.round((ws.getColumn(c).width||10)*7)+'px">'+String.fromCharCode(64+c)+'</th>';
  h+='</tr></thead><tbody>';
  for(var r=1;r<=nrow;r++){
    h+='<tr><th>'+r+'</th>';
    for(var cc=1;cc<=ncol;cc++){
      var key=r+','+cc; if(covered[key]) continue;
      var cell=ws.getCell(r,cc), sp=spans[key], txt=_pdXlText(cell);
      h+='<td data-r="'+r+'" data-c="'+cc+'" data-o="'+_esc(txt)+'" contenteditable="plaintext-only" spellcheck="false"'
        +(sp?' rowspan="'+sp.rs+'" colspan="'+sp.cs+'"':'')+' style="'+_pdXlCellCss(cell)+'">'+_esc(txt)+'</td>';
    }
    h+='</tr>';
  }
  return h+'</tbody></table>';
}
function _pdOpenXlEditor(){
  var html='<div class="mtit">'+_esc(_pdXl.fileName)+' — 편집</div>'
    +'<div style="font-size:11px;color:var(--tx-muted);margin-bottom:8px">칸을 클릭해서 직접 수정하세요. 저장하면 이 행(칸) 전용 파일로 보관됩니다'
    +(String(_pdXl.fileId).indexOf('ref-')===0?' (기본 양식 원본은 그대로 유지됩니다)':'')+'.</div>'
    +'<div id="pd_xl_wrap" style="max-height:55vh;overflow:auto;border:1px solid var(--bd-main);border-radius:6px">'+_pdXlGridHtml()+'</div>'
    +'<div class="mfoot"><button class="btn sm" onclick="pdXlAddRow()" style="margin-right:auto">+ 행 추가</button>'
    +'<span id="pd_xl_status" style="font-size:11px;color:var(--tx-muted);margin-right:8px"></span>'
    +'<button class="btn sm" onclick="pdXlClose()">취소</button><button class="btn sm pri" id="pd_xl_save" onclick="pdXlSave()">저장</button></div>';
  mw(html,true);
}
function pdXlAddRow(){
  _pdXl.lastRow+=1;
  var wrap=document.getElementById('pd_xl_wrap');
  _pdXlCollect(); // 입력 중이던 값을 유지
  wrap.innerHTML=_pdXlGridHtml(); wrap.scrollTop=wrap.scrollHeight;
}
// 편집한 칸의 값을 워크북에 반영한다 (바뀐 칸만 건드려서 서식/수식을 보존)
function _pdXlCollect(){
  var changed=0;
  document.querySelectorAll('#pd_xl_wrap td[data-r]').forEach(function(td){
    var txt=td.textContent.replace(/\r/g,''), o=td.getAttribute('data-o');
    if(txt===o) return;
    var cell=_pdXl.ws.getCell(parseInt(td.getAttribute('data-r'),10),parseInt(td.getAttribute('data-c'),10));
    var wasNum=typeof cell.value==='number';
    cell.value=txt===''?null:((wasNum&&/^-?\d+(\.\d+)?$/.test(txt.trim()))?Number(txt):txt);
    td.setAttribute('data-o',txt); changed++;
  });
  return changed;
}
function pdXlClose(){
  var ctx=_pdXl&&_pdXl.ctx; _pdXl=null;
  cm();
  if(ctx) _pdReopenCell(ctx);
}
function _pdReopenCell(ctx){
  var tr=document.querySelector('#pdTbody tr.pd-row[data-rid="'+ctx.rowId+'"]');
  var td=tr&&tr.querySelector('td[data-k="'+ctx.key+'"]');
  if(td) openPedestalCell(td,ctx.key); else _pdModal=null;
}
function pdXlSave(){
  if(!_pdXl) return;
  var st=document.getElementById('pd_xl_status'), btn=document.getElementById('pd_xl_save');
  var url=getSheetsUrl();
  if(!url){ alert('Sheets 연동 URL이 설정되어 있지 않아 저장할 수 없습니다.'); return; }
  _pdXlCollect();
  if(btn) btn.disabled=true; if(st) st.textContent='저장 중...';
  var x=_pdXl, ctx=x.ctx, row=_pdRowById(ctx.rowId);
  var base=(x.fileName||'file.xlsx').replace(/\.xlsx$/i,'').replace(/ — No\.\d+.*$/,'');
  var idx=parseInt((document.querySelector('#pdTbody tr.pd-row[data-rid="'+ctx.rowId+'"]')||{getAttribute:function(){return 0;}}).getAttribute('data-no'),10)||1;
  var cust=row?_pdText(row,_pdColByKey('customer')):'';
  var name=String(x.fileId).indexOf('ref-')===0?base+' — No.'+idx+(cust?' '+cust:'')+'.xlsx':(x.fileName||base+'.xlsx');
  x.wb.xlsx.writeBuffer().then(function(buf){
    var blob=new Blob([buf],{type:PD_XLSX_MIME});
    return new Promise(function(res,rej){
      var rd=new FileReader(); rd.onload=function(){res(String(rd.result).split(',')[1]||'');}; rd.onerror=rej; rd.readAsDataURL(blob);
    }).then(function(b64){
      return fetch(url,{method:'POST',headers:{'Content-Type':'text/plain'},
        body:JSON.stringify({action:'uploadFile',fileName:name,mimeType:blob.type,base64Data:b64})}).then(function(r){return r.json();});
    });
  }).then(function(d){
    if(d.error) throw new Error(d.error);
    var r2=_pdRowById(ctx.rowId); if(!r2) throw new Error('행을 찾을 수 없습니다.');
    var c=_pdRichCell(r2,ctx.key);
    var entry={id:d.fileId,name:d.name,size:d.size,downloadUrl:d.downloadUrl,viewUrl:d.viewUrl,mimeType:PD_XLSX_MIME,uploadedAt:Date.now()};
    var pos=c.files.findIndex(function(f){return String(f.id)===String(x.fileId);});
    if(pos>=0) c.files.splice(pos,1,entry); else c.files.push(entry);
    _touch(r2); saveData();
    if(String(x.fileId).indexOf('ref-')!==0) fetch(url,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({action:'deleteFile',fileId:x.fileId})}).catch(function(){});
    _pdRefreshCell(ctx.rowId,ctx.key);
    _pdXl=null; cm(); _pdReopenCell(ctx);
  }).catch(function(e){
    if(btn) btn.disabled=false; if(st) st.textContent='';
    alert('저장 실패: '+(e&&e.message||e)+'\n(서버가 막 깨어나는 중이면 잠시 후 다시 시도해주세요.)');
  });
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
  ec.push({g:'',l:'프로젝트 시리얼',w:16,main:true,v:function(r){return _pdProjects(r).map(function(m){return m.serial||'';}).filter(Boolean).join(', ');}});
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
        ec.push({g:g.label,l:col.label,w:col.w/6+8,main:true,files:col.nofile?null:col.key,v:function(r){return col.nofile?_pdText(r,col):_pdMemoWithFiles(r,col);}});
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
          cell.value=fl.length?{text:String(val),hyperlink:new URL(fl[0].viewUrl||fl[0].downloadUrl,location.href).href}:val;
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
