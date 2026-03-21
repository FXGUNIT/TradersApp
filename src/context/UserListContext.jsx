import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { getCachedUserList, cacheUserList } from '../utils/cacheUtils.js';

// RULE #172: Global Context for User List - Instant data flow to all components
// RULE #165: Cache Persistence - Initialize from localStorage cache
const UserListContext = createContext();

export function UserListProvider({ children }) {
  // RULE #165: Load from localStorage cache on initialization
  const [users, setUsersState] = useState(() => {
    const cached = getCachedUserList();
    return cached || {};
  });
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  // RULE #165: Wrap setUsers to also cache the data
  const setUsers = useCallback((newUsers) => {
    setUsersState(newUsers);
    // Save to cache for offline access and faster loading
    cacheUserList(newUsers);
    setLastUpdated(Date.now());
  }, []);

  const updateUsers = useCallback((newUsers) => {
    setUsers(newUsers);
  }, [setUsers]);

  const value = useMemo(() => ({
    users,
    setUsers: updateUsers,
    loading,
    setLoading,
    dbError,
    setDbError,
    lastUpdated
  }), [users, updateUsers, loading, dbError, lastUpdated]);

  return (
    <UserListContext.Provider value={value}>
      {children}
    </UserListContext.Provider>
  );
}

export function useUserList() {
  const context = useContext(UserListContext);
  if (!context) {
    throw new Error('useUserList must be used within UserListProvider');
  }
  return context;
}
