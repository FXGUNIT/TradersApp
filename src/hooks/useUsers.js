import { useState, useEffect, useCallback } from 'react';
import { onValue, ref } from 'firebase/database';
import { db } from '../services/firebase';
import { cacheUserList, getCachedUserList, clearUserListCache } from '../utils/uiUtils';

export const useUsers = (userId = null) => {
  const [users, setUsers] = useState({});
  const [loading, setLoading] = useState(() => !!db);
  const [error, setError] = useState(null);

  useEffect(() => {
    const cachedUsers = getCachedUserList();
    if (cachedUsers) {
      setTimeout(() => {
        setUsers(cachedUsers);
        setLoading(false);
      }, 0);
    }
  }, []);

  useEffect(() => {
    if (!db) {
      return;
    }

    const usersRef = ref(db, 'users');
    
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const data = snapshot.val() || {};
      setUsers(data);
      cacheUserList(data);
      setLoading(false);
    }, (err) => {
      setError(err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const refreshUsers = useCallback(() => {
    clearUserListCache();
    setLoading(true);
  }, []);

  const getUserById = useCallback((uid) => {
    return users[uid] || null;
  }, [users]);

  const getUsersByStatus = useCallback((status) => {
    return Object.entries(users)
      .filter(([_, user]) => user.status === status)
      .reduce((acc, [uid, user]) => ({ ...acc, [uid]: user }), {});
  }, [users]);

  const currentUser = userId ? users[userId] : null;

  return {
    users,
    loading,
    error,
    refreshUsers,
    getUserById,
    getUsersByStatus,
    currentUser,
    userCount: Object.keys(users).length
  };
};

export default useUsers;
