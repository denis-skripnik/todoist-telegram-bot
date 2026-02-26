import axios from "axios";

const PLAN_SCHEMA = "task_plan_v1";
const URGENT_PROJECT_NAME_RU = "\u0421\u0440\u043e\u0447\u043d\u044b\u0435 \u0437\u0430\u0434\u0430\u0447\u0438";
const FORCE_PROJECT_TO_URGENT = true;
const MAX_PREVIEW_ITEMS = 40;
const MAX_REPORT_DETAILS = 30;

const ACTIVATION_PATTERNS = [
  /(^|\s)\u043f\u043b\u0430\u043d \u043d\u0430 \u043c\u0435\u0441\u044f\u0446(\s|$)/i,
  /(^|\s)\u043f\u043b\u0430\u043d \u043d\u0430 \u043d\u0435\u0434\u0435\u043b\u044e(\s|$)/i,
  /(^|\s)\u0441\u043e\u0437\u0434\u0430\u0439 \u0437\u0430\u0434\u0430\u0447\u0443(\s|$)/i,
  /(^|\s)\u0441\u043e\u0437\u0434\u0430\u0442\u044c \u0437\u0430\u0434\u0430\u0447\u0443(\s|$)/i,
  /(^|\s)plan for month(\s|$)/i,
  /(^|\s)plan for week(\s|$)/i,
  /(^|\s)create task(\s|$)/i
];

const REQUIRED_KEYS = ["addTask", "updateTaskLabels", "updateTaskDue", "createSubtask"];
const ROOT_ALLOWED_KEYS = [
  "schema",
  "mode",
  "request_id",
  "timezone",
  "addTask",
  "updateTaskLabels",
  "updateTaskDue",
  "createSubtask",
  "warnings"
];
const MODE_ALLOWED_VALUES = ["single_task", "weekly_plan", "monthly_plan", "batch"];
const ADD_TASK_ALLOWED_KEYS = ["ref", "project_name", "content", "due_string", "schedule", "labels"];
const UPDATE_LABELS_ALLOWED_KEYS = ["task_ref", "labels"];
const UPDATE_DUE_ALLOWED_KEYS = ["task_ref", "due_string"];
const CREATE_SUBTASK_ALLOWED_KEYS = [
  "ref",
  "parent_ref",
  "parent_task_id",
  "content",
  "due_string",
  "schedule",
  "labels"
];
const SCHEDULE_ALLOWED_KEYS = ["anchor", "weekday_iso", "week_offset", "date", "time_hhmm"];
const SCHEDULE_ANCHOR_ALLOWED_VALUES = ["next_weekday", "absolute_date"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const TASK_SCHEDULE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    anchor: { type: "string", enum: SCHEDULE_ANCHOR_ALLOWED_VALUES },
    weekday_iso: { type: "integer", minimum: 1, maximum: 7 },
    week_offset: { type: "integer", minimum: 0, maximum: 12 },
    date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    time_hhmm: { type: "string", pattern: "^([01]\\d|2[0-3]):([0-5]\\d)$" }
  },
  anyOf: [{ required: ["weekday_iso"] }, { required: ["date"] }]
};
// JSON Schema document kept in code and enforced by validateTaskPlanSchema.
export const TASK_PLAN_JSON_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: PLAN_SCHEMA,
  type: "object",
  additionalProperties: false,
  required: ["schema", "mode", "addTask", "updateTaskLabels", "updateTaskDue", "createSubtask"],
  properties: {
    schema: { type: "string", const: PLAN_SCHEMA },
    mode: { type: "string", enum: MODE_ALLOWED_VALUES },
    request_id: { type: "string" },
    timezone: { type: "string" },
    warnings: { type: "array", items: { type: "string" } },
    addTask: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["ref", "content"],
        properties: {
          ref: { type: "string", minLength: 1 },
          project_name: { type: "string" },
          content: { type: "string", minLength: 1 },
          due_string: { type: "string" },
          schedule: TASK_SCHEDULE_JSON_SCHEMA,
          labels: { type: "array", items: { type: "string" } }
        }
      }
    },
    updateTaskLabels: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["task_ref", "labels"],
        properties: {
          task_ref: { type: "string", minLength: 1 },
          labels: { type: "array", items: { type: "string" } }
        }
      }
    },
    updateTaskDue: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["task_ref", "due_string"],
        properties: {
          task_ref: { type: "string", minLength: 1 },
          due_string: { type: "string", minLength: 1 }
        }
      }
    },
    createSubtask: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["ref", "content"],
        properties: {
          ref: { type: "string", minLength: 1 },
          parent_ref: { type: "string" },
          parent_task_id: { type: "string" },
          content: { type: "string", minLength: 1 },
          due_string: { type: "string" },
          schedule: TASK_SCHEDULE_JSON_SCHEMA,
          labels: { type: "array", items: { type: "string" } }
        },
        anyOf: [{ required: ["parent_ref"] }, { required: ["parent_task_id"] }]
      }
    }
  }
};

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asString(value) {
  if (typeof value === "string") return value.trim();
  if (value == null) return "";
  return String(value).trim();
}

function toInteger(value) {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
    return Number(value.trim());
  }
  return null;
}

function isIsoDateString(value) {
  return DATE_RE.test(asString(value));
}

function isTimeString(value) {
  return TIME_RE.test(asString(value));
}

function normalizeSchedule(value) {
  if (!isPlainObject(value)) return null;

  const anchorRaw = normalizeName(value.anchor);
  const weekdayIso = toInteger(value.weekday_iso);
  const weekOffsetRaw = toInteger(value.week_offset);
  const date = asString(value.date) || null;
  const timeHhmm = asString(value.time_hhmm) || null;

  let anchor = null;
  if (SCHEDULE_ANCHOR_ALLOWED_VALUES.includes(anchorRaw)) {
    anchor = anchorRaw;
  } else if (isIsoDateString(date)) {
    anchor = "absolute_date";
  } else if (weekdayIso != null) {
    anchor = "next_weekday";
  }

  return {
    anchor,
    weekday_iso: weekdayIso,
    week_offset: weekOffsetRaw == null ? 0 : weekOffsetRaw,
    date,
    time_hhmm: timeHhmm
  };
}

function normalizeName(value) {
  return asString(value).toLocaleLowerCase();
}

