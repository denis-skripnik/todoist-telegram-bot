import "dotenv/config";

// === Environment Variables ===
export const TELEGRAM_BOT_TOKEN = process.env.BOT_API_KEY;
export const TODOIST_API_TOKEN = process.env.TODOIST_API_TOKEN;
export const USER_CHAT_ID = Number(process.env.TG_CHAT_ID);

// === UI Configuration ===
export const TASKS_PER_PAGE = 5;
export const MAX_TASK_PREVIEW_LENGTH = 80;
export const LABEL_FILTER_ALL = "all";
export const LABEL_FILTER_NONE = "none";
