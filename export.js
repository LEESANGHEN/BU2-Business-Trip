/* ════════════════════════════════════════════
   엑셀 다운로드
════════════════════════════════════════════ */
function downloadExcel(){
  _ensureExcelJS(_doDownloadExcel);
}

function _ensureExcelJS(cb){
  if(!window.ExcelJS){
    var s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
    s.onload=cb;
    document.head.appendChild(s);
    return;
  }
  cb();
}

function _doDownloadExcel(){
  var wb=new ExcelJS.Workbook();
  wb.creator='BU2 출장 일정 관리';
  wb.created=new Date();
  _buildProjectsSheet(wb);
  _buildEquipSetupSheet(wb);
  wb.calcProperties={fullCalcOnLoad:true};   // 파일을 열 때 수식을 다시 계산
  _buildGanttSheet(wb);
  _buildPersonSheet(wb);
  _buildMonthlyAggSheet(wb);
  wb.xlsx.writeBuffer().then(function(buf){
    var blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a');
    a.href=url;
    var d=new Date();
    a.download='출장일정관리_'+d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')+'.xlsx';
    a.click();
    setTimeout(function(){URL.revokeObjectURL(url);},1000);
  });
}

/* ── 공통 유틸 ── */
function _xArgb(hex){
  hex=(hex||'#888888').replace('#','');
  if(hex.length===3) hex=hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
  return 'FF'+hex.toUpperCase();
}

function _xStyle(cell,opts){
  var bgColor=opts.bg?_xArgb(opts.bg):'FF18181E';
  var fgColor=opts.fg?_xArgb(opts.fg):'FFC8C8D4';
  cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:bgColor}};
  cell.font={name:'맑은 고딕',size:opts.size||10,color:{argb:fgColor},bold:!!opts.bold};
  cell.alignment={vertical:'middle',horizontal:opts.align||'center',wrapText:!!opts.wrap};
  var bc={argb:'FF3A3A44'};
  cell.border={top:{style:'thin',color:bc},bottom:{style:'thin',color:bc},left:{style:'thin',color:bc},right:{style:'thin',color:bc}};
}


/* ── Sheet: 프로젝트관리 ── */
function _buildProjectsSheet(wb){
  var ws=wb.addWorksheet('프로젝트관리');
  // 프로젝트 관리 탭에서 내려받으면 화면에 보이는 목록(필터·검색·정렬 그대로), 다른 탭에서는 숨기지 않은 전체 프로젝트
  var rows;
  if(typeof _activeTab!=='undefined'&&_activeTab==='projects') rows=_mpScreenRows();
  else rows=_mpActive().slice().sort(function(a,b){
    var tieFields=['category','region','customer','projectName'];
    for(var i=0;i<tieFields.length;i++){
      var f=tieFields[i];
      var tv=String(a[f]||'').localeCompare(String(b[f]||''),'ko');
      if(tv!==0) return tv;
    }
    var uv=_mpUnitCompare(a.prodUnit,b.prodUnit);
    if(uv!==0) return uv;
    return _mpUnitCompare(a.customerUnit,b.customerUnit);
  });

  // 열 구성은 프로젝트 관리 탭 화면(renderProjectsTable)과 같은 순서·같은 제목
  var cols=[
    {label:_xColLbl('colCategory',t('colCategory')),w:12,align:'center'},
    {label:_xColLbl('colCustomerHdr',t('mpCustomer')),w:16,align:'left'},
    {label:_xColLbl('colProject',t('colProject')),w:22,align:'left'},
    {label:_xColLbl('colSerialNo','설비 시리얼 넘버'),w:18,align:'left'},
    {label:_xColLbl('colUnitCombined2',(typeof _lang!=='undefined'&&_lang!=='ko')?t('colUnitCombined'):'생산 호기(현장 호기)'),w:22,align:'left'},
    {label:_xColLbl('colTransferDay','이관일'),w:11,align:'center'},
    {label:_xColLbl('colSetupLocation',t('colSetupLocation')),w:16,align:'left'},
    {label:_xColLbl('colSetupDone2','셋업 완료'),w:11,align:'center'},
    {label:_xColLbl('colShipDay','출하일'),w:11,align:'center'},
    {label:_xColLbl('colTransferToShip','이관→출하'),w:11,align:'center'},
    {label:_xColLbl('colFieldSetupMgr','Field 셋업 담당'),w:16,align:'left'},
    {label:_xColLbl('mpStatus',t('mpStatus')),w:13,align:'center'}
  ];
  ws.columns=cols.map(function(c){return {width:c.w};});
  ws.views=[{state:'frozen',ySplit:1}];

  if(!rows.length){
    ws.getCell('A1').value='등록된 프로젝트가 없습니다.';
    return;
  }

  var hRow=ws.getRow(1);
  cols.forEach(function(c,i){
    var cell=hRow.getCell(i+1);
    cell.value=c.label;
    _xStyle(cell,{bg:'#2a2a3e',fg:'#e0e0ec',bold:true,wrap:true});
  });
  hRow.height=24;
  ws.autoFilter={from:{row:1,column:1},to:{row:1,column:cols.length}};

  var rIdx=2;
  rows.forEach(function(mp){
    var bg=rIdx%2===0?'#1c1c24':'#181820';
    // 화면(renderProjectRow)과 같은 표기: 호기는 "생산 70호기_(현장 3호기)", 날짜는 YY.MM.DD, 빈 값은 "-"
    var prodLbl=mp.prodUnit?('생산 '+mp.prodUnit):'';
    var unitLbl=(prodLbl&&mp.customerUnit)?(prodLbl+'_(현장 '+mp.customerUnit+')'):(prodLbl||(mp.customerUnit?('현장 '+mp.customerUnit):''));
    var days=_mpDaysToShip(mp);
    var cat=_mpCatNorm(mp.category);
    var stEff=_mpEffectiveStatus(mp);
    var vals=[
      cat,
      mp.customer||'',
      mp.projectName||'',
      mp.serial||'',
      unitLbl,
      _mpFd(_mpEffectiveTransferDate(mp))||'-',
      mp.setupLocation||'-',
      _mpFd(mp.setupDone)||'-',
      _mpFd(_mpEffectiveShipDate(mp))||'-',
      days==null?'-':days+'일',
      mp.tripManager||'-',
      stEff?tStatus(stEff):''
    ];
    var row=ws.getRow(rIdx);
    vals.forEach(function(v,i){
      var cell=row.getCell(i+1);
      cell.value=v;
      var o={bg:bg,fg:'#c8c8d4',align:cols[i].align};
      // 구분·상태는 화면의 색 배지와 같은 색으로 표시
      if(i===0) _xBadgeOpts(o,_MP_CATEGORY_BADGE_STYLE[cat]);
      if(i===11) _xBadgeOpts(o,_MP_STATUS_BADGE_STYLE[stEff]);
      _xStyle(cell,o);
    });
    row.height=17;
    rIdx++;
  });
}