function uniqueStrings(values) {
  const out = [];
  const seen = new Set();
  for (const value of values) {
    const s = asString(value);
    if (!s) continue;
    const key = s.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

function extractFromCodeFence(text) {
  const matches = text.match(/```(?:json)?\s*([\s\S]*?)```/gi) || [];
  return matches.map((m) => m.replace(/```(?:json)?/i, "").replace(/```$/, "").trim());
}

function extractBalancedJsonCandidates(text) {
  const candidates = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "{") continue;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let j = i; j < text.length; j++) {
      const ch = text[j];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (ch === "\\") {
          escaped = true;
        } else if (ch === "\"") {
          inString = false;
        }
        continue;
      }
      if (ch === "\"") {
        inString = true;
        continue;
      }
      if (ch === "{") depth++;
      if (ch === "}") depth--;
      if (depth === 0) {
        candidates.push(text.slice(i, j + 1));
        i = j;
        break;
      }
    }
  }
  return candidates;
}

function tryParseCandidates(candidates) {
  const parsedObjects = [];
  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        parsedObjects.push(parsed);
      }
    } catch {
      // ignore invalid candidate
    }
  }

  parsedObjects.sort((a, b) => JSON.stringify(b).length - JSON.stringify(a).length);

  for (const obj of parsedObjects) {
    if (REQUIRED_KEYS.some((k) => Object.prototype.hasOwnProperty.call(obj, k))) {
      return obj;
    }
    if (obj.plan && typeof obj.plan === "object") {
      return obj.plan;
    }
  }

  return parsedObjects[0] || null;
}

function extractJsonObject(rawContent) {
  if (!rawContent) return null;
  if (typeof rawContent === "object" && !Array.isArray(rawContent)) return rawContent;

  const text = asString(rawContent);
  if (!text) return null;

  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
  } catch {
    // keep trying
  }

  const fenceCandidate = tryParseCandidates(extractFromCodeFence(text));
  if (fenceCandidate) return fenceCandidate;

  return tryParseCandidates(extractBalancedJsonCandidates(text));
}

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyAllowedKeys(obj, allowed) {
  return Object.keys(obj).every((k) => allowed.includes(k));
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((x) => typeof x === "string");
}

function validateScheduleObject(schedule, contextRef, errors) {
  if (schedule == null) return;

  if (!isPlainObject(schedule)) {
    errors.push(`${contextRef}.schedule must be an object`);
    return;
  }

  if (!hasOnlyAllowedKeys(schedule, SCHEDULE_ALLOWED_KEYS)) {
    const invalid = Object.keys(schedule).filter((k) => !SCHEDULE_ALLOWED_KEYS.includes(k));
    errors.push(`${contextRef}.schedule unknown keys: ${invalid.join(", ")}`);
  }

  const anchor = asString(schedule.anchor);
  const hasAnchor = Boolean(anchor);
  const hasWeekdayIso = toInteger(schedule.weekday_iso) != null;
  const hasDate = Boolean(asString(schedule.date));

  if (hasAnchor && !SCHEDULE_ANCHOR_ALLOWED_VALUES.includes(anchor)) {
    errors.push(
      `${contextRef}.schedule.anchor must be one of: ${SCHEDULE_ANCHOR_ALLOWED_VALUES.join(", ")}`
    );
  }

  if (hasWeekdayIso) {
    const weekdayIso = toInteger(schedule.weekday_iso);
    if (weekdayIso < 1 || weekdayIso > 7) {
      errors.push(`${contextRef}.schedule.weekday_iso must be integer 1..7`);
    }
  } else if (schedule.weekday_iso != null) {
    errors.push(`${contextRef}.schedule.weekday_iso must be integer 1..7`);
  }

  if (schedule.week_offset != null) {
    const weekOffset = toInteger(schedule.week_offset);
    if (weekOffset == null || weekOffset < 0 || weekOffset > 12) {
      errors.push(`${contextRef}.schedule.week_offset must be integer 0..12`);
    }
  }

  if (hasDate && !isIsoDateString(schedule.date)) {
    errors.push(`${contextRef}.schedule.date must be YYYY-MM-DD`);
  }

  if (schedule.time_hhmm != null && !isTimeString(schedule.time_hhmm)) {
    errors.push(`${contextRef}.schedule.time_hhmm must be HH:MM`);
  }

  if (anchor === "next_weekday" && !hasWeekdayIso) {
    errors.push(`${contextRef}.schedule.weekday_iso is required when anchor=next_weekday`);
  }
  if (anchor === "absolute_date" && !hasDate) {
    errors.push(`${contextRef}.schedule.date is required when anchor=absolute_date`);
  }

  if (!hasAnchor && !hasWeekdayIso && !hasDate) {
    errors.push(`${contextRef}.schedule requires at least weekday_iso or date`);
  }
}

