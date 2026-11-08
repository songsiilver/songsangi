import { calculateBudget, parseAmount, parseRatio, DEFAULT_RATIOS } from './calculator.mjs?v=7';
const $=id=>document.getElementById(id), salaryInput=$('salaryInput'), loanInput=$('loanInput'), loanToggle=$('loanToggle');
const presets=[...document.querySelectorAll('[data-salary]')], terms=[...document.querySelectorAll('[data-years]')];
const ratioFields=['manualSaving','manualEmergency','manualCulture','manualLiving'].map($);
const nf=new Intl.NumberFormat('ko-KR'), pf=new Intl.NumberFormat('ko-KR',{maximumFractionDigits:1});
const money=n=>`${nf.format(n)}만원`, set=(id,v)=>{$(id).textContent=v;};
const NAMES=['저축','비상금','문화비','생활비'];
const ratioText=(r,sep=' · ')=>r.map((v,i)=>`${NAMES[i]} ${pf.format(v)}%`).join(sep);
const sameRatios=(a,b)=>a.every((v,i)=>Math.round(v*10)===Math.round(b[i]*10));
// The ratios currently used for every result on the page (default 40·4·6·50).
let years=5, ratios=[...DEFAULT_RATIOS], latest=null, statusTimer;
function inputError(input,el,msg){input.setAttribute('aria-invalid',String(!!msg));el.textContent=msg;el.hidden=!msg;}
function clearCopy(){
  set('copyStatus','');$('copyFallback').hidden=true;$('copyText').value='';
  set('manualCopyStatus','');$('manualCopyFallback').hidden=true;$('manualCopyText').value='';
}
function edited(){$('exampleNote').hidden=true;$('exampleBadge').hidden=true;$('integerNote').hidden=false;clearCopy();}
function announce(msg){clearTimeout(statusTimer);statusTimer=setTimeout(()=>set('liveStatus',msg),500);}
function readIncome(){return{salary:parseAmount(salaryInput.value),loan:loanToggle.checked?parseAmount(loanInput.value,true):0};}

// Ratio editor: validates the draft ratios. They apply only when "이 비율로 계산하기" is pressed.
function updateRatioForm(){
  const {salary,loan}=readIncome();
  const incomeValid=salary!==null&&loan!==null&&loan<=salary;
  set('manualSalary',salary===null?'—':money(salary));
  set('manualRepayment',loan===null?'—':money(loan));
  set('manualAvailable',incomeValid?money(salary-loan):'—');
  const draft=ratioFields.map(f=>parseRatio(f.value));
  const valid=draft.every(r=>r!==null);
  const totalTenths=valid?draft.reduce((s,r)=>s+Math.round(r*10),0):null;
  ratioFields.forEach((f,i)=>f.setAttribute('aria-invalid',String(draft[i]===null)));
  set('manualRatioTotal',totalTenths===null?'—':`${pf.format(totalTenths/10)}%`);
  $('manualRatioStatus').dataset.valid=String(totalTenths===1000);
  let msg;
  if(!valid)msg='각 비율은 0~100% 사이, 소수점 한 자리까지 입력해 주세요.';
  else if(totalTenths<1000)msg=`${pf.format((1000-totalTenths)/10)}%를 더 배분해 주세요.`;
  else if(totalTenths>1000)msg=`${pf.format((totalTenths-1000)/10)}%를 줄여 주세요.`;
  else if(sameRatios(draft,ratios))msg='합계가 100%예요. 지금 이 비율로 계산하고 있어요.';
  else msg='합계가 100%예요. 버튼을 누르면 위 카드와 미래 원금에 바로 반영돼요.';
  set('manualRatioMessage',msg);
  const ok=valid&&totalTenths===1000;
  $('manualCalculate').disabled=!ok;
  return ok?draft:null;
}

