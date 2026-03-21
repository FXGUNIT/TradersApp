import { signInWithPopup } from 'firebase/auth';
import { T } from '../../constants/theme.js';
import { authBtn } from '../../utils/styleUtils.js';

// ═══════════════════════════════════════════════════════════════════
// COMPONENT: Google Sign-In Button (RULE #23 - One-Tap Google Login)
// ═══════════════════════════════════════════════════════════════════
export function GoogleSignInButton({ onSuccess, onError, buttonText = 'Continue with Google', isLoading = false, firebaseAuth, googleProvider }) {
  const handleGoogleSignIn = async () => {
    try {
      const result = await signInWithPopup(firebaseAuth, googleProvider);
      const user = result.user;
      
      // RULE #23: Gmail-only enforcement
      if (!user.email || !user.email.toLowerCase().endsWith('@gmail.com')) {
        throw new Error('Only @gmail.com accounts are allowed');
      }
      
      onSuccess && onSuccess(user);
    } catch (error) {
      const errorMsg = error.message.includes('Only @gmail.com') 
        ? 'Only @gmail.com accounts are allowed'
        : error.message;
      onError && onError(errorMsg);
    }
  };

  return (
    <button
      onClick={handleGoogleSignIn}
      disabled={isLoading}
      style={{
        ...authBtn(T.blue, isLoading),
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        fontSize: 13,
        fontWeight: 600
      }}
      className="btn-glass"
    >
      {isLoading ? '\u231B CONNECTING...' : `\uD83D\uDD35 ${buttonText}`}
    </button>
  );
}
