/* ── 모달 ── */
var _selCol='purple',_dragIdx=null;
var _editExtSeq=null; // 현재 인라인 수정 중인 연장 회차 (null이면 없음)
function openModal(t){if(t==='schedule'){_editExtSeq=null;showSM(null);}else if(t==='event')showEM(null);else showSiteM();}
function openEditSc(id){var s=S.schedules.find(function(x){return x.id===id;});if(s){_editExtSeq=null;showSM(s);}}
function openEditEv(id){var e=S.events.find(function(x){return x.id===id;});if(e)showEM(e);}
function mw(inner,wide){document.getElementById('mc').innerHTML='<div class="mover"><div class="modal'+(wide?' wide':'')+'">'+inner+'</div></div>';}
function cm(){document.getElementById('mc').innerHTML='';_selCol='purple';_dragIdx=null;}

/* 이벤트 모달 */
var _evModalType='event'; // 'event' | 'work'
function showEM(ex, exWt){
  // ex = 기존 이벤트, exWt = 기존 작업
  var ie=!!(ex||exWt);
  var initType = exWt ? 'work' : 'event';
  _evModalType = initType;
  _selCol = ex ? (ex.colorId||'purple') : 'purple';

  var curProjId = ex ? ex.projectId : (exWt ? exWt.projectId : null);
  var curSiteId=null;
  if(curProjId){var _pr=S.projects.find(function(p){return p.id===curProjId;});if(_pr)curSiteId=_pr.siteId;}
  var eso=_sitesWithProjects().map(function(s){return '<option value="'+s.id+'"'+(s.id===curSiteId?' selected':'')+'>'+s.name+'</option>';}).join('');
  var sw=EVC.map(function(c){return '<div class="csw'+(c.id===_selCol?' sel':'')+'" style="background:'+c.bg+'" data-cid="'+c.id+'" id="sw_'+c.id+'"></div>';}).join('');

  var todayStr=TODAY.getFullYear()+'-'+String(TODAY.getMonth()+1).padStart(2,'0')+'-'+String(TODAY.getDate()).padStart(2,'0');

  var html='<div class="mtit">'+(ie?'이벤트 / 작업 수정':'이벤트 / 작업 등록')+'</div>';
  // 유형 탭
  html+='<div class="ev-type-sel">'
    +'<button class="ev-type-btn'+(initType==='event'?' on':'')+'" id="evtab_event" onclick="switchEvTab(\'event\')">★ 주요 이벤트</button>'
    +'<button class="ev-type-btn'+(initType==='work'?' on':'')+'" id="evtab_work" onclick="switchEvTab(\'work\')">▣ 작업</button>'
    +'</div>';
  html+='<div class="fg"><label class="fl">사이트</label><select id="fe_site">'+eso+'</select></div>';
  html+='<div class="fg"><label class="fl">프로젝트</label><select id="fe_proj"></select></div>';

  // ── 주요 이벤트 섹션
  html+='<div id="fe_event_sec" style="display:'+(initType==='event'?'block':'none')+'">';
  html+='<div class="fg"><label class="fl">날짜</label><input type="date" id="fe_date" value="'+(ex?ex.date:todayStr)+'"></div>';
  html+='<div class="fg"><label class="fl">이벤트 제목</label><input type="text" id="fe_title" value="'+(ex?ex.title:'')+'" placeholder="예: 양산시작, 고객 방문"></div>';
  html+='<div class="fg"><label class="fl">색상</label><div class="crow">'+sw+'</div></div>';
  html+='</div>';

  // ── 작업 섹션
  var wt=exWt||{};
  var wtDays=exWt?dd(wt.start,wt.end)+' 일':'-';
  var wtDateInfo=exWt?(fmtFull(wt.start)+' → '+fmtFull(wt.end)):'';
  html+='<div id="fe_work_sec" style="display:'+(initType==='work'?'block':'none')+'">';
  html+='<div class="fg"><label class="fl">작업 제목</label><input type="text" id="fw_title" value="'+(exWt?wt.title:'')+'" placeholder="예: 비전 파라미터 최적화, 알람 점검"></div>';
  html+='<div class="fg"><label class="fl">그룹(라인)</label><input type="text" id="fw_group" value="'+(exWt?(wt.group||''):'')+'" placeholder="예: #5 — 같은 그룹은 같은 줄에 이어서 표시"></div>';
  html+='<div class="fr">'
    +'<div class="fg"><label class="fl">시작일 (YYYY-MM-DD)</label><input type="text" id="fw_start" value="'+(exWt?wt.start:todayStr)+'" maxlength="10" oninput="fmtDateInput(this);calcWD()" style="font-family:monospace;letter-spacing:1px"></div>'
    +'<div class="fg"><label class="fl">종료일 (YYYY-MM-DD)</label><input type="text" id="fw_end" value="'+(exWt?wt.end:todayStr)+'" maxlength="10" oninput="fmtDateInput(this);calcWD()" style="font-family:monospace;letter-spacing:1px"></div>'
    +'</div>';
  html+='<div class="dbox"><span id="fw_datebox" style="color:#ccc">'+wtDateInfo+'</span>'+(wtDateInfo?' &nbsp; ':'')+'기간: <span id="fw_days" style="font-weight:500">'+wtDays+'</span></div>';
  html+='<div class="fg"><label class="fl">담당자 / 비고</label><input type="text" id="fw_note" value="'+(exWt?wt.note:'')+'" placeholder="예: 김성민, 전 라인 점검"></div>';
  // 작업 색상
  var sw2=EVC.map(function(c){return '<div class="csw'+(c.id===(exWt?wt.colorId||'blue':'blue')?' sel':'')+'" style="background:'+c.bg+'" data-cid="'+c.id+'" id="sww_'+c.id+'"></div>';}).join('');
  html+='<div class="fg"><label class="fl">색상</label><div class="crow" id="fw_colors">'+sw2+'</div></div>';
  html+='</div>';

  html+='<div class="mfoot">';
  if(ie) html+='<button class="btn red sm" id="fe_del">삭제</button>';
  html+='<button class="btn sm" id="fe_cancel">취소</button>';
  html+='<button class="btn sm pri" id="fe_save">'+(ie?'수정 완료':'등록')+'</button>';
  html+='</div>';
  mw(html);
  document.getElementById('fe_site').onchange=function(){_populateProjSelect('fe_site','fe_proj');};
  _populateProjSelect('fe_site','fe_proj',curProjId);

  // 이벤트 탭 버튼
  document.querySelectorAll('.csw').forEach(function(btn){
    btn.addEventListener('click',function(){selC(this.getAttribute('data-cid'));});
  });
  document.querySelectorAll('#fw_colors .csw').forEach(function(btn){
    btn.addEventListener('click',function(){selCW(this.getAttribute('data-cid'));});
  });
  document.getElementById('fe_cancel').onclick=function(){cm();};
  document.getElementById('fe_save').onclick=function(){
    if(_evModalType==='event') saveEv(ex?ex.id:null);
    else saveWt(exWt?exWt.id:null);
  };
  if(ie){
    document.getElementById('fe_del').onclick=function(){
      if(_evModalType==='event'&&ex) delEv(ex.id);
      else if(exWt) delWt(exWt.id);
    };
  }
  if(initType==='work') calcWD();
}
function switchEvTab(t){
  _evModalType=t;
  document.getElementById('evtab_event').className='ev-type-btn'+(t==='event'?' on':'');
  document.getElementById('evtab_work').className='ev-type-btn'+(t==='work'?' on':'');
  document.getElementById('fe_event_sec').style.display=t==='event'?'block':'none';
  document.getElementById('fe_work_sec').style.display=t==='work'?'block':'none';
}
function selC(id){
  _selCol=id;
  document.querySelectorAll('.csw').forEach(function(e){
    if(e.id&&e.id.indexOf('sw_')===0) e.classList.toggle('sel',e.id==='sw_'+id);
  });
}
var _selColW='blue';
function selCW(id){
  _selColW=id;
  document.querySelectorAll('#fw_colors .csw').forEach(function(e){e.classList.toggle('sel',e.getAttribute('data-cid')===id);});
}
function calcWD(){
  var s=document.getElementById('fw_start').value;
  var e=document.getElementById('fw_end').value;
  var re=/^\d{4}-\d{2}-\d{2}$/;
  if(s&&e&&re.test(s)&&re.test(e)&&s<=e){
    document.getElementById('fw_days').textContent=dd(s,e)+' 일';
    var db=document.getElementById('fw_datebox');if(db)db.textContent=fmtFull(s)+' → '+fmtFull(e);
  }
}
function saveEv(exId){
  var projId=document.getElementById('fe_proj').value;
  var date=document.getElementById('fe_date').value;
  var title=document.getElementById('fe_title').value.trim();
  if(!projId||!date||!title){alert('모든 항목을 입력하세요.');return;}
  if(exId){
    var i=S.events.findIndex(function(e){return e.id===exId;});
    S.events[i]=_touch({id:exId,projectId:projId,date:date,title:title,colorId:_selCol});
  } else {
    S.events.push(_touch({id:genId('e',S.events),projectId:projId,date:date,title:title,colorId:_selCol}));
  }
  saveData();cm();renderAll();
}
function saveWt(exId){
  var projId=document.getElementById('fe_proj').value;
  var title=document.getElementById('fw_title').value.trim();
  var start=document.getElementById('fw_start').value;
  var end=document.getElementById('fw_end').value;
  var note=document.getElementById('fw_note').value.trim();
  var group=document.getElementById('fw_group').value.trim();
  var dateRe=/^\d{4}-\d{2}-\d{2}$/;
  // 색상: fw_colors 내 sel 찾기
  var selBtn=document.querySelector('#fw_colors .csw.sel');
  var colorId=selBtn?selBtn.getAttribute('data-cid'):'blue';
  if(!projId||!title||!start||!end){alert('모든 항목을 입력하세요.');return;}
  if(!dateRe.test(start)||!dateRe.test(end)){alert('날짜 형식이 올바르지 않아요.\n예: 2026-04-01');return;}
  if(start>end){alert('종료일이 시작일보다 빠릅니다.');return;}
  if(exId){
    var i=S.workTasks.findIndex(function(w){return w.id===exId;});
    S.workTasks[i]=_touch({id:exId,projectId:projId,title:title,start:start,end:end,note:note,colorId:colorId,group:group});
  } else {
    S.workTasks.push(_touch({id:genId('wt',S.workTasks),projectId:projId,title:title,start:start,end:end,note:note,colorId:colorId,group:group}));
  }
  saveData();cm();renderAll();
}
function delEv(id){if(!confirm('이벤트를 삭제할까요?'))return;S.events=S.events.filter(function(e){return e.id!==id;});_markDeleted('events',id);saveData();cm();renderAll();}
function delWt(id){if(!confirm('작업을 삭제할까요?'))return;S.workTasks=S.workTasks.filter(function(w){return w.id!==id;});_markDeleted('workTasks',id);saveData();cm();renderAll();}
function openEditWt(id){var w=S.workTasks.find(function(x){return x.id===id;});if(w)showEM(null,w);}