function render(){
  const {salary,loan}=readIncome();
  const salaryError=salary===null&&salaryInput.value!==''?'월급은 1~1,000,000 사이의 정수 만원으로 입력해 주세요.':'';
  let loanError='';
  if(loanToggle.checked&&loan===null)loanError='월 상환액을 0 이상의 정수 만원으로 입력해 주세요.';
  else if(salary!==null&&loan>salary)loanError='월 상환액이 월급보다 커요. 월급이나 상환액을 확인해 주세요.';
  inputError(salaryInput,$('salaryError'),salaryError);inputError(loanInput,$('loanError'),loanError);
  presets.forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.salary)===salary)));
  terms.forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.years)===years)));
  $('manualYears').value=String(years);
  set('autoGuideRatios',ratioText(ratios));
  updateRatioForm();
  const valid=salary!==null&&loan!==null&&!loanError;
  $('results').hidden=!valid;$('summaryValues').hidden=!valid;$('summaryEmpty').hidden=valid;$('copyButton').disabled=!valid;
  if(!valid){latest=null;set('salaryMini','금액을 입력하면 바로 계산해요.');set('validationMessage',salaryInput.value===''?'세후 월급을 입력해 주세요.':'');announce('금액을 올바르게 입력하면 계산 결과가 표시됩니다.');return;}
  set('validationMessage','');
  const b=calculateBudget(salary,loan,ratios);latest=b;
  const zeroAfterRounding=loan>0&&b.categories.some(c=>c.amount===0);
  $('loanWarning').hidden=!zeroAfterRounding;
  set('loanWarning',loan===salary?'월급 전액을 대출 상환에 사용해 네 항목에 배분할 금액이 0원이에요.':'만원 미만으로 배분된 항목은 0만원으로 표시돼요. 버린 금액은 아래 남은 금액에 합산됩니다.');
  set('salaryMini',`월급 ${money(salary)} 기준 · 나의 작은 계획`);set('monthlySaving',nf.format(b.monthlySaved));set('saveRatio',pf.format(b.monthlySaved/salary*100)+'%');
  const ids=['savings','emergency','culture','living'];
  b.categories.forEach((c,i)=>{set(ids[i]+'Amount',nf.format(c.amount));set(ids[i]+'Percent',pf.format(c.percent)+'%');set(ids[i]+'Rate',`배분 비율 ${pf.format(c.rate)}%`);});
  set('remainderValue',money(b.unallocated));
  $('loanLegend').hidden=loan===0;$('remainingLegend').hidden=b.unallocated===0;
  const colors=['#23886f','#84a8d5','#b7a5d3','#e6bd87','#829190','#e7eae7'];
  const barIds=['barSavings','barEmergency','barCulture','barLiving','barLoan','barRemaining'];
  let cursor=0;
  const wedges=[...b.categories.map(c=>c.amount),loan,b.unallocated].map((v,i)=>{const width=v/salary*100,start=cursor;cursor+=width;$(barIds[i]).style.width=`${width}%`;return `${colors[i]} ${start}% ${cursor}%`;});
  $('ringChart').style.background=`conic-gradient(${wedges.join(',')})`;
  const chartText=`월급 ${money(salary)}: ${b.categories.map(c=>`${c.name} ${money(c.amount)}`).join(', ')}, 대출 상환 ${money(loan)}, 남은 금액 ${money(b.unallocated)}`;
  $('ringChart').setAttribute('aria-label',chartText);$('ratioTrack').setAttribute('aria-label',chartText);
  // 2번 하단: 확인 줄 + 매달 저축/미래 원금
  const future=b.years[years-1];
  set('manualResultLoan',money(loan));set('manualRemainder',money(b.unallocated));
  set('manualCheckTotal',money(b.saving+b.emergency+b.culture+b.living+loan+b.unallocated));
  $('manualZeroNote').hidden=b.available!==0;
  set('manualMonthlySaved',money(b.monthlySaved));set('manualFutureTotal',money(future.total));
  set('manualFutureBreakdown',`저축 ${money(future.saving)} + 비상금 ${money(future.emergency)}`);
  // 3번
  set('futureLabel',`${years}년 뒤, 저축 + 비상금`);set('futureTotal',nf.format(future.total));set('futureSavings',money(future.saving));set('futureEmergency',money(future.emergency));
  $('yearOverview').innerHTML=b.years.map(y=>`<div class="year-point${y.year===years?' selected':''}"><span>${y.year}년 뒤</span><strong>${nf.format(y.total)}<small>만원</small></strong></div>`).join('');
  announce(`매달 저축과 비상금 ${money(b.monthlySaved)}, ${years}년 뒤 원금 ${money(future.total)}입니다.`);
}

function copyText(b){
  return ['송산기 | 나의 월급 관리 루틴',`세후 월급: ${money(b.salary)}`,`월 대출 상환액: ${money(b.repayment)}`,`배분 기준: 대출 상환 후 남은 ${money(b.available)}을 ${ratioText(b.ratios,'·')}로 배분`,...b.categories.map(c=>`${c.name}: ${money(c.amount)}`),`배분 후 남은 금액: ${money(b.unallocated)}`,`${years}년 뒤 저축 + 비상금 원금: ${money(b.years[years-1].total)}`,'(이자·투자 수익 제외, 비상금 미사용, 월급·월 상환액·배분 비율이 일정하다고 가정)'].join('\n');
}
async function copyResult(statusId,fallbackId,textId){
  if(!latest)return;const text=copyText(latest);
  try{await navigator.clipboard.writeText(text);set(statusId,'계산 결과가 복사됐어요.');}
  catch{$(textId).value=text;$(fallbackId).hidden=false;set(statusId,'자동 복사가 제한된 브라우저예요. 아래 결과를 직접 복사할 수 있어요.');}
}

