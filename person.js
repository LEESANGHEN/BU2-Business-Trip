/* ════════════════════════════════════════════
   인원 출장일 관리
════════════════════════════════════════════ */

// BU2 실제 출장 국가 목록 (사이트별 "국가 선택"의 기본 옵션)
var BASE_REGIONS=['국내','중국','대만','일본','베트남','말레이시아','싱가폴','태국','기타'];

// 국가별 세부 지역(도시) 목록 — "국가"를 고르면 이 목록을 기준으로 "세부 지역" 드롭다운이 바뀜
var COUNTRY_REGIONS={
  '국내':['부산','김해','진해','구미','세종'],
  '중국':['충칭','선전','후아이안','후이저우'],
  '대만':['타이중','양메이','신펑','산잉','중리','가오슝','타오위안'],
  '일본':['기후 이비','나가노','니가타','교토 아야베'],
  '베트남':['타이응우옌성','하이퐁'],
  '말레이시아':['쿨림'],
  '싱가폴':['우드랜드'],
  '태국':['시마하폿']
};

// 사이트의 "국가" (인원 출장일/설비 진행율 탭에서 "지역"으로 표시되는 값)
function getSiteRegion(siteId){
  var site=S.sites.find(function(s){return s.id===siteId;});
  return (site&&site.country)||'기타';
}

// 국가 드롭다운에 보여줄 전체 옵션: 기본 국가 + 이미 사이트에 쓰인 커스텀(직접입력) 국가
function getAllRegionOptions(){
  var seen={};
  var list=[];
  BASE_REGIONS.forEach(function(r){if(!seen[r]){seen[r]=true;list.push(r);}});
  S.sites.forEach(function(s){if(s.country&&!seen[s.country]){seen[s.country]=true;list.push(s.country);}});
  return list;
}

// 특정 국가를 선택했을 때 "세부 지역" 드롭다운에 보여줄 옵션: 그 국가의 기본 도시 + 이미 그 국가에 쓰인 커스텀 지역
function getRegionOptionsForCountry(country){
  var seen={};
  var list=[];
  (COUNTRY_REGIONS[country]||[]).forEach(function(r){if(!seen[r]){seen[r]=true;list.push(r);}});
  S.sites.forEach(function(s){if((s.country||'기타')===country&&s.region&&!seen[s.region]){seen[s.region]=true;list.push(s.region);}});
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
    var city=sc.domestic?'':((site&&site.region)||'');
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
      scheduleId:sc.id,type:sc.type,occSeq:sc.occSeq||1,
      siteId:siteId,siteName:siteName,siteColor:siteColor,
      region:region,city:city,start:sc.start,end:sc.end,planEnd:planEnd,
      days:planDays,ext1Days:ext1Days,ext2Days:ext2Days,
      tripTotal:_tripTotalDays(sc),
      status:status,task:sc.task,note:sc.note,
      domestic:sc.domestic||false
    });
  });
  Object.keys(persons).forEach(function(k){
    persons[k].trips.sort(function(a,b){return a.start>b.start?1:-1;});
  });
  return persons;
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
var _pmFilter='all';          // 상태 필터: all | done | going | plan
var _pmSearch='';             // 이름 검색
var _pmSortKey='name';        // 정렬 기준: name | country | site
var _pmSortAsc=true;          // 정렬 방향
var _pmTypeFilter={hq:true,outsource:true,tech:true,vision:true,host:true,localOutsource:true}; // 인원유형 체크
var _pmHideDone=true;         // 켜면 진행중(출장중) 상태만 남기고 완료/예정은 숨김 — 기본 On

function setPmFilter(f){ _pmFilter=f; renderPersonBody(); }
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
function togglePmHideDone(){
  _pmHideDone=!_pmHideDone;
  renderPersonBody();
}
// 상단 통계 카드의 인원유형 구성 배지 — 예전엔 본사/외주 두 갈래로만 묶어서 기술·비전·호스트
// 인원까지 전부 "본사계열"로 보였다. 실제 인원유형(TYPE_LBL) 그대로, 존재하는 유형만 표시한다.
var _PM_TYPE_ORDER=['hq','outsource','localOutsource','tech','vision','host'];
function _pmTypeBreakdownHtml(names,allPersons){
  var counts={};
  names.forEach(function(n){ var ty=allPersons[n].type; counts[ty]=(counts[ty]||0)+1; });
  return _PM_TYPE_ORDER.filter(function(ty){return counts[ty];}).map(function(ty){
    var key='pmType'+ty.charAt(0).toUpperCase()+ty.slice(1);
    var c=TYPE_COLOR[ty]||'#666';
    return '<span class="pm-bd-type" style="color:'+c+';background:'+c+'22">'+t(key)+' '+counts[ty]+'</span>';
  }).join('');
}

