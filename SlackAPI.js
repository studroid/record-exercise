class SlackAPI {
  constructor(botToken) {
    this.botToken = botToken;
  }

  getDisplayNameFromUserId(userId) {
    const cache = CacheService.getScriptCache();
    const cacheKey = "user:" + userId;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const payload = {
      'token': this.botToken,
      'user': userId,
    };
    const response = this._callAPI("get", "users.info", payload);
    if (!response || !response.user) return null;

    const profile = response.user.profile || {};
    const name = profile.display_name || response.user.real_name || null;
    if (name) {
      cache.put(cacheKey, name, 3600);
    }
    return name;
  }

  postThreadMessage(channel, threadTs, text) {
    const payload = {
      'token': this.botToken,
      'channel': channel,
      'thread_ts': threadTs,
      'text': text,
    };

    this._callAPI("post", "chat.postMessage", payload);
  }

  getThreadMessages(channel, threadTs) {
    const payload = {
      'token': this.botToken,
      'channel': channel,
      'ts': threadTs,
    };

    const response = this._callAPI("get", "conversations.replies", payload);
    return (response && response.messages) ? response.messages : [];
  }

  reactWithEmoji(slackEvent) {
    const payload = {
      'token': this.botToken,
      'channel': slackEvent.channel,
      'timestamp': slackEvent.ts,
      'name': "heavy_check_mark"
    };

    this._callAPI("post", "reactions.add", payload);
  }

  _callAPI(httpMethod, apiMethod, payload) {
    const option = {
      'method': httpMethod,
      'payload': payload
    };

    const response = UrlFetchApp.fetch("https://slack.com/api/" + apiMethod, option);
    return JSON.parse(response.getContentText());
  }
}
