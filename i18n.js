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
  tabHome:'🏠 홈', tabProjects:'🗂️ 프로젝트 관리', tabGantt:'📅 간트 차트', tabPerson:'👤 인원 출장일', tabVision:'📊 월별 집계',
  btnExcel:'⬇ 엑셀', btnSheetsSettings:'⚙ Sheets 설정', btnSiteMgr:'사이트 관리', btnAddEvent:'★ 이벤트 등록', btnAddSchedule:'+ 출장 등록',
  btnHidden:'숨김 보기', searchPh:'검색', zoomWeek:'주', zoomBiweek:'격주', zoomMonth:'월',
  filterSchedule:'출장일정', filterEvent:'이벤트', filterWork:'작업',
  legendHq:'본사계열', legendOutsource:'외주계열', legendDone:'완료', legendGoing:'출장중', legendExt1:'1차 연장', legendExt2:'2차 연장', legendPlan:'예정',
  ghTask:'업무', ghTraveler:'출장자', siteFilter:'사이트 필터',
  mpSearchPh:'고객사/프로젝트 검색...', mpRegion:'지역', mpStatus:'상태', mpCustomer:'고객사', mpShipMonth:'출하월',
  mpFilterRegion:'국가(지역)', mpFilterCustomer:'고객사(사이트)', mpFilterProject:'설비명(프로젝트)', mpFilterTransferMonth:'이관월', mpFilterNSelected:'개 선택',
  mpHideInactive:'진행중만 보기', mpAddProject:'+ 프로젝트 등록', optAll:'전체', btnEdit:'수정', btnDelete:'삭제',
  colCategory:'구분', colProject:'프로젝트', colSerial:'프로젝트 시리얼', colUnitCombined:'생산/고객사 호기',
  colSetupPeriod:'생산 셋업 기간', colShipDate:'설비 출하 일정', colManage:'관리',
  colCustomerReqShipL1:'고객사 요청', colCustomerReqShipL2:'출하 일정',
  colTransferDate:'생산 이관일', colTransferDateOverride:'변경 이관일',
  tipSetupPeriod:'셋업 시작일부터 종료일까지 전체 기간(일수)입니다.', tipCustomerReqShip:'셋업 시작일부터 출하 전날까지, 셋업에 쓸 수 있는 일수입니다.',
  pmSearchPh:'이름 검색...', pmStatusAll:'전체', pmStatusDone:'완료', pmStatusGoing:'진행중', pmStatusPlan:'예정',
  pmTypeHq:'본사', pmTypeOutsource:'외주', pmTypeLocalOutsource:'현지외주', pmTypeTech:'기술', pmTypeVision:'비전', pmTypeHost:'호스트',
  pmSortLabel:'정렬', pmSortName:'이름', pmSortCountry:'국가', pmSortSite:'사이트', pmHideDone:'진행중만 보기',
  statRegisteredPersons:'등록 인원', statAllTravelers:'전체 출장자', statOnTripNow:'현재 출장 중', statTodayBasis:'오늘 기준', pmBdOutsource:'외주', pmPersonTypeLabel:'인원',
  colName:'이름', colCountry:'국가', colCity:'지역', colSite:'사이트', colFirstDays:'최초 출장일수', colExt1Days:'1차 연장일수', colExt2Days:'2차 연장일수', colStatusBadge:'상태', colGrandTotal:'전체 출장일수',
  maMonth:'월', maHqCount:'본사 셋업 설비 수', maHqList:'본사 셋업 설비군', maSiteCount:'현장 셋업 설비 수', maSiteList:'현장 셋업 설비군', maPeople:'출장 인원', maPeopleList:'출장 인원 명단',
  homeGreeting:'안녕하세요 👋', homeSubPoWaiting:'PO 대기 {n}건', homeSubUpcoming:'곧 시작하는 출장 {n}건', homeSubJoiner:', ', homeSubSuffix:'이 있습니다', homeSubNone:'오늘도 좋은 하루 되세요',
  homeUpcomingTitle:'📅 다가오는 셋업 일정', homeUpcomingEmpty:'14일 내 예정된 출장이 없습니다.',
  homeQuickTitle:'⚡ 빠른 작업', homeBtnExcel:'⬇ 엑셀 다운로드',
  homeCountryTitle:'🌏 국가별 프로젝트 현황', homeCountryHint:'막대에 마우스를 올리면 고객사(사이트) 목록을 볼 수 있습니다.', homeCountryTipEmpty:'등록된 고객사(사이트)가 없습니다.', homeEmptyProjects:'등록된 프로젝트가 없습니다.',
  homeTypeTitle:'👥 인원유형별 출장 현황', homeTypeHint:'막대에 마우스를 올리면 출장자 명단을 볼 수 있습니다.', homeTypeTipEmpty:'해당 유형으로 등록된 출장자가 없습니다.',
  homeShipChartTitle:'🚚 월별 출하 설비 수 (이번 달 기준 6개월)', homeSetupChartTitle:'🔧 월별 설비 셋업 수량 (이번 달 기준 6개월)', homeChartHint:'막대를 클릭하면 해당 월의 설비명(프로젝트) 목록을 볼 수 있습니다.', homeChartTipEmpty:'해당 월에 등록된 설비가 없습니다.',
  homeRecentTitle:'🕓 최근 등록/수정 프로젝트',
  homeHighlightTitle:'✨ 이번달 하이라이트', homeHighlightNew:'신규 등록 프로젝트', homeHighlightDone:'완료 처리', homeCountSuffix:'건'
},
en:{
  appTitle:'Trip Schedule Management', connOk:'Connected', connChecking:'Checking...', themeToggleTitle:'Toggle dark/light mode',
  langSelectTitle:'Select language',
  tabHome:'🏠 Home', tabProjects:'🗂️ Projects', tabGantt:'📅 Gantt Chart', tabPerson:'👤 Trip Days', tabVision:'📊 Monthly Summary',
  btnExcel:'⬇ Excel', btnSheetsSettings:'⚙ Sheets Settings', btnSiteMgr:'Site Mgmt', btnAddEvent:'★ Add Event', btnAddSchedule:'+ Add Trip',
  btnHidden:'Show Hidden', searchPh:'Search', zoomWeek:'Week', zoomBiweek:'2-Week', zoomMonth:'Month',
  filterSchedule:'Trips', filterEvent:'Events', filterWork:'Work',
  legendHq:'HQ Group', legendOutsource:'Outsource Group', legendDone:'Done', legendGoing:'On Trip', legendExt1:'Ext. 1', legendExt2:'Ext. 2', legendPlan:'Planned',
  ghTask:'Task', ghTraveler:'Traveler', siteFilter:'Site Filter',
  mpSearchPh:'Search customer/project...', mpRegion:'Region', mpStatus:'Status', mpCustomer:'Customer', mpShipMonth:'Ship Month',
  mpFilterRegion:'Country (Region)', mpFilterCustomer:'Customer (Site)', mpFilterProject:'Equipment (Project)', mpFilterTransferMonth:'Transfer Month', mpFilterNSelected:' selected',
  mpHideInactive:'Active only', mpAddProject:'+ Add Project', optAll:'All', btnEdit:'Edit', btnDelete:'Delete',
  colCategory:'Category', colProject:'Project', colSerial:'Project Serial', colUnitCombined:'Production/Customer Unit',
  colSetupPeriod:'Setup Period', colShipDate:'Ship Date', colManage:'Manage',
  colCustomerReqShipL1:'Customer Requested', colCustomerReqShipL2:'Ship Date',
  colTransferDate:'Transfer Date', colTransferDateOverride:'Adjusted Transfer Date',
  tipSetupPeriod:'Total number of days from setup start to end date.', tipCustomerReqShip:'Number of setup days available, from setup start to the day before shipping.',
  pmSearchPh:'Search name...', pmStatusAll:'All', pmStatusDone:'Done', pmStatusGoing:'In Progress', pmStatusPlan:'Planned',
  pmTypeHq:'HQ', pmTypeOutsource:'Outsource', pmTypeLocalOutsource:'Local Outsource', pmTypeTech:'Tech', pmTypeVision:'Vision', pmTypeHost:'Host',
  pmSortLabel:'Sort', pmSortName:'Name', pmSortCountry:'Country', pmSortSite:'Site', pmHideDone:'Active only',
  statRegisteredPersons:'Registered', statAllTravelers:'All travelers', statOnTripNow:'Currently on trip', statTodayBasis:'As of today', pmBdOutsource:'Outsource', pmPersonTypeLabel:'Type',
  colName:'Name', colCountry:'Country', colCity:'Region', colSite:'Site', colFirstDays:'Initial Days', colExt1Days:'Ext.1 Days', colExt2Days:'Ext.2 Days', colStatusBadge:'Status', colGrandTotal:'Total Days',
  maMonth:'Month', maHqCount:'HQ Setup Units', maHqList:'HQ Setup Details', maSiteCount:'Site Setup Units', maSiteList:'Site Setup Details', maPeople:'Travelers', maPeopleList:'Traveler List',
  homeGreeting:'Hello 👋', homeSubPoWaiting:'{n} PO(s) pending', homeSubUpcoming:'{n} upcoming trip(s)', homeSubJoiner:', ', homeSubSuffix:'', homeSubNone:'Have a great day',
  homeUpcomingTitle:'📅 Upcoming setup schedule', homeUpcomingEmpty:'No trips scheduled in the next 14 days.',
  homeQuickTitle:'⚡ Quick actions', homeBtnExcel:'⬇ Download Excel',
  homeCountryTitle:'🌏 Projects by country', homeCountryHint:'Hover a bar to see registered customers (sites).', homeCountryTipEmpty:'No customers (sites) registered.', homeEmptyProjects:'No projects registered.',
  homeTypeTitle:'👥 Trips by personnel type', homeTypeHint:'Hover a bar to see traveler names.', homeTypeTipEmpty:'No travelers registered for this type.',
  homeShipChartTitle:'🚚 Monthly shipments (6 months from this month)', homeSetupChartTitle:'🔧 Monthly setups (6 months from this month)', homeChartHint:"Click a bar to see that month's equipment (project) list.", homeChartTipEmpty:'No equipment registered for this month.',
  homeRecentTitle:'🕓 Recently added/updated projects',
  homeHighlightTitle:"✨ This month's highlights", homeHighlightNew:'New projects', homeHighlightDone:'Completed', homeCountSuffix:''
},
zhHans:{
  appTitle:'出差日程管理', connOk:'连接正常', connChecking:'检查中...', themeToggleTitle:'切换深色/浅色模式',
  langSelectTitle:'选择语言',
  tabHome:'🏠 首页', tabProjects:'🗂️ 项目管理', tabGantt:'📅 甘特图', tabPerson:'👤 人员出差日', tabVision:'📊 月度汇总',
  btnExcel:'⬇ 导出Excel', btnSheetsSettings:'⚙ Sheets设置', btnSiteMgr:'站点管理', btnAddEvent:'★ 添加事件', btnAddSchedule:'+ 添加出差',
  btnHidden:'显示隐藏', searchPh:'搜索', zoomWeek:'周', zoomBiweek:'双周', zoomMonth:'月',
  filterSchedule:'出差日程', filterEvent:'事件', filterWork:'工作',
  legendHq:'总部系列', legendOutsource:'外包系列', legendDone:'完成', legendGoing:'出差中', legendExt1:'第1次延长', legendExt2:'第2次延长', legendPlan:'预定',
  ghTask:'任务', ghTraveler:'出差人员', siteFilter:'站点筛选',
  mpSearchPh:'搜索客户/项目...', mpRegion:'地区', mpStatus:'状态', mpCustomer:'客户', mpShipMonth:'出货月份',
  mpFilterRegion:'国家(地区)', mpFilterCustomer:'客户(现场)', mpFilterProject:'设备名(项目)', mpFilterTransferMonth:'移交月', mpFilterNSelected:'项已选',
  mpHideInactive:'仅看进行中', mpAddProject:'+ 添加项目', optAll:'全部', btnEdit:'修改', btnDelete:'删除',
  colCategory:'分类', colProject:'项目', colSerial:'项目序列号', colUnitCombined:'生产/客户机台',
  colSetupPeriod:'生产安装周期', colShipDate:'设备出货日期', colManage:'管理',
  colCustomerReqShipL1:'客户要求', colCustomerReqShipL2:'出货日期',
  colTransferDate:'生产移交日', colTransferDateOverride:'变更移交日',
  tipSetupPeriod:'从安装开始日到结束日的总天数。', tipCustomerReqShip:'从安装开始日到出货前一天，可用于安装的天数。',
  pmSearchPh:'搜索姓名...', pmStatusAll:'全部', pmStatusDone:'完成', pmStatusGoing:'进行中', pmStatusPlan:'预定',
  pmTypeHq:'总部', pmTypeOutsource:'外包', pmTypeLocalOutsource:'当地外包', pmTypeTech:'技术', pmTypeVision:'视觉', pmTypeHost:'主机厂',
  pmSortLabel:'排序', pmSortName:'姓名', pmSortCountry:'国家', pmSortSite:'站点', pmHideDone:'仅看进行中',
  statRegisteredPersons:'登记人数', statAllTravelers:'全部出差人员', statOnTripNow:'当前出差中', statTodayBasis:'截至今天', pmBdOutsource:'外包', pmPersonTypeLabel:'人员',
  colName:'姓名', colCountry:'国家', colCity:'地区', colSite:'站点', colFirstDays:'首次出差天数', colExt1Days:'第1次延长天数', colExt2Days:'第2次延长天数', colStatusBadge:'状态', colGrandTotal:'总出差天数',
  maMonth:'月份', maHqCount:'总部安装设备数', maHqList:'总部安装设备清单', maSiteCount:'现场安装设备数', maSiteList:'现场安装设备清单', maPeople:'出差人数', maPeopleList:'出差人员名单',
  homeGreeting:'您好 👋', homeSubPoWaiting:'{n}个PO待处理', homeSubUpcoming:'{n}个即将开始的出差', homeSubJoiner:'，', homeSubSuffix:'', homeSubNone:'祝您今天愉快',
  homeUpcomingTitle:'📅 即将开始的安装日程', homeUpcomingEmpty:'未来14天内没有安排的出差。',
  homeQuickTitle:'⚡ 快捷操作', homeBtnExcel:'⬇ 下载Excel',
  homeCountryTitle:'🌏 各国家项目现况', homeCountryHint:'将鼠标悬停在柱状图上可查看已登记的客户(现场)列表。', homeCountryTipEmpty:'没有已登记的客户(现场)。', homeEmptyProjects:'没有已登记的项目。',
  homeTypeTitle:'👥 各人员类型出差现况', homeTypeHint:'将鼠标悬停在柱状图上可查看出差人员名单。', homeTypeTipEmpty:'该类型没有已登记的出差人员。',
  homeShipChartTitle:'🚚 月度出货设备数(以本月为准的6个月)', homeSetupChartTitle:'🔧 月度设备安装数量(以本月为准的6个月)', homeChartHint:'点击柱状图可查看该月的设备名(项目)列表。', homeChartTipEmpty:'该月没有已登记的设备。',
  homeRecentTitle:'🕓 最近新增/修改的项目',
  homeHighlightTitle:'✨ 本月亮点', homeHighlightNew:'新增项目', homeHighlightDone:'完成处理', homeCountSuffix:'个'
},
zhHant:{
  appTitle:'出差日程管理', connOk:'連線正常', connChecking:'檢查中...', themeToggleTitle:'切換深色/淺色模式',
  langSelectTitle:'選擇語言',
  tabHome:'🏠 首頁', tabProjects:'🗂️ 專案管理', tabGantt:'📅 甘特圖', tabPerson:'👤 人員出差日', tabVision:'📊 月度彙總',
  btnExcel:'⬇ 匯出Excel', btnSheetsSettings:'⚙ Sheets設定', btnSiteMgr:'站點管理', btnAddEvent:'★ 新增事件', btnAddSchedule:'+ 新增出差',
  btnHidden:'顯示隱藏', searchPh:'搜尋', zoomWeek:'週', zoomBiweek:'雙週', zoomMonth:'月',
  filterSchedule:'出差日程', filterEvent:'事件', filterWork:'工作',
  legendHq:'總部系列', legendOutsource:'外包系列', legendDone:'完成', legendGoing:'出差中', legendExt1:'第1次延長', legendExt2:'第2次延長', legendPlan:'預定',
  ghTask:'任務', ghTraveler:'出差人員', siteFilter:'站點篩選',
  mpSearchPh:'搜尋客戶/專案...', mpRegion:'地區', mpStatus:'狀態', mpCustomer:'客戶', mpShipMonth:'出貨月份',
  mpFilterRegion:'國家(地區)', mpFilterCustomer:'客戶(現場)', mpFilterProject:'設備名(專案)', mpFilterTransferMonth:'移交月', mpFilterNSelected:'項已選',
  mpHideInactive:'僅看進行中', mpAddProject:'+ 新增專案', optAll:'全部', btnEdit:'修改', btnDelete:'刪除',
  colCategory:'分類', colProject:'專案', colSerial:'專案序號', colUnitCombined:'生產/客戶機台',
  colSetupPeriod:'生產安裝週期', colShipDate:'設備出貨日期', colManage:'管理',
  colCustomerReqShipL1:'客戶要求', colCustomerReqShipL2:'出貨日期',
  colTransferDate:'生產移交日', colTransferDateOverride:'變更移交日',
  tipSetupPeriod:'從安裝開始日到結束日的總天數。', tipCustomerReqShip:'從安裝開始日到出貨前一天，可用於安裝的天數。',
  pmSearchPh:'搜尋姓名...', pmStatusAll:'全部', pmStatusDone:'完成', pmStatusGoing:'進行中', pmStatusPlan:'預定',
  pmTypeHq:'總部', pmTypeOutsource:'外包', pmTypeLocalOutsource:'當地外包', pmTypeTech:'技術', pmTypeVision:'視覺', pmTypeHost:'主機廠',
  pmSortLabel:'排序', pmSortName:'姓名', pmSortCountry:'國家', pmSortSite:'站點', pmHideDone:'僅看進行中',
  statRegisteredPersons:'登記人數', statAllTravelers:'全部出差人員', statOnTripNow:'目前出差中', statTodayBasis:'截至今天', pmBdOutsource:'外包', pmPersonTypeLabel:'人員',
  colName:'姓名', colCountry:'國家', colCity:'地區', colSite:'站點', colFirstDays:'首次出差天數', colExt1Days:'第1次延長天數', colExt2Days:'第2次延長天數', colStatusBadge:'狀態', colGrandTotal:'總出差天數',
  maMonth:'月份', maHqCount:'總部安裝設備數', maHqList:'總部安裝設備清單', maSiteCount:'現場安裝設備數', maSiteList:'現場安裝設備清單', maPeople:'出差人數', maPeopleList:'出差人員名單',
  homeGreeting:'您好 👋', homeSubPoWaiting:'{n}個PO待處理', homeSubUpcoming:'{n}個即將開始的出差', homeSubJoiner:'，', homeSubSuffix:'', homeSubNone:'祝您今天愉快',
  homeUpcomingTitle:'📅 即將開始的安裝日程', homeUpcomingEmpty:'未來14天內沒有安排的出差。',
  homeQuickTitle:'⚡ 快捷操作', homeBtnExcel:'⬇ 下載Excel',
  homeCountryTitle:'🌏 各國家專案現況', homeCountryHint:'將滑鼠懸停在長條圖上可查看已登記的客戶(現場)清單。', homeCountryTipEmpty:'沒有已登記的客戶(現場)。', homeEmptyProjects:'沒有已登記的專案。',
  homeTypeTitle:'👥 各人員類型出差現況', homeTypeHint:'將滑鼠懸停在長條圖上可查看出差人員名單。', homeTypeTipEmpty:'該類型沒有已登記的出差人員。',
  homeShipChartTitle:'🚚 月度出貨設備數(以本月為準的6個月)', homeSetupChartTitle:'🔧 月度設備安裝數量(以本月為準的6個月)', homeChartHint:'點擊長條圖可查看該月的設備名(專案)清單。', homeChartTipEmpty:'該月沒有已登記的設備。',
  homeRecentTitle:'🕓 最近新增/修改的專案',
  homeHighlightTitle:'✨ 本月亮點', homeHighlightNew:'新增專案', homeHighlightDone:'完成處理', homeCountSuffix:'個'
},
ja:{
  appTitle:'出張スケジュール管理', connOk:'接続正常', connChecking:'確認中...', themeToggleTitle:'ダーク/ライトモード切替',
  langSelectTitle:'言語選択',
  tabHome:'🏠 ホーム', tabProjects:'🗂️ プロジェクト管理', tabGantt:'📅 ガントチャート', tabPerson:'👤 出張日数', tabVision:'📊 月別集計',
  btnExcel:'⬇ Excel', btnSheetsSettings:'⚙ Sheets設定', btnSiteMgr:'サイト管理', btnAddEvent:'★ イベント登録', btnAddSchedule:'+ 出張登録',
  btnHidden:'非表示を表示', searchPh:'検索', zoomWeek:'週', zoomBiweek:'隔週', zoomMonth:'月',
  filterSchedule:'出張予定', filterEvent:'イベント', filterWork:'作業',
  legendHq:'本社系列', legendOutsource:'外注系列', legendDone:'完了', legendGoing:'出張中', legendExt1:'1次延長', legendExt2:'2次延長', legendPlan:'予定',
  ghTask:'業務', ghTraveler:'出張者', siteFilter:'サイトフィルター',
  mpSearchPh:'顧客/プロジェクト検索...', mpRegion:'地域', mpStatus:'状態', mpCustomer:'顧客', mpShipMonth:'出荷月',
  mpFilterRegion:'国(地域)', mpFilterCustomer:'顧客(サイト)', mpFilterProject:'設備名(プロジェクト)', mpFilterTransferMonth:'移管月', mpFilterNSelected:'件選択中',
  mpHideInactive:'進行中のみ表示', mpAddProject:'+ プロジェクト登録', optAll:'全体', btnEdit:'編集', btnDelete:'削除',
  colCategory:'区分', colProject:'プロジェクト', colSerial:'プロジェクトシリアル', colUnitCombined:'生産/顧客号機',
  colSetupPeriod:'生産セットアップ期間', colShipDate:'設備出荷日程', colManage:'管理',
  colCustomerReqShipL1:'顧客要求', colCustomerReqShipL2:'出荷日程',
  colTransferDate:'生産移管日', colTransferDateOverride:'変更移管日',
  tipSetupPeriod:'セットアップ開始日から終了日までの全体日数です。', tipCustomerReqShip:'セットアップ開始日から出荷前日までの、セットアップに使える日数です。',
  pmSearchPh:'名前検索...', pmStatusAll:'全体', pmStatusDone:'完了', pmStatusGoing:'進行中', pmStatusPlan:'予定',
  pmTypeHq:'本社', pmTypeOutsource:'外注', pmTypeLocalOutsource:'現地外注', pmTypeTech:'技術', pmTypeVision:'ビジョン', pmTypeHost:'ホスト',
  pmSortLabel:'並び替え', pmSortName:'名前', pmSortCountry:'国', pmSortSite:'サイト', pmHideDone:'進行中のみ表示',
  statRegisteredPersons:'登録人数', statAllTravelers:'全出張者', statOnTripNow:'現在出張中', statTodayBasis:'本日時点', pmBdOutsource:'外注', pmPersonTypeLabel:'人員',
  colName:'名前', colCountry:'国', colCity:'地域', colSite:'サイト', colFirstDays:'初回出張日数', colExt1Days:'1次延長日数', colExt2Days:'2次延長日数', colStatusBadge:'状態', colGrandTotal:'全体出張日数',
  maMonth:'月', maHqCount:'本社セットアップ設備数', maHqList:'本社セットアップ設備群', maSiteCount:'現場セットアップ設備数', maSiteList:'現場セットアップ設備群', maPeople:'出張人員', maPeopleList:'出張人員名簿',
  homeGreeting:'こんにちは 👋', homeSubPoWaiting:'PO待ち{n}件', homeSubUpcoming:'まもなく始まる出張{n}件', homeSubJoiner:'、', homeSubSuffix:'があります', homeSubNone:'今日も良い一日を',
  homeUpcomingTitle:'📅 近日中のセットアップ予定', homeUpcomingEmpty:'今後14日以内に予定されている出張はありません。',
  homeQuickTitle:'⚡ クイック操作', homeBtnExcel:'⬇ Excelダウンロード',
  homeCountryTitle:'🌏 国別プロジェクト現況', homeCountryHint:'棒グラフにマウスを乗せると顧客(サイト)一覧が表示されます。', homeCountryTipEmpty:'登録された顧客(サイト)がありません。', homeEmptyProjects:'登録されたプロジェクトがありません。',
  homeTypeTitle:'👥 人員タイプ別出張現況', homeTypeHint:'棒グラフにマウスを乗せると出張者名簿が表示されます。', homeTypeTipEmpty:'該当タイプで登録された出張者がいません。',
  homeShipChartTitle:'🚚 月別出荷設備数(今月から6ヶ月間)', homeSetupChartTitle:'🔧 月別設備セットアップ数量(今月から6ヶ月間)', homeChartHint:'棒グラフをクリックするとその月の設備名(プロジェクト)一覧が表示されます。', homeChartTipEmpty:'この月に登録された設備はありません。',
  homeRecentTitle:'🕓 最近登録/更新されたプロジェクト',
  homeHighlightTitle:'✨ 今月のハイライト', homeHighlightNew:'新規登録プロジェクト', homeHighlightDone:'完了処理', homeCountSuffix:'件'
}
};

