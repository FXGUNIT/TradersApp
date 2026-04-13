import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import {
  cacheUserList,
  getCachedUserList,
} from "../../utils/userUtils.js";

const UserListContext = createContext();

export function UserListProvider({ children }) {
  const [users, setUsersState] = useState(() => {
    const cached = getCachedUserList();
    return cached || {};
  });
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const setUsers = useCallback((nextUsers) => {
    setUsersState((currentUsers) => {
      const resolvedUsers =
        typeof nextUsers === "function" ? nextUsers(currentUsers) : nextUsers;
      cacheUserList(resolvedUsers);
      setLastUpdated(Date.now());
      return resolvedUsers;
    });
  }, []);

  const updateUsers = useCallback(
    (newUsers) => {
      setUsers(newUsers);
    },
    [setUsers],
  );

  const value = useMemo(
    () => ({
      users,
      setUsers: updateUsers,
      loading,
      setLoading,
      dbError,
      setDbError,
      lastUpdated,
    }),
    [users, updateUsers, loading, dbError, lastUpdated],
  );

  return (
    <UserListContext.Provider value={value}>
      {children}
    </UserListContext.Provider>
  );
}

export function useUserList() {
  const context = useContext(UserListContext);
  if (!context) {
    throw new Error("useUserList must be used within UserListProvider");
  }
  return context;
}
