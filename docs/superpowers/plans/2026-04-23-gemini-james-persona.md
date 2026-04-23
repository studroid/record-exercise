# 제임스 페르소나 Gemini 응답 봇 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 고정 문자열 "안녕?" 대신 Gemini API에 제임스 페르소나 프롬프트를 실어 호출하고, 스레드 컨텍스트와 디바운싱/재시도 방지까지 포함한 자연스러운 답변 봇을 만든다.

**Architecture:** 기존 `Code.js` 오케스트레이션 구조를 유지하고, Gemini 호출은 새로운 `GeminiAPI.js`, 페르소나 프롬프트는 `Persona.js`로 분리한다. 스레드 히스토리 조회(`SlackAPI.getThreadMessages`)와 Gemini 입력 변환(`Logic.buildGeminiContents`)으로 책임을 쪼갠다. Slack 재시도 중복 방지와 3초 디바운싱은 `CacheService`로 구현한다.

**Tech Stack:** Google Apps Script (V8), `UrlFetchApp`, `CacheService`, `Utilities.sleep`, Slack Web API (`conversations.replies`, `chat.postMessage`, `reactions.add`), Gemini API (`generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`).

**참조 문서:**
- 설계: `docs/superpowers/specs/2026-04-23-gemini-james-persona-design.md`
- 페르소나 원문: `docs/superpowers/specs/2026-04-23-persona-prompt.md`

**Apps Script 특이사항:**
- 모든 `.js` 파일은 전역 스코프로 concatenate되어 로드됨 (`import` 없음)
- 테스트는 `clasp push` 후 에디터에서 `TestAll()` 수동 실행 — 자동화 러너 없음
- 순수 함수만 단위 테스트 대상. 외부 API/Cache/Sleep은 수동 검증
- HTTP 헤더에 접근 불가 → 재시도 감지는 `event.event_id` 기반

---

## File Structure

- Create: `Persona.js` — `PERSONA_PROMPT` 문자열 상수만 담는 파일
- Create: `GeminiAPI.js` — `class GeminiAPI { generate(systemInstruction, contents) }`
- Modify: `Constant.js` / `Constant.js.template` — `GEMINI_API_KEY`, `GEMINI_MODEL` 추가
- Modify: `Logic.js` — `REPLY_TEXT` 삭제, `isTriggeredThread`/`buildGeminiContents` 추가, `TRIGGER_KEYWORD`/`isRespondTarget` 유지
- Modify: `SlackAPI.js` — `getThreadMessages(channel, threadTs)` 추가
- Modify: `Code.js` — `doPost` 재작성 (bot_id 스킵, event_id dedup, 디바운싱, 트리거 규칙, Gemini 호출)
- Modify: `Test.js` — `isTriggeredThreadTest`, `buildGeminiContentsTest` 추가

---

### Task 1: Gemini 관련 상수 추가

**Files:**
- Modify: `Constant.js`
- Modify: `Constant.js.template`

- [ ] **Step 1: `Constant.js.template`에 Gemini 섹션 추가**

전체 내용을 아래로 교체:

```javascript
// Slack
const SLACK_BOT_TOKEN = "";

// Log
const LOG_SHEET_ID = "";
const LOG_SHEET_NAME = "";

// Gemini
const GEMINI_API_KEY = "";
const GEMINI_MODEL = "gemini-3-flash-preview";
```

- [ ] **Step 2: `Constant.js`에 Gemini 섹션 추가**

전체 내용을 아래로 교체. 실제 값 자리는 비워두고 사용자가 추후 채운다:

```javascript
// Slack
const SLACK_BOT_TOKEN = "<SLACK_BOT_TOKEN>";

// Log
const LOG_SHEET_ID = "<LOG_SHEET_ID>";
const LOG_SHEET_NAME = "로그";

// Gemini
const GEMINI_API_KEY = "";
const GEMINI_MODEL = "gemini-3-flash-preview";
```

> **중요:** `Constant.js`는 `.gitignore`로 무시되므로 `git add`는 `Constant.js.template`만 포함된다. 이는 정상이다.

- [ ] **Step 3: 커밋**

```bash
git add Constant.js.template
git commit -m "feat: Gemini API 상수(GEMINI_API_KEY, GEMINI_MODEL) 추가"
```

