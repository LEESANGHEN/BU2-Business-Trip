/* ══════════════════════════════════════════
   다국어 지원 (1단계: 상단바/탭/공용 툴바/표 헤더 등 핵심 UI)
   모달 내부 입력 폼, 상태값(진행중/완료 등 사용자가 입력한 데이터)은
   이번 1단계 범위에서 제외 — 필요 시 추후 확장.
══════════════════════════════════════════ */
var LANG_KEY='trip_lang';
var LANG_LABELS={ko:'한국어',en:'English',zhHans:'简体中文',zhHant:'繁體中文',ja:'日本語'};

var I18N={
ko:{
  appTitle:'출장 일정 관리', connOk:'연결 정상', connChecking:'연결 확인', themeToggleTitle:'다크/라이트 모드 전환',
  langSelectTitle:'언어 선택',
  tabProjects:'🗂️ 프로젝트 관리', tabGantt:'📅 간트 차트', tabPerson:'👤 인원 출장일', tabVision:'📊 월별 집계',
  btnExcel:'⬇ 엑셀', btnSheetsSettings:'⚙ Sheets 설정', btnSiteMgr:'사이트 관리', btnAddEvent:'★ 이벤트 등록', btnAddSchedule:'+ 출장 등록',
  btnHidden:'숨김 보기', searchPh:'검색', zoomWeek:'주', zoomBiweek:'격주', zoomMonth:'월',
  filterSchedule:'출장일정', filterEvent:'이벤트', filterWork:'작업',
  legendHq:'본사계열', legendOutsource:'외주계열', legendDone:'완료', legendGoing:'출장중', legendExt1:'1차 연장', legendExt2:'2차 연장', legendPlan:'예정',
  ghTask:'업무', ghTraveler:'출장자', siteFilter:'사이트 필터',
  mpSearchPh:'고객사/프로젝트 검색...', mpRegion:'지역', mpStatus:'상태', mpCustomer:'고객사', mpShipMonth:'출하월',
  mpHideInactive:'진행중만 보기', mpAddProject:'+ 프로젝트 등록', optAll:'전체', btnEdit:'수정', btnDelete:'삭제',
  colCategory:'구분', colProject:'프로젝트', colSerial:'프로젝트 시리얼', colUnitCombined:'생산/고객사 호기',
  colSetupPeriod:'생산 셋업 기간', colShipDate:'설비 출하 일정', colManage:'관리',
  pmSearchPh:'이름 검색...', pmStatusAll:'전체', pmStatusGoing:'출장중', pmStatusHome:'국내',
  pmTypeHq:'본사', pmTypeOutsource:'외주', pmTypeLocalOutsource:'현지외주', pmTypeTech:'기술', pmTypeVision:'비전', pmTypeHost:'호스트',
  pmSortLabel:'정렬', pmSortName:'이름', pmSortDays:'최초 출장일수', pmSortGrandTotal:'전체 출장일수', pmHideDone:'완료 숨기기',
  statRegisteredPersons:'등록 인원', statAllTravelers:'전체 출장자', statOnTripNow:'현재 출장 중', statTodayBasis:'오늘 기준', pmBdOutsource:'외주', pmPersonTypeLabel:'인원',
  colName:'이름', colCountry:'국가', colCity:'지역', colSite:'사이트', colFirstDays:'최초 출장일수', colExt1Days:'1차 연장일수', colExt2Days:'2차 연장일수', colStatusBadge:'상태', colGrandTotal:'전체 출장일수',
  maMonth:'월', maHqCount:'본사 셋업 설비 수', maHqList:'본사 셋업 설비군', maSiteCount:'현장 셋업 설비 수', maSiteList:'현장 셋업 설비군', maPeople:'출장 인원', maPeopleList:'출장 인원 명단'
},
en:{
  appTitle:'Trip Schedule Management', connOk:'Connected', connChecking:'Checking...', themeToggleTitle:'Toggle dark/light mode',
  langSelectTitle:'Select language',
  tabProjects:'🗂️ Projects', tabGantt:'📅 Gantt Chart', tabPerson:'👤 Trip Days', tabVision:'📊 Monthly Summary',
  btnExcel:'⬇ Excel', btnSheetsSettings:'⚙ Sheets Settings', btnSiteMgr:'Site Mgmt', btnAddEvent:'★ Add Event', btnAddSchedule:'+ Add Trip',
  btnHidden:'Show Hidden', searchPh:'Search', zoomWeek:'Week', zoomBiweek:'2-Week', zoomMonth:'Month',
  filterSchedule:'Trips', filterEvent:'Events', filterWork:'Work',
  legendHq:'HQ Group', legendOutsource:'Outsource Group', legendDone:'Done', legendGoing:'On Trip', legendExt1:'Ext. 1', legendExt2:'Ext. 2', legendPlan:'Planned',
  ghTask:'Task', ghTraveler:'Traveler', siteFilter:'Site Filter',
  mpSearchPh:'Search customer/project...', mpRegion:'Region', mpStatus:'Status', mpCustomer:'Customer', mpShipMonth:'Ship Month',
  mpHideInactive:'Active only', mpAddProject:'+ Add Project', optAll:'All', btnEdit:'Edit', btnDelete:'Delete',
  colCategory:'Category', colProject:'Project', colSerial:'Project Serial', colUnitCombined:'Production/Customer Unit',
  colSetupPeriod:'Setup Period', colShipDate:'Ship Date', colManage:'Manage',
  pmSearchPh:'Search name...', pmStatusAll:'All', pmStatusGoing:'On Trip', pmStatusHome:'Domestic',
  pmTypeHq:'HQ', pmTypeOutsource:'Outsource', pmTypeLocalOutsource:'Local Outsource', pmTypeTech:'Tech', pmTypeVision:'Vision', pmTypeHost:'Host',
  pmSortLabel:'Sort', pmSortName:'Name', pmSortDays:'Initial Days', pmSortGrandTotal:'Total Days', pmHideDone:'Hide Done',
  statRegisteredPersons:'Registered', statAllTravelers:'All travelers', statOnTripNow:'Currently on trip', statTodayBasis:'As of today', pmBdOutsource:'Outsource', pmPersonTypeLabel:'Type',
  colName:'Name', colCountry:'Country', colCity:'Region', colSite:'Site', colFirstDays:'Initial Days', colExt1Days:'Ext.1 Days', colExt2Days:'Ext.2 Days', colStatusBadge:'Status', colGrandTotal:'Total Days',
  maMonth:'Month', maHqCount:'HQ Setup Units', maHqList:'HQ Setup Details', maSiteCount:'Site Setup Units', maSiteList:'Site Setup Details', maPeople:'Travelers', maPeopleList:'Traveler List'
},
zhHans:{
  appTitle:'出差日程管理', connOk:'连接正常', connChecking:'检查中...', themeToggleTitle:'切换深色/浅色模式',
  langSelectTitle:'选择语言',
  tabProjects:'🗂️ 项目管理', tabGantt:'📅 甘特图', tabPerson:'👤 人员出差日', tabVision:'📊 月度汇总',
  btnExcel:'⬇ 导出Excel', btnSheetsSettings:'⚙ Sheets设置', btnSiteMgr:'站点管理', btnAddEvent:'★ 添加事件', btnAddSchedule:'+ 添加出差',
  btnHidden:'显示隐藏', searchPh:'搜索', zoomWeek:'周', zoomBiweek:'双周', zoomMonth:'月',
  filterSchedule:'出差日程', filterEvent:'事件', filterWork:'工作',
  legendHq:'总部系列', legendOutsource:'外包系列', legendDone:'完成', legendGoing:'出差中', legendExt1:'第1次延长', legendExt2:'第2次延长', legendPlan:'预定',
  ghTask:'任务', ghTraveler:'出差人员', siteFilter:'站点筛选',
  mpSearchPh:'搜索客户/项目...', mpRegion:'地区', mpStatus:'状态', mpCustomer:'客户', mpShipMonth:'出货月份',
  mpHideInactive:'仅看进行中', mpAddProject:'+ 添加项目', optAll:'全部', btnEdit:'修改', btnDelete:'删除',
  colCategory:'分类', colProject:'项目', colSerial:'项目序列号', colUnitCombined:'生产/客户机台',
  colSetupPeriod:'生产安装周期', colShipDate:'设备出货日期', colManage:'管理',
  pmSearchPh:'搜索姓名...', pmStatusAll:'全部', pmStatusGoing:'出差中', pmStatusHome:'国内',
  pmTypeHq:'总部', pmTypeOutsource:'外包', pmTypeLocalOutsource:'当地外包', pmTypeTech:'技术', pmTypeVision:'视觉', pmTypeHost:'主机厂',
  pmSortLabel:'排序', pmSortName:'姓名', pmSortDays:'首次出差天数', pmSortGrandTotal:'总出差天数', pmHideDone:'隐藏已完成',
  statRegisteredPersons:'登记人数', statAllTravelers:'全部出差人员', statOnTripNow:'当前出差中', statTodayBasis:'截至今天', pmBdOutsource:'外包', pmPersonTypeLabel:'人员',
  colName:'姓名', colCountry:'国家', colCity:'地区', colSite:'站点', colFirstDays:'首次出差天数', colExt1Days:'第1次延长天数', colExt2Days:'第2次延长天数', colStatusBadge:'状态', colGrandTotal:'总出差天数',
  maMonth:'月份', maHqCount:'总部安装设备数', maHqList:'总部安装设备清单', maSiteCount:'现场安装设备数', maSiteList:'现场安装设备清单', maPeople:'出差人数', maPeopleList:'出差人员名单'
},
zhHant:{
  appTitle:'出差日程管理', connOk:'連線正常', connChecking:'檢查中...', themeToggleTitle:'切換深色/淺色模式',
  langSelectTitle:'選擇語言',
  tabProjects:'🗂️ 專案管理', tabGantt:'📅 甘特圖', tabPerson:'👤 人員出差日', tabVision:'📊 月度彙總',
  btnExcel:'⬇ 匯出Excel', btnSheetsSettings:'⚙ Sheets設定', btnSiteMgr:'站點管理', btnAddEvent:'★ 新增事件', btnAddSchedule:'+ 新增出差',
  btnHidden:'顯示隱藏', searchPh:'搜尋', zoomWeek:'週', zoomBiweek:'雙週', zoomMonth:'月',
  filterSchedule:'出差日程', filterEvent:'事件', filterWork:'工作',
  legendHq:'總部系列', legendOutsource:'外包系列', legendDone:'完成', legendGoing:'出差中', legendExt1:'第1次延長', legendExt2:'第2次延長', legendPlan:'預定',
  ghTask:'任務', ghTraveler:'出差人員', siteFilter:'站點篩選',
  mpSearchPh:'搜尋客戶/專案...', mpRegion:'地區', mpStatus:'狀態', mpCustomer:'客戶', mpShipMonth:'出貨月份',
  mpHideInactive:'僅看進行中', mpAddProject:'+ 新增專案', optAll:'全部', btnEdit:'修改', btnDelete:'刪除',
  colCategory:'分類', colProject:'專案', colSerial:'專案序號', colUnitCombined:'生產/客戶機台',
  colSetupPeriod:'生產安裝週期', colShipDate:'設備出貨日期', colManage:'管理',
  pmSearchPh:'搜尋姓名...', pmStatusAll:'全部', pmStatusGoing:'出差中', pmStatusHome:'國內',
  pmTypeHq:'總部', pmTypeOutsource:'外包', pmTypeLocalOutsource:'當地外包', pmTypeTech:'技術', pmTypeVision:'視覺', pmTypeHost:'主機廠',
  pmSortLabel:'排序', pmSortName:'姓名', pmSortDays:'首次出差天數', pmSortGrandTotal:'總出差天數', pmHideDone:'隱藏已完成',
  statRegisteredPersons:'登記人數', statAllTravelers:'全部出差人員', statOnTripNow:'目前出差中', statTodayBasis:'截至今天', pmBdOutsource:'外包', pmPersonTypeLabel:'人員',
  colName:'姓名', colCountry:'國家', colCity:'地區', colSite:'站點', colFirstDays:'首次出差天數', colExt1Days:'第1次延長天數', colExt2Days:'第2次延長天數', colStatusBadge:'狀態', colGrandTotal:'總出差天數',
  maMonth:'月份', maHqCount:'總部安裝設備數', maHqList:'總部安裝設備清單', maSiteCount:'現場安裝設備數', maSiteList:'現場安裝設備清單', maPeople:'出差人數', maPeopleList:'出差人員名單'
},
ja:{
  appTitle:'出張スケジュール管理', connOk:'接続正常', connChecking:'確認中...', themeToggleTitle:'ダーク/ライトモード切替',
  langSelectTitle:'言語選択',
  tabProjects:'🗂️ プロジェクト管理', tabGantt:'📅 ガントチャート', tabPerson:'👤 出張日数', tabVision:'📊 月別集計',
  btnExcel:'⬇ Excel', btnSheetsSettings:'⚙ Sheets設定', btnSiteMgr:'サイト管理', btnAddEvent:'★ イベント登録', btnAddSchedule:'+ 出張登録',
  btnHidden:'非表示を表示', searchPh:'検索', zoomWeek:'週', zoomBiweek:'隔週', zoomMonth:'月',
  filterSchedule:'出張予定', filterEvent:'イベント', filterWork:'作業',
  legendHq:'本社系列', legendOutsource:'外注系列', legendDone:'完了', legendGoing:'出張中', legendExt1:'1次延長', legendExt2:'2次延長', legendPlan:'予定',
  ghTask:'業務', ghTraveler:'出張者', siteFilter:'サイトフィルター',
  mpSearchPh:'顧客/プロジェクト検索...', mpRegion:'地域', mpStatus:'状態', mpCustomer:'顧客', mpShipMonth:'出荷月',
  mpHideInactive:'進行中のみ表示', mpAddProject:'+ プロジェクト登録', optAll:'全体', btnEdit:'編集', btnDelete:'削除',
  colCategory:'区分', colProject:'プロジェクト', colSerial:'プロジェクトシリアル', colUnitCombined:'生産/顧客号機',
  colSetupPeriod:'生産セットアップ期間', colShipDate:'設備出荷日程', colManage:'管理',
  pmSearchPh:'名前検索...', pmStatusAll:'全体', pmStatusGoing:'出張中', pmStatusHome:'国内',
  pmTypeHq:'本社', pmTypeOutsource:'外注', pmTypeLocalOutsource:'現地外注', pmTypeTech:'技術', pmTypeVision:'ビジョン', pmTypeHost:'ホスト',
  pmSortLabel:'並び替え', pmSortName:'名前', pmSortDays:'初回出張日数', pmSortGrandTotal:'全体出張日数', pmHideDone:'完了を非表示',
  statRegisteredPersons:'登録人数', statAllTravelers:'全出張者', statOnTripNow:'現在出張中', statTodayBasis:'本日時点', pmBdOutsource:'外注', pmPersonTypeLabel:'人員',
  colName:'名前', colCountry:'国', colCity:'地域', colSite:'サイト', colFirstDays:'初回出張日数', colExt1Days:'1次延長日数', colExt2Days:'2次延長日数', colStatusBadge:'状態', colGrandTotal:'全体出張日数',
  maMonth:'月', maHqCount:'本社セットアップ設備数', maHqList:'本社セットアップ設備群', maSiteCount:'現場セットアップ設備数', maSiteList:'現場セットアップ設備群', maPeople:'出張人員', maPeopleList:'出張人員名簿'
}
};

