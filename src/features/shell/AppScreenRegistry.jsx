/* eslint-disable no-unused-vars */
import { Suspense } from "react";
import ThemeSwitcher from "../../components/ThemeSwitcher.jsx";
import { createShellChrome } from "./appShellChrome.jsx";

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
  const { authBtn, authCard, lbl, AMD_PHASES, LED, SHead, TableSkeletonLoader } =
    createShellChrome(T);

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
        <WaitingRoomScreen
          profile={profile}
          auth={auth}
          onRefresh={checkApprovalStatus}
          onResendVerification={handleResendVerificationEmail}
          onLogout={handleLogout}
        />
      );

    case "forcePasswordReset":
      return (
        <ForcePasswordResetScreen
          profile={profile}
          onReset={handlePasswordReset}
          onLogout={handleLogout}
          theme={T}
        />
      );

    case "sessions":
      return (
        <SessionsManagementScreen
          profile={profile}
          auth={auth}
          currentSessionId={currentSessionId}
          onBack={() => setScreen("hub")}
          showToast={showToast}
        />
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
            theme={theme}
            currentTheme={currentTheme}
            onThemeChange={handleThemeChange}
            aiStatuses={aiStatuses}
          />
        </Suspense>
      );

    case "consciousness":
      return (
        <CollectiveConsciousnessPage
          onBack={() => setScreen(consciousnessReturnScreen || "hub")}
          theme={theme}
          currentTheme={currentTheme}
          onThemeChange={handleThemeChange}
          auth={auth}
          aiStatuses={aiStatuses}
        />
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
        <div style={{ position: "relative" }}>
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
                ? "â˜€ï¸ LUMIERE"
                : currentTheme === "amber"
                  ? "ðŸŸ  AMBER"
                  : "ðŸŒ™ MIDNIGHT"}
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
              ðŸ“± SESSIONS
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
        </div>
      );

    default:
      return <SplashScreen />;
  }
}
