/* ══════════════════════════════════════════
   프로젝트 관리 (마스터 프로젝트 목록) — projects.js
   BU2 "프로젝트 입력" 엑셀을 대체하는 탭.
   간트 차트(S.schedules)와는 완전히 독립된 별도 데이터(S.masterProjects)다.
   여기서 프로젝트를 등록/수정해도 간트 차트에는 자동으로 반영되지 않는다 —
   간트 차트는 이 탭과 무관하게 별도로 직접 관리한다.
══════════════════════════════════════════ */

var _mpSearch='';
var _mpFilterRegion='all';
var _mpFilterStatus='all';
var _mpFilterCustomer='all';
var _mpFilterShipMonth='all';
var _mpSortKey='category';
var _mpSortAsc=false;
var _mpHideInactive=true;     // 완료/LOI 접수/발주 대기 상태 숨기고 진행중(그 외 상태·공란)만 보기 — 기본 On
var _MP_HIDDEN_STATUSES=['완료','LOI 접수','발주 대기'];

// "생산 98호기"처럼 숫자가 섞인 호기 텍스트를 숫자 크기로 비교 (둘 다 숫자면 숫자 비교, 아니면 문자열 비교)
function _mpUnitNum(v){
  var m=String(v||'').match(/(\d+)/);
  return m?parseInt(m[1],10):null;
}
function _mpUnitCompare(a,b){
  var an=_mpUnitNum(a), bn=_mpUnitNum(b);
  if(an!==null&&bn!==null&&an!==bn) return an-bn;
  return String(a||'').localeCompare(String(b||''),'ko');
}

function _mpId(){ return genId('mp',S.masterProjects); }

/* ── 목록 탭 렌더 ── */
function renderProjectsTab(){
  var wrap=document.getElementById('mpWrap');
  if(!wrap) return;
  var html='<div class="pm-fixed-header">';
  html+='<div class="pm-ctrl-bar" id="mpCtrlBar">';
  html+='<div class="pm-ctrl-group">';
  html+='<span style="font-size:11px;color:#666">🔍</span>';
  html+='<input class="pm-search" id="mpSearchInp" type="text" placeholder="'+t('mpSearchPh')+'" autocomplete="off" oninput="setMpSearch(this.value)" value="'+_esc(_mpSearch)+'">';
  html+='</div>';
  html+='<div class="pm-ctrl-sep"></div>';
  html+='<div class="pm-ctrl-group">';
  html+='<span style="font-size:10px;color:#555">'+t('mpRegion')+'</span>';
  html+='<select id="mpRegionSel" onchange="setMpRegionFilter(this.value)">'+_mpRegionFilterOpts()+'</select>';
  html+='</div>';
  html+='<div class="pm-ctrl-sep"></div>';
  html+='<div class="pm-ctrl-group">';
  html+='<span style="font-size:10px;color:#555">'+t('mpStatus')+'</span>';
  html+='<select id="mpStatusSel" onchange="setMpStatusFilter(this.value)">'+_mpStatusFilterOpts()+'</select>';
  html+='</div>';
  html+='<div class="pm-ctrl-sep"></div>';
  html+='<div class="pm-ctrl-group">';
  html+='<span style="font-size:10px;color:#555">'+t('mpCustomer')+'</span>';
  html+='<select id="mpCustomerSel" onchange="setMpCustomerFilter(this.value)">'+_mpCustomerFilterOpts()+'</select>';
  html+='</div>';
  html+='<div class="pm-ctrl-sep"></div>';
  html+='<div class="pm-ctrl-group">';
  html+='<span style="font-size:10px;color:#555">'+t('mpShipMonth')+'</span>';
  html+='<select id="mpShipMonthSel" onchange="setMpShipMonthFilter(this.value)">'+_mpShipMonthFilterOpts()+'</select>';
  html+='</div>';
  html+='<div class="pm-ctrl-sep"></div>';
  html+='<div class="pm-ctrl-group">';
  html+='<button class="pm-filter-btn'+(_mpHideInactive?' on':'')+'" id="mpHideInactiveBtn" onclick="togglePmHideInactive()">'+t('mpHideInactive')+'</button>';
  html+='</div>';
  html+='<div style="flex:1"></div>';
  if(!S.masterProjects.length){
    html+='<button class="btn warn sm" onclick="importExcelSeedMasterProjects()">엑셀 데이터 가져오기 (최초 1회)</button>';
  }
  if(_isAdminMode()) html+='<button class="btn pri sm" onclick="openAddMasterProject()">'+t('mpAddProject')+'</button>';
  html+='</div>';
  html+='</div>';
  html+='<div class="pm-body-scroll"><div id="mpBody"></div></div>';
  wrap.innerHTML=html;
  renderProjectsBody();
}

function setMpSearch(v){_mpSearch=v.trim().toLowerCase();renderProjectsBody();}
function setMpRegionFilter(v){_mpFilterRegion=v;renderProjectsBody();}
function setMpStatusFilter(v){_mpFilterStatus=v;renderProjectsBody();}
function setMpCustomerFilter(v){_mpFilterCustomer=v;renderProjectsBody();}
function setMpShipMonthFilter(v){_mpFilterShipMonth=v;renderProjectsBody();}
function togglePmHideInactive(){
  _mpHideInactive=!_mpHideInactive;
  var btn=document.getElementById('mpHideInactiveBtn');
  if(btn) btn.className='pm-filter-btn'+(_mpHideInactive?' on':'');
  renderProjectsBody();
}
function setMpSort(key){
  if(_mpSortKey===key)_mpSortAsc=!_mpSortAsc;
  else{_mpSortKey=key;_mpSortAsc=true;}
  renderProjectsBody();
}

function _mpRegionFilterOpts(){
  var regions=[];
  S.masterProjects.forEach(function(mp){if(mp.region&&regions.indexOf(mp.region)<0)regions.push(mp.region);});
  (typeof BASE_REGIONS!=='undefined'?BASE_REGIONS:[]).forEach(function(r){if(regions.indexOf(r)<0)regions.push(r);});
  var html='<option value="all"'+(_mpFilterRegion==='all'?' selected':'')+'>'+t('optAll')+'</option>';
  regions.forEach(function(r){html+='<option value="'+_esc(r)+'"'+(_mpFilterRegion===r?' selected':'')+'>'+_esc(r)+'</option>';});
  return html;
}
function _mpStatusFilterOpts(){
  var statuses=[];
  S.masterProjects.forEach(function(mp){if(mp.status&&statuses.indexOf(mp.status)<0)statuses.push(mp.status);});
  var html='<option value="all"'+(_mpFilterStatus==='all'?' selected':'')+'>'+t('optAll')+'</option>';
  statuses.forEach(function(s){html+='<option value="'+_esc(s)+'"'+(_mpFilterStatus===s?' selected':'')+'>'+_esc(s)+'</option>';});
  return html;
}
function _mpCustomerFilterOpts(){
  var customers=[];
  S.masterProjects.forEach(function(mp){if(mp.customer&&customers.indexOf(mp.customer)<0)customers.push(mp.customer);});
  customers.sort(function(a,b){return a.localeCompare(b,'ko');});
  var html='<option value="all"'+(_mpFilterCustomer==='all'?' selected':'')+'>'+t('optAll')+'</option>';
  customers.forEach(function(c){html+='<option value="'+_esc(c)+'"'+(_mpFilterCustomer===c?' selected':'')+'>'+_esc(c)+'</option>';});
  return html;
}
function _mpShipMonth(mp){ return mp.shipDate?mp.shipDate.slice(0,7):''; }
function _mpShipMonthFilterOpts(){
  var months=[];
  S.masterProjects.forEach(function(mp){var m=_mpShipMonth(mp);if(m&&months.indexOf(m)<0)months.push(m);});
  months.sort();
  var html='<option value="all"'+(_mpFilterShipMonth==='all'?' selected':'')+'>'+t('optAll')+'</option>';
  months.forEach(function(m){html+='<option value="'+m+'"'+(_mpFilterShipMonth===m?' selected':'')+'>'+m+'</option>';});
  return html;
}

