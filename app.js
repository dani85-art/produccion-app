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
let selectedTurno = ''; // Variable para almacenar el turno seleccionado en el modal

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
        if (r.metros !== '' && r.metros !== null) {
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
  let diasTrabajados = 0;
  let diasManitou = 0;
  registros.forEach(r => {
    if (!isSameMonth(r.fecha, year, month)) return;
    if (r.manitou) diasManitou++;
    if (turnoCuenta(r.turno) && r.metros !== '' && r.metros !== null) {
      diasTrabajados++;
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
    saveDay({ 
      fecha: editingFecha, 
      turno: selectedTurno, 
      metros: editorMetros.value.trim(), 
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
        editorMetros.value = r.metros ?? '';
        editorManitou.checked = r.manitou ?? false;
      }
      updateActiveButton(selectedTurno);
      editor.classList.remove('hidden');
    });
  };
}

function calculateAndShowCycle(start, end) {
  getAllDays().then(registros => {
    let metros = 0, diasTrabajados = 0;
    
    // Convertimos las fechas para cálculo
    const startDate = new Date(start + 'T00:00:00');
    const endDate = new Date(end + 'T00:00:00');
    
    // Calcular días totales del ciclo (incluyendo inicio y fin)
    const diffTime = Math.abs(endDate - startDate);
    const diasTotales = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    registros.forEach(r => {
      if (r.fecha < start || r.fecha > end) return;
      if (turnoCuenta(r.turno) && r.metros !== '' && r.metros !== null) {
        diasTrabajados++;
        metros += Number(r.metros);
      }
    });

    const objetivoTotal = diasTotales * OBJETIVO_DIARIO;
    const excedente = metros - objetivoTotal;

    // Formateo de fechas con meses enteros
    const formatOpts = { day: 'numeric', month: 'long' };
    const inicioStr = startDate.toLocaleDateString('es-ES', formatOpts);
    const finStr = endDate.toLocaleDateString('es-ES', formatOpts);

    // Actualización del DOM
    // Nota: Asegúrate de que tu HTML tenga estos IDs o similares
    document.getElementById('cycleTotal').textContent = `${metros.toFixed(1)} m`;
    
    document.getElementById('cycleResult').innerHTML = `
      <div class="fila-dato"><span>Periodo del ciclo:</span> <strong>${inicioStr} al ${finStr}</strong></div>
      <div class="fila-dato"><span>Días totales del ciclo:</span> <strong>${diasTotales}</strong></div>
      <div class="fila-dato"><span>Objetivo total del ciclo:</span> <strong>${objetivoTotal.toFixed(1)} m</strong></div>
      <div class="fila-dato"><span>Metros realizados:</span> <strong>${metros.toFixed(1)} m</strong></div>
      <div class="fila-dato"><span>Días trabajados:</span> <strong>${diasTrabajados}</strong></div>
      <div class="fila-dato"><span>Excedente:</span> <strong>${excedente > 0 ? '+' : ''}${excedente.toFixed(1)} m</strong></div>
    `;

    document.getElementById('cycleResult').classList.remove('hidden');
  });
}

function initCycleSelector() {
  document.getElementById('openCycle')?.addEventListener('click', () => document.getElementById('cycleSelector').classList.remove('hidden'));
  document.getElementById('cancelCycle')?.addEventListener('click', () => document.getElementById('cycleSelector').classList.add('hidden'));
  document.getElementById('applyCycle')?.addEventListener('click', () => {
    const start = document.getElementById('cycleStart').value;
    const end = document.getElementById('cycleEnd').value;
    if (!start || !end) return alert('Selecciona fechas');
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

function initSwipeGestures() {
  let touchStartX = 0;
  const cal = document.getElementById('calendar');

  cal.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, false);
  
  cal.addEventListener('touchend', e => {
    let touchEndX = e.changedTouches[0].screenX;
    if (touchEndX < touchStartX - 50) { // Desliza a la izquierda (avanza mes)
      currentDate.setMonth(currentDate.getMonth() + 1);
      renderCalendar();
    } else if (touchEndX > touchStartX + 50) { // Desliza a la derecha (retrocede mes)
      currentDate.setMonth(currentDate.getMonth() - 1);
      renderCalendar();
    }
  }, false);
}

// Llama a esta función dentro de tu DOMContentLoaded en app.js
document.addEventListener('DOMContentLoaded', () => {
  // ... resto de tus funciones
  initSwipeGestures(); 
});
