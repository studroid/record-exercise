# 제임스 인사봇 용도 전환 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 운동기록 봇을 "제임스!"로 시작하는 메시지에 스레드 답장 + 로그 기록 + ✅ 이모지 반응을 하는 인사봇으로 전환한다.

**Architecture:** 기존 파일 구조(`Code.js` 진입점, `Logic.js` 매칭, `SlackAPI.js` Slack 래퍼, `Log.js` 기록, `Constant.js` 상수, `Test.js` 테스트)를 유지하고, 운동기록 관련 로직만 제거/교체한다. 책임 경계는 바꾸지 않는다.

**Tech Stack:** Google Apps Script (V8), clasp, Slack Web API.

**프로젝트 특성 참고 (중요):**
- 모든 `.js` 파일은 Apps Script가 concatenate하여 전역 스코프로 로드한다. 파일 간 `import` 없음.
- 유닛 테스트는 `clasp push` 후 Apps Script 에디터에서 `TestAll()` 함수를 수동 실행해 `console.log/error` 출력으로 결과를 확인한다. 자동화된 테스트 러너 없음.
- 외부 의존 로직(SlackAPI, Spreadsheet 쓰기)은 단위 테스트로 커버하지 않는다. 수동 검증으로 끝낸다.
- 따라서 "테스트 실행해 실패 확인" 단계는 생략하고, 테스트 코드를 구현과 같은 커밋 또는 바로 앞 커밋에 포함시킨다.

---

## File Structure

- 수정: `Code.js` — `doPost` 재작성
- 수정: `Logic.js` — 운동기록 로직 삭제, `isRespondTarget` + 상수 추가
- 수정: `SlackAPI.js` — `postThreadMessage` 추가, `getDisplayNameFromUserId` 삭제
- 수정: `Constant.js`, `Constant.js.template` — 미사용 상수 제거
- 수정: `Test.js` — 구조 유지, 새 테스트로 교체
- 변경 없음: `Log.js`, `appsscript.json`, `.clasp.json`, `package.json`, `README.md`, `.gitignore`, `LICENSE`
- 삭제: `examples/SampleData.js`, `examples/References.js`, `examples/` 디렉토리, `reference.py`

---

### Task 1: 미사용 상수 제거

**Files:**
- Modify: `Constant.js`
- Modify: `Constant.js.template`

- [ ] **Step 1: `Constant.js`에서 운동기록 관련 상수 삭제**

다음 라인들을 제거하여 `Constant.js` 전체 내용을 아래와 같이 만든다:

```javascript
// Slack
const SLACK_BOT_TOKEN = "<SLACK_BOT_TOKEN>";

// Log
const LOG_SHEET_ID = "<LOG_SHEET_ID>";
const LOG_SHEET_NAME = "로그";
```

(Spreadsheet 섹션의 `SHEET_ID`/`SHEET_NAME`, Test 섹션의 `TEST_USER_ID`/`TEST_USER_NAME` 모두 제거. "Spreadsheet", "Test" 섹션 주석도 함께 제거.)

- [ ] **Step 2: `Constant.js.template`도 동일하게 정리**

`Constant.js.template` 전체 내용을 아래와 같이 만든다:

```javascript
// Slack
const SLACK_BOT_TOKEN = "";

// Log
const LOG_SHEET_ID = "";
const LOG_SHEET_NAME = "";
```

- [ ] **Step 3: 커밋**

```bash
git add Constant.js Constant.js.template
git commit -m "refactor: 운동기록용 상수 제거 (SHEET_ID/NAME, TEST_USER_*)"
```

---

### Task 2: `Logic.js` 매칭 로직 교체

**Files:**
- Modify: `Logic.js` (전체 교체)
- Modify: `Test.js` (테스트 케이스 교체)

- [ ] **Step 1: `Test.js` 내용을 새 테스트로 교체**

`Test.js` 전체를 아래 내용으로 덮어쓴다. `assert`, `TestCases`, `init`/`finish`, `TestAll` 구조는 유지하고 테스트 메서드만 교체한다.

