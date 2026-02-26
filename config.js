import "dotenv/config";

// === Environment Variables ===
export const TELEGRAM_BOT_TOKEN = process.env.BOT_API_KEY;
export const TODOIST_API_TOKEN = process.env.TODOIST_API_TOKEN;
export const USER_CHAT_ID = Number(process.env.TG_CHAT_ID);
export const GROQ_API_KEY = process.env.GROQ_API_KEY
export const PROXY_URL = process.env.PROXY_URL;
export const AI_URL = process.env.AI_URL || process.env.ai_url || "";
export const AI_API_KEY = process.env.AI_API_KEY || process.env.ai_api_key || "";
export const AI_MODEL = process.env.AI_MODEL || process.env.ai_model || "";

// === UI Configuration ===
export const TASKS_PER_PAGE = 5;
export const MAX_TASK_PREVIEW_LENGTH = 80;
export const LABEL_FILTER_ALL = "all";
export const LABEL_FILTER_NONE = "none";
