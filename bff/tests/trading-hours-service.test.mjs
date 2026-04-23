// bff/tests/trading-hours-service.test.mjs
import { strict as assert } from 'assert';
import { isNyLunchBreakActive, isNyInDst, isNyLunchBlockActive } from '../services/tradingHoursService.mjs';

// DST mode tests (isDst=true)
// NY lunch = 12:00–13:00 ET → 21:30–22:30 IST during DST
assert(!isNyLunchBreakActive(21, 0, true), '21:00 IST DST — before lunch');
assert(!isNyLunchBreakActive(21, 29, true), '21:29 IST DST — before lunch');
assert(isNyLunchBreakActive(21, 30, true), '21:30 IST DST — lunch starts');
assert(isNyLunchBreakActive(21, 59, true), '21:59 IST DST — lunch active');
assert(isNyLunchBreakActive(22, 0, true), '22:00 IST DST — lunch active');
assert(!isNyLunchBreakActive(22, 30, true), '22:30 IST DST — lunch ends');
assert(!isNyLunchBreakActive(22, 59, true), '22:59 IST DST — after lunch');
assert(!isNyLunchBreakActive(23, 0, true), '23:00 IST DST — after lunch');

// Non-DST mode tests (isDst=false)
// NY lunch = 12:00–13:00 ET → 22:30–23:30 IST outside DST
assert(!isNyLunchBreakActive(22, 0, false), '22:00 IST noDST — before lunch');
assert(!isNyLunchBreakActive(22, 29, false), '22:29 IST noDST — before lunch');
assert(isNyLunchBreakActive(22, 30, false), '22:30 IST noDST — lunch starts');
assert(isNyLunchBreakActive(22, 59, false), '22:59 IST noDST — lunch active');
assert(isNyLunchBreakActive(23, 0, false), '23:00 IST noDST — lunch active');
assert(isNyLunchBreakActive(23, 29, false), '23:29 IST noDST — lunch active');
assert(!isNyLunchBreakActive(23, 30, false), '23:30 IST noDST — lunch ends');

// Sanity: non-lunch hours never block
assert(!isNyLunchBreakActive(7, 0, true), '07:00 IST morning — not lunch');
assert(!isNyLunchBreakActive(14, 0, true), '14:00 IST afternoon — not lunch');
assert(!isNyLunchBreakActive(3, 0, false), '03:00 IST night — not lunch');

// isNyInDst: should return a boolean (truthy or falsy)
const dst = isNyInDst(new Date('2026-06-15T12:00:00Z')); // summer
const noDst = isNyInDst(new Date('2026-01-15T12:00:00Z')); // winter
assert(dst === true || dst === false, 'isNyInDst must return boolean for summer');
assert(noDst === true || noDst === false, 'isNyInDst must return boolean for winter');

// Explicit DST dates
assert.strictEqual(isNyInDst(new Date('2026-06-15T12:00:00Z')), true, 'June date should be in DST');
assert.strictEqual(isNyInDst(new Date('2026-01-15T12:00:00Z')), false, 'January date should be in standard time');

// isNyLunchBlockActive: UTC timestamp → IST → lunch check
// DST ON: NY lunch 12:00-13:00 ET → 21:30-22:30 IST
// A UTC time that lands inside 21:30-22:30 IST during DST → allowed:false
const dstInsideLunch = new Date('2026-07-15T16:00:00Z'); // 21:30 IST (UTC+5:30)
assert.strictEqual(
  isNyLunchBlockActive(dstInsideLunch).allowed,
  false,
  'UTC landing in 21:30 IST during DST → blocked',
);

// A UTC time landing outside the DST lunch window → allowed:true
const dstOutsideLunch = new Date('2026-07-15T14:00:00Z'); // 19:30 IST
assert.strictEqual(
  isNyLunchBlockActive(dstOutsideLunch).allowed,
  true,
  'UTC landing in 19:30 IST during DST → not blocked',
);

// DST OFF: NY lunch 12:00-13:00 ET → 22:30-23:30 IST
// A UTC time landing inside 22:30-23:30 IST outside DST → allowed:false
const noDstInsideLunch = new Date('2026-01-15T17:00:00Z'); // 22:30 IST (UTC+5:30)
assert.strictEqual(
  isNyLunchBlockActive(noDstInsideLunch).allowed,
  false,
  'UTC landing in 22:30 IST outside DST → blocked',
);

// A UTC time landing just before the non-DST lunch window → allowed:true
const noDstBeforeLunch = new Date('2026-01-15T16:30:00Z'); // 22:00 IST
assert.strictEqual(
  isNyLunchBlockActive(noDstBeforeLunch).allowed,
  true,
  'UTC landing in 22:00 IST outside DST → not blocked',
);

// Verify the `now` parameter is respected — two different inputs give different results
const lunchResult = isNyLunchBlockActive(new Date('2026-07-15T16:00:00Z'));
const openResult  = isNyLunchBlockActive(new Date('2026-07-15T14:00:00Z'));
assert(lunchResult.allowed !== openResult.allowed, 'Different now values produce different allowed results');

console.log('All tradingHoursService tests passed');