/* 출장 모달 */
function showSM(ex){
  var ie=!!ex;
  var so=_sitesWithProjects().map(function(s){return '<option value="'+s.id+'">'+s.name+'</option>';}).join('');
  var po='<option value="">사이트를 먼저 선택하세요</option>';
  if(ie){var pr=S.projects.find(function(p){return p.id===ex.projectId;});if(pr)po=S.projects.filter(function(p){return p.siteId===pr.siteId;}).map(function(p){return '<option value="'+p.id+'"'+(p.id===ex.projectId?' selected':'')+'>'+p.name+'</option>';}).join('');}
  var curType=ie?(ex.type||'hq'):'hq';
  var typeOpts=[['hq','본사'],['outsource','외주'],['localOutsource','현지외주'],['tech','기술'],['vision','비전'],['host','호스트']].map(function(t){return '<option value="'+t[0]+'"'+(curType===t[0]?' selected':'')+'>'+t[1]+'</option>';}).join('');
  var days=ie?dd(ex.start,ex.end)+' 일':'-';
  var dateInfo=ie?(fmtFull(ex.start)+' → '+fmtFull(ex.end)):'';
  var isHidden=ie&&ex.hidden?true:false;
  var isDomestic=ie&&ex.domestic?true:false;
  var html='<div class="mtit">'+(ie?'출장 일정 수정':'출장 일정 등록')+'</div>';
  html+='<div class="fg"><label class="fl">사이트</label><select id="f_site">'+so+'</select></div>';
  html+='<div class="fg"><label class="fl">국내 여부</label><label class="chkrow" style="margin:0"><input type="checkbox" id="f_domestic"'+(isDomestic?' checked':'')+'>국내 출장 (현장이 아닌 국내에서 진행)</label><span id="f_dom_warn" style="display:none;font-size:10px;color:#d08020;margin-left:6px">⚠ 해외 사이트 — 출장일이 국내로 집계됩니다</span></div>';
  html+='<div class="fg"><label class="fl">프로젝트</label><select id="f_proj">'+po+'</select></div>';
  html+='<div class="fg"><label class="fl">업무 유형</label><input type="text" id="f_task" value="'+(ie?ex.task:'')+'" placeholder="예: 셋업, 대응, 개조"></div>';
  html+='<div class="fg"><label class="fl">출장자 이름</label><input type="text" id="f_name" value="'+(ie?ex.name:'')+'" placeholder="이름 입력"></div>';
  html+='<div class="fg"><label class="fl">인원 구분</label><select id="f_type">'+typeOpts+'</select></div>';
  html+='<div class="fr"><div class="fg"><label class="fl">출발일 (YYYY-MM-DD)</label><input type="text" id="f_start" value="'+(ie?ex.start:'2026-03-01')+'" placeholder="2026-04-01" maxlength="10" oninput="fmtDateInput(this);calcD()" style="font-family:monospace;letter-spacing:1px"></div><div class="fg"><label class="fl">복귀일 (YYYY-MM-DD)</label><input type="text" id="f_end" value="'+(ie?ex.end:'2026-03-30')+'" placeholder="2026-06-30" maxlength="10" oninput="fmtDateInput(this);calcD()" style="font-family:monospace;letter-spacing:1px"></div></div>';
  html+='<div class="dbox"><span id="f_datebox" style="color:#ccc">'+dateInfo+'</span>'+(dateInfo?' &nbsp; ':'')+'체류: <span id="f_days" style="font-weight:500">'+days+'</span></div>';
  if(ie){
    var exts=ex.extensions||[];
    html+='<div class="fg" style="border-top:1px solid var(--bd-light);padding-top:8px;margin-top:2px">';
    html+='<label class="fl">현장 연장</label>';
    if(exts.length){
      html+='<div style="font-size:11px;color:var(--tx-muted);margin-bottom:4px">최초 계획 복귀일: '+fmtFull(ex.origEnd||ex.end)+'</div>';
      exts.forEach(function(e){
        if(_editExtSeq===e.seq){
          html+='<div style="display:flex;gap:5px;margin-bottom:4px;align-items:center">'
            +'<span style="font-size:12px;flex-shrink:0">'+e.seq+'차 연장</span>'
            +'<input type="text" id="f_extEditEnd_'+e.seq+'" value="'+e.end+'" maxlength="10" oninput="fmtDateInput(this)" style="font-family:monospace;width:110px">'
            +'<input type="text" id="f_extEditNote_'+e.seq+'" value="'+_esc(e.note||'')+'" placeholder="사유(선택)" style="flex:1">'
            +'<button class="btn sm pri" type="button" onclick="saveEditExtension(\''+ex.id+'\','+e.seq+')">저장</button>'
            +'<button class="btn sm" type="button" onclick="cancelEditExtension(\''+ex.id+'\')">취소</button>'
            +'</div>';
        } else {
          html+='<div style="display:flex;gap:6px;align-items:center;margin-bottom:2px">'
            +'<span style="font-size:12px;flex:1">'+e.seq+'차 연장 → <b>'+fmtFull(e.end)+'</b>'+(e.note?' · '+_esc(e.note):'')+'</span>'
            +'<button class="btn sm" type="button" onclick="startEditExtension(\''+ex.id+'\','+e.seq+')">수정</button>'
            +'<button class="btn sm red" type="button" onclick="deleteExtension(\''+ex.id+'\','+e.seq+')">삭제</button>'
            +'</div>';
        }
      });
    }
    if(exts.length<2&&_editExtSeq===null){
      html+='<div style="display:flex;gap:5px;margin-top:6px">'
        +'<input type="text" id="f_extEnd" placeholder="연장 복귀일" maxlength="10" oninput="fmtDateInput(this)" style="font-family:monospace;width:110px">'
        +'<input type="text" id="f_extNote" placeholder="사유(선택)" style="flex:1">'
        +'<button class="btn sm" id="f_extAdd" type="button">'+(exts.length+1)+'차 연장 등록</button>'
        +'</div>';
    } else if(exts.length>=2){
      html+='<div style="font-size:11px;color:var(--tx-muted)">최대 연장 횟수(2회)에 도달했습니다.</div>';
    }
    html+='</div>';
  }
  html+='<div class="fg"><label class="fl">메모 / 비고</label><input type="text" id="f_note" value="'+(ie?ex.note:'')+'" placeholder="주의사항 등"></div>';
  html+='<label class="chkrow"><input type="checkbox" id="f_hidden"'+(isHidden?' checked':'')+'>간트차트에서 숨기기</label>';
  html+='<div class="mfoot">';
  if(ie) html+='<button class="btn red sm" id="f_del">삭제</button>';
  html+='<button class="btn sm" id="f_cancel">취소</button>';
  html+='<button class="btn sm pri" id="f_save">'+(ie?'수정 완료':'등록')+'</button>';
  html+='</div>';
  mw(html);
  // 이벤트 등록
  function _updDomWarn(){var sid=document.getElementById('f_site').value;var reg=getSiteRegion(sid);var domCb=document.getElementById('f_domestic');var warn=document.getElementById('f_dom_warn');if(warn)warn.style.display=(domCb&&domCb.checked&&reg!=='국내'&&reg!=='기타')?'inline':'none';}
  document.getElementById('f_site').onchange=function(){upP();var sid=this.value;var reg=getSiteRegion(sid);var domCb=document.getElementById('f_domestic');if(domCb&&reg!=='국내'&&reg!=='기타'){domCb.checked=false;}_updDomWarn();};
  document.getElementById('f_domestic').onchange=function(){_updDomWarn();};
  document.getElementById('f_start').onchange=function(){calcD();};
  document.getElementById('f_end').onchange=function(){calcD();};
  document.getElementById('f_cancel').onclick=function(){cm();};
  document.getElementById('f_save').onclick=function(){saveSc(ie?ex.id:null);};
  if(ie){
    document.getElementById('f_del').onclick=function(){delSc(ex.id);};
    var extBtn=document.getElementById('f_extAdd');
    if(extBtn) extBtn.onclick=function(){addExtension(ex.id);};
    var pr2=S.projects.find(function(p){return p.id===ex.projectId;});
    if(pr2) document.getElementById('f_site').value=pr2.siteId;
    upP();
    setTimeout(function(){
      document.getElementById('f_proj').value=ex.projectId;
      calcD(); // 수정 모드에서 초기 날짜 표시
      _updDomWarn(); // 해외 사이트 + 국내 체크 시 경고 표시
    },0);
  } else {
    upP();
    calcD(); // 신규 등록 모드 초기 날짜 표시
  }
}
/* 사이트/프로젝트 select 공용 정렬(가나다순) + 프로젝트 목록 갱신 */
function _sortedSites(){return S.sites.slice().sort(function(a,b){return a.name.localeCompare(b.name,'ko');});}
function _sitesWithProjects(){return _sortedSites().filter(function(s){return S.projects.some(function(p){return p.siteId===s.id;});});}
function _populateProjSelect(siteSelId,projSelId,curProjId){
  var sid=document.getElementById(siteSelId).value;
  var ps=S.projects.filter(function(p){return p.siteId===sid;}).sort(function(a,b){return a.name.localeCompare(b.name,'ko');});
  document.getElementById(projSelId).innerHTML=ps.length?ps.map(function(p){return '<option value="'+p.id+'"'+(curProjId&&p.id===curProjId?' selected':'')+'>'+p.name+'</option>';}).join(''):'<option value="">해당 사이트에 프로젝트 없음</option>';
}
function upP(){_populateProjSelect('f_site','f_proj');}
function fmtDateInput(el){
  // 숫자만 남기고 자동으로 - 삽입: 20260401 → 2026-04-01
  var v=el.value.replace(/[^0-9]/g,'');
  if(v.length>4) v=v.slice(0,4)+'-'+v.slice(4);
  if(v.length>7) v=v.slice(0,7)+'-'+v.slice(7);
  el.value=v.slice(0,10);
}
function calcD(){
  var s=document.getElementById('f_start').value;
  var e=document.getElementById('f_end').value;
  var re=/^\d{4}-\d{2}-\d{2}$/;
  var fs=document.getElementById('f_start');
  var fe=document.getElementById('f_end');
  if(fs) fs.style.borderColor=(!s||re.test(s))?'#3a3a44':'#b52020';
  if(fe) fe.style.borderColor=(!e||re.test(e))?'#3a3a44':'#b52020';
  if(s&&e&&re.test(s)&&re.test(e)){
    if(s<=e){
      document.getElementById('f_days').textContent=dd(s,e)+' 일';
      var db=document.getElementById('f_datebox');
      if(db)db.textContent=fmtFull(s)+' → '+fmtFull(e);
      if(fe) fe.style.borderColor='#3a3a44';
    } else {
      if(fe) fe.style.borderColor='#b52020';
      document.getElementById('f_days').textContent='날짜 오류';
    }
  }
}
function saveSc(exId){
  var projId=document.getElementById('f_proj').value;
  var task=document.getElementById('f_task').value.trim();
  var name=document.getElementById('f_name').value.trim();
  var type=document.getElementById('f_type').value;
  var start=document.getElementById('f_start').value;
  var end=document.getElementById('f_end').value;
  var note=document.getElementById('f_note').value.trim();
  var hidden=document.getElementById('f_hidden').checked;
  var domestic=document.getElementById('f_domestic').checked;
  var dateRe=/^\d{4}-\d{2}-\d{2}$/;
  if(!projId||!task||!name||!start||!end){alert('필수 항목을 모두 입력하세요.');return;}
  if(!dateRe.test(start)||!dateRe.test(end)){alert('날짜 형식이 올바르지 않아요.\n예: 2026-04-01');return;}
  if(start>end){alert('복귀일이 출발일보다 빠릅니다.');return;}
  if(exId){
    var i=S.schedules.findIndex(function(s){return s.id===exId;});
    var prev=S.schedules[i];
    S.schedules[i]=_touch({id:exId,projectId:projId,task:task,name:name,type:type,start:start,end:end,note:note,hidden:hidden,domestic:domestic,extensions:prev.extensions,origEnd:prev.origEnd});
  } else {
    S.schedules.push(_touch({id:genId('s',S.schedules),projectId:projId,task:task,name:name,type:type,start:start,end:end,note:note,hidden:hidden,domestic:domestic}));
  }
  saveData();cm();renderAll();
}
function delSc(id){if(!confirm('이 출장 일정을 삭제할까요?'))return;S.schedules=S.schedules.filter(function(s){return s.id!==id;});_markDeletedSc(id);saveData();cm();renderAll();}

