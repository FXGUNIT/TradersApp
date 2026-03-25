import React, { useEffect, useMemo, useRef, useState } from "react";

import { computeJournalMetrics, formatMetricNumber } from "./journalMetrics";
import {
  makeImgHandler,
  onScreenshotDrop,
  toDataUrl,
} from "./terminalUploadUtils";

const SURFACE = {
  bg: "var(--aura-base-layer, #07111f)",
  panel: "var(--aura-surface-elevated, rgba(8, 18, 35, 0.88))",
  panelAlt: "var(--aura-surface-primary, rgba(12, 28, 52, 0.82))",
  border: "var(--aura-border-subtle, rgba(111, 168, 255, 0.22))",
  muted: "var(--aura-text-secondary, #9fb1cb)",
  text: "var(--aura-text-primary, #edf4ff)",
  accent: "var(--aura-accent-primary, #5bb7ff)",
  accentStrong: "var(--aura-accent-success, #79f7d4)",
  success: "var(--aura-accent-success, #37d67a)",
  danger: "var(--aura-accent-danger, #ff6b6b)",
  warning: "var(--aura-accent-warning, #ffc857)",
};

const defaultTradeForm = {
  date: new Date().toISOString().slice(0, 10),
  instrument: "MNQ",
  result: "win",
  pnl: "",
  entry: "",
  exit: "",
  notes: "",
};

const defaultAccountState = {
  startingBalance: "",
  currentBalance: "",
  highWaterMark: "",
  dailyStartBalance: "",
};

function normalizeJournal(journal) {
  if (Array.isArray(journal)) return journal;
  if (journal && typeof journal === "object") return Object.values(journal);
  return [];
}

function buildAccountState(accountState) {
  return {
    ...defaultAccountState,
    ...(accountState || {}),
  };
}

function cardStyle(extra = {}) {
  return {
    background: SURFACE.panel,
    border: `1px solid ${SURFACE.border}`,
    borderRadius: 18,
    padding: 20,
    boxShadow: "0 18px 60px rgba(0, 0, 0, 0.25)",
    ...extra,
  };
}

function dropZoneStyle(active = false) {
  return {
    ...cardStyle({
      minHeight: 150,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      gap: 10,
      borderStyle: "dashed",
      borderColor: active ? SURFACE.accentStrong : SURFACE.border,
      background: active
        ? "var(--aura-accent-primary-hover, rgba(35, 78, 125, 0.45))"
        : SURFACE.panelAlt,
      textAlign: "center",
    }),
  };
}

function inputStyle() {
  return {
    width: "100%",
    background: "var(--aura-surface-primary, rgba(5, 12, 24, 0.9))",
    border: `1px solid ${SURFACE.border}`,
    borderRadius: 10,
    color: SURFACE.text,
    padding: "10px 12px",
    outline: "none",
  };
}

function buttonStyle(kind = "primary") {
  const palette =
    kind === "ghost"
      ? {
          background: "transparent",
          border: SURFACE.border,
          color: SURFACE.muted,
        }
      : kind === "danger"
        ? {
            background:
              "var(--aura-accent-danger-subtle, rgba(255, 107, 107, 0.14))",
            border:
              "var(--aura-accent-danger-border, rgba(255, 107, 107, 0.35))",
            color: SURFACE.danger,
          }
        : {
            background:
              "var(--aura-accent-primary-subtle, rgba(91, 183, 255, 0.16))",
            border:
              "var(--aura-accent-primary-border, rgba(91, 183, 255, 0.34))",
            color: SURFACE.accent,
          };

  return {
    border: `1px solid ${palette.border}`,
    background: palette.background,
    color: palette.color,
    borderRadius: 10,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 700,
  };
}

