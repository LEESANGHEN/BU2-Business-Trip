/* ══════════════════════════════════════════
   홈 대시보드 — home.js
   프로젝트 관리(S.masterProjects)/간트 차트(S.schedules)/인원 출장일 데이터를
   한 화면에 요약해서 보여준다. 자체 저장 데이터는 없고 매번 렌더 시점에 계산한다.
   화면 문구는 전부 i18n.js의 home* 키를 통해 언어 변경 시 함께 바뀐다.
══════════════════════════════════════════ */

// 언어 코드(ko/en/zhHans/zhHant/ja) → Intl 로케일 태그. 날짜/요일/월 이름은
// 직접 사전을 만드는 대신 브라우저 Intl API에 맡겨서 자연스럽게 현지화한다
var HOME_LOCALE_MAP={ko:'ko-KR',en:'en-US',zhHans:'zh-CN',zhHant:'zh-TW',ja:'ja-JP'};
function _homeLocale(){ return HOME_LOCALE_MAP[typeof _lang!=='undefined'?_lang:'ko']||'ko-KR'; }

function _homeIsoStr(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }

// 앞으로 days일 이내에 시작하는(아직 시작 전인) 간트 일정 — "다가오는 셋업 일정"
function _homeUpcomingTrips(days,limit){
  var maxDate=new Date(TODAY); maxDate.setDate(maxDate.getDate()+days);
  var todayISO=_homeIsoStr(TODAY), maxISO=_homeIsoStr(maxDate);
  var list=S.schedules.filter(function(s){
    return !s.hidden && s.start>todayISO && s.start<=maxISO;
  }).map(function(s){
    var proj=S.projects.find(function(p){return p.id===s.projectId;});
    var site=proj?S.sites.find(function(x){return x.id===proj.siteId;}):null;
    return {name:s.name,siteName:site?site.name:(proj?proj.siteId:''),start:s.start,dday:Math.round((pd(s.start)-TODAY)/86400000)};
  }).sort(function(a,b){return a.start<b.start?-1:(a.start>b.start?1:0);});
  return limit?list.slice(0,limit):list;
}

var HOME_STATUS_ORDER=['생산중(HQ)','셋업(HQ)','셋업(Field)','완료','PO 대기','PO 발행','LOI 접수'];
var HOME_STATUS_COLOR={'생산중(HQ)':'#e0972e','셋업(HQ)':'#5a9aee','셋업(Field)':'#4aaa70','완료':'var(--tx-dim)','PO 대기':'#d4b02e','PO 발행':'#b39ddb','LOI 접수':'#2ecccc'};

function _homeGreetingHtml(){
  var dateStr=new Intl.DateTimeFormat(_homeLocale(),{year:'numeric',month:'long',day:'numeric',weekday:'long'}).format(TODAY);
  var poWaiting=_mpActive().filter(function(mp){return mp.status==='PO 대기';}).length;
  var upcoming=_homeUpcomingTrips(14).length;
  var parts=[];
  if(poWaiting) parts.push(t('homeSubPoWaiting').replace('{n}',poWaiting));
  if(upcoming) parts.push(t('homeSubUpcoming').replace('{n}',upcoming));
  var sub=parts.length?(parts.join(t('homeSubJoiner'))+t('homeSubSuffix')):t('homeSubNone');
  return '<p class="home-hello">'+_esc(t('homeGreeting'))+'</p><p class="home-sub">'+_esc(dateStr)+' · '+_esc(sub)+'</p>';
}

