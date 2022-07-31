function doPost(e) {
  const slackEvent = getIncomingSlackEventFromAppEvent(e);
  const text = slackEvent.text;
  const userId = slackEvent.user;

  const slackAPI = new SlackAPI(SLACK_BOT_TOKEN);
  const userDisplayName = slackAPI.getDisplayNameFromUserId(userId)

  // logPostEventToSheet(e);
  logTextToSheet(text);

  if(!isRecordMessage(text)) {
    return;
  }

  recordExerciseTime(text, userDisplayName);

  slackAPI.reactWithEmoji(slackEvent);
}

function doGet(e) {
  return ContentService.createTextOutput("운동 기록!");
}

function getIncomingSlackEventFromAppEvent(e) {
  return JSON.parse(e.postData.contents).event;
}