// 현장 연장 등록 (최대 2회) — 최초 계획 복귀일(origEnd)은 보존하고, 실제 복귀일(end)만 갱신
function addExtension(scheduleId){
  var endInp=document.getElementById('f_extEnd');
  var noteInp=document.getElementById('f_extNote');
  if(!endInp) return;
  var newEnd=endInp.value.trim();
  var note=noteInp?noteInp.value.trim():'';
  var dateRe=/^\d{4}-\d{2}-\d{2}$/;
  if(!dateRe.test(newEnd)){alert('연장 복귀일 형식이 올바르지 않아요.\n예: 2026-04-15');return;}
  var sc=S.schedules.find(function(s){return s.id===scheduleId;});
  if(!sc) return;
  if(newEnd<=sc.end){alert('연장 복귀일은 현재 복귀일('+sc.end+')보다 이후여야 합니다.');return;}
  if(!sc.extensions) sc.extensions=[];
  if(sc.extensions.length>=2){alert('최대 2회까지만 연장할 수 있습니다.');return;}
  if(sc.origEnd===undefined) sc.origEnd=sc.end;
  sc.extensions.push({seq:sc.extensions.length+1,end:newEnd,note:note});
  sc.end=newEnd;
  _touch(sc);
  saveData();
  showSM(sc);
  renderAll();
}
function startEditExtension(scheduleId,seq){
  _editExtSeq=seq;
  var sc=S.schedules.find(function(s){return s.id===scheduleId;});
  if(sc) showSM(sc);
}
function cancelEditExtension(scheduleId){
  _editExtSeq=null;
  var sc=S.schedules.find(function(s){return s.id===scheduleId;});
  if(sc) showSM(sc);
}
function saveEditExtension(scheduleId,seq){
  var endInp=document.getElementById('f_extEditEnd_'+seq);
  var noteInp=document.getElementById('f_extEditNote_'+seq);
  if(!endInp) return;
  var newEnd=endInp.value.trim();
  var note=noteInp?noteInp.value.trim():'';
  var dateRe=/^\d{4}-\d{2}-\d{2}$/;
  if(!dateRe.test(newEnd)){alert('연장 복귀일 형식이 올바르지 않아요.\n예: 2026-04-15');return;}
  var sc=S.schedules.find(function(s){return s.id===scheduleId;});
  if(!sc||!sc.extensions) return;
  var idx=sc.extensions.findIndex(function(e){return e.seq===seq;});
  if(idx<0) return;
  var prevEnd=idx===0?(sc.origEnd||sc.end):sc.extensions[idx-1].end;
  var nextExt=sc.extensions[idx+1];
  if(newEnd<=prevEnd){alert('연장 복귀일은 이전 단계 복귀일('+prevEnd+')보다 이후여야 합니다.');return;}
  if(nextExt&&newEnd>=nextExt.end){alert('연장 복귀일은 다음 연장 복귀일('+nextExt.end+')보다 이전이어야 합니다.');return;}
  sc.extensions[idx].end=newEnd;
  sc.extensions[idx].note=note;
  if(idx===sc.extensions.length-1) sc.end=newEnd; // 마지막 연장이면 실제 복귀일도 갱신
  _touch(sc);
  saveData();
  _editExtSeq=null;
  showSM(sc);
  renderAll();
}
function deleteExtension(scheduleId,seq){
  if(!confirm(seq+'차 연장 기록을 삭제할까요?\n이후 회차가 있다면 번호가 당겨집니다.'))return;
  var sc=S.schedules.find(function(s){return s.id===scheduleId;});
  if(!sc||!sc.extensions) return;
  sc.extensions=sc.extensions.filter(function(e){return e.seq!==seq;});
  sc.extensions.forEach(function(e,i){e.seq=i+1;});
  if(sc.extensions.length){
    sc.end=sc.extensions[sc.extensions.length-1].end;
  } else {
    sc.end=sc.origEnd;
    delete sc.origEnd;
  }
  _touch(sc);
  saveData();
  _editExtSeq=null;
  showSM(sc);
  renderAll();
}