function _homeStatRowHtml(){
  var counts={}; HOME_STATUS_ORDER.forEach(function(k){counts[k]=0;});
  _mpActive().forEach(function(mp){
    var st=_mpEffectiveStatus(mp);
    if(counts[st]!==undefined) counts[st]++;
  });
  var html='<div class="home-stat-row">';
  html+='<div class="home-stat-card" style="cursor:pointer" onclick="homeGoToProjectsByStatus(\'\')" title="'+_esc(t('homeStatClickHint')||'')+'"><div class="home-stat-num">'+_mpActive().length+'</div><div class="home-stat-lbl">'+_esc(t('optAll'))+'</div></div>';
  HOME_STATUS_ORDER.forEach(function(k){
    var kAttr=k.replace(/'/g,"\\'");
    html+='<div class="home-stat-card" style="cursor:pointer" onclick="homeGoToProjectsByStatus(\''+kAttr+'\')" title="'+_esc(t('homeStatClickHint')||'')+'"><div class="home-stat-num" style="color:'+HOME_STATUS_COLOR[k]+'">'+counts[k]+'</div><div class="home-stat-lbl">'+_esc(tStatus(k))+'</div></div>';
  });
  html+='</div>';
  return html;
}

// "다가오는 HQ 셋업 일정" — 출장 예정이 아니라 프로젝트 관리의 실제 HQ 일정을 기준으로 한다.
// 앞으로 7일 이내(오늘 포함)에 닥치는 ① 생산 이관일(변경 이관일이 있으면 그 날짜) ② 출하 일정(고객사 요청 출하일이 있으면 그 날짜)을
// 날짜순으로 알려준다. 완료된 프로젝트와 숨긴 프로젝트는 제외. 항목을 누르면 그 프로젝트 수정 창이 열린다
var HOME_UPCOMING_DAYS=7, HOME_UPCOMING_MAX=6;
function _homeUpcomingEvents(){
  var out=[];
  _mpActive().forEach(function(mp){
    if(mp.status==='완료') return;
    [['transfer',_mpEffectiveTransferDate(mp)],['ship',_mpEffectiveShipDate(mp)]].forEach(function(e){
      if(!e[1]) return;
      var d=Math.round((pd(e[1])-TODAY)/86400000);
      if(d<0||d>HOME_UPCOMING_DAYS) return;
      out.push({kind:e[0],date:e[1],dday:d,mp:mp});
    });
  });
  return out.sort(function(a,b){return a.dday-b.dday||((a.kind==='transfer'?0:1)-(b.kind==='transfer'?0:1))||String(a.mp.projectName||'').localeCompare(String(b.mp.projectName||''),'ko');});
}
function _homeUpcomingCardHtml(){
  var list=_homeUpcomingEvents(), shown=list.slice(0,HOME_UPCOMING_MAX);
  var tagStyle={transfer:'background:#3a2a10;color:#e0972e;border:1px solid #6a4a1a',ship:'background:#1a3a5a;color:#5a9aee;border:1px solid #2a5a8a'};
  var body=shown.length?shown.map(function(ev){
    var mp=ev.mp, unit=mp.prodUnit?(' · '+mp.prodUnit):'';
    var tag=t(ev.kind==='transfer'?'homeTagTransfer':'homeTagShip');
    var dl=ev.dday===0?t('homeToday'):('D-'+ev.dday), dm=parseInt(ev.date.slice(5,7),10)+'/'+parseInt(ev.date.slice(8,10),10);
    var hot=ev.dday<=2?'background:#4a1a1a;color:#e05a5a':'background:var(--bg-hover);color:var(--tx-second)';
    return '<div class="home-row home-up-row" onclick="openEditMasterProject(\''+_homeEscAttr(mp.id)+'\')" title="'+_homeEscAttr(t('homeUpcomingOpen'))+'">'
      +'<span class="home-up-tag" style="'+tagStyle[ev.kind]+'">'+_esc(tag)+'</span>'
      +'<span class="home-row-main">'+_esc((mp.projectName||'-')+' · '+(mp.customer||'-')+unit)+'</span>'
      +'<span style="color:var(--tx-faint);font-size:11px;flex-shrink:0">'+dm+'</span>'
      +'<span style="'+hot+';padding:2px 8px;border-radius:5px;font-size:10px;font-weight:600;flex-shrink:0;min-width:34px;text-align:center">'+dl+'</span></div>';
  }).join(''):'<div class="home-empty">'+_esc(t('homeUpcomingEmpty'))+'</div>';
  if(list.length>shown.length) body+='<div class="home-rank-more">'+_esc(t('homeUpcomingMore').replace('{n}',list.length-shown.length))+'</div>';
  return '<div class="home-card"><p class="home-card-h">'+_esc(t('homeUpcomingTitle'))+'</p>'+body+'</div>';
}

function _homeQuickActionsCardHtml(){
  var html='<div class="home-card"><p class="home-card-h">'+_esc(t('homeQuickTitle'))+'</p>';
  html+='<button class="home-qbtn" onclick="switchTab(\'projects\');openAddMasterProject()">'+_esc(t('mpAddProject'))+'</button>';
  html+='<button class="home-qbtn" onclick="switchTab(\'gantt\');openModal(\'schedule\')">'+_esc(t('btnAddSchedule'))+'</button>';
  html+='<button class="home-qbtn" onclick="downloadExcel()">'+_esc(t('homeBtnExcel'))+'</button>';
  html+='</div>';
  return html;
}

var HOME_PALETTE=['#5a9aee','#4aaa70','#e0972e','#b39ddb','#e05a8a','#2ecccc','#999'];

function _homeEscAttr(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// 프로젝트 관리 데이터(숨김 제외)를 기준으로 묶어서 센다 — keyFn: 묶는 값, subFn: 툴팁에 보여줄 하위 항목
function _homeGroupBy(keyFn,subFn){
  var map={};
  _mpActive().forEach(function(mp){
    var k=keyFn(mp), g=map[k]||(map[k]={value:k,count:0,sub:{}});
    g.count++;
    var s=subFn?subFn(mp):''; if(s) g.sub[s]=(g.sub[s]||0)+1;
  });
  return Object.keys(map).map(function(k){return map[k];}).sort(function(a,b){return b.count-a.count||String(a.value).localeCompare(String(b.value),'ko');});
}
function _homeSubTip(g,emptyKey){
  var names=Object.keys(g.sub).sort(function(a,b){return g.sub[b]-g.sub[a]||a.localeCompare(b,'ko');})
    .map(function(n){return n+'('+g.sub[n]+')';});
  return names.length?names.join('\n'):t(emptyKey);
}
var HOME_PALETTE2=HOME_PALETTE.concat(['#e0a05a','#8ad0a0','#d58aff','#7ab8ff','#ff9a8a']);

// 지역 / 고객사(사이트) / 설비명(프로젝트)별 — 같은 모양의 도넛 그래프. 조각(또는 범례)을 누르면 프로젝트 관리가 그 항목으로 필터링되어 열린다.
// 항목이 많으면 상위 top개만 조각으로 그리고 나머지는 회색 "그 외"로 묶는다(누르면 이동하지 않음)
function _homeDonutCardHtml(title,hintKey,filterKey,keyFn,subFn,labelFn,top){
  var g=_homeGroupBy(keyFn,subFn);
  var total=g.reduce(function(a,x){return a+x.count;},0);
  if(!total) return '<div class="home-card"><p class="home-card-h">'+_esc(title)+'</p><div class="home-empty">'+_esc(t('homeEmptyProjects'))+'</div></div>';
  var shown=g.slice(0,top), rest=g.slice(top);
  var items=shown.map(function(x,i){ return {v:x.value,label:labelFn(x.value),count:x.count,color:HOME_PALETTE2[i%HOME_PALETTE2.length],tip:_homeSubTip(x,'homeCountryTipEmpty'),go:true}; });
  if(rest.length){
    var rc=rest.reduce(function(a,x){return a+x.count;},0);
    items.push({v:'',label:t('homeRankMore').replace('{k}',rest.length).replace(' · {n}대','').replace(' · {n} units',''),count:rc,color:'#666',
      tip:rest.map(function(x){return labelFn(x.value)+'('+x.count+')';}).join('\n'),go:false});
  }
  var R=15.9155, cum=0, segs='', legend='';
  items.forEach(function(x){
    var pct=x.count/total*100, v=_homeEscAttr(x.v);
    var click=x.go?' onclick="homeGoToProjectsBy(\''+filterKey+'\',this.getAttribute(\'data-v\'))"':'';
    segs+='<circle class="home-donut-seg'+(x.go?'':' nogo')+'" r="'+R+'" cx="21" cy="21" fill="none" stroke="'+x.color+'" stroke-width="6" stroke-dasharray="'+pct.toFixed(3)+' '+(100-pct).toFixed(3)+'" stroke-dashoffset="'+(25-cum).toFixed(3)+'" data-v="'+v+'"'+click+'><title>'+_homeEscAttr(x.label+' '+x.count+'대 ('+Math.round(pct)+'%)')+'</title></circle>';
    cum+=pct;
    legend+='<div class="home-leg-row'+(x.go?'':' nogo')+'" data-v="'+v+'" data-tip="'+_homeEscAttr(x.tip)+'" onmouseenter="_homeShowChartTip(this)" onmouseleave="_homeHideChartTip()"'+click+'>'
      +'<span class="home-bar-dot" style="background:'+x.color+'"></span><span class="home-leg-lbl" title="'+_homeEscAttr(x.label)+'">'+_esc(x.label)+'</span>'
      +'<span class="home-leg-n">'+x.count+'</span><span class="home-leg-pct">'+Math.round(pct)+'%</span></div>';
  });
  return '<div class="home-card"><p class="home-card-h">'+_esc(title)+'</p>'
    +'<p class="home-hint">'+_esc(t(hintKey))+'</p>'
    +'<div class="home-donut-wrap"><svg class="home-donut" viewBox="0 0 42 42"><circle r="'+R+'" cx="21" cy="21" fill="none" stroke="var(--bg-deep)" stroke-width="6"/>'+segs
    +'<text x="21" y="21.5" text-anchor="middle" class="home-donut-n">'+total+'</text><text x="21" y="26.5" text-anchor="middle" class="home-donut-s">'+_esc(t('homeDonutUnit'))+'</text></svg>'
    +'<div class="home-leg">'+legend+'</div></div></div>';
}
function _homeCountryCardHtml(){
  return _homeDonutCardHtml(t('homeCountryTitle'),'homeDonutHint','region',function(mp){return mp.region||'기타';},function(mp){return mp.customer||'';},function(v){return tRegion(v);},8);
}
function _homeCustomerCardHtml(){
  return _homeDonutCardHtml(t('homeCustTitle'),'homeDonutHint2','customer',function(mp){return mp.customer||'';},function(mp){return mp.projectName||'';},function(v){return v||t('homeUnassigned');},8);
}
function _homeProjectCardHtml(){
  return _homeDonutCardHtml(t('homeProjTitle'),'homeDonutHint2','project',function(mp){return mp.projectName||'';},function(mp){return mp.customer||'';},function(v){return v||t('homeUnassigned');},8);
}

// Field 셋업 간트 차트 기본 화면과 동일한 기준(숨김 아님 + 과거 아님)으로 "지금 실제로
// 이름이 올라오는" 출장자만 걸러낸다 — aggregatePersonTrips()는 인원 출장일 탭 용도라
// 숨김/과거 일정까지 전부 잡히는데, 그대로 쓰면 이미 끝난 출장자가 계속 카운트에 남아
// 간트 차트에 보이는 인원 수와 어긋난다
function _homeVisibleTripNames(){
  var todayISO=_homeIsoStr(TODAY);
  var set={};
  S.schedules.forEach(function(sc){
    var isPast=sc.end&&sc.end<todayISO;
    if(!sc.hidden&&!isPast) set[sc.name]=true;
  });
  return set;
}
// 인원유형별로 실제 출장자 이름을 함께 모아서, 막대에 마우스를 올리면 명단을 보여준다
function _homeTypeCardHtml(){
  var all=aggregatePersonTrips();
  var visibleNames=_homeVisibleTripNames();
  var counts={hq:0,outsource:0,localOutsource:0,tech:0,vision:0,host:0};
  var names={hq:[],outsource:[],localOutsource:[],tech:[],vision:[],host:[]};
  Object.keys(all).forEach(function(n){
    if(!visibleNames[n]) return;
    var ty=all[n].type; if(counts[ty]!==undefined){ counts[ty]++; names[ty].push(n); }
  });
  var order=[['hq','pmTypeHq'],['outsource','pmTypeOutsource'],['localOutsource','pmTypeLocalOutsource'],['tech','pmTypeTech'],['vision','pmTypeVision'],['host','pmTypeHost']];
  var max=Math.max.apply(null,order.map(function(o){return counts[o[0]];}).concat([1]));
  var body=order.map(function(o){
    var k=o[0], n=counts[k], pct=Math.max(Math.round(n/max*100),4);
    var c=TYPE_COLOR[k]||'#888';
    var tip=names[k].length?names[k].sort(function(a,b){return a.localeCompare(b,'ko');}).join('\n'):t('homeTypeTipEmpty');
    return '<div class="home-bar-row"><span class="home-bar-dot" style="background:'+c+'"></span><span class="home-bar-lbl">'+_esc(t(o[1]))+'</span>'
      +'<div class="home-bar-track" style="cursor:pointer" data-tip="'+_homeEscAttr(tip)+'" onmouseenter="_homeShowChartTip(this)" onmouseleave="_homeHideChartTip()"><div class="home-bar-fill" style="width:'+pct+'%;background:'+c+'"></div></div><span class="home-bar-n">'+n+'</span></div>';
  }).join('');
  return '<div class="home-card"><p class="home-card-h">'+_esc(t('homeTypeTitle'))+'</p>'
    +'<p class="home-hint">'+_esc(t('homeTypeHint'))+'</p>'
    +body+'</div>';
}

/* ── 엔지니어별 전체 출장일수 (기술/외주 인원, 연도별) ──
   인원 출장일 탭의 "전체 출장일수"와 같은 방식(같은 날 겹치는 출장은 하루로 계산)으로 집계하되,
   한 출장 기록에 "이상헌 부장, 김형진 과장"처럼 쉼표로 여러 명이 적혀 있으면 각자에게 일수를 더한다.
   분야는 인원 출장일 탭과 같은 우선순위로 정해진 대표 유형(tech / outsource·localOutsource)을 따른다. */
var _homeEngYear=null;      // null=올해, 'all'=전체 기간, 그 외 연도(숫자)
var _homeEngFilter='all';   // all | tech | outsource
var _homeEngRows=[];        // 마지막으로 그린 목록(이름 클릭 시 상세 표시에 사용)

function _homeEngSplitNames(raw){
  return String(raw||'').split(/[,，、]/).map(function(s){return s.trim();}).filter(Boolean);
}
function _homeEngYears(){
  var first=2026, last=TODAY.getFullYear();
  S.schedules.forEach(function(sc){ var y=parseInt(String(sc.end||'').slice(0,4),10); if(y&&y>last) last=y; });
  var ys=[]; for(var y=last;y>=first;y--) ys.push(y);
  return ys;
}
function _homeEngCollect(year){
  var typePri={hq:6,tech:5,vision:4,host:3,outsource:2,localOutsource:1};
  var todayISO=_homeIsoStr(TODAY);
  var P={};
  S.schedules.forEach(function(sc){
    var proj=S.projects.find(function(p){return p.id===sc.projectId;}); if(!proj||!sc.start||!sc.end) return;
    var site=S.sites.find(function(s){return s.id===proj.siteId;});
    var siteName=site?site.name:proj.siteId;
    var going=sc.start<=todayISO&&todayISO<=sc.end;
    _homeEngSplitNames(sc.name).forEach(function(nm){
      var p=P[nm]||(P[nm]={name:nm,type:sc.type,days:{},sites:{},going:false});
      if((typePri[sc.type]||0)>(typePri[p.type]||0)) p.type=sc.type;
      if(going) p.going=true;
      var sset=p.sites[siteName]||(p.sites[siteName]={});
      for(var cur=pd(sc.start),e=pd(sc.end);cur<=e;cur.setDate(cur.getDate()+1)){
        if(year!=='all'&&cur.getFullYear()!==year) continue;
        var k=_homeIsoStr(cur); p.days[k]=true; sset[k]=true;
      }
    });
  });
  return Object.keys(P).map(function(k){
    var p=P[k];
    return {name:p.name,type:p.type,going:p.going,total:Object.keys(p.days).length,
      sites:Object.keys(p.sites).map(function(sn){return {site:sn,days:Object.keys(p.sites[sn]).length};}).filter(function(x){return x.days>0;}).sort(function(a,b){return b.days-a.days;})};
  });
}
function _homeEngInnerHtml(){
  var years=_homeEngYears();
  var year=_homeEngYear===null?TODAY.getFullYear():_homeEngYear;
  if(year!=='all'&&years.indexOf(year)<0) year=years[0];
  var suffix=t('homeEngYearSuffix');
  var yearOpts=years.map(function(y){return '<option value="'+y+'"'+(y===year?' selected':'')+'>'+y+suffix+'</option>';}).join('')
    +'<option value="all"'+(year==='all'?' selected':'')+'>'+_esc(t('homeEngYearAll'))+'</option>';
  var isTech=function(r){return r.type==='tech';}, isOut=function(r){return r.type==='outsource'||r.type==='localOutsource';};
  var rows=_homeEngCollect(year).filter(function(r){return (isTech(r)||isOut(r))&&r.total>0;});
  var shown=rows.filter(function(r){ return _homeEngFilter==='all'||(_homeEngFilter==='tech'?isTech(r):isOut(r)); })
    .sort(function(a,b){return b.total-a.total||a.name.localeCompare(b.name,'ko');});
  _homeEngRows=shown;
  var tot=shown.reduce(function(a,r){return a+r.total;},0);
  var max=shown.length?shown[0].total:1;
  var btn=function(f,label){
    return '<button class="home-eng-btn'+(_homeEngFilter===f?' on':'')+'" onclick="homeEngSetFilter(\''+f+'\')">'+_esc(label)+'</button>';
  };
  var body=shown.length?shown.map(function(r,i){
    var c=isTech(r)?TYPE_COLOR.tech:TYPE_COLOR.outsource;
    var pct=Math.max(Math.round(r.total/max*100),4);
    return '<div class="home-bar-row"><span class="home-eng-dot" title="'+(r.going?'출장 중':'')+'" style="'+(r.going?'background:#4aaa70':'')+'"></span>'
      +'<span class="home-bar-lbl home-eng-lbl" onclick="homeEngOpen('+i+')" title="상세 보기">'+_esc(r.name)+'</span>'
      +'<div class="home-bar-track"><div class="home-bar-fill" style="width:'+pct+'%;background:'+c+'"></div></div>'
      +'<span class="home-bar-n" style="width:44px">'+r.total+'일</span></div>';
  }).join(''):'<div class="home-empty">'+_esc(t('homeEngEmpty'))+'</div>';
  return '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:12px">'
    +'<div><p class="home-card-h" style="margin:0 0 4px">'+_esc(t('homeEngTitle'))+'</p><p class="home-hint" style="margin:0">'+_esc(t('homeEngHint'))+'</p></div>'
    +'<div style="display:flex;align-items:center;gap:5px"><select class="home-eng-sel" onchange="homeEngSetYear(this.value)">'+yearOpts+'</select>'
    +btn('all',t('optAll'))+btn('tech',t('pmTypeTech'))+btn('outsource',t('pmTypeOutsource'))+'</div></div>'
    +body;
}
function _homeEngCardHtml(){ return '<div class="home-card" id="homeEngCard">'+_homeEngInnerHtml()+'</div>'; }
function _homeEngRefresh(){ var el=document.getElementById('homeEngCard'); if(el) el.innerHTML=_homeEngInnerHtml(); }
function homeEngSetYear(v){ _homeEngYear=(v==='all')?'all':parseInt(v,10); _homeEngRefresh(); }
function homeEngSetFilter(f){ _homeEngFilter=f; _homeEngRefresh(); }
function homeEngOpen(i){
  var r=_homeEngRows[i]; if(!r) return;
  var year=_homeEngYear===null?TODAY.getFullYear():_homeEngYear;
  var yl=(year==='all')?t('homeEngYearAll'):(year+t('homeEngYearSuffix'));
  var body='<div class="mtit">'+_esc(r.name)+' — '+_esc(yl)+' 출장일수 상세</div>';
  body+='<table class="pm-person-table"><thead><tr><th>사이트</th><th>일수</th></tr></thead><tbody>';
  r.sites.forEach(function(s){ body+='<tr><td>'+_esc(s.site)+'</td><td>'+s.days+'일</td></tr>'; });
  body+='<tr class="pm-site-total-row"><td>합계</td><td>'+r.total+'일</td></tr></tbody></table>';
  body+='<div style="font-size:11px;color:var(--tx-faint);margin-top:6px">합계는 같은 날 여러 사이트가 겹쳐도 하루로 계산합니다.</div>';
  body+='<div class="mfoot"><button class="btn sm" onclick="cm()">닫기</button></div>';
  mw(body);
}

// 이번 달부터 6개월 치 연-월(ym) 목록 — 출하/셋업 그래프 공용. 월 이름도 Intl로 현지화
function _homeMonthlyMonths(){
  var months=[]; var d=new Date(TODAY.getFullYear(),TODAY.getMonth(),1);
  var fmt=new Intl.DateTimeFormat(_homeLocale(),{month:'short'});
  for(var i=0;i<6;i++){
    months.push({ym:d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'),label:fmt.format(d)});
    d.setMonth(d.getMonth()+1);
  }
  return months;
}
// 설비명(프로젝트)·고객사 한 줄로 표시할 항목 라벨
function _homeMpLabel(mp){ return (mp.projectName||'-')+' · '+(mp.customer||'-'); }
// 출하월(고객사 요청 출하 일정 우선, 없으면 HQ 출하 일정)이 그 달인 프로젝트 수 + 목록
function _homeMonthlyShipData(){
  return _homeMonthlyMonths().map(function(m){
    var items=[];
    _mpActive().forEach(function(mp){ if(_mpShipMonth(mp)===m.ym) items.push(_homeMpLabel(mp)); });
    return {label:m.label,ym:m.ym,value:items.length,items:items};
  });
}
// HQ 셋업 기간이 그 달과 겹치는 프로젝트 수 + 목록 (월별 집계 탭의 "본사 셋업" 계산과 동일 기준)
function _homeMonthlySetupData(){
  return _homeMonthlyMonths().map(function(m){
    var items=[];
    _mpActive().forEach(function(mp){ if(_mpMonthOverlap(m.ym,mp.setupStart,mp.setupEnd)) items.push(_homeMpLabel(mp)); });
    return {label:m.label,ym:m.ym,value:items.length,items:items};
  });
}
// 막대를 클릭하면 그 달의 설비명(프로젝트) 목록을 툴팁으로 보여주고, 바깥을 클릭하면 닫힌다.
// 프로젝트 관리 표 헤더의 ⓘ 툴팁(_mpShowInfoTip)은 position:fixed라 뷰포트에 고정되는데,
// 홈 화면은 스크롤되는 컨테이너(#homeWrap) 안에서 막대를 스크롤해 지나쳐도 툴팁은 화면에 그대로
// 남아 엉뚱한 카드 위에 겹쳐 보였다 — 그래서 #homeWrap 안에 absolute로 붙여 함께 스크롤되게 한다
function _homeShowChartTip(el){
  var tip=el.getAttribute('data-tip');
  var wrap=(el.closest&&el.closest('#homeWrap,.pm-body-scroll'))||document.getElementById('homeWrap');
  if(!tip||!wrap) return;
  if(getComputedStyle(wrap).position==='static') wrap.style.position='relative';
  var tt=document.getElementById('home-chart-tt');
  if(!tt){ tt=document.createElement('div'); tt.id='home-chart-tt'; tt.className='home-chart-tt'; }
  if(tt.parentNode!==wrap) wrap.appendChild(tt);
  tt.textContent=tip;
  tt.style.display='block';
  tt._forEl=el;
  var barRect=el.getBoundingClientRect(), wrapRect=wrap.getBoundingClientRect();
  var top=(barRect.bottom-wrapRect.top)+wrap.scrollTop+6;
  var left=(barRect.left-wrapRect.left)+wrap.scrollLeft;
  var maxLeft=wrap.scrollLeft+wrap.clientWidth-280-8;
  tt.style.top=top+'px';
  tt.style.left=Math.max(wrap.scrollLeft+8,Math.min(left,maxLeft))+'px';
}
function _homeHideChartTip(){
  var tt=document.getElementById('home-chart-tt');
  if(tt){ tt.style.display='none'; tt._forEl=null; }
}
function _homeToggleChartTip(el){
  var tt=document.getElementById('home-chart-tt');
  if(tt&&tt.style.display==='block'&&tt._forEl===el){ _homeHideChartTip(); return; }
  _homeShowChartTip(el);
}
document.addEventListener('click',function(e){
  if(e.target.closest&&(e.target.closest('.home-chart-bar')||e.target.closest('.home-chart-tt'))) return;
  _homeHideChartTip();
});

function _homeMonthlyChartCardHtml(title,hintKey,color,data,filterKey){
  var max=Math.max.apply(null,data.map(function(d){return d.value;}).concat([1]));
  var cols=data.map(function(d){
    var h=d.value>0?Math.max(Math.round(d.value/max*100),6):2;
    var tip=(d.items&&d.items.length)?d.items.join('\n'):t('homeChartTipEmpty');
    return '<div class="home-chart-col"><div class="home-chart-val">'+d.value+'</div>'
      +'<div class="home-chart-bar" style="height:'+h+'%;background:'+color+';cursor:pointer" data-tip="'+_homeEscAttr(tip)+'" onclick="event.stopPropagation();_homeToggleChartTip(this)" ondblclick="event.stopPropagation();_homeHideChartTip();homeGoToProjectsByMonth(\x27'+filterKey+'\x27,\x27'+d.ym+'\x27)"></div>'
      +'<div class="home-chart-mo">'+_esc(d.label)+'</div></div>';
  }).join('');
  return '<div class="home-card" style="margin-bottom:14px"><p class="home-card-h">'+_esc(title)+'</p>'
    +'<p class="home-hint">'+_esc(t(hintKey))+'</p>'
    +'<div class="home-chart-wrap">'+cols+'</div></div>';
}

function _homeRecentCardHtml(){
  var list=_mpActive().slice().sort(function(a,b){return (b.mt||0)-(a.mt||0);}).slice(0,5);
  var body=list.length?list.map(function(mp){
    var d=mp.mt?new Date(mp.mt):null;
    return '<div class="home-row"><span class="home-row-main">'+_esc(mp.projectName||'')+' · '+_esc(mp.customer||'')+'</span>'
      +'<span style="color:var(--tx-faint);flex-shrink:0">'+(d?(d.getMonth()+1)+'/'+d.getDate():'')+'</span></div>';
  }).join(''):'<div class="home-empty">'+_esc(t('homeEmptyProjects'))+'</div>';
  return '<div class="home-card"><p class="home-card-h">'+_esc(t('homeRecentTitle'))+'</p>'+body+'</div>';
}

// 마스터 프로젝트 id는 genId('mp',...) = "mp"+시각(36진수)+"_"+난수 형식이라, 등록 시각을 그대로 복원할 수 있다
function _homeCreatedAt(mp){
  var m=/^mp([0-9a-z]+)_/.exec(mp.id||'');
  return m?parseInt(m[1],36):null;
}
function _homeHighlightCardHtml(){
  var y=TODAY.getFullYear(),mo=TODAY.getMonth();
  var isThisMonth=function(ts){ if(!ts)return false; var d=new Date(ts); return d.getFullYear()===y&&d.getMonth()===mo; };
  var newCount=0,doneCount=0,poIssuedCount=0;
  _mpActive().forEach(function(mp){
    if(isThisMonth(_homeCreatedAt(mp))) newCount++;
    if(mp.status==='완료'&&isThisMonth(mp.mt)) doneCount++;
    if(mp.status==='PO 발행'&&isThisMonth(mp.mt)) poIssuedCount++;
  });
  var suf=t('homeCountSuffix');
  return '<div class="home-card"><p class="home-card-h">'+_esc(t('homeHighlightTitle'))+'</p>'
    +'<div class="home-row"><span>'+_esc(t('homeHighlightNew'))+'</span><span style="font-weight:700">'+newCount+suf+'</span></div>'
    +'<div class="home-row"><span>'+_esc(t('homeHighlightDone'))+'</span><span style="font-weight:700">'+doneCount+suf+'</span></div>'
    +'<div class="home-row"><span>'+_esc(tStatus('PO 발행'))+'</span><span style="font-weight:700">'+poIssuedCount+suf+'</span></div>'
    +'</div>';
}

function renderHomeTab(){
  var wrap=document.getElementById('homeWrap');
  if(!wrap) return;
  var html='';
  html+=_homeGreetingHtml();
  html+=_homeStatRowHtml();
  // 상태 카드 바로 아래: 월별 출하 설비 수 / 월별 설비 셋업 수량을 나란히 두어 홈에서 가장 먼저 보이게 한다
  html+='<div class="home-grid2">'+_homeMonthlyChartCardHtml(t('homeShipChartTitle'),'homeChartHint','#5a9aee',_homeMonthlyShipData(),'shipMonth')
    +_homeMonthlyChartCardHtml(t('homeSetupChartTitle'),'homeChartHint','#4aaa70',_homeMonthlySetupData(),'setupMonth')+'</div>';
  // 프로젝트 현황 그래프(프로젝트 관리 탭 데이터): 지역별 도넛 / 고객사(사이트)별 막대 → 이번 달 하이라이트·다가오는 셋업 일정 / 설비별 막대
  // (엔지니어별 출장일수·인원유형별 출장 현황은 "인원 출장일" 탭으로 옮겼다)
  html+='<div class="home-grid3">'+_homeCountryCardHtml()+_homeCustomerCardHtml()+_homeProjectCardHtml()+'</div>';
  html+='<div class="home-grid2">'+_homeHighlightCardHtml()+_homeUpcomingCardHtml()+'</div>';
  html+='<div class="home-grid2">'+_homeRecentCardHtml()+_homeQuickActionsCardHtml()+'</div>';
  wrap.innerHTML=html;
}
