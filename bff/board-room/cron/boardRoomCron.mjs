// bff/board-room/cron/boardRoomCron.mjs
// 3-hour acknowledgment enforcer + stale thread warning + weekly digest
// Uses setInterval (no external cron package needed)

const ACK_CHECK_INTERVAL_MS = 10 * 60 * 1000; // every 10 minutes
const STALE_WARNING_DAYS = 7;
const LOG_ARCHIVE_INTERVAL_MS = 12 * 60 * 60 * 1000;

export function startBoardRoomCron(boardRoomService, boardRoomTelegram) {
  console.log('[boardRoomCron] Starting cron jobs');

  // ── 3-hour acknowledgment enforcer ────────────────────────────────────
  let ackInterval;
  async function checkAcknowledgmentDeadlines() {
    try {
      const pending = await boardRoomService.getPendingAcknowledgments();
      const now = Date.now();
      for (const post of pending) {
        if (post.acknowledgmentDeadline && now > post.acknowledgmentDeadline) {
          const thread = await boardRoomService.getThread(post.threadId);
          await boardRoomService.createPost({
            threadId: post.threadId,
            author: 'board-room-cron',
            authorType: 'agent',
            content: JSON.stringify({ warning: 'ack_timeout', targetAgent: post.mentions?.[0] || 'unknown', deadline: post.acknowledgmentDeadline, message: 'Acknowledgment deadline missed. CEO auto-escalated.' }),
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
        }
      }
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
      const threads = await boardRoomService.getAllOpenThreads();
      const now = Date.now();
      const MS_7_DAYS = 7 * 24 * 60 * 60 * 1000;
      for (const thread of threads) {
        const inactiveMs = now - (thread.lastActivityAt || thread.createdAt);
        if (inactiveMs >= MS_7_DAYS && !thread.staleWarningSent) {
          await boardRoomService.createPost({
            threadId: thread.threadId,
            author: 'board-room-cron',
            authorType: 'agent',
            content: JSON.stringify({ warning: 'stale_thread', days: Math.round(inactiveMs / MS_7_DAYS), message: 'No activity for 7 days. CEO will review for closure.' }),
            type: 'system',
          });
          await boardRoomService.updateThread(thread.threadId, { staleWarningSent: true });
          await boardRoomTelegram.sendAlert({ type: 'STALE_THREAD', agent: 'board-room-cron', threadId: thread.threadId, threadTitle: thread.title, priority: 'MEDIUM', what: `No activity for ${Math.round(inactiveMs / MS_7_DAYS)} days` });
        }
      }
    } catch (err) {
      console.error('[boardRoomCron] stale check failed:', err.message);
    }
  }

  staleInterval = setInterval(checkStaleThreads, ACK_CHECK_INTERVAL_MS);
  checkStaleThreads();

  // ── Weekly digest (Sunday 9 AM IST) ───────────────────────────────────
  let digestTimeout;
  function scheduleNextDigest() {
    const now = new Date();
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + IST_OFFSET_MS);
    let nextSunday = new Date(istNow);
    nextSunday.setDate(istNow.getDate() + (7 - istNow.getDay()) % 7);
    nextSunday.setHours(9, 0, 0, 0);
    if (nextSunday <= istNow) nextSunday.setDate(nextSunday.getDate() + 7);
    const msUntil = nextSunday.getTime() - istNow.getTime();
    console.log(`[boardRoomCron] Next weekly digest in ${Math.round(msUntil / 1000 / 60)} minutes`);
    digestTimeout = setTimeout(async () => {
      await sendWeeklyDigest();
      scheduleNextDigest();
    }, msUntil);
  }

  async function sendWeeklyDigest() {
    try {
      const threads = await boardRoomService.getAllOpenThreads();
      const staleThreads = [];
      for (const t of threads) {
        const days = (Date.now() - (t.lastActivityAt || t.createdAt)) / (24 * 60 * 60 * 1000);
        if (days >= 14) staleThreads.push({ id: t.threadId, days: Math.round(days) });
      }
      const digest = {
        date: new Date().toISOString().slice(0, 10),
        activeCount: threads.length,
        needsAction: threads.filter(t => t.ownerAgent).map(t => t.threadId),
        staleThreads,
        lateAcks: [],
        inactiveAgents: [],
      };
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