/* ── 사이트 관리 모달 (좌우 분할) ── */
function showSiteM(){
  mw('<div class="mtit">사이트 / 프로젝트 관리</div>'
    +'<div class="sitemgr">'
    +'<div class="sitemgr-l">'
    +'<div class="smtit">그룹 관리 (간트차트 고객사 분류)</div><div id="grpListRows"></div>'
    +'<div style="display:flex;gap:5px;margin:6px 0 12px"><input type="text" id="ns_grp" placeholder="그룹명" style="flex:1"><button class="btn sm pri" onclick="addGroup()">추가</button></div>'
    +'<div class="smtit">그룹 & 사이트</div><div id="grpSiteRows"></div>'
    +'<div style="margin-top:10px;padding-top:8px;border-top:1px solid #2a2a34">'
    +'<div style="font-size:10px;color:#666;margin-bottom:5px">새 사이트 추가</div>'
    +'<div style="display:flex;gap:5px;margin-bottom:4px"><input type="text" id="ns_n" placeholder="사이트명" style="flex:1"><input type="color" id="ns_c" value="#1558a0" style="width:30px;padding:1px;border:1px solid #3a3a44;border-radius:4px;background:#1e1e26"></div>'
    +'<div style="display:flex;gap:5px"><select id="ns_grpsel" style="flex:1">'+S.groups.map(function(g){return '<option value="'+g.id+'">'+g.name+'</option>';}).join('')+'</select><button class="btn sm pri" onclick="addSite()">추가</button></div>'
    +'</div></div>'
    +'<div class="sitemgr-r"><div class="smtit">프로젝트</div><div id="projRows"></div></div>'
    +'</div>'
    +'<div class="mfoot"><button class="btn sm" onclick="cm()">닫기</button></div>',true);
  buildGrpListRows();buildGrpSiteRows();buildProjRows();
}

