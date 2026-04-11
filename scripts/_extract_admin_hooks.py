#!/usr/bin/env python3
"""Extract hooks and computed values from AdminDashboardScreen.jsx into custom hooks."""
import os

BASE = 'e:/TradersApp/src/features/admin-security/'

# Read the current main file
with open(BASE + 'AdminDashboardScreen.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# ── Extract useAdminUserList (effect + data loading) ─────────────────────────
useAdminUserList_code = r"""/* eslint-disable */
/** Extracted from AdminDashboardScreen.jsx — user list data loading effect */
import { useEffect, useState } from "react";

export function useAdminUserList({ isAdminAuthenticated, auth, listAdminUsers }) {
  const { users, setUsers, loading, setLoading, dbError, setDbError } = (function() {
    const { useUserList } = require("./UserListContext.jsx");
    return useUserList();
  })();

  // Load users on mount and poll every 10s
  useEffect(() => {
    if (!isAdminAuthenticated && !auth?.token) return;
    let active = true;
    let intervalId = null;

    const applyUsersPayload = (payload) => {
      const usersData = Array.isArray(payload)
        ? payload.reduce((acc, user) => { if (user?.uid) acc[user.uid] = user; return acc; }, {})
        : payload && typeof payload === "object"
          ? payload.users && typeof payload.users === "object" ? payload.users : payload
          : {};
      if (!active) return;
      setUsers(usersData); setLoading(false); setDbError("");
    };

    const loadUsers = async ({ background = false } = {}) => {
      if (!background) setLoading(true);
      setDbError("");
      if (listAdminUsers) {
        try {
          const response = await listAdminUsers();
          if (!active) return;
          if (response?.success === false) throw new Error(response.error || "Failed to load admin users.");
          applyUsersPayload(response?.users || response?.data || response);
          return;
        } catch (error) {
          if (!active) return;
          console.warn("Admin client user load failed, falling back:", error);
        }
      }
      if (!active) return;
      if (!background) setUsers({});
      setLoading(false);
      setDbError("Admin user list unavailable.");
    };

    loadUsers();
    intervalId = window.setInterval(() => { loadUsers({ background: true }); }, 10000);
    return () => { active = false; if (intervalId) window.clearInterval(intervalId); };
  }, [isAdminAuthenticated, auth?.token, setUsers, setLoading, setDbError, listAdminUsers]);

  return { users, setUsers, loading, setLoading, dbError, setDbError };
}
"""
# That's getting complex. Let me instead write a simpler version.

# ── Simpler approach: extract ONLY computed values ──────────────────────────────
# The file has these large computed-value blocks in the hooks section that need to be extracted.

# Since we're at 667 lines, let's extract the table logic into a useAdminTableData hook
useAdminTableData_code = r"""/* eslint-disable */
/** Extracted from AdminDashboardScreen.jsx — computed table values */
import { useMemo } from "react";

export function useAdminTableData({ users, filterStatus, searchQuery, balanceFilter, showAdvancedFilter, groupByStatus, rowsPerPage, currentPage }) {
  const normalizeStatus = (status) => {
    if (!status) return "";
    return status.toLowerCase() === "pending" ? "PENDING"
      : status.toUpperCase() === "ACTIVE" ? "ACTIVE"
      : status.toUpperCase() === "BLOCKED" ? "BLOCKED"
      : status.toUpperCase();
  };

  const getUserSortTimestamp = (userData) => {
    const candidates = [userData?.updatedAt, userData?.submittedAt, userData?.createdAt,
      userData?.approvedAt, userData?.blockedAt, userData?.lastLoginAt, userData?.lastLoginAttempt];
    for (const c of candidates) { const t = Date.parse(c || ""); if (Number.isFinite(t)) return t; }
    return 0;
  };

  const sortedUserList = useMemo(() => {
    const userList = Object.entries(users || {});
    return [...userList].sort(([lu, luu], [ru, ruu]) => {
      const td = getUserSortTimestamp(ruu) - getUserSortTimestamp(luu);
      if (td !== 0) return td;
      return String(ru || "").localeCompare(String(lu || ""));
    });
  }, [users]);

  const filteredUsers = useMemo(() =>
    filterStatus === "ALL" ? sortedUserList
      : sortedUserList.filter(([, u]) => normalizeStatus(u.status) === filterStatus),
  [sortedUserList, filterStatus]);

  const searchFilteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return filteredUsers;
    const q = searchQuery.toLowerCase();
    return filteredUsers
      .map(([uid, u]) => {
        const ns = (u.fullName || "").toLowerCase().includes(q) ? 1 : 0;
        const es = (u.email || "").toLowerCase().includes(q) ? 1 : 0;
        const score = Math.max(ns, es);
        if (score === 0) return null;
        return [uid, u];
      })
      .filter(Boolean);
  }, [filteredUsers, searchQuery]);

  const advancedFilteredUsers = useMemo(() =>
    showAdvancedFilter
      ? searchFilteredUsers.filter(([, u]) => {
          const bal = parseFloat(u.accountBalance || 0);
          return bal >= (balanceFilter.min || 0) && bal <= (balanceFilter.max || Infinity);
        })
      : searchFilteredUsers,
  [searchFilteredUsers, showAdvancedFilter, balanceFilter]);

  const statusCounts = useMemo(() => ({
    ALL: sortedUserList.length,
    ACTIVE: sortedUserList.filter(([, u]) => normalizeStatus(u.status) === "ACTIVE").length,
    PENDING: sortedUserList.filter(([, u]) => normalizeStatus(u.status) === "PENDING").length,
    BLOCKED: sortedUserList.filter(([, u]) => normalizeStatus(u.status) === "BLOCKED").length,
  }), [sortedUserList]);

  let finalUsers = advancedFilteredUsers;
  if (groupByStatus) {
    finalUsers = [
      ...advancedFilteredUsers.filter(([, u]) => normalizeStatus(u.status) === "ACTIVE"),
      ...advancedFilteredUsers.filter(([, u]) => normalizeStatus(u.status) === "PENDING"),
      ...advancedFilteredUsers.filter(([, u]) => normalizeStatus(u.status) === "BLOCKED"),
    ];
  }

  const totalResults = finalUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalResults / rowsPerPage));
  const validPage = Math.min(currentPage, Math.max(1, totalPages));
  const startIdx = (validPage - 1) * rowsPerPage;
  const endIdx = startIdx + rowsPerPage;
  const paginatedUsers = finalUsers.slice(startIdx, endIdx);

  return {
    normalizeStatus, sortedUserList, filteredUsers,
    searchFilteredUsers, advancedFilteredUsers, statusCounts,
    finalUsers, totalResults, totalPages, validPage, startIdx, endIdx, paginatedUsers,
  };
}
"""

with open(BASE + 'useAdminTableData.js', 'w', encoding='utf-8') as f:
    f.write(useAdminTableData_code)
print(f"useAdminTableData.js: {len(useAdminTableData_code.splitlines())} lines")

# Now update the main AdminDashboardScreen to use this hook
# The new version should:
# 1. Import useAdminTableData
# 2. Replace the computed values section with useAdminTableData hook call
# 3. Keep all the original hooks/effects/actions

# Read current file
with open(BASE + 'AdminDashboardScreen.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find line numbers of computed values section
# Looking for: const normalizeStatus =, const getUserSortTimestamp =, const sortedUserList =, etc.
# These start after the effects and before the return.

# For now, let me check how many lines the main file currently has
print(f"Current main file: {len(lines)} lines")
