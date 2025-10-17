// Simple Vet Clinic Simulator
// Core logic for customers, diseases, tests, diagnosis, scoring

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

// Define diseases with symptoms and how tests respond
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

// Tests definitions: cost and which test key maps
const TESTS = {
  blood: {cost: 20, name: 'Blood Test', key: 'blood'},
  stool: {cost: 15, name: 'Stool Test', key: 'stool'},
  skin: {cost: 12, name: 'Skin Scrape', key: 'skin'},
  xray: {cost: 30, name: 'X-Ray', key: 'xray'},
  flea: {cost: 5, name: 'Flea Check', key: 'flea'},
  urine: {cost: 18, name: 'Urine Analysis', key: 'urine'}
};

function init() {
  state.diseases = DISEASES;
  populateDiagnosisOptions();
  seedWaitingRoom(5);
  updateHUD();
  bindEvents();
  log("Clinic opened. Good luck!");
}

function bindEvents() {
  DOM.nextBtn.addEventListener('click', () => {
    callNextCustomer();
  });

  document.querySelectorAll('.testBtn').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      const test = e.target.dataset.test;
      runTest(test);
    });
  });

  DOM.diagnoseBtn.addEventListener('click', submitDiagnosis);
}

function populateDiagnosisOptions() {
  const select = DOM.diagnosisSelect;
  state.diseases.forEach(d=>{
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = d.name;
    select.appendChild(opt);
  });
}

function seedWaitingRoom(n) {
  for(let i=0;i<n;i++){
    state.waiting.push(generateCustomer());
  }
  renderWaiting();
}

function generateCustomer() {
  const petTypes = ['Dog','Cat','Rabbit'];
  const petType = petTypes[rand(0,petTypes.length-1)];
  // Choose a disease compatible with pet type (if none, pick one)
  const possible = state.diseases.filter(d => d.petTypes.includes(petType) || d.petTypes.length===0);
  const disease = possible[rand(0,possible.length-1)];
  const custNames = ['Alex','Jamie','Taylor','Jordan','Morgan','Casey','Riley','Sam','Charlie','Dana'];
  const petNames = ['Buddy','Mittens','Nibbles','Coco','Rex','Luna','Bella','Ollie','Simba','Daisy'];
  // Observed symptoms: pick a few from disease and maybe add noise
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
  // pick 2-3 true symptoms and maybe add 0-2 irrelevant symptoms
  const numTrue = rand(2,3);
  const trueSymptoms = shuffleArray(disease.symptoms).slice(0,numTrue);
  // possible noise from other diseases
  const otherSymptoms = state.diseases.flatMap(d=>d.symptoms).filter(s=>!trueSymptoms.includes(s));
  const numNoise = Math.random() < 0.4 ? rand(0,2) : 0; // sometimes noise
  const noise = shuffleArray(otherSymptoms).slice(0,numNoise);
  return shuffleArray([...trueSymptoms, ...noise]);
}

function renderWaiting() {
  DOM.waitingList.innerHTML = '';
  state.waiting.forEach((c, idx)=>{
    const li = document.createElement('li');
    li.textContent = `${c.owner} - ${c.petName} (${c.petType})`;
    DOM.waitingList.appendChild(li);
  });
}

