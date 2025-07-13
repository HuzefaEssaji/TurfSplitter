// 1. Welcome Modal Logic
const welcomeModalEl = document.getElementById('welcomeModal');
const welcomeModal   = new bootstrap.Modal(welcomeModalEl, {
  backdrop: 'static', keyboard: false
});
let welcomeTimer;

// Show on load, auto-hide after 20s
window.addEventListener('load', () => {
  welcomeModal.show();
  welcomeTimer = setTimeout(() => welcomeModal.hide(), 20000);
});

// Understood button clears timer and hides modal
document.getElementById('understood-btn')
  .addEventListener('click', () => {
    clearTimeout(welcomeTimer);
    welcomeModal.hide();
  });


// 2. Element references for main app
const form             = document.getElementById('match-form');
const payerInput       = document.getElementById('payer');
const amountInput      = document.getElementById('amount');
const playersInput     = document.getElementById('players');
const tabsList         = document.getElementById('match-tabs');
const contentsDiv      = document.getElementById('match-contents');

const clubBtn          = document.getElementById('club-expenses-btn');
const clubModalEl      = document.getElementById('clubExpensesModal');
const clubModal        = new bootstrap.Modal(clubModalEl);
const matchCheckboxes  = document.getElementById('match-checkboxes');
const applyClubBtn     = document.getElementById('apply-club-expenses');
const resetClubBtn     = document.getElementById('reset-club-expenses');
const clubSummaryTbody = document.querySelector('#club-summary-table tbody');

let matches = [];  // in-memory only

// Initial render
renderAll();

// Add match
form.addEventListener('submit', e => {
  e.preventDefault();
  const payer   = payerInput.value.trim();
  const amount  = parseFloat(amountInput.value);
  const players = playersInput.value
    .split(',').map(s => s.trim()).filter(s => s);

  if (!payer || isNaN(amount) || !players.length) return;

  matches.push({ payer, amount, players });
  payerInput.value = '';
  amountInput.value = '';
  playersInput.value = '';
  renderAll();
});

// Compute balances
function computeBalances(subMatches) {
  const balMap = {};
  subMatches.forEach(m => {
    const participants = [...m.players];
    if (!participants.includes(m.payer)) participants.push(m.payer);
    const share = m.amount / participants.length;
    participants.forEach(p => {
      balMap[p] = (balMap[p] || 0) - share;
    });
    balMap[m.payer] += m.amount;
  });
  return balMap;
}

// Render tabs + panes + delete
function renderAll() {
  tabsList.innerHTML = '';
  contentsDiv.innerHTML = '';
  clubBtn.disabled = matches.length < 2;

  matches.forEach((m, i) => {
    const active = i === 0 ? 'active' : '';
    const paneId = `match-${i}`;

    // Tab w/ delete “×”
    tabsList.insertAdjacentHTML('beforeend', `
      <li class="nav-item">
        <button
          class="nav-link ${active} d-flex align-items-center"
          id="${paneId}-tab"
          data-bs-toggle="tab"
          data-bs-target="#${paneId}"
          type="button"
        >
          <span>Match ${i+1}</span>
          <button
            type="button"
            class="btn-close ms-2 delete-match"
            aria-label="Delete"
            data-index="${i}"
          ></button>
        </button>
      </li>
    `);

    // Pane content
    const balances = computeBalances([m]);
    const rows = Object.entries(balances)
      .sort((a,b)=>b[1]-a[1])
      .map(([p,b]) => `
        <tr><td>${p}</td><td>₹${b.toFixed(2)}</td></tr>
      `).join('');

    contentsDiv.insertAdjacentHTML('beforeend', `
      <div class="tab-pane fade ${active?'show active':''}" id="${paneId}">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <div><strong>${m.payer}</strong> paid ₹${m.amount.toFixed(2)}
            | Players: ${m.players.join(', ')}
          </div>
          <button type="button" class="btn btn-sm btn-danger delete-match"
            data-index="${i}">
            Delete Match
          </button>
        </div>
        <table class="table table-sm">
          <thead><tr><th>Player</th><th>Balance</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `);
  });

  // Wire up deletes
  document.querySelectorAll('.delete-match').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const idx = +btn.dataset.index;
      if (confirm(`Remove Match ${idx+1}?`)) {
        matches.splice(idx,1);
        renderAll();
      }
    });
  });
}

// Club modal: show match list
clubBtn.addEventListener('click', () => {
  matchCheckboxes.innerHTML = '';
  clubSummaryTbody.innerHTML = '';
  matches.forEach((m,i) => {
    matchCheckboxes.insertAdjacentHTML('beforeend', `
      <div class="form-check">
        <input class="form-check-input" type="checkbox" id="chk-${i}" value="${i}">
        <label class="form-check-label" for="chk-${i}">
          Match ${i+1}: ${m.payer} paid ₹${m.amount.toFixed(2)}
        </label>
      </div>
    `);
  });
  clubModal.show();
});

// Reset club modal
resetClubBtn.addEventListener('click', () => {
  matchCheckboxes.querySelectorAll('input').forEach(cb => cb.checked=false);
  clubSummaryTbody.innerHTML = '';
});

// Apply club modal
applyClubBtn.addEventListener('click', () => {
  const idxs = Array.from(
    matchCheckboxes.querySelectorAll('input:checked')
  ).map(cb=>+cb.value);
  const combined = computeBalances(idxs.map(i=>matches[i]));

  clubSummaryTbody.innerHTML = '';
  Object.entries(combined)
    .sort((a,b)=>Math.abs(b[1])-Math.abs(a[1]))
    .forEach(([player,net]) => {
      const owed = Math.abs(net);
      const isCred = net>0;
      const paid0 = isCred?owed:0;
      const rem0  = isCred?0:owed;

      clubSummaryTbody.insertAdjacentHTML('beforeend', `
        <tr data-owed="${owed}">
          <td>${player}</td>
          <td>₹${owed.toFixed(2)}</td>
          <td>
            <input
              type="number"
              class="form-control paid-input"
              value="${paid0.toFixed(2)}"
              ${isCred?'disabled':''}
              min="0" step="0.01"
              style="width:100px"
            >
          </td>
          <td class="remaining-cell">₹${rem0.toFixed(2)}</td>
        </tr>
      `);
    });

  // live update
  clubSummaryTbody.querySelectorAll('.paid-input:not([disabled])')
    .forEach(input=>{
      input.addEventListener('input', ()=> {
        const tr = input.closest('tr');
        const owed = +tr.dataset.owed;
        const paid = +input.value||0;
        tr.querySelector('.remaining-cell')
          .textContent = `₹${(owed-paid).toFixed(2)}`;
      });
    });
});
