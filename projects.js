/* ══════════════════════════════════════════
   프로젝트 관리 (마스터 프로젝트 목록) — projects.js
   BU2 "프로젝트 입력" 엑셀을 대체하는 탭.
   간트 차트(S.schedules)와는 완전히 독립된 별도 데이터(S.masterProjects)다.
   여기서 프로젝트를 등록/수정해도 간트 차트에는 자동으로 반영되지 않는다 —
   간트 차트는 이 탭과 무관하게 별도로 직접 관리한다.
══════════════════════════════════════════ */

var _mpSearch='';
// 지역/고객사/설비명(프로젝트)/상태/이관월/출하월 필터 — 각각 다중 선택 가능(배열, 빈 배열=전체)
var _mpMS={region:[],customer:[],project:[],status:[],transferMonth:[],setupMonth:[],shipMonth:[]};
var _mpSortKey='category';
var _mpSortAsc=false;
var _mpHideInactive=true;     // 완료/LOI 접수/PO 대기/PO 발행 상태 숨기고 진행중(그 외 상태·공란)만 보기 — 기본 On
var _MP_HIDDEN_STATUSES=['완료','LOI 접수','PO 대기','PO 발행'];
var _mpSelectedIds={};        // 일괄 삭제용 체크된 프로젝트 id 모음(id -> true)
var _mpViewHidden=false;     // true면 "숨긴 프로젝트" 목록만 보는 화면(숨김 해제/삭제 용도)
// 숨김 처리한(mp.hidden) 프로젝트는 삭제된 것이 아니라 데이터는 그대로 두고, 목록/홈 통계/월별 집계/엑셀/HQ 간트 어디에도
// 나오지 않게만 한다. "숨긴 항목" 화면에서 다시 찾아 숨김을 해제할 수 있다
function _mpActive(){ return S.masterProjects.filter(function(mp){return !mp.hidden;}); }
function _mpHiddenList(){ return S.masterProjects.filter(function(mp){return !!mp.hidden;}); }
function _mpViewList(){ return _mpViewHidden?_mpHiddenList():_mpActive(); }

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

// "발주 대기" 상태명을 "PO 대기"로 바꾸면서, 기존에 이미 저장된 레코드도 한 번만 자동으로 갱신
function _migrateMpStatusRename(){
  var changed=false;
  S.masterProjects.forEach(function(mp){
    if(mp.status==='발주 대기'){ mp.status='PO 대기'; _touch(mp); changed=true; }
  });
  if(changed) saveData();
}

/* ── 목록 탭 렌더 ── */
function renderProjectsTab(){
  var wrap=document.getElementById('mpWrap');
  if(!wrap) return;
  _migrateMpStatusRename();
  // 컨트롤바까지 통째로 다시 그리면 .pm-body-scroll이 새 요소로 교체되어 스크롤이 맨 위로
  // 튀어버린다(언어 변경/관리자 모드 전환/탭 재진입 등 전체 재렌더 시). 이전 위치를 기억했다가
  // 다시 그린 뒤 그대로 복원한다 — 호출부(_mpRenderTabKeepScroll 등)를 신경 쓸 필요 없이 항상 동작
  var _prevScroll=wrap.querySelector('.pm-body-scroll');
  var _sTop=_prevScroll?_prevScroll.scrollTop:0, _sLeft=_prevScroll?_prevScroll.scrollLeft:0;
  var html='<div class="pm-fixed-header">';
  html+='<div class="pm-ctrl-bar" id="mpCtrlBar">';
  html+='<div class="pm-ctrl-group">';
  html+='<span style="font-size:11px;color:#666">🔍</span>';
  html+='<input class="pm-search" id="mpSearchInp" type="text" placeholder="'+t('mpSearchPh')+'" autocomplete="off" oninput="setMpSearch(this.value)" value="'+_esc(_mpSearch)+'">';
  html+='</div>';
  html+='<div class="pm-ctrl-sep"></div>';
  html+=_mpMsHtml('region',t('mpFilterRegion'));
  html+='<div class="pm-ctrl-sep"></div>';
  html+=_mpMsHtml('customer',t('mpFilterCustomer'));
  html+='<div class="pm-ctrl-sep"></div>';
  html+=_mpMsHtml('project',t('mpFilterProject'));
  html+='<div class="pm-ctrl-sep"></div>';
  html+=_mpMsHtml('status',t('mpStatus'));
  html+='<div class="pm-ctrl-sep"></div>';
  html+=_mpMsHtml('transferMonth',t('mpFilterTransferMonth'));
  html+='<div class="pm-ctrl-sep"></div>';
  html+=_mpMsHtml('setupMonth',t('mpFilterSetupMonth'));
  html+='<div class="pm-ctrl-sep"></div>';
  html+=_mpMsHtml('shipMonth',t('mpShipMonth'));
  html+='<div class="pm-ctrl-sep"></div>';
  html+='<div class="pm-ctrl-group">';
  html+='<button class="pm-filter-btn'+(_mpHideInactive?' on':'')+'" id="mpHideInactiveBtn" onclick="togglePmHideInactive()">'+t('mpHideInactive')+'</button>';
  html+='</div>';
  html+='<div style="flex:1"></div>';
  if(!S.masterProjects.length){
    html+='<button class="btn warn sm" onclick="importExcelSeedMasterProjects()">엑셀 데이터 가져오기 (최초 1회)</button>';
  }
  var _selN=Object.keys(_mpSelectedIds).length;
  html+='<button class="btn sm" onclick="toggleMpHiddenView()" title="숨겨 둔 프로젝트를 다시 찾아 숨김 해제">'+(_mpViewHidden?'← 전체 목록으로':'🙈 숨긴 항목 ('+_mpHiddenList().length+')')+'</button>';
  html+='<button class="btn sm" id="mpBulkHideBtn" onclick="hideMpSelected()" style="display:'+(_selN>0?'inline-flex':'none')+'">'+(_mpViewHidden?'선택 숨김 해제':'선택 숨기기')+' ('+_selN+')</button>';
  html+='<button class="btn red sm" id="mpBulkDeleteBtn" onclick="deleteMpSelected()" style="display:'+(_selN>0?'inline-flex':'none')+'">선택 삭제 ('+_selN+')</button>';
  html+='<button class="btn sm" onclick="openBatchMasterProject()" title="같은 설비를 시리얼/호기만 바꿔 여러 대 한 번에 등록">+ 여러 대 등록</button>';
  html+='<button class="btn pri sm" onclick="openAddMasterProject()">'+t('mpAddProject')+'</button>';
  html+='</div>';
  html+='</div>';
  html+='<div class="pm-body-scroll"><div id="mpBody"></div></div>';
  wrap.innerHTML=html;
  renderProjectsBody();
  var _newScroll=wrap.querySelector('.pm-body-scroll');
  if(_newScroll){_newScroll.scrollTop=_sTop;_newScroll.scrollLeft=_sLeft;}
}
// 탭에 들어올 때 이번 달 줄(없으면 가장 가까운 다음 달, 그것도 없으면 마지막 달)이 화면 세로 중앙에 오게 스크롤한다
function _maCenterNow(sc,months,nowYm){
  var target=months.find(function(m){return m>=nowYm;})||months[months.length-1];
  var tr=sc.querySelector('tr[data-ym="'+target+'"]'); if(!tr) return;
  var go=function(){
    var r=tr.getBoundingClientRect(), c=sc.getBoundingClientRect();
    sc.scrollTop+=(r.top+r.height/2)-(c.top+c.height/2);
  };
  go(); requestAnimationFrame(go);
}