// renderPersonTab : 전체 렌더 (탭 첫 진입, 지역필터 변경 시)
// renderPersonBody: 결과 테이블만 갱신 (검색·정렬·타입필터 변경 시 → 검색창 IME 유지)
function renderPersonTab(){
  var wrap=document.getElementById('pmWrap');
  if(!wrap) return;
  // 통계 카드/컨트롤바까지 통째로 다시 그리면 .pm-body-scroll이 새 요소로 교체되어 스크롤이
  // 맨 위로 튀어버린다(언어 변경/관리자 모드 전환/탭 재진입 등). 이전 위치를 기억했다가 복원한다
  var _prevScroll=wrap.querySelector('.pm-body-scroll');
  var _sTop=_prevScroll?_prevScroll.scrollTop:0, _sLeft=_prevScroll?_prevScroll.scrollLeft:0;

  var allPersons=aggregatePersonTrips();
  var allNames=Object.keys(allPersons);

  var totalPersons=allNames.length;
  var onTripNames=allNames.filter(function(n){return getCurrentLocation(allPersons[n].trips).onTrip;});
  var onTripNow=onTripNames.length;
  var totalBreakdown=_pmTypeBreakdownHtml(allNames,allPersons);
  var onTripBreakdown=_pmTypeBreakdownHtml(onTripNames,allPersons);

  if(!totalPersons){
    wrap.innerHTML='<div style="padding:40px;text-align:center;color:#555">등록된 출장 일정이 없습니다.</div>';
    return;
  }

  var html='';

  html+='<div class="pm-fixed-header">';

  // 통계 카드
  html+='<div class="pm-stats-row">';
  html+='<div class="pm-stat-card"><div class="pm-stat-val">'+totalPersons+'</div><div class="pm-stat-lbl">'+t('statRegisteredPersons')+'</div><div class="pm-stat-sub">'+t('statAllTravelers')+'</div><div class="pm-stat-breakdown">'+totalBreakdown+'</div></div>';
  html+='<div class="pm-stat-card"><div class="pm-stat-val" style="color:#2176cc">'+onTripNow+'</div><div class="pm-stat-lbl">'+t('statOnTripNow')+'</div><div class="pm-stat-sub">'+t('statTodayBasis')+'</div><div class="pm-stat-breakdown">'+onTripBreakdown+'</div></div>';
  html+='</div>';

  // ── 컨트롤 바 (검색창 포함 - 여기서 한 번만 생성, 이후 재생성 안 함)
  html+='<div class="pm-ctrl-bar" id="pmCtrlBar">';
  html+='<div class="pm-ctrl-group">';
  html+='<span style="font-size:11px;color:#666">🔍</span>';
  html+='<input class="pm-search" id="pmSearchInp" type="text" placeholder="'+t('pmSearchPh')+'" autocomplete="off" oninput="setPmSearch(this.value)">';
  html+='</div>';
  html+='<div class="pm-ctrl-sep"></div>';
  html+='<div class="pm-ctrl-group">';
  html+='<span style="font-size:10px;color:#555">'+t('mpStatus')+'</span>';
  [{v:'all',l:t('pmStatusAll')},{v:'done',l:t('pmStatusDone')},{v:'going',l:t('pmStatusGoing')},{v:'plan',l:t('pmStatusPlan')}].forEach(function(f){
    html+='<button class="pm-filter-btn'+((_pmFilter===f.v)?' on':'')+'" onclick="setPmFilter(\''+f.v+'\')">'+f.l+'</button>';
  });
  html+='</div>';
  html+='<div class="pm-ctrl-sep"></div>';
  html+='<div class="pm-ctrl-group" style="flex-wrap:wrap;gap:4px">';
  html+='<span style="font-size:10px;color:#555">'+t('pmPersonTypeLabel')+'</span>';
  var typeList=[['hq',t('pmTypeHq'),TYPE_COLOR.hq],['outsource',t('pmTypeOutsource'),TYPE_COLOR.outsource],['localOutsource',t('pmTypeLocalOutsource'),TYPE_COLOR.localOutsource],['tech',t('pmTypeTech'),TYPE_COLOR.tech],['vision',t('pmTypeVision'),TYPE_COLOR.vision],['host',t('pmTypeHost'),TYPE_COLOR.host]];
  typeList.forEach(function(tp){
    var isOn=_pmTypeFilter[tp[0]];
    html+='<label class="pm-type-ck'+(isOn?' on':'')+'" style="--tc:'+tp[2]+';'+(isOn?'background:'+tp[2]+'22;border-color:'+tp[2]:'')+'"><input type="checkbox"'+(isOn?' checked':'')+' onchange="togglePmType(\''+tp[0]+'\')">'+tp[1]+'</label>';
  });
  html+='</div>';
  html+='<div class="pm-ctrl-sep"></div>';
  html+='<div class="pm-ctrl-group" id="pmSortBtns">';
  html+=buildSortBtnsHtml();
  html+='</div>';
  html+='<div class="pm-ctrl-sep"></div>';
  html+='<div class="pm-ctrl-group">';
  html+='<button class="pm-filter-btn'+(_pmHideDone?' on':'')+'" id="pmHideDoneBtn" onclick="togglePmHideDone()">'+t('pmHideDone')+'</button>';
  html+='</div>';
  html+='</div>';

  html+='</div>'; // .pm-fixed-header 닫기

  // ── 결과 영역 (검색/정렬/타입 변경 시 이 div만 갱신)
  html+='<div class="pm-body-scroll"><div id="pmBody"></div></div>';

  wrap.innerHTML=html;
  renderPersonBody(); // 결과 채우기
  var _newScroll=wrap.querySelector('.pm-body-scroll');
  if(_newScroll){_newScroll.scrollTop=_sTop;_newScroll.scrollLeft=_sLeft;}
}

