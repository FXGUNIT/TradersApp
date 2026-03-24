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
import { approveUser, blockUser, lockUser } from "../services/adminService.js";

function AdminUserActions({ user }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const admin = getAuth().currentUser;

  const handleApprove = async () => {
    setIsLoading(true);
    setError(null);
    const result = await approveUser(user.uid, admin.uid);
    if (!result.success) {
      setError(result.error);
    }
    setIsLoading(false);
  };

  const handleBlock = async () => {
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
        <button onClick={handleApprove} disabled={isLoading} style={styles.approveButton}>
          {isLoading ? "..." : "Approve"}
        </button>
      )}
      
      {user.status === "ACTIVE" && (
         <button onClick={handleBlock} disabled={isLoading} style={styles.blockButton}>
            {isLoading ? "..." : "Block"}
        </button>
      )}

      {!user.isLocked && (
         <button onClick={handleLock} disabled={isLoading} style={styles.lockButton}>
            {isLoading ? "..." : "Lock"}
        </button>
      )}

      {error && <p style={styles.errorText}>{error}</p>}
    </div>
  );
}

const styles = {
    container: {
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
    },
    approveButton: {
        backgroundColor: '#34C759',
        color: 'white',
        border: 'none',
        padding: '8px 12px',
        borderRadius: '6px',
        cursor: 'pointer',
    },
    blockButton: {
        backgroundColor: '#FF3B30',
        color: 'white',
        border: 'none',
        padding: '8px 12px',
        borderRadius: '6px',
        cursor: 'pointer',
    },
    lockButton: {
        backgroundColor: '#FF9500',
        color: 'white',
        border: 'none',
        padding: '8px 12px',
        borderRadius: '6px',
        cursor: 'pointer',
    },
    errorText: {
        color: '#FF3B30',
        fontSize: '12px',
    }
};

export default AdminUserActions;
