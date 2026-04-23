# "제임스!" 인사봇으로 용도 전환 설계

## 배경

현재 이 Google Apps Script 프로젝트는 Slack 메시지가 `!운동` 또는 `!기록` 으로 시작할 때 운동 시간을 스프레드시트에 기록하고 ✅ 이모지로 반응하는 봇이다. 운동기록 용도를 폐기하고, "제임스!"로 시작하는 메시지에 스레드로 인사 답장을 보내는 봇으로 전환한다.

## 요구사항

Slack 메시지 이벤트 수신 시:

1. 메시지 본문이 `"제임스!"` 로 시작하는 경우에만 반응한다 (`startsWith` 매칭).
2. 매칭된 메시지에 대해 다음을 수행한다:
   - 원문 메시지를 로그 스프레드시트(`LOG_SHEET`)에 기록한다.
   - 해당 메시지가 속한 스레드에 `"안녕?"` 이라고 텍스트 답장을 보낸다.
     - 원문 메시지에 `thread_ts`가 있으면 그 값을 스레드 루트로 사용하고, 없으면 원문 메시지의 `ts`를 스레드 루트로 사용한다.
   - 원문 메시지에 ✅(`heavy_check_mark`) 이모지로 반응한다.
3. 매칭되지 않은 메시지는 기록/답장/반응을 모두 생략하고 조기 반환한다.
4. Slack `url_verification` 이벤트 처리는 기존과 동일하게 유지한다.

## 비요구사항 (범위 밖)

- `README.md` 내용 갱신 (프로젝트 디렉토리명이 그대로 "운동기록"이므로 이번 범위에서는 손대지 않는다).
- 다국어/대소문자/공백 관용 매칭 (엄격한 `startsWith("제임스!")`만).
- 응답 실패 시 재시도 로직.

## 아키텍처

기존 파일 레이아웃을 그대로 유지한다. 책임 분리가 이미 명료하므로 재구조화할 이유가 없다.

- `Code.js` — Slack 이벤트 진입점 (`doPost`), 조율 담당
- `Logic.js` — 매칭 규칙과 도메인 상수
- `SlackAPI.js` — Slack Web API 래퍼
- `Log.js` — 로그 시트 기록
- `Constant.js` — 환경 상수
- `Test.js` — 테스트 케이스 및 러너

### 실행 흐름

```
Slack event → doPost(e)
  ↓
appEvent.type === "url_verification" → challenge 응답 후 종료
  ↓
text가 isRespondTarget(text)? (startsWith "제임스!")
  ├─ 아니오 → 조기 반환
  └─ 예
      ├─ logTextToSheet(text)
      ├─ SlackAPI.postThreadMessage(channel, thread_ts || ts, "안녕?")
      └─ SlackAPI.reactWithEmoji(slackEvent)
```

## 파일별 변경 내역

### `Code.js` — `doPost` 재작성

- 매칭되지 않은 메시지는 로그를 포함한 모든 동작을 생략하고 조기 반환한다 (현재는 매칭 전에 모든 메시지를 로그하고 있음).
- 매칭된 메시지에 대해 로그 → 스레드 답장 → 이모지 반응 순서로 실행한다.
- `getDisplayNameFromUserId` 호출 제거 (사용자 이름 불필요).
- 스레드 루트: `slackEvent.thread_ts || slackEvent.ts`.

### `Logic.js` — 운동기록 로직 전면 제거

삭제:
- 모듈 상수 `SHEET`
- 상수 `COMMAND_HEAD1`, `COMMAND_HEAD2`
- 함수 `recordExerciseTime`, `getTargetTime`, `getTimesToRecord`, `formatHour`, `getTargetRange`, `getTargetColumn`, `getTargetRow`

추가/변경:
- 상수 `TRIGGER_KEYWORD = "제임스!"`
- 상수 `REPLY_TEXT = "안녕?"`
- 함수 `isRespondTarget(text)` — `text.startsWith(TRIGGER_KEYWORD)` 반환. (기존 `isRecordMessage` 대체)

### `SlackAPI.js`

추가:
- `postThreadMessage(channel, threadTs, text)` — `chat.postMessage`를 `thread_ts`와 함께 호출한다.

유지:
- `reactWithEmoji(slackEvent)` — 매칭된 메시지에 ✅ 반응을 붙이는 용도로 계속 사용한다.
- `_callAPI(httpMethod, apiMethod, payload)` — 내부 공통 호출부.

삭제:
- `getDisplayNameFromUserId(userId)` — 더 이상 사용하지 않는다.

### `Constant.js` / `Constant.js.template`

삭제:
- `SHEET_ID`, `SHEET_NAME` (운동기록표 시트 더 이상 사용 안 함)
- `TEST_USER_ID`, `TEST_USER_NAME` (연관 테스트 제거됨)

유지:
- `SLACK_BOT_TOKEN`
- `LOG_SHEET_ID`, `LOG_SHEET_NAME`

추가 없음. `TRIGGER_KEYWORD`/`REPLY_TEXT`는 의미적으로 `Logic.js`에 둔다.

### `Log.js`

변경 없음.

### `Test.js` — 구조 유지, 내용 교체

유지:
- `assert(a, b)` 헬퍼
- `TestCases` 클래스, `init`/`finish` 메서드
- `TestAll()` 러너

삭제:
- `isRecordMessageTest`, `getTargetTimeTest`, `getTimesToRecordTest`, `getSlackDisplayNameFromUserIdTest`, `getTargetColumnTest`, `getTargetRowTest`, `recordExerciseTimeTest`

추가:
- `isRespondTargetTest` — 다음 케이스 검증:
  - `isRespondTarget("제임스!")` === true
  - `isRespondTarget("제임스! 안녕")` === true
  - `isRespondTarget("제임스")` === false (느낌표 없음)
  - `isRespondTarget("안녕 제임스!")` === false (중간/뒤에 있음)
  - `isRespondTarget("")` === false

### 그 외 파일 정리

삭제:
- `examples/SampleData.js`, `examples/References.js` — 운동기록 샘플이라 새 용도와 무관
- `reference.py` — 운동기록 초기 레퍼런스

손대지 않음:
- `README.md` — 디렉토리명이 여전히 "운동기록"이므로 일관성 유지 차원에서 범위 밖
- `appsscript.json`, `.clasp.json`, `package.json`, `LICENSE`, `.gitignore`

## 에러 처리

- `doPost`는 기존과 동일하게 예외를 명시적으로 처리하지 않는다. Apps Script 런타임이 실패를 잡아 Slack에 5xx로 반환하면 Slack이 재시도한다.
- `postThreadMessage`의 Slack API 응답 검증은 도입하지 않는다 (기존 `reactWithEmoji`와 일관성 유지, 단순성 우선).

## 테스트 전략

- `Test.js`의 유닛 테스트는 순수 로직(`isRespondTarget`)에 집중한다.
- Slack API나 Spreadsheet를 건드리는 통합 테스트는 이번 범위에 포함하지 않는다 (기존에도 없었음).
- 수동 검증: 배포 후 Slack에서 "제임스! 테스트" 메시지를 보내 답장·이모지·로그를 확인한다.