// 정렬 버튼 HTML 조각 생성 (컨트롤바 내 정렬 버튼 업데이트에 재사용)
function buildSortBtnsHtml(){
  var sortBtns=[['name',t('pmSortName')],['country',t('pmSortCountry')],['site',t('pmSortSite')]];
  var h='<span style="font-size:10px;color:#555">'+t('pmSortLabel')+'</span>';
  sortBtns.forEach(function(b){
    var isOn=_pmSortKey===b[0];
    var arrow=isOn?(_pmSortAsc?'▲':'▼'):'';
    h+='<button class="pm-sort-btn'+(isOn?' on':'')+'" onclick="setPmSort(\''+b[0]+'\')">'+b[1]+'<span class="pm-sort-arrow">'+arrow+'</span></button>';
  });
  return h;
}

// 인원별 "전체 출장일수" — 같은 기간에 여러 프로젝트로 겹쳐서 출장을 가더라도(같은 사이트, 동시 진행)
// 실제 달력상 겹치는 날짜는 한 번만 센다 (calcTotalOverseas12M과 동일한 날짜 Set 방식)
function _personTotalDaysUnion(trips){
  var set={};
  trips.forEach(function(t){
    var s=pd(t.start),e=pd(t.end);
    for(var cur=new Date(s);cur<=e;cur.setDate(cur.getDate()+1))
      set[cur.toDateString()]=true;
  });
  return Object.keys(set).length;
}

// 같은 사람 + 같은 사이트에서 기간이 겹치는 여러 출장(동시에 여러 프로젝트 수행하러 간 같은 출장)은
// 그중 가장 긴 일정을 대표로 선택해 표에는 한 줄로만 보여준다 (전체 출장일수 집계와는 무관 — 그건 항상 모든 출장 기준)
function _dedupTripsBySite(trips){
  var bySite={};
  trips.forEach(function(t){
    (bySite[t.siteId]=bySite[t.siteId]||[]).push(t);
  });
  var result=[];
  Object.keys(bySite).forEach(function(siteId){
    var list=bySite[siteId].slice().sort(function(a,b){return a.start>b.start?1:(a.start<b.start?-1:0);});
    var clusters=[];
    list.forEach(function(t){
      var cur=clusters[clusters.length-1];
      if(cur && t.start<=cur.end){
        cur.items.push(t);
        if(t.end>cur.end) cur.end=t.end;
      }else{
        clusters.push({start:t.start,end:t.end,items:[t]});
      }
    });
    clusters.forEach(function(c){
      var rep=c.items[0];
      c.items.forEach(function(t){ if(t.tripTotal>rep.tripTotal) rep=t; });
      result.push(rep);
    });
  });
  return result;
}

