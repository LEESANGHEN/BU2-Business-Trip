/* ══════════════════════════════════════════
   프로젝트 여러 대 한 번에 등록 / 복제 — projects-batch.js
   구분·지역·고객사·프로젝트(설비명)는 공통으로 한 번만 입력하고,
   시리얼/호기/일정 등은 아래 표에서 한 줄(=한 대)씩 입력한다.
   - 새 행은 윗행의 값을 그대로 가져오고(시리얼 제외), 호기 숫자는 1씩 올라간다
   - 열 제목의 ↓ 버튼: 첫 행의 값을 아래 모든 행에 복사
   - 엑셀에서 복사한 값(여러 줄/여러 칸)을 칸에 붙여넣기 가능
   - 기존 프로젝트의 "복제"도 같은 창을 쓴다(공통 정보 + 1행으로 시작)
══════════════════════════════════════════ */

var MPB_COLS=[
  {k:'serial',l:'프로젝트 시리얼',t:'text',w:130,noFill:true},
  {k:'prodUnit',l:'생산 호기',t:'text',w:90,inc:true,noFill:true,ph:'70호기'},
  {k:'customerUnit',l:'고객사 호기',t:'text',w:90,inc:true,noFill:true},
  {k:'transferDate',l:'생산 이관일',t:'date',w:128},
  {k:'setupStart',l:'셋업 시작',t:'date',w:128},
  {k:'setupEnd',l:'셋업 종료',t:'date',w:128},
  {k:'setupLocation',l:'셋업 장소',t:'text',w:100},
  {k:'shipDate',l:'출하 일정',t:'date',w:128},
  {k:'status',l:'상태',t:'text',w:90,list:'mpb_status_list'}
];
var _mpbRows=[];

function _mpbIncUnit(s){
  s=String(s||'');
  return s.replace(/(\d+)(?!.*\d)/,function(m){ var n=String(parseInt(m,10)+1); while(n.length<m.length) n='0'+n; return n; });
}
function _mpbNormDate(s){
  s=String(s||'').trim(); if(!s) return '';
  var m=s.match(/(\d{4})\s*[.\-\/년]\s*(\d{1,2})\s*[.\-\/월]\s*(\d{1,2})/);
  if(!m) return '';
  return m[1]+'-'+('0'+m[2]).slice(-2)+'-'+('0'+m[3]).slice(-2);
}
function _mpbNewRow(prev){
  var r={};
  MPB_COLS.forEach(function(c){
    if(!prev||c.k==='serial') r[c.k]='';
    else r[c.k]=c.inc?_mpbIncUnit(prev[c.k]):(prev[c.k]||'');
  });
  return r;
}
function _mpbRowFromProject(mp){
  var r={};
  MPB_COLS.forEach(function(c){
    if(c.k==='serial') r[c.k]='';
    else r[c.k]=c.inc?_mpbIncUnit(mp[c.k]):(mp[c.k]||'');
  });
  return r;
}