function renderProjectsBody(){
  var body=document.getElementById('mpBody');
  if(!body)return;
  var rows=S.masterProjects.filter(function(mp){
    if(_mpFilterRegion!=='all'&&(mp.region||'기타')!==_mpFilterRegion)return false;
    if(_mpFilterStatus!=='all'&&(mp.status||'')!==_mpFilterStatus)return false;
    if(_mpFilterCustomer!=='all'&&(mp.customer||'')!==_mpFilterCustomer)return false;
    if(_mpFilterShipMonth!=='all'&&_mpShipMonth(mp)!==_mpFilterShipMonth)return false;
    if(_mpHideInactive&&_MP_HIDDEN_STATUSES.indexOf(mp.status||'')>=0)return false;
    if(_mpSearch){
      var hay=[mp.customer,mp.projectName,mp.prodUnit,mp.customerUnit,mp.serial].join(' ').toLowerCase();
      if(hay.indexOf(_mpSearch)<0)return false;
    }
    return true;
  });
  if(!rows.length){
    body.innerHTML='<div style="padding:30px 10px;text-align:center;color:#707080;font-size:13px">'
      +(S.masterProjects.length?'해당 조건의 프로젝트가 없습니다.':'등록된 프로젝트가 없습니다. 엑셀 데이터를 가져오거나 새로 등록하세요.')
      +'</div>';
    return;
  }
  rows.sort(function(a,b){
    var k=_mpSortKey,v;
    v=String(a[k]||'').localeCompare(String(b[k]||''),'ko');
    if(!_mpSortAsc) v=-v;
    if(v!==0) return v;
    // 정렬 기준이 같으면 구분→지역→고객사→프로젝트→생산/고객사 호기 순으로 세부 배치
    // (새로 등록한 프로젝트도 이 순서에 맞는 자리에 자동으로 놓인다)
    var tieFields=['category','region','customer','projectName'];
    for(var i=0;i<tieFields.length;i++){
      var f=tieFields[i];
      var tv=String(a[f]||'').localeCompare(String(b[f]||''),'ko');
      if(tv!==0) return tv;
    }
    // 생산/고객사 호기는 "98호기"처럼 숫자가 포함된 텍스트라 문자열 비교로는 순서가 뒤틀린다
    // (예: "108호기"가 "70호기"보다 앞으로 옴) — 숫자를 뽑아 숫자 크기로 비교한다
    var uv=_mpUnitCompare(a.prodUnit,b.prodUnit);
    if(uv!==0) return uv;
    return _mpUnitCompare(a.customerUnit,b.customerUnit);
  });
  body.innerHTML=renderProjectsTable(rows);
}

function renderProjectsTable(rows){
  function thS(key,lbl){
    var isOn=_mpSortKey===key;
    var arrow=isOn?(_mpSortAsc?' ▲':' ▼'):'';
    return '<th class="'+(isOn?'on':'')+'" onclick="setMpSort(\''+key+'\')">'+lbl+arrow+'</th>';
  }
  var html='<table class="pm-person-table"><thead><tr>';
  html+=thS('category',t('colCategory'))+thS('region',t('mpRegion'))+thS('customer',t('mpCustomer'))+thS('projectName',t('colProject'));
  html+='<th>'+t('colSerial')+'</th>';
  html+='<th>'+t('colUnitCombined')+'</th>';
  html+=thS('setupStart',t('colSetupPeriod'));
  html+=thS('shipDate',t('colShipDate'));
  html+='<th>'+t('colCustomerReqShipL1')+'<br>'+t('colCustomerReqShipL2')+'</th>';
  html+=thS('status',t('mpStatus'));
  if(_isAdminMode()) html+='<th>'+t('colManage')+'</th>';
  html+='</tr></thead><tbody>';
  rows.forEach(function(mp){html+=renderProjectRow(mp);});
  html+='</tbody></table>';
  return html;
}

function renderProjectRow(mp){
  var setupLbl=(mp.setupStart&&mp.setupEnd)?(fmtFull(mp.setupStart)+' ~ '+fmtFull(mp.setupEnd)):'-';
  var shipLbl=mp.shipDate?fmtFull(mp.shipDate):'-';
  var custReqShipLbl=mp.customerReqShipDate?fmtFull(mp.customerReqShipDate):'-';
  var unitLbl=[mp.prodUnit,mp.customerUnit].filter(Boolean).join(' / ');
  var admin=_isAdminMode();
  return '<tr class="pm-person-row"'+(admin?' style="cursor:pointer" onclick="openEditMasterProject(\''+mp.id+'\')"':'')+'>'
    +'<td>'+_esc(mp.category||'')+'</td>'
    +'<td>'+_esc(mp.region||'')+'</td>'
    +'<td>'+_esc(mp.customer||'')+'</td>'
    +'<td>'+_esc(mp.projectName||'')+'</td>'
    +'<td>'+_esc(mp.serial||'')+'</td>'
    +'<td>'+_esc(unitLbl)+'</td>'
    +'<td>'+setupLbl+'</td>'
    +'<td>'+shipLbl+'</td>'
    +'<td>'+custReqShipLbl+'</td>'
    +'<td>'+_esc(mp.status||'')+'</td>'
    +(admin?('<td onclick="event.stopPropagation()">'
      +'<button class="eq-item-edit-btn" onclick="openEditMasterProject(\''+mp.id+'\')">'+t('btnEdit')+'</button> '
      +'<button class="eq-item-edit-btn" onclick="delMasterProject(\''+mp.id+'\')" style="color:#c04040">'+t('btnDelete')+'</button>'
      +'</td>'):'')
    +'</tr>';
}

/* ── 지역 입력: 기존 국가 목록 + 직접 입력 ── */
function _mpAllRegions(){
  var out=(typeof BASE_REGIONS!=='undefined'?BASE_REGIONS.slice():[]);
  S.masterProjects.forEach(function(mp){if(mp.region&&out.indexOf(mp.region)<0)out.push(mp.region);});
  return out;
}
function _mpRegionFieldHtml(sel){
  var opts=_mpAllRegions().map(function(r){return '<option value="'+_esc(r)+'"'+(r===sel?' selected':'')+'>'+_esc(r)+'</option>';}).join('');
  return '<select id="mp_region">'+opts+'</select>'
    +'<input type="text" id="mp_region_custom" placeholder="새 지역 직접 입력 (선택)" autocomplete="off" style="margin-top:4px;width:100%">';
}
function _mpReadRegionField(){
  var custom=document.getElementById('mp_region_custom');
  var cv=custom?custom.value.trim():'';
  if(cv)return cv;
  var sel=document.getElementById('mp_region');
  return (sel&&sel.value)||'기타';
}

/* ── CRUD 모달 ── */
function openAddMasterProject(){
  mw(_mpFormHtml(null),true);
  setTimeout(function(){var el=document.getElementById('mp_customer');if(el)el.focus();},50);
}
function openEditMasterProject(id){
  var mp=S.masterProjects.find(function(m){return m.id===id;});
  if(!mp)return;
  mw(_mpFormHtml(mp),true);
}
function _mpFormHtml(mp){
  var ie=!!mp;
  function v(f){return ie?_esc(mp[f]||''):'';}
  function dateFld(id,label,val){
    return '<div class="fg" style="flex:1"><label class="fl">'+label+'</label>'
      +'<input type="date" id="'+id+'" value="'+_esc(val||'')+'"></div>';
  }
  var html='<div class="mtit">'+(ie?'프로젝트 수정':'프로젝트 등록')+'</div>';
  html+='<div style="display:flex;gap:8px">'
    +'<div class="fg" style="flex:1"><label class="fl">구분</label><input type="text" id="mp_category" value="'+v('category')+'" list="mp_category_list" autocomplete="off"></div>'
    +'<div class="fg" style="flex:1"><label class="fl">지역</label>'+_mpRegionFieldHtml(ie?mp.region:'')+'</div>'
    +'</div>';
  html+='<datalist id="mp_category_list"><option value="Repeat Order"><option value="신규 개발"><option value="기타"></datalist>';
  html+='<div style="display:flex;gap:8px">'
    +'<div class="fg" style="flex:1"><label class="fl">고객사</label><input type="text" id="mp_customer" value="'+v('customer')+'" autocomplete="off"></div>'
    +'<div class="fg" style="flex:1"><label class="fl">프로젝트</label><input type="text" id="mp_projectName" value="'+v('projectName')+'" autocomplete="off"></div>'
    +'</div>';
  html+='<div style="display:flex;gap:8px">'
    +'<div class="fg" style="flex:1"><label class="fl">생산 호기</label><input type="text" id="mp_prodUnit" value="'+v('prodUnit')+'" autocomplete="off"></div>'
    +'<div class="fg" style="flex:1"><label class="fl">고객사 호기</label><input type="text" id="mp_customerUnit" value="'+v('customerUnit')+'" autocomplete="off"></div>'
    +'<div class="fg" style="flex:1"><label class="fl">프로젝트 시리얼</label><input type="text" id="mp_serial" value="'+v('serial')+'" autocomplete="off"></div>'
    +'</div>';
  html+='<div style="font-size:11px;color:var(--tx-muted);margin:10px 0 4px;font-weight:600">본사 셋업</div>';
  html+='<div style="display:flex;gap:8px">'
    +dateFld('mp_setupStart','시작',ie?mp.setupStart:'')
    +dateFld('mp_setupEnd','종료',ie?mp.setupEnd:'')
    +'<div class="fg" style="flex:1"><label class="fl">담당자</label><input type="text" id="mp_setupManager" value="'+v('setupManager')+'" autocomplete="off"></div>'
    +'</div>';
  html+='<div style="display:flex;gap:8px">'
    +'<div class="fg" style="max-width:200px">'+dateFld('mp_shipDate','출하 일정',ie?mp.shipDate:'')+'</div>'
    +'<div class="fg" style="max-width:200px">'+dateFld('mp_customerReqShipDate','고객사 요청 출하 일정',ie?mp.customerReqShipDate:'')+'</div>'
    +'</div>';
  html+='<div class="fg"><label class="fl">상태</label><input type="text" id="mp_status" value="'+v('status')+'" list="mp_status_list" autocomplete="off"></div>';
  html+='<datalist id="mp_status_list"><option value="진행중"><option value="완료"><option value="발주 대기"><option value="LOI 접수"></datalist>';
  html+='<div class="mfoot">';
  if(ie) html+='<button class="btn red sm" onclick="delMasterProject(\''+mp.id+'\')">삭제</button>';
  html+='<button class="btn sm" onclick="cm()">취소</button>';
  html+='<button class="btn sm pri" onclick="'+(ie?('saveEditMasterProject(\''+mp.id+'\')'):'saveAddMasterProject()')+'">'+(ie?'저장':'등록')+'</button>';
  html+='</div>';
  return html;
}

