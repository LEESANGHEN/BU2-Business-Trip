/* ══════════════════════════════════════════
   HQ 셋업 간트 차트 — setup.js (탭 이름과 구분하기 위해 파일명은 그대로 setup.js)
   프로젝트 관리(S.masterProjects)의 생산 이관일/HQ 셋업 기간/출하 일정을 실제
   달력 타임라인 위에 그려서 진행 상황을 한눈에 보고, 단계별 진행률(이관 완료/
   셋업 진행률/출하 완료)을 직접 입력·저장한다.

   Field 셋업 간트 차트(gantt.js, 현장 출장 일정 S.schedules 기준)와 같은 달력
   렌더링 방식(주/격주/월 단위 격자, 오늘 날짜 선)을 그대로 따르지만, 날짜 범위
   기준이 다르므로(S.schedules가 아니라 S.masterProjects) 전역 상태(WPX/_months/
   _totPx/_sd)를 공유하지 않고 접두어 _sp를 붙인 독립된 상태로 둔다 — Field 셋업
   간트 차트를 건드리지 않기 위함.
══════════════════════════════════════════ */

var _spZoom='week';
var SP_WPX_MAP={week:42,biweek:22,month:12};
var _spWPX=42,_spMonths=[],_spTotPx=0,_spSd=null;
var _spFilterRegion='all', _spFilterCustomer='all';
var _spScrollBootstrapped=false; // 최초 1회만 '오늘' 위치로 자동 스크롤(Field 셋업 간트 차트와 동일 방식), 이후 재렌더는 사용자 위치 유지

function setSpZoom(z){ _spZoom=z; renderSetupTab(); }

// 출하일(최초 일정 또는 프로젝트 관리에서 변경 적용된 일정) 다음날이 지난 프로젝트는
// Field 셋업 간트 차트의 "완료" 숨김 처리와 동일하게 기본적으로 목록에서 숨긴다
// (상단 "숨김 보기" 토글로 다시 볼 수 있음 — S.showHidden 공용 상태)
function _spIsPastComplete(mp){
  var ship=_mpEffectiveShipDate(mp);
  if(!ship) return false;
  return TODAY>pd(ship);
}
// 출하 완료 여부도 이관과 동일하게 수동 체크가 아니라 프로젝트 관리에 적용된 출하일
// (최초 일정 또는 변경된 일정) 기준으로 자동 판정한다
function _spShipDone(mp){
  var sh=_mpEffectiveShipDate(mp);
  return !!(sh&&TODAY>=pd(sh));
}
// 이관 이전(아직 먼) 프로젝트는 이관일이 7일 이내로 다가오기 전까지는 목록에 안 보이게 한다
// (너무 이른 프로젝트로 목록이 붐비지 않도록 — 이관일 기준 D-7 시점에 자동 노출)
// 이관일이 아예 등록되지 않은 프로젝트도 "아직 일정 확정 전"으로 보고 동일하게 숨긴다
function _spIsFarFutureTransfer(mp){
  var tr=_mpEffectiveTransferDate(mp);
  if(!tr) return true;
  var daysUntil=Math.round((pd(tr)-TODAY)/86400000);
  return daysUntil>=7;
}
// 이관 완료 여부는 수동 체크가 아니라 프로젝트 관리에 등록된 이관일 기준으로 자동 판정한다
// (이관일이 지나면 자동 체크됨 — 날짜를 바꾸고 싶으면 프로젝트 관리에서 이관일 자체를 수정)
function _spTransferDone(mp){
  var tr=_mpEffectiveTransferDate(mp);
  return !!(tr&&TODAY>=pd(tr));
}
function _spIsHiddenByDefault(mp){
  return _spIsPastComplete(mp)||_spIsFarFutureTransfer(mp);
}
function _spFilteredProjects(){
  return S.masterProjects.filter(function(mp){
    if(_spFilterRegion!=='all'&&(mp.region||'기타')!==_spFilterRegion) return false;
    if(_spFilterCustomer!=='all'&&(mp.customer||'')!==_spFilterCustomer) return false;
    if(_spIsHiddenByDefault(mp)&&!S.showHidden) return false;
    return true;
  }).sort(function(a,b){
    // 이관일이 가까운 프로젝트가 위로 오도록 정렬(D-7 자동 노출 순서와 일치) — 이관일 없는 프로젝트는 맨 뒤로
    var ta=_mpEffectiveTransferDate(a), tb=_mpEffectiveTransferDate(b);
    if(!ta&&!tb) return 0;
    if(!ta) return 1;
    if(!tb) return -1;
    return pd(ta)-pd(tb);
  });
}

