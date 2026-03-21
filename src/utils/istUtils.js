// IST Clock & Market Hours Utility
export function getISTState() {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const ist = new Date(utcMs + 5.5 * 3600 * 1000);

  const h = ist.getHours();
  const m = ist.getMinutes();
  const s = ist.getSeconds();

  const tot = h * 60 + m;
  const OPEN = 10 * 60;
  const CLOSE = 17 * 60;

  const isOpen = tot >= OPEN && tot < CLOSE;
  let sec, lbl;

  if (tot < OPEN) {
    sec = (OPEN - tot) * 60 - s;
    lbl = 'OPENS IN';
  } else if (tot < CLOSE) {
    sec = (CLOSE - tot) * 60 - s;
    lbl = 'CLOSES IN';
  } else {
    sec = (24 * 60 - tot + OPEN) * 60 - s;
    lbl = 'OPENS IN';
  }

  const ch = String(Math.floor(sec / 3600)).padStart(2, '0');
  const cm = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
  const cs = String(sec % 60).padStart(2, '0');

  return {
    isOpen, h, m, s, lbl,
    countdown: `${ch}:${cm}:${cs}`,
    istStr: `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} IST`
  };
}

// RULE #150: Dynamic Greeting - Time-based greeting helper
export const getTimeBasedGreeting = (userName = '') => {
  const hour = new Date().getHours();
  const firstName = userName ? userName.split(' ')[0] : 'Trader';

  let greeting = '';
  let emoji = '';

  if (hour < 5) {
    greeting = 'Night Owl';
    emoji = '🌙';
  } else if (hour < 12) {
    greeting = 'Good Morning';
    emoji = '☀️';
  } else if (hour < 17) {
    greeting = 'Good Afternoon';
    emoji = '🌤️';
  } else if (hour < 21) {
    greeting = 'Good Evening';
    emoji = '🌅';
  } else {
    greeting = 'Night Trading';
    emoji = '🌙';
  }

  return { greeting, emoji, fullGreeting: `${emoji} ${greeting}, ${firstName}` };
};
