// English translations
export const en = {
  // Common UI elements
  common: {
    back: "◀️ Back",
    cancel: "❌ Cancel",
    yes_delete: "✅ Yes, delete",
    save: "💾 Save",
    view: "👁️ View",
    complete: "✅ Complete",
    delete: "🗑️ Delete",
    rename: "📝 Rename",
    create: "➕ Create",
  },

  // Language selection
  language: {
    select: "Please select your language / Пожалуйста, выберите язык",
    russian: "Русский",
    english: "English",
  },

  // Errors
  errors: {
    no_access: "No access",
    unknown_action: "Unknown action",
    task_complete_failed: "❌ Completion failed",
    task_reopen_failed: "❌ Reopen failed",
    deletion_failed: "❌ Deletion failed",
    update_failed: (msg) => `❌ Update failed: ${msg}`,
    rename_failed: (msg) => `❌ Rename failed: ${msg}`,
    creation_failed: (msg) => `❌ Creation failed: ${msg}`,
    task_add_failed: (msg) => `❌ Failed to add task: ${msg}`,
    project_create_failed: (msg) => `❌ Failed to create project: ${msg}`,
    tag_create_failed: (msg) => `❌ Failed to create tag: ${msg}`,
    date_parse_failed: "❌ Could not parse date. Try format: 25.12.2026 or 'tomorrow at 3pm'",
    task_due_update_failed: (msg) => `❌ Failed to update due date: ${msg}`,
    labels_update_failed: (msg) => `❌ Error: ${msg}`,
    project_limit: "❌ Project limit reached (5) for Todoist Free. Delete an existing project to create a new one.",
  },

  // Success messages
  success: {
    task_completed: "✅ Task completed!",
    task_reopened: "🔄 Task reopened",
    project_deleted: "✅ Project deleted",
    tag_deleted: "✅ Tag deleted",
    task_deleted: "✅ Task deleted",
    cancelled: "Cancelled",
    labels_updated: "✅ Tags updated",
    project_created: (name) => `✅ Project "${name}" created!`,
    project_renamed: (name) => `✅ Project renamed to "${name}"`,
    tag_created: (name) => `✅ Tag #${name} created!`,
    tag_renamed: (name) => `✅ Tag renamed to #${name}"`,
    task_added: (content, due) => `✅ Task added:\n${content}${due ? `\n📅 ${due}` : ''}`,
    task_content_updated: "✅ Task text updated",
    task_due_updated: "✅ Task due date updated",
  },

  // Main menu
  menu: {
    main_title: "🏠 *Main Menu*\n\nSelect a section:",
    projects: "📋 Projects",
    tags: "🏷️ Tags",
    tasks: "✅ Tasks",
    language: "🌐 Language",
  },

  // Projects
  projects: {
    title: "📋 *Manage Projects*\n\n",
    no_projects: "You don't have any projects yet.",
    count: (count) => `Total projects: ${count}/5 (Todoist Free limit)\n\n`,
    create_button: "➕ Create project",
    project_actions_title: (name) => `📋 *Project: ${name}*\n\nSelect an action:`,
  },

  // Tags (Labels)
  tags: {
    title: "🏷️ *Manage Tags*\n\n",
    no_tags: "You don't have any tags yet.",
    count: (count) => `Total tags: ${count}\n\n`,
    create_button: "➕ Create tag",
    tag_actions_title: (name) => `🏷️ *Tag: #${name}*\n\nSelect an action:`,
  },

  // Tasks
  tasks: {
    select_project_title: "✅ *Tasks*\n\nSelect a project:",
    no_projects: "✅ *Tasks*\n\nYou don't have any projects. Create a project in the 'Projects' section.",
    go_to_projects: "📋 Go to projects",
    filter_title: (project) => `✅ *Tasks → ${project}*\n\nFilter by tag:`,
    all_tasks: "All tasks",
    no_tags: "No tags",
    list_title: (project) => `✅ *Tasks → ${project}*\n`,
    filter_label: (filter) => `Filter: ${filter === 'none' ? 'no tags' : '#' + filter}\n`,
    mode_label: (showCompleted) => `Mode: ${showCompleted ? 'Completed' : 'Active'}\n\n`,
    no_completed: "No completed tasks.",
    no_active: "No active tasks.",
    range: (start, end, total) => `Tasks ${start}-${end} of ${total}:\n\n`,
    add_button: "➕ Add task",
    toggle_completed: (showCompleted) => showCompleted ? "📋 Active" : "✅ Completed",
    change_filter: "🏷️ Change filter",
    not_found: "❌ Task not found",
    go_to_task: "👁️ Go to task",
  },

  // Task details
  task: {
    detail_title: "📝 *Task Details*\n\n",
    due_label: (due) => `📅 Due: ${due}\n`,
    tags_label: (tags) => `🏷️ Tags: ${tags}\n`,
    status_label: (isCompleted) => `\nStatus: ${isCompleted ? '✅ Completed' : '📋 Active'}`,
    complete_button: "✅ Complete",
    edit_content_button: "📝 Edit text",
    edit_due_button: "📅 Edit due date",
    edit_labels_button: "🏷️ Manage tags",
    reopen_button: "🔄 Reopen",
    labels_picker_title: "🏷️ *Manage Task Tags*\n\nSelect tags for this task:\n\n",
  },

  // Confirmation dialogs
  confirm: {
    delete_project: (name) => `⚠️ *Confirm Deletion*\n\nAre you sure you want to delete project "${name}"?\n\nAll tasks in this project will also be deleted.`,
    delete_tag: (name) => `⚠️ *Confirm Deletion*\n\nAre you sure you want to delete tag "#${name}"?\n\nThe tag will be removed from all tasks.`,
    delete_task: (name) => `⚠️ *Confirm Deletion*\n\nAre you sure you want to delete this task?\n\n"${name}"`,
  },

  // Input prompts
  prompts: {
    enter_project_name: "Enter project name",
    enter_project_name_full: "📋 Enter new project name:",
    enter_new_name: "Enter new name",
    enter_new_project_name: "📝 Enter new project name:",
    enter_tag_name: "Enter tag name",
    enter_tag_name_full: "🏷️ Enter new tag name (without # symbol):",
    enter_new_tag_name: "📝 Enter new tag name:",
    enter_task_text: "Enter task text",
    enter_task_text_full: "✍️ Enter new task text:",
    enter_new_text: "Enter new text",
    enter_new_task_text: "📝 Enter new task text:",
    enter_new_due: "Enter new due date",
    enter_new_due_full: "📅 Enter new due date (e.g., tomorrow at 3pm, 25.12.2026):",
  },

  // Notifications
  notifications: {
    task_time: (project, content, time) => `⏰ *Time to start task!*\n\nProject: ${project}\n${content}\n📅 Time: ${time}`,
    task_today: (project, content) => `📅 *Task for today*\n\nProject: ${project}\n${content}`,
  },
};