export function validateTaskPlanSchema(rawPlan) {
  const errors = [];
  const requiresSchedulePerTask =
    rawPlan && (rawPlan.mode === "weekly_plan" || rawPlan.mode === "monthly_plan");

  if (!isPlainObject(rawPlan)) {
    return ["Root must be a JSON object"];
  }

  if (!hasOnlyAllowedKeys(rawPlan, ROOT_ALLOWED_KEYS)) {
    const invalid = Object.keys(rawPlan).filter((k) => !ROOT_ALLOWED_KEYS.includes(k));
    errors.push(`Root has unknown keys: ${invalid.join(", ")}`);
  }

  for (const key of REQUIRED_KEYS) {
    if (!Array.isArray(rawPlan[key])) {
      errors.push(`Root.${key} must be an array`);
    }
  }

  if (typeof rawPlan.schema !== "string" || rawPlan.schema !== PLAN_SCHEMA) {
    errors.push(`Root.schema must be '${PLAN_SCHEMA}'`);
  }

  if (typeof rawPlan.mode !== "string" || !MODE_ALLOWED_VALUES.includes(rawPlan.mode)) {
    errors.push(`Root.mode must be one of: ${MODE_ALLOWED_VALUES.join(", ")}`);
  }

  if (rawPlan.request_id != null && typeof rawPlan.request_id !== "string") {
    errors.push("Root.request_id must be a string");
  }

  if (rawPlan.timezone != null && typeof rawPlan.timezone !== "string") {
    errors.push("Root.timezone must be a string");
  }

  if (rawPlan.warnings != null && !isStringArray(rawPlan.warnings)) {
    errors.push("Root.warnings must be an array of strings");
  }

  asArray(rawPlan.addTask).forEach((item, idx) => {
    if (!isPlainObject(item)) {
      errors.push(`addTask[${idx}] must be an object`);
      return;
    }

    if (!hasOnlyAllowedKeys(item, ADD_TASK_ALLOWED_KEYS)) {
      const invalid = Object.keys(item).filter((k) => !ADD_TASK_ALLOWED_KEYS.includes(k));
      errors.push(`addTask[${idx}] unknown keys: ${invalid.join(", ")}`);
    }

    if (typeof item.ref !== "string" || !item.ref.trim()) {
      errors.push(`addTask[${idx}].ref must be a non-empty string`);
    }
    if (typeof item.content !== "string" || !item.content.trim()) {
      errors.push(`addTask[${idx}].content must be a non-empty string`);
    }
    if (item.project_name != null && typeof item.project_name !== "string") {
      errors.push(`addTask[${idx}].project_name must be a string`);
    }
    if (item.due_string != null && typeof item.due_string !== "string") {
      errors.push(`addTask[${idx}].due_string must be a string`);
    }
    validateScheduleObject(item.schedule, `addTask[${idx}]`, errors);
    if (requiresSchedulePerTask && item.schedule == null) {
      errors.push(`addTask[${idx}].schedule is required for mode='${rawPlan.mode}'`);
    }
    if (item.labels != null && !isStringArray(item.labels)) {
      errors.push(`addTask[${idx}].labels must be an array of strings`);
    }
  });

  asArray(rawPlan.updateTaskLabels).forEach((item, idx) => {
    if (!isPlainObject(item)) {
      errors.push(`updateTaskLabels[${idx}] must be an object`);
      return;
    }

    if (!hasOnlyAllowedKeys(item, UPDATE_LABELS_ALLOWED_KEYS)) {
      const invalid = Object.keys(item).filter((k) => !UPDATE_LABELS_ALLOWED_KEYS.includes(k));
      errors.push(`updateTaskLabels[${idx}] unknown keys: ${invalid.join(", ")}`);
    }

    if (typeof item.task_ref !== "string" || !item.task_ref.trim()) {
      errors.push(`updateTaskLabels[${idx}].task_ref must be a non-empty string`);
    }
    if (!isStringArray(item.labels)) {
      errors.push(`updateTaskLabels[${idx}].labels must be an array of strings`);
    }
  });

  asArray(rawPlan.updateTaskDue).forEach((item, idx) => {
    if (!isPlainObject(item)) {
      errors.push(`updateTaskDue[${idx}] must be an object`);
      return;
    }

    if (!hasOnlyAllowedKeys(item, UPDATE_DUE_ALLOWED_KEYS)) {
      const invalid = Object.keys(item).filter((k) => !UPDATE_DUE_ALLOWED_KEYS.includes(k));
      errors.push(`updateTaskDue[${idx}] unknown keys: ${invalid.join(", ")}`);
    }

    if (typeof item.task_ref !== "string" || !item.task_ref.trim()) {
      errors.push(`updateTaskDue[${idx}].task_ref must be a non-empty string`);
    }
    if (typeof item.due_string !== "string" || !item.due_string.trim()) {
      errors.push(`updateTaskDue[${idx}].due_string must be a non-empty string`);
    }
  });

  asArray(rawPlan.createSubtask).forEach((item, idx) => {
    if (!isPlainObject(item)) {
      errors.push(`createSubtask[${idx}] must be an object`);
      return;
    }

    if (!hasOnlyAllowedKeys(item, CREATE_SUBTASK_ALLOWED_KEYS)) {
      const invalid = Object.keys(item).filter((k) => !CREATE_SUBTASK_ALLOWED_KEYS.includes(k));
      errors.push(`createSubtask[${idx}] unknown keys: ${invalid.join(", ")}`);
    }

    if (typeof item.ref !== "string" || !item.ref.trim()) {
      errors.push(`createSubtask[${idx}].ref must be a non-empty string`);
    }
    if (typeof item.content !== "string" || !item.content.trim()) {
      errors.push(`createSubtask[${idx}].content must be a non-empty string`);
    }
    if (item.due_string != null && typeof item.due_string !== "string") {
      errors.push(`createSubtask[${idx}].due_string must be a string`);
    }
    validateScheduleObject(item.schedule, `createSubtask[${idx}]`, errors);
    if (item.labels != null && !isStringArray(item.labels)) {
      errors.push(`createSubtask[${idx}].labels must be an array of strings`);
    }

    const hasParentRef = typeof item.parent_ref === "string" && item.parent_ref.trim();
    const hasParentTaskId = typeof item.parent_task_id === "string" && item.parent_task_id.trim();
    if (!hasParentRef && !hasParentTaskId) {
      errors.push(`createSubtask[${idx}] requires parent_ref or parent_task_id`);
    }
    if (item.parent_ref != null && typeof item.parent_ref !== "string") {
      errors.push(`createSubtask[${idx}].parent_ref must be a string`);
    }
    if (item.parent_task_id != null && typeof item.parent_task_id !== "string") {
      errors.push(`createSubtask[${idx}].parent_task_id must be a string`);
    }
  });

  return errors;
}

function summarizeSchemaErrors(errors) {
  const limit = 8;
  if (!errors || errors.length === 0) return "Unknown schema error";
  const head = errors.slice(0, limit).join("; ");
  if (errors.length <= limit) return head;
  return `${head}; and ${errors.length - limit} more`;
}

function normalizePlan(rawPlan) {
  const warnings = [];
  const src = rawPlan && typeof rawPlan === "object" ? rawPlan : {};

  const normalized = {
    schema: asString(src.schema) || PLAN_SCHEMA,
    mode: asString(src.mode) || "batch",
    request_id: asString(src.request_id),
    timezone: asString(src.timezone),
    addTask: [],
    updateTaskLabels: [],
    updateTaskDue: [],
    createSubtask: [],
    warnings: uniqueStrings(asArray(src.warnings))
  };

  asArray(src.addTask).forEach((item, idx) => {
    const content = asString(item?.content);
    if (!content) {
      warnings.push(`addTask[${idx}] skipped: empty content`);
      return;
    }

    normalized.addTask.push({
      ref: asString(item?.ref) || `task_${idx + 1}`,
      project_name: asString(item?.project_name),
      content,
      due_string: asString(item?.due_string) || null,
      schedule: normalizeSchedule(item?.schedule),
      labels: uniqueStrings(asArray(item?.labels))
    });
  });

  asArray(src.updateTaskLabels).forEach((item, idx) => {
    const taskRef = asString(item?.task_ref);
    if (!taskRef) {
      warnings.push(`updateTaskLabels[${idx}] skipped: empty task_ref`);
      return;
    }

    normalized.updateTaskLabels.push({
      task_ref: taskRef,
      labels: uniqueStrings(asArray(item?.labels))
    });
  });

  asArray(src.updateTaskDue).forEach((item, idx) => {
    const taskRef = asString(item?.task_ref);
    const dueString = asString(item?.due_string);
    if (!taskRef || !dueString) {
      warnings.push(`updateTaskDue[${idx}] skipped: empty task_ref or due_string`);
      return;
    }

    normalized.updateTaskDue.push({
      task_ref: taskRef,
      due_string: dueString
    });
  });

  asArray(src.createSubtask).forEach((item, idx) => {
    const content = asString(item?.content);
    if (!content) {
      warnings.push(`createSubtask[${idx}] skipped: empty content`);
      return;
    }

    const parentRef = asString(item?.parent_ref);
    const parentTaskId = asString(item?.parent_task_id);
    if (!parentRef && !parentTaskId) {
      warnings.push(`createSubtask[${idx}] skipped: parent_ref or parent_task_id is required`);
      return;
    }

    normalized.createSubtask.push({
      ref: asString(item?.ref) || `subtask_${idx + 1}`,
      parent_ref: parentRef || null,
      parent_task_id: parentTaskId || null,
      content,
      due_string: asString(item?.due_string) || null,
      schedule: normalizeSchedule(item?.schedule),
      labels: uniqueStrings(asArray(item?.labels))
    });
  });

  normalized.warnings = uniqueStrings([...normalized.warnings, ...warnings]);
  return normalized;
}