---

### Task 2: Persona.js 생성 (페르소나 프롬프트 상수)

**Files:**
- Create: `Persona.js`
- Source: `docs/superpowers/specs/2026-04-23-persona-prompt.md` (원문)

- [ ] **Step 1: `Persona.js` 파일 생성**

`Persona.js`를 만들고 아래 구조로 작성한다:

```javascript
const PERSONA_PROMPT = `<페르소나 원문 내용>`;
```

`<페르소나 원문 내용>`에는 `docs/superpowers/specs/2026-04-23-persona-prompt.md`의 전체 내용을 그대로 집어넣되, 다음 두 가지만 **치환**한다:

1. 백틱 `` ` `` → `` \` `` (모든 인라인 코드 표기에서 발생. 꼼꼼히 처리)
2. 달러 템플릿 `${` → `\${` (원문에 `${`가 있으면 escape. 검색해서 없으면 skip)

그 외 개행·공백·이모지·아시아문자는 **원문 그대로** 유지한다.

구현 요령 (권장):
- 먼저 원문 파일을 그대로 복사해 Persona.js에 붙인다.
- 편집기에서 regex로 일괄 치환: `\`` → `\\\`` (JS 리터럴이라 escape 하나 더 붙음).
- `${` 검색 — 없으면 skip, 있으면 `\${`로 치환.
- 맨 앞에 `const PERSONA_PROMPT = \`` 추가, 맨 뒤에 `\`;` 추가.

- [ ] **Step 2: Persona.js가 구문적으로 유효한지 확인**

```bash
node -e "const fs=require('fs'); const code=fs.readFileSync('Persona.js','utf8'); new Function(code); console.log('OK');"
```

예상 출력: `OK`. 실패하면 escape 누락. 에러 메시지의 라인 주변 백틱/달러 치환을 점검.

- [ ] **Step 3: 프롬프트 내용 일관성 확인**

```bash
node -e "
const fs=require('fs');
const code=fs.readFileSync('Persona.js','utf8');
eval(code);
const md=fs.readFileSync('docs/superpowers/specs/2026-04-23-persona-prompt.md','utf8');
const normalized=PERSONA_PROMPT;
if (normalized === md) { console.log('IDENTICAL'); }
else {
  console.log('length_prompt=', normalized.length, ' length_md=', md.length);
  for (let i=0; i<Math.min(normalized.length, md.length); i++) {
    if (normalized[i] !== md[i]) {
      console.log('first diff at', i, JSON.stringify(normalized.slice(Math.max(0,i-20), i+20)), 'vs', JSON.stringify(md.slice(Math.max(0,i-20), i+20)));
      break;
    }
  }
}
"
```

예상 출력: `IDENTICAL`. 다르게 나오면 출력된 diff 위치의 문자를 수정.

- [ ] **Step 4: 커밋**

```bash
git add Persona.js
git commit -m "feat: 제임스 페르소나 프롬프트 상수 PERSONA_PROMPT 추가"
```

---

### Task 3: Logic.js 보강 및 Test.js 업데이트

**Files:**
- Modify: `Logic.js`
- Modify: `Test.js`

- [ ] **Step 1: `Test.js`에 새 테스트 추가 (먼저 작성)**

`Test.js` 전체를 아래로 교체:

```javascript
function assert(a, b) {
  if (a !== b) {
    console.error(`${a} must be ${b}`);
  }
}

function assertDeep(a, b) {
  const sa = JSON.stringify(a);
  const sb = JSON.stringify(b);
  if (sa !== sb) {
    console.error(`${sa} must be ${sb}`);
  }
}

class TestCases {
  init() {
    console.log("테스트 시작");
  }

  isRespondTargetTest() {
    assert(isRespondTarget("제임스!"), true);
    assert(isRespondTarget("제임스! 안녕"), true);
    assert(isRespondTarget("제임스!안녕"), true);
    assert(isRespondTarget("제임스"), false);
    assert(isRespondTarget("안녕 제임스!"), false);
    assert(isRespondTarget(""), false);
  }

  isTriggeredThreadTest() {
    assert(isTriggeredThread([]), false);
    assert(isTriggeredThread([{ text: "제임스! 안녕", ts: "1.0" }]), true);
    assert(isTriggeredThread([{ text: "안녕", ts: "1.0" }]), false);
    assert(
      isTriggeredThread([
        { text: "제임스! 밥", ts: "1.0" },
        { text: "뭐 먹을까", ts: "2.0" },
      ]),
      true
    );
    assert(
      isTriggeredThread([
        { text: "밥 먹자", ts: "1.0" },
        { text: "제임스! 추천", ts: "2.0" },
      ]),
      false
    );
  }

  buildGeminiContentsTest() {
    assertDeep(buildGeminiContents([], "hello"), [
      { role: "user", parts: [{ text: "hello" }] },
    ]);

    assertDeep(
      buildGeminiContents(
        [
          { text: "제임스! 밥", ts: "1.0" },
          { text: "오오~ 뭐 드실래요?", ts: "2.0", bot_id: "B01" },
          { text: "치킨", ts: "3.0" },
        ],
        "fallback-ignored"
      ),
      [
        { role: "user", parts: [{ text: "제임스! 밥" }] },
        { role: "model", parts: [{ text: "오오~ 뭐 드실래요?" }] },
        { role: "user", parts: [{ text: "치킨" }] },
      ]
    );
  }

  finish() {
    console.log("테스트 종료");
  }
}

function TestAll() {
  const testCases = new TestCases();
  for (method of Object.getOwnPropertyNames(TestCases.prototype)) {
    if (method !== "constructor") {
      testCases[method]();
    }
  }
}
```

- [ ] **Step 2: `Logic.js` 재작성**

`Logic.js` 전체를 아래로 교체:

```javascript
const TRIGGER_KEYWORD = "제임스!";
const REPLY_TEXT = "안녕?";

function isRespondTarget(text) {
  return typeof text === "string" && text.startsWith(TRIGGER_KEYWORD);
}

function isTriggeredThread(threadMessages) {
  if (!threadMessages || threadMessages.length === 0) {
    return false;
  }
  return isRespondTarget(threadMessages[0].text);
}

function buildGeminiContents(threadMessages, fallbackText) {
  if (!threadMessages || threadMessages.length === 0) {
    return [{ role: "user", parts: [{ text: fallbackText }] }];
  }
  return threadMessages.map(function (msg) {
    const role = msg.bot_id ? "model" : "user";
    return { role: role, parts: [{ text: msg.text }] };
  });
}
```

변경 포인트:
- `isRespondTarget`에 `typeof text === "string"` 가드 추가 (Slack 이벤트 중 `text`가 없는 경우 보호)
- `isTriggeredThread`, `buildGeminiContents` 신규 추가
- `REPLY_TEXT`는 **이번 Task에서는 유지**한다. Task 6에서 `Code.js`가 더 이상 참조하지 않게 된 뒤에 제거한다 (bisectability 유지)

- [ ] **Step 3: 구문 체크**

```bash
node -e "const fs=require('fs'); new Function(fs.readFileSync('Logic.js','utf8')); new Function(fs.readFileSync('Test.js','utf8')); console.log('OK');"
```

예상 출력: `OK`.

- [ ] **Step 4: 커밋**

```bash
git add Logic.js Test.js
git commit -m "feat: Logic에 isTriggeredThread/buildGeminiContents 추가, Test 갱신"
```

---

### Task 4: SlackAPI.js에 getThreadMessages 추가

**Files:**
- Modify: `SlackAPI.js`

- [ ] **Step 1: `SlackAPI.js` 전체를 아래로 교체**

```javascript
class SlackAPI {
  constructor(botToken) {
    this.botToken = botToken;
  }

  postThreadMessage(channel, threadTs, text) {
    const payload = {
      'token': this.botToken,
      'channel': channel,
      'thread_ts': threadTs,
      'text': text,
    };

    this._callAPI("post", "chat.postMessage", payload);
  }

  getThreadMessages(channel, threadTs) {
    const payload = {
      'token': this.botToken,
      'channel': channel,
      'ts': threadTs,
    };

    const response = this._callAPI("get", "conversations.replies", payload);
    return (response && response.messages) ? response.messages : [];
  }

  reactWithEmoji(slackEvent) {
    const payload = {
      'token': this.botToken,
      'channel': slackEvent.channel,
      'timestamp': slackEvent.ts,
      'name': "heavy_check_mark"
    };

    this._callAPI("post", "reactions.add", payload);
  }

  _callAPI(httpMethod, apiMethod, payload) {
    const option = {
      'method': httpMethod,
      'payload': payload
    };

    const response = UrlFetchApp.fetch("https://slack.com/api/" + apiMethod, option);
    return JSON.parse(response.getContentText());
  }
}
```

변경 포인트:
- `getThreadMessages(channel, threadTs)` 추가. `conversations.replies` GET 호출. `messages` 배열이 없으면 빈 배열 반환.
- 나머지 메서드는 그대로 유지.

- [ ] **Step 2: 구문 체크**

```bash
node -e "new Function(require('fs').readFileSync('SlackAPI.js','utf8')); console.log('OK');"
```

예상: `OK`.

- [ ] **Step 3: 커밋**

```bash
git add SlackAPI.js
git commit -m "feat: SlackAPI.getThreadMessages 추가 (conversations.replies)"
```

---

### Task 5: GeminiAPI.js 생성

**Files:**
- Create: `GeminiAPI.js`

- [ ] **Step 1: 새 파일 `GeminiAPI.js` 작성**

```javascript
class GeminiAPI {
  constructor(apiKey, model) {
    this.apiKey = apiKey;
    this.model = model;
  }

  generate(systemInstruction, contents) {
    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/" +
      encodeURIComponent(this.model) +
      ":generateContent?key=" +
      encodeURIComponent(this.apiKey);

    const body = {
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
      contents: contents,
    };

    const option = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(body),
      muteHttpExceptions: true,
    };

    const response = UrlFetchApp.fetch(url, option);
    const code = response.getResponseCode();
    const text = response.getContentText();

    if (code < 200 || code >= 300) {
      console.error("Gemini API error " + code + ": " + text);
      return null;
    }

    const parsed = JSON.parse(text);
    const candidate = parsed && parsed.candidates && parsed.candidates[0];
    const part = candidate && candidate.content && candidate.content.parts && candidate.content.parts[0];
    if (!part || typeof part.text !== "string") {
      console.error("Gemini API unexpected response: " + text);
      return null;
    }
    return part.text;
  }
}
```

설계 포인트:
- `muteHttpExceptions: true` — Apps Script의 `UrlFetchApp`은 기본적으로 4xx/5xx에서 예외를 던진다. 예외 대신 응답 코드로 분기하기 위해 `true` 설정.
- 실패 시 `null` 반환. 호출부(`Code.js`)가 `null` 체크해서 답장 스킵.
- 성공 경로는 `candidates[0].content.parts[0].text` 추출.

- [ ] **Step 2: 구문 체크**

```bash
node -e "new Function(require('fs').readFileSync('GeminiAPI.js','utf8')); console.log('OK');"
```

예상: `OK`.

- [ ] **Step 3: 커밋**

```bash
git add GeminiAPI.js
git commit -m "feat: GeminiAPI 클래스 추가 (generateContent 호출 래퍼)"
```

---

### Task 6: Code.js의 doPost 재작성 (메인 플로우)

**Files:**
- Modify: `Code.js`

- [ ] **Step 1: `Code.js` 전체를 아래로 교체 및 `Logic.js`에서 REPLY_TEXT 제거**

`Code.js`를 아래 내용으로 덮어쓴다:

```javascript
const EVENT_CACHE_TTL_SEC = 300;
const DEBOUNCE_LOCK_TTL_SEC = 10;
const DEBOUNCE_DELAY_MS = 3000;

function doPost(e) {
  const appEvent = getAppEventBodyAsObject(e);
  if (appEvent.type === "url_verification") {
    return ContentService.createTextOutput(appEvent.challenge);
  }

  const slackEvent = appEvent.event;
  if (!slackEvent || slackEvent.bot_id) {
    return;
  }

  const cache = CacheService.getScriptCache();

  const eventKey = "evt:" + appEvent.event_id;
  if (cache.get(eventKey)) {
    return;
  }
  cache.put(eventKey, "1", EVENT_CACHE_TTL_SEC);

  const threadRoot = slackEvent.thread_ts || slackEvent.ts;
  const slackAPI = new SlackAPI(SLACK_BOT_TOKEN);

  let threadMessages = [];
  if (slackEvent.thread_ts) {
    try {
      threadMessages = slackAPI.getThreadMessages(slackEvent.channel, threadRoot);
    } catch (err) {
      console.error("getThreadMessages failed: " + err);
      threadMessages = [];
    }
  }

  const triggered = slackEvent.thread_ts
    ? isTriggeredThread(threadMessages)
    : isRespondTarget(slackEvent.text);
  if (!triggered) {
    return;
  }

  const lockKey = "lock:" + threadRoot;
  cache.put(lockKey, slackEvent.ts, DEBOUNCE_LOCK_TTL_SEC);
  Utilities.sleep(DEBOUNCE_DELAY_MS);
  if (cache.get(lockKey) !== slackEvent.ts) {
    return;
  }

  logTextToSheet(slackEvent.text);

  const contents = buildGeminiContents(threadMessages, slackEvent.text);
  const geminiAPI = new GeminiAPI(GEMINI_API_KEY, GEMINI_MODEL);

  let replyText = null;
  try {
    replyText = geminiAPI.generate(PERSONA_PROMPT, contents);
  } catch (err) {
    console.error("Gemini generate failed: " + err);
  }

  if (replyText) {
    slackAPI.postThreadMessage(slackEvent.channel, threadRoot, replyText);
  }

  slackAPI.reactWithEmoji(slackEvent);
}

function doGet(e) {
  return ContentService.createTextOutput("제임스 인사봇!");
}

function getAppEventBodyAsObject(e) {
  return JSON.parse(e.postData.contents);
}
```

플로우 요약 (각 가드는 해당 조건에서 즉시 반환):
1. `url_verification` → challenge 응답
2. `slackEvent` 없음 또는 `bot_id` 존재 → 무시
3. `event_id` 캐시 히트 → 중복 무시 (300s TTL)
4. `event_id`를 캐시에 기록
5. 스레드 루트 결정, 필요 시 스레드 메시지 조회 (실패해도 빈 배열로 graceful)
6. 트리거 판정 (스레드면 `isTriggeredThread`, 아니면 `isRespondTarget`)
7. 디바운스 락 기록 → 3초 sleep → 락 재조회로 "내가 마지막인지" 확인
8. 로그 기록
9. Gemini 호출 (실패 시 `null`)
10. `null`이 아니면 Slack 스레드 답장
11. ✅ 이모지 반응 (Gemini 성공/실패 무관)

- [ ] **Step 2: `Logic.js`에서 `REPLY_TEXT` 제거**

`Logic.js`에서 `const REPLY_TEXT = "안녕?";` 줄을 삭제. 최종 `Logic.js`는 아래와 같아야 한다:

```javascript
const TRIGGER_KEYWORD = "제임스!";

function isRespondTarget(text) {
  return typeof text === "string" && text.startsWith(TRIGGER_KEYWORD);
}

function isTriggeredThread(threadMessages) {
  if (!threadMessages || threadMessages.length === 0) {
    return false;
  }
  return isRespondTarget(threadMessages[0].text);
}

function buildGeminiContents(threadMessages, fallbackText) {
  if (!threadMessages || threadMessages.length === 0) {
    return [{ role: "user", parts: [{ text: fallbackText }] }];
  }
  return threadMessages.map(function (msg) {
    const role = msg.bot_id ? "model" : "user";
    return { role: role, parts: [{ text: msg.text }] };
  });
}
```

- [ ] **Step 3: 구문 체크**

```bash
node -e "new Function(require('fs').readFileSync('Code.js','utf8')); new Function(require('fs').readFileSync('Logic.js','utf8')); console.log('OK');"
```

예상: `OK`.

- [ ] **Step 4: 커밋**

```bash
git add Code.js Logic.js
git commit -m "feat: doPost을 Gemini 호출 + 디바운싱 + 재시도 방지 플로우로 재작성"
```

---

### Task 7: 수동 검증

**Files:**
- (배포 및 실제 동작 확인)

- [ ] **Step 1: Constant.js의 GEMINI_API_KEY 채우기**

로컬 `Constant.js`에 실제 Gemini API 키를 넣는다 (gitignored라 커밋되지 않음). 없으면 Google AI Studio에서 발급.

```javascript
const GEMINI_API_KEY = "AIzaSy...실제 키...";
```

- [ ] **Step 2: `npm run push`로 배포**

```bash
npm run push
```

예상: `Pushed N files.` 출력. `clasp login` 상태 확인 필요할 수 있음.

- [ ] **Step 3: Apps Script 에디터에서 `TestAll()` 실행**

`clasp open` 후 Test.js 선택 → TestAll 함수 실행. Execution log 예상:
```
테스트 시작
테스트 종료
```

`console.error`가 찍히면 해당 케이스 실패. `isRespondTargetTest` / `isTriggeredThreadTest` / `buildGeminiContentsTest` 중 실패 케이스 확인.

- [ ] **Step 4: Slack 엔드투엔드 검증**

봇이 설치된 채널에서:

1. **Top-level 트리거**: `"제임스! 안녕하세요"` 전송 → 3초 후 스레드에 제임스 말투 답장 + ✅ + 로그 기록 확인
2. **스레드 연속**: 위 답장이 달린 스레드 안에서 prefix 없이 `"근데 오늘 점심 뭐 먹을까요?"` 전송 → 같은 스레드 안에 이전 맥락 반영된 답장 (예: 앞서 무슨 얘기 했는지 기억하는 듯한 말투)
3. **비-트리거 top-level**: `"안녕 제임스!"` 또는 `"오늘 날씨 좋다"` 전송 → 무응답, 로그 없음
4. **디바운싱**: `"제임스! 질문1"` 전송 후 1초 내에 `"제임스! 질문2"` 전송 → 답장은 1개만, 질문2 기준으로
5. **중복 이벤트 방지 (간접 확인)**: 반응이 한 메시지에 두 번 가지 않으면 통과. Slack의 자동 재시도를 재현하긴 어렵지만, `CacheService`에 `evt:{event_id}` 키가 쌓이는 것을 Apps Script 실행 로그의 `console` 호출을 임시로 추가해 확인 가능 (선택).

- [ ] **Step 5: 문제 발견 시 해당 Task로 복귀**

흔한 실패와 대응:
- 답장이 빈 문자열/`undefined` → Gemini 응답 구조가 예상과 다름. `GeminiAPI.generate` 반환 전 `console.log(parsed)` 일시 추가해 실제 응답 확인.
- Slack 재시도로 중복 답장 → `event_id` 캐시 로직 확인. `cache.put` 전 `cache.get` 호출 순서가 맞는지.
- 디바운스가 안 됨 → `cache.get(lockKey)` 반환값 타입 확인 (Apps Script CacheService는 문자열만 저장). `slackEvent.ts`도 문자열이므로 `===` 비교 문제 없어야 함.
- `ReferenceError: PERSONA_PROMPT is not defined` → `Persona.js`가 clasp 푸시에 포함됐는지 확인 (`.claspignore` 설정 확인).

---

## 실행 순서 근거

1. **Task 1 (상수)**: 이후 Task들이 `GEMINI_API_KEY`, `GEMINI_MODEL`을 참조하므로 가장 먼저.
2. **Task 2 (Persona.js)**: 순수 상수 파일. 의존성 없음. `Code.js`에서 사용하기 전에만 존재하면 됨.
3. **Task 3 (Logic + Test)**: 순수 함수. 다른 파일과 독립적.
4. **Task 4 (SlackAPI)**: `getThreadMessages` 추가. 기존 메서드 동작에 영향 없음.
5. **Task 5 (GeminiAPI)**: 신규 파일. 독립적.
6. **Task 6 (Code.js)**: 위 모든 빌딩블록을 한데 엮는다. 반드시 마지막 코드 변경.
7. **Task 7 (수동 검증)**: 배포와 실 Slack 테스트.

각 Task의 커밋은 독립적으로 Apps Script에 로드 가능하다 (Task 5까지는 `Code.js`가 아직 기존 로직을 쓰고 있어 기존 동작 유지; Task 6에서 신규 플로우로 스위치).
