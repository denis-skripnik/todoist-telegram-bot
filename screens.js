import { InlineKeyboard } from "grammy";
import {
  TASKS_PER_PAGE,
  MAX_TASK_PREVIEW_LENGTH,
  LABEL_FILTER_ALL,
  LABEL_FILTER_NONE,
  TODOIST_API_TOKEN
} from "./config.js";
import { userStates } from "./state.js";
import {
  getAllProjects,
  getAllLabels,
  getTasksByProjectAndLabel,
  getCompletedTasks,
  getTask,
  getSubtasks
} from "./todoist_api.js";
import { t } from "./lngs/index.js";

// === SCREEN RENDERERS ===

export function renderLanguageSelectionScreen(state) {
  const text = "Please select your language / Пожалуйста, выберите язык";
  const keyboard = new InlineKeyboard()
    .text("English", "lng:set:en")
    .text("Русский", "lng:set:ru");
  
  // Add back button only if language is already set
  if (state && state.lng) {
    keyboard.row().text(t(state, 'common.back'), "language:back");
  }
  
  return { text, keyboard };
}

export function renderMainMenu(state) {
  const text = t(state, 'menu.main_title');
  const keyboard = new InlineKeyboard()
    .text(t(state, 'menu.projects'), "menu:projects").row()
    .text(t(state, 'menu.tags'), "menu:tags").row()
    .text(t(state, 'menu.tasks'), "menu:tasks").row()
    .text(t(state, 'menu.language'), "settings:language");
  return { text, keyboard };
}

export async function renderProjectsScreen(state) {
  let projects = await getAllProjects();
  if (!Array.isArray(projects)) {
    console.error("renderProjectsScreen: projects is not array", { type: typeof projects });
    projects = [];
  }
  let text = t(state, 'projects.title');
  
  if (projects.length === 0) {
    text += t(state, 'projects.no_projects');
  } else {
    text += t(state, 'projects.count', projects.length);
    projects.forEach((p, i) => {
      text += `${i + 1}. ${p.name}\n`;
    });
  }
  
  const keyboard = new InlineKeyboard();
  
  // Project buttons (2 per row)
  for (let i = 0; i < projects.length; i += 2) {
    if (i + 1 < projects.length) {
      keyboard
        .text(projects[i].name, `project:view:${projects[i].id}`)
        .text(projects[i + 1].name, `project:view:${projects[i + 1].id}`)
        .row();
    } else {
      keyboard.text(projects[i].name, `project:view:${projects[i].id}`).row();
    }
  }
  
  // Action buttons
  if (projects.length < 5) {
    keyboard.text(t(state, 'projects.create_button'), "project:create").row();
  }
  keyboard.text(t(state, 'common.back'), "menu:main");
  
  return { text, keyboard };
}

export async function renderProjectActionsScreen(state, projectId) {
  const projects = await getAllProjects();
  const project = projects.find(p => p.id === projectId);
  
  if (!project) {
    return renderProjectsScreen(state); // Fallback if project not found
  }
  
  const text = t(state, 'projects.project_actions_title', project.name);
  const keyboard = new InlineKeyboard()
    .text(t(state, 'common.rename'), `project:rename:${projectId}`).row()
    .text(t(state, 'common.delete'), `project:delete:${projectId}`).row()
    .text(t(state, 'common.back'), "menu:projects");
  
  return { text, keyboard };
}

export async function renderTagsScreen(state) {
  let labels = await getAllLabels();
  if (!Array.isArray(labels)) {
    console.error("renderTagsScreen: labels is not array", { type: typeof labels });
    labels = [];
  }
  let text = t(state, 'tags.title');
  
  if (labels.length === 0) {
    text += t(state, 'tags.no_tags');
  } else {
    text += t(state, 'tags.count', labels.length);
    labels.forEach((l, i) => {
      text += `${i + 1}. #${l.name}\n`;
    });
  }
  
  const keyboard = new InlineKeyboard();
  
  // Label buttons (2 per row)
  for (let i = 0; i < labels.length; i += 2) {
    if (i + 1 < labels.length) {
      keyboard
        .text(`#${labels[i].name}`, `tag:view:${labels[i].id}`)
        .text(`#${labels[i + 1].name}`, `tag:view:${labels[i + 1].id}`)
        .row();
    } else {
      keyboard.text(`#${labels[i].name}`, `tag:view:${labels[i].id}`).row();
    }
  }
  
  keyboard.text(t(state, 'tags.create_button'), "tag:create").row();
  keyboard.text(t(state, 'common.back'), "menu:main");
  
  return { text, keyboard };
}

