// Simple Vet Clinic Simulator (updated: more robust button handling & feedback)

// Core DOM refs
const DOM = {
  money: document.getElementById('money'),
  reputation: document.getElementById('reputation'),
  nextBtn: document.getElementById('nextBtn'),
  waitingList: document.getElementById('waitingList'),
  custName: document.getElementById('custName'),
  petInfo: document.getElementById('petInfo'),
  symptomList: document.getElementById('symptomList'),
  testResults: document.getElementById('testResults'),
  diagnosisSelect: document.getElementById('diagnosisSelect'),
  diagnoseBtn: document.getElementById('diagnoseBtn'),
  treatmentOptions: document.getElementById('treatmentOptions'),
  feedback: document.getElementById('feedback'),
  logList: document.getElementById('logList')
};

let state = {
  money: 100,
  reputation: 50,
  waiting: [],
  current: null,
  diseases: [],
  diagnosisOptions: []
};

// Disease and test definitions (unchanged)
const DISEASES = [
  {
    id: 'parvo',
    name: 'Parvovirus',
    petTypes: ['Dog'],
    symptoms: ['Vomiting', 'Bloody diarrhea', 'Lethargy', 'Loss of appetite', 'Dehydration'],
    tests: {
      stool: {positive: 'Parvo antigen detected', rate: 0.9},
      blood: {positive: 'Low white blood cells', rate: 0.7},
      xray: {positive: 'Dilated intestines', rate: 0.6}
    },
    treatment: {name: 'IV fluids + Antiemetic + Isolation', reward: 80}
  },
  {
    id: 'mange',
    name: 'Mange (mites)',
    petTypes: ['Dog', 'Cat'],
    symptoms: ['Severe itching', 'Hair loss', 'Red skin', 'Scabs'],
    tests: {
      skin: {positive: 'Mites observed on scraping', rate: 0.85},
      flea: {positive: 'No fleas found', rate: 0.6}
    },
    treatment: {name: 'Topical acaricide + medicated bath', reward: 40}
  },
  {
    id: 'flea_allergy',
    name: 'Flea Allergy Dermatitis',
    petTypes: ['Dog', 'Cat'],
    symptoms: ['Itching', 'Bite marks', 'Hair loss', 'Red bumps'],
    tests: {
      flea: {positive: 'Fleas or flea dirt present', rate: 0.9},
      skin: {positive: 'Secondary bacterial infection', rate: 0.4}
    },
    treatment: {name: 'Flea control + anti inflammation', reward: 35}
  },
  {
    id: 'uti',
    name: 'Urinary Tract Infection',
    petTypes: ['Dog', 'Cat'],
    symptoms: ['Straining to urinate', 'Frequent urination', 'Blood in urine', 'Licking genitals'],
    tests: {
      urine: {positive: 'Bacteria and blood in urine', rate: 0.9},
      blood: {positive: 'Mildly raised white cells', rate: 0.5}
    },
    treatment: {name: 'Antibiotics for UTI', reward: 30}
  },
  {
    id: 'kennel_cough',
    name: 'Kennel Cough',
    petTypes: ['Dog'],
    symptoms: ['Dry hacking cough', 'Gagging', 'Low energy', 'Mild fever'],
    tests: {
      xray: {positive: 'Bronchial pattern', rate: 0.5},
      blood: {positive: 'Slight inflammation markers', rate: 0.4}
    },
    treatment: {name: 'Cough suppressant + rest', reward: 25}
  },
  {
    id: 'diabetes',
    name: 'Diabetes Mellitus',
    petTypes: ['Dog', 'Cat'],
    symptoms: ['Increased thirst', 'Increased urination', 'Weight loss', 'Increased appetite'],
    tests: {
      blood: {positive: 'High blood glucose', rate: 0.95},
      urine: {positive: 'Glucose in urine', rate: 0.9}
    },
    treatment: {name: 'Insulin + diet management', reward: 70}
  }
];