```javascript
function assert(a, b) {
  if (a !== b) {
    console.error(`${a} must be ${b}`);
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

- [ ] **Step 2: `Logic.js` 전체를 새 매칭 로직으로 교체**

`Logic.js` 전체를 아래 내용으로 덮어쓴다:

```javascript
const TRIGGER_KEYWORD = "제임스!";
const REPLY_TEXT = "안녕?";

function isRespondTarget(text) {
  return text.startsWith(TRIGGER_KEYWORD);
}
```

(상단의 `const SHEET = SpreadsheetApp.openById(SHEET_ID)...` 줄은 Task 1에서 `SHEET_ID`/`SHEET_NAME`을 이미 삭제했기 때문에 반드시 제거해야 한다. 남겨두면 Apps Script 로드 시점에 `ReferenceError: SHEET_ID is not defined`로 전체 스크립트가 실패한다.)

- [ ] **Step 3: 커밋**

```bash
git add Logic.js Test.js
git commit -m "refactor: 운동기록 로직을 '제임스!' 매칭 로직으로 교체"
```

---

### Task 3: `SlackAPI.js` 갱신

**Files:**
- Modify: `SlackAPI.js`

- [ ] **Step 1: `postThreadMessage` 추가, `getDisplayNameFromUserId` 삭제**

`SlackAPI.js` 전체를 아래 내용으로 덮어쓴다:

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

- [ ] **Step 2: 커밋**

```bash
git add SlackAPI.js
git commit -m "feat: SlackAPI에 postThreadMessage 추가, 미사용 getDisplayNameFromUserId 제거"
```

---

### Task 4: `Code.js`의 `doPost` 재작성

**Files:**
- Modify: `Code.js`

- [ ] **Step 1: 새 플로우로 `doPost` 교체**

`Code.js` 전체를 아래 내용으로 덮어쓴다:

```javascript
function doPost(e) {
  const appEvent = getAppEventBodyAsObject(e);
  if (appEvent.type === "url_verification") {
    return ContentService.createTextOutput(appEvent.challenge);
  }

  const slackEvent = appEvent.event;
  const text = slackEvent.text;

  if (!isRespondTarget(text)) {
    return;
  }

  logTextToSheet(text);

  const threadTs = slackEvent.thread_ts || slackEvent.ts;
  const slackAPI = new SlackAPI(SLACK_BOT_TOKEN);
  slackAPI.postThreadMessage(slackEvent.channel, threadTs, REPLY_TEXT);
  slackAPI.reactWithEmoji(slackEvent);
}

function doGet(e) {
  return ContentService.createTextOutput("제임스 인사봇!");
}

