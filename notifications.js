import { InlineKeyboard } from "grammy";
import cron from "node-cron";
import { format } from "date-fns";
import { USER_CHAT_ID } from "./config.js";
import { notifiedTasks, userStates } from "./state.js";
import { getAllProjects, getTasksByProject } from "./todoist_api.js";
import { t } from "./lngs/index.js";

// === NOTIFICATIONS ===
export async function notifyTasksWithExactTime(bot) {
  const now = new Date().getTime();
  let projects = await getAllProjects();
  if (!Array.isArray(projects)) projects = [];

  const state = userStates[USER_CHAT_ID] || { lng: 'en' };

  for (const project of projects) {
    const tasks = await getTasksByProject(project.id);

    for (const task of tasks) {
      if (task.due && task.due.date && !notifiedTasks.has(task.id) && !task.is_completed) {
        const dueDateTime = new Date(task.due.date).getTime();
        if (now >= dueDateTime && now - dueDateTime < 60000) {
          await bot.api.sendMessage(
            USER_CHAT_ID,
            t(state, 'notifications.task_time', [project.name, task.content, task.due.string]),
            {
              parse_mode: "Markdown",
              reply_markup: new InlineKeyboard()
                .text(t(state, 'common.complete'), `task:complete:${task.id}`)
                .text(t(state, 'common.view'), `task:view:${task.id}`)
            }
          );
          notifiedTasks.add(task.id);
        }
      }
    }
  }
}

export async function notifyTodayTasks(bot) {
  const todayStr = format(new Date(), "yyyy-MM-dd");
  let projects = await getAllProjects();
  if (!Array.isArray(projects)) projects = [];

  const state = userStates[USER_CHAT_ID] || { lng: 'en' };

  for (const project of projects) {
    const tasks = await getTasksByProject(project.id);

    for (const task of tasks) {
      if (task.due && task.due.date === todayStr && !task.due.datetime && !task.is_completed) {
        await bot.api.sendMessage(
          USER_CHAT_ID,
          t(state, 'notifications.task_today', [project.name, task.content]),
          {
            parse_mode: "Markdown",
            reply_markup: new InlineKeyboard()
              .text(t(state, 'common.complete'), `task:complete:${task.id}`)
              .text(t(state, 'common.view'), `task:view:${task.id}`)
          }
        );
      }
    }
  }
}

// === SCHEDULER SETUP ===
export function setupNotifications(bot) {
  // One running pass and at most one pending pass of each type. A slow
  // exact-time pass must not discard the daily notification (or grow a queue).
  const pending = new Set();
  let running = false;
  async function enqueue(type) {
    pending.add(type);
    if (running) return;
    running = true;
    try {
      while (pending.size) {
        const next = pending.values().next().value;
        pending.delete(next);
        try {
          if (next === "exact") {
            await notifyTasksWithExactTime(bot);
          } else {
            console.log("Running daily notification for tasks without exact time");
            await notifyTodayTasks(bot);
          }
        } catch (error) {
          console.error(error);
        }
      }
    } finally {
      running = false;
    }
  }

  // Run check every minute; daily at 09:00.
  setInterval(() => { enqueue("exact").catch(console.error); }, 60 * 1000);
  cron.schedule("0 9 * * *", () => { enqueue("daily").catch(console.error); });
}
