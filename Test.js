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