// 인원 이름 클릭 시: 국가/지역/사이트별로 며칠 출장 갔는지 + 전체 합계를 보여주는 상세 모달
// (겹치는 기간은 날짜 Set으로 중복 제거 — _personTotalDaysUnion과 동일한 방식이라 합계가 정확히 일치한다)
function _personSiteBreakdown(trips){
  var bySite={};
  trips.forEach(function(t){
    var key=t.siteId;
    if(!bySite[key]) bySite[key]={siteId:t.siteId,siteName:t.siteName,siteColor:t.siteColor,region:t.region,city:t.city,dates:{}};
    var s=pd(t.start),e=pd(t.end);
    for(var cur=new Date(s);cur<=e;cur.setDate(cur.getDate()+1))
      bySite[key].dates[cur.toDateString()]=true;
  });
  return Object.keys(bySite).map(function(k){
    var b=bySite[k];
    return {siteId:b.siteId,siteName:b.siteName,siteColor:b.siteColor,region:b.region||'기타',city:b.city||'-',days:Object.keys(b.dates).length};
  }).sort(function(a,b){return b.days-a.days;});
}
function openPersonDaysModal(name){
  var allPersons=aggregatePersonTrips();
  var p=allPersons[name];
  if(!p){cm();return;}
  var rows=_personSiteBreakdown(p.trips);
  var total=_personTotalDaysUnion(p.trips);
  var body='<div class="mtit">'+_esc(name)+' — 출장일수 상세</div>';
  if(!rows.length){
    body+='<div style="padding:10px;color:var(--tx-muted);font-size:12px">출장 기록이 없습니다.</div>';
  }else{
    body+='<table class="pm-person-table"><thead><tr><th>국가</th><th>지역</th><th>사이트</th><th>일수</th></tr></thead><tbody>';
    rows.forEach(function(r){
      body+='<tr>'
        +'<td>'+_esc(tRegion(r.region))+'</td>'
        +'<td>'+_esc(r.city)+'</td>'
        +'<td><span class="pm-site-chip" style="background:'+r.siteColor+'"></span>'+_esc(r.siteName)+'</td>'
        +'<td>'+r.days+'일</td>'
        +'</tr>';
    });
    body+='<tr class="pm-site-total-row"><td colspan="3">합계</td><td>'+total+'일</td></tr>';
    body+='</tbody></table>';
  }
  body+='<div class="mfoot"><button class="btn sm" onclick="cm()">닫기</button></div>';
  mw(body,true);
}

