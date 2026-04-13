// bff/services/boardRoomService.mjs
// Board Room core — thread CRUD, post CRUD, agent memory, JSONL logger
// Data store: Redis (board-room:* prefix keys)
// Audit log: board-room/logs/board_YYYY-MM-DD.jsonl

import { createClient } from 'redis';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  unlinkSync,
} from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function getLogDir() {
  return process.env.BOARD_ROOM_LOG_DIR || join(__dirname, '../../board-room/logs');
}

function getArchiveDir() {
  return process.env.BOARD_ROOM_LOG_ARCHIVE_DIR || join(__dirname, '../../board-room/archive/dvc');
}

// ─── Redis Client ───────────────────────────────────────────────────────────
let _redis = null;

function getRedis() {
  if (!_redis) {
    _redis = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
    _redis.on('error', (err) => console.error('[boardRoom] Redis error:', err.message));
    _redis.connect().catch((err) => console.error('[boardRoom] Redis connect failed:', err.message));
  }
  return _redis;
}

async function redisGet(key) {
  try {
    const client = getRedis();
    const val = await client.get(key);
    return val ? JSON.parse(val) : null;
  } catch { return null; }
}

async function redisSet(key, value, ttl = null) {
  try {
    const client = getRedis();
    if (ttl) await client.setEx(key, ttl, JSON.stringify(value));
    else await client.set(key, JSON.stringify(value));
  } catch { /* fail silent */ }
}

async function redisZadd(key, score, member) {
  try {
    const client = getRedis();
    await client.zAdd(key, { score, value: member });
  } catch { /* fail silent */ }
}

async function redisZrange(key, min, max) {
  try {
    const client = getRedis();
    return await client.zRange(key, min, max);
  } catch { return []; }
}

async function redisIncr(key) {
  try {
    const client = getRedis();
    return await client.incr(key);
  } catch { return 1; }
}

// ─── ID Generation ───────────────────────────────────────────────────────────
async function nextThreadId() {
  const id = await redisIncr('board-room:meta:threadCount');
  return `T${String(id).padStart(5, '0')}`;
}

async function nextPostIdForThread(threadId) {
  const id = await redisIncr(`board-room:meta:${threadId}:postCount`);
  return `${threadId}-P${String(id).padStart(5, '0')}`;
}

async function nextTaskId() {
  const id = await redisIncr('board-room:meta:taskCount');
  return `TK${String(id).padStart(5, '0')}`;
}

// ─── JSONL Logger ───────────────────────────────────────────────────────────
function getTodayLogFile() {
  const date = new Date().toISOString().slice(0, 10);
  return join(getLogDir(), `board_${date}.jsonl`);
}

function logToJsonl(entry) {
  try {
    const logDir = getLogDir();
    if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
    const line = JSON.stringify({ ts: new Date().toISOString(), ...entry });
    appendFileSync(getTodayLogFile(), line + '\n');
  } catch (err) {
    console.error('[boardRoom] JSONL log write failed:', err.message);
  }
}

