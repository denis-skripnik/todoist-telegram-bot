// Test-only resolution: never load a developer or production config/credentials.
const fixture = `
export const TELEGRAM_BOT_TOKEN = '123:fake', TODOIST_API_TOKEN = 'fake', USER_CHAT_ID = 42,
GROQ_API_KEY = 'fake', PROXY_URL = '', TASKS_PER_PAGE = 5, MAX_TASK_PREVIEW_LENGTH = 100,
LABEL_FILTER_ALL = 'all', LABEL_FILTER_NONE = 'none', AI_URL = '', AI_API_KEY = '', AI_MODEL = '';
`;
export async function resolve(specifier, context, nextResolve) {
  if (specifier === './config.js') {
    return { url: `data:text/javascript,${encodeURIComponent(fixture)}`, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
