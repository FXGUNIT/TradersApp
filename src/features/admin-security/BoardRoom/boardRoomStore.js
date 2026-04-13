import { create } from "zustand";
import * as BoardRoomClient from "./BoardRoomClient.js";

const DEFAULT_FILTERS = {
  query: "",
  priority: "ALL",
  status: "ALL",
  agent: "ALL",
  tag: "ALL",
};

function collectAgentsFromThreads(threads = []) {
  const agents = new Set();
  threads.forEach((thread) => {
    if (thread?.ownerAgent) agents.add(thread.ownerAgent);
    if (thread?.createdBy && thread.createdBy !== "ceo") agents.add(thread.createdBy);
  });
  return [...agents];
}

function collectAgentsFromDetail(thread, posts = []) {
  const agents = new Set(collectAgentsFromThreads(thread ? [thread] : []));
  posts.forEach((post) => {
    if (post?.author && post.author !== "ceo") agents.add(post.author);
    (post?.mentions || []).forEach((mention) => {
      if (mention && mention !== "ceo") agents.add(mention);
    });
    if (post?.acknowledgedBy && post.acknowledgedBy !== "ceo") {
      agents.add(post.acknowledgedBy);
    }
  });
  return [...agents];
}

function sortThreads(threads = []) {
  return [...threads].sort(
    (left, right) => (right?.lastActivityAt || 0) - (left?.lastActivityAt || 0),
  );
}

const useBoardRoomStore = create((set, get) => ({
  threads: [],
  activeThreadId: null,
  threadDetails: {},
  templates: [],
  agentMemories: {},
  filters: DEFAULT_FILTERS,
  loadingThreads: false,
  loadingThread: false,
  loadingTemplates: false,
  submitting: false,
  error: "",

  setFilters(updates) {
    set((state) => ({
      filters: {
        ...state.filters,
        ...updates,
      },
    }));
  },

  resetFilters() {
    set({ filters: DEFAULT_FILTERS });
  },

  clearError() {
    set({ error: "" });
  },

  async hydrateAgentMemories(agents = []) {
    const uniqueAgents = [...new Set((agents || []).filter(Boolean))];
    if (uniqueAgents.length === 0) return;

    const responses = await Promise.all(
      uniqueAgents.map(async (agent) => {
        const result = await BoardRoomClient.getAgentMemory(agent);
        return result?.success ? [agent, result.memory] : null;
      }),
    );

    set((state) => ({
      agentMemories: responses.reduce((acc, entry) => {
        if (!entry) return acc;
        const [agent, memory] = entry;
        acc[agent] = memory;
        return acc;
      }, { ...state.agentMemories }),
    }));
  },

  async loadTemplates() {
    set({ loadingTemplates: true, error: "" });
    const result = await BoardRoomClient.getTemplates();
    if (!result.success) {
      set({
        loadingTemplates: false,
        error: result.error || "Unable to load board room templates.",
      });
      return result;
    }

    set({
      templates: result.templates,
      loadingTemplates: false,
      error: "",
    });
    return result;
  },

  async loadThreads() {
    set({ loadingThreads: true, error: "" });
    const result = await BoardRoomClient.listThreads({ status: "ALL" });
    if (!result.success) {
      set({
        loadingThreads: false,
        error: result.error || "Unable to load board room threads.",
      });
      return result;
    }

    const threads = sortThreads(result.threads);
    const previousActiveThreadId = get().activeThreadId;
    const nextActiveThreadId = threads.some((thread) => thread.threadId === previousActiveThreadId)
      ? previousActiveThreadId
      : threads[0]?.threadId || null;

    set({
      threads,
      activeThreadId: nextActiveThreadId,
      loadingThreads: false,
      error: "",
    });

    await get().hydrateAgentMemories(collectAgentsFromThreads(threads));

    if (nextActiveThreadId) {
      await get().selectThread(nextActiveThreadId);
    }

    return result;
  },

  async selectThread(threadId) {
    if (!threadId) {
      set({ activeThreadId: null });
      return null;
    }

    set({ activeThreadId: threadId, loadingThread: true, error: "" });
    const result = await BoardRoomClient.getThread(threadId);
    if (!result.success) {
      set({
        loadingThread: false,
        error: result.error || "Unable to load board room thread.",
      });
      return result;
    }

    const detail = {
      thread: result.thread,
      posts: Array.isArray(result.posts) ? result.posts : [],
      tasks: Array.isArray(result.tasks) ? result.tasks : [],
    };

    set((state) => ({
      threadDetails: {
        ...state.threadDetails,
        [threadId]: detail,
      },
      loadingThread: false,
      error: "",
    }));

    await get().hydrateAgentMemories(
      collectAgentsFromDetail(detail.thread, detail.posts),
    );

    return result;
  },

  async createThread(payload) {
    set({ submitting: true, error: "" });
    const result = await BoardRoomClient.createThread(payload);
    if (!result.success) {
      set({
        submitting: false,
        error: result.error || "Unable to create board room thread.",
      });
      return result;
    }

    await get().loadThreads();
    if (result.thread?.threadId) {
      await get().selectThread(result.thread.threadId);
    }
    set({ submitting: false, error: "" });
    return result;
  },

  async createPost({ threadId, ...payload }) {
    set({ submitting: true, error: "" });
    const result = await BoardRoomClient.createPost(threadId, payload);
    if (!result.success) {
      set({
        submitting: false,
        error: result.error || "Unable to create board room post.",
      });
      return result;
    }

    await get().loadThreads();
    await get().selectThread(threadId);
    set({ submitting: false, error: "" });
    return result;
  },

  async createTask(threadId, payload) {
    set({ submitting: true, error: "" });
    const result = await BoardRoomClient.createTask(threadId, payload);
    if (!result.success) {
      set({
        submitting: false,
        error: result.error || "Unable to create board room task.",
      });
      return result;
    }

    await get().selectThread(threadId);
    await get().loadThreads();
    set({ submitting: false, error: "" });
    return result;
  },

  async toggleTask(threadId, taskId, payload) {
    set({ submitting: true, error: "" });
    const result = await BoardRoomClient.toggleTask(taskId, payload);
    if (!result.success) {
      set({
        submitting: false,
        error: result.error || "Unable to update board room task.",
      });
      return result;
    }

    await get().selectThread(threadId);
    set({ submitting: false, error: "" });
    return result;
  },

  async acknowledgePost(threadId, postId, payload) {
    set({ submitting: true, error: "" });
    const result = await BoardRoomClient.acknowledgePost(postId, payload);
    if (!result.success) {
      set({
        submitting: false,
        error: result.error || "Unable to acknowledge board room post.",
      });
      return result;
    }

    await get().selectThread(threadId);
    set({ submitting: false, error: "" });
    return result;
  },

  async updatePlanStatus(threadId, postId, action) {
    set({ submitting: true, error: "" });
    const actionClient = action === "approve"
      ? BoardRoomClient.approvePlan
      : BoardRoomClient.rejectPlan;
    const result = await actionClient(postId);
    if (!result.success) {
      set({
        submitting: false,
        error: result.error || "Unable to update board room plan status.",
      });
      return result;
    }

    await get().selectThread(threadId);
    set({ submitting: false, error: "" });
    return result;
  },

  async closeThread(threadId, payload) {
    set({ submitting: true, error: "" });
    const result = await BoardRoomClient.closeThread(threadId, payload);
    if (!result.success) {
      set({
        submitting: false,
        error: result.error || "Unable to close board room thread.",
      });
      return result;
    }

    await get().loadThreads();
    set({ submitting: false, error: "" });
    return result;
  },
}));

export default useBoardRoomStore;
