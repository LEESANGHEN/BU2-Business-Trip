/* ══════════════════════════════════════════
   참고자료(BU1) — 확인용(읽기 전용)
   엑셀 "설비 생산 현황" + BSM(service.intekplus.com/bsm)에서 모은 BU1(iPIS 계열 + 모듈 계열 iMAS/iMAL/iSSD) 생산 계획을 보여준다.
   - 열: 구분 · 고객사 · 설비명 · 시리얼 · 생산 호기(현장 호기) · 이관일 · 셋업 장소 · 셋업 완료 · 출하일 · 이관→출하 · 출장 담당자 · 상태
   - 날짜는 YY.MM.DD. "셋업 완료"는 BSM에서 셋업 진행률 100%로 실제 완료 등록된 설비만 그 기준일을 보여준다.
   - 데이터는 Apps Script의 별도 시트(BU1_TRIP_DATA, action=loadBu1)에서만 읽어 _bu1Data에 담는다. BU2 데이터(S, load/save)·홈 대시보드·
     월별 집계·엑셀 내보내기와 섞이지 않는다(저장/동기화 없음, 편집 없음). 공개 저장소에는 데이터 파일을 올리지 않는다.
   ══════════════════════════════════════════ */
var _bu1={q:'',hideDone:false,sortKey:'tr',asc:true};
// 다중 선택 필터(빈 배열=전체): fam 계열, cust 고객사, model 설비명, st 상태, tm 이관월, cm 셋업 완료월, hm 출하월 / 월 필터는 기간 직접 설정(_bu1Rg)도 가능
var _bu1MS={fam:[],cust:[],model:[],st:[],tm:[],cm:[],hm:[]};
var _bu1Rg={tm:null,cm:null,hm:null};   // {from:'YYYY-MM',to:'YYYY-MM'}
var _bu1Opts={};                        // 마지막으로 그린 옵션 목록(체크박스에서 인덱스로 참조)
var BU1_STATUS_ORDER=['생산중(HQ)','셋업(HQ)','셋업(Field)','완료'];
var BU1_FILTERS=[['fam','계열'],['cust','고객사'],['model','설비명(프로젝트)'],['st','상태'],['tm','이관월'],['cm','셋업 완료월'],['hm','출하월']];
var BU1_RANGE={tm:1,cm:1,hm:1};
var _bu1Data=null, _bu1Loading=false, _bu1Err='';
function _bu1Load(force){
  if(_bu1Loading||(_bu1Data&&!force)) return;
  var url=getSheetsUrl();
  if(!url){ _bu1Err='Sheets 연동 URL이 설정되어 있지 않습니다.'; return; }
  _bu1Loading=true; _bu1Err='';
  fetch(url+'?action=loadBu1').then(function(r){return r.json();}).then(function(d){
    if(d.error) throw new Error(d.error);
    if(!d.rows||!d.rows.length) throw new Error('BU1 데이터가 아직 등록되지 않았습니다.');
    _bu1Data=d;
  }).catch(function(e){ _bu1Err=String((e&&e.message)||e); }).then(function(){
    _bu1Loading=false;
    if(typeof _activeTab!=='undefined'&&_activeTab==='bu1') renderBu1Tab();
  });
}

// 날짜는 모두 YY.MM.DD
function _bu1Fd(iso){ return iso?iso.slice(2).replace(/-/g,'.'):''; }
// BU2 프로젝트 관리의 상태 분류와 같은 방식: 완료 → 출하일이 지났으면 셋업(Field) → 이관일이 지났으면 셋업(HQ) → 그 외 생산중(HQ)
function _bu1Status(r){
  if(r.done) return '완료';
  if(r.shI&&pd(r.shI)<TODAY) return '셋업(Field)';
  if(r.trI&&pd(r.trI)<TODAY) return '셋업(HQ)';
  return '생산중(HQ)';
}
function _bu1Fam(r){ return /^ipis/i.test(r.model)?'iPIS':'Module'; }
// 이관→출하 일수: 음수이거나 1년을 넘으면 입력 오류(엑셀 연도 오기, BSM 옛 날짜)일 가능성이 커서 표시하지 않는다
function _bu1Days(r){ var d=r.days; return (d===''||d==null||d<0||d>365)?null:d; }
function _bu1Ym(iso){ return iso?iso.slice(0,7):''; }
function _bu1Val(r,key){
  if(key==='fam') return _bu1Fam(r);
  if(key==='cust') return r.cust;
  if(key==='model') return r.model;
  if(key==='st') return _bu1Status(r);
  if(key==='tm') return _bu1Ym(r.trI);
  if(key==='cm') return _bu1Ym(r.scI);
  if(key==='hm') return _bu1Ym(r.shI);
  return '';
}
function _bu1AllRows(){ return (_bu1Data&&_bu1Data.rows)||[]; }