// 결과 테이블만 갱신 - pmCtrlBar/pmSearchInp DOM 건드리지 않음
function renderPersonBody(){
  var body=document.getElementById('pmBody');
  if(!body) return;

  // 정렬 버튼 상태만 업데이트 (검색창과 무관)
  var sortEl=document.getElementById('pmSortBtns');
  if(sortEl) sortEl.innerHTML=buildSortBtnsHtml();

  var hideDoneBtn=document.getElementById('pmHideDoneBtn');
  if(hideDoneBtn) hideDoneBtn.className='pm-filter-btn'+(_pmHideDone?' on':'');

  // 상태 필터(전체/출장중/국내) 버튼 상태 업데이트
  var ctrlBar=document.getElementById('pmCtrlBar');
  if(ctrlBar){
    ctrlBar.querySelectorAll("button[onclick^=\"setPmFilter\"]").forEach(function(btn){
      var v=btn.getAttribute('onclick').replace(/setPmFilter\('|'\)/g,'');
      btn.className='pm-filter-btn'+(_pmFilter===v?' on':'');
    });
  }

  // 타입필터 버튼 상태 업데이트
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
    grandTotals[n]=_personTotalDaysUnion(allPersons[n].trips);
  });

  // 출장(일정) 1건당 1행으로 평탄화
  var rows=[];
  Object.keys(allPersons).forEach(function(n){
    _dedupTripsBySite(allPersons[n].trips).forEach(function(t){
      rows.push({name:n,trip:t,grandTotal:grandTotals[n]});
    });
  });

  // 이름 검색 + 인원유형 필터 + 상태 필터 (행=출장 단위)
  rows=rows.filter(function(r){
    if(!_pmTypeFilter[r.trip.type]) return false;
    if(_pmSearch && r.name.toLowerCase().indexOf(_pmSearch)<0) return false;
    if(_pmFilter!=='all' && r.trip.status!==_pmFilter) return false;
    if(_pmHideDone && r.trip.status!=='going') return false;
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
    else if(_pmSortKey==='country')    v=(a.trip.region||'기타').localeCompare(b.trip.region||'기타','ko')||a.name.localeCompare(b.name,'ko');
    else if(_pmSortKey==='city')       v=(a.trip.city||'').localeCompare(b.trip.city||'','ko')||a.name.localeCompare(b.name,'ko');
    else if(_pmSortKey==='site')       v=(a.trip.siteName||'').localeCompare(b.trip.siteName||'','ko')||a.name.localeCompare(b.name,'ko');
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
  html+=thS('name',t('colName'));
  html+=thS('country',t('colCountry'))+thS('city',t('colCity'))+thS('site',t('colSite'));
  html+=thS('days',t('colFirstDays'));
  html+='<th>'+t('colExt1Days')+'</th><th>'+t('colExt2Days')+'</th>';
  html+='<th>'+t('colStatusBadge')+'</th>';
  html+=thS('grandTotal',t('colGrandTotal'));
  html+='</tr></thead><tbody>';

  rows.forEach(function(r){ html+=renderPersonRow(r); });

  html+='</tbody></table>';
  html+='<div style="font-size:10px;color:#707080;padding:8px 4px;margin-top:4px">'
    +'* 전체 출장일수는 해당 인원의 모든 출장을 합산한 값입니다 (같은 인원의 각 행에 동일하게 표시).'
    +' 같은 사이트에서 기간이 겹치는 여러 프로젝트 출장은 가장 긴 일정 한 줄로만 표시됩니다.'
    +'</div>';
  return html;
}

// 간트와 동일한 날짜 기준 status(going/plan/done)를 뱃지로 표시
function _pmStatusBadge(status){
  if(status==='going') return '<span class="pm-trip-status status-going">'+tStatus('진행중')+'</span>';
  if(status==='plan')  return '<span class="pm-trip-status status-plan">'+tStatus('예정')+'</span>';
  return '<span class="pm-trip-status status-done">'+tStatus('완료')+'</span>';
}

function renderPersonRow(r){
  var t=r.trip;
  var tc=TYPE_COLOR[t.type]||'#555';
  var tl=TYPE_LBL[t.type]||t.type;
  var countryLbl=tRegion(t.region||'기타');
  var cityLbl=t.city||'-';

  var nameAttr=r.name.replace(/'/g,"\\'");
  var html='<tr class="pm-person-row">';
  html+='<td><div style="display:flex;align-items:center;gap:6px">'
    +'<span class="pm-name" style="cursor:pointer;text-decoration:underline dotted" onclick="openPersonDaysModal(\''+nameAttr+'\')" title="클릭하면 출장일수 상세 보기">'+r.name+'</span>'
    +'<span class="pm-type" style="background:'+tc+'">'+tl+'</span>'
    +'</div></td>';
  html+='<td>'+countryLbl+'</td>';
  html+='<td>'+cityLbl+'</td>';
  html+='<td><span class="pm-site-chip" style="background:'+t.siteColor+'"></span>'+t.siteName+'</td>';
  html+='<td style="text-align:center"><span class="pm-days-big" style="font-size:15px">'+t.days+'</span><span class="pm-days-unit"> 일</span></td>';
  html+='<td style="text-align:center">'+(t.ext1Days>0?'<span style="color:#e0972e;font-weight:600">'+t.ext1Days+'일</span>':'<span style="color:var(--tx-muted)">-</span>')+'</td>';
  html+='<td style="text-align:center">'+(t.ext2Days>0?'<span style="color:#e05050;font-weight:600">'+t.ext2Days+'일</span>':'<span style="color:var(--tx-muted)">-</span>')+'</td>';
  html+='<td style="text-align:center">'+_pmStatusBadge(t.status)+'</td>';
  html+='<td style="text-align:center"><span class="pm-days-big" style="font-size:15px;font-weight:700">'+r.grandTotal+'</span><span class="pm-days-unit"> 일</span></td>';
  html+='</tr>';
  return html;
}
