class GeminiAPI {
  constructor(apiKey, model) {
    this.apiKey = apiKey;
    this.model = model;
  }

  generate(systemInstruction, contents) {
    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/" +
      encodeURIComponent(this.model) +
      ":generateContent?key=" +
      encodeURIComponent(this.apiKey);

    const body = {
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
      contents: contents,
    };

    const option = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(body),
      muteHttpExceptions: true,
    };

    const response = UrlFetchApp.fetch(url, option);
    const code = response.getResponseCode();
    const text = response.getContentText();

    if (code === 429) {
      console.error("Gemini rate limit (429): " + text);
      return { ok: false, reason: "rate_limit" };
    }
    if (code < 200 || code >= 300) {
      console.error("Gemini API error " + code + ": " + text);
      return { ok: false, reason: "api_error" };
    }

    const parsed = JSON.parse(text);
    const candidate = parsed && parsed.candidates && parsed.candidates[0];
    const part = candidate && candidate.content && candidate.content.parts && candidate.content.parts[0];
    if (!part || typeof part.text !== "string") {
      console.error("Gemini unexpected response: " + text);
      return { ok: false, reason: "bad_response" };
    }
    return { ok: true, text: part.text };
  }
}
