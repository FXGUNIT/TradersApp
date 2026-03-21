// App-wide static constants

// Time options for IST timezone (10:00 AM – 5:00 PM, 5-minute intervals)
export const TIME_OPTIONS = (() => {
  const opts = [{ v: '', l: '— time IST —' }];
  for (let h = 10; h <= 17; h++) {
    for (let m = 0; m < 60; m += 5) {
      if (h === 17 && m > 0) continue;
      const hh = h > 12 ? h - 12 : (h === 0 ? 12 : h);
      const ampm = h >= 12 ? 'PM' : 'AM';
      opts.push({ v: `${hh}:${String(m).padStart(2, '0')} ${ampm}`, l: `${hh}:${String(m).padStart(2, '0')} ${ampm} IST` });
    }
  }
  return opts;
})();

// Officer's Briefing - Rotating motivational quotes
export const OFFICERS_BRIEFING = [
  "Make your role so worthy in life that people applaud you even after the curtain falls.",
  "May the god show mercy on our enemies because we won't.",
  "An angry wife can be more frightening than an army of disgruntled soldiers.",
  "Individually, you are a warrior. Together, we are an army.",
  "It's not the years in your life that count. It's the life in your years.",
  "Life is what happens to us while we are making other plans.",
  "A goal without a plan is just a wish.",
  "Don't let yesterday take up too much of today.",
  "The best revenge is massive success.",
  "I am not a product of my circumstances. I am a product of my decisions.",
  "People who are crazy enough to think they can change the world, are the ones who do.",
  "In three words I can sum up everything I've learned about life: it goes on.",
  "Bravery is their routine, sacrifice their second nature.",
  "The only way to do great work is to love what you do.",
  "Believe you can and you're halfway there.",
  "It does not matter how slowly you go as long as you do not stop.",
  "You miss 100% of the shots you don't take.",
];

export const getRandomQuote = () =>
  OFFICERS_BRIEFING[Math.floor(Math.random() * OFFICERS_BRIEFING.length)];