function _mpReadForm(){
  function v(id){var el=document.getElementById(id);return el?el.value.trim():'';}
  return {
    category:v('mp_category'), region:_mpReadRegionField(), customer:v('mp_customer'), projectName:v('mp_projectName'),
    prodUnit:v('mp_prodUnit'), customerUnit:v('mp_customerUnit'), serial:v('mp_serial'),
    setupStart:v('mp_setupStart'), setupEnd:v('mp_setupEnd'), setupManager:v('mp_setupManager'),
    shipDate:v('mp_shipDate'), customerReqShipDate:v('mp_customerReqShipDate'),
    status:v('mp_status')
  };
}
// renderProjectsTab()은 컨트롤바(필터 옵션 등)까지 통째로 다시 그려서 스크롤 위치가 최상단으로
// 튀어버린다. 저장/삭제 후에는 방금 보던 위치 그대로 있어야 하므로 스크롤 위치를 기억했다가 복원한다.
function _mpRenderTabKeepScroll(){
  var scrollEl=document.querySelector('.pm-body-scroll');
  var scrollTop=scrollEl?scrollEl.scrollTop:0;
  renderProjectsTab();
  var newScrollEl=document.querySelector('.pm-body-scroll');
  if(newScrollEl) newScrollEl.scrollTop=scrollTop;
}
function saveAddMasterProject(){
  var f=_mpReadForm();
  if(!f.customer){alert('고객사를 입력해주세요.');return;}
  var mp=_touch(f);
  mp.id=_mpId();
  S.masterProjects.push(mp);
  saveData();cm();_mpRenderTabKeepScroll();
}
function saveEditMasterProject(id){
  var mp=S.masterProjects.find(function(m){return m.id===id;});
  if(!mp)return;
  var f=_mpReadForm();
  if(!f.customer){alert('고객사를 입력해주세요.');return;}
  Object.keys(f).forEach(function(k){mp[k]=f[k];});
  _touch(mp);
  saveData();cm();_mpRenderTabKeepScroll();
}
function delMasterProject(id){
  if(!confirm('이 프로젝트 항목을 삭제하시겠습니까?'))return;
  S.masterProjects=S.masterProjects.filter(function(m){return m.id!==id;});
  _markDeleted('masterProjects',id);
  saveData();cm();_mpRenderTabKeepScroll();
}

/* ── 엑셀 데이터 1회성 가져오기 ──
   간트 차트와는 별개다. 여기서 들여온 데이터는 프로젝트 관리 탭 안에서만 관리되며,
   간트 차트(S.schedules)에는 어떤 경우에도 자동 반영되지 않는다. */
function _mpCloneSeed(seed){
  return {
    category:seed.category,region:seed.region,customer:seed.customer,projectName:seed.projectName,
    prodUnit:seed.prodUnit,customerUnit:seed.customerUnit,serial:seed.serial,
    setupStart:seed.setupStart,setupEnd:seed.setupEnd,setupManager:seed.setupManager,
    shipDate:seed.shipDate,
    trip1Start:seed.trip1Start,trip1End:seed.trip1End,trip1Manager:seed.trip1Manager,
    trip2Start:seed.trip2Start,trip2End:seed.trip2End,trip2Manager:seed.trip2Manager,
    trip3Start:seed.trip3Start,trip3End:seed.trip3End,trip3Manager:seed.trip3Manager,
    status:seed.status, id:_mpId()
  };
}
function importExcelSeedMasterProjects(){
  if(S.masterProjects.length){alert('이미 프로젝트 데이터가 있어 가져오기를 실행할 수 없습니다.');return;}
  if(!confirm('엑셀 "프로젝트 입력" 시트의 데이터 '+_EXCEL_SEED_MASTER_PROJECTS.length+'건을 가져옵니다.\n간트 차트에는 반영되지 않습니다.\n계속할까요?'))return;
  _EXCEL_SEED_MASTER_PROJECTS.forEach(function(seed){
    var mp=_touch(_mpCloneSeed(seed));
    S.masterProjects.push(mp);
  });
  saveData();
  renderProjectsTab();
  alert('가져오기가 완료되었습니다.');
}

