export const MAX_SALARY = 1_000_000;
export const CATEGORIES = [
  { key: 'saving', name: '저축', rate: 40, color: '#13856f' },
  { key: 'emergency', name: '비상금', rate: 4, color: '#e4b74a' },
  { key: 'culture', name: '문화비', rate: 6, color: '#9990d8' },
  { key: 'living', name: '생활비', rate: 50, color: '#89b7ca' },
];

// All public inputs and outputs use whole 10,000 KRW units.
export function calculateBudget(salary, repayment = 0) {
  if (!Number.isSafeInteger(salary) || salary < 1 || salary > MAX_SALARY) {
    throw new RangeError('월급은 1~1,000,000 사이의 정수 만원으로 입력해 주세요.');
  }
  const repaymentLimit = salary;
  if (!Number.isSafeInteger(repayment) || repayment < 0 || repayment > repaymentLimit) {
    throw new RangeError('월 상환액은 월급 이내로 입력해 주세요.');
  }
  // Repay debt first, then split the remainder 40:4:6:50. All four
  // categories decrease by the same proportion, including living expenses.
  // 100 subunits per 만원 keep this arithmetic exact before flooring once.
  const available = salary - repayment;
  const precise = CATEGORIES.map(c => available * c.rate);
  const categories = CATEGORIES.map((c, i) => ({
    ...c,
    amount: Math.floor(Math.max(0, precise[i]) / 100 + 1e-9),
    percent: Math.max(0, precise[i]) / salary,
    reduced: repayment > 0,
  }));
  const [saving, emergency, culture, living] = categories.map(c => c.amount);
  const unallocated = salary - repayment - saving - emergency - culture - living;
  const years = Array.from({ length: 5 }, (_, i) => {
    const year = i + 1;
    return { year, saving: saving * 12 * year, emergency: emergency * 12 * year, total: (saving + emergency) * 12 * year };
  });
  return { salary, repayment, repaymentLimit, available, categories, saving, emergency, culture, living, unallocated, monthlySaved: saving + emergency, years };
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

export function calculateManualBudget(salary, repayment, ratios) {
  if (!Number.isSafeInteger(salary) || salary < 1 || salary > MAX_SALARY) {
    throw new RangeError('월급을 올바르게 입력해 주세요.');
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
    ...c, percent: tenths[i] / 10, amount: Math.floor(available * tenths[i] / 1000),
  }));
  const [saving, emergency, culture, living] = categories.map(c => c.amount);
  const unallocated = available - saving - emergency - culture - living;
  const years = Array.from({ length: 5 }, (_, i) => {
    const year = i + 1;
    return { year, saving: saving * 12 * year, emergency: emergency * 12 * year, total: (saving + emergency) * 12 * year };
  });
  return { salary, repayment, available, categories, saving, emergency, culture, living, unallocated, monthlySaved: saving + emergency, years };
}
