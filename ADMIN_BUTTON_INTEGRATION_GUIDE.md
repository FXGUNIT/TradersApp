# Admin Button Integration Examples

## Quick Reference - Add Click Tracking to Admin Buttons

### Pattern 1: Basic Admin Button with Activity Tracking

**Before** (Current code):
```javascript
const handleApproveClick = async (uid) => {
  try {
    await dbM(`users/${uid}`, { status: 'ACTIVE' }, auth?.token);
    showToast('User approved', 'success');
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
};

// In JSX:
<button onClick={() => handleApproveClick(user.uid)}>
  ✓ Approve
</button>
```

**After** (With Security Sentinel):
```javascript
const handleApproveClick = async (uid) => {
  // Already integrated - recordAdminActivity is called inside approve()
  // The approve() function now has this at the start:
  // if (!recordAdminActivity('APPROVE_USER', uid)) return;
  
  try {
    await approve(uid); // This now calls recordAdminActivity internally
  } catch (error) {
    showToast('Error: ' + error.message, 'error');
  }
};

// In JSX - No changes needed, already tracking!
<button onClick={() => handleApproveClick(user.uid)}>
  ✓ Approve
</button>
```

---

### Pattern 2: Rapid-Fire Admin Operations

**Usage**: When admin needs to do multiple actions quickly

```javascript
/**
 * Bulk approve users - Activity tracking happens per action
 */
const handleBulkApprove = async (userIds) => {
  for (const uid of userIds) {
    const canProceed = recordAdminActivity('BULK_APPROVE', uid);
    
    if (!canProceed) {
      showToast('⚠️ Admin panel locked due to extreme activity', 'error');
      break; // Stop processing
    }
    
    try {
      await dbM(`users/${uid}`, { status: 'ACTIVE' }, auth?.token);
    } catch (error) {
      console.error('Bulk approve error:', error);
    }
  }
  
  showToast(`✓ Processed ${userIds.length} approvals`, 'success');
};
```

**Expected Behavior**:
- ✅ If user clicking at human speed (1-2 clicks/sec): All actions succeed
- ⚠️ If clicks exceed 2.5/sec: Toast warning appears
- 🔒 If clicks exceed 5/sec: Admin panel locked, toast error, all pending actions blocked
- 📊 If locked, requires OTP from Telegram to unlock

---

### Pattern 3: Manual Activity Logging

**For custom admin actions**:

```javascript
const handleCustomAdminAction = async (actionName, targetData) => {
  // Manually log before action
  const activityCheck = recordAdminActivity(
    actionName,      // e.g., 'DELETE_USER', 'RESET_PASSWORD', 'EDIT_CONFIG'
    targetData       // e.g., user ID, feature name, etc
  );
  
  if (!activityCheck) {
    console.warn('Admin panel locked - cannot proceed');
    return false;
  }
  
  // Proceed with action
  try {
    // Your business logic here
    console.log(`Performing: ${actionName} on ${targetData}`);
    return true;
  } catch (error) {
    console.error('Action failed:', error);
    return false;
  }
};

// Usage in buttons:
<button onClick={() => handleCustomAdminAction('DELETE_USER', user.uid)}>
  🗑️ Delete
</button>

<button onClick={() => handleCustomAdminAction('RESET_PASSWORD', user.email)}>
  🔑 Reset Password
</button>

<button onClick={() => handleCustomAdminAction('LOCK_ACCOUNT', user.uid)}>
  🔒 Lock
</button>
```

---

### Pattern 4: Monitoring Activity in Real-time

**For admin dashboard**:

```javascript
const AdminActivityMonitor = () => {
  useEffect(() => {
    if (isAdminAuthenticated && window.securitySentinel) {
      // Get current activity stats
      const history = window.securitySentinel.antiHacker.getActivityHistory();
      
      console.log('Current Click History:', history);
      // Output:
      // {
      //   totalClicks: 12,
      //   recentClicks: [...last 10 clicks],
      //   isLocked: false,
      //   clicksInLastSecond: 2
      // }
    }
  }, [isAdminAuthenticated]);
  
  return (
    <div style={{ padding: 16, background: '#f0f0f0', borderRadius: 8 }}>
      <h3>🛡️ Admin Activity Monitor</h3>
      
      {isAdminAuthenticated && window.securitySentinel?.antiHacker.isAdminLocked ? (
        <div style={{ color: 'red', fontWeight: 'bold' }}>
          🔒 ADMIN PANEL LOCKED
          <br/>
          OTP Required to Unlock
        </div>
      ) : (
        <div style={{ color: 'green' }}>
          ✅ Admin Panel Active
        </div>
      )}
      
      <hr/>
      
      <button 
        onClick={() => {
          const history = window.securitySentinel.antiHacker.getActivityHistory();
          console.table(history.recentClicks);
        }}
      >
        View Recent Activity
      </button>
      
      <button
        onClick={() => {
          const status = window.securitySentinel.getStatus();
          console.log('Security Status:', status);
        }}
      >
        Check All Systems
      </button>
    </div>
  );
};
```

---

### Pattern 5: Testing Click Speed Detection

**For development/testing**:

```javascript
/**
 * Simulate rapid clicks to test security sentinel
 * DO NOT USE IN PRODUCTION
 */
const testClickSpeedDetection = async () => {
  if (!window.securitySentinel) {
    console.error('Security Sentinel not initialized');
    return;
  }
  
  console.log('Starting click speed test...');
  
  // Simulate 10 rapid clicks (should trigger bot detection)
  for (let i = 0; i < 10; i++) {
    const result = recordAdminActivity(
      'TEST_RAPID_CLICK_' + i,
      'test_target'
    );
    
    if (!result) {
      console.warn('⚠️ Admin panel locked after', i, 'clicks');
      break;
    }
  }
  
  const history = window.securitySentinel.antiHacker.getActivityHistory();
  console.log('Final activity history:', history);
};

// In console to test:
// testClickSpeedDetection()
```

**Expected output**:
```
Starting click speed test...
⚠️ Admin panel locked after 8 clicks
Final activity history: {
  totalClicks: 8,
  clicksInLastSecond: 8,
  isLocked: true
}
```

---

### Pattern 6: Unlock Admin Panel via OTP

**When admin panel is locked**:

```javascript
const UnlockAdminPanel = () => {
  const [otp, setOtp] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  
  const handleOTPSubmit = async () => {
    setUnlocking(true);
    
    try {
      // Call Cloud Function to verify OTP
      const verifyOTP = firebase.functions().httpsCallable('verifyAdminOTPUnlock');
      
      const result = await verifyOTP({
        adminUID: auth.uid,
        otp: otp
      });
      
      if (result.data.success) {
        showToast('🔓 Admin panel unlocked', 'success');
        setOtp('');
        // Refresh admin panel UI
        window.location.reload();
      } else {
        showToast('❌ Invalid OTP', 'error');
      }
    } catch (error) {
      showToast('Error: ' + error.message, 'error');
    }
    
    setUnlocking(false);
  };
  
  return (
    <div style={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      background: '#fff',
      padding: 32,
      borderRadius: 12,
      boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
      zIndex: 9999
    }}>
      <h2>🔒 Admin Panel Locked</h2>
      <p>Bot activity detected. Enter OTP from Telegram to unlock.</p>
      
      <input
        type="text"
        value={otp}
        onChange={e => setOtp(e.target.value.slice(0, 6))}
        placeholder="000000"
        maxLength="6"
        style={{
          fontSize: 28,
          textAlign: 'center',
          letterSpacing: 8,
          padding: 12,
          border: '2px solid #ccc',
          borderRadius: 8,
          marginBottom: 16,
          width: '100%'
        }}
      />
      
      <button
        onClick={handleOTPSubmit}
        disabled={unlocking || otp.length !== 6}
        style={{
          width: '100%',
          padding: 12,
          background: '#007AFF',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          fontSize: 16,
          fontWeight: 'bold',
          cursor: 'pointer'
        }}
      >
        {unlocking ? '⏳ Verifying...' : '✓ Unlock'} 
      </button>
    </div>
  );
};
```