/* ── 창 열기 ── */
function openBatchMasterProject(srcId){
  var src=srcId?S.masterProjects.find(function(m){return m.id===srcId;}):null;
  _mpbRows=[src?_mpbRowFromProject(src):_mpbNewRow(null)];
  var v=function(f){return src?_esc(src[f]||''):'';};
  var html='<div class="mtit">'+(src?'프로젝트 복제 — 여러 대 등록':'프로젝트 여러 대 한 번에 등록')+'</div>'
    +'<div style="font-size:11px;color:var(--tx-muted);margin-bottom:8px">구분 / 지역 / 고객사 / 프로젝트는 모두 같게 들어가고, 시리얼·호기·일정은 아래 표에서 한 줄(한 대)씩 입력합니다.</div>'
    +'<div style="display:flex;gap:8px">'
    +'<div class="fg" style="flex:1"><label class="fl">구분</label><input type="text" id="mp_category" value="'+v('category')+'" list="mp_category_list" autocomplete="off"></div>'
    +'<div class="fg" style="flex:1"><label class="fl">지역</label>'+_mpRegionFieldHtml(src?src.region:'')+'</div>'
    +'</div>'
    +'<datalist id="mp_category_list"><option value="Repeat Order"><option value="신규 개발"><option value="기타"></datalist>'
    +'<datalist id="mpb_status_list"><option value="진행중"><option value="완료"><option value="PO 대기"><option value="PO 발행"><option value="LOI 접수"></datalist>'
    +'<div style="display:flex;gap:8px">'
    +'<div class="fg" style="flex:1"><label class="fl">고객사</label><input type="text" id="mp_customer" value="'+v('customer')+'" autocomplete="off"></div>'
    +'<div class="fg" style="flex:1"><label class="fl">프로젝트(설비명)</label><input type="text" id="mp_projectName" value="'+v('projectName')+'" autocomplete="off"></div>'
    +'</div>'
    +'<div style="display:flex;align-items:center;gap:8px;margin:6px 0">'
    +'<span style="font-size:11px;color:var(--tx-muted);font-weight:600">등록할 설비 목록</span>'
    +'<label class="fl" style="margin:0 0 0 auto">대수</label><input type="number" id="mpb_count" min="1" max="100" value="1" style="width:64px">'
    +'<button class="btn sm" onclick="mpbSetCount()">적용</button>'
    +'<button class="btn sm" onclick="mpbAddRow()">+ 행 추가</button>'
    +'</div>'
    +'<div id="mpb_wrap" style="max-height:44vh;overflow:auto;border:1px solid var(--bd-main);border-radius:6px"></div>'
    +'<div style="font-size:10px;color:var(--tx-muted);margin:6px 0 2px">새 행은 윗행 값을 그대로 가져오고 호기 숫자는 1씩 올라갑니다. 열 제목의 ↓는 첫 행 값을 아래로 모두 채웁니다. 엑셀에서 복사한 값을 칸에 붙여넣을 수 있습니다(시리얼 여러 줄도 가능).</div>'
    +'<div class="mfoot"><button class="btn sm" onclick="cm()">취소</button>'
    +'<button class="btn sm pri" onclick="saveBatchMasterProject()">등록</button></div>';
  mw(html,true);
  mpbRender();
  setTimeout(function(){var el=document.getElementById(src?'mpb_count':'mp_category'); if(el) el.focus();},50);
}

/* ── 표 ── */
function mpbRender(){
  var wrap=document.getElementById('mpb_wrap'); if(!wrap) return;
  var h='<table class="mpb-table"><thead><tr><th>#</th>';
  MPB_COLS.forEach(function(c,ci){
    h+='<th style="min-width:'+c.w+'px">'+_esc(c.l)+(c.noFill?'':' <button class="mpb-fill" title="첫 행의 값을 아래 모든 행에 복사" onclick="mpbFillDown('+ci+')">↓</button>')+'</th>';
  });
  h+='<th></th></tr></thead><tbody>';
  _mpbRows.forEach(function(r,ri){
    h+='<tr><td class="mpb-no">'+(ri+1)+'</td>';
    MPB_COLS.forEach(function(c,ci){
      h+='<td><input type="'+c.t+'" value="'+_esc(r[c.k]||'')+'" data-r="'+ri+'" data-c="'+ci+'"'
        +(c.list?' list="'+c.list+'"':'')+(c.ph?' placeholder="'+_esc(c.ph)+'"':'')
        +' autocomplete="off" oninput="mpbSet(this)" onpaste="mpbPaste(event,this)"></td>';
    });
    h+='<td class="mpb-del"><button class="pd-del" title="이 행 삭제" onclick="mpbDelRow('+ri+')">×</button></td></tr>';
  });
  h+='</tbody></table>';
  wrap.innerHTML=h;
  var cnt=document.getElementById('mpb_count'); if(cnt) cnt.value=_mpbRows.length;
}
function mpbSet(inp){
  var r=parseInt(inp.getAttribute('data-r'),10), c=MPB_COLS[parseInt(inp.getAttribute('data-c'),10)];
  if(_mpbRows[r]) _mpbRows[r][c.k]=inp.value;
}
function mpbAddRow(){
  _mpbRows.push(_mpbNewRow(_mpbRows[_mpbRows.length-1]));
  mpbRender();
  var wrap=document.getElementById('mpb_wrap'); if(wrap) wrap.scrollTop=wrap.scrollHeight;
}
function mpbSetCount(){
  var n=Math.max(1,Math.min(100,parseInt((document.getElementById('mpb_count')||{}).value,10)||1));
  while(_mpbRows.length<n) _mpbRows.push(_mpbNewRow(_mpbRows[_mpbRows.length-1]));
  if(_mpbRows.length>n) _mpbRows.length=n;
  mpbRender();
}
function mpbDelRow(i){
  if(_mpbRows.length<=1){ _mpbRows=[_mpbNewRow(null)]; }
  else _mpbRows.splice(i,1);
  mpbRender();
}
function mpbFillDown(ci){
  var k=MPB_COLS[ci].k, first=_mpbRows[0][k];
  for(var i=1;i<_mpbRows.length;i++) _mpbRows[i][k]=first;
  mpbRender();
}
// 엑셀에서 복사한 여러 줄/여러 칸을 현재 칸부터 채운다. 한 칸짜리 일반 텍스트는 기본 붙여넣기에 맡긴다(날짜 칸만 형식 보정)
function mpbPaste(e,inp){
  var text=(e.clipboardData&&e.clipboardData.getData('text'))||''; if(!text) return;
  var r0=parseInt(inp.getAttribute('data-r'),10), c0=parseInt(inp.getAttribute('data-c'),10);
  var lines=text.replace(/\r/g,'').replace(/\n+$/,'').split('\n').map(function(l){return l.split('\t');});
  var single=lines.length===1&&lines[0].length===1;
  if(single&&MPB_COLS[c0].t!=='date') return;
  e.preventDefault();
  lines.forEach(function(cells,i){
    var r=r0+i; if(r>=100) return;
    while(_mpbRows.length<=r) _mpbRows.push(_mpbNewRow(_mpbRows[_mpbRows.length-1]));
    cells.forEach(function(val,j){
      var c=MPB_COLS[c0+j]; if(!c) return;
      _mpbRows[r][c.k]=c.t==='date'?_mpbNormDate(val):val.trim();
    });
  });
  mpbRender();
}