function callNextCustomer() {
  if(state.current) {
    log("You still have a patient. Finish them before calling the next.");
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

function renderCurrent() {
  const c = state.current;
  if(!c){
    DOM.custName.textContent = 'No customer';
    DOM.petInfo.textContent = '';
    DOM.symptomList.innerHTML = '';
    DOM.testResults.innerHTML = '';
    DOM.treatmentOptions.innerHTML = '';
    DOM.diagnosisSelect.value = '';
    DOM.feedback.textContent = '';
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
  DOM.diagnosisSelect.value = '';
  DOM.feedback.textContent = '';
  // Enable/disable tests based on pet type: for simplicity, all tests present but urine only for dog/cat
  document.querySelectorAll('.testBtn').forEach(btn=>{
    const t = btn.dataset.test;
    if(t === 'urine' && !['Dog','Cat'].includes(c.petType)){
      btn.disabled = true;
    } else {
      btn.disabled = false;
    }
  });
}

function runTest(testKey) {
  const c = state.current;
  if(!c){ log("No current patient."); return; }
  // Check enough money
  const testDef = TESTS[testKey] || {cost: 10, name: testKey};
  if(state.money < testDef.cost){
    log("Not enough money to run the test.");
    return;
  }
  state.money -= testDef.cost;
  updateHUD();

  // Determine if the test returns positive for the current disease (if disease defines this test)
  let resultText = `Used ${testDef.name} (-$${testDef.cost}). `;
  const disease = c.disease;
  const testInfo = (disease.tests && disease.tests[testKey]) ? disease.tests[testKey] : null;
  let positive = false;
  if(testInfo){
    // accuracy is testInfo.rate; can flip false positive/negative slightly
    positive = Math.random() < testInfo.rate;
  } else {
    // random false positive small chance
    positive = Math.random() < 0.08;
  }

  if(positive){
    const text = testInfo && testInfo.positive ? testInfo.positive : `${testDef.name} abnormal`;
    resultText += `<strong>Result: ${text}</strong>`;
  } else {
    resultText += `Result: No significant findings.`;
  }

  // Save test result
  c.testsRun[testKey] = {positive, text: resultText, timestamp: Date.now()};
  renderTestResults();
  log(`${c.owner}'s ${c.petName}: ${testDef.name} run.`);
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

function submitDiagnosis() {
  const selected = DOM.diagnosisSelect.value;
  const c = state.current;
  if(!c){ log("No patient to diagnose."); return; }
  if(!selected){ log("Select a diagnosis from the dropdown."); return; }

  const disease = state.diseases.find(d=>d.id===selected);
  const correct = selected === c.disease.id;

  if(correct){
    // reward depends on treatment reward and how many tests used (fewer tests = bonus)
    const base = disease.treatment.reward;
    const testsUsed = Object.keys(c.testsRun).length;
    const efficiencyBonus = Math.max(0, Math.round((3 - testsUsed) * 5)); // prefer fewer tests
    const moneyEarned = base + efficiencyBonus;
    state.money += moneyEarned;
    state.reputation = Math.min(100, state.reputation + 5);
    DOM.feedback.className = 'feedback good';
    DOM.feedback.innerHTML = `<strong>Correct!</strong> Treatment: ${disease.treatment.name}. You earned $${moneyEarned} and +5 reputation.`;
    // Offer treatment options (simulate different choices)
    DOM.treatmentOptions.innerHTML = '';
    const treatBtn = document.createElement('button');
    treatBtn.textContent = `Provide treatment (${disease.treatment.name})`;
    treatBtn.addEventListener('click', ()=>{
      finishTreatment(true);
    });
    DOM.treatmentOptions.appendChild(treatBtn);
    log(`Diagnosed ${c.petName} with ${disease.name} (correct).`);
  } else {
    // penalty
    const penalty = 15;
    state.money = Math.max(0, state.money - penalty);
    state.reputation = Math.max(0, state.reputation - 8);
    DOM.feedback.className = 'feedback bad';
    const actual = c.disease.name;
    DOM.feedback.innerHTML = `<strong>Incorrect diagnosis.</strong> Actual: ${actual}. You lost $${penalty} and -8 reputation.`;
    // Allow to treat (but lesser reward)
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
}

function finishTreatment(correct) {
  const c = state.current;
  if(!c) return;
  if(correct){
    log(`Treatment given to ${c.petName}. Pet is recovering.`);
  } else {
    log(`Treatment given after incorrect diagnosis. Outcome mixed.`);
  }
  // Remove current patient and seed new
  state.current = null;
  // Occasionally generate random new customers
  state.waiting.push(generateCustomer());
  renderWaiting();
  renderCurrent();
}

function updateHUD() {
  DOM.money.textContent = `$${state.money}`;
  DOM.reputation.textContent = `Reputation: ${state.reputation}`;
}

function log(text) {
  const p = document.createElement('p');
  p.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
  DOM.logList.prepend(p);
}

// Utilities
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