/* ════════════════════════════════════════════
   설비 진행율 탭
════════════════════════════════════════════ */
var _equipEditMode=false;
// 필터 상태(상단 필터 행): 국가 / 고객사(사이트 id) / 설비명(라인) / 셋업 위치 — 각각 여러 개 선택 가능, 빈 배열=전체
var _eqMS={region:[],site:[],line:[],loc:[]};
function _eqAnyFilter(){ return !!(_eqMS.region.length||_eqMS.site.length||_eqMS.line.length||_eqMS.loc.length); }
// 셋업 위치 필터 — 프로젝트 관리의 "셋업 장소"(본사/트리엔(구미)/JTN(천안)/센트로닉스)로 호기를 거른다.
var _EQ_LOCS=[
  {key:'본사',label:'본사(대전)'},
  {key:'트리엔',label:'트리엔(구미)'},
  {key:'JTN',label:'JTN(천안)'},
  {key:'센트로닉스',label:'센트로닉스(천안)'}
];
function _eqLocKeyOf(str){
  str=String(str||'').trim();
  for(var i=0;i<_EQ_LOCS.length;i++) if(str.indexOf(_EQ_LOCS[i].key)===0) return _EQ_LOCS[i].key;
  return '';
}
// 국가·고객사·설비명·셋업 위치 필터를 모두 통과하는지
function _eqUnitPassFilters(u){
  if(_eqMS.site.length&&_eqMS.site.indexOf(u.siteId)<0) return false;
  if(_eqMS.region.length){ var s=_eqSite(u.siteId); if(!s||_eqMS.region.indexOf(s.country||'기타')<0) return false; }
  if(_eqMS.line.length&&_eqMS.line.indexOf((u.lineName||'').trim())<0) return false;
  if(_eqMS.loc.length&&_eqMS.loc.indexOf(_eqLocKeyOf(u.autoLoc))<0) return false;
  return true;
}
// 출하까지 체크된("설비 출하" 칸 완료) 호기 = HQ 설비 셋업 완료 → 기본으로 숨기고, "완료 보기"를 누르면 보인다
var _eqShowDone=false;
function _eqShipDone(u){
  var item=S.equipItems.find(function(i){return i.name==='설비 출하'&&(i.groupName||'')==='본사 셋업';});
  var c=item&&u.cells?u.cells[item.id]:null;
  return !!(c&&!c.na&&(parseFloat(c.percent)||0)>=100);
}
function _eqUnitShown(u){ return _eqShowDone||!_eqShipDone(u); }   // 완료 숨김 규칙만 적용
function _eqUnitVisible(u){ return _eqUnitPassFilters(u)&&_eqUnitShown(u); }
function _eqVisibleUnits(){ return S.equipUnits.filter(_eqUnitVisible); }
function toggleEquipDone(){ _eqShowDone=!_eqShowDone; renderEquipTab(); }
var _EQUIP_COLLAPSED_LS_KEY='bu2_equip_collapsed';
var _equipCollapsed=(function(){
  try{return JSON.parse(localStorage.getItem(_EQUIP_COLLAPSED_LS_KEY)||'{}')||{};}catch(e){return {};}
})();
function _saveEquipCollapsed(){
  try{localStorage.setItem(_EQUIP_COLLAPSED_LS_KEY,JSON.stringify(_equipCollapsed));}catch(e){}
}
var PROJ_TYPE_COLOR={'납품셋업':'#1a55bb','개조':'#aa6000','이설':'#1a7a3a','개발':'#7a1a99','본사셋업':'#1a9999'};
var PROJ_TYPES=['납품셋업','개조','이설','개발','본사셋업'];
var _CUSTOM_TYPE_PALETTE=['#b0182f','#4a4a4a','#8a6d1a','#1a4a8a','#6d1a4a','#2a8a6d','#8a3a1a','#3a3a8a'];
function _typeColor(type){
  if(PROJ_TYPE_COLOR[type]) return PROJ_TYPE_COLOR[type];
  var h=0;
  for(var i=0;i<type.length;i++) h=(h*31+type.charCodeAt(i))>>>0;
  return _CUSTOM_TYPE_PALETTE[h%_CUSTOM_TYPE_PALETTE.length];
}
function _allProjTypes(){
  var extra=[];
  (S.equipProjects||[]).forEach(function(p){if(p.projType&&PROJ_TYPES.indexOf(p.projType)<0&&extra.indexOf(p.projType)<0)extra.push(p.projType);});
  (S.equipUnits||[]).forEach(function(u){if(u.unitType&&PROJ_TYPES.indexOf(u.unitType)<0&&extra.indexOf(u.unitType)<0)extra.push(u.unitType);});
  return PROJ_TYPES.concat(extra);
}

/* ── 프로젝트 담당자 (역할별 5종) ── */
var EQUIP_MGR_ROLES=[
  ['mgrHq','본사 셋업'],
  ['mgrTravel','출장 셋업'],
  ['mgrOutsource','외주 담당자'],
  ['mgrHost','Host 담당자'],
  ['mgrVision','Vision 담당자']
];
function _equipMgrFieldsHtml(idPrefix,proj){
  var html='';
  EQUIP_MGR_ROLES.forEach(function(r){
    var val=proj?(proj[r[0]]||''):'';
    html+='<div class="fg"><label class="fl">'+r[1]+' (여러 명은 쉼표로 구분)</label>'
      +'<input type="text" id="'+idPrefix+r[0]+'" value="'+val+'" placeholder="예: 홍길동, 김철수" autocorrect="off" autocomplete="off" spellcheck="false"></div>';
  });
  return html;
}
function _readEquipMgrFields(idPrefix,proj){
  EQUIP_MGR_ROLES.forEach(function(r){
    var el=document.getElementById(idPrefix+r[0]);
    proj[r[0]]=el?el.value.trim():'';
  });
}
// 프로젝트 행에 표시할 역할별 담당자 칩 HTML (값이 있는 역할만 표시)
function _equipMgrDisplayHtml(proj){
  var lines=[];
  EQUIP_MGR_ROLES.forEach(function(r){
    var names=(proj[r[0]]||'').split(',').map(function(n){return n.trim();}).filter(Boolean);
    if(!names.length) return;
    lines.push('<span class="eq-proj-mgr-grp">'+r[1]+': '
      +names.map(function(n){return '<span class="eq-chip hq">'+n+'</span>';}).join('')
      +'</span>');
  });
  return lines.length?'<div class="eq-proj-mgrs">'+lines.join('')+'</div>':'';
}
var _dragEquipSiteId=null;
var _EQUIP_SITE_GROUPS=[
  {label:'LG (미국)',   ids:['ESHD','ESMI','ESHG','MILS','UC2','BOSK_TN']},
  {label:'LG (캐나다)', ids:['ESOT']},
  {label:'현대JV',      ids:['현대JV']},
  {label:'중국',        ids:['ESNA','ESNB','DSBJ','SDD']},
  {label:'베트남',      ids:['SDV']},
  {label:'유럽',        ids:['WA']},
];

/* ── 프로젝트 관리 연동 ──
   프로젝트 관리의 프로젝트가 생산 이관일 2일 전이 되면 이 탭에 호기 행이 자동으로 생긴다.
   · 구분(사이트)은 S.sites와 무관하게 프로젝트의 "고객사" 이름을 그대로 쓴다 → siteId는 'mp:고객사명'(가상 사이트)
   · 라인 = 설비명(프로젝트), 호기 = 프로젝트 관리와 같은 표기("생산 33호기_(현장 2호기)")
   · 행 id는 'eu_mp_<프로젝트 id>'로 고정 → 여러 기기에서 동시에 만들어도 중복되지 않는다
   · 한 번 만든 행은 이관일이 바뀌어도 그대로 두고, 직접 삭제하면(삭제 기록) 다시 만들지 않는다 */
