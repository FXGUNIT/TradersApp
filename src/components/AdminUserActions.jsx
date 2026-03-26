/**
 * ═══════════════════════════════════════════════════════════════════
 * ADMIN USER ACTIONS - Phase 3
 * ═══════════════════════════════════════════════════════════════════
 *
 * Component: AdminUserActions
 * Purpose: Buttons for admins to approve, block, or lock users.
 *
 * Task: 3.4
 */

import React, { useState } from "react";
import { getAuth } from "firebase/auth";
import {
  approveUser,
  blockUser,
  lockUser,
} from "../services/clients/AdminSecurityClient.js";

function AdminUserActions({ user }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  let admin = null;
  try {
    admin = getAuth().currentUser;
  } catch {
    admin = null;
  }

  const handleApprove = async () => {
    if (!admin) {
      setError("Admin auth unavailable");
      return;
    }
    setIsLoading(true);
    setError(null);
    const result = await approveUser(user.uid, admin.uid);
    if (!result.success) {
      setError(result.error);
    }
    setIsLoading(false);
  };

  const handleBlock = async () => {
    if (!admin) {
      setError("Admin auth unavailable");
      return;
    }
    setIsLoading(true);
    setError(null);
    // Note: You might want a confirmation modal here in a real app
    const result = await blockUser(user.uid, admin.uid);
    if (!result.success) {
      setError(result.error);
    }
    setIsLoading(false);
  };

  const handleLock = async () => {
    if (!admin) {
      setError("Admin auth unavailable");
      return;
    }
    setIsLoading(true);
    setError(null);
    const result = await lockUser(user.uid, admin.uid);
    if (!result.success) {
      setError(result.error);
    }
    setIsLoading(false);
  };

  return (
    <div style={styles.container}>
      {user.status === "PENDING" && (
        <button
          onClick={handleApprove}
          disabled={isLoading}
          style={styles.approveButton}
        >
          {isLoading ? "..." : "Approve"}
        </button>
      )}

      {user.status === "ACTIVE" && (
        <button
          onClick={handleBlock}
          disabled={isLoading}
          style={styles.blockButton}
        >
          {isLoading ? "..." : "Block"}
        </button>
      )}

      {!user.isLocked && (
        <button
          onClick={handleLock}
          disabled={isLoading}
          style={styles.lockButton}
        >
          {isLoading ? "..." : "Lock"}
        </button>
      )}

      {error && <p style={styles.errorText}>{error}</p>}
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
  },
  approveButton: {
    background:
      "linear-gradient(135deg, var(--status-success, #34C759), rgba(52,199,89,0.72))",
    color: "var(--accent-text, #FFFFFF)",
    border: "1px solid rgba(52,199,89,0.3)",
    padding: "8px 12px",
    borderRadius: "6px",
    cursor: "pointer",
  },
  blockButton: {
    background:
      "linear-gradient(135deg, var(--status-error, #FF3B30), rgba(255,59,48,0.72))",
    color: "var(--accent-text, #FFFFFF)",
    border: "1px solid rgba(255,59,48,0.3)",
    padding: "8px 12px",
    borderRadius: "6px",
    cursor: "pointer",
  },
  lockButton: {
    background:
      "linear-gradient(135deg, var(--status-warning, #FF9500), rgba(255,149,0,0.72))",
    color: "var(--accent-text, #FFFFFF)",
    border: "1px solid rgba(255,149,0,0.3)",
    padding: "8px 12px",
    borderRadius: "6px",
    cursor: "pointer",
  },
  errorText: {
    color: "var(--status-error, #FF3B30)",
    fontSize: "12px",
  },
};

export default AdminUserActions;
