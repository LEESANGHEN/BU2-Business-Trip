/* ══════════════════════════════════════════
   프로젝트 관리 (마스터 프로젝트 목록) — projects.js
   BU2 "프로젝트 입력" 엑셀을 대체하는 탭.
   1차 출장 일정이 채워지면 간트 차트에 자동 등록된다(최초 1회, 이후 간트 차트에서 자유롭게
   추가/수정 가능 — 마스터 행을 다시 고쳐도 이미 연동된 일정을 되돌려 덮어쓰지 않는다).
══════════════════════════════════════════ */

var _mpSearch='';
var _mpFilterRegion='all';
var _mpFilterStatus='all';
var _mpSortKey='customer';
var _mpSortAsc=true;

function _mpId(){ return genId('mp',S.masterProjects); }

/* ── 목록 탭 렌더 ── */
function renderProjectsTab(){
  var wrap=document.getElementById('mpWrap');
  if(!wrap) return;
  var html='<div class="pm-fixed-header">';
  html+='<div class="pm-ctrl-bar" id="mpCtrlBar">';
  html+='<div class="pm-ctrl-group">';
  html+='<span style="font-size:11px;color:#666">🔍</span>';
  html+='<input class="pm-search" id="mpSearchInp" type="text" placeholder="고객사/프로젝트 검색..." autocomplete="off" oninput="setMpSearch(this.value)" value="'+_esc(_mpSearch)+'">';
  html+='</div>';
  html+='<div class="pm-ctrl-sep"></div>';
  html+='<div class="pm-ctrl-group">';
  html+='<span style="font-size:10px;color:#555">지역</span>';
  html+='<select id="mpRegionSel" onchange="setMpRegionFilter(this.value)">'+_mpRegionFilterOpts()+'</select>';
  html+='</div>';
  html+='<div class="pm-ctrl-sep"></div>';
  html+='<div class="pm-ctrl-group">';
  html+='<span style="font-size:10px;color:#555">상태</span>';
  html+='<select id="mpStatusSel" onchange="setMpStatusFilter(this.value)">'+_mpStatusFilterOpts()+'</select>';
  html+='</div>';
  html+='<div style="flex:1"></div>';
  if(!S.masterProjects.length){
    html+='<button class="btn warn sm" onclick="importExcelSeedMasterProjects()">엑셀 데이터 가져오기 (최초 1회)</button>';
  }
  html+='<button class="btn pri sm" onclick="openAddMasterProject()">+ 프로젝트 등록</button>';
  html+='</div>';
  html+='</div>';
  html+='<div class="pm-body-scroll"><div id="mpBody"></div></div>';
  wrap.innerHTML=html;
  renderProjectsBody();
}

function setMpSearch(v){_mpSearch=v.trim().toLowerCase();renderProjectsBody();}
function setMpRegionFilter(v){_mpFilterRegion=v;renderProjectsBody();}
function setMpStatusFilter(v){_mpFilterStatus=v;renderProjectsBody();}
function setMpSort(key){
  if(_mpSortKey===key)_mpSortAsc=!_mpSortAsc;
  else{_mpSortKey=key;_mpSortAsc=true;}
  renderProjectsBody();
}

function _mpRegionFilterOpts(){
  var regions=[];
  S.masterProjects.forEach(function(mp){if(mp.region&&regions.indexOf(mp.region)<0)regions.push(mp.region);});
  (typeof BASE_REGIONS!=='undefined'?BASE_REGIONS:[]).forEach(function(r){if(regions.indexOf(r)<0)regions.push(r);});
  var html='<option value="all"'+(_mpFilterRegion==='all'?' selected':'')+'>전체</option>';
  regions.forEach(function(r){html+='<option value="'+_esc(r)+'"'+(_mpFilterRegion===r?' selected':'')+'>'+_esc(r)+'</option>';});
  return html;
}
function _mpStatusFilterOpts(){
  var statuses=[];
  S.masterProjects.forEach(function(mp){if(mp.status&&statuses.indexOf(mp.status)<0)statuses.push(mp.status);});
  var html='<option value="all"'+(_mpFilterStatus==='all'?' selected':'')+'>전체</option>';
  statuses.forEach(function(s){html+='<option value="'+_esc(s)+'"'+(_mpFilterStatus===s?' selected':'')+'>'+_esc(s)+'</option>';});
  return html;
}

