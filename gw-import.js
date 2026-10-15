/* ══════════════════════════════════════════
   그룹웨어(전자결재) 해외출장 품의서 → 출장 일정 가져오기 — gw-import.js
   흐름: ① 그룹웨어에 로그인한 브라우저에서 "수집 북마크"를 한 번 클릭 → 2026년 해외출장 품의서에서 필요한 항목만
         읽어 클립보드로 복사(비밀번호/토큰 저장 없음, 본문 전체·금액·첨부는 가져오지 않음)
         ② 이 창에 붙여넣고 "분석" → 현재 등록된 출장 일정(완료 포함)과 문서별로 매칭
         ③ 건별 [반영] 또는 선택/일괄 반영 (확인이 필요한 건은 사이트·프로젝트를 고른 뒤 반영)
   규칙: 결재 "완료" 문서만 반영. 최초 → 변경(연장/축소) → 완료(실제 기간) 순서로 한 출장(그룹)의 최종 기간을 계산.
         반영한 문서번호는 일정의 gwDocs에 기록해 다시 가져와도 중복 등록되지 않는다.
══════════════════════════════════════════ */

/* ── ① 그룹웨어 페이지에서 실행되는 수집기 (북마크로 실행되므로 이 함수 안에서 모든 것이 자족적이어야 한다) ── */
function _gwCollector(){
  (async function(){
    var YEAR='2026';
    function clean(s){ return String(s||'').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim(); }
    var old=document.getElementById('bu2gw'); if(old) old.remove();
    var box=document.createElement('div'); box.id='bu2gw';
    box.style.cssText='position:fixed;z-index:2147483647;top:16px;right:16px;width:440px;background:#fff;color:#111;border:2px solid #1558a0;border-radius:8px;padding:12px 14px;font:13px/1.5 sans-serif;box-shadow:0 4px 20px rgba(0,0,0,.4)';
    document.body.appendChild(box);
    function say(h){ box.innerHTML='<div style="font-weight:700;margin-bottom:6px">BU2 출장 일정 가져오기</div>'+h; }
    // 해외: 구분/기간/도시/국가/고객사/출장자, 국내: 구분/기간/도시/고객사/출장자 (국가는 "한국"으로 채운다)
    function parseTitle(t,dom){
      var re=dom
        ?/^(.*?)\/(\d{4}-\d{2}-\d{2})\([^)]*\)\s*~\s*(\d{4}-\d{2}-\d{2})\([^)]*\)\/([^\/]*)\/([^\/]*)\/(.*)$/
        :/^(.*?)\/(\d{4}-\d{2}-\d{2})\([^)]*\)\s*~\s*(\d{4}-\d{2}-\d{2})\([^)]*\)\/([^\/]*)\/([^\/]*)\/([^\/]*)\/(.*)$/;
      var m=t.match(re);
      if(!m) return {ok:false,domestic:dom};
      var ppl=(dom?m[6]:m[7]).split(/[,，、]/).map(function(s){return s.trim();}).filter(Boolean);
      return {ok:true,domestic:dom,kind:m[1].trim(),start:m[2],end:m[3],city:m[4].trim(),country:dom?'한국':m[5].trim(),customer:(dom?m[5]:m[6]).trim(),people:ppl};
    }
    function pick(txt,label){
      var m=txt.match(new RegExp(label+'\\s*[:：]\\s*([^\\n]*)')); var v=m?m[1]:'';
      v=v.split(/\s(?:고객사|협력사|프로젝트\s*명|출장\s*목적)\s*[:：]/)[0];
      return v.replace(/\s+/g,' ').trim().slice(0,200);
    }
    try{
      say('해외·국내 출장 품의서 목록을 읽는 중...');
      var docs=[], seenId={};
      var FORMS={'해외출장 품의서':false,'국내출장 품의서':true};
      for(var kw of ['해외출장','국내출장']){
        var page=0, hasNext=true;
        while(hasNext&&page<40){
          var j=await fetch('/api/search/approval?stype=simple&type=approval&keyword='+encodeURIComponent(kw)+'&fromDate=&toDate=&page='+page+'&offset=100',{credentials:'same-origin'}).then(function(r){return r.json();});
          var d=j.data; (Array.isArray(d)?d:Object.keys(d).map(function(k){return d[k];})).forEach(function(x){ if(!seenId[x.id]){ seenId[x.id]=1; docs.push(x); } });
          hasNext=!!j.hasNext; page++;
        }
      }
      docs=docs.filter(function(x){
        var f=clean(x.formName);
        return (f in FORMS)&&(String(x.draftedAt).slice(0,4)===YEAR||clean(x.title).indexOf(YEAR+'-')>=0);
      });
      var out=[], idx=0;
      async function worker(){
        while(idx<docs.length){
          var x=docs[idx++], t=clean(x.title), rec=parseTitle(t,FORMS[clean(x.formName)]);
          rec.id=x.id; rec.docNum=x.docNum||''; rec.status=x.docStatus; rec.drafter=x.drafterName; rec.draftedAt=String(x.draftedAt).slice(0,10); rec.titleRaw=t;
          try{
            var dj=await fetch('/api/approval/document/'+x.id,{credentials:'same-origin'}).then(function(r){return r.json();});
            var ddoc=((dj.data||dj).document||{});
            rec.deptId=ddoc.drafterDeptId; rec.dept=ddoc.drafterDeptName||'';
            var tmp=document.createElement('div'); tmp.innerHTML=ddoc.docBodyContent||'';
            tmp.querySelectorAll('style,script').forEach(function(e){e.remove();});
            var txt=tmp.innerText||tmp.textContent||'';
            rec.project=pick(txt,'프로젝트\\s*명'); rec.partner=pick(txt,'협력사'); rec.purpose=pick(txt,'출장\\s*목적');
          }catch(e){ rec.detailErr=1; }
          out.push(rec);
          say('문서 내용을 읽는 중... '+out.length+' / '+docs.length);
        }
      }
      await Promise.all([worker(),worker(),worker(),worker(),worker(),worker()]);
      out.sort(function(a,b){return (a.draftedAt+a.docNum)<(b.draftedAt+b.docNum)?-1:1;});
      // BU2부문 구성원 명단 (기술운영1그룹 + 선행기술1그룹 + 부문장 등):
      //  ① 부서 구성원 목록(권한이 있는 부서)에서 조직 경로에 BU2부문이 있는 사람
      //  ② 그 외 출장자는 이름으로 사용자 검색을 해서 소속 부서가 BU2로 시작하는 사람(BU2부문, BU2_선행기술1그룹 등)
      say('BU2부문 구성원을 확인하는 중...');
      var GROUP='BU2부문', deptIds={303:1,304:1,305:1}, roster=[], seenN={};
      out.forEach(function(r){ if(r.deptId) deptIds[r.deptId]=1; });
      function addMember(name,position,dept){ if(name&&!seenN[name]){ seenN[name]=1; roster.push({name:name,position:position||'',dept:dept||''}); } }
      for(var did in deptIds){
        try{
          var mj=await fetch('/api/department/'+did+'/members?offset=500',{credentials:'same-origin'});
          if(!mj.ok) continue; mj=await mj.json();
          (mj.data||[]).forEach(function(m){ var path=String(m.parentsDeptPath||''); if(path.indexOf('BU2부문')>=0) addMember(m.name,m.positionName,path.split('>').pop().trim()); });
        }catch(e){}
      }
      var names={};
      out.forEach(function(r){ (r.people||[]).forEach(function(p){ var n=p.split(/\s+(?:최초|변경|완료|\d+차\s*변경|출장\s*취소)\s*\//)[0].replace(/\s*방문.*$/,'').replace(/\s*\(.*$/,'').trim(); if(n) names[n]=1; }); });
      var pending=Object.keys(names).filter(function(n){return !seenN[n];}), pi=0;
      async function nameWorker(){
        while(pi<pending.length){
          var n=pending[pi++];
          try{
            var uj=await fetch('/api/user/search?keyword='+encodeURIComponent(n),{credentials:'same-origin'}).then(function(r){return r.json();});
            (uj.data||[]).filter(function(u){return u.name===n;}).forEach(function(u){
              var dep=(u.departments||[]).filter(function(x){return /^BU2/.test(x);})[0];
              if(dep) addMember(n,u.position,dep);
            });
          }catch(e){}
        }
      }
      await Promise.all([nameWorker(),nameWorker(),nameWorker(),nameWorker()]);
      var json=JSON.stringify({src:'bu2-gw',v:3,year:YEAR,group:GROUP,roster:roster,collectedAt:new Date().toISOString(),items:out});
      window.__bu2gwResult=json;
      var copied=false;
      try{ await navigator.clipboard.writeText(json); copied=true; }catch(e){}
      say((copied?'✔ ':'')+out.length+'건을 읽었습니다. '+(copied?'클립보드에 복사했습니다.':'아래 내용을 전체 선택(Ctrl+A)해 복사하세요.')
        +'<br>BU2 앱의 <b>그룹웨어 가져오기</b> 창에 붙여넣기(Ctrl+V) 하세요.'
        +'<textarea id="bu2gwTa" style="width:100%;height:70px;margin-top:8px;font-size:11px"></textarea>'
        +'<div style="text-align:right;margin-top:6px"><button id="bu2gwClose" style="padding:3px 12px">닫기</button></div>');
      var ta=document.getElementById('bu2gwTa'); if(ta){ ta.value=json; if(!copied){ ta.focus(); ta.select(); } }
      var cb=document.getElementById('bu2gwClose'); if(cb) cb.onclick=function(){ box.remove(); };
    }catch(e){
      say('<span style="color:#b00">읽기에 실패했습니다: '+(e&&e.message||e)+'</span><br>그룹웨어에 로그인되어 있는지 확인하세요.'
        +'<div style="text-align:right;margin-top:6px"><button onclick="document.getElementById(\'bu2gw\').remove()">닫기</button></div>');
    }
  })();
}
function _gwBookmarklet(){ return 'javascript:'+encodeURIComponent('('+_gwCollector.toString()+')()'); }

/* ── ② 매칭 ── */
var _gwState={items:[],rows:[],appOnly:[],filter:'all',meta:null};
// 그룹웨어의 직위와 실제 호칭이 다른 경우(사용자 확인) 앱에 등록할 이름에 쓰는 직위
var GW_POS_OVERRIDE={'최정오':'부장'};
var GW_SITE_ALIAS={'zdtha':'zdt','lgait':'lgit','ait':'lgit','아이비텍':'ibtech','신코':'shinko','쿄세라':'kyocera','vitoryglant':'victorygiant','vitorygiant':'victorygiant'};
// 도시 표기가 영문/한글/오타로 섞여 있어(Kulim/쿨림, 썬전/선전 등) 같은 도시로 보이게 맞춘다 — 그룹웨어 제목과 앱 사이트 지역 양쪽에 같이 적용
var GW_CITY_ALIAS={'kulim':'쿨림','nagano':'나가노','niigata':'니가타','leoben':'레오벤','huaian':'후아이안','썬전':'선전','shenzhen':'선전','taoyuan':'타오위안','싱가폴':'싱가포르'};
function _gwCityN(s){ var n=String(s||'').toLowerCase().replace(/[^a-z0-9가-힣]/g,''); return GW_CITY_ALIAS[n]||n; }

function _gwNorm(s){ return String(s||'').toLowerCase().replace(/[^a-z0-9가-힣]/g,''); }
function _gwAliased(s){ var n=_gwNorm(s); return GW_SITE_ALIAS[n]||n; }
function _gwSiteKey(it){ return _gwNorm(it.customer)+'|'+_gwNorm(it.city)+'|'+_gwNorm(it.country); }
function _gwLoadMap(){ try{ return JSON.parse(localStorage.getItem('bu2_gw_sitemap')||'{}'); }catch(e){ return {}; } }
// "무시" 처리한 항목(임원 전시회 출장처럼 앱에서 관리하지 않는 출장) — 이 브라우저에만 기억한다
function _gwLoadIgnored(){ try{ return JSON.parse(localStorage.getItem('bu2_gw_ignored')||'{}'); }catch(e){ return {}; } }
function _gwSetIgnored(key,on){ try{ var m=_gwLoadIgnored(); if(on) m[key]=1; else delete m[key]; localStorage.setItem('bu2_gw_ignored',JSON.stringify(m)); }catch(e){} }
function _gwSaveMap(key,siteId){ try{ var m=_gwLoadMap(); m[key]=siteId; localStorage.setItem('bu2_gw_sitemap',JSON.stringify(m)); }catch(e){} }

// 그룹웨어의 (고객사, 도시, 국가)를 앱 사이트로 매핑. 확실하면 site를 정하고, 아니면 후보만 돌려준다
function _gwMapSite(it){
  var map=_gwLoadMap(), key=_gwSiteKey(it);
  if(map[key]&&S.sites.some(function(s){return s.id===map[key];})) return {siteId:map[key],cands:[],how:'저장된 매핑'};
  var custs=String(it.customer||'').split(/[,，、]/).map(_gwAliased).filter(Boolean);
  custs=custs.filter(function(c,i){return custs.indexOf(c)===i;}); // "LGIT, AIT"처럼 같은 사이트의 다른 표기는 하나로
  var city=_gwCityN(it.city), country=_gwNorm(it.country); if(country==='한국') country='국내';
  var scored=S.sites.map(function(s){
    var sn=_gwNorm(s.name), score=0;
    if(custs.some(function(c){return c&&(sn.indexOf(c)>=0||c.indexOf(sn)>=0);})) score+=3;
    var rg=_gwCityN(s.region);
    if(city&&rg&&(rg===city||(city.length>=3&&(rg.indexOf(city)>=0||city.indexOf(rg)>=0)))) score+=2;
    if(country&&_gwNorm(s.country)===country) score+=1;
    return {site:s,score:score};
  }).filter(function(x){return x.score>0;}).sort(function(a,b){return b.score-a.score;});
  var best=scored[0], second=scored[1];
  if(best&&best.score>=3&&(!second||best.score>second.score)&&custs.length<=1) return {siteId:best.site.id,cands:scored.slice(0,5).map(function(x){return x.site.id;}),how:'자동'};
  return {siteId:'',cands:scored.slice(0,5).map(function(x){return x.site.id;}),how:'확인 필요'};
}

function _gwAppPersonNames(){
  var set={};
  S.schedules.forEach(function(sc){ String(sc.name||'').split(/[,，、]/).map(function(s){return s.trim();}).filter(Boolean).forEach(function(n){set[n]=true;}); });
  return Object.keys(set);
}
// "황의송" → 앱에 등록된 "황의송 대리"
function _gwMatchPerson(name,appNames){
  var hit=appNames.filter(function(n){return n===name||n.indexOf(name+' ')===0;});
  return hit[0]||'';
}
function _gwPersonOf(sc){ return String(sc.name||'').split(/[,，、]/).map(function(s){return s.trim();}).filter(Boolean); }
function _gwSchedSite(sc){ var p=S.projects.find(function(x){return x.id===sc.projectId;}); return p?p.siteId:''; }
function _gwOverlap(a1,a2,b1,b2){ return a1<=b2&&b1<=a2; }
function _gwDays(a,b){ return Math.round((pd(b)-pd(a))/86400000)+1; }
function _gwFmt(a,b){ return a.slice(2).replace(/-/g,'.')+' ~ '+b.slice(2).replace(/-/g,'.'); }

// 제목 끝에 다른 문구가 붙은 경우("정해영 최초/2026-03-16...", "유은상 방문(JRA)")를 이름만 남기고 정리
function _gwCleanPeople(list){
  var out=[];
  list.forEach(function(n){
    n=String(n).split(/\s+(?:최초|변경|완료|\d+차\s*변경|출장\s*취소)\s*\//)[0].replace(/\s*방문.*$/,'').replace(/\s*\(.*$/,'').trim();
    if(n&&out.indexOf(n)<0) out.push(n);
  });
  return out;
}
// 반영하기 전에 사용자가 채워야 하는 항목. 앱에 없는 출장자는 구분(기술/외주 등)을 직접 골라야 한다
// (임원 전시회 출장자 등이 기본값으로 기술 인원에 섞이지 않도록)
function _gwBlockers(r){
  var b=[];
  if(!r.siteId) b.push('사이트 선택');
  if(!r.scId){
    if(!r.project) b.push('프로젝트명');
    if(!r.appName&&!r.type) b.push('출장자 구분');
  }
  return b;
}
function _gwRecls(r){
  if(r.external){ r.cls='external'; r.reason='BU2 기술운영1그룹 아님'; return; }
  if(r.cls==='applied') return;
  var b=_gwBlockers(r);
  r.reason=b.join(', ');
  if(r.scId){ if(r.cls==='update'&&!r.siteId) r.cls='check'; }
  else r.cls=b.length?'check':'new';
}
function _gwAnalyze(json){
  var data;
  try{ data=JSON.parse(json); }catch(e){ throw new Error('붙여넣은 내용을 읽을 수 없습니다. 수집 북마크가 복사한 내용을 그대로 붙여넣어 주세요.'); }
  if(!data||data.src!=='bu2-gw'||!Array.isArray(data.items)) throw new Error('수집 북마크로 만든 데이터가 아닙니다.');
  data.items.forEach(function(it){ if(it.people) it.people=_gwCleanPeople(it.people); });
  // 자동 입력 대상은 BU2_기술운영1그룹 구성원뿐 — 외주/TS본부/임원 등 그 밖의 출장자는 "대상 외"로 분류해 반영하지 않는다(수동 등록은 출장 등록에서)
  var rosterSet=null;
  if(Array.isArray(data.roster)&&data.roster.length){ rosterSet={}; data.roster.forEach(function(m){ rosterSet[m.name]=m; }); }
  var seenDocs={}; try{ seenDocs=JSON.parse(localStorage.getItem('bu2_gw_seen')||'{}'); }catch(e){}
  var firstRun=!Object.keys(seenDocs).length;
  var appNames=_gwAppPersonNames();
  var items=data.items;
  var skipped=[], usable=[];
  items.forEach(function(it){
    if(!it.ok){ skipped.push({it:it,reason:'제목 형식을 읽을 수 없음'}); return; }
    if(it.status!=='COMPLETE'){ skipped.push({it:it,reason:it.status==='RETURN'?'반려':'결재 진행중'}); return; }
    if(/취소/.test(it.kind)){ skipped.push({it:it,reason:'출장 취소 문서 — 앱 일정 직접 확인',cancel:true}); return; }
    if(it.start>it.end){ skipped.push({it:it,reason:'기간 오류(취소/정정 문서로 보임) — 앱 일정 직접 확인',cancel:true}); return; }
    if(it.end<(data.year||'2026')+'-01-01'||it.start>(data.year||'2026')+'-12-31'){ skipped.push({it:it,reason:(data.year||'2026')+'년 기간이 아님'}); return; }
    usable.push(it);
  });
  // 한 출장(그룹): 같은 사람 + 같은 고객사/도시 + 기간이 겹치는 문서들을 기안 순서로 묶는다
  var groups=[];
  usable.sort(function(a,b){return (a.draftedAt+a.docNum)<(b.draftedAt+b.docNum)?-1:1;});
  // 같은 출장인지 판단: 고객사/도시 표기가 문서마다 조금씩 달라도(AT&S P5 / AT&S, 오타, 완료 문서의 빈 고객사 등)
  // 같은 사이트로 매핑되거나 한쪽이 비어 있으면 같은 출장으로 본다
  function compat(a,b){
    return !a.customer||!b.customer||_gwSiteKey(a)===_gwSiteKey(b)||(a._site&&a._site===b._site);
  }
  usable.forEach(function(it){
    it._site=_gwMapSite(it).siteId;
    it.people.forEach(function(p){
      var key=_gwSiteKey(it), g=groups.find(function(x){
        return x.person===p&&_gwOverlap(it.start,it.end,x.minStart,x.maxEnd)&&x.docs.some(function(d){return compat(d,it);});
      });
      if(!g){ g={person:p,key:key,docs:[],minStart:it.start,maxEnd:it.end}; groups.push(g); }
      g.docs.push(it);
      if(it.start<g.minStart) g.minStart=it.start;
      if(it.end>g.maxEnd) g.maxEnd=it.end;
    });
  });
  var used={}, usedAny={}; // 사람별로 이미 매칭된 앱 일정(한 일정에 여러 사람 이름이 쉼표로 적힌 경우 각자 매칭), 어느 사람이든 매칭된 일정
  var rows=groups.map(function(g,gi){
    var first=g.docs.find(function(d){return d.kind==='최초';})||g.docs[0];
    var done=g.docs.filter(function(d){return d.kind==='완료';}).pop();
    var changes=g.docs.filter(function(d){return d.kind!=='완료';});
    var fin=done||changes[changes.length-1]||first;
    var plan=first;
    var site=_gwMapSite(first);
    var appName=_gwMatchPerson(g.person,appNames);
    var docNums=g.docs.map(function(d){return d.docNum;}).filter(Boolean);
    // 연장 이력: 최초 계획 복귀일보다 늘어난 변경 문서의 복귀일(최대 2회)
    var ext=[], lastEnd=plan.end;
    changes.forEach(function(d){ if(d.end>lastEnd){ ext.push({seq:ext.length+1,end:d.end,note:'그룹웨어 '+(d.kind||'변경')+' '+d.docNum}); lastEnd=d.end; } });
    if(ext.length>2) ext=ext.slice(-2).map(function(e,i){return {seq:i+1,end:e.end,note:e.note};});
    if(fin.end<=plan.end) ext=[];
    var row={gi:gi,person:g.person,appName:appName,start:fin.start,end:fin.end,plan:{start:plan.start,end:plan.end},ext:ext,
      docs:g.docs,docNums:docNums,customer:first.customer,city:first.city,country:first.country,partner:first.partner||'',
      project:(g.docs.slice().reverse().find(function(d){return d.project;})||{}).project||'',
      purpose:(g.docs.slice().reverse().find(function(d){return d.purpose;})||{}).purpose||'',
      siteId:site.siteId,siteCands:site.cands,siteHow:site.how,
      kinds:g.docs.map(function(d){return d.kind;}).join(' → '),
      type:'',scId:'',cls:'',reason:'',selected:false};
    row.change=fin.end>plan.end?'연장 '+(_gwDays(plan.end,fin.end)-1)+'일':(fin.end<plan.end?'축소 '+(_gwDays(fin.end,plan.end)-1)+'일':(fin.start!==plan.start?'시작일 변경':''));
    // 현재 앱 일정(완료 포함)과 매칭
    var names=[g.person,appName].filter(Boolean);
    // 국내 출장은 품의서가 짧게 여러 건(주 단위)인데 앱에는 장기 일정 하나로 등록된 경우가 많아, 한 앱 일정이 여러 품의서를 포함할 수 있다
    var isDom=g.docs.some(function(d){return d.domestic;});
    function covers(sc){ return sc.start<=_addDaysStr(fin.start,2)&&sc.end>=_addDaysStr(fin.end,-2); }
    var cands=S.schedules.filter(function(sc){
      if(!isDom&&used[sc.id+'|'+g.person]) return false;
      if(!_gwPersonOf(sc).some(function(n){return names.indexOf(n)>=0||n.indexOf(g.person+' ')===0;})) return false;
      if(row.siteId&&_gwSchedSite(sc)!==row.siteId) return false;
      return _gwOverlap(sc.start,sc.end,g.minStart,g.maxEnd);
    }).sort(function(a,b){
      var oa=Math.min(a.end,g.maxEnd)<Math.max(a.start,g.minStart)?0:1;
      return (a.start===fin.start&&a.end===fin.end?0:1)-(b.start===fin.start&&b.end===fin.end?0:1)||(isDom?((covers(a)?0:1)-(covers(b)?0:1)||((a.end>a.start?pd(a.end)-pd(a.start):0)-(b.end>b.start?pd(b.end)-pd(b.start):0))):0)||(Math.abs(pd(a.start)-pd(fin.start))-Math.abs(pd(b.start)-pd(fin.start)));
    });
    var already=cands.find(function(sc){return (sc.gwDocs||[]).some(function(n){return docNums.indexOf(n)>=0;});});
    var m=already||cands[0];
    // 같은 고객사의 다른 사이트에 등록돼 있을 수 있다(예: 제목은 IBIDEN/Ogaki인데 앱에는 IBIDEN_Cell8) — 사이트 매핑이 달라도
    // 같은 사람·같은 기간·같은 고객사면 그 일정으로 본다
    if(!m){
      var ctoks=String(first.customer||'').split(/[,，、]/).map(_gwAliased).filter(function(c){return c&&c.length>=3;});
      var alt=ctoks.length?S.schedules.filter(function(sc){
        if(!isDom&&used[sc.id+'|'+g.person]) return false;
        if(!_gwPersonOf(sc).some(function(n){return names.indexOf(n)>=0||n.indexOf(g.person+' ')===0;})) return false;
        var sn=_gwNorm((S.sites.find(function(s){return s.id===_gwSchedSite(sc);})||{}).name);
        if(!ctoks.some(function(c){return sn.indexOf(c)>=0;})) return false;
        return _gwOverlap(sc.start,sc.end,g.minStart,g.maxEnd);
      }).sort(function(a,b){return Math.abs(pd(a.start)-pd(fin.start))-Math.abs(pd(b.start)-pd(fin.start));}):[];
      if(alt.length){ m=alt[0]; row.siteId=_gwSchedSite(m); row.siteHow='같은 고객사의 다른 사이트(일정에서 추정)'; }
    }
    if(m){
      used[m.id+'|'+g.person]=true; usedAny[m.id]=true;
      row.scId=m.id; row.cur={start:m.start,end:m.end}; row.curTask=m.task||''; row.multi=cands.length>1?cands.length:0;
      if(!row.siteId){ row.siteId=_gwSchedSite(m); row.siteHow='일정에서 추정'; } // 사이트 매핑이 안 돼도 매칭된 앱 일정의 사이트를 따른다
    }
    // 같은 출장의 다른 앱 일정(프로젝트별로 나눠 등록했거나 기간을 쪼개 등록한 일정)도 같은 품의서에 딸린 일정으로 본다
    row.sibIds=[];
    if(m){
      var msite=_gwSchedSite(m);
      S.schedules.forEach(function(sc){
        if(sc.id===m.id||used[sc.id+'|'+g.person]) return;
        if(!_gwPersonOf(sc).some(function(n){return names.indexOf(n)>=0||n.indexOf(g.person+' ')===0;})) return;
        if(_gwSchedSite(sc)!==msite) return;
        if(sc.start<_addDaysStr(g.minStart,-2)||sc.end>_addDaysStr(g.maxEnd,2)) return;
        row.sibIds.push(sc.id); used[sc.id+'|'+g.person]=true; usedAny[sc.id]=true;
      });
    }
    row.external=!!rosterSet&&!rosterSet[g.person];
    row.pos=GW_POS_OVERRIDE[g.person]||(rosterSet&&rosterSet[g.person]&&rosterSet[g.person].position)||'';
    row.type=(!appName&&rosterSet&&rosterSet[g.person])?'tech':''; // BU2부문 구성원은 앱에 처음 등록돼도 기본 구분을 기술로 한다
    row.rdept=(rosterSet&&rosterSet[g.person]&&rosterSet[g.person].dept)||'';
    row.domestic=g.docs.some(function(d){return d.domestic;});
    row.isNew=!firstRun&&docNums.some(function(n){return !seenDocs[n];});
    row.ignoreKey=g.person+'|'+g.minStart+'|'+g.maxEnd+'|'+_gwNorm(first.customer);
    row.ignored=!!_gwLoadIgnored()[row.ignoreKey];
    // 분류
    if(m){
      var same=m.start===fin.start&&m.end===fin.end;
      var docsLinked=docNums.every(function(n){return (m.gwDocs||[]).indexOf(n)>=0;});
      var covered=!same&&isDom&&covers(m);
      row.covered=covered;
      if((same||covered)&&docsLinked) row.cls='applied';
      else if(same||covered) row.cls='match';
      else row.cls='update';
    }else row.cls='new';
    _gwRecls(row);
    return row;
  });
  // 앱에만 있는 2026년 일정(그룹웨어 문서와 매칭되지 않음)
  var year=data.year||'2026';
  var appOnly=S.schedules.filter(function(sc){
    return !usedAny[sc.id]&&sc.end>=year+'-01-01'&&sc.start<=year+'-12-31'&&!(sc.gwDocs&&sc.gwDocs.length);
  }).map(function(sc){
    var site=S.sites.find(function(s){return s.id===_gwSchedSite(sc);});
    return {id:sc.id,name:sc.name,start:sc.start,end:sc.end,site:site?site.name:'',hidden:!!sc.hidden};
  }).sort(function(a,b){return a.start<b.start?-1:1;});
  try{ var nowSeen=JSON.parse(localStorage.getItem('bu2_gw_seen')||'{}'); items.forEach(function(it){ if(it.docNum) nowSeen[it.docNum]=1; }); localStorage.setItem('bu2_gw_seen',JSON.stringify(nowSeen)); localStorage.setItem('bu2_gw_last',data.collectedAt||''); }catch(e){}
  _gwState={items:items,rows:rows,appOnly:appOnly,skipped:skipped,filter:'all',meta:{roster:rosterSet?Object.keys(rosterSet).length:0,group:data.group||'',firstRun:firstRun,year:year,collectedAt:data.collectedAt,total:items.length}};
  return _gwState;
}

/* ── ③ 반영 ── */
function _gwPersonType(row){
  if(row.type) return row.type;
  var ex=S.schedules.find(function(sc){return _gwPersonOf(sc).indexOf(row.appName)>=0;});
  return (ex&&ex.type)||'tech';
}
function _gwApplyRow(row){
  if(row.cls==='applied') return 'skip';
  var docNums=row.docNums;
  function stamp(sc){ var set=(sc.gwDocs||[]).slice(); docNums.forEach(function(n){ if(set.indexOf(n)<0) set.push(n); }); sc.gwDocs=set; }
  if(row.scId){
    var sc=S.schedules.find(function(s){return s.id===row.scId;});
    if(!sc) return 'missing';
    if(row.cls==='update'||(row.cls==='check'&&row.cur&&(row.cur.start!==row.start||row.cur.end!==row.end))){
      sc.start=row.start; sc.end=row.end;
      if(row.ext.length){ sc.origEnd=row.plan.end; sc.extensions=row.ext.map(function(e){return {seq:e.seq,end:e.end,note:e.note};}); }
      else if(sc.extensions&&sc.extensions.length&&sc.end<=(sc.origEnd||'')){ delete sc.extensions; delete sc.origEnd; }
    }
    stamp(sc); _touch(sc);
    (row.sibIds||[]).forEach(function(id){ var s2=S.schedules.find(function(x){return x.id===id;}); if(s2){ stamp(s2); _touch(s2); } });
    return 'ok';
  }
  // 신규 등록
  if(!row.siteId) return 'site';
  var pname=(row.project||'').trim(); if(!pname) return 'project';
  if(!row.appName&&!row.type) return 'type';
  var proj=S.projects.find(function(p){return p.siteId===row.siteId&&p.name===pname;});
  if(!proj){ proj=_touch({id:_createProjectId(pname),siteId:row.siteId,name:pname}); S.projects.push(proj); }
  var same=S.schedules.filter(function(s){return s.projectId===proj.id&&_gwPersonOf(s).indexOf(row.appName||row.person)>=0;}).length;
  var rec={id:genId('s',S.schedules),projectId:proj.id,task:(row.purpose||'출장').slice(0,80),name:row.appName||(row.pos?row.person+' '+row.pos:row.person),
    occSeq:Math.min(same+1,3),type:_gwPersonType(row),start:row.start,end:row.end,note:'그룹웨어 '+docNums.join(', '),hidden:false,
    domestic:!!row.domestic&&((S.sites.find(function(s){return s.id===row.siteId;})||{}).country||'')!=='국내'};
  if(row.ext.length){ rec.origEnd=row.plan.end; rec.extensions=row.ext.map(function(e){return {seq:e.seq,end:e.end,note:e.note};}); }
  stamp(rec); S.schedules.push(_touch(rec));
  row.scId=rec.id; row.cur={start:rec.start,end:rec.end};
  return 'ok';
}
function _gwRowDone(row){ row.cls='applied'; row.selected=false; }

/* ── UI ── */
function openGwImport(){
  var html='<div class="mtit">그룹웨어 가져오기 — 해외·국내 출장 품의서 (2026년)</div>'
    +'<div id="gw_body"></div>'
    +'<div class="mfoot"><button class="btn sm pri" onclick="cm()">닫기</button></div>';
  mw(html,true);
  _gwRender();
}
function _gwCopyBookmarklet(){
  var txt=_gwBookmarklet();
  (navigator.clipboard?navigator.clipboard.writeText(txt):Promise.reject()).then(function(){alert('북마크 주소를 복사했습니다. 새 북마크를 만들고 URL 칸에 붙여넣으세요.');}).catch(function(){prompt('아래 주소를 복사해 새 북마크의 URL에 붙여넣으세요.',txt);});
}
function _gwRender(){
  var el=document.getElementById('gw_body'); if(!el) return;
  var st=_gwState;
  if(!st.rows.length&&!st.meta){
    el.innerHTML='<div style="font-size:12px;line-height:1.7;color:var(--tx-second)">'
      +'<b>1. 수집 북마크 만들기 (처음 한 번)</b><br>아래 버튼을 브라우저 <b>북마크 바로 끌어다 놓으세요.</b> (끌어서 놓기가 안 되면 <b>주소 복사</b> 후 새 북마크의 URL에 붙여넣기)<br>'
      +'<a class="btn sm pri" href="'+_esc(_gwBookmarklet())+'" onclick="alert(\'이 버튼은 클릭하지 말고 북마크 바로 끌어다 놓으세요.\');return false;" style="text-decoration:none;display:inline-block;margin:6px 6px 8px 0">BU2 출장 수집</a>'
      +'<button class="btn sm" onclick="_gwCopyBookmarklet()">주소 복사</button><br>'
      +'<b>2. 그룹웨어에서 실행</b><br>그룹웨어(전자결재)에 로그인한 탭에서 북마크 <b>BU2 출장 수집</b>을 클릭하면 2026년 해외·국내 출장 품의서를 읽어 클립보드에 복사합니다. (제목·기간·사이트·프로젝트명·출장 목적·출장자·결재상태만 읽고, 비용·첨부·본문 전체는 가져오지 않습니다.)<br>'
      +'<b>3. 여기에 붙여넣기</b></div>'
      +'<textarea id="gw_paste" placeholder="여기에 붙여넣기 (Ctrl+V)" style="width:100%;height:90px;margin:8px 0;font-size:11px"></textarea>'
      +'<div id="gw_err" style="color:var(--tx-danger,#e05a5a);font-size:12px;min-height:16px"></div>'
      +'<button class="btn sm pri" onclick="gwAnalyzeClick()">분석</button>';
    return;
  }
  var cnt={new:0,update:0,match:0,applied:0,check:0,external:0}; var newDocN=0;
  var ignoredN=0; st.rows.forEach(function(r){ if(r.ignored) ignoredN++; else cnt[r.cls]++; });
  st.rows.forEach(function(r){ if(r.isNew&&!r.ignored&&r.cls!=='external') newDocN++; });
  var chip=function(k,label,color){ return '<button class="gw-chip'+(st.filter===k?' on':'')+'" style="border-color:'+color+';color:'+color+'" onclick="gwSetFilter(\''+k+'\')">'+label+'</button>'; };
  var h='<div style="font-size:11px;color:var(--tx-muted);margin-bottom:6px">'+st.meta.total+'건 읽음 · 수집 '+_esc((st.meta.collectedAt||'').slice(0,16).replace('T',' '))+' · 결재 완료 문서만 반영 대상 · '+(st.meta.roster?_esc(st.meta.group||'BU2 기술운영1그룹')+' '+st.meta.roster+'명만 자동 입력 대상':'<span style="color:#e05a5a">조직 명단이 없어 모든 출장자가 대상으로 보입니다(수집 북마크를 최신으로 다시 만드세요)</span>')+(cnt.external?' · 대상 외 '+cnt.external+'건 제외됨':'')+(st.meta.firstRun?' · 처음 수집이라 NEW 표시는 다음 수집부터':'')+'</div>';
  h+='<div class="gw-chips">'+chip('all','전체 '+(st.rows.length-ignoredN-cnt.external),'#888')+(newDocN?chip('newdoc','NEW '+newDocN,'#e05a5a'):'')+chip('new','신규 '+cnt.new,'#4aaa70')+chip('update','수정 '+cnt.update,'#e0972e')+chip('match','일치 '+cnt.match+(cnt.applied?'(+반영됨 '+cnt.applied+')':''),'#5a9aee')
    +chip('check','확인 필요 '+cnt.check,'#e05a5a')+chip('apponly','앱에만 있음 '+st.appOnly.length,'#b39ddb')+chip('skipped','건너뜀 '+st.skipped.length,'#777')+chip('ignored','무시됨 '+ignoredN,'#777')+'</div>';
  if(st.filter==='apponly'){
    h+='<div style="font-size:11px;color:var(--tx-muted);margin:6px 0">그룹웨어 2026년 품의서와 매칭되지 않은 앱 일정입니다(반영한 적 없는 일정). 품의서 없이 등록했거나 이름/사이트 표기가 달라 매칭되지 않은 경우입니다.</div>';
    h+='<div class="gw-wrap"><table class="gw-tbl"><thead><tr><th>출장자</th><th>사이트</th><th>기간</th><th>숨김</th></tr></thead><tbody>'
      +(st.appOnly.map(function(a){return '<tr><td>'+_esc(a.name)+'</td><td>'+_esc(a.site)+'</td><td>'+_esc(_gwFmt(a.start,a.end))+'</td><td>'+(a.hidden?'숨김':'')+'</td></tr>';}).join('')||'<tr><td colspan="4">없음</td></tr>')+'</tbody></table></div>';
  }else if(st.filter==='skipped'){
    h+='<div class="gw-wrap"><table class="gw-tbl"><thead><tr><th>문서</th><th>제목</th><th>사유</th></tr></thead><tbody>'
      +(st.skipped.map(function(s){return '<tr><td>'+_esc(s.it.docNum||'(번호 없음)')+'</td><td>'+_esc(s.it.titleRaw||'')+'</td><td>'+_esc(s.reason)+'</td></tr>';}).join('')||'<tr><td colspan="3">없음</td></tr>')+'</tbody></table></div>';
  }else{
    var rows=st.rows.filter(function(r){ if(st.filter==='ignored') return r.ignored; if(r.ignored) return false; if(r.cls==='external') return false; if(st.filter==='newdoc') return r.isNew; return st.filter==='all'||r.cls===st.filter||(st.filter==='match'&&r.cls==='applied'); });
    var applyable=rows.filter(function(r){return r.cls==='new'||r.cls==='update'||r.cls==='match';}).length;
    h+='<div style="display:flex;gap:6px;align-items:center;margin:8px 0;flex-wrap:wrap">'
      +'<button class="btn sm" onclick="gwSelectAll(true)">신규·수정 전체 선택</button><button class="btn sm" onclick="gwSelectAll(false)">선택 해제</button>'
      +'<button class="btn sm pri" onclick="gwApplySelected()">선택 반영</button>'
      +'<input type="text" id="gw_bulk_proj" placeholder="프로젝트명 일괄 입력" style="width:150px;font-size:11px"><button class="btn sm" onclick="gwBulkProject()" title="체크한 신규/확인 필요 행에 프로젝트명을 한꺼번에 넣습니다">선택 행에 적용</button>'
      +'<select id="gw_bulk_type" style="font-size:11px"><option value="">새 출장자 구분...</option><option value="tech">기술</option><option value="outsource">외주</option><option value="localOutsource">현지외주</option><option value="hq">본사</option><option value="vision">비전</option><option value="host">호스트</option></select><button class="btn sm" onclick="gwBulkType()">선택 행에 구분 적용</button>'
      +'<button class="btn sm pri" onclick="gwApplyAllSafe()" title="신규와 수정 중 확인 필요 없는 건을 모두 반영합니다(일치 건은 문서만 연결)">신규·수정 모두 반영</button>'
      +'<span style="font-size:11px;color:var(--tx-muted)">현재 목록에서 반영 가능 '+applyable+'건</span></div>';
    h+='<div class="gw-wrap"><table class="gw-tbl"><thead><tr><th></th><th>상태</th><th>출장자</th><th>사이트</th><th>그룹웨어 기간</th><th>현재 앱 일정</th><th>변경</th><th>문서</th><th></th></tr></thead><tbody>';
    h+=rows.map(_gwRowHtml).join('')||'<tr><td colspan="9">해당 항목이 없습니다.</td></tr>';
    h+='</tbody></table></div>';
  }
  h+='<div style="margin-top:8px"><button class="btn sm" onclick="gwReset()">← 다시 붙여넣기</button></div>';
  el.innerHTML=h;
}
function _gwClsLabel(r){
  return {external:'<span style="color:#777">대상 외</span>',new:'<span style="color:#4aaa70">신규</span>',update:'<span style="color:#e0972e">수정</span>',match:'<span style="color:#5a9aee">일치</span>',applied:'<span style="color:#888">반영됨</span>',check:'<span style="color:#e05a5a">확인 필요</span>'}[r.cls];
}
function _gwRowHtml(r){
  var site=S.sites.find(function(s){return s.id===r.siteId;});
  var siteCell;
  if(r.cls==='check'&&!r.scId||!r.siteId){
    var cands=r.siteCands.map(function(id){return S.sites.find(function(s){return s.id===id;});}).filter(Boolean);
    var all=S.sites.slice().sort(function(a,b){return a.name.localeCompare(b.name,'ko');});
    siteCell='<select onchange="gwSetSite('+r.gi+',this.value)"><option value="">사이트 선택...</option>'
      +(cands.length?'<optgroup label="추천">'+cands.map(function(s){return '<option value="'+_esc(s.id)+'"'+(s.id===r.siteId?' selected':'')+'>'+_esc(s.name)+'</option>';}).join('')+'</optgroup>':'')
      +'<optgroup label="전체">'+all.map(function(s){return '<option value="'+_esc(s.id)+'"'+(s.id===r.siteId?' selected':'')+'>'+_esc(s.name)+'</option>';}).join('')+'</optgroup></select>'
      +'<div class="gw-sub">'+_esc(r.customer+' / '+r.city+' / '+r.country)+'</div>';
  }else siteCell=_esc(site?site.name:'')+'<div class="gw-sub">'+_esc(r.customer+' / '+r.city)+'</div>';
  var needNew=!r.scId;
  var extra='';
  if(needNew&&(r.cls==='new'||r.cls==='check')){
    extra='<div class="gw-sub">프로젝트: <input type="text" list="gw_pl_'+r.gi+'" value="'+_esc(r.project)+'" onchange="gwSetProject('+r.gi+',this.value)" style="width:150px" placeholder="프로젝트명"><datalist id="gw_pl_'+r.gi+'">'+S.projects.filter(function(p){return p.siteId===r.siteId;}).map(function(p){return '<option value="'+_esc(p.name)+'">';}).join('')+'</datalist></div>';
    if(!r.appName) extra+='<div class="gw-sub">새 출장자 구분: <select onchange="gwSetType('+r.gi+',this.value)"><option value="">선택...</option>'
      +[['tech','기술'],['outsource','외주'],['localOutsource','현지외주'],['hq','본사'],['vision','비전'],['host','호스트']].map(function(o){return '<option value="'+o[0]+'"'+(r.type===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select></div>';
  }
  var cur=r.cur?_esc(_gwFmt(r.cur.start,r.cur.end))+(r.sibIds&&r.sibIds.length?'<div class="gw-sub">같은 출장의 앱 일정 '+r.sibIds.length+'건 함께 연결</div>':'')+(r.covered?'<div class="gw-sub">이 출장 기간을 포함하는 일정(국내 장기 일정)</div>':'')+(r.multi?'<div class="gw-sub">후보 '+r.multi+'건 중 가장 가까운 일정</div>':''):'<span style="color:var(--tx-faint)">없음</span>';
  var canApply=(r.cls==='match'||_gwBlockers(r).length===0);
  var btn;
  if(r.cls==='external') btn='';
  else if(r.ignored) btn='<button class="btn sm" onclick="gwIgnore('+r.gi+',false)">무시 해제</button>';
  else{
    btn=r.cls==='applied'?'':'<button class="btn sm pri" '+(canApply?'':'disabled ')+'onclick="gwApplyOne('+r.gi+')">'+(r.cls==='match'?'연결':'반영')+'</button>';
    if(r.cls==='check'||r.cls==='new') btn+=' <button class="btn sm" title="앱에서 관리하지 않는 출장(임원 전시회 등)이면 목록에서 숨깁니다" onclick="gwIgnore('+r.gi+',true)">무시</button>';
  }
  return '<tr class="gw-'+r.cls+'"><td>'+((!r.ignored&&(r.cls==='new'||r.cls==='update'||r.cls==='check'))?'<input type="checkbox" '+(r.selected?'checked':'')+' onchange="gwToggle('+r.gi+',this.checked)">':'')+'</td>'
    +'<td>'+_gwClsLabel(r)+(r.isNew?' <span style="background:#e05a5a;color:#fff;border-radius:3px;padding:0 4px;font-size:9px;font-weight:700">NEW</span>':'')+(r.reason?'<div class="gw-sub" style="color:#e05a5a">'+_esc(r.reason)+'</div>':'')+'</td>'
    +'<td>'+_esc(r.appName||r.person)+(r.appName?'':'<div class="gw-sub">(앱에 없음'+(r.rdept?' · '+_esc(r.rdept):'')+')</div>')+'</td>'
    +'<td>'+siteCell+extra+'</td>'
    +'<td>'+_esc(_gwFmt(r.start,r.end))+'</td><td>'+cur+'</td>'
    +'<td>'+_esc(r.change)+'<div class="gw-sub">'+_esc(r.kinds)+'</div></td>'
    +'<td class="gw-sub">'+r.docNums.map(_esc).join('<br>')+'</td><td>'+btn+'</td></tr>';
}
function gwAnalyzeClick(){
  var ta=document.getElementById('gw_paste'), err=document.getElementById('gw_err');
  try{ _gwAnalyze(ta.value.trim()); _gwRender(); }catch(e){ if(err) err.textContent=e.message; }
}
function gwReset(){ _gwState={items:[],rows:[],appOnly:[],skipped:[],filter:'all',meta:null}; _gwRender(); }
function gwIgnore(gi,on){ var r=_gwRow(gi); r.ignored=on; if(on) r.selected=false; _gwSetIgnored(r.ignoreKey,on); _gwRender(); }
function gwSetFilter(f){ _gwState.filter=f; _gwRender(); }
function _gwRow(gi){ return _gwState.rows[gi]; }
function gwToggle(gi,on){ _gwRow(gi).selected=on; }
function gwSelectAll(on){
  _gwState.rows.forEach(function(r){ if(r.cls==='new'||r.cls==='update') r.selected=on&&(_gwState.filter==='all'||_gwState.filter===r.cls); });
  _gwRender();
}
function gwSetSite(gi,siteId){
  var r=_gwRow(gi); r.siteId=siteId;
  if(siteId) _gwSaveMap(r.docs[0]?_gwSiteKey(r.docs[0]):'',siteId);
  // 사이트가 정해지면 앱 일정 매칭을 다시 계산
  var res=_gwReanalyzeRow(r);
  _gwRender();
}
function gwSetProject(gi,v){ var r=_gwRow(gi); r.project=v.trim(); _gwRecls(r); _gwRender(); }
function gwSetType(gi,v){ var r=_gwRow(gi); r.type=v; _gwRecls(r); _gwRender(); }
// 선택한 행(앱에 아직 없는 출장)에 같은 프로젝트명을 한꺼번에 넣는다
// 선택한 행의 앱에 없는 새 출장자에게 구분(기술/외주/본사 등)을 한꺼번에 지정한다
function gwBulkType(){
  var sel=document.getElementById('gw_bulk_type'), v=sel?sel.value:'';
  if(!v){ alert('적용할 구분을 선택하세요.'); return; }
  var n=0; _gwState.rows.forEach(function(r){ if(r.selected&&!r.appName&&!r.scId&&r.cls!=='applied'){ r.type=v; _gwRecls(r); n++; } });
  if(!n){ alert('앱에 없는 새 출장자 행을 먼저 체크하세요.'); return; }
  _gwRender();
}
function gwBulkProject(){
  var inp=document.getElementById('gw_bulk_proj'), v=(inp&&inp.value||'').trim();
  if(!v){ alert('프로젝트명을 입력하세요.'); return; }
  var n=0; _gwState.rows.forEach(function(r){ if(r.selected&&!r.scId&&r.cls!=='applied'){ r.project=v; _gwRecls(r); n++; } });
  if(!n){ alert('먼저 앱에 없는 출장(신규/확인 필요) 행을 체크하세요.'); return; }
  _gwRender();
}
// 사이트를 사용자가 정한 뒤, 그 사이트에서 같은 사람/기간의 앱 일정을 찾아 분류를 갱신
function _gwReanalyzeRow(r){
  var names=[r.person,r.appName].filter(Boolean);
  var fin={start:r.start,end:r.end};
  var cands=S.schedules.filter(function(sc){
    return r.siteId&&_gwSchedSite(sc)===r.siteId&&_gwPersonOf(sc).some(function(n){return names.indexOf(n)>=0||n.indexOf(r.person+' ')===0;})
      &&_gwOverlap(sc.start,sc.end,r.plan.start<r.start?r.plan.start:r.start,r.plan.end>r.end?r.plan.end:r.end);
  }).sort(function(a,b){return Math.abs(pd(a.start)-pd(fin.start))-Math.abs(pd(b.start)-pd(fin.start));});
  var m=cands[0];
  if(m){
    r.scId=m.id; r.cur={start:m.start,end:m.end}; r.multi=cands.length>1?cands.length:0;
    var same=m.start===fin.start&&m.end===fin.end;
    var cov=!same&&r.domestic&&m.start<=_addDaysStr(r.start,2)&&m.end>=_addDaysStr(r.end,-2); r.covered=cov;
    r.cls=(same||cov)?((r.docNums.every(function(n){return (m.gwDocs||[]).indexOf(n)>=0;}))?'applied':'match'):'update';
  }else{
    r.scId=''; r.cur=null; r.multi=0; r.cls='new';
  }
  _gwRecls(r);
}
function _gwFinish(){
  saveData();
  renderAll();
  _gwRender();
}
function gwApplyOne(gi){
  var r=_gwRow(gi), res=_gwApplyRow(r);
  if(res==='site'){ alert('사이트를 선택하세요.'); return; }
  if(res==='project'){ alert('프로젝트명을 입력하세요.'); return; }
  if(res==='type'){ alert('새 출장자의 구분(기술/외주 등)을 선택하세요.'); return; }
  if(res==='ok') _gwRowDone(r);
  _gwFinish();
}
function gwApplySelected(){
  var n=0, bad=0;
  _gwState.rows.forEach(function(r){
    if(!r.selected) return;
    var res=_gwApplyRow(r);
    if(res==='ok'){ _gwRowDone(r); n++; } else bad++;
  });
  if(!n&&!bad){ alert('선택된 항목이 없습니다.'); return; }
  _gwFinish();
  if(bad) alert(n+'건 반영했습니다. '+bad+'건은 사이트/프로젝트가 필요해 반영하지 못했습니다.');
}
function gwApplyAllSafe(){
  var targets=_gwState.rows.filter(function(r){return (r.cls==='new'||r.cls==='update')&&r.siteId;});
  var matches=_gwState.rows.filter(function(r){return r.cls==='match';});
  if(!targets.length&&!matches.length){ alert('반영할 항목이 없습니다.'); return; }
  if(!confirm('신규 '+targets.filter(function(r){return r.cls==='new';}).length+'건, 수정 '+targets.filter(function(r){return r.cls==='update';}).length+'건을 반영하고, 일치 '+matches.length+'건은 문서만 연결합니다.\n확인 필요 항목은 건드리지 않습니다. 계속할까요?')) return;
  var n=0;
  targets.concat(matches).forEach(function(r){ if(_gwApplyRow(r)==='ok'){ _gwRowDone(r); n++; } });
  _gwFinish();
  alert(n+'건을 반영했습니다.');
}
