import fs from "fs";
import path from "path";

// === State Structure ===
// userStates[chatId] = {
//   lng: string | null,  // User's language preference ('ru' or 'en')
//   activeMessageId: number,
//   screen: {
//     type: "main_menu" | "lists" | "tags" | "project_selection" | "tasks" | "task_detail" | "confirm" | "language_select",
//     projectId: string | null,
//     labelFilter: string | null,
//     taskId: string | null,
//     page: number,
//     showCompleted: boolean,
//     parentId: string | null,
//     confirmAction: { action: string, targetId: string, targetName: string } | null,
//     beforeConfirm: object | null
//   },
//   mode: string | null,
//   tempData: any
// }
export const userStates = {};
export const notifiedTasks = new Set();

const stateFilePath = path.resolve("./state.json");

export function loadState() {
  try {
    if (fs.existsSync(stateFilePath)) {
      const raw = fs.readFileSync(stateFilePath, "utf-8");
      const data = JSON.parse(raw);
      if (data.userStates && typeof data.userStates === "object") Object.assign(userStates, data.userStates);
      if (Array.isArray(data.notifiedTasks)) for (const id of data.notifiedTasks) notifiedTasks.add(id);
      console.log("State loaded from file.");
    }
  } catch (e) { console.error("Error loading state from file:", e); }
}

export function migrateState() {
  for (const chatId in userStates) {
    const state = userStates[chatId];
    
    // Old format detection: has 'category' or old structure without 'screen'
    if (state.category || (state.mode && !state.screen)) {
      console.log(`Migrating state for chat ${chatId} from old format`);
      
      // Clear old state (session data, safe to reset)
      userStates[chatId] = {
        lng: null,
        activeMessageId: null,
        screen: {
          type: "main_menu",
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
    }
    
    // Migrate "lists" -> "projects" terminology
    if (state.screen && state.screen.type === "lists") {
      console.log(`Migrating screen type "lists" -> "projects" for chat ${chatId}`);
      state.screen.type = "projects";
    }
  }
  
  console.log("State migration completed");
  saveState(); // Save migrated state immediately
}

export function saveState() {
  const data = { userStates, notifiedTasks: Array.from(notifiedTasks) };
  fs.writeFileSync(stateFilePath, JSON.stringify(data, null, 2));
}
