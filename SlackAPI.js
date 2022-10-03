class SlackAPI {
  constructor(botToken) {
    this.botToken = botToken;
  }

  getDisplayNameFromUserId(userId) {
    const payload = {
      'token': this.botToken,
      'user': userId,
    };

    const user = this._callAPI("get", "users.info", payload).user;
    return user.profile.display_name === "" ? user.real_name : user.profile.display_name;
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
  