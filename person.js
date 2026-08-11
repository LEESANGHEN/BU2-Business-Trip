/* ════════════════════════════════════════════
   인원 출장일 관리
════════════════════════════════════════════ */

// BU2 실제 출장 국가 기준 지역 목록 (사이트별 "지역 선택"의 기본 옵션)
var BASE_REGIONS=['국내','중국','대만','일본','베트남','말레이시아','싱가폴','태국','기타'];

function getSiteRegion(siteId){
  var site=S.sites.find(function(s){return s.id===siteId;});
  return (site&&site.region)||'기타';
}

// 지역 드롭다운에 보여줄 전체 옵션: 기본 지역 + 이미 사이트에 쓰인 커스텀(직접입력) 지역
function getAllRegionOptions(){
  var seen={};
  var list=[];
  BASE_REGIONS.forEach(function(r){if(!seen[r]){seen[r]=true;list.push(r);}});
  S.sites.forEach(function(s){if(s.region&&!seen[s.region]){seen[s.region]=true;list.push(s.region);}});
  return list;
}

function calcOverlapDays(start,end,rangeStart,rangeEnd){
  var s=pd(start),e=pd(end);
  if(rangeStart) s=new Date(Math.max(s,pd(rangeStart)));
  if(rangeEnd)   e=new Date(Math.min(e,pd(rangeEnd)));
  if(s>e) return 0;
  return Math.round((e-s)/86400000)+1;
}

function getRolling12(){
  var end=new Date(TODAY);
  var start=new Date(TODAY.getFullYear()-1,TODAY.getMonth(),TODAY.getDate());
  start.setHours(0,0,0,0); end.setHours(0,0,0,0);
  return {start:start,end:end};
}

// 롤링 12개월 창 안에서 모든 지역 합산 해외 체류일
function calcTotalOverseas12M(trips, rolling12){
  var set={};
  trips.filter(function(t){return t.region!=='국내';}).forEach(function(t){
    var s=new Date(Math.max(pd(t.start),rolling12.start));
    var e=new Date(Math.min(pd(t.end),rolling12.end));
    if(s>e) return;
    for(var cur=new Date(s);cur<=e;cur.setDate(cur.getDate()+1))
      set[cur.toDateString()]=true;
  });
  return Object.keys(set).length;
}

// 현재 연속 국내 체류일 (기존 calcKoreaDays와 동일 로직, 이름만 명확화)
function calcCurrentKoreaDays(trips){
  if(!trips||!trips.length) return 0;
  var pastTrips=trips.filter(function(t){return pd(t.end)<=TODAY;});
  if(!pastTrips.length) return 0;
  var lastEnd=pastTrips.reduce(function(mx,t){return pd(t.end)>pd(mx)?t.end:mx;},pastTrips[0].end);
  var onTrip=trips.some(function(t){return t.region!=='국내'&&TODAY>=pd(t.start)&&TODAY<=pd(t.end);});
  if(onTrip) return 0;
  var returnDay=new Date(pd(lastEnd));
  returnDay.setDate(returnDay.getDate()+1);
  if(returnDay>TODAY) return 0;
  return Math.round((TODAY-returnDay)/86400000)+1;
}