function buildGrpListRows(){
  var el=document.getElementById('grpListRows');if(!el)return;el.innerHTML='';
  if(!S.groups.length){
    var empty=document.createElement('div');
    empty.style.cssText='font-size:10px;color:#555;padding:2px 8px 4px';
    empty.textContent='(그룹 없음)';
    el.appendChild(empty);
    return;
  }
  S.groups.forEach(function(g){
    var row=document.createElement('div');row.className='mrow';
    var ni=document.createElement('input');ni.type='text';ni.value=g.name;
    ni.style.cssText='flex:1;min-width:80px;font-size:11px';
    ni.onchange=(function(gid){return function(){updGN(gid,this.value);};})(g.id);
    var btnD=document.createElement('button');btnD.className='btn sm red';btnD.textContent='삭제';
    btnD.onclick=(function(gid){return function(){delGroup(gid);};})(g.id);
    [ni,btnD].forEach(function(el2){row.appendChild(el2);});
    el.appendChild(row);
  });
}

// 국가/세부지역이 분리되기 전 데이터 이전: country가 없고 region만 있던 사이트는
// 그 region 값이 사실 "국가"였으므로 country로 옮기고 region은 비움 (한 번만 실행되면 됨)
function _migrateSiteCountry(){
  var changed=false;
  S.sites.forEach(function(s){
    if(!s.country&&s.region){ s.country=s.region; s.region=''; _touch(s); changed=true; }
  });
  if(changed) saveData();
}

