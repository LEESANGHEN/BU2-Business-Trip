/* ══════════════════════════════════════════
   프로젝트 관리(BU1) — 확인용(읽기 전용)
   엑셀 "설비 생산 현황"에서 뽑은 BU1(iPIS 계열 + 모듈 계열 iMAS/iMAL/iSSD) 생산 계획을
   프로젝트 관리(BU2) 탭과 같은 표 모양·같은 필터 막대로 보여준다.
   - 데이터는 Apps Script의 별도 시트(BU1_TRIP_DATA, action=loadBu1)에서만 읽어 _bu1Data에 담는다. BU2 데이터(S, load/save)·홈 대시보드·
     월별 집계·엑셀 내보내기와 섞이지 않는다(저장/동기화 없음, 편집 없음). 공개 저장소에는 데이터 파일을 올리지 않는다.
   - 엑셀에 없는 항목(국가, 출장 담당자)은 열/필터를 만들지 않았다.
   ══════════════════════════════════════════ */
var _bu1={q:'',hideDone:false,sortKey:'tr',asc:true};
// 다중 선택 필터(빈 배열=전체): fam 계열, cust 고객사, model 설비명, st 상태, tm 이관월, sm 셋업월, hm 출하월 / 월 필터는 기간 직접 설정(_bu1Rg)도 가능
var _bu1MS={fam:[],cust:[],model:[],st:[],tm:[],sm:[],hm:[]};
var _bu1Rg={tm:null,sm:null,hm:null};   // {from:'YYYY-MM',to:'YYYY-MM'}
var _bu1Opts={};                        // 마지막으로 그린 옵션 목록(체크박스에서 인덱스로 참조)
var BU1_STATUS_ORDER=['생산중(HQ)','셋업(HQ)','셋업(Field)','완료'];
var BU1_FILTERS=[['fam','계열'],['cust','고객사'],['model','설비명(프로젝트)'],['st','상태'],['tm','이관월'],['sm','셋업월'],['hm','출하월']];
var BU1_RANGE={tm:1,sm:1,hm:1};
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

// BU2 프로젝트 관리의 상태 분류와 같은 방식: 완료(엑셀 출하유무) → 출하일이 지났으면 셋업(Field) → 이관일이 지났으면 셋업(HQ) → 그 외 생산중(HQ)
function _bu1Status(r){
  if(r.done) return '완료';
  if(r.shI&&pd(r.shI)<TODAY) return '셋업(Field)';
  if(r.trI&&pd(r.trI)<TODAY) return '셋업(HQ)';
  return '생산중(HQ)';
}
function _bu1Fam(r){ return /^ipis/i.test(r.model)?'iPIS':'Module'; }
function _bu1Ym(iso){ return iso?iso.slice(0,7):''; }
// 셋업 기간(시작/종료 날짜가 읽힌 행만). 한쪽만 있으면 그 날짜 하루로 본다
function _bu1SetupRange(r){
  var a=r.ssI||r.seI, b=r.seI||r.ssI;
  return a?[a,b]:null;
}
function _bu1Val(r,key){
  if(key==='fam') return _bu1Fam(r);
  if(key==='cust') return r.cust;
  if(key==='model') return r.model;
  if(key==='st') return _bu1Status(r);
  if(key==='tm') return _bu1Ym(r.trI);
  if(key==='hm') return _bu1Ym(r.shI);
  return '';
}
function _bu1AllRows(){ return (_bu1Data&&_bu1Data.rows)||[]; }

// 필터 옵션 목록
function _bu1Options(key){
  var rows=_bu1AllRows(), seen={}, out=[];
  if(key==='sm'){
    rows.forEach(function(r){
      var rg=_bu1SetupRange(r); if(!rg) return;
      var y=parseInt(rg[0].slice(0,4),10), m=parseInt(rg[0].slice(5,7),10), end=rg[1].slice(0,7), g=0;
      while(g++<60){
        var ym=y+'-'+String(m).padStart(2,'0'); if(ym>end) break;
        if(!seen[ym]){ seen[ym]=1; out.push(ym); }
        m++; if(m>12){ m=1; y++; }
      }
    });
    return out.sort().map(function(v){return {v:v,l:v};});
  }
  rows.forEach(function(r){ var v=_bu1Val(r,key); if(v&&!seen[v]){ seen[v]=1; out.push(v); } });
  if(key==='st') out.sort(function(a,b){return BU1_STATUS_ORDER.indexOf(a)-BU1_STATUS_ORDER.indexOf(b);});
  else if(key==='fam') out.sort();
  else out.sort(function(a,b){return String(a).localeCompare(String(b),'ko');});
  return out.map(function(v){return {v:v,l:(key==='st')?tStatus(v):v};});
}

