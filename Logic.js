const TRIGGER_KEYWORD = "제임스!";
const MUTE_COMMAND = "제임스 그만해!";
const UNMUTE_COMMAND = "제임스 다시 시작해!";

function isRespondTarget(text) {
  return typeof text === "string" && text.startsWith(TRIGGER_KEYWORD);
}

function isMuteCommand(text) {
  return typeof text === "string" && text.startsWith(MUTE_COMMAND);
}

function isUnmuteCommand(text) {
  return typeof text === "string" && text.startsWith(UNMUTE_COMMAND);
}

function isThreadMuted(threadMessages) {
  if (!threadMessages || threadMessages.length === 0) return false;
  let muted = false;
  for (let i = 0; i < threadMessages.length; i++) {
    const msg = threadMessages[i];
    if (msg.bot_id) continue;
    if (isMuteCommand(msg.text)) muted = true;
    else if (isUnmuteCommand(msg.text)) muted = false;
  }
  return muted;
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

const GEMINI_FAILURE_MESSAGES = {
  rate_limit:
    "크흠... Gemini 호출 한도를 다 썼습니다. 잠시 후 다시 여쭤 주시죠 ^^",
  api_error:
    "음... Gemini 쪽에서 오류가 반환됐습니다. 잠시 후 다시 한 번 부탁드립니닷",
  bad_response:
    "흠, 응답을 제대로 뽑아내지 못했습니닷. 질문을 살짝 바꿔 다시 여쭤봐 주시죠 ^^",
  network:
    "네트워크 호출이 실패했습니닷. 잠시 후 다시 시도 부탁드립니다",
  unknown:
    "알 수 없는 이유로 응답이 막혔습니닷. 잠시 후 다시 시도 부탁드립니다",
};

function pickFailureMessage(reason) {
  return GEMINI_FAILURE_MESSAGES[reason] || GEMINI_FAILURE_MESSAGES.unknown;
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
