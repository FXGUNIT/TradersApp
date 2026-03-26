import {
  approveUser as approveAdminUser,
  blockUser as blockAdminUser,
  listUsers as listAdminUsers,
  lockUser as lockAdminUser,
} from "../adminService.js";

export async function approveUser(uid, adminUid) {
  return approveAdminUser(uid, adminUid);
}

export async function blockUser(uid, adminUid) {
  return blockAdminUser(uid, adminUid);
}

export async function lockUser(uid, adminUid) {
  return lockAdminUser(uid, adminUid);
}

export async function listUsers() {
  return listAdminUsers();
}

export default {
  approveUser,
  blockUser,
  lockUser,
  listUsers,
};