function _spCalcRange(){
  var minD=new Date(TODAY.getFullYear(),TODAY.getMonth()-1,1),maxD=new Date(TODAY.getFullYear(),TODAY.getMonth()+3,0);
  var all=[];
  _spFilteredProjects().forEach(function(mp){
    var tr=_mpEffectiveTransferDate(mp); if(tr) all.push(tr);
    if(mp.setupStart) all.push(mp.setupStart);
    if(mp.setupEnd) all.push(mp.setupEnd);
    var sh=_mpEffectiveShipDate(mp); if(sh) all.push(sh);
    var p=_spProgress(mp);
    if(p.midInspectionDate) all.push(p.midInspectionDate);
    if(p.finalInspectionDate) all.push(p.finalInspectionDate);
  });
  if(all.length){
    var sorted=all.map(function(d){return pd(d);}).sort(function(a,b){return a-b;});
    if(sorted[0]<minD) minD=new Date(sorted[0].getFullYear(),sorted[0].getMonth(),1);
    var mx=sorted[sorted.length-1]; var mxE=new Date(mx.getFullYear(),mx.getMonth()+2,0);
    if(mxE>maxD) maxD=mxE;
  }
  return {start:minD,end:maxD};
}
function _spInitTL(){
  _spWPX=SP_WPX_MAP[_spZoom]||42;
  var r=_spCalcRange(); _spSd=new Date(r.start); _spSd.setHours(0,0,0,0); _spMonths=[];
  var cur=new Date(r.start.getFullYear(),r.start.getMonth(),1);
  while(cur<=r.end){
    var y=cur.getFullYear(),m=cur.getMonth()+1,days=new Date(y,m,0).getDate();
    _spMonths.push({y:y,m:m,days:days,weeks:Math.ceil(days/7),label:(m===1?y+'년 ':'')+m+'월'});
    cur=new Date(y,m,1);
  }
  _spTotPx=Math.round(_spMonths.reduce(function(s,mo){return s+mo.days;},0)/7*_spWPX);
}
function _spD2px(ds){ if(!ds) return 0; return Math.round(Math.max(0,Math.round((pd(ds)-_spSd)/86400000))/7*_spWPX); }
function _spTpx(){ var y=TODAY.getFullYear(),m=String(TODAY.getMonth()+1).padStart(2,'0'),d=String(TODAY.getDate()).padStart(2,'0'); return _spD2px(y+'-'+m+'-'+d); }
function _spMPx(mon){ return Math.round(mon.days/7*_spWPX); }
function _spWPxWeek(mon,wi){ var s=wi*7+1,e=Math.min(s+6,mon.days); return Math.round((e-s+1)/7*_spWPX); }
function _spFixedW(){ var el=document.getElementById('spGhFixed'); return (el&&el.offsetWidth)||455; }

function _spAddGrid(el){
  var xPx=0;
  _spMonths.forEach(function(mon,mi){
    if(mi>0){ var ln=document.createElement('div'); ln.className='gl mo'; ln.style.left=xPx+'px'; el.appendChild(ln); }
    for(var w=1;w<mon.weeks;w++){ var ln2=document.createElement('div'); ln2.className='gl'; ln2.style.left=(xPx+w*_spWPX)+'px'; el.appendChild(ln2); }
    xPx+=_spMPx(mon);
  });
}
function _spAddTodayLine(el){
  var px=_spTpx();
  if(px<0||px>_spTotPx) return;
  var ln=document.createElement('div'); ln.className='tlnb'; ln.style.left=px+'px'; el.appendChild(ln);
}

function renderSetupHeader(){
  var tl=document.getElementById('spGhTl');
  if(!tl) return;
  tl.innerHTML='';
  _spMonths.forEach(function(mon){
    var mpx=_spMPx(mon);
    var div=document.createElement('div'); div.className='ghmb'; div.style.width=mpx+'px';
    var wkh='';
    for(var i=0;i<mon.weeks;i++){ var p=_spWPxWeek(mon,i); wkh+='<div class="ghwk" style="width:'+p+'px;min-width:'+p+'px">'+(i+1)+'주</div>'; }
    div.innerHTML='<div class="ghmn">'+mon.label+'</div><div class="ghwks">'+wkh+'</div>';
    tl.appendChild(div);
  });
  var db=document.getElementById('spGhDb');
  if(db){
    db.innerHTML=''; _spAddGrid(db);
    var tp=_spTpx();
    if(tp>=0&&tp<=_spTotPx){
      var ln=document.createElement('div'); ln.className='tdln'; ln.style.left=tp+'px'; db.appendChild(ln);
      var lb=document.createElement('div'); lb.className='tdlb'; lb.style.left=(tp+3)+'px'; lb.textContent=todayLbl(); db.appendChild(lb);
    }
  }
  var wrap=document.getElementById('spGwrap');
  if(wrap) wrap.style.width=(_spFixedW()+_spTotPx)+'px';
}

// 사이드바 국가 그룹 접기/펼치기 상태 (새로고침 후에도 유지 — Field 셋업 간트 차트와 동일 방식)
var _SP_GRP_COLLAPSED_LS_KEY='bu2_setup_grp_collapsed';
var _spGrpCollapsed=(function(){
  try{ return JSON.parse(localStorage.getItem(_SP_GRP_COLLAPSED_LS_KEY)||'{}')||{}; }catch(e){ return {}; }
})();
function _spSaveGrpCollapsed(){
  try{ localStorage.setItem(_SP_GRP_COLLAPSED_LS_KEY,JSON.stringify(_spGrpCollapsed)); }catch(e){}
}
function toggleSpGrpCollapse(region){
  _spGrpCollapsed[region]=!_spGrpCollapsed[region];
  _spSaveGrpCollapsed();
  renderSetupSidebar();
}

