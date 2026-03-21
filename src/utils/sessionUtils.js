// Session utilities — generateSessionId, encryptSessionToken, getDeviceInfo, getSessionGeoData

// Generate a unique session ID
export const generateSessionId = () =>
  `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Simple base64 encoding for 30-day persistence token
// NOT production-grade — use TweetNaCl or libsodium in production
export const encryptSessionToken = (data) => {
  try {
    return btoa(JSON.stringify(data));
  } catch (e) {
    console.error('Encryption failed:', e);
    return null;
  }
};

// Detect device type from user agent
export const getDeviceInfo = () => {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS Device';
  if (/Android/.test(ua)) return 'Android Device';
  if (/Windows/.test(ua)) return 'Windows PC';
  if (/Macintosh/.test(ua)) return 'Mac';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Unknown Device';
};

// Fetch geo data for session (last active city)
export const getSessionGeoData = async () => {
  try {
    const geoRes = await fetch('https://ipapi.co/json/');
    const geoData = await geoRes.json();
    return {
      city: geoData.city || 'Unknown',
      country: geoData.country_name || 'Unknown',
    };
  } catch {
    return { city: 'Unknown', country: 'Unknown' };
  }
};