function buildGrpSiteRows(){
  _migrateSiteCountry();
  var el=document.getElementById('grpSiteRows');if(!el)return;el.innerHTML='';
  var COUNTRY_SECTIONS=BASE_REGIONS.map(function(r){return {key:r,label:r};});
  var countryOpts=getAllRegionOptions();

  COUNTRY_SECTIONS.forEach(function(sec){
    var secSites=S.sites.filter(function(s){return (s.country||'기타')===sec.key;});

    // 섹션 헤더
    var hdr=document.createElement('div');
    hdr.className='sm-country-hdr';
    hdr.textContent=sec.label;
    el.appendChild(hdr);

    if(!secSites.length){
      var empty=document.createElement('div');
      empty.style.cssText='font-size:10px;color:#555;padding:2px 8px 4px';
      empty.textContent='(사이트 없음)';
      el.appendChild(empty);
      return;
    }

    secSites.forEach(function(site){
      var row=document.createElement('div');row.className='mrow';row.style.paddingLeft='8px';
      var ic=document.createElement('input');ic.type='color';ic.value=site.color;
      ic.style.cssText='width:22px;height:22px;padding:0;border:none;background:none;cursor:pointer;flex-shrink:0';
      ic.onchange=(function(sid){return function(){updSC(sid,this.value);};})(site.id);
      var iname=document.createElement('input');iname.type='text';iname.value=site.name;
      iname.style.cssText='flex:1;min-width:60px;font-size:11px';
      iname.onchange=(function(sid){return function(){updSN(sid,this.value);};})(site.id);
      // 간트 그룹 선택 (고객사별 간트차트 왼쪽 패널 분류)
      var gsel=document.createElement('select');
      gsel.title='간트차트 고객사 그룹';
      gsel.style.cssText='font-size:10px;padding:2px 3px;width:100px;color:#ccc';
      S.groups.forEach(function(g){var o=document.createElement('option');o.value=g.id;o.textContent=g.name;if((site.groupId||'_none')===g.id)o.selected=true;gsel.appendChild(o);});
      gsel.onchange=(function(sid){return function(){moveSiteGroup(sid,this.value);};})(site.id);

      // 국가 선택
      var csel=document.createElement('select');
      csel.title='출장 국가';
      csel.style.cssText='font-size:10px;padding:2px 3px;width:80px;color:#ccc';
      countryOpts.forEach(function(c){var o=document.createElement('option');o.value=c;o.textContent=c;if((site.country||'기타')===c)o.selected=true;csel.appendChild(o);});
      var cNewOpt=document.createElement('option');cNewOpt.value='__new__';cNewOpt.textContent='+ 직접 입력...';csel.appendChild(cNewOpt);
      csel.onchange=(function(sid){return function(){
        if(this.value==='__new__'){
          var name=prompt('새 국가명을 입력하세요');
          name=name?name.trim():'';
          if(!name){buildGrpSiteRows();return;}
          updSiteCountry(sid,name);
        } else {
          updSiteCountry(sid,this.value);
        }
        buildGrpSiteRows();
      };})(site.id);

      // 세부 지역 선택 — 위에서 고른 국가에 등록된 지역 목록만 표시 (국가별로 옵션이 바뀜)
      var rsel=document.createElement('select');
      rsel.title='세부 지역(도시)';
      rsel.style.cssText='font-size:10px;padding:2px 3px;width:100px;color:#ccc';
      var curCountry=site.country||'기타';
      var cityOpts=getRegionOptionsForCountry(curCountry);
      var blankOpt=document.createElement('option');blankOpt.value='';blankOpt.textContent='(선택 안 함)';
      if(!site.region) blankOpt.selected=true;
      rsel.appendChild(blankOpt);
      cityOpts.forEach(function(r){var o=document.createElement('option');o.value=r;o.textContent=r;if(site.region===r)o.selected=true;rsel.appendChild(o);});
      var rNewOpt=document.createElement('option');rNewOpt.value='__new__';rNewOpt.textContent='+ 직접 입력...';rsel.appendChild(rNewOpt);
      rsel.onchange=(function(sid){return function(){
        if(this.value==='__new__'){
          var name=prompt('새 세부 지역명을 입력하세요 (예: 하노이)');
          name=name?name.trim():'';
          if(!name){buildGrpSiteRows();return;}
          updSiteRegion(sid,name);
        } else {
          updSiteRegion(sid,this.value);
        }
        buildGrpSiteRows();
      };})(site.id);

      var btnP=document.createElement('button');btnP.className='btn sm';btnP.textContent='PJT+';
      btnP.onclick=(function(sid){return function(){addP(sid);};})(site.id);
      var btnD=document.createElement('button');btnD.className='btn sm red';btnD.textContent='삭제';
      btnD.onclick=(function(sid){return function(){delSite(sid);};})(site.id);
      [ic,iname,gsel,csel,rsel,btnP,btnD].forEach(function(el2){row.appendChild(el2);});
      el.appendChild(row);
    });
  });
}

