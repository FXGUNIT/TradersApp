/* eslint-disable no-unused-vars */
import { Suspense, useEffect, useState } from "react";
import ThemeSwitcher from "../../components/ThemeSwitcher.jsx";
import { createShellChrome } from "./appShellChrome.jsx";
import { useOfflineStatus } from "../../hooks/useOfflineStatus.js";
import TiltLockout, {
  isTiltLocked,
} from "../../features/terminal/TiltLockout.jsx";

function AppRuntimeScreen({
  AiEnginesStatus,
  LoadingFallback,
  MainTerminal,
  T,
  aiStatuses,
  auth,
  currentTheme,
  handleLogout,
  handleThemeChange,
  isAudioMuted,
  profile,
  saveAccount,
  saveFirmRules,
  saveJournal,
  setConsciousnessReturnScreen,
  setIsAudioMuted,
  setScreen,
  showToast,
}) {
  const [tiltLocked, setTiltLocked] = useState(isTiltLocked);
  const { isOnline, isSyncing } = useOfflineStatus();

  useEffect(() => {
    const handler = () => setTiltLocked(true);
    window.addEventListener("tilt-lock", handler);
    return () => window.removeEventListener("tilt-lock", handler);
  }, []);

  return (
    <>
      {tiltLocked && <TiltLockout onUnlocked={() => setTiltLocked(false)} />}

      <div
        style={{
          position: "relative",
          borderTop: isOnline ? "none" : "2px solid #d4a520",
          transition: "border-color 0.4s ease",
          pointerEvents: tiltLocked ? "none" : "auto",
        }}
      >
        {!isOnline && (
          <div
            style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              background: "rgba(212, 165, 32, 0.12)",
              borderTop: "1px solid rgba(212, 165, 32, 0.4)",
              padding: "6px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              zIndex: 9999,
            }}
          >
            <span
              style={{
                color: "#d4a520",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: 2,
              }}
            >
              {isSyncing
                ? "↻ SYNCING TO LOCAL VAULT..."
                : "OFFLINE - REQUESTS QUEUED"}
            </span>
          </div>
        )}

        <div
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            zIndex: 100,
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          <AiEnginesStatus statuses={aiStatuses} />
          <button
            onClick={() => setIsAudioMuted((value) => !value)}
            title={isAudioMuted ? "Unmute audio cues" : "Mute audio cues"}
            style={{
              background: isAudioMuted
                ? "rgba(255,255,255,0.05)"
                : "rgba(255,255,255,0.10)",
              border: isAudioMuted
                ? "1px solid rgba(255,255,255,0.12)"
                : "1px solid rgba(255,255,255,0.20)",
              borderRadius: 8,
              cursor: "pointer",
              color: isAudioMuted
                ? "rgba(255,255,255,0.30)"
                : "rgba(255,255,255,0.70)",
              padding: "5px 10px",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 1,
              minWidth: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s ease",
            }}
          >
            {isAudioMuted ? "\u{1F507}" : "\u{1F50A}"}
          </button>
          <ThemeSwitcher
            currentTheme={currentTheme}
            onThemeChange={handleThemeChange}
          />
          <button
            onClick={() => {
              const themes = ["lumiere", "amber", "midnight"];
              const idx = themes.indexOf(currentTheme);
              const nextTheme = themes[(idx + 1) % themes.length];
              handleThemeChange(nextTheme);
            }}
            title="Toggle Lumiere/Amber/Midnight mode"
            style={{
              display: "none",
              background: "var(--accent-primary, #3B82F6)",
              border: "1px solid var(--accent-primary, #3B82F6)",
              color: "var(--accent-text, #FFFFFF)",
              padding: "8px 12px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 12,
              fontFamily: T.font,
              fontWeight: 600,
            }}
            className="btn-glass"
          >
            {currentTheme === "lumiere"
              ? "\u2600\uFE0F LUMIERE"
              : currentTheme === "amber"
                ? "\u{1F7E0} AMBER"
                : "\u{1F319} MIDNIGHT"}
          </button>
          <button
            onClick={() => setScreen("sessions")}
            title="Manage active sessions"
            style={{
              background: "var(--accent-glow, rgba(52,144,220,0.3))",
              border: `1px solid ${T.blue}`,
              color: T.blue,
              padding: "8px 12px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 12,
              fontFamily: T.font,
              fontWeight: 600,
            }}
            className="btn-glass"
          >
            {"\u{1F4F1} SESSIONS"}
          </button>
        </div>

        <Suspense fallback={<LoadingFallback />}>
          <MainTerminal
            auth={auth}
            profile={profile}
            onLogout={handleLogout}
            onSaveJournal={saveJournal}
            onSaveAccount={saveAccount}
            onSaveFirmRules={saveFirmRules}
            showToast={showToast}
            onNavigateToConsciousness={() => {
              setConsciousnessReturnScreen("app");
              setScreen("consciousness");
            }}
          />
        </Suspense>

        <div
          id="tilt-lock-trigger"
          data-locked={tiltLocked}
          style={{ display: "none" }}
        />
      </div>
    </>
  );
}

