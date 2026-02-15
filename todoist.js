import { Bot, InlineKeyboard } from "grammy";
import * as chrono from "chrono-node";
import { TELEGRAM_BOT_TOKEN, TODOIST_API_TOKEN, USER_CHAT_ID, GROQ_API_KEY, PROXY_URL, TASKS_PER_PAGE, MAX_TASK_PREVIEW_LENGTH, LABEL_FILTER_ALL, LABEL_FILTER_NONE } from "./config.js";
import { userStates, notifiedTasks, loadState, migrateState, saveState } from "./state.js";
import { todoist, getCompletedTasks, getAllProjects, getTasksByProject, addTask, deleteTask, completeTask, reopenTask, createProject, updateProject, deleteProject, getAllLabels, createLabel, updateLabel, deleteLabel, getTasksByProjectAndLabel, updateTaskLabels, updateTaskContent, updateTaskDue, getTask, getSubtasks, createSubtask } from "./todoist_api.js";
import { renderLanguageSelectionScreen, renderMainMenu, renderProjectsScreen, renderProjectActionsScreen, renderTagsScreen, renderTagActionsScreen, renderProjectSelectionScreen, renderLabelFilterScreen, renderTaskListScreen, renderTaskDetailScreen, renderTaskLabelsPickerScreen, renderConfirmDialog, updateScreen } from "./screens.js";
import { setupNotifications } from "./notifications.js";
import { t } from "./lngs/index.js";
import fs from "fs";
import Groq from "groq-sdk";
import path from "path";
import { HttpsProxyAgent } from "https-proxy-agent";

const bot = new Bot(TELEGRAM_BOT_TOKEN);
const groq = new Groq({
  apiKey: GROQ_API_KEY || "",
  ...(PROXY_URL && { httpAgent: new HttpsProxyAgent(PROXY_URL) }),
});

// === State initialization ===
loadState();
migrateState();
process.on("SIGINT", () => { saveState(); process.exit(); });
process.on("SIGTERM", () => { saveState(); process.exit(); });
setInterval(saveState, 60 * 1000);

async function downloadTelegramFile(botToken, filePath, localPath) {
  const url = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download Telegram file: ${res.status} ${res.statusText}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
await fs.promises.mkdir(path.dirname(localPath), { recursive: true });
  await fs.promises.writeFile(localPath, buffer);
}

// === COMMAND HANDLERS ===
bot.command("start", async (ctx) => {
  if (ctx.chat.id !== USER_CHAT_ID) return;
  
  // Initialize user state
  if (!userStates[ctx.chat.id]) {
    userStates[ctx.chat.id] = {
      lng: null,
      activeMessageId: null,
      screen: {
        type: "language_select",
        projectId: null,
        labelFilter: null,
        taskId: null,
        page: 0,
        showCompleted: false,
        parentId: null,
        subtaskPage: 0,
        confirmAction: null,
        beforeConfirm: null
      },
      mode: null,
      tempData: null
    };
  }
  
  const state = userStates[ctx.chat.id];
  
  // Show language selection if not set
  if (!state.lng) {
    state.screen.type = "language_select";
    const screen = renderLanguageSelectionScreen(state);
    state.activeMessageId = null;
    await updateScreen(ctx, ctx.chat.id, screen);
  } else {
    state.screen.type = "main_menu";
    const screen = renderMainMenu(state);
    state.activeMessageId = null;
    await updateScreen(ctx, ctx.chat.id, screen);
  }
});

bot.command("tasks", async (ctx) => {
  if (ctx.chat.id !== USER_CHAT_ID) return;
  
  // Initialize or update state
  if (!userStates[ctx.chat.id]) {
    userStates[ctx.chat.id] = {
      lng: 'en',
      activeMessageId: null,
      screen: {
        type: "project_selection",
        projectId: null,
        labelFilter: null,
        taskId: null,
        page: 0,
        showCompleted: false,
        parentId: null,
        confirmAction: null,
        beforeConfirm: null
      },
      mode: null,
      tempData: null
    };
  } else {
    userStates[ctx.chat.id].screen.type = "project_selection";
  }
  
  const state = userStates[ctx.chat.id];
  const screen = await renderProjectSelectionScreen(state);
  await updateScreen(ctx, ctx.chat.id, screen);
});