export async function renderTagActionsScreen(state, labelId) {
  const labels = await getAllLabels();
  const label = labels.find(l => l.id === labelId);
  
  if (!label) {
    return renderTagsScreen(state); // Fallback
  }
  
  const text = t(state, 'tags.tag_actions_title', label.name);
  const keyboard = new InlineKeyboard()
    .text(t(state, 'common.rename'), `tag:rename:${labelId}`).row()
    .text(t(state, 'common.delete'), `tag:delete:${labelId}`).row()
    .text(t(state, 'common.back'), "menu:tags");
  
  return { text, keyboard };
}

export async function renderProjectSelectionScreen(state) {
  const projects = await getAllProjects();
  let text = t(state, 'tasks.select_project_title');
  
  if (projects.length === 0) {
    text = t(state, 'tasks.no_projects');
    const keyboard = new InlineKeyboard()
      .text(t(state, 'tasks.go_to_projects'), "menu:projects").row()
      .text(t(state, 'common.back'), "menu:main");
    return { text, keyboard };
  }
  
  const keyboard = new InlineKeyboard();
  projects.forEach(p => {
    keyboard.text(p.name, `tasks:selproj:${p.id}`).row();
  });
  keyboard.text(t(state, 'common.back'), "menu:main");
  
  return { text, keyboard };
}

export async function renderLabelFilterScreen(state, projectId) {
  const projects = await getAllProjects();
  const project = projects.find(p => p.id === projectId);
  const labels = await getAllLabels();
  
  let text = t(state, 'tasks.filter_title', project?.name || 'Project');
  
  const keyboard = new InlineKeyboard()
    .text(t(state, 'tasks.all_tasks'), `tasks:filter:${projectId}:${LABEL_FILTER_ALL}`).row();
  
  if (labels.length > 0) {
    labels.forEach(l => {
      keyboard.text(`#${l.name}`, `tasks:filter:${projectId}:${l.name}`).row();
    });
    keyboard.text(t(state, 'tasks.no_tags'), `tasks:filter:${projectId}:${LABEL_FILTER_NONE}`).row();
  }
  
  keyboard.text(t(state, 'common.back'), "tasks:back");
  
  return { text, keyboard };
}

export async function renderTaskListScreen(chatId) {
  const state = userStates[chatId];
  const { projectId, labelFilter, page, showCompleted, parentId } = state.screen;
  
  const projects = await getAllProjects();
  const project = projects.find(p => p.id === projectId);
  
  // Get tasks
  let tasks;
  if (!showCompleted) {
    tasks = await getTasksByProjectAndLabel(projectId, labelFilter || LABEL_FILTER_ALL);
    if (!Array.isArray(tasks)) {
      console.error("renderTaskListScreen: tasks is not array", { type: typeof tasks });
      tasks = [];
    }
    tasks = tasks.filter(t => (t.parentId ?? null) === parentId);
  } else {
    tasks = await getCompletedTasks(TODOIST_API_TOKEN, { projectId, parentId });
  }
  
  // Build header
  let text = t(state, 'tasks.list_title', project?.name || 'Project');
  if (labelFilter && labelFilter !== LABEL_FILTER_ALL) {
    text += t(state, 'tasks.filter_label', labelFilter);
  }
  text += t(state, 'tasks.mode_label', showCompleted);
  
  // Pagination
  const totalPages = Math.ceil(tasks.length / TASKS_PER_PAGE);
  const currentPage = Math.min(page, totalPages - 1) || 0;
  const startIdx = currentPage * TASKS_PER_PAGE;
  const endIdx = Math.min(startIdx + TASKS_PER_PAGE, tasks.length);
  const pageTasks = tasks.slice(startIdx, endIdx);
  
  if (tasks.length === 0) {
    text += showCompleted ? t(state, 'tasks.no_completed') : t(state, 'tasks.no_active');
  } else {
    text += t(state, 'tasks.range', [startIdx + 1, endIdx, tasks.length]);
    pageTasks.forEach((task, i) => {
      const taskContent = task.item_object?.content ?? task.content ?? "";
      const preview = taskContent.length > MAX_TASK_PREVIEW_LENGTH
        ? taskContent.substring(0, MAX_TASK_PREVIEW_LENGTH) + "..."
        : taskContent;
      const prefix = showCompleted ? "✅" : "•";
      text += `${prefix} ${preview}\n`;
    });
  }
  
  // Keyboard
  const keyboard = new InlineKeyboard();
  
  // Task buttons (1 per row, showing task number)
  pageTasks.forEach((task, i) => {
    const taskId = showCompleted ? task.v2_task_id || task.id : task.id;
    const taskContent = task.item_object?.content ?? task.content ?? "";
    const label = `${startIdx + i + 1}. ${taskContent.substring(0, 20)}${taskContent.length > 20 ? '...' : ''}`;
    keyboard.text(label, `task:view:${taskId}`).row();
  });
  
  // Pagination controls
  if (totalPages > 1) {
    const paginationRow = [];
    if (currentPage > 0) {
      paginationRow.push({ text: "◀️", callback_data: `tasks:page:${currentPage - 1}` });
    }
    paginationRow.push({ text: `${currentPage + 1}/${totalPages}`, callback_data: "noop" });
    if (currentPage < totalPages - 1) {
      paginationRow.push({ text: "▶️", callback_data: `tasks:page:${currentPage + 1}` });
    }
    keyboard.row(...paginationRow);
  }
  
  // Action buttons
  keyboard.text(t(state, 'tasks.add_button'), "task:add").row();
  keyboard.text(t(state, 'tasks.toggle_completed', showCompleted), "tasks:toggle").row();
  keyboard.text(t(state, 'tasks.change_filter'), "tasks:chfilter").row();
  keyboard.text(t(state, 'common.back'), "tasks:back");
  
  return { text, keyboard };
}