const TESTS = {
  blood: {cost: 20, name: 'Blood Test', key: 'blood'},
  stool: {cost: 15, name: 'Stool Test', key: 'stool'},
  skin: {cost: 12, name: 'Skin Scrape', key: 'skin'},
  xray: {cost: 30, name: 'X-Ray', key: 'xray'},
  flea: {cost: 5, name: 'Flea Check', key: 'flea'},
  urine: {cost: 18, name: 'Urine Analysis', key: 'urine'}
};

// ---------- initialization ----------
function init() {
  state.diseases = DISEASES;
  populateDiagnosisOptions();
  seedWaitingRoom(5);
  updateHUD();
  bindEvents();
  log("Clinic opened. Good luck!");
}

function bindEvents() {
  if (DOM.nextBtn) {
    DOM.nextBtn.addEventListener('click', () => {
      try {
        callNextCustomer();
      } catch (err) {
        console.error('Error while calling next customer:', err);
        showFeedback('An error occurred while calling the next customer.', 'bad');
      }
    });
  }

  // Use currentTarget to avoid missing clicks when inner nodes exist
  document.querySelectorAll('.testBtn').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      try {
        const test = e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.test : null;
        if (!test) {
          console.warn('Clicked a test button with no data-test attribute', e.currentTarget);
          showFeedback('Test unavailable.', 'bad');
          return;
        }
        runTest(test);
      } catch (err) {
        console.error('Error running test:', err);
        showFeedback('An error occurred running the test.', 'bad');
      }
    });
  });

  if (DOM.diagnoseBtn) {
    DOM.diagnoseBtn.addEventListener('click', ()=>{
      try {
        submitDiagnosis();
      } catch (err) {
        console.error('Error on diagnose:', err);
        showFeedback('An error occurred during diagnosis.', 'bad');
      }
    });
  }
}

// ---------- UI helpers ----------
function showFeedback(msg, type = 'neutral') {
  if(!DOM.feedback) return;
  DOM.feedback.textContent = msg;
  DOM.feedback.className = 'feedback';
  if(type === 'good') DOM.feedback.classList.add('good');
  if(type === 'bad') DOM.feedback.classList.add('bad');
}

function populateDiagnosisOptions() {
  const select = DOM.diagnosisSelect;
  if(!select) return;
  // clear prior options except first placeholder
  select.innerHTML = '<option value="">-- Select diagnosis --</option>';
  state.diseases.forEach(d=>{
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = d.name;
    select.appendChild(opt);
  });
}

// ---------- waiting & customers ----------
function seedWaitingRoom(n) {
  for(let i=0;i<n;i++){
    state.waiting.push(generateCustomer());
  }
  renderWaiting();
}

function generateCustomer() {
  const petTypes = ['Dog','Cat','Rabbit'];
  const petType = petTypes[rand(0,petTypes.length-1)];
  const possible = state.diseases.filter(d => d.petTypes.includes(petType) || d.petTypes.length===0);
  const disease = possible[rand(0,possible.length-1)];
  const custNames = ['Alex','Jamie','Taylor','Jordan','Morgan','Casey','Riley','Sam','Charlie','Dana'];
  const petNames = ['Buddy','Mittens','Nibbles','Coco','Rex','Luna','Bella','Ollie','Simba','Daisy'];
  const observed = generateObservedSymptoms(disease);
  return {
    id: 'cust_' + Math.random().toString(36).slice(2,9),
    owner: custNames[rand(0,custNames.length-1)],
    petName: petNames[rand(0,petNames.length-1)],
    petType,
    disease,
    observedSymptoms: observed,
    testsRun: {},
    called: false
  };
}

function generateObservedSymptoms(disease) {
  const numTrue = rand(2,3);
  const trueSymptoms = shuffleArray(disease.symptoms).slice(0,numTrue);
  const otherSymptoms = state.diseases.flatMap(d=>d.symptoms).filter(s=>!trueSymptoms.includes(s));
  const numNoise = Math.random() < 0.4 ? rand(0,2) : 0;
  const noise = shuffleArray(otherSymptoms).slice(0,numNoise);
  return shuffleArray([...trueSymptoms, ...noise]);
}