// === CALLBACK QUERY HANDLER ===
bot.on("callback_query:data", async (ctx) => {
  if (ctx.chat?.id !== USER_CHAT_ID) {
    await ctx.answerCallbackQuery({ text: t({ lng: 'en' }, 'errors.no_access') });
    return;
  }
  
  const data = ctx.callbackQuery.data;
  const chatId = ctx.chat.id;
  
  // Ensure state exists
  if (!userStates[chatId]) {
    userStates[chatId] = {
      lng: 'en',
      activeMessageId: ctx.callbackQuery.message.message_id,
      screen: { type: "main_menu", projectId: null, labelFilter: null, taskId: null, page: 0, showCompleted: false, parentId: null, confirmAction: null, beforeConfirm: null },
      mode: null,
      tempData: null
    };
  }
  
  const state = userStates[chatId];
  
  // Update activeMessageId to the message where button was clicked
  if (ctx.callbackQuery.message?.message_id) {
    state.activeMessageId = ctx.callbackQuery.message.message_id;
  }
  
  // === LANGUAGE SELECTION ===
  if (data.startsWith("lng:set:")) {
    const lng = data.split(":")[2];
    state.lng = lng;
    state.screen.type = "main_menu";
    state.tempData = null;
    const screen = renderMainMenu(state);
    await updateScreen(ctx, chatId, screen);
    await ctx.answerCallbackQuery();
    return;
  }
  
  if (data === "settings:language") {
    state.screen.type = "language_select";
    state.tempData = { returnTo: "main_menu" };
    const screen = renderLanguageSelectionScreen(state);
    await updateScreen(ctx, chatId, screen);
    await ctx.answerCallbackQuery();
    return;
  }
  
  if (data === "language:back") {
    state.screen.type = "main_menu";
    state.tempData = null;
    const screen = renderMainMenu(state);
    await updateScreen(ctx, chatId, screen);
    await ctx.answerCallbackQuery();
    return;
  }
  
  // === MAIN MENU ===
  if (data === "menu:main") {
    state.screen.type = "main_menu";
    const screen = renderMainMenu(state);
    await updateScreen(ctx, chatId, screen);
    await ctx.answerCallbackQuery();
    return;
  }
  
  if (data === "menu:projects") {
    state.screen.type = "projects";
    const screen = await renderProjectsScreen(state);
    await updateScreen(ctx, chatId, screen);
    await ctx.answerCallbackQuery();
    return;
  }
  
  if (data === "menu:tags") {
    state.screen.type = "tags";
    const screen = await renderTagsScreen(state);
    await updateScreen(ctx, chatId, screen);
    await ctx.answerCallbackQuery();
    return;
  }
  
  if (data === "menu:tasks") {
    state.screen.type = "project_selection";
    const screen = await renderProjectSelectionScreen(state);
    await updateScreen(ctx, chatId, screen);
    await ctx.answerCallbackQuery();
    return;
  }
  
  // === PROJECTS ===
  if (data.startsWith("project:view:")) {
    const projectId = data.split(":")[2];
    state.screen.projectId = projectId;
    const screen = await renderProjectActionsScreen(state, projectId);
    await updateScreen(ctx, chatId, screen);
    await ctx.answerCallbackQuery();
    return;
  }
  
  if (data === "project:create") {
    state.mode = "creating_project";
    await ctx.answerCallbackQuery({ text: t(state, 'prompts.enter_project_name') });
    await ctx.reply(t(state, 'prompts.enter_project_name_full'));
    return;
  }
  
  if (data.startsWith("project:rename:")) {
    const projectId = data.split(":")[2];
    state.mode = "renaming_project";
    state.tempData = { projectId };
    await ctx.answerCallbackQuery({ text: t(state, 'prompts.enter_new_name') });
    await ctx.reply(t(state, 'prompts.enter_new_project_name'));
    return;
  }
  
  if (data.startsWith("project:delete:")) {
    const projectId = data.split(":")[2];
    const projects = await getAllProjects();
    const project = projects.find(p => p.id === projectId);
    
    if (project) {
      state.screen.beforeConfirm = {
        type: state.screen.type,
        projectId: state.screen.projectId,
        labelFilter: state.screen.labelFilter,
        taskId: state.screen.taskId,
        page: state.screen.page,
        showCompleted: state.screen.showCompleted,
        parentId: state.screen.parentId
      };
      state.screen.confirmAction = { action: "delete_project", targetId: projectId, targetName: project.name };
      const screen = renderConfirmDialog(state, "delete_project", project.name, projectId);
      await updateScreen(ctx, chatId, screen);
    }
    await ctx.answerCallbackQuery();
    return;
  }
  
  // === TAGS (LABELS) ===
  if (data.startsWith("tag:view:")) {
    const labelId = data.split(":")[2];
    const screen = await renderTagActionsScreen(state, labelId);
    await updateScreen(ctx, chatId, screen);
    await ctx.answerCallbackQuery();
    return;
  }
  
  if (data === "tag:create") {
    state.mode = "creating_tag";
    await ctx.answerCallbackQuery({ text: t(state, 'prompts.enter_tag_name') });
    await ctx.reply(t(state, 'prompts.enter_tag_name_full'));
    return;
  }
  
  if (data.startsWith("tag:rename:")) {
    const labelId = data.split(":")[2];
    state.mode = "renaming_tag";
    state.tempData = { labelId };
    await ctx.answerCallbackQuery({ text: t(state, 'prompts.enter_new_name') });
    await ctx.reply(t(state, 'prompts.enter_new_tag_name'));
    return;
  }
  
  if (data.startsWith("tag:delete:")) {
    const labelId = data.split(":")[2];
    const labels = await getAllLabels();
    const label = labels.find(l => l.id === labelId);
    
    if (label) {
      state.screen.beforeConfirm = {
        type: state.screen.type,
        projectId: state.screen.projectId,
        labelFilter: state.screen.labelFilter,
        taskId: state.screen.taskId,
        page: state.screen.page,
        showCompleted: state.screen.showCompleted,
        parentId: state.screen.parentId
      };
      state.screen.confirmAction = { action: "delete_tag", targetId: labelId, targetName: label.name };
      const screen = renderConfirmDialog(state, "delete_tag", label.name, labelId);
      await updateScreen(ctx, chatId, screen);
    }
    await ctx.answerCallbackQuery();
    return;
  }
  
  // === TASKS ===
  if (data.startsWith("tasks:selproj:")) {
    const projectId = data.split(":")[2];
    state.screen.projectId = projectId;
    state.screen.labelFilter = LABEL_FILTER_ALL;
    const screen = await renderLabelFilterScreen(state, projectId);
    await updateScreen(ctx, chatId, screen);
    await ctx.answerCallbackQuery();
    return;
  }
  
  if (data.startsWith("tasks:filter:")) {
    const parts = data.split(":");
    const projectId = parts[2];
    let labelFilter = parts[3];
    if (labelFilter !== LABEL_FILTER_ALL && labelFilter !== LABEL_FILTER_NONE) {
      labelFilter = decodeURIComponent(labelFilter);
    }
    state.screen.projectId = projectId;
    state.screen.labelFilter = labelFilter;
    state.screen.page = 0;
    state.screen.type = "tasks";
    const screen = await renderTaskListScreen(chatId);
    await updateScreen(ctx, chatId, screen);
    await ctx.answerCallbackQuery();
    return;
  }
  
  if (data === "tasks:back") {
    state.screen.type = "project_selection";
    const screen = await renderProjectSelectionScreen(state);
    await updateScreen(ctx, chatId, screen);
    await ctx.answerCallbackQuery();
    return;
  }
  
  if (data === "tasks:list") {
    state.screen.type = "tasks";
    const screen = await renderTaskListScreen(chatId);
    await updateScreen(ctx, chatId, screen);
    await ctx.answerCallbackQuery();
    return;
  }
  
  if (data === "tasks:toggle") {
    state.screen.showCompleted = !state.screen.showCompleted;
    state.screen.page = 0;
    const screen = await renderTaskListScreen(chatId);
    await updateScreen(ctx, chatId, screen);
    await ctx.answerCallbackQuery();
    return;
  }
  
  if (data === "tasks:chfilter") {
    const screen = await renderLabelFilterScreen(state, state.screen.projectId);
    await updateScreen(ctx, chatId, screen);
    await ctx.answerCallbackQuery();
    return;
  }
  
  if (data.startsWith("tasks:page:")) {
    const page = parseInt(data.split(":")[2]);
    state.screen.page = page;
    const screen = await renderTaskListScreen(chatId);
    await updateScreen(ctx, chatId, screen);
    await ctx.answerCallbackQuery();
    return;
  }
  
  if (data === "task:add") {
    state.mode = "adding_task";
    state.tempData = { projectId: state.screen.projectId };
    await ctx.answerCallbackQuery({ text: t(state, 'prompts.enter_task_text') });
    await ctx.reply(t(state, 'prompts.enter_task_text_full'));
    return;
  }
  
  if (data.startsWith("task:view:")) {
    const taskId = data.split(":")[2];
    state.screen.taskId = taskId;
    state.screen.type = "task_detail";
    state.screen.subtaskPage = 0;
    const screen = await renderTaskDetailScreen(state, taskId);
    await updateScreen(ctx, chatId, screen);
    await ctx.answerCallbackQuery();
    return;
  }
  
  // === SUBTASK HANDLERS ===
  if (data.startsWith("subtask:add:")) {
    const parentTaskId = data.split(":")[2];
    state.mode = "adding_subtask";
    state.tempData = { parentTaskId };
    await ctx.answerCallbackQuery({ text: t(state, 'subtasks.enter_text_prompt') });
    await ctx.reply(t(state, 'subtasks.enter_text_full'));
    return;
  }
  
  if (data.startsWith("subtask:page:")) {
    const parts = data.split(":");
    const parentTaskId = parts[2];
    const page = parseInt(parts[3]);
    state.screen.subtaskPage = page;
    state.screen.taskId = parentTaskId;
    const screen = await renderTaskDetailScreen(state, parentTaskId);
    await updateScreen(ctx, chatId, screen);
    await ctx.answerCallbackQuery();
    return;
  }
  
  if (data.startsWith("task:complete:")) {
    const taskId = data.split(":")[2];
    try {
      await completeTask(taskId);
      await ctx.answerCallbackQuery({ text: t(state, 'success.task_completed') });
      const screen = await renderTaskDetailScreen(state, taskId);
      await updateScreen(ctx, chatId, screen);
    } catch (e) {
      await ctx.answerCallbackQuery({ text: t(state, 'errors.task_complete_failed') });
    }
    return;
  }
  
  if (data.startsWith("task:reopen:")) {
    const taskId = data.split(":")[2];
    try {
      await reopenTask(taskId);
      await ctx.answerCallbackQuery({ text: t(state, 'success.task_reopened') });
      const screen = await renderTaskDetailScreen(state, taskId);
      await updateScreen(ctx, chatId, screen);
    } catch (e) {
      await ctx.answerCallbackQuery({ text: t(state, 'errors.task_reopen_failed') });
    }
    return;
  }
  
  if (data.startsWith("task:delete:")) {
    const taskId = data.split(":")[2];
    const task = await getTask(taskId).catch(() => null);
    
    if (task) {
      const taskContent = task.item_object?.content ?? task.content ?? "";
      state.screen.beforeConfirm = {
        type: state.screen.type,
        projectId: state.screen.projectId,
        labelFilter: state.screen.labelFilter,
        taskId: state.screen.taskId,
        page: state.screen.page,
        showCompleted: state.screen.showCompleted,
        parentId: state.screen.parentId
      };
      state.screen.confirmAction = { action: "delete_task", targetId: taskId, targetName: taskContent };
      const screen = renderConfirmDialog(state, "delete_task", taskContent, taskId);
      await updateScreen(ctx, chatId, screen);
    }
    await ctx.answerCallbackQuery();
    return;
  }
  
  if (data.startsWith("task:editcontent:")) {
    const taskId = data.split(":")[2];
    state.mode = "editing_task_content";
    state.tempData = { taskId };
    await ctx.answerCallbackQuery({ text: t(state, 'prompts.enter_new_text') });
    await ctx.reply(t(state, 'prompts.enter_new_task_text'));
    return;
  }
  
  if (data.startsWith("task:editdue:")) {
    const taskId = data.split(":")[2];
    state.mode = "editing_task_due";
    state.tempData = { taskId };
    await ctx.answerCallbackQuery({ text: t(state, 'prompts.enter_new_due') });
    await ctx.reply(t(state, 'prompts.enter_new_due_full'));
    return;
  }
  
  if (data.startsWith("task:editlabels:")) {
    const taskId = data.split(":")[2];
    const screen = await renderTaskLabelsPickerScreen(chatId, taskId);
    await updateScreen(ctx, chatId, screen);
    await ctx.answerCallbackQuery();
    return;
  }
  
  if (data.startsWith("task:labels:toggle:")) {
    const labelName = data.substring("task:labels:toggle:".length);
    const selectedLabels = state.tempData.selectedLabels || [];
    
    if (selectedLabels.includes(labelName)) {
      state.tempData.selectedLabels = selectedLabels.filter(l => l !== labelName);
    } else {
      state.tempData.selectedLabels = [...selectedLabels, labelName];
    }
    
    const taskId = state.tempData.taskId;
    const screen = await renderTaskLabelsPickerScreen(chatId, taskId);
    await updateScreen(ctx, chatId, screen);
    await ctx.answerCallbackQuery();
    return;
  }
  
  if (data === "task:labels:save") {
    const taskId = state.tempData.taskId;
    const selectedLabels = state.tempData.selectedLabels || [];
    
    try {
      await updateTaskLabels(taskId, selectedLabels);
      state.tempData = null;
      state.screen.type = "task_detail";
      state.screen.taskId = taskId;
      const screen = await renderTaskDetailScreen(state, taskId);
      await updateScreen(ctx, chatId, screen);
      await ctx.answerCallbackQuery({ text: t(state, 'success.labels_updated') });
    } catch (e) {
      await ctx.answerCallbackQuery({ text: t(state, 'errors.labels_update_failed', e.message) });
    }
    return;
  }
  
  // === CONFIRMATIONS ===
  if (data.startsWith("confirm:delproj:")) {
    const projectId = data.split(":")[2];
    try {
      await deleteProject(projectId);
      await ctx.answerCallbackQuery({ text: t(state, 'success.project_deleted') });
      state.screen.confirmAction = null;
      state.screen.type = "projects";
      const screen = await renderProjectsScreen(state);
      await updateScreen(ctx, chatId, screen);
    } catch (e) {
      await ctx.answerCallbackQuery({ text: t(state, 'errors.deletion_failed') });
    }
    return;
  }
  
  if (data.startsWith("confirm:deltag:")) {
    const labelId = data.split(":")[2];
    try {
      await deleteLabel(labelId);
      await ctx.answerCallbackQuery({ text: t(state, 'success.tag_deleted') });
      state.screen.confirmAction = null;
      state.screen.type = "tags";
      const screen = await renderTagsScreen(state);
      await updateScreen(ctx, chatId, screen);
    } catch (e) {
      await ctx.answerCallbackQuery({ text: t(state, 'errors.deletion_failed') });
    }
    return;
  }
  
  if (data.startsWith("confirm:deltask:")) {
    const taskId = data.split(":")[2];
    try {
      await deleteTask(taskId);
      await ctx.answerCallbackQuery({ text: t(state, 'success.task_deleted') });
      state.screen.confirmAction = null;
      state.screen.type = "tasks";
      const screen = await renderTaskListScreen(chatId);
      await updateScreen(ctx, chatId, screen);
    } catch (e) {
      await ctx.answerCallbackQuery({ text: t(state, 'errors.deletion_failed') });
    }
    return;
  }
  
  if (data === "confirm:cancel") {
    await ctx.answerCallbackQuery({ text: t(state, 'success.cancelled') });
    
    if (state.screen.beforeConfirm) {
      const previousScreen = state.screen.beforeConfirm;
      state.screen.type = previousScreen.type;
      state.screen.projectId = previousScreen.projectId;
      state.screen.labelFilter = previousScreen.labelFilter;
      state.screen.taskId = previousScreen.taskId;
      state.screen.page = previousScreen.page;
      state.screen.showCompleted = previousScreen.showCompleted;
      state.screen.parentId = previousScreen.parentId;
      state.screen.confirmAction = null;
      state.screen.beforeConfirm = null;
      
      let screen;
      if (previousScreen.type === "projects") {
        screen = await renderProjectsScreen(state);
      } else if (previousScreen.type === "tags") {
        screen = await renderTagsScreen(state);
      } else if (previousScreen.type === "task_detail") {
        screen = await renderTaskDetailScreen(state, previousScreen.taskId);
      } else if (previousScreen.type === "project_selection") {
        screen = await renderProjectSelectionScreen(state);
      } else if (previousScreen.type === "tasks") {
        screen = await renderTaskListScreen(chatId);
      } else {
        screen = renderMainMenu(state);
      }
      await updateScreen(ctx, chatId, screen);
    } else {
      state.screen.confirmAction = null;
      const screen = renderMainMenu(state);
      await updateScreen(ctx, chatId, screen);
    }
    return;
  }
  
  if (data === "noop") {
    await ctx.answerCallbackQuery();
    return;
  }
  
  await ctx.answerCallbackQuery({ text: t(state, 'errors.unknown_action') });
});