function aggregatePersonTrips(){
  var persons={};
  S.schedules.forEach(function(sc){
    // 인원 출장일 탭은 숨김 여부와 무관하게 모든 일정 집계
    var proj=S.projects.find(function(p){return p.id===sc.projectId;});
    if(!proj) return;
    var site=S.sites.find(function(s){return s.id===proj.siteId;});
    var siteId=proj.siteId;
    var siteName=site?site.name:siteId;
    var siteColor=site?site.color:'#555';
    var region=sc.domestic?'국내':getSiteRegion(siteId);
    var s=pd(sc.start),e=pd(sc.end);
    var status=TODAY>e?'done':(TODAY>=s?'going':'plan');
    var key=sc.name;
    if(!persons[key]) persons[key]={name:sc.name,type:sc.type,trips:[]};
    var typePri={hq:6,tech:5,vision:4,host:3,outsource:2,localOutsource:1};
    if((typePri[sc.type]||0)>(typePri[persons[key].type]||0)) persons[key].type=sc.type;
    // 출장 원래 type 기록 (인원에 복수 타입 있을 수 있음)
    if(!persons[key].types) persons[key].types={};
    persons[key].types[sc.type]=true;
    // 최초 계획/1차 연장/2차 연장 구간별 일수를 각각 계산
    var planEnd=sc.origEnd||sc.end;
    var planDays=dd(sc.start,planEnd);
    var ext1=sc.extensions&&sc.extensions[0];
    var ext2=sc.extensions&&sc.extensions[1];
    var ext1Days=ext1?dd(_addDaysStr(planEnd,1),ext1.end):0;
    var ext2Days=ext2?dd(_addDaysStr(ext1.end,1),ext2.end):0;
    persons[key].trips.push({
      scheduleId:sc.id,type:sc.type,
      siteId:siteId,siteName:siteName,siteColor:siteColor,
      region:region,start:sc.start,end:sc.end,planEnd:planEnd,
      days:planDays,ext1Days:ext1Days,ext2Days:ext2Days,
      tripTotal:planDays+ext1Days+ext2Days,
      status:status,task:sc.task,note:sc.note,
      domestic:sc.domestic||false
    });
  });
  Object.keys(persons).forEach(function(k){
    persons[k].trips.sort(function(a,b){return a.start>b.start?1:-1;});
  });
  return persons;
}

// 사이트별 Total 출장일수 집계 (전체/본사/외주, 기간별)
// period: 'all'(전체 기간) | 'year'(올해) | 'r12'(최근 12개월)
function aggregateSiteDays(period){
  var rangeStart=null, rangeEnd=null;
  if(period==='year'){
    rangeStart=new Date(TODAY.getFullYear(),0,1);
    rangeEnd=new Date(TODAY.getFullYear(),11,31);
  }else if(period==='r12'){
    var r12=getRolling12();
    rangeStart=r12.start; rangeEnd=r12.end;
  }

  var siteMap={}; // siteId -> {siteId,name,color,groupId,total,hq,out,local,names:{}}
  S.schedules.forEach(function(sc){
    if(!_pmSiteTypeFilter[sc.type]) return;
    var proj=S.projects.find(function(p){return p.id===sc.projectId;});
    if(!proj) return;
    var site=S.sites.find(function(s){return s.id===proj.siteId;});
    if(!site) return;
    // 현장 연장분은 제외하고 최초 계획 복귀일 기준으로 집계
    var planEnd=sc.origEnd||sc.end;
    var days=rangeStart?calcOverlapDays(sc.start,planEnd,rangeStart,rangeEnd):dd(sc.start,planEnd);
    if(days<=0) return;
    var siteId=site.id;
    if(!siteMap[siteId]) siteMap[siteId]={siteId:siteId,name:site.name,color:site.color,groupId:site.groupId,total:0,hq:0,out:0,local:0,names:{}};
    var entry=siteMap[siteId];
    entry.total+=days;
    if(sc.type==='outsource') entry.out+=days;
    else if(sc.type==='localOutsource') entry.local+=days;
    else entry.hq+=days;
    entry.names[sc.name]=true;
  });

  var groupOrder=S.groups.map(function(g){return g.id;});
  var siteList=Object.keys(siteMap).map(function(id){
    var e=siteMap[id];
    var siteObj=S.sites.find(function(s){return s.id===id;});
    return {siteId:e.siteId,name:e.name,color:e.color,groupId:e.groupId,
      total:e.total,hq:e.hq,out:e.out,local:e.local,personCount:Object.keys(e.names).length,
      estMd:(siteObj&&siteObj.estMd)||0};
  });
  siteList.sort(function(a,b){
    var gi=groupOrder.indexOf(a.groupId)-groupOrder.indexOf(b.groupId);
    if(gi!==0) return gi;
    return b.total-a.total;
  });

  var groups=[];
  siteList.forEach(function(s){
    var g=groups[groups.length-1];
    if(!g||g.groupId!==s.groupId){
      var gInfo=S.groups.find(function(x){return x.id===s.groupId;});
      g={groupId:s.groupId,groupName:gInfo?gInfo.name:(s.groupId||'미분류'),sites:[]};
      groups.push(g);
    }
    g.sites.push(s);
  });

  var grand={total:0,hq:0,out:0,local:0,names:{}};
  Object.keys(siteMap).forEach(function(id){
    grand.total+=siteMap[id].total; grand.hq+=siteMap[id].hq; grand.out+=siteMap[id].out; grand.local+=siteMap[id].local;
    Object.keys(siteMap[id].names).forEach(function(n){grand.names[n]=true;});
  });

  return {groups:groups,grandTotal:grand.total,grandHq:grand.hq,grandOut:grand.out,grandLocal:grand.local,grandPersons:Object.keys(grand.names).length};
}

