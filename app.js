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

document.addEventListener('DOMContentLoaded', () => {
  initMonthNavigation();
  initEditor();
  initCycleSelector();
  renderCalendar();
});

/* =======================
   NAVEGACIÓN MESES
======================= */

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

/* =======================
   CALENDARIO
======================= */

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
      empty.className = 'day empty';
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
          cell.innerHTML += `<div class="day-metros">${r.metros} m</div>`;
        }
      }

      const today = new Date();

      if (
        year === today.getFullYear() &&
        month === today.getMonth() &&
        day === today.getDate()
      ) {
        cell.classList.add('today');
      }

      cell.addEventListener('click', () => openEditor(fecha));
      cal.appendChild(cell);
    }

    const resumen = calcularResumenMensual(registros, year, month);
    renderResumenMensual(resumen);
  });
}

/* =======================
   CÁLCULOS MENSUALES
======================= */

function isSameMonth(dateStr, year, month) {
  const [y, m] = dateStr.split('-').map(Number);
  return y === year && m - 1 === month;
}

function calcularResumenMensual(registros, year, month) {
  let metros = 0;
  let diasTrabajados = 0;

  registros.forEach(r => {
    if (
      isSameMonth(r.fecha, year, month) &&
      turnoCuenta(r.turno) &&
      r.metros !== '' &&
      r.metros !== null
    ) {
      diasTrabajados++;
      metros += Number(r.metros);
    }
  });

  return {
    metros,
    excedente: metros - diasTrabajados * OBJETIVO_DIARIO
  };
}

function renderResumenMensual(resumen) {
  const totalEl = document.getElementById('monthTotal');
  const excEl = document.getElementById('monthExcess');

  totalEl.textContent = `${resumen.metros.toFixed(1)} m`;

  excEl.className = 'summary-excess';
  if (resumen.excedente > 0) {
    excEl.classList.add('excedente-pos');
    excEl.textContent = `+${resumen.excedente.toFixed(1)} m`;
  } else if (resumen.excedente < 0) {
    excEl.classList.add('excedente-neg');
    excEl.textContent = `${resumen.excedente.toFixed(1)} m`;
  } else {
    excEl.classList.add('excedente-neu');
    excEl.textContent = `0.0 m`;
  }
}

/* =======================
   EDITOR DE DÍA
======================= */

function initEditor() {
  const editor = document.getElementById('dayEditor');
  if (!editor) return;

  const editorDate = document.getElementById('editorDate');
  const editorTurno = document.getElementById('editorTurno');
  const editorMetros = document.getElementById('editorMetros');
  const turnoButtons = editor.querySelectorAll('.turno-buttons button');

  function updateMetrosState() {
    if (editorTurno.value === '') {
      editorMetros.value = '';
      editorMetros.disabled = true;
    } else {
      editorMetros.disabled = false;
    }
  }

  function updateActiveButton(turno) {
    turnoButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.turno === turno);
    });
  }

  // Click en botones de turno
  turnoButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const turno = btn.dataset.turno;
      editorTurno.value = turno;
      updateActiveButton(turno);
      updateMetrosState();
    });
  });

  // Cambio manual del select (fallback)
  editorTurno.addEventListener('change', () => {
    updateActiveButton(editorTurno.value);
    updateMetrosState();
  });

  document.getElementById('cancelDay')?.addEventListener('click', () => {
    editor.classList.add('hidden');
  });

  document.getElementById('saveDay')?.addEventListener('click', () => {
    saveDay({
      fecha: editingFecha,
      turno: editorTurno.value,
      metros: editorMetros.value.trim()
    }).then(() => {
      editor.classList.add('hidden');
      renderCalendar();
    });
  });

  window.openEditor = function (fecha) {
    editingFecha = fecha;
    editorDate.textContent = fecha;
    editorTurno.value = '';
    editorMetros.value = '';

    getAllDays().then(registros => {
      const r = registros.find(x => x.fecha === fecha);
      if (r) {
        editorTurno.value = r.turno ?? '';
        editorMetros.value = r.metros ?? '';
      }
      updateActiveButton(editorTurno.value);
      updateMetrosState();
    });

    editor.classList.remove('hidden');
  };
}

/* =======================
   CÁLCULO DE CICLO
======================= */

function calcularResumenCiclo(registros, inicio, fin) {
  let metros = 0;
  let dias = 0;

  registros.forEach(r => {
    if (
      r.fecha >= inicio &&
      r.fecha <= fin &&
      turnoCuenta(r.turno) &&
      r.metros !== '' &&
      r.metros !== null
    ) {
      dias++;
      metros += Number(r.metros);
    }
  });

  const objetivo = dias * OBJETIVO_DIARIO;

  return {
    metros,
    dias,
    objetivo,
    excedente: metros - objetivo
  };
}

/* =======================
   SELECTOR DE CICLO
======================= */

function initCycleSelector() {
  const openBtn = document.getElementById('openCycle');
  const modal = document.getElementById('cycleSelector');
  const startInput = document.getElementById('cycleStart');
  const endInput = document.getElementById('cycleEnd');

  if (!openBtn || !modal) return;

  openBtn.addEventListener('click', () => {
    modal.classList.remove('hidden');
  });

  document.getElementById('cancelCycle')?.addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  document.getElementById('applyCycle')?.addEventListener('click', () => {
    const start = startInput.value;
    const end = endInput.value;

    if (!start || !end) {
      alert('Selecciona ambas fechas');
      return;
    }

    if (start > end) {
      alert('La fecha inicial no puede ser posterior a la final');
      return;
    }

    getAllDays().then(registros => {
      const resumen = calcularResumenCiclo(registros, start, end);

      const box = document.getElementById('cycleResult');
      const totalEl = document.getElementById('cycleTotal');
      const daysEl = document.getElementById('cycleDays');
      const targetEl = document.getElementById('cycleTarget');
      const excEl = document.getElementById('cycleExcess');

      totalEl.textContent = `${resumen.metros.toFixed(1)} m`;
      daysEl.textContent = resumen.dias;
      targetEl.textContent = `${resumen.objetivo.toFixed(1)} m`;

      excEl.className = '';
      if (resumen.excedente > 0) {
        excEl.classList.add('excedente-pos');
        excEl.textContent = `+${resumen.excedente.toFixed(1)} m`;
      } else if (resumen.excedente < 0) {
        excEl.classList.add('excedente-neg');
        excEl.textContent = `${resumen.excedente.toFixed(1)} m`;
      } else {
        excEl.textContent = `0.0 m`;
      }

      box.classList.remove('hidden');
      modal.classList.add('hidden');
    });
  });
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}

