/**
 * ═══════════════════════════════════════════════════════════════════
 * WAITING ROOM - Phase 3: Admin Approval
 * ═══════════════════════════════════════════════════════════════════
 *
 * Component: WaitingRoom
 * Purpose: Live component that waits for admin approval
 * Key Feature: Auto-updates when status changes from PENDING → ACTIVE
 *
 * Tasks: 3.1, 3.2, 3.6, 3.8
 */

import React, { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import ConfettiCelebration from "../components/ConfettiCelebration.jsx";
import { auth as firebaseAuth, db as firebaseDb } from "../services/firebase.js";

function WaitingRoom({ onApproved, onNavigate }) {
  const [status, setStatus] = useState("PENDING");
  const [showConfetti, setShowConfetti] = useState(false);

  const uid = firebaseAuth?.currentUser?.uid;
  const email = firebaseAuth?.currentUser?.email || "";

  useEffect(() => {
    if (!uid) {
      console.warn("No UID found - redirecting to login");
      if (onNavigate) onNavigate("login");
      return;
    }

    if (!firebaseDb) {
      console.warn("WaitingRoom Firebase unavailable - falling back to login");
      if (onNavigate) onNavigate("login");
      return;
    }

    // === LIVE STATUS LISTENER ===
    const statusRef = ref(firebaseDb, `users/${uid}/status`);
    const unsubscribe = onValue(statusRef, (snapshot) => {
      const newStatus = snapshot.val();
      console.warn("📡 Status changed:", newStatus);

      setStatus(newStatus);

      // === MAGIC HANDSHAKE ===
      if (newStatus === "ACTIVE") {
        console.warn("🎉 Application APPROVED!");

        // Trigger confetti
        setShowConfetti(true);

        // Wait briefly then route
        setTimeout(() => {
          if (onApproved) {
            onApproved(); // Notify parent to route
          } else if (onNavigate) {
            onNavigate("hub"); // Or 'app' for MainTerminal
          }
        }, 2000); // 2 second celebration
      }
    });

    // Cleanup listener on unmount
    return () => unsubscribe();
  }, [uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Render loading state while checking auth
  if (!uid) {
    return (
      <div style={styles.container}>
        <div style={styles.spinner}></div>
        <p style={styles.loadingText}>Loading...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {showConfetti && <ConfettiCelebration />}

      {/* Spinning Logo */}
      <div style={styles.logoContainer}>
        <div style={styles.spinner}></div>
      </div>

      {/* Main Message */}
      <h1 style={styles.title}>Your application is under review</h1>

      <p style={styles.subtitle}>
        The Chief will verify your identity within 48 hours.
      </p>

      {/* User email */}
      {email && <p style={styles.email}>Account: {email}</p>}

      {/* Status indicator */}
      <div style={styles.statusBadge}>
        Status: <span style={styles.statusValue}>{status}</span>
      </div>

      {/* Progress animation (only when PENDING) */}
      {status === "PENDING" && (
        <div style={styles.progressContainer}>
          <div style={styles.progressBar}>
            <div style={styles.progressFill}></div>
          </div>
          <p style={styles.progressText}>Waiting for approval...</p>
        </div>
      )}

      {/* Already approved message */}
      {status === "ACTIVE" && (
        <div style={styles.approvedContainer}>
          <p style={styles.approvedText}>
            🎉 You're approved! Redirecting to the Regiment...
          </p>
        </div>
      )}

      {/* Help text */}
      <p style={styles.helpText}>
        Need help? Contact support through the chat widget.
      </p>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0b1220 0%, #1a1a2e 100%)",
    color: "#fff",
    padding: "20px",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  logoContainer: {
    marginBottom: "32px",
  },
  spinner: {
    width: "80px",
    height: "80px",
    border: "4px solid rgba(255,255,255,0.1)",
    borderTopColor: "#30D158",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  loadingText: {
    color: "#8E8E93",
    fontSize: "14px",
    marginTop: "16px",
  },
  title: {
    fontSize: "28px",
    fontWeight: "700",
    marginBottom: "12px",
    textAlign: "center",
    background: "linear-gradient(90deg, #fff, #8E8E93)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  subtitle: {
    color: "#8E8E93",
    fontSize: "16px",
    marginBottom: "24px",
    textAlign: "center",
  },
  email: {
    color: "#636366",
    fontSize: "12px",
    marginBottom: "16px",
  },
  statusBadge: {
    marginTop: "16px",
    padding: "8px 16px",
    background: "rgba(255,255,255,0.1)",
    borderRadius: "8px",
    fontSize: "14px",
    color: "#FFD60A",
  },
  statusValue: {
    fontWeight: "700",
    textTransform: "uppercase",
  },
  progressContainer: {
    marginTop: "32px",
    width: "100%",
    maxWidth: "300px",
  },
  progressBar: {
    width: "100%",
    height: "4px",
    background: "rgba(255,255,255,0.1)",
    borderRadius: "2px",
    overflow: "hidden",
  },
  progressFill: {
    width: "30%",
    height: "100%",
    background: "linear-gradient(90deg, #30D158, #34C759)",
    borderRadius: "2px",
    animation: "pulse 2s ease-in-out infinite",
  },
  progressText: {
    color: "#8E8E93",
    fontSize: "12px",
    marginTop: "8px",
    textAlign: "center",
  },
  approvedContainer: {
    marginTop: "32px",
    padding: "16px 24px",
    background: "rgba(48, 209, 88, 0.1)",
    border: "1px solid rgba(48, 209, 88, 0.3)",
    borderRadius: "12px",
  },
  approvedText: {
    color: "#30D158",
    fontSize: "16px",
    fontWeight: "600",
  },
  helpText: {
    position: "absolute",
    bottom: "24px",
    color: "#636366",
    fontSize: "12px",
  },
};

export default WaitingRoom;
