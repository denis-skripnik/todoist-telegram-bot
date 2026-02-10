# Telegram Todoist Bot

A personal Telegram bot for managing Todoist tasks with a clean single-message interface. Designed for single-user use with comprehensive task, project, and tag management capabilities.

## Features

- **Multi-language Support** - Full support for Russian and English languages
- **Language Selection** - Choose your preferred language on first start, change it anytime via menu
- **Single-message UX** - All interactions happen in one message that updates dynamically, keeping your chat clean
- **Project Management** - Create, rename, and delete Todoist projects (supports up to 5 projects on Todoist Free plan)
- **Task Management** - Add, complete, reopen, delete tasks, edit task content and due dates
- **Tag Management** - Create, rename, and delete labels/tags for task organization
- **Task Filtering** - Filter tasks by tags (all tasks, specific tag, or tasks without tags)
- **Subtasks Support** - View and create subtasks inside task details
- **Smart Notifications** - Automatic notifications for tasks with due times (checked every minute) and daily reminders at 9:00 AM for tasks without specific times
- **Natural Language Dates** - Parse dates in various formats (e.g., "tomorrow at 15:00", "25.12.2026")
- **Pagination** - Browse tasks in pages (5 tasks per page)

## Requirements

- Node.js (with ES modules support)
- npm
- Telegram Bot Token (from [@BotFather](https://t.me/BotFather))
- Todoist API Token
- Your Telegram Chat ID

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd todoist
```

2. Install dependencies:
```bash
npm install
```

## Configuration

1. Create a `.env` file in the project root based on `.env.example`:
```bash
cp .env.example .env
```

2. Fill in your credentials in the `.env` file:
   - `BOT_API_KEY` - Get from [@BotFather](https://t.me/BotFather) on Telegram
   - `TG_CHAT_ID` - Your personal Telegram chat ID (you can get it from [@userinfobot](https://t.me/userinfobot))
   - `TODOIST_API_TOKEN` - Get from Todoist Settings → Integrations → Developer

**Important:** The bot is restricted to work only with the chat ID specified in `TG_CHAT_ID`. This is a single-user bot for personal use.

## Running

Start the bot:
```bash
node todoist.js
```

The bot will start and display "Bot started" in the console. Keep the process running to receive notifications.

## File Structure

```
todoist/
├── todoist.js           # Main entry point, bot initialization and handlers
├── config.js            # Configuration and environment variables
├── state.js             # User state management and persistence
├── todoist_api.js       # Todoist API wrapper functions
├── screens.js           # UI rendering and screen management
├── notifications.js     # Task notification system
├── lngs/                # Internationalization (i18n)
│   ├── index.js         # Translation helper function
│   ├── ru.js            # Russian translations
│   └── en.js            # English translations
├── package.json         # Dependencies and project metadata
├── .env                 # Environment variables (not in git)
└── state.json          # Persistent state storage (auto-generated)
```

## Usage

### First Start

When you first run `/start`, the bot will ask you to select your preferred language (Russian or English). Your choice will be saved and used for all future interactions.

### Basic Commands

- `/start` - Initialize the bot and show main menu (or language selection if not set)
- `/tasks` - Quick access to tasks view

### Navigation

The bot uses an interactive button-based interface. After starting with `/start`, you can:

1. **📋 Projects / Проекты** - Manage Todoist projects
   - View all projects
   - Create new projects (up to 5 on free plan)
   - Rename or delete existing projects

2. **🏷️ Tags / Теги** - Manage labels
   - View all labels/tags
   - Create new tags
   - Rename or delete existing tags

3. **✅ Tasks / Задачи** - Manage tasks
   - Select a project
   - Filter by tag (all, specific tag, or no tags)
   - View task list with pagination
   - Add new tasks with natural language dates
   - Complete, reopen, edit, or delete tasks
   - Manage task tags

4. **🌐 Language / Язык** - Change interface language
   - Switch between Russian and English
   - Language preference is saved in `state.json`

### Adding Tasks with Dates

When adding a task, you can include dates in various formats:

- `Buy milk tomorrow at 15:00`
- `Meeting 25.12.2026 10:30`
- `Call John next Monday`

The bot will automatically parse and extract the date from your task description.

## Language

The bot supports two languages:
- **English (EN)** - Full interface in English
- **Russian (RU)** - Full interface in Russian

Your language preference is saved in state.json and persists across bot restarts. You can change the language at any time by selecting **🌐 Language / Язык** from the main menu.

## Troubleshooting

### Bot doesn't respond
- **Check TG_CHAT_ID**: Make sure the `TG_CHAT_ID` in your `.env` file matches your actual Telegram chat ID. The bot will ignore messages from other users.
- **Verify bot token**: Ensure `BOT_API_KEY` is correct and the bot is not stopped in BotFather.

### "Invalid callback_data" errors
- This usually happens when the bot restarts and old messages have outdated button data. Send `/start` to reinitialize the interface with the current session.

### Todoist API errors
- **Invalid token**: Check that `TODOIST_API_TOKEN` is correct in your [`.env`](.env:1) file.
- **Project limit reached**: Todoist Free plan allows only 5 projects. Delete an existing project before creating a new one.
- **Rate limiting**: If you make too many requests quickly, Todoist API may temporarily rate limit your requests.

### Notifications not working
- Ensure the bot process is running continuously (not just when you interact with it).
- Check that tasks have proper due dates set.
- Notifications for tasks with specific times are checked every minute.
- Daily notifications for tasks without times are sent at 9:00 AM.

### about subtasks
subtasks are shown only in task detail and are not displayed in the general task list of the project.

## Security Note

**Important:** Never commit your `.env` file to version control. It contains sensitive tokens and credentials.

- Keep your `BOT_API_KEY`, `TG_CHAT_ID`, and `TODOIST_API_TOKEN` private
- The `.env` file is already included in `.gitignore`
- Only share `.env.example` as a template

## Dependencies

- `grammy` - Telegram Bot framework
- `@doist/todoist-api-typescript` - Official Todoist API client
- `chrono-node` - Natural language date parser
- `node-cron` - Task scheduler for notifications
- `date-fns` - Date formatting utilities
- `axios` - HTTP client for Todoist Sync API
- `dotenv` - Environment variable management