function buildProjRows(){
  var el=document.getElementById('projRows');if(!el)return;el.innerHTML='';
  S.projects.forEach(function(p){
    var si=S.sites.find(function(s){return s.id===p.siteId;});
    var row=document.createElement('div');row.className='mrow';
    var chip=document.createElement('span');chip.className='grp-chip';
    chip.style.cssText='background:'+(si?si.color:'#555')+';color:#fff';chip.textContent=si?si.name:p.siteId;
    var ni=document.createElement('input');ni.type='text';ni.value=p.name;
    ni.style.cssText='flex:1;min-width:80px;font-size:11px';
    ni.onchange=(function(pid){return function(){updPN(pid,this.value);};})(p.id);
    var btnD=document.createElement('button');btnD.className='btn sm red';btnD.textContent='삭제';
    btnD.onclick=(function(pid){return function(){delPjt(pid);};})(p.id);
    [chip,ni,btnD].forEach(function(el2){row.appendChild(el2);});
    el.appendChild(row);
  });
}

/* 그룹 CRUD */
function addGroup(){
  var name=document.getElementById('ns_grp').value.trim();if(!name){alert('그룹명을 입력하세요.');return;}
  S.groups.push(_touch({id:genId('g',S.groups),name:name}));
  saveData();showSiteM();renderAll();
}
function delGroup(id){
  if(!confirm('그룹을 삭제하면 소속 사이트가 미분류됩니다. 계속할까요?'))return;
  S.sites.forEach(function(s){if(s.groupId===id){s.groupId='_none';_touch(s);}});
  S.groups=S.groups.filter(function(g){return g.id!==id;});
  _markDeleted('groups',id);
  saveData();showSiteM();renderAll();
}
function updGN(id,v){var g=S.groups.find(function(g){return g.id===id;});if(g){g.name=v.trim();_touch(g);saveData();renderSidebar();buildGrpSiteRows();}}
function moveSiteGroup(sid,gid){var s=S.sites.find(function(s){return s.id===sid;});if(s){s.groupId=gid;_touch(s);saveData();buildGrpSiteRows();renderSidebar();renderGantt();}}

