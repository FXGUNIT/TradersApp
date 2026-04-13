/* eslint-disable */
/**
 * TradersRegimentInner — render helpers
 * Extracted from TradersRegimentInner.jsx to keep the JSX component ≤300 lines.
 */
import React from "react";

import CollectiveConsciousnessPage from "./pages/CollectiveConsciousness.jsx";
import MainTerminal from "./features/terminal/MainTerminal.jsx";
import CleanLoginScreen from "./features/auth/CleanLoginScreen.jsx";
import AdminUnlockModal from "./features/admin-security/AdminUnlockModal.jsx";
import AdminDashboardScreen from "./features/admin-security/AdminDashboardScreen.jsx";
import AdminInvitesView from "./features/admin-security/AdminInvitesView.jsx";
import DebugOverlay from "./features/admin-security/DebugOverlay.jsx";
import ErrorBoundaryAdmin from "./features/admin-security/ErrorBoundaryAdmin.jsx";
import SessionsManagementScreen from "./features/identity/SessionsManagementScreen.jsx";
import ForcePasswordResetScreen from "./features/identity/ForcePasswordResetScreen.jsx";
import WaitingRoomScreen from "./features/identity/WaitingRoomScreen.jsx";
import SupportChatModal from "./features/support/SupportChatModal.jsx";
import { UserListProvider } from "./features/admin-security/UserListContext.jsx";
import Toast from "./features/shell/Toast.jsx";
import FloatingChatWidget from "./components/FloatingChatWidget.jsx";
import AiEnginesStatus from "./components/AiEnginesStatus.jsx";
import FeatureGuard from "./components/FeatureGuard.jsx";
import EmptyStateCard from "./components/EmptyStateCard.jsx";
import SplashScreen from "./features/shell/SplashScreen.jsx";
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

export { CleanOnboarding, RegimentHub };

export function buildScreenContent({
  screen,
  currentTheme,
  theme,
  aiStatuses,
  consciousnessReturnScreen,
  isAdminAuthenticated,
  isAudioMuted,
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
  adminPassErr,
  adminPassInput,
  adminOtpErr,
  showAdminPrompt,
  showAdminPwd,
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
      showAdminPwd={showAdminPwd}
      adminMasterEmail={adminMasterEmail}
      adminMasterEmailVerified={adminMasterEmailVerified}
      adminOtpStep={adminOtpStep}
      adminOtps={adminOtps}
      adminOtpsVerified={adminOtpsVerified}
      adminPassErr={adminPassErr}
      adminPassInput={adminPassInput}
      adminOtpErr={adminOtpErr}
      showToast={showToast}
      handleLogin={handleLogin}
      handleStructuredGoogleAuth={handleStructuredGoogleAuth}
      handleLoginPasswordReset={handleLoginPasswordReset}
      resetAdminPromptState={resetAdminPromptState}
      setShowAdminPrompt={setShowAdminPrompt}
      setAdminMasterEmail={setAdminMasterEmail}
      setAdminPassInput={setAdminPassInput}
      setAdminOtps={setAdminOtps}
      setAdminOtpStep={setAdminOtpStep}
      handleAdminRequestNewCodes={handleAdminRequestNewCodes}
      sendAdminOTPs={sendAdminOTPs}
      setShowAdminPwd={setShowAdminPwd}
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
  auth,
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
  aiQuadCoreStatus,
  dailyQuote,
}) {
  return (
    <AppShellProvider value={{ screen, setScreen, navigateToScreen: setScreen, profile, theme, currentTheme, maintenanceMode: maintenanceModeActive }}>
      <section className={`app-container theme-${currentTheme}`}>
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
        <OfficersBriefingFooter dailyQuote={dailyQuote} theme={theme} quadCoreStatus={aiQuadCoreStatus} />
      </section>
    </AppShellProvider>
  );
}