// rolling 12M 기준 지역별 출장일 (중복 날짜 제거)
function calcRegionDays12M(trips, region, rolling12){
  var set={};
  trips.filter(function(t){return t.region===region;}).forEach(function(t){
    var s=new Date(Math.max(pd(t.start),rolling12.start));
    var e=new Date(Math.min(pd(t.end),rolling12.end));
    if(s>e) return;
    for(var cur=new Date(s);cur<=e;cur.setDate(cur.getDate()+1)){
      set[cur.getFullYear()+'-'+cur.getMonth()+'-'+cur.getDate()]=true;
    }
  });
  return Object.keys(set).length;
}

function getCurrentLocation(trips){
  for(var i=0;i<trips.length;i++){
    var t=trips[i];
    if(TODAY>=pd(t.start)&&TODAY<=pd(t.end)){
      return {onTrip:true,siteName:t.siteName,siteColor:t.siteColor,region:t.region,endDate:t.end};
    }
  }
  return {onTrip:false};
}

// ── 상태 변수
var _pmFilter='all';          // 상태 필터: all | going | home
var _pmSearch='';             // 이름 검색
var _pmSortKey='name';        // 정렬 기준: name | days | grandTotal
var _pmSortAsc=true;          // 정렬 방향
var _pmTypeFilter={hq:true,outsource:true,tech:true,vision:true,host:true,localOutsource:true}; // 인원유형 체크
var _pmSitePeriod='all';      // 사이트별 출장일 집계 기간: all | year | r12
var _pmSiteCollapsed=true;    // 사이트별 출장일 요약 접기 상태 (기본 접힘)
var _pmSiteTypeFilter={hq:true,outsource:true,tech:true,vision:true,host:true,localOutsource:true}; // 사이트별 요약 인원유형 체크

function setPmFilter(f){ _pmFilter=f; renderPersonTab(); }
function setPmSearch(v){
  _pmSearch=v.toLowerCase();
  renderPersonBody();
}
function setPmSort(key){
  if(_pmSortKey===key) _pmSortAsc=!_pmSortAsc;
  else { _pmSortKey=key; _pmSortAsc=key==='name'; }
  renderPersonBody();
}
function togglePmType(type){
  _pmTypeFilter[type]=!_pmTypeFilter[type];
  renderPersonBody();
}
function setPmSitePeriod(p){
  _pmSitePeriod=p;
  var el=document.getElementById('pmSiteDaysWrap');
  if(el) el.outerHTML=renderSiteDaysSummary();
}
function togglePmSiteCollapse(){
  _pmSiteCollapsed=!_pmSiteCollapsed;
  var el=document.getElementById('pmSiteDaysWrap');
  if(el) el.outerHTML=renderSiteDaysSummary();
}
function toggleSiteTypeFilter(type){
  _pmSiteTypeFilter[type]=!_pmSiteTypeFilter[type];
  var el=document.getElementById('pmSiteDaysWrap');
  if(el) el.outerHTML=renderSiteDaysSummary();
}
function updSiteEstMd(siteId,val){
  var site=S.sites.find(function(s){return s.id===siteId;});
  if(!site) return;
  var num=parseFloat(val);
  site.estMd=(isNaN(num)||num<0)?undefined:num;
  _touch(site);
  saveData();
  var el=document.getElementById('pmSiteDaysWrap');
  if(el) el.outerHTML=renderSiteDaysSummary();
}