// 입력값은 이 기기의 브라우저(localStorage)에만 저장돼요. 서버로 보내지 않고, 다른 사람의 브라우저에는 보이지 않아요.
const STORE_KEY='songsangi:my-settings:v1';
function saveState(){
  const state={salary:salaryInput.value,loanOn:loanToggle.checked,loan:loanInput.value,years,ratios:ratios.map(String)};
  try{localStorage.setItem(STORE_KEY,JSON.stringify(state));}catch{}
}
function loadState(){try{const raw=localStorage.getItem(STORE_KEY);return raw?JSON.parse(raw):null;}catch{return null;}}
function clearState(){try{localStorage.removeItem(STORE_KEY);}catch{}}
function setRatios(r){ratios=[...r];ratioFields.forEach((f,i)=>{f.value=String(r[i]);});}
function validSavedRatios(r){
  if(!Array.isArray(r)||r.length!==4)return null;
  const n=r.map(parseRatio);
  return n.every(v=>v!==null)&&n.reduce((s,v)=>s+Math.round(v*10),0)===1000?n:null;
}
function restoreExample(){salaryInput.value='300';loanInput.value='0';loanToggle.checked=false;years=5;$('loanEntry').hidden=true;loanToggle.setAttribute('aria-expanded','false');$('exampleNote').hidden=false;$('exampleBadge').hidden=false;$('integerNote').hidden=true;setRatios(DEFAULT_RATIOS);clearCopy();render();}
function restoreSaved(){
  const s=loadState();
  if(!s||typeof s!=='object'){restoreExample();return;}
  salaryInput.value=String(s.salary??'');loanInput.value=String(s.loan??'0');loanToggle.checked=!!s.loanOn;
  years=[1,2,3,4,5].includes(Number(s.years))?Number(s.years):5;
  $('loanEntry').hidden=!loanToggle.checked;loanToggle.setAttribute('aria-expanded',String(loanToggle.checked));
  setRatios(validSavedRatios(s.ratios)||DEFAULT_RATIOS);
  edited();render();
}

[salaryInput,loanInput].forEach(input=>input.addEventListener('input',()=>{edited();render();saveState();}));
loanToggle.addEventListener('change',()=>{edited();$('loanEntry').hidden=!loanToggle.checked;loanToggle.setAttribute('aria-expanded',String(loanToggle.checked));render();saveState();});
presets.forEach(b=>b.addEventListener('click',()=>{salaryInput.value=b.dataset.salary;edited();render();saveState();}));
terms.forEach(b=>b.addEventListener('click',()=>{years=Number(b.dataset.years);clearCopy();render();saveState();}));
$('manualYears').addEventListener('change',()=>{years=Number($('manualYears').value);clearCopy();render();saveState();});
ratioFields.forEach(f=>f.addEventListener('input',updateRatioForm));
$('manualForm').addEventListener('submit',event=>{
  event.preventDefault();
  const draft=updateRatioForm();if(!draft)return;
  ratios=draft;clearCopy();render();saveState();
  set('manualRatioMessage','이 비율로 계산했어요. 위 카드와 아래 미래 원금에 반영했어요.');
});
$('manualResetRatios').addEventListener('click',()=>{setRatios(DEFAULT_RATIOS);clearCopy();render();saveState();});
// '입력 초기화'를 누르면 이 기기에 저장된 값(비율 포함)도 지워요. 다음에 열면 300만원 예시로 시작해요.
$('resetBtn').addEventListener('click',()=>{salaryInput.value='';loanInput.value='0';loanToggle.checked=false;$('loanEntry').hidden=true;loanToggle.setAttribute('aria-expanded','false');years=5;setRatios(DEFAULT_RATIOS);edited();render();clearState();salaryInput.focus();});
$('copyButton').addEventListener('click',()=>copyResult('copyStatus','copyFallback','copyText'));
$('manualCopyButton').addEventListener('click',()=>copyResult('manualCopyStatus','manualCopyFallback','manualCopyText'));
window.addEventListener('pageshow',restoreSaved);restoreSaved();