/* ── 저장 ── */
function saveBatchMasterProject(){
  function v(id){var el=document.getElementById(id);return el?el.value.trim():'';}
  var common={category:v('mp_category'),region:_mpReadRegionField(),customer:v('mp_customer'),projectName:v('mp_projectName')};
  if(!common.customer){alert('고객사를 입력해주세요.');return;}
  var have={}; S.masterProjects.forEach(function(m){ if(m.serial) have[String(m.serial).trim().toLowerCase()]=1; });
  var made=[], skippedDup=[], skippedEmpty=0;
  _mpbRows.forEach(function(r){
    var row={}; MPB_COLS.forEach(function(c){ row[c.k]=String(r[c.k]||'').trim(); });
    if(!row.serial&&!row.prodUnit&&!row.customerUnit){ skippedEmpty++; return; }
    var key=row.serial.toLowerCase();
    if(row.serial&&have[key]){ skippedDup.push(row.serial); return; }
    if(row.serial) have[key]=1;
    var f={category:common.category,region:common.region,customer:common.customer,projectName:common.projectName,
      prodUnit:row.prodUnit,customerUnit:row.customerUnit,serial:row.serial,
      setupStart:row.setupStart,setupEnd:row.setupEnd,setupManager:'',setupLocation:row.setupLocation,
      shipDate:row.shipDate,customerReqShipDate:'',transferDate:row.transferDate,transferDateOverride:'',status:row.status};
    if(!f.transferDate&&f.setupStart) f.transferDate=_addDaysStr(f.setupStart,-1);
    var mp=_touch(f); mp.id=_mpId();
    S.masterProjects.push(mp); made.push(mp);
  });
  if(!made.length){
    alert('등록할 항목이 없습니다.'+(skippedDup.length?'\n이미 등록된 시리얼: '+skippedDup.join(', '):'\n시리얼 또는 호기가 입력된 행이 있어야 합니다.'));
    return;
  }
  saveData(); cm(); _mpRenderTabKeepScroll();
  if(skippedDup.length) alert(made.length+'건 등록했습니다.\n이미 등록된 시리얼이라 건너뜀: '+skippedDup.join(', '));
}
