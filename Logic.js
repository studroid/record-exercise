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

function buildLengthHint(userText) {
  const length = typeof userText === "string" ? userText.length : 0;
  let band;
  if (length <= 20) {
    band = '한 줄 이내의 단답 또는 이모티콘 한 방 ("^^", "ㅇㅈ", "오오~" 같은 수준)';
  } else if (length <= 100) {
    band = "2~4줄 이내로 간결하게";
  } else if (length <= 300) {
    band = "핵심만 잡아 중간 길이로. 문장 4~8줄 수준";
  } else {
    band = "구조화해서 충실히. 단 유머 한두 방 반드시 박아 넣을 것";
  }
  return [
    "## 응답 길이 지침 (동적)",
    "",
    "상대의 마지막 메시지는 " + length + "자다.",
    "응답은 이 길이에 맞춰라: " + band + ".",
    "절대 매번 비슷한 분량으로 답하지 말 것. 짧은 말엔 짧게, 긴 말엔 길게.",
  ].join("\n");
}
