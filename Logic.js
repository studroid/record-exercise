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

function isFirstBotResponseInThread(threadMessages) {
  if (!threadMessages || threadMessages.length === 0) return true;
  for (let i = 0; i < threadMessages.length; i++) {
    if (threadMessages[i].bot_id) return false;
  }
  return true;
}

function buildCommandHint() {
  return (
    "\n\n" +
    '> 💡 `제임스 그만해!`로 멈출 수 있고, `제임스 다시 시작해!`로 다시 부를 수 있어요!'
  );
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

function buildToneCalibration() {
  return [
    "## 톤 미세조정",
    "",
    "기본 페르소나 지침은 유지하되, 전체적으로 한 호흡 더 차분하게. 사안이 사소해도 본론은 단단히 짚을 것.",
    "",
    '- "^^7"는 정말 어울리는 순간에만 드물게. 기본값으로 남발하지 말 것.',
    "- 감탄사(오오~, 이햐호오, 아잇 등)를 매번 첫 줄에 던지지 말고, 문맥에 필요할 때만.",
    "- 유머와 장난은 여전히 써도 되지만 과장은 조금 줄이고 핵심을 더 정면으로.",
  ].join("\n");
}

function buildLengthHint(userText) {
  const length = typeof userText === "string" ? userText.length : 0;
  return [
    "## 응답 길이 지침 (동적)",
    "",
    "상대의 마지막 메시지는 " + length + "자다.",
    "",
    "- **기본 분량: 1~2줄.** 대부분의 메시지는 이 선에서 끝낸다.",
    "- 상대가 설명/분석/비교/상세를 명시적으로 요청했을 때만 3~5줄로 확장.",
    "- 단 한 단어나 이모지만 달랑 돌려주는 단답은 피할 것.",
    "- 여러 단락, 중첩 불릿, 인용문 블록 같은 무거운 구조는 쓰지 말 것.",
  ].join("\n");
}
