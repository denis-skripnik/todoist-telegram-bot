# Telegram Todoist Bot

Personal Telegram bot for Todoist with a single-message UI, voice input, and AI task planning.

## Features

- Single-user bot (restricted by `TG_CHAT_ID`)
- Russian and English interface
- Single-message UX (main screens are edited in place)
- Project management: create, rename, delete
- Tag management: create, rename, delete
- Task management: create, edit, complete/reopen, delete
- Subtasks: create and browse inside task details
- Task filtering by label (all, specific label, no labels)
- Date parsing from natural text (for tasks and subtasks)
- Voice input via Groq Whisper (`message:voice`)
- AI planner with preview and confirmation flow
- Notifications:
  - exact-time tasks checked every minute
  - daily reminder at 09:00 for tasks due today without exact time

## Requirements

- Node.js 18+
- npm
- Telegram bot token (from [@BotFather](https://t.me/BotFather))
- Todoist API token
- Your Telegram chat ID
- AI provider credentials for an OpenAI-compatible Chat Completions endpoint:
  - `AI_URL`
  - `AI_API_KEY`
  - `AI_MODEL`
- Optional for voice input:
  - `GROQ_API_KEY`
  - `PROXY_URL` (if needed in your region)

## Installation

```bash
git clone <repository-url>
cd todoist-telegram-bot
npm install
```

## Configuration

1. Create `.env` from `.env.example`.

```bash
cp .env.example .env
```

2. Fill values in `.env`.

Required base config:

- `BOT_API_KEY` - Telegram bot token
- `TG_CHAT_ID` - your personal chat ID
- `TODOIST_API_TOKEN` - Todoist API token

Required AI config:

- `AI_URL` - OpenAI-compatible endpoint (example: OpenRouter chat completions URL)
- `AI_API_KEY` - AI provider API key
- `AI_MODEL` - model identifier

Optional voice config:

- `GROQ_API_KEY` - required only for voice transcription
- `PROXY_URL` - optional proxy URL (HTTP/HTTPS/SOCKS5)

Examples:

```env
AI_URL="https://openrouter.ai/api/v1/chat/completions"
AI_API_KEY="your_ai_api_key_here"
AI_MODEL="z-ai/glm-4.6:exacto"

# Optional voice transcription:
GROQ_API_KEY="your_groq_api_key_here"
PROXY_URL="http://proxy.example.com:8080"
```

Important: the bot only responds to messages from `TG_CHAT_ID`.

## Running

```bash
node todoist.js
```

## Commands

- `/start` - initialize bot and open main menu
- `/tasks` - open tasks section directly

## AI Planner

AI planner works in two ways:

1. Through the `AI` button in main menu.
2. By activation phrases in text messages (for example: `plan for week`, `plan for month`, `create task`, `план на неделю`, `план на месяц`, `создай задачу`).

Flow in AI menu:

1. Select target project.
2. Send prompt (single task, weekly plan, or monthly plan).
3. Bot generates structured plan and sends preview.
4. Confirm or cancel creation.

Notes:

- AI config must be complete (`AI_URL`, `AI_API_KEY`, `AI_MODEL`).
- The bot requests a JSON plan, resolves due dates/labels, then executes task/subtask creation.
- Final output includes an execution report with counts and errors.

## Voice Input

Voice messages are supported when bot is waiting for text input (create/edit task, create subtask, edit due date).

- Audio is transcribed with Groq Whisper (`whisper-large-v3`).
- Recognized text is passed into the same text handlers as normal input.
- If Groq access is blocked, set `PROXY_URL`.

## Notifications

- Exact due time: checked every minute.
- Daily reminder: runs at `09:00` server local time for tasks due today without exact time.

## File Structure

```text
todoist-telegram-bot/
├── todoist.js          # Main entry point and Telegram handlers
├── ai_planner.js       # AI planning, schema validation, execution/report
├── config.js           # Environment config
├── state.js            # State loading/saving/migration
├── todoist_api.js      # Todoist API helpers
├── screens.js          # UI rendering and inline keyboards
├── notifications.js    # Scheduled notifications
├── lngs/               # i18n
│   ├── index.js
│   ├── ru.js
│   └── en.js
├── .env.example
├── package.json
└── state.json          # Auto-generated runtime state
```

## Troubleshooting

### Bot does not respond

- Check `TG_CHAT_ID` in `.env`.
- Check `BOT_API_KEY`.
- Make sure process is running.

### AI does not work

- Verify `AI_URL`, `AI_API_KEY`, `AI_MODEL`.
- If preview has no tasks/subtasks, clarify prompt.
- If provider returns schema errors, retry with a more explicit request.

### Voice transcription fails

- Verify `GROQ_API_KEY`.
- If region/network blocks Groq, configure `PROXY_URL`.

### Old buttons stop working

- Send `/start` to refresh active UI message and callbacks.

## Security

Never commit `.env`.

Keep private:

- `BOT_API_KEY`
- `TG_CHAT_ID`
- `TODOIST_API_TOKEN`
- `AI_API_KEY`
- `GROQ_API_KEY`

## Dependencies

- `grammy`
- `@doist/todoist-api-typescript`
- `axios`
- `chrono-node`
- `date-fns`
- `node-cron`
- `groq-sdk`
- `https-proxy-agent`
- `dotenv`