// 사이드바: 간트 차트와 같은 스타일(전체 보기 → 국가 그룹 → 고객사) — 단, S.sites가 아니라
// S.masterProjects의 region/customer 값을 그대로 그룹핑 기준으로 쓴다(별개 데이터라서)
function renderSetupSidebar(){
  var el=document.getElementById('spSiteList');
  if(!el) return;
  el.innerHTML='';
  var isAll=(_spFilterRegion==='all');
  var allDiv=document.createElement('div');
  allDiv.className='sit-all'+(isAll?' on':'');
  var totalCnt=S.masterProjects.filter(function(mp){return !_spIsHiddenByDefault(mp)||S.showHidden;}).length;
  allDiv.innerHTML='<div class="sdot" style="background:#666"></div><span class="sname">'+_esc(t('optAll'))+'</span><span class="scnt'+(totalCnt>0?' has':'')+'">'+totalCnt+'</span>';
  allDiv.onclick=function(){_spFilterRegion='all';_spFilterCustomer='all';renderSetupTab();};
  el.appendChild(allDiv);

  var regionOpts=_MP_MS_DEFS.region();
  regionOpts.forEach(function(r){
    var regionMps=S.masterProjects.filter(function(mp){return (mp.region||'기타')===r.value&&(!_spIsHiddenByDefault(mp)||S.showHidden);});
    if(!regionMps.length) return;
    var isRegionActive=(_spFilterRegion===r.value&&_spFilterCustomer==='all');
    var collapsed=!!_spGrpCollapsed[r.value];
    var lbl=document.createElement('div');
    lbl.className='grplbl'+(isRegionActive?' on':'');
    lbl.style.cssText='cursor:pointer;display:flex;align-items:center;gap:4px';
    lbl.innerHTML='<span class="grp-toggle" style="flex-shrink:0;font-size:8px;color:var(--tx-faint)">'+(collapsed?'▶':'▼')+'</span>'
      +'<span style="flex:1">'+_esc(r.label)+'</span><span class="scnt'+(regionMps.length>0?' has':'')+'">'+regionMps.length+'</span>';
    lbl.querySelector('.grp-toggle').onclick=(function(rv){return function(e){ e.stopPropagation(); toggleSpGrpCollapse(rv); };})(r.value);
    lbl.onclick=function(){_spFilterRegion=r.value;_spFilterCustomer='all';renderSetupTab();};
    el.appendChild(lbl);
    if(collapsed) return;

    var customers={};
    regionMps.forEach(function(mp){ if(mp.customer) customers[mp.customer]=(customers[mp.customer]||0)+1; });
    Object.keys(customers).sort(function(a,b){return a.localeCompare(b,'ko');}).forEach(function(cust){
      var isCustActive=(_spFilterRegion===r.value&&_spFilterCustomer===cust);
      var d=document.createElement('div');
      d.className='sit'+(isCustActive?' on':'');
      d.innerHTML='<div class="sdot" style="background:#5a9aee"></div><span class="sname">'+_esc(cust)+'</span><span class="scnt'+(customers[cust]>0?' has':'')+'">'+customers[cust]+'</span>';
      (function(rv,cv){ d.onclick=function(){_spFilterRegion=rv;_spFilterCustomer=cv;renderSetupTab();}; })(r.value,cust);
      el.appendChild(d);
    });
  });
}

// 이관/셋업/출하 진행 데이터 — 각 프로젝트 레코드에 새 필드로 저장(마이그레이션 불필요, 없으면 기본값)
// 이관·출하 완료 여부는 더 이상 수동 체크값을 저장하지 않는다 — _spTransferDone/_spShipDone이
// 프로젝트 관리에 적용된 날짜(최초 일정 또는 변경된 일정) 기준으로 매번 자동 계산한다
var SP_PROGRESS_DEFAULT={setupPct:0,manager:'',dept:'',midInspectionDate:'',finalInspectionDate:'',checklist:{},notes:'',attachments:[]};
function _spProgress(mp){ return Object.assign({},SP_PROGRESS_DEFAULT,mp.progress||{}); }
function _spOverallPct(mp){
  var p=_spProgress(mp);
  return Math.round(((_spTransferDone(mp)?100:0)+(p.setupPct||0)+(_spShipDone(mp)?100:0))/3);
}
function _spSetProgress(mpId,patch){
  var mp=S.masterProjects.find(function(x){return x.id===mpId;});
  if(!mp) return;
  mp.progress=Object.assign({},SP_PROGRESS_DEFAULT,mp.progress||{},patch);
  _touch(mp); saveData();
  renderSetupBody();
}
function spSetSetupPct(mpId,val){ _spSetProgress(mpId,{setupPct:Math.max(0,Math.min(100,parseInt(val,10)||0))}); }

// 셋업 간트 바는 항상 출하 하루 전까지를 종료 시점으로 맞춘다 — 출하일이 늦춰지면 연장되고,
// 반대로 출하일이 등록된 셋업 종료일보다 앞당겨지면 셋업 바도 그만큼 단축된다.
// (실제 mp.setupEnd 값은 건드리지 않고, 렌더 시점에만 계산 — 출하일이 다시 바뀌면 자동으로 재조정됨)
function _spEffectiveSetupEnd(mp){
  var end=mp.setupEnd;
  var ship=_mpEffectiveShipDate(mp);
  if(ship){
    var shipMinus1=new Date(pd(ship).getTime()-86400000);
    var y=shipMinus1.getFullYear(),m=String(shipMinus1.getMonth()+1).padStart(2,'0'),d=String(shipMinus1.getDate()).padStart(2,'0');
    end=y+'-'+m+'-'+d;
    // 셋업 시작일보다 앞서지 않도록 보정(출하일이 셋업 시작일보다도 빠른 극단적인 경우)
    if(mp.setupStart&&pd(end)<pd(mp.setupStart)) end=mp.setupStart;
  }
  return end;
}

// 셋업 %를 슬라이더 대신 클릭해서 직접 숫자로 입력할 수 있게(임시로 <input type=number>로 치환)
function spEditSetupPct(spanEl,mpId){
  var cur=parseInt(spanEl.textContent,10)||0;
  var input=document.createElement('input');
  input.type='number'; input.min=0; input.max=100; input.value=cur;
  input.style.cssText='width:42px;font-size:10px;padding:0 2px;border-radius:3px;border:1px solid var(--bd-main);background:var(--bg-deep);color:var(--tx-main)';
  spanEl.replaceWith(input);
  input.focus(); input.select();
  var done=false;
  function commit(){ if(done) return; done=true; spSetSetupPct(mpId,input.value); }
  function cancel(){ if(done) return; done=true; renderSetupBody(); }
  input.addEventListener('keydown',function(e){
    if(e.key==='Enter'){ e.preventDefault(); commit(); }
    else if(e.key==='Escape'){ e.preventDefault(); cancel(); }
  });
  input.addEventListener('blur',commit);
}

