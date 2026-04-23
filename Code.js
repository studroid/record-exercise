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