// 열 제목: 관리자가 바꾼 표 제목(한국어 화면)이 있으면 화면과 똑같이 반영 ('/'는 줄바꿈)
function _xColLbl(key,defaultLbl){
  if(typeof _lang!=='undefined'&&_lang!=='ko') return defaultLbl;
  var ov=(S.labelOverrides||{})[key];
  if(ov===undefined||ov==='') return defaultLbl;
  return String(ov).split('/').join('\n');
}
// 배지 CSS 문자열("background:#2e2050;color:#b39ddb;...")에서 배경·글자색을 뽑는다 (var(--…)처럼 색을 못 뽑으면 기본색 유지)
function _xBadgeOpts(o,css){
  if(!css) return;
  var bgm=/background:\s*(#[0-9a-fA-F]{3,6})/.exec(css), fgm=/(?:^|;)\s*color:\s*(#[0-9a-fA-F]{3,6})/.exec(css);
  if(bgm) o.bg=bgm[1];
  if(fgm) o.fg=fgm[1];
}

/* ── Sheet: HQ 설비 셋업 진행률 ──
   파일 안에서도 앱과 같이 동작하도록 만든다(매크로는 .xlsx에 넣을 수 없어 수식·입력 제한·조건부 서식·필터를 쓴다).
   · 항목 칸 = 완료일(날짜). 날짜를 입력하면 완료, 비우면 미완료 → 진행률·이관·출하가 수식으로 자동 계산된다
   · 진행률 = 완료한 항목 수 ÷ 전체 항목 수 (앱의 호기별 진행률과 같은 값)
   · 이관/출하 = 오른쪽 「이관(생산▶BU2)」「설비 출하」 칸에 날짜가 있으면 ☑ + 날짜
   · 항목 칸에는 날짜만 입력되게 데이터 유효성을 걸고, 완료된 칸은 조건부 서식으로 초록색이 된다
   · 하단 요약(호기 수·평균 진행률)은 필터를 걸면 보이는 행만 기준으로 다시 계산된다 */
function _buildEquipSetupSheet(wb){
  var ws=wb.addWorksheet('HQ설비셋업진행률');
  var items=_sortedEquipItemsGrouped();
  // HQ 설비 셋업 진행률 탭에서 내려받으면 화면에 보이는 호기(필터·완료 숨김 그대로), 다른 탭에서는 전체 호기
  var onTab=(typeof _activeTab!=='undefined'&&_activeTab==='equip');
  var order=(typeof ensureEquipSiteOrder==='function')?(ensureEquipSiteOrder(),S.equipSiteOrder||[]):[];
  var units=S.equipUnits.map(function(u,i){return {u:u,i:i};}).filter(function(x){return onTab?_eqUnitVisible(x.u):true;})
    .sort(function(a,b){
      var ia=order.indexOf(a.u.siteId), ib=order.indexOf(b.u.siteId);
      ia=ia<0?9999:ia; ib=ib<0?9999:ib;
      return ia-ib||a.i-b.i;
    }).map(function(x){return x.u;});

  var FIX=7;                                   // 앞쪽 고정 열: 구분·라인·호기·셋업 위치·진행률·이관·출하
  var N=items.length, c1=FIX+1, cN=FIX+N;      // 항목 열 범위(1-based 열 번호)
  function L(col){ var s=''; while(col>0){ var m=(col-1)%26; s=String.fromCharCode(65+m)+s; col=Math.floor((col-1)/26); } return s; }
  var widths=[16,20,24,11,10,13,13].concat(items.map(function(){return 12;}));
  ws.columns=widths.map(function(w){return {width:w};});
  ws.views=[{state:'frozen',xSplit:3,ySplit:1}];

  var hdr=['구분(고객사)','라인(설비명)','호기','셋업 위치','진행률','이관','출하'].concat(items.map(function(i){return i.name;}));
  var hRow=ws.getRow(1);
  hdr.forEach(function(h,i){
    var cell=hRow.getCell(i+1); cell.value=h;
    _xStyle(cell,{bg:'#1f3d63',fg:'#eaf3ff',bold:true,wrap:true});
  });
  hRow.height=34;

  if(!units.length){
    ws.getCell('A2').value='표시할 호기가 없습니다.';
    return;
  }
  var trItem=items.find(function(i){return i.name==='이관(생산▶BU2)';});
  var shItem=items.find(function(i){return i.name==='설비 출하';});
  var trCol=trItem?FIX+1+items.indexOf(trItem):0, shCol=shItem?FIX+1+items.indexOf(shItem):0;

  function toDate(s){ var m=/^(\d{4})-(\d{2})-(\d{2})/.exec(s||''); return m?new Date(Date.UTC(+m[1],+m[2]-1,+m[3])):null; }
  function sd(s){ return s?String(s).slice(2).replace(/-/g,'.'):''; }
  var locOf=function(u){ var k=_eqLocKeyOf(u.autoLoc); var l=_EQ_LOCS.find(function(x){return x.key===k;}); return l?l.label:(u.autoLoc||''); };

  var rIdx=2;
  units.forEach(function(u){
    var bg=rIdx%2===0?'#1c1c24':'#181820';
    var site=_eqSite(u.siteId);
    var row=ws.getRow(rIdx);
    var firstL=L(c1), lastL=L(cN);
    var done=0;
    var itemVals=items.map(function(it){
      var c=(u.cells||{})[it.id];
      var ok=!!(c&&!c.na&&(parseFloat(c.percent)||0)>=100);
      if(ok) done++;
      return {ok:ok,c:c};
    });
    var pct=N?done/N:0;
    // 이관·출하 표시값(수식 결과 미리보기용)
    function stage(col){
      if(!col) return '☐';
      var v=itemVals[col-c1]; if(!v.ok) return '☐';
      return v.c.doneDate?('☑ '+sd(v.c.doneDate)):'☑';
    }
    var A=u.autoCustomer||(site?site.name:u.siteId), B=u.lineName||'', C=u.unitName||'', D=locOf(u);
    [A,B,C,D].forEach(function(v,i){
      var cell=row.getCell(i+1); cell.value=v;
      _xStyle(cell,{bg:bg,fg:'#c8c8d4',align:i===3?'center':'left'});
    });
    // 진행률 = 완료한 항목 수 ÷ 전체 항목 수
    var pc=row.getCell(5);
    // 결과가 0이면 미리보기 값이 빠지는 라이브러리 특성 때문에 아주 작은 값으로 대신한다(엑셀이 열릴 때 다시 계산하며 표시는 0%)
    pc.value={formula:'COUNTA('+firstL+rIdx+':'+lastL+rIdx+')/COLUMNS('+firstL+rIdx+':'+lastL+rIdx+')',result:pct||1e-9};
    pc.numFmt='0%'; _xStyle(pc,{bg:bg,fg:'#c8c8d4',align:'center',bold:true});
    // 이관 / 출하: 해당 항목 칸에 값(완료일)이 있으면 ☑ + 날짜
    [[6,trCol],[7,shCol]].forEach(function(p){
      var cell=row.getCell(p[0]);
      if(p[1]){
        var ref=L(p[1])+rIdx;
        cell.value={formula:'IF('+ref+'<>"",IF(ISNUMBER('+ref+'),"☑ "&TEXT('+ref+',"yy.mm.dd"),"☑"),"☐")',result:stage(p[1])};
      } else cell.value='☐';
      _xStyle(cell,{bg:bg,fg:'#c8c8d4',align:'center'});
    });
    // 항목 칸: 완료일(날짜). 특이사항은 셀 메모로 붙인다
    items.forEach(function(it,j){
      var cell=row.getCell(c1+j), v=itemVals[j];
      if(v.ok){ var d=toDate(v.c.doneDate); cell.value=d||'완료'; if(d) cell.numFmt='yy.mm.dd'; }
      if(v.c&&v.c.note) cell.note=String(v.c.note);
      _xStyle(cell,{bg:bg,fg:'#c8c8d4',align:'center'});
      cell.dataValidation={type:'date',operator:'greaterThan',formulae:[new Date(Date.UTC(2020,0,1))],allowBlank:true,
        showInputMessage:true,promptTitle:'완료일',prompt:'날짜를 입력하면 완료, 비우면 미완료입니다. (예: 2026-11-09)',
        showErrorMessage:true,errorStyle:'stop',errorTitle:'날짜만 입력',error:'완료일을 날짜로 입력해 주세요 (예: 2026-11-09). 비우면 미완료입니다.'};
    });
    row.height=20;
    rIdx++;
  });
  var last=rIdx-1;

  // 조건부 서식: 완료된 항목 칸 = 초록, 진행률 구간별 색, 이관·출하 ☑ = 강조
  var green={font:{color:{argb:'FF4AAA70'},bold:true},fill:{type:'pattern',pattern:'solid',bgColor:{argb:'FF0A3D1E'}}};
  ws.addConditionalFormatting({ref:L(c1)+'2:'+L(cN)+last,rules:[{type:'expression',priority:1,formulae:['LEN('+L(c1)+'2)>0'],style:green}]});
  ws.addConditionalFormatting({ref:'E2:E'+last,rules:[
    {type:'cellIs',priority:2,operator:'greaterThanOrEqual',formulae:[1],style:{font:{color:{argb:'FF4AAA70'},bold:true}}},
    {type:'cellIs',priority:3,operator:'greaterThanOrEqual',formulae:[0.5],style:{font:{color:{argb:'FF4A9EEE'},bold:true}}},
    {type:'cellIs',priority:4,operator:'greaterThan',formulae:[0],style:{font:{color:{argb:'FFE8A020'},bold:true}}}
  ]});
  ws.addConditionalFormatting({ref:'F2:G'+last,rules:[{type:'expression',priority:5,formulae:['LEFT(F2,1)="☑"'],style:{font:{color:{argb:'FF5A9AEE'},bold:true}}}]});

  // 필터 + 하단 요약(필터를 걸면 보이는 행 기준으로 재계산)
  ws.autoFilter={from:{row:1,column:1},to:{row:1,column:cN}};
  var sRow=last+2;
  var avg=0; units.forEach(function(u){ var d=0; items.forEach(function(it){ var c=(u.cells||{})[it.id]; if(c&&!c.na&&(parseFloat(c.percent)||0)>=100) d++; }); avg+=N?d/N:0; });
  avg=units.length?avg/units.length:0;
  var lab1=ws.getCell(sRow,3), val1=ws.getCell(sRow,5), lab2=ws.getCell(sRow+1,3), val2=ws.getCell(sRow+1,5), lab3=ws.getCell(sRow+2,3), val3=ws.getCell(sRow+2,5);
  lab1.value='표시 호기 수'; val1.value={formula:'SUBTOTAL(103,C2:C'+last+')',result:units.length};
  lab2.value='평균 진행률'; val2.value={formula:'SUBTOTAL(101,E2:E'+last+')',result:avg}; val2.numFmt='0%';
  lab3.value='출하 완료 호기'; val3.value={formula:'COUNTIF(G2:G'+last+',"☑*")',result:units.filter(function(u){return _eqShipDone(u);}).length||1e-9};
  val1.numFmt='0'; val3.numFmt='0';
  [lab1,lab2,lab3].forEach(function(c){ _xStyle(c,{bg:'#2a2a3e',fg:'#e0e0ec',bold:true,align:'left'}); });
  [val1,val2,val3].forEach(function(c){ _xStyle(c,{bg:'#2a2a3e',fg:'#e0e0ec',bold:true,align:'center'}); });
  var note=ws.getCell(sRow+4,1);
  note.value='사용법: 항목 칸에 완료일(날짜)을 입력하면 진행률·이관·출하가 자동 계산됩니다. 비우면 미완료입니다. 특이사항은 칸의 메모로 들어 있습니다.';
  note.font={name:'맑은 고딕',size:10,color:{argb:'FF9A9AB0'},italic:true};
}

/* ── Sheet: 월별집계 ── */
function _buildMonthlyAggSheet(wb){
  var ws=wb.addWorksheet('월별집계');
  var months=_mpAllMonths();

  ws.columns=[10,12,34,12,34,10,40].map(function(w){return {width:w};});
  ws.views=[{state:'frozen',ySplit:1}];

  if(!months.length){
    ws.getCell('A1').value='집계할 데이터가 없습니다.';
    return;
  }

  var hdr=['월','본사 셋업 설비 수','본사 셋업 설비군','현장 셋업 설비 수','현장 셋업 설비군','출장 인원','출장 인원 명단'];
  var hRow=ws.getRow(1);
  hdr.forEach(function(h,i){
    var cell=hRow.getCell(i+1);
    cell.value=h;
    _xStyle(cell,{bg:'#2a2a3e',fg:'#e0e0ec',bold:true,wrap:true});
  });
  hRow.height=20;

  var rIdx=2;
  months.forEach(function(ym){
    var hq=_mpMonthGroup(ym,'hq');
    var site=_mpMonthGroup(ym,'site');
    var people=_mpMonthTravelers(ym);
    var bg=rIdx%2===0?'#1c1c24':'#181820';
    var row=ws.getRow(rIdx);
    [ym,hq.count,hq.list.join('\n'),site.count,site.list.join('\n'),people.count,people.list.join('\n')].forEach(function(v,i){
      var cell=row.getCell(i+1);
      cell.value=v;
      _xStyle(cell,{bg:bg,fg:'#c8c8d4',align:(i===0||i===1||i===3||i===5)?'center':'left',wrap:(i===2||i===4||i===6)});
    });
    row.height=Math.max(17,15*Math.max(hq.list.length,site.list.length,people.list.length,1));
    rIdx++;
  });
}

/* ── Sheet 1: 간트차트 ── */
function _buildGanttSheet(wb){
  var ws=wb.addWorksheet('간트차트');
  var colWidths=[12,10,30,10,12,8,13,13,9,20];
  var colHdrs=['그룹','사이트','프로젝트','업무','출장자','유형','시작일','종료일','기간(일)','비고'];
  ws.columns=colHdrs.map(function(h,i){return {width:colWidths[i]};});
  ws.views=[{state:'frozen',ySplit:1}];

  var hRow=ws.getRow(1);
  colHdrs.forEach(function(h,i){
    var cell=hRow.getCell(i+1);
    cell.value=h;
    _xStyle(cell,{bg:'#2a2a3e',fg:'#e0e0ec',bold:true});
  });
  hRow.height=20;

  var typeLabel={hq:'본사',outsource:'외주',tech:'기술',vision:'비전',host:'호스트',localOutsource:'현지외주'};
  var rows=[];
  S.schedules.forEach(function(sc){
    var proj=S.projects.find(function(p){return p.id===sc.projectId;});
    if(!proj) return;
    var site=S.sites.find(function(s){return s.id===proj.siteId;});
    var grpObj=site&&site.groupId?S.groups.find(function(g){return g.id===site.groupId;}):null;
    rows.push({
      grp:grpObj?grpObj.name:'',
      siteIdx:S.sites.indexOf(site),
      siteId:proj.siteId,
      siteName:site?site.name:proj.siteId,
      siteColor:site?site.color:'#555555',
      proj:proj.name,
      task:sc.task||'',
      name:sc.name||'',
      typeLabel:typeLabel[sc.type]||sc.type||'',
      typeRaw:sc.type||'hq',
      start:sc.start,
      end:sc.end,
      days:_tripTotalDays(sc),
      note:sc.note||''
    });
  });
  rows.sort(function(a,b){
    if(a.siteIdx!==b.siteIdx) return a.siteIdx-b.siteIdx;
    return a.start>b.start?1:-1;
  });

  var prevSiteId=null;
  var rIdx=2;
  rows.forEach(function(r){
    if(r.siteId!==prevSiteId){
      ws.mergeCells(rIdx,1,rIdx,10);
      var sepCell=ws.getRow(rIdx).getCell(1);
      sepCell.value=r.siteName;
      _xStyle(sepCell,{bg:r.siteColor,fg:'#ffffff',bold:true,align:'left'});
      ws.getRow(rIdx).height=18;
      rIdx++;
      prevSiteId=r.siteId;
    }
    var bg=r.typeRaw==='hq'?'#0d1e33':(r.typeRaw==='outsource'?'#1e1400':'#181820');
    var dataRow=ws.getRow(rIdx);
    [r.grp,r.siteName,r.proj,r.task,r.name,r.typeLabel,r.start,r.end,r.days,r.note].forEach(function(v,i){
      var cell=dataRow.getCell(i+1);
      cell.value=v;
      _xStyle(cell,{bg:bg,fg:'#c8c8d4',align:(i>=6&&i<=8)?'center':'left'});
    });
    dataRow.height=17;
    rIdx++;
  });
}

/* ── Sheet 2: 인원출장일 ── */
function _buildPersonSheet(wb){
  var ws=wb.addWorksheet('인원출장일');
  var allPersons=aggregatePersonTrips();
  var rolling12=getRolling12();
  var names=Object.keys(allPersons).sort(function(a,b){return a.localeCompare(b,'ko');});

  ws.columns=[12,8,22,14,14,18,16,10].map(function(w){return {width:w};});
  ws.views=[{state:'frozen',ySplit:1}];

  if(!names.length){
    ws.getCell('A1').value='등록된 출장 일정이 없습니다.';
    return;
  }

  var sumHdr=['이름','유형','현재상태','미주12M(일)','유럽12M(일)','전체해외12M(일)','현연속국내(일)','B1위험도'];
  var hRow=ws.getRow(1);
  sumHdr.forEach(function(h,i){
    var cell=hRow.getCell(i+1);
    cell.value=h;
    _xStyle(cell,{bg:'#2a2a3e',fg:'#e0e0ec',bold:true});
  });
  hRow.height=20;

  var typeLabel={hq:'본사',outsource:'외주',tech:'기술',vision:'비전',host:'호스트',localOutsource:'현지외주'};
  var rIdx=2;
  names.forEach(function(name){
    var p=allPersons[name];
    var loc=getCurrentLocation(p.trips);
    var status=loc.onTrip?'출장중 ('+loc.siteName+')':'국내';
    var americas=calcRegionDays12M(p.trips,'americas',rolling12);
    var europe=calcRegionDays12M(p.trips,'europe',rolling12);
    var total=calcTotalOverseas12M(p.trips,rolling12);
    var korCur=calcCurrentKoreaDays(p.trips);
    var b1Risk=americas>=150?'위험':americas>=100?'주의':'안전';
    var b1Color=americas>=150?'#ff4444':americas>=100?'#ffaa00':'#4aaa70';
    var bg=rIdx%2===0?'#1c1c24':'#181820';
    var row=ws.getRow(rIdx);
    [name,typeLabel[p.type]||p.type,status,americas,europe,total,korCur,b1Risk].forEach(function(v,i){
      var cell=row.getCell(i+1);
      cell.value=v;
      _xStyle(cell,{bg:bg,fg:i===7?b1Color:'#c8c8d4',align:i>=3?'center':'left',bold:i===7});
    });
    row.height=17;
    rIdx++;
  });

  rIdx+=2;

  var detHdr=['이름','사이트','업무','시작일','종료일','기간(일)','상태'];
  var detHRow=ws.getRow(rIdx);
  detHdr.forEach(function(h,i){
    var cell=detHRow.getCell(i+1);
    cell.value=h;
    _xStyle(cell,{bg:'#2a2a3e',fg:'#e0e0ec',bold:true});
  });
  detHRow.height=20;
  rIdx++;

  var stLabel={done:'완료',going:'출장중',plan:'예정'};
  var stColor={done:'#888888',going:'#2176cc',plan:'#0f9e6e'};
  names.forEach(function(name){
    var p=allPersons[name];
    p.trips.forEach(function(t){
      var bg=rIdx%2===0?'#1c1c24':'#181820';
      var row=ws.getRow(rIdx);
      [name,t.siteName,t.task||'',t.start,t.end,t.days,stLabel[t.status]||t.status].forEach(function(v,i){
        var cell=row.getCell(i+1);
        cell.value=v;
        _xStyle(cell,{bg:bg,fg:i===6?(stColor[t.status]||'#c8c8d4'):'#c8c8d4',align:i>=3?'center':'left'});
      });
      row.height=17;
      rIdx++;
    });
  });
}

/* ── Sheet 3: 설비진행율 ── */
function _buildEquipSheet(wb){
  var ws=wb.addWorksheet('설비진행율');
  var items=S.equipItems.slice().sort(function(a,b){return a.order-b.order;});
  var msDateItem=items.find(function(i){return i.id==='ei21';});
  var scrollItems=items.filter(function(i){return i.id!=='ei21';});
  var totalCols=6+scrollItems.length;

  var colDefs=[
    {header:'사이트',width:12},
    {header:'라인',width:8},
    {header:'호기',width:14},
    {header:'진행율(%)',width:10},
    {header:msDateItem?msDateItem.name:'양산시작',width:12},
    {header:'메모',width:22}
  ].concat(scrollItems.map(function(item){
    return {header:item.name+(item.groupName?'\n['+item.groupName+']':''),width:14};
  }));

  ws.columns=colDefs.map(function(c){return {width:c.width};});
  ws.views=[{state:'frozen',ySplit:1}];

  var hRow=ws.getRow(1);
  colDefs.forEach(function(c,i){
    var cell=hRow.getCell(i+1);
    cell.value=c.header;
    _xStyle(cell,{bg:'#2a2a3e',fg:'#e0e0ec',bold:true,wrap:true});
  });
  hRow.height=32;

  if(!S.equipUnits.length){
    ws.getCell('A2').value='등록된 설비가 없습니다.';
    return;
  }

  ensureEquipSiteOrder();
  var siteIds=S.equipSiteOrder.filter(function(id){
    return S.equipUnits.some(function(u){return u.siteId===id;});
  });
  S.equipUnits.forEach(function(u){
    if(siteIds.indexOf(u.siteId)<0) siteIds.push(u.siteId);
  });

  var rIdx=2;
  var todayStr=TODAY.getFullYear()+'-'+String(TODAY.getMonth()+1).padStart(2,'0')+'-'+String(TODAY.getDate()).padStart(2,'0');

  siteIds.forEach(function(siteId){
    var site=S.sites.find(function(s){return s.id===siteId;});
    var siteName=site?site.name:siteId;
    var siteColor=site?site.color:'#555555';
    var siteUnits=S.equipUnits.filter(function(u){return u.siteId===siteId;});
    if(!siteUnits.length) return;

    ws.mergeCells(rIdx,1,rIdx,totalCols);
    var sepCell=ws.getRow(rIdx).getCell(1);
    sepCell.value=siteName;
    _xStyle(sepCell,{bg:siteColor,fg:'#ffffff',bold:true,align:'left'});
    ws.getRow(rIdx).height=18;
    rIdx++;

    siteUnits.forEach(function(unit,idx){
      var unitPct=calcUnitProgress(unit);
      var bg=idx%2===0?'#1c1c24':'#181820';
      var isDone=unitPct===100;
      var rowBg=isDone?'#091810':bg;
      var row=ws.getRow(rIdx);

      [siteName,unit.lineName||'',unit.unitName||''].forEach(function(v,i){
        var cell=row.getCell(i+1);
        cell.value=v;
        _xStyle(cell,{bg:rowBg,fg:'#c8c8d4',align:'left'});
      });

      var pctCell=row.getCell(4);
      pctCell.value=unitPct;
      _xStyle(pctCell,{bg:rowBg,fg:isDone?'#4aaa70':'#c8c8d4',align:'center',bold:isDone});

      var msRaw=msDateItem?(unit.cells||{})[msDateItem.id]:null;
      _buildEquipXCell(row.getCell(5),msRaw,rowBg,todayStr);

      var memoCell=row.getCell(6);
      memoCell.value=unit.memo||'';
      _xStyle(memoCell,{bg:rowBg,fg:'#b0b0c0',align:'left'});

      scrollItems.forEach(function(item,iIdx){
        var rawCell=(unit.cells||{})[item.id];
        _buildEquipXCell(row.getCell(7+iIdx),rawCell,rowBg,todayStr);
      });

      row.height=17;
      rIdx++;
    });
  });
}

function _buildEquipXCell(exCell,cell,defaultBg,todayStr){
  cell=_migrateEquipCell(cell);
  if(cell.na){
    exCell.value='N/A';
    _xStyle(exCell,{bg:'#1a1a1a',fg:'#555566',align:'center'});
    return;
  }
  var pct=parseFloat(cell.percent)||0;
  var isDone=pct>=100;
  var isOver=cell.planDate&&cell.planDate<todayStr&&!isDone;
  var parts=[];
  if(cell.planDate) parts.push(cell.planDate);
  parts.push(pct+'%');
  if(isDone&&cell.doneDate) parts.push('완료 '+cell.doneDate);
  exCell.value=parts.join(' · ')+(isDone?' ✓':'');
  if(isDone){
    _xStyle(exCell,{bg:'#0a1e10',fg:'#4aaa70',align:'center',bold:true});
  } else {
    _xStyle(exCell,{bg:defaultBg,fg:isOver?'#ff6060':(pct>=90?'#7adeaa':'#c8c8d4'),align:'center'});
  }
}

/* ── Sheet 4: 이력관리 ── */
function _buildVisionSheet(wb){
  if(!S.visionEquips||!S.visionEquips.length) return;
  var ws=wb.addWorksheet('이력관리');

  var hdrs=[
    {label:'사이트',      w:12},
    {label:'라인',        w:10},
    {label:'호기',        w:14},
    {label:'Vision Type', w:20},
    {label:'S/N',         w:16},
    {label:'특이사항',    w:24},
    {label:'프로그램',    w:26},
    {label:'카메라',      w:32},
    {label:'조명',        w:26},
    {label:'트리거보드',  w:28},
    {label:'PC 정보',     w:52}
  ];

  ws.columns=hdrs.map(function(h){return {width:h.w};});
  ws.views=[{state:'frozen',ySplit:1}];

  var hRow=ws.getRow(1);
  hdrs.forEach(function(h,i){
    var cell=hRow.getCell(i+1);
    cell.value=h.label;
    _xStyle(cell,{bg:'#2a2a3e',fg:'#e0e0ec',bold:true,wrap:true});
  });
  hRow.height=28;

  /* ── 포맷 헬퍼 ── */
  function fmtCams(arr){
    if(!arr||!arr.length) return '';
    return arr.map(function(c){
      return (c.model||'')+(c.sn?' ['+c.sn+']':'');
    }).join(' / ');
  }
  function fmtProgs(arr){
    if(!arr||!arr.length) return '';
    return arr.map(function(p){
      return (p.name||'')+(p.version?' v'+p.version:'');
    }).join(' / ');
  }
  function fmtBoards(allBoards,type){
    if(!allBoards||!allBoards.length) return '';
    return allBoards.filter(function(b){
      return !b.types||!b.types.length||(type&&b.types.indexOf(type)>=0);
    }).map(function(b){
      var parts=[];
      if(b.model) parts.push(b.model);
      if(b.board) parts.push(b.board);
      if(b.fw)    parts.push('FW:'+b.fw);
      return parts.join(' / ');
    }).join('\n');
  }
  function fmtPcs(arr){
    if(!arr||!arr.length) return '';
    return arr.map(function(pc,i){
      var parts=[pc.name||('PC'+(i+1))];
      if(pc.cpu&&pc.cpu.spec)      parts.push('CPU: '+pc.cpu.spec+(pc.cpu.qty?'×'+pc.cpu.qty:''));
      if(pc.mainboard&&pc.mainboard.spec) parts.push('MB: '+pc.mainboard.spec);
      if(pc.vga&&pc.vga.spec)      parts.push('VGA: '+pc.vga.spec);
      if(Array.isArray(pc.ram)&&pc.ram.length)
        parts.push('RAM: '+pc.ram.map(function(r){return (r.capacity||'')+(r.qty?'×'+r.qty:'');}).join('+'));
      if(Array.isArray(pc.ssd)&&pc.ssd.length)
        parts.push('SSD: '+pc.ssd.map(function(s){return (s.capacity||'')+(s.qty?'×'+s.qty:'')+(s.drive?' ('+s.drive+')':'');}).join('+'));
      if(Array.isArray(pc.fg)&&pc.fg.length)
        parts.push('FG: '+pc.fg.map(function(f){return (f.model||'')+(f.board?'/'+f.board:'')+(f.fw?' FW:'+f.fw:'');}).join(', '));
      if(Array.isArray(pc.lancard)&&pc.lancard.length)
        parts.push('LAN: '+pc.lancard.map(function(l){return (l.speed||'')+(l.ports?'×'+l.ports:'')+(l.purpose?' ('+l.purpose+')':'');}).join(', '));
      if(pc.os)      parts.push('OS: '+pc.os);
      if(pc.license) parts.push('License: '+pc.license);
      return parts.join(' | ');
    }).join('\n');
  }

  /* ── 사이트별 그룹 ── */
  var bysite={};
  S.visionEquips.forEach(function(e){
    var sid=e.siteId||'기타';
    if(!bysite[sid])bysite[sid]=[];
    bysite[sid].push(e);
  });
  var siteOrder=S.sites.map(function(s){return s.id;}).filter(function(id){return bysite[id];});
  Object.keys(bysite).forEach(function(k){if(siteOrder.indexOf(k)<0)siteOrder.push(k);});

  var rIdx=2;
  siteOrder.forEach(function(sid){
    var site=S.sites.find(function(s){return s.id===sid;});
    var siteName=site?site.name:sid;
    var siteColor=site?site.color:'#555555';

    ws.mergeCells(rIdx,1,rIdx,hdrs.length);
    var sepCell=ws.getRow(rIdx).getCell(1);
    sepCell.value=siteName;
    _xStyle(sepCell,{bg:siteColor,fg:'#ffffff',bold:true,align:'left'});
    ws.getRow(rIdx).height=18;
    rIdx++;

    bysite[sid].forEach(function(e,eidx){
      var d=e.data||{};
      var typeVal=d['vi_type'];
      var types=Array.isArray(typeVal)?typeVal:(typeVal?[typeVal]:[null]);
      var allBoards=Array.isArray(d['vi_board_trig'])?d['vi_board_trig']:[];
      var snRaw=d['vi_sn'];

      types.forEach(function(type){
        var bg=eidx%2===0?'#1c1c24':'#181820';
        var sn=(snRaw&&typeof snRaw==='object')?(snRaw[type]||''):(snRaw||'');
        var cams  =(d.vi_cameras     &&Array.isArray(d.vi_cameras[type]))    ?d.vi_cameras[type]    :[];
        var illums=(d.vi_illumination&&Array.isArray(d.vi_illumination[type]))?d.vi_illumination[type]:[];
        var progs =(d.vi_program     &&Array.isArray(d.vi_program[type]))    ?d.vi_program[type]    :[];
        var pcs   =(d.vi_pc          &&Array.isArray(d.vi_pc[type]))         ?d.vi_pc[type]         :[];

        var vals=[
          d['vi_site']||siteName,
          d['vi_line']||'',
          d['vi_unit']||'',
          type||'',
          sn,
          d['vi_notes']||'',
          fmtProgs(progs),
          fmtCams(cams),
          fmtCams(illums),
          fmtBoards(allBoards,type),
          fmtPcs(pcs)
        ];
        var row=ws.getRow(rIdx);
        vals.forEach(function(v,i){
          var cell=row.getCell(i+1);
          cell.value=v;
          _xStyle(cell,{bg:bg,fg:'#c8c8d4',align:i<=3?'center':'left',wrap:true});
        });
        row.height=Math.max(17,pcs.length*15);
        rIdx++;
      });
    });
  });
}