export default function AppScreenRegistry({
  screen,
  CleanLoginScreen,
  AdminUnlockModal,
  CleanOnboarding,
  WaitingRoomScreen,
  ForcePasswordResetScreen,
  SessionsManagementScreen,
  RegimentHub,
  CollectiveConsciousnessPage,
  ErrorBoundaryAdmin,
  LoadingFallback,
  UserListProvider,
  AiEnginesStatus,
  AdminDashboardScreen,
  AdminInvitesView,
  SplashScreen,
  MainTerminal,
  auth,
  profile,
  googleUser,
  currentSessionId,
  currentTheme,
  theme,
  aiStatuses,
  consciousnessReturnScreen,
  isAdminAuthenticated,
  maintenanceModeActive,
  isAudioMuted,
  setIsAudioMuted,
  ADMIN_UID,
  ADMIN_EMAIL,
  listAdminUsers,
  approveAdminUser,
  blockAdminUser,
  EmptyStateCard,
  SupportChatModal,
  showAdminPrompt,
  showAdminPwd,
  adminMasterEmail,
  adminMasterEmailVerified,
  adminOtpStep,
  adminOtps,
  adminOtpsVerified,
  adminPassErr,
  adminPassInput,
  adminOtpErr,
  showToast,
  handleLogin,
  handleStructuredGoogleAuth,
  handleLoginPasswordReset,
  resetAdminPromptState,
  setShowAdminPrompt,
  setAdminMasterEmail,
  setAdminPassInput,
  setAdminOtps,
  setAdminOtpStep,
  handleAdminRequestNewCodes,
  sendAdminOTPs,
  setShowAdminPwd,
  handleAdminAccess,
  handleAdminVerifyCodes,
  handleStructuredSignup,
  handleBackToLoginFromSignup,
  checkApprovalStatus,
  handleResendVerificationEmail,
  handleLogout,
  handlePasswordReset,
  setScreen,
  setConsciousnessReturnScreen,
  handleThemeChange,
  handleToggleMaintenanceMode,
  saveJournal,
  saveAccount,
  saveFirmRules,
}) {
  const T = theme;
  const {
    authBtn,
    authCard,
    lbl,
    cardS,
    AMD_PHASES,
    LED,
    SHead,
    TableSkeletonLoader,
  } = createShellChrome(T);

  switch (screen) {
    case "login":
      return (
        <>
          <CleanLoginScreen
            onLogin={handleLogin}
            onSignup={() => setScreen("signup")}
            onAdmin={() => setShowAdminPrompt(true)}
            onGoogleAuth={handleStructuredGoogleAuth}
            onForgotPassword={handleLoginPasswordReset}
          />
          <AdminUnlockModal
            authButton={authBtn}
            authCardStyle={authCard}
            labelStyle={lbl}
            onCancel={() => resetAdminPromptState({ closePrompt: true })}
            onMasterEmailChange={setAdminMasterEmail}
            onPasswordChange={setAdminPassInput}
            onOtpChange={(field, value) =>
              setAdminOtps((prev) => ({
                ...prev,
                [field]: value,
              }))
            }
            onProceedToCodeEntry={() => setAdminOtpStep(true)}
            onRequestNew={handleAdminRequestNewCodes}
            onSendVerificationCodes={sendAdminOTPs}
            onTogglePasswordVisibility={() => setShowAdminPwd((prev) => !prev)}
            onUnlockAdmin={handleAdminAccess}
            onVerifyCodes={handleAdminVerifyCodes}
            passwordError={adminPassErr}
            passwordValue={adminPassInput}
            show={showAdminPrompt}
            showPassword={showAdminPwd}
            theme={T}
            verificationError={adminOtpErr}
            verificationState={{
              masterEmail: adminMasterEmail,
              masterEmailVerified: adminMasterEmailVerified,
              otpStep: adminOtpStep,
              otps: adminOtps,
              otpsVerified: adminOtpsVerified,
            }}
          />
        </>
      );

    case "signup":
      return (
        <Suspense fallback={<LoadingFallback />}>
          <CleanOnboarding
            onSignupSuccess={handleStructuredSignup}
            onGoogleSuccess={handleStructuredGoogleAuth}
            onBackToLogin={handleBackToLoginFromSignup}
            googleUser={googleUser}
          />
        </Suspense>
      );

    case "waiting":
      return (
        <Suspense fallback={<LoadingFallback />}>
          <WaitingRoomScreen
            profile={profile}
            auth={auth}
            onRefresh={checkApprovalStatus}
            onResendVerification={handleResendVerificationEmail}
            onLogout={handleLogout}
          />
        </Suspense>
      );

    case "forcePasswordReset":
      return (
        <Suspense fallback={<LoadingFallback />}>
          <ForcePasswordResetScreen
            profile={profile}
            onReset={handlePasswordReset}
            onLogout={handleLogout}
            theme={T}
          />
        </Suspense>
      );

    case "sessions":
      return (
        <Suspense fallback={<LoadingFallback />}>
          <SessionsManagementScreen
            profile={profile}
            auth={auth}
            currentSessionId={currentSessionId}
            onBack={() => setScreen("hub")}
            showToast={showToast}
          />
        </Suspense>
      );

    case "hub":
      return (
        <Suspense fallback={<LoadingFallback />}>
          <RegimentHub
            onNavigate={(dest) => {
              if (dest === "consciousness") {
                setConsciousnessReturnScreen("hub");
              }
              setScreen(dest);
            }}
            profile={profile}
            theme={theme}
            currentTheme={currentTheme}
            onThemeChange={handleThemeChange}
            aiStatuses={aiStatuses}
          />
        </Suspense>
      );

    case "consciousness":
      return (
        <Suspense fallback={<LoadingFallback />}>
          <CollectiveConsciousnessPage
            onBack={() => setScreen(consciousnessReturnScreen || "hub")}
            theme={theme}
            currentTheme={currentTheme}
            onThemeChange={handleThemeChange}
            auth={auth}
            profile={profile}
            aiStatuses={aiStatuses}
          />
        </Suspense>
      );

    case "admin":
      return isAdminAuthenticated ? (
        <ErrorBoundaryAdmin>
          <Suspense fallback={<LoadingFallback />}>
            <UserListProvider>
              <div
                style={{
                  position: "absolute",
                  top: 10,
                  right: 10,
                  zIndex: 100,
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <AiEnginesStatus statuses={aiStatuses} />
              </div>
              <AdminDashboardScreen
                auth={auth}
                onLogout={handleLogout}
                isAdminAuthenticated={isAdminAuthenticated}
                showToast={showToast}
                maintenanceModeActive={maintenanceModeActive}
                handleToggleMaintenanceMode={handleToggleMaintenanceMode}
                T={T}
                authBtn={authBtn}
                cardS={cardS}
                ADMIN_UID={ADMIN_UID}
                ADMIN_EMAIL={ADMIN_EMAIL}
                listAdminUsers={listAdminUsers}
                approveAdminUser={approveAdminUser}
                blockAdminUser={blockAdminUser}
                AMD_PHASES={AMD_PHASES}
                LED={LED}
                SHead={SHead}
                TableSkeletonLoader={TableSkeletonLoader}
                EmptyStateCard={EmptyStateCard}
                SupportChatModal={SupportChatModal}
              />
              <AdminInvitesView showToast={showToast} />
            </UserListProvider>
          </Suspense>
        </ErrorBoundaryAdmin>
      ) : (
        <SplashScreen />
      );

    case "app":
      return (
        <AppRuntimeScreen
          AiEnginesStatus={AiEnginesStatus}
          LoadingFallback={LoadingFallback}
          MainTerminal={MainTerminal}
          T={T}
          aiStatuses={aiStatuses}
          auth={auth}
          currentTheme={currentTheme}
          handleLogout={handleLogout}
          handleThemeChange={handleThemeChange}
          isAudioMuted={isAudioMuted}
          profile={profile}
          saveAccount={saveAccount}
          saveFirmRules={saveFirmRules}
          saveJournal={saveJournal}
          setConsciousnessReturnScreen={setConsciousnessReturnScreen}
          setIsAudioMuted={setIsAudioMuted}
          setScreen={setScreen}
          showToast={showToast}
        />
      );

    default:
      return <SplashScreen />;
  }
}
