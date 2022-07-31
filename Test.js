function assert(a, b) {
  if(a !== b) {
    console.error(`${a} must be ${b}`);
  }
}

class TestCases {
  init() {
    console.log("테스트 시작");
  }

  isRecordMessageTest() {
    assert(isRecordMessage("!운동기록"), true);
    assert(isRecordMessage("!운동"), true);
    assert(isRecordMessage("!기록"), true);
    assert(isRecordMessage("!운동 기록"), true);
    assert(isRecordMessage("!운"), false);
  }

  getTimesToRecordTest() {
    const currentTime1 = new Date(1991, 0, 22, 4, 24, 30);
    assert(getTimesToRecord(currentTime1), "03:00~04:00");

    const currentTime2 = new Date(1991, 0, 22, 14, 24, 30);
    assert(getTimesToRecord(currentTime2), "13:00~14:00");
  }

  getSlackDisplayNameFromUserIdTest() {
    const slackAPI = new SlackAPI(SLACK_BOT_TOKEN);
    const userDisplayName = slackAPI.getDisplayNameFromUserId(TEST_USER_ID);
    assert(userDisplayName, TEST_USER_NAME);
  }

  getTargetColumnTest() {
    const targetColumn = getTargetColumn(TEST_USER_NAME);
    assert(targetColumn, 8);
  }

  getTargetRowTest() {
    const currentTime = new Date(2021, 9, 27, 4, 37, 30);
    const targetRow = getTargetRow(currentTime);
    assert(targetRow, 339)
  }

  recordExerciseTimeTest() {
    recordExerciseTime("!운동기록", TEST_USER_NAME);
  }

  finish() {
    console.log("테스트 종료");
  }
}

function TestAll() {
  const testCases = new TestCases();
  for(method of Object.getOwnPropertyNames(TestCases.prototype)) {
    if(method !== 'constructor') {
      testCases[method]();
    }
  }
}