/* ══════════════════════════════════════════
   월별 집계 (구 "이력관리" 탭 자리) — S.masterProjects에서 매번 파생 계산
══════════════════════════════════════════ */
function renderMonthlyAggTab(){
  var sidebar=document.getElementById('visionSidebar');
  var main=document.getElementById('visionMain');
  if(sidebar)sidebar.innerHTML='';
  if(!main)return;
  var months=_mpAllMonths();
  if(!months.length){
    main.innerHTML='<div style="padding:40px;text-align:center;color:#707080">집계할 프로젝트 데이터가 없습니다. "프로젝트 관리" 탭에서 데이터를 등록하거나 가져오세요.</div>';
    return;
  }
  var html='<div style="overflow:auto;flex:1;padding:12px">';
  html+='<table class="pm-person-table"><thead><tr>'
    +'<th>'+t('maMonth')+'</th><th>'+t('maHqCount')+'</th><th>'+t('maHqList')+'</th>'
    +'<th>'+t('maSiteCount')+'</th><th>'+t('maSiteList')+'</th>'
    +'<th>'+t('maPeople')+'</th><th>'+t('maPeopleList')+'</th></tr></thead><tbody>';
  months.forEach(function(ym){
    var hq=_mpMonthGroup(ym,'hq');
    var site=_mpMonthGroup(ym,'site');
    var people=_mpMonthTravelers(ym);
    html+='<tr class="pm-person-row">'
      +'<td>'+ym+'</td>'
      +'<td>'+hq.count+'</td><td style="white-space:pre-line;font-size:11px;text-align:left">'+_esc(hq.list.join('\n'))+'</td>'
      +'<td>'+site.count+'</td><td style="white-space:pre-line;font-size:11px;text-align:left">'+_esc(site.list.join('\n'))+'</td>'
      +'<td>'+people.count+'</td><td style="white-space:pre-line;font-size:11px;text-align:left">'+_esc(people.list.join('\n'))+'</td>'
      +'</tr>';
  });
  html+='</tbody></table></div>';
  main.innerHTML=html;
}
function _mpAllMonths(){
  var min=null,max=null;
  S.masterProjects.forEach(function(mp){
    [mp.setupStart,mp.setupEnd,mp.trip1Start,mp.trip1End].forEach(function(d){
      if(!d)return;
      if(!min||d<min)min=d;
      if(!max||d>max)max=d;
    });
  });
  // 출장 인원은 간트(S.schedules) 기준이므로, 프로젝트 등록 데이터에 없는 달도 빠지지 않도록 범위에 포함시킨다
  S.schedules.forEach(function(sc){
    [sc.start,sc.end].forEach(function(d){
      if(!d)return;
      if(!min||d<min)min=d;
      if(!max||d>max)max=d;
    });
  });
  if(!min||!max)return [];
  var months=[];
  var y=parseInt(min.slice(0,4),10),m=parseInt(min.slice(5,7),10);
  var ey=parseInt(max.slice(0,4),10),em=parseInt(max.slice(5,7),10);
  while(y<ey||(y===ey&&m<=em)){
    months.push(y+'-'+String(m).padStart(2,'0'));
    m++;if(m>12){m=1;y++;}
  }
  return months;
}
function _mpMonthOverlap(ym,start,end){
  if(!start||!end)return false;
  var monthStart=ym+'-01';
  var y=parseInt(ym.slice(0,4),10),m=parseInt(ym.slice(5,7),10);
  var nextM=m+1,nextY=y;if(nextM>12){nextM=1;nextY++;}
  var monthEnd=nextY+'-'+String(nextM).padStart(2,'0')+'-01';
  return start<monthEnd&&end>=monthStart;
}
function _mpMonthGroup(ym,phase){
  var groups={};
  if(phase==='hq'){
    S.masterProjects.forEach(function(mp){
      if(!_mpMonthOverlap(ym,mp.setupStart,mp.setupEnd))return;
      var key=(mp.region||'기타')+'|'+(mp.customer||'')+'|'+(mp.projectName||'');
      groups[key]=(groups[key]||0)+1;
    });
  }else{
    // 현장 셋업: 프로젝트 등록이 아니라 간트 차트(S.schedules) 기준 — 같은 프로젝트(설비)에
    // 여러 인원이 겹쳐 출장 가도 설비 수는 프로젝트 단위로 한 번만 센다.
    var seenProj={};
    S.schedules.forEach(function(sc){
      if(!_mpMonthOverlap(ym,sc.start,sc.end))return;
      var proj=S.projects.find(function(p){return p.id===sc.projectId;});
      if(!proj||seenProj[proj.id])return;
      seenProj[proj.id]=true;
      var site=S.sites.find(function(s){return s.id===proj.siteId;});
      var region=(site&&site.country)||'기타';
      var siteName=(site&&site.name)||proj.siteId;
      var key=region+'|'+siteName+'|'+proj.name;
      groups[key]=(groups[key]||0)+1;
    });
  }
  var keys=Object.keys(groups);
  var list=keys.map(function(k,i){
    var parts=k.split('|');
    return (i+1)+'. ['+parts[0]+'] '+parts[1]+' - '+parts[2]+' '+groups[k]+'대';
  });
  return {count:keys.reduce(function(s,k){return s+groups[k];},0),list:list};
}
// 출장 인원 명단은 프로젝트 등록(trip1Manager)이 아니라 간트 차트(S.schedules)를 기준으로 집계한다.
// 완료된 일정도 포함해서 그 달과 기간이 겹치는 모든 일정의 담당자를 모은다 (sc.end는 연장분까지 반영된 최종 종료일).
function _mpMonthTravelers(ym){
  var bySite={}; // '지역|사이트' -> {이름:true,...}
  var allNames={};
  S.schedules.forEach(function(sc){
    if(sc.type!=='tech')return; // 인원 구분이 "기술"인 인원만 명단에 반영
    if(!_mpMonthOverlap(ym,sc.start,sc.end))return;
    if(!sc.name)return;
    var proj=S.projects.find(function(p){return p.id===sc.projectId;});
    var site=proj?S.sites.find(function(s){return s.id===proj.siteId;}):null;
    var region=(site&&site.country)||'기타';
    var siteName=(site&&site.name)||(proj?proj.siteId:'미지정');
    var key=region+'|'+siteName;
    if(!bySite[key]) bySite[key]={};
    bySite[key][sc.name]=true;
    allNames[sc.name]=true;
  });
  var keys=Object.keys(bySite);
  var list=keys.map(function(k,i){
    var parts=k.split('|');
    return (i+1)+'. ['+parts[0]+'] '+parts[1]+' - '+Object.keys(bySite[k]).join(', ');
  });
  return {count:Object.keys(allNames).length, list:list};
}