/* 사이트 CRUD */
function updSN(id,v){var s=S.sites.find(function(s){return s.id===id;});if(s){s.name=v.trim();_touch(s);saveData();renderSidebar();renderGantt();}}
function updSC(id,v){var s=S.sites.find(function(s){return s.id===id;});if(s){s.color=v;_touch(s);saveData();renderSidebar();renderGantt();}}
function updSiteRegion(id,v){var s=S.sites.find(function(s){return s.id===id;});if(s){s.region=v;_touch(s);saveData();}}
function updSiteCountry(id,v){var s=S.sites.find(function(s){return s.id===id;});if(s&&s.country!==v){s.country=v;s.region='';_touch(s);saveData();}}
function addSite(){
  var name=document.getElementById('ns_n').value.trim(),color=document.getElementById('ns_c').value;
  var gid=document.getElementById('ns_grpsel').value;
  if(!name){alert('사이트 이름을 입력하세요.');return;}
  var baseId=name.replace(/[^a-zA-Z0-9가-힣]/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,'')||'site';
  var newId=baseId,n=2;while(S.sites.find(function(s){return s.id===newId;}))newId=baseId+'_'+n++;
  S.sites.push(_touch({id:newId,name:name,color:color,groupId:gid}));
  saveData();showSiteM();renderAll();
}
function delSite(id){
  if(!confirm('사이트와 관련 항목을 모두 삭제합니까?'))return;
  var pids=S.projects.filter(function(p){return p.siteId===id;}).map(function(p){return p.id;});
  // 연쇄 삭제 대상 전부 tombstone 마킹 (다른 PC에서 부활 방지)
  pids.forEach(function(pid){_markDeleted('projects',pid);});
  S.schedules.forEach(function(s){if(pids.indexOf(s.projectId)>=0)_markDeleted('schedules',s.id);});
  S.events.forEach(function(e){if(pids.indexOf(e.projectId)>=0)_markDeleted('events',e.id);});
  (S.equipProjects||[]).forEach(function(p){if(p.siteId===id)_markDeleted('equipProjects',p.id);});
  (S.equipUnits||[]).forEach(function(u){if(u.siteId===id)_markDeleted('equipUnits',u.id);});
  _markDeleted('sites',id);
  S.projects=S.projects.filter(function(p){return p.siteId!==id;});
  S.schedules=S.schedules.filter(function(s){return pids.indexOf(s.projectId)<0;});
  S.events=S.events.filter(function(e){return pids.indexOf(e.projectId)<0;});
  S.sites=S.sites.filter(function(s){return s.id!==id;});
  // 설비 데이터도 함께 정리
  S.equipSiteOrder=(S.equipSiteOrder||[]).filter(function(sid){return sid!==id;});
  S.equipProjects=(S.equipProjects||[]).filter(function(p){return p.siteId!==id;});
  S.equipUnits=(S.equipUnits||[]).filter(function(u){return u.siteId!==id;});
  saveData();showSiteM();renderAll();
}

/* 프로젝트 CRUD */
function updPN(id,v){var p=S.projects.find(function(p){return p.id===id;});if(p){p.name=v.trim();_touch(p);saveData();renderGantt();}}
function addP(sid){
  var name=prompt('새 프로젝트 이름:');if(!name)return;
  var baseId=name.replace(/[^a-zA-Z0-9가-힣]/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,'')||'pjt';
  var newId=baseId,n=2;while(S.projects.find(function(p){return p.id===newId;}))newId=baseId+'_'+n++;
  S.projects.push(_touch({id:newId,siteId:sid,name:name}));saveData();showSiteM();renderAll();
}
function delPjt(id){
  if(!confirm('프로젝트와 관련 일정을 모두 삭제합니까?'))return;
  // 연쇄 삭제 대상 tombstone 마킹
  S.schedules.forEach(function(s){if(s.projectId===id)_markDeleted('schedules',s.id);});
  S.events.forEach(function(e){if(e.projectId===id)_markDeleted('events',e.id);});
  _markDeleted('projects',id);
  S.schedules=S.schedules.filter(function(s){return s.projectId!==id;});S.events=S.events.filter(function(e){return e.projectId!==id;});S.projects=S.projects.filter(function(p){return p.id!==id;});
  saveData();showSiteM();renderAll();
}
