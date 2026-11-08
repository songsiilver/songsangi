import { calculateBudget, parseAmount } from './calculator.mjs?v=5';
import { setupManualCalculator } from './manual.mjs?v=5';
const $=id=>document.getElementById(id), salaryInput=$('salaryInput'), loanInput=$('loanInput'), loanToggle=$('loanToggle');
const presets=[...document.querySelectorAll('[data-salary]')], terms=[...document.querySelectorAll('[data-years]')];
const nf=new Intl.NumberFormat('ko-KR'), pf=new Intl.NumberFormat('ko-KR',{maximumFractionDigits:1});
const money=n=>`${nf.format(n)}만원`, set=(id,v)=>{$(id).textContent=v;};
let years=5, latest=null, statusTimer;
const manual=setupManualCalculator();
function inputError(input,el,msg){input.setAttribute('aria-invalid',String(!!msg));el.textContent=msg;el.hidden=!msg;}
function clearCopy(){set('copyStatus','');$('copyFallback').hidden=true;$('copyText').value='';}
function edited(){$('exampleNote').hidden=true;$('exampleBadge').hidden=true;$('integerNote').hidden=false;clearCopy();}
function announce(msg){clearTimeout(statusTimer);statusTimer=setTimeout(()=>set('liveStatus',msg),500);}
function render(){
  const salary=parseAmount(salaryInput.value), loan=loanToggle.checked?parseAmount(loanInput.value,true):0;
  const salaryError=salary===null&&salaryInput.value!==''?'월급은 1~1,000,000 사이의 정수 만원으로 입력해 주세요.':'';
  let loanError='';
  if(loanToggle.checked&&loan===null)loanError='월 상환액을 0 이상의 정수 만원으로 입력해 주세요.';
  else if(salary!==null&&loan>salary)loanError='월 상환액이 월급보다 커요. 월급이나 상환액을 확인해 주세요.';
  inputError(salaryInput,$('salaryError'),salaryError);inputError(loanInput,$('loanError'),loanError);
  presets.forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.salary)===salary)));
  terms.forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.years)===years)));
  const valid=salary!==null&&loan!==null&&!loanError;
  manual.update();
  $('results').hidden=!valid;$('summaryValues').hidden=!valid;$('summaryEmpty').hidden=valid;$('copyButton').disabled=!valid;
  if(!valid){latest=null;set('salaryMini','금액을 입력하면 바로 계산해요.');set('validationMessage',salaryInput.value===''?'세후 월급을 입력해 주세요.':'');announce('금액을 올바르게 입력하면 계산 결과가 표시됩니다.');return;}
  set('validationMessage','');
  const b=calculateBudget(salary,loan);latest=b;
  const zeroAfterRounding=loan>0&&b.categories.some(c=>c.amount===0);
  $('loanWarning').hidden=!zeroAfterRounding;
  set('loanWarning',loan===salary?'월급 전액을 대출 상환에 사용해 네 항목에 배분할 금액이 0원이에요.':'만원 미만으로 배분된 항목은 0만원으로 표시돼요. 버린 금액은 아래 남은 금액에 합산됩니다.');
  set('salaryMini',`월급 ${money(salary)} 기준 · 나의 작은 계획`);set('monthlySaving',nf.format(b.monthlySaved));set('saveRatio',pf.format(b.monthlySaved/salary*100)+'%');
  const ids=['savings','emergency','culture','living'];
  b.categories.forEach((c,i)=>{set(ids[i]+'Amount',nf.format(c.amount));set(ids[i]+'Percent',pf.format(c.percent)+'%');});
  set('loanAmount',money(loan));set('leftoverAmount',money(b.unallocated));set('remainderValue',money(b.unallocated));
  $('loanNote').hidden=loan===0;$('loanLegend').hidden=loan===0;$('remainingLegend').hidden=b.unallocated===0;
  const colors=['#23886f','#84a8d5','#b7a5d3','#e6bd87','#829190','#e7eae7'];
  const barIds=['barSavings','barEmergency','barCulture','barLiving','barLoan','barRemaining'];
  let cursor=0;
  const wedges=[...b.categories.map(c=>c.amount),loan,b.unallocated].map((v,i)=>{const width=v/salary*100,start=cursor;cursor+=width;$(barIds[i]).style.width=`${width}%`;return `${colors[i]} ${start}% ${cursor}%`;});
  $('ringChart').style.background=`conic-gradient(${wedges.join(',')})`;
  const chartText=`월급 ${money(salary)}: ${b.categories.map(c=>`${c.name} ${money(c.amount)}`).join(', ')}, 대출 상환 ${money(loan)}, 남은 금액 ${money(b.unallocated)}`;
  $('ringChart').setAttribute('aria-label',chartText);$('ratioTrack').setAttribute('aria-label',chartText);
  const future=b.years[years-1];set('futureLabel',`${years}년 뒤, 저축 + 비상금`);set('futureTotal',nf.format(future.total));set('futureSavings',money(future.saving));set('futureEmergency',money(future.emergency));
  $('yearOverview').innerHTML=b.years.map(y=>`<div class="year-point${y.year===years?' selected':''}"><span>${y.year}년 뒤</span><strong>${nf.format(y.total)}<small>만원</small></strong></div>`).join('');
  announce(`매달 저축과 비상금 ${money(b.monthlySaved)}, ${years}년 뒤 원금 ${money(future.total)}입니다.`);
}
[salaryInput,loanInput].forEach(input=>input.addEventListener('input',()=>{edited();render();}));
loanToggle.addEventListener('change',()=>{edited();$('loanEntry').hidden=!loanToggle.checked;loanToggle.setAttribute('aria-expanded',String(loanToggle.checked));render();});
presets.forEach(b=>b.addEventListener('click',()=>{salaryInput.value=b.dataset.salary;edited();render();}));
terms.forEach(b=>b.addEventListener('click',()=>{years=Number(b.dataset.years);clearCopy();render();}));
$('resetBtn').addEventListener('click',()=>{salaryInput.value='';loanInput.value='0';loanToggle.checked=false;$('loanEntry').hidden=true;loanToggle.setAttribute('aria-expanded','false');years=5;manual.reset();edited();render();salaryInput.focus();});
$('copyButton').addEventListener('click',async()=>{
  if(!latest)return;const b=latest;
  const text=['송산기 | 나의 월급 관리 루틴',`세후 월급: ${money(b.salary)}`,`배분 기준: 대출 상환 후 남은 ${money(b.available)}을 40%·4%·6%·50%로 배분`,...b.categories.map(c=>`${c.name}: ${money(c.amount)}`),`월 대출 상환액: ${money(b.repayment)}`,`배분 후 남은 금액: ${money(b.unallocated)}`,`${years}년 뒤 저축 + 비상금 원금: ${money(b.years[years-1].total)}`,'(이자·투자 수익 제외, 비상금 미사용, 월급·월 상환액·배분액이 일정하다고 가정)'].join('\n');
  try{await navigator.clipboard.writeText(text);set('copyStatus','계산 결과가 복사됐어요.');}
  catch{$('copyText').value=text;$('copyFallback').hidden=false;set('copyStatus','자동 복사가 제한된 브라우저예요. 아래 결과를 직접 복사할 수 있어요.');}
});
function restoreExample(){salaryInput.value='300';loanInput.value='0';loanToggle.checked=false;years=5;$('loanEntry').hidden=true;loanToggle.setAttribute('aria-expanded','false');$('exampleNote').hidden=false;$('exampleBadge').hidden=false;$('integerNote').hidden=true;manual.reset();clearCopy();render();}
// Values stay in page memory. A reload/history restoration resets to the example.
window.addEventListener('pageshow',restoreExample);restoreExample();
