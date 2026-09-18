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

var HOME_STATUS_ORDER=['진행중(HQ)','진행중(Field)','완료','PO 대기','PO 발행','LOI 접수'];
var HOME_STATUS_COLOR={'진행중(HQ)':'#5a9aee','진행중(Field)':'#4aaa70','완료':'var(--tx-dim)','PO 대기':'#d4b02e','PO 발행':'#b39ddb','LOI 접수':'#2ecccc'};

function _homeGreetingHtml(){
  var dateStr=new Intl.DateTimeFormat(_homeLocale(),{year:'numeric',month:'long',day:'numeric',weekday:'long'}).format(TODAY);
  var poWaiting=S.masterProjects.filter(function(mp){return mp.status==='PO 대기';}).length;
  var upcoming=_homeUpcomingTrips(14).length;
  var parts=[];
  if(poWaiting) parts.push(t('homeSubPoWaiting').replace('{n}',poWaiting));
  if(upcoming) parts.push(t('homeSubUpcoming').replace('{n}',upcoming));
  var sub=parts.length?(parts.join(t('homeSubJoiner'))+t('homeSubSuffix')):t('homeSubNone');
  return '<p class="home-hello">'+_esc(t('homeGreeting'))+'</p><p class="home-sub">'+_esc(dateStr)+' · '+_esc(sub)+'</p>';
}

function _homeStatRowHtml(){
  var counts={}; HOME_STATUS_ORDER.forEach(function(k){counts[k]=0;});
  S.masterProjects.forEach(function(mp){
    var st=_mpEffectiveStatus(mp);
    if(counts[st]!==undefined) counts[st]++;
  });
  var html='<div class="home-stat-row">';
  html+='<div class="home-stat-card"><div class="home-stat-num">'+S.masterProjects.length+'</div><div class="home-stat-lbl">'+_esc(t('optAll'))+'</div></div>';
  HOME_STATUS_ORDER.forEach(function(k){
    html+='<div class="home-stat-card"><div class="home-stat-num" style="color:'+HOME_STATUS_COLOR[k]+'">'+counts[k]+'</div><div class="home-stat-lbl">'+_esc(tStatus(k))+'</div></div>';
  });
  html+='</div>';
  return html;
}

function _homeUpcomingCardHtml(){
  var list=_homeUpcomingTrips(14,5);
  var body=list.length?list.map(function(tr){
    return '<div class="home-row"><span class="home-row-main">'+_esc(tr.name)+' · '+_esc(tr.siteName)+'</span>'
      +'<span style="background:#1a3a5a;color:#5a9aee;padding:2px 8px;border-radius:5px;font-size:10px;font-weight:600;flex-shrink:0">D-'+tr.dday+'</span></div>';
  }).join(''):'<div class="home-empty">'+_esc(t('homeUpcomingEmpty'))+'</div>';
  return '<div class="home-card"><p class="home-card-h">'+_esc(t('homeUpcomingTitle'))+'</p>'+body+'</div>';
}

function _homeQuickActionsCardHtml(){
  var html='<div class="home-card"><p class="home-card-h">'+_esc(t('homeQuickTitle'))+'</p>';
  if(_isAdminMode()){
    html+='<button class="home-qbtn" onclick="switchTab(\'projects\');openAddMasterProject()">'+_esc(t('mpAddProject'))+'</button>';
    html+='<button class="home-qbtn" onclick="switchTab(\'gantt\');openModal(\'schedule\')">'+_esc(t('btnAddSchedule'))+'</button>';
  }
  html+='<button class="home-qbtn" onclick="downloadExcel()">'+_esc(t('homeBtnExcel'))+'</button>';
  if(_isAdminMode()){
    html+='<button class="home-qbtn" onclick="openSheetsSettings()">'+_esc(t('btnSheetsSettings'))+'</button>';
  }
  html+='</div>';
  return html;
}

var HOME_PALETTE=['#5a9aee','#4aaa70','#e0972e','#b39ddb','#e05a8a','#2ecccc','#999'];