function renderWaiting() {
  if(!DOM.waitingList) return;
  DOM.waitingList.innerHTML = '';
  state.waiting.forEach((c, idx)=>{
    const li = document.createElement('li');
    li.textContent = `${c.owner} - ${c.petName} (${c.petType})`;
    DOM.waitingList.appendChild(li);
  });
}

function callNextCustomer() {
  if(state.current) {
    showFeedback("You still have a patient. Finish them before calling the next.", 'bad');
    log("Tried to call next while a patient is active.");
    return;
  }
  const next = state.waiting.shift();
  if(!next){
    log("No more customers. Seeded a few more.");
    seedWaitingRoom(3);
    return;
  }
  state.current = next;
  renderCurrent();
  renderWaiting();
}

// ---------- rendering current patient ----------
function renderCurrent() {
  const c = state.current;
  if(!c){
    DOM.custName.textContent = 'No customer';
    DOM.petInfo.textContent = '';
    DOM.symptomList.innerHTML = '';
    DOM.testResults.innerHTML = '';
    DOM.treatmentOptions.innerHTML = '';
    if(DOM.diagnosisSelect) DOM.diagnosisSelect.value = '';
    showFeedback('', 'neutral');
    return;
  }
  DOM.custName.textContent = `${c.owner} — ${c.petName}`;
  DOM.petInfo.textContent = `${c.petType}`;
  DOM.symptomList.innerHTML = '';
  c.observedSymptoms.forEach(s=>{
    const li = document.createElement('li');
    li.textContent = s;
    DOM.symptomList.appendChild(li);
  });
  DOM.testResults.innerHTML = '<em>No tests run yet.</em>';
  DOM.treatmentOptions.innerHTML = '';
  if(DOM.diagnosisSelect) DOM.diagnosisSelect.value = '';
  showFeedback('', 'neutral');

  // Enable/disable tests based on pet type: urine only for dog/cat
  document.querySelectorAll('.testBtn').forEach(btn=>{
    const t = btn.dataset.test;
    if(t === 'urine' && !['Dog','Cat'].includes(c.petType)){
      btn.disabled = true;
    } else {
      btn.disabled = false;
    }
  });
}

// ---------- tests ----------
function runTest(testKey) {
  const c = state.current;
  if(!c){ log("No current patient."); showFeedback('No current patient to test.', 'bad'); return; }
  const testDef = TESTS[testKey] || {cost: 10, name: testKey};
  if(state.money < testDef.cost){
    log("Not enough money to run the test.");
    showFeedback('Not enough money to run that test.', 'bad');
    return;
  }

  try {
    state.money -= testDef.cost;
    updateHUD();

    let resultText = `Used ${testDef.name} (-$${testDef.cost}). `;
    const disease = c.disease;
    const testInfo = (disease.tests && disease.tests[testKey]) ? disease.tests[testKey] : null;
    let positive = false;
    if(testInfo){
      positive = Math.random() < testInfo.rate;
    } else {
      positive = Math.random() < 0.08;
    }

    if(positive){
      const text = testInfo && testInfo.positive ? testInfo.positive : `${testDef.name} abnormal`;
      resultText += `Result: ${text}`;
    } else {
      resultText += `Result: No significant findings.`;
    }

    c.testsRun[testKey] = {positive, text: resultText, timestamp: Date.now()};
    renderTestResults();
    log(`${c.owner}'s ${c.petName}: ${testDef.name} run.`);
    showFeedback(`Ran ${testDef.name}.`, 'neutral');
  } catch (err) {
    console.error('Exception in runTest:', err);
    showFeedback('An error occurred while running the test.', 'bad');
  }
}

