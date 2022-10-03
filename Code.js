function doPost(e) {
  const appEvent = getAppEventBodyAsObject(e);
  if(appEvent.type === "url_verification") {
    return ContentService.createTextOutput(appEvent.challenge);
  }

  const slackEvent = appEvent.event;
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

function getAppEventBodyAsObject(e) {
  return JSON.parse(e.postData.contents);
}