// bff/services/boardRoomService.mjs
// Board Room core — thread CRUD, post CRUD, agent memory, JSONL logger
// Data store: Redis (board-room:* prefix keys)
// Audit log: board-room/logs/board_YYYY-MM-DD.jsonl

import { createClient } from 'redis';
import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_DIR = join(__dirname, '../../board-room/logs');

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
  return join(LOG_DIR, `board_${date}.jsonl`);
}

function logToJsonl(entry) {
  try {
    if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
    const line = JSON.stringify({ ts: new Date().toISOString(), ...entry });
    appendFileSync(getTodayLogFile(), line + '\n');
  } catch (err) {
    console.error('[boardRoom] JSONL log write failed:', err.message);
  }
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
async function createThread({ title, description, priority, tags, ownerAgent, createdBy, tasks = [] }) {
  const threadId = await nextThreadId();
  const now = Date.now();
  const thread = {
    threadId, title,
    description: description || '',
    priority: priority || 'MEDIUM',
    tags: tags || [],
    ownerAgent,
    createdBy,
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
  await updateAgentMemory(ownerAgent, { threadsOwned: { op: 'add', id: threadId } });
  logToJsonl({ type: 'thread_opened', agent: ownerAgent, threadId, title, priority });
  return thread;
}

async function getThread(threadId) {
  return await redisGet(`board-room:threads/${threadId}`);
}

async function getThreads(status = 'OPEN') {
  const client = getRedis();
  const keys = (await client.keys('board-room:threads/T*')) || [];
  const threads = [];
  const normalizedStatus = String(status || 'OPEN').toUpperCase();

  for (const key of keys) {
    const thread = await redisGet(key);
    if (!thread) continue;
    if (normalizedStatus !== 'ALL' && thread.status !== normalizedStatus) continue;
    threads.push(thread);
  }

  return threads.sort((left, right) => (right.lastActivityAt || 0) - (left.lastActivityAt || 0));
}

async function getAllOpenThreads() {
  return getThreads('OPEN');
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
  await updateAgentMemory(author, { lastSeen: now });
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
  logToJsonl({ type: 'acknowledgment', agent, postId, response, late: updated.acknowledgedLate });
  return updated;
}

async function updatePostPlanStatus(postId, planStatus) {
  const post = await getPost(postId);
  if (!post) return null;
  const updated = { ...post, planStatus };
  await redisSet(`board-room:posts/${postId}`, updated);
  return updated;
}

// ─── Task CRUD ───────────────────────────────────────────────────────────────
async function createTask({ threadId, description, done = false, doneBy = null }) {
  const taskId = await nextTaskId();
  const now = Date.now();
  const task = { taskId, threadId, description, done, doneBy, doneAt: done ? now : null };
  await redisSet(`board-room:tasks/${taskId}`, task);
  await redisZadd(`board-room:threads/${threadId}/tasks`, 0, taskId);
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
  createPost, getPost, getThreadPosts, acknowledgePost, updatePostPlanStatus,
  createTask, getThreadTasks, toggleTask,
  getAgentMemory, updateAgentMemory,
  getPendingAcknowledgments,
  getTemplates,
  validateContent,
};

export default boardRoomService;
