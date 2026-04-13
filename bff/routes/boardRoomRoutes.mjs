// bff/routes/boardRoomRoutes.mjs
import { createHmac, timingSafeEqual } from 'node:crypto';
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
    const requestUrl = new URL(req.url, origin || 'http://localhost');

    if (method === 'POST' && pathname === '/board-room/git-webhook') {
      const rawBody = await readRawBody(req);
      const secret = String(process.env.BOARD_ROOM_GITHUB_WEBHOOK_SECRET || '').trim();
      if (!secret) {
        json(res, 503, { ok: false, error: 'github webhook secret not configured' });
        return true;
      }

      const signature = req.headers['x-hub-signature-256'];
      if (!isValidGithubSignature(rawBody, signature, secret)) {
        json(res, 401, { ok: false, error: 'invalid github signature' });
        return true;
      }

      let body = {};
      try {
        body = rawBody ? JSON.parse(rawBody) : {};
      } catch {
        json(res, 400, { ok: false, error: 'invalid JSON body' });
        return true;
      }

      const branch = extractBranchName(body.ref);
      const commits = Array.isArray(body.commits) ? body.commits : [];
      const linked = [];

      for (const commit of commits) {
        const ticketRefs = extractTicketRefs(commit?.message);
        for (const ticketRef of ticketRefs) {
          const threadId = await resolveThreadId(ticketRef);
          if (!threadId) continue;

          const result = await boardRoomService.linkCommitToThread({
            threadId,
            commitHash: String(commit?.id || '').slice(0, 12),
            branch,
            message: commit?.message || '',
            commitUrl: commit?.url || null,
            author: commit?.author?.name || commit?.author?.username || null,
          });

          if (!result?.thread) continue;
          linked.push({
            threadId,
            commitHash: String(commit?.id || '').slice(0, 12),
            branch,
          });

          if (result.thread.status === 'OPEN') {
            boardRoomTelegram.sendAlert({
              type: 'GIT_COMMIT',
              agent: commit?.author?.name || 'git-webhook',
              threadId,
              threadTitle: result.thread.title,
              priority: result.thread.priority,
              what: `${String(commit?.id || '').slice(0, 12)} on ${branch}`,
            });
          }
        }
      }

      json(res, 200, {
        ok: true,
        linked,
        processedCommits: commits.length,
      });
      return true;
    }

    if (method === 'GET' && pathname === '/board-room/threads') {
      const status = requestUrl.searchParams.get('status') || 'OPEN';
      const threads = await boardRoomService.getThreads(status);
      json(res, 200, { ok: true, threads });
      return true;
    }

    if (method === 'POST' && pathname === '/board-room/threads') {
      const body = await readJson(req);
      const {
        title,
        description,
        priority,
        tags,
        ownerAgent,
        createdBy = 'ceo',
        tasks,
        parentThreadId = null,
      } = body;
      if (!title || !ownerAgent) {
        json(res, 400, { ok: false, error: 'title and ownerAgent required' });
        return true;
      }
      if (parentThreadId) {
        const parentThread = await boardRoomService.getThread(String(parentThreadId).trim().toUpperCase());
        if (!parentThread) {
          json(res, 404, { ok: false, error: 'parent thread not found' });
          return true;
        }
      }
      const validation = boardRoomService.validateContent(description || '');
      if (!validation.valid) {
        json(res, 400, { ok: false, error: validation.reason });
        return true;
      }
      const thread = await boardRoomService.createThread({
        title,
        description,
        priority,
        tags,
        ownerAgent,
        createdBy,
        tasks: tasks || [],
        parentThreadId,
      });
      if (!thread) {
        json(res, 404, { ok: false, error: 'parent thread not found' });
        return true;
      }
      if (priority === 'HIGH' || priority === 'CRITICAL') {
        boardRoomTelegram.sendAlert({
          type: 'THREAD_OPENED',
          agent: ownerAgent,
          threadId: thread.threadId,
          threadTitle: title,
          priority,
        });
      }
      json(res, 201, { ok: true, thread });
      return true;
    }

    if (method === 'GET' && pathname.startsWith('/board-room/threads/')) {
      const segments = pathname.split('/');
      const threadId = segments[3];
      if (!threadId || segments.includes('posts') || segments.includes('close')) {
        return false;
      }
      const thread = await boardRoomService.getThread(threadId);
      if (!thread) {
        json(res, 404, { ok: false, error: 'thread not found' });
        return true;
      }
      const [posts, tasks, childThreads, parentThread] = await Promise.all([
        boardRoomService.getThreadPosts(threadId),
        boardRoomService.getThreadTasks(threadId),
        boardRoomService.getChildThreads(threadId),
        thread.parentThreadId ? boardRoomService.getThread(thread.parentThreadId) : null,
      ]);
      json(res, 200, { ok: true, thread, posts, tasks, childThreads, parentThread });
      return true;
    }

    if (method === 'POST' && pathname.match(/^\/board-room\/threads\/[^/]+\/close$/)) {
      if (!requireAuth(req, res)) return true;
      const segments = pathname.split('/');
      const threadId = segments[3];
      const body = await readJson(req);
      const thread = await boardRoomService.closeThread({
        threadId,
        closureCommit: body.closureCommit,
        closurePR: body.closurePR,
        note: body.note,
        closedBy: 'ceo',
      });
      if (!thread) {
        json(res, 404, { ok: false, error: 'thread not found' });
        return true;
      }
      json(res, 200, { ok: true, thread });
      return true;
    }

    if (method === 'POST' && pathname.match(/^\/board-room\/threads\/[^/]+\/posts$/)) {
      const segments = pathname.split('/');
      const threadId = segments[3];
      const body = await readJson(req);
      const {
        author,
        authorType = 'agent',
        content,
        type = 'comment',
        mentions = [],
        acknowledgmentRequired,
        priority,
        planStatus,
        linkedCommit,
        linkedPR,
        response,
      } = body;
      if (!author || !content) {
        json(res, 400, { ok: false, error: 'author and content required' });
        return true;
      }
      const validation = boardRoomService.validateContent(content);
      if (!validation.valid) {
        json(res, 400, { ok: false, error: validation.reason });
        return true;
      }
      let acknowledgmentDeadline = null;
      if (acknowledgmentRequired) {
        acknowledgmentDeadline = Date.now() + 3 * 60 * 60 * 1000;
      }
      const post = await boardRoomService.createPost({
        threadId,
        author,
        authorType,
        content,
        type,
        mentions,
        acknowledgmentRequired: !!acknowledgmentRequired,
        acknowledgmentDeadline,
        planStatus: planStatus || null,
        linkedCommit: linkedCommit || null,
        linkedPR: linkedPR || null,
        response: response || null,
      });
      const thread = await boardRoomService.getThread(threadId);
      if ((type === 'suggestion' || type === 'plan') && (priority === 'HIGH' || priority === 'CRITICAL')) {
        boardRoomTelegram.sendAlert({
          type: type === 'plan' ? 'PLAN_POSTED' : 'SUGGESTION',
          agent: author,
          threadId,
          threadTitle: thread?.title,
          target: mentions?.[0],
          what: typeof content === 'string' ? content.substring(0, 100) : content,
          priority,
        });
      }
      json(res, 201, { ok: true, post });
      return true;
    }

    if (method === 'POST' && pathname.match(/^\/board-room\/posts\/[^/]+\/acknowledge$/)) {
      const segments = pathname.split('/');
      const postId = segments[3];
      const body = await readJson(req);
      if (!body.agent) {
        json(res, 400, { ok: false, error: 'agent required' });
        return true;
      }
      const post = await boardRoomService.acknowledgePost({
        postId,
        agent: body.agent,
        response: body.response,
      });
      if (!post) {
        json(res, 404, { ok: false, error: 'post not found' });
        return true;
      }
      json(res, 200, { ok: true, post });
      return true;
    }

    if (method === 'POST' && pathname.match(/^\/board-room\/posts\/[^/]+\/(approve|reject)$/)) {
      if (!requireAuth(req, res)) return true;
      const segments = pathname.split('/');
      const postId = segments[3];
      const action = segments[4];
      await readJson(req);
      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      const post = await boardRoomService.updatePostPlanStatus(postId, newStatus);
      if (!post) {
        json(res, 404, { ok: false, error: 'post not found' });
        return true;
      }
      const thread = await boardRoomService.getThread(post.threadId);
      await boardRoomService.createPost({
        threadId: post.threadId,
        author: 'ceo',
        authorType: 'human',
        content: JSON.stringify({
          type: 'plan_status',
          status: newStatus,
          targetAgent: post.author || null,
          message: `Plan ${newStatus} by CEO`,
        }),
        type: 'decision',
        mentions: post.author && post.author !== 'ceo' ? [post.author] : [],
      });
      if (action === 'approve') {
        boardRoomTelegram.sendAlert({
          type: 'PLAN_APPROVED',
          agent: 'ceo',
          threadId: post.threadId,
          threadTitle: thread?.title,
        });
      }
      json(res, 200, { ok: true, post });
      return true;
    }

    if (method === 'POST' && pathname.match(/^\/board-room\/threads\/[^/]+\/tasks$/)) {
      const segments = pathname.split('/');
      const threadId = segments[3];
      const body = await readJson(req);
      if (!body.description) {
        json(res, 400, { ok: false, error: 'description required' });
        return true;
      }
      const task = await boardRoomService.createTask({
        threadId,
        description: body.description,
        doneBy: body.doneBy,
      });
      json(res, 201, { ok: true, task });
      return true;
    }

    if (method === 'PATCH' && pathname.match(/^\/board-room\/tasks\/[^/]+$/)) {
      const taskId = pathname.split('/')[3];
      const body = await readJson(req);
      const task = await boardRoomService.toggleTask(taskId, body.doneBy);
      if (!task) {
        json(res, 404, { ok: false, error: 'task not found' });
        return true;
      }
      json(res, 200, { ok: true, task });
      return true;
    }

    if (method === 'GET' && pathname.startsWith('/board-room/agents/')) {
      const agent = decodeURIComponent(pathname.split('/')[3]);
      const memory = await boardRoomService.getAgentMemory(agent);
      json(res, 200, { ok: true, memory });
      return true;
    }

    if (method === 'POST' && pathname === '/board-room/heartbeat') {
      const body = await readJson(req);
      if (!body.agent) {
        json(res, 400, { ok: false, error: 'agent required' });
        return true;
      }
      const heartbeat = await boardRoomService.recordHeartbeat({
        agent: body.agent,
        status: body.status || 'active',
        currentThreadId: body.currentThreadId || null,
        focus: body.focus || null,
      });
      json(res, 200, { ok: true, heartbeat });
      return true;
    }

    if (method === 'GET' && pathname === '/board-room/templates') {
      const templates = await boardRoomService.getTemplates();
      json(res, 200, { ok: true, templates });
      return true;
    }

    if (method === 'POST' && pathname === '/board-room/error') {
      const body = await readJson(req);
      if (!body.agent || !body.error) {
        json(res, 400, { ok: false, error: 'agent and error required' });
        return true;
      }
      const errorResult = await boardRoomService.reportError({
        agent: body.agent,
        error: body.error,
        stack: body.stack || null,
        severity: body.severity || 'MEDIUM',
        threadId: body.threadId || null,
      });
      const thread = errorResult?.thread || null;
      const post = errorResult?.post || null;
      const threadId = errorResult?.threadId || body.threadId || 'new';
      if (body.severity === 'HIGH' || body.severity === 'CRITICAL') {
        boardRoomTelegram.sendAlert({
          type: 'ERROR',
          agent: body.agent,
          threadId,
          threadTitle: thread?.title || 'new thread',
          priority: body.severity,
          what: body.error.substring(0, 120),
        });
      }
      json(res, 201, { ok: true, thread, post, threadId });
      return true;
    }

    return false;
  }

  return { handle };
}

