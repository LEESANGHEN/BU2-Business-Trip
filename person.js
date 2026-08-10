/* ════════════════════════════════════════════
   인원 출장일 관리
════════════════════════════════════════════ */

var REGION_AMERICAS_IDS=['ESHD','ESMI','ESHG','MILS','UC2','현대JV','BOSK_TN'];
var REGION_CANADA_IDS=['ESOT'];
var REGION_EUROPE_IDS=['WA','ESWA'];
var REGION_CHINA_IDS=[];
var REGION_VIETNAM_IDS=[];

function getSiteRegion(siteId){
  // 사이트 데이터에 region 필드가 있으면 우선 사용
  var site=S.sites.find(function(s){return s.id===siteId;});
  if(site&&site.region) return site.region;
  // 하위 호환: 하드코딩 배열
  var sid=(siteId||'').toUpperCase();
  if(REGION_AMERICAS_IDS.map(function(x){return x.toUpperCase();}).indexOf(sid)>=0) return 'americas';
  if(REGION_CANADA_IDS.map(function(x){return x.toUpperCase();}).indexOf(sid)>=0)   return 'canada';
  if(REGION_EUROPE_IDS.map(function(x){return x.toUpperCase();}).indexOf(sid)>=0)   return 'europe';
  return 'other';
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
  trips.filter(function(t){return t.region!=='korea';}).forEach(function(t){
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
  var onTrip=trips.some(function(t){return t.region!=='korea'&&TODAY>=pd(t.start)&&TODAY<=pd(t.end);});
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
    var region=sc.domestic?'korea':getSiteRegion(siteId);
    var s=pd(sc.start),e=pd(sc.end);
    var status=TODAY>e?'done':(TODAY>=s?'going':'plan');
    var key=sc.name;
    if(!persons[key]) persons[key]={name:sc.name,type:sc.type,trips:[]};
    var typePri={hq:6,tech:5,vision:4,host:3,outsource:2,localOutsource:1};
    if((typePri[sc.type]||0)>(typePri[persons[key].type]||0)) persons[key].type=sc.type;
    // 출장 원래 type 기록 (인원에 복수 타입 있을 수 있음)
    if(!persons[key].types) persons[key].types={};
    persons[key].types[sc.type]=true;
    persons[key].trips.push({
      siteId:siteId,siteName:siteName,siteColor:siteColor,
      region:region,start:sc.start,end:sc.end,
      days:dd(sc.start,sc.end),status:status,task:sc.task,note:sc.note,
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
    var days=rangeStart?calcOverlapDays(sc.start,sc.end,rangeStart,rangeEnd):dd(sc.start,sc.end);
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

function statusHtml(st){
  if(st==='going') return '<span class="pm-trip-status status-going">출장중</span>';
  if(st==='plan')  return '<span class="pm-trip-status status-plan">예정</span>';
  return '<span class="pm-trip-status status-done">완료</span>';
}

// ── 상태 변수
var _pmFilter='all';          // 상태 필터: all | going | home
var _pmSearch='';             // 이름 검색
var _pmSortKey='name';        // 정렬 기준: name | americas | europe | total | korea12m | koreaCur
var _pmSortAsc=true;          // 정렬 방향
var _pmTypeFilter={hq:true,outsource:true,tech:true,vision:true,host:true,localOutsource:true}; // 인원유형 체크
var _pmExpanded={};           // 행 펼침 상태: { '이름': true }
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
function togglePersonExpand(name){
  _pmExpanded[name]=!_pmExpanded[name];
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
    var days=rangeStart?calcOverlapDays(sc.start,sc.end,rangeStart,rangeEnd):dd(sc.start,sc.end);
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
  var sortBtns=[['name','이름'],['koreaCur','현재국내'],['siteTotal','전체 출장일수']];
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

  // 이름 검색 + 인원유형 필터 + 상태 필터
  var names=Object.keys(allPersons).filter(function(n){
    var p=allPersons[n];
    var typeKeys=Object.keys(p.types||{});
    if(typeKeys.length===0) typeKeys=[p.type];
    if(!typeKeys.some(function(t){return _pmTypeFilter[t];})) return false;
    if(_pmSearch && n.toLowerCase().indexOf(_pmSearch)<0) return false;
    var loc=getCurrentLocation(p.trips);
    if(_pmFilter==='going' && !loc.onTrip) return false;
    if(_pmFilter==='home'  &&  loc.onTrip) return false;
    return true;
  });

  if(!names.length){
    body.innerHTML='<div style="padding:30px 10px;text-align:center;color:#707080;font-size:13px">해당 조건의 인원이 없습니다.</div>';
    return;
  }

  // 정렬
  names=names.slice().sort(function(a,b){
    var pa=allPersons[a], pb=allPersons[b];
    var v;
    if(_pmSortKey==='name')          v=a.localeCompare(b,'ko');
    else if(_pmSortKey==='koreaCur') v=calcCurrentKoreaDays(pa.trips)-calcCurrentKoreaDays(pb.trips);
    else if(_pmSortKey==='siteTotal')v=personTotalDays(pa.trips)-personTotalDays(pb.trips);
    else                             v=a.localeCompare(b,'ko');
    return _pmSortAsc?v:-v;
  });

  body.innerHTML=renderPersonTable(allPersons, names);
}

// 인원의 전체 출장일수 합계 (전체 기간, 모든 사이트)
function personTotalDays(trips){
  return (trips||[]).reduce(function(sum,t){return sum+t.days;},0);
}

// 인원별 사이트 방문 합계 (사이트별 총 출장일수)
function aggregatePersonSiteTotals(trips){
  var map={};
  (trips||[]).forEach(function(t){
    if(!map[t.siteId]) map[t.siteId]={siteId:t.siteId,siteName:t.siteName,siteColor:t.siteColor,region:t.region,days:0};
    map[t.siteId].days+=t.days;
  });
  return Object.keys(map).map(function(k){return map[k];}).sort(function(a,b){return b.days-a.days;});
}

function renderPersonTable(persons, nameList){
  var html='<table class="pm-person-table">';
  html+='<thead><tr>';
  function thS(key,lbl){
    var isOn=_pmSortKey===key;
    var arrow=isOn?(_pmSortAsc?' ▲':' ▼'):'';
    return '<th class="'+(isOn?'on':'')+'" onclick="setPmSort(\''+key+'\')">'+lbl+arrow+'</th>';
  }
  html+=thS('name','이름');
  html+='<th>현재위치</th>';
  html+=thS('koreaCur','현재국내');
  html+=thS('siteTotal','전체 출장일수');
  html+='</tr></thead><tbody>';

  nameList.forEach(function(name){
    html+=renderPersonRow(name, persons[name]);
    if(_pmExpanded[name]) html+=renderPersonTimeline(persons[name].trips);
  });

  html+='</tbody></table>';
  html+='<div style="font-size:10px;color:#707080;padding:8px 4px;margin-top:4px">'
    +'* 이름을 클릭하면 사이트별 합계와 출장 이력을 펼쳐볼 수 있습니다.'
    +'</div>';
  return html;
}

function renderPersonRow(name, person){
  var trips=person.trips;
  var loc=getCurrentLocation(trips);
  var koreaCur=calcCurrentKoreaDays(trips);
  var totalDays=personTotalDays(trips);

  var tc=TYPE_COLOR[person.type]||'#555';
  var tl=TYPE_LBL[person.type]||person.type;
  var expanded=_pmExpanded[name];
  var arrow=expanded?'▼':'▶';

  var html='<tr class="pm-person-row" onclick="togglePersonExpand(\''+name.replace(/'/g,"\\'")+'\')">';

  // 이름 + 유형 + 펼침 화살표
  html+='<td><div style="display:flex;align-items:center;gap:6px">'
    +'<span style="font-size:10px;color:#606070">'+arrow+'</span>'
    +'<span class="pm-name">'+name+'</span>'
    +'<span class="pm-type" style="background:'+tc+'">'+tl+'</span>'
    +'</div></td>';

  // 현재 위치
  if(loc.onTrip){
    html+='<td><div style="display:flex;flex-direction:column;gap:1px">'
      +'<span style="font-size:12px;font-weight:600;color:'+loc.siteColor+'">'+loc.siteName+'</span>'
      +'<span style="font-size:10px;color:#909090">~'+fmt(loc.endDate)+'</span>'
      +'</div></td>';
  } else {
    html+='<td><span style="font-size:12px;color:#4aaa70;font-weight:500">🇰🇷 국내</span></td>';
  }

  // 현재국내
  var curColor=koreaCur===0?(loc.onTrip?'#606070':'#e84040'):(koreaCur<30?'#e8a020':'#4aaa70');
  html+='<td style="text-align:center"><span style="font-size:16px;font-weight:600;color:'+curColor+'">'+koreaCur+'</span><span class="pm-days-unit"> 일</span></td>';

  // 전체 출장일수 (전체 기간, 모든 사이트 합계)
  html+='<td style="text-align:center"><span class="pm-days-big" style="font-size:16px;font-weight:700">'+totalDays+'</span><span class="pm-days-unit"> 일</span></td>';

  html+='</tr>';
  return html;
}

function renderPersonTimeline(trips){
  if(!trips||!trips.length) return '';
  var sorted=trips.slice().sort(function(a,b){return a.start>b.start?1:-1;});
  var rows=renderPersonSiteSummary(trips);
  var prevEnd=null;
  var todayStr=TODAY.getFullYear()+'-'+String(TODAY.getMonth()+1).padStart(2,'0')+'-'+String(TODAY.getDate()).padStart(2,'0');

  sorted.forEach(function(t){
    // 이전 출장과 사이에 국내 체류 갭이 있으면 표시
    if(prevEnd!==null){
      var gapStart=new Date(pd(prevEnd));
      gapStart.setDate(gapStart.getDate()+1);
      var gapEnd=new Date(pd(t.start));
      gapEnd.setDate(gapEnd.getDate()-1);
      if(gapStart<=gapEnd){
        var gapDays=Math.round((gapEnd-gapStart)/86400000)+1;
        rows+='<div class="pm-tl-korea">'
          +'<span style="font-size:16px;margin-right:2px">🇰🇷</span>'
          +'<span style="flex:1">국내 체류</span>'
          +'<span style="color:#a0a0a8;font-size:11px">'+fmtFull(gapStart.getFullYear()+'-'+String(gapStart.getMonth()+1).padStart(2,'0')+'-'+String(gapStart.getDate()).padStart(2,'0'))
          +' → '+fmtFull(gapEnd.getFullYear()+'-'+String(gapEnd.getMonth()+1).padStart(2,'0')+'-'+String(gapEnd.getDate()).padStart(2,'0'))+'</span>'
          +'<span style="min-width:50px;text-align:right;color:#b0b0b8">'+gapDays+'일</span>'
          +'</div>';
      }
    }
    // 출장 행
    var stHtml=statusHtml(t.status);
    rows+='<div class="pm-tl-trip">'
      +'<span class="pm-trip-site" style="background:'+t.siteColor+'">'+t.siteName+'</span>'
      +'<span style="font-size:10px;padding:1px 5px;border-radius:3px;background:#1e1e2a;color:#b0b0b8">'+(t.region==='americas'?'미국':t.region==='canada'?'캐나다':t.region==='europe'?'유럽':t.region==='china'?'중국':t.region==='vietnam'?'베트남':t.region==='korea'?'국내':'기타')+'</span>'
      +'<span style="flex:1;color:#a0a0a8;font-size:11px">'+fmtFull(t.start)+' → '+fmtFull(t.end)+'</span>'
      +'<span style="min-width:50px;text-align:right;color:#c8c8d4">'+t.days+'일</span>'
      +stHtml
      +'</div>';
    prevEnd=t.end;
  });

  // 마지막 출장 후 현재까지 국내 체류 (출장중이 아닌 경우)
  var onTrip=trips.some(function(t){return TODAY>=pd(t.start)&&TODAY<=pd(t.end);});
  if(!onTrip && prevEnd!==null){
    var afterStart=new Date(pd(prevEnd));
    afterStart.setDate(afterStart.getDate()+1);
    if(afterStart<=TODAY){
      var afterDays=Math.round((TODAY-afterStart)/86400000)+1;
      rows+='<div class="pm-tl-korea">'
        +'<span style="font-size:16px;margin-right:2px">🇰🇷</span>'
        +'<span style="flex:1">국내 체류 (현재)</span>'
        +'<span style="color:#a0a0a8;font-size:11px">'+fmtFull(afterStart.getFullYear()+'-'+String(afterStart.getMonth()+1).padStart(2,'0')+'-'+String(afterStart.getDate()).padStart(2,'0'))+' → 오늘</span>'
        +'<span style="min-width:50px;text-align:right;color:#4aaa70">'+afterDays+'일</span>'
        +'</div>';
    }
  }

  return '<tr class="pm-expand-row"><td colspan="4"><div class="pm-timeline">'+rows+'</div></td></tr>';
}

// 인원 펼침 시 상단에 보여줄 "사이트별 합계" 칩 목록
function renderPersonSiteSummary(trips){
  var sites=aggregatePersonSiteTotals(trips);
  if(!sites.length) return '';
  var regionLbl={americas:'미국',canada:'캐나다',europe:'유럽',china:'중국',vietnam:'베트남',korea:'국내'};
  var html='<div class="pm-tl-sitesum">';
  sites.forEach(function(s){
    html+='<span class="pm-site-sum-chip" style="border-color:'+s.siteColor+'">'
      +'<span class="pm-site-chip" style="background:'+s.siteColor+'"></span>'
      +s.siteName+(regionLbl[s.region]?' · '+regionLbl[s.region]:'')
      +' <b>'+s.days+'일</b></span>';
  });
  html+='</div>';
  return html;
}
