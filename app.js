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

function formatDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

let currentDate = new Date();
let editingFecha = null;
let selectedTurno = '';

document.addEventListener('DOMContentLoaded', () => {
  initMonthNavigation();
  initEditor();
  initCycleSelector();
  initReportSelector();
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
  if (!cal) return;
  cal.innerHTML = '';
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthLabelEl = document.getElementById('monthLabel');
  if (monthLabelEl) {
    monthLabelEl.textContent = currentDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();
  }

  const firstDay = new Date(year, month, 1);
  let startWeekDay = firstDay.getDay();
  startWeekDay = startWeekDay === 0 ? 6 : startWeekDay - 1; // Ajuste para Lunes como primer día
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // 1. Celdas vacías de relleno al inicio del mes
  for (let i = 0; i < startWeekDay; i++) {
    const empty = document.createElement('div');
    empty.className = 'day empty hidden-empty';
    cal.appendChild(empty);
  }

  // 2. Pintar inmediatamente los días del mes (del 1 al 31) para que nunca se queden en blanco
  const dayCells = {};
  for (let day = 1; day <= daysInMonth; day++) {
    const cell = document.createElement('div');
    cell.className = 'day';
    const fecha = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    cell.dataset.fecha = fecha;
    cell.innerHTML = `<div class="day-number">${day}</div>`;

    const today = new Date();
    if (year === today.getFullYear() && month === today.getMonth() && day === today.getDate()) {
      cell.classList.add('today');
    }
    
    cell.addEventListener('click', () => openEditor(fecha));
    cal.appendChild(cell);
    dayCells[fecha] = cell;
  }
  
  // 3. Cargar los datos guardados y rellenar los turnos y métricas en sus celdas correspondientes
  getAllDays().then(registros => {
    if (registros && Array.isArray(registros)) {
      registros.forEach(r => {
        const cell = dayCells[r.fecha];
        if (cell && r.turno) {
          cell.classList.add(`turno-${r.turno}`);
          cell.innerHTML += `<div class="day-turno">${r.turno}</div>`;
          if (r.metros !== '' && r.metros !== null && r.metros !== undefined) {
            cell.innerHTML += `<div class="day-metros">${r.metros}</div>`;
          }
          
          let badgesHtml = '<div class="day-info-row">';
          if (r.manitou) badgesHtml += `<span class="day-manitou">MAN</span>`;
          if (r.extra) badgesHtml += `<span class="day-extra">EXT</span>`;
          if (r.sondas && r.sondas.length > 0) {
            r.sondas.forEach(sonda => {
              badgesHtml += `<span class="day-sonda">${sonda}</span>`;
            });
          }
          badgesHtml += '</div>';
          cell.innerHTML += badgesHtml;
        }
      });
      renderResumenMensual(calcularResumenMensual(registros, year, month));
    }
  }).catch(err => {
    console.error("Error al cargar los registros del calendario:", err);
  });
}

function isSameMonth(dateStr, year, month) {
  if (!dateStr) return false;
  const [y, m] = dateStr.split('-').map(Number);
  return y === year && m - 1 === month;
}

function calcularResumenMensual(registros, year, month) {
  let metros = 0;
  let diasManitou = 0;
  let diasExtra = 0;
  registros.forEach(r => {
    if (!isSameMonth(r.fecha, year, month)) return;
    if (r.manitou) diasManitou++;
    if (r.extra) diasExtra++;
    if (turnoCuenta(r.turno) && r.metros !== '' && r.metros !== null && r.metros !== undefined) {
      metros += Number(r.metros);
    }
  });
  return { metros, diasManitou, diasExtra };
}

function renderResumenMensual(resumen) {
  const monthTotalEl = document.getElementById('monthTotal');
  if (monthTotalEl) monthTotalEl.textContent = `${resumen.metros.toFixed(1)} m`;
  
  const manitouEl = document.getElementById('monthManitou');
  if (manitouEl) {
    if (resumen.diasManitou > 0) {
      manitouEl.textContent = `Manitou: ${resumen.diasManitou} día${resumen.diasManitou > 1 ? 's' : ''}`;
      manitouEl.style.display = 'block';
    } else {
      manitouEl.style.display = 'none';
    }
  }

  const extraEl = document.getElementById('monthExtra');
  if (extraEl) {
    if (resumen.diasExtra > 0) {
      extraEl.textContent = `Días extra: ${resumen.diasExtra}`;
      extraEl.style.display = 'block';
    } else {
      extraEl.style.display = 'none';
    }
  }
}

function initEditor() {
  const editor = document.getElementById('dayEditor');
  if (!editor) return;

  const editorDate = document.getElementById('editorDate');
  const editorMetros = document.getElementById('editorMetros');
  const editorManitou = document.getElementById('editorManitou');
  const editorExtra = document.getElementById('editorExtra');
  const sondaCheckboxes = editor.querySelectorAll('.editor-sonda');
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

    const selectedSondas = Array.from(sondaCheckboxes)
      .filter(cb => cb.checked)
      .map(cb => cb.value);

    saveDay({ 
      fecha: editingFecha, 
      turno: selectedTurno, 
      metros: isNaN(metros) ? null : metros, 
      manitou: editorManitou.checked,
      extra: editorExtra.checked,
      sondas: selectedSondas
    }).then(() => {
      editor.classList.add('hidden');
      renderCalendar();
      const start = document.getElementById('cycleStart')?.value;
      const end = document.getElementById('cycleEnd')?.value;
      if (start && end) calculateAndShowCycle(start, end);
    });
  });

  window.openEditor = function (fecha) {
    editingFecha = fecha;
    const d = new Date(fecha + 'T00:00:00');
    if (editorDate) {
      editorDate.textContent = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
    
    selectedTurno = '';
    if (editorMetros) editorMetros.value = '';
    if (editorManitou) editorManitou.checked = false;
    if (editorExtra) editorExtra.checked = false;
    sondaCheckboxes.forEach(cb => cb.checked = false);

    getAllDays().then(registros => {
      const r = registros.find(x => x.fecha === fecha);
      if (r) {
        selectedTurno = r.turno ?? '';
        if (editorMetros) editorMetros.value = (r.metros !== null && r.metros !== undefined) ? r.metros : '';
        if (editorManitou) editorManitou.checked = r.manitou ?? false;
        if (editorExtra) editorExtra.checked = r.extra ?? false;
        
        if (r.sondas && Array.isArray(r.sondas)) {
          sondaCheckboxes.forEach(cb => {
            cb.checked = r.sondas.includes(cb.value);
          });
        }
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
    const cyclePeriodEl = document.getElementById('cyclePeriod');
    if (cyclePeriodEl) cyclePeriodEl.textContent = `${startDate.toLocaleDateString('es-ES', formatOpts)} al ${endDate.toLocaleDateString('es-ES', formatOpts)}`;
    
    const cycleTotalDaysEl = document.getElementById('cycleTotalDays');
    if (cycleTotalDaysEl) cycleTotalDaysEl.textContent = diasComputables;
    
    const cycleTargetEl = document.getElementById('cycleTarget');
    if (cycleTargetEl) cycleTargetEl.textContent = `${objetivoTotal.toFixed(1)} m`;
    
    const cycleTotalEl = document.getElementById('cycleTotal');
    if (cycleTotalEl) cycleTotalEl.textContent = `${metros.toFixed(1)} m`;
    
    const cycleDaysEl = document.getElementById('cycleDays');
    if (cycleDaysEl) cycleDaysEl.textContent = diasTrabajados;
    
    const excEl = document.getElementById('cycleExcess');
    if (excEl) {
      excEl.className = '';
      excEl.classList.add(excedente > 0 ? 'excedente-pos' : excedente < 0 ? 'excedente-neg' : 'excedente-neu');
      excEl.textContent = `${excedente > 0 ? '+' : ''}${excedente.toFixed(1)} m`;
    }
    
    const cycleResultEl = document.getElementById('cycleResult');
    if (cycleResultEl) cycleResultEl.classList.remove('hidden');
  });
}

function initCycleSelector() {
  document.getElementById('openCycle')?.addEventListener('click', () => document.getElementById('cycleSelector')?.classList.remove('hidden'));
  document.getElementById('cancelCycle')?.addEventListener('click', () => document.getElementById('cycleSelector')?.classList.add('hidden'));
  document.getElementById('applyCycle')?.addEventListener('click', () => {
    const start = document.getElementById('cycleStart')?.value;
    const end = document.getElementById('cycleEnd')?.value;
    
    if (!start || !end) return alert('Selecciona ambas fechas');
    if (start > end) return alert('La fecha de inicio no puede ser posterior a la fecha de fin.');

    localStorage.setItem('cycleStart', start);
    localStorage.setItem('cycleEnd', end);
    calculateAndShowCycle(start, end);
    document.getElementById('cycleSelector')?.classList.add('hidden');
  });
}

function loadCycleDates() {
  const start = localStorage.getItem('cycleStart');
  const end = localStorage.getItem('cycleEnd');
  if (start && end) {
    const startInput = document.getElementById('cycleStart');
    const endInput = document.getElementById('cycleEnd');
    if (startInput) startInput.value = start;
    if (endInput) endInput.value = end;
    calculateAndShowCycle(start, end);
  }
}

function initReportSelector() {
  const reportModal = document.getElementById('reportSelector');
  
  document.getElementById('openReportModal')?.addEventListener('click', () => {
    reportModal?.classList.remove('hidden');
  });
  
  document.getElementById('cancelReport')?.addEventListener('click', () => {
    reportModal?.classList.add('hidden');
  });

  document.getElementById('generateReportBtn')?.addEventListener('click', () => {
    const startInput = document.getElementById('reportStart');
    const endInput = document.getElementById('reportEnd');

    if (!startInput || !endInput) {
      alert('No se encuentran los campos de fecha del informe.');
      return;
    }

    const start = startInput.value;
    const end = endInput.value;

    if (!start || !end) {
      alert('Por favor, selecciona ambas fechas (Desde y Hasta).');
      return;
    }

    if (start > end) {
      alert('La fecha de inicio no puede ser posterior a la fecha de fin.');
      return;
    }

    reportModal?.classList.add('hidden');

    getAllDays().then(registros => {
      // Filtramos solo los días dentro del rango y que sean días trabajados (turnoCuenta == true)
      const filtrados = (registros || [])
        .filter(r => r.fecha >= start && r.fecha <= end && turnoCuenta(r.turno))
        .sort((a, b) => a.fecha.localeCompare(b.fecha));

      if (filtrados.length === 0) {
        alert('No hay registros de días trabajados en el rango de fechas seleccionado.');
        return;
      }

      let totalMetros = 0;
      let totalDias = filtrados.length;
      let totalManitou = 0;
      let totalExtra = 0;

      let filasHtml = '';
      filtrados.forEach(r => {
        if (r.metros !== '' && r.metros !== null && r.metros !== undefined) {
          totalMetros += Number(r.metros);
        }
        if (r.manitou) totalManitou++;
        if (r.extra) totalExtra++;

        const sondasStr = r.sondas && r.sondas.length > 0 ? r.sondas.join(', ') : '—';
        const manitouStr = r.manitou ? 'Sí' : 'No';
        const extraStr = r.extra ? 'Sí' : 'No';
        const metrosStr = (r.metros !== '' && r.metros !== null && r.metros !== undefined) ? `${r.metros} m` : '—';

        filasHtml += `
          <tr>
            <td>${formatDate(r.fecha)}</td>
            <td><b>${r.turno}</b></td>
            <td>${metrosStr}</td>
            <td>${sondasStr}</td>
            <td>${manitouStr}</td>
            <td>${extraStr}</td>
          </tr>
        `;
      });

      let reportContainer = document.getElementById('dynamicReportModal');
      if (!reportContainer) {
        reportContainer = document.createElement('div');
        reportContainer.id = 'dynamicReportModal';
        reportContainer.style.cssText = `
          position: fixed; top: 0; left: 0; width: 100%; height: 100%;
          background: rgba(0,0,0,0.6); z-index: 9999; display: flex;
          justify-content: center; align-items: center; padding: 20px; box-sizing: border-box;
        `;
        document.body.appendChild(reportContainer);
      }

      const formattedStart = formatDate(start);
      const formattedEnd = formatDate(end);

      reportContainer.innerHTML = `
        <div style="background: white; width: 100%; max-width: 800px; max-height: 90vh; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
          <div style="padding: 16px 20px; background: #007aff; color: white; display: flex; justify-content: space-between; align-items: center;">
            <h3 style="margin: 0; font-size: 18px;">Informe de Producción (${formattedStart} al ${formattedEnd})</h3>
            <button id="closeDynamicReport" style="background: none; border: none; color: white; font-size: 20px; cursor: pointer;">✕</button>
          </div>
          <div style="padding: 20px; overflow-y: auto; flex: 1; font-family: -apple-system, Arial, sans-serif; color: #1c1c1e;">
            <div style="background: #f2f2f7; padding: 12px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-around; font-size: 14px;">
              <div><b>Días trabajados:</b> ${totalDias}</div>
              <div><b>Metros:</b> ${totalMetros.toFixed(1)} m</div>
              <div><b>Manitou:</b> ${totalManitou}</div>
              <div><b>Extra:</b> ${totalExtra}</div>
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <thead>
                <tr style="background: #007aff; color: white;">
                  <th style="border: 1px solid #c6c6c8; padding: 8px 12px; text-align: left;">Fecha</th>
                  <th style="border: 1px solid #c6c6c8; padding: 8px 12px; text-align: left;">Turno</th>
                  <th style="border: 1px solid #c6c6c8; padding: 8px 12px; text-align: left;">Metros</th>
                  <th style="border: 1px solid #c6c6c8; padding: 8px 12px; text-align: left;">Sondas / Máquina</th>
                  <th style="border: 1px solid #c6c6c8; padding: 8px 12px; text-align: left;">Manitou</th>
                  <th style="border: 1px solid #c6c6c8; padding: 8px 12px; text-align: left;">Extra</th>
                </tr>
              </thead>
              <tbody>
                ${filasHtml}
              </tbody>
            </table>
          </div>
          <div style="padding: 12px 20px; background: #f9f9fbfb; border-top: 1px solid #c6c6c8; display: flex; justify-content: flex-end; gap: 10px;">
            <button id="printDynamicReport" style="background: #007aff; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 500;">Imprimir / Guardar PDF</button>
            <button id="cancelDynamicReport" style="background: #e5e5ea; color: #1c1c1e; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;">Cerrar</button>
          </div>
        </div>
      `;

      document.getElementById('closeDynamicReport').onclick = () => reportContainer.remove();
      document.getElementById('cancelDynamicReport').onclick = () => reportContainer.remove();
      document.getElementById('printDynamicReport').onclick = () => window.print();
    }).catch(err => {
      console.error('Error al generar el informe:', err);
      alert('Hubo un error al leer los datos para el informe.');
    });
  });
}

function initBackup() {
  document.getElementById('exportBackup')?.addEventListener('click', () => {
    getAllDays().then(registros => {
      const blob = new Blob([JSON.stringify(registros || [])], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
    });
  });
  document.getElementById('importBackup')?.addEventListener('click', () => document.getElementById('importFile')?.click());
  document.getElementById('importFile')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const regs = JSON.parse(ev.target.result);
        if (Array.isArray(regs)) {
          Promise.all(regs.map(r => saveDay(r))).then(() => renderCalendar());
        }
      } catch (err) {
        alert('Archivo de respaldo inválido');
      }
    };
    reader.readAsText(file);
  });
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
