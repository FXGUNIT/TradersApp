export function assembleLegacyProfile(userData = {}, authData = {}, fullData = {}) {
  const merged = {
    ...userData,
    ...(fullData?.profile || {}),
  };

  return {
    ...merged,
    uid: authData.uid ?? merged.uid ?? null,
    token: authData.token ?? merged.token ?? null,
    email: authData.email ?? merged.email ?? null,
    mobile: fullData?.mobile ?? merged.mobile ?? null,
    journal: fullData?.journal ?? merged.journal,
    firmRules: fullData?.firmRules ?? merged.firmRules,
    accountState: fullData?.accountState ?? merged.accountState,
    sessions: fullData?.sessions ?? merged.sessions,
  };
}
