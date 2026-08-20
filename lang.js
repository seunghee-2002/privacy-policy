/* 언어 자동 감지 이동 + 언어 선택 기억.
   이 파일은 todays-weapon-rental / privacy-policy 두 저장소에 같은 내용으로 복제되어 있다.
   한쪽을 고치면 반드시 다른 쪽도 같이 고칠 것.

   문서마다 지원 언어가 다르다 (todays-weapon-rental=4개, balance-master=8개, 사이트 목차=9개).
   그래서 지원 언어는 script 태그의 data-langs가 정하고, 속성이 없으면 DEFAULT_LANGS(기존 4개)로
   동작한다 — 기존 문서를 수정하지 않아도 예전과 똑같이 움직인다.
   지원하지 않는 언어가 기억되어 있거나 감지되면 그 문서에서는 en으로 폴백한다. */
(function () {
  var DEFAULT_LANGS = ['ko', 'en', 'ja', 'zh-Hans'];   // ko는 사이트 루트(접두사 없음)
  var KEY = 'twr-lang';                        // 같은 오리진의 다른 Pages 저장소와 충돌하지 않게 접두사를 둔다

  var me = document.currentScript;
  if (!me) return;                             // 없으면 정적 스위처만으로 동작한다

  var cur  = me.getAttribute('data-lang') || 'ko';
  var page = me.getAttribute('data-page') || '';   // 언어 루트 기준 문서 경로
  var root = me.src.replace(/[^/]*$/, '');         // lang.js 위치 = 사이트 루트 (베이스 경로를 코드에 박지 않는다)

  // 이 문서가 실제로 번역되어 있는 언어 목록. 없는 언어로 보내면 404가 되므로 문서마다 받는다.
  var attr = me.getAttribute('data-langs');
  var LANGS = attr ? attr.split(/\s+/).filter(Boolean) : DEFAULT_LANGS;

  function valid(v) { return LANGS.indexOf(v) >= 0 ? v : null; }
  function urlFor(lang) { return root + (lang === 'ko' ? '' : lang + '/') + page; }

  // localStorage는 file:// 오리진과 사파리 프라이빗 모드에서 예외를 던진다
  function read()   { try { return valid(localStorage.getItem(KEY)); } catch (e) { return null; } }
  function write(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

  // ?lang=ja 형태의 1회성 명시 지정. 저장하지 않으므로 사용자의 기존 선택을 훼손하지 않는다.
  // 번역본의 "한국어 원문" 링크와 검증에 쓴다.
  function fromQuery() {
    var m = /[?&]lang=([^&]+)/.exec(location.search);
    return m ? valid(decodeURIComponent(m[1])) : null;
  }

  // BCP 47 태그 -> 이 사이트의 언어 코드. 지원 언어 전체(9개)를 대상으로 한다.
  function normalize(tag) {
    var t = String(tag).toLowerCase();
    if (t.indexOf('ko') === 0) return 'ko';        // ko, ko-KR
    if (t.indexOf('ja') === 0) return 'ja';        // ja, ja-JP
    if (t.indexOf('zh') === 0) return 'zh-Hans';   // zh-CN/SG 뿐 아니라 번체(zh-TW/HK/Hant)도 간체로 유도
    if (t.indexOf('en') === 0) return 'en';        // en, en-US, en-GB
    if (t.indexOf('de') === 0) return 'de';        // de, de-AT, de-CH
    if (t.indexOf('pt') === 0) return 'pt';        // pt, pt-BR, pt-PT
    if (t.indexOf('es') === 0) return 'es';        // es, es-ES, es-MX
    if (t.indexOf('id') === 0 || t.indexOf('in') === 0) return 'id';  // 인도네시아어의 구 코드가 in
    if (t.indexOf('vi') === 0) return 'vi';        // vi, vi-VN
    return null;
  }

  // 브라우저 언어 -> 이 문서가 지원하는 언어. 지원하지 않으면 en으로 보낸다.
  function detect() {
    var list = (navigator.languages && navigator.languages.length)
      ? navigator.languages : [navigator.language || ''];
    for (var i = 0; i < list.length; i++) {
      var hit = valid(normalize(list[i]));
      if (hit) return hit;
    }
    return valid('en') || LANGS[0];
  }

  // 1) 자동 이동
  // data-lang은 파일마다 하드코딩이라 도착 페이지에서 want === cur 이 성립한다 -> 무한 루프 불가.
  // search를 함께 넘겨야 ?lang= 명시 지정이 도착 페이지까지 전달되고, hash는 #data-deletion 보존용이다.
  // replace를 쓰는 이유: href면 원래 언어가 히스토리에 남아 뒤로가기 시 즉시 재이동하는 트랩이 생긴다.
  var want = fromQuery() || read() || detect();
  if (want !== cur) {
    location.replace(urlFor(want) + location.search + location.hash);
    return;
  }

  // 2) 스위처 클릭 = 수동 선택. 마크업은 각 HTML에 정적으로 있고 여기서는 기록만 한다.
  // 기록은 문서의 지원 언어가 아니라 전체 언어 기준으로 한다 (예: balance-master에서 고른 Deutsch를
  // 저장해 두면 사이트 목차에서도 독일어로 열린다). 지원하지 않는 문서에서는 read()가 걸러낸다.
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[data-setlang]') : null;
    if (!a) return;
    var lang = a.getAttribute('data-setlang');
    if (!lang || !normalize(lang)) return;
    write(lang);
    // 읽던 위치(#앵커)는 유지하되 search는 버린다.
    // ?lang=ko 로 들어온 상태에서 日本語를 누르면 /ja/...?lang=ko 가 되어 되돌려차이기 때문.
    // getAttribute로 원본 href를 읽으므로 반복 클릭에도 hash가 누적되지 않는다.
    a.href = a.getAttribute('href') + location.hash;
  });
})();