function parseBoardRoomLogDate(fileName) {
  const match = /^board_(\d{4}-\d{2}-\d{2})\.jsonl$/i.exec(String(fileName || ''));
  if (!match) return null;
  const timestamp = Date.parse(`${match[1]}T00:00:00.000Z`);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function archiveOldLogs({ now = new Date(), retentionDays = 90 } = {}) {
  const logDir = getLogDir();
  const archiveDir = getArchiveDir();
  if (!existsSync(logDir)) {
    return { archived: [] };
  }

  if (!existsSync(archiveDir)) {
    mkdirSync(archiveDir, { recursive: true });
  }

  const cutoffMs = now.getTime() - retentionDays * 24 * 60 * 60 * 1000;
  const archived = [];

  for (const fileName of readdirSync(logDir)) {
    const fileDateMs = parseBoardRoomLogDate(fileName);
    if (fileDateMs === null || fileDateMs >= cutoffMs) continue;

    const sourcePath = join(logDir, fileName);
    const targetPath = join(archiveDir, fileName);

    if (existsSync(targetPath)) {
      unlinkSync(sourcePath);
    } else {
      renameSync(sourcePath, targetPath);
    }
    archived.push(fileName);
  }

  if (archived.length > 0) {
    logToJsonl({
      type: 'jsonl_log_archived',
      archivedCount: archived.length,
      files: archived,
      archiveDir,
    });
  }

  return { archived };
}

// ─── Content Validation ─────────────────────────────────────────────────────
function validateContent(content) {
  if (typeof content !== 'string') return { valid: false, reason: 'content must be string' };
  const trimmed = content.trim();
  if (trimmed.length === 0) return { valid: false, reason: 'content cannot be empty' };
  if (trimmed.length > 10000) return { valid: false, reason: 'content exceeds 10000 chars' };
  const prefix = trimmed.substring(0, 2);
  if (prefix === '{"' || prefix === '[{') {
    try { JSON.parse(trimmed); }
    catch { return { valid: false, reason: 'invalid JSON content' }; }
  }
  return { valid: true };
}

// ─── Thread CRUD ─────────────────────────────────────────────────────────────
function sortThreadsByActivity(threads = []) {
  return [...threads].sort((left, right) => (right.lastActivityAt || 0) - (left.lastActivityAt || 0));
}

async function loadAllThreads() {
  const client = getRedis();
  const keys = (await client.keys('board-room:threads/T*')) || [];
  const threads = [];

  for (const key of keys) {
    const thread = await redisGet(key);
    if (!thread) continue;
    threads.push(thread);
  }

  return threads;
}

async function createThread({
  title,
  description,
  priority,
  tags,
  ownerAgent,
  createdBy,
  tasks = [],
  parentThreadId = null,
}) {
  const threadId = await nextThreadId();
  const now = Date.now();
  const normalizedParentThreadId = typeof parentThreadId === 'string' && parentThreadId.trim()
    ? parentThreadId.trim().toUpperCase()
    : null;
  if (normalizedParentThreadId) {
    const parentThread = await getThread(normalizedParentThreadId);
    if (!parentThread) return null;
  }
  const thread = {
    threadId, title,
    description: description || '',
    priority: priority || 'MEDIUM',
    tags: tags || [],
    ownerAgent,
    createdBy,
    parentThreadId: normalizedParentThreadId,
    status: 'OPEN',
    createdAt: now,
    closedAt: null,
    closedBy: null,
    closureCommit: null,
    closurePR: null,
    staleWarningSent: false,
    lastActivityAt: now,
  };
  await redisSet(`board-room:threads/${threadId}`, thread);
  // Initial post from description
  if (description && description.trim()) {
    await createPost({ threadId, author: createdBy, authorType: createdBy === 'ceo' ? 'human' : 'agent', content: description, type: 'comment' });
  }
  // Create tasks
  for (const task of tasks) {
    await createTask({ threadId, description: task.description, done: !!task.done });
  }
  await updateAgentMemory(ownerAgent, {
    threadsOwned: { op: 'add', id: threadId },
    currentThread: threadId,
  });
  await syncThreadOwnerTaskCount(threadId);
  if (normalizedParentThreadId) {
    await createPost({
      threadId: normalizedParentThreadId,
      author: createdBy,
      authorType: createdBy === 'ceo' ? 'human' : 'agent',
      content: JSON.stringify({
        type: 'sub_thread_opened',
        childThreadId: threadId,
        childTitle: title,
        ownerAgent,
        priority: thread.priority,
      }),
      type: 'milestone',
    });
    logToJsonl({
      type: 'sub_thread_opened',
      threadId,
      parentThreadId: normalizedParentThreadId,
      agent: ownerAgent,
      title,
      priority: thread.priority,
    });
  }
  logToJsonl({ type: 'thread_opened', agent: ownerAgent, threadId, title, priority });
  return thread;
}

async function getThread(threadId) {
  return await redisGet(`board-room:threads/${threadId}`);
}

async function getThreads(status = 'OPEN') {
  const threads = await loadAllThreads();
  const normalizedStatus = String(status || 'OPEN').toUpperCase();
  return sortThreadsByActivity(
    threads.filter((thread) => normalizedStatus === 'ALL' || thread.status === normalizedStatus),
  );
}

async function getAllOpenThreads() {
  return getThreads('OPEN');
}

async function getChildThreads(parentThreadId) {
  const normalizedParentThreadId = typeof parentThreadId === 'string' && parentThreadId.trim()
    ? parentThreadId.trim().toUpperCase()
    : null;
  if (!normalizedParentThreadId) return [];

  const threads = await loadAllThreads();
  return sortThreadsByActivity(
    threads.filter((thread) => thread.parentThreadId === normalizedParentThreadId),
  );
}

async function updateThread(threadId, updates) {
  const existing = await getThread(threadId);
  if (!existing) return null;
  const updated = { ...existing, ...updates, lastActivityAt: Date.now() };
  await redisSet(`board-room:threads/${threadId}`, updated);
  return updated;
}

async function closeThread({ threadId, closureCommit, closurePR, note, closedBy }) {
  const now = Date.now();
  const thread = await updateThread(threadId, {
    status: 'CLOSED',
    closedAt: now,
    closedBy,
    closureCommit: closureCommit || null,
    closurePR: closurePR || null,
  });
  if (note && note.trim()) {
    await createPost({ threadId, author: closedBy, authorType: 'human', content: note, type: 'comment' });
  }
  logToJsonl({ type: 'thread_closed', by: closedBy, threadId, closureCommit, closurePR });
  return thread;
}

// ─── Post CRUD ───────────────────────────────────────────────────────────────
async function createPost({ threadId, author, authorType = 'agent', content, type = 'comment', mentions = [], acknowledgmentRequired = false, acknowledgmentDeadline = null, planStatus = null, linkedCommit = null, linkedPR = null, response = null }) {
  const postId = await nextPostIdForThread(threadId);
  const now = Date.now();
  const post = {
    postId, threadId, author, authorType, content, type,
    timestamp: now,
    mentions: mentions || [],
    acknowledgmentRequired: !!acknowledgmentRequired,
    acknowledgedBy: null,
    acknowledgedAt: null,
    acknowledgmentDeadline: acknowledgmentDeadline || null,
    acknowledgedLate: null,
    planStatus,
    linkedCommit,
    linkedPR,
    response: response || null,
  };
  await redisSet(`board-room:posts/${postId}`, post);
  await redisZadd(`board-room:threads/${threadId}/posts`, now, postId);
  await updateThreadLastActivity(threadId);
  await updateAgentMemory(author, { lastSeen: now, currentThread: threadId });
  if (acknowledgmentRequired && mentions.length > 0) {
    for (const target of mentions) {
      await updateAgentMemory(target, { pendingAcknowledgments: { op: 'add', id: postId } });
    }
  }
  logToJsonl({ type: type === 'plan' ? 'plan_posted' : type, agent: author, threadId, postId, planStatus: planStatus || undefined });
  return post;
}

async function getPost(postId) {
  return await redisGet(`board-room:posts/${postId}`);
}

async function getThreadPosts(threadId) {
  const postIds = await redisZrange(`board-room:threads/${threadId}/posts`, 0, -1);
  const posts = [];
  for (const id of postIds) {
    const p = await redisGet(`board-room:posts/${id}`);
    if (p) posts.push(p);
  }
  return posts;
}

async function acknowledgePost({ postId, agent, response }) {
  const post = await getPost(postId);
  if (!post) return null;
  const now = Date.now();
  const updated = {
    ...post,
    acknowledgedBy: agent,
    acknowledgedAt: now,
    acknowledgedLate: post.acknowledgmentDeadline ? now > post.acknowledgmentDeadline : false,
    response: response || null,
  };
  await redisSet(`board-room:posts/${postId}`, updated);
  for (const target of post.mentions || []) {
    await updateAgentMemory(target, { pendingAcknowledgments: { op: 'remove', id: postId } });
  }
  await recordAgentAcknowledgment(agent, post);
  logToJsonl({ type: 'acknowledgment', agent, postId, response, late: updated.acknowledgedLate });
  return updated;
}

async function updatePostPlanStatus(postId, planStatus) {
  const post = await getPost(postId);
  if (!post) return null;
  const updated = { ...post, planStatus };
  await redisSet(`board-room:posts/${postId}`, updated);
  await recordPlanDecision(updated, planStatus);
  return updated;
}

// ─── Task CRUD ───────────────────────────────────────────────────────────────
async function createTask({ threadId, description, done = false, doneBy = null }) {
  const taskId = await nextTaskId();
  const now = Date.now();
  const task = { taskId, threadId, description, done, doneBy, doneAt: done ? now : null };
  await redisSet(`board-room:tasks/${taskId}`, task);
  await redisZadd(`board-room:threads/${threadId}/tasks`, 0, taskId);
  await syncThreadOwnerTaskCount(threadId);
  return task;
}

async function getTask(taskId) {
  return await redisGet(`board-room:tasks/${taskId}`);
}

async function getThreadTasks(threadId) {
  const taskIds = await redisZrange(`board-room:threads/${threadId}/tasks`, 0, -1);
  const tasks = [];
  for (const id of taskIds) {
    const t = await getTask(id);
    if (t) tasks.push(t);
  }
  return tasks;
}

async function toggleTask(taskId, doneBy) {
  const task = await getTask(taskId);
  if (!task) return null;
  const now = Date.now();
  const updated = { ...task, done: !task.done, doneBy, doneAt: !task.done ? now : null };
  await redisSet(`board-room:tasks/${taskId}`, updated);
  await syncThreadOwnerTaskCount(task.threadId);
  return updated;
}

// ─── Agent Memory ────────────────────────────────────────────────────────────
async function getAgentMemory(agent) {
  return await redisGet(`board-room:agent-memory/${agent}`) || {
    currentThread: null, lastSeen: null, lastHeartbeat: null,
    activeTaskCount: 0, pendingAcknowledgments: [], threadsOwned: [],
    totalPlansApproved: 0, totalPlansRejected: 0, avgAckTimeSeconds: 0, ackCount: 0,
  };
}

async function updateAgentMemory(agent, updates) {
  const current = await getAgentMemory(agent);
  const updated = { ...current, lastSeen: Date.now() };
  for (const [key, val] of Object.entries(updates)) {
    if (val && typeof val === 'object' && 'op' in val) {
      if (val.op === 'add') {
        if (!Array.isArray(updated[key])) updated[key] = [];
        if (!updated[key].includes(val.id)) updated[key].push(val.id);
      } else if (val.op === 'remove') {
        if (Array.isArray(updated[key])) updated[key] = updated[key].filter(id => id !== val.id);
      }
    } else {
      updated[key] = val;
    }
  }
  await redisSet(`board-room:agent-memory/${agent}`, updated);
  return updated;
}

async function recordAgentAcknowledgment(agent, post) {
  if (!agent) return null;
  const memory = await getAgentMemory(agent);
  const ackCount = Number(memory.ackCount || 0);
  const avgAckTimeSeconds = Number(memory.avgAckTimeSeconds || 0);
  const ackDurationSeconds = Math.max(
    0,
    Math.round((Date.now() - Number(post?.timestamp || Date.now())) / 1000),
  );
  const nextAckCount = ackCount + 1;
  const nextAverage = nextAckCount === 1
    ? ackDurationSeconds
    : ((avgAckTimeSeconds * ackCount) + ackDurationSeconds) / nextAckCount;

  return updateAgentMemory(agent, {
    avgAckTimeSeconds: Math.round(nextAverage),
    ackCount: nextAckCount,
    currentThread: post?.threadId || null,
  });
}

async function recordPlanDecision(post, planStatus) {
  if (!post?.author || post.author === 'ceo') return null;
  const memory = await getAgentMemory(post.author);
  if (planStatus === 'approved') {
    return updateAgentMemory(post.author, {
      totalPlansApproved: Number(memory.totalPlansApproved || 0) + 1,
      currentThread: post.threadId || null,
    });
  }
  if (planStatus === 'rejected') {
    return updateAgentMemory(post.author, {
      totalPlansRejected: Number(memory.totalPlansRejected || 0) + 1,
      currentThread: post.threadId || null,
    });
  }
  return null;
}

async function syncThreadOwnerTaskCount(threadId) {
  const thread = await getThread(threadId);
  if (!thread?.ownerAgent) return null;
  const tasks = await getThreadTasks(threadId);
  const activeTaskCount = tasks.filter((task) => !task.done).length;
  return updateAgentMemory(thread.ownerAgent, {
    activeTaskCount,
    currentThread: thread.status === 'OPEN' ? threadId : null,
  });
}

async function recordHeartbeat({ agent, status = 'active', focus = null, currentThreadId = null }) {
  const now = Date.now();
  const memory = await updateAgentMemory(agent, {
    lastHeartbeat: now,
    status,
    currentThread: currentThreadId || null,
    focus: focus || null,
  });

  logToJsonl({
    type: 'heartbeat',
    agent,
    threadId: currentThreadId || undefined,
    status,
    focus: focus || undefined,
  });

  return {
    agent,
    timestamp: now,
    currentThreadId: currentThreadId || null,
    memory,
  };
}

async function reportError({ agent, error, stack = null, severity = 'MEDIUM', threadId = null }) {
  let targetThreadId = threadId || null;
  let thread = targetThreadId ? await getThread(targetThreadId) : null;

  if (!thread) {
    thread = await createThread({
      title: `[${agent}] ${severity} error`,
      description: JSON.stringify({
        autoOpened: true,
        error,
        severity,
        stack: stack || null,
      }),
      priority: severity || 'MEDIUM',
      tags: ['error', String(severity || 'MEDIUM').toLowerCase(), String(agent || 'agent').toLowerCase()],
      ownerAgent: agent,
      createdBy: agent,
      tasks: [],
    });
    targetThreadId = thread.threadId;
  }

  const post = await createPost({
    threadId: targetThreadId,
    author: agent,
    authorType: 'agent',
    content: JSON.stringify({
      error,
      severity,
      stack: stack || null,
    }),
    type: 'error',
  });

  logToJsonl({
    type: 'error',
    agent,
    threadId: targetThreadId,
    severity,
    message: String(error || '').substring(0, 240),
  });

  return { thread, post, threadId: targetThreadId };
}

async function linkCommitToThread({
  threadId,
  commitHash,
  branch = null,
  message = '',
  commitUrl = null,
  author = null,
}) {
  const thread = await getThread(threadId);
  if (!thread) return null;

  const normalizedCommitHash = String(commitHash || '').trim();
  const updatedThread = (
    thread.status === 'OPEN' &&
    !thread.closureCommit &&
    normalizedCommitHash
  )
    ? await updateThread(threadId, { closureCommit: normalizedCommitHash })
    : thread;

  const content = JSON.stringify({
    type: 'git_commit_detected',
    commitHash: normalizedCommitHash || null,
    branch: branch || null,
    message: String(message || ''),
    commitUrl: commitUrl || null,
    author: author || null,
  });

  const post = await createPost({
    threadId,
    author: 'git-webhook',
    authorType: 'agent',
    content,
    type: 'milestone',
    linkedCommit: normalizedCommitHash || null,
  });

  logToJsonl({
    type: 'git_commit_linked',
    threadId,
    commitHash: normalizedCommitHash || undefined,
    branch: branch || undefined,
    message: String(message || '').substring(0, 240) || undefined,
    author: author || undefined,
    commitUrl: commitUrl || undefined,
  });

  return {
    thread: updatedThread,
    post,
  };
}

// ─── Pending Acknowledgments ──────────────────────────────────────────────────
async function getPendingAcknowledgments() {
  const client = getRedis();
  const keys = (await client.keys('board-room:posts/*')) || [];
  const pending = [];
  for (const key of keys) {
    const post = await redisGet(key);
    if (post && post.acknowledgmentRequired && !post.acknowledgedBy) {
      pending.push(post);
    }
  }
  return pending;
}

// ─── Thread Last Activity ────────────────────────────────────────────────────
async function updateThreadLastActivity(threadId) {
  await redisSet(`board-room:threads/${threadId}/meta:lastActivityAt`, Date.now());
  const thread = await getThread(threadId);
  if (thread) await redisSet(`board-room:threads/${threadId}`, { ...thread, lastActivityAt: Date.now() });
}

// ─── Templates ───────────────────────────────────────────────────────────────
async function getTemplates() {
  const client = getRedis();
  try {
    const raw = await client.get('board-room:templates');
    if (raw) return JSON.parse(raw);
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    const defaults = JSON.parse(readFileSync(join(__dirname, '../../board-room/templates/defaults.json'), 'utf-8'));
    await client.set('board-room:templates', JSON.stringify(defaults));
    return defaults;
  } catch { return []; }
}

// ─── Public API ──────────────────────────────────────────────────────────────
export const boardRoomService = {
  createThread, getThread, getThreads, getAllOpenThreads, updateThread, closeThread,
  getChildThreads,
  createPost, getPost, getThreadPosts, acknowledgePost, updatePostPlanStatus,
  createTask, getThreadTasks, toggleTask,
  getAgentMemory, updateAgentMemory, recordHeartbeat, reportError, linkCommitToThread,
  getPendingAcknowledgments,
  archiveOldLogs,
  getTemplates,
  validateContent,
};

export default boardRoomService;
