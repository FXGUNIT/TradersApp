/**
 * Business Logic Utilities & Formatters
 * Handles data cleaning and consistent formatting across the app
 */

/**
 * Format phone number to consistent clean format
 * Removes +91 prefix, hyphens, spaces
 * Returns even-spaced format: XXXXXXXXXX (10 digits)
 * 
 * @param {string} phoneNumber - Raw phone number input
 * @returns {string} - Formatted phone number (10 digits, no prefix/hyphens)
 */
export const formatPhoneNumber = (phoneNumber) => {
  if (!phoneNumber) return '';
  
  // Convert to string and remove all non-digit characters
  let cleaned = phoneNumber.toString().replace(/\D/g, '');
  
  // Remove +91 or 91 prefix if present (keep only last 10 digits for Indian numbers)
  if (cleaned.length >= 12 && cleaned.startsWith('91')) {
    cleaned = cleaned.slice(2);
  } else if (cleaned.length > 10) {
    // If longer than 10 digits, take last 10
    cleaned = cleaned.slice(-10);
  }
  
  // Pad with zeros if less than 10 digits
  cleaned = cleaned.padStart(10, '0');
  
  // Return first 10 digits only
  return cleaned.substring(0, 10);
};

/**
 * Format phone number for display with even spacing
 * Format: 9876543210 (10 digits, clean, no separators)
 * 
 * @param {string} phoneNumber - Raw phone number
 * @returns {string} - Display-formatted phone number
 */
export const displayPhoneNumber = (phoneNumber) => {
  return formatPhoneNumber(phoneNumber);
};

/**
 * Validate if phone number is in correct format
 * 
 * @param {string} phoneNumber - Phone number to validate
 * @returns {boolean} - True if valid Indian phone number
 */
export const isValidPhoneNumber = (phoneNumber) => {
  const formatted = formatPhoneNumber(phoneNumber);
  // Must be exactly 10 digits and not all zeros
  return /^\d{10}$/.test(formatted) && formatted !== '0000000000';
};

/**
 * Clean and standardize phone numbers in user lists
 * 
 * @param {Object} users - Users object from database
 * @returns {Object} - Users with cleaned phone numbers
 */
export const cleanUserPhoneNumbers = (users) => {
  if (!users || typeof users !== 'object') return users;
  
  const cleaned = { ...users };
  Object.keys(cleaned).forEach(uid => {
    if (cleaned[uid]?.mobile) {
      cleaned[uid].mobile = formatPhoneNumber(cleaned[uid].mobile);
    }
  });
  
  return cleaned;
};

/**
 * Brand Watermark Component
 * Displays "Traders Regiment" branding
 * 
 * @returns {React.ReactElement}
 */
export const TradersRegimentWatermark = () => {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontSize: '13px',
      color: 'var(--subtext)',
      fontWeight: '600',
      letterSpacing: '1px',
      borderTop: 'none',
      transition: 'all 0.3s ease',
      userSelect: 'none',
      textAlign: 'center',
      fontFamily: "var(--font-ui)",
      fontWeight: 800,
      letterSpacing: 2,
    }}>
      <span style={{ marginRight: '4px' }}>�</span>
      <span style={{ fontFamily: "var(--font-ui)" }}>TRADERS REGIMENT</span>
      <span style={{ marginLeft: '4px', fontSize: '10px', opacity: 0.6 }}>™</span>
    </div>
  );
};

/**
 * Exchange Facility Badge Component
 * High-contrast modern badge for user profile view
 * 
 * @returns {React.ReactElement}
 */
export const ExchangeFacilityBadge = () => {
  return (
    <div style={{
      background: 'linear-gradient(135deg, var(--accent) 0%, rgba(56, 189, 248, 0.8) 100%)',
      border: '1px solid var(--accent)',
      borderRadius: '12px',
      padding: '16px 20px',
      marginBottom: '16px',
      boxShadow: '0 4px 16px rgba(56, 189, 248, 0.2)',
      transition: 'all 0.3s ease',
      cursor: 'pointer'
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.boxShadow = '0 8px 24px rgba(56, 189, 248, 0.35)';
      e.currentTarget.style.transform = 'translateY(-2px)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.boxShadow = '0 4px 16px rgba(56, 189, 248, 0.2)';
      e.currentTarget.style.transform = 'translateY(0)';
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px'
      }}>
        <div style={{
          fontSize: '24px',
          lineHeight: '1',
          marginTop: '2px'
        }}>
          ♻️
        </div>
        
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: '16px',
            fontWeight: '700',
            color: '#FFFFFF',
            marginBottom: '6px',
            letterSpacing: '-0.5px'
          }}>
            Exchange Facility Available
          </div>
          
          <div style={{
            fontSize: '13px',
            color: 'rgba(255, 255, 255, 0.95)',
            fontWeight: '500',
            lineHeight: '1.5',
            letterSpacing: '-0.01em'
          }}>
            We offer the <strong>best prices</strong> for older devices, fully documented and safe.
          </div>
          
          <div style={{
            fontSize: '11px',
            color: 'rgba(255, 255, 255, 0.7)',
            marginTop: '8px',
            fontWeight: '500',
            letterSpacing: '0.5px'
          }}>
            ✓ Instant quotes • ✓ Safe handling • ✓ Transparent pricing
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Extract and format phone numbers from user data
 * Useful for bulk cleaning operations
 * 
 * @param {string} phoneNumber - Phone number from input
 * @returns {Object} - Object with formatted and display versions
 */
export const getPhoneNumberInfo = (phoneNumber) => {
  return {
    raw: phoneNumber,
    formatted: formatPhoneNumber(phoneNumber),
    valid: isValidPhoneNumber(phoneNumber),
    display: displayPhoneNumber(phoneNumber)
  };
};

export default {
  formatPhoneNumber,
  displayPhoneNumber,
  isValidPhoneNumber,
  cleanUserPhoneNumbers,
  getPhoneNumberInfo,
  TradersRegimentWatermark,
  ExchangeFacilityBadge
};
