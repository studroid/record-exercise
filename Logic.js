const TRIGGER_KEYWORD = "제임스!";
const REPLY_TEXT = "안녕?";

function isRespondTarget(text) {
  return text.startsWith(TRIGGER_KEYWORD);
}
