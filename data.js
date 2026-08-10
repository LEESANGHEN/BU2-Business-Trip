/* ── 기본 데이터 (BU2용 새 인스턴스 — 사이트/프로젝트/일정은 비어 있는 상태로 시작합니다.
   앱 상단의 "사이트 관리" / "+ 출장 등록" / "★ 이벤트 등록" 메뉴에서 BU2 실제 데이터를 등록하세요.) ── */
var DEF = {
  "sites": [],
  "projects": [],
  "schedules": [],
  "events": [],
  "workTasks": [],
  "equipItems": [
    {"id":"ei1",  "name":"FAB-in",                    "groupName":"",    "order":0},
    {"id":"ei2",  "name":"Installation",              "groupName":"",    "order":1},
    {"id":"ei3",  "name":"Turn On (Ele.)",             "groupName":"SAT", "order":2},
    {"id":"ei4",  "name":"Turn On (CDA)",              "groupName":"SAT", "order":3},
    {"id":"ei5",  "name":"I/O Check (Vision)",         "groupName":"SAT", "order":4},
    {"id":"ei6",  "name":"I/O Check (PLC연동)",        "groupName":"SAT", "order":5},
    {"id":"ei7",  "name":"IP/IQ check",               "groupName":"SAT", "order":6},
    {"id":"ei8",  "name":"Calibration",               "groupName":"SAT", "order":7},
    {"id":"ei9",  "name":"GRR",                       "groupName":"SAT", "order":8},
    {"id":"ei10", "name":"QA검증 (MSA 대표 1-A)",      "groupName":"SAT", "order":9},
    {"id":"ei11", "name":"QA검증 (Error Proofing)",    "groupName":"SAT", "order":10},
    {"id":"ei12", "name":"SAT",                       "groupName":"SAT", "order":11},
    {"id":"ei13", "name":"QA망 포설",                  "groupName":"IT",  "order":12},
    {"id":"ei14", "name":"IP Activation",             "groupName":"IT",  "order":13},
    {"id":"ei15", "name":"Agent Ins",                 "groupName":"IT",  "order":14},
    {"id":"ei16", "name":"SPC+ 개통",                 "groupName":"IT",  "order":15},
    {"id":"ei17", "name":"NQVM Ins",                  "groupName":"IT",  "order":16},
    {"id":"ei18", "name":"방화벽",                    "groupName":"IT",  "order":17},
    {"id":"ei19", "name":"SPC 정합성 (이미지/데이터)","groupName":"IT",  "order":18},
    {"id":"ei20", "name":"Sample Ready",              "groupName":"",    "order":19},
    {"id":"ei21", "name":"양산시작",                  "groupName":"",    "order":20}
  ],
  "equipUnits": [],
  "visionEquips": [],
  "visionTemplate": {
    "categories": [
      {
        "id": "vc_basic", "name": "기본정보", "order": 0,
        "items": [
          {"id":"vi_site",    "name":"사이트",   "type":"text",        "order":0, "showInGrid":false},
          {"id":"vi_line",    "name":"라인",     "type":"text",        "order":1, "showInGrid":false},
          {"id":"vi_unit",    "name":"호기",     "type":"text",        "order":2, "showInGrid":false},
          {"id":"vi_type",    "name":"Type",     "type":"multiselect", "order":3, "showInGrid":false,
           "options":["Notching","Delamination","Foil","NGMarking","DNC_Notching","DNC_Cutting"]},
          {"id":"vi_sn",      "name":"S/N",      "type":"text",        "order":4, "showInGrid":false},
          {"id":"vi_program", "name":"Program",  "type":"type-program","order":5, "showInGrid":true},
          {"id":"vi_notes",   "name":"특이사항", "type":"textarea",    "order":6, "showInGrid":false}
        ]
      },
      {
        "id": "vc_board", "name": "Board", "order": 1,
        "groups": [
          {
            "id":"vg_trig","name":"TRIGGER BOARD","order":0,
            "items":[
              {"id":"vi_board_trig","name":"Trigger Board","type":"board-multi","order":0,"showInGrid":false,
               "labels":["사용 용도","BOARD 버전","FIRMWARE"]}
            ]
          },
          {
            "id":"vg_fg","name":"FRAME GRABBER","order":1,
            "items":[
              {"id":"vi_fg","name":"Frame Grabber","type":"board-multi","order":0,"showInGrid":false,
               "labels":["제조사","BOARD 버전","FIRMWARE"],"pcSelect":true}
            ]
          },
          {
            "id":"vg_sync","name":"SYNC BOARD","order":2,
            "items":[
              {"id":"vi_sync","name":"Sync Board","type":"board-multi","order":0,"showInGrid":false,
               "labels":["제조사","BOARD 버전","FIRMWARE"],"pcSelect":true}
            ]
          }
        ]
      },
      {
        "id": "vc_controller", "name": "Controller", "order": 2,
        "groups": [
          {
            "id":"vg_af_ctrl","name":"AF CONTROLLER","order":0,
            "items":[
              {"id":"vi_af_ctrl","name":"AF Controller","type":"spec-qty","order":0,"showInGrid":false,
               "specPlaceholder":"예: 제조사 모델명"}
            ]
          }
        ]
      },
      {
        "id": "vc_vision", "name": "Vision", "order": 3,
        "groups": [
          {
            "id":"vg_camera","name":"CAMERA","order":0,
            "items":[
              {"id":"vi_cameras","name":"Camera","type":"type-camera","order":0,"showInGrid":true}
            ]
          },
          {
            "id":"vg_light","name":"ILLUMINATION","order":1,
            "items":[
              {"id":"vi_illumination","name":"Illumination","type":"type-illum","order":0,"showInGrid":false}
            ]
          }
        ]
      },
      {
        "id": "vc_pc", "name": "PC", "order": 4,
        "items": [
          {"id":"vi_pc","name":"PC","type":"type-pc","order":0,"showInGrid":false}
        ]
      }
    ]
  },
  "groups": [
    {"id": "lges", "name": "LGES(해외)"},
    {"id": "skon", "name": "SKON(해외)"},
    {"id": "display", "name": "DISPLAY(해외)"},
    {"id": "domestic", "name": "국내"}
  ]
};