function getContentFromModelResponse(data) {
  if (!data || typeof data !== "object") return "";

  const message = data?.choices?.[0]?.message;
  if (!message) return "";

  if (typeof message.content === "string") return message.content;

  if (Array.isArray(message.content)) {
    return message.content
      .map((part) => (typeof part === "string" ? part : part?.text || ""))
      .join("\n")
      .trim();
  }

  return "";
}

function getTodayInfo(timezone) {
  let tz = asString(timezone) || "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
  } catch {
    tz = "UTC";
  }
  const now = new Date();
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const year = dateParts.find((p) => p.type === "year")?.value || "1970";
  const month = dateParts.find((p) => p.type === "month")?.value || "01";
  const day = dateParts.find((p) => p.type === "day")?.value || "01";
  const isoDate = `${year}-${month}-${day}`;

  const weekdayName = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "long"
  }).format(now);

  const weekdayJsMap = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6
  };
  const weekdayJs = weekdayJsMap[weekdayName] ?? 0;
  const weekdayMonday0 = (weekdayJs + 6) % 7;
  const weekdayIso = weekdayJs === 0 ? 7 : weekdayJs;

  return {
    timezone: tz,
    isoDate,
    weekdayName,
    weekdayJs,
    weekdayMonday0,
    weekdayIso
  };
}

function buildSystemPrompt({ projects, labels, timezone }) {
  const projectList = projects.map((p) => `- ${p.name}`).join("\n") || "- (none)";
  const labelList = labels.map((l) => `- ${l.name}`).join("\n") || "- (none)";
  const todayInfo = getTodayInfo(timezone);
  const projectsJson = JSON.stringify(
    projects.map((p) => ({ id: asString(p.id), name: asString(p.name) })),
    null,
  2
  );
  const labelsJson = JSON.stringify(
    labels.map((l) => ({ id: asString(l.id), name: asString(l.name) })),
    null,
    2
  );

  return [
    "You are a Todoist planner. Return JSON object only.",
    `Schema id: ${PLAN_SCHEMA}`,
    "Allowed top-level keys only: schema, mode, request_id, timezone, addTask, updateTaskLabels, updateTaskDue, createSubtask, warnings.",
    "STRICT REQUIREMENTS: include schema, mode, addTask, updateTaskLabels, updateTaskDue, createSubtask.",
    "STRICT REQUIREMENTS: no unknown keys anywhere (additionalProperties=false).",
    "STRICT REQUIREMENTS: addTask items require ref + content.",
    "STRICT REQUIREMENTS: createSubtask items require ref + content + (parent_ref or parent_task_id).",
    "STRICT REQUIREMENTS: updateTaskLabels items require task_ref + labels[].",
    "STRICT REQUIREMENTS: updateTaskDue items require task_ref + due_string.",
    "STRICT REQUIREMENTS: for date planning use schedule object in addTask/createSubtask items.",
    "STRICT REQUIREMENTS: schedule keys only: anchor, weekday_iso, week_offset, date, time_hhmm.",
    "STRICT REQUIREMENTS: schedule.anchor must be next_weekday or absolute_date.",
    "STRICT REQUIREMENTS: schedule.anchor=next_weekday requires weekday_iso (1..7).",
    "STRICT REQUIREMENTS: schedule.anchor=absolute_date requires date (YYYY-MM-DD).",
    "STRICT REQUIREMENTS: schedule.time_hhmm, when used, must be HH:MM (24h).",
    "STRICT REQUIREMENTS: schedule.week_offset (0..12) means extra weeks after first matching future weekday.",
    "STRICT REQUIREMENTS: project_name must exactly match one of Available projects names.",
    "STRICT REQUIREMENTS: each label in labels[] must exactly match one of Available labels names.",
    "STRICT REQUIREMENTS: choose labels by theme of EACH individual task text, not by global plan.",
    "STRICT REQUIREMENTS: if label 'Работа' exists, use it for work/business/dev/distribution/discord roles tasks.",
    "STRICT REQUIREMENTS: if label 'Жизнь' exists, use it for health/personal/life tasks.",
    "STRICT REQUIREMENTS: if no clear thematic label match, keep labels as empty array.",
    "STRICT REQUIREMENTS: do not invent tasks or topics not explicitly present in user request.",
    "STRICT REQUIREMENTS: keep task wording close to user text; avoid generic summaries.",
    "STRICT REQUIREMENTS: for weekly_plan/monthly_plan, every addTask item must include schedule.",
    "STRICT REQUIREMENTS: updateTaskDue should be [] for newly created tasks (use schedule on addTask/createSubtask).",
    "STRICT REQUIREMENTS: when user gives weekday set (e.g. Monday, Wednesday, Friday), due weekday must be exactly one of those weekdays.",
    "STRICT REQUIREMENTS: never replace requested weekdays with neighboring weekdays.",
    "STRICT REQUIREMENTS: before output, self-check each schedule.weekday_iso against source text weekday.",
    "DATE RULE: compute schedule relative to Current datetime and User timezone.",
    "DATE RULE: weekday mention => anchor=next_weekday and weekday_iso by exact weekday mapping.",
    "DATE RULE: week_offset=0 means first strictly future occurrence of that weekday.",
    "DATE RULE: if today is Tuesday and task says Wednesday -> weekday_iso=3 and week_offset=0.",
    "DATE RULE: if today is after Monday and task says Monday -> weekday_iso=1 and week_offset=0 (next week).",
    "DATE RULE: for monthly_plan expand recurring weekday activities into concrete tasks for 4 weeks using week_offset=0..3.",
    "DATE RULE: do not use a single end-of-month due date for all tasks unless user explicitly asks so.",
    "WEEKDAY MAP (ISO): Monday=1 Tuesday=2 Wednesday=3 Thursday=4 Friday=5 Saturday=6 Sunday=7.",
    "WEEKDAY MAP (RU): понедельник=1, вторник=2, среда=3, четверг=4, пятница=5, суббота=6, воскресенье=7.",
    `TODAY CONTEXT (computed in JS): date=${todayInfo.isoDate}, weekday_name=${todayInfo.weekdayName}, weekday_js_sun0=${todayInfo.weekdayJs}, weekday_monday0=${todayInfo.weekdayMonday0}, weekday_iso_mon1=${todayInfo.weekdayIso}.`,
    "PROJECT RULE: set project_name to 'Срочные задачи' for all addTask items when this project exists.",
    "Never create projects or labels. Use only existing project_name and labels from provided lists.",
    "If label is uncertain, use an empty labels array.",
    "For due_string: leave empty when schedule is provided. due_string is reserved for explicit absolute date text if needed.",
    "For createSubtask use parent_ref (from addTask.ref) or parent_task_id (existing Todoist task id).",
    `Current datetime: ${new Date().toISOString()}. User timezone: ${todayInfo.timezone}.`,
    "Available projects:",
    projectList,
    "Available projects JSON (source of truth):",
    projectsJson,
    "Available labels:",
    labelList,
    "Available labels JSON (source of truth):",
    labelsJson
  ].join("\n");
}