/* ── 엑셀 "프로젝트 입력" 시트 원본 데이터 (2026-08-31 기준 1회성 가져오기용) ── */
var _EXCEL_SEED_MASTER_PROJECTS = [{"category":"Repeat Order","region":"국내","customer":"LGIT_구미","projectName":"iSIS-NBGA","prodUnit":"생산 98호기","customerUnit":"","serial":"IP2UT0EH05","setupStart":"2026-05-01","setupEnd":"2026-05-29","setupManager":"양성호","shipDate":"2026-06-01","trip1Start":"2026-06-01","trip1End":"2026-06-22","trip1Manager":"양성호","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"완료"},{"category":"Repeat Order","region":"국내","customer":"LGIT_구미","projectName":"iPIS-590","prodUnit":"생산 29호기","customerUnit":"","serial":"IP59T0EH04","setupStart":"2026-05-29","setupEnd":"2026-06-15","setupManager":"맹준영","shipDate":"2026-06-22","trip1Start":"2026-06-22","trip1End":"2026-07-08","trip1Manager":"맹준영","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"완료"},{"category":"Repeat Order","region":"국내","customer":"LGIT_구미","projectName":"iPIS-590","prodUnit":"생산 31호기","customerUnit":"","serial":"IP59T0EI04","setupStart":"2026-08-18","setupEnd":"2026-09-21","setupManager":"맹준영","shipDate":"2026-09-22","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"국내","customer":"LGIT_구미","projectName":"iVRS-100S","prodUnit":"생산 4호기","customerUnit":"","serial":"IP2VT0EH02","setupStart":"2026-05-01","setupEnd":"2026-05-29","setupManager":"맹준영","shipDate":"2026-06-01","trip1Start":"2026-06-01","trip1End":"2026-06-15","trip1Manager":"맹준영","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"완료"},{"category":"Repeat Order","region":"국내","customer":"LGIT_구미","projectName":"iVRS-100S","prodUnit":"생산 5호기","customerUnit":"","serial":"IP2VT0EI01","setupStart":"2026-08-18","setupEnd":"2026-09-21","setupManager":"맹준영","shipDate":"2026-09-22","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"국내","customer":"LGIT_구미","projectName":"iSIS-SMTV V1(CTV)","prodUnit":"생산 66호기","customerUnit":"","serial":"IP2NT0EI09","setupStart":"2026-07-02","setupEnd":"2026-07-30","setupManager":"윤덕현, 양성호, 장원준","shipDate":"2026-07-31","trip1Start":"2026-08-03","trip1End":"2026-08-28","trip1Manager":"양성호","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"국내","customer":"LGIT_구미","projectName":"iSIS-SMTV V1(CTV)","prodUnit":"생산 67호기","customerUnit":"","serial":"IP2NT0EI10","setupStart":"2026-07-30","setupEnd":"2026-10-22","setupManager":"양성호, 윤덕현","shipDate":"2026-10-23","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"국내","customer":"LGIT_구미","projectName":"iSIS-SMTV V1(CTV)","prodUnit":"생산 85호기","customerUnit":"","serial":"IP2NT0EI28","setupStart":"2027-01-06","setupEnd":"2027-02-24","setupManager":"양성호, 외주(한빛)","shipDate":"2027-02-25","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"국내","customer":"SEMCO_세종","projectName":"iPIS-590","prodUnit":"생산 33호기","customerUnit":"","serial":"IP59T0EI06","setupStart":"2026-10-26","setupEnd":"2026-12-14","setupManager":"생산 셋업","shipDate":"2026-12-15","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"국내","customer":"SEMCO_세종","projectName":"iPIS-590","prodUnit":"생산 34호기","customerUnit":"","serial":"IP59T0EI07","setupStart":"2026-11-19","setupEnd":"2027-01-14","setupManager":"생산 셋업","shipDate":"2027-01-15","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"국내","customer":"SEMCO_세종","projectName":"iPIS-590","prodUnit":"생산 35호기","customerUnit":"","serial":"IP59T0EI08","setupStart":"2026-11-25","setupEnd":"2027-01-14","setupManager":"생산 셋업","shipDate":"2027-01-15","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"국내","customer":"SEMCO_세종","projectName":"iPIS-590","prodUnit":"생산 36호기","customerUnit":"","serial":"IP59T0EI09","setupStart":"2026-11-25","setupEnd":"2027-01-14","setupManager":"생산 셋업","shipDate":"2027-01-15","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"국내","customer":"SEMCO_세종","projectName":"iSIS-SMTV V1(NTV)","prodUnit":"생산 71호기","customerUnit":"","serial":"IP2NT0EI14","setupStart":"2026-12-04","setupEnd":"2026-12-28","setupManager":"윤재철, 외주(한빛)","shipDate":"2026-12-29","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"국내","customer":"SEMCO_세종","projectName":"iSIS-SMTV V1(NTV)","prodUnit":"생산 72호기","customerUnit":"","serial":"IP2NT0EI15","setupStart":"2026-12-04","setupEnd":"2026-12-28","setupManager":"윤재철, 외주(한빛)","shipDate":"2026-12-29","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"국내","customer":"SEMCO_세종","projectName":"iSIS-SMTV V1(NTV)","prodUnit":"생산 73호기","customerUnit":"","serial":"IP2NT0EI16","setupStart":"2026-12-14","setupEnd":"2027-04-29","setupManager":"윤재철, 외주(한빛)","shipDate":"2027-04-30","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"국내","customer":"SEMCO_세종","projectName":"iSIS-SMTV V1(NTV)","prodUnit":"생산 74호기","customerUnit":"","serial":"IP2NT0EI17","setupStart":"2026-12-29","setupEnd":"2027-04-29","setupManager":"윤재철, 외주(한빛)","shipDate":"2027-04-30","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"국내","customer":"SEMCO_세종","projectName":"iSIS-SMTV V1(NTV)","prodUnit":"생산 75호기","customerUnit":"","serial":"IP2NT0EI18","setupStart":"2027-02-26","setupEnd":"2027-04-22","setupManager":"윤재철, 외주(한빛)","shipDate":"2027-04-23","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"베트남","customer":"베트남_SEMV","projectName":"iSIS-SMTV V1(NTV)","prodUnit":"생산 106호기","customerUnit":"","serial":"IP2SP0EI03","setupStart":"2027-03-05","setupEnd":"2027-04-29","setupManager":"윤재철, 외주(한빛)","shipDate":"2027-04-30","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"국내","customer":"SEMCO_부산","projectName":"iSIS-SMTV V1(NTV)","prodUnit":"생산 107호기","customerUnit":"","serial":"IP2SP0EI04","setupStart":"2027-03-10","setupEnd":"2027-04-29","setupManager":"윤재철, 외주(한빛)","shipDate":"2027-04-30","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"국내","customer":"SEMCO_세종","projectName":"iSIS-QPM","prodUnit":"생산 25호기","customerUnit":"","serial":"IPQMT0EJ01","setupStart":"2027-04-07","setupEnd":"2027-05-27","setupManager":"윤재철, 외주(한빛)","shipDate":"2027-05-28","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"베트남","customer":"SEMV","projectName":"iSIS-QPM","prodUnit":"생산 23호기","customerUnit":"","serial":"IPQMT0EI03","setupStart":"2027-04-07","setupEnd":"2027-05-27","setupManager":"윤재철, 외주(한빛)","shipDate":"2027-05-28","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"베트남","customer":"SEMV","projectName":"iSIS-QPM","prodUnit":"생산 24호기","customerUnit":"","serial":"IPQMT0EI04","setupStart":"2027-04-07","setupEnd":"2027-05-27","setupManager":"윤재철, 외주(한빛)","shipDate":"2027-05-28","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"대만","customer":"Kinsus","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 59호기","customerUnit":"","serial":"IP2NS0EH01","setupStart":"2025-12-20","setupEnd":"2026-01-27","setupManager":"정해영, 이경호, 외주(한빛)","shipDate":"2026-01-28","trip1Start":"","trip1End":"","trip1Manager":"대만지사(아담)","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"완료"},{"category":"Repeat Order","region":"대만","customer":"Kinsus","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 70호기","customerUnit":"","serial":"IP2NT0EI13","setupStart":"2026-10-16","setupEnd":"2026-11-26","setupManager":"정해영, 이경호, 외주(한빛)","shipDate":"2026-11-27","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"대만","customer":"Kinsus","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 82호기","customerUnit":"","serial":"IP2NT0EI25","setupStart":"2026-11-05","setupEnd":"2026-12-21","setupManager":"정해영, 이경호, 외주(한빛)","shipDate":"2026-12-22","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"대만","customer":"Kinsus","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 83호기","customerUnit":"","serial":"IP2NT0EI26","setupStart":"2026-11-19","setupEnd":"2027-01-19","setupManager":"정해영, 이경호, 외주(한빛)","shipDate":"2027-01-20","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"대만","customer":"Kinsus","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 84호기","customerUnit":"","serial":"IP2NT0EI27","setupStart":"2026-11-19","setupEnd":"2027-01-19","setupManager":"정해영, 이경호, 외주(한빛)","shipDate":"2027-01-20","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"대만","customer":"Kinsus","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 108호기","customerUnit":"","serial":"","setupStart":"","setupEnd":"2027-02-23","setupManager":"","shipDate":"2027-02-24","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"대만","customer":"Kinsus","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 109호기","customerUnit":"","serial":"","setupStart":"","setupEnd":"2027-02-23","setupManager":"","shipDate":"2027-02-24","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"대만","customer":"ZDT","projectName":"iPIS-590","prodUnit":"생산 30호기","customerUnit":"","serial":"IP59T0EI03","setupStart":"2026-07-17","setupEnd":"2026-08-20","setupManager":"생산 셋업","shipDate":"2026-08-21","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"대만","customer":"ZDT","projectName":"iSIS-NBGA","prodUnit":"생산 99호기","customerUnit":"","serial":"IP2UT0EI02","setupStart":"2026-06-22","setupEnd":"2026-07-15","setupManager":"생산 셋업","shipDate":"2026-07-16","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"ZDT_SZ","projectName":"iPIS-590","prodUnit":"생산 32호기","customerUnit":"","serial":"IP59T0EI05","setupStart":"2026-10-16","setupEnd":"2026-11-30","setupManager":"생산 셋업","shipDate":"2026-12-01","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"ZDT_SZ","projectName":"iPIS-590","prodUnit":"생산 37호기","customerUnit":"","serial":"IP59T0EI10","setupStart":"2026-11-13","setupEnd":"2026-12-28","setupManager":"생산 셋업","shipDate":"2026-12-29","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"ZDT_SZ","projectName":"iSIS-QPM","prodUnit":"생산 21호기","customerUnit":"","serial":"IPQMT0EI01","setupStart":"2026-10-15","setupEnd":"2026-11-12","setupManager":"정해영","shipDate":"2026-11-13","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"ZDT_SZ","projectName":"iSIS-QPM","prodUnit":"생산 22호기","customerUnit":"","serial":"IPQMT0EI02","setupStart":"2026-10-15","setupEnd":"2026-11-12","setupManager":"정해영","shipDate":"2026-11-13","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"ZDT_SZ","projectName":"iSIS-NBGA","prodUnit":"생산 100호기","customerUnit":"","serial":"IP2UT0EI03","setupStart":"2026-11-11","setupEnd":"2026-12-21","setupManager":"생산 셋업","shipDate":"2026-12-22","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"ZDT_SZ","projectName":"iSIS-NBGA","prodUnit":"생산 101호기","customerUnit":"","serial":"IP2UT0EI04","setupStart":"2026-11-11","setupEnd":"2026-12-21","setupManager":"생산 셋업","shipDate":"2026-12-22","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"ZDT_SZ","projectName":"iSIS-NBGA","prodUnit":"생산 102호기","customerUnit":"","serial":"IP2UT0EI05","setupStart":"2026-12-03","setupEnd":"2027-01-12","setupManager":"생산 셋업","shipDate":"2027-01-13","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"ZDT_SZ","projectName":"iSIS-NBGA","prodUnit":"생산 103호기","customerUnit":"","serial":"IP2UT0EI06","setupStart":"2026-12-03","setupEnd":"2027-01-12","setupManager":"생산 셋업","shipDate":"2027-01-13","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"ZDT_SZ","projectName":"iSIS-NBGA","prodUnit":"생산 104호기","customerUnit":"","serial":"IP2UT0EI07","setupStart":"2026-12-23","setupEnd":"2027-02-02","setupManager":"생산 셋업","shipDate":"2027-02-03","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"ZDT_SZ","projectName":"iSIS-NBGA","prodUnit":"생산 105호기","customerUnit":"","serial":"IP2UT0EI08","setupStart":"2026-12-23","setupEnd":"2027-02-02","setupManager":"생산 셋업","shipDate":"2027-02-03","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"ZDT_SZ","projectName":"iSIS-SMTV V1(NTV)","prodUnit":"생산 63호기","customerUnit":"","serial":"IP2NT0EI04","setupStart":"2026-05-22","setupEnd":"2026-06-18","setupManager":"장현재, 이경호, 외주(한빛)","shipDate":"2026-06-19","trip1Start":"2026-07-19","trip1End":"2026-07-31","trip1Manager":"이경호, 중국지사(정호삼), Takewin","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"완료"},{"category":"Repeat Order","region":"중국","customer":"ZDT_SZ","projectName":"iSIS-SMTV V1(NTV)","prodUnit":"생산 64호기","customerUnit":"","serial":"IP2NT0EI07","setupStart":"2026-06-09","setupEnd":"2026-09-29","setupManager":"장현재, 이경호, 외주(한빛)","shipDate":"2026-09-30","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"AT\u0026S CQ","projectName":"iSIS-NBGA","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"Repeat Order","region":"중국","customer":"AT\u0026S CQ","projectName":"iSIS-NBGA","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"Repeat Order","region":"중국","customer":"AT\u0026S CQ","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 76호기","customerUnit":"","serial":"IP2NT0EI19","setupStart":"2026-11-12","setupEnd":"2026-12-28","setupManager":"정해영, 외주(한빛)","shipDate":"2026-12-29","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"AT\u0026S CQ","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 77호기","customerUnit":"","serial":"IP2NT0EI20","setupStart":"2026-11-12","setupEnd":"2026-12-28","setupManager":"정해영, 외주(한빛)","shipDate":"2026-12-29","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"AT\u0026S CQ","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 78호기","customerUnit":"","serial":"IP2NT0EI21","setupStart":"2026-11-26","setupEnd":"2027-01-14","setupManager":"정해영, 외주(한빛)","shipDate":"2027-01-15","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"AT\u0026S CQ","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 79호기","customerUnit":"","serial":"IP2NT0EI22","setupStart":"2026-11-26","setupEnd":"2027-01-14","setupManager":"정해영, 외주(한빛)","shipDate":"2027-01-15","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"AT\u0026S CQ","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 80호기","customerUnit":"","serial":"IP2NT0EI23","setupStart":"2026-12-10","setupEnd":"2027-01-28","setupManager":"정해영, 외주(한빛)","shipDate":"2027-01-29","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"AT\u0026S CQ","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 81호기","customerUnit":"","serial":"IP2NT0EI24","setupStart":"2026-12-10","setupEnd":"2027-01-28","setupManager":"정해영, 외주(한빛)","shipDate":"2027-01-29","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"AKM","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 86호기","customerUnit":"","serial":"IP2NT0EI29","setupStart":"2026-10-26","setupEnd":"2026-11-27","setupManager":"BU3, 정해영, 외주(한빛)","shipDate":"2026-11-30","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"AKM","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 87호기","customerUnit":"","serial":"IP2NT0EJ01","setupStart":"2026-12-23","setupEnd":"2027-01-28","setupManager":"BU3","shipDate":"2027-01-29","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"AKM","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 88호기","customerUnit":"","serial":"IP2NT0EJ02","setupStart":"2026-12-23","setupEnd":"2027-01-28","setupManager":"BU3","shipDate":"2027-01-29","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"AKM","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 89호기","customerUnit":"","serial":"IP2NT0EJ03","setupStart":"2027-01-08","setupEnd":"2027-02-25","setupManager":"BU3","shipDate":"2027-02-26","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"AKM","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 90호기","customerUnit":"","serial":"IP2NT0EJ04","setupStart":"2027-01-08","setupEnd":"2027-02-25","setupManager":"BU3","shipDate":"2027-02-26","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"AKM","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 91호기","customerUnit":"","serial":"IP2NT0EJ05","setupStart":"2027-02-03","setupEnd":"2027-03-25","setupManager":"BU3","shipDate":"2027-03-26","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"AKM","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 92호기","customerUnit":"","serial":"IP2NT0EJ06","setupStart":"2027-02-03","setupEnd":"2027-03-25","setupManager":"BU3","shipDate":"2027-03-26","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"AKM","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 93호기","customerUnit":"","serial":"IP2NT0EJ07","setupStart":"2027-03-05","setupEnd":"2027-04-22","setupManager":"BU3","shipDate":"2027-04-23","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"AKM","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 94호기","customerUnit":"","serial":"IP2NT0EJ08","setupStart":"2027-03-05","setupEnd":"2027-04-22","setupManager":"BU3","shipDate":"2027-04-23","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"AKM","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 95호기","customerUnit":"","serial":"IP2NT0EJ09","setupStart":"2027-03-31","setupEnd":"2027-05-20","setupManager":"BU3","shipDate":"2027-05-21","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"AKM","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 96호기","customerUnit":"","serial":"IP2NT0EJ10","setupStart":"2027-03-31","setupEnd":"2027-05-20","setupManager":"BU3","shipDate":"2027-05-21","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"AKM","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 97호기","customerUnit":"","serial":"IP2NT0EJ11","setupStart":"2027-04-28","setupEnd":"2027-06-17","setupManager":"BU3","shipDate":"2027-06-18","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"AKM","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 98호기","customerUnit":"","serial":"IP2NT0EJ12","setupStart":"2027-04-28","setupEnd":"2027-06-17","setupManager":"BU3","shipDate":"2027-06-18","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"AKM","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 99호기","customerUnit":"","serial":"IP2NT0EJ13","setupStart":"2027-05-28","setupEnd":"2027-07-15","setupManager":"BU3","shipDate":"2027-07-16","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"AKM","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 100호기","customerUnit":"","serial":"IP2NT0EJ14","setupStart":"2027-05-28","setupEnd":"2027-07-15","setupManager":"BU3","shipDate":"2027-07-16","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"AKM","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 101호기","customerUnit":"","serial":"IP2NT0EJ15","setupStart":"2027-06-25","setupEnd":"2027-08-12","setupManager":"BU3","shipDate":"2027-08-13","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"AKM","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 102호기","customerUnit":"","serial":"IP2NT0EJ16","setupStart":"2027-06-25","setupEnd":"2027-08-12","setupManager":"BU3","shipDate":"2027-08-13","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"AKM","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 103호기","customerUnit":"","serial":"IP2NT0EJ17","setupStart":"2027-07-23","setupEnd":"2027-09-09","setupManager":"BU3","shipDate":"2027-09-10","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"AKM","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 104호기","customerUnit":"","serial":"IP2NT0EJ18","setupStart":"2027-07-23","setupEnd":"2027-09-09","setupManager":"BU3","shipDate":"2027-09-10","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"SCC","projectName":"iSIS-NBGA","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"Repeat Order","region":"중국","customer":"SCC","projectName":"iSIS-NBGA","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"Repeat Order","region":"중국","customer":"SCC","projectName":"iSIS-NBGA","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"Repeat Order","region":"중국","customer":"SCC","projectName":"iSIS-NBGA","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"Repeat Order","region":"중국","customer":"SCC","projectName":"iPIS-580","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"Repeat Order","region":"중국","customer":"SCC","projectName":"iPIS-580","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"Repeat Order","region":"중국","customer":"SCC","projectName":"iPIS-580","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"Repeat Order","region":"중국","customer":"Fastprint","projectName":"iSIS-NBGA","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"2026-10-01","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"LOI 접수"},{"category":"Repeat Order","region":"중국","customer":"Fastprint","projectName":"iSIS-NBGA","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"2027-06-01","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"LOI 접수"},{"category":"Repeat Order","region":"중국","customer":"Fastprint","projectName":"iSIS-NBGA","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"2027-07-01","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"LOI 접수"},{"category":"Repeat Order","region":"중국","customer":"Fastprint","projectName":"iSIS-NBGA","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"2027-09-01","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"LOI 접수"},{"category":"Repeat Order","region":"중국","customer":"Fastprint","projectName":"iSIS-NBGA","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"2027-09-01","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"LOI 접수"},{"category":"Repeat Order","region":"중국","customer":"Fastprint","projectName":"iSIS-NBGA","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"2027-12-01","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"LOI 접수"},{"category":"Repeat Order","region":"중국","customer":"Fastprint","projectName":"iSIS-NBGA","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"Repeat Order","region":"중국","customer":"Fastprint","projectName":"iSIS-NBGA","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"Repeat Order","region":"중국","customer":"Fastprint","projectName":"iSIS-NBGA","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"Repeat Order","region":"중국","customer":"Fastprint","projectName":"iSIS-NBGA","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"Repeat Order","region":"중국","customer":"Fastprint","projectName":"iPIS-580","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"2027-09-01","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"LOI 접수"},{"category":"Repeat Order","region":"중국","customer":"Fastprint","projectName":"iPIS-580","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"2027-12-01","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"LOI 접수"},{"category":"Repeat Order","region":"중국","customer":"Fastprint","projectName":"iPIS-580","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"Repeat Order","region":"말레이시아","customer":"AT\u0026S_P5","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"","customerUnit":"NTV307","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"Techsense","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"완료"},{"category":"Repeat Order","region":"말레이시아","customer":"AT\u0026S_P5","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"","customerUnit":"NTV308","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"Repeat Order","region":"말레이시아","customer":"AT\u0026S_P5","projectName":"iSIS-SMTV V0 (BTV)","prodUnit":"","customerUnit":"BTV502","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"Techsense","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"완료"},{"category":"Repeat Order","region":"말레이시아","customer":"AT\u0026S_P5","projectName":"iSIS-SMTV V0(BTV)","prodUnit":"생산 68호기","customerUnit":"","serial":"IP2NT0EI11","setupStart":"2026-07-03","setupEnd":"2026-07-24","setupManager":"정해영, 외주(한빛)","shipDate":"2026-07-27","trip1Start":"","trip1End":"","trip1Manager":"Techsense","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"완료"},{"category":"Repeat Order","region":"말레이시아","customer":"AT\u0026S_P5","projectName":"iSIS-SMTV V0(BTV)","prodUnit":"생산 69호기","customerUnit":"","serial":"IP2NT0EI12","setupStart":"2026-07-17","setupEnd":"2026-08-27","setupManager":"정해영, 이경호, 외주(한빛)","shipDate":"2026-08-28","trip1Start":"","trip1End":"","trip1Manager":"Techsense","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"미국","customer":"Space X","projectName":"iSIS-SMTV V1(NTV)","prodUnit":"생산 105호기","customerUnit":"","serial":"IP2NT0EJ19","setupStart":"2026-12-16","setupEnd":"2027-01-21","setupManager":"정해영, 이윤경, 외주(한빛)","shipDate":"2027-01-22","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"신규 개발","region":"일본","customer":"IBIDEN","projectName":"iSIS-NTV DI","prodUnit":"생산 1호기","customerUnit":"","serial":"IP2NT0EI01","setupStart":"2026-02-20","setupEnd":"2026-04-03","setupManager":"김형진, 황의송, 윤덕현","shipDate":"2026-04-06","trip1Start":"2026-04-15","trip1End":"2026-06-22","trip1Manager":"김형진, 황의송, 윤덕현","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"완료"},{"category":"신규 개발","region":"일본","customer":"TOPPAN","projectName":"iSIS-FP3D","prodUnit":"생산 3호기","customerUnit":"","serial":"IPQFT0EI01","setupStart":"2026-08-01","setupEnd":"2026-10-29","setupManager":"윤재철, 장원준","shipDate":"2026-10-30","trip1Start":"","trip1End":"","trip1Manager":"장원준","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"신규 개발","region":"일본","customer":"TOPPAN","projectName":"iSIS-LTV","prodUnit":"생산 1호기","customerUnit":"","serial":"IP2LT0EI01","setupStart":"2026-03-23","setupEnd":"2026-06-29","setupManager":"김형진","shipDate":"2026-06-30","trip1Start":"2026-07-09","trip1End":"2026-09-04","trip1Manager":"김형진","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"신규 개발","region":"일본","customer":"SHINKO","projectName":"iSIS-NTV DS","prodUnit":"생산 1호기","customerUnit":"","serial":"IP2NT0EI02","setupStart":"2026-03-12","setupEnd":"2026-07-01","setupManager":"윤재철, 윤덕현","shipDate":"2026-07-02","trip1Start":"2026-07-12","trip1End":"2026-09-04","trip1Manager":"윤재철, 윤덕현","trip2Start":"2026-09-01","trip2End":"2026-09-23","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"신규 개발","region":"일본","customer":"SHINKO","projectName":"iSIS-NTV DS","prodUnit":"생산 2호기","customerUnit":"","serial":"IP2NT0EI03","setupStart":"2026-03-12","setupEnd":"2026-07-01","setupManager":"윤재철, 윤덕현","shipDate":"2026-07-02","trip1Start":"2026-07-12","trip1End":"2026-09-04","trip1Manager":"윤재철","trip2Start":"2026-09-01","trip2End":"2026-09-23","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"신규 개발","region":"대만","customer":"Nanya_SL","projectName":"iSIS-LTV100","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"신규 개발","region":"대만","customer":"Nanya_SL","projectName":"iSIS-HL1000","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"신규 개발","region":"대만","customer":"UMTC YM2","projectName":"iSIS-LTV100","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"신규 개발","region":"대만","customer":"UMTC YM2","projectName":"iSIS-LTV100","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"신규 개발","region":"대만","customer":"UMTC YM2","projectName":"iSIS-LTV100","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"신규 개발","region":"대만","customer":"UMTC_KF2","projectName":"iSIS-LTV200","prodUnit":"생산 1호기","customerUnit":"","serial":"IP2LT0EI03","setupStart":"2026-07-16","setupEnd":"2026-11-27","setupManager":"정해영, 이주헌","shipDate":"2026-11-30","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"신규 개발","region":"대만","customer":"UMTC_KF2","projectName":"iSIS-LTV200","prodUnit":"생산 2호기","customerUnit":"","serial":"IP2LT0EI06","setupStart":"2026-10-23","setupEnd":"2026-12-18","setupManager":"정해영, 외주(한빛)","shipDate":"2026-12-21","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"신규 개발","region":"대만","customer":"UMTC_KF2","projectName":"iSIS-LTV200","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"신규 개발","region":"대만","customer":"UMTC_KF2","projectName":"iSIS-LTV200","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"신규 개발","region":"중국","customer":"Shenghong; (Victory Giant)","projectName":"QPM 대여 건","prodUnit":"","customerUnit":"","serial":"","setupStart":"2026-01-01","setupEnd":"2026-03-08","setupManager":"장현재, 이경호","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"완료"},{"category":"신규 개발","region":"중국","customer":"Shenghong; (Victory Giant)","projectName":"iSIS-LTV100","prodUnit":"생산 2호기","customerUnit":"","serial":"IP2LT0EI02","setupStart":"2026-06-24","setupEnd":"2026-09-14","setupManager":"황의송","shipDate":"2026-09-15","trip1Start":"","trip1End":"","trip1Manager":"황의송","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"신규 개발","region":"중국","customer":"ZDT_SZ","projectName":"iSIS-LTV100","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"신규 개발","region":"중국","customer":"ZDT_SZ","projectName":"iPIS-HL1000","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"신규 개발","region":"중국","customer":"ZDT_HA","projectName":"iSIS-LTV100","prodUnit":"생산 1호기","customerUnit":"","serial":"IP2LT0EH01","setupStart":"2026-06-10","setupEnd":"2026-06-29","setupManager":"장현재, 이경호","shipDate":"2026-06-30","trip1Start":"2026-08-30","trip1End":"2026-11-27","trip1Manager":"이경호","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"신규 개발","region":"중국","customer":"ZDT_HA","projectName":"iSIS-LTV100","prodUnit":"생산 3호기","customerUnit":"","serial":"IP2LT0EI04","setupStart":"2026-06-30","setupEnd":"2026-08-27","setupManager":"장현재, 이경호","shipDate":"2026-08-28","trip1Start":"2026-08-30","trip1End":"2026-11-27","trip1Manager":"이경호","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"신규 개발","region":"중국","customer":"ZDT_HA","projectName":"iPIS-HL1000","prodUnit":"생산 1호기","customerUnit":"","serial":"IPHLT0EH02","setupStart":"2026-06-16","setupEnd":"2026-06-29","setupManager":"장현재, 이경호","shipDate":"2026-06-30","trip1Start":"2026-09-02","trip1End":"2026-11-27","trip1Manager":"이승진, 장현재","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"신규 개발","region":"중국","customer":"ZDT_HA","projectName":"iPIS-HL1000","prodUnit":"생산 2호기","customerUnit":"","serial":"IPHLT0EI01","setupStart":"2026-06-30","setupEnd":"2026-08-27","setupManager":"장현재, 이경호","shipDate":"2026-08-28","trip1Start":"2026-09-02","trip1End":"2026-11-27","trip1Manager":"이승진, 장현재","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"신규 개발","region":"싱가폴","customer":"Broadcom","projectName":"iSIS-FP3D","prodUnit":"생산 1호기","customerUnit":"","serial":"IPQFS0EI01","setupStart":"2026-02-13","setupEnd":"2026-06-04","setupManager":"장현재","shipDate":"2026-06-05","trip1Start":"2026-06-15","trip1End":"2026-07-10","trip1Manager":"장현재","trip2Start":"2026-09-27","trip2End":"2026-10-08","trip2Manager":"정해영","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"신규 개발","region":"태국","customer":"DTMC","projectName":"iSIS-LTV100","prodUnit":"생산 4호기","customerUnit":"","serial":"IP2LT0EI05","setupStart":"2026-09-10","setupEnd":"2026-11-05","setupManager":"김형진","shipDate":"2026-11-06","trip1Start":"","trip1End":"","trip1Manager":"김형진","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"신규 개발","region":"태국","customer":"DTMC","projectName":"iPIS-HL1000","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"신규 개발","region":"베트남","customer":"SEMV","projectName":"iSIS-LTV300","prodUnit":"생산 1호기","customerUnit":"","serial":"IP2LT0EI07","setupStart":"2027-03-19","setupEnd":"2027-05-27","setupManager":"윤재철, 외주(한빛)","shipDate":"2027-05-28","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"신규 개발","region":"베트남","customer":"SEMV","projectName":"iSIS-LTV300","prodUnit":"생산 2호기","customerUnit":"","serial":"IP2LT0EI08","setupStart":"2027-03-19","setupEnd":"2027-05-27","setupManager":"윤재철, 외주(한빛)","shipDate":"2027-05-28","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"신규 개발","region":"베트남","customer":"SEMV","projectName":"iSIS-LTV300","prodUnit":"생산 3호기","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"신규 개발","region":"베트남","customer":"SEMV","projectName":"iSIS-LTV300","prodUnit":"생산 4호기","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"신규 개발","region":"베트남","customer":"SEMV","projectName":"iSIS-LTV300","prodUnit":"생산 5호기","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"신규 개발","region":"베트남","customer":"SEMV","projectName":"iSIS-LTV300","prodUnit":"생산 6호기","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"신규 개발","region":"베트남","customer":"SEMV","projectName":"iSIS-LTV300","prodUnit":"생산 7호기","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"신규 개발","region":"베트남","customer":"SEMV","projectName":"iSIS-LTV300","prodUnit":"생산 8호기","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"신규 개발","region":"베트남","customer":"SEMV","projectName":"iSIS-LTV300","prodUnit":"생산 9호기","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"신규 개발","region":"베트남","customer":"SEMV","projectName":"iSIS-LTV300","prodUnit":"생산 10호기","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"신규 개발","region":"베트남","customer":"SEMV","projectName":"iSIS-LTV300","prodUnit":"생산 11호기","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"신규 개발","region":"베트남","customer":"SEMV","projectName":"iSIS-LTV300","prodUnit":"생산 12호기","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"신규 개발","region":"베트남","customer":"SEMV","projectName":"iSIS-LTV300","prodUnit":"생산 13호기","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"신규 개발","region":"베트남","customer":"SEMV","projectName":"iPIS-HL1000(SE)","prodUnit":"생산 1호기","customerUnit":"","serial":"HL01TOEI01","setupStart":"2027-03-19","setupEnd":"2027-05-27","setupManager":"윤재철, 외주(한빛)","shipDate":"2027-05-28","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"신규 개발","region":"베트남","customer":"SEMV","projectName":"iPIS-HL1000(SE)","prodUnit":"생산 2호기","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"신규 개발","region":"베트남","customer":"SEMV","projectName":"iPIS-HL1000(SE)","prodUnit":"생산 3호기","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"신규 개발","region":"베트남","customer":"SEMV","projectName":"iPIS-HL1000(SE)","prodUnit":"생산 4호기","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"기타","region":"국내","customer":"AIT▶LGIT_구미","projectName":"iSIS-NBGA_현장 1호기 이설 셋업","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"2026-09-14","trip1End":"2026-10-08","trip1Manager":"양성호, 외주(한빛)","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"기타","region":"국내","customer":"AIT▶LGIT_구미","projectName":"iSIS-NBGA_현장 2호기 이설 셋업","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"2026-08-18","trip1End":"2026-09-04","trip1Manager":"양성호, 외주(한빛)","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"기타","region":"국내","customer":"AIT▶LGIT_구미","projectName":"iSIS-NBGA_현장 3호기 이설 셋업","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"2026-07-20","trip1End":"2026-08-07","trip1Manager":"양성호","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"완료"},{"category":"기타","region":"국내","customer":"AIT▶LGIT_구미","projectName":"iPIS-590_현장 1호기 개조+이설 셋업","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"2026-09-14","trip1End":"2026-10-08","trip1Manager":"맹준영, 외주(한빛)","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"기타","region":"국내","customer":"AIT▶LGIT_구미","projectName":"iPIS-590_현장 2호기 개조+이설 셋업","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"2026-08-18","trip1End":"2026-09-04","trip1Manager":"맹준영, 외주(한빛)","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"기타","region":"국내","customer":"AIT▶LGIT_구미","projectName":"iPIS-590_현장 3호기 개조+이설 셋업","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"2026-07-20","trip1End":"2026-08-07","trip1Manager":"맹준영","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"완료"},{"category":"기타","region":"국내","customer":"AIT▶LGIT_구미","projectName":"iVRS-100S_현장 1호기 개조+이설 셋업","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"2026-09-14","trip1End":"2026-10-08","trip1Manager":"맹준영, 외주(한빛)","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"기타","region":"국내","customer":"AIT▶LGIT_구미","projectName":"iVRS-100S_현장 2호기 개조+이설 셋업","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"2026-08-18","trip1End":"2026-09-04","trip1Manager":"맹준영, 외주(한빛)","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"기타","region":"국내","customer":"AIT▶LGIT_구미","projectName":"iVRS-100S_현장 3호기 개조+이설 셋업","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"2026-07-20","trip1End":"2026-08-07","trip1Manager":"맹준영","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"완료"},{"category":"기타","region":"국내","customer":"AIT▶LGIT_구미","projectName":"iSIS-SMTV (NTV)_현장 1호기 이설 셋업","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"2026-06-01","trip1End":"2026-06-15","trip1Manager":"양성호","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"완료"},{"category":"기타","region":"국내","customer":"SEMCO_부산","projectName":"iSIS-SMTV(CTV) Multi Sorter 기능 개선","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"기타","region":"국내","customer":"SEMCO_부산","projectName":"iSIS-NBGA Multi Sorter 기능 개선","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"기타","region":"국내","customer":"SEMCO_부산","projectName":"iSIS-NBGA 제품 들뜸 감지 기능 적용","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"기타","region":"베트남","customer":"SEMV","projectName":"iSIS-NBGA Thick Tray 대응 개조","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"2026-05-08","trip1End":"2026-06-01","trip1Manager":"장원준","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"완료"},{"category":"기타","region":"베트남","customer":"SEMV","projectName":"iPIS-590 Thick Tray 대응 개조","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"2026-05-08","trip1End":"2026-05-29","trip1Manager":"맹준영","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"완료"},{"category":"기타","region":"대만","customer":"UMTC YM","projectName":"iPIS-580M Large PKG 개조","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"2026-09-03","trip1End":"2026-09-25","trip1Manager":"이주헌","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"기타","region":"대만","customer":"UMTC YM","projectName":"VRS-100M Large PKG 개조","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"2026-09-17","trip1End":"2026-10-09","trip1Manager":"이주헌","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"기타","region":"대만","customer":"UMTC YM","projectName":"VRS-100M Large PKG 개조","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"2026-10-01","trip1End":"2026-10-23","trip1Manager":"이주헌","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"기타","region":"대만","customer":"UMTC YM","projectName":"iSIS-SMTV V3(NTV) Large PKG 개조","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"기타","region":"대만","customer":"UMTC YM","projectName":"iSIS-MPSI Demo","prodUnit":"생산 1호기","customerUnit":"","serial":"","setupStart":"2026-07-13","setupEnd":"2026-08-10","setupManager":"이주헌","shipDate":"2026-08-11","trip1Start":"2026-08-19","trip1End":"2026-10-30","trip1Manager":"이주헌, 대만지사(빈센트)","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"기타","region":"말레이시아","customer":"AT\u0026S P5","projectName":"iSIS-SMTV V1(#42_대여 설비); Large PKG 개조 + 셋업","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"2026-06-01","trip1End":"2026-07-01","trip1Manager":"이주헌","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"완료"},{"category":"기타","region":"오스트리아","customer":"AT\u0026S_Hub","projectName":"iSIS-NBGA_ 현장 3호기 이설 셋업; AT\u0026S_CQ(China) ▶ AT\u0026S_Hub(Austria)","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"2026-06-22","trip1End":"2026-07-08","trip1Manager":"황의송","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"완료"}];