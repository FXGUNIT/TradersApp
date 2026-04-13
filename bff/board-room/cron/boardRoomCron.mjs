// bff/board-room/cron/boardRoomCron.mjs
// 3-hour acknowledgment enforcer + stale thread warning + weekly digest
// Uses setInterval (no external cron package needed)

const ACK_CHECK_INTERVAL_MS = 10 * 60 * 1000; // every 10 minutes
const STALE_WARNING_DAYS = 7;
const STALE_DIGEST_DAYS = 14;
const INACTIVE_AGENT_HOURS = 24;
const LOG_ARCHIVE_INTERVAL_MS = 12 * 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;

function normalizeNowMs(now = Date.now()) {
  if (typeof now === 'number') return now;
  return now instanceof Date ? now.getTime() : Date.now();
}

function collectAgentsFromPosts(posts = []) {
  const agents = new Set();
  for (const post of posts) {
    if (post?.author && post.author !== 'ceo' && post.author !== 'git-webhook' && post.author !== 'board-room-cron') {
      agents.add(post.author);
    }
    for (const mention of post?.mentions || []) {
      if (mention && mention !== 'ceo') agents.add(mention);
    }
    if (post?.acknowledgedBy && post.acknowledgedBy !== 'ceo') {
      agents.add(post.acknowledgedBy);
    }
  }
  return agents;
}

export async function runAcknowledgmentDeadlineCheck(
  boardRoomService,
  boardRoomTelegram,
  now = Date.now(),
) {
  const nowMs = normalizeNowMs(now);
  const escalatedPostIds = [];
  const pending = await boardRoomService.getPendingAcknowledgments();

  for (const post of pending) {
    if (!post.acknowledgmentDeadline || nowMs <= post.acknowledgmentDeadline) continue;
    const thread = await boardRoomService.getThread(post.threadId);
    await boardRoomService.createPost({
      threadId: post.threadId,
      author: 'board-room-cron',
      authorType: 'agent',
      content: JSON.stringify({
        warning: 'ack_timeout',
        targetAgent: post.mentions?.[0] || 'unknown',
        deadline: post.acknowledgmentDeadline,
        message: 'Acknowledgment deadline missed. CEO auto-escalated.',
      }),
      type: 'system',
    });
    await boardRoomTelegram.sendEscalation({
      agent: post.mentions?.[0] || 'unknown',
      threadId: post.threadId,
      threadTitle: thread?.title || post.threadId,
      suggestionFrom: post.author,
      what: typeof post.content === 'string' ? post.content.substring(0, 120) : post.content,
      deadline: post.acknowledgmentDeadline,
    });
    escalatedPostIds.push(post.postId);
  }

  return { escalatedPostIds };
}

export async function runStaleThreadCheck(
  boardRoomService,
  boardRoomTelegram,
  now = Date.now(),
) {
  const nowMs = normalizeNowMs(now);
  const warnedThreadIds = [];
  const threads = await boardRoomService.getAllOpenThreads();

  for (const thread of threads) {
    const inactiveMs = nowMs - (thread.lastActivityAt || thread.createdAt);
    if (inactiveMs < STALE_WARNING_DAYS * MS_PER_DAY || thread.staleWarningSent) continue;

    await boardRoomService.createPost({
      threadId: thread.threadId,
      author: 'board-room-cron',
      authorType: 'agent',
      content: JSON.stringify({
        warning: 'stale_thread',
        days: Math.max(STALE_WARNING_DAYS, Math.round(inactiveMs / MS_PER_DAY)),
        message: 'No activity for 7 days. CEO will review for closure.',
      }),
      type: 'system',
    });
    await boardRoomService.updateThread(thread.threadId, { staleWarningSent: true });
    await boardRoomTelegram.sendAlert({
      type: 'STALE_THREAD',
      agent: 'board-room-cron',
      threadId: thread.threadId,
      threadTitle: thread.title,
      priority: 'MEDIUM',
      what: `No activity for ${Math.max(STALE_WARNING_DAYS, Math.round(inactiveMs / MS_PER_DAY))} days`,
    });
    warnedThreadIds.push(thread.threadId);
  }

  return { warnedThreadIds };
}