function buildUserPrompt({ text }) {
  return [
    "Convert user request into Todoist JSON plan.",
    "Return JSON only.",
    "Use only what user explicitly requested. No extra goals.",
    "User request:",
    text
  ].join("\n");
}

function quoteOrDash(value) {
  return value ? value : "-";
}

function truncateText(value, maxLength = 120) {
  const s = asString(value);
  if (s.length <= maxLength) return s;
  return `${s.slice(0, maxLength - 3)}...`;
}

function pushLimitedDetails(lines, title, items, formatter) {
  if (items.length === 0) return;
  lines.push("");
  lines.push(title);
  const limit = Math.min(items.length, MAX_REPORT_DETAILS);
  for (let i = 0; i < limit; i++) {
    lines.push(`${i + 1}. ${formatter(items[i])}`);
  }
  if (items.length > limit) {
    lines.push(`... and ${items.length - limit} more`);
  }
}

export function isAiActivationPhrase(text) {
  const s = asString(text);
  if (!s) return false;
  return ACTIVATION_PATTERNS.some((re) => re.test(s));
}

export async function requestAiTaskPlan({
  text,
  timezone,
  projects,
  labels,
  aiUrl,
  aiApiKey,
  aiModel
}) {
  if (!asString(aiUrl) || !asString(aiApiKey) || !asString(aiModel)) {
    throw new Error("AI_CONFIG_INCOMPLETE");
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${aiApiKey}`
  };

  const body = {
    model: aiModel,
    temperature: 0.1,
    messages: [
      { role: "system", content: buildSystemPrompt({ projects, labels, timezone }) },
      { role: "user", content: buildUserPrompt({ text }) }
    ],
    response_format: { type: "json_object" }
  };

  let responseData;
  try {
    const response = await axios.post(aiUrl, body, { headers, timeout: 120000 });
    responseData = response.data;
  } catch (error) {
    const status = error?.response?.status;
    if (status === 400 || status === 422) {
      const fallbackBody = { ...body };
      delete fallbackBody.response_format;
      const response = await axios.post(aiUrl, fallbackBody, { headers, timeout: 120000 });
      responseData = response.data;
    } else {
      throw error;
    }
  }

  const rawContent = getContentFromModelResponse(responseData);
  const parsed = extractJsonObject(rawContent);
  if (!parsed) {
    throw new Error("AI_JSON_NOT_FOUND");
  }

  const schemaErrors = validateTaskPlanSchema(parsed);
  if (schemaErrors.length > 0) {
    throw new Error(`AI_SCHEMA_INVALID: ${summarizeSchemaErrors(schemaErrors)}`);
  }

  return {
    rawContent,
    plan: normalizePlan(parsed)
  };
}

function buildLabelSystemPrompt({ labelNames }) {
  const hasWork = labelNames.some((n) => normalizeName(n) === normalizeName("Работа"));
  const hasLife = labelNames.some((n) => normalizeName(n) === normalizeName("Жизнь"));
  return [
    "You classify Todoist labels for ONE task.",
    "Return JSON object only.",
    "Allowed top-level keys only: labels.",
    "labels must be an array of strings.",
    "Use ONLY labels from the allowed list below. Never invent labels.",
    "Classify by the topic of THIS task text.",
    "Prefer at least one label if any allowed label is semantically close.",
    "Return empty array only when there is truly no thematic match.",
    "Prefer a small set of labels (0-2).",
    hasWork
      ? "If task is about work/dev/coding/content/distribution/discord roles, prefer label 'Работа'."
      : "No special 'Работа' rule available.",
    hasLife
      ? "If task is about health/sport/walk/breathing/personal routine, prefer label 'Жизнь'."
      : "No special 'Жизнь' rule available.",
    "Allowed labels:",
    ...labelNames.map((n) => `- ${n}`)
  ].join("\n");
}

function buildLabelUserPrompt({ itemType, content, parentContent, sourceText }) {
  return [
    "Classify labels for this item.",
    `Item type: ${itemType}`,
    `Item text: ${content}`,
    `Parent task text: ${parentContent || "-"}`,
    `Original user request: ${sourceText || "-"}`
  ].join("\n");
}

function normalizeLabelDecision(parsed, labelLookup) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
  const rawLabels = [];
  if (Array.isArray(parsed.labels)) rawLabels.push(...parsed.labels);
  if (typeof parsed.label === "string") rawLabels.push(parsed.label);
  if (typeof parsed.labels === "string") rawLabels.push(parsed.labels);

  const out = [];
  const seen = new Set();
  for (const raw of rawLabels) {
    const s = asString(raw);
    if (!s) continue;
    const key = s.toLocaleLowerCase();
    const resolved = labelLookup.get(key);
    if (!resolved) continue;
    const resolvedKey = resolved.toLocaleLowerCase();
    if (seen.has(resolvedKey)) continue;
    seen.add(resolvedKey);
    out.push(resolved);
  }
  return out;
}

async function requestAiLabelsForItem({
  itemType,
  content,
  parentContent,
  sourceText,
  labelNames,
  labelLookup,
  aiUrl,
  aiApiKey,
  aiModel
}) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${aiApiKey}`
  };

  const body = {
    model: aiModel,
    temperature: 0,
    messages: [
      { role: "system", content: buildLabelSystemPrompt({ labelNames }) },
      {
        role: "user",
        content: buildLabelUserPrompt({ itemType, content, parentContent, sourceText })
      }
    ],
    response_format: { type: "json_object" }
  };

  let responseData;
  try {
    const response = await axios.post(aiUrl, body, { headers, timeout: 45000 });
    responseData = response.data;
  } catch (error) {
    const status = error?.response?.status;
    if (status === 400 || status === 422) {
      const fallbackBody = { ...body };
      delete fallbackBody.response_format;
      const response = await axios.post(aiUrl, fallbackBody, { headers, timeout: 45000 });
      responseData = response.data;
    } else {
      throw error;
    }
  }

  const rawContent = getContentFromModelResponse(responseData);
  const parsed = extractJsonObject(rawContent);
  if (!parsed) {
    throw new Error("AI_LABEL_JSON_NOT_FOUND");
  }

  return normalizeLabelDecision(parsed, labelLookup);
}

