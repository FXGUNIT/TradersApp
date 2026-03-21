// RULE #244: Fraud Detection - Duplicate IP analysis
export function detectDuplicateIPs(users) {
  const ipMap = {};
  const duplicates = {};
  
  if (!users || typeof users !== 'object') return duplicates;
  
  Object.entries(users).forEach(([uid, user]) => {
    const ip = user?.forensic?.ip || user?.ip;
    if (ip && ip !== 'Unknown') {
      if (!ipMap[ip]) ipMap[ip] = [];
      ipMap[ip].push(uid);
    }
  });
  
  // Mark IPs with multiple users as duplicates
  Object.entries(ipMap).forEach(([ip, uids]) => {
    if (uids.length > 1) {
      duplicates[ip] = uids;
    }
  });
  
  return duplicates;
}
