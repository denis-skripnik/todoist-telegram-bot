import { TodoistApi } from '@doist/todoist-api-typescript';
import axios from "axios";
import { TODOIST_API_TOKEN, LABEL_FILTER_ALL, LABEL_FILTER_NONE } from "./config.js";

export const todoist = new TodoistApi(TODOIST_API_TOKEN);

// === Todoist helpers ===
export function normalizeArrayResponse(data, label) {
  if (Array.isArray(data)) {
    return data;
  }
  if (data?.results && Array.isArray(data.results)) {
    return data.results;
  }
  console.error(`[${label}] Unexpected response shape`, {
    type: typeof data,
    isArray: Array.isArray(data),
    keys: data && typeof data === "object" ? Object.keys(data) : null
  });
  return [];
}

export async function getCompletedTasks(token, { projectId, parentId, limit = 50 } = {}) {
  const params = {
    limit,
    annotate_items: true,
  };
  if (projectId) params.project_id = projectId;

  try {
    const res = await axios.post(
      "https://api.todoist.com/sync/v9/completed/get_all",
      params,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    let tasks = res.data.items || [];

    // Filter by parent if needed (for subtasks)
    if (parentId) {
      tasks = tasks.filter(task => (task.item_object?.v2_parent_id?? null) === parentId);
    }

    return tasks;
  } catch (err) {
    console.error("Error fetching completed tasks:", err.response?.data || err.message);
    return [];
  }
}

export async function getAllProjects() {
  try {
    const data = await todoist.getProjects();
    return normalizeArrayResponse(data, "getProjects");
  } catch (e) {
    console.error("Error fetching projects", e);
    return [];
  }
}

export async function getTasksByProject(projectId) {
  const data = await todoist.getTasks({ projectId });
  return normalizeArrayResponse(data, "getTasks");
}

export async function addTask(projectId, content, dueString = null, parentId = null) {
  const task = { content, projectId };
  if (dueString) task.dueString = dueString;
  if (parentId) task.parentId = parentId;
  return todoist.addTask(task);
}

export async function deleteTask(taskId) {
  return todoist.deleteTask(taskId);
}

export async function completeTask(taskId) {
  return todoist.closeTask(taskId);
}

export async function reopenTask(taskId) {
  return todoist.reopenTask(taskId);
}

// === Projects CRUD ===
export async function createProject(name) {
  try {
    return await todoist.addProject({ name });
  } catch (e) {
    console.error("Todoist createProject failed:", e.response?.status, e.message, e.response?.data);
    if (e.response?.status === 403 || e.message?.includes('limit')) {
      throw new Error('PROJECT_LIMIT');
    }
    throw e;
  }
}

export async function updateProject(projectId, name) {
  try {
    return await todoist.updateProject(projectId, { name });
  } catch (e) {
    console.error("Todoist updateProject failed:", e.response?.status, e.message, e.response?.data);
    throw e;
  }
}

export async function deleteProject(projectId) {
  try {
    return await todoist.deleteProject(projectId);
  } catch (e) {
    console.error("Todoist deleteProject failed:", e.response?.status, e.message, e.response?.data);
    throw e;
  }
}

// === Labels CRUD ===
export async function getAllLabels() {
  try {
    const data = await todoist.getLabels();
    return normalizeArrayResponse(data, "getLabels");
  } catch (e) {
    console.error("Error fetching labels", e);
    return [];
  }
}

export async function createLabel(name) {
  try {
    return await todoist.addLabel({ name });
  } catch (e) {
    console.error("Todoist createLabel failed:", e.response?.status, e.message, e.response?.data);
    throw e;
  }
}

export async function updateLabel(labelId, name) {
  try {
    return await todoist.updateLabel(labelId, { name });
  } catch (e) {
    console.error("Todoist updateLabel failed:", e.response?.status, e.message, e.response?.data);
    throw e;
  }
}

export async function deleteLabel(labelId) {
  try {
    return await todoist.deleteLabel(labelId);
  } catch (e) {
    console.error("Todoist deleteLabel failed:", e.response?.status, e.message, e.response?.data);
    throw e;
  }
}

// === Tasks with labels ===
export async function getTasksByProjectAndLabel(projectId, labelFilter) {
  if (labelFilter === LABEL_FILTER_ALL) {
    // Get all tasks in project
    const data = await todoist.getTasks({ projectId });
    return normalizeArrayResponse(data, "getTasks(all)");
  } else if (labelFilter === LABEL_FILTER_NONE) {
    // Get all tasks, then filter for those without labels
    const data = await todoist.getTasks({ projectId });
    const allTasks = normalizeArrayResponse(data, "getTasks(none)");
    return allTasks.filter(t => !t.labels || t.labels.length === 0);
  } else {
    // Filter by specific label using SDK's native label parameter
    const data = await todoist.getTasks({ projectId, label: labelFilter });
    return normalizeArrayResponse(data, "getTasks(label)");
  }
}

export async function updateTaskLabels(taskId, labels) {
  try {
    return await todoist.updateTask(taskId, { labels });
  } catch (e) {
    console.error("Todoist updateTaskLabels failed:", e.response?.status, e.message, e.response?.data);
    throw e;
  }
}

export async function updateTaskContent(taskId, content) {
  try {
    return await todoist.updateTask(taskId, { content });
  } catch (e) {
    console.error("Todoist updateTaskContent failed:", e.response?.status, e.message, e.response?.data);
    throw e;
  }
}

export async function updateTaskDue(taskId, dueString) {
  try {
    return await todoist.updateTask(taskId, { dueString });
  } catch (e) {
    console.error("Todoist updateTaskDue failed:", e.response?.status, e.message, e.response?.data);
    throw e;
  }
}

export async function getTask(taskId) {
  return todoist.getTask(taskId);
}
