const OBJETIVO_DIARIO = 11.2;

const TURNOS = {
  M: { cuenta: true },
  T: { cuenta: true },
  N: { cuenta: true },
  D: { cuenta: false },
  V: { cuenta: false }
};

function turnoCuenta(turno) {
  return TURNOS[turno]?.cuenta === true;
}

let currentDate = new Date();
let editingFecha = null;
let selectedTurno = '';

document.addEventListener('DOMContentLoaded', () => {
  initMonthNavigation();
  initEditor();
  initCycleSelector();
  initBackup();
  renderCalendar();
  loadCycleDates();
});

function initMonthNavigation() {
  document.getElementById('prevMonth')?.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
  });
  document.getElementById('nextMonth')?.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
  });
}

function renderCalendar() {
  const cal = document.getElementById('calendar');
  cal.innerHTML = '';
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  document.getElementById('monthLabel').textContent =
    currentDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();

  const firstDay = new Date(year, month, 1);
  let startWeekDay = firstDay.getDay();
  startWeekDay = startWeekDay === 0 ? 6 : startWeekDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  getAllDays().then(registros => {
    const map = {};
    registros.forEach(r => map[r.fecha] = r);

    for (let i = 0; i < startWeekDay; i++) {
      const empty = document.createElement('div');
      empty.className = 'day empty hidden-empty';
      cal.appendChild(empty);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const cell = document.createElement('div');
      cell.className = 'day';
      const fecha = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cell.dataset.fecha = fecha;
      cell.innerHTML = `<div class="day-number">${day}</div>`;

      const r = map[fecha];
      if (r && r.turno) {
        cell.classList.add(`turno-${r.turno}`);
        cell.innerHTML += `<div class="day-turno">${r.turno}</div>`;
        if (r.metros !== '' && r.metros !== null && r.metros !== undefined) {
          cell.innerHTML += `<div class="day-metros">${r.metros}</div>`;
        }
        if (r.manitou) cell.innerHTML += `<div class="day-manitou">MAN</div>`;
      }
      
      const today = new Date();
      if (year === today.getFullYear() && month === today.getMonth() && day === today.getDate()) cell.classList.add('today');
      cell.addEventListener('click', () => openEditor(fecha));
      cal.appendChild(cell);
    }
    renderResumenMensual(calcularResumenMensual(registros, year, month));
  });
}

function isSameMonth(dateStr, year, month) {
  const [y, m] = dateStr.split('-').map(Number);
  return y === year && m - 1 === month;
}

function calcularResumenMensual(registros, year, month) {
  let metros = 0;
  let diasManitou = 0;
  registros.forEach(r => {
    if (!isSameMonth(r.fecha, year, month)) return;
    if (r.manitou) diasManitou++;
    if (turnoCuenta(r.turno) && r.metros !== '' && r.metros !== null && r.metros !== undefined) {
      metros += Number(r.metros);
    }
  });
  return { metros, diasManitou };
}

function renderResumenMensual(resumen) {
  document.getElementById('monthTotal').textContent = `${resumen.metros.toFixed(1)} m`;
  const manitouEl = document.getElementById('monthManitou');
  if (resumen.diasManitou > 0) {
    manitouEl.textContent = `Manitou: ${resumen.diasManitou} día${resumen.diasManitou > 1 ? 's' : ''}`;
    manitouEl.style.display = 'block';
  } else {
    manitouEl.style.display = 'none';
  }
}

function initEditor() {
  const editor = document.getElementById('dayEditor');
  if (!editor) return;

  const editorDate = document.getElementById('editorDate');
  const editorMetros = document.getElementById('editorMetros');
  const editorManitou = document.getElementById('editorManitou');
  const turnoButtons = editor.querySelectorAll('.turno-buttons button');

  function updateActiveButton(turno) {
    selectedTurno = turno;
    turnoButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.turno === turno);
    });
  }

  turnoButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      updateActiveButton(btn.dataset.turno);
    });
  });

  document.getElementById('cancelDay')?.addEventListener('click', () => editor.classList.add('hidden'));
  
  document.getElementById('saveDay')?.addEventListener('click', () => {
    const rawMetros = editorMetros.value.trim().replace(',', '.');
    const metros = rawMetros === '' ? null : Number(rawMetros);

    saveDay({ 
      fecha: editingFecha, 
      turno: selectedTurno, 
      metros: isNaN(metros) ? null : metros, 
      manitou: editorManitou.checked 
    }).then(() => {
      editor.classList.add('hidden');
      renderCalendar();
      const start = document.getElementById('cycleStart').value;
      const end = document.getElementById('cycleEnd').value;
      if (start && end) calculateAndShowCycle(start, end);
    });
  });

  window.openEditor = function (fecha) {
    editingFecha = fecha;
    const d = new Date(fecha + 'T00:00:00');
    editorDate.textContent = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    
    selectedTurno = '';
    editorMetros.value = '';
    editorManitou.checked = false;

    getAllDays().then(registros => {
      const r = registros.find(x => x.fecha === fecha);
      if (r) {
        selectedTurno = r.turno ?? '';
        editorMetros.value = (r.metros !== null && r.metros !== undefined) ? r.metros : '';
        editorManitou.checked = r.manitou ?? false;
      }
      updateActiveButton(selectedTurno);
      editor.classList.remove('hidden');
    });
  };
}