// 필터 옵션 목록
function _bu1Options(key){
  var rows=_bu1AllRows(), seen={}, out=[];
  rows.forEach(function(r){ var v=_bu1Val(r,key); if(v&&!seen[v]){ seen[v]=1; out.push(v); } });
  if(key==='st') out.sort(function(a,b){return BU1_STATUS_ORDER.indexOf(a)-BU1_STATUS_ORDER.indexOf(b);});
  else if(key==='fam'||BU1_RANGE[key]) out.sort();
  else out.sort(function(a,b){return String(a).localeCompare(String(b),'ko');});
  return out.map(function(v){return {v:v,l:(key==='st')?tStatus(v):v};});
}

function _bu1Rows(){
  var q=_bu1.q;
  return _bu1AllRows().filter(function(r){
    var st=_bu1Status(r), k;
    if(_bu1.hideDone&&st==='완료') return false;
    for(k in _bu1MS){
      var sel=_bu1MS[k];
      if(sel.length&&sel.indexOf(_bu1Val(r,k))<0) return false;
    }
    for(k in _bu1Rg){
      var g=_bu1Rg[k]; if(!g) continue;
      var ym=_bu1Val(r,k);
      if(!ym||(g.from&&ym<g.from)||(g.to&&ym>g.to)) return false;
    }
    if(q){
      var hay=[r.cust,r.model,r.serial,r.unit,r.loc,r.cat,r.mgr].join(' ').toLowerCase();
      if(hay.indexOf(q)<0) return false;
    }
    return true;
  });
}

/* ── 다중 선택 드롭다운 (BU2 프로젝트 관리와 같은 모양, 클래스 공용) ── */
function _bu1RgText(r){ return (r.from||'')+' ~ '+(r.to||''); }
function _bu1MsSummary(key){
  var sel=_bu1MS[key], rg=_bu1Rg[key];
  if(rg) return sel.length?(sel.length+'개 선택 + '+_bu1RgText(rg)):_bu1RgText(rg);
  if(!sel.length) return '전체';
  if(sel.length===1){
    var o=(_bu1Opts[key]||_bu1Options(key)).find(function(x){return x.v===sel[0];});
    return o?o.l:sel[0];
  }
  return sel.length+'개 선택';
}
function _bu1MsPanelHtml(key){
  var opts=_bu1Opts[key]=_bu1Options(key), sel=_bu1MS[key], rg=_bu1Rg[key]||{from:'',to:''};
  var h='';
  if(BU1_RANGE[key]){
    h+='<div class="pm-ms-range" onclick="event.stopPropagation()"><div class="pm-ms-range-h">기간 직접 설정 (년/월 ~ 년/월)</div>'
      +'<div class="pm-ms-range-row"><input type="month" id="bu1Rg_'+key+'_f" value="'+_esc(rg.from||'')+'" onchange="bu1MsRange(\''+key+'\')">'
      +'<span>~</span><input type="month" id="bu1Rg_'+key+'_t" value="'+_esc(rg.to||'')+'" onchange="bu1MsRange(\''+key+'\')">'
      +'<button type="button" class="btn sm" onclick="bu1MsRangeClear(\''+key+'\')" title="기간 지우기">지우기</button></div></div>';
  }
  h+='<label class="pm-ms-opt all"><input type="checkbox" '+((!sel.length&&!_bu1Rg[key])?'checked':'')+' onchange="bu1MsClear(\''+key+'\')">전체</label>';
  opts.forEach(function(o,i){
    h+='<label class="pm-ms-opt"><input type="checkbox" '+(sel.indexOf(o.v)>=0?'checked':'')+' onchange="bu1MsToggle(\''+key+'\','+i+')">'+_esc(o.l)+'</label>';
  });
  return h;
}
function _bu1MsHtml(key,label){
  return '<div class="pm-ctrl-group"><span class="pm-ctrl-label">'+_esc(label)+'</span><div class="pm-ms-wrap">'
    +'<button type="button" class="pm-ms-trigger" onclick="bu1MsOpen(\''+key+'\')"><span id="bu1MsLbl_'+key+'">'+_esc(_bu1MsSummary(key))+'</span> ▾</button>'
    +'<div class="pm-ms-panel" id="bu1MsPanel_'+key+'" style="display:none">'+_bu1MsPanelHtml(key)+'</div></div></div>';
}
function bu1MsOpen(key){
  var p=document.getElementById('bu1MsPanel_'+key); if(!p) return;
  var open=p.style.display==='none';
  document.querySelectorAll('.pm-ms-panel').forEach(function(x){ x.style.display='none'; });
  p.style.display=open?'block':'none';
}
function _bu1MsRefresh(key,keepPanel){
  var l=document.getElementById('bu1MsLbl_'+key); if(l) l.textContent=_bu1MsSummary(key);
  var p=document.getElementById('bu1MsPanel_'+key);
  if(p&&!keepPanel) p.innerHTML=_bu1MsPanelHtml(key);
  renderBu1Body();
}
function bu1MsToggle(key,i){
  var o=(_bu1Opts[key]||[])[i]; if(!o) return;
  var a=_bu1MS[key], j=a.indexOf(o.v);
  if(j>=0) a.splice(j,1); else a.push(o.v);
  _bu1MsRefresh(key);
}
function bu1MsClear(key){
  _bu1MS[key]=[]; if(BU1_RANGE[key]) _bu1Rg[key]=null;
  _bu1MsRefresh(key);
  var p=document.getElementById('bu1MsPanel_'+key); if(p) p.style.display='none';
}
function bu1MsRange(key){
  var f=document.getElementById('bu1Rg_'+key+'_f'), t=document.getElementById('bu1Rg_'+key+'_t');
  var a=(f&&f.value)||'', b=(t&&t.value)||'';
  if(a&&b&&a>b){ var x=a; a=b; b=x; if(f) f.value=a; if(t) t.value=b; } // 거꾸로 넣으면 순서를 바로잡는다
  _bu1Rg[key]=(a||b)?{from:a,to:b}:null;
  _bu1MsRefresh(key,true);
  var all=document.querySelector('#bu1MsPanel_'+key+' .pm-ms-opt.all input'); if(all) all.checked=(!_bu1MS[key].length&&!_bu1Rg[key]);
}
function bu1MsRangeClear(key){
  var f=document.getElementById('bu1Rg_'+key+'_f'), t=document.getElementById('bu1Rg_'+key+'_t'); if(f) f.value=''; if(t) t.value='';
  bu1MsRange(key);
}