function setMpSearch(v){_mpSearch=v.trim().toLowerCase();renderProjectsBody();}
// 홈 대시보드 상태 카드 클릭 시 호출 — 다른 필터를 전부 초기화하고 해당 상태만 골라서
// 프로젝트 관리 탭으로 이동한다("전체" 카드는 status를 빈 값으로). 진행중만 보기가 켜져
// 있으면 완료/PO 대기 등의 상태가 가려져 아무것도 안 보일 수 있어 항상 꺼준다
function homeGoToProjectsByStatus(status){
  _mpMS={region:[],customer:[],project:[],status:status?[status]:[],transferMonth:[],setupMonth:[],shipMonth:[]};
  _mpHideInactive=false;
  _mpSearch='';
  _mpViewHidden=false;
  switchTab('projects');
}
// 홈의 지역/고객사/설비명 그래프에서 항목을 누르면 호출 — 다른 필터를 모두 초기화하고 그 값(key: region|customer|project)만 골라 프로젝트 관리로 이동한다
function homeGoToProjectsBy(key,val){
  _mpMS={region:[],customer:[],project:[],status:[],transferMonth:[],setupMonth:[],shipMonth:[]};
  _mpMS[key]=[val];
  _mpHideInactive=false;
  _mpSearch='';
  _mpViewHidden=false;
  switchTab('projects');
}
// 홈 "월별 설비 셋업 수량 / 출하 설비 수" 막대를 더블클릭하면 호출 — 다른 필터를 모두 초기화하고 그 달(key: setupMonth|shipMonth)만 골라
// 프로젝트 관리로 이동한다. 그래프는 상태와 무관하게 집계하므로 "진행중만 보기"는 끄고, 해당 일정 순으로 정렬해 보여준다
function homeGoToProjectsByMonth(key,ym){
  _mpMS={region:[],customer:[],project:[],status:[],transferMonth:[],setupMonth:[],shipMonth:[]};
  _mpMS[key]=[ym];
  _mpHideInactive=false;
  _mpSearch='';
  _mpViewHidden=false;
  _mpSortKey=(key==='setupMonth')?'transferDate':'shipDate';
  _mpSortAsc=true;
  switchTab('projects');
}
function togglePmHideInactive(){
  _mpHideInactive=!_mpHideInactive;
  // "진행중만 보기"를 켜는 순간에는 기본 화면으로 되돌린다 — 모든 필터/검색을 전체로 비우고
  // 구분 내림차순으로 정렬한다(끄는 경우는 현재 필터를 그대로 두고 완료 등까지 보여주기만 한다)
  if(_mpHideInactive){
    _mpMS={region:[],customer:[],project:[],status:[],transferMonth:[],setupMonth:[],shipMonth:[]};
    _mpSearch='';
    _mpSortKey='category'; _mpSortAsc=false;
    _mpViewHidden=false;
    renderProjectsTab();
    return;
  }
  var btn=document.getElementById('mpHideInactiveBtn');
  if(btn) btn.className='pm-filter-btn'+(_mpHideInactive?' on':'');
  renderProjectsBody();
}
function setMpSort(key){
  if(_mpSortKey===key)_mpSortAsc=!_mpSortAsc;
  else{_mpSortKey=key;_mpSortAsc=true;}
  renderProjectsBody();
}

// 고객사 요청 출하 일정이 등록되면(고객사가 출하일을 못박은 것) 그 프로젝트는 HQ 출하 예정일 대신
// 고객사 기준일로 "출하월"을 판단한다 — 상태(진행중 HQ/Field) 분류 기준과 동일한 우선순위
function _mpEffectiveShipDate(mp){ return mp.customerReqShipDate||mp.shipDate; }
function _mpShipMonth(mp){ var d=_mpEffectiveShipDate(mp); return d?d.slice(0,7):''; }
// 변경 이관일이 입력되면(이관일을 다시 조정한 것) 그 프로젝트는 원래 생산 이관일 대신
// 변경된 이관일 기준으로 "이관월"을 판단한다
function _mpEffectiveTransferDate(mp){ return mp.transferDateOverride||mp.transferDate; }
function _mpTransferMonth(mp){ var d=_mpEffectiveTransferDate(mp); return d?d.slice(0,7):''; }