async function readJson(req) {
  return new Promise((resolve) => {
    readRawBody(req).then((body) => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    }).catch(() => resolve({}));
  });
}

async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function isValidGithubSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || typeof signatureHeader !== 'string' || !secret) {
    return false;
  }

  const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const actualBuffer = Buffer.from(signatureHeader, 'utf8');
  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }
  return timingSafeEqual(expectedBuffer, actualBuffer);
}

function extractBranchName(ref) {
  const normalized = String(ref || '').trim();
  if (!normalized) return 'unknown';
  const segments = normalized.split('/');
  return segments[segments.length - 1] || 'unknown';
}

function extractTicketRefs(message) {
  const text = String(message || '');
  return [...text.matchAll(/\[(T\d{1,10})\]/gi)].map((match) => match[1].toUpperCase());
}

async function resolveThreadId(ticketRef) {
  const normalized = String(ticketRef || '').trim().toUpperCase();
  if (!normalized) return null;

  const numeric = normalized.startsWith('T') ? normalized.slice(1) : normalized;
  const candidates = new Set([normalized]);
  if (/^\d+$/.test(numeric)) {
    candidates.add(`T${numeric.padStart(5, '0')}`);
  }

  for (const candidate of candidates) {
    const thread = await boardRoomService.getThread(candidate);
    if (thread?.threadId) {
      return thread.threadId;
    }
  }

  return null;
}
