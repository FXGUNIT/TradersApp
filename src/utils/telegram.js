export async function notifyTelegram(event, payload) {
  // Allow overriding bridge base URL for testing (e.g., http://localhost:5001)
  const bridgeBase = import.meta.env.VITE_TELEGRAM_BRIDGE_BASE
  if (!bridgeBase) {
    return false
  }
  try {
    const target = bridgeBase.endsWith('/notify') ? bridgeBase : `${bridgeBase}/notify`
    const res = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, payload })
    })
    return res.ok
  } catch (e) {
    console.error('Telegram notify failed', e)
    return false
  }
}

export default { notifyTelegram }