export async function renderTaskDetailScreen(state, taskId) {
  let task;
  try {
    task = await getTask(taskId);
  } catch (e) {
    // Task might be completed, try to get from completed
    const completed = await getCompletedTasks(TODOIST_API_TOKEN, { limit: 200 });
    task = completed.find(t => t.v2_task_id === taskId || t.id === taskId);
    if (!task) {
      return {
        text: t(state, 'tasks.not_found'),
        keyboard: new InlineKeyboard().text(t(state, 'common.back'), "tasks:list")
      };
    }
  }
  
const isCompleted =
  task.is_completed === true ||
  task.isCompleted === true ||
  Boolean(task.completed_at || task.completedAt);
  const isSubtask = task.parentId != null;
  const taskContent = task.item_object?.content ?? task.content ?? "";
  
  let text = t(state, 'task.detail_title');
  text += `${taskContent}\n\n`;
  
  if (task.due) {
    text += t(state, 'task.due_label', task.due.string || task.due.date);
  }
  
  if (task.labels && task.labels.length > 0) {
    text += t(state, 'task.tags_label', task.labels.map(l => '#' + l).join(', '));
  }
  
  text += t(state, 'task.status_label', isCompleted);
  
  // Add subtasks section (only for parent tasks, not completed)
  let subtasks = [];
  if (!isSubtask && !isCompleted) {
    try {
      subtasks = await getSubtasks(taskId);
      const subtaskPage = state.screen.subtaskPage || 0;
      const SUBTASKS_PER_PAGE = 5;
      const totalPages = Math.ceil(subtasks.length / SUBTASKS_PER_PAGE);
      const currentPage = Math.min(subtaskPage, Math.max(0, totalPages - 1));
      const startIdx = currentPage * SUBTASKS_PER_PAGE;
      const endIdx = Math.min(startIdx + SUBTASKS_PER_PAGE, subtasks.length);
      const pageSubtasks = subtasks.slice(startIdx, endIdx);
      
      text += "\n\n" + t(state, 'subtasks.section_title') + "\n";
      
      if (subtasks.length === 0) {
        text += t(state, 'subtasks.no_subtasks');
      } else {
        text += t(state, 'subtasks.count', { current: pageSubtasks.length, total: subtasks.length }) + "\n";
        pageSubtasks.forEach((subtask) => {
          const content = subtask.content ?? "";
          const preview = content.length > 40 ? content.substring(0, 40) + "..." : content;
          text += `↳ ${preview}\n`;
        });
      }
      
      subtasks = pageSubtasks; // Store page subtasks for keyboard
    } catch (e) {
      console.error("Error fetching subtasks:", e);
    }
  }
  
  const keyboard = new InlineKeyboard();
  
  if (!isCompleted) {
    keyboard.text(t(state, 'task.complete_button'), `task:complete:${taskId}`).row();
    keyboard.text(t(state, 'task.edit_content_button'), `task:editcontent:${taskId}`).row();
    keyboard.text(t(state, 'task.edit_due_button'), `task:editdue:${taskId}`).row();
    keyboard.text(t(state, 'task.edit_labels_button'), `task:editlabels:${taskId}`).row();
  } else {
    keyboard.text(t(state, 'task.reopen_button'), `task:reopen:${taskId}`).row();
  }
  
  // Add subtask buttons (only for parent tasks, not completed)
  if (!isSubtask && !isCompleted && subtasks.length > 0) {
    subtasks.forEach((subtask) => {
      const content = subtask.content ?? "";
      const label = `↳ ${content.substring(0, 25)}${content.length > 25 ? '...' : ''}`;
      keyboard.text(label, `task:view:${subtask.id}`).row();
    });
  }
  
  // Add subtask button
  if (!isSubtask && !isCompleted) {
    keyboard.text(t(state, 'subtasks.add_button'), `subtask:add:${taskId}`).row();
  }
  
  // If this is a subtask, add "Back to Parent" button
  if (isSubtask) {
    keyboard.text(t(state, 'subtasks.back_to_parent'), `task:view:${task.parentId}`).row();
  }
  
  keyboard.text(t(state, 'common.delete'), `task:delete:${taskId}`).row();
  keyboard.text(t(state, 'common.back'), "tasks:list");
  
  return { text, keyboard };
}