---

## Real-World Usage Examples

### Example 1: Approval List with Activity Tracking

```javascript
const ApprovalList = ({ users }) => {
  return (
    <div>
      {users?.map(user => (
        <div key={user.uid} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <span>{user.email}</span>
          
          {/* Button already has activity tracking via recordAdminActivity */}
          <button 
            onClick={() => approve(user.uid)}
            style={{ background: '#34C759', color: '#fff', padding: '8px 16px', borderRadius: 4 }}
          >
            ✓ Approve
          </button>
          
          <button 
            onClick={() => handleRejectUser(user.uid)}
            style={{ background: '#FF3B30', color: '#fff', padding: '8px 16px', borderRadius: 4 }}
          >
            ✕ Reject
          </button>
        </div>
      ))}
    </div>
  );
};

// Both buttons now automatically track admin activity
// If clicks exceed threshold, panel locks
```

### Example 2: Batch Operations with Progress

```javascript
const BatchOperationPanel = () => {
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const handleBatchApprove = async () => {
    setIsProcessing(true);
    let approved = 0;
    let failed = 0;
    
    for (const uid of selectedUsers) {
      // Activity is tracked per action
      const canProceed = recordAdminActivity('BATCH_APPROVE', uid);
      
      if (!canProceed) {
        showToast('⚠️ Panel locked - batch operation stopped', 'error');
        break;
      }
      
      try {
        await approve(uid);
        approved++;
      } catch (error) {
        failed++;
      }
    }
    
    showToast(
      `Batch complete: ${approved} approved, ${failed} failed`,
      failed === 0 ? 'success' : 'warning'
    );
    
    setIsProcessing(false);
  };
  
  return (
    <div>
      <h3>Batch Approve</h3>
      <p>Selected: {selectedUsers.length} users</p>
      
      <button
        onClick={handleBatchApprove}
        disabled={isProcessing || selectedUsers.length === 0}
      >
        {isProcessing ? '⏳ Processing...' : '✓ Approve All'}
      </button>
      
      {/* Activity tracking prevents accidental double-clicks and bot automation */}
    </div>
  );
};
```

---

## Debugging Commands

Run these in browser console to debug:

```javascript
// Check sentinel status
console.log(window.securitySentinel?.getStatus());

// View current activity history
console.log(window.securitySentinel?.antiHacker.getActivityHistory());

// Manually test click detection
window.securitySentinel?.antiHacker.recordAdminActivity('TEST', 'target');

// Check if admin panel is locked
console.log('Is locked?', window.securitySentinel?.antiHacker.isAdminLocked);

// View all security incidents
firebase.firestore().collection('securityIncidents').get().then(snap => {
  snap.docs.forEach(doc => console.log(doc.data()));
});
```

---

## Summary

✅ **Your Admin Panel Now Has**:
- Automatic click speed detection
- Bot activity prevention
- Admin panel auto-lock on suspicious behavior
- OTP unlock requirement
- Real-time activity logging
- Telegram alerts on detected threats

🛡️ **Security Improvements**:
- Prevents automated admin takeover
- Detects superhuman click speeds
- Logs all admin actions for audit trail
- Automatic response to threats (panel lock)

🚀 **Next Steps**:
1. Test clicking rapidly in admin panel (should lock after 5+ clicks/sec)
2. Check Cloud Function logs for activity logging
3. Verify Telegram alerts appear
4. Deploy OTP unlock flow

---

**Status**: ✅ **READY FOR INTEGRATION**
