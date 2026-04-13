// bff/routes/boardRoomRoutes.mjs
import { boardRoomService } from '../services/boardRoomService.mjs';
import boardRoomTelegram from '../services/boardRoomTelegram.mjs';

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function requireAuth(req, res) {
  if (!req.headers.authorization) {
    json(res, 401, { ok: false, error: 'unauthorized' });
    return false;
  }
  return true;
}

export function createBoardRoomRouteHandler() {
  async function handle(req, res, pathname, origin) {
    const method = req.method;

    // ── Thread Routes ────────────────────────────────────────────
    if (method === 'GET' && pathname === '/board-room/threads') {
      const threads = await boardRoomService.getAllOpenThreads();
      json(res, 200, { ok: true, threads });
      return true;
    }

    if (method === 'POST' && pathname === '/board-room/threads') {
      const body = await readJson(req);
      const { title, description, priority, tags, ownerAgent, createdBy = 'ceo', tasks } = body;
      if (!title || !ownerAgent) { json(res, 400, { ok: false, error: 'title and ownerAgent required' }); return true; }
      const validation = boardRoomService.validateContent(description || '');
      if (!validation.valid) { json(res, 400, { ok: false, error: validation.reason }); return true; }
      const thread = await boardRoomService.createThread({ title, description, priority, tags, ownerAgent, createdBy, tasks: tasks || [] });
      if (priority === 'HIGH' || priority === 'CRITICAL') {
        boardRoomTelegram.sendAlert({ type: 'THREAD_OPENED', agent: ownerAgent, threadId: thread.threadId, threadTitle: title, priority });
      }
      json(res, 201, { ok: true, thread });
      return true;
    }

    if (method === 'GET' && pathname.startsWith('/board-room/threads/')) {
      const segments = pathname.split('/');
      const threadId = segments[3];
      if (!threadId || segments.includes('posts') || segments.includes('close')) {
        return false; // let other handlers take it
      }
      const thread = await boardRoomService.getThread(threadId);
      if (!thread) { json(res, 404, { ok: false, error: 'thread not found' }); return true; }
      const [posts, tasks] = await Promise.all([
        boardRoomService.getThreadPosts(threadId),
        boardRoomService.getThreadTasks(threadId),
      ]);
      json(res, 200, { ok: true, thread, posts, tasks });
      return true;
    }

    // CEO-only: close thread
    if (method === 'POST' && pathname.match(/^\/board-room\/threads\/[^/]+\/close$/)) {
      if (!requireAuth(req, res)) return true;
      const segments = pathname.split('/');
      const threadId = segments[3];
      const body = await readJson(req);
      const thread = await boardRoomService.closeThread({ threadId, closureCommit: body.closureCommit, closurePR: body.closurePR, note: body.note, closedBy: 'ceo' });
      if (!thread) { json(res, 404, { ok: false, error: 'thread not found' }); return true; }
      json(res, 200, { ok: true, thread });
      return true;
    }

    // Posts on thread
    if (method === 'POST' && pathname.match(/^\/board-room\/threads\/[^/]+\/posts$/)) {
      const segments = pathname.split('/');
      const threadId = segments[3];
      const body = await readJson(req);
      const { author, authorType = 'agent', content, type = 'comment', mentions = [], acknowledgmentRequired, priority, planStatus, linkedCommit, linkedPR, response } = body;
      if (!author || !content) { json(res, 400, { ok: false, error: 'author and content required' }); return true; }
      const validation = boardRoomService.validateContent(content);
      if (!validation.valid) { json(res, 400, { ok: false, error: validation.reason }); return true; }
      let acknowledgmentDeadline = null;
      if (acknowledgmentRequired) acknowledgmentDeadline = Date.now() + 3 * 60 * 60 * 1000;
      const post = await boardRoomService.createPost({
        threadId, author, authorType, content, type,
        mentions, acknowledgmentRequired: !!acknowledgmentRequired,
        acknowledgmentDeadline, planStatus: planStatus || null,
        linkedCommit: linkedCommit || null, linkedPR: linkedPR || null,
        response: response || null,
      });
      const thread = await boardRoomService.getThread(threadId);
      if ((type === 'suggestion' || type === 'plan') && (priority === 'HIGH' || priority === 'CRITICAL')) {
        boardRoomTelegram.sendAlert({ type: type === 'plan' ? 'PLAN_POSTED' : 'SUGGESTION', agent: author, threadId, threadTitle: thread?.title, target: mentions?.[0], what: typeof content === 'string' ? content.substring(0, 100) : content, priority });
      }
      json(res, 201, { ok: true, post });
      return true;
    }

    // Acknowledge post
    if (method === 'POST' && pathname.match(/^\/board-room\/posts\/[^/]+\/acknowledge$/)) {
      const segments = pathname.split('/');
      const postId = segments[3];
      const body = await readJson(req);
      if (!body.agent) { json(res, 400, { ok: false, error: 'agent required' }); return true; }
      const post = await boardRoomService.acknowledgePost({ postId, agent: body.agent, response: body.response });
      if (!post) { json(res, 404, { ok: false, error: 'post not found' }); return true; }
      json(res, 200, { ok: true, post });
      return true;
    }

    // CEO-only: approve/reject plan
    if (method === 'POST' && pathname.match(/^\/board-room\/posts\/[^/]+\/(approve|reject)$/)) {
      if (!requireAuth(req, res)) return true;
      const segments = pathname.split('/');
      const postId = segments[3];
      const action = segments[5];
      const body = await readJson(req);
      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      const post = await boardRoomService.updatePostPlanStatus(postId, newStatus);
      if (!post) { json(res, 404, { ok: false, error: 'post not found' }); return true; }
      const thread = await boardRoomService.getThread(post.threadId);
      if (action === 'approve') {
        boardRoomTelegram.sendAlert({ type: 'PLAN_APPROVED', agent: 'ceo', threadId: post.threadId, threadTitle: thread?.title });
      }
      json(res, 200, { ok: true, post });
      return true;
    }

    // ── Task Routes ─────────────────────────────────────────────
    if (method === 'POST' && pathname.match(/^\/board-room\/threads\/[^/]+\/tasks$/)) {
      const segments = pathname.split('/');
      const threadId = segments[3];
      const body = await readJson(req);
      if (!body.description) { json(res, 400, { ok: false, error: 'description required' }); return true; }
      const task = await boardRoomService.createTask({ threadId, description: body.description, doneBy: body.doneBy });
      json(res, 201, { ok: true, task });
      return true;
    }

    if (method === 'PATCH' && pathname.match(/^\/board-room\/tasks\/[^/]+$/)) {
      const taskId = pathname.split('/')[3];
      const body = await readJson(req);
      const task = await boardRoomService.toggleTask(taskId, body.doneBy);
      if (!task) { json(res, 404, { ok: false, error: 'task not found' }); return true; }
      json(res, 200, { ok: true, task });
      return true;
    }

    // ── Agent Memory ─────────────────────────────────────────────
    if (method === 'GET' && pathname.startsWith('/board-room/agents/')) {
      const agent = decodeURIComponent(pathname.split('/')[3]);
      const memory = await boardRoomService.getAgentMemory(agent);
      json(res, 200, { ok: true, memory });
      return true;
    }

    if (method === 'POST' && pathname === '/board-room/heartbeat') {
      const body = await readJson(req);
      if (!body.agent) { json(res, 400, { ok: false, error: 'agent required' }); return true; }
      await boardRoomService.updateAgentMemory(body.agent, {
        lastHeartbeat: Date.now(),
        status: body.status,
        currentThread: body.currentThreadId || null,
        focus: body.focus,
      });
      json(res, 200, { ok: true });
      return true;
    }

    // ── Templates ─────────────────────────────────────────────────
    if (method === 'GET' && pathname === '/board-room/templates') {
      const templates = await boardRoomService.getTemplates();
      json(res, 200, { ok: true, templates });
      return true;
    }

    // ── Error Posts ──────────────────────────────────────────────
    if (method === 'POST' && pathname === '/board-room/error') {
      const body = await readJson(req);
      if (!body.agent || !body.error) { json(res, 400, { ok: false, error: 'agent and error required' }); return true; }
      const threadId = body.threadId;
      const thread = threadId ? await boardRoomService.getThread(threadId) : null;
      const post = threadId
        ? await boardRoomService.createPost({ threadId, author: body.agent, authorType: 'agent', content: JSON.stringify({ error: body.error, stack: body.stack || null }), type: 'error' })
        : null;
      if (body.severity === 'HIGH' || body.severity === 'CRITICAL') {
        boardRoomTelegram.sendAlert({ type: 'ERROR', agent: body.agent, threadId: threadId || 'new', threadTitle: thread?.title || 'new thread', priority: body.severity, what: body.error.substring(0, 120) });
      }
      json(res, 201, { ok: true, post });
      return true;
    }

    return false;
  }

  return { handle };
}

async function readJson(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}
