# 제임스 페르소나 Gemini 응답 봇 설계

## 배경

현재 Slack 봇은 `"제임스!"` 로 시작하는 메시지에 고정 문자열 `"안녕?"` 으로 스레드 답장을 한다. 이를 Gemini API에 페르소나 프롬프트를 실어 호출하는 구조로 업그레이드해, 제임스(김시준)의 말투·유머·사고방식을 모방한 응답을 돌려주게 한다.

## 요구사항

### 트리거 규칙

1. **Top-level 메시지** (`event.thread_ts` 없음): `text.startsWith("제임스!")`일 때만 응답.
2. **스레드 답글** (`event.thread_ts` 있음): 스레드 루트 메시지의 텍스트가 `"제임스!"` 로 시작하면 응답. 현재 답글 자체가 `"제임스!"` 로 시작할 필요는 없다.
3. **봇 자신이 보낸 메시지** (`event.bot_id` 존재): 항상 무시. 봇이 자기 응답에 다시 답하는 무한 루프 방지.

### Slack 재시도 중복 방지

- `event.event_id` 를 키로 `CacheService.getScriptCache()` 에 TTL 300초로 기록한다. 이미 있으면 이벤트 처리를 즉시 스킵한다.
- Apps Script `doPost` 는 HTTP 헤더에 접근할 수 없어 `X-Slack-Retry-Num` 을 볼 수 없으므로 `event_id` 기반이 유일한 선택.

### 디바운싱

동일 스레드 내에서 연속으로 빠르게 들어오는 메시지에 대해 마지막 메시지 하나에만 응답한다:

1. 트리거가 확인된 메시지에 대해 `CacheService` 에 키 `lock:{threadRoot}`, 값 `event.ts`, TTL 10초로 기록.
2. `Utilities.sleep(3000)` — 3초 대기.
3. 다시 캐시에서 `lock:{threadRoot}` 조회. 값이 여전히 이 핸들러의 `event.ts` 와 같으면 "이 메시지가 마지막" → 이후 처리 진행. 다른 값으로 바뀌어 있으면 뒤에 새 메시지가 들어왔다는 뜻 → 이 핸들러는 조기 반환하고 뒤의 핸들러가 처리.

모든 응답 경로에 3초 지연이 붙는다. 이는 의도된 트레이드오프이며, 연속 질문을 모아 답하게 만드는 의미.

### 메시지 처리 본체

트리거 + 중복 방지 + 디바운싱 통과 후:

1. `logTextToSheet(currentText)` — `LOG_SHEET` 에 원문 기록. 응답 대상이 된 메시지만 기록 (지금 규약 유지).
2. 스레드 히스토리가 있으면 (`thread_ts` 존재) `SlackAPI.getThreadMessages(channel, threadRoot)` 로 조회해 Gemini contents 배열을 만든다. 없으면 현재 메시지 하나로 단일 turn.
3. `GeminiAPI.generate(PERSONA_PROMPT, contents)` 호출.
4. 성공 시 반환 텍스트를 `SlackAPI.postThreadMessage(channel, threadRoot, text)` 로 전송.
5. 마지막으로 `SlackAPI.reactWithEmoji(slackEvent)` 호출 (Gemini 성공/실패 무관, 트리거 확인된 메시지에는 ✅를 단다).

### Gemini contents 구성 규칙

Slack `conversations.replies` 결과 배열을 시간순 오름차순으로 돌면서 각 메시지를 Gemini `contents` 한 항목으로 변환한다:

- `msg.bot_id` 존재 → `{ role: "model", parts: [{ text: msg.text }] }`
- 그 외 → `{ role: "user", parts: [{ text: msg.text }] }`

스레드가 없는 top-level 트리거는 `[{ role: "user", parts: [{ text: currentText }] }]` 한 항목짜리 contents로.

페르소나 프롬프트는 별도 `systemInstruction` 필드에 실어 보낸다. 사용자 메시지 텍스트는 `"제임스!"` prefix 포함 원문 그대로 전달.

### 비요구사항 (범위 밖)

- 페르소나 프롬프트 동적 편집 / A/B 테스트 / 버저닝
- 긴 스레드의 자동 요약 또는 truncation. 토큰 초과 시 Gemini가 에러를 돌려주면 silent fail로 응답이 안 나갈 뿐.
- Gemini tool use / function calling.
- 응답 스타일 사용자 제어 (말투 강도 조절 등).
- README 갱신.

## 아키텍처

기존 파일 구조를 유지하되, Gemini 관련 책임은 새 파일로 분리한다:

- `Code.js` — Slack 진입점, 오케스트레이션
- `Logic.js` — 매칭 규칙 + Gemini contents 변환 헬퍼
- `Persona.js` — `PERSONA_PROMPT` 상수만 담는 파일 (길이가 길어 다른 파일에 섞으면 가독성 저해)
- `GeminiAPI.js` — `class GeminiAPI` (`generate` 메서드)
- `SlackAPI.js` — 기존 메서드 + `getThreadMessages` 추가
- `Log.js` — 변경 없음
- `Constant.js` / `Constant.js.template` — `GEMINI_API_KEY`, `GEMINI_MODEL` 추가
- `Test.js` — 순수 함수 단위 테스트