function StatCard({ label, value, hint, tone = SURFACE.accent }) {
  return (
    <div style={cardStyle({ minHeight: 130 })}>
      <div
        style={{
          color: SURFACE.muted,
          fontSize: 12,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          marginBottom: 12,
        }}
      >
        {label}
      </div>
      <div style={{ color: tone, fontSize: 28, fontWeight: 800 }}>{value}</div>
      <div style={{ color: SURFACE.muted, fontSize: 13, marginTop: 8 }}>
        {hint}
      </div>
    </div>
  );
}

function AssetPreview({ asset, title }) {
  if (!asset) {
    return (
      <div style={cardStyle({ minHeight: 160, opacity: 0.7 })}>
        <div style={{ color: SURFACE.muted, fontSize: 14 }}>{title}</div>
        <div style={{ color: SURFACE.muted, fontSize: 13, marginTop: 10 }}>
          No image loaded yet.
        </div>
      </div>
    );
  }

  return (
    <div style={cardStyle({ overflow: "hidden" })}>
      <div style={{ color: SURFACE.muted, fontSize: 14, marginBottom: 10 }}>
        {title}
      </div>
      <img
        src={toDataUrl(asset)}
        alt={title}
        style={{
          width: "100%",
          maxHeight: 220,
          objectFit: "cover",
          borderRadius: 12,
          border: `1px solid ${SURFACE.border}`,
        }}
      />
      <div style={{ color: SURFACE.muted, fontSize: 12, marginTop: 8 }}>
        {asset.name}
      </div>
    </div>
  );
}