var _lang=(function(){
  try{var v=localStorage.getItem(LANG_KEY);return (v&&I18N[v])?v:'ko';}catch(e){return 'ko';}
})();

function t(key){
  var dict=I18N[_lang]||I18N.ko;
  return (key in dict)?dict[key]:(I18N.ko[key]!==undefined?I18N.ko[key]:key);
}

// 다국어 범위: UI 문구(위 I18N) 외에, 표에 실제로 표시되는 값 중 "국가(지역)"와
// "상태" 두 항목만 값 자체를 번역한다(그 외 사용자가 입력한 데이터는 원문 그대로 표시).
var REGION_I18N={
  ko:{'국내':'국내','중국':'중국','대만':'대만','일본':'일본','베트남':'베트남','말레이시아':'말레이시아','싱가폴':'싱가폴','태국':'태국','미국':'미국','오스트리아':'오스트리아','기타':'기타'},
  en:{'국내':'Domestic','중국':'China','대만':'Taiwan','일본':'Japan','베트남':'Vietnam','말레이시아':'Malaysia','싱가폴':'Singapore','태국':'Thailand','미국':'USA','오스트리아':'Austria','기타':'Other'},
  zhHans:{'국내':'国内','중국':'中国','대만':'台湾','일본':'日本','베트남':'越南','말레이시아':'马来西亚','싱가폴':'新加坡','태국':'泰国','미국':'美国','오스트리아':'奥地利','기타':'其他'},
  zhHant:{'국내':'國內','중국':'中國','대만':'台灣','일본':'日本','베트남':'越南','말레이시아':'馬來西亞','싱가폴':'新加坡','태국':'泰國','미국':'美國','오스트리아':'奧地利','기타':'其他'},
  ja:{'국내':'国内','중국':'中国','대만':'台湾','일본':'日本','베트남':'ベトナム','말레이시아':'マレーシア','싱가폴':'シンガポール','태국':'タイ','미국':'アメリカ','오스트리아':'オーストリア','기타':'その他'}
};
var STATUS_I18N={
  ko:{'진행중':'진행중','진행중(HQ)':'진행중(HQ)','진행중(Field)':'진행중(Field)','완료':'완료','PO 대기':'PO 대기','PO 발행':'PO 발행','LOI 접수':'LOI 접수','예정':'예정'},
  en:{'진행중':'In Progress','진행중(HQ)':'In Progress (HQ)','진행중(Field)':'In Progress (Field)','완료':'Done','PO 대기':'PO Pending','PO 발행':'PO Issued','LOI 접수':'LOI Received','예정':'Planned'},
  zhHans:{'진행중':'进行中','진행중(HQ)':'进行中(总部)','진행중(Field)':'进行中(现场)','완료':'完成','PO 대기':'PO待发','PO 발행':'PO已发行','LOI 접수':'已收到LOI','예정':'预定'},
  zhHant:{'진행중':'進行中','진행중(HQ)':'進行中(總部)','진행중(Field)':'進行中(現場)','완료':'完成','PO 대기':'PO待發','PO 발행':'PO已發行','LOI 접수':'已收到LOI','예정':'預定'},
  ja:{'진행중':'進行中','진행중(HQ)':'進行中(本社)','진행중(Field)':'進行中(現場)','완료':'完了','PO 대기':'PO待ち','PO 발행':'PO発行済み','LOI 접수':'LOI受領','예정':'予定'}
};
function tRegion(v){
  if(!v)return v;
  var dict=REGION_I18N[_lang]||REGION_I18N.ko;
  return dict[v]!==undefined?dict[v]:v;
}
function tStatus(v){
  if(!v)return v;
  var dict=STATUS_I18N[_lang]||STATUS_I18N.ko;
  return dict[v]!==undefined?dict[v]:v;
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
    var key=el.getAttribute('data-i18n');
    // 관리자가 커스텀 타이틀을 지정했으면(S.appTitle) 그 값을 언어와 무관하게 그대로 보여준다
    if(key==='appTitle'){
      var titleTxt=(typeof S!=='undefined'&&S.appTitle)?S.appTitle:t(key);
      el.textContent=titleTxt;
      document.title=titleTxt; // 브라우저 탭 제목도 함께 갱신
      return;
    }
    el.textContent=t(key);
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