function renderProjectsBody(){
  var body=document.getElementById('mpBody');
  if(!body)return;
  var rows=S.masterProjects.filter(function(mp){
    if(_mpFilterRegion!=='all'&&(mp.region||'기타')!==_mpFilterRegion)return false;
    if(_mpFilterStatus!=='all'&&(mp.status||'')!==_mpFilterStatus)return false;
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
    return _mpSortAsc?v:-v;
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
  html+=thS('category','구분')+thS('region','지역')+thS('customer','고객사')+thS('projectName','프로젝트');
  html+='<th>생산/고객사 호기</th>';
  html+=thS('setupStart','셋업 기간');
  html+='<th>출장(간트)</th>';
  html+=thS('status','상태');
  html+='<th>관리</th>';
  html+='</tr></thead><tbody>';
  rows.forEach(function(mp){html+=renderProjectRow(mp);});
  html+='</tbody></table>';
  return html;
}

function _mpTripSummary(mp){
  if(!mp.trip1Start||!mp.trip1End) return '<span style="color:#707080">미등록</span>';
  var lastEnd=mp.trip3End||mp.trip2End||mp.trip1End;
  var lbl=fmtFull(mp.trip1Start)+' ~ '+fmtFull(lastEnd);
  var badge=mp.scheduleId?' <span class="eq-type-badge" style="background:#1a7a3a">간트 연동됨</span>':'';
  return '<span'+(mp.scheduleId?' onclick="event.stopPropagation();gotoMasterProjectSchedule(\''+mp.id+'\')" style="cursor:pointer;text-decoration:underline"':'')+'>'+lbl+'</span>'+badge;
}

function renderProjectRow(mp){
  var setupLbl=(mp.setupStart&&mp.setupEnd)?(fmtFull(mp.setupStart)+' ~ '+fmtFull(mp.setupEnd)):'-';
  var unitLbl=[mp.prodUnit,mp.customerUnit].filter(Boolean).join(' / ');
  return '<tr class="pm-person-row" style="cursor:pointer" onclick="openEditMasterProject(\''+mp.id+'\')">'
    +'<td>'+_esc(mp.category||'')+'</td>'
    +'<td>'+_esc(mp.region||'')+'</td>'
    +'<td>'+_esc(mp.customer||'')+'</td>'
    +'<td>'+_esc(mp.projectName||'')+'</td>'
    +'<td>'+_esc(unitLbl)+'</td>'
    +'<td>'+setupLbl+'</td>'
    +'<td>'+_mpTripSummary(mp)+'</td>'
    +'<td>'+_esc(mp.status||'')+'</td>'
    +'<td onclick="event.stopPropagation()">'
    +'<button class="eq-item-edit-btn" onclick="openEditMasterProject(\''+mp.id+'\')">수정</button> '
    +'<button class="eq-item-edit-btn" onclick="delMasterProject(\''+mp.id+'\')" style="color:#c04040">삭제</button>'
    +'</td>'
    +'</tr>';
}

function gotoMasterProjectSchedule(mpId){
  var mp=S.masterProjects.find(function(m){return m.id===mpId;});
  if(!mp||!mp.scheduleId)return;
  var sc=S.schedules.find(function(s){return s.id===mp.scheduleId;});
  if(!sc){alert('연동된 간트 일정을 찾을 수 없습니다(간트 차트에서 삭제되었을 수 있음).');return;}
  var proj=S.projects.find(function(p){return p.id===sc.projectId;});
  switchTab('gantt');
  if(proj){S.filterSite=proj.siteId;S.filterSites=[];renderAll();}
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
  var locked=ie&&mp.scheduleId;
  function dateFld(id,label,val,disabled){
    return '<div class="fg" style="flex:1"><label class="fl">'+label+'</label>'
      +'<input type="text" id="'+id+'" value="'+_esc(val||'')+'" maxlength="10" placeholder="YYYY-MM-DD" oninput="fmtDateInput(this)" autocomplete="off"'+(disabled?' disabled':'')+'></div>';
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
  html+='<div class="fg" style="max-width:200px">'+dateFld('mp_shipDate','출하 일정',ie?mp.shipDate:'')+'</div>';
  [1,2,3].forEach(function(n){
    html+='<div style="font-size:11px;color:var(--tx-muted);margin:10px 0 4px;font-weight:600">'+n+'차 출장</div>';
    html+='<div style="display:flex;gap:8px">'
      +dateFld('mp_trip'+n+'Start','시작',ie?mp['trip'+n+'Start']:'',locked)
      +dateFld('mp_trip'+n+'End','종료',ie?mp['trip'+n+'End']:'',locked)
      +'<div class="fg" style="flex:1"><label class="fl">담당자</label><input type="text" id="mp_trip'+n+'Manager" value="'+v('trip'+n+'Manager')+'" autocomplete="off"'+(locked?' disabled':'')+'></div>'
      +'</div>';
  });
  if(locked){
    html+='<div style="font-size:11px;color:#1a7a3a;margin-bottom:8px">✓ 간트 차트에 일정이 이미 연동되어 있습니다. 출장 날짜/담당자 수정은 간트 차트에서 해주세요.</div>';
  }
  html+='<div class="fg"><label class="fl">상태</label><input type="text" id="mp_status" value="'+v('status')+'" list="mp_status_list" autocomplete="off"></div>';
  html+='<datalist id="mp_status_list"><option value="완료"><option value="발주 대기"><option value="LOI 접수"></datalist>';
  html+='<div class="mfoot">';
  if(ie) html+='<button class="btn red sm" onclick="delMasterProject(\''+mp.id+'\')">삭제</button>';
  html+='<button class="btn sm" onclick="cm()">취소</button>';
  html+='<button class="btn sm pri" onclick="'+(ie?('saveEditMasterProject(\''+mp.id+'\')'):'saveAddMasterProject()')+'">'+(ie?'저장':'등록')+'</button>';
  html+='</div>';
  return html;
}

function _mpReadForm(locked){
  function v(id){var el=document.getElementById(id);return el?el.value.trim():'';}
  var f={
    category:v('mp_category'), region:_mpReadRegionField(), customer:v('mp_customer'), projectName:v('mp_projectName'),
    prodUnit:v('mp_prodUnit'), customerUnit:v('mp_customerUnit'), serial:v('mp_serial'),
    setupStart:v('mp_setupStart'), setupEnd:v('mp_setupEnd'), setupManager:v('mp_setupManager'),
    shipDate:v('mp_shipDate'),
    status:v('mp_status')
  };
  if(!locked){
    f.trip1Start=v('mp_trip1Start');f.trip1End=v('mp_trip1End');f.trip1Manager=v('mp_trip1Manager');
    f.trip2Start=v('mp_trip2Start');f.trip2End=v('mp_trip2End');f.trip2Manager=v('mp_trip2Manager');
    f.trip3Start=v('mp_trip3Start');f.trip3End=v('mp_trip3End');f.trip3Manager=v('mp_trip3Manager');
  }
  return f;
}
function saveAddMasterProject(){
  var f=_mpReadForm(false);
  if(!f.customer){alert('고객사를 입력해주세요.');return;}
  var mp=_touch(f);
  mp.id=_mpId();
  mp.scheduleId=null;
  S.masterProjects.push(mp);
  _syncMasterProjectToGantt(mp);
  saveData();cm();renderProjectsTab();
}
function saveEditMasterProject(id){
  var mp=S.masterProjects.find(function(m){return m.id===id;});
  if(!mp)return;
  var f=_mpReadForm(!!mp.scheduleId);
  if(!f.customer){alert('고객사를 입력해주세요.');return;}
  Object.keys(f).forEach(function(k){mp[k]=f[k];});
  _touch(mp);
  _syncMasterProjectToGantt(mp);
  saveData();cm();renderProjectsTab();
}
function delMasterProject(id){
  if(!confirm('이 프로젝트 항목을 삭제하시겠습니까?\n(간트 차트에 이미 연동된 일정은 함께 삭제되지 않습니다)'))return;
  S.masterProjects=S.masterProjects.filter(function(m){return m.id!==id;});
  _markDeleted('masterProjects',id);
  saveData();cm();renderProjectsTab();
}

/* ── 간트 차트 자동 연동 (최초 1회만) ── */
var _MP_SITE_PALETTE=['#5a7ac9','#c98a5a','#5ac98f','#c95a8a','#8a5ac9','#c9c05a','#5ac9c0','#c95a5a'];
function _mpFindOrCreateGroup(){
  var g=S.groups.find(function(g){return g.name==='BU2 프로젝트';});
  if(g)return g;
  g=_touch({id:genId('g',S.groups),name:'BU2 프로젝트'});
  S.groups.push(g);
  return g;
}
function _mpFindOrCreateSite(mp){
  var name=mp.customer;
  var site=S.sites.find(function(s){return s.name===name;});
  if(site)return site;
  var baseId=name.replace(/[^a-zA-Z0-9가-힣]/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,'')||'site';
  var newId=baseId,n=2;while(S.sites.find(function(s){return s.id===newId;}))newId=baseId+'_'+n++;
  var grp=_mpFindOrCreateGroup();
  site=_touch({id:newId,name:name,color:_MP_SITE_PALETTE[S.sites.length%_MP_SITE_PALETTE.length],groupId:grp.id,country:mp.region||'기타'});
  S.sites.push(site);
  return site;
}
function _mpFindOrCreateProject(siteId,name){
  var p=S.projects.find(function(p){return p.siteId===siteId&&p.name===name;});
  if(p)return p;
  p=_touch({id:genId('pj',S.projects),siteId:siteId,name:name});
  S.projects.push(p);
  return p;
}
function _syncMasterProjectToGantt(mp){
  if(mp.scheduleId)return; // 이미 연동됨 — 재동기화 안 함(간트 차트에서 자유 편집 가능하도록)
  if(!mp.trip1Start||!mp.trip1End)return;
  var site=_mpFindOrCreateSite(mp);
  var proj=_mpFindOrCreateProject(site.id,mp.projectName||mp.customer||'프로젝트');
  var managerText=mp.trip1Manager||mp.setupManager||'미정';
  var type=/외주/.test(managerText)?'outsource':'hq';
  var task=mp.prodUnit||mp.customerUnit||mp.projectName||'';
  var sc=_touch({id:genId('s',S.schedules),projectId:proj.id,task:task,name:managerText,type:type,
    start:mp.trip1Start,end:mp.trip1End,note:'',hidden:false,domestic:(mp.region==='국내')});
  S.schedules.push(sc);
  if(mp.trip2Start&&mp.trip2End){
    sc.origEnd=sc.end;
    sc.extensions=[{seq:1,end:mp.trip2End,note:''}];
    sc.end=mp.trip2End;
    if(mp.trip3Start&&mp.trip3End){
      sc.extensions.push({seq:2,end:mp.trip3End,note:''});
      sc.end=mp.trip3End;
    }
    _touch(sc);
  }
  mp.scheduleId=sc.id;
  _touch(mp);
}

/* ── 엑셀 데이터 1회성 가져오기 ── */
function _mpCloneSeed(seed){
  return {
    category:seed.category,region:seed.region,customer:seed.customer,projectName:seed.projectName,
    prodUnit:seed.prodUnit,customerUnit:seed.customerUnit,serial:seed.serial,
    setupStart:seed.setupStart,setupEnd:seed.setupEnd,setupManager:seed.setupManager,
    shipDate:seed.shipDate,
    trip1Start:seed.trip1Start,trip1End:seed.trip1End,trip1Manager:seed.trip1Manager,
    trip2Start:seed.trip2Start,trip2End:seed.trip2End,trip2Manager:seed.trip2Manager,
    trip3Start:seed.trip3Start,trip3End:seed.trip3End,trip3Manager:seed.trip3Manager,
    status:seed.status, id:_mpId(), scheduleId:null
  };
}
function importExcelSeedMasterProjects(){
  if(S.masterProjects.length){alert('이미 프로젝트 데이터가 있어 가져오기를 실행할 수 없습니다.');return;}
  if(!confirm('엑셀 "프로젝트 입력" 시트의 데이터 '+_EXCEL_SEED_MASTER_PROJECTS.length+'건을 가져옵니다.\n1차 출장 일정이 있는 항목은 간트 차트에도 자동 등록됩니다.\n계속할까요?'))return;
  _EXCEL_SEED_MASTER_PROJECTS.forEach(function(seed){
    var mp=_touch(_mpCloneSeed(seed));
    S.masterProjects.push(mp);
    _syncMasterProjectToGantt(mp);
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
    +'<th>월</th><th>본사 셋업 설비 수</th><th>본사 셋업 설비군</th>'
    +'<th>현장 셋업 설비 수</th><th>현장 셋업 설비군</th>'
    +'<th>출장 인원</th><th>출장 인원 명단</th></tr></thead><tbody>';
  months.forEach(function(ym){
    var hq=_mpMonthGroup(ym,'hq');
    var site=_mpMonthGroup(ym,'site');
    var people=_mpMonthTravelers(ym);
    html+='<tr class="pm-person-row">'
      +'<td>'+ym+'</td>'
      +'<td>'+hq.count+'</td><td style="white-space:pre-line;font-size:11px;text-align:left">'+_esc(hq.list.join('\n'))+'</td>'
      +'<td>'+site.count+'</td><td style="white-space:pre-line;font-size:11px;text-align:left">'+_esc(site.list.join('\n'))+'</td>'
      +'<td>'+people.length+'</td><td style="font-size:11px;text-align:left">'+_esc(people.join(', '))+'</td>'
      +'</tr>';
  });
  html+='</tbody></table></div>';
  main.innerHTML=html;
}
function _mpAllMonths(){
  var min=null,max=null;
  S.masterProjects.forEach(function(mp){
    [mp.setupStart,mp.setupEnd,mp.trip1Start,mp.trip1End,mp.trip2Start,mp.trip2End,mp.trip3Start,mp.trip3End].forEach(function(d){
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
  S.masterProjects.forEach(function(mp){
    var overlap;
    if(phase==='hq') overlap=_mpMonthOverlap(ym,mp.setupStart,mp.setupEnd);
    else overlap=_mpMonthOverlap(ym,mp.trip1Start,mp.trip3End||mp.trip2End||mp.trip1End);
    if(!overlap)return;
    var key=(mp.region||'기타')+'|'+(mp.customer||'')+'|'+(mp.projectName||'');
    groups[key]=(groups[key]||0)+1;
  });
  var keys=Object.keys(groups);
  var list=keys.map(function(k,i){
    var parts=k.split('|');
    return (i+1)+'. ['+parts[0]+'] '+parts[1]+' - '+parts[2]+' '+groups[k]+'대';
  });
  return {count:keys.reduce(function(s,k){return s+groups[k];},0),list:list};
}
function _mpMonthTravelers(ym){
  var names={};
  S.masterProjects.forEach(function(mp){
    var tEnd=mp.trip3End||mp.trip2End||mp.trip1End;
    if(!_mpMonthOverlap(ym,mp.trip1Start,tEnd))return;
    [mp.trip1Manager,mp.trip2Manager,mp.trip3Manager].forEach(function(txt){
      if(!txt)return;
      txt.split(',').forEach(function(nm){nm=nm.trim();if(nm)names[nm]=true;});
    });
  });
  return Object.keys(names);
}

/* ── 엑셀 "프로젝트 입력" 시트 원본 데이터 (2026-08-31 기준 1회성 가져오기용) ── */
var _EXCEL_SEED_MASTER_PROJECTS = [{"category":"Repeat Order","region":"국내","customer":"LGIT_구미","projectName":"iSIS-NBGA","prodUnit":"생산 98호기","customerUnit":"","serial":"IP2UT0EH05","setupStart":"2026-05-01","setupEnd":"2026-05-29","setupManager":"양성호","shipDate":"2026-06-01","trip1Start":"2026-06-01","trip1End":"2026-06-22","trip1Manager":"양성호","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"완료"},{"category":"Repeat Order","region":"국내","customer":"LGIT_구미","projectName":"iPIS-590","prodUnit":"생산 29호기","customerUnit":"","serial":"IP59T0EH04","setupStart":"2026-05-29","setupEnd":"2026-06-15","setupManager":"맹준영","shipDate":"2026-06-22","trip1Start":"2026-06-22","trip1End":"2026-07-08","trip1Manager":"맹준영","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"완료"},{"category":"Repeat Order","region":"국내","customer":"LGIT_구미","projectName":"iPIS-590","prodUnit":"생산 31호기","customerUnit":"","serial":"IP59T0EI04","setupStart":"2026-08-18","setupEnd":"2026-09-21","setupManager":"맹준영","shipDate":"2026-09-22","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"국내","customer":"LGIT_구미","projectName":"iVRS-100S","prodUnit":"생산 4호기","customerUnit":"","serial":"IP2VT0EH02","setupStart":"2026-05-01","setupEnd":"2026-05-29","setupManager":"맹준영","shipDate":"2026-06-01","trip1Start":"2026-06-01","trip1End":"2026-06-15","trip1Manager":"맹준영","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"완료"},{"category":"Repeat Order","region":"국내","customer":"LGIT_구미","projectName":"iVRS-100S","prodUnit":"생산 5호기","customerUnit":"","serial":"IP2VT0EI01","setupStart":"2026-08-18","setupEnd":"2026-09-21","setupManager":"맹준영","shipDate":"2026-09-22","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"국내","customer":"LGIT_구미","projectName":"iSIS-SMTV V1(CTV)","prodUnit":"생산 66호기","customerUnit":"","serial":"IP2NT0EI09","setupStart":"2026-07-02","setupEnd":"2026-07-30","setupManager":"윤덕현, 양성호, 장원준","shipDate":"2026-07-31","trip1Start":"2026-08-03","trip1End":"2026-08-28","trip1Manager":"양성호","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"국내","customer":"LGIT_구미","projectName":"iSIS-SMTV V1(CTV)","prodUnit":"생산 67호기","customerUnit":"","serial":"IP2NT0EI10","setupStart":"2026-07-30","setupEnd":"2026-10-22","setupManager":"양성호, 윤덕현","shipDate":"2026-10-23","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"국내","customer":"LGIT_구미","projectName":"iSIS-SMTV V1(CTV)","prodUnit":"생산 85호기","customerUnit":"","serial":"IP2NT0EI28","setupStart":"2027-01-06","setupEnd":"2027-02-24","setupManager":"양성호, 외주(한빛)","shipDate":"2027-02-25","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"국내","customer":"SEMCO_세종","projectName":"iPIS-590","prodUnit":"생산 33호기","customerUnit":"","serial":"IP59T0EI06","setupStart":"2026-10-26","setupEnd":"2026-12-14","setupManager":"생산 셋업","shipDate":"2026-12-15","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"국내","customer":"SEMCO_세종","projectName":"iPIS-590","prodUnit":"생산 34호기","customerUnit":"","serial":"IP59T0EI07","setupStart":"2026-11-19","setupEnd":"2027-01-14","setupManager":"생산 셋업","shipDate":"2027-01-15","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"국내","customer":"SEMCO_세종","projectName":"iPIS-590","prodUnit":"생산 35호기","customerUnit":"","serial":"IP59T0EI08","setupStart":"2026-11-25","setupEnd":"2027-01-14","setupManager":"생산 셋업","shipDate":"2027-01-15","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"국내","customer":"SEMCO_세종","projectName":"iPIS-590","prodUnit":"생산 36호기","customerUnit":"","serial":"IP59T0EI09","setupStart":"2026-11-25","setupEnd":"2027-01-14","setupManager":"생산 셋업","shipDate":"2027-01-15","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"국내","customer":"SEMCO_세종","projectName":"iSIS-SMTV V1(NTV)","prodUnit":"생산 71호기","customerUnit":"","serial":"IP2NT0EI14","setupStart":"2026-12-04","setupEnd":"2026-12-28","setupManager":"윤재철, 외주(한빛)","shipDate":"2026-12-29","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"국내","customer":"SEMCO_세종","projectName":"iSIS-SMTV V1(NTV)","prodUnit":"생산 72호기","customerUnit":"","serial":"IP2NT0EI15","setupStart":"2026-12-04","setupEnd":"2026-12-28","setupManager":"윤재철, 외주(한빛)","shipDate":"2026-12-29","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"국내","customer":"SEMCO_세종","projectName":"iSIS-SMTV V1(NTV)","prodUnit":"생산 73호기","customerUnit":"","serial":"IP2NT0EI16","setupStart":"2026-12-14","setupEnd":"2027-04-29","setupManager":"윤재철, 외주(한빛)","shipDate":"2027-04-30","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"국내","customer":"SEMCO_세종","projectName":"iSIS-SMTV V1(NTV)","prodUnit":"생산 74호기","customerUnit":"","serial":"IP2NT0EI17","setupStart":"2026-12-29","setupEnd":"2027-04-29","setupManager":"윤재철, 외주(한빛)","shipDate":"2027-04-30","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"국내","customer":"SEMCO_세종","projectName":"iSIS-SMTV V1(NTV)","prodUnit":"생산 75호기","customerUnit":"","serial":"IP2NT0EI18","setupStart":"2027-02-26","setupEnd":"2027-04-22","setupManager":"윤재철, 외주(한빛)","shipDate":"2027-04-23","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"베트남","customer":"베트남_SEMV","projectName":"iSIS-SMTV V1(NTV)","prodUnit":"생산 106호기","customerUnit":"","serial":"IP2SP0EI03","setupStart":"2027-03-05","setupEnd":"2027-04-29","setupManager":"윤재철, 외주(한빛)","shipDate":"2027-04-30","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"국내","customer":"SEMCO_부산","projectName":"iSIS-SMTV V1(NTV)","prodUnit":"생산 107호기","customerUnit":"","serial":"IP2SP0EI04","setupStart":"2027-03-10","setupEnd":"2027-04-29","setupManager":"윤재철, 외주(한빛)","shipDate":"2027-04-30","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"국내","customer":"SEMCO_세종","projectName":"iSIS-QPM","prodUnit":"생산 25호기","customerUnit":"","serial":"IPQMT0EJ01","setupStart":"2027-04-07","setupEnd":"2027-05-27","setupManager":"윤재철, 외주(한빛)","shipDate":"2027-05-28","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"베트남","customer":"SEMV","projectName":"iSIS-QPM","prodUnit":"생산 23호기","customerUnit":"","serial":"IPQMT0EI03","setupStart":"2027-04-07","setupEnd":"2027-05-27","setupManager":"윤재철, 외주(한빛)","shipDate":"2027-05-28","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"베트남","customer":"SEMV","projectName":"iSIS-QPM","prodUnit":"생산 24호기","customerUnit":"","serial":"IPQMT0EI04","setupStart":"2027-04-07","setupEnd":"2027-05-27","setupManager":"윤재철, 외주(한빛)","shipDate":"2027-05-28","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"대만","customer":"Kinsus","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 59호기","customerUnit":"","serial":"IP2NS0EH01","setupStart":"2025-12-20","setupEnd":"2026-01-27","setupManager":"정해영, 이경호, 외주(한빛)","shipDate":"2026-01-28","trip1Start":"","trip1End":"","trip1Manager":"대만지사(아담)","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"완료"},{"category":"Repeat Order","region":"대만","customer":"Kinsus","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 70호기","customerUnit":"","serial":"IP2NT0EI13","setupStart":"2026-10-16","setupEnd":"2026-11-26","setupManager":"정해영, 이경호, 외주(한빛)","shipDate":"2026-11-27","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"대만","customer":"Kinsus","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 82호기","customerUnit":"","serial":"IP2NT0EI25","setupStart":"2026-11-05","setupEnd":"2026-12-21","setupManager":"정해영, 이경호, 외주(한빛)","shipDate":"2026-12-22","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"대만","customer":"Kinsus","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 83호기","customerUnit":"","serial":"IP2NT0EI26","setupStart":"2026-11-19","setupEnd":"2027-01-19","setupManager":"정해영, 이경호, 외주(한빛)","shipDate":"2027-01-20","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"대만","customer":"Kinsus","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 84호기","customerUnit":"","serial":"IP2NT0EI27","setupStart":"2026-11-19","setupEnd":"2027-01-19","setupManager":"정해영, 이경호, 외주(한빛)","shipDate":"2027-01-20","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"대만","customer":"Kinsus","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 108호기","customerUnit":"","serial":"","setupStart":"","setupEnd":"2027-02-23","setupManager":"","shipDate":"2027-02-24","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"대만","customer":"Kinsus","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 109호기","customerUnit":"","serial":"","setupStart":"","setupEnd":"2027-02-23","setupManager":"","shipDate":"2027-02-24","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"대만","customer":"ZDT","projectName":"iPIS-590","prodUnit":"생산 30호기","customerUnit":"","serial":"IP59T0EI03","setupStart":"2026-07-17","setupEnd":"2026-08-20","setupManager":"생산 셋업","shipDate":"2026-08-21","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"대만","customer":"ZDT","projectName":"iSIS-NBGA","prodUnit":"생산 99호기","customerUnit":"","serial":"IP2UT0EI02","setupStart":"2026-06-22","setupEnd":"2026-07-15","setupManager":"생산 셋업","shipDate":"2026-07-16","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"ZDT_SZ","projectName":"iPIS-590","prodUnit":"생산 32호기","customerUnit":"","serial":"IP59T0EI05","setupStart":"2026-10-16","setupEnd":"2026-11-30","setupManager":"생산 셋업","shipDate":"2026-12-01","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"ZDT_SZ","projectName":"iPIS-590","prodUnit":"생산 37호기","customerUnit":"","serial":"IP59T0EI10","setupStart":"2026-11-13","setupEnd":"2026-12-28","setupManager":"생산 셋업","shipDate":"2026-12-29","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"ZDT_SZ","projectName":"iSIS-QPM","prodUnit":"생산 21호기","customerUnit":"","serial":"IPQMT0EI01","setupStart":"2026-10-15","setupEnd":"2026-11-12","setupManager":"정해영","shipDate":"2026-11-13","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"ZDT_SZ","projectName":"iSIS-QPM","prodUnit":"생산 22호기","customerUnit":"","serial":"IPQMT0EI02","setupStart":"2026-10-15","setupEnd":"2026-11-12","setupManager":"정해영","shipDate":"2026-11-13","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"ZDT_SZ","projectName":"iSIS-NBGA","prodUnit":"생산 100호기","customerUnit":"","serial":"IP2UT0EI03","setupStart":"2026-11-11","setupEnd":"2026-12-21","setupManager":"생산 셋업","shipDate":"2026-12-22","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"ZDT_SZ","projectName":"iSIS-NBGA","prodUnit":"생산 101호기","customerUnit":"","serial":"IP2UT0EI04","setupStart":"2026-11-11","setupEnd":"2026-12-21","setupManager":"생산 셋업","shipDate":"2026-12-22","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"ZDT_SZ","projectName":"iSIS-NBGA","prodUnit":"생산 102호기","customerUnit":"","serial":"IP2UT0EI05","setupStart":"2026-12-03","setupEnd":"2027-01-12","setupManager":"생산 셋업","shipDate":"2027-01-13","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"ZDT_SZ","projectName":"iSIS-NBGA","prodUnit":"생산 103호기","customerUnit":"","serial":"IP2UT0EI06","setupStart":"2026-12-03","setupEnd":"2027-01-12","setupManager":"생산 셋업","shipDate":"2027-01-13","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"ZDT_SZ","projectName":"iSIS-NBGA","prodUnit":"생산 104호기","customerUnit":"","serial":"IP2UT0EI07","setupStart":"2026-12-23","setupEnd":"2027-02-02","setupManager":"생산 셋업","shipDate":"2027-02-03","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"ZDT_SZ","projectName":"iSIS-NBGA","prodUnit":"생산 105호기","customerUnit":"","serial":"IP2UT0EI08","setupStart":"2026-12-23","setupEnd":"2027-02-02","setupManager":"생산 셋업","shipDate":"2027-02-03","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"ZDT_SZ","projectName":"iSIS-SMTV V1(NTV)","prodUnit":"생산 63호기","customerUnit":"","serial":"IP2NT0EI04","setupStart":"2026-05-22","setupEnd":"2026-06-18","setupManager":"장현재, 이경호, 외주(한빛)","shipDate":"2026-06-19","trip1Start":"2026-07-19","trip1End":"2026-07-31","trip1Manager":"이경호, 중국지사(정호삼), Takewin","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"완료"},{"category":"Repeat Order","region":"중국","customer":"ZDT_SZ","projectName":"iSIS-SMTV V1(NTV)","prodUnit":"생산 64호기","customerUnit":"","serial":"IP2NT0EI07","setupStart":"2026-06-09","setupEnd":"2026-09-29","setupManager":"장현재, 이경호, 외주(한빛)","shipDate":"2026-09-30","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"AT\u0026S CQ","projectName":"iSIS-NBGA","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"Repeat Order","region":"중국","customer":"AT\u0026S CQ","projectName":"iSIS-NBGA","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"Repeat Order","region":"중국","customer":"AT\u0026S CQ","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 76호기","customerUnit":"","serial":"IP2NT0EI19","setupStart":"2026-11-12","setupEnd":"2026-12-28","setupManager":"정해영, 외주(한빛)","shipDate":"2026-12-29","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"AT\u0026S CQ","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 77호기","customerUnit":"","serial":"IP2NT0EI20","setupStart":"2026-11-12","setupEnd":"2026-12-28","setupManager":"정해영, 외주(한빛)","shipDate":"2026-12-29","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"AT\u0026S CQ","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 78호기","customerUnit":"","serial":"IP2NT0EI21","setupStart":"2026-11-26","setupEnd":"2027-01-14","setupManager":"정해영, 외주(한빛)","shipDate":"2027-01-15","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"AT\u0026S CQ","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 79호기","customerUnit":"","serial":"IP2NT0EI22","setupStart":"2026-11-26","setupEnd":"2027-01-14","setupManager":"정해영, 외주(한빛)","shipDate":"2027-01-15","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"AT\u0026S CQ","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 80호기","customerUnit":"","serial":"IP2NT0EI23","setupStart":"2026-12-10","setupEnd":"2027-01-28","setupManager":"정해영, 외주(한빛)","shipDate":"2027-01-29","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"AT\u0026S CQ","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 81호기","customerUnit":"","serial":"IP2NT0EI24","setupStart":"2026-12-10","setupEnd":"2027-01-28","setupManager":"정해영, 외주(한빛)","shipDate":"2027-01-29","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"AKM","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 86호기","customerUnit":"","serial":"IP2NT0EI29","setupStart":"2026-10-26","setupEnd":"2026-11-27","setupManager":"BU3, 정해영, 외주(한빛)","shipDate":"2026-11-30","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"AKM","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 87호기","customerUnit":"","serial":"IP2NT0EJ01","setupStart":"2026-12-23","setupEnd":"2027-01-28","setupManager":"BU3","shipDate":"2027-01-29","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"AKM","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 88호기","customerUnit":"","serial":"IP2NT0EJ02","setupStart":"2026-12-23","setupEnd":"2027-01-28","setupManager":"BU3","shipDate":"2027-01-29","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"AKM","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 89호기","customerUnit":"","serial":"IP2NT0EJ03","setupStart":"2027-01-08","setupEnd":"2027-02-25","setupManager":"BU3","shipDate":"2027-02-26","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"AKM","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 90호기","customerUnit":"","serial":"IP2NT0EJ04","setupStart":"2027-01-08","setupEnd":"2027-02-25","setupManager":"BU3","shipDate":"2027-02-26","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"AKM","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 91호기","customerUnit":"","serial":"IP2NT0EJ05","setupStart":"2027-02-03","setupEnd":"2027-03-25","setupManager":"BU3","shipDate":"2027-03-26","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"AKM","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 92호기","customerUnit":"","serial":"IP2NT0EJ06","setupStart":"2027-02-03","setupEnd":"2027-03-25","setupManager":"BU3","shipDate":"2027-03-26","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"AKM","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 93호기","customerUnit":"","serial":"IP2NT0EJ07","setupStart":"2027-03-05","setupEnd":"2027-04-22","setupManager":"BU3","shipDate":"2027-04-23","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"AKM","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 94호기","customerUnit":"","serial":"IP2NT0EJ08","setupStart":"2027-03-05","setupEnd":"2027-04-22","setupManager":"BU3","shipDate":"2027-04-23","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"AKM","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 95호기","customerUnit":"","serial":"IP2NT0EJ09","setupStart":"2027-03-31","setupEnd":"2027-05-20","setupManager":"BU3","shipDate":"2027-05-21","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"AKM","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 96호기","customerUnit":"","serial":"IP2NT0EJ10","setupStart":"2027-03-31","setupEnd":"2027-05-20","setupManager":"BU3","shipDate":"2027-05-21","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"AKM","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 97호기","customerUnit":"","serial":"IP2NT0EJ11","setupStart":"2027-04-28","setupEnd":"2027-06-17","setupManager":"BU3","shipDate":"2027-06-18","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"AKM","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 98호기","customerUnit":"","serial":"IP2NT0EJ12","setupStart":"2027-04-28","setupEnd":"2027-06-17","setupManager":"BU3","shipDate":"2027-06-18","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"AKM","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 99호기","customerUnit":"","serial":"IP2NT0EJ13","setupStart":"2027-05-28","setupEnd":"2027-07-15","setupManager":"BU3","shipDate":"2027-07-16","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"AKM","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 100호기","customerUnit":"","serial":"IP2NT0EJ14","setupStart":"2027-05-28","setupEnd":"2027-07-15","setupManager":"BU3","shipDate":"2027-07-16","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"AKM","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 101호기","customerUnit":"","serial":"IP2NT0EJ15","setupStart":"2027-06-25","setupEnd":"2027-08-12","setupManager":"BU3","shipDate":"2027-08-13","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"AKM","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 102호기","customerUnit":"","serial":"IP2NT0EJ16","setupStart":"2027-06-25","setupEnd":"2027-08-12","setupManager":"BU3","shipDate":"2027-08-13","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"AKM","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 103호기","customerUnit":"","serial":"IP2NT0EJ17","setupStart":"2027-07-23","setupEnd":"2027-09-09","setupManager":"BU3","shipDate":"2027-09-10","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"AKM","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"생산 104호기","customerUnit":"","serial":"IP2NT0EJ18","setupStart":"2027-07-23","setupEnd":"2027-09-09","setupManager":"BU3","shipDate":"2027-09-10","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"중국","customer":"SCC","projectName":"iSIS-NBGA","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"Repeat Order","region":"중국","customer":"SCC","projectName":"iSIS-NBGA","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"Repeat Order","region":"중국","customer":"SCC","projectName":"iSIS-NBGA","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"Repeat Order","region":"중국","customer":"SCC","projectName":"iSIS-NBGA","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"Repeat Order","region":"중국","customer":"SCC","projectName":"iPIS-580","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"Repeat Order","region":"중국","customer":"SCC","projectName":"iPIS-580","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"Repeat Order","region":"중국","customer":"SCC","projectName":"iPIS-580","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"Repeat Order","region":"중국","customer":"Fastprint","projectName":"iSIS-NBGA","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"2026-10-01","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"LOI 접수"},{"category":"Repeat Order","region":"중국","customer":"Fastprint","projectName":"iSIS-NBGA","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"2027-06-01","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"LOI 접수"},{"category":"Repeat Order","region":"중국","customer":"Fastprint","projectName":"iSIS-NBGA","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"2027-07-01","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"LOI 접수"},{"category":"Repeat Order","region":"중국","customer":"Fastprint","projectName":"iSIS-NBGA","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"2027-09-01","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"LOI 접수"},{"category":"Repeat Order","region":"중국","customer":"Fastprint","projectName":"iSIS-NBGA","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"2027-09-01","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"LOI 접수"},{"category":"Repeat Order","region":"중국","customer":"Fastprint","projectName":"iSIS-NBGA","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"2027-12-01","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"LOI 접수"},{"category":"Repeat Order","region":"중국","customer":"Fastprint","projectName":"iSIS-NBGA","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"Repeat Order","region":"중국","customer":"Fastprint","projectName":"iSIS-NBGA","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"Repeat Order","region":"중국","customer":"Fastprint","projectName":"iSIS-NBGA","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"Repeat Order","region":"중국","customer":"Fastprint","projectName":"iSIS-NBGA","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"Repeat Order","region":"중국","customer":"Fastprint","projectName":"iPIS-580","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"2027-09-01","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"LOI 접수"},{"category":"Repeat Order","region":"중국","customer":"Fastprint","projectName":"iPIS-580","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"2027-12-01","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"LOI 접수"},{"category":"Repeat Order","region":"중국","customer":"Fastprint","projectName":"iPIS-580","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"Repeat Order","region":"말레이시아","customer":"AT\u0026S_P5","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"","customerUnit":"NTV307","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"Techsense","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"완료"},{"category":"Repeat Order","region":"말레이시아","customer":"AT\u0026S_P5","projectName":"iSIS-SMTV V3(NTV)","prodUnit":"","customerUnit":"NTV308","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"Repeat Order","region":"말레이시아","customer":"AT\u0026S_P5","projectName":"iSIS-SMTV V0 (BTV)","prodUnit":"","customerUnit":"BTV502","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"Techsense","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"완료"},{"category":"Repeat Order","region":"말레이시아","customer":"AT\u0026S_P5","projectName":"iSIS-SMTV V0(BTV)","prodUnit":"생산 68호기","customerUnit":"","serial":"IP2NT0EI11","setupStart":"2026-07-03","setupEnd":"2026-07-24","setupManager":"정해영, 외주(한빛)","shipDate":"2026-07-27","trip1Start":"","trip1End":"","trip1Manager":"Techsense","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"완료"},{"category":"Repeat Order","region":"말레이시아","customer":"AT\u0026S_P5","projectName":"iSIS-SMTV V0(BTV)","prodUnit":"생산 69호기","customerUnit":"","serial":"IP2NT0EI12","setupStart":"2026-07-17","setupEnd":"2026-08-27","setupManager":"정해영, 이경호, 외주(한빛)","shipDate":"2026-08-28","trip1Start":"","trip1End":"","trip1Manager":"Techsense","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"Repeat Order","region":"미국","customer":"Space X","projectName":"iSIS-SMTV V1(NTV)","prodUnit":"생산 105호기","customerUnit":"","serial":"IP2NT0EJ19","setupStart":"2026-12-16","setupEnd":"2027-01-21","setupManager":"정해영, 이윤경, 외주(한빛)","shipDate":"2027-01-22","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"신규 개발","region":"일본","customer":"IBIDEN","projectName":"iSIS-NTV DI","prodUnit":"생산 1호기","customerUnit":"","serial":"IP2NT0EI01","setupStart":"2026-02-20","setupEnd":"2026-04-03","setupManager":"김형진, 황의송, 윤덕현","shipDate":"2026-04-06","trip1Start":"2026-04-15","trip1End":"2026-06-22","trip1Manager":"김형진, 황의송, 윤덕현","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"완료"},{"category":"신규 개발","region":"일본","customer":"TOPPAN","projectName":"iSIS-FP3D","prodUnit":"생산 3호기","customerUnit":"","serial":"IPQFT0EI01","setupStart":"2026-08-01","setupEnd":"2026-10-29","setupManager":"윤재철, 장원준","shipDate":"2026-10-30","trip1Start":"","trip1End":"","trip1Manager":"장원준","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"신규 개발","region":"일본","customer":"TOPPAN","projectName":"iSIS-LTV","prodUnit":"생산 1호기","customerUnit":"","serial":"IP2LT0EI01","setupStart":"2026-03-23","setupEnd":"2026-06-29","setupManager":"김형진","shipDate":"2026-06-30","trip1Start":"2026-07-09","trip1End":"2026-09-04","trip1Manager":"김형진","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"신규 개발","region":"일본","customer":"SHINKO","projectName":"iSIS-NTV DS","prodUnit":"생산 1호기","customerUnit":"","serial":"IP2NT0EI02","setupStart":"2026-03-12","setupEnd":"2026-07-01","setupManager":"윤재철, 윤덕현","shipDate":"2026-07-02","trip1Start":"2026-07-12","trip1End":"2026-09-04","trip1Manager":"윤재철, 윤덕현","trip2Start":"2026-09-01","trip2End":"2026-09-23","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"신규 개발","region":"일본","customer":"SHINKO","projectName":"iSIS-NTV DS","prodUnit":"생산 2호기","customerUnit":"","serial":"IP2NT0EI03","setupStart":"2026-03-12","setupEnd":"2026-07-01","setupManager":"윤재철, 윤덕현","shipDate":"2026-07-02","trip1Start":"2026-07-12","trip1End":"2026-09-04","trip1Manager":"윤재철","trip2Start":"2026-09-01","trip2End":"2026-09-23","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"신규 개발","region":"대만","customer":"Nanya_SL","projectName":"iSIS-LTV100","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"신규 개발","region":"대만","customer":"Nanya_SL","projectName":"iSIS-HL1000","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"신규 개발","region":"대만","customer":"UMTC YM2","projectName":"iSIS-LTV100","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"신규 개발","region":"대만","customer":"UMTC YM2","projectName":"iSIS-LTV100","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"신규 개발","region":"대만","customer":"UMTC YM2","projectName":"iSIS-LTV100","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"신규 개발","region":"대만","customer":"UMTC_KF2","projectName":"iSIS-LTV200","prodUnit":"생산 1호기","customerUnit":"","serial":"IP2LT0EI03","setupStart":"2026-07-16","setupEnd":"2026-11-27","setupManager":"정해영, 이주헌","shipDate":"2026-11-30","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"신규 개발","region":"대만","customer":"UMTC_KF2","projectName":"iSIS-LTV200","prodUnit":"생산 2호기","customerUnit":"","serial":"IP2LT0EI06","setupStart":"2026-10-23","setupEnd":"2026-12-18","setupManager":"정해영, 외주(한빛)","shipDate":"2026-12-21","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"신규 개발","region":"대만","customer":"UMTC_KF2","projectName":"iSIS-LTV200","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"신규 개발","region":"대만","customer":"UMTC_KF2","projectName":"iSIS-LTV200","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"신규 개발","region":"중국","customer":"Shenghong; (Victory Giant)","projectName":"QPM 대여 건","prodUnit":"","customerUnit":"","serial":"","setupStart":"2026-01-01","setupEnd":"2026-03-08","setupManager":"장현재, 이경호","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"완료"},{"category":"신규 개발","region":"중국","customer":"Shenghong; (Victory Giant)","projectName":"iSIS-LTV100","prodUnit":"생산 2호기","customerUnit":"","serial":"IP2LT0EI02","setupStart":"2026-06-24","setupEnd":"2026-09-14","setupManager":"황의송","shipDate":"2026-09-15","trip1Start":"","trip1End":"","trip1Manager":"황의송","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"신규 개발","region":"중국","customer":"ZDT_SZ","projectName":"iSIS-LTV100","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"신규 개발","region":"중국","customer":"ZDT_SZ","projectName":"iPIS-HL1000","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"신규 개발","region":"중국","customer":"ZDT_HA","projectName":"iSIS-LTV100","prodUnit":"생산 1호기","customerUnit":"","serial":"IP2LT0EH01","setupStart":"2026-06-10","setupEnd":"2026-06-29","setupManager":"장현재, 이경호","shipDate":"2026-06-30","trip1Start":"2026-08-30","trip1End":"2026-11-27","trip1Manager":"이경호","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"신규 개발","region":"중국","customer":"ZDT_HA","projectName":"iSIS-LTV100","prodUnit":"생산 3호기","customerUnit":"","serial":"IP2LT0EI04","setupStart":"2026-06-30","setupEnd":"2026-08-27","setupManager":"장현재, 이경호","shipDate":"2026-08-28","trip1Start":"2026-08-30","trip1End":"2026-11-27","trip1Manager":"이경호","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"신규 개발","region":"중국","customer":"ZDT_HA","projectName":"iPIS-HL1000","prodUnit":"생산 1호기","customerUnit":"","serial":"IPHLT0EH02","setupStart":"2026-06-16","setupEnd":"2026-06-29","setupManager":"장현재, 이경호","shipDate":"2026-06-30","trip1Start":"2026-09-02","trip1End":"2026-11-27","trip1Manager":"이승진, 장현재","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"신규 개발","region":"중국","customer":"ZDT_HA","projectName":"iPIS-HL1000","prodUnit":"생산 2호기","customerUnit":"","serial":"IPHLT0EI01","setupStart":"2026-06-30","setupEnd":"2026-08-27","setupManager":"장현재, 이경호","shipDate":"2026-08-28","trip1Start":"2026-09-02","trip1End":"2026-11-27","trip1Manager":"이승진, 장현재","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"신규 개발","region":"싱가폴","customer":"Broadcom","projectName":"iSIS-FP3D","prodUnit":"생산 1호기","customerUnit":"","serial":"IPQFS0EI01","setupStart":"2026-02-13","setupEnd":"2026-06-04","setupManager":"장현재","shipDate":"2026-06-05","trip1Start":"2026-06-15","trip1End":"2026-07-10","trip1Manager":"장현재","trip2Start":"2026-09-27","trip2End":"2026-10-08","trip2Manager":"정해영","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"신규 개발","region":"태국","customer":"DTMC","projectName":"iSIS-LTV100","prodUnit":"생산 4호기","customerUnit":"","serial":"IP2LT0EI05","setupStart":"2026-09-10","setupEnd":"2026-11-05","setupManager":"김형진","shipDate":"2026-11-06","trip1Start":"","trip1End":"","trip1Manager":"김형진","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"신규 개발","region":"태국","customer":"DTMC","projectName":"iPIS-HL1000","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"신규 개발","region":"베트남","customer":"SEMV","projectName":"iSIS-LTV300","prodUnit":"생산 1호기","customerUnit":"","serial":"IP2LT0EI07","setupStart":"2027-03-19","setupEnd":"2027-05-27","setupManager":"윤재철, 외주(한빛)","shipDate":"2027-05-28","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"신규 개발","region":"베트남","customer":"SEMV","projectName":"iSIS-LTV300","prodUnit":"생산 2호기","customerUnit":"","serial":"IP2LT0EI08","setupStart":"2027-03-19","setupEnd":"2027-05-27","setupManager":"윤재철, 외주(한빛)","shipDate":"2027-05-28","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"신규 개발","region":"베트남","customer":"SEMV","projectName":"iSIS-LTV300","prodUnit":"생산 3호기","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"신규 개발","region":"베트남","customer":"SEMV","projectName":"iSIS-LTV300","prodUnit":"생산 4호기","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"신규 개발","region":"베트남","customer":"SEMV","projectName":"iSIS-LTV300","prodUnit":"생산 5호기","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"신규 개발","region":"베트남","customer":"SEMV","projectName":"iSIS-LTV300","prodUnit":"생산 6호기","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"신규 개발","region":"베트남","customer":"SEMV","projectName":"iSIS-LTV300","prodUnit":"생산 7호기","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"신규 개발","region":"베트남","customer":"SEMV","projectName":"iSIS-LTV300","prodUnit":"생산 8호기","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"신규 개발","region":"베트남","customer":"SEMV","projectName":"iSIS-LTV300","prodUnit":"생산 9호기","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"신규 개발","region":"베트남","customer":"SEMV","projectName":"iSIS-LTV300","prodUnit":"생산 10호기","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"신규 개발","region":"베트남","customer":"SEMV","projectName":"iSIS-LTV300","prodUnit":"생산 11호기","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"신규 개발","region":"베트남","customer":"SEMV","projectName":"iSIS-LTV300","prodUnit":"생산 12호기","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"신규 개발","region":"베트남","customer":"SEMV","projectName":"iSIS-LTV300","prodUnit":"생산 13호기","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"신규 개발","region":"베트남","customer":"SEMV","projectName":"iPIS-HL1000(SE)","prodUnit":"생산 1호기","customerUnit":"","serial":"HL01TOEI01","setupStart":"2027-03-19","setupEnd":"2027-05-27","setupManager":"윤재철, 외주(한빛)","shipDate":"2027-05-28","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"신규 개발","region":"베트남","customer":"SEMV","projectName":"iPIS-HL1000(SE)","prodUnit":"생산 2호기","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"신규 개발","region":"베트남","customer":"SEMV","projectName":"iPIS-HL1000(SE)","prodUnit":"생산 3호기","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"신규 개발","region":"베트남","customer":"SEMV","projectName":"iPIS-HL1000(SE)","prodUnit":"생산 4호기","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"기타","region":"국내","customer":"AIT▶LGIT_구미","projectName":"iSIS-NBGA_현장 1호기 이설 셋업","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"2026-09-14","trip1End":"2026-10-08","trip1Manager":"양성호, 외주(한빛)","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"기타","region":"국내","customer":"AIT▶LGIT_구미","projectName":"iSIS-NBGA_현장 2호기 이설 셋업","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"2026-08-18","trip1End":"2026-09-04","trip1Manager":"양성호, 외주(한빛)","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"기타","region":"국내","customer":"AIT▶LGIT_구미","projectName":"iSIS-NBGA_현장 3호기 이설 셋업","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"2026-07-20","trip1End":"2026-08-07","trip1Manager":"양성호","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"완료"},{"category":"기타","region":"국내","customer":"AIT▶LGIT_구미","projectName":"iPIS-590_현장 1호기 개조+이설 셋업","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"2026-09-14","trip1End":"2026-10-08","trip1Manager":"맹준영, 외주(한빛)","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"기타","region":"국내","customer":"AIT▶LGIT_구미","projectName":"iPIS-590_현장 2호기 개조+이설 셋업","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"2026-08-18","trip1End":"2026-09-04","trip1Manager":"맹준영, 외주(한빛)","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"기타","region":"국내","customer":"AIT▶LGIT_구미","projectName":"iPIS-590_현장 3호기 개조+이설 셋업","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"2026-07-20","trip1End":"2026-08-07","trip1Manager":"맹준영","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"완료"},{"category":"기타","region":"국내","customer":"AIT▶LGIT_구미","projectName":"iVRS-100S_현장 1호기 개조+이설 셋업","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"2026-09-14","trip1End":"2026-10-08","trip1Manager":"맹준영, 외주(한빛)","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"기타","region":"국내","customer":"AIT▶LGIT_구미","projectName":"iVRS-100S_현장 2호기 개조+이설 셋업","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"2026-08-18","trip1End":"2026-09-04","trip1Manager":"맹준영, 외주(한빛)","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"기타","region":"국내","customer":"AIT▶LGIT_구미","projectName":"iVRS-100S_현장 3호기 개조+이설 셋업","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"2026-07-20","trip1End":"2026-08-07","trip1Manager":"맹준영","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"완료"},{"category":"기타","region":"국내","customer":"AIT▶LGIT_구미","projectName":"iSIS-SMTV (NTV)_현장 1호기 이설 셋업","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"2026-06-01","trip1End":"2026-06-15","trip1Manager":"양성호","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"완료"},{"category":"기타","region":"국내","customer":"SEMCO_부산","projectName":"iSIS-SMTV(CTV) Multi Sorter 기능 개선","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"기타","region":"국내","customer":"SEMCO_부산","projectName":"iSIS-NBGA Multi Sorter 기능 개선","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"기타","region":"국내","customer":"SEMCO_부산","projectName":"iSIS-NBGA 제품 들뜸 감지 기능 적용","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"기타","region":"베트남","customer":"SEMV","projectName":"iSIS-NBGA Thick Tray 대응 개조","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"2026-05-08","trip1End":"2026-06-01","trip1Manager":"장원준","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"완료"},{"category":"기타","region":"베트남","customer":"SEMV","projectName":"iPIS-590 Thick Tray 대응 개조","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"2026-05-08","trip1End":"2026-05-29","trip1Manager":"맹준영","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"완료"},{"category":"기타","region":"대만","customer":"UMTC YM","projectName":"iPIS-580M Large PKG 개조","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"2026-09-03","trip1End":"2026-09-25","trip1Manager":"이주헌","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"기타","region":"대만","customer":"UMTC YM","projectName":"VRS-100M Large PKG 개조","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"2026-09-17","trip1End":"2026-10-09","trip1Manager":"이주헌","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"기타","region":"대만","customer":"UMTC YM","projectName":"VRS-100M Large PKG 개조","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"2026-10-01","trip1End":"2026-10-23","trip1Manager":"이주헌","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"기타","region":"대만","customer":"UMTC YM","projectName":"iSIS-SMTV V3(NTV) Large PKG 개조","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"","trip1End":"","trip1Manager":"","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"발주 대기"},{"category":"기타","region":"대만","customer":"UMTC YM","projectName":"iSIS-MPSI Demo","prodUnit":"생산 1호기","customerUnit":"","serial":"","setupStart":"2026-07-13","setupEnd":"2026-08-10","setupManager":"이주헌","shipDate":"2026-08-11","trip1Start":"2026-08-19","trip1End":"2026-10-30","trip1Manager":"이주헌, 대만지사(빈센트)","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":""},{"category":"기타","region":"말레이시아","customer":"AT\u0026S P5","projectName":"iSIS-SMTV V1(#42_대여 설비); Large PKG 개조 + 셋업","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"2026-06-01","trip1End":"2026-07-01","trip1Manager":"이주헌","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"완료"},{"category":"기타","region":"오스트리아","customer":"AT\u0026S_Hub","projectName":"iSIS-NBGA_ 현장 3호기 이설 셋업; AT\u0026S_CQ(China) ▶ AT\u0026S_Hub(Austria)","prodUnit":"","customerUnit":"","serial":"","setupStart":"","setupEnd":"","setupManager":"","shipDate":"","trip1Start":"2026-06-22","trip1End":"2026-07-08","trip1Manager":"황의송","trip2Start":"","trip2End":"","trip2Manager":"","trip3Start":"","trip3End":"","trip3Manager":"","status":"완료"}];