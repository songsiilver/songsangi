import { calculateManualBudget, parseAmount, parseRatio } from './calculator.mjs?v=5';

export function setupManualCalculator() {
  const $ = id => document.getElementById(id);
  const nf = new Intl.NumberFormat('ko-KR');
  const pf = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 });
  const money = n => `${nf.format(n)}만원`;
  const fields = ['manualSaving', 'manualEmergency', 'manualCulture', 'manualLiving'].map($);
  const defaults = [40, 4, 6, 50];
  let latest = null;
  let lastInputKey = '';

  function clearCopy() {
    $('manualCopyStatus').textContent = '';
    $('manualCopyFallback').hidden = true;
    $('manualCopyText').value = '';
  }

  function readInputs() {
    const salary = parseAmount($('salaryInput').value);
    const repayment = $('loanToggle').checked ? parseAmount($('loanInput').value, true) : 0;
    const ratios = fields.map(field => parseRatio(field.value));
    return { salary, repayment, ratios };
  }

  function update() {
    const inputKey = JSON.stringify([
      $('salaryInput').value, $('loanToggle').checked, $('loanInput').value,
      ...fields.map(field => field.value),
    ]);
    if (inputKey !== lastInputKey) {
      latest = null;
      $('manualResults').hidden = true;
      clearCopy();
      lastInputKey = inputKey;
    }
    const { salary, repayment, ratios } = readInputs();
    const incomeValid = salary !== null && repayment !== null && repayment <= salary;
    const ratiosValid = ratios.every(r => r !== null);
    const totalTenths = ratiosValid ? ratios.reduce((sum, r) => sum + Math.round(r * 10), 0) : null;
    const ready = incomeValid && totalTenths === 1000;
    fields.forEach((field, i) => field.setAttribute('aria-invalid', String(ratios[i] === null)));
    $('manualSalary').textContent = salary === null ? '—' : money(salary);
    $('manualRepayment').textContent = repayment === null ? '—' : money(repayment);
    $('manualAvailable').textContent = incomeValid ? money(salary - repayment) : '—';
    $('manualRatioTotal').textContent = totalTenths === null ? '—' : `${pf.format(totalTenths / 10)}%`;
    $('manualRatioStatus').dataset.valid = String(totalTenths === 1000);
    let message = '';
    if (!incomeValid) message = '위에서 월급과 월 상환액을 확인해 주세요. 월 상환액은 월급을 넘을 수 없어요.';
    else if (!ratiosValid) message = '각 비율은 0~100% 사이, 소수점 한 자리까지 입력해 주세요.';
    else if (totalTenths < 1000) message = `${pf.format((1000 - totalTenths) / 10)}%를 더 배분해 주세요.`;
    else if (totalTenths > 1000) message = `${pf.format((totalTenths - 1000) / 10)}%를 줄여 주세요.`;
    else message = '합계가 100%예요. 버튼을 누르면 아래에 수동 계산 결과가 나와요.';
    $('manualRatioMessage').textContent = message;
    $('manualCalculate').disabled = !ready;
    return ready;
  }

  function renderResults() {
    if (!latest) return;
    const b = latest;
    const years = Number($('manualYears').value);
    const future = b.years[years - 1];
    const names = ['Saving', 'Emergency', 'Culture', 'Living'];
    b.categories.forEach((c, i) => {
      $(`manual${names[i]}Amount`).textContent = nf.format(c.amount);
      $(`manual${names[i]}Percent`).textContent = `${pf.format(c.percent)}%`;
    });
    $('manualResultBasis').textContent = `월급 ${money(b.salary)} − 월 상환액 ${money(b.repayment)} = ${money(b.available)}을 배분한 결과예요.`;
    $('manualMonthlySaved').textContent = money(b.monthlySaved);
    $('manualRemainder').textContent = money(b.unallocated);
    $('manualCheckTotal').textContent = money(b.salary);
    $('manualResultLoan').textContent = money(b.repayment);
    $('manualFutureTotal').textContent = money(future.total);
    $('manualFutureBreakdown').textContent = `저축 ${money(future.saving)} + 비상금 ${money(future.emergency)}`;
    $('manualZeroNote').hidden = b.available !== 0;
    $('manualResults').hidden = false;
  }

  fields.forEach(field => field.addEventListener('input', update));
  $('manualForm').addEventListener('submit', event => {
    event.preventDefault();
    if (!update()) return;
    const { salary, repayment, ratios } = readInputs();
    latest = calculateManualBudget(salary, repayment, ratios);
    clearCopy();
    renderResults();
    $('manualResultTitle').focus({ preventScroll: true });
    $('manualResults').scrollIntoView({ behavior: 'auto', block: 'start' });
  });
  $('manualResetRatios').addEventListener('click', () => {
    fields.forEach((field, i) => { field.value = String(defaults[i]); });
    update();
  });
  $('manualYears').addEventListener('change', () => { clearCopy(); renderResults(); });
  $('manualCopyButton').addEventListener('click', async () => {
    if (!latest) return;
    const b = latest;
    const years = Number($('manualYears').value);
    const text = [
      '송산기 | 내가 정한 비율로 계산한 월급 루틴',
      `세후 월급: ${money(b.salary)}`, `월 대출 상환액: ${money(b.repayment)}`,
      `배분 기준: 대출 상환 후 남은 ${money(b.available)} = 100%`,
      ...b.categories.map(c => `${c.name}: ${money(c.amount)} (${pf.format(c.percent)}%)`),
      `배분 후 남은 금액: ${money(b.unallocated)}`,
      `${years}년 뒤 저축 + 비상금 원금: ${money(b.years[years - 1].total)}`,
      '(이자·투자 수익 제외, 비상금 미사용, 월급·월 상환액·배분액이 일정하다고 가정)',
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      $('manualCopyStatus').textContent = '수동 계산 결과가 복사됐어요.';
    } catch {
      $('manualCopyText').value = text;
      $('manualCopyFallback').hidden = false;
      $('manualCopyStatus').textContent = '아래 결과를 직접 복사해 주세요.';
    }
  });

  function reset() {
    fields.forEach((field, i) => { field.value = String(defaults[i]); });
    $('manualYears').value = '5';
    latest = null;
    lastInputKey = '';
    update();
  }
  return { update, reset };
}