function renderTestResults() {
  const c = state.current;
  if(!c){ DOM.testResults.innerHTML = ''; return; }
  const parts = [];
  for(const [k,v] of Object.entries(c.testsRun)){
    parts.push(`<div class="test-line"><strong>${TESTS[k] ? TESTS[k].name : k}:</strong> ${v.positive ? '<span style="color:green">Positive</span>' : '<span style="color:gray">Negative</span>'} — ${v.text}</div>`);
  }
  DOM.testResults.innerHTML = parts.length ? parts.join('') : '<em>No tests run yet.</em>';
}

// ---------- diagnosis & treatment ----------
function submitDiagnosis() {
  const select = DOM.diagnosisSelect;
  if(!select){ showFeedback('Diagnosis UI not found.', 'bad'); return; }
  const selected = select.value;
  const c = state.current;
  if(!c){ log("No patient to diagnose."); showFeedback('No patient to diagnose.', 'bad'); return; }
  if(!selected){ log("Select a diagnosis from the dropdown."); showFeedback('Please select a diagnosis before submitting.', 'bad'); return; }

  try {
    const disease = state.diseases.find(d=>d.id===selected);
    const correct = selected === c.disease.id;

    if(correct){
      const base = disease.treatment.reward;
      const testsUsed = Object.keys(c.testsRun).length;
      const efficiencyBonus = Math.max(0, Math.round((3 - testsUsed) * 5));
      const moneyEarned = base + efficiencyBonus;
      state.money += moneyEarned;
      state.reputation = Math.min(100, state.reputation + 5);
      DOM.feedback.className = 'feedback good';
      DOM.feedback.innerHTML = `<strong>Correct!</strong> Treatment: ${disease.treatment.name}. You earned $${moneyEarned} and +5 reputation.`;
      DOM.treatmentOptions.innerHTML = '';
      const treatBtn = document.createElement('button');
      treatBtn.textContent = `Provide treatment (${disease.treatment.name})`;
      treatBtn.addEventListener('click', ()=>{
        finishTreatment(true);
      });
      DOM.treatmentOptions.appendChild(treatBtn);
      log(`Diagnosed ${c.petName} with ${disease.name} (correct).`);
    } else {
      const penalty = 15;
      state.money = Math.max(0, state.money - penalty);
      state.reputation = Math.max(0, state.reputation - 8);
      DOM.feedback.className = 'feedback bad';
      const actual = c.disease.name;
      DOM.feedback.innerHTML = `<strong>Incorrect diagnosis.</strong> Actual: ${actual}. You lost $${penalty} and -8 reputation.`;
      DOM.treatmentOptions.innerHTML = '';
      const fixBtn = document.createElement('button');
      fixBtn.textContent = `Treat for ${actual} (accept)`;
      fixBtn.addEventListener('click', ()=>{
        finishTreatment(false);
      });
      DOM.treatmentOptions.appendChild(fixBtn);
      log(`Diagnosed ${c.petName} incorrectly as ${disease ? disease.name : selected}.`);
    }
    updateHUD();
  } catch (err) {
    console.error('Exception in submitDiagnosis:', err);
    showFeedback('An error occurred when submitting the diagnosis.', 'bad');
  }
}

function finishTreatment(correct) {
  const c = state.current;
  if(!c) return;
  if(correct){
    log(`Treatment given to ${c.petName}. Pet is recovering.`);
  } else {
    log(`Treatment given after incorrect diagnosis. Outcome mixed.`);
  }
  state.current = null;
  state.waiting.push(generateCustomer());
  renderWaiting();
  renderCurrent();
}

function updateHUD() {
  if(DOM.money) DOM.money.textContent = `$${state.money}`;
  if(DOM.reputation) DOM.reputation.textContent = `Reputation: ${state.reputation}`;
}

function log(text) {
  if(!DOM.logList) return;
  const p = document.createElement('p');
  p.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
  DOM.logList.prepend(p);
}

// ---------- utilities ----------
function rand(min, max) {
  return Math.floor(Math.random()*(max-min+1))+min;
}
function shuffleArray(a){
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}
function shuffleCopy(a){ return shuffleArray([...a]); }

function randPick(a){ return a[rand(0,a.length-1)]; }

// init on load
init();
