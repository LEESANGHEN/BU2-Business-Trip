/**
 * BU2 출장일정관리 — Apps Script 백엔드
 * =====================================
 * 이 파일은 새로 만든 Google Sheet에 붙여넣어서 "웹 앱"으로 배포하는 용도입니다.
 * BU2 trip 앱(index.html 등)의 데이터 저장소 역할을 하며, BU3의 기존 시트와는
 * 완전히 분리된 별도의 데이터입니다.
 *
 * ── 배포 방법 ──────────────────────────────────────────────
 * 1. sheet.new 로 새 Google Sheet를 만듭니다. (제목 예: "BU2 출장일정관리 DATA")
 * 2. 상단 메뉴 [확장 프로그램] > [Apps Script] 클릭
 * 3. 기본으로 열려있는 Code.gs 안의 내용을 전부 지우고, 이 파일 내용을 통째로 붙여넣기
 * 4. 저장(💾) 후, 상단 [배포] > [새 배포] 클릭
 *    - 유형 선택(⚙️)에서 "웹 앱" 선택
 *    - 실행할 사용자: "나(내 계정)"
 *    - 액세스 권한이 있는 사용자: "전체"  ← 반드시 "전체"로 설정해야 로그인 없이 앱에서 접근 가능합니다
 * 5. [배포] 클릭 → 권한 승인(본인 계정으로 로그인 필요) → 완료되면 나오는
 *    웹 앱 URL (https://script.google.com/macros/s/xxxx/exec) 을 복사
 * 6. 이 URL을 BU2 trip 앱의 script.js 안 DEFAULT_SHEETS_URL 값으로 붙여넣고
 *    GitHub Pages에 반영하면, 이 앱을 처음 여는 모든 사용자에게 자동 적용됩니다.
 *
 * ── 참고 ──────────────────────────────────────────────────
 * 이 백엔드는 저장할 때마다 전체 데이터를 통째로 저장/불러오는 단순한 방식입니다.
 * BU3 원본 앱이 쓰던 "레코드 단위 병합 + 삭제 기록(tombstone)" 서버 로직은
 * Google 쪽에 비공개로 배포되어 있어 소스를 확인할 수 없었기 때문에 그대로
 * 옮기지 못했습니다. BU2처럼 소수 인원이 순차적으로 입력하는 규모에서는
 * 이 단순 저장 방식으로 충분히 안전하게 동작하지만, 여러 사람이 "정확히 동시에"
 * 각자 다른 PC에서 저장을 누르는 극히 드문 경우에는 마지막에 저장한 내용이
 * 우선합니다 (먼저 저장한 사람의 변경 중 겹치는 항목이 있으면 덮어써질 수 있음).
 */

var SHEET_NAME = 'BU2_TRIP_DATA';
var CHUNK_SIZE = 40000; // Google Sheets 셀 1개 최대 5만자 제한보다 여유있게 설정

var FIELDS = ['groups', 'sites', 'projects', 'schedules', 'events', 'workTasks',
              'equipItems', 'equipUnits', 'equipSiteOrder', 'equipProjects',
              'visionTemplate', 'visionEquips', 'masterProjects'];

function _getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    try { sh.hideSheet(); } catch (e) {}
  }
  return sh;
}

function _readState_() {
  var sh = _getSheet_();
  var lastRow = sh.getLastRow();
  if (lastRow < 1) return {};
  var vals = sh.getRange(1, 1, lastRow, 1).getValues();
  var raw = vals.map(function (r) { return r[0] || ''; }).join('');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

function _writeState_(obj) {
  var sh = _getSheet_();
  sh.clearContents();
  var raw = JSON.stringify(obj);
  var rows = [];
  for (var i = 0; i < raw.length; i += CHUNK_SIZE) {
    rows.push([raw.substring(i, i + CHUNK_SIZE)]);
  }
  if (!rows.length) rows.push(['']);
  sh.getRange(1, 1, rows.length, 1).setValues(rows);
}

function _json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var action = e && e.parameter && e.parameter.action;
  if (action === 'load') {
    var state = _readState_();
    var out = {};
    FIELDS.forEach(function (f) {
      if (state[f] !== undefined) {
        out[f] = state[f];
      } else {
        out[f] = (f === 'visionTemplate') ? {} : [];
      }
    });
    out.deletedIds = state.deletedIds || [];
    out.deletedScheduleIds = state.deletedScheduleIds || [];
    return _json_(out);
  }
  return _json_({ error: 'unknown action: ' + action });
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.action === 'save') {
      var state = _readState_();
      FIELDS.forEach(function (f) {
        if (body[f] !== undefined) state[f] = body[f];
      });
      if (body.deletedIds !== undefined) state.deletedIds = body.deletedIds;
      if (body.deletedScheduleIds !== undefined) state.deletedScheduleIds = body.deletedScheduleIds;
      _writeState_(state);
      return _json_({ ok: true });
    }
    return _json_({ error: 'unknown action: ' + body.action });
  } catch (err) {
    return _json_({ error: String(err) });
  }
}
