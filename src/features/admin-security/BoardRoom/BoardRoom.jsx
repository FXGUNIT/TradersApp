import { useEffect, useMemo, useState } from "react";
import AgentScorecard from "./AgentScorecard.jsx";
import BoardRoomSidebar from "./BoardRoomSidebar.jsx";
import BoardRoomThread from "./BoardRoomThread.jsx";
import useBoardRoomStore from "./boardRoomStore.js";

const EMPTY_THREAD_DRAFT = {
  templateId: "",
  title: "",
  ownerAgent: "ConsensusEngine",
  createdBy: "ceo",
  priority: "MEDIUM",
  tags: "",
  description: "",
  tasksText: "",
};

function parseCommaList(rawValue) {
  return String(rawValue || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseTaskList(rawValue) {
  return String(rawValue || "")
    .split("\n")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((description) => ({ description }));
}

function matchesQuery(thread, query) {
  if (!query) return true;
  const haystack = [
    thread?.threadId,
    thread?.title,
    thread?.description,
    thread?.ownerAgent,
    ...(Array.isArray(thread?.tags) ? thread.tags : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(String(query).trim().toLowerCase());
}

function uniquePendingAcknowledgments(agentMemories) {
  const ids = new Set();
  Object.values(agentMemories || {}).forEach((memory) => {
    (memory?.pendingAcknowledgments || []).forEach((postId) => ids.add(postId));
  });
  return ids.size;
}

function pendingApprovalCount(threadDetails) {
  return Object.values(threadDetails || {}).reduce((count, detail) => {
    const posts = Array.isArray(detail?.posts) ? detail.posts : [];
    return (
      count +
      posts.filter(
        (post) => post?.type === "plan" && post?.planStatus === "pending_approval",
      ).length
    );
  }, 0);
}

export default function BoardRoom({
  auth,
  adminEmail = "",
  showToast,
}) {
  const [draft, setDraft] = useState(EMPTY_THREAD_DRAFT);
  const threads = useBoardRoomStore((state) => state.threads);
  const activeThreadId = useBoardRoomStore((state) => state.activeThreadId);
  const threadDetails = useBoardRoomStore((state) => state.threadDetails);
  const templates = useBoardRoomStore((state) => state.templates);
  const agentMemories = useBoardRoomStore((state) => state.agentMemories);
  const filters = useBoardRoomStore((state) => state.filters);
  const error = useBoardRoomStore((state) => state.error);
  const loadingThreads = useBoardRoomStore((state) => state.loadingThreads);
  const loadingThread = useBoardRoomStore((state) => state.loadingThread);
  const loadingTemplates = useBoardRoomStore((state) => state.loadingTemplates);
  const submitting = useBoardRoomStore((state) => state.submitting);
  const clearError = useBoardRoomStore((state) => state.clearError);
  const createPost = useBoardRoomStore((state) => state.createPost);
  const createTask = useBoardRoomStore((state) => state.createTask);
  const createThread = useBoardRoomStore((state) => state.createThread);
  const acknowledgePost = useBoardRoomStore((state) => state.acknowledgePost);
  const closeThread = useBoardRoomStore((state) => state.closeThread);
  const loadTemplates = useBoardRoomStore((state) => state.loadTemplates);
  const loadThreads = useBoardRoomStore((state) => state.loadThreads);
  const selectThread = useBoardRoomStore((state) => state.selectThread);
  const setFilters = useBoardRoomStore((state) => state.setFilters);
  const toggleTask = useBoardRoomStore((state) => state.toggleTask);
  const updatePlanStatus = useBoardRoomStore((state) => state.updatePlanStatus);

  const ceoLabel = auth?.email || adminEmail || "CEO";
  const adminIdentity = "ceo";

  useEffect(() => {
    void loadTemplates();
    void loadThreads();
  }, [loadTemplates, loadThreads]);

  const availableAgents = useMemo(() => {
    const nextAgents = new Set(Object.keys(agentMemories || {}));
    threads.forEach((thread) => {
      if (thread?.ownerAgent) nextAgents.add(thread.ownerAgent);
      if (thread?.createdBy && thread.createdBy !== "ceo") {
        nextAgents.add(thread.createdBy);
      }
    });
    Object.values(threadDetails || {}).forEach((detail) => {
      (detail?.posts || []).forEach((post) => {
        if (post?.author && post.author !== "ceo") nextAgents.add(post.author);
        (post?.mentions || []).forEach((mention) => {
          if (mention && mention !== "ceo") nextAgents.add(mention);
        });
      });
    });
    return [...nextAgents].sort((left, right) => left.localeCompare(right));
  }, [agentMemories, threadDetails, threads]);

  const availableTags = useMemo(() => {
    const nextTags = new Set();
    threads.forEach((thread) => {
      (thread?.tags || []).forEach((tag) => {
        if (tag) nextTags.add(tag);
      });
    });
    return [...nextTags].sort((left, right) => left.localeCompare(right));
  }, [threads]);

  const filteredThreads = useMemo(() => {
    return threads.filter((thread) => {
      if (filters.priority !== "ALL" && thread?.priority !== filters.priority) {
        return false;
      }
      if (filters.status !== "ALL" && thread?.status !== filters.status) {
        return false;
      }
      if (
        filters.agent !== "ALL" &&
        thread?.ownerAgent !== filters.agent &&
        thread?.createdBy !== filters.agent
      ) {
        return false;
      }
      if (
        filters.tag !== "ALL" &&
        !(thread?.tags || []).includes(filters.tag)
      ) {
        return false;
      }
      return matchesQuery(thread, filters.query);
    });
  }, [filters, threads]);

  const activeDetail = activeThreadId ? threadDetails[activeThreadId] : null;

  const summaryCards = useMemo(() => {
    const openThreads = threads.filter((thread) => thread?.status === "OPEN").length;
    const criticalThreads = threads.filter(
      (thread) => thread?.status === "OPEN" && thread?.priority === "CRITICAL",
    ).length;

    return [
      {
        label: "Loaded threads",
        value: threads.length,
        tone: "#7dd3fc",
      },
      {
        label: "Open threads",
        value: openThreads,
        tone: "#34d399",
      },
      {
        label: "Pending approvals",
        value: pendingApprovalCount(threadDetails),
        tone: "#fbbf24",
      },
      {
        label: "Pending ack",
        value: uniquePendingAcknowledgments(agentMemories),
        tone: criticalThreads > 0 ? "#f87171" : "#c4b5fd",
      },
    ];
  }, [agentMemories, threadDetails, threads]);

  const handleDraftChange = (field, value) => {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleApplyTemplate = (templateId) => {
    const template = templates.find((entry) => entry.id === templateId);
    if (!template) {
      setDraft((current) => ({ ...current, templateId }));
      return;
    }

    setDraft((current) => ({
      ...current,
      templateId,
      title: template.name,
      tags: Array.isArray(template.suggestedTags)
        ? template.suggestedTags.join(", ")
        : current.tags,
      description: template.initialPrompt || current.description,
    }));
  };

  const handleCreateThread = async () => {
    if (!draft.title.trim() || !draft.ownerAgent.trim() || !draft.description.trim()) {
      showToast?.("Title, owner agent, and description are required.", "warning");
      return;
    }

    const result = await createThread({
      title: draft.title.trim(),
      description: draft.description.trim(),
      priority: draft.priority,
      tags: parseCommaList(draft.tags),
      ownerAgent: draft.ownerAgent.trim(),
      createdBy: adminIdentity,
      tasks: parseTaskList(draft.tasksText),
    });

    if (!result?.success) {
      showToast?.(result?.error || "Unable to create board room thread.", "error");
      return;
    }

    setDraft(EMPTY_THREAD_DRAFT);
    showToast?.(`Thread ${result.thread?.threadId || ""} opened.`, "success");
  };

  const handleCreateSubThread = async (payload) => {
    const result = await createThread(payload);
    if (!result?.success) {
      showToast?.(result?.error || "Unable to create sub-thread.", "error");
      return result;
    }
    showToast?.(`Sub-thread ${result.thread?.threadId || ""} opened.`, "success");
    return result;
  };

  const handleSelectThread = async (threadId) => {
    const result = await selectThread(threadId);
    if (result?.success === false) {
      showToast?.(result.error || "Unable to load board room thread.", "error");
    }
  };

  const handleCreatePost = async (payload) => {
    const result = await createPost(payload);
    if (!result?.success) {
      showToast?.(result?.error || "Unable to post to board room.", "error");
      return;
    }
    showToast?.("Thread updated.", "success");
  };

  const handleCreateTask = async (threadId, description) => {
    if (!description?.trim()) return;
    const result = await createTask(threadId, { description: description.trim() });
    if (!result?.success) {
      showToast?.(result?.error || "Unable to create task.", "error");
      return;
    }
    showToast?.("Task added.", "success");
  };

  const handleToggleTask = async (threadId, task) => {
    const result = await toggleTask(threadId, task.taskId, { doneBy: adminIdentity });
    if (!result?.success) {
      showToast?.(result?.error || "Unable to update task.", "error");
      return;
    }
    showToast?.(task?.done ? "Task reopened." : "Task completed.", "success");
  };

  const handleAcknowledgePost = async (threadId, post, response) => {
    const result = await acknowledgePost(threadId, post.postId, {
      agent: adminIdentity,
      response,
    });
    if (!result?.success) {
      showToast?.(result?.error || "Unable to acknowledge post.", "error");
      return;
    }
    showToast?.("Acknowledgment recorded.", "success");
  };

  const handleApprovePlan = async (threadId, post) => {
    const result = await updatePlanStatus(threadId, post.postId, "approve");
    if (!result?.success) {
      showToast?.(result?.error || "Unable to approve plan.", "error");
      return;
    }
    showToast?.("Plan approved.", "success");
  };

  const handleRejectPlan = async (threadId, post) => {
    const result = await updatePlanStatus(threadId, post.postId, "reject");
    if (!result?.success) {
      showToast?.(result?.error || "Unable to reject plan.", "error");
      return;
    }
    showToast?.("Plan rejected.", "warning");
  };

  const handleCloseThread = async (threadId, payload) => {
    const result = await closeThread(threadId, payload);
    if (!result?.success) {
      showToast?.(result?.error || "Unable to close thread.", "error");
      return;
    }
    showToast?.("Thread closed.", "success");
  };

  return (
    <section style={pageStyle}>
      <div style={heroStyle}>
        <div>
          <div style={{ fontSize: 30, fontWeight: 900 }}>Board Room</div>
          <div style={{ fontSize: 13, opacity: 0.74, marginTop: 8 }}>
            CEO workspace for agent threads, approvals, acknowledgments, and live memory.
          </div>
        </div>
        <div style={{ fontSize: 12, opacity: 0.74 }}>
          Signed in as {ceoLabel}
        </div>
      </div>

      <div style={summaryGridStyle}>
        {summaryCards.map((card) => (
          <article
            key={card.label}
            style={{
              ...summaryCardStyle,
              borderColor: `${card.tone}44`,
              boxShadow: `inset 0 1px 0 ${card.tone}22`,
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.72 }}>{card.label}</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: card.tone }}>
              {card.value}
            </div>
          </article>
        ))}
      </div>

      {error && (
        <div style={errorBannerStyle}>
          <div>{error}</div>
          <button type="button" onClick={clearError} style={dismissButtonStyle}>
            Dismiss
          </button>
        </div>
      )}

      <div style={workspaceGridStyle}>
        <BoardRoomSidebar
          draft={draft}
          filters={filters}
          filteredThreads={filteredThreads}
          activeThreadId={activeThreadId}
          isSubmitting={submitting || loadingTemplates}
          loadingThreads={loadingThreads}
          templates={templates}
          availableAgents={availableAgents}
          availableTags={availableTags}
          onDraftChange={handleDraftChange}
          onApplyTemplate={handleApplyTemplate}
          onCreateThread={handleCreateThread}
          onSelectThread={handleSelectThread}
          onSetFilters={setFilters}
        />

        {loadingThread && !activeDetail ? (
          <section style={loadingPanelStyle}>Loading thread...</section>
        ) : (
          <BoardRoomThread
            key={activeThreadId || "board-room-empty"}
            detail={activeDetail}
            adminIdentity={adminIdentity}
            disabled={submitting}
            onCreatePost={handleCreatePost}
            onCreateTask={handleCreateTask}
            onToggleTask={handleToggleTask}
            onAcknowledgePost={handleAcknowledgePost}
            onApprovePlan={handleApprovePlan}
            onRejectPlan={handleRejectPlan}
            onCloseThread={handleCloseThread}
            onCreateSubThread={handleCreateSubThread}
            onSelectThread={handleSelectThread}
          />
        )}
      </div>

      <AgentScorecard agentMemories={agentMemories} />
    </section>
  );
}

const pageStyle = {
  display: "grid",
  gap: 18,
};

const heroStyle = {
  borderRadius: 24,
  border: "1px solid rgba(255,255,255,0.08)",
  background:
    "radial-gradient(circle at top right, rgba(56,189,248,0.18), rgba(7,15,27,0.88) 38%), rgba(7,15,27,0.88)",
  padding: 22,
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "end",
};

const summaryGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
};

const summaryCardStyle = {
  borderRadius: 20,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(7,15,27,0.72)",
  padding: 16,
  display: "grid",
  gap: 8,
};

const errorBannerStyle = {
  borderRadius: 16,
  border: "1px solid rgba(248,113,113,0.35)",
  background: "rgba(127,29,29,0.28)",
  padding: "12px 14px",
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
};

const dismissButtonStyle = {
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 10,
  padding: "8px 12px",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
};

const workspaceGridStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(300px, 360px) minmax(0, 1fr)",
  gap: 18,
  alignItems: "start",
};

const loadingPanelStyle = {
  borderRadius: 24,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(7,15,27,0.72)",
  padding: 24,
  minHeight: 540,
  display: "grid",
  placeItems: "center",
};
