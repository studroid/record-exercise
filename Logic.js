const TRIGGER_KEYWORD = "제임스!";

function isRespondTarget(text) {
  return typeof text === "string" && text.startsWith(TRIGGER_KEYWORD);
}

function isTriggeredThread(threadMessages) {
  if (!threadMessages || threadMessages.length === 0) {
    return false;
  }
  return isRespondTarget(threadMessages[0].text);
}

function buildGeminiContents(threadMessages, fallbackText) {
  if (!threadMessages || threadMessages.length === 0) {
    return [{ role: "user", parts: [{ text: fallbackText }] }];
  }
  return threadMessages.map(function (msg) {
    const role = msg.bot_id ? "model" : "user";
    return { role: role, parts: [{ text: msg.text }] };
  });
}
