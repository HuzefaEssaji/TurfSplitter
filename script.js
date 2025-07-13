// script.js

// 1. Element references
const form               = document.getElementById('match-form');
const payerInput         = document.getElementById('payer');
const amountInput        = document.getElementById('amount');
const playersInput       = document.getElementById('players');
const tabsList           = document.getElementById('match-tabs');
const contentsDiv        = document.getElementById('match-contents');

const clubBtn            = document.getElementById('club-expenses-btn');
const clubModalEl        = document.getElementById('clubExpensesModal');
const clubModal          = new bootstrap.Modal(clubModalEl);
const matchCheckboxes    = document.getElementById('match-checkboxes');
const applyClubBtn       = document.getElementById('apply-club-expenses');
const resetClubBtn       = document.getElementById('reset-club-expenses');
const clubSummaryTbody   = document.querySelector('#club-summary-table tbody');

// 2. In-memory matches (ephemeral)
let matches = [];

// 3. Initial render
renderAll();

// 4. Add Match Handler
form.addEventListener('submit', e => {
  e.preventDefault();

  const payer   = payerInput.value.trim();
  const amount  = parseFloat(amountInput.value);
  const players = playersInput.value
    .split(',')
    .map(s => s.trim())
    .filter(s => s);

  if (!payer || isNaN(amount) || players.length === 0) return;

  matches.push({ payer, amount, players });
  payerInput.value = '';
  amountInput.value = '';
  playersInput.value = '';

  renderAll();
});

// 5. Compute balances for a given set of matches
function computeBalances(subMatches) {
  const balMap = {};

  subMatches.forEach(m => {
    const participants = [...m.players];
    if (!participants.includes(m.payer)) {
      participants.push(m.payer);
    }

    const share = m.amount / participants.length;
    participants.forEach(p => {
      balMap[p] = (balMap[p] || 0) - share;
    });

    balMap[m.payer] += m.amount;
  });

  return balMap;
}

// 6. Render tabs, panes, delete controls, and button states
function renderAll() {
  tabsList.innerHTML    = '';
  contentsDiv.innerHTML = '';

  // Disable Club Expenses if no matches
  clubBtn.disabled = matches.length < 2;

  matches.forEach((m, i) => {
    const isActive = i === 0 ? 'active' : '';
    const paneId   = `match-${i}`;

    // Tab with inline delete “×”
    tabsList.insertAdjacentHTML('beforeend', `
      <li class="nav-item" role="presentation">
        <button
          class="nav-link ${isActive} d-flex align-items-center"
          id="${paneId}-tab"
          data-bs-toggle="tab"
          data-bs-target="#${paneId}"
          type="button"
          role="tab"
        >
          <span>Match ${i + 1}</span>
          <button
            type="button"
            class="btn-close ms-2 delete-match"
            aria-label="Delete"
            data-index="${i}"
          ></button>
        </button>
      </li>
    `);

    // Pane content with delete button
    const balances = computeBalances([m]);
    const rows = Object.entries(balances)
      .sort((a, b) => b[1] - a[1])
      .map(([player, bal]) => `
        <tr>
          <td>${player}</td>
          <td>₹${bal.toFixed(2)}</td>
        </tr>
      `).join('');

    contentsDiv.insertAdjacentHTML('beforeend', `
      <div
        class="tab-pane fade ${isActive ? 'show active' : ''}"
        id="${paneId}"
        role="tabpanel"
      >
        <div class="d-flex justify-content-between align-items-center mb-2">
          <div>
            <strong>${m.payer}</strong> paid ₹${m.amount.toFixed(2)}
            &nbsp;|&nbsp; Players: ${m.players.join(', ')}
          </div>
          <button
            type="button"
            class="btn btn-sm btn-danger delete-match"
            data-index="${i}"
          >
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

  // Attach delete-match listeners
  document.querySelectorAll('.delete-match').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation(); // prevent tab switch
      const idx = parseInt(btn.dataset.index, 10);
      if (!isNaN(idx) && confirm(`Remove Match ${idx + 1}?`)) {
        matches.splice(idx, 1);
        renderAll();
      }
    });
  });
}

// 7. Club Expenses Modal: populate checkboxes on open
clubBtn.addEventListener('click', () => {
  matchCheckboxes.innerHTML = '';
  clubSummaryTbody.innerHTML = '';

  matches.forEach((m, i) => {
    matchCheckboxes.insertAdjacentHTML('beforeend', `
      <div class="form-check">
        <input
          class="form-check-input"
          type="checkbox"
          value="${i}"
          id="chk-${i}"
        >
        <label class="form-check-label" for="chk-${i}">
          Match ${i + 1}: ${m.payer} paid ₹${m.amount.toFixed(2)}
        </label>
      </div>
    `);
  });

  clubModal.show();
});

// 8. Reset Club Modal: clear all selections & summary
resetClubBtn.addEventListener('click', () => {
  matchCheckboxes
    .querySelectorAll('input[type=checkbox]')
    .forEach(cb => { cb.checked = false; });
  clubSummaryTbody.innerHTML = '';
});

// 9. Apply Club Expenses: summary with live Remaining updates
applyClubBtn.addEventListener('click', () => {
  const selectedIdx = Array.from(
    matchCheckboxes.querySelectorAll(
      'input[type=checkbox]:checked'
    )
  ).map(cb => parseInt(cb.value, 10));

  const selectedMatches = selectedIdx.map(i => matches[i]);
  const combined = computeBalances(selectedMatches);

  clubSummaryTbody.innerHTML = '';
  Object.entries(combined)
    // sort by descending absolute amount
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .forEach(([player, netBal]) => {
      const owedAbs       = Math.abs(netBal);
      const isCreditor    = netBal > 0;
      const paidDefault   = isCreditor ? owedAbs : 0;
      const inputDisabled = isCreditor;
      const remainingInit = isCreditor ? 0 : owedAbs;

      clubSummaryTbody.insertAdjacentHTML('beforeend', `
        <tr data-owed="${owedAbs.toFixed(2)}">
          <td>${player}</td>
          <td class="owed-cell">₹${owedAbs.toFixed(2)}</td>
          <td>
            <input
              type="number"
              class="form-control paid-input"
              value="${paidDefault.toFixed(2)}"
              ${inputDisabled ? 'disabled' : ''}
              min="0"
              step="0.01"
              style="width: 100px;"
            >
          </td>
          <td class="remaining-cell">₹${remainingInit.toFixed(2)}</td>
        </tr>
      `);
    });

  // Live‐update Remaining = owed − paid
  clubSummaryTbody
    .querySelectorAll('.paid-input:not([disabled])')
    .forEach(input => {
      input.addEventListener('input', () => {
        const tr   = input.closest('tr');
        const owed = parseFloat(tr.dataset.owed);
        const paid = parseFloat(input.value) || 0;
        const rem  = (owed - paid).toFixed(2);
        tr.querySelector('.remaining-cell').textContent = `₹${rem}`;
      });
    });
});