// 견적 M/D 대비 잔여/초과 표시 (estMd 미입력 시 '-')
function _fmtEstMdDiff(estMd,allTotal){
  if(!estMd) return '<span style="color:var(--tx-muted)">-</span>';
  var diff=estMd-allTotal; // 양수: 잔여, 음수: 초과
  if(diff>=0) return '<span style="color:#4aaa70">잔여 '+diff+'일</span>';
  return '<span style="color:#ff4444">초과 '+(-diff)+'일</span>';
}

// 사이트별 Total 출장일수 요약 섹션 (전체/본사/외주)
function renderSiteDaysSummary(){
  var agg=aggregateSiteDays(_pmSitePeriod);
  // 견적 대비 차이는 기간 탭과 무관하게 항상 전체 기간 실제 출장일과 비교
  var allTotalMap=null;
  if(_pmSitePeriod!=='all'){
    var allAgg=aggregateSiteDays('all');
    allTotalMap={};
    allAgg.groups.forEach(function(g){g.sites.forEach(function(s){allTotalMap[s.siteId]=s.total;});});
  }
  var periods=[['all','전체'],['year','올해'],['r12','최근12개월']];
  var html='<div class="pm-site-days" id="pmSiteDaysWrap">';
  html+='<div class="pm-site-days-head">';
  html+='<span class="pm-site-days-title" onclick="togglePmSiteCollapse()" style="cursor:pointer">'
      +(_pmSiteCollapsed?'▶':'▼')+' 📍 사이트별 Total 출장일수</span>';
  html+='<div class="pm-ctrl-group" style="margin-left:auto">';
  periods.forEach(function(p){
    html+='<button class="pm-filter-btn'+(_pmSitePeriod===p[0]?' on':'')+'" onclick="setPmSitePeriod(\''+p[0]+'\')">'+p[1]+'</button>';
  });
  html+='</div></div>';

  if(!_pmSiteCollapsed){
    var siteTypeList=[['hq','본사',TYPE_COLOR.hq],['outsource','외주',TYPE_COLOR.outsource],['localOutsource','현지외주',TYPE_COLOR.localOutsource],['tech','기술',TYPE_COLOR.tech],['vision','비전',TYPE_COLOR.vision],['host','호스트',TYPE_COLOR.host]];
    html+='<div class="pm-ctrl-group" style="flex-wrap:wrap;gap:4px;padding:8px 12px 0 12px">';
    html+='<span style="font-size:10px;color:#555">인원</span>';
    siteTypeList.forEach(function(t){
      var isOn=_pmSiteTypeFilter[t[0]];
      html+='<label class="pm-type-ck'+(isOn?' on':'')+'" style="--tc:'+t[2]+';'+(isOn?'background:'+t[2]+'22;border-color:'+t[2]:'')+'"><input type="checkbox"'+(isOn?' checked':'')+' onchange="toggleSiteTypeFilter(\''+t[0]+'\')">'+t[1]+'</label>';
    });
    html+='</div>';

    if(!agg.groups.length){
      html+='<div style="padding:12px;color:var(--tx-muted);font-size:12px">해당 조건에 등록된 출장 일정이 없습니다.</div>';
    }else{
      html+='<table class="pm-person-table pm-site-days-table"><thead><tr>'
          +'<th>사이트</th><th>전체 출장일</th><th>본사</th><th>외주</th><th>현지외주</th><th>출장 인원수</th><th>견적 M/D</th><th>차이</th>'
          +'</tr></thead><tbody>';
      var grandEstMd=0, grandAllTotal=0;
      agg.groups.forEach(function(g){
        html+='<tr class="pm-site-group-row"><td colspan="8">'+_esc(g.groupName)+'</td></tr>';
        g.sites.forEach(function(s){
          var sidAttr=s.siteId.replace(/'/g,"\\'");
          var allTotal=allTotalMap?(allTotalMap[s.siteId]||0):s.total;
          grandEstMd+=s.estMd; grandAllTotal+=allTotal;
          html+='<tr>'
              +'<td onclick="openSiteRosterModal(\''+sidAttr+'\')" style="cursor:pointer"><span class="pm-site-chip" style="background:'+s.color+'"></span>'+_esc(s.name)+'</td>'
              +'<td>'+s.total+'일</td>'
              +'<td>'+s.hq+'일</td>'
              +'<td>'+s.out+'일</td>'
              +'<td>'+s.local+'일</td>'
              +'<td>'+s.personCount+'명</td>'
              +'<td><input type="number" min="0" class="pm-estmd-inp" value="'+(s.estMd||'')+'" placeholder="-" onchange="updSiteEstMd(\''+sidAttr+'\',this.value)"></td>'
              +'<td>'+_fmtEstMdDiff(s.estMd,allTotal)+'</td>'
              +'</tr>';
        });
      });
      html+='<tr class="pm-site-total-row">'
          +'<td>합계</td><td>'+agg.grandTotal+'일</td><td>'+agg.grandHq+'일</td><td>'+agg.grandOut+'일</td><td>'+agg.grandLocal+'일</td><td>'+agg.grandPersons+'명</td>'
          +'<td>'+(grandEstMd?grandEstMd+'일':'-')+'</td><td>'+_fmtEstMdDiff(grandEstMd,grandAllTotal)+'</td>'
          +'</tr>';
      html+='</tbody></table>';
    }
  }
  html+='</div>';
  return html;
}

// 사이트 클릭 → 인원 로스터 모달 (현재 기간·인원구분 필터를 그대로 반영해 요약표와 대조 가능)
function openSiteRosterModal(siteId){
  var site=S.sites.find(function(s){return s.id===siteId;});
  if(!site) return;
  var period=_pmSitePeriod;
  var rangeStart=null, rangeEnd=null;
  if(period==='year'){ rangeStart=new Date(TODAY.getFullYear(),0,1); rangeEnd=new Date(TODAY.getFullYear(),11,31); }
  else if(period==='r12'){ var r12=getRolling12(); rangeStart=r12.start; rangeEnd=r12.end; }

  var rows=[];
  S.schedules.forEach(function(sc){
    if(!_pmSiteTypeFilter[sc.type]) return;
    var proj=S.projects.find(function(p){return p.id===sc.projectId;});
    if(!proj||proj.siteId!==siteId) return;
    var planEnd=sc.origEnd||sc.end;
    var days=rangeStart?calcOverlapDays(sc.start,planEnd,rangeStart,rangeEnd):dd(sc.start,planEnd);
    if(days<=0) return;
    rows.push({name:sc.name,type:sc.type,task:sc.task||'',start:sc.start,end:sc.end,days:days});
  });
  rows.sort(function(a,b){return a.start>b.start?1:(a.start<b.start?-1:a.name.localeCompare(b.name,'ko'));});

  var total=rows.reduce(function(sum,r){return sum+r.days;},0);
  var sidAttr2=siteId.replace(/'/g,"\\'");
  var body='<div class="mtit" style="display:flex;align-items:center;justify-content:space-between;gap:8px">'
      +'<span>'+_esc(site.name)+' — 인원 출장 로스터</span>'
      +'<button class="btn sm" onclick="exportSiteRosterExcel(\''+sidAttr2+'\')">📥 전체 이력 엑셀 다운로드</button>'
      +'</div>';
  if(!rows.length){
    body+='<div style="padding:10px;color:var(--tx-muted);font-size:12px">해당 조건에 표시할 출장 기록이 없습니다.</div>';
  }else{
    body+='<div style="max-height:60vh;overflow-y:auto"><table class="pm-person-table"><thead><tr>'
        +'<th>이름</th><th>인원구분</th><th>업무</th><th>출발일</th><th>복귀일</th><th>일수</th>'
        +'</tr></thead><tbody>';
    rows.forEach(function(r){
      body+='<tr>'
          +'<td>'+_esc(r.name)+'</td>'
          +'<td>'+_esc(TYPE_LBL[r.type]||r.type)+'</td>'
          +'<td>'+_esc(r.task)+'</td>'
          +'<td>'+r.start+'</td>'
          +'<td>'+r.end+'</td>'
          +'<td>'+r.days+'일</td>'
          +'</tr>';
    });
    body+='<tr class="pm-site-total-row"><td colspan="5">합계</td><td>'+total+'일</td></tr>';
    body+='</tbody></table></div>';
  }
  body+='<div class="mfoot"><button class="btn sm" onclick="cm()">닫기</button></div>';
  mw(body,true);
}

// renderPersonTab : 전체 렌더 (탭 첫 진입, 지역필터 변경 시)
// renderPersonBody: 결과 테이블만 갱신 (검색·정렬·타입필터 변경 시 → 검색창 IME 유지)
function renderPersonTab(){
  var wrap=document.getElementById('pmWrap');
  if(!wrap) return;

  var allPersons=aggregatePersonTrips();
  var allNames=Object.keys(allPersons);

  var totalPersons=allNames.length;
  var onTripNow=allNames.filter(function(n){return getCurrentLocation(allPersons[n].trips).onTrip;}).length;
  var isOut=function(t){return t==='outsource'||t==='localOutsource';};
  var totalHq=allNames.filter(function(n){return !isOut(allPersons[n].type);}).length;
  var totalOut=allNames.filter(function(n){return isOut(allPersons[n].type);}).length;
  var onTripHq=allNames.filter(function(n){return getCurrentLocation(allPersons[n].trips).onTrip&&!isOut(allPersons[n].type);}).length;
  var onTripOut=allNames.filter(function(n){return getCurrentLocation(allPersons[n].trips).onTrip&&isOut(allPersons[n].type);}).length;

  if(!totalPersons){
    wrap.innerHTML='<div style="padding:40px;text-align:center;color:#555">등록된 출장 일정이 없습니다.</div>';
    return;
  }

  var html='';

  html+='<div class="pm-fixed-header">';

  // 통계 카드
  html+='<div class="pm-stats-row">';
  html+='<div class="pm-stat-card"><div class="pm-stat-val">'+totalPersons+'</div><div class="pm-stat-lbl">등록 인원</div><div class="pm-stat-sub">전체 출장자</div><div class="pm-stat-breakdown"><span class="pm-bd-hq">본사계열 '+totalHq+'</span><span class="pm-bd-out">외주 '+totalOut+'</span></div></div>';
  html+='<div class="pm-stat-card"><div class="pm-stat-val" style="color:#2176cc">'+onTripNow+'</div><div class="pm-stat-lbl">현재 출장 중</div><div class="pm-stat-sub">오늘 기준</div><div class="pm-stat-breakdown"><span class="pm-bd-hq">본사계열 '+onTripHq+'</span><span class="pm-bd-out">외주 '+onTripOut+'</span></div></div>';
  html+='</div>';

  // ── 사이트별 Total 출장일수 요약
  html+=renderSiteDaysSummary();

  // ── 컨트롤 바 (검색창 포함 - 여기서 한 번만 생성, 이후 재생성 안 함)
  html+='<div class="pm-ctrl-bar" id="pmCtrlBar">';
  html+='<div class="pm-ctrl-group">';
  html+='<span style="font-size:11px;color:#666">🔍</span>';
  html+='<input class="pm-search" id="pmSearchInp" type="text" placeholder="이름 검색..." autocomplete="off" oninput="setPmSearch(this.value)">';
  html+='</div>';
  html+='<div class="pm-ctrl-sep"></div>';
  html+='<div class="pm-ctrl-group">';
  html+='<span style="font-size:10px;color:#555">상태</span>';
  [{v:'all',l:'전체'},{v:'going',l:'출장중'},{v:'home',l:'국내'}].forEach(function(f){
    html+='<button class="pm-filter-btn'+((_pmFilter===f.v)?' on':'')+'" onclick="setPmFilter(\''+f.v+'\')">'+f.l+'</button>';
  });
  html+='</div>';
  html+='<div class="pm-ctrl-sep"></div>';
  html+='<div class="pm-ctrl-group" style="flex-wrap:wrap;gap:4px">';
  html+='<span style="font-size:10px;color:#555">인원</span>';
  var typeList=[['hq','본사',TYPE_COLOR.hq],['outsource','외주',TYPE_COLOR.outsource],['localOutsource','현지외주',TYPE_COLOR.localOutsource],['tech','기술',TYPE_COLOR.tech],['vision','비전',TYPE_COLOR.vision],['host','호스트',TYPE_COLOR.host]];
  typeList.forEach(function(t){
    var isOn=_pmTypeFilter[t[0]];
    html+='<label class="pm-type-ck'+(isOn?' on':'')+'" style="--tc:'+t[2]+';'+(isOn?'background:'+t[2]+'22;border-color:'+t[2]:'')+'"><input type="checkbox"'+(isOn?' checked':'')+' onchange="togglePmType(\''+t[0]+'\')">'+t[1]+'</label>';
  });
  html+='</div>';
  html+='<div class="pm-ctrl-sep"></div>';
  html+='<div class="pm-ctrl-group" id="pmSortBtns">';
  html+=buildSortBtnsHtml();
  html+='</div>';
  html+='</div>';

  html+='</div>'; // .pm-fixed-header 닫기

  // ── 결과 영역 (검색/정렬/타입 변경 시 이 div만 갱신)
  html+='<div class="pm-body-scroll"><div id="pmBody"></div></div>';

  wrap.innerHTML=html;
  renderPersonBody(); // 결과 채우기
}

// 정렬 버튼 HTML 조각 생성 (컨트롤바 내 정렬 버튼 업데이트에 재사용)
function buildSortBtnsHtml(){
  var sortBtns=[['name','이름'],['days','최초 출장일수'],['grandTotal','전체 출장일수']];
  var h='<span style="font-size:10px;color:#555">정렬</span>';
  sortBtns.forEach(function(b){
    var isOn=_pmSortKey===b[0];
    var arrow=isOn?(_pmSortAsc?'▲':'▼'):'';
    h+='<button class="pm-sort-btn'+(isOn?' on':'')+'" onclick="setPmSort(\''+b[0]+'\')">'+b[1]+'<span class="pm-sort-arrow">'+arrow+'</span></button>';
  });
  return h;
}

// 결과 테이블만 갱신 - pmCtrlBar/pmSearchInp DOM 건드리지 않음
function renderPersonBody(){
  var body=document.getElementById('pmBody');
  if(!body) return;

  // 정렬 버튼 상태만 업데이트 (검색창과 무관)
  var sortEl=document.getElementById('pmSortBtns');
  if(sortEl) sortEl.innerHTML=buildSortBtnsHtml();

  // 타입필터 버튼 상태 업데이트
  var ctrlBar=document.getElementById('pmCtrlBar');
  if(ctrlBar){
    ctrlBar.querySelectorAll('.pm-type-ck').forEach(function(el){
      var t=el.querySelector('input[type=checkbox]');
      if(!t) return;
      var type=t.getAttribute('onchange').replace(/togglePmType\('|'\)/g,'');
      var isOn=_pmTypeFilter[type];
      el.className='pm-type-ck'+(isOn?' on':'');
      el.style.cssText='--tc:'+TYPE_COLOR[type]+';'+(isOn?'background:'+TYPE_COLOR[type]+'22;border-color:'+TYPE_COLOR[type]:'');
      t.checked=isOn;
    });
  }

  var allPersons=aggregatePersonTrips();

  // 인원별 전체 출장일수(모든 출장 합산) 미리 계산
  var grandTotals={};
  Object.keys(allPersons).forEach(function(n){
    grandTotals[n]=allPersons[n].trips.reduce(function(s,t){return s+t.tripTotal;},0);
  });

  // 출장(일정) 1건당 1행으로 평탄화
  var rows=[];
  Object.keys(allPersons).forEach(function(n){
    allPersons[n].trips.forEach(function(t){
      rows.push({name:n,trip:t,grandTotal:grandTotals[n]});
    });
  });

  // 이름 검색 + 인원유형 필터 + 상태 필터 (행=출장 단위)
  rows=rows.filter(function(r){
    if(!_pmTypeFilter[r.trip.type]) return false;
    if(_pmSearch && r.name.toLowerCase().indexOf(_pmSearch)<0) return false;
    if(_pmFilter==='going' && r.trip.status!=='going') return false;
    if(_pmFilter==='home'  && !r.trip.domestic) return false;
    return true;
  });

  if(!rows.length){
    body.innerHTML='<div style="padding:30px 10px;text-align:center;color:#707080;font-size:13px">해당 조건의 출장이 없습니다.</div>';
    return;
  }

  // 정렬
  rows.sort(function(a,b){
    var v;
    if(_pmSortKey==='name')            v=a.name.localeCompare(b.name,'ko')||a.trip.start.localeCompare(b.trip.start);
    else if(_pmSortKey==='days')       v=a.trip.days-b.trip.days;
    else if(_pmSortKey==='grandTotal') v=a.grandTotal-b.grandTotal;
    else                                v=a.name.localeCompare(b.name,'ko');
    return _pmSortAsc?v:-v;
  });

  body.innerHTML=renderPersonTable(rows);
}

function renderPersonTable(rows){
  var html='<table class="pm-person-table">';
  html+='<thead><tr>';
  function thS(key,lbl){
    var isOn=_pmSortKey===key;
    var arrow=isOn?(_pmSortAsc?' ▲':' ▼'):'';
    return '<th class="'+(isOn?'on':'')+'" onclick="setPmSort(\''+key+'\')">'+lbl+arrow+'</th>';
  }
  html+=thS('name','이름');
  html+='<th>지역</th><th>사이트</th>';
  html+=thS('days','최초 출장일수');
  html+='<th>1차 연장일수</th><th>2차 연장일수</th>';
  html+=thS('grandTotal','전체 출장일수');
  html+='</tr></thead><tbody>';

  rows.forEach(function(r){ html+=renderPersonRow(r); });

  html+='</tbody></table>';
  html+='<div style="font-size:10px;color:#707080;padding:8px 4px;margin-top:4px">'
    +'* 전체 출장일수는 해당 인원의 모든 출장을 합산한 값입니다 (같은 인원의 각 행에 동일하게 표시).'
    +'</div>';
  return html;
}

function renderPersonRow(r){
  var t=r.trip;
  var tc=TYPE_COLOR[t.type]||'#555';
  var tl=TYPE_LBL[t.type]||t.type;
  var regionLbl=t.region||'기타';

  var html='<tr class="pm-person-row">';
  html+='<td><div style="display:flex;align-items:center;gap:6px">'
    +'<span class="pm-name">'+r.name+'</span>'
    +'<span class="pm-type" style="background:'+tc+'">'+tl+'</span>'
    +'</div></td>';
  html+='<td>'+regionLbl+'</td>';
  html+='<td><span class="pm-site-chip" style="background:'+t.siteColor+'"></span>'+t.siteName+'</td>';
  html+='<td style="text-align:center"><span class="pm-days-big" style="font-size:15px">'+t.days+'</span><span class="pm-days-unit"> 일</span></td>';
  html+='<td style="text-align:center">'+(t.ext1Days>0?'<span style="color:#e0972e;font-weight:600">'+t.ext1Days+'일</span>':'<span style="color:var(--tx-muted)">-</span>')+'</td>';
  html+='<td style="text-align:center">'+(t.ext2Days>0?'<span style="color:#e05050;font-weight:600">'+t.ext2Days+'일</span>':'<span style="color:var(--tx-muted)">-</span>')+'</td>';
  html+='<td style="text-align:center"><span class="pm-days-big" style="font-size:15px;font-weight:700">'+r.grandTotal+'</span><span class="pm-days-unit"> 일</span></td>';
  html+='</tr>';
  return html;
}
