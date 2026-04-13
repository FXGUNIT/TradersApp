/* Auto-extracted from AdminDashboardScreen.jsx — user docs modal */
import React from "react";
import { X } from "lucide-react";

export default function AdminUserDocsModal({
  T,
  selectedUserDocs, setSelectedUserDocs,
  searchFilteredUsers, authBtn,
}) {
  if (!selectedUserDocs) return null;
  const userName = searchFilteredUsers.find(([uid]) => uid === selectedUserDocs)?.[1]?.fullName || "Unknown";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(5px)" }}>
      <div style={{ background: "rgba(20,20,20,0.95)", border: `1px solid ${T.green}40`, borderRadius: 12, padding: 28, maxWidth: 600, maxHeight: "80vh", overflowY: "auto", boxShadow: `0 0 40px rgba(52,199,89,0.2)`, backdropFilter: "blur(10px)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${T.green}30` }}>
          <div style={{ color: T.green, fontSize: 14, letterSpacing: 2, fontWeight: 700 }}>📄 IDENTITY DOCUMENTS (RULE #24)</div>
          <button onClick={() => setSelectedUserDocs(null)} style={{ background: "transparent", border: "none", color: T.muted, fontSize: 20, cursor: "pointer", padding: "4px 8px" }}>
            <X size={14} />
          </button>
        </div>
        <div style={{ marginBottom: 20 }}>
          <div style={{ color: T.muted, fontSize: 12, marginBottom: 12, fontWeight: 600 }}>User: {userName}</div>
          <div style={{ padding: 16, background: "rgba(52,199,89,0.1)", borderRadius: 8, border: `1px solid ${T.green}30`, minHeight: 120, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
            <div style={{ color: T.green, fontSize: 14 }}>📁</div>
            <div style={{ color: T.muted, fontSize: 12, textAlign: "center" }}>
              Identity documents for this user will appear here.<br />
              <span style={{ fontSize: 11, color: T.dim }}>(Currently uploaded documents from Aadhar, Passport, License, PAN)</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button onClick={() => setSelectedUserDocs(null)} style={{ ...(authBtn ? authBtn(T.muted, false) : {}), background: "transparent" }}>CLOSE</button>
        </div>
      </div>
    </div>
  );
}
