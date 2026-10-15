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
    function parseTitle(t){
      var m=t.match(/^(.*?)\/(\d{4}-\d{2}-\d{2})\([^)]*\)\s*~\s*(\d{4}-\d{2}-\d{2})\([^)]*\)\/([^\/]*)\/([^\/]*)\/([^\/]*)\/(.*)$/);
      if(!m) return {ok:false};
      return {ok:true,kind:m[1].trim(),start:m[2],end:m[3],city:m[4].trim(),country:m[5].trim(),customer:m[6].trim(),
        people:m[7].split(/[,，、]/).map(function(s){return s.trim();}).filter(Boolean)};
    }
    function pick(txt,label){
      var m=txt.match(new RegExp(label+'\\s*[:：]\\s*([^\\n]*)')); var v=m?m[1]:'';
      v=v.split(/\s(?:고객사|협력사|프로젝트명|출장 목적)\s*[:：]/)[0];
      return v.replace(/\s+/g,' ').trim().slice(0,200);
    }
    try{
      say('해외출장 품의서 목록을 읽는 중...');
      var docs=[], page=0, hasNext=true;
      while(hasNext&&page<30){
        var j=await fetch('/api/search/approval?stype=simple&type=approval&keyword='+encodeURIComponent('해외출장')+'&fromDate=&toDate=&page='+page+'&offset=100',{credentials:'same-origin'}).then(function(r){return r.json();});
        var d=j.data; docs=docs.concat(Array.isArray(d)?d:Object.keys(d).map(function(k){return d[k];}));
        hasNext=!!j.hasNext; page++;
      }
      docs=docs.filter(function(x){
        return clean(x.formName)==='해외출장 품의서'&&(String(x.draftedAt).slice(0,4)===YEAR||clean(x.title).indexOf(YEAR+'-')>=0);
      });
      var out=[], idx=0;
      async function worker(){
        while(idx<docs.length){
          var x=docs[idx++], t=clean(x.title), rec=parseTitle(t);
          rec.id=x.id; rec.docNum=x.docNum||''; rec.status=x.docStatus; rec.drafter=x.drafterName; rec.draftedAt=String(x.draftedAt).slice(0,10); rec.titleRaw=t;
          try{
            var dj=await fetch('/api/approval/document/'+x.id,{credentials:'same-origin'}).then(function(r){return r.json();});
            var tmp=document.createElement('div'); tmp.innerHTML=((dj.data||dj).document||{}).docBodyContent||'';
            tmp.querySelectorAll('style,script').forEach(function(e){e.remove();});
            var txt=tmp.innerText||tmp.textContent||'';
            rec.project=pick(txt,'프로젝트명'); rec.partner=pick(txt,'협력사'); rec.purpose=pick(txt,'출장 목적');
          }catch(e){ rec.detailErr=1; }
          out.push(rec);
          say('문서 내용을 읽는 중... '+out.length+' / '+docs.length);
        }
      }
      await Promise.all([worker(),worker(),worker(),worker()]);
      out.sort(function(a,b){return (a.draftedAt+a.docNum)<(b.draftedAt+b.docNum)?-1:1;});
      var json=JSON.stringify({src:'bu2-gw',v:1,year:YEAR,collectedAt:new Date().toISOString(),items:out});
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
var GW_SITE_ALIAS={'신코':'shinko','니가타':'niigata'};

function _gwNorm(s){ return String(s||'').toLowerCase().replace(/[^a-z0-9가-힣]/g,''); }
function _gwAliased(s){ var n=_gwNorm(s); return GW_SITE_ALIAS[n]||n; }
function _gwSiteKey(it){ return _gwNorm(it.customer)+'|'+_gwNorm(it.city)+'|'+_gwNorm(it.country); }
function _gwLoadMap(){ try{ return JSON.parse(localStorage.getItem('bu2_gw_sitemap')||'{}'); }catch(e){ return {}; } }
function _gwSaveMap(key,siteId){ try{ var m=_gwLoadMap(); m[key]=siteId; localStorage.setItem('bu2_gw_sitemap',JSON.stringify(m)); }catch(e){} }

// 그룹웨어의 (고객사, 도시, 국가)를 앱 사이트로 매핑. 확실하면 site를 정하고, 아니면 후보만 돌려준다
function _gwMapSite(it){
  var map=_gwLoadMap(), key=_gwSiteKey(it);
  if(map[key]&&S.sites.some(function(s){return s.id===map[key];})) return {siteId:map[key],cands:[],how:'저장된 매핑'};
  var custs=String(it.customer||'').split(/[,，、]/).map(_gwAliased).filter(Boolean);
  var city=_gwNorm(it.city), country=_gwNorm(it.country);
  var scored=S.sites.map(function(s){
    var sn=_gwNorm(s.name), score=0;
    if(custs.some(function(c){return c&&(sn.indexOf(c)>=0||c.indexOf(sn)>=0);})) score+=2;
    var rg=_gwNorm(s.region);
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

function _gwAnalyze(json){
  var data;
  try{ data=JSON.parse(json); }catch(e){ throw new Error('붙여넣은 내용을 읽을 수 없습니다. 수집 북마크가 복사한 내용을 그대로 붙여넣어 주세요.'); }
  if(!data||data.src!=='bu2-gw'||!Array.isArray(data.items)) throw new Error('수집 북마크로 만든 데이터가 아닙니다.');
  var appNames=_gwAppPersonNames();
  var items=data.items;
  var skipped=[], usable=[];
  items.forEach(function(it){
    if(!it.ok){ skipped.push({it:it,reason:'제목 형식을 읽을 수 없음'}); return; }
    if(it.status!=='COMPLETE'){ skipped.push({it:it,reason:it.status==='RETURN'?'반려':'결재 진행중'}); return; }
    if(/취소/.test(it.kind)){ skipped.push({it:it,reason:'출장 취소 문서 — 앱 일정 직접 확인',cancel:true}); return; }
    usable.push(it);
  });
  // 한 출장(그룹): 같은 사람 + 같은 고객사/도시 + 기간이 겹치는 문서들을 기안 순서로 묶는다
  var groups=[];
  usable.sort(function(a,b){return (a.draftedAt+a.docNum)<(b.draftedAt+b.docNum)?-1:1;});
  usable.forEach(function(it){
    it.people.forEach(function(p){
      var key=_gwSiteKey(it), g=groups.find(function(x){
        return x.person===p&&x.key===key&&_gwOverlap(it.start,it.end,x.minStart,x.maxEnd);
      });
      if(!g){ g={person:p,key:key,docs:[],minStart:it.start,maxEnd:it.end}; groups.push(g); }
      g.docs.push(it);
      if(it.start<g.minStart) g.minStart=it.start;
      if(it.end>g.maxEnd) g.maxEnd=it.end;
    });
  });
  var used={}; // 이미 다른 그룹에 매칭된 앱 일정 id
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
    var cands=S.schedules.filter(function(sc){
      if(used[sc.id]) return false;
      if(!_gwPersonOf(sc).some(function(n){return names.indexOf(n)>=0||n.indexOf(g.person+' ')===0;})) return false;
      if(row.siteId&&_gwSchedSite(sc)!==row.siteId) return false;
      return _gwOverlap(sc.start,sc.end,g.minStart,g.maxEnd);
    }).sort(function(a,b){
      var oa=Math.min(a.end,g.maxEnd)<Math.max(a.start,g.minStart)?0:1;
      return (a.start===fin.start&&a.end===fin.end?0:1)-(b.start===fin.start&&b.end===fin.end?0:1)||(Math.abs(pd(a.start)-pd(fin.start))-Math.abs(pd(b.start)-pd(fin.start)));
    });
    var already=cands.find(function(sc){return (sc.gwDocs||[]).some(function(n){return docNums.indexOf(n)>=0;});});
    var m=already||cands[0];
    if(m){ used[m.id]=true; row.scId=m.id; row.cur={start:m.start,end:m.end}; row.curTask=m.task||''; row.multi=cands.length>1?cands.length:0; }
    // 분류
    var reasons=[];
    if(!row.siteId) reasons.push('사이트 매핑 필요');
    if(!m&&!appName) reasons.push('앱에 없는 출장자');
    if(!m&&!row.project) reasons.push('프로젝트명 없음');
    if(m){
      var same=m.start===fin.start&&m.end===fin.end;
      var docsLinked=docNums.every(function(n){return (m.gwDocs||[]).indexOf(n)>=0;});
      if(same&&docsLinked) row.cls='applied';
      else if(same) row.cls='match';
      else row.cls='update';
    }else row.cls='new';
    if(row.cls==='new'&&reasons.length) row.cls='check';
    if(row.cls==='update'&&!row.siteId) row.cls='check';
    row.reason=reasons.join(', ');
    return row;
  });
  // 앱에만 있는 2026년 일정(그룹웨어 문서와 매칭되지 않음)
  var year=data.year||'2026';
  var appOnly=S.schedules.filter(function(sc){
    return !used[sc.id]&&sc.end>=year+'-01-01'&&sc.start<=year+'-12-31'&&!(sc.gwDocs&&sc.gwDocs.length);
  }).map(function(sc){
    var site=S.sites.find(function(s){return s.id===_gwSchedSite(sc);});
    return {id:sc.id,name:sc.name,start:sc.start,end:sc.end,site:site?site.name:'',hidden:!!sc.hidden};
  }).sort(function(a,b){return a.start<b.start?-1:1;});
  _gwState={items:items,rows:rows,appOnly:appOnly,skipped:skipped,filter:'all',meta:{year:year,collectedAt:data.collectedAt,total:items.length}};
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
    return 'ok';
  }
  // 신규 등록
  if(!row.siteId) return 'site';
  var pname=(row.project||'').trim(); if(!pname) return 'project';
  var proj=S.projects.find(function(p){return p.siteId===row.siteId&&p.name===pname;});
  if(!proj){ proj=_touch({id:_createProjectId(pname),siteId:row.siteId,name:pname}); S.projects.push(proj); }
  var same=S.schedules.filter(function(s){return s.projectId===proj.id&&_gwPersonOf(s).indexOf(row.appName||row.person)>=0;}).length;
  var rec={id:genId('s',S.schedules),projectId:proj.id,task:(row.purpose||'출장').slice(0,80),name:row.appName||row.person,
    occSeq:Math.min(same+1,3),type:_gwPersonType(row),start:row.start,end:row.end,note:'그룹웨어 '+docNums.join(', '),hidden:false,
    domestic:/^(한국|국내)$/.test(row.country)};
  if(row.ext.length){ rec.origEnd=row.plan.end; rec.extensions=row.ext.map(function(e){return {seq:e.seq,end:e.end,note:e.note};}); }
  stamp(rec); S.schedules.push(_touch(rec));
  row.scId=rec.id; row.cur={start:rec.start,end:rec.end};
  return 'ok';
}
function _gwRowDone(row){ row.cls='applied'; row.selected=false; }

/* ── UI ── */
function openGwImport(){
  var html='<div class="mtit">그룹웨어 가져오기 — 해외출장 품의서 (2026년)</div>'
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
      +'<b>2. 그룹웨어에서 실행</b><br>그룹웨어(전자결재)에 로그인한 탭에서 북마크 <b>BU2 출장 수집</b>을 클릭하면 2026년 해외출장 품의서를 읽어 클립보드에 복사합니다. (제목·기간·사이트·프로젝트명·출장 목적·출장자·결재상태만 읽고, 비용·첨부·본문 전체는 가져오지 않습니다.)<br>'
      +'<b>3. 여기에 붙여넣기</b></div>'
      +'<textarea id="gw_paste" placeholder="여기에 붙여넣기 (Ctrl+V)" style="width:100%;height:90px;margin:8px 0;font-size:11px"></textarea>'
      +'<div id="gw_err" style="color:var(--tx-danger,#e05a5a);font-size:12px;min-height:16px"></div>'
      +'<button class="btn sm pri" onclick="gwAnalyzeClick()">분석</button>';
    return;
  }
  var cnt={new:0,update:0,match:0,applied:0,check:0};
  st.rows.forEach(function(r){ cnt[r.cls]++; });
  var chip=function(k,label,color){ return '<button class="gw-chip'+(st.filter===k?' on':'')+'" style="border-color:'+color+';color:'+color+'" onclick="gwSetFilter(\''+k+'\')">'+label+'</button>'; };
  var h='<div style="font-size:11px;color:var(--tx-muted);margin-bottom:6px">'+st.meta.total+'건 읽음 · 수집 '+_esc((st.meta.collectedAt||'').slice(0,16).replace('T',' '))+' · 결재 완료 문서만 반영 대상</div>';
  h+='<div class="gw-chips">'+chip('all','전체 '+st.rows.length,'#888')+chip('new','신규 '+cnt.new,'#4aaa70')+chip('update','수정 '+cnt.update,'#e0972e')+chip('match','일치 '+cnt.match+(cnt.applied?'(+반영됨 '+cnt.applied+')':''),'#5a9aee')
    +chip('check','확인 필요 '+cnt.check,'#e05a5a')+chip('apponly','앱에만 있음 '+st.appOnly.length,'#b39ddb')+chip('skipped','건너뜀 '+st.skipped.length,'#777')+'</div>';
  if(st.filter==='apponly'){
    h+='<div style="font-size:11px;color:var(--tx-muted);margin:6px 0">그룹웨어 2026년 품의서와 매칭되지 않은 앱 일정입니다(반영한 적 없는 일정). 품의서 없이 등록했거나 이름/사이트 표기가 달라 매칭되지 않은 경우입니다.</div>';
    h+='<div class="gw-wrap"><table class="gw-tbl"><thead><tr><th>출장자</th><th>사이트</th><th>기간</th><th>숨김</th></tr></thead><tbody>'
      +(st.appOnly.map(function(a){return '<tr><td>'+_esc(a.name)+'</td><td>'+_esc(a.site)+'</td><td>'+_esc(_gwFmt(a.start,a.end))+'</td><td>'+(a.hidden?'숨김':'')+'</td></tr>';}).join('')||'<tr><td colspan="4">없음</td></tr>')+'</tbody></table></div>';
  }else if(st.filter==='skipped'){
    h+='<div class="gw-wrap"><table class="gw-tbl"><thead><tr><th>문서</th><th>제목</th><th>사유</th></tr></thead><tbody>'
      +(st.skipped.map(function(s){return '<tr><td>'+_esc(s.it.docNum||'(번호 없음)')+'</td><td>'+_esc(s.it.titleRaw||'')+'</td><td>'+_esc(s.reason)+'</td></tr>';}).join('')||'<tr><td colspan="3">없음</td></tr>')+'</tbody></table></div>';
  }else{
    var rows=st.rows.filter(function(r){return st.filter==='all'||r.cls===st.filter||(st.filter==='match'&&r.cls==='applied');});
    var applyable=rows.filter(function(r){return r.cls==='new'||r.cls==='update'||r.cls==='match';}).length;
    h+='<div style="display:flex;gap:6px;align-items:center;margin:8px 0;flex-wrap:wrap">'
      +'<button class="btn sm" onclick="gwSelectAll(true)">신규·수정 전체 선택</button><button class="btn sm" onclick="gwSelectAll(false)">선택 해제</button>'
      +'<button class="btn sm pri" onclick="gwApplySelected()">선택 반영</button>'
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
  return {new:'<span style="color:#4aaa70">신규</span>',update:'<span style="color:#e0972e">수정</span>',match:'<span style="color:#5a9aee">일치</span>',applied:'<span style="color:#888">반영됨</span>',check:'<span style="color:#e05a5a">확인 필요</span>'}[r.cls];
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
    extra='<div class="gw-sub">프로젝트: <input type="text" value="'+_esc(r.project)+'" onchange="gwSetProject('+r.gi+',this.value)" style="width:150px" placeholder="프로젝트명"></div>';
    if(!r.appName) extra+='<div class="gw-sub">새 출장자 구분: <select onchange="gwSetType('+r.gi+',this.value)">'
      +[['tech','기술'],['outsource','외주'],['localOutsource','현지외주'],['hq','본사'],['vision','비전'],['host','호스트']].map(function(o){return '<option value="'+o[0]+'"'+(r.type===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select></div>';
  }
  var cur=r.cur?_esc(_gwFmt(r.cur.start,r.cur.end))+(r.multi?'<div class="gw-sub">후보 '+r.multi+'건 중 가장 가까운 일정</div>':''):'<span style="color:var(--tx-faint)">없음</span>';
  var canApply=(r.cls==='new'||r.cls==='update'||r.cls==='match'||(r.cls==='check'&&r.siteId&&(r.scId||r.project)));
  var btn=r.cls==='applied'?'':'<button class="btn sm pri" '+(canApply?'':'disabled ')+'onclick="gwApplyOne('+r.gi+')">'+(r.cls==='match'?'연결':'반영')+'</button>';
  return '<tr class="gw-'+r.cls+'"><td>'+((r.cls==='new'||r.cls==='update')?'<input type="checkbox" '+(r.selected?'checked':'')+' onchange="gwToggle('+r.gi+',this.checked)">':'')+'</td>'
    +'<td>'+_gwClsLabel(r)+(r.reason?'<div class="gw-sub" style="color:#e05a5a">'+_esc(r.reason)+'</div>':'')+'</td>'
    +'<td>'+_esc(r.appName||r.person)+(r.appName?'':'<div class="gw-sub">(앱에 없음)</div>')+'</td>'
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
function gwSetProject(gi,v){ _gwRow(gi).project=v.trim(); _gwRender(); }
function gwSetType(gi,v){ _gwRow(gi).type=v; }
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
    r.cls=same?((r.docNums.every(function(n){return (m.gwDocs||[]).indexOf(n)>=0;}))?'applied':'match'):'update';
    r.reason='';
  }else{
    r.scId=''; r.cur=null; r.multi=0;
    var reasons=[]; if(!r.appName) reasons.push('앱에 없는 출장자'); if(!r.project) reasons.push('프로젝트명 없음');
    r.cls=reasons.length?'check':'new'; r.reason=reasons.join(', ');
  }
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