function _spRenderRow(mp,idx){
  var p=_spProgress(mp);
  var transferDate=_mpEffectiveTransferDate(mp);
  var shipDate=_mpEffectiveShipDate(mp);
  var idAttr=mp.id.replace(/'/g,"\\'");

  var unitInfo=mp.prodUnit?(mp.prodUnit+(mp.customerUnit?'('+mp.customerUnit+')':'')):(mp.customerUnit||'');
  var nameExtra=[mp.serial||'',unitInfo].filter(Boolean).join(' · ');

  var fixedHtml='<div class="gfix" style="flex-direction:column;align-items:flex-start;height:auto;padding:6px 8px;gap:3px">'
    +'<div style="display:flex;align-items:center;gap:6px;width:100%;overflow:hidden">'+_mpCategoryBadge(mp.category)
    +'<span style="font-size:11px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+_esc(mp.projectName||'')
    +(nameExtra?' <span style="font-weight:400;color:var(--tx-faint);font-size:10px">'+_esc(nameExtra)+'</span>':'')+'</span></div>'
    +'<div style="font-size:10px;color:var(--tx-muted)">'+_esc(mp.customer||'')+' · '+_esc(tRegion(mp.region||'기타'))+(p.manager?' · '+_esc(p.manager):'')+'</div>';

  // 이관·출하 완료 여부/날짜는 프로젝트 관리에 적용된 일정(최초 일정 또는 변경된 일정) 기준으로
  // 자동 계산한다(수동 체크 없음 — 날짜를 바꾸고 싶으면 프로젝트 관리에서 해당 일정 자체를 수정)
  var transferDone=_spTransferDone(mp);
  var transferDateShown=transferDone?transferDate:'';
  var shipDone=_spShipDone(mp);
  var shipDateShown=shipDone?shipDate:'';

  fixedHtml+='<div style="display:flex;align-items:center;gap:8px;font-size:10px;color:var(--tx-second);flex-wrap:wrap">'
    +'<label style="display:flex;align-items:center;gap:3px" title="프로젝트 관리의 이관일 기준으로 자동 체크됩니다"><input type="checkbox" '+(transferDone?'checked':'')+' disabled style="accent-color:#5a9aee">이관'
    +(transferDateShown?' <span style="color:var(--tx-faint)">'+fmtFull(transferDateShown)+'</span>':'')+'</label>'
    +'<span style="display:flex;align-items:center;gap:4px">셋업'
    +'<input type="range" min="0" max="100" value="'+(p.setupPct||0)+'" oninput="this.nextElementSibling.textContent=this.value+\'%\'" onchange="spSetSetupPct(\''+idAttr+'\',this.value)" style="width:56px;accent-color:#4aaa70">'
    +'<span onclick="spEditSetupPct(this,\''+idAttr+'\')" style="cursor:pointer;min-width:28px;display:inline-block;text-align:right" title="클릭하여 직접 입력">'+(p.setupPct||0)+'%</span>'
    +(mp.setupStart&&mp.setupEnd?' <span style="color:var(--tx-faint)">('+fmtFull(mp.setupStart)+'~'+fmtFull(mp.setupEnd)+')</span>':'')+'</span>'
    +'<label style="display:flex;align-items:center;gap:3px" title="프로젝트 관리의 출하일 기준으로 자동 체크됩니다"><input type="checkbox" '+(shipDone?'checked':'')+' disabled style="accent-color:#b39ddb">출하'
    +(shipDateShown?' <span style="color:var(--tx-faint)">'+fmtFull(shipDateShown)+'</span>':'')+'</label>'
    +'</div>';
  fixedHtml+='</div>';

  var segHtml='';
  if(mp.setupStart&&mp.setupEnd){
    var effEnd=_spEffectiveSetupEnd(mp);
    var x1=_spD2px(mp.setupStart), x2=_spD2px(effEnd)+Math.round(_spWPX/7);
    var w=Math.max(x2-x1,4);
    var fillPct=Math.max(0,Math.min(100,p.setupPct||0));
    var extNote=effEnd===mp.setupEnd?'':(pd(effEnd)>pd(mp.setupEnd)?' · 출하일정 반영 연장':' · 출하일정 반영 단축');
    segHtml+='<div onclick="openSpProgressModal(\''+idAttr+'\')" title="셋업 '+fmtFull(mp.setupStart)+' ~ '+fmtFull(effEnd)+' ('+(p.setupPct||0)+'%)'+extNote+' · 클릭하여 상세 기록" style="position:absolute;top:8px;left:'+x1+'px;width:'+w+'px;height:16px;border-radius:4px;background:var(--bg-deep);border:1px solid var(--bd-main);overflow:hidden;z-index:2;cursor:pointer">'
      +'<div style="height:100%;width:'+fillPct+'%;background:#4aaa70"></div></div>';
  }
  if(transferDate){
    var tx=_spD2px(transferDate);
    segHtml+='<div title="이관 '+fmtFull(transferDate)+(transferDone?' (완료)':'')+'" style="position:absolute;top:6px;left:'+(tx-4)+'px;width:8px;height:20px;border-radius:2px;background:'+(transferDone?'#5a9aee':'var(--bg-hover)')+';border:1px solid '+(transferDone?'#3a7ac0':'var(--bd-main)')+';z-index:3"></div>';
  }
  if(shipDate){
    var sx=_spD2px(shipDate);
    segHtml+='<div title="출하 '+fmtFull(shipDate)+(shipDone?' (완료)':'')+'" style="position:absolute;top:6px;left:'+(sx-4)+'px;width:8px;height:20px;border-radius:2px;background:'+(shipDone?'#b39ddb':'var(--bg-hover)')+';border:1px solid '+(shipDone?'#8a6ac0':'var(--bd-main)')+';z-index:3"></div>';
  }
  if(p.midInspectionDate){
    var mx=_spD2px(p.midInspectionDate);
    segHtml+='<div title="고객사 중간 검수 '+fmtFull(p.midInspectionDate)+'" style="position:absolute;top:6px;left:'+(mx-4)+'px;width:8px;height:20px;border-radius:2px;background:#d9a441;border:1px solid #a67d1a;z-index:3"></div>';
  }
  if(p.finalInspectionDate){
    var fx=_spD2px(p.finalInspectionDate);
    segHtml+='<div title="고객사 최종 검수 '+fmtFull(p.finalInspectionDate)+'" style="position:absolute;top:6px;left:'+(fx-4)+'px;width:8px;height:20px;border-radius:2px;background:#e0735a;border:1px solid #b34a32;z-index:3"></div>';
  }

  var row=document.createElement('div');
  row.className='grow '+(idx%2===0?'even':'odd');
  row.innerHTML=fixedHtml+'<div class="gtl" style="height:auto;min-height:56px"></div>';
  var gtl=row.querySelector('.gtl');
  _spAddGrid(gtl);
  _spAddTodayLine(gtl);
  gtl.insertAdjacentHTML('beforeend',segHtml);
  return row;
}

function renderSetupBody(){
  var body=document.getElementById('spGbody');
  if(!body) return;
  // 숨김 보기 버튼 상태 동기화(Field 셋업 간트 차트와 동일 방식) — showHidden이 localStorage에서 복원된 경우 반영
  var _btn=document.getElementById('btnHiddenSetup');
  if(_btn){_btn.textContent=S.showHidden?'숨김 숨기기':'숨김 보기';_btn.className='btn'+(S.showHidden?' warn':'');}
  var rows=_spFilteredProjects();
  body.innerHTML='';
  if(!rows.length){
    body.innerHTML='<div class="empty" style="padding:30px;text-align:center;color:var(--tx-muted)">해당 조건의 프로젝트가 없습니다.</div>';
    return;
  }
  var frag=document.createDocumentFragment();
  rows.forEach(function(mp,idx){ frag.appendChild(_spRenderRow(mp,idx)); });
  body.appendChild(frag);
}

// ── 셋업 진행 기록 모달 (담당자/소속 + 체크리스트 + 첨부파일) ──
var SP_CHECKLIST_ITEMS=['I/O 확인','Motion 확인','PC, Controller Setting','SW 설치','Vision 상태 확인',
  '설비 초기화','Jig Table 평탄, Isolator Setting','Handler Teaching','Dry Run Test','광학계 Tuning',
  'Recipe Setup','Data 검증','Full Run Test','고객사 요청 사항 점검(사양서)','Outgoing Report'];
var SP_MAX_FILE_MB=15;
var _spModalMpId=null; // 현재 열려있는 셋업 진행 모달의 대상 mp id

function _spFmtFileSize(bytes){
  if(!bytes&&bytes!==0) return '';
  if(bytes<1024) return bytes+'B';
  if(bytes<1024*1024) return Math.round(bytes/1024)+'KB';
  return (bytes/1024/1024).toFixed(1)+'MB';
}

function _spAttachListHtml(attachments){
  if(!attachments||!attachments.length) return '<div style="font-size:11px;color:var(--tx-faint)">첨부된 파일이 없습니다.</div>';
  return attachments.map(function(a){
    var fidAttr=String(a.id).replace(/'/g,"\\'");
    return '<div style="display:flex;align-items:center;gap:8px;font-size:12px;background:var(--bg-deep);border:1px solid var(--bd-main);border-radius:6px;padding:5px 8px">'
      +'<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+_esc(a.name||'')+'</span>'
      +'<span style="color:var(--tx-faint);flex-shrink:0">'+_spFmtFileSize(a.size)+'</span>'
      +'<a href="'+_esc(a.downloadUrl||a.viewUrl||'#')+'" target="_blank" rel="noopener" class="btn sm" style="flex-shrink:0;text-decoration:none">다운로드</a>'
      +'<button class="btn sm red" style="flex-shrink:0" onclick="spDeleteAttachment(\''+_spModalMpId.replace(/'/g,"\\'")+'\',\''+fidAttr+'\')">삭제</button>'
      +'</div>';
  }).join('');
}

function openSpProgressModal(mpId){
  var mp=S.masterProjects.find(function(x){return x.id===mpId;});
  if(!mp) return;
  _spModalMpId=mpId;
  _spNotesSavedRange=null;
  var p=_spProgress(mp);
  var idAttr=mpId.replace(/'/g,"\\'");
  var doneCnt=SP_CHECKLIST_ITEMS.filter(function(item,i){return !!p.checklist[i];}).length;

  var html='<div class="mtit">🛠️ 셋업 진행 기록 — '+_esc(mp.projectName||'')+'</div>';
  html+='<div style="font-size:11px;color:var(--tx-muted);margin-bottom:10px">'+_esc(mp.customer||'')+' · '+_esc(tRegion(mp.region||'기타'))+'</div>';

  html+='<div style="display:flex;gap:10px;margin-bottom:10px">'
    +'<div class="fg" style="flex:1"><label class="fl">담당자</label><input type="text" value="'+_esc(p.manager||'')+'" placeholder="담당자명" onchange="spSaveField(\''+idAttr+'\',\'manager\',this.value)"></div>'
    +'<div class="fg" style="flex:1"><label class="fl">소속</label><input type="text" value="'+_esc(p.dept||'')+'" placeholder="소속" onchange="spSaveField(\''+idAttr+'\',\'dept\',this.value)"></div>'
    +'</div>';

  html+='<div style="display:flex;gap:10px;margin-bottom:10px">'
    +'<div class="fg" style="flex:1"><label class="fl">고객사 중간 검수일</label><input type="date" value="'+_esc(p.midInspectionDate||'')+'" onchange="spSaveField(\''+idAttr+'\',\'midInspectionDate\',this.value)"></div>'
    +'<div class="fg" style="flex:1"><label class="fl">고객사 최종 검수일</label><input type="date" value="'+_esc(p.finalInspectionDate||'')+'" onchange="spSaveField(\''+idAttr+'\',\'finalInspectionDate\',this.value)"></div>'
    +'</div>';

  html+='<div class="fg"><label class="fl" id="sp_cl_count">체크리스트 ('+doneCnt+'/'+SP_CHECKLIST_ITEMS.length+')</label>'
    +'<div style="display:flex;flex-direction:column;gap:2px;max-height:220px;overflow-y:auto;border:1px solid var(--bd-main);border-radius:6px;padding:8px">'
    +SP_CHECKLIST_ITEMS.map(function(item,i){
      var checked=!!p.checklist[i];
      return '<label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;padding:2px 0">'
        +'<input type="checkbox" '+(checked?'checked':'')+' onchange="spToggleChecklist(\''+idAttr+'\','+i+',this.checked)">'
        +'<span style="color:'+(checked?'var(--tx-muted)':'var(--tx-main)')+';text-decoration:'+(checked?'line-through':'none')+'">'+(i+1)+'. '+_esc(item)+'</span>'
        +'</label>';
    }).join('')
    +'</div></div>';

  html+='<div class="fg"><label class="fl">특이사항</label>'
    +'<div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;padding:6px;background:var(--bg-deep);border:1px solid var(--bd-main);border-bottom:none;border-radius:6px 6px 0 0">'
    +'<select onchange="spNotesExec(\'fontName\',this.value);this.selectedIndex=0" style="font-size:11px;max-width:100px" title="글꼴">'
    +'<option value="">글꼴</option><option value="맑은 고딕">맑은 고딕</option><option value="굴림">굴림</option><option value="돋움">돋움</option><option value="바탕">바탕</option><option value="monospace">monospace</option><option value="Arial">Arial</option>'
    +'</select>'
    +'<select onchange="spNotesFontSize(this.value);this.selectedIndex=0" style="font-size:11px;width:64px" title="크기">'
    +'<option value="">크기</option><option value="11">11</option><option value="12">12</option><option value="14">14</option><option value="16">16</option><option value="18">18</option><option value="24">24</option>'
    +'</select>'
    +'<button type="button" class="btn sm" onmousedown="event.preventDefault()" onclick="spNotesExec(\'bold\')" style="font-weight:700" title="굵게">B</button>'
    +'<button type="button" class="btn sm" onmousedown="event.preventDefault()" onclick="spNotesExec(\'italic\')" style="font-style:italic" title="기울임">I</button>'
    +'<button type="button" class="btn sm" onmousedown="event.preventDefault()" onclick="spNotesExec(\'underline\')" style="text-decoration:underline" title="밑줄">U</button>'
    +'<button type="button" class="btn sm" onmousedown="event.preventDefault()" onclick="event.stopPropagation();spToggleColorPicker(\'fore\',this)" title="글자색" style="display:flex;flex-direction:column;align-items:center;padding:2px 6px;line-height:1.1;gap:1px">'
    +'<span>가</span><span id="sp_fore_indicator" style="display:block;width:14px;height:3px;background:#e8e8ec;border-radius:1px"></span></button>'
    +'<button type="button" class="btn sm" onmousedown="event.preventDefault()" onclick="event.stopPropagation();spToggleColorPicker(\'back\',this)" title="배경색(강조)" style="display:flex;flex-direction:column;align-items:center;padding:2px 6px;line-height:1.1;gap:1px">'
    +'<span>채색</span><span id="sp_back_indicator" style="display:block;width:14px;height:3px;background:transparent;border:1px solid var(--bd-main);border-radius:1px"></span></button>'
    +'<button type="button" class="btn sm" onmousedown="event.preventDefault()" onclick="spNotesExec(\'removeFormat\')" title="서식 지우기">지우기</button>'
    +'</div>'
    +'<div id="sp_notes_editor" class="rte-editor" contenteditable="true" data-placeholder="특이사항을 입력하세요" onmouseup="_spNotesSaveSelection()" onkeyup="_spNotesSaveSelection()" onblur="spSaveField(\''+idAttr+'\',\'notes\',this.innerHTML)" style="font-family:monospace;font-size:12px;white-space:pre-wrap;word-break:break-word;height:200px;overflow-y:auto;background:var(--bg-deep);color:var(--tx-main);border:1px solid var(--bd-main);border-radius:0 0 6px 6px;padding:8px">'+_spNotesHtml(p.notes)+'</div>'
    +'</div>';

  html+='<div class="fg"><label class="fl">첨부파일 (이미지/파일) : Tuning Image, Data 검증 Raw data, Outgoing Report 등의 파일을 업로드해주세요.</label>'
    +'<div id="sp_attach_list" style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px">'+_spAttachListHtml(p.attachments)+'</div>'
    +'<button class="btn sm" onclick="spTriggerFileUpload(\''+idAttr+'\')">+ 파일 추가</button>'
    +'<span id="sp_attach_status" style="font-size:11px;color:var(--tx-muted);margin-left:8px"></span>'
    +'</div>';

  html+='<div class="mfoot"><button class="btn sm pri" onclick="cm()">닫기</button></div>';
  mw(html,true);
}

function spSaveField(mpId,field,val){
  var patch={}; patch[field]=val;
  _spSetProgress(mpId,patch);
}

// 특이사항은 이 서식 툴바가 생기기 전까지 순수 텍스트(<textarea>)로 저장돼 있었다 — 그 데이터는
// 태그가 있을 수 없으므로 이스케이프해서 그대로 보여주고(줄바꿈은 white-space:pre-wrap이 처리),
// 이 에디터가 저장한 HTML(태그 포함)은 그대로 렌더링한다
function _spNotesHtml(raw){
  if(!raw) return '';
  if(/<[a-z][\s\S]*>/i.test(raw)) return raw;
  return _esc(raw);
}
// 글꼴/크기 select와 색상 picker는 클릭하는 순간 브라우저가 네이티브 목록을 열기 위해
// contenteditable의 포커스·선택 영역을 가져가 버린다(그래서 mousedown에 preventDefault를
// 걸면 반대로 네이티브 목록 자체가 안 열림). 그래서 에디터에서 커서를 움직일 때마다
// 선택 영역을 따로 기억해뒀다가, 서식 명령 실행 직전에 그 선택 영역을 되살린다.
var _spNotesSavedRange=null;
function _spNotesSaveSelection(){
  var editor=document.getElementById('sp_notes_editor');
  var sel=window.getSelection();
  if(editor&&sel.rangeCount>0&&editor.contains(sel.anchorNode)){
    _spNotesSavedRange=sel.getRangeAt(0).cloneRange();
  }
}
function _spNotesRestoreSelection(){
  var editor=document.getElementById('sp_notes_editor');
  editor.focus();
  var sel=window.getSelection();
  // 드래그로 선택한 게 없으면(커서만 있는 상태) 서식 버튼을 눌러도 눈에 보이는 변화가 없어서
  // "안 바뀐다"로 오인하기 쉽다 — 이 경우 전체 내용에 적용되도록 기본값으로 전체 선택한다
  if(_spNotesSavedRange&&!_spNotesSavedRange.collapsed){
    sel.removeAllRanges();
    sel.addRange(_spNotesSavedRange);
  } else if(editor.textContent.length>0){
    document.execCommand('selectAll',false,null);
  }
}
// 특이사항 서식 툴바 — 굵게/기울임/밑줄/글꼴/글자색은 표준 execCommand로 처리
function spNotesExec(cmd,value){
  _spNotesRestoreSelection();
  document.execCommand(cmd,false,value||null);
  _spNotesSaveSelection();
}
// execCommand('fontSize')는 1~7 스케일만 지원해서 실제 px 크기를 못 받으므로,
// 일단 최대값(7)으로 적용해 생성된 <font size="7">를 찾아 원하는 px로 바꿔치기한다(표준 트릭)
function spNotesFontSize(px){
  if(!px) return;
  var editor=document.getElementById('sp_notes_editor');
  _spNotesRestoreSelection();
  document.execCommand('fontSize',false,'7');
  var fonts=editor.getElementsByTagName('font');
  for(var i=0;i<fonts.length;i++){
    if(fonts[i].size==='7'){
      fonts[i].removeAttribute('size');
      fonts[i].style.fontSize=px+'px';
    }
  }
  _spNotesSaveSelection();
}

// 엑셀 글꼴 색/채우기 색 팔레트와 비슷한 형태 — 표준 색 10개 + 최근 사용한 색(localStorage) +
// "다른 색"(네이티브 색상 선택기). 배경색은 "채우기 없음"으로 지울 수도 있다.
var SP_STD_COLORS=['#C00000','#FF0000','#FFC000','#FFFF00','#92D050','#00B050','#00B0F0','#0070C0','#002060','#7030A0'];
var SP_RECENT_KEY={fore:'bu2_setup_recent_fore_colors',back:'bu2_setup_recent_back_colors'};
function _spRecentColors(kind){
  try{ return JSON.parse(localStorage.getItem(SP_RECENT_KEY[kind])||'[]'); }catch(e){ return []; }
}
function _spAddRecentColor(kind,color){
  var list=_spRecentColors(kind).filter(function(c){return c!==color;});
  list.unshift(color);
  try{ localStorage.setItem(SP_RECENT_KEY[kind],JSON.stringify(list.slice(0,10))); }catch(e){}
}
function _spSwatchesHtml(kind,colors){
  return '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:5px;margin-bottom:8px">'
    +colors.map(function(c){
      return '<div onmousedown="event.preventDefault()" onclick="_spPickColor(\''+kind+'\',\''+c+'\')" title="'+c+'" style="width:26px;height:22px;background:'+c+';border-radius:3px;cursor:pointer;border:1px solid rgba(255,255,255,.15)"></div>';
    }).join('')
    +'</div>';
}
function spToggleColorPicker(kind,btnEl){
  var existing=document.getElementById('sp_color_picker');
  if(existing){
    var wasKind=existing.getAttribute('data-kind');
    existing.remove();
    document.removeEventListener('mousedown',_spColorPickerOutsideClick,true);
    if(wasKind===kind) return; // 같은 버튼 다시 클릭하면 닫기만
  }
  _spNotesSaveSelection(); // 패널이 뜨기 전 마지막 선택 영역을 한 번 더 확정
  var rect=btnEl.getBoundingClientRect();
  var panel=document.createElement('div');
  panel.id='sp_color_picker';
  panel.setAttribute('data-kind',kind);
  panel.style.cssText='position:fixed;top:'+(rect.bottom+4)+'px;left:'+rect.left+'px;z-index:999;background:var(--bg-panel);border:1px solid var(--bd-strong);border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.5);padding:10px;width:186px';
  var html='';
  if(kind==='back'){
    html+='<div onmousedown="event.preventDefault()" onclick="_spPickColor(\'back\',\'\')" style="font-size:11px;padding:4px 6px;cursor:pointer;border-radius:4px;margin-bottom:6px">채우기 없음</div>';
  }
  // 글자색은 기본값이 흰색에 가까운 밝은 회색(#e8e8ec)이라, 다른 색을 적용했다가
  // 원래대로 되돌리고 싶을 때 쓸 수 있게 흰색을 맨 앞에 추가해둔다
  var stdColors=kind==='fore'?['#FFFFFF'].concat(SP_STD_COLORS):SP_STD_COLORS;
  html+='<div style="font-size:10px;color:var(--tx-faint);margin-bottom:4px">표준 색</div>'
    +_spSwatchesHtml(kind,stdColors);
  var recent=_spRecentColors(kind);
  if(recent.length){
    html+='<div style="font-size:10px;color:var(--tx-faint);margin-bottom:4px">최근에 사용한 색</div>'
      +_spSwatchesHtml(kind,recent);
  }
  html+='<input type="color" onmousedown="event.stopPropagation()" onchange="_spPickColor(\''+kind+'\',this.value)" style="width:100%;height:26px;padding:0;border:1px solid var(--bd-main);border-radius:4px;background:none;cursor:pointer" title="다른 색">';
  panel.innerHTML=html;
  document.body.appendChild(panel);
  setTimeout(function(){ document.addEventListener('mousedown',_spColorPickerOutsideClick,true); },0);
}
function _spColorPickerOutsideClick(e){
  var panel=document.getElementById('sp_color_picker');
  if(panel&&!panel.contains(e.target)){
    panel.remove();
    document.removeEventListener('mousedown',_spColorPickerOutsideClick,true);
  }
}
function _spPickColor(kind,color){
  var panel=document.getElementById('sp_color_picker');
  if(panel){ panel.remove(); document.removeEventListener('mousedown',_spColorPickerOutsideClick,true); }
  _spNotesRestoreSelection();
  if(kind==='fore'){
    document.execCommand('foreColor',false,color||'inherit');
  } else {
    document.execCommand('styleWithCSS',false,true);
    var ok=document.execCommand('hiliteColor',false,color||'transparent');
    if(!ok) document.execCommand('backColor',false,color||'transparent');
  }
  var indicator=document.getElementById(kind==='fore'?'sp_fore_indicator':'sp_back_indicator');
  if(indicator) indicator.style.background=color||'transparent';
  if(color) _spAddRecentColor(kind,color);
  _spNotesSaveSelection();
}

function spToggleChecklist(mpId,idx,checked){
  var mp=S.masterProjects.find(function(x){return x.id===mpId;});
  if(!mp) return;
  var p=_spProgress(mp);
  var checklist=Object.assign({},p.checklist);
  if(checked) checklist[idx]=true; else delete checklist[idx];
  _spSetProgress(mpId,{checklist:checklist});
  var doneCnt=SP_CHECKLIST_ITEMS.filter(function(item,i){return !!checklist[i];}).length;
  var lbl=document.getElementById('sp_cl_count');
  if(lbl) lbl.textContent='체크리스트 ('+doneCnt+'/'+SP_CHECKLIST_ITEMS.length+')';
}

function spTriggerFileUpload(mpId){
  _spModalMpId=mpId;
  var input=document.getElementById('spAttachFileInput');
  if(input) input.click();
}

function _spRefreshAttachList(){
  var mp=S.masterProjects.find(function(x){return x.id===_spModalMpId;});
  var listEl=document.getElementById('sp_attach_list');
  if(!mp||!listEl) return;
  listEl.innerHTML=_spAttachListHtml(_spProgress(mp).attachments);
}

function spHandleFileUpload(inputEl){
  var files=Array.prototype.slice.call(inputEl.files||[]);
  inputEl.value='';
  if(!files.length) return;
  var mpId=_spModalMpId;
  if(!S.masterProjects.find(function(x){return x.id===mpId;})) return;
  var url=getSheetsUrl();
  if(!url){ alert('Sheets 연동 URL이 설정되어 있지 않아 파일을 업로드할 수 없습니다.'); return; }
  var statusEl=document.getElementById('sp_attach_status');
  var remaining=files.length;
  files.forEach(function(file){
    if(file.size>SP_MAX_FILE_MB*1024*1024){
      alert(file.name+' 파일이 '+SP_MAX_FILE_MB+'MB를 초과하여 업로드할 수 없습니다.');
      remaining--; if(remaining===0&&statusEl) statusEl.textContent='';
      return;
    }
    if(statusEl) statusEl.textContent=file.name+' 업로드 중...';
    var reader=new FileReader();
    reader.onload=function(){
      var base64Data=String(reader.result).split(',')[1]||'';
      fetch(url,{method:'POST',headers:{'Content-Type':'text/plain'},
        body:JSON.stringify({action:'uploadFile',fileName:file.name,mimeType:file.type||'application/octet-stream',base64Data:base64Data})
      }).then(function(r){return r.json();})
      .then(function(data){
        remaining--;
        if(data.error){ alert('업로드 실패: '+data.error); }
        else{
          var m=S.masterProjects.find(function(x){return x.id===mpId;});
          if(m){
            var p=_spProgress(m);
            var attachments=(p.attachments||[]).slice();
            attachments.push({id:data.fileId,name:data.name,size:data.size,downloadUrl:data.downloadUrl,viewUrl:data.viewUrl,uploadedAt:Date.now()});
            _spSetProgress(mpId,{attachments:attachments});
            _spRefreshAttachList();
          }
        }
        if(remaining===0&&statusEl) statusEl.textContent='';
      })
      .catch(function(err){
        remaining--;
        alert('업로드 실패: '+err.message);
        if(remaining===0&&statusEl) statusEl.textContent='';
      });
    };
    reader.readAsDataURL(file);
  });
}

function spDeleteAttachment(mpId,fileId){
  if(!confirm('첨부파일을 삭제할까요?')) return;
  var mp=S.masterProjects.find(function(x){return x.id===mpId;});
  if(!mp) return;
  var p=_spProgress(mp);
  var attachments=(p.attachments||[]).filter(function(a){return String(a.id)!==String(fileId);});
  _spSetProgress(mpId,{attachments:attachments});
  _spRefreshAttachList();
  var url=getSheetsUrl();
  if(url){
    fetch(url,{method:'POST',headers:{'Content-Type':'text/plain'},
      body:JSON.stringify({action:'deleteFile',fileId:fileId})
    }).catch(function(){});
  }
}

function renderSetupTab(){
  var scrollEl=document.getElementById('spGscroll');
  var sTop=scrollEl?scrollEl.scrollTop:0, sLeft=scrollEl?scrollEl.scrollLeft:0;
  _spInitTL();
  renderSetupSidebar();
  renderSetupHeader();
  renderSetupBody();
  var newScrollEl=document.getElementById('spGscroll');
  if(!newScrollEl) return;
  if(!_spScrollBootstrapped){
    // Field 셋업 간트 차트(gantt.js)와 같은 공식: 고정 컬럼 폭의 4/3만큼 여유를 두고 오늘 위치로 스크롤
    newScrollEl.scrollLeft=Math.max(0,_spTpx()-Math.round(_spFixedW()*4/3));
    _spScrollBootstrapped=true;
  }else{
    newScrollEl.scrollTop=sTop; newScrollEl.scrollLeft=sLeft;
  }
}