export async function enrichResolvedPlanLabelsByAI(
  resolvedPlan,
  { availableLabels, aiUrl, aiApiKey, aiModel, sourceText = "", maxItems = 200 } = {}
) {
  const labelsInput = asArray(availableLabels);
  const labelNames = uniqueStrings(labelsInput.map((l) => asString(l?.name)).filter(Boolean));
  if (labelNames.length === 0) {
    return resolvedPlan;
  }

  if (!asString(aiUrl) || !asString(aiApiKey) || !asString(aiModel)) {
    return {
      ...resolvedPlan,
      warnings: uniqueStrings([...(resolvedPlan.warnings || []), "AI label pass skipped: incomplete config"])
    };
  }

  const labelLookup = new Map(labelNames.map((n) => [n.toLocaleLowerCase(), n]));
  const warnings = [...asArray(resolvedPlan.warnings)];
  const taskByRef = new Map(asArray(resolvedPlan.tasks).map((t) => [asString(t.ref), t]));
  const cache = new Map();

  let processed = 0;
  const classify = async (itemType, content, parentContent, existingLabels, ref) => {
    if (processed >= maxItems) return existingLabels;
    const cacheKey = `${itemType}|${normalizeName(content)}|${normalizeName(parentContent)}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);

    processed++;
    try {
      const decidedLabels = await requestAiLabelsForItem({
        itemType,
        content,
        parentContent,
        sourceText,
        labelNames,
        labelLookup,
        aiUrl,
        aiApiKey,
        aiModel
      });
      const fallbackLabels = uniqueStrings(existingLabels);
      const finalLabels = decidedLabels.length > 0 ? decidedLabels : fallbackLabels;
      cache.set(cacheKey, finalLabels);
      return finalLabels;
    } catch (error) {
      warnings.push(`AI label pass failed for ${ref}: ${error?.message || "unknown_error"}`);
      cache.set(cacheKey, existingLabels);
      return existingLabels;
    }
  };

  const tasks = [];
  for (const task of asArray(resolvedPlan.tasks)) {
    const labels = await classify(
      "task",
      task.content,
      "",
      asArray(task.labels),
      asString(task.ref) || task.content
    );
    tasks.push({ ...task, labels: uniqueStrings(labels) });
  }

  const subtasks = [];
  for (const subtask of asArray(resolvedPlan.subtasks)) {
    const parentContent =
      taskByRef.get(asString(subtask.parentRef))?.content ||
      taskByRef.get(asString(subtask.parentTaskId))?.content ||
      "";
    const labels = await classify(
      "subtask",
      subtask.content,
      parentContent,
      asArray(subtask.labels),
      asString(subtask.ref) || subtask.content
    );
    subtasks.push({ ...subtask, labels: uniqueStrings(labels) });
  }

  return {
    ...resolvedPlan,
    tasks,
    subtasks,
    warnings: uniqueStrings(warnings)
  };
}

function resolveProject(projectName, projects) {
  const requested = asString(projectName);
  const defaultProject = projects.find((p) => normalizeName(p.name) === normalizeName(URGENT_PROJECT_NAME_RU)) || projects[0] || null;

  if (FORCE_PROJECT_TO_URGENT) {
    return { project: defaultProject, fallback: false, requested };
  }

  if (!requested) {
    return { project: defaultProject, fallback: true, requested: "" };
  }

  const exact = projects.find((p) => normalizeName(p.name) === normalizeName(requested));
  if (exact) return { project: exact, fallback: false, requested };

  const partial = projects.filter((p) => normalizeName(p.name).includes(normalizeName(requested)));
  if (partial.length === 1) return { project: partial[0], fallback: true, requested };

  return { project: defaultProject, fallback: true, requested };
}

function resolveLabels(labelNames, labels, warnings, contextRef) {
  const requested = uniqueStrings(labelNames);
  const lookup = new Map(labels.map((l) => [normalizeName(l.name), l.name]));
  const resolved = [];

  for (const label of requested) {
    const key = normalizeName(label);
    if (lookup.has(key)) {
      resolved.push(lookup.get(key));
    } else {
      warnings.push(`Label '${label}' not found for ${contextRef}, skipped`);
    }
  }

  return uniqueStrings(resolved);
}

function addDaysToIsoDate(isoDate, days) {
  if (!isIsoDateString(isoDate) || !Number.isInteger(days)) return null;
  const [year, month, day] = isoDate.split("-").map((x) => Number(x));
  const utc = new Date(Date.UTC(year, month - 1, day + days, 0, 0, 0, 0));
  return utc.toISOString().slice(0, 10);
}

function buildDueString(date, timeHhmm) {
  if (!isIsoDateString(date)) return null;
  if (!timeHhmm) return date;
  if (!isTimeString(timeHhmm)) return null;
  return `${date} ${timeHhmm}`;
}

function computeDueStringFromSchedule(schedule, todayInfo, warnings, contextRef) {
  const normalized = normalizeSchedule(schedule);
  if (!normalized) return null;

  if (normalized.time_hhmm && !isTimeString(normalized.time_hhmm)) {
    warnings.push(`Invalid schedule.time_hhmm for ${contextRef}: '${normalized.time_hhmm}'`);
    return null;
  }

  if (normalized.anchor === "absolute_date") {
    if (!isIsoDateString(normalized.date)) {
      warnings.push(`Invalid schedule.date for ${contextRef}: '${normalized.date || ""}'`);
      return null;
    }
    return buildDueString(normalized.date, normalized.time_hhmm);
  }

  if (normalized.anchor === "next_weekday") {
    const weekdayIso = toInteger(normalized.weekday_iso);
    if (weekdayIso == null || weekdayIso < 1 || weekdayIso > 7) {
      warnings.push(`Invalid schedule.weekday_iso for ${contextRef}: '${normalized.weekday_iso ?? ""}'`);
      return null;
    }

    let weekOffset = toInteger(normalized.week_offset);
    if (weekOffset == null || weekOffset < 0) weekOffset = 0;
    if (weekOffset > 12) {
      warnings.push(`schedule.week_offset capped to 12 for ${contextRef}`);
      weekOffset = 12;
    }

    let deltaDays = weekdayIso - todayInfo.weekdayIso;
    if (deltaDays <= 0) deltaDays += 7;
    deltaDays += weekOffset * 7;

    const targetDate = addDaysToIsoDate(todayInfo.isoDate, deltaDays);
    if (!targetDate) {
      warnings.push(`Could not compute target date for ${contextRef} from schedule`);
      return null;
    }
    return buildDueString(targetDate, normalized.time_hhmm);
  }

  warnings.push(`Schedule for ${contextRef} is incomplete, fallback to due_string`);
  return null;
}

export function resolveAiTaskPlan(plan, { projects, labels }) {
  const warnings = [...asArray(plan?.warnings)];
  const dueByRef = new Map();
  const labelsByRef = new Map();
  const mode = asString(plan?.mode) || "batch";
  const todayInfo = getTodayInfo(asString(plan?.timezone) || "UTC");

  asArray(plan?.updateTaskDue).forEach((op) => {
    const taskRef = asString(op.task_ref);
    const dueString = asString(op.due_string);
    if (taskRef && dueString) {
      dueByRef.set(taskRef, dueString);
    }
  });

  asArray(plan?.updateTaskLabels).forEach((op) => {
    labelsByRef.set(asString(op.task_ref), uniqueStrings(asArray(op.labels)));
  });

  const tasks = asArray(plan?.addTask).map((task) => {
    const ref = asString(task.ref);
    const projectResolution = resolveProject(task.project_name, projects);

    if (!projectResolution.project) {
      warnings.push(`No available projects for task '${task.content}'`);
    } else if (projectResolution.fallback && projectResolution.requested) {
      warnings.push(
        `Project '${projectResolution.requested}' not found, ${ref} fallback to '${projectResolution.project.name}'`
      );
    }

    const mergedLabels = uniqueStrings([
      ...asArray(task.labels),
      ...asArray(labelsByRef.get(ref))
    ]);
    const schedule = normalizeSchedule(task.schedule);
    const computedDueString = computeDueStringFromSchedule(schedule, todayInfo, warnings, ref || task.content);
    const fallbackDueString = asString(dueByRef.get(ref) || task.due_string);
    const dueString = computedDueString || fallbackDueString || null;

    if ((mode === "weekly_plan" || mode === "monthly_plan") && !dueString) {
      warnings.push(`No due date resolved for ${ref || task.content}`);
    }

    return {
      ref,
      content: task.content,
      projectName: projectResolution.project?.name || null,
      projectId: projectResolution.project?.id || null,
      dueString,
      schedule,
      labels: resolveLabels(mergedLabels, labels, warnings, ref)
    };
  });

  const subtasks = asArray(plan?.createSubtask).map((subtask) => {
    const ref = asString(subtask.ref);
    const mergedLabels = uniqueStrings([
      ...asArray(subtask.labels),
      ...asArray(labelsByRef.get(ref))
    ]);
    const schedule = normalizeSchedule(subtask.schedule);
    const computedDueString = computeDueStringFromSchedule(schedule, todayInfo, warnings, ref || subtask.content);
    const fallbackDueString = asString(dueByRef.get(ref) || subtask.due_string);

    return {
      ref,
      parentRef: asString(subtask.parent_ref) || null,
      parentTaskId: asString(subtask.parent_task_id) || null,
      content: subtask.content,
      dueString: computedDueString || fallbackDueString || null,
      schedule,
      labels: resolveLabels(mergedLabels, labels, warnings, ref)
    };
  });

  return {
    schema: asString(plan?.schema) || PLAN_SCHEMA,
    mode,
    requestId: asString(plan?.request_id),
    timezone: todayInfo.timezone,
    tasks,
    subtasks,
    warnings: uniqueStrings(warnings)
  };
}

export function hasResolvedWork(resolvedPlan) {
  return asArray(resolvedPlan?.tasks).length > 0 || asArray(resolvedPlan?.subtasks).length > 0;
}

export function buildAiPreviewText(resolvedPlan) {
  const lines = [];
  lines.push("AI: plan preview");
  lines.push(`Schema: ${quoteOrDash(resolvedPlan.schema)}`);
  lines.push(`Mode: ${quoteOrDash(resolvedPlan.mode)}`);
  if (resolvedPlan.requestId) lines.push(`Request ID: ${resolvedPlan.requestId}`);
  if (resolvedPlan.timezone) lines.push(`Timezone: ${resolvedPlan.timezone}`);
  lines.push("");

  if (resolvedPlan.tasks.length === 0) {
    lines.push("Tasks: none");
  } else {
    lines.push(`Tasks (${resolvedPlan.tasks.length}):`);
    const limit = Math.min(resolvedPlan.tasks.length, MAX_PREVIEW_ITEMS);
    for (let i = 0; i < limit; i++) {
      const task = resolvedPlan.tasks[i];
      lines.push(`${i + 1}. ${truncateText(task.content)}`);
      lines.push(`   ref: ${task.ref}`);
      lines.push(`   project: ${quoteOrDash(task.projectName)}`);
      lines.push(`   labels: ${task.labels.length ? task.labels.map((l) => `#${l}`).join(", ") : "-"}`);
      lines.push(`   due: ${quoteOrDash(task.dueString)}`);
    }
    if (resolvedPlan.tasks.length > limit) {
      lines.push(`... and ${resolvedPlan.tasks.length - limit} more tasks`);
    }
  }

  lines.push("");
  if (resolvedPlan.subtasks.length === 0) {
    lines.push("Subtasks: none");
  } else {
    lines.push(`Subtasks (${resolvedPlan.subtasks.length}):`);
    const limit = Math.min(resolvedPlan.subtasks.length, MAX_PREVIEW_ITEMS);
    for (let i = 0; i < limit; i++) {
      const subtask = resolvedPlan.subtasks[i];
      lines.push(`${i + 1}. ${truncateText(subtask.content)}`);
      lines.push(`   ref: ${subtask.ref}`);
      lines.push(`   parent: ${subtask.parentRef ? `ref:${subtask.parentRef}` : `id:${subtask.parentTaskId}`}`);
      lines.push(`   labels: ${subtask.labels.length ? subtask.labels.map((l) => `#${l}`).join(", ") : "-"}`);
      lines.push(`   due: ${quoteOrDash(subtask.dueString)}`);
    }
    if (resolvedPlan.subtasks.length > limit) {
      lines.push(`... and ${resolvedPlan.subtasks.length - limit} more subtasks`);
    }
  }

  if (resolvedPlan.warnings.length > 0) {
    lines.push("");
    lines.push("Warnings:");
    const limit = Math.min(resolvedPlan.warnings.length, MAX_PREVIEW_ITEMS);
    for (let i = 0; i < limit; i++) {
      lines.push(`${i + 1}. ${resolvedPlan.warnings[i]}`);
    }
    if (resolvedPlan.warnings.length > limit) {
      lines.push(`... and ${resolvedPlan.warnings.length - limit} more warnings`);
    }
  }

  lines.push("");
  lines.push("Confirm creation?");
  return lines.join("\n");
}

function resolveTaskId(taskRef, refToId) {
  const ref = asString(taskRef);
  if (!ref) return null;
  if (refToId.has(ref)) return refToId.get(ref);
  return ref;
}

export async function executeAiResolvedPlan(resolvedPlan, api) {
  const report = {
    createdTasks: [],
    failedTasks: [],
    createdSubtasks: [],
    failedSubtasks: [],
    updatedDue: [],
    failedDue: [],
    updatedLabels: [],
    failedLabels: [],
    warnings: [...resolvedPlan.warnings]
  };

  const refToId = new Map();

  for (const task of resolvedPlan.tasks) {
    if (!task.projectId) {
      report.failedTasks.push({ ref: task.ref, content: task.content, reason: "project_not_found" });
      continue;
    }

    try {
      const created = await api.addTask(task.projectId, task.content, null, null);
      const createdId = created?.id ? String(created.id) : null;
      if (!createdId) {
        report.failedTasks.push({ ref: task.ref, content: task.content, reason: "missing_created_id" });
        continue;
      }

      refToId.set(task.ref, createdId);
      report.createdTasks.push({ ref: task.ref, id: createdId, content: task.content, project: task.projectName });
    } catch (error) {
      report.failedTasks.push({
        ref: task.ref,
        content: task.content,
        reason: error?.message || "addTask_failed"
      });
    }
  }

  const pendingSubtasks = [...resolvedPlan.subtasks];
  let attemptsLeft = pendingSubtasks.length + 2;

  while (pendingSubtasks.length > 0 && attemptsLeft > 0) {
    attemptsLeft--;
    let progress = false;

    for (let i = pendingSubtasks.length - 1; i >= 0; i--) {
      const subtask = pendingSubtasks[i];
      const parentId = subtask.parentTaskId || refToId.get(subtask.parentRef);
      if (!parentId) continue;

      try {
        const created = await api.createSubtask(parentId, subtask.content, null);
        const createdId = created?.id ? String(created.id) : null;
        if (!createdId) {
          report.failedSubtasks.push({
            ref: subtask.ref,
            content: subtask.content,
            parent: subtask.parentRef || subtask.parentTaskId,
            reason: "missing_created_id"
          });
          pendingSubtasks.splice(i, 1);
          progress = true;
          continue;
        }

        refToId.set(subtask.ref, createdId);
        report.createdSubtasks.push({
          ref: subtask.ref,
          id: createdId,
          content: subtask.content,
          parent: subtask.parentRef || subtask.parentTaskId
        });
      } catch (error) {
        report.failedSubtasks.push({
          ref: subtask.ref,
          content: subtask.content,
          parent: subtask.parentRef || subtask.parentTaskId,
          reason: error?.message || "createSubtask_failed"
        });
      }

      pendingSubtasks.splice(i, 1);
      progress = true;
    }

    if (!progress) break;
  }

  for (const subtask of pendingSubtasks) {
    report.failedSubtasks.push({
      ref: subtask.ref,
      content: subtask.content,
      parent: subtask.parentRef || subtask.parentTaskId,
      reason: "parent_not_resolved"
    });
  }

  const allEntities = [
    ...resolvedPlan.tasks.map((x) => ({ ref: x.ref, labels: x.labels, dueString: x.dueString })),
    ...resolvedPlan.subtasks.map((x) => ({ ref: x.ref, labels: x.labels, dueString: x.dueString }))
  ];

  for (const entity of allEntities) {
    const taskId = resolveTaskId(entity.ref, refToId);
    if (!taskId) continue;

    if (entity.dueString) {
      try {
        await api.updateTaskDue(taskId, entity.dueString);
        report.updatedDue.push({ taskId, ref: entity.ref, dueString: entity.dueString });
      } catch (error) {
        report.failedDue.push({
          taskId,
          ref: entity.ref,
          dueString: entity.dueString,
          reason: error?.message || "updateTaskDue_failed"
        });
      }
    }

    if (entity.labels && entity.labels.length > 0) {
      try {
        await api.updateTaskLabels(taskId, entity.labels);
        report.updatedLabels.push({ taskId, ref: entity.ref, labels: entity.labels });
      } catch (error) {
        report.failedLabels.push({
          taskId,
          ref: entity.ref,
          labels: entity.labels,
          reason: error?.message || "updateTaskLabels_failed"
        });
      }
    }
  }

  return report;
}

export function formatAiExecutionReport(report) {
  const lines = [];
  lines.push("AI: execution report");
  lines.push(`Tasks created: ${report.createdTasks.length}`);
  lines.push(`Task errors: ${report.failedTasks.length}`);
  lines.push(`Subtasks created: ${report.createdSubtasks.length}`);
  lines.push(`Subtask errors: ${report.failedSubtasks.length}`);
  lines.push(`Due updates: ${report.updatedDue.length}`);
  lines.push(`Due errors: ${report.failedDue.length}`);
  lines.push(`Label updates: ${report.updatedLabels.length}`);
  lines.push(`Label errors: ${report.failedLabels.length}`);

  pushLimitedDetails(
    lines,
    "Task errors:",
    report.failedTasks,
    (x) => `[${x.ref}] ${x.content} -> ${x.reason}`
  );
  pushLimitedDetails(
    lines,
    "Subtask errors:",
    report.failedSubtasks,
    (x) => `[${x.ref}] ${x.content} (parent: ${x.parent}) -> ${x.reason}`
  );
  pushLimitedDetails(
    lines,
    "Due errors:",
    report.failedDue,
    (x) => `[${x.ref}] ${x.dueString} -> ${x.reason}`
  );
  pushLimitedDetails(
    lines,
    "Label errors:",
    report.failedLabels,
    (x) => `[${x.ref}] ${(x.labels || []).join(", ")} -> ${x.reason}`
  );
  pushLimitedDetails(lines, "Warnings:", report.warnings, (x) => x);

  return lines.join("\n");
}
