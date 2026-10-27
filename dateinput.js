/* ══════════════════════════════════════════
   날짜 입력칸 공통 — 앱의 모든 <input type="date">를 "직접 입력 + 달력 버튼" 칸으로 바꾼다
   - 직접 입력: 20261027 · 261027 · 26.10.27 · 2026/10/27 · 2026-10-27 어느 형식이든 칸을 벗어나면 2026-10-27로 정리
   - 달력 선택: 오른쪽 달력 버튼
   - 원래 date 칸은 그대로 두고(숨김) 값만 맞춰 준다 → id, onchange/oninput, .value 읽기·쓰기를 쓰는 기존 코드는 수정 없이 동작
   - 읽을 수 없는 값을 입력하면 이전 값으로 되돌리고 칸 테두리를 잠깐 빨갛게 표시한다(잘못된 날짜가 저장되지 않음)
   ══════════════════════════════════════════ */
(function(){
  var NATIVE=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');

  // 반환: 'YYYY-MM-DD' | ''(빈 값) | null(읽을 수 없음)
  function parse(txt){
    var t=String(txt||'').trim(); if(!t) return '';
    var y,mo,d, m=t.match(/^(\d{2}|\d{4})[-./\s]+(\d{1,2})[-./\s]+(\d{1,2})$/);
    if(m){ y=m[1]; mo=m[2]; d=m[3]; }
    else if(/^\d{8}$/.test(t)){ y=t.slice(0,4); mo=t.slice(4,6); d=t.slice(6,8); }
    else if(/^\d{6}$/.test(t)){ y=t.slice(0,2); mo=t.slice(2,4); d=t.slice(4,6); }
    else return null;
    if(y.length===2) y='20'+y;
    var dt=new Date(+y,+mo-1,+d);
    if(dt.getFullYear()!==+y||dt.getMonth()!==+mo-1||dt.getDate()!==+d) return null;
    return y+'-'+('0'+mo).slice(-2)+'-'+('0'+d).slice(-2);
  }
  window.dtParse=parse;

  function enhance(el){
    if(el.getAttribute('data-dt')) return;
    el.setAttribute('data-dt','1');
    var wrap=document.createElement('span'); wrap.className='dt-wrap';
    var st=el.getAttribute('style'); if(st) wrap.setAttribute('style',st);
    var txt=document.createElement('input'); txt.type='text';
    txt.className='dt-txt'+(el.className?' '+el.className:'');
    txt.placeholder='YYYY-MM-DD'; txt.maxLength=10; txt.setAttribute('inputmode','numeric'); txt.autocomplete='off';
    txt.title='직접 입력(예: 20261027, 26.10.27) 또는 오른쪽 달력 버튼으로 선택';
    var btn=document.createElement('button'); btn.type='button'; btn.className='dt-btn'; btn.tabIndex=-1;
    btn.title='달력에서 선택'; btn.innerHTML='&#128197;';
    if(el.disabled){ txt.disabled=true; btn.disabled=true; }
    el.parentNode.insertBefore(wrap,el);
    wrap.appendChild(txt); wrap.appendChild(btn); wrap.appendChild(el);

    function sync(){ txt.value=NATIVE.get.call(el); }
    function flash(msg){
      txt.classList.add('dt-bad'); txt.title=msg;
      setTimeout(function(){ txt.classList.remove('dt-bad'); txt.title='직접 입력(예: 20261027, 26.10.27) 또는 오른쪽 달력 버튼으로 선택'; },1800);
    }
    // 코드가 el.value를 직접 바꿔도(예: 출하일 → 셋업 완료일 자동 입력) 보이는 칸이 따라가도록
    Object.defineProperty(el,'value',{
      get:function(){ return NATIVE.get.call(el); },
      set:function(v){ NATIVE.set.call(el,v); sync(); },
      configurable:true
    });
    el.focus=function(){ txt.focus(); };
    el.addEventListener('input',sync); el.addEventListener('change',sync);

    txt.addEventListener('change',function(){
      var v=parse(txt.value);
      if(v===null){ flash('날짜 형식을 확인해 주세요 (예: 2026-10-27)'); sync(); return; }
      if(v&&el.min&&v<el.min){ flash(el.min+' 이후 날짜만 입력할 수 있습니다'); sync(); return; }
      if(v&&el.max&&v>el.max){ flash(el.max+' 이전 날짜만 입력할 수 있습니다'); sync(); return; }
      if(v!==NATIVE.get.call(el)){
        NATIVE.set.call(el,v);
        el.dispatchEvent(new Event('input',{bubbles:true}));
        el.dispatchEvent(new Event('change',{bubbles:true}));
      }
      sync();
    });
    // 입력칸에 붙여넣기도 원래 칸의 onpaste(예: 일괄 등록 표)로 전달
    txt.addEventListener('paste',function(e){ if(typeof el.onpaste==='function') el.onpaste.call(el,e); });
    btn.addEventListener('click',function(){
      if(el.disabled) return;
      try{ el.showPicker(); }catch(err){ HTMLElement.prototype.focus.call(el); el.click(); }
    });
    sync();
  }

  var scheduled=false;
  function scan(){
    scheduled=false;
    var list=document.querySelectorAll('input[type=date]:not([data-dt])');
    for(var i=0;i<list.length;i++) enhance(list[i]);
  }
  function schedule(){ if(scheduled) return; scheduled=true; (window.queueMicrotask||function(f){Promise.resolve().then(f);})(scan); }
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  scan();
})();