var _EQ_AUTO_LEAD_DAYS=2;
var _EQ_AUTO_COLORS=['#4a8fd8','#3aaa7a','#d89a3a','#b06ad8','#d85a7a','#3ab0c8','#8aa83a','#d8683a'];
function _eqIsVirtualSiteId(id){ return typeof id==='string'&&id.indexOf('mp:')===0; }
// 사이트 조회: S.sites에 있으면 그것, 자동 생성 행의 가상 사이트(고객사)면 호기 데이터로 이름·국가·색을 만들어 돌려준다
function _eqSite(siteId){
  var real=S.sites.find(function(s){return s.id===siteId;});
  if(real) return real;
  if(!_eqIsVirtualSiteId(siteId)) return null;
  var u=S.equipUnits.find(function(x){return x.siteId===siteId;});
  if(!u) return null;
  var name=u.autoCustomer||siteId.slice(3)||'미지정';
  var h=0; for(var i=0;i<name.length;i++) h=(h*31+name.charCodeAt(i))>>>0;
  return {id:siteId,name:name,country:u.autoRegion||'기타',color:_EQ_AUTO_COLORS[h%_EQ_AUTO_COLORS.length],virtual:true};
}
function _eqLocalToday(){
  var d=new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function _eqUnitLabel(mp){
  var prodLbl=mp.prodUnit?('생산 '+mp.prodUnit):'';
  var lbl=(prodLbl&&mp.customerUnit)?(prodLbl+'_(현장 '+mp.customerUnit+')'):(prodLbl||(mp.customerUnit?('현장 '+mp.customerUnit):''));
  return lbl||mp.serial||'';
}
// 변경이 있으면 true (호출한 쪽에서 저장)
function syncEquipFromMasterProjects(){
  if(!S.masterProjects||!S.masterProjects.length||!S.equipItems||!S.equipItems.length) return false;
  if(typeof _mpActive!=='function') return false;
  var today=_eqLocalToday(), changed=false;
  var byMp={};
  S.equipUnits.forEach(function(u){ if(u.mpId) byMp[u.mpId]=u; });
  _mpActive().forEach(function(mp){
    if(_MP_HIDDEN_STATUSES.indexOf(mp.status||'')>=0) return;   // 완료/LOI 접수/PO 대기/PO 발행은 제외
    var cust=(mp.customer||'').trim()||'미지정';
    var line=mp.projectName||'', unitLbl=_eqUnitLabel(mp);
    var sig=[cust,mp.region||'',line,unitLbl].join('|');
    var unit=byMp[mp.id];
    var loc=mp.setupLocation||'';
    if(unit){
      // 셋업 위치(프로젝트 관리의 셋업 장소)는 항상 최신으로 맞춘다 — 위치 필터 기준
      if((unit.autoLoc||'')!==loc){ unit.autoLoc=loc; _touch(unit); changed=true; }
      // 프로젝트 쪽 표기가 바뀐 경우에만 라벨을 다시 맞춘다(그 전에 직접 고친 값은 유지)
      if(unit.autoSig!==sig){
        unit.autoSig=sig; unit.autoCustomer=cust; unit.autoRegion=mp.region||'기타';
        unit.siteId='mp:'+cust; unit.lineName=line; unit.unitName=unitLbl;
        _touch(unit); changed=true;
      }
      return;
    }
    var id='eu_mp_'+mp.id;
    if(_isDeleted('equipUnits',id)) return;                       // 직접 지운 행은 다시 만들지 않음
    if(S.equipUnits.some(function(u){return u.id===id;})) return;
    var t=_mpEffectiveTransferDate(mp); if(!t) return;
    if(_addDaysStr(t,-_EQ_AUTO_LEAD_DAYS)>today) return;          // 이관일 2일 전부터
    var rg=_mpSetupRange(mp); if(rg&&rg.end&&rg.end<today) return; // 셋업 기간이 이미 끝난 프로젝트는 만들지 않음
    var siteId='mp:'+cust, cells={};
    S.equipItems.forEach(function(item){
      var s=item.siteIds;
      if(!s||s.length===0||s.indexOf(siteId)>=0) cells[item.id]={na:false,planDate:'',percent:0,doneDate:''};
    });
    S.equipUnits.push(_touch({id:id,mpId:mp.id,auto:true,autoSig:sig,autoCustomer:cust,autoRegion:mp.region||'기타',autoLoc:loc,
      siteId:siteId,equipProjectId:null,lineName:line,unitName:unitLbl,memo:'',cells:cells,cellsMt:Date.now()}));
    changed=true;
  });
  return changed;
}

/* ── 설비 탭 사이트 순서 헬퍼 ── */
function ensureEquipSiteOrder(){
  if(!S.equipSiteOrder) S.equipSiteOrder=[];
  var inUnits={};
  S.equipUnits.forEach(function(u){inUnits[u.siteId]=true;});
  S.sites.forEach(function(s){
    if(inUnits[s.id]&&S.equipSiteOrder.indexOf(s.id)<0)
      S.equipSiteOrder.push(s.id);
  });
  // 프로젝트 관리 연동으로 생긴 가상 사이트(고객사)도 순서 목록에 포함
  Object.keys(inUnits).forEach(function(id){
    if(_eqIsVirtualSiteId(id)&&S.equipSiteOrder.indexOf(id)<0) S.equipSiteOrder.push(id);
  });
  S.equipSiteOrder=S.equipSiteOrder.filter(function(id){
    return S.sites.some(function(s){return s.id===id;})||(_eqIsVirtualSiteId(id)&&inUnits[id]);
  });
}
function onEquipSiteDragStart(siteId){_dragEquipSiteId=siteId;}
function onEquipSiteDrop(targetSiteId){
  if(!_dragEquipSiteId||_dragEquipSiteId===targetSiteId){_dragEquipSiteId=null;return;}
  ensureEquipSiteOrder();
  var arr=S.equipSiteOrder;
  var fi=arr.indexOf(_dragEquipSiteId),ti=arr.indexOf(targetSiteId);
  if(fi<0||ti<0){_dragEquipSiteId=null;return;}
  arr.splice(fi,1);arr.splice(ti,0,_dragEquipSiteId);
  _dragEquipSiteId=null;
  saveData();renderEquipTab();
}

// 그룹(MC/PO 등)별로 항목이 뭉쳐 보이도록 정렬: 그룹의 위치는 그룹 내 최소 order로 결정,
// 그룹 안에서는 각 항목의 order로 정렬
function _sortedEquipItemsGrouped(){
  var groupPos={};
  S.equipItems.forEach(function(i){
    var g=i.groupName||'';
    if(!(g in groupPos)||i.order<groupPos[g]) groupPos[g]=i.order;
  });
  return S.equipItems.slice().sort(function(a,b){
    var ga=a.groupName||'', gb=b.groupName||'';
    if(ga!==gb) return groupPos[ga]-groupPos[gb];
    return a.order-b.order;
  });
}

// 예전 {type,value} 단일선택 셀 형식 → {na,planDate,percent,doneDate} 동시표시 형식으로 변환
function _migrateEquipCell(c){
  if(!c) return {na:true,planDate:'',percent:0,doneDate:''};
  if(c.na!==undefined) return c; // 이미 새 형식
  if(!c.type||c.type==='na') return {na:true,planDate:'',percent:0,doneDate:''};
  if(c.type==='date')    return {na:false,planDate:c.value||'',percent:0,doneDate:''};
  if(c.type==='percent') return {na:false,planDate:'',percent:parseFloat(c.value)||0,doneDate:''};
  if(c.type==='done')    return {na:false,planDate:'',percent:100,doneDate:c.value||''};
  return {na:true,planDate:'',percent:0,doneDate:''};
}
function _migrateEquipCells(){
  var changed=false;
  S.equipUnits.forEach(function(u){
    if(!u.cells) return;
    Object.keys(u.cells).forEach(function(itemId){
      var c=u.cells[itemId];
      if(c&&c.na===undefined){ u.cells[itemId]=_migrateEquipCell(c); changed=true; _touch(u); }
    });
  });
  if(changed) saveData();
}
// 역할별 담당자로 나뉘기 전, 단일 "담당자" 필드에 넣었던 값은 '본사 셋업'으로 이전
function _migrateEquipProjectManagers(){
  var changed=false;
  (S.equipProjects||[]).forEach(function(p){
    if(p.manager&&!p.mgrHq&&!p.mgrTravel&&!p.mgrHost&&!p.mgrVision){
      p.mgrHq=p.manager;
      delete p.manager;
      _touch(p);
      changed=true;
    }
  });
  if(changed) saveData();
}

/* ── 그룹(단계) 기반 유형/진행율 자동 판정 ──
   그룹(본사셋업/현장셋업 등)을 순서대로 보며, 호기별로 아직 안 끝난 첫 그룹을 "현재 단계"로 본다.
   해당 호기에 해당사항 없는(N/A) 그룹은 건너뛰고, 모든 그룹이 끝났으면 마지막 해당 그룹을 유지한다. */
function _equipGroupSeq(){
  var items=_sortedEquipItemsGrouped();
  var seq=[];
  items.forEach(function(i){var g=i.groupName||'';if(g&&seq.indexOf(g)<0)seq.push(g);});
  return seq;
}
function _equipGroupItems(groupName){
  return S.equipItems.filter(function(i){return (i.groupName||'')===groupName;});
}
function _groupProgressForUnit(unit,groupName){
  var items=_equipGroupItems(groupName);
  if(!items.length) return 100;
  var total=0,count=0;
  items.forEach(function(item){
    var cell=(unit.cells||{})[item.id];
    if(!cell||cell.na) return;
    count++;
    total+=(parseFloat(cell.percent)||0);
  });
  if(!count) return 100;
  return Math.round(total/count);
}
function calcUnitActivePhase(unit){
  var seq=_equipGroupSeq();
  if(!seq.length) return null;
  var lastApplicable=null;
  for(var idx=0;idx<seq.length;idx++){
    var g=seq[idx];
    var applicable=_equipGroupItems(g).filter(function(item){
      var c=(unit.cells||{})[item.id];
      return c&&!c.na;
    });
    if(!applicable.length) continue;
    lastApplicable=g;
    var allDone=applicable.every(function(item){
      return (parseFloat(unit.cells[item.id].percent)||0)>=100;
    });
    if(!allDone) return g;
  }
  return lastApplicable;
}
function calcProjectActivePhase(projectId){
  var units=S.equipUnits.filter(function(u){return u.equipProjectId===projectId;});
  var seq=_equipGroupSeq();
  if(!units.length||!seq.length) return null;
  var minIdx=null;
  units.forEach(function(u){
    var phase=calcUnitActivePhase(u);
    if(!phase) return;
    var idx=seq.indexOf(phase);
    if(minIdx===null||idx<minIdx) minIdx=idx;
  });
  return minIdx===null?null:seq[minIdx];
}

/* ── 진행율 계산 ── */
function calcUnitProgress(unit){
  var phase=calcUnitActivePhase(unit);
  if(phase) return _groupProgressForUnit(unit,phase);
  var items=S.equipItems.slice().sort(function(a,b){return a.order-b.order;});
  if(!items.length) return 0;
  var total=0,count=0;
  items.forEach(function(item){
    var cell=(unit.cells||{})[item.id];
    if(!cell||cell.na) return;
    count++;
    total+=(parseFloat(cell.percent)||0);
  });
  if(!count) return 0;
  return Math.round(total/count);
}

function calcSiteProgress(siteId){
  var units=_eqVisibleUnits().filter(function(u){return u.siteId===siteId;});
  if(!units.length) return null;
  var sum=0;
  units.forEach(function(u){sum+=calcUnitProgress(u);});
  return Math.round(sum/units.length);
}
function calcProjectProgress(projectId){
  var units=S.equipUnits.filter(function(u){return u.equipProjectId===projectId;});
  if(!units.length) return null;
  var phase=calcProjectActivePhase(projectId);
  var sum=0;
  units.forEach(function(u){sum+=(phase?_groupProgressForUnit(u,phase):calcUnitProgress(u));});
  return Math.round(sum/units.length);
}

/* ── 상단 필터 행 (프로젝트 관리 탭과 같은 다중 선택 드롭다운) ──
   국가 / 고객사(사이트) / 설비명(라인) / 셋업 위치를 여러 개씩 고를 수 있고, 표·요약 카드·호기 수가 모두 그 조건을 따른다.
   (예전 왼쪽 사이드바 필터를 대체한다) */
var _EQ_MS_LABELS={region:'국가',site:'고객사',line:'설비명',loc:'셋업 위치'};
var _EQ_MS_DEFS={
  region:function(){
    var arr=[];
    S.equipUnits.filter(_eqUnitShown).forEach(function(u){var s=_eqSite(u.siteId); var c=s?(s.country||'기타'):''; if(c&&arr.indexOf(c)<0) arr.push(c);});
    var ordered=[];
    (typeof BASE_REGIONS!=='undefined'?BASE_REGIONS:[]).forEach(function(c){if(arr.indexOf(c)>=0) ordered.push(c);});
    arr.forEach(function(c){if(ordered.indexOf(c)<0) ordered.push(c);});
    return ordered.map(function(v){return {value:v,label:(typeof tRegion==='function'?tRegion(v):v)};});
  },
  site:function(){
    ensureEquipSiteOrder();
    var ids=[];
    S.equipSiteOrder.forEach(function(id){ if(S.equipUnits.some(function(u){return u.siteId===id&&_eqUnitShown(u);})) ids.push(id); });
    S.equipUnits.filter(_eqUnitShown).forEach(function(u){ if(ids.indexOf(u.siteId)<0) ids.push(u.siteId); });
    return ids.map(function(id){var s=_eqSite(id); return s?{value:id,label:s.name}:null;}).filter(Boolean);
  },
  line:function(){
    var arr=[];
    S.equipUnits.filter(_eqUnitShown).forEach(function(u){var l=(u.lineName||'').trim(); if(l&&arr.indexOf(l)<0) arr.push(l);});
    arr.sort(function(a,b){return a.localeCompare(b,'ko');});
    return arr.map(function(v){return {value:v,label:v};});
  },
  loc:function(){
    return _EQ_LOCS.map(function(l){return {value:l.key,label:l.label};});
  }
};
function _eqMsSummary(key){
  var sel=_eqMS[key];
  if(!sel.length) return '전체';
  if(sel.length===1){
    var o=_EQ_MS_DEFS[key]().find(function(x){return x.value===sel[0];});
    return o?o.label:sel[0];
  }
  return sel.length+'개 선택';
}
function _eqMsAttr(v){ return String(v).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/&/g,'&amp;').replace(/"/g,'&quot;'); }
function _eqMsOptionsHtml(key){
  var sel=_eqMS[key];
  var html='<label class="pm-ms-opt all"><input type="checkbox" '+(sel.length===0?'checked':'')+' onchange="_eqMsClearAll(\''+key+'\')">전체</label>';
  _EQ_MS_DEFS[key]().forEach(function(o){
    html+='<label class="pm-ms-opt"><input type="checkbox" '+(sel.indexOf(o.value)>=0?'checked':'')+' onchange="_eqMsToggle(\''+key+'\',\''+_eqMsAttr(o.value)+'\')">'+_esc(o.label)+'</label>';
  });
  return html;
}
function _eqMsHtml(key){
  return '<div class="pm-ctrl-group"><span class="pm-ctrl-label">'+_EQ_MS_LABELS[key]+'</span>'
    +'<div class="pm-ms-wrap">'
    +'<button type="button" class="pm-ms-trigger" onclick="_eqMsTogglePanel(\''+key+'\')"><span id="eqMsLbl_'+key+'">'+_esc(_eqMsSummary(key))+'</span> ▾</button>'
    +'<div class="pm-ms-panel" id="eqMsPanel_'+key+'" style="display:none">'+_eqMsOptionsHtml(key)+'</div>'
    +'</div></div>';
}
function _eqMsTogglePanel(key){
  var panel=document.getElementById('eqMsPanel_'+key);
  if(!panel) return;
  var willOpen=panel.style.display==='none';
  document.querySelectorAll('.pm-ms-panel').forEach(function(p){p.style.display='none';});
  panel.style.display=willOpen?'block':'none';
}
function _eqMsRefresh(key){
  var panel=document.getElementById('eqMsPanel_'+key);
  if(panel) panel.innerHTML=_eqMsOptionsHtml(key);
  var lbl=document.getElementById('eqMsLbl_'+key);
  if(lbl) lbl.textContent=_eqMsSummary(key);
}
function _eqUpdateCount(){
  var el=document.getElementById('eqCount');
  if(el) el.innerHTML='총 <b>'+S.equipUnits.filter(_eqUnitVisible).length+'</b>호기'+(_eqAnyFilter()?' <span style="color:var(--tx-faint)">(전체 '+S.equipUnits.filter(_eqUnitShown).length+'호기 중)</span>':'');
}
function _eqMsAfterChange(key){
  _eqMsRefresh(key);
  renderEquipGrid();
  _eqUpdateCount();
}
function _eqMsToggle(key,value){
  var arr=_eqMS[key], idx=arr.indexOf(value);
  if(idx>=0) arr.splice(idx,1); else arr.push(value);
  _eqMsAfterChange(key);
}
function _eqMsClearAll(key){
  _eqMS[key]=[];
  var panel=document.getElementById('eqMsPanel_'+key);
  if(panel) panel.style.display='none';
  _eqMsAfterChange(key);
}
function eqResetFilters(){
  _eqMS={region:[],site:[],line:[],loc:[]};
  renderEquipTab();
}
function renderEquipFilterBar(){
  var el=document.getElementById('eqFilterBar');
  if(!el) return;
  // 더 이상 존재하지 않는 값(호기가 지워졌거나 완료로 숨겨진 사이트 등)은 선택에서 뺀다
  Object.keys(_eqMS).forEach(function(k){
    var valid=_EQ_MS_DEFS[k]().map(function(o){return o.value;});
    _eqMS[k]=_eqMS[k].filter(function(v){return valid.indexOf(v)>=0;});
  });
  var html='<div class="pm-ctrl-bar" style="margin-bottom:0">';
  ['region','site','line','loc'].forEach(function(k,i){
    if(i) html+='<div class="pm-ctrl-sep"></div>';
    html+=_eqMsHtml(k);
  });
  html+='<div class="pm-ctrl-sep"></div>'
    +'<button class="pm-filter-btn" onclick="eqResetFilters()" title="모든 필터를 전체로 되돌립니다">필터 초기화</button>'
    +'<div style="flex:1"></div>'
    +'<span id="eqCount" style="font-size:12px;color:var(--tx-second)"></span>'
    +'</div>';
  el.innerHTML=html;
  _eqUpdateCount();
}

// 사이트가 국가·고객사 필터에 맞는지(항목 열의 적용 사이트 판정용)
function _equipSiteMatchesFilter(siteId){
  if(_eqMS.site.length&&_eqMS.site.indexOf(siteId)<0) return false;
  if(_eqMS.region.length){
    var s=_eqSite(siteId);
    if(!s||_eqMS.region.indexOf(s.country||'기타')<0) return false;
  }
  return true;
}
function toggleEquipCollapse(siteId){
  _equipCollapsed[siteId]=!_equipCollapsed[siteId];
  _saveEquipCollapsed();
  renderEquipTab();
}
function collapseAllEquip(){
  ensureEquipSiteOrder();
  S.equipSiteOrder.forEach(function(id){_equipCollapsed[id]=true;});
  S.equipUnits.forEach(function(u){_equipCollapsed[u.siteId]=true;});
  _saveEquipCollapsed();
  renderEquipTab();
}
function expandAllEquip(){
  _equipCollapsed={};
  _saveEquipCollapsed();
  renderEquipTab();
}

/* ── sticky 좌측 오프셋 보정 (라인/호기/양산시작/메모 4열) ── */
function fixEquipStickyOffsets(){
  var lineEl=document.querySelector('#eqGrid .eq-col-line');
  var unitEl=document.querySelector('#eqGrid .eq-col-unit');
  var msEl=document.querySelector('#eqGrid .eq-col-msdate');
  if(!lineEl) return;
  var lw=lineEl.offsetWidth;
  var uw=unitEl?unitEl.offsetWidth:80;
  var mw2=msEl?msEl.offsetWidth:80;
  document.querySelectorAll('#eqGrid .eq-col-unit').forEach(function(el){el.style.left=lw+'px';});
  document.querySelectorAll('#eqGrid .eq-col-msdate').forEach(function(el){el.style.left=(lw+uw)+'px';});
  document.querySelectorAll('#eqGrid .eq-col-memo').forEach(function(el){el.style.left=(lw+uw+mw2)+'px';});
}

/* ── 메인 렌더 진입점 ── */
function renderEquipTab(){
  if(syncEquipFromMasterProjects()) saveData();   // 이관일 D-2가 된 프로젝트의 호기 행 자동 생성
  _migrateEquipCells();
  _migrateEquipProjectManagers();
  renderEquipFilterBar();
  renderEquipGrid();
  // "완료 보기" 버튼 상태 동기화(다른 탭의 완료 보기 버튼과 같은 표기: 켜면 "완료 숨기기" + 강조색)
  var doneBtn=document.getElementById('btnEquipDone');
  if(doneBtn){ doneBtn.textContent=_eqShowDone?'완료 숨기기':'완료 보기'; doneBtn.className='btn'+(_eqShowDone?' warn':''); }
}

/* ── 셀 내용(시작예정일 + 진행율 + 완료) 공용 렌더러 ── */
function _equipCellInner(cell){
  if(!cell||cell.na){
    return {done:false,html:'<span class="eq-na">N/A</span>'};
  }
  var pct=parseFloat(cell.percent)||0;
  var isDone=pct>=100;
  var today=TODAY.toISOString().slice(0,10);
  var isOver=cell.planDate&&cell.planDate<today&&!isDone;
  var html='';
  // %는 입력하지 않는다 — 완료를 체크하면 "완료 ✓"와 완료일만 보이고, 완료 전에는 시작 예정일만 보인다
  // 날짜는 YY.MM.DD(프로젝트 관리와 같은 짧은 표기)로 표시해 좁은 칸에도 한 줄에 들어가게 한다
  function sd(s){ return s?String(s).slice(2).replace(/-/g,'.'):''; }
  if(isDone){
    html+='<div style="font-weight:600;color:#4aaa70">완료 ✓</div>';
    if(cell.doneDate) html+='<div style="font-size:11px;color:#5a9aee">'+sd(cell.doneDate)+'</div>';
  } else if(cell.planDate){
    html+='<div class="'+(isOver?'eq-date overdue':'eq-date')+'" style="font-size:11px">'+sd(cell.planDate)+'</div>';
  }
  if(cell.note) html+='<span class="eq-note-dot" title="특이사항 있음">●</span>';
  return {done:isDone,html:html};
}
// 셀에 특이사항이 있으면 hover 시 말풍선 툴팁으로 보여주는 속성(data-memo + 메모 툴팁 재사용) 생성
function _equipCellNoteAttrs(cell){
  if(!cell||!cell.note) return '';
  var esc=cell.note.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  return ' data-memo="'+esc+'" onmouseenter="showMemoTooltip(this)" onmouseleave="hideMemoTooltip()"';
}
/* ── 셀 HTML ── */
function renderEquipCell(cell,editMode,unitId,itemId){
  var r=_equipCellInner(cell);
  var cls='eq-td'+(r.done?' eq-done':'')+(editMode?' editable':'');
  var attrs=_equipCellNoteAttrs(cell);
  if(editMode) attrs+=' onclick="openEquipCellEdit(\''+unitId+'\',\''+itemId+'\')"';
  return '<td class="'+cls+'"'+attrs+'>'+r.html+'</td>';
}

/* ── sticky 셀 렌더러 (고정 열용) ── */
function renderEquipCellSticky(cell,editMode,unitId,itemId,extraCls,extraStyle){
  var r=_equipCellInner(cell);
  var cls='eq-td-fix'+(r.done?' eq-done':'')+(extraCls?' '+extraCls:'')+(editMode?' editable':'');
  var attrs=extraStyle?(' style="'+extraStyle+'"'):'';
  attrs+=_equipCellNoteAttrs(cell);
  if(editMode) attrs+=' onclick="openEquipCellEdit(\''+unitId+'\',\''+itemId+'\')"';
  return '<td class="'+cls+'"'+attrs+'>'+r.html+'</td>';
}

/* ── 메모 셀 렌더러 ── */
function renderEquipMemoCell(unit,editMode){
  var memo=unit.memo||'';
  var cls='eq-td-fix eq-col-memo'+(editMode?' editable':'');
  var styleAttr=' style="left:0;border-right:2px solid #555;text-align:center;padding:4px"';
  var onclick=editMode?' onclick="openEditUnitMemo(\''+unit.id+'\')">':'>';
  if(memo){
    var escaped=memo.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    return '<td class="'+cls+'"'+styleAttr+onclick
      +'<span class="eq-memo-icon-wrap" data-memo="'+escaped+'" onmouseenter="showMemoTooltip(this)" onmouseleave="hideMemoTooltip()">'
      +'<span class="eq-memo-icon has-memo">&#x1F4AC;</span>'
      +'</span></td>';
  }
  if(editMode){
    return '<td class="'+cls+'"'+styleAttr+onclick+'<span class="eq-memo-icon">+</span></td>';
  }
  return '<td class="'+cls+'"'+styleAttr+'></td>';
}

function showMemoTooltip(el){
  var memo=el.getAttribute('data-memo');
  if(!memo) return;
  var tt=document.getElementById('eq-memo-tt');
  if(!tt){
    tt=document.createElement('div');
    tt.id='eq-memo-tt';
    tt.className='eq-memo-tooltip-fixed';
    document.body.appendChild(tt);
  }
  tt.innerHTML=memo.replace(/\n/g,'<br>');
  tt.style.display='block';
  var rect=el.getBoundingClientRect();
  var top=rect.bottom+4;
  var left=rect.left;
  tt.style.top=top+'px';
  tt.style.left=left+'px';
  var w=tt.offsetWidth;
  if(left+w>window.innerWidth-8) tt.style.left=Math.max(8,window.innerWidth-w-8)+'px';
}
function hideMemoTooltip(){
  var tt=document.getElementById('eq-memo-tt');
  if(tt) tt.style.display='none';
}

// HQ 셋업 간트 차트의 프로젝트 행과 같은 표시 — "☑ 이관 날짜 · 진행 % (셋업 기간) · ☐ 출하"
// 프로젝트 관리 연동 행(unit.mpId)에만 나오며, 이관·출하 체크와 진행률은 간트 차트와 같은 계산(_spTransferDone/_spShipDone/_spAutoPct)이다
function _equipScheduleInfoHtml(unit){
  // 이관/출하 체크는 날짜 자동 계산이 아니라 오른쪽 표의 "이관(생산▶BU2)"·"설비 출하" 칸의 완료 체크를 따른다 —
  // 그 칸에 완료를 체크하면 여기도 체크되고 그 칸의 완료일이 표시된다. (진행 % 표시는 없앰)
  function stage(itemName){
    var item=S.equipItems.find(function(i){return i.name===itemName&&(i.groupName||'')==='본사 셋업';});
    var c=item&&unit.cells?unit.cells[item.id]:null;
    var done=!!(c&&!c.na&&(parseFloat(c.percent)||0)>=100);
    return {done:done,date:done?(c.doneDate||''):''};
  }
  var tr=stage('이관(생산▶BU2)'), sh=stage('설비 출하');
  return '<div style="display:flex;align-items:center;gap:12px;font-size:10px;font-weight:400;color:var(--tx-second);flex-wrap:wrap;margin-top:4px">'
    +'<label style="display:flex;align-items:center;gap:3px" title="오른쪽 \'이관(생산▶BU2)\' 칸에 완료를 체크하면 체크되고 완료일이 표시됩니다"><input type="checkbox" '+(tr.done?'checked':'')+' disabled style="accent-color:#5a9aee">이관'
    +(tr.date?' <span style="color:var(--tx-faint)">'+tr.date.slice(2).replace(/-/g,'.')+'</span>':'')+'</label>'
    +'<label style="display:flex;align-items:center;gap:3px" title="오른쪽 \'설비 출하\' 칸에 완료를 체크하면 체크되고 완료일이 표시됩니다"><input type="checkbox" '+(sh.done?'checked':'')+' disabled style="accent-color:#b39ddb">출하'
    +(sh.date?' <span style="color:var(--tx-faint)">'+sh.date.slice(2).replace(/-/g,'.')+'</span>':'')+'</label>'
    +'</div>';
}
function _renderEquipUnitHtml(unit,idx,e,msDateItem,scrollItems){
  var rowCls='eq-row '+(idx%2===0?'even':'odd');
  var unitPct=calcUnitProgress(unit);
  var pctBar,unitBg='';
  if(unitPct===100){
    pctBar='<div style="font-size:11px;font-weight:600;color:#4aaa70;margin-top:2px">완료 ✓</div>';
    unitBg='background:var(--bg-eq-done);';
  } else {
    pctBar='<div style="font-size:11px;color:var(--tx-muted);margin-top:2px">'+unitPct+'%</div>';
  }
  var html='<tr class="'+rowCls+'">';
  html+='<td class="eq-td-fix eq-col-line'+(e?' editable':'')+'" style="left:0;min-width:0;'+(e?'white-space:nowrap;':'')+'text-align:left"'
    +(e?' onclick="openEditEquipUnit(\''+unit.id+'\')">':'>')
    +(unit.lineName||'')+'</td>';
  // 프로젝트 없는 사이트 직속 호기에만 유형 배지 표시 (프로젝트 호기는 프로젝트 행에서 표시)
  var isNoProj=!(unit.equipProjectId&&(S.equipProjects||[]).find(function(p){return p.id===unit.equipProjectId;}));
  var uType=isNoProj?(calcUnitActivePhase(unit)||unit.unitType||'납품셋업'):null;
  var uTypeBadge=uType?'<span class="eq-type-badge" style="font-size:9px;padding:1px 5px;background:'+_typeColor(uType)+'">'+uType+'</span>':'';
  html+='<td class="eq-td-fix eq-col-unit'+(e?' editable':'')+'"'
    +' style="left:0;border-right:2px solid var(--bd-strong);font-weight:500;'+unitBg+'"'
    +(e?' onclick="openEditEquipUnit(\''+unit.id+'\')"':'')+'>'
    +uTypeBadge+(unit.unitName||'')+pctBar+_equipScheduleInfoHtml(unit)+'</td>';
  // 고정 열은 라인·호기 2개뿐(양산시작·메모 열은 제거함)
  scrollItems.forEach(function(item){
    html+=renderEquipCell((unit.cells||{})[item.id],true,unit.id,item.id);
  });
  if(e){
    html+='<td class="eq-td" style="white-space:nowrap">'
      +'<button class="eq-act-btn copy" onclick="openCopyEquipUnit(\''+unit.id+'\')">복사</button>'
      +'<button class="eq-act-btn del" onclick="delEquipUnit(\''+unit.id+'\')">삭제</button>'
      +'</td>';
  }
  html+='</tr>';
  return html;
}

/* ── 그리드 렌더 ── */
function renderEquipGrid(){
  var el=document.getElementById('eqGrid');
  if(!el) return;

  _migrateEquipCells();
  var items=_sortedEquipItemsGrouped();
  var groupSeq=[];
  items.forEach(function(i){var g=i.groupName||'';if(groupSeq.indexOf(g)<0)groupSeq.push(g);});
  // 양산시작(ei21)은 고정 열로 분리, 나머지가 스크롤 항목
  var msDateItem=items.find(function(i){return i.id==='ei21';});
  var scrollItems=items.filter(function(i){
    if(i.id==='ei21') return false;
    var s=i.siteIds;
    if(!s||s.length===0) return true;
    return s.some(function(sid){return _equipSiteMatchesFilter(sid);});
  });

  // 필터링
  var allUnits=S.equipUnits.filter(function(u){
    return _eqUnitVisible(u)&&_equipSiteMatchesFilter(u.siteId);
  });

  // 사이트 목록 — equipSiteOrder 기반
  ensureEquipSiteOrder();
  var siteIds=S.equipSiteOrder.filter(function(id){
    return allUnits.some(function(u){return u.siteId===id;});
  });
  allUnits.forEach(function(u){
    if(siteIds.indexOf(u.siteId)<0) siteIds.push(u.siteId);
  });

  /* ── 요약 카드 — eqSummary 영역 (테이블과 분리, 스크롤 독립) ── */
  var summaryEl=document.getElementById('eqSummary');
  if(!allUnits.length){
    var hiddenDone=S.equipUnits.some(function(u){return _eqShipDone(u);})&&!_eqShowDone;
    el.innerHTML=hiddenDone
      ?'<div class="eq-empty">표시할 설비가 없습니다.<div class="eq-empty-sub">출하까지 완료된 호기는 숨겨져 있습니다. 위의 [완료 보기]를 누르면 볼 수 있습니다.</div></div>'
      :'<div class="eq-empty">등록된 설비가 없습니다.'
      +'<div class="eq-empty-sub">수정 모드로 전환 후 [+ 사이트]와 [+ 호기]를 추가하세요.</div></div>';
    if(summaryEl) summaryEl.innerHTML='';
    return;
  }

  if(summaryEl){
    var summaryHtml='<div class="eq-summary-bar">';
    siteIds.forEach(function(siteId){
      var site=_eqSite(siteId);
      if(!site) return;
      var pct=calcSiteProgress(siteId);
      if(pct===null) return;
      var units=allUnits.filter(function(u){return u.siteId===siteId;});
      var doneCount=units.filter(function(u){return calcUnitProgress(u)===100;}).length;
      var barColor=pct===100?'#2a8a40':(pct>=70?'#1a6bbf':'#b87a10');
      var siteProjs=(S.equipProjects||[]).filter(function(p){return p.siteId===siteId;});
      var projSubHtml='';
      if(siteProjs.length>0){
        projSubHtml='<div class="eq-proj-sub-list">';
        siteProjs.forEach(function(proj){
          var pp=calcProjectProgress(proj.id);
          if(pp===null) return;
          var pc=pp===100?'#2a8a40':(pp>=70?'#1a6bbf':'#b87a10');
          projSubHtml+='<div class="eq-proj-sub-item">'
            +'<span class="eq-proj-sub-name">'+proj.name+'</span>'
            +'<span class="eq-proj-sub-pct" style="color:'+pc+'">'+pp+'%</span>'
            +'<div class="eq-proj-sub-bar"><div class="eq-proj-sub-bar-fill" style="width:'+pp+'%;background:'+pc+'"></div></div>'
            +'</div>';
        });
        projSubHtml+='</div>';
      }
      summaryHtml+='<div class="eq-summary-card">'
        +'<div style="display:flex;align-items:center;gap:7px;margin-bottom:6px">'
        +'<div style="width:4px;height:28px;border-radius:2px;background:'+site.color+';flex-shrink:0"></div>'
        +'<span style="font-size:13px;font-weight:700">'+site.name+'</span>'
        +'</div>'
        +'<div style="font-size:24px;font-weight:700;line-height:1">'+pct+'%</div>'
        +'<div style="margin:6px 0 3px;background:var(--bd-light);border-radius:3px;height:5px;overflow:hidden">'
        +'<div style="height:100%;border-radius:3px;background:'+barColor+';width:'+pct+'%"></div></div>'
        +'<div style="font-size:10px;color:var(--tx-muted);margin-top:3px">'+doneCount+' / '+units.length+' 호기 완료</div>'
        +projSubHtml
        +'</div>';
    });
    summaryHtml+='</div>';
    summaryEl.innerHTML=summaryHtml;
  }

  var e=_equipEditMode;
  // colCount: 고정 2열 (라인/호기) + 스크롤 항목 + 관리열(수정모드)
  var scrollColCount=scrollItems.length+(e?1:0);

  /* ── 헤더 단일 행 ── */
  var prevGroup=null;
  var hdrRow='<tr>';
  // 고정 2열 헤더
  hdrRow+='<th class="eq-th fix-col eq-col-line" style="left:0;'+(e?'white-space:nowrap;min-width:40px':'width:96px')+'">라인</th>';
  hdrRow+='<th class="eq-th fix-col eq-col-unit" style="left:0;'+(e?'min-width:260px;width:260px':'width:210px')+';border-right:2px solid var(--bd-strong)">호기</th>';
  // 스크롤 항목 헤더
  scrollItems.forEach(function(item,itemIdx){
    var g=item.groupName||'';
    var isGroupStart=(g!==prevGroup);
    var groupLbl='';
    if(g){
      groupLbl='<div style="font-size:8px;color:#534AB7;margin-bottom:2px;letter-spacing:.04em">'+g+'</div>';
      if(e&&isGroupStart){
        var gIdx=groupSeq.indexOf(g);
        var gIsFirst=(gIdx<=0),gIsLast=(gIdx>=groupSeq.length-1);
        groupLbl='<div style="font-size:8px;color:#534AB7;margin-bottom:2px;letter-spacing:.04em">'+g
          +(gIsFirst?'':' <button class="eq-item-edit-btn" title="그룹 전체 위로 이동" style="width:auto;padding:0 3px;display:inline-block;font-size:8px" onclick="moveEquipGroup(\''+g.replace(/'/g,"\\'")+'\',-1)">◀그룹</button>')
          +(gIsLast?'':' <button class="eq-item-edit-btn" title="그룹 전체 아래로 이동" style="width:auto;padding:0 3px;display:inline-block;font-size:8px" onclick="moveEquipGroup(\''+g.replace(/'/g,"\\'")+'\',1)">그룹▶</button>')
          +'</div>';
      }
    }
    var borderLeft=(g&&g!==prevGroup&&prevGroup!==null)?'border-left:2px solid #534AB7;':'';
    prevGroup=g;
    if(e){
      var isFirst=(itemIdx===0),isLast=(itemIdx===scrollItems.length-1);
      hdrRow+='<th class="eq-th" style="padding:3px 5px;'+borderLeft+'white-space:normal;max-width:100px">'
        +groupLbl
        +'<div style="word-break:break-word">'+item.name+'</div>'
        +'<div style="display:flex;gap:2px;margin-top:3px;justify-content:center;flex-wrap:wrap">'
        +(isFirst?'':'<button class="eq-item-edit-btn" style="width:auto;padding:1px 5px;display:inline-block" onclick="moveEquipItem(\''+item.id+'\',-1)">↑</button>')
        +(isLast?'':'<button class="eq-item-edit-btn" style="width:auto;padding:1px 5px;display:inline-block" onclick="moveEquipItem(\''+item.id+'\',1)">↓</button>')
        +'<button class="eq-item-edit-btn" style="width:auto;padding:1px 5px;display:inline-block" onclick="openEditEquipItem(\''+item.id+'\')">수정</button>'
        +'<button class="eq-item-edit-btn" style="width:auto;padding:1px 5px;display:inline-block;color:#c04040;border-color:#7a1010" onclick="openDelEquipItem(\''+item.id+'\')">삭제</button>'
        +'</div></th>';
    } else {
      hdrRow+='<th class="eq-th" style="'+borderLeft+'white-space:normal;max-width:100px">'+groupLbl+item.name+'</th>';
    }
  });
  if(e) hdrRow+='<th class="eq-th">관리</th>';
  hdrRow+='</tr>';

  /* ── 데이터 행 ── */
  var bodyHtml='';
  siteIds.forEach(function(siteId){
    var site=_eqSite(siteId);
    if(!site) return; // 삭제된 사이트는 표시하지 않음
    var siteName=site.name;
    var siteColor=site.color;
    var collapsed=!!_equipCollapsed[siteId];
    var sitePct=calcSiteProgress(siteId);
    var sitePctStr=sitePct!==null?sitePct+'%':'—';
    var sitePctColor=sitePct===100?'#2a8a40':(sitePct>=70?'#1a6bbf':'#b87a10');
    var collapseBtn='<button class="eq-collapse-btn" onclick="toggleEquipCollapse(\''+siteId+'\')">'+(collapsed?'▶':'▼')+'</button>';
    var collapsedInfo=collapsed
      ?'<span class="eq-site-pct" style="color:'+sitePctColor+'">'+sitePctStr+'</span>'
       +'<div class="eq-site-pbar"><div class="eq-site-pbar-fill" style="width:'+(sitePct||0)+'%;background:'+sitePctColor+'"></div></div>'
      :'';
    // 사이트 구분 행 — 4열 colspan sticky로 사이트명/출장자 고정
    bodyHtml+='<tr class="eq-site-row">'
      +'<td colspan="2" style="position:sticky;left:0;z-index:25;border-left:4px solid '+siteColor+'">'
      +'<div class="eq-site-inner">'
      +collapseBtn
      +'<span style="font-size:14px;font-weight:700;letter-spacing:.04em">'+siteName+'</span>'
      +collapsedInfo
      +'</div></td>'
      +(scrollColCount>0?'<td colspan="'+scrollColCount+'" style="background:var(--bg-alt);border-top:2px solid var(--bd-light)"></td>':'')
      +'</tr>';

    var siteUnits=allUnits.filter(function(u){return u.siteId===siteId;});
    var siteProjects=(S.equipProjects||[]).filter(function(p){return p.siteId===siteId;});
    if(siteProjects.length>0){
      // 프로젝트 모드: 프로젝트별 서브그룹
      siteProjects.forEach(function(proj){
        var projUnits=siteUnits.filter(function(u){return u.equipProjectId===proj.id;});
        var projPct=calcProjectProgress(proj.id);
        var projPctStr=projPct!==null?projPct+'%':'—';
        var pType=calcProjectActivePhase(proj.id)||proj.projType||'납품셋업';
        var pTypeColor=_typeColor(pType);
        var typeBadge='<span class="eq-type-badge" style="background:'+pTypeColor+'">'+pType+'</span>';
        bodyHtml+='<tr class="eq-project-row">'
          +'<td colspan="2" class="eq-proj-sticky" style="position:sticky;left:0;z-index:22;background:var(--bg-deep);'
          +'border-top:1px solid var(--bd-light);border-left:3px solid #4a4a6a;border-bottom:1px solid var(--bd-light);">'
          +'<div class="eq-proj-row1">'
          +typeBadge
          +'<span class="eq-proj-name">'+proj.name+'</span>'
          +'<span class="eq-proj-pct">'+projPctStr+'</span>'
          +(e?'<button class="eq-item-edit-btn" onclick="openEditEquipProject(\''+proj.id+'\')">수정</button>'
            +'<button class="eq-item-edit-btn" style="color:#c04040;border-color:#7a1010" onclick="delEquipProject(\''+proj.id+'\')">삭제</button>':'')
          +'</div>'
          +(collapsed?'':_equipMgrDisplayHtml(proj))
          +'</td>'
          +(scrollColCount>0?'<td colspan="'+scrollColCount+'" style="background:var(--bg-deep);border-top:1px solid var(--bd-light);border-bottom:1px solid var(--bd-light)"></td>':'')
          +'</tr>';
        // ▼ 접기는 담당자 정보만 숨기고, 설비 일정/진행율 라인은 항상 표시
        projUnits.forEach(function(unit,idx){bodyHtml+=_renderEquipUnitHtml(unit,idx,e,msDateItem,scrollItems);});
      });
      // 미지정 호기
      var unassigned=siteUnits.filter(function(u){
        return !u.equipProjectId||!siteProjects.find(function(p){return p.id===u.equipProjectId;});
      });
      if(unassigned.length){
        bodyHtml+='<tr class="eq-project-row unassigned">'
          +'<td colspan="'+(2+scrollColCount)+'" style="position:sticky;left:0;z-index:22;background:var(--bg-deep);'
          +'border-top:1px solid var(--bd-light);border-bottom:1px solid var(--bd-light);'
          +'color:var(--tx-faint);font-size:11px;font-style:italic;padding:4px 10px 4px 20px">미지정</td>'
          +'</tr>';
        unassigned.forEach(function(unit,idx){bodyHtml+=_renderEquipUnitHtml(unit,idx,e,msDateItem,scrollItems);});
      }
    } else {
      // 기존 방식 (프로젝트 없음 - 납품셋업 기본 배지 표시)
      siteUnits.forEach(function(unit,idx){bodyHtml+=_renderEquipUnitHtml(unit,idx,e,msDateItem,scrollItems);});
    }
  });

  el.innerHTML='<table class="eq-table'+(e?'':' eq-compact')+'"><thead>'+hdrRow+'</thead><tbody>'+bodyHtml+'</tbody></table>';
  fixEquipStickyOffsets();
}

/* ── 수정 모드 토글 ── */
function toggleEquipEdit(){
  _equipEditMode=!_equipEditMode;
  var btn=document.getElementById('btnEquipEdit');
  if(btn) btn.className='btn'+(_equipEditMode?' edit-on':'');
  ['btnAddEquipSite','btnAddEquipProject','btnAddEquipUnit','btnAddEquipItem'].forEach(function(id){
    var el=document.getElementById(id);
    if(el) el.style.display=_equipEditMode?'':'none';
  });
  renderEquipTab();
}

/* ── 셀 편집 모달 ── */
function openEquipCellEdit(unitId,itemId){
  var unit=S.equipUnits.find(function(u){return u.id===unitId;});
  var item=S.equipItems.find(function(i){return i.id===itemId;});
  if(!unit||!item) return;
  var cell=_migrateEquipCell((unit.cells||{})[itemId]);

  mw('<div class="mtit">셀 편집</div>'
    +'<div style="font-size:11px;color:#888;margin-bottom:14px">'+item.name+'</div>'
    +'<div id="eq_fields_wrap">'
    +'<label class="chkrow" style="margin:4px 0 10px"><input type="checkbox" id="eq_done"'+((parseFloat(cell.percent)||0)>=100?' checked':'')+' onchange="equipCellDoneChange()"> 완료</label>'
    +'<div class="fg" id="eq_doneDate_wrap" style="'+((parseFloat(cell.percent)||0)>=100?'':'display:none')+'"><label class="fl">완료일 — 완료를 체크하면 오늘 날짜가 들어가며, 직접 바꿀 수 있습니다</label>'
    +'<input type="date" id="eq_doneDate" value="'+((parseFloat(cell.percent)||0)>=100?(cell.doneDate||''):'')+'" style="width:100%"></div>'
    +'<div class="fg"><label class="fl">특이사항 (선택) — 마우스를 올리면 셀에서 바로 확인 가능</label>'
    +'<textarea id="eq_note" rows="8" placeholder="예: 부품 입고 지연으로 일정 연기" style="width:100%;resize:vertical;background:var(--bg-input);color:var(--tx-primary);border:1px solid var(--bd-main);border-radius:4px;padding:6px;font-size:12px">'+(cell.note||'')+'</textarea></div>'
    +'</div>'
    +'<div class="mfoot">'
    +'<button class="btn sm" onclick="cm()">취소</button>'
    +'<button class="btn sm pri" onclick="saveEquipCell(\''+unitId+'\',\''+itemId+'\')">저장</button>'
    +'</div>');
  // 특이사항 칸을 넓게 쓸 수 있도록 이 모달만 폭을 1.5배로 확대 (기본 460px → 690px)
  var modalEl=document.querySelector('.mover .modal');
  if(modalEl) modalEl.style.width='690px';
}

// 완료 체크 시 완료일 칸을 보이고(비어 있으면 오늘 날짜), 체크를 풀면 숨긴다
function equipCellDoneChange(){
  var on=document.getElementById('eq_done').checked;
  var wrap=document.getElementById('eq_doneDate_wrap');
  var inp=document.getElementById('eq_doneDate');
  if(wrap) wrap.style.display=on?'':'none';
  if(on&&inp&&!inp.value){
    var d=new Date();
    inp.value=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
}

function saveEquipCell(unitId,itemId){
  var unit=S.equipUnits.find(function(u){return u.id===unitId;});
  if(!unit) return;
  var noteEl=document.getElementById('eq_note');
  var note=noteEl?noteEl.value.trim():'';
  // 해당 없음(N/A)·시작 예정일 입력은 없앴다 — 모든 칸은 항상 해당되는 항목이고, 예전에 저장된 시작 예정일 값은 그대로 보존한다
  var old=_migrateEquipCell((unit.cells||{})[itemId]);
  // 진행률은 완료 체크 여부로만 정한다(체크=100, 해제=0). 완료일은 체크했을 때만 저장
  var isDone=document.getElementById('eq_done').checked;
  var doneDate=isDone?(document.getElementById('eq_doneDate').value||''):'';
  if(isDone&&!doneDate){
    var d=new Date();
    doneDate=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  var cell={na:false,planDate:old.planDate||'',percent:isDone?100:0,doneDate:doneDate,note:note};
  if(!unit.cells) unit.cells={};
  unit.cells[itemId]=cell;
  unit.cellsMt=Date.now();
  _touch(unit);
  saveData();cm();renderEquipGrid();
}

/* ── 호기 메모 편집 ── */
function openEditUnitMemo(unitId){
  var unit=S.equipUnits.find(function(u){return u.id===unitId;});
  if(!unit) return;
  var memo=unit.memo||'';
  mw('<div class="mtit">호기 메모</div>'
    +'<div style="font-size:11px;color:#888;margin-bottom:10px">'+unit.unitName+'</div>'
    +'<div class="fg"><label class="fl">메모 내용</label>'
    +'<textarea id="eq_memo_text" rows="4" style="width:100%;resize:vertical;background:var(--bg-input);'
    +'color:var(--tx-primary);border:1px solid var(--bd-main);border-radius:4px;padding:6px;font-size:12px">'
    +memo+'</textarea></div>'
    +'<div class="mfoot">'
    +'<button class="btn sm" onclick="cm()">취소</button>'
    +'<button class="btn sm warn" onclick="saveUnitMemo(\''+unitId+'\',true)">삭제</button>'
    +'<button class="btn sm pri" onclick="saveUnitMemo(\''+unitId+'\',false)">저장</button>'
    +'</div>');
  setTimeout(function(){var el=document.getElementById('eq_memo_text');if(el)el.focus();},50);
}

function saveUnitMemo(unitId,clear){
  var unit=S.equipUnits.find(function(u){return u.id===unitId;});
  if(!unit) return;
  unit.memo=clear?'':(document.getElementById('eq_memo_text').value.trim());
  _touch(unit);
  saveData();cm();renderEquipGrid();
}

/* ── 프로젝트 CRUD ── */
function _projTypeOpts(sel){
  return _allProjTypes().map(function(t){
    return '<option value="'+t+'"'+(t===(sel||'납품셋업')?' selected':'')+'>'+t+'</option>';
  }).join('');
}
function _typeFieldHtml(selId,sel){
  return '<select id="'+selId+'">'+_projTypeOpts(sel)+'</select>'
    +'<input type="text" id="'+selId+'_custom" placeholder="새 유형 직접 입력 (선택)" autocorrect="off" autocomplete="off" spellcheck="false" style="margin-top:4px;width:100%">';
}
function _readTypeField(selId,fallback){
  var custom=document.getElementById(selId+'_custom');
  var v=custom?custom.value.trim():'';
  if(v) return v;
  var sel=document.getElementById(selId);
  return (sel&&sel.value)||fallback;
}
function openAddEquipProject(){
  ensureEquipSiteOrder();
  var available=S.sites.filter(function(s){return S.equipSiteOrder.indexOf(s.id)>=0;});
  if(!available.length){alert('먼저 사이트를 추가해주세요.');return;}
  var opts=available.map(function(s){return '<option value="'+s.id+'">'+s.name+'</option>';}).join('');
  mw('<div class="mtit">프로젝트 추가</div>'
    +'<div class="fg"><label class="fl">사이트</label>'
    +'<select id="eq_proj_site">'+opts+'</select></div>'
    +'<div class="fg"><label class="fl">프로젝트명</label>'
    +'<input type="text" id="eq_proj_name" placeholder="예: Phase 1" autocorrect="off" autocomplete="off" spellcheck="false"'
    +' onkeydown="if(event.key===\'Enter\')saveAddEquipProject()"></div>'
    +'<div class="fg"><label class="fl">유형</label>'
    +_typeFieldHtml('eq_proj_type')+'</div>'
    +_equipMgrFieldsHtml('eq_proj_')
    +'<div class="mfoot">'
    +'<button class="btn sm" onclick="cm()">취소</button>'
    +'<button class="btn sm pri" onclick="saveAddEquipProject()">추가</button>'
    +'</div>');
  setTimeout(function(){var el=document.getElementById('eq_proj_name');if(el)el.focus();},50);
}
function saveAddEquipProject(){
  var siteId=document.getElementById('eq_proj_site').value;
  var name=document.getElementById('eq_proj_name').value.trim();
  var projType=_readTypeField('eq_proj_type','납품셋업');
  if(!name){alert('프로젝트명을 입력해주세요.');return;}
  var proj=_touch({id:genId('ep',S.equipProjects),siteId:siteId,name:name,projType:projType});
  _readEquipMgrFields('eq_proj_',proj);
  S.equipProjects.push(proj);
  saveData();cm();renderEquipGrid();
}
function openEditEquipProject(projectId){
  var proj=S.equipProjects.find(function(p){return p.id===projectId;});
  if(!proj) return;
  mw('<div class="mtit">프로젝트 수정</div>'
    +'<div class="fg"><label class="fl">프로젝트명</label>'
    +'<input type="text" id="eq_edit_proj_name" value="'+proj.name+'" autocorrect="off" autocomplete="off" spellcheck="false"'
    +' onkeydown="if(event.key===\'Enter\')saveEditEquipProject(\''+projectId+'\')"></div>'
    +'<div class="fg"><label class="fl">유형</label>'
    +_typeFieldHtml('eq_edit_proj_type',proj.projType||'납품셋업')+'</div>'
    +_equipMgrFieldsHtml('eq_edit_proj_',proj)
    +'<div class="mfoot">'
    +'<button class="btn sm" onclick="cm()">취소</button>'
    +'<button class="btn sm pri" onclick="saveEditEquipProject(\''+projectId+'\')">저장</button>'
    +'</div>');
  setTimeout(function(){var el=document.getElementById('eq_edit_proj_name');if(el)el.focus();},50);
}
function saveEditEquipProject(projectId){
  var proj=S.equipProjects.find(function(p){return p.id===projectId;});
  if(!proj) return;
  var name=document.getElementById('eq_edit_proj_name').value.trim();
  var projType=_readTypeField('eq_edit_proj_type','납품셋업');
  if(!name){alert('프로젝트명을 입력해주세요.');return;}
  proj.name=name;
  proj.projType=projType;
  _readEquipMgrFields('eq_edit_proj_',proj);
  _touch(proj);
  saveData();cm();renderEquipGrid();
}
function delEquipProject(projectId){
  var proj=S.equipProjects.find(function(p){return p.id===projectId;});
  if(!proj) return;
  if(!confirm('"'+proj.name+'" 프로젝트를 삭제하시겠습니까?\n소속 호기는 미지정으로 이동됩니다.')) return;
  S.equipUnits.forEach(function(u){if(u.equipProjectId===projectId){u.equipProjectId=null;_touch(u);}});
  S.equipProjects=S.equipProjects.filter(function(p){return p.id!==projectId;});
  _markDeleted('equipProjects',projectId);
  saveData();renderEquipGrid();
}

/* ── 사이트 추가 ── */
function openAddEquipSite(){
  ensureEquipSiteOrder();
  var available=S.sites.filter(function(s){return S.equipSiteOrder.indexOf(s.id)<0;});
  if(!available.length){alert('모든 사이트가 이미 추가되어 있습니다.');return;}
  var opts=available.map(function(s){
    return '<option value="'+s.id+'">'+s.name+'</option>';
  }).join('');
  mw('<div class="mtit">사이트 추가</div>'
    +'<div class="fg"><label class="fl">사이트 선택</label>'
    +'<select id="eq_add_site">'+opts+'</select></div>'
    +'<div class="mfoot">'
    +'<button class="btn sm" onclick="cm()">취소</button>'
    +'<button class="btn sm pri" onclick="saveAddEquipSite()">추가</button>'
    +'</div>');
}

function saveAddEquipSite(){
  var siteId=document.getElementById('eq_add_site').value;
  if(!siteId) return;
  ensureEquipSiteOrder();
  if(S.equipSiteOrder.indexOf(siteId)<0) S.equipSiteOrder.push(siteId);
  saveData();cm();renderEquipTab();
}

/* ── 호기 추가 ── */
function _equipProjOpts(siteId, selectedId){
  var projs=S.equipProjects.filter(function(p){return p.siteId===siteId;});
  if(!projs.length) return '';
  return '<option value=""'+(selectedId?'':' selected')+'>없음</option>'
    +projs.map(function(p){return '<option value="'+p.id+'"'+(p.id===selectedId?' selected':'')+'>'+p.name+'</option>';}).join('');
}
function openAddEquipUnit(){
  ensureEquipSiteOrder();
  var available=S.sites.filter(function(s){return S.equipSiteOrder.indexOf(s.id)>=0;});
  if(!available.length){alert('먼저 사이트를 추가해주세요.');return;}
  var firstSiteId=available[0].id;
  var opts=available.map(function(s){return '<option value="'+s.id+'">'+s.name+'</option>';}).join('');
  var projOpts=_equipProjOpts(firstSiteId,'');
  mw('<div class="mtit">호기 추가</div>'
    +'<div class="fg"><label class="fl">사이트</label>'
    +'<select id="eq_unit_site" onchange="_updateUnitProjSelect()">'+opts+'</select></div>'
    +(projOpts?'<div class="fg" id="eq_unit_proj_wrap"><label class="fl">프로젝트</label>'
      +'<select id="eq_unit_proj">'+projOpts+'</select></div>':'<div id="eq_unit_proj_wrap"></div>')
    +'<div class="fg"><label class="fl">라인명 (선택)</label>'
    +'<input type="text" id="eq_unit_line" placeholder="예: 1라인" autocorrect="off" autocomplete="off" spellcheck="false"></div>'
    +'<div class="fg"><label class="fl">호기명</label>'
    +'<input type="text" id="eq_unit_name" placeholder="예: Anode" autocorrect="off" autocomplete="off" spellcheck="false"'
    +' onkeydown="if(event.key===\'Enter\')saveAddEquipUnit()"></div>'
    +'<div id="eq_unit_feedback" style="display:none;color:#4aaa70;font-size:11px;'
    +'padding:4px 8px;background:#0a1e10;border-radius:4px;margin-bottom:6px"></div>'
    +'<div class="mfoot">'
    +'<button class="btn sm" onclick="cm()">닫기</button>'
    +'<button class="btn sm pri" onclick="saveAddEquipUnit()">추가</button>'
    +'</div>');
}
function _updateUnitProjSelect(){
  var siteId=document.getElementById('eq_unit_site').value;
  var wrap=document.getElementById('eq_unit_proj_wrap');
  if(!wrap) return;
  var opts=_equipProjOpts(siteId,'');
  wrap.innerHTML=opts?'<label class="fl">프로젝트</label><select id="eq_unit_proj">'+opts+'</select>':'';
}

function saveAddEquipUnit(){
  var siteId=document.getElementById('eq_unit_site').value;
  var lineName=document.getElementById('eq_unit_line').value.trim();
  var unitName=document.getElementById('eq_unit_name').value.trim();
  if(!unitName){alert('호기명을 입력해주세요.');return;}
  var projEl=document.getElementById('eq_unit_proj');
  var equipProjectId=projEl?projEl.value||null:null;
  var initCells={};
  S.equipItems.forEach(function(item){
    var s=item.siteIds;
    if(!s||s.length===0||s.indexOf(siteId)>=0) initCells[item.id]={na:true,planDate:'',percent:0,doneDate:''};
  });
  S.equipUnits.push(_touch({id:genId('eu',S.equipUnits),siteId:siteId,equipProjectId:equipProjectId,lineName:lineName,unitName:unitName,memo:'',cells:initCells,cellsMt:Date.now()}));
  saveData();
  renderEquipGrid();
  // 모달 유지 — 필드 초기화 후 포커스
  document.getElementById('eq_unit_line').value='';
  document.getElementById('eq_unit_name').value='';
  document.getElementById('eq_unit_name').focus();
  var fb=document.getElementById('eq_unit_feedback');
  if(fb){fb.style.display='';fb.textContent='"'+unitName+'" 추가됨';}
}

/* ── 사이트 선택 체크박스 HTML 생성 헬퍼 ── */
var _REGION_LABEL={};
var _REGION_ORDER=['국내','중국','대만','일본','베트남','말레이시아','싱가폴','태국'];
function _buildSiteCheckboxesHtml(checkedIds){
  var allChecked=!checkedIds||checkedIds.length===0;
  // S.sites 기반으로 국가별 동적 그룹화
  var regionMap={};
  (S.sites||[]).forEach(function(site){
    var r=site.country||'기타';
    if(!regionMap[r]) regionMap[r]=[];
    regionMap[r].push(site);
  });
  // S.sites에 없지만 equip에 등록된 사이트도 포함
  (S.equipSiteOrder||[]).forEach(function(sid){
    var found=(S.sites||[]).some(function(s){return s.id===sid;});
    if(!found){
      if(!regionMap['기타']) regionMap['기타']=[];
      regionMap['기타'].push({id:sid,name:(_eqSite(sid)||{name:sid}).name});
    }
  });
  var orderedRegions=_REGION_ORDER.filter(function(r){return regionMap[r];});
  // 정해진 순서에 없는 지역(직접입력·기타 포함)도 뒤에 이어서 표시
  Object.keys(regionMap).forEach(function(r){if(orderedRegions.indexOf(r)<0) orderedRegions.push(r);});

  var html='<div class="fg"><label class="fl">적용 사이트</label>'
    +'<label style="display:flex;align-items:center;gap:5px;cursor:pointer;margin-bottom:6px">'
    +'<input type="checkbox" id="eq_site_all" onchange="_onEquipSiteAllChange()"'+(allChecked?' checked':'')+'>'
    +'<span style="font-size:12px">전체 공통 (모든 사이트)</span></label>'
    +'<div id="eq_site_groups" style="display:'+(allChecked?'none':'block')+';padding:6px 8px;background:var(--bg-alt);border:1px solid var(--bd-main);border-radius:4px">';
  orderedRegions.forEach(function(region){
    var sites=regionMap[region];
    var label=_REGION_LABEL[region]||region;
    html+='<div style="margin-bottom:4px"><span style="font-size:10px;color:#7a7aaa;margin-right:6px">'+label+'</span>';
    sites.forEach(function(site){
      var chk=(!allChecked&&checkedIds&&checkedIds.indexOf(site.id)>=0)?' checked':'';
      html+='<label style="display:inline-flex;align-items:center;gap:3px;margin-right:8px;cursor:pointer;font-size:11px">'
        +'<input type="checkbox" class="eq-site-cb" value="'+site.id+'"'+chk+'>'+site.name+'</label>';
    });
    html+='</div>';
  });
  html+='</div></div>';
  return html;
}
function _onEquipSiteAllChange(){
  var allEl=document.getElementById('eq_site_all');
  var grpEl=document.getElementById('eq_site_groups');
  if(grpEl) grpEl.style.display=allEl&&allEl.checked?'none':'block';
}
function _collectSiteIds(){
  var allEl=document.getElementById('eq_site_all');
  if(allEl&&allEl.checked) return [];
  var ids=[];
  var cbs=document.querySelectorAll('.eq-site-cb:checked');
  cbs.forEach(function(cb){ids.push(cb.value);});
  return ids;
}

/* ── 그룹 선택기 (드롭다운 목록에서 옵션별로 바로 삭제 가능) ── */
function _buildEquipGroupOptionRows(){
  // SAT/IT를 항상 다시 채워넣던 고정 기본값을 없애서, 삭제하면 실제로 목록에서 완전히 사라지도록 함
  var groups=[];
  S.equipItems.forEach(function(i){if(i.groupName&&groups.indexOf(i.groupName)<0)groups.push(i.groupName);});
  var rows='<div class="eq-group-opt" onclick="_selectEquipGroupOption(\'\')">없음</div>';
  groups.forEach(function(g){
    var gEsc=g.replace(/'/g,"\\'");
    var gHtml=g.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    rows+='<div class="eq-group-opt">'
      +'<span onclick="_selectEquipGroupOption(\''+gEsc+'\')">'+gHtml+'</span>'
      +'<button type="button" class="eq-group-opt-del" onclick="event.stopPropagation();_deleteEquipGroupOption(\''+gEsc+'\')" title="목록에서 그룹 삭제">✕</button>'
      +'</div>';
  });
  return rows;
}
function _buildEquipGroupPickerHtml(currentGroup){
  currentGroup=currentGroup||'';
  return '<div class="fg"><label class="fl">그룹</label>'
    +'<div style="position:relative">'
    +'<button type="button" id="eq_group_trigger" class="btn sm" style="width:100%;text-align:left;display:flex;justify-content:space-between;align-items:center" onclick="_toggleEquipGroupPanel()">'
    +'<span id="eq_group_label">'+(currentGroup||'없음')+'</span><span>▾</span></button>'
    +'<input type="hidden" id="eq_group_value" value="'+currentGroup+'">'
    +'<div id="eq_group_panel" class="eq-group-panel" style="display:none">'+_buildEquipGroupOptionRows()+'</div>'
    +'</div>'
    +'<input type="text" id="eq_group_custom" placeholder="새 그룹명 직접 입력" style="margin-top:5px"></div>';
}
function _toggleEquipGroupPanel(){
  var panel=document.getElementById('eq_group_panel');
  if(panel) panel.style.display=(panel.style.display==='none')?'block':'none';
}
function _selectEquipGroupOption(value){
  var valEl=document.getElementById('eq_group_value');
  var lblEl=document.getElementById('eq_group_label');
  if(valEl) valEl.value=value;
  if(lblEl) lblEl.textContent=value||'없음';
  var panel=document.getElementById('eq_group_panel');
  if(panel) panel.style.display='none';
}
// 목록에 있는 그룹 항목 자체를 삭제 — 현재 선택 여부와 무관하게, 그 그룹에 속한 모든 공정 항목을 "없음"으로 변경
function _deleteEquipGroupOption(group){
  var count=S.equipItems.filter(function(i){return i.groupName===group;}).length;
  if(!confirm('"'+group+'" 그룹을 목록에서 삭제하면 이 그룹에 속한 항목 '+count+'개가 모두 "없음"으로 변경됩니다.\n계속하시겠습니까?')) return;
  S.equipItems.forEach(function(i){if(i.groupName===group){i.groupName='';_touch(i);}});
  saveData();
  var valEl=document.getElementById('eq_group_value');
  if(valEl&&valEl.value===group) _selectEquipGroupOption(''); // 지금 선택돼 있던 값이면 "없음"으로
  var panel=document.getElementById('eq_group_panel');
  if(panel){panel.innerHTML=_buildEquipGroupOptionRows();panel.style.display='block';}
  renderEquipTab(); // 모달 뒤 배경 그리드에도 즉시 반영
}

/* ── 항목 추가 ── */
function openAddEquipItem(){
  mw('<div class="mtit">공정 항목 추가</div>'
    +'<div class="fg"><label class="fl">항목명</label>'
    +'<input type="text" id="eq_item_name" placeholder="예: Final Check"></div>'
    +_buildEquipGroupPickerHtml('')
    +_buildSiteCheckboxesHtml(null)
    +'<div class="mfoot">'
    +'<button class="btn sm" onclick="cm()">취소</button>'
    +'<button class="btn sm pri" onclick="saveAddEquipItem()">추가</button>'
    +'</div>');
}

function saveAddEquipItem(){
  var name=document.getElementById('eq_item_name').value.trim();
  if(!name){alert('항목명을 입력해주세요.');return;}
  var group=document.getElementById('eq_group_custom').value.trim()
    ||document.getElementById('eq_group_value').value||'';
  var siteIds=_collectSiteIds();
  var maxOrder=0;
  S.equipItems.forEach(function(i){if(i.order>maxOrder)maxOrder=i.order;});
  var newItem=_touch({id:genId('ei',S.equipItems),name:name,groupName:group,order:maxOrder+1,siteIds:siteIds});
  S.equipItems.push(newItem);
  S.equipUnits.forEach(function(u){
    if(!u.cells) u.cells={};
    var applicable=siteIds.length===0||siteIds.indexOf(u.siteId)>=0;
    if(applicable){u.cells[newItem.id]={na:true,planDate:'',percent:0,doneDate:''};_touch(u);}
  });
  saveData();cm();renderEquipTab();
}

/* ── 항목 수정 ── */
function openEditEquipItem(itemId){
  var item=S.equipItems.find(function(i){return i.id===itemId;});
  if(!item) return;
  mw('<div class="mtit">항목 수정</div>'
    +'<div class="fg"><label class="fl">항목명</label>'
    +'<input type="text" id="eq_edit_name" value="'+item.name+'"></div>'
    +_buildEquipGroupPickerHtml(item.groupName||'')
    +_buildSiteCheckboxesHtml(item.siteIds||[])
    +'<div class="mfoot">'
    +'<button class="btn sm" onclick="cm()">취소</button>'
    +'<button class="btn sm pri" onclick="saveEditEquipItem(\''+itemId+'\')">저장</button>'
    +'</div>');
}

function saveEditEquipItem(itemId){
  var item=S.equipItems.find(function(i){return i.id===itemId;});
  if(!item) return;
  var name=document.getElementById('eq_edit_name').value.trim();
  if(!name){alert('항목명을 입력해주세요.');return;}
  var group=document.getElementById('eq_group_custom').value.trim()
    ||document.getElementById('eq_group_value').value||'';
  var newSiteIds=_collectSiteIds();
  // 새로 추가된 사이트의 units에 cells 초기화 (기존 데이터는 유지)
  S.equipUnits.forEach(function(u){
    if(!u.cells) u.cells={};
    var wasApplicable=!item.siteIds||item.siteIds.length===0||item.siteIds.indexOf(u.siteId)>=0;
    var nowApplicable=newSiteIds.length===0||newSiteIds.indexOf(u.siteId)>=0;
    if(!wasApplicable&&nowApplicable&&!u.cells[itemId]){
      u.cells[itemId]={na:true,planDate:'',percent:0,doneDate:''};_touch(u);
    }
  });
  item.name=name;item.groupName=group;item.siteIds=newSiteIds;
  _touch(item);
  saveData();cm();renderEquipTab();
}

/* ── 항목 삭제 ── */
function openDelEquipItem(itemId){
  var item=S.equipItems.find(function(i){return i.id===itemId;});
  if(!item) return;
  mw('<div class="mtit">항목 삭제</div>'
    +'<div style="background:var(--bg-danger,#2a0a0a);border:1px solid var(--bd-danger,#7a1010);border-radius:5px;padding:10px 12px;font-size:12px;color:#e84040;margin-bottom:16px">'
    +'⚠ <b>"'+item.name+'"</b> 항목을 삭제하면 <b>모든 사이트의 해당 항목 데이터가 영구 삭제</b>됩니다.'
    +'<br>이 작업은 되돌릴 수 없습니다.</div>'
    +'<div class="mfoot">'
    +'<button class="btn sm" onclick="cm()">취소</button>'
    +'<button class="btn sm red" onclick="execDelEquipItem(\''+itemId+'\')">삭제</button>'
    +'</div>');
}

function execDelEquipItem(itemId){
  S.equipItems=S.equipItems.filter(function(i){return i.id!==itemId;});
  S.equipUnits.forEach(function(u){if(u.cells&&u.cells[itemId]){delete u.cells[itemId];_touch(u);}});
  _markDeleted('equipItems',itemId);
  saveData();cm();renderEquipTab();
}

/* ── 항목 순서 변경 ── */
function moveEquipItem(itemId,dir){
  var sorted=_sortedEquipItemsGrouped();
  var idx=sorted.findIndex(function(i){return i.id===itemId;});
  var swapIdx=idx+dir;
  if(swapIdx<0||swapIdx>=sorted.length) return;
  // MC는 MC끼리, PO는 PO끼리 묶여 있도록 — 그룹 경계를 넘어가는 이동은 막음
  if((sorted[swapIdx].groupName||'')!==(sorted[idx].groupName||'')) return;
  // sorted[]는 S.equipItems와 같은 객체 참조를 담고 있으므로 order를 바로 바꾸면 실제 데이터도 바뀜.
  // 단, mt(수정시각)을 갱신해야 Sheets 동기화 시 이 변경이 "최신"으로 인식되어 되돌아가지 않음.
  var a=sorted[idx], b=sorted[swapIdx];
  var tmp=a.order;
  a.order=b.order;
  b.order=tmp;
  _touch(a);_touch(b);
  saveData();renderEquipGrid();
}

/* ── 그룹 전체 순서 변경 (그룹에 속한 항목들을 통째로 이동) ── */
function moveEquipGroup(groupName,dir){
  var sorted=_sortedEquipItemsGrouped();
  var groupSeq=[];
  sorted.forEach(function(i){var g=i.groupName||'';if(groupSeq.indexOf(g)<0)groupSeq.push(g);});
  var idx=groupSeq.indexOf(groupName);
  var swapIdx=idx+dir;
  if(idx<0||swapIdx<0||swapIdx>=groupSeq.length) return;
  var tmp=groupSeq[idx];groupSeq[idx]=groupSeq[swapIdx];groupSeq[swapIdx]=tmp;
  // 새 그룹 순서대로 전체 항목의 order를 다시 매김 (그룹 안에서의 상대 순서는 그대로 유지)
  var seq=0;
  groupSeq.forEach(function(g){
    sorted.filter(function(i){return (i.groupName||'')===g;}).forEach(function(item){
      item.order=seq++;
      _touch(item);
    });
  });
  saveData();renderEquipGrid();
}

/* ── 라인/호기 수정 ── */
function openEditEquipUnit(unitId){
  var unit=S.equipUnits.find(function(u){return u.id===unitId;});
  if(!unit) return;
  var siteOpts=S.sites.map(function(s){
    return '<option value="'+s.id+'"'+(s.id===unit.siteId?' selected':'')+'>'+s.name+'</option>';
  }).join('');
  // 프로젝트 관리 연동으로 만들어진 행은 고객사(가상 사이트) 항목을 맨 앞에 두어 저장해도 구분이 바뀌지 않게 한다
  if(_eqIsVirtualSiteId(unit.siteId)){
    var vs=_eqSite(unit.siteId);
    siteOpts='<option value="'+unit.siteId+'" selected>'+(vs?vs.name:unit.siteId)+' (프로젝트 관리 연동)</option>'+siteOpts;
  }
  var projOpts=_equipProjOpts(unit.siteId,unit.equipProjectId||'');
  // 프로젝트에 속하지 않는 사이트 직속 호기일 때 유형 선택 표시
  var hasProj=!!(unit.equipProjectId&&(S.equipProjects||[]).find(function(p){return p.id===unit.equipProjectId;}));
  var typeRow=hasProj?'':'<div class="fg"><label class="fl">유형</label>'
    +_typeFieldHtml('eq_edit_unit_type',unit.unitType||'납품셋업')+'</div>';
  mw('<div class="mtit">라인 / 호기 수정</div>'
    +'<div class="fg"><label class="fl">사이트</label>'
    +'<select id="eq_edit_unit_site" onchange="_updateEditUnitProjSelect(\''+unitId+'\')">'+siteOpts+'</select></div>'
    +(projOpts?'<div class="fg" id="eq_edit_unit_proj_wrap"><label class="fl">프로젝트</label>'
      +'<select id="eq_edit_unit_proj">'+projOpts+'</select></div>':'<div id="eq_edit_unit_proj_wrap"></div>')
    +'<div class="fg"><label class="fl">라인명 (선택)</label>'
    +'<input type="text" id="eq_edit_unit_line" value="'+(unit.lineName||'')+'" autocorrect="off" autocomplete="off" spellcheck="false"></div>'
    +'<div class="fg"><label class="fl">호기명</label>'
    +'<input type="text" id="eq_edit_unit_name" value="'+(unit.unitName||'')+'" autocorrect="off" autocomplete="off" spellcheck="false"></div>'
    +typeRow
    +'<div class="mfoot">'
    +'<button class="btn sm" onclick="cm()">취소</button>'
    +'<button class="btn sm pri" onclick="saveEditEquipUnit(\''+unitId+'\')">저장</button>'
    +'</div>');
}
function _updateEditUnitProjSelect(){
  var siteId=document.getElementById('eq_edit_unit_site').value;
  var wrap=document.getElementById('eq_edit_unit_proj_wrap');
  if(!wrap) return;
  var opts=_equipProjOpts(siteId,'');
  wrap.innerHTML=opts?'<label class="fl">프로젝트</label><select id="eq_edit_unit_proj">'+opts+'</select>':'';
}
function saveEditEquipUnit(unitId){
  var unit=S.equipUnits.find(function(u){return u.id===unitId;});
  if(!unit) return;
  var newSiteId=document.getElementById('eq_edit_unit_site').value;
  var ln=document.getElementById('eq_edit_unit_line').value.trim();
  var un=document.getElementById('eq_edit_unit_name').value.trim();
  if(!un){alert('호기명을 입력해주세요.');return;}
  var projEl=document.getElementById('eq_edit_unit_proj');
  var typeEl=document.getElementById('eq_edit_unit_type');
  unit.siteId=newSiteId;
  unit.equipProjectId=projEl?projEl.value||null:null;
  unit.lineName=ln;unit.unitName=un;
  if(typeEl) unit.unitType=_readTypeField('eq_edit_unit_type','납품셋업');
  _touch(unit);
  saveData();cm();renderEquipTab();
}

/* ── 호기 삭제 ── */
function delEquipUnit(unitId){
  var unit=S.equipUnits.find(function(u){return u.id===unitId;});
  if(!unit) return;
  if(!confirm('"'+unit.unitName+'" 호기를 삭제하시겠습니까?')) return;
  S.equipUnits=S.equipUnits.filter(function(u){return u.id!==unitId;});
  _markDeleted('equipUnits',unitId);
  saveData();renderEquipTab();
}

/* ── 호기 복사 ── */
function openCopyEquipUnit(fromUnitId){
  var from=S.equipUnits.find(function(u){return u.id===fromUnitId;});
  if(!from) return;
  var targets=S.equipUnits.filter(function(u){return u.id!==fromUnitId&&u.siteId===from.siteId;});
  if(!targets.length){alert('복사할 대상 호기가 없습니다.\n같은 사이트에 호기를 먼저 추가해주세요.');return;}
  var chkHtml=targets.map(function(u){
    return '<label class="chkrow"><input type="checkbox" class="eq_copy_target" value="'+u.id+'"> '+(u.lineName?u.lineName+' - ':'')+u.unitName+'</label>';
  }).join('');
  mw('<div class="mtit">호기 복사</div>'
    +'<div style="font-size:11px;color:#888;margin-bottom:12px">'
    +'<b>'+(from.lineName?from.lineName+' - ':'')+from.unitName+'</b>의 데이터를 복사할 대상을 선택하세요.'
    +'<br><span style="color:#cc8010">선택한 호기의 기존 데이터가 덮어쓰입니다.</span></div>'
    +'<div style="max-height:200px;overflow-y:auto;border:1px solid var(--bd-light);border-radius:5px;padding:8px 10px">'
    +chkHtml+'</div>'
    +'<div class="mfoot">'
    +'<button class="btn sm" onclick="cm()">취소</button>'
    +'<button class="btn sm pri" onclick="execCopyEquipUnit(\''+fromUnitId+'\')">복사</button>'
    +'</div>');
}

function execCopyEquipUnit(fromUnitId){
  var from=S.equipUnits.find(function(u){return u.id===fromUnitId;});
  if(!from) return;
  var checked=document.querySelectorAll('.eq_copy_target:checked');
  if(!checked.length){alert('대상 호기를 선택해주세요.');return;}
  checked.forEach(function(el){
    var target=S.equipUnits.find(function(u){return u.id===el.value;});
    if(target){target.cells=deepCopy(from.cells||{});target.cellsMt=Date.now();_touch(target);}
  });
  saveData();cm();renderEquipGrid();
}