function _bu1SortVal(r,k){
  if(k==='tr') return r.trI||'9999';
  if(k==='sc') return r.scI||'9999';
  if(k==='sh') return r.shI||'9999';
  if(k==='days'){ var dd=_bu1Days(r); return dd==null?99999:dd; }
  if(k==='st') return BU1_STATUS_ORDER.indexOf(_bu1Status(r));
  return String(r[k]||'');
}
function bu1SetSort(k){
  if(_bu1.sortKey===k) _bu1.asc=!_bu1.asc; else{ _bu1.sortKey=k; _bu1.asc=true; }
  renderBu1Body();
}
function bu1Search(v){ _bu1.q=v.trim().toLowerCase(); renderBu1Body(); }
function bu1Retry(){ _bu1Err=''; _bu1Load(true); renderBu1Tab(); }
// 진행중만 보기: BU2와 같이 켜는 순간 모든 필터를 비우고 완료를 숨긴다(끄면 현재 필터는 그대로)
function bu1ToggleDone(){
  _bu1.hideDone=!_bu1.hideDone;
  if(_bu1.hideDone){
    _bu1.q=''; _bu1.sortKey='tr'; _bu1.asc=true;
    for(var k in _bu1MS) _bu1MS[k]=[];
    _bu1Rg={tm:null,cm:null,hm:null};
  }
  renderBu1Tab();
}