export default function MainTerminal({
  profile,
  onLogout,
  onSaveJournal,
  onSaveAccount,
  onSaveFirmRules: _onSaveFirmRules,
  showToast,
  auth: _auth,
  privacyMode: _privacyMode,
}) {
  const [activeTab, setActiveTab] = useState("capture");
  const [screenshots, setScreenshots] = useState([]);
  const [mpChart, setMpChart] = useState(null);
  const [vwapChart, setVwapChart] = useState(null);
  const [tradeForm, setTradeForm] = useState(defaultTradeForm);
  const [journal, setJournal] = useState(() =>
    normalizeJournal(profile?.journal),
  );
  const [accountState, setAccountState] = useState(() =>
    buildAccountState(profile?.accountState),
  );
  const [dragTarget, setDragTarget] = useState("");

  const journalDidMount = useRef(false);
  const accountDidMount = useRef(false);

  useEffect(() => {
    setJournal(normalizeJournal(profile?.journal));
    setAccountState(buildAccountState(profile?.accountState));
  }, [profile?.uid]);

  useEffect(() => {
    const current = Number.parseFloat(accountState.currentBalance || "0");
    const high = Number.parseFloat(accountState.highWaterMark || "0");

    if (Number.isFinite(current) && current > high) {
      setAccountState((previous) => ({
        ...previous,
        highWaterMark: String(current),
      }));
    }
  }, [accountState.currentBalance, accountState.highWaterMark]);

  useEffect(() => {
    if (!journalDidMount.current) {
      journalDidMount.current = true;
      return;
    }
    if (onSaveJournal) {
      void onSaveJournal(journal);
    }
  }, [journal, onSaveJournal]);

  useEffect(() => {
    if (!accountDidMount.current) {
      accountDidMount.current = true;
      return;
    }
    if (onSaveAccount) {
      void onSaveAccount(accountState);
    }
  }, [accountState, onSaveAccount]);

  const metrics = useMemo(() => computeJournalMetrics(journal), [journal]);

  const handleAccountChange = (field) => (event) => {
    const nextValue = event.target.value;
    setAccountState((previous) => ({
      ...previous,
      [field]: nextValue,
    }));
  };

  const handleTradeChange = (field) => (event) => {
    const nextValue = event.target.value;
    setTradeForm((previous) => ({
      ...previous,
      [field]: nextValue,
    }));
  };

  const handleAddTrade = () => {
    if (!tradeForm.entry || !tradeForm.exit || !tradeForm.pnl) {
      showToast?.(
        "Entry, exit, and P&L are required before saving.",
        "warning",
      );
      return;
    }

    setJournal((previous) => [
      {
        ...tradeForm,
        id: `trade-${Date.now()}`,
      },
      ...previous,
    ]);
    setTradeForm((previous) => ({
      ...defaultTradeForm,
      instrument: previous.instrument,
    }));
    showToast?.("Journal entry saved and queued for cloud sync.", "success");
  };

  const handleRemoveTrade = (tradeId) => {
    setJournal((previous) => previous.filter((entry) => entry.id !== tradeId));
  };

  const handleDrop = async (event, runner, successMessage) => {
    try {
      await runner(event);
      if (successMessage) showToast?.(successMessage, "success");
    } catch (error) {
      showToast?.(error?.message || "Upload failed.", "error");
    } finally {
      setDragTarget("");
    }
  };

  const handleScreenshotUpload = (event) =>
    handleDrop(
      event,
      (nextEvent) => onScreenshotDrop(nextEvent, setScreenshots),
      "Screenshot tray updated.",
    );

  const handleMpUpload = (event) =>
    handleDrop(
      event,
      makeImgHandler(setMpChart),
      "Market profile image attached.",
    );

  const handleVwapUpload = (event) =>
    handleDrop(event, makeImgHandler(setVwapChart), "VWAP image attached.");

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "var(--aura-gradient-terminal, radial-gradient(circle at top, rgba(47,112,198,0.24), transparent 34%), linear-gradient(180deg, var(--aura-base-layer, #030711) 0%, var(--aura-surface-primary, #081425) 100%))",
        color: SURFACE.text,
        padding: "28px 24px 40px",
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          display: "grid",
          gap: 20,
        }}
      >
        <div
          style={{
            ...cardStyle({
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
            }),
          }}
        >
          <div>
            <div
              style={{
                color: SURFACE.accentStrong,
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: 1.5,
                marginBottom: 8,
              }}
            >
              Main Terminal
            </div>
            <h1 style={{ margin: 0, fontSize: 32 }}>Execution Workspace</h1>
            <div style={{ color: SURFACE.muted, marginTop: 10, fontSize: 14 }}>
              Logged in as {profile?.fullName || profile?.email || "Trader"}.
              Auto-sync is active for journal and account state.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[
              ["capture", "Capture Engine"],
              ["journal", "Journal"],
              ["account", "Account"],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                style={{
                  ...buttonStyle(key === activeTab ? "primary" : "ghost"),
                  color: key === activeTab ? SURFACE.accent : SURFACE.muted,
                }}
              >
                {label}
              </button>
            ))}
            <button onClick={onLogout} style={buttonStyle("danger")}>
              Logout
            </button>
          </div>
        </div>

        {activeTab === "capture" && (
          <div style={{ display: "grid", gap: 20 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr",
                gap: 20,
              }}
            >
              <div
                data-testid="terminal-screenshot-dropzone"
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragTarget("screenshots");
                }}
                onDragLeave={() => setDragTarget("")}
                onDrop={handleScreenshotUpload}
                style={dropZoneStyle(dragTarget === "screenshots")}
              >
                <div style={{ fontSize: 18, fontWeight: 700 }}>
                  Drop screenshots here
                </div>
                <div style={{ color: SURFACE.muted, maxWidth: 420 }}>
                  Native drag and drop is enabled. Image files are read as
                  base64 and stored in the terminal screenshot tray with a hard
                  limit of 4 images.
                </div>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleScreenshotUpload}
                  style={{ color: SURFACE.muted }}
                />
                <div
                  data-testid="terminal-screenshot-count"
                  style={{ color: SURFACE.accentStrong, fontSize: 13 }}
                >
                  {screenshots.length}/4 screenshots loaded
                </div>
              </div>

              <div
                data-testid="terminal-mp-dropzone"
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragTarget("mp");
                }}
                onDragLeave={() => setDragTarget("")}
                onDrop={handleMpUpload}
                style={dropZoneStyle(dragTarget === "mp")}
              >
                <div style={{ fontWeight: 700 }}>MP Chart Drop Zone</div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleMpUpload}
                  style={{ color: SURFACE.muted }}
                />
              </div>

              <div
                data-testid="terminal-vwap-dropzone"
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragTarget("vwap");
                }}
                onDragLeave={() => setDragTarget("")}
                onDrop={handleVwapUpload}
                style={dropZoneStyle(dragTarget === "vwap")}
              >
                <div style={{ fontWeight: 700 }}>VWAP Chart Drop Zone</div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleVwapUpload}
                  style={{ color: SURFACE.muted }}
                />
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 20,
              }}
            >
              <AssetPreview asset={mpChart} title="Market Profile" />
              <AssetPreview asset={vwapChart} title="VWAP / Execution Chart" />
              <div style={cardStyle()}>
                <div style={{ color: SURFACE.muted, marginBottom: 12 }}>
                  Screenshot Tray
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr)",
                    gap: 12,
                  }}
                >
                  {screenshots.map((asset) => (
                    <img
                      key={`${asset.name}-${asset.b64.slice(0, 24)}`}
                      src={toDataUrl(asset)}
                      alt={asset.name}
                      style={{
                        width: "100%",
                        height: 120,
                        objectFit: "cover",
                        borderRadius: 12,
                        border: `1px solid ${SURFACE.border}`,
                      }}
                    />
                  ))}
                  {screenshots.length === 0 && (
                    <div style={{ color: SURFACE.muted, fontSize: 13 }}>
                      No screenshots captured yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "journal" && (
          <div style={{ display: "grid", gap: 20 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 20,
              }}
            >
              <StatCard
                label="Win Rate"
                value={`${formatMetricNumber(metrics.wr, 1)}%`}
                hint={`${metrics.wins.length} wins / ${journal.length} trades`}
                tone={SURFACE.accentStrong}
              />
              <StatCard
                label="Profit Factor"
                value={formatMetricNumber(metrics.pf)}
                hint={`Avg win ${formatMetricNumber(metrics.avgWin)} vs avg loss ${formatMetricNumber(metrics.avgLoss)}`}
                tone={SURFACE.warning}
              />
              <StatCard
                label="Net P&L"
                value={`${metrics.pnlTotal >= 0 ? "+" : ""}${formatMetricNumber(metrics.pnlTotal)}`}
                hint={`${metrics.losses.length} losses tracked live`}
                tone={metrics.pnlTotal >= 0 ? SURFACE.success : SURFACE.danger}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "340px 1fr",
                gap: 20,
                alignItems: "start",
              }}
            >
              <div style={cardStyle()}>
                <div
                  style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}
                >
                  Add Journal Entry
                </div>
                <div style={{ display: "grid", gap: 12 }}>
                  <input
                    type="date"
                    value={tradeForm.date}
                    onChange={handleTradeChange("date")}
                    style={inputStyle()}
                  />
                  <input
                    type="text"
                    value={tradeForm.instrument}
                    onChange={handleTradeChange("instrument")}
                    placeholder="Instrument"
                    style={inputStyle()}
                  />
                  <select
                    value={tradeForm.result}
                    onChange={handleTradeChange("result")}
                    style={inputStyle()}
                  >
                    <option value="win">Win</option>
                    <option value="loss">Loss</option>
                    <option value="breakeven">Breakeven</option>
                  </select>
                  <input
                    type="number"
                    value={tradeForm.entry}
                    onChange={handleTradeChange("entry")}
                    placeholder="Entry price"
                    style={inputStyle()}
                  />
                  <input
                    type="number"
                    value={tradeForm.exit}
                    onChange={handleTradeChange("exit")}
                    placeholder="Exit price"
                    style={inputStyle()}
                  />
                  <input
                    type="number"
                    value={tradeForm.pnl}
                    onChange={handleTradeChange("pnl")}
                    placeholder="P&L"
                    style={inputStyle()}
                  />
                  <textarea
                    value={tradeForm.notes}
                    onChange={handleTradeChange("notes")}
                    placeholder="Setup notes"
                    rows={4}
                    style={inputStyle()}
                  />
                  <button
                    onClick={handleAddTrade}
                    style={buttonStyle("primary")}
                  >
                    Save Entry
                  </button>
                </div>
              </div>

              <div style={cardStyle({ overflowX: "auto" })}>
                <div
                  style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}
                >
                  Journal Ledger
                </div>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 14,
                  }}
                >
                  <thead>
                    <tr style={{ color: SURFACE.muted, textAlign: "left" }}>
                      <th style={{ paddingBottom: 10 }}>Date</th>
                      <th style={{ paddingBottom: 10 }}>Instrument</th>
                      <th style={{ paddingBottom: 10 }}>Result</th>
                      <th style={{ paddingBottom: 10 }}>Entry</th>
                      <th style={{ paddingBottom: 10 }}>Exit</th>
                      <th style={{ paddingBottom: 10 }}>P&L</th>
                      <th style={{ paddingBottom: 10 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {journal.map((entry, index) => (
                      <tr
                        key={entry.id || `${entry.date || "trade"}-${index}`}
                        style={{
                          borderTop: `1px solid ${SURFACE.border}`,
                        }}
                      >
                        <td style={{ padding: "12px 0" }}>
                          {entry.date || "—"}
                        </td>
                        <td style={{ padding: "12px 0" }}>
                          {entry.instrument || "—"}
                        </td>
                        <td
                          style={{
                            padding: "12px 0",
                            color:
                              String(entry.result).toLowerCase() === "win"
                                ? SURFACE.success
                                : String(entry.result).toLowerCase() === "loss"
                                  ? SURFACE.danger
                                  : SURFACE.warning,
                          }}
                        >
                          {entry.result || "—"}
                        </td>
                        <td style={{ padding: "12px 0" }}>
                          {entry.entry || "—"}
                        </td>
                        <td style={{ padding: "12px 0" }}>
                          {entry.exit || "—"}
                        </td>
                        <td style={{ padding: "12px 0" }}>
                          {entry.pnl || "—"}
                        </td>
                        <td style={{ padding: "12px 0" }}>
                          <button
                            onClick={() => handleRemoveTrade(entry.id)}
                            style={buttonStyle("ghost")}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                    {journal.length === 0 && (
                      <tr>
                        <td
                          colSpan={7}
                          style={{ paddingTop: 20, color: SURFACE.muted }}
                        >
                          No journal entries yet. Add one to start the live math
                          dashboard.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "account" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 20,
            }}
          >
            {[
              ["startingBalance", "Starting Balance"],
              ["currentBalance", "Current Balance"],
              ["highWaterMark", "High-Water Mark"],
              ["dailyStartBalance", "Daily Start Balance"],
            ].map(([field, label]) => (
              <div key={field} style={cardStyle()}>
                <div style={{ color: SURFACE.muted, marginBottom: 10 }}>
                  {label}
                </div>
                <input
                  type="number"
                  value={accountState[field] || ""}
                  onChange={handleAccountChange(field)}
                  style={inputStyle()}
                />
              </div>
            ))}
            <div style={cardStyle({ gridColumn: "1 / -1" })}>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
                Sync Status
              </div>
              <div style={{ color: SURFACE.muted, lineHeight: 1.7 }}>
                Account state changes are pushed upward through
                <code style={{ marginLeft: 6 }}>
                  onSaveAccount(accountState)
                </code>
                . Journal changes are pushed upward through
                <code style={{ marginLeft: 6 }}>onSaveJournal(journal)</code>.
                This terminal now treats Firebase persistence as a parent
                concern instead of writing directly from inside the feature.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
