import React, { useMemo, useState } from "react";
import BoardRoomPost from "./BoardRoomPost.jsx";
import BoardRoomTask from "./BoardRoomTask.jsx";

const EMPTY_POST_FORM = {
  author: "ceo",
  authorType: "human",
  type: "comment",
  priority: "MEDIUM",
  content: "",
  mentions: "",
  acknowledgmentRequired: false,
  linkedCommit: "",
  linkedPR: "",
};

function buildSubThreadDraft(thread) {
  return {
    title: "",
    ownerAgent: thread?.ownerAgent || "",
    priority: thread?.priority || "MEDIUM",
    tags: Array.isArray(thread?.tags) ? thread.tags.join(", ") : "",
    description: "",
    tasksText: "",
  };
}

function parseDelimitedList(rawValue) {
  return String(rawValue || "")
    .split(/[\n,]/)
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

function formatTimestamp(timestamp) {
  if (!timestamp) return "Unknown";
  try {
    return new Date(Number(timestamp)).toLocaleString();
  } catch {
    return "Unknown";
  }
}

export default function BoardRoomThread({
  detail,
  adminIdentity = "ceo",
  disabled = false,
  onCreatePost,
  onCreateTask,
  onToggleTask,
  onAcknowledgePost,
  onApprovePlan,
  onRejectPlan,
  onCloseThread,
  onCreateSubThread,
  onSelectThread,
}) {
  const initialThread = detail?.thread || null;
  const [postForm, setPostForm] = useState(() => ({
    ...EMPTY_POST_FORM,
    author: adminIdentity || "ceo",
    authorType: "human",
  }));
  const [subThreadForm, setSubThreadForm] = useState(() => buildSubThreadDraft(initialThread));
  const [taskDescription, setTaskDescription] = useState("");
  const [closeForm, setCloseForm] = useState({
    closureCommit: "",
    closurePR: "",
    note: "",
  });

  const thread = detail?.thread || null;
  const posts = detail?.posts || [];
  const tasks = detail?.tasks || [];
  const childThreads = detail?.childThreads || [];
  const parentThread = detail?.parentThread || null;
  const accentColor = useMemo(() => {
    switch (thread?.priority) {
      case "CRITICAL":
        return "#f87171";
      case "HIGH":
        return "#fb923c";
      case "LOW":
        return "#86efac";
      default:
        return "#7dd3fc";
    }
  }, [thread?.priority]);

  if (!thread) {
    return (
      <section style={emptyStateStyle}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>Board Room</div>
          <div style={{ fontSize: 13, opacity: 0.72, marginTop: 8 }}>
            Pick a thread from the sidebar or create a new one.
          </div>
        </div>
      </section>
    );
  }

  const submitPost = async () => {
    if (!postForm.content.trim()) return;
    await onCreatePost?.({
      threadId: thread.threadId,
      author: postForm.author || adminIdentity || "ceo",
      authorType: postForm.authorType,
      type: postForm.type,
      content: postForm.content,
      mentions: parseDelimitedList(postForm.mentions),
      acknowledgmentRequired:
        postForm.acknowledgmentRequired || postForm.type === "suggestion",
      priority: postForm.priority,
      planStatus: postForm.type === "plan" ? "pending_approval" : null,
      linkedCommit: postForm.linkedCommit || null,
      linkedPR: postForm.linkedPR || null,
    });

    setPostForm((current) => ({
      ...current,
      content: "",
      mentions: "",
      acknowledgmentRequired: false,
      linkedCommit: "",
      linkedPR: "",
    }));
  };

  const submitSubThread = async () => {
    if (!thread || !subThreadForm.title.trim() || !subThreadForm.description.trim()) return;
    const result = await onCreateSubThread?.({
      parentThreadId: thread.threadId,
      title: subThreadForm.title.trim(),
      description: subThreadForm.description.trim(),
      priority: subThreadForm.priority,
      tags: parseDelimitedList(subThreadForm.tags),
      ownerAgent: subThreadForm.ownerAgent || thread.ownerAgent,
      createdBy: adminIdentity || "ceo",
      tasks: parseTaskList(subThreadForm.tasksText),
    });

    if (result?.success) {
      setSubThreadForm(buildSubThreadDraft(thread));
    }
  };

  return (
    <section style={containerStyle}>
      <header style={headerStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 24, fontWeight: 900 }}>{thread.title}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 12 }}>
              <span
                style={{
                  borderRadius: 999,
                  padding: "3px 10px",
                  background: `${accentColor}22`,
                  color: accentColor,
                  fontWeight: 800,
                }}
              >
                {thread.priority}
              </span>
              <span style={{ opacity: 0.72 }}>{thread.status}</span>
              <span style={{ opacity: 0.72 }}>Owner: {thread.ownerAgent}</span>
              <span style={{ opacity: 0.72 }}>Opened: {formatTimestamp(thread.createdAt)}</span>
            </div>
          </div>
          {thread.status === "CLOSED" && (
            <div style={{ fontSize: 12, opacity: 0.72 }}>
              Closed by {thread.closedBy || "ceo"}
            </div>
          )}
        </div>

        <div style={{ fontSize: 13, lineHeight: 1.55, opacity: 0.85, whiteSpace: "pre-wrap" }}>
          {thread.description || "No thread description provided."}
        </div>

        {Array.isArray(thread.tags) && thread.tags.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {thread.tags.map((tag) => (
              <span
                key={`${thread.threadId}-${tag}`}
                style={{
                  borderRadius: 999,
                  padding: "4px 10px",
                  background: "rgba(255,255,255,0.08)",
                  fontSize: 11,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(240px, 300px) 1fr", gap: 18 }}>
        <div style={{ display: "grid", gap: 18, alignContent: "start" }}>
          <section style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>Linked threads</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>{childThreads.length} child</div>
            </div>

            {parentThread ? (
              <button
                type="button"
                onClick={() => onSelectThread?.(parentThread.threadId)}
                style={linkedThreadButtonStyle(true)}
              >
                <div style={{ fontWeight: 700 }}>Parent: {parentThread.title}</div>
                <div style={{ fontSize: 11, opacity: 0.72 }}>
                  {parentThread.threadId} · {parentThread.ownerAgent} · {parentThread.status}
                </div>
              </button>
            ) : (
              <div style={{ fontSize: 12, opacity: 0.7 }}>No parent thread.</div>
            )}

            <div style={{ display: "grid", gap: 8 }}>
              {childThreads.length === 0 ? (
                <div style={{ fontSize: 12, opacity: 0.7 }}>No sub-threads yet.</div>
              ) : (
                childThreads.map((childThread) => (
                  <button
                    key={childThread.threadId}
                    type="button"
                    onClick={() => onSelectThread?.(childThread.threadId)}
                    style={linkedThreadButtonStyle(false)}
                  >
                    <div style={{ fontWeight: 700 }}>{childThread.title}</div>
                    <div style={{ fontSize: 11, opacity: 0.72 }}>
                      {childThread.threadId} · {childThread.ownerAgent} · {childThread.status}
                    </div>
                  </button>
                ))
              )}
            </div>

            {thread.status !== "CLOSED" && (
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Open sub-thread</div>
                <input
                  value={subThreadForm.title}
                  onChange={(event) => setSubThreadForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Sub-thread title"
                  style={fieldStyle}
                />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <input
                    value={subThreadForm.ownerAgent}
                    onChange={(event) => setSubThreadForm((current) => ({ ...current, ownerAgent: event.target.value }))}
                    placeholder="Owner agent"
                    style={fieldStyle}
                  />
                  <select
                    value={subThreadForm.priority}
                    onChange={(event) => setSubThreadForm((current) => ({ ...current, priority: event.target.value }))}
                    style={fieldStyle}
                  >
                    {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  value={subThreadForm.tags}
                  onChange={(event) => setSubThreadForm((current) => ({ ...current, tags: event.target.value }))}
                  placeholder="Tags, comma separated"
                  style={fieldStyle}
                />
                <textarea
                  value={subThreadForm.description}
                  onChange={(event) => setSubThreadForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Sub-thread description"
                  rows={4}
                  style={{ ...fieldStyle, resize: "vertical" }}
                />
                <textarea
                  value={subThreadForm.tasksText}
                  onChange={(event) => setSubThreadForm((current) => ({ ...current, tasksText: event.target.value }))}
                  placeholder="Tasks, one per line"
                  rows={3}
                  style={{ ...fieldStyle, resize: "vertical" }}
                />
                <button
                  type="button"
                  disabled={disabled || !subThreadForm.title.trim() || !subThreadForm.description.trim()}
                  onClick={submitSubThread}
                  style={actionButtonStyle(accentColor)}
                >
                  Open sub-thread
                </button>
              </div>
            )}
          </section>

          <section style={cardStyle}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>Tasks</div>
            <div style={{ display: "grid", gap: 10 }}>
              {tasks.length === 0 ? (
                <div style={{ fontSize: 12, opacity: 0.7 }}>No tasks yet.</div>
              ) : (
                tasks.map((task) => (
                  <BoardRoomTask
                    key={task.taskId}
                    task={task}
                    accentColor={accentColor}
                    disabled={disabled || thread.status === "CLOSED"}
                    onToggle={() => onToggleTask?.(thread.threadId, task)}
                  />
                ))
              )}
            </div>
            {thread.status !== "CLOSED" && (
              <div style={{ display: "grid", gap: 10 }}>
                <input
                  value={taskDescription}
                  onChange={(event) => setTaskDescription(event.target.value)}
                  placeholder="Add task"
                  style={fieldStyle}
                />
                <button
                  type="button"
                  disabled={disabled || !taskDescription.trim()}
                  onClick={async () => {
                    await onCreateTask?.(thread.threadId, taskDescription);
                    setTaskDescription("");
                  }}
                  style={actionButtonStyle(accentColor)}
                >
                  Add task
                </button>
              </div>
            )}
          </section>

          {thread.status !== "CLOSED" && (
            <section style={cardStyle}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>Close thread</div>
              <input
                value={closeForm.closureCommit}
                onChange={(event) => setCloseForm((current) => ({ ...current, closureCommit: event.target.value }))}
                placeholder="Closure commit"
                style={fieldStyle}
              />
              <input
                value={closeForm.closurePR}
                onChange={(event) => setCloseForm((current) => ({ ...current, closurePR: event.target.value }))}
                placeholder="Closure PR"
                style={fieldStyle}
              />
              <textarea
                value={closeForm.note}
                onChange={(event) => setCloseForm((current) => ({ ...current, note: event.target.value }))}
                placeholder="Closure note"
                rows={4}
                style={{ ...fieldStyle, resize: "vertical" }}
              />
              <button
                type="button"
                disabled={disabled}
                onClick={() => onCloseThread?.(thread.threadId, closeForm)}
                style={actionButtonStyle("#fca5a5")}
              >
                Close thread
              </button>
            </section>
          )}
        </div>

        <div style={{ display: "grid", gap: 18, alignContent: "start" }}>
          {thread.status !== "CLOSED" && (
            <section style={cardStyle}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>New post</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <input
                  value={postForm.author}
                  onChange={(event) => setPostForm((current) => ({ ...current, author: event.target.value }))}
                  placeholder="Author"
                  style={fieldStyle}
                />
                <select
                  value={postForm.authorType}
                  onChange={(event) => setPostForm((current) => ({ ...current, authorType: event.target.value }))}
                  style={fieldStyle}
                >
                  <option value="human">human</option>
                  <option value="agent">agent</option>
                </select>
                <select
                  value={postForm.type}
                  onChange={(event) => setPostForm((current) => ({ ...current, type: event.target.value }))}
                  style={fieldStyle}
                >
                  {["comment", "chat", "suggestion", "plan", "decision", "milestone", "heartbeat"].map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <input
                  value={postForm.mentions}
                  onChange={(event) => setPostForm((current) => ({ ...current, mentions: event.target.value }))}
                  placeholder="Mentions, comma separated"
                  style={fieldStyle}
                />
                <select
                  value={postForm.priority}
                  onChange={(event) => setPostForm((current) => ({ ...current, priority: event.target.value }))}
                  style={fieldStyle}
                >
                  {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                value={postForm.content}
                onChange={(event) => setPostForm((current) => ({ ...current, content: event.target.value }))}
                placeholder="Post content"
                rows={6}
                style={{ ...fieldStyle, resize: "vertical" }}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <input
                  value={postForm.linkedCommit}
                  onChange={(event) => setPostForm((current) => ({ ...current, linkedCommit: event.target.value }))}
                  placeholder="Linked commit"
                  style={fieldStyle}
                />
                <input
                  value={postForm.linkedPR}
                  onChange={(event) => setPostForm((current) => ({ ...current, linkedPR: event.target.value }))}
                  placeholder="Linked PR"
                  style={fieldStyle}
                />
              </div>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={postForm.acknowledgmentRequired}
                  onChange={(event) => setPostForm((current) => ({
                    ...current,
                    acknowledgmentRequired: event.target.checked,
                  }))}
                />
                Require acknowledgment
              </label>
              <button
                type="button"
                disabled={disabled || !postForm.content.trim()}
                onClick={submitPost}
                style={actionButtonStyle(accentColor)}
              >
                Post to thread
              </button>
            </section>
          )}

          <section style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>Thread activity</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>{posts.length} posts</div>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              {posts.length === 0 ? (
                <div style={{ fontSize: 12, opacity: 0.7 }}>No posts yet.</div>
              ) : (
                posts.map((post) => (
                  <BoardRoomPost
                    key={post.postId}
                    post={post}
                    accentColor={accentColor}
                    defaultResponder={adminIdentity}
                    disabled={disabled || thread.status === "CLOSED"}
                    onAcknowledge={(currentPost, response) =>
                      onAcknowledgePost?.(thread.threadId, currentPost, response)
                    }
                    onApprove={(currentPost) => onApprovePlan?.(thread.threadId, currentPost)}
                    onReject={(currentPost) => onRejectPlan?.(thread.threadId, currentPost)}
                  />
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}

const emptyStateStyle = {
  borderRadius: 24,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(7,15,27,0.72)",
  padding: 24,
  minHeight: 540,
  display: "grid",
  placeItems: "center",
  textAlign: "center",
};

const containerStyle = {
  borderRadius: 24,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(7,15,27,0.72)",
  padding: 20,
  display: "grid",
  gap: 18,
};

const headerStyle = {
  display: "grid",
  gap: 12,
  paddingBottom: 16,
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};

const cardStyle = {
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.02)",
  padding: 14,
  display: "grid",
  gap: 10,
};

const fieldStyle = {
  width: "100%",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(15,23,42,0.35)",
  color: "inherit",
  padding: "10px 12px",
};

function actionButtonStyle(accentColor) {
  return {
    border: 0,
    borderRadius: 12,
    padding: "10px 14px",
    background: accentColor,
    color: "#04111f",
    fontWeight: 800,
    cursor: "pointer",
  };
}

function linkedThreadButtonStyle(isParent) {
  return {
    textAlign: "left",
    borderRadius: 12,
    border: `1px solid ${isParent ? "rgba(125,211,252,0.3)" : "rgba(255,255,255,0.08)"}`,
    background: isParent ? "rgba(56,189,248,0.1)" : "rgba(255,255,255,0.03)",
    color: "inherit",
    padding: "10px 12px",
    display: "grid",
    gap: 6,
    cursor: "pointer",
  };
}
