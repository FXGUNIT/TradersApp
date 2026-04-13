import React from "react";

export default function BoardRoomSidebar({
  draft,
  filters,
  filteredThreads,
  activeThreadId,
  isSubmitting = false,
  loadingThreads = false,
  templates = [],
  availableAgents = [],
  availableTags = [],
  onDraftChange,
  onApplyTemplate,
  onCreateThread,
  onSelectThread,
  onSetFilters,
}) {
  return (
    <aside
      style={{
        display: "grid",
        gap: 16,
        alignContent: "start",
      }}
    >
      <section style={panelStyle}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>Open Thread</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Use a template or draft a thread from scratch.
          </div>
        </div>

        <select
          value={draft.templateId}
          onChange={(event) => onApplyTemplate(event.target.value)}
          style={inputStyle}
        >
          <option value="">Template</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>

        <input
          value={draft.title}
          onChange={(event) => onDraftChange("title", event.target.value)}
          placeholder="Thread title"
          style={inputStyle}
        />

        <input
          value={draft.ownerAgent}
          onChange={(event) => onDraftChange("ownerAgent", event.target.value)}
          placeholder="Owner agent"
          style={inputStyle}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <input
            value={draft.createdBy}
            onChange={(event) => onDraftChange("createdBy", event.target.value)}
            placeholder="Created by"
            style={inputStyle}
          />
          <select
            value={draft.priority}
            onChange={(event) => onDraftChange("priority", event.target.value)}
            style={inputStyle}
          >
            {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </div>

        <input
          value={draft.tags}
          onChange={(event) => onDraftChange("tags", event.target.value)}
          placeholder="Tags, comma separated"
          style={inputStyle}
        />

        <textarea
          value={draft.description}
          onChange={(event) => onDraftChange("description", event.target.value)}
          placeholder="Description"
          rows={5}
          style={textareaStyle}
        />

        <textarea
          value={draft.tasksText}
          onChange={(event) => onDraftChange("tasksText", event.target.value)}
          placeholder="Tasks, one per line"
          rows={4}
          style={textareaStyle}
        />

        <button
          type="button"
          disabled={isSubmitting}
          onClick={onCreateThread}
          style={primaryButtonStyle}
        >
          {isSubmitting ? "Creating..." : "Create thread"}
        </button>
      </section>

      <section style={panelStyle}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>Filters</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Priority, status, agent, and tag filters.
          </div>
        </div>

        <input
          value={filters.query}
          onChange={(event) => onSetFilters({ query: event.target.value })}
          placeholder="Search title or description"
          style={inputStyle}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <select
            value={filters.priority}
            onChange={(event) => onSetFilters({ priority: event.target.value })}
            style={inputStyle}
          >
            {["ALL", "LOW", "MEDIUM", "HIGH", "CRITICAL"].map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>

          <select
            value={filters.status}
            onChange={(event) => onSetFilters({ status: event.target.value })}
            style={inputStyle}
          >
            {["ALL", "OPEN", "CLOSED"].map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <select
            value={filters.agent}
            onChange={(event) => onSetFilters({ agent: event.target.value })}
            style={inputStyle}
          >
            <option value="ALL">All agents</option>
            {availableAgents.map((agent) => (
              <option key={agent} value={agent}>
                {agent}
              </option>
            ))}
          </select>

          <select
            value={filters.tag}
            onChange={(event) => onSetFilters({ tag: event.target.value })}
            style={inputStyle}
          >
            <option value="ALL">All tags</option>
            {availableTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section style={{ ...panelStyle, minHeight: 300 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>Threads</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{filteredThreads.length}</div>
        </div>

        {loadingThreads ? (
          <div style={{ fontSize: 13, opacity: 0.75 }}>Loading board room threads...</div>
        ) : filteredThreads.length === 0 ? (
          <div style={{ fontSize: 13, opacity: 0.75 }}>No threads match the current filters.</div>
        ) : (
          filteredThreads.map((thread) => {
            const isActive = thread.threadId === activeThreadId;
            return (
              <button
                key={thread.threadId}
                type="button"
                onClick={() => onSelectThread(thread.threadId)}
                style={{
                  textAlign: "left",
                  borderRadius: 14,
                  border: `1px solid ${isActive ? "rgba(125,211,252,0.55)" : "rgba(255,255,255,0.08)"}`,
                  background: isActive ? "rgba(56,189,248,0.12)" : "rgba(255,255,255,0.02)",
                  color: "inherit",
                  padding: 12,
                  display: "grid",
                  gap: 8,
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{thread.title}</span>
                  <span style={{ fontSize: 10, opacity: 0.7 }}>{thread.priority}</span>
                </div>
                <div style={{ fontSize: 11, opacity: 0.72 }}>
                  {thread.ownerAgent} · {thread.status}
                </div>
                {Array.isArray(thread.tags) && thread.tags.length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {thread.tags.slice(0, 3).map((tag) => (
                      <span
                        key={`${thread.threadId}-${tag}`}
                        style={{
                          borderRadius: 999,
                          padding: "2px 8px",
                          background: "rgba(255,255,255,0.08)",
                          fontSize: 10,
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            );
          })
        )}
      </section>
    </aside>
  );
}

const panelStyle = {
  borderRadius: 20,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(7,15,27,0.72)",
  padding: 16,
  display: "grid",
  gap: 12,
};

const inputStyle = {
  width: "100%",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(15,23,42,0.35)",
  color: "inherit",
  padding: "10px 12px",
};

const textareaStyle = {
  ...inputStyle,
  resize: "vertical",
  minHeight: 90,
};

const primaryButtonStyle = {
  border: 0,
  borderRadius: 12,
  padding: "12px 16px",
  background: "linear-gradient(135deg, #38bdf8, #14b8a6)",
  color: "#04111f",
  fontWeight: 800,
  cursor: "pointer",
};
