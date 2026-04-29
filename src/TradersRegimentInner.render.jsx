/* eslint-disable */
/**
 * TradersRegimentInner — render helpers
 * Extracted from TradersRegimentInner.jsx to keep the JSX component ≤300 lines.
 */
import React from "react";

import CleanLoginScreen from "./features/auth/CleanLoginScreen.jsx";
import AdminUnlockModal from "./features/admin-security/AdminUnlockModal.jsx";
import DebugOverlay from "./features/admin-security/DebugOverlay.jsx";
import ErrorBoundaryAdmin from "./features/admin-security/ErrorBoundaryAdmin.jsx";
import { UserListProvider } from "./features/admin-security/UserListContext.jsx";
import Toast from "./features/shell/Toast.jsx";
import FloatingChatWidget from "./components/FloatingChatWidget.jsx";
import AiEnginesStatus from "./components/AiEnginesStatus.jsx";
import FeatureGuard from "./components/FeatureGuard.jsx";
import EmptyStateCard from "./components/EmptyStateCard.jsx";
import LoadingFallback from "./features/shell/LoadingFallback.jsx";
import SplashScreen from "./features/shell/SplashScreen.jsx";
import AppScreenRegistry from "./features/shell/AppScreenRegistry.jsx";
import ShellThemeOverlay from "./features/shell/ShellThemeOverlay.jsx";
import OfficersBriefingFooter from "./features/shell/OfficersBriefingFooter.jsx";
import MaintenanceScreen from "./features/shell/MaintenanceScreen.jsx";
import DiamondNavigationLattice from "./features/shell/navigation-lattice/DiamondNavigationLattice.jsx";
import { AppShellProvider } from "./features/shell/AppShellContext.jsx";

const CleanOnboarding = React.lazy(
  () => import("./features/onboarding/CleanOnboardingScreen.jsx"),
);
const RegimentHub = React.lazy(
  () => import("./features/hub-content/RegimentHubScreen.jsx"),
);
const WaitingRoomScreen = React.lazy(
  () => import("./features/identity/WaitingRoomScreen.jsx"),
);
const ForcePasswordResetScreen = React.lazy(
  () => import("./features/identity/ForcePasswordResetScreen.jsx"),
);
const SessionsManagementScreen = React.lazy(
  () => import("./features/identity/SessionsManagementScreen.jsx"),
);
const CollectiveConsciousnessPage = React.lazy(
  () => import("./pages/CollectiveConsciousness.jsx"),
);
const MainTerminal = React.lazy(
  () => import("./features/terminal/MainTerminal.jsx"),
);
const AdminDashboardScreen = React.lazy(
  () => import("./features/admin-security/AdminDashboardScreen.jsx"),
);
const AdminInvitesView = React.lazy(
  () => import("./features/admin-security/AdminInvitesView.jsx"),
);
const SupportChatModal = React.lazy(
  () => import("./features/support/SupportChatModal.jsx"),
);

export { CleanOnboarding, RegimentHub };