function _homeEscAttr(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// 국가(지역)별로 등록된 고객사(사이트)를 함께 모아서, 막대에 마우스를 올리면 목록을 보여준다
function _homeCountryCardHtml(){
  var data={};
  S.masterProjects.forEach(function(mp){
    var r=tRegion(mp.region||'기타');
    if(!data[r]) data[r]={count:0,sites:{}};
    data[r].count++;
    if(mp.customer) data[r].sites[mp.customer]=(data[r].sites[mp.customer]||0)+1;
  });
  var arr=Object.keys(data).map(function(k){
    var sites=Object.keys(data[k].sites).sort(function(a,b){return a.localeCompare(b,'ko');})
      .map(function(s){return s+'('+data[k].sites[s]+')';});
    return {label:k,count:data[k].count,sites:sites};
  }).sort(function(a,b){return b.count-a.count;});
  var max=arr.length?arr[0].count:1;
  var body=arr.length?arr.map(function(a,i){
    var pct=Math.max(Math.round(a.count/max*100),4);
    var c=HOME_PALETTE[i%HOME_PALETTE.length];
    var tip=a.sites.length?a.sites.join('\n'):t('homeCountryTipEmpty');
    return '<div class="home-bar-row"><span class="home-bar-dot" style="background:'+c+'"></span><span class="home-bar-lbl">'+_esc(a.label)+'</span>'
      +'<div class="home-bar-track" style="cursor:pointer" data-tip="'+_homeEscAttr(tip)+'" onmouseenter="_homeShowChartTip(this)" onmouseleave="_homeHideChartTip()"><div class="home-bar-fill" style="width:'+pct+'%;background:'+c+'"></div></div><span class="home-bar-n">'+a.count+'</span></div>';
  }).join(''):'<div class="home-empty">'+_esc(t('homeEmptyProjects'))+'</div>';
  return '<div class="home-card"><p class="home-card-h">'+_esc(t('homeCountryTitle'))+'</p>'
    +(arr.length?'<p class="home-hint">'+_esc(t('homeCountryHint'))+'</p>':'')
    +body+'</div>';
}

// 인원유형별로 실제 출장자 이름을 함께 모아서, 막대에 마우스를 올리면 명단을 보여준다
function _homeTypeCardHtml(){
  var all=aggregatePersonTrips();
  var counts={hq:0,outsource:0,localOutsource:0,tech:0,vision:0,host:0};
  var names={hq:[],outsource:[],localOutsource:[],tech:[],vision:[],host:[]};
  Object.keys(all).forEach(function(n){ var ty=all[n].type; if(counts[ty]!==undefined){ counts[ty]++; names[ty].push(n); } });
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
    S.masterProjects.forEach(function(mp){ if(_mpShipMonth(mp)===m.ym) items.push(_homeMpLabel(mp)); });
    return {label:m.label,value:items.length,items:items};
  });
}
// HQ 셋업 기간이 그 달과 겹치는 프로젝트 수 + 목록 (월별 집계 탭의 "본사 셋업" 계산과 동일 기준)
function _homeMonthlySetupData(){
  return _homeMonthlyMonths().map(function(m){
    var items=[];
    S.masterProjects.forEach(function(mp){ if(_mpMonthOverlap(m.ym,mp.setupStart,mp.setupEnd)) items.push(_homeMpLabel(mp)); });
    return {label:m.label,value:items.length,items:items};
  });
}
// 막대를 클릭하면 그 달의 설비명(프로젝트) 목록을 툴팁으로 보여주고, 바깥을 클릭하면 닫힌다.
// 프로젝트 관리 표 헤더의 ⓘ 툴팁(_mpShowInfoTip)은 position:fixed라 뷰포트에 고정되는데,
// 홈 화면은 스크롤되는 컨테이너(#homeWrap) 안에서 막대를 스크롤해 지나쳐도 툴팁은 화면에 그대로
// 남아 엉뚱한 카드 위에 겹쳐 보였다 — 그래서 #homeWrap 안에 absolute로 붙여 함께 스크롤되게 한다
function _homeShowChartTip(el){
  var tip=el.getAttribute('data-tip');
  var wrap=document.getElementById('homeWrap');
  if(!tip||!wrap) return;
  var tt=document.getElementById('home-chart-tt');
  if(!tt){ tt=document.createElement('div'); tt.id='home-chart-tt'; tt.className='home-chart-tt'; wrap.appendChild(tt); }
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

function _homeMonthlyChartCardHtml(title,hintKey,color,data){
  var max=Math.max.apply(null,data.map(function(d){return d.value;}).concat([1]));
  var cols=data.map(function(d){
    var h=d.value>0?Math.max(Math.round(d.value/max*100),6):2;
    var tip=(d.items&&d.items.length)?d.items.join('\n'):t('homeChartTipEmpty');
    return '<div class="home-chart-col"><div class="home-chart-val">'+d.value+'</div>'
      +'<div class="home-chart-bar" style="height:'+h+'%;background:'+color+';cursor:pointer" data-tip="'+_homeEscAttr(tip)+'" onclick="event.stopPropagation();_homeToggleChartTip(this)"></div>'
      +'<div class="home-chart-mo">'+_esc(d.label)+'</div></div>';
  }).join('');
  return '<div class="home-card" style="margin-bottom:14px"><p class="home-card-h">'+_esc(title)+'</p>'
    +'<p class="home-hint">'+_esc(t(hintKey))+'</p>'
    +'<div class="home-chart-wrap">'+cols+'</div></div>';
}

function _homeRecentCardHtml(){
  var list=S.masterProjects.slice().sort(function(a,b){return (b.mt||0)-(a.mt||0);}).slice(0,5);
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
  S.masterProjects.forEach(function(mp){
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
  html+='<div class="home-grid2">'+_homeUpcomingCardHtml()+_homeQuickActionsCardHtml()+'</div>';
  html+='<div class="home-grid2">'+_homeCountryCardHtml()+_homeTypeCardHtml()+'</div>';
  html+=_homeMonthlyChartCardHtml(t('homeShipChartTitle'),'homeChartHint','#5a9aee',_homeMonthlyShipData());
  html+=_homeMonthlyChartCardHtml(t('homeSetupChartTitle'),'homeChartHint','#4aaa70',_homeMonthlySetupData());
  html+='<div class="home-grid2">'+_homeRecentCardHtml()+_homeHighlightCardHtml()+'</div>';
  wrap.innerHTML=html;
}