export async function buildWeeklyDigest(boardRoomService, now = Date.now()) {
  const nowMs = normalizeNowMs(now);
  const weekAgoMs = nowMs - (7 * MS_PER_DAY);
  const threads = await boardRoomService.getAllOpenThreads();
  const needsAction = new Set();
  const agentSet = new Set();
  const staleThreads = [];
  const lateAcks = [];

  for (const thread of threads) {
    if (thread?.ownerAgent) agentSet.add(thread.ownerAgent);
    if (thread?.createdBy && thread.createdBy !== 'ceo') agentSet.add(thread.createdBy);

    const inactiveDays = (nowMs - (thread.lastActivityAt || thread.createdAt)) / MS_PER_DAY;
    if (inactiveDays >= STALE_DIGEST_DAYS) {
      staleThreads.push({
        id: thread.threadId,
        days: Math.round(inactiveDays),
      });
    }

    const posts = await boardRoomService.getThreadPosts(thread.threadId);
    for (const agent of collectAgentsFromPosts(posts)) {
      agentSet.add(agent);
    }

    const hasPendingPlan = posts.some(
      (post) => post?.type === 'plan' && post?.planStatus === 'pending_approval',
    );
    const hasOverdueAck = posts.some(
      (post) =>
        post?.acknowledgmentRequired &&
        !post?.acknowledgedBy &&
        post?.acknowledgmentDeadline &&
        nowMs > post.acknowledgmentDeadline,
    );
    if (hasPendingPlan || hasOverdueAck) {
      needsAction.add(thread.threadId);
    }

    for (const post of posts) {
      if (!post?.acknowledgedLate || !post?.acknowledgedAt || post.acknowledgedAt < weekAgoMs) continue;
      lateAcks.push({
        agent: post.acknowledgedBy || post.mentions?.[0] || 'unknown',
        postId: post.postId,
        threadId: thread.threadId,
      });
    }
  }

  const inactiveAgents = [];
  for (const agent of agentSet) {
    const memory = await boardRoomService.getAgentMemory(agent);
    if (!memory?.lastHeartbeat || nowMs - Number(memory.lastHeartbeat) >= INACTIVE_AGENT_HOURS * MS_PER_HOUR) {
      inactiveAgents.push(agent);
    }
  }

  return {
    date: new Date(nowMs).toISOString().slice(0, 10),
    activeCount: threads.length,
    needsAction: [...needsAction].sort(),
    staleThreads: staleThreads.sort((left, right) => right.days - left.days),
    lateAcks,
    inactiveAgents: inactiveAgents.sort((left, right) => left.localeCompare(right)),
  };
}

export function computeNextDigestDelayMs(now = new Date()) {
  const nowDate = now instanceof Date ? now : new Date(now);
  const IST_OFFSET_MS = 5.5 * MS_PER_HOUR;
  const istNow = new Date(nowDate.getTime() + IST_OFFSET_MS);
  const nextSunday = new Date(istNow);
  nextSunday.setDate(istNow.getDate() + ((7 - istNow.getDay()) % 7));
  nextSunday.setHours(9, 0, 0, 0);
  if (nextSunday <= istNow) nextSunday.setDate(nextSunday.getDate() + 7);
  return nextSunday.getTime() - istNow.getTime();
}

export function startBoardRoomCron(boardRoomService, boardRoomTelegram) {
  console.log('[boardRoomCron] Starting cron jobs');

  // ── 3-hour acknowledgment enforcer ────────────────────────────────────
  let ackInterval;
  async function checkAcknowledgmentDeadlines() {
    try {
      await runAcknowledgmentDeadlineCheck(boardRoomService, boardRoomTelegram);
    } catch (err) {
      console.error('[boardRoomCron] ack check failed:', err.message);
    }
  }

  ackInterval = setInterval(checkAcknowledgmentDeadlines, ACK_CHECK_INTERVAL_MS);
  checkAcknowledgmentDeadlines(); // run immediately

  // ── Stale thread handler ─────────────────────────────────────────────
  let staleInterval;
  async function checkStaleThreads() {
    try {
      await runStaleThreadCheck(boardRoomService, boardRoomTelegram);
    } catch (err) {
      console.error('[boardRoomCron] stale check failed:', err.message);
    }
  }

  staleInterval = setInterval(checkStaleThreads, ACK_CHECK_INTERVAL_MS);
  checkStaleThreads();

  // ── Weekly digest (Sunday 9 AM IST) ───────────────────────────────────
  let digestTimeout;
  function scheduleNextDigest() {
    const msUntil = computeNextDigestDelayMs(new Date());
    console.log(`[boardRoomCron] Next weekly digest in ${Math.round(msUntil / 1000 / 60)} minutes`);
    digestTimeout = setTimeout(async () => {
      await sendWeeklyDigest();
      scheduleNextDigest();
    }, msUntil);
  }

  async function sendWeeklyDigest() {
    try {
      const digest = await buildWeeklyDigest(boardRoomService);
      await boardRoomTelegram.sendDigest(digest);
      console.log('[boardRoomCron] Weekly digest sent');
    } catch (err) {
      console.error('[boardRoomCron] digest failed:', err.message);
    }
  }

  scheduleNextDigest();

  // ── JSONL archive rotation ───────────────────────────────────────────────
  let archiveInterval;
  async function rotateArchivedLogs() {
    try {
      const result = await boardRoomService.archiveOldLogs({ retentionDays: 90 });
      if (Array.isArray(result?.archived) && result.archived.length > 0) {
        console.log(`[boardRoomCron] Archived ${result.archived.length} Board Room log files`);
      }
    } catch (err) {
      console.error('[boardRoomCron] log archive failed:', err.message);
    }
  }

  archiveInterval = setInterval(rotateArchivedLogs, LOG_ARCHIVE_INTERVAL_MS);
  rotateArchivedLogs();

  // Graceful shutdown
  const cleanup = () => {
    clearInterval(ackInterval);
    clearInterval(staleInterval);
    clearInterval(archiveInterval);
    clearTimeout(digestTimeout);
    console.log('[boardRoomCron] Cron jobs stopped');
  };
  process.on('beforeExit', cleanup);
  process.on('SIGTERM', cleanup);

  console.log('[boardRoomCron] All cron jobs running');
}