function calculateAndShowCycle(start, end) {
  getAllDays().then(registros => {
    let metros = 0;
    let diasComputables = 0;
    let diasTrabajados = 0;
    
    const startDate = new Date(start + 'T00:00:00');
    const endDate = new Date(end + 'T00:00:00');

    registros.forEach(r => {
      if (r.fecha < start || r.fecha > end) return;
      
      if (turnoCuenta(r.turno)) {
        diasComputables++;
        
        if (r.metros !== '' && r.metros !== null && r.metros !== undefined) {
          diasTrabajados++;
          metros += Number(r.metros);
        }
      }
    });

    const objetivoTotal = diasComputables * OBJETIVO_DIARIO;
    const excedente = metros - objetivoTotal;

    const formatOpts = { day: 'numeric', month: 'long' };
    document.getElementById('cyclePeriod').textContent = `${startDate.toLocaleDateString('es-ES', formatOpts)} al ${endDate.toLocaleDateString('es-ES', formatOpts)}`;
    document.getElementById('cycleTotalDays').textContent = diasComputables;
    document.getElementById('cycleTarget').textContent = `${objetivoTotal.toFixed(1)} m`;
    document.getElementById('cycleTotal').textContent = `${metros.toFixed(1)} m`;
    document.getElementById('cycleDays').textContent = diasTrabajados;
    
    const excEl = document.getElementById('cycleExcess');
    excEl.className = '';
    excEl.classList.add(excedente > 0 ? 'excedente-pos' : excedente < 0 ? 'excedente-neg' : 'excedente-neu');
    excEl.textContent = `${excedente > 0 ? '+' : ''}${excedente.toFixed(1)} m`;
    
    document.getElementById('cycleResult').classList.remove('hidden');
  });
}

function initCycleSelector() {
  document.getElementById('openCycle')?.addEventListener('click', () => document.getElementById('cycleSelector').classList.remove('hidden'));
  document.getElementById('cancelCycle')?.addEventListener('click', () => document.getElementById('cycleSelector').classList.add('hidden'));
  document.getElementById('applyCycle')?.addEventListener('click', () => {
    const start = document.getElementById('cycleStart').value;
    const end = document.getElementById('cycleEnd').value;
    
    if (!start || !end) return alert('Selecciona ambas fechas');
    
    // VALIDACIÓN NUEVA: Comprobamos que el inicio no sea posterior al fin
    if (start > end) {
      return alert('La fecha de inicio no puede ser posterior a la fecha de fin.');
    }

    localStorage.setItem('cycleStart', start);
    localStorage.setItem('cycleEnd', end);
    calculateAndShowCycle(start, end);
    document.getElementById('cycleSelector').classList.add('hidden');
  });
}

function loadCycleDates() {
  const start = localStorage.getItem('cycleStart');
  const end = localStorage.getItem('cycleEnd');
  if (start && end) {
    document.getElementById('cycleStart').value = start;
    document.getElementById('cycleEnd').value = end;
    calculateAndShowCycle(start, end);
  }
}

function initBackup() {
  document.getElementById('exportBackup')?.addEventListener('click', () => {
    getAllDays().then(registros => {
      const blob = new Blob([JSON.stringify(registros)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
    });
  });
  document.getElementById('importBackup')?.addEventListener('click', () => document.getElementById('importFile').click());
  document.getElementById('importFile')?.addEventListener('change', (e) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const regs = JSON.parse(ev.target.result);
      Promise.all(regs.map(r => saveDay(r))).then(() => renderCalendar());
    };
    reader.readAsText(e.target.files[0]);
  });
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');