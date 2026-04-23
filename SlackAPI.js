class SlackAPI {
  constructor(botToken) {
    this.botToken = botToken;
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
