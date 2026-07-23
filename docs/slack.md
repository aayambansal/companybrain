# Slack bot

Ask your company brain from Slack with a `/brain` slash command. Answers come back grounded in
your indexed knowledge, with sources.

## Setup

1. Create a Slack app at https://api.slack.com/apps.
2. Under **Basic Information**, copy the **Signing Secret** and set it on the API:
   ```
   SLACK_SIGNING_SECRET=your-signing-secret
   ```
   (restart the API so it picks it up).
3. Under **Slash Commands**, create a command:
   - Command: `/brain`
   - Request URL: `https://your-companybrain-host/v1/integrations/slack/command`
   - Short description: `Ask the company brain`
4. Install the app to your workspace.

## Use

```
/brain how do we cut a release?
```

The bot searches your memory, generates an answer with the configured LLM (or an extractive
answer if none), and replies in the channel with a **Sources** list.

## Notes

- The endpoint is public but authenticated by Slack's request signature (HMAC over the raw
  body), with replay protection. No API key is needed.
- Answers use the default workspace. This targets single-user self-host; multi-workspace Slack
  routing is a future addition.
- Slack expects a reply within 3 seconds. A fast/extractive answer is fine inline; for slow LLMs
  you may want to move to the `response_url` delayed-response pattern.
