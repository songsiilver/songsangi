export const MAX_SALARY = 1_000_000;
export const CATEGORIES = [
  { key: 'saving', name: '저축', rate: 40, color: '#13856f' },
  { key: 'emergency', name: '비상금', rate: 4, color: '#e4b74a' },
  { key: 'culture', name: '문화비', rate: 6, color: '#9990d8' },
  { key: 'living', name: '생활비', rate: 50, color: '#89b7ca' },
];

export const DEFAULT_RATIOS = CATEGORIES.map(c => c.rate);

// All public inputs and outputs use whole 10,000 KRW units.
// Repay debt first, then split the remainder by the ratios (default 40:4:6:50).
// Ratios are percentages of the money left after repayment, one decimal place,
// summing to 100. Tenths keep the arithmetic exact before flooring once.
export function calculateBudget(salary, repayment = 0, ratios = DEFAULT_RATIOS) {
  if (!Number.isSafeInteger(salary) || salary < 1 || salary > MAX_SALARY) {
    throw new RangeError('월급은 1~1,000,000 사이의 정수 만원으로 입력해 주세요.');
  }
  if (!Number.isSafeInteger(repayment) || repayment < 0 || repayment > salary) {
    throw new RangeError('월 상환액은 월급 이내로 입력해 주세요.');
  }
  if (!Array.isArray(ratios) || ratios.length !== 4 || ratios.some(r =>
    !Number.isFinite(r) || r < 0 || r > 100 || Math.abs(r * 10 - Math.round(r * 10)) > 1e-8
  )) {
    throw new RangeError('비율은 0~100% 사이, 소수점 한 자리까지 입력해 주세요.');
  }
  const tenths = ratios.map(r => Math.round(r * 10));
  if (tenths.reduce((sum, r) => sum + r, 0) !== 1000) {
    throw new RangeError('네 항목의 비율 합계를 100%로 맞춰 주세요.');
  }
  const available = salary - repayment;
  const categories = CATEGORIES.map((c, i) => ({
    ...c,
    rate: tenths[i] / 10,
    amount: Math.floor(available * tenths[i] / 1000),
    // share of the whole salary, before flooring
    percent: available * tenths[i] / 10 / salary,
    reduced: repayment > 0,
  }));
  const [saving, emergency, culture, living] = categories.map(c => c.amount);
  const unallocated = available - saving - emergency - culture - living;
  const years = Array.from({ length: 5 }, (_, i) => {
    const year = i + 1;
    return { year, saving: saving * 12 * year, emergency: emergency * 12 * year, total: (saving + emergency) * 12 * year };
  });
  return { salary, repayment, available, ratios: tenths.map(t => t / 10), categories, saving, emergency, culture, living, unallocated, monthlySaved: saving + emergency, years };
}

export function parseAmount(value, allowZero = false) {
  const clean = String(value).trim();
  if (!/^\d+$/.test(clean)) return null;
  const n = Number(clean);
  return Number.isSafeInteger(n) && n >= (allowZero ? 0 : 1) && n <= MAX_SALARY ? n : null;
}

// Manual ratios apply to the income remaining AFTER monthly debt repayment.
// Store percentages in tenths to validate the total without floating-point drift.
export function parseRatio(value) {
  const clean = String(value).trim();
  if (!/^\d{1,3}(?:\.\d)?$/.test(clean)) return null;
  const n = Number(clean);
  return n >= 0 && n <= 100 ? n : null;
}