// ── 다중 선택 필터(국가(지역)/고객사(사이트)/설비명(프로젝트)/상태/이관월/출하월) 공용 드롭다운 ──
var _MP_MS_DEFS={
  region:function(){
    var arr=[];
    _mpViewList().forEach(function(mp){if(mp.region&&arr.indexOf(mp.region)<0)arr.push(mp.region);});
    (typeof BASE_REGIONS!=='undefined'?BASE_REGIONS:[]).forEach(function(r){if(arr.indexOf(r)<0)arr.push(r);});
    return arr.map(function(v){return {value:v,label:tRegion(v)};});
  },
  customer:function(){
    var arr=[];
    _mpViewList().forEach(function(mp){if(mp.customer&&arr.indexOf(mp.customer)<0)arr.push(mp.customer);});
    arr.sort(function(a,b){return a.localeCompare(b,'ko');});
    return arr.map(function(v){return {value:v,label:v};});
  },
  project:function(){
    var arr=[];
    _mpViewList().forEach(function(mp){if(mp.projectName&&arr.indexOf(mp.projectName)<0)arr.push(mp.projectName);});
    arr.sort(function(a,b){return a.localeCompare(b,'ko');});
    return arr.map(function(v){return {value:v,label:v};});
  },
  status:function(){
    var arr=[];
    _mpViewList().forEach(function(mp){var st=_mpEffectiveStatus(mp);if(st&&arr.indexOf(st)<0)arr.push(st);});
    return arr.map(function(v){return {value:v,label:tStatus(v)};});
  },
  transferMonth:function(){
    var arr=[];
    _mpViewList().forEach(function(mp){var m=_mpTransferMonth(mp);if(m&&arr.indexOf(m)<0)arr.push(m);});
    arr.sort();
    return arr.map(function(v){return {value:v,label:v};});
  },
  setupMonth:function(){
    var arr=[];
    _mpViewList().forEach(function(mp){
      if(!mp.setupStart||!mp.setupEnd) return;
      var y=parseInt(mp.setupStart.slice(0,4),10), m=parseInt(mp.setupStart.slice(5,7),10), guard=0;
      var endYm=mp.setupEnd.slice(0,7);
      while(guard++<60){
        var ym=y+'-'+String(m).padStart(2,'0');
        if(ym>endYm) break;
        if(arr.indexOf(ym)<0) arr.push(ym);
        m++; if(m>12){ m=1; y++; }
      }
    });
    arr.sort();
    return arr.map(function(v){return {value:v,label:v};});
  },
  shipMonth:function(){
    var arr=[];
    _mpViewList().forEach(function(mp){var m=_mpShipMonth(mp);if(m&&arr.indexOf(m)<0)arr.push(m);});
    arr.sort();
    return arr.map(function(v){return {value:v,label:v};});
  }
};
// 이관월/셋업월/출하월은 체크 선택 말고 "년/월 ~ 년/월" 기간으로도 거를 수 있다 (_mpMS[key+'Range']={from,to}, 'YYYY-MM')
var _MP_RANGE_KEYS={transferMonth:1,setupMonth:1,shipMonth:1};
function _mpRange(key){ var r=_mpMS[key+'Range']; return (r&&(r.from||r.to))?r:null; }
function _mpRangeText(r){ return (r.from||'')+' ~ '+(r.to||''); }
function _mpInRange(r,ym){ return !!ym&&(!r.from||ym>=r.from)&&(!r.to||ym<=r.to); }
function _mpMsSummary(key){
  var sel=_mpMS[key], rg=_mpRange(key);
  if(rg){
    if(!sel.length) return _mpRangeText(rg);
    return sel.length+t('mpFilterNSelected')+' + '+_mpRangeText(rg);
  }
  if(!sel.length) return t('optAll');
  if(sel.length===1){
    var opt=_MP_MS_DEFS[key]().find(function(o){return o.value===sel[0];});
    return opt?opt.label:sel[0];
  }
  return sel.length+t('mpFilterNSelected');
}
function _mpMsOptionsHtml(key){
  var opts=_MP_MS_DEFS[key]();
  var sel=_mpMS[key];
  var rg=_mpRange(key)||{from:'',to:''};
  var html='';
  if(_MP_RANGE_KEYS[key]){
    html+='<div class="pm-ms-range" onclick="event.stopPropagation()"><div class="pm-ms-range-h">기간 직접 설정 (년/월 ~ 년/월)</div>'
      +'<div class="pm-ms-range-row"><input type="month" id="mpRg_'+key+'_f" value="'+_esc(rg.from||'')+'" onchange="_mpMsRange(\''+key+'\')">'
      +'<span>~</span><input type="month" id="mpRg_'+key+'_t" value="'+_esc(rg.to||'')+'" onchange="_mpMsRange(\''+key+'\')">'
      +'<button type="button" class="btn sm" onclick="_mpMsRangeClear(\''+key+'\')" title="기간 지우기">지우기</button></div></div>';
  }
  html+='<label class="pm-ms-opt all"><input type="checkbox" '+(sel.length===0&&!_mpRange(key)?'checked':'')+' onchange="_mpMsClearAll(\''+key+'\')">'+t('optAll')+'</label>';
  opts.forEach(function(o){
    var vAttr=String(o.value).replace(/'/g,"\\'");
    var checked=sel.indexOf(o.value)>=0;
    html+='<label class="pm-ms-opt"><input type="checkbox" '+(checked?'checked':'')+' onchange="_mpMsToggle(\''+key+'\',\''+vAttr+'\')">'+_esc(o.label)+'</label>';
  });
  return html;
}
function _mpMsHtml(key,label){
  return '<div class="pm-ctrl-group"><span class="pm-ctrl-label">'+label+'</span>'
    +'<div class="pm-ms-wrap">'
    +'<button type="button" class="pm-ms-trigger" onclick="_mpMsTogglePanel(\''+key+'\')"><span id="mpMsLbl_'+key+'">'+_esc(_mpMsSummary(key))+'</span> ▾</button>'
    +'<div class="pm-ms-panel" id="mpMsPanel_'+key+'" style="display:none">'+_mpMsOptionsHtml(key)+'</div>'
    +'</div></div>';
}
function _mpMsTogglePanel(key){
  var panel=document.getElementById('mpMsPanel_'+key);
  if(!panel) return;
  var willOpen=panel.style.display==='none';
  document.querySelectorAll('.pm-ms-panel').forEach(function(p){p.style.display='none';});
  panel.style.display=willOpen?'block':'none';
}
function _mpMsToggle(key,value){
  var arr=_mpMS[key];
  var idx=arr.indexOf(value);
  if(idx>=0) arr.splice(idx,1); else arr.push(value);
  // 상태 필터를 고르는 순간에는 "진행중만 보기"가 켜져 있으면 고른 상태(완료/PO 대기 등)가
  // 숨김 대상이라 아무것도 안 보일 수 있다 — 상태를 새로 선택하면 그 필터를 자동으로 꺼서
  // 고른 상태의 프로젝트가 바로 보이게 한다
  if(key==='status'&&idx<0&&_mpHideInactive){
    _mpHideInactive=false;
    var btn=document.getElementById('mpHideInactiveBtn');
    if(btn) btn.className='pm-filter-btn';
  }
  _mpMsRefresh(key);
  renderProjectsBody();
}
function _mpMsRange(key){
  var f=document.getElementById('mpRg_'+key+'_f'), to=document.getElementById('mpRg_'+key+'_t');
  var a=(f&&f.value)||'', b=(to&&to.value)||'';
  if(a&&b&&a>b){ var x=a; a=b; b=x; if(f) f.value=a; if(to) to.value=b; } // 거꾸로 넣으면 자동으로 바로잡는다
  if(a||b) _mpMS[key+'Range']={from:a,to:b}; else delete _mpMS[key+'Range'];
  var lbl=document.getElementById('mpMsLbl_'+key); if(lbl) lbl.textContent=_mpMsSummary(key);
  var all=document.querySelector('#mpMsPanel_'+key+' .pm-ms-opt.all input'); if(all) all.checked=(_mpMS[key].length===0&&!_mpRange(key));
  renderProjectsBody();
}
function _mpMsRangeClear(key){
  delete _mpMS[key+'Range'];
  var f=document.getElementById('mpRg_'+key+'_f'), to=document.getElementById('mpRg_'+key+'_t'); if(f) f.value=''; if(to) to.value='';
  _mpMsRange(key);
}
function _mpMsClearAll(key){
  _mpMS[key]=[]; delete _mpMS[key+'Range'];
  _mpMsRefresh(key);
  var panel=document.getElementById('mpMsPanel_'+key);
  if(panel) panel.style.display='none';
  renderProjectsBody();
}
function _mpMsRefresh(key){
  var panel=document.getElementById('mpMsPanel_'+key);
  if(panel) panel.innerHTML=_mpMsOptionsHtml(key);
  var lbl=document.getElementById('mpMsLbl_'+key);
  if(lbl) lbl.textContent=_mpMsSummary(key);
}
// 패널 바깥을 클릭하면 열려있는 다중선택 드롭다운을 닫는다
document.addEventListener('click',function(e){
  if(e.target.closest&&e.target.closest('.pm-ms-wrap')) return;
  document.querySelectorAll('.pm-ms-panel').forEach(function(p){p.style.display='none';});
});

function _mpFilteredProjects(){
  return _mpViewList().filter(function(mp){
    if(_mpMS.region.length&&_mpMS.region.indexOf(mp.region||'기타')<0)return false;
    if(_mpMS.customer.length&&_mpMS.customer.indexOf(mp.customer||'')<0)return false;
    if(_mpMS.project.length&&_mpMS.project.indexOf(mp.projectName||'')<0)return false;
    if(_mpMS.status.length&&_mpMS.status.indexOf(_mpEffectiveStatus(mp)||'')<0)return false;
    if(_mpMS.transferMonth.length&&_mpMS.transferMonth.indexOf(_mpTransferMonth(mp))<0)return false;
    if(_mpMS.setupMonth.length&&!_mpMS.setupMonth.some(function(ym){return _mpMonthOverlap(ym,mp.setupStart,mp.setupEnd);}))return false;
    if(_mpMS.shipMonth.length&&_mpMS.shipMonth.indexOf(_mpShipMonth(mp))<0)return false;
    var rgT=_mpRange('transferMonth'); if(rgT&&!_mpInRange(rgT,_mpTransferMonth(mp)))return false;
    var rgS=_mpRange('setupMonth'); // 셋업 기간이 한 달이라도 겹치면 포함
    if(rgS&&!(mp.setupStart&&mp.setupEnd&&(!rgS.to||mp.setupStart.slice(0,7)<=rgS.to)&&(!rgS.from||mp.setupEnd.slice(0,7)>=rgS.from)))return false;
    var rgH=_mpRange('shipMonth'); if(rgH&&!_mpInRange(rgH,_mpShipMonth(mp)))return false;
    if(_mpHideInactive&&!_mpViewHidden&&_MP_HIDDEN_STATUSES.indexOf(mp.status||'')>=0)return false;
    if(_mpSearch){
      var hay=[mp.customer,mp.projectName,mp.prodUnit,mp.customerUnit,mp.serial,mp.tripManager].join(' ').toLowerCase();
      if(hay.indexOf(_mpSearch)<0)return false;
    }
    return true;
  });
}
/* ── BSM 스냅샷(진행 현황·셋업 완료) — BU2 데이터와 별도 시트(BSM_SNAPSHOT, action=loadBsm)에서 읽기 전용으로 덧붙인다 ──
   BSM(service.intekplus.com/bsm)은 앱에서 직접 읽을 수 없어서, BSM에서 뽑은 시리얼별 단계·진척률을 Sheets에 스냅샷으로 저장해 두고
   시리얼로 맞춰 본다. 프로젝트 데이터(S.masterProjects)는 건드리지 않는다. */
var _mpBsm=null, _mpBsmLoading=false, _mpBsmTried=false;
function _mpBsmLoad(){
  if(_mpBsm||_mpBsmLoading||_mpBsmTried) return;
  var url=(typeof getSheetsUrl==='function')?getSheetsUrl():''; if(!url) return;
  _mpBsmLoading=true; _mpBsmTried=true;
  fetch(url+'?action=loadBsm').then(function(r){return r.json();}).then(function(d){
    if(d&&d.items) _mpBsm=d;
  }).catch(function(){}).then(function(){
    _mpBsmLoading=false;
    if(_mpBsm&&typeof _activeTab!=='undefined'&&_activeTab==='projects') renderProjectsBody();
  });
}
function _mpNz(x){ return String(x||'').replace(/\s+/g,'').toUpperCase().replace(/O/g,'0'); }
function _mpBsmItem(mp){ return (_mpBsm&&_mpBsm.items&&mp.serial)?(_mpBsm.items[_mpNz(mp.serial)]||null):null; }
function _mpFd(iso){ return iso?iso.slice(2).replace(/-/g,'.'):''; }   // 날짜는 YY.MM.DD (셋업 완료는 프로젝트에 저장된 셋업 완료일 setupDone)
// 이관→출하 일수: 음수이거나 1년을 넘으면 입력 오류일 가능성이 커서 표시하지 않는다
function _mpDaysToShip(mp){
  var a=_mpEffectiveTransferDate(mp), b=_mpEffectiveShipDate(mp); if(!a||!b) return null;
  var d=Math.round((pd(b)-pd(a))/86400000); return (d<0||d>365)?null:d;
}
var _MP_BST={d:['#e05a5a','지연'],a:['#e0972e','위험'],o:['#4aaa70','정상']};
function _mpProgHtml(mp){
  var p=_mpBsmItem(mp); if(!p) return '-';
  var b=_MP_BST[p.bst]||['#888',''];
  var tip='BSM '+(b[1]?b[1]+' · ':'')+p.wf+' · 전체 '+p.pct+'% (구매 '+p.gu+'% · 기구 '+p.ki+'% · 전장 '+p.je+'% · 셋업 '+p.se+'%)';
  return '<span title="'+_esc(tip)+'"><span class="bu-dot" style="background:'+b[0]+'"></span>'+_esc(p.wf)+' '+p.pct+'%</span>';
}

function renderProjectsBody(){
  var body=document.getElementById('mpBody');
  if(!body)return;
  _mpBsmLoad();
  var rows=_mpFilteredProjects();
  if(!rows.length){
    body.innerHTML='<div style="padding:30px 10px;text-align:center;color:#707080;font-size:13px">'
      +(_mpViewHidden?'숨긴 프로젝트가 없습니다. 목록에서 프로젝트를 선택하고 "선택 숨기기"를 누르면 여기에 모입니다.':S.masterProjects.length?'해당 조건의 프로젝트가 없습니다.':'등록된 프로젝트가 없습니다. 엑셀 데이터를 가져오거나 새로 등록하세요.')
      +'</div>';
    return;
  }
  rows.sort(function(a,b){
    var k=_mpSortKey,v;
    // 이관일/출하일은 "변경" 값이 있으면 그 값이 화면에 보이므로, 정렬도 실제 보이는(적용되는)
    // 값 기준으로 해야 화면 순서와 어긋나지 않는다. 호기는 숫자 섞인 텍스트라 숫자 크기로 비교한다
    if(k==='transferDate') v=String(_mpEffectiveTransferDate(a)||'').localeCompare(String(_mpEffectiveTransferDate(b)||''),'ko');
    else if(k==='shipDate') v=String(_mpEffectiveShipDate(a)||'').localeCompare(String(_mpEffectiveShipDate(b)||''),'ko');
    // 상태는 화면에 보이는 값(_mpEffectiveStatus: 생산중/셋업 등)을 홈 대시보드 카드와 같은 순서로 비교한다.
    // 저장값(mp.status)은 대부분 "진행중" 하나라 그대로 비교하면 정렬이 안 된다
    else if(k==='setupDone'){ v=String(a.setupDone||'9999').localeCompare(String(b.setupDone||'9999')); }
    else if(k==='daysToShip'){ var da=_mpDaysToShip(a), db=_mpDaysToShip(b); v=(da==null?99999:da)-(db==null?99999:db); }
    else if(k==='prog'){ var pa=_mpBsmItem(a), pb=_mpBsmItem(b); v=(pa?pa.pct:-1)-(pb?pb.pct:-1); }
    else if(k==='status') v=_mpStatusRank(a)-_mpStatusRank(b);
    else if(k==='prodUnit'||k==='customerUnit') v=_mpUnitCompare(a[k],b[k]);
    else v=String(a[k]||'').localeCompare(String(b[k]||''),'ko');
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

function thS(sortKey,labelKey,defaultLbl,infoText){
  var isOn=_mpSortKey===sortKey;
  var arrow=isOn?(_mpSortAsc?' ▲':' ▼'):'';
  return '<th class="'+(isOn?'on':'')+'" onclick="setMpSort(\''+sortKey+'\')">'+_colLabel(labelKey,defaultLbl)+(infoText?_mpInfoIconHtml(infoText):'')+arrow+'</th>';
}
function thP(labelKey,defaultLbl,infoText){
  return '<th>'+_colLabel(labelKey,defaultLbl)+(infoText?_mpInfoIconHtml(infoText):'')+'</th>';
}
// 열 제목 옆에 붙는 안내 아이콘 — 데스크탑은 호버, 모바일은 탭으로 같은 툴팁을 보여준다
function _mpInfoIconHtml(text){
  var esc=text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  return ' <span class="mp-info-icon" data-tip="'+esc+'" onmouseenter="_mpShowInfoTip(this)" onmouseleave="_mpHideInfoTip()" onclick="event.stopPropagation();_mpToggleInfoTip(this)">ⓘ</span>';
}
function _mpShowInfoTip(el){
  var tip=el.getAttribute('data-tip');
  if(!tip) return;
  var tt=document.getElementById('mp-info-tt');
  if(!tt){ tt=document.createElement('div'); tt.id='mp-info-tt'; tt.className='mp-info-tooltip'; document.body.appendChild(tt); }
  tt.textContent=tip;
  tt.style.display='block';
  tt._forEl=el;
  var rect=el.getBoundingClientRect();
  var top=rect.bottom+6, left=rect.left;
  tt.style.top=top+'px'; tt.style.left=left+'px';
  var w=tt.offsetWidth;
  if(left+w>window.innerWidth-8) tt.style.left=Math.max(8,window.innerWidth-w-8)+'px';
}
function _mpHideInfoTip(){
  var tt=document.getElementById('mp-info-tt');
  if(tt){ tt.style.display='none'; tt._forEl=null; }
}
// 탭(터치)용 — 같은 아이콘을 다시 탭하면 닫히고, 다른 아이콘을 탭하면 그쪽으로 옮겨간다
function _mpToggleInfoTip(el){
  var tt=document.getElementById('mp-info-tt');
  if(tt&&tt.style.display==='block'&&tt._forEl===el){ _mpHideInfoTip(); return; }
  _mpShowInfoTip(el);
}
// 터치 환경은 mouseleave가 없으므로, 아이콘 바깥을 탭하면 열려있는 안내 툴팁을 닫는다
document.addEventListener('click',function(e){
  if(e.target.closest&&(e.target.closest('[data-tip]')||e.target.closest('.mp-info-tooltip'))) return;
  _mpHideInfoTip();
});
// 관리자 모드에서 표 제목을 자유롭게 바꿀 수 있게 하는 커스텀 오버라이드 (Sheets에 저장되어 모든 접속자에게 반영)
function _colLabel(key,defaultLbl){
  // 관리자 커스텀 제목은 한국어 화면에서만 적용한다. 다른 언어를 선택하면 항상 기본
  // 번역(defaultLbl)을 보여준다 — 커스텀 문구는 번역이 없어 다국어 전환이 안 되기 때문
  if(typeof _lang!=='undefined'&&_lang!=='ko')return defaultLbl;
  var ov=(S.labelOverrides||{})[key];
  if(ov===undefined||ov==='')return defaultLbl;
  // '/'를 줄바꿈 구분자로 써서 두 줄 이상으로도 표시할 수 있게 함 (예: "고객사 요청/설비 출하 일정")
  return ov.split('/').map(_esc).join('<br>');
}

function renderProjectsTable(rows){
  var html='<table class="pm-person-table mp-t"><thead><tr>';
  var _allSelected=rows.length>0&&rows.every(function(mp){return !!_mpSelectedIds[mp.id];});
  html+='<th style="width:28px"><input type="checkbox" '+(_allSelected?'checked':'')+' onclick="event.stopPropagation()" onchange="toggleMpSelectAll(this.checked)" title="화면에 보이는 전체 선택"></th>';
  // 열: 구분 · 고객사 · 설비명 · 시리얼 · 생산 호기(현장 호기) · 이관일 · 셋업 장소 · 셋업 완료 · 출하일 · 이관→출하 · 진행 현황 · 출장 담당자 · 상태 (날짜는 YY.MM.DD)
  html+=thS('category','colCategory',t('colCategory'))+thS('customer','colCustomerHdr',t('mpCustomer'))+thS('projectName','colProject',t('colProject'));
  html+=thS('serial','colSerialNo','설비 시리얼 넘버');
  html+=thS('prodUnit','colUnitCombined2',(typeof _lang!=='undefined'&&_lang!=='ko')?t('colUnitCombined'):'생산 호기(현장 호기)');
  html+=thS('transferDate','colTransferDay','이관일');
  html+=thS('setupLocation','colSetupLocation',t('colSetupLocation'));
  html+=thS('setupDone','colSetupDone2','셋업 완료','셋업 완료일 — 기본값은 출하일 2일 전이며, 수정 창에서 직접 바꿀 수 있습니다');
  html+=thS('shipDate','colShipDay','출하일');
  html+=thS('daysToShip','colTransferToShip','이관→출하','이관일부터 출하일까지 일수');
  html+=thS('prog','colProgress','진행 현황','BSM 진행 단계와 전체 진척률'+((_mpBsm&&_mpBsm.updated)?(' (BSM 스냅샷 '+_mpBsm.updated.slice(0,10)+' 기준)'):''));
  html+=thS('tripManager','colTripManager',t('colTripManager'));
  html+=thS('status','colStatusHdr',t('mpStatus'));
  html+='</tr></thead><tbody>';
  rows.forEach(function(mp){html+=renderProjectRow(mp);});
  html+='</tbody></table>';
  return html;
}

// 구분/상태 값에 따라 색상 배지로 표시 (모르는 값이면 배지 없이 텍스트만 표시)
var _MP_CATEGORY_BADGE_STYLE={
  'Repeat Order':'background:#1a3a5a;color:#7aafee;border:1px solid #2a5a8a',
  '신규 개발':'background:#2e2050;color:#b39ddb;border:1px solid #4a3a80',
  '기타':'background:#3a2a10;color:#e0972e;border:1px solid #6a4a1a'
};
var _MP_STATUS_BADGE_STYLE={
  '생산중(HQ)':'background:#3a2a10;color:#e0972e;border:1px solid #6a4a1a',
  '셋업(HQ)':'background:#1a3a5a;color:#5a9aee;border:1px solid #2a5a8a',
  '셋업(Field)':'background:#1a4a2a;color:#4aaa70;border:1px solid #2a6a3a',
  '완료':'background:var(--bg-hover);color:var(--tx-dim);border:1px solid var(--bd-main)',
  'PO 대기':'background:#3a3010;color:#d4b02e;border:1px solid #6a5a1a',
  'PO 발행':'background:#2a1a4a;color:#b39ddb;border:1px solid #4a3080',
  'LOI 접수':'background:#103a3a;color:#2ecccc;border:1px solid #1a6a6a'
};
// 저장된 상태값 자체는 "진행중"으로 하나지만, 화면에는 날짜를 기준으로 세 가지로 나눠서 보여준다 —
// 일정만 등록/변경하면 상태 분류가 자동으로 바뀌므로 수동으로 고를 필요가 없다.
//  · 출하 일정(고객사 요청 출하 일정이 있으면 그 날짜)이 이미 지났으면      → 셋업(Field)
//  · 그 전이면서 생산 이관일(변경 이관일이 있으면 그 날짜) 당일 이전이면      → 생산중(HQ)
//  · 그 전이면서 생산 이관일 다음 날부터                                    → 셋업(HQ)
// 이관일이 아직 없으면 아직 이관 전이므로 생산중(HQ)으로 본다
function _mpEffectiveStatus(mp){
  if(mp.status==='진행중'){
    var ship=_mpEffectiveShipDate(mp);
    if(ship&&pd(ship)<TODAY) return '셋업(Field)';
    var tr=_mpEffectiveTransferDate(mp);
    return (tr&&pd(tr)<TODAY)?'셋업(HQ)':'생산중(HQ)';
  }
  return mp.status;
}
function _mpStatusRank(mp){
  var i=HOME_STATUS_ORDER.indexOf(_mpEffectiveStatus(mp));
  return i<0?HOME_STATUS_ORDER.length:i;
}
function _mpBadge(val,styleMap,label){
  if(!val)return '';
  var st=styleMap[val];
  var disp=(label!==undefined)?label:val;
  if(!st)return _esc(disp);
  return '<span style="'+st+';padding:3px 10px;border-radius:5px;font-size:12px;font-weight:500;white-space:nowrap">'+_esc(disp)+'</span>';
}
function _mpCategoryBadge(cat){ return _mpBadge(cat,_MP_CATEGORY_BADGE_STYLE); }
function _mpStatusBadge(st){ return _mpBadge(st,_MP_STATUS_BADGE_STYLE,tStatus(st)); }

function renderProjectRow(mp){
  // 생산 호기는 입력값에 "생산"을 붙이지 않고 저장(예: "70호기")하므로, 화면 표시할 때만 "생산 "을 붙인다
  var prodLbl=mp.prodUnit?('생산 '+mp.prodUnit):'';
  var unitLbl=(prodLbl&&mp.customerUnit)?(prodLbl+'_(현장 '+mp.customerUnit+')'):(prodLbl||(mp.customerUnit?('현장 '+mp.customerUnit):''));
  // 이관일/출하일은 "변경" 값(override)이 있으면 그 값을, 없으면 최초 등록값을 보여준다(_mpEffectiveTransferDate/_mpEffectiveShipDate).
  // 날짜는 모두 YY.MM.DD. 셋업 완료는 저장된 셋업 완료일(기본: 출하일 2일 전).
  var transferLbl=_mpFd(_mpEffectiveTransferDate(mp))||'-';
  var shipLbl=_mpFd(_mpEffectiveShipDate(mp))||'-';
  var doneLbl=_mpFd(mp.setupDone)||'-';
  var days=_mpDaysToShip(mp);
  // 수정은 시리얼 넘버를 클릭했을 때만 가능하다(행 클릭/수정 버튼 없음). 시리얼이 비어있는 행도
  // 수정할 수 있도록 빈 값일 땐 "(미입력)"을 같은 링크 모양으로 보여준다
  var serialCell='<span class="mp-serial-link" onclick="openEditMasterProject(\''+mp.id+'\')" title="클릭하여 수정">'+(mp.serial?_esc(mp.serial):'(미입력)')+'</span>';
  return '<tr class="pm-person-row">'
    +'<td><input type="checkbox" '+(_mpSelectedIds[mp.id]?'checked':'')+' onchange="toggleMpRowSelect(\''+mp.id+'\',this.checked)"></td>'
    +'<td>'+_mpCategoryBadge(mp.category)+'</td>'
    +'<td class="mp-ell mp-c-cust" title="'+_esc(mp.customer||'')+'">'+_esc(mp.customer||'')+'</td>'
    +'<td class="mp-ell mp-c-proj" title="'+_esc(mp.projectName||'')+'">'+_esc(mp.projectName||'')+'</td>'
    +'<td>'+serialCell+'</td>'
    +'<td>'+_esc(unitLbl)+'</td>'
    +'<td>'+transferLbl+'</td>'
    +'<td class="mp-ell mp-c-loc" title="'+_esc(mp.setupLocation||'')+'">'+_esc(mp.setupLocation||'-')+'</td>'
    +'<td>'+doneLbl+'</td>'
    +'<td>'+shipLbl+'</td>'
    +'<td>'+(days==null?'-':days+'일')+'</td>'
    +'<td>'+_mpProgHtml(mp)+'</td>'
    +'<td class="mp-ell mp-c-mgr" title="'+_esc(mp.tripManager||'')+'">'+_esc(mp.tripManager||'-')+'</td>'
    +'<td>'+_mpStatusBadge(_mpEffectiveStatus(mp))+'</td>'
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
// 셋업 시작일을 입력/수정할 때 생산 이관일 칸이 비어있으면 "시작일 - 1일"을 자동으로 채워준다
// (이미 값이 있으면 건드리지 않음 — 직접 입력/수정한 값을 덮어쓰지 않기 위함)
function _mpWireTransferAutofill(){
  var transferEl=document.getElementById('mp_transferDate'), shipEl=document.getElementById('mp_shipDate'), doneEl=document.getElementById('mp_setupDone');
  var startEl=document.getElementById('mp_setupStart'), endEl=document.getElementById('mp_setupEnd');
  if(!transferEl||!shipEl||!doneEl) return;
  // 셋업 완료일을 직접 고치지 않았다면(비어 있거나 출하일 2일 전과 같으면) 출하일을 바꿀 때 같이 따라간다
  var auto=!doneEl.value||(shipEl.value&&doneEl.value===_addDaysStr(shipEl.value,-2));
  doneEl.addEventListener('input',function(){ auto=false; });
  shipEl.addEventListener('change',function(){ if(auto&&shipEl.value) doneEl.value=_addDaysStr(shipEl.value,-2); });
  // 이관일을 입력하면 비어 있는 셋업 시작을 이관일 다음날로
  transferEl.addEventListener('change',function(){ if(startEl&&!startEl.value&&transferEl.value) startEl.value=_addDaysStr(transferEl.value,1); });
}
function openAddMasterProject(){
  mw(_mpFormHtml(null),true);
  _mpWireTransferAutofill();
  setTimeout(function(){var el=document.getElementById('mp_customer');if(el)el.focus();},50);
}
function openEditMasterProject(id){
  var mp=S.masterProjects.find(function(m){return m.id===id;});
  if(!mp)return;
  mw(_mpFormHtml(mp),true);
  _mpWireTransferAutofill();
}
function _mpFormHtml(mp){
  var ie=!!mp;
  function v(f){return ie?_esc(mp[f]||''):'';}
  function dateFld(id,label,val){
    return '<div class="fg"><label class="fl">'+label+'</label><input type="date" id="'+id+'" value="'+_esc(val||'')+'"></div>';
  }
  function txt(id,label,val,extra){
    return '<div class="fg"><label class="fl">'+label+'</label><input type="text" id="'+id+'" value="'+val+'" autocomplete="off"'+(extra||'')+'></div>';
  }
  function sec(t){return '<div class="mp-sec">'+t+'</div>';}
  // 이관일/출하일은 입력칸 하나 — 현재 적용되는 값(변경값이 있으면 그 값)을 보여준다
  var effT=ie?_mpEffectiveTransferDate(mp):'', effS=ie?_mpEffectiveShipDate(mp):'';
  var html='<div class="mtit">'+(ie?'프로젝트 수정':'프로젝트 등록')+'</div>';
  html+=sec('기본 정보');
  html+='<div class="mp-grid mp-g2">'
    +'<div class="fg"><label class="fl">구분</label><input type="text" id="mp_category" value="'+v('category')+'" list="mp_category_list" autocomplete="off"></div>'
    +'<div class="fg"><label class="fl">지역</label>'+_mpRegionFieldHtml(ie?mp.region:'')+'</div>'
    +txt('mp_customer','고객사',v('customer'))+txt('mp_projectName','프로젝트(설비명)',v('projectName'))
    +'</div>';
  html+='<datalist id="mp_category_list"><option value="Repeat Order"><option value="신규 개발"><option value="기타"></datalist>';
  html+='<div class="mp-grid mp-g3">'
    +txt('mp_serial','설비 시리얼 넘버',v('serial'))
    +txt('mp_prodUnit','생산 호기',v('prodUnit'),' placeholder="예: 70호기 (\'생산\' 제외)"')
    +txt('mp_customerUnit','현장 호기',v('customerUnit'))
    +'</div>';
  html+=sec('일정');
  html+='<div class="mp-grid mp-g3">'
    +dateFld('mp_transferDate','이관일',effT)+dateFld('mp_setupDone','셋업 완료일',ie?mp.setupDone:'')+dateFld('mp_shipDate','출하일',effS)
    +'</div>';
  html+='<div class="mp-hint">셋업 완료일은 출하일 2일 전이 기본값입니다. 출하일을 바꾸면(셋업 완료일을 직접 고치지 않은 경우) 자동으로 따라갑니다.</div>';
  html+=sec('셋업 · 출장');
  html+='<div class="mp-grid mp-g3">'
    +txt('mp_setupLocation','셋업 장소',v('setupLocation'))+txt('mp_setupManager','셋업 담당자',v('setupManager'))+txt('mp_tripManager','출장 담당자',v('tripManager'))
    +'</div>';
  html+='<details class="mp-adv"><summary>본사 셋업 기간 <span>(HQ 셋업 간트 · 월별 집계용)</span></summary>'
    +'<div class="mp-grid mp-g2">'+dateFld('mp_setupStart','시작',ie?mp.setupStart:'')+dateFld('mp_setupEnd','종료',ie?mp.setupEnd:'')+'</div>'
    +'<div class="mp-hint">비워 두면 시작은 이관일 다음날, 종료는 셋업 완료일로 자동 입력됩니다.</div></details>';
  html+='<div class="fg" style="margin-top:14px"><label class="fl">상태</label><input type="text" id="mp_status" value="'+v('status')+'" list="mp_status_list" autocomplete="off"></div>';
  html+='<datalist id="mp_status_list"><option value="진행중"><option value="완료"><option value="PO 대기"><option value="PO 발행"><option value="LOI 접수"></datalist>';
  html+='<div class="mfoot">';
  if(ie) html+='<button class="btn red sm" onclick="delMasterProject(\''+mp.id+'\')">삭제</button>'
    +'<button class="btn sm" onclick="openBatchMasterProject(\''+mp.id+'\')" title="이 프로젝트와 같은 내용으로 시리얼/호기만 바꿔 새로 등록">복제</button>'
    +'<button class="btn sm" onclick="toggleMpHidden(\''+mp.id+'\')" title="삭제하지 않고 목록/통계에서 감춥니다. 목록 위 \'숨긴 항목\'에서 다시 찾을 수 있습니다." style="margin-right:auto">'+(mp.hidden?'숨김 해제':'숨기기')+'</button>';
  html+='<button class="btn sm" onclick="cm()">취소</button>';
  html+='<button class="btn sm pri" onclick="'+(ie?('saveEditMasterProject(\''+mp.id+'\')'):'saveAddMasterProject()')+'">'+(ie?'저장':'등록')+'</button>';
  html+='</div>';
  return html;
}

function _mpReadForm(){
  function v(id){var el=document.getElementById(id);return el?el.value.trim():'';}
  // 이관일·출하일은 입력칸이 하나다(현재 적용되는 값). 저장할 때 _mpAssignDates가 최초값/변경값 중 맞는 쪽에 넣는다
  return {
    category:v('mp_category'), region:_mpReadRegionField(), customer:v('mp_customer'), projectName:v('mp_projectName'),
    prodUnit:v('mp_prodUnit'), customerUnit:v('mp_customerUnit'), serial:v('mp_serial'),
    setupStart:v('mp_setupStart'), setupEnd:v('mp_setupEnd'), setupManager:v('mp_setupManager'), setupLocation:v('mp_setupLocation'),
    tripManager:v('mp_tripManager'), setupDone:v('mp_setupDone'),
    transferDate:v('mp_transferDate'), shipDate:v('mp_shipDate'),
    status:v('mp_status')
  };
}
// 하나로 합친 이관일/출하일을 프로젝트에 넣는다: "변경" 값이 이미 있으면 그 값을 고치고(최초값은 기록으로 남김), 없으면 최초값 칸에 넣는다
function _mpAssignDates(mp,f){
  var tv=f.transferDate, sv=f.shipDate; delete f.transferDate; delete f.shipDate;
  Object.keys(f).forEach(function(k){mp[k]=f[k];});
  var oldT=_mpEffectiveTransferDate(mp);
  if(mp.transferDateOverride){ mp.transferDateOverride=tv; if(tv&&tv!==oldT) mp.setupStart=_addDaysStr(tv,1); } else mp.transferDate=tv;
  if(mp.customerReqShipDate) mp.customerReqShipDate=sv; else mp.shipDate=sv;
  if(mp.transferDateOverride===undefined) mp.transferDateOverride='';
  if(mp.customerReqShipDate===undefined) mp.customerReqShipDate='';
  var eT=_mpEffectiveTransferDate(mp), eS=_mpEffectiveShipDate(mp);
  // 비어 있는 칸은 자동으로 채운다: 셋업 완료일=출하일 2일 전, 셋업 시작=이관일 다음날, 셋업 종료=셋업 완료일
  if(!mp.setupDone&&eS) mp.setupDone=_addDaysStr(eS,-2);
  if(!mp.setupStart&&eT) mp.setupStart=_addDaysStr(eT,1);
  if(!mp.setupEnd&&mp.setupDone) mp.setupEnd=mp.setupDone;
  if(!mp.transferDate&&!mp.transferDateOverride&&mp.setupStart) mp.transferDate=_addDaysStr(mp.setupStart,-1);
  return mp;
}
// 변경 이관일이 입력되어 있으면, 본사 셋업 시작일을 그 다음날로 자동 맞춘다
// (생산 이관일 자체는 이제 폼에서 직접 입력/수정하는 일반 필드다 — renderProjectRow는 저장된 값을 그대로 보여준다)
// renderProjectsTab() 자체가 스크롤 위치를 기억했다가 복원하므로 그냥 호출하면 된다
// (예전엔 이 함수에서 직접 처리했으나 모든 재렌더 경로에 적용되도록 renderProjectsTab()으로 옮김)
function _mpRenderTabKeepScroll(){
  renderProjectsTab();
}
function saveAddMasterProject(){
  var f=_mpReadForm();
  if(!f.customer){alert('고객사를 입력해주세요.');return;}
  var mp={transferDateOverride:'',customerReqShipDate:''};
  _mpAssignDates(mp,f);
  _touch(mp);
  mp.id=_mpId();
  S.masterProjects.push(mp);
  saveData();cm();_mpRenderTabKeepScroll();
}
function saveEditMasterProject(id){
  var mp=S.masterProjects.find(function(m){return m.id===id;});
  if(!mp)return;
  var f=_mpReadForm();
  if(!f.customer){alert('고객사를 입력해주세요.');return;}
  _mpAssignDates(mp,f);
  _touch(mp);
  saveData();cm();_mpRenderTabKeepScroll();
}
function delMasterProject(id){
  if(!confirm('이 프로젝트 항목을 삭제하시겠습니까?'))return;
  S.masterProjects=S.masterProjects.filter(function(m){return m.id!==id;});
  _markDeleted('masterProjects',id);
  saveData();cm();_mpRenderTabKeepScroll();
}

/* ── 여러 프로젝트 한번에 선택/삭제 ── */
function _mpUpdateBulkBar(){
  var btn=document.getElementById('mpBulkDeleteBtn');
  if(!btn) return;
  var n=Object.keys(_mpSelectedIds).length;
  btn.style.display=n>0?'inline-flex':'none';
  btn.textContent='선택 삭제 ('+n+')';
  var hb=document.getElementById('mpBulkHideBtn');
  if(hb){
    hb.style.display=n>0?'inline-flex':'none';
    hb.textContent=(_mpViewHidden?'선택 숨김 해제':'선택 숨기기')+' ('+n+')';
  }
}
// 선택한 프로젝트를 숨기거나(일반 화면) 숨김을 해제한다(숨긴 항목 화면). 삭제와 달리 데이터는 그대로 남는다
function hideMpSelected(){
  var ids=Object.keys(_mpSelectedIds);
  if(!ids.length) return;
  var hide=!_mpViewHidden;
  S.masterProjects.forEach(function(mp){
    if(!_mpSelectedIds[mp.id]) return;
    if(hide) mp.hidden=true; else delete mp.hidden;
    _touch(mp);
  });
  _mpSelectedIds={};
  saveData();
  renderProjectsTab();
}
// 프로젝트 수정 창의 숨기기 / 숨김 해제 버튼
function toggleMpHidden(id){
  var mp=S.masterProjects.find(function(m){return m.id===id;});
  if(!mp) return;
  if(mp.hidden) delete mp.hidden; else mp.hidden=true;
  _touch(mp);
  saveData(); cm();
  _mpSelectedIds={};
  renderProjectsTab();
}
function toggleMpHiddenView(){
  _mpViewHidden=!_mpViewHidden;
  _mpSelectedIds={};
  renderProjectsTab();
}
function toggleMpRowSelect(id,checked){
  if(checked) _mpSelectedIds[id]=true; else delete _mpSelectedIds[id];
  _mpUpdateBulkBar();
}
// 헤더 체크박스 — 현재 필터 조건으로 화면에 보이는 행만 기준으로 전체 선택/해제한다
function toggleMpSelectAll(checked){
  _mpFilteredProjects().forEach(function(mp){
    if(checked) _mpSelectedIds[mp.id]=true; else delete _mpSelectedIds[mp.id];
  });
  renderProjectsBody();
  _mpUpdateBulkBar();
}
function deleteMpSelected(){
  var ids=Object.keys(_mpSelectedIds);
  if(!ids.length) return;
  if(!confirm(ids.length+'개 프로젝트 항목을 삭제하시겠습니까? 되돌릴 수 없습니다.'))return;
  ids.forEach(function(id){ _markDeleted('masterProjects',id); });
  S.masterProjects=S.masterProjects.filter(function(m){return !_mpSelectedIds[m.id];});
  _mpSelectedIds={};
  saveData();_mpRenderTabKeepScroll();
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
function renderMonthlyAggTab(centerNow){
  var sidebar=document.getElementById('aggSidebar');
  var main=document.getElementById('aggMain');
  if(sidebar)sidebar.innerHTML='';
  if(!main)return;
  var _prevScroll=document.getElementById('maScroll');
  var _sTop=_prevScroll?_prevScroll.scrollTop:0, _sLeft=_prevScroll?_prevScroll.scrollLeft:0;
  var months=_mpAllMonths();
  if(!months.length){
    main.innerHTML='<div style="padding:40px;text-align:center;color:#707080">집계할 프로젝트 데이터가 없습니다. "프로젝트 관리" 탭에서 데이터를 등록하거나 가져오세요.</div>';
    return;
  }
  var html='<div id="maScroll" style="overflow:auto;flex:1;padding:0 12px 12px">';
  html+='<table class="pm-person-table" style="margin-top:12px"><thead><tr>'
    +'<th>'+t('maMonth')+'</th><th>'+t('maHqCount')+'</th><th>'+t('maHqList')+'</th>'
    +'<th>'+t('maSiteCount')+'</th><th>'+t('maSiteList')+'</th>'
    +'<th>'+t('maPeople')+'</th><th>'+t('maPeopleList')+'</th></tr></thead><tbody>';
  var nowYm=TODAY.getFullYear()+'-'+String(TODAY.getMonth()+1).padStart(2,'0');
  months.forEach(function(ym){
    var hq=_mpMonthGroup(ym,'hq');
    var site=_mpMonthGroup(ym,'site');
    var people=_mpMonthTravelers(ym);
    html+='<tr class="pm-person-row'+(ym===nowYm?' ma-cur':'')+'" data-ym="'+ym+'">'
      +'<td>'+ym+'</td>'
      +'<td>'+hq.count+'</td><td style="white-space:pre-line;font-size:11px;text-align:left">'+_esc(hq.list.join('\n'))+'</td>'
      +'<td>'+site.count+'</td><td style="white-space:pre-line;font-size:11px;text-align:left">'+_esc(site.list.join('\n'))+'</td>'
      +'<td>'+people.count+'</td><td style="white-space:pre-line;font-size:11px;text-align:left">'+_esc(people.list.join('\n'))+'</td>'
      +'</tr>';
  });
  html+='</tbody></table></div>';
  main.innerHTML=html;
  var _newScroll=document.getElementById('maScroll');
  if(_newScroll){_newScroll.scrollTop=_sTop;_newScroll.scrollLeft=_sLeft;}
  if(centerNow&&_newScroll) _maCenterNow(_newScroll,months,nowYm);
}
function _mpAllMonths(){
  var min=null,max=null;
  _mpActive().forEach(function(mp){
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
// 프로젝트(설비)명에 "1,2호기"처럼 여러 호기가 적혀 있으면 그 호기 수만큼의 대수로 센다 (괄호 안 "(생산 1,2호기)"는 무시)
// 예) "iPIS-HL1000 1,2호기(생산 1,2호기)" → 2대, "1~3호기" → 3대, "70호기" → 1대, 호기 표기가 없으면 1대
function _mpUnitCount(name){
  var m=String(name||'').replace(/[(（]\s*생산[^)）]*[)）]/g,'').match(/(#?\d+(?:\s*[,，~～]\s*#?\d+)*)\s*호기/);
  if(!m) return 1;
  var n=0;
  m[1].split(/[,，]/).forEach(function(tok){
    var r=tok.split(/[~～]/).map(function(x){return parseInt(x.replace('#',''),10);});
    n+=(r.length>1&&r[1]>=r[0]&&r[1]-r[0]<50)?(r[1]-r[0]+1):1;
  });
  return n||1;
}
function _mpMonthGroup(ym,phase){
  var groups={};
  if(phase==='hq'){
    _mpActive().forEach(function(mp){
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
      groups[key]=(groups[key]||0)+_mpUnitCount(proj.name);
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