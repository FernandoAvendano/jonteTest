import express from 'express';

const app = express();
app.use(express.json());

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_BOT_USER_ID = process.env.SLACK_BOT_USER_ID;

if (!SLACK_BOT_TOKEN) {
  console.warn('[Slack Events] Missing SLACK_BOT_TOKEN env variable. Outbound replies will fail.');
}

async function postSlackMessage(payload) {
  if (!SLACK_BOT_TOKEN) return;
  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`
    },
    body: JSON.stringify(payload)
  });
  const json = await res.json();
  if (!json.ok) {
    console.error('[Slack Events] chat.postMessage error', json);
  }
  return json;
}

async function handleSlackEvent(event) {
  if (!event) return;
  if (event.type !== 'message' || event.subtype) {
    console.log('[Slack Event] Ignored type/subtype', event.type, event.subtype);
    return;
  }
  if (event.bot_id || (SLACK_BOT_USER_ID && event.user === SLACK_BOT_USER_ID)) {
    return;
  }

  const channel = event.channel;
  const text = event.text || '(tomt meddelande)';
  const thread_ts = event.thread_ts || event.ts;
  const ack = `Jag såg: ${text}\n\nSvarar parad i den här tråden.`;

  await postSlackMessage({ channel, text: ack, thread_ts });
}

app.post('/slack/events', (req, res) => {
  const { type, challenge, event } = req.body || {};
  if (type === 'url_verification' && challenge) {
    return res.status(200).send(challenge);
  }
  res.status(200).send('OK');
  if (type === 'event_callback') {
    handleSlackEvent(event).catch((err) => console.error('[Slack Events] handler failed', err));
  }
});

app.get('/slack/events', (_req, res) => {
  res.status(200).send('Slack events endpoint is online.');
});

const PORT = process.env.SLACK_EVENTS_PORT || 4390;
app.listen(PORT, () => {
  console.log(`Slack events server listening on port ${PORT}`);
});