function _bu1Rows(){
  var q=_bu1.q;
  return _bu1AllRows().filter(function(r){
    var st=_bu1Status(r), k;
    if(_bu1.hideDone&&st==='완료') return false;
    for(k in _bu1MS){
      if(k==='sm') continue;
      var sel=_bu1MS[k];
      if(sel.length&&sel.indexOf(_bu1Val(r,k))<0) return false;
    }
    if(_bu1MS.sm.length){
      var rg=_bu1SetupRange(r);
      if(!rg||!_bu1MS.sm.some(function(ym){return _mpMonthOverlap(ym,rg[0],rg[1]);})) return false;
    }
    var t=_bu1Rg.tm; if(t&&!((!t.from||_bu1Ym(r.trI)>=t.from)&&(!t.to||_bu1Ym(r.trI)<=t.to)&&_bu1Ym(r.trI))) return false;
    var h=_bu1Rg.hm; if(h&&!((!h.from||_bu1Ym(r.shI)>=h.from)&&(!h.to||_bu1Ym(r.shI)<=h.to)&&_bu1Ym(r.shI))) return false;
    var s=_bu1Rg.sm;
    if(s){
      var sr=_bu1SetupRange(r);
      if(!(sr&&(!s.to||sr[0].slice(0,7)<=s.to)&&(!s.from||sr[1].slice(0,7)>=s.from))) return false;
    }
    if(q){
      var hay=[r.cust,r.model,r.serial,r.unit,r.loc,r.cat].join(' ').toLowerCase();
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
  if(k==='sh') return r.shI||'9999';
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
    _bu1Rg={tm:null,sm:null,hm:null};
  }
  renderBu1Tab();
}

function _bu1Th(key,label){
  var on=_bu1.sortKey===key, arrow=on?(_bu1.asc?' ▲':' ▼'):'';
  return '<th class="'+(on?'on':'')+'" onclick="bu1SetSort(\''+key+'\')">'+_esc(label)+arrow+'</th>';
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
    body.innerHTML='<div style="padding:30px 10px;text-align:center;color:#707080;font-size:13px">조건에 맞는 BU1 설비가 없습니다.</div>';
    return;
  }
  var h='<table class="pm-person-table mp-t"><thead><tr>'
    +_bu1Th('cat','구분')+_bu1Th('cust','고객사')+_bu1Th('model','설비명(프로젝트)')+_bu1Th('serial','설비 시리얼 넘버')
    +_bu1Th('unit','생산 호기(현장 호기)')+_bu1Th('tr','생산 이관일')+'<th>셋업 일정</th>'+_bu1Th('loc','셋업 장소')+_bu1Th('sh','출하 일정')+_bu1Th('st','상태')
    +'</tr></thead><tbody>';
  rows.forEach(function(r){
    var st=_bu1Status(r), dash=function(v){ return v?_esc(v):'-'; };
    h+='<tr class="pm-person-row">'
      +'<td>'+dash(r.cat)+'</td>'
      +'<td class="mp-ell mp-c-cust" title="'+_esc(r.cust)+'">'+dash(r.cust)+'</td>'
      +'<td class="mp-ell mp-c-proj" title="'+_esc(r.model)+'">'+dash(r.model)+'</td>'
      +'<td>'+dash(r.serial)+'</td>'
      +'<td>'+dash(r.unit)+'</td>'
      +'<td class="mp-ell" title="'+_esc(r.tr)+'">'+dash(r.tr)+'</td>'
      +'<td class="mp-ell" style="max-width:260px" title="'+_esc(r.ss)+'">'+dash(r.ss)+'</td>'
      +'<td class="mp-ell mp-c-loc" title="'+_esc(r.loc)+'">'+dash(r.loc)+'</td>'
      +'<td class="mp-ell" title="'+_esc(r.sh)+'">'+dash(r.sh)+'</td>'
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