function getAppEventBodyAsObject(e) {
  return JSON.parse(e.postData.contents);
}
```

변경 포인트 요약:
- `url_verification` 처리 위치는 그대로 유지.
- `isRespondTarget(text)`가 false면 조기 반환 (로그도 남기지 않음).
- 매칭된 메시지만 `logTextToSheet(text)` 호출.
- `slackEvent.thread_ts || slackEvent.ts`를 스레드 루트로 사용.
- `getDisplayNameFromUserId` 호출 제거.
- `doGet` 응답 문구도 새 용도에 맞게 교체.

- [ ] **Step 2: 커밋**

```bash
git add Code.js
git commit -m "feat: doPost를 '제임스!' 매칭 → 스레드 답장 + 로그 + 이모지 반응 플로우로 교체"
```

---

### Task 5: 운동기록 전용 참고 파일 삭제

**Files:**
- Delete: `examples/` (디렉토리 전체, `.gitignore`로 이미 무시 중)
- Delete: `reference.py` (추적되지 않은 파일)

> **주의:** `examples/`는 `.gitignore`에 포함되어 있고, `reference.py`는 Git에 한 번도 추적된 적 없는 파일이다. 따라서 `git rm`을 사용할 수 없다. 작업 트리에서만 삭제하면 되고, 이 Task 자체로는 커밋할 내용이 없다(스테이징할 것이 없음).

- [ ] **Step 1: 작업 트리에서 삭제**

```bash
rm -rf examples reference.py
```

- [ ] **Step 2: 삭제 확인**

```bash
ls examples 2>/dev/null; ls reference.py 2>/dev/null; echo "---"; git status
```

예상:
- 위 `ls` 두 줄은 아무 것도 출력하지 않거나 `No such file or directory` 에러를 낸다.
- `git status`는 `nothing to commit, working tree clean` (직전 Task의 커밋 상태) 또는 staged 변경이 없는 상태를 보인다. `examples/`와 `reference.py`가 Untracked 목록에서도 사라진다.

- [ ] **Step 3: 커밋 없음 — 이 Task는 작업 트리 정리로 종료**

별도 커밋을 남기지 않는다. Git이 추적하지 않는 파일 삭제라 커밋할 변경이 없다.

---

### Task 6: 수동 검증

**Files:**
- (배포 및 Slack 테스트만 수행)

- [ ] **Step 1: clasp로 Apps Script에 푸시**

```bash
npm run push
```

예상: `└─ appsscript.json`, `├─ Code.js` 등 현재 파일들이 `Pushed N files.`로 출력됨. 오류가 나면 `clasp login` 상태 확인.

- [ ] **Step 2: Apps Script 에디터에서 `TestAll()` 실행**

Apps Script 에디터를 열고 (`clasp open`) `Test.js`에서 함수 `TestAll`을 선택 후 실행.

예상 출력(실행 로그):
```
테스트 시작
테스트 종료
```

`console.error`가 나타나면 실패이므로 해당 케이스 디버깅. (에러가 없으면 `isRespondTargetTest`의 6개 단언이 모두 통과한 것.)

- [ ] **Step 3: Slack에서 엔드투엔드 검증**

봇이 설치된 채널에서 다음을 수행:

1. `"제임스! 안녕"` 메시지 전송 → 해당 메시지의 스레드에 `"안녕?"` 답장이 달리고, 원문 메시지에 ✅ 이모지가 붙는지 확인. `LOG_SHEET`(로그 시트)에 새 행으로 타임스탬프와 원문이 기록되었는지 확인.
2. 같은 채널의 아무 스레드 안에서 `"제임스! 테스트"` 메시지 전송 → 같은 스레드 안에 `"안녕?"` 답장이 달리는지 확인 (`thread_ts` 경로).
3. `"제임스"` (느낌표 없음) 메시지 전송 → 아무 반응도 없고 로그 시트에도 기록되지 않는지 확인.
4. `"안녕 제임스!"` (앞에 다른 단어) 메시지 전송 → 아무 반응도 없는지 확인.

- [ ] **Step 4: 문제가 없으면 종료; 문제가 있으면 해당 Task로 복귀**

에러 시:
- `ReferenceError: SHEET_ID is not defined` → Task 2 Step 2 누락 (`Logic.js` 상단 `SHEET` 상수 미삭제).
- 답장은 되는데 이모지 반응 없음 → `SlackAPI.reactWithEmoji` 또는 Slack 봇 권한(`reactions:write`) 확인.
- 답장이 스레드 밖에 달림 → `threadTs` 계산 로직(`slackEvent.thread_ts || slackEvent.ts`) 확인.
- 로그 시트에 아무 것도 안 쌓임 → `LOG_SHEET_ID`/`LOG_SHEET_NAME`와 봇 계정의 시트 쓰기 권한 확인.

---

## 실행 순서 근거

1. **Task 1 (상수 제거) 먼저** — Task 2에서 `Logic.js` 상단 `SHEET` 모듈 상수를 안전하게 제거하려면 관련 상수들이 쓰이는 모든 참조가 같은 커밋 내에서 정리되어야 한다. 단, `SHEET`는 `Logic.js` 안에서만 정의되므로 Task 1(Constant) → Task 2(Logic) 순서로 가면 어느 시점의 커밋에서도 `ReferenceError`가 발생하지 않는다.
2. **Task 2 (Logic + Test)** — 순수 로직. 외부 의존 없음.
3. **Task 3 (SlackAPI)** — Task 4에서 호출할 `postThreadMessage`가 먼저 존재해야 한다.
4. **Task 4 (Code.js)** — 진입점 교체. 앞선 Task 2·3 결과물을 사용.
5. **Task 5 (파일 정리)** — 삭제는 코드 교체가 끝난 뒤 해도 안전하다.
6. **Task 6 (수동 검증)** — 마지막.

각 커밋은 독립적으로 빌드/로드 가능하다 (중간 커밋에서도 Apps Script가 `ReferenceError` 없이 로드됨).