function _bu1Th(key,label,tip){
  var on=_bu1.sortKey===key, arrow=on?(_bu1.asc?' ▲':' ▼'):'';
  return '<th class="'+(on?'on':'')+'"'+(tip?' title="'+_esc(tip)+'"':'')+' onclick="bu1SetSort(\''+key+'\')">'+_esc(label)+arrow+'</th>';
}
function renderBu1Body(){
  var body=document.getElementById('bu1Body'); if(!body) return;
  var rows=_bu1Rows(), k=_bu1.sortKey, dir=_bu1.asc?1:-1;
  rows.sort(function(a,b){
    var x=_bu1SortVal(a,k), y=_bu1SortVal(b,k), v;
    if(typeof x==='number') v=x-y; else v=String(x).localeCompare(String(y),'ko');
    if(v!==0) return v*dir;
    return (a.xr-b.xr)||String(a.serial).localeCompare(String(b.serial));
  });
  var cnt=document.getElementById('bu1Count'); if(cnt) cnt.textContent=rows.length+'건';
  if(!rows.length){
    body.innerHTML='<div style="padding:30px 10px;text-align:center;color:#707080;font-size:13px">조건에 맞는 설비가 없습니다.</div>';
    return;
  }
  var h='<table class="pm-person-table mp-t"><thead><tr>'
    +_bu1Th('cat','구분')+_bu1Th('cust','고객사')+_bu1Th('model','설비명(프로젝트)')+_bu1Th('serial','설비 시리얼 넘버')
    +_bu1Th('unit','생산 호기(현장 호기)')+_bu1Th('tr','이관일')+_bu1Th('loc','셋업 장소')
    +_bu1Th('sc','셋업 완료','BSM에서 셋업 진행률 100%로 실제 완료 등록된 설비만 그 기준일을 표시합니다')
    +_bu1Th('sh','출하일')+_bu1Th('days','이관→출하','이관일부터 출하일까지 일수')
    +_bu1Th('mgr','출장 담당자','BSM에 등록된 담당자')+_bu1Th('st','상태')
    +'</tr></thead><tbody>';
  rows.forEach(function(r){
    var st=_bu1Status(r), dash=function(v){ return v?_esc(v):'-'; }, fd=function(v){ return v?_bu1Fd(v):'-'; };
    h+='<tr class="pm-person-row">'
      +'<td>'+dash(_mpCatNorm(r.cat))+'</td>'
      +'<td class="mp-ell mp-c-cust" title="'+_esc(r.cust)+'">'+dash(r.cust)+'</td>'
      +'<td class="mp-ell mp-c-proj" title="'+_esc(r.model)+'">'+dash(r.model)+'</td>'
      +'<td'+(r.src==='B'?' title="BSM에만 등록된 설비(엑셀에는 없음)"':'')+'>'+dash(r.serial)+(r.src==='B'?' <span style="color:var(--tx-faint)">*</span>':'')+'</td>'
      +'<td class="mp-ell" title="'+_esc(r.unit)+'">'+dash(r.unit)+'</td>'
      +'<td>'+fd(r.trI)+'</td>'
      +'<td class="mp-ell mp-c-loc" title="'+_esc(r.loc)+'">'+dash(r.loc)+'</td>'
      +'<td>'+fd(r.scI)+'</td>'
      +'<td>'+fd(r.shI)+'</td>'
      +'<td'+((_bu1Days(r)==null&&r.days!==''&&r.days!=null)?' title="날짜 입력 오류 가능성(음수 또는 1년 초과)으로 표시하지 않음: '+r.days+'일"':'')+'>'+(_bu1Days(r)==null?'-':_bu1Days(r)+'일')+'</td>'
      +'<td>'+dash(r.mgr)+'</td>'
      +'<td>'+_mpStatusBadge(st)+'</td></tr>';
  });
  h+='</tbody></table>';
  body.innerHTML=h;
}
function renderBu1Tab(){
  var wrap=document.getElementById('bu1Wrap'); if(!wrap) return;
  if(!_bu1Data){
    if(!_bu1Loading&&!_bu1Err) _bu1Load();
    wrap.innerHTML='<div style="padding:40px;text-align:center;color:#707080;font-size:13px">'
      +(_bu1Err?(_esc(_bu1Err)+'<br><br><button class="btn sm" onclick="bu1Retry()">다시 시도</button>'):'BU1 생산 계획을 불러오는 중...')+'</div>';
    return;
  }
  var prev=wrap.querySelector('.pm-body-scroll'), sTop=prev?prev.scrollTop:0, sLeft=prev?prev.scrollLeft:0;
  var h='<div class="pm-fixed-header"><div class="pm-ctrl-bar">'
    +'<div class="pm-ctrl-group"><span style="font-size:11px;color:#666">🔍</span>'
    +'<input class="pm-search" type="text" placeholder="고객사/설비/시리얼 검색..." autocomplete="off" oninput="bu1Search(this.value)" value="'+_esc(_bu1.q)+'"></div>';
  BU1_FILTERS.forEach(function(f){ h+='<div class="pm-ctrl-sep"></div>'+_bu1MsHtml(f[0],f[1]); });
  h+='<div class="pm-ctrl-sep"></div><div class="pm-ctrl-group"><button class="pm-filter-btn'+(_bu1.hideDone?' on':'')+'" onclick="bu1ToggleDone()">진행중만 보기</button></div>'
    +'<div style="flex:1"></div>'
    +'<span style="font-size:11px;color:var(--tx-muted)">BU1 확인용 · 읽기 전용 · 출처 '+_esc(_bu1Data.source||'')+' · <b id="bu1Count"></b></span>'
    +'</div></div>'
    +'<div class="pm-body-scroll"><div id="bu1Body"></div></div>';
  wrap.innerHTML=h;
  renderBu1Body();
  var sc=wrap.querySelector('.pm-body-scroll'); if(sc){ sc.scrollTop=sTop; sc.scrollLeft=sLeft; }
}
