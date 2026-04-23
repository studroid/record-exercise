const EVENT_CACHE_TTL_SEC = 300;
const DEBOUNCE_LOCK_TTL_SEC = 10;
const DEBOUNCE_DELAY_MS = 3000;

function doPost(e) {
  const appEvent = getAppEventBodyAsObject(e);
  if (appEvent.type === "url_verification") {
    return ContentService.createTextOutput(appEvent.challenge);
  }

  const slackEvent = appEvent.event;
  if (!slackEvent || slackEvent.bot_id) {
    return;
  }

  const cache = CacheService.getScriptCache();

  const eventKey = "evt:" + appEvent.event_id;
  if (cache.get(eventKey)) {
    return;
  }
  cache.put(eventKey, "1", EVENT_CACHE_TTL_SEC);

  const threadRoot = slackEvent.thread_ts || slackEvent.ts;
  const slackAPI = new SlackAPI(SLACK_BOT_TOKEN);

  let threadMessages = [];
  if (slackEvent.thread_ts) {
    try {
      threadMessages = slackAPI.getThreadMessages(slackEvent.channel, threadRoot);
    } catch (err) {
      console.error("getThreadMessages failed: " + err);
      threadMessages = [];
    }
  }

  const triggered = slackEvent.thread_ts
    ? isTriggeredThread(threadMessages)
    : isRespondTarget(slackEvent.text);
  if (!triggered) {
    return;
  }

  const lockKey = "lock:" + threadRoot;
  cache.put(lockKey, slackEvent.ts, DEBOUNCE_LOCK_TTL_SEC);
  Utilities.sleep(DEBOUNCE_DELAY_MS);
  if (cache.get(lockKey) !== slackEvent.ts) {
    return;
  }

  logTextToSheet(slackEvent.text);
  slackAPI.reactWithEmoji(slackEvent);

  const contents = buildGeminiContents(threadMessages, slackEvent.text);
  const geminiAPI = new GeminiAPI(GEMINI_API_KEY, GEMINI_MODEL);

  let replyText = null;
  try {
    replyText = geminiAPI.generate(PERSONA_PROMPT, contents);
  } catch (err) {
    console.error("Gemini generate failed: " + err);
  }

  if (replyText) {
    slackAPI.postThreadMessage(slackEvent.channel, threadRoot, replyText);
  }
}

function doGet(e) {
  return ContentService.createTextOutput("제임스 인사봇!");
}

function getAppEventBodyAsObject(e) {
  return JSON.parse(e.postData.contents);
}
