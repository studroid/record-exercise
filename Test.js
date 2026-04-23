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

  buildLengthHintTest() {
    assert(buildLengthHint("").includes("0자다"), true);
    assert(buildLengthHint("짧은 말").includes("한 줄 이내"), true);
    assert(buildLengthHint("a".repeat(50)).includes("2~4줄"), true);
    assert(buildLengthHint("a".repeat(200)).includes("중간 길이"), true);
    assert(buildLengthHint("a".repeat(500)).includes("구조화"), true);
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