async function handleModeInput(ctx, state, text) {
    const chatId = ctx.chat.id;
  
  // === CREATE PROJECT ===
  if (state.mode === "creating_project") {
    try {
      const project = await createProject(text);
      await ctx.reply(t(state, 'success.project_created', project.name), {
        reply_markup: new InlineKeyboard().text(t(state, 'common.back'), "menu:projects")
      });
      state.mode = null;
      state.screen.type = "projects";
      const screen = await renderProjectsScreen(state);
      await updateScreen(ctx, chatId, screen);
    } catch (e) {
      if (e.message === 'PROJECT_LIMIT') {
        await ctx.reply(t(state, 'errors.project_limit'));
      } else {
        await ctx.reply(t(state, 'errors.project_create_failed', e.message));
      }
    }
    return;
  }
  
  // === RENAME PROJECT ===
  if (state.mode === "renaming_project") {
    const projectId = state.tempData.projectId;
    try {
      await updateProject(projectId, text);
      await ctx.reply(t(state, 'success.project_renamed', text), {
        reply_markup: new InlineKeyboard().text(t(state, 'common.back'), "menu:projects")
      });
      state.mode = null;
      state.tempData = null;
      state.screen.type = "projects";
      const screen = await renderProjectsScreen(state);
      await updateScreen(ctx, chatId, screen);
    } catch (e) {
      await ctx.reply(t(state, 'errors.rename_failed', e.message));
    }
    return;
  }
  
  // === CREATE TAG ===
  if (state.mode === "creating_tag") {
    try {
      const label = await createLabel(text);
      await ctx.reply(t(state, 'success.tag_created', label.name), {
        reply_markup: new InlineKeyboard().text(t(state, 'common.back'), "menu:tags")
      });
      state.mode = null;
      state.screen.type = "tags";
      const screen = await renderTagsScreen(state);
      await updateScreen(ctx, chatId, screen);
    } catch (e) {
      await ctx.reply(t(state, 'errors.tag_create_failed', e.message));
    }
    return;
  }
  
  // === RENAME TAG ===
  if (state.mode === "renaming_tag") {
    const labelId = state.tempData.labelId;
    try {
      await updateLabel(labelId, text);
      await ctx.reply(t(state, 'success.tag_renamed', text), {
        reply_markup: new InlineKeyboard().text(t(state, 'common.back'), "menu:tags")
      });
      state.mode = null;
      state.tempData = null;
      state.screen.type = "tags";
      const screen = await renderTagsScreen(state);
      await updateScreen(ctx, chatId, screen);
    } catch (e) {
      await ctx.reply(t(state, 'errors.rename_failed', e.message));
    }
    return;
  }
  
  // === ADD TASK ===
  if (state.mode === "adding_task") {
    const projectId = state.tempData.projectId;
    const contentRaw = text;
    
    // Parse date from text (reuse existing logic)
    const EXPLICIT_DT_RE = /\b(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})(?:\s+(\d{1,2}):(\d{2}))?\b/;
    let dueString = null;
    let content = contentRaw;
    
    const m = EXPLICIT_DT_RE.exec(contentRaw);
    if (m) {
      const [, dd, MM, yyyy, HH = "00", mm = "00"] = m;
      const dt = new Date(Number(yyyy), Number(MM) - 1, Number(dd), Number(HH), Number(mm), 0, 0);
      dueString = dt.toISOString();
      content = contentRaw.slice(0, m.index) + contentRaw.slice(m.index + m[0].length);
      content = content.trim();
    } else {
      const normalized = contentRaw.replace(/\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/g, "$1/$2/$3");
      const parsedDate = chrono.en.GB.parseDate(normalized, new Date(), { forwardDate: true });
      if (parsedDate) {
        dueString = parsedDate.toISOString();
        const results = chrono.en.GB.parse(normalized);
        if (results.length > 0) {
          const { index, text: chronoText } = results[0];
          const candidates = [chronoText, chronoText.replace(/\//g, "."), chronoText.replace(/\//g, "-")];
          let toRemove = candidates.find((t) => content.includes(t));
          if (!toRemove) {
            content = content.slice(0, index) + content.slice(index + chronoText.length);
          } else {
            content = content.replace(toRemove, "");
          }
          content = content.trim();
        }
      }
    }
    
    try {
      const created = await addTask(projectId, content || contentRaw, dueString, null);
      const keyboard = new InlineKeyboard();
      if (created && created.id) {
        keyboard.text(t(state, 'tasks.go_to_task'), `task:view:${created.id}`).row();
      }
      keyboard.text(t(state, 'common.back'), "tasks:list");
      
      await ctx.reply(t(state, 'success.task_added', [content || contentRaw, dueString]), {
        reply_markup: keyboard
      });
      state.mode = null;
      state.tempData = null;
      state.screen.type = "tasks";
      const screen = await renderTaskListScreen(chatId);
      await updateScreen(ctx, chatId, screen);
    } catch (e) {
      await ctx.reply(t(state, 'errors.task_add_failed', e.message));
    }
    return;
  }
  
  // === ADD SUBTASK ===
  if (state.mode === "adding_subtask") {
    const parentTaskId = state.tempData.parentTaskId;
    const contentRaw = text;
    
    // Reuse existing date parsing logic
    const EXPLICIT_DT_RE = /\b(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})(?:\s+(\d{1,2}):(\d{2}))?\b/;
    let dueString = null;
    let content = contentRaw;
    
    const m = EXPLICIT_DT_RE.exec(contentRaw);
    if (m) {
      const [, dd, MM, yyyy, HH = "00", mm = "00"] = m;
      const dt = new Date(Number(yyyy), Number(MM) - 1, Number(dd), Number(HH), Number(mm), 0, 0);
      dueString = dt.toISOString();
      content = contentRaw.slice(0, m.index) + contentRaw.slice(m.index + m[0].length);
      content = content.trim();
    } else {
      const normalized = contentRaw.replace(/\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/g, "$1/$2/$3");
      const parsedDate = chrono.en.GB.parseDate(normalized, new Date(), { forwardDate: true });
      if (parsedDate) {
        dueString = parsedDate.toISOString();
        const results = chrono.en.GB.parse(normalized);
        if (results.length > 0) {
          const { index, text: chronoText } = results[0];
          const candidates = [chronoText, chronoText.replace(/\//g, "."), chronoText.replace(/\//g, "-")];
          let toRemove = candidates.find((t) => content.includes(t));
          if (!toRemove) {
            content = content.slice(0, index) + content.slice(index + chronoText.length);
          } else {
            content = content.replace(toRemove, "");
          }
          content = content.trim();
        }
      }
    }
    
    try {
      const created = await createSubtask(parentTaskId, content || contentRaw, dueString);
      const keyboard = new InlineKeyboard();
      if (created && created.id) {
        keyboard.text(t(state, 'subtasks.go_to_subtask'), `task:view:${created.id}`).row();
      }
      keyboard.text(t(state, 'common.back'), `task:view:${parentTaskId}`);
      
      await ctx.reply(t(state, 'subtasks.added_success', { content: content || contentRaw, due: dueString }), {
        reply_markup: keyboard
      });
      state.mode = null;
      state.tempData = null;
      state.screen.type = "task_detail";
      state.screen.taskId = parentTaskId;
      const screen = await renderTaskDetailScreen(state, parentTaskId);
      await updateScreen(ctx, chatId, screen);
    } catch (e) {
      await ctx.reply(t(state, 'subtasks.add_failed', { error: e.message }));
    }
    return;
  }
  
  // === EDIT TASK CONTENT ===
  if (state.mode === "editing_task_content") {
    const taskId = state.tempData.taskId;
    try {
      await updateTaskContent(taskId, text);
      await ctx.reply(t(state, 'success.task_content_updated'), {
        reply_markup: new InlineKeyboard().text(t(state, 'common.back'), `task:view:${taskId}`)
      });
      state.mode = null;
      state.tempData = null;
      state.screen.type = "task_detail";
      const screen = await renderTaskDetailScreen(state, taskId);
      await updateScreen(ctx, chatId, screen);
    } catch (e) {
      await ctx.reply(t(state, 'errors.update_failed', e.message));
    }
    return;
  }
  
  // === EDIT TASK DUE ===
  if (state.mode === "editing_task_due") {
    const taskId = state.tempData.taskId;
    
    // Parse date
    const EXPLICIT_DT_RE = /\b(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})(?:\s+(\d{1,2}):(\d{2}))?\b/;
    let dueString = null;
    
    const m = EXPLICIT_DT_RE.exec(text);
    if (m) {
      const [, dd, MM, yyyy, HH = "00", mm = "00"] = m;
      const dt = new Date(Number(yyyy), Number(MM) - 1, Number(dd), Number(HH), Number(mm), 0, 0);
      dueString = dt.toISOString();
    } else {
      const normalized = text.replace(/\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/g, "$1/$2/$3");
      const parsedDate = chrono.en.GB.parseDate(normalized, new Date(), { forwardDate: true });
      if (parsedDate) {
        dueString = parsedDate.toISOString();
      }
    }
    
    if (!dueString) {
      await ctx.reply(t(state, 'errors.date_parse_failed'));
      return;
    }
    
    try {
      await updateTaskDue(taskId, dueString);
      await ctx.reply(t(state, 'success.task_due_updated'), {
        reply_markup: new InlineKeyboard().text(t(state, 'common.back'), `task:view:${taskId}`)
      });
      state.mode = null;
      state.tempData = null;
      state.screen.type = "task_detail";
      const screen = await renderTaskDetailScreen(state, taskId);
      await updateScreen(ctx, chatId, screen);
    } catch (e) {
      await ctx.reply(t(state, 'errors.task_due_update_failed', e.message));
    }
    return;
  }
}

bot.on("message:voice", async (ctx) => {
  if (ctx.chat.id !== USER_CHAT_ID) return;
  const chatId = ctx.chat.id;
  const state = userStates[chatId];
  if (!state || !state.mode) return;

  try {
    const voice = ctx.message.voice;
    const file = await ctx.getFile();
    const filePath = file.file_path;
    if (!filePath) {
      await ctx.reply(t(state, "errors.nofile") || "Не удалось получить файл голосового.");
      return;
    }

    const localOggPath = path.join("tmp", `${voice.file_id}.ogg`);

    // 1) скачать ogg
    await downloadTelegramFile(TELEGRAM_BOT_TOKEN, filePath, localOggPath);

    // 2) отправить в Groq Whisper large v3
    const fileBuffer = await fs.promises.readFile(localOggPath);
    const transcription = await groq.audio.transcriptions.create({
      file: new File([fileBuffer], path.basename(localOggPath), { type: "audio/ogg" }),
      model: "whisper-large-v3",
      temperature: 0,
      response_format: "verbose_json",
      // language: "ru",
    });

    const recognizedText = transcription.text || "";
    if (!recognizedText.trim()) {
      await ctx.reply(t(state, "errors.sttempty") || "Не удалось распознать голосовое.");
      return;
    }

    // 3) Переиспользуем существующую логику ADD TASK,
    // подставляя recognizedText вместо text
    await handleModeInput(ctx, state, recognizedText);

    // 4) Удалить временный файл после того, как всё обработано
    await fs.promises.unlink(localOggPath).catch(err => 
      console.error('Failed to delete temp file:', localOggPath, err)
    );
  } catch (e) {
    console.error(e);
    await ctx.reply(t(state, "errors.sttfail") || "Ошибка при распознавании голосового.");
  }
});

// === MESSAGE HANDLER ===
bot.on("message:text", async (ctx) => {
  if (ctx.chat.id !== USER_CHAT_ID) return;

  const chatId = ctx.chat.id;
  const state = userStates[chatId];
  if (!state || !state.mode) return;

  const text = ctx.message.text;
  await handleModeInput(ctx, state, text);
});

// === Setup notifications ===
setupNotifications(bot);

// === Start bot ===
bot.catch((err) => console.error("BOT ERROR", err));
bot.start();
console.log("Bot started");
