(() => {
  "use strict";

  // ─────────────────────────────────────────────
  // 갤러리 webp 변환 v1.8.1
  //
  // v1.8.1: 교체 뒤 확인에서 고친 메시지는 반드시 서버에서 다시 읽음(스와이프 기록, 없으면 방 목록 재수신),
  //         새로고침 복구용 잠금 표 기억을 localStorage→sessionStorage로(다른 탭의 표를 내 것으로 오인하지 않음).
  //
  // v1.8.0: 메시지 목록을 한 번에 받지 않고 엔진 화면처럼 페이지 단위(50개, ?limit=&before=커서)로 받는다.
  //         큰 방은 응답 하나가 수십 MB라 브라우저가 해석하는 동안 화면이 까맣게 멈추던 문제 대응.
  //         페이지 사이마다 화면에 양보하고 진행 표시에 "메시지 읽는 중 n페이지"를 보여 준다.
  //         변환 순서(갤러리 생성일 오래된 순)와 안전장치는 그대로.
  //
  // v1.7.2: 전체 변환 예상 시간을 분당 30장 기준으로(요청 제한에 걸리면 더 걸린다고 안내).
  //
  // v1.7.1: 방 전체 메시지 목록은 작업당 한 번만 받고(고친 메시지는 서버 응답으로 제자리 갱신), 적용 직전엔
  //         고칠 메시지의 스와이프만 새로 읽음 — 큰 방에서 느려지던 것을 줄임.
  //
  // v1.7.0: 서버 요청 제한(1분 600회) 대응 — 읽은 메시지 목록·스와이프를 작업 안에서 재사용하고 고친 메시지만
  //         다시 읽어 요청 수를 크게 줄임, 분당 420회 아래로 스스로 속도 조절, 429가 오면 서버가 알려 주는
  //         시간만큼 쉬고 재시도(429는 처리 전 거절이라 중복 없음). 진행 표시에 대기 사유 표시.
  //
  // v1.6.4: 알림을 PC에서도 화면 위쪽에 표시(입력창 가림 방지).
  //
  // v1.6.3: 새로고침으로 끊긴 내 작업의 잠금 표를 알아보고(브라우저 저장소에 표 기억) 넘어감, 끊긴 표 판정을
  //         15분→3분으로, 설정 팝오버에 "작업 표 지우기" 버튼과 남은 표 안내 추가.
  //
  // v1.6.2: 생성 진행 중일 때 한 장마다 60초씩 기다리던 것을 작업당 한 번(60초)으로 줄이고, 그래도 계속이면
  //         남은 삽화는 바로 "PNG로 남김"으로 미룸. 진행 표시에 "생성이 끝나길 기다리는 중" 추가, 결과 알림 문구 정리.
  //
  // v1.6.1: 대화 모드 입력창의 중지 아이콘도 생성 중으로 감지, 잠금 갱신 전 소유자 확인(남의 잠금이면 중단).
  //
  // v1.6.0: 3차 검토 반영 — 생성 진행 중(보내기 버튼이 중지 아이콘, 갤러리 생성 버튼 바쁨)이면
  //         변환을 미루고, 첨부 교체 뒤 다시 읽어 옛 주소가 남아 있으면 PNG를 지우지 않음.
  //         다른 기기 잠금은 "쓰고 잠시 뒤 확인"으로 동시 시작을 거르고 60초마다 갱신, 내 표일 때만 해제.
  //         서버 시각을 못 읽으면 사본 만들기 중단. 되돌리기 때 만든 사본을 명시적으로 삭제.
  //
  // v1.5.0: 2차 검토 반영 — 첨부 자리를 적용 직전에 다시 읽음(준비 뒤 변경 덮어쓰기 방지),
  //         다른 방·갤러리 조회는 404만 "없음"으로 보고 나머지 오류는 건너뜀, 사본 탐색을
  //         모든 캐릭터·페르소나로 확장, 사본 판정에 파일 해시 비교, 60초 연동 검사와 2분 대기를
  //         서버 시각으로, 본문 링크는 이 서버 주소만, 첨부 없는 삽화는 자동 변환 안 함,
  //         다른 탭·기기와의 잠금(확장 저장소).
  //
  // v1.4.0: 데이터 보존 보강(코덱스 검토 반영)
  //  - 삽화마다 관련 방(소유 방·열린 방·같은 그룹·연결된 방) 전체의 메시지를 새로 읽어
  //    첨부 자리를 확인하고, 스와이프 번호를 명시해 패치한다.
  //  - 조회 실패, 사본 업로드 실패, 고칠 수 없는 비활성 스와이프 본문 링크가 있으면
  //    PNG를 남기고 건너뛴다. 사본 실패 시 새 WebP는 되돌린다.
  //  - 자동 변환은 메시지에 첨부가 끝난 삽화만 바로 처리한다.
  //  - 실행 잠금을 첫 대기 전에 걸고 시작한 쪽만 푼다.
  //  - 옛 사본 판정에 파일 크기 비교를 더하고, 첨부 매칭은 ID 우선·같은 서버 경로,
  //    본문 치환은 링크 단위로 바꾼다. 전체 사본 만들기는 생성 2분 안 된 삽화를 건너뛴다.
  //
  // v1.3.0: 팝오버 정리 — 설명은 ? 버튼 뒤로, 변환 품질을 자동 변환 위로, 완료 알림을 하위 토글로,
  //         "생성 삽화 자동 변환"으로 이름 변경, 용어를 "삽화"로 통일.
  // v1.2.1: 자동 변환 완료 알림 켜기/끄기(기본 꺼짐, 실패는 항상 알림), 폰 화면에서는
  //         알림을 입력창 대신 위쪽에 띄움.
  // v1.2.0: 자동 변환 진단 — 팝오버에 마지막 점검 시각·결과·오류 표시, "지금 점검" 버튼,
  //         실패는 토스트로 알리고 3번까지 재시도, 기준 시각을 서버 시계(가장 새 그림)로 잡아
  //         폰 시계가 어긋나도 동작. 대기 시간도 기기 시계 차이를 타지 않게 계산.
  // v1.1.1: 문구 손질 — 사본 만들기 버튼 이름, "탭" 설명, 순정 엔진의 자동 저장 설정 언급.
  // v1.1.0: 그리드 기본/3/4/5열, 품질 5단위, 사본 대상(캐릭터/페르소나) 선택,
  //         설정에 따른 예상 용량 표시(순정은 파일 1장을 세 갤러리에서 공유하지만
  //         확장은 갤러리마다 파일이 하나씩 늘어난다).
  //
  // 채팅방 갤러리의 PNG 삽화를 브라우저에서 WebP로 다시 인코딩해
  // 갤러리에 올리고, 메시지 첨부를 새 파일로 이어 붙인 뒤 옛 파일을
  // 지운다. 엔진은 건드리지 않고 순정 갤러리·채팅 API만 쓴다.
  //
  // 들어가는 자리
  //  - 갤러리 헤더(창으로 띄웠을 때는 핀 옆, 채팅 설정 안에 접혀 있을
  //    때는 섹션 제목 줄): 설정 버튼 → 팝오버
  //  - 선택 바(선택 다운로드/선택 삭제 옆): 선택 변환 · 선택 프롬 복사
  // ─────────────────────────────────────────────

  if (typeof marinara === "undefined" || !marinara || !marinara.storage) {
    console.warn("[갤러리 webp 변환] marinara 런타임이 없어 실행하지 않습니다.");
    return;
  }

  const EXT_NAME = "갤러리 webp 변환";
  const ACTIVE_CHAT_KEY = "marinara-active-chat-id";
  const PINNED_KEY = "marinara-pinned-gallery-images";
  const SCAN_MS = 1200;
  const AUTO_POLL_MS = 10_000;
  // 생성 직후 서버가 메시지 첨부·캐릭터 갤러리 연결을 끝낼 시간을 준다.
  const AUTO_MIN_AGE_MS = 8_000;
  // 작업 중에는 60초마다 잠금 표를 갱신한다. 3분 넘게 갱신이 없으면 끊긴 작업으로 보고 무시한다.
  const REMOTE_LOCK_STALE_MS = 3 * 60_000;
  // 이 탭이 마지막으로 잡았던 잠금 표. 새로고침으로 끊긴 내 작업의 표를 알아보기 위해.
  // sessionStorage는 탭마다 따로라서, 다른 탭의 표를 내 것으로 오인하지 않는다(localStorage는 탭끼리 공유됨).
  const OWN_LOCK_KEY = "gwc-own-lock-token";
  const INSTANCE_ID = Math.random().toString(36).slice(2, 10);
  // 삭제 연동 규칙(같은 그림의 복사본 판정)이 보는 시간 창. 사본 업로드는 이 안에 끝내야 한다.
  const COPY_LINK_WINDOW_MS = 60_000;
  const CONVERTIBLE_EXT = /\.(png|jpe?g|bmp|tiff?|avif)$/i;

  const DEFAULTS = Object.freeze({
    columns: 0, // 0 = 마리나라 기본(2열)
    autoConvert: false,
    autoToast: false, // 자동 변환이 끝났을 때 알림을 띄울지 (실패는 항상 알림)
    autoSince: null, // 자동 변환을 켠 시각(ISO). 그 뒤에 생성된 그림만 자동 변환.
    quality: 95,
    copyToEntityGalleries: false,
    // 사본을 올릴 갤러리. 변환 때(토글 켜짐)와 "사본 만들기" 버튼이 함께 본다.
    copyCharacters: true,
    copyPersonas: false,
  });
  const COLUMN_OPTIONS = [0, 3, 4, 5];
  const QUALITY_STEP = 5;
  // 크롬 캔버스 인코딩 실측(832x1216 삽화 4장 평균): PNG 대비 WebP 비율. 100은 무손실.
  const SIZE_RATIO = { 70: 0.04, 75: 0.047, 80: 0.056, 85: 0.07, 90: 0.09, 95: 0.125, 100: 0.57 };

  const SVG = {
    settings:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>',
    convert:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>',
    copy:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  };

  const state = {
    settings: { ...DEFAULTS },
    settingsLoaded: false,
    chatId: null,
    webpSupported: null, // null = 아직 모름
    run: null, // 진행 중인 작업 { kind, total, done, saved, cancelled, failed, skipped }
    panel: null,
    panelAnchor: null,
    openHelp: new Set(), // 설명이 펼쳐진 ? 버튼들

    autoTimer: null,
    autoBusy: false,
    autoFirstSeen: new Map(), // 자동 변환 점검에서 그림을 처음 본 시각(이 기기 기준) — 기기 시계와 서버 시계 차이를 타지 않는다
    autoFailures: new Map(), // 이미지 id → 자동 변환 실패 횟수 (3번까지 다시 시도)
    autoStatus: { lastCheck: null, note: "", error: null }, // 설정 팝오버에 보여 주는 점검 상태
    autoLastToastedError: null,
    remoteLockInfo: null, // 다른 탭·기기의 작업 표(팝오버에서 수동 해제용)
    lastRunSummary: null, // 마지막 변환 작업 결과(알림을 놓쳤을 때 팝오버에서 확인)
  };

  const cleanupFns = [];
  const onCleanup = (fn) => cleanupFns.push(fn);

  // ───────────────────────── 유틸 ─────────────────────────

  const log = {
    info: (...a) => marinara.log?.info?.(`[${EXT_NAME}]`, ...a),
    warn: (...a) => marinara.log?.warn?.(`[${EXT_NAME}]`, ...a),
    error: (...a) => marinara.log?.error?.(`[${EXT_NAME}]`, ...a),
  };

  function readActiveChatId() {
    try {
      return localStorage.getItem(ACTIVE_CHAT_KEY) || null;
    } catch {
      return null;
    }
  }

  function fmtBytes(n) {
    if (!Number.isFinite(n)) return "?";
    if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)}MB`;
    if (n >= 1024) return `${Math.round(n / 1024)}KB`;
    return `${n}B`;
  }

  function pathOf(url) {
    try {
      return new URL(url, location.origin).pathname;
    } catch {
      return String(url || "");
    }
  }

  function isWebpPath(filePath) {
    return /\.webp$/i.test(String(filePath || ""));
  }

  function isConvertible(image) {
    return CONVERTIBLE_EXT.test(String(image?.filePath || ""));
  }

  function byOldest(a, b) {
    return Date.parse(a.createdAt || 0) - Date.parse(b.createdAt || 0);
  }

  function parseExtra(extra) {
    if (!extra) return {};
    if (typeof extra === "string") {
      try {
        return JSON.parse(extra) || {};
      } catch {
        return {};
      }
    }
    return typeof extra === "object" ? extra : {};
  }

  async function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  // ───────────────────────── API ─────────────────────────

  const doFetch = typeof marinara.fetch === "function" ? marinara.fetch : window.fetch.bind(window);

  // 서버는 기본적으로 1분에 600회까지만 받는다(그 뒤는 429). 그 아래로 스스로 속도를 맞추고,
  // 그래도 429가 오면 서버가 알려 주는 시간만큼 쉬었다가 다시 보낸다. 429는 요청을 처리하기 전에
  // 거절하는 것이라 업로드도 중복 없이 다시 보낼 수 있다.
  const REQUEST_WINDOW_MS = 60_000;
  const REQUEST_BUDGET = 420;
  // 메시지 목록 한 페이지 크기. 엔진 화면은 20개씩 받는다. 1,520개짜리 방 실측에서 100개는 최대 4MB,
  // 50개면 2MB 안팎이라 화면이 멈추지 않으면서 요청 수도 과하지 않다.
  const MESSAGE_PAGE_SIZE = 50;
  const requestTimes = [];
  async function throttle() {
    const now = Date.now();
    while (requestTimes.length && now - requestTimes[0] > REQUEST_WINDOW_MS) requestTimes.shift();
    if (requestTimes.length >= REQUEST_BUDGET) {
      const wait = REQUEST_WINDOW_MS - (now - requestTimes[0]) + 200;
      setThrottleNote(`서버 요청 제한에 맞춰 ${Math.ceil(wait / 1000)}초 쉬는 중`);
      await sleep(wait);
      setThrottleNote(null);
      return throttle();
    }
    requestTimes.push(Date.now());
  }
  function setThrottleNote(note) {
    if (state.run) {
      state.run.throttleNote = note;
      renderPanel();
    }
  }
  function setRunNote(note) {
    if (state.run) {
      state.run.readNote = note;
      renderPanel();
    }
  }

  async function api(method, path, body, { attempt = 0 } = {}) {
    const headers = { "x-marinara-csrf": "1" };
    const init = { method, headers, cache: "no-store", credentials: "same-origin" };
    if (body instanceof FormData) init.body = body;
    else if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    await throttle();
    const res = await doFetch(`/api${path}`, init);
    if (res.status === 429 && attempt < 5) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : Math.min(60_000, 5_000 * 2 ** attempt);
      setThrottleNote(`서버 요청 제한(429), ${Math.ceil(wait / 1000)}초 뒤 다시 시도`);
      await sleep(wait);
      setThrottleNote(null);
      return api(method, path, body, { attempt: attempt + 1 });
    }
    if (!res.ok) {
      let detail = "";
      try {
        const j = await res.json();
        if (j && j.error) detail = ` - ${j.error}`;
      } catch {
        /* ignore */
      }
      const error = new Error(`${method} ${path} 실패 (${res.status}${detail})`);
      error.status = res.status;
      throw error;
    }
    if (res.status === 204) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  async function fetchBlob(url, attempt = 0) {
    await throttle();
    const res = await doFetch(url, { cache: "no-store", credentials: "same-origin" });
    if (res.status === 429 && attempt < 5) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : Math.min(60_000, 5_000 * 2 ** attempt);
      setThrottleNote(`서버 요청 제한(429), ${Math.ceil(wait / 1000)}초 뒤 다시 시도`);
      await sleep(wait);
      setThrottleNote(null);
      return fetchBlob(url, attempt + 1);
    }
    if (!res.ok) throw new Error(`이미지를 받지 못했습니다 (${res.status})`);
    return res.blob();
  }

  /** 404(없음)인지, 그 밖의 오류(통신·서버 장애)인지 구분한다. 후자는 "없음"으로 오인하면 안 된다. */
  function isNotFound(error) {
    return error && error.status === 404;
  }

  /** 서버 시계(응답 Date 헤더). 기기 시계가 어긋나도 서버 기준으로 비교하기 위해. 못 읽으면 던진다. */
  async function serverNow() {
    const res = await doFetch("/api/personal-extensions/", { method: "HEAD", cache: "no-store", credentials: "same-origin" });
    const t = Date.parse(res.headers.get("date") || "");
    if (!Number.isFinite(t)) throw new Error("서버 시각을 확인하지 못했습니다");
    return t;
  }

  /**
   * 이 화면에서 생성이 진행 중인지(보내기 버튼이 중지 아이콘일 때, 갤러리 생성 버튼이 바쁠 때).
   * 생성기가 첨부를 덧붙이는 순간과 겹치지 않도록, 진행 중이면 변환을 미룬다.
   */
  function chatIsGenerating() {
    const STOP_ICON = "button svg.lucide-stop-circle, button svg.lucide-circle-stop";
    // 롤플레이 입력창(.mari-chat-send-btn)과 대화 모드 입력창(클래스 없음) 모두: 입력칸을 감싸는 블록 안의 중지 아이콘
    if (document.querySelector(`.mari-chat-send-btn svg.lucide-stop-circle, .mari-chat-send-btn svg.lucide-circle-stop`)) return true;
    const composer = document.querySelector("textarea[data-chat-composer]");
    let scope = composer;
    for (let depth = 0; scope && depth < 6; depth += 1) {
      if (scope.querySelector(STOP_ICON)) return true;
      scope = scope.parentElement;
    }
    // 백그라운드 삽화 생성 중에는 입력창이 중지 아이콘을 숨기므로, 갤러리의 생성 버튼 상태도 본다(갤러리가 열려 있을 때만 보임).
    return !!document.querySelector(`${ROOT_SEL.split(", ").map((s) => `${s} [aria-busy="true"]`).join(", ")}`);
  }

  async function waitForQuiet(maxMs = 60_000) {
    const started = Date.now();
    while (chatIsGenerating()) {
      if (Date.now() - started > maxMs) return false;
      await sleep(1000);
    }
    return true;
  }

  async function sha256Hex(blob) {
    const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // ───────────────────────── 설정 저장 ─────────────────────────

  async function loadSettings() {
    try {
      const saved = await marinara.storage.get();
      const value = saved && typeof saved === "object" ? { ...saved } : {};
      delete value.runLock; // 작업 잠금은 설정이 아니다
      state.settings = { ...DEFAULTS, ...value };
      state.settings.quality = clampQuality(state.settings.quality);
      // 1.0.0의 "2열"은 기본과 같으므로 기본으로 되돌린다.
      state.settings.columns = COLUMN_OPTIONS.includes(Number(state.settings.columns)) ? Number(state.settings.columns) : 0;
      state.settings.copyCharacters = state.settings.copyCharacters !== false;
      state.settings.copyPersonas = state.settings.copyPersonas === true;
    } catch (error) {
      log.warn("설정을 읽지 못했습니다", error);
      state.settings = { ...DEFAULTS };
    }
    state.settingsLoaded = true;
  }

  async function saveSettings(patch) {
    state.settings = { ...state.settings, ...patch };
    try {
      await marinara.storage.patch(patch);
    } catch (error) {
      log.warn("설정을 저장하지 못했습니다", error);
      toast("설정을 저장하지 못했습니다", "error");
    }
    applyColumns();
    renderPanel();
    syncAuto();
  }

  function clampQuality(q) {
    const n = Number(q);
    if (!Number.isFinite(n)) return DEFAULTS.quality;
    const stepped = Math.round(n / QUALITY_STEP) * QUALITY_STEP;
    return Math.min(100, Math.max(70, stepped));
  }

  /** 지금 설정으로 변환하면 PNG 1장 대비 몇 %가 되는지(사본 포함). */
  function estimateRatio() {
    const s = state.settings;
    const per = SIZE_RATIO[clampQuality(s.quality)] ?? SIZE_RATIO[95];
    const copies = s.copyToEntityGalleries ? (s.copyCharacters ? 1 : 0) + (s.copyPersonas ? 1 : 0) : 0;
    return { per, copies, total: per * (1 + copies) };
  }

  // ───────────────────────── 토스트 ─────────────────────────

  let toastHost = null;
  function toast(message, kind = "info", ms = 3200) {
    if (!toastHost) {
      toastHost = document.createElement("div");
      toastHost.className = "gwc-toast-host";
      toastHost.setAttribute("data-chat-floating-panel", "");
      document.body.appendChild(toastHost);
    }
    const el = document.createElement("div");
    el.className = `gwc-toast gwc-toast--${kind}`;
    el.textContent = message;
    toastHost.appendChild(el);
    requestAnimationFrame(() => el.classList.add("gwc-toast--in"));
    setTimeout(() => {
      el.classList.remove("gwc-toast--in");
      setTimeout(() => el.remove(), 250);
    }, ms);
  }

  function confirmDialog({ title, message, confirmLabel = "확인", danger = false }) {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "gwc-overlay";
      overlay.setAttribute("data-chat-floating-panel", "");
      overlay.innerHTML = `
        <div class="gwc-dialog" role="dialog" aria-modal="true">
          <h3 class="gwc-dialog__title"></h3>
          <p class="gwc-dialog__message"></p>
          <div class="gwc-dialog__actions">
            <button type="button" class="gwc-btn" data-act="cancel">취소</button>
            <button type="button" class="gwc-btn gwc-btn--primary" data-act="ok"></button>
          </div>
        </div>`;
      overlay.querySelector(".gwc-dialog__title").textContent = title;
      overlay.querySelector(".gwc-dialog__message").textContent = message;
      const ok = overlay.querySelector('[data-act="ok"]');
      ok.textContent = confirmLabel;
      if (danger) ok.classList.add("gwc-btn--danger");
      const done = (value) => {
        overlay.remove();
        document.removeEventListener("keydown", onKey, true);
        resolve(value);
      };
      const onKey = (e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          done(false);
        }
      };
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) done(false);
      });
      overlay.querySelector('[data-act="cancel"]').addEventListener("click", () => done(false));
      ok.addEventListener("click", () => done(true));
      document.addEventListener("keydown", onKey, true);
      document.body.appendChild(overlay);
      ok.focus();
    });
  }

  // ───────────────────────── 마리나라 화면 갱신 ─────────────────────────

  let cachedQueryClient = null;
  function findQueryClient() {
    if (cachedQueryClient) return cachedQueryClient;
    const container = document.getElementById("root");
    if (!container) return null;
    const key = Object.keys(container).find((n) => n.startsWith("__reactContainer$") || n.startsWith("__reactFiber$"));
    if (!key) return null;
    const queue = [container[key]];
    let steps = 0;
    while (queue.length && steps < 600) {
      const node = queue.shift();
      steps += 1;
      if (!node) continue;
      const client = node.memoizedProps?.client;
      if (client && typeof client.invalidateQueries === "function") {
        cachedQueryClient = client;
        return client;
      }
      if (node.child) queue.push(node.child);
      if (node.sibling) queue.push(node.sibling);
    }
    return null;
  }

  /** 변환 뒤 갤러리·메시지 목록을 다시 불러오도록 마리나라에 요청한다. 실패하면 false. */
  function refreshMarinara(chatIds) {
    try {
      const client = findQueryClient();
      if (!client) return false;
      void client.invalidateQueries({ queryKey: ["gallery"] });
      for (const id of chatIds) void client.invalidateQueries({ queryKey: ["chats", "messages", id] });
      return true;
    } catch (error) {
      log.warn("화면 갱신 요청 실패", error);
      return false;
    }
  }

  // ───────────────────────── WebP 인코딩 ─────────────────────────

  async function probeWebpSupport() {
    if (state.webpSupported !== null) return state.webpSupported;
    try {
      const c = document.createElement("canvas");
      c.width = 2;
      c.height = 2;
      c.getContext("2d").fillRect(0, 0, 2, 2);
      const blob = await new Promise((r) => c.toBlob(r, "image/webp", 0.8));
      state.webpSupported = !!blob && blob.type === "image/webp";
    } catch {
      state.webpSupported = false;
    }
    return state.webpSupported;
  }

  async function encodeWebp(sourceBlob, quality) {
    const bitmap = await createImageBitmap(sourceBlob);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(bitmap, 0, 0);
      const blob = await new Promise((r) => canvas.toBlob(r, "image/webp", quality / 100));
      if (!blob || blob.type !== "image/webp") throw new Error("이 브라우저는 WebP 인코딩을 지원하지 않습니다");
      return { blob, width: bitmap.width, height: bitmap.height };
    } finally {
      bitmap.close?.();
    }
  }

  // ───────────────────────── 작업 한 번 동안 쓰는 조회 도우미 ─────────────────────────

  /** 변환을 멈추고 PNG를 남겨야 하는 상황. 실패가 아니라 "건너뜀"으로 집계한다. */
  class SkipError extends Error {
    constructor(reason) {
      super(reason);
      this.name = "SkipError";
      this.skip = true;
    }
  }

  function makeRunCache() {
    const chats = new Map();
    const characterGalleries = new Map();
    const personaGalleries = new Map();
    const fileSizes = new Map();
    const fileHashes = new Map();
    const messageLists = new Map(); // chatId → { at, rows }
    const swipeLists = new Map(); // chatId/messageId → swipes[]
    let chatList = null;
    let characterList = null;
    let personaList = null;
    const list = (promise) => promise.then((rows) => (Array.isArray(rows) ? rows : rows?.items || []));
    return {
      /** 모든 캐릭터·페르소나. 엔진은 원본 ID에 연결된 사본을 전체에서 찾아 지우므로 범위를 맞춘다. */
      allCharacters() {
        if (!characterList) characterList = list(api("GET", "/characters"));
        return characterList;
      },
      allPersonas() {
        if (!personaList) personaList = list(api("GET", "/characters/personas/list"));
        return personaList;
      },
      /** 파일 내용 해시. 못 읽으면 던진다(확인 실패를 "다름"으로 오인하지 않기 위해). */
      fileHash(url) {
        if (!fileHashes.has(url)) fileHashes.set(url, fetchBlob(url).then(sha256Hex));
        return fileHashes.get(url);
      },
      /** 조회가 실패하면 던진다. "없음"으로 오인해 삭제하지 않기 위해서다. */
      chat(chatId) {
        if (!chats.has(chatId)) chats.set(chatId, api("GET", `/chats/${encodeURIComponent(chatId)}`));
        return chats.get(chatId);
      },
      allChats() {
        if (!chatList) chatList = list(api("GET", "/chats"));
        return chatList;
      },
      characterGallery(id) {
        if (!characterGalleries.has(id))
          characterGalleries.set(id, list(api("GET", `/characters/${encodeURIComponent(id)}/gallery`)));
        return characterGalleries.get(id);
      },
      personaGallery(id) {
        if (!personaGalleries.has(id))
          personaGalleries.set(id, list(api("GET", `/characters/personas/${encodeURIComponent(id)}/gallery`)));
        return personaGalleries.get(id);
      },
      /** 파일 크기(HEAD). 못 읽으면 null. */
      fileSize(url) {
        if (!fileSizes.has(url)) {
          fileSizes.set(
            url,
            throttle()
              .then(() => doFetch(url, { method: "HEAD", cache: "no-store", credentials: "same-origin" }))
              .then((res) => (res.ok ? Number(res.headers.get("content-length")) || null : null))
              .catch(() => null),
          );
        }
        return fileSizes.get(url);
      },
      /**
       * 메시지 목록. 같은 방을 몇 초 안에 다시 읽을 때는 재사용한다(삽화마다 세 번씩 읽어 요청 제한에
       * 걸리는 것을 막기 위해). 우리가 고친 뒤에는 forgetMessages로 비운다.
       */
      async messages(chatId, maxAgeMs = 0) {
        const hit = messageLists.get(chatId);
        if (hit && Date.now() - hit.at <= maxAgeMs) return hit.rows;
        const rows = await fetchMessages(chatId);
        messageLists.set(chatId, { at: Date.now(), rows });
        return rows;
      },
      forgetMessages(chatId) {
        messageLists.delete(chatId);
      },
      /** 우리가 고친 메시지는 서버 응답으로 읽어 둔 목록을 제자리에서 갱신한다(목록을 통째로 다시 받지 않기 위해). */
      updateMessage(chatId, row) {
        const hit = messageLists.get(chatId);
        if (!hit || !row || !row.id) return;
        const index = hit.rows.findIndex((m) => m.id === row.id);
        if (index >= 0) hit.rows[index] = { ...hit.rows[index], ...row };
      },
      /** 메시지의 스와이프 목록. 작업 동안 한 번만 읽고, 그 메시지를 고치면 forgetSwipes로 비운다. */
      async swipes(chatId, messageId, fresh = false) {
        const key = `${chatId}/${messageId}`;
        if (fresh || !swipeLists.has(key)) {
          const rows = await api("GET", `/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}/swipes`);
          swipeLists.set(key, Array.isArray(rows) ? rows : []);
        }
        return swipeLists.get(key);
      },
      forgetSwipes(chatId, messageId) {
        swipeLists.delete(`${chatId}/${messageId}`);
      },
      hasSwipes(chatId, messageId) {
        return swipeLists.has(`${chatId}/${messageId}`);
      },
      forgetEntityGalleries() {
        characterGalleries.clear();
        personaGalleries.clear();
      },
    };
  }

  /** 메시지는 삽화마다 새로 읽는다. 앞 삽화가 바꾼 첨부를 낡은 복사본으로 되돌리지 않기 위해서다. */
  /**
   * 메시지 목록. limit이 있으면 최신 limit개 한 페이지만, 없으면 엔진 화면과 같은 방식으로
   * 최신부터 페이지 단위(100개)로 끝까지 받아 오래된 순으로 합친다. 큰 방은 한 번에 받으면
   * 응답 하나가 수십 MB라 브라우저가 해석하는 동안 화면이 멈추므로, 페이지 사이마다 화면에 양보한다.
   */
  async function fetchMessages(chatId, { limit } = {}) {
    const base = `/chats/${encodeURIComponent(chatId)}/messages`;
    const asList = (rows) => (Array.isArray(rows) ? rows : rows?.messages || []);
    if (limit) return asList(await api("GET", `${base}?limit=${limit}`));
    const pages = [];
    let before = null;
    for (let page = 1; ; page += 1) {
      const params = new URLSearchParams({ limit: String(MESSAGE_PAGE_SIZE) });
      if (before) params.set("before", before);
      const list = asList(await api("GET", `${base}?${params.toString()}`));
      pages.unshift(list);
      setRunNote(`메시지 읽는 중 ${page}페이지…`);
      if (list.length < MESSAGE_PAGE_SIZE) break;
      const oldest = list[0];
      if (!oldest?.createdAt || !oldest?.id) break;
      before = `${oldest.createdAt}|${encodeURIComponent(oldest.id)}`;
      await new Promise((resolve) => setTimeout(resolve, 0)); // 화면이 그릴 틈
    }
    setRunNote(null);
    return pages.flat();
  }

  /**
   * 삽화 소유 방 + 지금 열린 방 + 같은 그룹(분기·게임 세션)·연결된 방.
   * 분기 만들기는 첨부와 본문을 그대로 복사하므로 다른 방에도 같은 주소가 남는다.
   */
  async function relatedChatIds(cache, image) {
    const ids = new Set([image.chatId]);
    if (state.chatId) ids.add(state.chatId);
    const owner = await cache.chat(image.chatId);
    if (owner?.connectedChatId) ids.add(owner.connectedChatId);
    const all = await cache.allChats();
    for (const chat of all) {
      if (!chat?.id) continue;
      if (owner?.groupId && chat.groupId === owner.groupId) ids.add(chat.id);
      if (chat.connectedChatId === image.chatId) ids.add(chat.id);
    }
    return [...ids];
  }

  /** 다른 방 조회: 404면 지워진 방이니 건너뛰고, 그 밖의 오류는 던진다. */
  async function chatOrNull(cache, chatId) {
    try {
      return await cache.chat(chatId);
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  // ───────────────────────── 캐릭터·페르소나 사본 찾기 ─────────────────────────

  function sameMetadata(row, image) {
    return (
      row.prompt === image.prompt &&
      row.provider === image.provider &&
      row.model === image.model &&
      row.width === image.width &&
      row.height === image.height
    );
  }

  /**
   * 엔진이 "같은 삽화의 사본"으로 보고 함께 지우는 기록인지.
   * 엔진 규칙: 원본 ID 연결, 또는 60초 이내 생성 + 정보 동일 + 파일 크기·해시 동일.
   * 크기는 미리 거르는 용도이고 최종 판정은 해시로 한다. 확인 실패는 던진다.
   */
  async function rowIsCopyOf(cache, row, image) {
    if (row.sourceChatImageId) return row.sourceChatImageId === image.id;
    const dt = Math.abs(Date.parse(row.createdAt || 0) - Date.parse(image.createdAt || 0));
    if (dt > COPY_LINK_WINDOW_MS || !sameMetadata(row, image)) return false;
    return sameFileContent(cache, row, image);
  }

  async function sameFileContent(cache, row, image) {
    if (!row.url || !image.url) return false;
    const [a, b] = await Promise.all([cache.fileSize(row.url), cache.fileSize(image.url)]);
    if (a == null || b == null) throw new Error("파일 크기를 확인하지 못함");
    if (a !== b) return false;
    const [ha, hb] = await Promise.all([cache.fileHash(row.url), cache.fileHash(image.url)]);
    return ha === hb;
  }

  /**
   * 이 삽화의 사본을 찾는다. 엔진은 원본 ID로 연결된 사본을 모든 캐릭터·페르소나 갤러리에서
   * 지우므로, 목록 API가 있으면 전체를 보고 없으면 관련 방에 연결된 것만 본다. 조회 실패는 던진다.
   */
  async function findEntityCopies(cache, image, chatIds) {
    const characterIds = new Set();
    const personaIds = new Set();
    for (const id of chatIds) {
      const chat = id === image.chatId ? await cache.chat(id) : await chatOrNull(cache, id);
      for (const cid of Array.isArray(chat?.characterIds) ? chat.characterIds : []) characterIds.add(cid);
      if (chat?.personaCharacterId) characterIds.add(chat.personaCharacterId);
      if (chat?.personaId) personaIds.add(chat.personaId);
    }
    try {
      for (const row of await cache.allCharacters()) if (row?.id) characterIds.add(row.id);
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
    try {
      for (const row of await cache.allPersonas()) if (row?.id) personaIds.add(row.id);
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
    const characters = [];
    const personas = [];
    for (const id of characterIds) {
      const rows = await cache.characterGallery(id);
      for (const row of rows) {
        if (await rowIsCopyOf(cache, row, image)) {
          characters.push(id);
          break;
        }
      }
    }
    for (const id of personaIds) {
      const rows = await cache.personaGallery(id);
      for (const row of rows) {
        if (await rowIsCopyOf(cache, row, image)) {
          personas.push(id);
          break;
        }
      }
    }
    return { characters, personas };
  }

  function metadataForm(blob, filename, image, size) {
    const fd = new FormData();
    fd.append("file", blob, filename);
    fd.append("prompt", image.prompt || "");
    fd.append("provider", image.provider || "");
    fd.append("model", image.model || "");
    const width = image.width || size?.width;
    const height = image.height || size?.height;
    if (width) fd.append("width", String(width));
    if (height) fd.append("height", String(height));
    return fd;
  }

  // ───────────────────────── 메시지 첨부 이어 붙이기 ─────────────────────────

  function isSameOriginUrl(url) {
    try {
      return new URL(url, location.origin).origin === location.origin;
    } catch {
      return false;
    }
  }

  /** 첨부가 이 삽화를 가리키는지. ID가 있으면 ID로, 없으면 같은 서버의 경로로 판단한다. */
  function attachmentMatches(att, image, oldPath) {
    if (!att || typeof att !== "object") return false;
    if (typeof att.galleryId === "string" && att.galleryId) return att.galleryId === image.id;
    return typeof att.url === "string" && isSameOriginUrl(att.url) && pathOf(att.url) === oldPath;
  }

  function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * 본문 속 직접 링크. 경로만 적힌 것(/api/...)과 이 서버 주소가 붙은 것만 잡는다.
   * 다른 서버 주소 뒤에 붙은 같은 경로는 앞에 호스트 글자가 이어지므로 걸리지 않고,
   * 경로 뒤에 다른 경로 글자가 이어지면 다른 파일이므로 역시 건드리지 않는다.
   */
  function linkPattern(oldPath) {
    return new RegExp(
      `(?<![A-Za-z0-9._~:/-])(?:${escapeRegExp(location.origin)})?${escapeRegExp(oldPath)}(?![A-Za-z0-9._~-])`,
      "g",
    );
  }

  function rewriteAttachments(attachments, image, oldPath, next) {
    if (!Array.isArray(attachments)) return null;
    let changed = false;
    const updated = attachments.map((att) => {
      if (!attachmentMatches(att, image, oldPath)) return att;
      changed = true;
      const filename =
        typeof att.filename === "string" ? att.filename.replace(/\.[a-z0-9]+$/i, "") + ".webp" : undefined;
      return { ...att, url: next.url, galleryId: next.id, ...(filename ? { filename } : {}) };
    });
    return changed ? updated : null;
  }

  /**
   * 삭제 전에 관련 방 전체에서 이 삽화를 가리키는 자리를 모두 찾는다.
   * 고칠 수 없는 자리(비활성 스와이프 본문의 직접 링크)가 있으면 건너뛴다.
   * 조회가 하나라도 실패하면 던진다 — 확인 못 한 참조를 두고 지우지 않기 위해서다.
   */
  /**
   * fresh=false: 몇 초 안에 읽은 목록과 작업 동안 읽어 둔 스와이프를 재사용(미리 확인·교체 뒤 확인용).
   * fresh=true: 고칠 자리는 적용 직전이므로 메시지 목록을 새로 읽고, 고칠 메시지의 스와이프도 새로 읽는다.
   */
  async function planRelink(cache, chatIds, image, { fresh = false, freshList = false } = {}) {
    const oldPath = pathOf(image.url);
    const pattern = linkPattern(oldPath);
    const spots = [];
    for (const chatId of chatIds) {
      let rows;
      try {
        // 방 전체 목록은 작업 동안 한 번 받고(우리가 고친 메시지는 응답으로 제자리 갱신), 스와이프 기록이 없는
        // 메시지 줄이나 본문을 고쳐야 할 때만 적용 직전에 통째로 다시 받는다.
        rows = await cache.messages(chatId, freshList ? 0 : 10 * 60_000);
      } catch (error) {
        if (chatId !== image.chatId && isNotFound(error)) continue; // 지워진 방
        throw error;
      }
      for (const msg of rows) {
        const extra = parseExtra(msg.extra);
        const activeIndex = Number.isInteger(msg.activeSwipeIndex) ? msg.activeSwipeIndex : 0;
        const rowMatches = Array.isArray(extra.attachments) && extra.attachments.some((att) => attachmentMatches(att, image, oldPath));
        const contentMatches = typeof msg.content === "string" && pattern.test(msg.content);
        pattern.lastIndex = 0;
        const swipeCount = typeof msg.swipeCount === "number" ? msg.swipeCount : 0;
        let activeSwipeCovered = false;
        // 이미 읽어 둔(또는 방금 서버에서 새로 읽은) 스와이프가 있으면 요청 없이 그것도 본다.
        if (swipeCount > 1 || rowMatches || cache.hasSwipes(chatId, msg.id)) {
          // 고칠 가능성이 있는 메시지(첨부가 걸린 메시지)만 적용 직전에 새로 읽는다. 나머지는 읽어 둔 것을 쓴다.
          const swipes = await cache.swipes(chatId, msg.id, fresh && rowMatches);
          for (const swipe of Array.isArray(swipes) ? swipes : []) {
            const sExtra = parseExtra(swipe.extra);
            if (Array.isArray(sExtra.attachments) && sExtra.attachments.some((att) => attachmentMatches(att, image, oldPath))) {
              spots.push({ chatId, messageId: msg.id, kind: "swipe", swipeIndex: swipe.index, attachments: sExtra.attachments });
              if (swipe.index === activeIndex) activeSwipeCovered = true;
            }
            if (swipe.index !== activeIndex && typeof swipe.content === "string" && pattern.test(swipe.content)) {
              pattern.lastIndex = 0;
              throw new SkipError("다른 답변 버전 본문에 직접 링크가 있어 고칠 수 없음");
            }
            pattern.lastIndex = 0;
          }
        }
        // 스와이프 기록이 없거나 활성 스와이프에 첨부가 없는데 메시지 줄에는 있는 경우
        if (rowMatches && !activeSwipeCovered) {
          spots.push({ chatId, messageId: msg.id, kind: "message", attachments: extra.attachments });
        }
        if (contentMatches) spots.push({ chatId, messageId: msg.id, kind: "content", content: msg.content });
      }
    }
    return { oldPath, spots };
  }

  async function applyRelink(cache, plan, image, next) {
    const { oldPath, spots } = plan;
    const pattern = linkPattern(oldPath);
    const nextPath = pathOf(next.url);
    for (const spot of spots) {
      const base = `/chats/${encodeURIComponent(spot.chatId)}/messages/${encodeURIComponent(spot.messageId)}`;
      let result;
      if (spot.kind === "content") {
        result = await api("PATCH", base, { content: spot.content.replace(pattern, nextPath) });
      } else {
        const updated = rewriteAttachments(spot.attachments, image, oldPath, next) ?? spot.attachments;
        const query = spot.kind === "swipe" ? `?swipeIndex=${spot.swipeIndex}` : "";
        result = await api("PATCH", `${base}/extra${query}`, { attachments: updated });
      }
      // 고친 메시지: 서버가 돌려준 줄로 읽어 둔 목록을 갱신하고, 스와이프는 다음 확인 때 새로 읽는다.
      if (result && result.id === spot.messageId) cache.updateMessage(spot.chatId, result);
      else cache.forgetMessages(spot.chatId);
      cache.forgetSwipes(spot.chatId, spot.messageId);
    }
    return spots.length;
  }

  function relinkPinned(oldId, next) {
    try {
      const raw = localStorage.getItem(PINNED_KEY);
      if (!raw) return;
      const list = JSON.parse(raw);
      if (!Array.isArray(list)) return;
      let changed = false;
      const updated = list.map((item) => {
        if (item && item.id === oldId) {
          changed = true;
          return { ...item, ...next, kind: "image" };
        }
        return item;
      });
      if (changed) localStorage.setItem(PINNED_KEY, JSON.stringify(updated));
    } catch {
      /* ignore */
    }
  }

  // ───────────────────────── 변환 한 장 ─────────────────────────

  /**
   * 순서: 관련 방·사본·첨부 자리 확인 → 받기 → WebP 인코딩 → 갤러리 업로드 → (사본)
   *       → 첨부 이어 붙이기 → 옛 파일 삭제.
   * 확인 단계에서 못 읽거나 고칠 수 없는 자리가 있으면 PNG를 남기고 건너뛴다(SkipError).
   * 사본을 올리지 못하면 새 WebP를 지우고 PNG를 남긴다.
   */
  async function convertOne(cache, image) {
    const quality = state.settings.quality;

    let chatIds;
    try {
      chatIds = await relatedChatIds(cache, image);
    } catch (error) {
      throw new SkipError(`관련 방을 읽지 못함 (${error.message})`);
    }

    const wantCopies = state.settings.copyToEntityGalleries && (state.settings.copyCharacters || state.settings.copyPersonas);
    let copies = { characters: [], personas: [] };
    if (wantCopies) {
      let found;
      try {
        found = await findEntityCopies(cache, image, chatIds);
      } catch (error) {
        throw new SkipError(`캐릭터·페르소나 갤러리를 읽지 못함 (${error.message})`);
      }
      copies = {
        characters: state.settings.copyCharacters ? found.characters : [],
        personas: state.settings.copyPersonas ? found.personas : [],
      };
    }

    // 미리 확인: 고칠 수 없는 자리가 있으면 WebP를 만들기도 전에 건너뛴다.
    const precheck = async () => {
      try {
        return await planRelink(cache, chatIds, image, { fresh: false });
      } catch (error) {
        if (error?.skip) throw error;
        throw new SkipError(`메시지를 읽지 못함 (${error.message})`);
      }
    };
    const preview = await precheck();
    // 스와이프 기록으로 고칠 수 없는 자리(메시지 줄·본문)가 있을 때만 적용 직전에 목록을 통째로 다시 받는다.
    const needsFreshList = preview.spots.some((spot) => spot.kind !== "swipe");

    const source = await fetchBlob(image.url);
    const { blob, width, height } = await encodeWebp(source, quality);
    const size = { width, height };

    const next = await api("POST", `/gallery/${encodeURIComponent(image.chatId)}/upload`, metadataForm(blob, "converted.webp", image, size));
    if (!next || !next.id || !next.url) throw new Error("업로드 응답이 비어 있습니다");

    const copyRows = []; // { kind, ownerId, row }
    const rollback = async (reason, { skip = false } = {}) => {
      // 만든 사본부터 명시적으로 지우고(60초를 넘긴 사본은 엔진의 연동 삭제에서 빠지므로), 새 WebP를 지운다.
      for (const copy of copyRows) {
        const path =
          copy.kind === "character"
            ? `/characters/${encodeURIComponent(copy.ownerId)}/gallery/${encodeURIComponent(copy.row.id)}`
            : `/characters/personas/${encodeURIComponent(copy.ownerId)}/gallery/${encodeURIComponent(copy.row.id)}`;
        await api("DELETE", path).catch((error) => log.warn("되돌리기: 사본 삭제 실패(남음)", path, error));
      }
      await api("DELETE", `/gallery/${encodeURIComponent(next.id)}?chatId=${encodeURIComponent(image.chatId)}`).catch((error) =>
        log.warn("되돌리기 실패(새 WebP가 남음)", next.id, error),
      );
      throw skip ? new SkipError(reason) : new Error(reason);
    };

    // 새 채팅 갤러리 기록과 같은 정보·같은 파일을 60초 안에 올려야
    // 채팅방에서 지울 때 사본도 같이 지워지는 연동 규칙에 걸린다. 시각은 서버가 적은 createdAt끼리 비교한다.
    const nextCreated = Date.parse(next.createdAt || "") || null;
    for (const cid of copies.characters) {
      try {
        const row = await api("POST", `/characters/${encodeURIComponent(cid)}/gallery/upload`, metadataForm(blob, "converted.webp", image, size));
        if (row?.id) copyRows.push({ kind: "character", ownerId: cid, row });
      } catch (error) {
        await rollback(`캐릭터 갤러리 사본 업로드 실패 (${error.message})`);
      }
    }
    for (const pid of copies.personas) {
      try {
        const row = await api("POST", `/characters/personas/${encodeURIComponent(pid)}/gallery/upload`, metadataForm(blob, "converted.webp", image, size));
        if (row?.id) copyRows.push({ kind: "persona", ownerId: pid, row });
      } catch (error) {
        await rollback(`페르소나 갤러리 사본 업로드 실패 (${error.message})`);
      }
    }
    const copied = copyRows.length;
    if (copied > 0) {
      cache.forgetEntityGalleries();
      const tooLate = copyRows.some(({ row }) => {
        const created = Date.parse(row?.createdAt || "");
        return !nextCreated || !Number.isFinite(created) || Math.abs(created - nextCreated) > COPY_LINK_WINDOW_MS - 5_000;
      });
      if (tooLate) await rollback("사본 업로드가 너무 늦어 삭제 연동을 보장할 수 없음");
    }

    // 적용 직전에 다시 읽는다. 준비 뒤에 생성기가 첨부를 더했거나 답변 버전을 바꿨을 수 있다.
    // 생성이 그 사이 시작됐으면 잠깐만 기다리고, 계속이면 미룬다(작업 단위의 긴 대기는 runConversion이 맡는다).
    if (!(await waitForQuiet(10_000))) await rollback("생성이 진행 중이라 미룸 (생성이 끝난 뒤 다시 변환)", { skip: true });
    let plan;
    try {
      plan = await planRelink(cache, chatIds, image, { fresh: true, freshList: needsFreshList });
    } catch (error) {
      await rollback(error?.skip ? error.message : `메시지를 다시 읽지 못함 (${error.message})`, { skip: true });
    }
    try {
      await applyRelink(cache, plan, image, next);
    } catch (error) {
      // 일부 메시지는 새 WebP를, 나머지는 PNG를 가리킨다. 둘 다 남아 있으니 깨지지는 않는다.
      throw new Error(`첨부 교체 중 실패, PNG와 WebP 모두 남김 (${error.message})`);
    }
    // 교체 뒤 확인: 그 사이 누군가 옛 주소를 다시 적었다면(생성기 등) PNG를 지우지 않는다.
    let leftover;
    try {
      // 고친 메시지는 반드시 서버에서 직접 다시 읽는다. 스와이프 기록은 메시지 줄의 첨부·본문을 그대로
      // 비추므로 그것으로 확인하고, 스와이프 기록이 없는 메시지는 그 방 목록을 통째로 다시 받는다.
      const touched = new Map();
      for (const spot of plan.spots) touched.set(`${spot.chatId}/${spot.messageId}`, spot);
      for (const spot of touched.values()) {
        const swipes = await cache.swipes(spot.chatId, spot.messageId, true);
        if (!Array.isArray(swipes) || swipes.length === 0) cache.forgetMessages(spot.chatId);
      }
      leftover = await planRelink(cache, chatIds, image, { fresh: false });
    } catch (error) {
      throw new Error(`교체 뒤 확인 실패, PNG와 WebP 모두 남김 (${error.message})`);
    }
    if (leftover.spots.length > 0) {
      throw new Error(`교체 뒤에도 옛 주소를 쓰는 자리가 ${leftover.spots.length}곳 남아 PNG를 유지함 (다시 변환하면 정리됨)`);
    }
    await api("DELETE", `/gallery/${encodeURIComponent(image.id)}?chatId=${encodeURIComponent(image.chatId)}`);
    relinkPinned(image.id, next);

    return { before: source.size, after: blob.size, copied, relinked: plan.spots.length, chatIds, next };
  }

  // ───────────────────────── 일괄 작업 ─────────────────────────

  function acquireRun(run) {
    if (state.run) return false;
    state.run = run;
    renderPanel();
    updateSelectionButtons();
    return true;
  }

  function releaseRun(run) {
    if (state.run === run) state.run = null;
    renderPanel();
    updateSelectionButtons();
  }

  /**
   * 다른 탭·기기와의 잠금. 확장 저장소(서버)에 기록하므로 모든 기기가 같은 값을 본다.
   * 돌려주는 값이 null이면 잡은 것이고, 문자열이면 못 잡은 이유다.
   */
  async function readRemoteLock() {
    const saved = await marinara.storage.get();
    return saved && typeof saved === "object" && saved.runLock && typeof saved.runLock === "object" ? saved.runLock : null;
  }

  function ownPreviousToken() {
    try {
      return sessionStorage.getItem(OWN_LOCK_KEY) || null;
    } catch {
      return null;
    }
  }

  function rememberOwnToken(token) {
    try {
      if (token) sessionStorage.setItem(OWN_LOCK_KEY, token);
      else sessionStorage.removeItem(OWN_LOCK_KEY);
    } catch {
      /* ignore */
    }
  }

  /** 남의 표이면서 아직 살아 있는지. 이 브라우저가 새로고침 전에 잡았던 표는 내 것으로 본다. */
  function lockIsForeignAndFresh(lock, token) {
    if (!lock || lock.token === token) return false;
    if (lock.token && lock.token === ownPreviousToken()) return false;
    const age = Date.now() - (Date.parse(lock.at || "") || 0);
    return age < REMOTE_LOCK_STALE_MS;
  }

  /** 설정 팝오버에서 쓰는 수동 해제. 다른 기기의 작업이 정말 끝났는지 사용자가 확인한 뒤 누른다. */
  async function forceClearRemoteLock() {
    try {
      await marinara.storage.patch({ runLock: null });
      rememberOwnToken(null);
      state.remoteLockInfo = null;
      toast("작업 표를 지웠습니다", "success");
      renderPanel();
    } catch (error) {
      toast(`작업 표를 지우지 못했습니다 (${error.message})`, "error");
    }
  }

  async function refreshRemoteLockInfo() {
    try {
      const lock = await readRemoteLock();
      state.remoteLockInfo = lock && lock.token !== state.run?.lockToken ? lock : null;
    } catch {
      state.remoteLockInfo = null;
    }
    renderPanel();
  }

  /**
   * 확장 저장소에는 원자적 잠금이 없다. 그래서 "읽기 → 비어 있으면 내 표를 쓰기 → 잠시 뒤 다시 읽어
   * 내 표가 남아 있는지 확인"으로 동시 시작을 거른다. 둘이 거의 동시에 쓰면 나중에 쓴 쪽만 살아남고
   * 먼저 쓴 쪽은 확인 단계에서 물러난다. 작업 중에는 60초마다 시각을 갱신해 끊긴 잠금과 구분한다.
   */
  async function claimRemoteLock(run) {
    const token = `${INSTANCE_ID}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      const existing = await readRemoteLock();
      if (lockIsForeignAndFresh(existing, token)) {
        const age = Math.round((Date.now() - (Date.parse(existing.at || "") || 0)) / 1000);
        const left = Math.max(0, Math.round(REMOTE_LOCK_STALE_MS / 1000) - age);
        state.remoteLockInfo = existing;
        renderPanel();
        return `다른 탭이나 기기에서 작업 중입니다 (${existing.kind || "변환"}, ${age}초 전 갱신). 끊긴 작업이면 ${left}초 뒤 자동 해제되고, 설정에서 바로 지울 수도 있습니다`;
      }
      await marinara.storage.patch({ runLock: { token, at: new Date().toISOString(), kind: run.kind } });
      await sleep(700);
      const check = await readRemoteLock();
      if (!check || check.token !== token) {
        return "다른 탭이나 기기에서 같은 순간에 작업을 시작해 이쪽이 물러났습니다. 잠시 뒤 다시 시도하세요";
      }
      run.lockToken = token;
      rememberOwnToken(token);
      // 갱신 전에 내 표인지 확인한다. 탭이 멈춘 사이 다른 기기가 가져갔다면 덮어쓰지 않고 이쪽 작업을 멈춘다.
      run.lockRenew = setInterval(async () => {
        try {
          const current = await readRemoteLock();
          if (current && current.token !== token) {
            clearInterval(run.lockRenew);
            run.lockRenew = null;
            run.lockToken = null;
            if (!run.cancelled) {
              run.cancelled = true;
              run.cancelReason = "다른 탭이나 기기가 잠금을 가져가 이쪽 작업을 멈췄습니다";
              toast(run.cancelReason, "error", 6000);
              renderPanel();
            }
            return;
          }
          await marinara.storage.patch({ runLock: { token, at: new Date().toISOString(), kind: run.kind } });
        } catch {
          /* 다음 갱신 때 다시 */
        }
      }, 60_000);
      return null;
    } catch (error) {
      return `잠금을 기록하지 못했습니다 (${error.message})`;
    }
  }

  /** 내 표가 그대로일 때만 지운다. 다른 기기가 그 사이 가져간 잠금은 건드리지 않는다. */
  async function releaseRemoteLock(run) {
    if (!run.lockToken) return;
    const token = run.lockToken;
    run.lockToken = null;
    if (run.lockRenew) clearInterval(run.lockRenew);
    run.lockRenew = null;
    // 지우기가 실패하면 다음 작업이 3분 동안 막히므로 몇 번 더 시도하고, 그래도 안 되면 알린다.
    let cleared = false;
    for (let attempt = 0; attempt < 4 && !cleared; attempt += 1) {
      try {
        const current = await readRemoteLock();
        if (!current || current.token !== token) cleared = true;
        else {
          await marinara.storage.patch({ runLock: null });
          cleared = true;
        }
      } catch (error) {
        log.warn("작업 표 지우기 실패, 다시 시도", attempt + 1, error);
        await sleep(1500 * (attempt + 1));
      }
    }
    if (!cleared) toast("작업 표를 지우지 못했습니다. 설정 팝오버의 '작업 표 지우기'를 눌러 주세요 (3분 뒤엔 자동 해제)", "error", 8000);
    rememberOwnToken(null);
  }

  async function runConversion(images, { kind, silent = false } = {}) {
    const run = {
      kind,
      preparing: true,
      total: 0,
      done: 0,
      failed: 0,
      skipped: 0,
      failedIds: [],
      skipReasons: new Map(),
      before: 0,
      after: 0,
      copied: 0,
      cancelled: false,
    };
    // 첫 대기 전에 잠근다. 두 작업이 동시에 들어오면 뒤의 것은 거절된다.
    if (!acquireRun(run)) {
      if (!silent) toast("이미 진행 중인 작업이 있습니다", "error");
      state.lastRunAbort = "이미 진행 중인 작업이 있습니다";
      return null;
    }
    try {
      if (!(await probeWebpSupport())) {
        if (!silent) toast("이 브라우저는 WebP 인코딩을 지원하지 않습니다. PC 크롬·엣지에서 실행해 주세요.", "error", 5000);
        state.lastRunAbort = "WebP 인코딩 미지원";
        return null;
      }
      const targets = images.filter(isConvertible).sort(byOldest);
      if (targets.length === 0) {
        if (!silent) toast("변환할 PNG 삽화가 없습니다", "info");
        state.lastRunAbort = "변환할 PNG 없음";
        return null;
      }
      const lockProblem = await claimRemoteLock(run);
      if (lockProblem) {
        if (!silent) toast(lockProblem, "error", 5000);
        state.lastRunAbort = lockProblem;
        return null;
      }
      run.total = targets.length;
      run.preparing = false;
      renderPanel();
      const cache = makeRunCache();
      const chatIds = new Set();
      let quietGaveUp = false;
      for (const image of targets) {
        if (run.cancelled) break;
        try {
          // 생성이 진행 중이면 첫 번째는 최대 60초 기다리고, 그래도 계속이면 남은 삽화는 바로 미룬다.
          // (한 장마다 60초씩 기다리면 작업이 수십 분 늘어진다.)
          if (chatIsGenerating()) {
            run.waitingForGeneration = true;
            renderPanel();
            const quiet = await waitForQuiet(quietGaveUp ? 2_000 : 60_000);
            run.waitingForGeneration = false;
            if (!quiet) {
              quietGaveUp = true;
              throw new SkipError("생성이 진행 중이라 미룸 (생성이 끝난 뒤 다시 변환)");
            }
          }
          const result = await convertOne(cache, image);
          run.before += result.before;
          run.after += result.after;
          run.copied += result.copied;
          for (const id of result.chatIds) chatIds.add(id);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (error?.skip) {
            run.skipped += 1;
            run.skipReasons.set(message, (run.skipReasons.get(message) || 0) + 1);
            log.warn("변환 건너뜀", image.id, message);
          } else {
            run.failed += 1;
            run.failedIds.push(image.id);
            run.lastError = message;
            log.error("변환 실패", image.id, error);
          }
        }
        run.done += 1;
        renderPanel();
      }
      const refreshed = chatIds.size ? refreshMarinara(chatIds) : true;
      if (state.panel) void refreshPanelCounts();
      const converted = run.done - run.failed - run.skipped;
      run.converted = converted;
      // 자동 변환(silent)은 설정에서 알림을 켰을 때만 완료를 알리고, 실패·건너뜀은 항상 알린다.
      const notify = !silent || run.failed > 0 || run.skipped > 0 || (converted > 0 && state.settings.autoToast);
      if (notify) {
        const parts = [`${converted}장 변환`];
        if (converted > 0) parts.push(`${fmtBytes(run.before)} → ${fmtBytes(run.after)}`);
        if (run.copied > 0) parts.push(`사본 ${run.copied}건`);
        if (run.skipped > 0) parts.push(`PNG로 남김 ${run.skipped}장 (${[...run.skipReasons.keys()].join(" / ")})`);
        if (run.failed > 0) parts.push(`실패 ${run.failed}장 (${run.lastError || "원인 불명"})`);
        if (run.cancelled) parts.push(run.cancelReason ? `중단: ${run.cancelReason}` : "취소됨");
        toast(parts.join(" · "), run.failed > 0 ? "error" : run.skipped > 0 ? "info" : "success", run.skipped || run.failed ? 9000 : 4500);
        if (!refreshed) toast("화면에 바로 반영되지 않으면 새로고침해 주세요", "info", 4500);
      }
      // 알림을 놓쳐도 설정 팝오버에서 다시 볼 수 있게 마지막 결과를 남긴다.
      state.lastRunSummary = {
        at: Date.now(),
        kind,
        text: [
          `${converted}장 변환`,
          run.skipped > 0 ? `PNG로 남김 ${run.skipped}장 (${[...run.skipReasons.keys()].join(" / ")})` : "",
          run.failed > 0 ? `실패 ${run.failed}장 (${run.lastError || "원인 불명"})` : "",
          run.cancelled ? (run.cancelReason ? `중단: ${run.cancelReason}` : "취소됨") : "",
        ]
          .filter(Boolean)
          .join(" · "),
      };
      return run;
    } finally {
      await releaseRemoteLock(run);
      releaseRun(run);
    }
  }

  async function loadChatImages(chatId) {
    const rows = await api("GET", `/gallery/${encodeURIComponent(chatId)}`);
    return Array.isArray(rows) ? rows : [];
  }

  async function convertSelected(root) {
    const chatId = state.chatId;
    if (!chatId) return toast("활성 채팅방을 찾지 못했습니다", "error");
    if (state.run) return toast("이미 진행 중인 작업이 있습니다", "error");
    const images = await loadChatImages(chatId);
    const selectedPaths = selectedTilePaths(root);
    const picked = images.filter((img) => selectedPaths.has(pathOf(img.url)));
    if (picked.length === 0) return toast("선택된 삽화가 없습니다", "info");
    const targets = picked.filter(isConvertible);
    if (targets.length === 0) return toast("선택한 삽화는 이미 WebP입니다", "info");
    const ok = await confirmDialog({
      title: "선택한 삽화를 WebP로 변환",
      message: `${targets.length}장을 오래된 순서로 변환합니다. 변환된 삽화는 생성일이 지금 시각으로 바뀌어 갤러리 위쪽으로 올라옵니다.${
        picked.length > targets.length ? ` 이미 WebP인 ${picked.length - targets.length}장은 건너뜁니다.` : ""
      }`,
      confirmLabel: "변환",
    });
    if (!ok) return;
    const run = await runConversion(targets, { kind: "selected" });
    if (run) exitSelection(root);
  }

  async function convertAllInChat() {
    const chatId = state.chatId;
    if (!chatId) return toast("활성 채팅방을 찾지 못했습니다", "error");
    if (state.run) return toast("이미 진행 중인 작업이 있습니다", "error");
    const images = await loadChatImages(chatId);
    const targets = images.filter(isConvertible);
    if (targets.length === 0) return toast("이 채팅방에는 변환할 PNG 삽화가 없습니다", "info");
    const ok = await confirmDialog({
      title: "이 채팅방의 모든 삽화를 WebP로 변환",
      message: `PNG ${targets.length}장을 오래된 순서로 변환합니다. 한 장씩 처리하므로 ${Math.max(1, Math.ceil(targets.length / 30))}분 안팎 걸리고(서버 요청 제한에 걸리면 더), 그동안 이 탭을 열어 두세요. 중간에 취소해도 이미 끝난 삽화는 그대로 남습니다.`,
      confirmLabel: "전체 변환",
    });
    if (!ok) return;
    await runConversion(targets, { kind: "all" });
  }

  async function copyPrompts(root) {
    const chatId = state.chatId;
    if (!chatId) return toast("활성 채팅방을 찾지 못했습니다", "error");
    const images = await loadChatImages(chatId);
    const selectedPaths = selectedTilePaths(root);
    const picked = images.filter((img) => selectedPaths.has(pathOf(img.url))).sort(byOldest);
    if (picked.length === 0) return toast("선택된 삽화가 없습니다", "info");
    const prompts = picked.map((img) => (img.prompt || "").trim()).filter(Boolean);
    const skipped = picked.length - prompts.length;
    if (prompts.length === 0) return toast("선택한 삽화에 프롬프트가 없습니다", "info");
    try {
      await navigator.clipboard.writeText(prompts.join("\n\n"));
      toast(`프롬프트 ${prompts.length}개 복사${skipped ? ` · 프롬프트 없는 ${skipped}장 건너뜀` : ""}`, "success");
    } catch (error) {
      log.warn("클립보드 복사 실패", error);
      toast("클립보드에 복사하지 못했습니다", "error");
    }
  }

  /** 이 채팅방 삽화 중 선택한 갤러리에 없는 것을 그곳에 올린다. */
  async function createEntityCopies() {
    const chatId = state.chatId;
    if (!chatId) return toast("활성 채팅방을 찾지 못했습니다", "error");
    if (!state.settings.copyCharacters && !state.settings.copyPersonas)
      return toast("사본을 올릴 갤러리를 먼저 선택하세요 (캐릭터 / 페르소나)", "info", 4000);
    const run = { kind: "copies", preparing: true, total: 0, done: 0, failed: 0, skipped: 0, before: 0, after: 0, copied: 0, cancelled: false };
    if (!acquireRun(run)) return toast("이미 진행 중인 작업이 있습니다", "error");
    try {
      const cache = makeRunCache();
      let chat;
      let images;
      try {
        chat = await cache.chat(chatId);
        images = (await loadChatImages(chatId)).sort(byOldest);
      } catch (error) {
        return toast(`채팅방을 읽지 못했습니다 (${error.message})`, "error");
      }
      const characterIds = state.settings.copyCharacters && Array.isArray(chat?.characterIds) ? chat.characterIds : [];
      const personaIds = state.settings.copyPersonas && chat?.personaId ? [chat.personaId] : [];
      if (characterIds.length === 0 && personaIds.length === 0) return toast("이 채팅방에 연결된 캐릭터·페르소나가 없습니다", "info");

      // 생성 60초가 안 된 삽화는 엔진이 "같은 삽화의 사본"으로 묶어 버릴 수 있어 건너뛴다. 서버 시계 기준.
      let nowOnServer;
      try {
        nowOnServer = await serverNow();
      } catch (error) {
        return toast(`서버 시각을 확인하지 못해 중단했습니다 (${error.message})`, "error", 5000);
      }
      const fresh = images.filter((img) => nowOnServer - (Date.parse(img.createdAt || 0) || 0) < COPY_LINK_WINDOW_MS * 2);
      const jobs = [];
      try {
        for (const image of images) {
          if (fresh.includes(image)) continue;
          for (const cid of characterIds) {
            const rows = await cache.characterGallery(cid);
            if (!(await hasEquivalentCopy(cache, rows, image))) jobs.push({ image, kind: "character", id: cid });
          }
          for (const pid of personaIds) {
            const rows = await cache.personaGallery(pid);
            if (!(await hasEquivalentCopy(cache, rows, image))) jobs.push({ image, kind: "persona", id: pid });
          }
        }
      } catch (error) {
        return toast(`캐릭터·페르소나 갤러리를 읽지 못했습니다 (${error.message})`, "error");
      }
      if (jobs.length === 0)
        return toast(fresh.length ? `모든 삽화가 이미 선택한 갤러리에 있습니다 (방금 생성된 ${fresh.length}장은 잠시 뒤 다시)` : "모든 삽화가 이미 선택한 갤러리에 있습니다", "info", 4500);
      const targetLabel = [state.settings.copyCharacters && "캐릭터", state.settings.copyPersonas && "페르소나"].filter(Boolean).join("·");
      const ok = await confirmDialog({
        title: "선택한 갤러리에 전체 사본 만들기",
        message: `${targetLabel} 갤러리에 없는 삽화 ${jobs.length}건을 복사하여 올립니다. 이렇게 만든 사본은 채팅방에서 삽화를 지워도 그 갤러리에 남습니다.${
          fresh.length ? ` 방금 생성된 ${fresh.length}장은 2분 뒤에 다시 눌러 주세요.` : ""
        }`,
        confirmLabel: "사본 만들기",
      });
      if (!ok) return;
      const lockProblem = await claimRemoteLock(run);
      if (lockProblem) return toast(lockProblem, "error", 5000);
      run.total = jobs.length;
      run.preparing = false;
      renderPanel();
      const blobs = new Map();
      for (const job of jobs) {
        if (run.cancelled) break;
        try {
          if (!blobs.has(job.image.id)) blobs.set(job.image.id, await fetchBlob(job.image.url));
          const blob = blobs.get(job.image.id);
          const ext = (job.image.filePath.match(/\.([a-z0-9]+)$/i) || [, "png"])[1].toLowerCase();
          const path =
            job.kind === "character"
              ? `/characters/${encodeURIComponent(job.id)}/gallery/upload`
              : `/characters/personas/${encodeURIComponent(job.id)}/gallery/upload`;
          await api("POST", path, metadataForm(blob, `copy.${ext}`, job.image));
          run.copied += 1;
        } catch (error) {
          run.failed += 1;
          log.error("사본 만들기 실패", job, error);
        }
        run.done += 1;
        renderPanel();
      }
      refreshMarinara([]);
      toast(`사본 ${run.copied}건 생성${run.failed ? ` · 실패 ${run.failed}건` : ""}${run.cancelled ? " · 취소됨" : ""}`, run.failed ? "error" : "success", 4500);
    } finally {
      await releaseRemoteLock(run);
      releaseRun(run);
    }
  }

  /** 원본 ID로 연결됐거나, 정보와 파일 내용이 같은(이 확장이 올린) 사본이 있는지. 확인 실패는 던진다. */
  async function hasEquivalentCopy(cache, rows, image) {
    for (const row of rows) {
      if (row.sourceChatImageId === image.id) return true;
      if (!row.sourceChatImageId && sameMetadata(row, image) && (await sameFileContent(cache, row, image))) return true;
    }
    return false;
  }

  // ───────────────────────── 자동 변환 ─────────────────────────

  function syncAuto() {
    const want = state.settings.autoConvert && !!state.chatId;
    if (want && !state.autoTimer) {
      state.autoTimer = marinara.setInterval(() => void autoTick(), AUTO_POLL_MS);
      void autoTick();
    } else if (!want && state.autoTimer) {
      if (typeof marinara.clearInterval === "function") marinara.clearInterval(state.autoTimer);
      else clearInterval(state.autoTimer);
      state.autoTimer = null;
    }
  }

  function setAutoStatus(note, isError = false) {
    state.autoStatus = { lastCheck: Date.now(), note, error: isError ? note : null };
    if (isError && state.autoLastToastedError !== note) {
      state.autoLastToastedError = note;
      toast(`자동 변환: ${note}`, "error", 5000);
    }
    renderPanel();
  }

  /** 자동 변환을 켤 때 기준점: 지금 갤러리에서 가장 새 삽화의 생성 시각(서버 시계). 그 뒤 삽화만 변환한다. */
  async function computeAutoSince() {
    try {
      const images = state.chatId ? await loadChatImages(state.chatId) : [];
      const newest = images.reduce((max, img) => Math.max(max, Date.parse(img.createdAt || 0) || 0), 0);
      return new Date(newest || Date.now()).toISOString();
    } catch {
      return new Date().toISOString();
    }
  }

  /** 최근 메시지에 첨부로 붙은 삽화 id 집합. 엔진은 갤러리 등록 뒤에 첨부하므로, 첨부가 보이면 생성이 끝난 것이다. */
  async function recentlyAttachedIds(chatId) {
    const ids = new Set();
    const paths = new Set();
    const rows = await fetchMessages(chatId, { limit: 40 });
    for (const msg of rows) {
      const extra = parseExtra(msg.extra);
      for (const att of Array.isArray(extra.attachments) ? extra.attachments : []) {
        if (!att || typeof att !== "object") continue;
        if (typeof att.galleryId === "string") ids.add(att.galleryId);
        if (typeof att.url === "string") paths.add(pathOf(att.url));
      }
    }
    return { ids, paths };
  }

  async function autoTick(force = false) {
    if (!state.settings.autoConvert || !state.chatId) return;
    if (state.run || state.autoBusy) return;
    if (document.hidden && !force) return; // 보이지 않는 탭에서는 쉰다
    state.autoBusy = true;
    try {
      if (!(await probeWebpSupport())) {
        setAutoStatus("이 브라우저는 WebP 인코딩을 지원하지 않습니다", true);
        return;
      }
      if (chatIsGenerating()) {
        setAutoStatus("생성이 진행 중이라 끝난 뒤에 점검합니다");
        return;
      }
      const since = Date.parse(state.settings.autoSince || 0) || 0;
      const now = Date.now();
      const images = await loadChatImages(state.chatId);
      const candidates = images.filter((img) => {
        if (!isConvertible(img)) return false;
        if ((state.autoFailures.get(img.id) || 0) >= 3) return false;
        return (Date.parse(img.createdAt || 0) || 0) > since;
      });
      // 서버가 첨부·갤러리 연결을 끝낼 시간을 주되, 기기 시계가 아니라 "이 기기에서 처음 본 뒤 지난 시간"으로 잰다.
      for (const img of candidates) if (!state.autoFirstSeen.has(img.id)) state.autoFirstSeen.set(img.id, now);
      const aged = candidates.filter((img) => now - state.autoFirstSeen.get(img.id) >= AUTO_MIN_AGE_MS);
      let ready = [];
      if (aged.length > 0) {
        // 메시지에 첨부가 끝난 삽화만 자동 변환한다. 첨부가 없는 삽화(직접 올린 것, 아직 생성 중인 것)는
        // 시간이 아무리 지나도 자동으로 건드리지 않는다. 필요하면 선택 변환으로.
        const attached = await recentlyAttachedIds(state.chatId);
        ready = aged.filter((img) => attached.ids.has(img.id) || attached.paths.has(pathOf(img.url)));
      }
      if (ready.length === 0) {
        setAutoStatus(
          candidates.length
            ? `첨부 안 된 새 PNG ${candidates.length}장 대기 중 (메시지에 붙으면 변환, 직접 올린 삽화는 선택 변환)`
            : `새 PNG 없음 · 갤러리 ${images.length}장`,
        );
        return;
      }
      state.lastRunAbort = null;
      const run = await runConversion(ready, { kind: "auto", silent: true });
      if (!run) {
        setAutoStatus(`변환을 시작하지 못했습니다: ${state.lastRunAbort || "원인 불명"}`, true);
        return;
      }
      for (const img of ready) {
        if (run.failedIds.includes(img.id)) state.autoFailures.set(img.id, (state.autoFailures.get(img.id) || 0) + 1);
        else state.autoFirstSeen.delete(img.id);
      }
      const converted = run.converted ?? 0;
      const tail = [];
      if (run.skipped > 0) tail.push(`건너뜀 ${run.skipped}장: ${[...run.skipReasons.keys()].join(" / ")}`);
      if (run.failed > 0) tail.push(`실패 ${run.failed}장: ${run.lastError || "원인 불명"}`);
      if (tail.length) setAutoStatus(`${converted}장 변환, ${tail.join(", ")}`, true);
      else setAutoStatus(`${converted}장 변환 완료`);
    } catch (error) {
      setAutoStatus(`점검 실패: ${error instanceof Error ? error.message : String(error)}`, true);
      log.warn("자동 변환 점검 실패", error);
    } finally {
      state.autoBusy = false;
    }
  }


  // ───────────────────────── 갤러리 DOM 찾기 ─────────────────────────

  const ROOT_SEL = '[data-chat-settings-section$="-gallery"], .mari-window[data-window$="-gallery"]';

  function galleryRoots() {
    return [...document.querySelectorAll(ROOT_SEL)].filter((el) => !el.hidden);
  }

  function selectionRow(root) {
    const download = root.querySelector("button svg.lucide-download");
    const trash = root.querySelector("button svg.lucide-trash-2");
    if (!download || !trash) return null;
    const a = download.closest("button");
    const b = trash.closest("button");
    if (!a || !b || a.parentElement !== b.parentElement) return null;
    return a.parentElement;
  }

  function selectedTilePaths(root) {
    const paths = new Set();
    for (const img of root.querySelectorAll('button[aria-pressed="true"] img')) {
      const src = img.currentSrc || img.src;
      if (src && src.includes("/api/gallery/file/")) paths.add(pathOf(src));
    }
    return paths;
  }

  function exitSelection(root) {
    // 선택 모드를 켜는/끄는 버튼은 선택 중일 때 X 아이콘을 보여 준다.
    const x = root.querySelector("button.mari-editor-action svg.lucide-x");
    x?.closest("button")?.click();
  }

  function headerSlot(root) {
    if (root.matches(".mari-window")) {
      const controls = root.querySelector(":scope > .mari-window__header .mari-window__controls");
      return controls ? { host: controls, mode: "window" } : null;
    }
    const header = root.querySelector(":scope > .mari-drawer__header");
    if (!header) return null;
    let actions = header.querySelector(".mari-drawer__actions");
    if (!actions) {
      actions = document.createElement("span");
      actions.className = "mari-drawer__actions flex items-center";
      actions.setAttribute("data-gwc-made", "");
      actions.addEventListener("click", (e) => e.stopPropagation());
      const arrow = header.querySelector(".mari-drawer__arrow");
      if (arrow) header.insertBefore(actions, arrow);
      else header.appendChild(actions);
    }
    return { host: actions, mode: "drawer" };
  }

  // ───────────────────────── 버튼 주입 ─────────────────────────

  function makeHeaderButton(mode) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("data-gwc-settings", "");
    btn.setAttribute("aria-label", `${EXT_NAME} 설정`);
    btn.title = `${EXT_NAME} 설정`;
    btn.className = mode === "window" ? "mari-window__control gwc-hdr-btn gwc-hdr-btn--window" : "gwc-hdr-btn gwc-hdr-btn--drawer";
    btn.innerHTML = SVG.settings;
    btn.addEventListener("pointerdown", (e) => e.stopPropagation());
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      togglePanel(btn);
    });
    return btn;
  }

  function makeActionButton({ icon, label, attr, onClick }) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute(attr, "");
    btn.className = "mari-editor-action inline-flex gwc-action";
    btn.title = label;
    btn.setAttribute("aria-label", label);
    btn.innerHTML = `${icon}<span class="gwc-action__label">${label}</span>`;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      void onClick();
    });
    return btn;
  }

  function injectInto(root) {
    const slot = headerSlot(root);
    if (slot && !slot.host.querySelector("[data-gwc-settings]")) {
      const btn = makeHeaderButton(slot.mode);
      if (slot.mode === "window") slot.host.insertBefore(btn, slot.host.firstChild);
      else slot.host.insertBefore(btn, slot.host.firstChild);
    }
    const row = selectionRow(root);
    if (row && !row.querySelector("[data-gwc-convert]")) {
      row.appendChild(
        makeActionButton({ icon: SVG.convert, label: "선택 변환", attr: "data-gwc-convert", onClick: () => convertSelected(root) }),
      );
      row.appendChild(
        makeActionButton({ icon: SVG.copy, label: "선택 프롬 복사", attr: "data-gwc-copy", onClick: () => copyPrompts(root) }),
      );
      watchRowWidth(row);
      updateSelectionButtons();
    }
    applyColumnsTo(root);
  }

  const rowObservers = new WeakMap();
  function watchRowWidth(row) {
    if (rowObservers.has(row) || typeof ResizeObserver === "undefined") return;
    const bar = row.parentElement || row;
    const ro = new ResizeObserver(() => {
      const compact = bar.getBoundingClientRect().width < 460;
      row.classList.toggle("gwc-compact", compact);
    });
    ro.observe(bar);
    rowObservers.set(row, ro);
  }

  function updateSelectionButtons() {
    const busy = !!state.run;
    for (const btn of document.querySelectorAll("[data-gwc-convert]")) {
      btn.disabled = busy || state.webpSupported === false;
      if (state.webpSupported === false) btn.title = "이 브라우저는 WebP 인코딩을 지원하지 않습니다 (PC 크롬·엣지에서 가능)";
    }
  }

  /** 갤러리 타일이 들어 있는 그리드에 표식을 붙인다(열 수 CSS가 이 표식을 본다). */
  function tagTileGrid(root) {
    for (const img of root.querySelectorAll('img[src*="/api/gallery/file/"], img[src*="/gallery/file/"]')) {
      const grid = img.closest(".grid");
      if (grid && !grid.hasAttribute("data-gwc-grid") && grid.querySelectorAll("img").length > 0) {
        grid.setAttribute("data-gwc-grid", "");
      }
    }
  }

  function applyColumnsTo(root) {
    tagTileGrid(root);
    const cols = state.settings.columns;
    if (cols) root.setAttribute("data-gwc-cols", String(cols));
    else root.removeAttribute("data-gwc-cols");
  }

  function applyColumns() {
    for (const root of document.querySelectorAll(ROOT_SEL)) applyColumnsTo(root);
  }

  // ───────────────────────── 설정 팝오버 ─────────────────────────

  function togglePanel(anchor) {
    if (state.panel && state.panelAnchor === anchor) return closePanel();
    openPanel(anchor);
  }

  function openPanel(anchor) {
    closePanel();
    const panel = document.createElement("div");
    panel.className = "gwc-panel";
    panel.setAttribute("data-chat-floating-panel", "");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", `${EXT_NAME} 설정`);
    document.body.appendChild(panel);
    state.panel = panel;
    state.panelAnchor = anchor;
    renderPanel();
    positionPanel();
    void probeWebpSupport().then(() => {
      renderPanel();
      updateSelectionButtons();
    });
    void refreshPanelCounts();
    void refreshRemoteLockInfo();
    const onDoc = (e) => {
      if (!state.panel) return;
      if (state.panel.contains(e.target) || anchor.contains(e.target)) return;
      if (e.target.closest?.(".gwc-overlay")) return;
      closePanel();
    };
    const onKey = (e) => {
      if (e.key === "Escape" && state.panel && !document.querySelector(".gwc-overlay")) closePanel();
    };
    const onResize = () => positionPanel();
    document.addEventListener("pointerdown", onDoc, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    panel._gwcDispose = () => {
      document.removeEventListener("pointerdown", onDoc, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }

  function closePanel() {
    if (!state.panel) return;
    state.panel._gwcDispose?.();
    state.panel.remove();
    state.panel = null;
    state.panelAnchor = null;
  }

  function positionPanel() {
    const panel = state.panel;
    const anchor = state.panelAnchor;
    if (!panel || !anchor) return;
    if (!anchor.isConnected) return closePanel();
    const r = anchor.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pw = Math.min(340, vw - 16);
    panel.style.width = `${pw}px`;
    let left = r.right - pw;
    if (left < 8) left = 8;
    if (left + pw > vw - 8) left = vw - 8 - pw;
    let top = r.bottom + 6;
    const ph = panel.offsetHeight;
    if (top + ph > vh - 8) top = r.top - 6 - ph; // 아래에 안 들어가면 위로
    top = Math.max(8, Math.min(top, vh - 8 - ph)); // 그래도 넘치면 화면 안으로 밀어 넣기
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    // 창(.mari-window)보다 위에 뜨도록
    const hostWindow = anchor.closest(".mari-window");
    const z = hostWindow ? parseInt(getComputedStyle(hostWindow).zIndex, 10) : NaN;
    panel.style.zIndex = String(Number.isFinite(z) ? Math.max(z + 2, 95) : 95);
  }

  const panelCounts = { chatId: null, convertible: 0, total: 0 };
  async function refreshPanelCounts() {
    const chatId = state.chatId;
    if (!chatId) return;
    try {
      const images = await loadChatImages(chatId);
      panelCounts.chatId = chatId;
      panelCounts.total = images.length;
      panelCounts.convertible = images.filter(isConvertible).length;
      renderPanel();
    } catch {
      /* ignore */
    }
  }

  /** 설명을 숨겨 두는 ? 버튼과, 열렸을 때만 보이는 설명 글. */
  function helpButton(key) {
    const open = state.openHelp.has(key);
    return `<button type="button" class="gwc-help${open ? " is-open" : ""}" data-help="${key}" aria-expanded="${open}" aria-label="설명 ${open ? "닫기" : "보기"}" title="설명">?</button>`;
  }
  function helpText(key, text) {
    return state.openHelp.has(key) ? `<p class="gwc-note gwc-help__text">${text}</p>` : "";
  }

  function renderPanel() {
    const panel = state.panel;
    if (!panel) return;
    const s = state.settings;
    const run = state.run;
    const counts = panelCounts.chatId === state.chatId ? panelCounts : null;
    const unsupported = state.webpSupported === false;
    const q = s.quality;
    const est = estimateRatio();
    const pct = (v) => `${Math.round(v * 100)}%`;
    const qualityNote =
      q >= 100
        ? "100은 브라우저가 무손실로 인코딩해 PNG의 절반 정도입니다. 사본까지 만들면 PNG 1장보다 커집니다."
        : q >= 95
          ? "95: 눈으로 구분이 어렵고 PNG의 1/8 정도입니다."
          : q >= 90
            ? "90: PNG의 1/10 정도입니다."
            : "낮을수록 작아지지만 세밀한 부분이 뭉개질 수 있습니다.";
    const estimateNote = `예상 용량: PNG 1장 대비 약 ${pct(est.total)} (채팅 1장${est.copies ? ` + 사본 ${est.copies}장, 장당 ${pct(est.per)}` : ""})`;
    const estimateWarn = est.total >= 1;

    panel.innerHTML = `
      <div class="gwc-panel__head">
        <span class="gwc-panel__title">${EXT_NAME}</span>
        <button type="button" class="gwc-icon-btn" data-act="close" aria-label="닫기">${SVG.x}</button>
      </div>
      ${unsupported ? `<p class="gwc-note gwc-note--warn">이 브라우저는 WebP 인코딩을 지원하지 않습니다. 변환은 PC 크롬·엣지에서 해 주세요. 그리드와 프롬프트 복사는 쓸 수 있습니다.</p>` : ""}
      <section class="gwc-row">
        <div class="gwc-row__label">갤러리 그리드</div>
        <div class="gwc-seg" role="group" aria-label="갤러리 열 수">
          ${COLUMN_OPTIONS.map(
            (n) =>
              `<button type="button" class="gwc-seg__btn${s.columns === n ? " is-on" : ""}" data-cols="${n}" aria-pressed="${s.columns === n}">${n === 0 ? "기본" : `${n}열`}</button>`,
          ).join("")}
        </div>
      </section>
      <section class="gwc-row">
        <div class="gwc-row__label">변환 품질 <span class="gwc-row__value" data-quality-value>${q}</span></div>
        <input type="range" min="70" max="100" step="${QUALITY_STEP}" value="${q}" data-act="quality" class="gwc-range" aria-label="변환 품질">
        <p class="gwc-note${q >= 100 ? " gwc-note--warn" : ""}" data-quality-note>${qualityNote}</p>
      </section>
      <section class="gwc-row gwc-row--toggle">
        <div class="gwc-toggle-row">
          <label class="gwc-toggle">
            <input type="checkbox" data-act="auto" ${s.autoConvert ? "checked" : ""} ${unsupported ? "disabled" : ""}>
            <span class="gwc-toggle__track"></span>
            <span class="gwc-toggle__text">생성 삽화 자동 변환</span>
          </label>
          ${helpButton("auto")}
        </div>
        ${helpText(
          "auto",
          "켠 뒤에 생성된 삽화를 몇 초 뒤 자동으로 WebP로 바꿉니다. 마리나라를 열어 둔 브라우저 탭이 화면에 보일 때만 동작하고, 놓친 삽화는 다음에 그 채팅방을 열 때 처리합니다. 변환 완료 알림을 끄면 결과는 아래 상태 줄에서만 보이고 실패만 알림으로 뜹니다.",
        )}
        ${
          s.autoConvert
            ? `<div class="gwc-auto-status">
                <p class="gwc-note${state.autoStatus.error ? " gwc-note--warn" : ""}" data-auto-status>${
                  state.autoStatus.lastCheck
                    ? `마지막 점검 ${new Date(state.autoStatus.lastCheck).toLocaleTimeString()} · ${state.autoStatus.note}`
                    : state.chatId
                      ? "아직 점검하지 않았습니다"
                      : "채팅방을 열면 점검을 시작합니다"
                }</p>
                <button type="button" class="gwc-btn gwc-btn--small" data-act="auto-check" ${run || !state.chatId ? "disabled" : ""}>지금 점검</button>
              </div>
              <label class="gwc-toggle gwc-toggle--sub">
                <input type="checkbox" data-act="auto-toast" ${s.autoToast ? "checked" : ""}>
                <span class="gwc-toggle__track"></span>
                <span class="gwc-toggle__text">변환 완료 알림 표시</span>
              </label>`
            : ""
        }
      </section>
      <section class="gwc-row gwc-row--toggle">
        <div class="gwc-toggle-row">
          <label class="gwc-toggle">
            <input type="checkbox" data-act="copies" ${s.copyToEntityGalleries ? "checked" : ""}>
            <span class="gwc-toggle__track"></span>
            <span class="gwc-toggle__text">사본도 함께 변환</span>
          </label>
          ${helpButton("copies")}
        </div>
        ${helpText(
          "copies",
          "순정 엔진은 설정 → 이미지 생성의 \"생성된 이미지를 캐릭터 갤러리에 자동 저장\"(기본 켜짐)에 따라 파일 1장을 캐릭터·페르소나 갤러리에서 함께 보여주지만, 확장은 선택한 갤러리마다 WebP를 한 장씩 더 올립니다. 끄면 채팅방에만 남고 다른 갤러리 쪽 연결은 사라집니다.",
        )}
        <div class="gwc-checks" role="group" aria-label="사본을 올릴 갤러리">
          <label class="gwc-check"><input type="checkbox" data-act="copy-characters" ${s.copyCharacters ? "checked" : ""}> 캐릭터 갤러리</label>
          <label class="gwc-check"><input type="checkbox" data-act="copy-personas" ${s.copyPersonas ? "checked" : ""}> 페르소나 갤러리</label>
        </div>
        <p class="gwc-note${estimateWarn ? " gwc-note--warn" : ""}" data-estimate>${estimateNote}${estimateWarn ? " — PNG보다 커집니다." : ""}</p>
      </section>
      <section class="gwc-row gwc-row--actions">
        <div class="gwc-toggle-row">
          <span class="gwc-row__label gwc-row__label--plain">일괄 작업</span>
          ${helpButton("actions")}
        </div>
        ${helpText(
          "actions",
          "전체 변환은 오래된 삽화부터 처리해 갤러리 순서를 유지합니다. 사본 만들기는 위에서 선택한 갤러리에 없는 삽화만 복사하여 올리며, 그 사본은 채팅방에서 지워도 남습니다.",
        )}
        <button type="button" class="gwc-btn gwc-btn--wide" data-act="convert-all" ${unsupported || run ? "disabled" : ""}>
          이 채팅방의 모든 삽화 변환${counts ? ` <span class="gwc-count">${counts.convertible} / ${counts.total}</span>` : ""}
        </button>
        <button type="button" class="gwc-btn gwc-btn--wide" data-act="make-copies" ${run || (!s.copyCharacters && !s.copyPersonas) ? "disabled" : ""}>선택한 갤러리에 전체 사본 만들기</button>
        ${
          state.lastRunSummary && !run
            ? `<p class="gwc-note" data-last-run>마지막 작업 ${new Date(state.lastRunSummary.at).toLocaleTimeString()}: ${state.lastRunSummary.text}</p>`
            : ""
        }
        ${
          state.remoteLockInfo && !run
            ? `<p class="gwc-note gwc-note--warn">다른 탭이나 기기의 작업 표가 남아 있습니다 (${state.remoteLockInfo.kind || "변환"}, ${Math.round(
                (Date.now() - (Date.parse(state.remoteLockInfo.at || "") || 0)) / 1000,
              )}초 전 갱신). 그쪽 작업이 끝났거나 새로고침으로 끊긴 게 확실하면 지우세요.</p>
              <button type="button" class="gwc-btn gwc-btn--wide gwc-btn--danger" data-act="clear-lock">작업 표 지우기</button>`
            : ""
        }
      </section>
      ${
        run
          ? `<section class="gwc-row gwc-progress">
              <div class="gwc-progress__text">${
                run.preparing
                  ? "준비 중…"
                  : `${run.throttleNote ? run.throttleNote : run.readNote ? run.readNote : run.waitingForGeneration ? "생성이 끝나길 기다리는 중" : run.kind === "copies" ? "사본 만드는 중" : "변환 중"} ${run.done} / ${run.total}${
                      run.kind !== "copies" && run.before ? ` · ${fmtBytes(run.before)} → ${fmtBytes(run.after)}` : ""
                    }${run.skipped ? ` · 건너뜀 ${run.skipped}` : ""}${run.failed ? ` · 실패 ${run.failed}` : ""}`
              }</div>
              <div class="gwc-progress__bar"><span style="width:${Math.round((run.done / Math.max(1, run.total)) * 100)}%"></span></div>
              <button type="button" class="gwc-btn gwc-btn--danger" data-act="cancel" ${run.cancelled ? "disabled" : ""}>${run.cancelled ? "취소하는 중…" : "취소"}</button>
            </section>`
          : ""
      }
    `;

    panel.querySelector('[data-act="close"]').addEventListener("click", closePanel);
    for (const btn of panel.querySelectorAll("[data-help]")) {
      btn.addEventListener("click", () => {
        const key = btn.dataset.help;
        if (state.openHelp.has(key)) state.openHelp.delete(key);
        else state.openHelp.add(key);
        renderPanel();
      });
    }
    for (const btn of panel.querySelectorAll("[data-cols]")) {
      btn.addEventListener("click", () => void saveSettings({ columns: Number(btn.dataset.cols) }));
    }
    panel.querySelector('[data-act="auto"]').addEventListener("change", async (e) => {
      const on = e.target.checked;
      if (on) {
        state.autoFirstSeen.clear();
        state.autoFailures.clear();
        state.autoStatus = { lastCheck: null, note: "", error: null };
        const autoSince = await computeAutoSince();
        await saveSettings({ autoConvert: true, autoSince });
      } else {
        await saveSettings({ autoConvert: false });
      }
    });
    panel.querySelector('[data-act="auto-check"]')?.addEventListener("click", () => void autoTick(true));
    panel.querySelector('[data-act="auto-toast"]')?.addEventListener("change", (e) => {
      void saveSettings({ autoToast: e.target.checked });
    });
    const range = panel.querySelector('[data-act="quality"]');
    range.addEventListener("input", () => {
      panel.querySelector("[data-quality-value]").textContent = range.value;
    });
    range.addEventListener("change", () => void saveSettings({ quality: clampQuality(range.value) }));
    panel.querySelector('[data-act="copies"]').addEventListener("change", (e) => {
      void saveSettings({ copyToEntityGalleries: e.target.checked });
    });
    panel.querySelector('[data-act="copy-characters"]').addEventListener("change", (e) => {
      void saveSettings({ copyCharacters: e.target.checked });
    });
    panel.querySelector('[data-act="copy-personas"]').addEventListener("change", (e) => {
      void saveSettings({ copyPersonas: e.target.checked });
    });
    panel.querySelector('[data-act="clear-lock"]')?.addEventListener("click", () => void forceClearRemoteLock());
    panel.querySelector('[data-act="convert-all"]').addEventListener("click", () => void convertAllInChat());
    panel.querySelector('[data-act="make-copies"]').addEventListener("click", () => void createEntityCopies());
    panel.querySelector('[data-act="cancel"]')?.addEventListener("click", () => {
      if (state.run) {
        state.run.cancelled = true;
        renderPanel();
      }
    });
    positionPanel();
  }

  // ───────────────────────── 스캔 루프 ─────────────────────────

  let scanQueued = false;
  function scheduleScan() {
    if (scanQueued) return;
    scanQueued = true;
    setTimeout(() => {
      scanQueued = false;
      scan();
    }, 60);
  }

  function scan() {
    const chatId = readActiveChatId();
    if (chatId !== state.chatId) {
      state.chatId = chatId;
      state.autoFirstSeen.clear();
      state.autoFailures.clear();
      state.autoStatus = { lastCheck: null, note: "", error: null };
      closePanel();
      syncAuto();
    }
    for (const root of galleryRoots()) injectInto(root);
    if (state.panel) positionPanel();
  }

  const observer = new MutationObserver((records) => {
    for (const rec of records) {
      for (const node of rec.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.closest?.(".gwc-panel, .gwc-toast-host, .gwc-overlay")) continue;
        scheduleScan();
        return;
      }
    }
  });

  // ───────────────────────── 시작·정리 ─────────────────────────

  async function start() {
    await loadSettings();
    scan();
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = marinara.setInterval(scan, SCAN_MS);
    onCleanup(() => (marinara.clearInterval ? marinara.clearInterval(timer) : clearInterval(timer)));
    onCleanup(() => observer.disconnect());
    onCleanup(() => {
      if (state.autoTimer) (marinara.clearInterval ? marinara.clearInterval(state.autoTimer) : clearInterval(state.autoTimer));
      state.autoTimer = null;
    });
    onCleanup(() => {
      closePanel();
      for (const el of document.querySelectorAll("[data-gwc-settings], [data-gwc-convert], [data-gwc-copy], [data-gwc-made]")) el.remove();
      for (const root of document.querySelectorAll("[data-gwc-cols]")) root.removeAttribute("data-gwc-cols");
      for (const grid of document.querySelectorAll("[data-gwc-grid]")) grid.removeAttribute("data-gwc-grid");
      toastHost?.remove();
      toastHost = null;
    });
    log.info("시작됨");
  }

  if (typeof marinara.onCleanup === "function") {
    marinara.onCleanup(() => {
      for (const fn of cleanupFns.splice(0)) {
        try {
          fn();
        } catch (error) {
          console.warn(`[${EXT_NAME}] 정리 중 오류`, error);
        }
      }
    });
  }

  void start();
})();