### 실행 흐름

```
Slack event → doPost(e)
  ↓
url_verification → challenge 응답
  ↓
slackEvent.bot_id 있음 → 무시
  ↓
event_id 캐시 히트? → 무시
  ↓
event_id 캐시 put (TTL 300s)
  ↓
threadRoot = thread_ts || ts
threadMessages = thread_ts 있으면 getThreadMessages 결과, 아니면 []
  ↓
트리거 판정:
  - threadMessages 있음 → isTriggeredThread(threadMessages)
  - 없음 → isRespondTarget(text)
  ↓ (false면 조기 반환)
디바운싱:
  put("lock:{threadRoot}", event.ts, 10s)
  sleep(3000)
  get("lock:{threadRoot}") !== event.ts → 조기 반환
  ↓
logTextToSheet(text)
  ↓
contents = buildGeminiContents(threadMessages, text)
  ↓
geminiAPI.generate(PERSONA_PROMPT, contents)
  ├─ 성공 → slackAPI.postThreadMessage(channel, threadRoot, 응답)
  └─ 실패 → console.error, 답장 생략
  ↓
slackAPI.reactWithEmoji(slackEvent)
```

### 컴포넌트 경계

**`GeminiAPI.generate(systemInstruction, contents) -> string`**
- 입력: 시스템 지시문(문자열), contents 배열
- 출력: 생성된 텍스트(문자열). 실패 시 예외를 던지거나 `null` 반환 (호출부는 null/예외 양쪽 처리)
- 의존: `UrlFetchApp`, `GEMINI_API_KEY`, `GEMINI_MODEL`

**`SlackAPI.getThreadMessages(channel, threadTs) -> Array<{user?, bot_id?, text, ts, ...}>`**
- 입력: 채널 ID, 스레드 루트 ts
- 출력: `conversations.replies` API의 `messages` 배열 (Slack이 주는 원 형태 그대로)
- 의존: `UrlFetchApp`, `SLACK_BOT_TOKEN`

**`Logic.isRespondTarget(text) -> boolean`** (기존 유지)

**`Logic.isTriggeredThread(threadMessages) -> boolean`**
- 입력: 스레드 메시지 배열 (시간순 오름차순 가정)
- 출력: 첫 번째 메시지 텍스트가 `"제임스!"` 로 시작하는지
- 빈 배열이면 `false`

**`Logic.buildGeminiContents(threadMessages, fallbackText) -> Array`**
- 입력: 스레드 메시지 배열, fallback 텍스트
- 출력: Gemini `contents` 형식 배열
- 배열이 비어 있으면 `[{ role: "user", parts: [{ text: fallbackText }] }]`
- 비어 있지 않으면 시간순으로 각 메시지를 `bot_id` 유무로 role 매핑
- 현재 트리거 메시지는 `conversations.replies` 결과에 포함되어 있다고 가정한다. Slack의 해당 API는 일반적으로 최신 메시지까지 포함해 반환한다. 만에 하나 누락되는 드문 경우는 이 설계에서 별도 처리하지 않는다 (다음 상호작용에서 자연히 복구됨)

## 에러 처리

- `getThreadMessages` 실패 (API 에러, 네트워크) → catch 후 빈 배열로 처리 → fallbackText만으로 Gemini 호출
- `generate` 실패 → catch 후 `console.error`, 답장 생략, ✅ 이모지는 붙임
- `CacheService` 실패 → 발생 시 그냥 처리 진행 (캐시는 최적화용). 실제로 Apps Script CacheService가 예외를 던지는 경우는 드물다.

"silent fail" 패턴은 기존 `reactWithEmoji` / `postThreadMessage` 와 일관되며, Slack webhook 스펙상 서버는 늘 200을 반환해야 재시도가 억제되기 때문이기도 하다.

## 테스트 전략

자동화된 단위 테스트(순수 함수만):
- `isRespondTargetTest` (기존)
- `isTriggeredThreadTest` — 루트가 "제임스!" 시작/비-시작/빈 배열
- `buildGeminiContentsTest` — bot_id 있는 메시지 role 매핑, bot_id 없는 메시지 role 매핑, 시간순 유지, 빈 입력 시 fallback 사용

수동 검증:
- Slack에서 "제임스! 안녕" 보내 응답 수신
- 스레드 안에서 prefix 없이 후속 질문 → 여전히 응답 수신
- prefix 없는 top-level 메시지 → 무응답
- 3초 안에 연속 메시지 2개 → 1개만 응답 (디바운싱)
- 같은 이벤트가 Slack 재시도로 두 번 들어오는 상황은 재현이 어려우니 스킵. 캐시 put/get 로직의 올바름만 코드 리뷰로 담보.

## 상수·설정

- `Constant.js`: `GEMINI_API_KEY`, `GEMINI_MODEL = "gemini-3-flash-preview"` 추가. 기존 상수 유지.
- `Constant.js.template`: 동일 키들을 빈 문자열로 추가.
- `Logic.js`: `TRIGGER_KEYWORD = "제임스!"` 유지. `REPLY_TEXT` 삭제.
- 캐시 키 네임스페이스: `"evt:{event_id}"`, `"lock:{threadRoot}"` (충돌 방지 접두사).