export async function renderTaskLabelsPickerScreen(chatId, taskId) {
  const state = userStates[chatId];
  const labels = await getAllLabels();
  
  // Initialize tempData only if taskId changed or selectedLabels is missing
  let selectedLabels;
  if (state.tempData?.taskId !== taskId || !state.tempData?.selectedLabels) {
    const task = await getTask(taskId);
    selectedLabels = task.labels || [];
    state.tempData = { taskId, selectedLabels };
  } else {
    selectedLabels = state.tempData.selectedLabels;
  }
  
  let text = t(state, 'task.labels_picker_title');
  
  const keyboard = new InlineKeyboard();
  
  labels.forEach(l => {
    const isSelected = selectedLabels.includes(l.name);
    const prefix = isSelected ? "✅ " : "";
    keyboard.text(`${prefix}#${l.name}`, `task:labels:toggle:${l.name}`).row();
  });
  
  keyboard.text(t(state, 'common.save'), "task:labels:save").row();
  keyboard.text(t(state, 'common.back'), `task:view:${taskId}`);
  
  return { text, keyboard };
}

export function renderConfirmDialog(state, action, targetName, targetId) {
  let text = "";
  let confirmCallback = "";
  
  if (action === "delete_project") {
    text = t(state, 'confirm.delete_project', targetName);
    confirmCallback = `confirm:delproj:${targetId}`;
  } else if (action === "delete_tag") {
    text = t(state, 'confirm.delete_tag', targetName);
    confirmCallback = `confirm:deltag:${targetId}`;
  } else if (action === "delete_task") {
    text = t(state, 'confirm.delete_task', targetName);
    confirmCallback = `confirm:deltask:${targetId}`;
  }
  
  const keyboard = new InlineKeyboard()
    .text(t(state, 'common.yes_delete'), confirmCallback).row()
    .text(t(state, 'common.cancel'), "confirm:cancel");
  
  return { text, keyboard };
}

// === MESSAGE UPDATE HELPER ===
export async function updateScreen(ctx, chatId, screen) {
  const state = userStates[chatId];
  const { text, keyboard } = screen;
  
  try {
    if (state.activeMessageId) {
      await ctx.api.editMessageText(chatId, state.activeMessageId, text, {
        parse_mode: "Markdown",
        reply_markup: keyboard
      });
    } else {
      // No active message, send new one
      const msg = await ctx.reply(text, {
        parse_mode: "Markdown",
        reply_markup: keyboard
      });
      state.activeMessageId = msg.message_id;
    }
  } catch (e) {
    // If message is not modified, just return (no need to send new message)
    const errText = String(e?.description || e?.message || "");
    if (errText.includes("message is not modified")) {
      return;
    }
    // Edit failed (message too old, deleted, etc.) - send new message
    try {
      const msg = await ctx.reply(text, {
        parse_mode: "Markdown",
        reply_markup: keyboard
      });
      state.activeMessageId = msg.message_id;
    } catch (sendError) {
      console.error("Failed to send message:", sendError);
    }
  }
}