var _lang=(function(){
  try{var v=localStorage.getItem(LANG_KEY);return (v&&I18N[v])?v:'ko';}catch(e){return 'ko';}
})();

function t(key){
  var dict=I18N[_lang]||I18N.ko;
  return (key in dict)?dict[key]:(I18N.ko[key]!==undefined?I18N.ko[key]:key);
}

function _langSelectHtml(){
  return Object.keys(LANG_LABELS).map(function(code){
    return '<option value="'+code+'"'+(code===_lang?' selected':'')+'>'+LANG_LABELS[code]+'</option>';
  }).join('');
}

// data-i18n(텍스트) / data-i18n-title(title 속성)이 붙은 정적 요소들을 현재 언어로 갱신
function applyLanguage(){
  document.documentElement.setAttribute('lang', _lang==='ko'?'ko':(_lang==='en'?'en':(_lang==='ja'?'ja':'zh')));
  Array.prototype.slice.call(document.querySelectorAll('[data-i18n]')).forEach(function(el){
    el.textContent=t(el.getAttribute('data-i18n'));
  });
  Array.prototype.slice.call(document.querySelectorAll('[data-i18n-title]')).forEach(function(el){
    el.title=t(el.getAttribute('data-i18n-title'));
  });
  Array.prototype.slice.call(document.querySelectorAll('[data-i18n-ph]')).forEach(function(el){
    el.placeholder=t(el.getAttribute('data-i18n-ph'));
  });
  var sel=document.getElementById('langSelect');
  if(sel){
    if(!sel.options.length) sel.innerHTML=_langSelectHtml();
    sel.value=_lang;
  }
}

function setLanguage(code){
  if(!I18N[code]) return;
  _lang=code;
  try{localStorage.setItem(LANG_KEY,code);}catch(e){}
  applyLanguage();
  if(typeof _activeTab!=='undefined'&&typeof switchTab==='function') switchTab(_activeTab);
}