export function buildScreenContent({
  screen,
  currentTheme,
  theme,
  aiStatuses,
  watchtowerStatus,
  consciousnessReturnScreen,
  isAdminAuthenticated,
  isAudioMuted,
  setIsAudioMuted,
  maintenanceModeActive,
  auth,
  profile,
  googleUser,
  currentSessionId,
  adminMasterEmail,
  adminMasterEmailVerified,
  adminOtpStep,
  adminOtps,
  adminOtpsVerified,
  adminMfaChallengeId,
  adminOtpChallengeId,
  adminOtpRecipients,
  totpCode,
  totpErr,
  adminOtpErr,
  showAdminPrompt,
  _SCREEN_IDS,
  ADMIN_UID,
  ADMIN_EMAIL,
  listAdminUsers,
  approveAdminUser,
  blockAdminUser,
  handleLogin,
  handleStructuredGoogleAuth,
  handleLoginPasswordReset,
  resetAdminPromptState,
  setShowAdminPrompt,
  setAdminMasterEmail,
  setTotpCode,
  setAdminOtps,
  setAdminOtpStep,
  handleAdminRequestNewCodes,
  sendAdminOTPs,
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
  showToast,
}) {
  return (
    <AppScreenRegistry
      screen={screen}
      CleanLoginScreen={CleanLoginScreen}
      AdminUnlockModal={AdminUnlockModal}
      CleanOnboarding={CleanOnboarding}
      WaitingRoomScreen={WaitingRoomScreen}
      ForcePasswordResetScreen={ForcePasswordResetScreen}
      SessionsManagementScreen={SessionsManagementScreen}
      RegimentHub={RegimentHub}
      CollectiveConsciousnessPage={CollectiveConsciousnessPage}
      ErrorBoundaryAdmin={ErrorBoundaryAdmin}
      LoadingFallback={LoadingFallback}
      UserListProvider={UserListProvider}
      AiEnginesStatus={AiEnginesStatus}
      AdminDashboardScreen={AdminDashboardScreen}
      AdminInvitesView={AdminInvitesView}
      SplashScreen={SplashScreen}
      MainTerminal={MainTerminal}
      auth={auth}
      profile={profile}
      googleUser={googleUser}
      currentSessionId={currentSessionId}
      currentTheme={currentTheme}
      theme={theme}
      aiStatuses={aiStatuses}
      watchtowerStatus={watchtowerStatus}
      consciousnessReturnScreen={consciousnessReturnScreen}
      isAdminAuthenticated={isAdminAuthenticated}
      isAudioMuted={isAudioMuted}
      setIsAudioMuted={setIsAudioMuted}
      maintenanceModeActive={maintenanceModeActive}
      ADMIN_UID={ADMIN_UID}
      ADMIN_EMAIL={ADMIN_EMAIL}
      listAdminUsers={listAdminUsers}
      approveAdminUser={approveAdminUser}
      blockAdminUser={blockAdminUser}
      EmptyStateCard={EmptyStateCard}
      SupportChatModal={SupportChatModal}
      showAdminPrompt={showAdminPrompt}
      totpCode={totpCode}
      totpErr={totpErr}
      adminMasterEmail={adminMasterEmail}
      adminMasterEmailVerified={adminMasterEmailVerified}
      adminOtpStep={adminOtpStep}
      adminOtps={adminOtps}
      adminOtpsVerified={adminOtpsVerified}
      adminMfaChallengeId={adminMfaChallengeId}
      adminOtpChallengeId={adminOtpChallengeId}
      adminOtpRecipients={adminOtpRecipients}
      adminOtpErr={adminOtpErr}
      showToast={showToast}
      handleLogin={handleLogin}
      handleStructuredGoogleAuth={handleStructuredGoogleAuth}
      handleLoginPasswordReset={handleLoginPasswordReset}
      resetAdminPromptState={resetAdminPromptState}
      setShowAdminPrompt={setShowAdminPrompt}
      setAdminMasterEmail={setAdminMasterEmail}
      setTotpCode={setTotpCode}
      setAdminOtps={setAdminOtps}
      setAdminOtpStep={setAdminOtpStep}
      handleAdminRequestNewCodes={handleAdminRequestNewCodes}
      sendAdminOTPs={sendAdminOTPs}
      handleAdminAccess={handleAdminAccess}
      handleAdminVerifyCodes={handleAdminVerifyCodes}
      handleStructuredSignup={handleStructuredSignup}
      handleBackToLoginFromSignup={handleBackToLoginFromSignup}
      checkApprovalStatus={checkApprovalStatus}
      handleResendVerificationEmail={handleResendVerificationEmail}
      handleLogout={handleLogout}
      handlePasswordReset={handlePasswordReset}
      setScreen={setScreen}
      setConsciousnessReturnScreen={setConsciousnessReturnScreen}
      handleThemeChange={handleThemeChange}
      handleToggleMaintenanceMode={handleToggleMaintenanceMode}
      saveJournal={saveJournal}
      saveAccount={saveAccount}
      saveFirmRules={saveFirmRules}
    />
  );
}

export function buildAppShell({
  currentTheme,
  screen,
  setScreen,
  auth,
  profile,
  maintenanceModeActive,
  _SCREEN_IDS,
  ADMIN_UID,
  screenContent,
  toasts,
  dismissToast,
  theme,
  handleThemeChange,
  debugLogs,
  debugLatencies,
  debugTTI,
  debugComponentStatus,
  debugOverlayOpen,
  setDebugOverlayOpen,
  aiQuadCoreStatus,
  watchtowerStatus,
  dailyQuote,
  showToast,
}) {
  return (
    <AppShellProvider value={{ screen, setScreen, navigateToScreen: setScreen, profile, theme, currentTheme, maintenanceMode: maintenanceModeActive }}>
      <section id="main-content" className={`app-container theme-${currentTheme}`}>
        <ShellThemeOverlay screen={screen} currentTheme={currentTheme} onThemeChange={handleThemeChange} />
        {maintenanceModeActive && auth?.uid !== ADMIN_UID && screen !== "admin" ? (
          <MaintenanceScreen />
        ) : (
          screenContent
        )}
        <DiamondNavigationLattice
          screen={screen}
          setScreen={setScreen}
          auth={auth}
          disabled={maintenanceModeActive && auth?.uid !== ADMIN_UID && screen !== _SCREEN_IDS?.ADMIN}
          onRestrictedBack={() => showToast("Back navigation is restricted after logout. Sign in again to continue.", "error")}
        />
        <DebugOverlay
          logs={debugLogs}
          latencies={debugLatencies}
          tti={debugTTI}
          componentStatus={debugComponentStatus}
          isOpen={debugOverlayOpen}
          onToggle={() => setDebugOverlayOpen(!debugOverlayOpen)}
          auth={auth}
        />
        <Toast toasts={toasts} onDismiss={dismissToast} fontFamily={theme?.font} />
        <FeatureGuard feature="floatingSupportChat">
          <FloatingChatWidget auth={auth} profile={profile} />
        </FeatureGuard>
        <OfficersBriefingFooter dailyQuote={dailyQuote} theme={theme} quadCoreStatus={aiQuadCoreStatus} watchtowerStatus={watchtowerStatus} />
      </section>
    </AppShellProvider>
  );
}
