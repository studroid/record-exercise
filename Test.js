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

  isMuteUnmuteCommandTest() {
    assert(isMuteCommand("제임스 그만해!"), true);
    assert(isMuteCommand("제임스 그만해! 오늘은 쉬어요"), true);
    assert(isMuteCommand("제임스 그만"), false);
    assert(isMuteCommand("제임스!"), false);
    assert(isMuteCommand(""), false);

    assert(isUnmuteCommand("제임스 다시 시작해!"), true);
    assert(isUnmuteCommand("제임스 다시 시작해! 와썹~"), true);
    assert(isUnmuteCommand("제임스 다시"), false);
    assert(isUnmuteCommand(""), false);
  }

  isThreadMutedTest() {
    assert(isThreadMuted([]), false);
    assert(isThreadMuted([{ text: "제임스! 안녕", ts: "1" }]), false);
    assert(
      isThreadMuted([
        { text: "제임스! 안녕", ts: "1" },
        { text: "오오~", ts: "2", bot_id: "B01" },
        { text: "제임스 그만해!", ts: "3" },
      ]),
      true
    );
    assert(
      isThreadMuted([
        { text: "제임스! 안녕", ts: "1" },
        { text: "제임스 그만해!", ts: "2" },
        { text: "제임스 다시 시작해!", ts: "3" },
      ]),
      false
    );
    assert(
      isThreadMuted([
        { text: "제임스! 밥", ts: "1" },
        { text: "제임스 그만해!", ts: "2" },
        { text: "제임스 다시 시작해!", ts: "3" },
        { text: "제임스 그만해!", ts: "4" },
      ]),
      true
    );
    // bot_id 메시지는 무시되어야 함 (혹시 봇 메시지에 "제임스 그만해!" 포함되어도 상태 변화 X)
    assert(
      isThreadMuted([
        { text: "제임스! 안녕", ts: "1" },
        { text: "제임스 그만해!라고 말하면 멈춰요", ts: "2", bot_id: "B01" },
      ]),
      false
    );
  }

  pickFailureMessageTest() {
    const reasons = ["rate_limit", "api_error", "bad_response", "network", "unknown"];
    for (const r of reasons) {
      const msg = pickFailureMessage(r);
      assert(typeof msg === "string", true);
      assert(msg.length > 0, true);
      assert(msg === GEMINI_FAILURE_MESSAGES[r], true);
    }
    // Unknown/undefined reason falls back to 'unknown' message
    assert(pickFailureMessage("something_weird"), GEMINI_FAILURE_MESSAGES.unknown);
    assert(pickFailureMessage(undefined), GEMINI_FAILURE_MESSAGES.unknown);
    assert(pickFailureMessage(null), GEMINI_FAILURE_MESSAGES.unknown);
    // Rate limit message should mention 한도
    assert(pickFailureMessage("rate_limit").includes("한도"), true);
  }

  isFirstBotResponseInThreadTest() {
    assert(isFirstBotResponseInThread([]), true);
    assert(isFirstBotResponseInThread(null), true);
    assert(isFirstBotResponseInThread(undefined), true);
    assert(isFirstBotResponseInThread([{ text: "제임스! 안녕", ts: "1" }]), true);
    assert(
      isFirstBotResponseInThread([
        { text: "제임스! 안녕", ts: "1" },
        { text: "와썹", ts: "2" },
      ]),
      true
    );
    assert(
      isFirstBotResponseInThread([
        { text: "제임스! 안녕", ts: "1" },
        { text: "오오~ 반갑슴다", ts: "2", bot_id: "B01" },
      ]),
      false
    );
  }

  buildCommandHintTest() {
    const hint = buildCommandHint();
    assert(typeof hint === "string", true);
    assert(hint.includes("제임스 그만해!"), true);
    assert(hint.includes("제임스 다시 시작해!"), true);
  }

  buildLengthHintTest() {
    assert(buildLengthHint("").includes("0자다"), true);
    assert(buildLengthHint("a".repeat(50)).includes("50자다"), true);
    const out = buildLengthHint("test");
    assert(out.includes("기본 분량: 1~2줄"), true);
    assert(out.includes("3~5줄"), true);
    assert(out.includes("단답은 피할 것"), true);
    assert(out.includes("무거운 구조는 쓰지 말 것"), true);
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
