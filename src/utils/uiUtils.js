// RULE #123: Confetti Success Animation - Trigger celebration bursts
export const triggerConfetti = (count = 30, duration = 2.5) => {
  const colors = ['#30D158', '#FFD60A', '#0A84FF', '#BF5AF2', '#64D2FF', '#FF375F'];

  for (let i = 0; i < count; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti-piece';

    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = Math.random() * 8 + 4;
    const duration_ms = duration * 1000;
    const delay = Math.random() * 100;

    confetti.style.cssText = `
      left: ${Math.random() * 100}%;
      top: 0;
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
      animation: confetti-fall ${duration}s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${delay}ms forwards;
      opacity: ${Math.random() * 0.5 + 0.5};
    `;

    document.body.appendChild(confetti);

    setTimeout(() => confetti.remove(), duration_ms + delay);
  }
};

// RULE #52: Copy-on-Click - Copy email/UID to clipboard with toast feedback
export const copyToClipboard = async (text, label, showToast) => {
  try {
    await navigator.clipboard.writeText(text);
    showToast(`${label} transmitted to system memory. Standing by.`, 'success');
  } catch (error) {
    console.error('Failed to copy:', error);
    showToast('Clipboard connection unstable. Retrying..', 'error');
  }
};

// Secure clipboard: copy to clipboard and auto-clear after 60 seconds
export const copyToClipboardSecure = async (text, showToast) => {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Data packet delivered. Clipboard stands ready.', 'success');

    setTimeout(async () => {
      try {
        await navigator.clipboard.writeText('');
      } catch (e) {
        console.warn('Could not clear clipboard:', e);
      }
    }, 60000);
  } catch (error) {
    console.error('Failed to copy:', error);
    showToast('Copy buffer full. Try again soon.', 'error');
  }
};

// RULE #125: Card Tilt Handler - 3D perspective tilt effect on hover
export const createCardTiltHandler = (element) => {
  if (!element) return;

  element.addEventListener('mousemove', (e) => {
    const rect = element.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateY = (x - centerX) * 0.02;
    const rotateX = (centerY - y) * 0.02;

    element.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
  });

  element.addEventListener('mouseleave', () => {
    element.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)';
  });

  element.style.transition = 'transform 0.1s ease-out';
};
