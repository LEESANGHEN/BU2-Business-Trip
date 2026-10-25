/* ══════════════════════════════════════════
   프로젝트 관리(BU1) — 확인용(읽기 전용)
   엑셀 "설비 생산 현황"에서 뽑은 BU1(iPIS 계열 + 모듈 계열 iMAS/iMAL/iSSD) 생산 계획을
   프로젝트 관리(BU2) 탭과 같은 표 모양으로 보여준다.
   - 데이터는 Apps Script의 별도 시트(BU1_TRIP_DATA, action=loadBu1)에서만 읽어 _bu1Data에 담는다. BU2 데이터(S, load/save)·홈 대시보드·
     월별 집계·엑셀 내보내기와 섞이지 않는다(저장/동기화 없음, 편집 없음). 공개 저장소에는 데이터 파일을 올리지 않는다.
   - 엑셀에 없는 항목(국가, 출장 담당자)은 열을 만들지 않았다.
   ══════════════════════════════════════════ */
var _bu1={q:'',st:'',fam:'',hideDone:false,sortKey:'tr',asc:true};
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
var BU1_STATUS_ORDER=['생산중(HQ)','셋업(HQ)','셋업(Field)','완료'];

// BU2 프로젝트 관리의 상태 분류와 같은 방식: 완료(엑셀 출하유무) → 출하일이 지났으면 셋업(Field) → 이관일이 지났으면 셋업(HQ) → 그 외 생산중(HQ)
function _bu1Status(r){
  if(r.done) return '완료';
  if(r.shI&&pd(r.shI)<TODAY) return '셋업(Field)';
  if(r.trI&&pd(r.trI)<TODAY) return '셋업(HQ)';
  return '생산중(HQ)';
}
function _bu1Fam(r){ return /^ipis/i.test(r.model)?'iPIS':'Module'; }
function _bu1Rows(){
  var all=(_bu1Data&&_bu1Data.rows)||[];
  var q=_bu1.q;
  return all.filter(function(r){
    var st=_bu1Status(r);
    if(_bu1.st&&st!==_bu1.st) return false;
    if(_bu1.fam&&_bu1Fam(r)!==_bu1.fam) return false;
    if(_bu1.hideDone&&st==='완료') return false;
    if(q){
      var hay=[r.cust,r.model,r.serial,r.unit,r.loc,r.cat].join(' ').toLowerCase();
      if(hay.indexOf(q)<0) return false;
    }
    return true;
  });
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
function bu1SetStatus(v){ _bu1.st=(_bu1.st===v)?'':v; renderBu1Tab(); }
function bu1SetFam(v){ _bu1.fam=(_bu1.fam===v)?'':v; renderBu1Tab(); }
function bu1ToggleDone(){ _bu1.hideDone=!_bu1.hideDone; renderBu1Tab(); }

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
      +(_bu1Err?(_esc(_bu1Err)+'<br><br><button class="btn sm" onclick="_bu1Err='';_bu1Load(true);renderBu1Tab()">다시 시도</button>'):'BU1 생산 계획을 불러오는 중...')+'</div>';
    return;
  }
  var prev=wrap.querySelector('.pm-body-scroll'), sTop=prev?prev.scrollTop:0, sLeft=prev?prev.scrollLeft:0;
  var src=_bu1Data.source||'';
  var btn=function(on,fn,label){ return '<button class="pm-filter-btn'+(on?' on':'')+'" onclick="'+fn+'">'+_esc(label)+'</button>'; };
  var h='<div class="pm-fixed-header"><div class="pm-ctrl-bar">'
    +'<div class="pm-ctrl-group"><span style="font-size:11px;color:#666">🔍</span>'
    +'<input class="pm-search" type="text" placeholder="고객사/설비/시리얼 검색..." autocomplete="off" oninput="bu1Search(this.value)" value="'+_esc(_bu1.q)+'"></div>'
    +'<div class="pm-ctrl-sep"></div><div class="pm-ctrl-group"><span class="pm-ctrl-label">계열</span>'
    +btn(_bu1.fam==='iPIS',"bu1SetFam('iPIS')",'iPIS')+btn(_bu1.fam==='Module',"bu1SetFam('Module')",'Module(iMAS·iMAL·iSSD)')+'</div>'
    +'<div class="pm-ctrl-sep"></div><div class="pm-ctrl-group"><span class="pm-ctrl-label">상태</span>'
    +BU1_STATUS_ORDER.map(function(s){ return btn(_bu1.st===s,"bu1SetStatus('"+s+"')",tStatus(s)); }).join('')+'</div>'
    +'<div class="pm-ctrl-sep"></div><div class="pm-ctrl-group">'+btn(_bu1.hideDone,'bu1ToggleDone()','완료 숨기기')+'</div>'
    +'<div style="flex:1"></div>'
    +'<span style="font-size:11px;color:var(--tx-muted)">BU1 확인용 · 읽기 전용 · 출처 '+_esc(src)+' · <b id="bu1Count"></b></span>'
    +'</div></div>'
    +'<div class="pm-body-scroll"><div id="bu1Body"></div></div>';
  wrap.innerHTML=h;
  renderBu1Body();
  var sc=wrap.querySelector('.pm-body-scroll'); if(sc){ sc.scrollTop=sTop; sc.scrollLeft=sLeft; }
}
