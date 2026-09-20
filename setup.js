/* ══════════════════════════════════════════
   설비 셋업 진행 현황 — setup.js
   프로젝트 관리(S.masterProjects)의 생산 이관일/HQ 셋업 기간/출하 일정을 실제
   달력 타임라인 위에 그려서 진행 상황을 한눈에 보고, 단계별 진행률(이관 완료/
   셋업 진행률/출하 완료)을 직접 입력·저장한다.

   간트 차트(gantt.js)와 같은 달력 렌더링 방식(주/격주/월 단위 격자, 오늘 날짜
   선)을 그대로 따르지만, 날짜 범위 기준이 다르므로(S.schedules가 아니라
   S.masterProjects) 전역 상태(WPX/_months/_totPx/_sd)를 공유하지 않고
   접두어 _sp를 붙인 독립된 상태로 둔다 — 간트 차트를 건드리지 않기 위함.
══════════════════════════════════════════ */

var _spZoom='week';
var SP_WPX_MAP={week:42,biweek:22,month:12};
var _spWPX=42,_spMonths=[],_spTotPx=0,_spSd=null;
var _spFilterRegion='all', _spFilterCustomer='all';

function setSpZoom(z){ _spZoom=z; renderSetupTab(); }

function _spFilteredProjects(){
  return S.masterProjects.filter(function(mp){
    if(_spFilterRegion!=='all'&&(mp.region||'기타')!==_spFilterRegion) return false;
    if(_spFilterCustomer!=='all'&&(mp.customer||'')!==_spFilterCustomer) return false;
    return true;
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

// 사이드바: 간트 차트와 같은 스타일(전체 보기 → 국가 그룹 → 고객사) — 단, S.sites가 아니라
// S.masterProjects의 region/customer 값을 그대로 그룹핑 기준으로 쓴다(별개 데이터라서)
function renderSetupSidebar(){
  var el=document.getElementById('spSiteList');
  if(!el) return;
  el.innerHTML='';
  var isAll=(_spFilterRegion==='all');
  var allDiv=document.createElement('div');
  allDiv.className='sit-all'+(isAll?' on':'');
  var totalCnt=S.masterProjects.length;
  allDiv.innerHTML='<div class="sdot" style="background:#666"></div><span class="sname">'+_esc(t('optAll'))+'</span><span class="scnt'+(totalCnt>0?' has':'')+'">'+totalCnt+'</span>';
  allDiv.onclick=function(){_spFilterRegion='all';_spFilterCustomer='all';renderSetupTab();};
  el.appendChild(allDiv);

  var regionOpts=_MP_MS_DEFS.region();
  regionOpts.forEach(function(r){
    var regionMps=S.masterProjects.filter(function(mp){return (mp.region||'기타')===r.value;});
    if(!regionMps.length) return;
    var isRegionActive=(_spFilterRegion===r.value&&_spFilterCustomer==='all');
    var lbl=document.createElement('div');
    lbl.className='grplbl'+(isRegionActive?' on':'');
    lbl.style.cssText='cursor:pointer;display:flex;align-items:center;justify-content:space-between';
    lbl.innerHTML='<span>'+_esc(r.label)+'</span><span class="scnt'+(regionMps.length>0?' has':'')+'">'+regionMps.length+'</span>';
    lbl.onclick=function(){_spFilterRegion=r.value;_spFilterCustomer='all';renderSetupTab();};
    el.appendChild(lbl);

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
function _spProgress(mp){ return mp.progress||{transferDone:false,setupPct:0,shipDone:false}; }
function _spOverallPct(mp){
  var p=_spProgress(mp);
  return Math.round(((p.transferDone?100:0)+(p.setupPct||0)+(p.shipDone?100:0))/3);
}
function _spSetProgress(mpId,patch){
  var mp=S.masterProjects.find(function(x){return x.id===mpId;});
  if(!mp) return;
  mp.progress=Object.assign({transferDone:false,setupPct:0,shipDone:false},mp.progress||{},patch);
  _touch(mp); saveData();
  renderSetupBody();
}
function spToggleTransfer(mpId,checked){ _spSetProgress(mpId,{transferDone:checked}); }
function spToggleShip(mpId,checked){ _spSetProgress(mpId,{shipDone:checked}); }
function spSetSetupPct(mpId,val){ _spSetProgress(mpId,{setupPct:Math.max(0,Math.min(100,parseInt(val,10)||0))}); }

function _spRenderRow(mp,idx){
  var admin=_isAdminMode();
  var p=_spProgress(mp);
  var transferDate=_mpEffectiveTransferDate(mp);
  var shipDate=_mpEffectiveShipDate(mp);
  var idAttr=mp.id.replace(/'/g,"\\'");

  var fixedHtml='<div class="gfix" style="flex-direction:column;align-items:flex-start;height:auto;padding:6px 8px;gap:3px">'
    +'<div style="display:flex;align-items:center;gap:6px;width:100%;overflow:hidden">'+_mpCategoryBadge(mp.category)
    +'<span style="font-size:11px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+_esc(mp.projectName||'')+'</span></div>'
    +'<div style="font-size:10px;color:var(--tx-muted)">'+_esc(mp.customer||'')+' · '+_esc(tRegion(mp.region||'기타'))+'</div>';

  if(admin){
    fixedHtml+='<div style="display:flex;align-items:center;gap:8px;font-size:10px;color:var(--tx-second);flex-wrap:wrap">'
      +'<label style="display:flex;align-items:center;gap:3px;cursor:pointer"><input type="checkbox" '+(p.transferDone?'checked':'')+' onchange="spToggleTransfer(\''+idAttr+'\',this.checked)" style="accent-color:#5a9aee">이관</label>'
      +'<span style="display:flex;align-items:center;gap:4px">셋업'
      +'<input type="range" min="0" max="100" value="'+(p.setupPct||0)+'" oninput="this.nextElementSibling.textContent=this.value+\'%\'" onchange="spSetSetupPct(\''+idAttr+'\',this.value)" style="width:56px;accent-color:#4aaa70">'
      +'<span>'+(p.setupPct||0)+'%</span></span>'
      +'<label style="display:flex;align-items:center;gap:3px;cursor:pointer"><input type="checkbox" '+(p.shipDone?'checked':'')+' onchange="spToggleShip(\''+idAttr+'\',this.checked)" style="accent-color:#b39ddb">출하</label>'
      +'</div>';
  }else{
    fixedHtml+='<div style="font-size:10px;color:var(--tx-second)">이관 '+(p.transferDone?'✓':'-')+' · 셋업 '+(p.setupPct||0)+'% · 출하 '+(p.shipDone?'✓':'-')+'</div>';
  }
  fixedHtml+='</div>';

  var segHtml='';
  if(mp.setupStart&&mp.setupEnd){
    var x1=_spD2px(mp.setupStart), x2=_spD2px(mp.setupEnd)+Math.round(_spWPX/7);
    var w=Math.max(x2-x1,4);
    var fillPct=Math.max(0,Math.min(100,p.setupPct||0));
    segHtml+='<div title="셋업 '+fmtFull(mp.setupStart)+' ~ '+fmtFull(mp.setupEnd)+' ('+(p.setupPct||0)+'%)" style="position:absolute;top:8px;left:'+x1+'px;width:'+w+'px;height:16px;border-radius:4px;background:var(--bg-deep);border:1px solid var(--bd-main);overflow:hidden;z-index:2">'
      +'<div style="height:100%;width:'+fillPct+'%;background:#4aaa70"></div></div>';
  }
  if(transferDate){
    var tx=_spD2px(transferDate);
    segHtml+='<div title="이관 '+fmtFull(transferDate)+(p.transferDone?' (완료)':'')+'" style="position:absolute;top:6px;left:'+(tx-4)+'px;width:8px;height:20px;border-radius:2px;background:'+(p.transferDone?'#5a9aee':'var(--bg-hover)')+';border:1px solid '+(p.transferDone?'#3a7ac0':'var(--bd-main)')+';z-index:3"></div>';
  }
  if(shipDate){
    var sx=_spD2px(shipDate);
    segHtml+='<div title="출하 '+fmtFull(shipDate)+(p.shipDone?' (완료)':'')+'" style="position:absolute;top:6px;left:'+(sx-4)+'px;width:8px;height:20px;border-radius:2px;background:'+(p.shipDone?'#b39ddb':'var(--bg-hover)')+';border:1px solid '+(p.shipDone?'#8a6ac0':'var(--bd-main)')+';z-index:3"></div>';
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

function renderSetupTab(){
  _spInitTL();
  renderSetupSidebar();
  renderSetupHeader();
  renderSetupBody();
}
