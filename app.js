const OBJETIVO_DIARIO = 11.2;

function diaCuentaParaCiclo(r) {
  const trasladosCuentan = localStorage.getItem('settingTrasladoCuenta') === 'true';
  const diasExtraNoCuentan = localStorage.getItem('settingDiasExtraNoCuenta') === 'true';

  const esDiaExtra = r.extra === true || r.etiquetas?.includes('EXT');
  if (diasExtraNoCuentan && esDiaExtra) {
    return false;
  }

  if (r.traslado) {
    return trasladosCuentan;
  }

  const TURNOS = {
    M: { cuenta: true },
    T: { cuenta: true },
    N: { cuenta: true },
    D: { cuenta: false },
    V: { cuenta: false }
  };

  return TURNOS[r.turno]?.cuenta === true;
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
  initSettingsModal();
  initExportReportModal();
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
    let textoMes = currentDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();
    monthLabelEl.textContent = textoMes.replace(' DE ', ' ');
  }

  const firstDay = new Date(year, month, 1);
  let startWeekDay = firstDay.getDay();
  startWeekDay = startWeekDay === 0 ? 6 : startWeekDay - 1; 
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < startWeekDay; i++) {
    const empty = document.createElement('div');
    empty.className = 'day empty hidden-empty';
    cal.appendChild(empty);
  }

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
  
  const activarSondas = localStorage.getItem('settingActivarSondas') === 'true';

  getAllDays().then(registros => {
    if (registros && Array.isArray(registros)) {
      registros.forEach(r => {
        const cell = dayCells[r.fecha];
        if (cell) {
          if (r.turno) {
            cell.classList.add(`turno-${r.turno}`);
            cell.innerHTML += `<div class="day-turno">${r.turno}</div>`;
          }
          if (r.metros !== '' && r.metros !== null && r.metros !== undefined) {
            cell.innerHTML += `<div class="day-metros">${r.metros}</div>`;
          }
          
          let badgesHtml = '<div class="day-info-row">';
          if (r.manitou) badgesHtml += `<span class="day-manitou">MAN</span>`;
          if (r.extra) badgesHtml += `<span class="day-extra">EXT</span>`;
          if (r.traslado) badgesHtml += `<span class="day-traslado">Trasl</span>`;
          
          if (activarSondas && r.sondas && Array.isArray(r.sondas)) {
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
    
    const diasExtraNoCuentan = localStorage.getItem('settingDiasExtraNoCuenta') === 'true';
    const esDiaExtra = r.extra === true || r.etiquetas?.includes('EXT');
    if (diasExtraNoCuentan && esDiaExtra) return;
    
    const cuentaMensual = r.traslado ? (localStorage.getItem('settingTrasladoCuenta') === 'true') : (r.turno === 'M' || r.turno === 'T' || r.turno === 'N');
    
    if (cuentaMensual && r.metros !== '' && r.metros !== null && r.metros !== undefined) {
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
  const editorTraslado = document.getElementById('editorTraslado');
  const sondasContainer = document.getElementById('editorSondasContainer');
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

    const activarSondas = localStorage.getItem('settingActivarSondas') === 'true';
    const selectedDaySondas = activarSondas ? Array.from(sondaCheckboxes)
      .filter(cb => cb.checked)
      .map(cb => cb.value) : [];

    saveDay({ 
      fecha: editingFecha, 
      turno: selectedTurno, 
      metros: isNaN(metros) ? null : metros, 
      manitou: editorManitou.checked,
      extra: editorExtra.checked,
      traslado: editorTraslado.checked,
      sondas: selectedDaySondas
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
    if (editorTraslado) editorTraslado.checked = false;
    sondaCheckboxes.forEach(cb => cb.checked = false);

    const activarSondas = localStorage.getItem('settingActivarSondas') === 'true';
    if (sondasContainer) {
      sondasContainer.style.display = activarSondas ? 'block' : 'none';
    }

    getAllDays().then(registros => {
      const r = registros.find(x => x.fecha === fecha);
      if (r) {
        selectedTurno = r.turno ?? '';
        if (editorMetros) editorMetros.value = (r.metros !== null && r.metros !== undefined) ? r.metros : '';
        if (editorManitou) editorManitou.checked = r.manitou ?? false;
        if (editorExtra) editorExtra.checked = r.extra ?? false;
        if (editorTraslado) editorTraslado.checked = r.traslado ?? false;
        
        if (activarSondas && r.sondas && Array.isArray(r.sondas)) {
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
    let diasTrasladoCiclo = 0;
    
    const diasExtraNoCuentan = localStorage.getItem('settingDiasExtraNoCuenta') === 'true';
    const trasladoCuenta = localStorage.getItem('settingTrasladoCuenta') === 'true';

    registros.forEach(r => {
      if (r.fecha < start || r.fecha > end) return;
      
      const esDiaExtra = r.extra === true || r.etiquetas?.includes('EXT');

      if (diasExtraNoCuentan && esDiaExtra) {
        return;
      }

      if (r.traslado) {
        diasTrasladoCiclo++;
      }
      
      if (diaCuentaParaCiclo(r)) {
        diasComputables++;
        
        if (r.metros !== '' && r.metros !== null && r.metros !== undefined) {
          metros += Number(r.metros);
        }
      }

      const tieneMetros = r.metros !== '' && r.metros !== null && r.metros !== undefined;
      const esDiaTrabajadoNormal = diaCuentaParaCiclo(r) && tieneMetros;
      const esTraslado = r.traslado;

      if (esDiaTrabajadoNormal || esTraslado) {
        diasTrabajados++;
      }
    });

    const objetivoTotal = diasComputables * OBJETIVO_DIARIO;
    const excedente = metros - objetivoTotal;

    const formatOpts = { day: 'numeric', month: 'short' };
    const formatearFechaCapitalizada = (fechaStr) => {
      const fechaObj = new Date(fechaStr + 'T00:00:00');
      let texto = fechaObj.toLocaleDateString('es-ES', formatOpts);
      return texto.replace(/^([0-9]+\s+)([a-z])/, (_, prefix, char) => prefix + char.toUpperCase());
    };

    const cyclePeriodEl = document.getElementById('cyclePeriod');
    if (cyclePeriodEl) {
      cyclePeriodEl.textContent = `${formatearFechaCapitalizada(start)} al ${formatearFechaCapitalizada(end)}`;
    }
  
    const cycleTotalDaysEl = document.getElementById('cycleTotalDays');
    if (cycleTotalDaysEl) cycleTotalDaysEl.textContent = diasComputables;

    const cycleTrasladoRowEl = document.getElementById('cycleTrasladoRow');
    const cycleTrasladoDaysEl = document.getElementById('cycleTrasladoDays');
    if (cycleTrasladoRowEl && cycleTrasladoDaysEl) {
      if (!trasladoCuenta && diasTrasladoCiclo > 0) {
        cycleTrasladoDaysEl.textContent = diasTrasladoCiclo;
        cycleTrasladoRowEl.style.display = 'flex';
      } else {
        cycleTrasladoRowEl.style.display = 'none';
      }
    }
    
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

function exportCycleReport(start, end) {
  if (!start || !end) {
    alert('Por favor, selecciona un periodo válido.');
    return;
  }

  getAllDays().then(registros => {
    const cycleDays = registros.filter(r => {
      if (r.fecha < start || r.fecha > end) return false;
      if (r.turno === 'D') return false;
      
      const tieneTurno = r.turno && r.turno.trim() !== '';
      const tieneMetros = r.metros !== null && r.metros !== undefined && r.metros !== '';
      const tieneExtras = r.manitou || r.traslado || r.extra;
      const tieneSondas = r.sondas && r.sondas.length > 0;

      return tieneTurno || tieneMetros || tieneExtras || tieneSondas;
    });

    cycleDays.sort((a, b) => a.fecha.localeCompare(b.fecha));

    if (cycleDays.length === 0) {
      alert('No hay registros válidos en el periodo seleccionado.');
      return;
    }

    const activarSondas = localStorage.getItem('settingActivarSondas') === 'true';

    let sumaMetrosTotales = 0;
    let totalManitou = 0;
    let totalTraslado = 0;

    let content = `INFORME DE CICLO\n`;
    content += `Periodo: ${formatDate(start)} al ${formatDate(end)}\n`;
    content += `=========================================\n\n`;

    if (activarSondas) {
      content += `FECHA      TURNO METROS SONDAS   MAN TRAS\n`;
      content += `-----------------------------------------\n`;
    } else {
      content += `FECHA      TURNO METROS MAN TRAS\n`;
      content += `---------------------------------\n`;
    }

    cycleDays.forEach(r => {
      const fecha = formatDate(r.fecha); 
      const turno = (r.turno ? r.turno : '').padEnd(5, ' ');
      
      const numMetros = (r.metros !== null && r.metros !== undefined && r.metros !== '') ? Number(r.metros) : 0;
      sumaMetrosTotales += numMetros;
      const metrosVal = (r.metros !== null && r.metros !== undefined && r.metros !== '') ? `${r.metros}m` : '';
      const metros = metrosVal.padEnd(7, ' ');

      const manStr = r.manitou ? 'SÍ ' : '   ';
      const trasStr = r.traslado ? 'SÍ' : '  ';
      
      if (r.manitou) totalManitou += 1;
      if (r.traslado) totalTraslado += 1;

      if (activarSondas) {
        const sondasStr = (r.sondas && r.sondas.length > 0) ? r.sondas.join(', ') : '';
        const sondasCol = sondasStr.padEnd(10, ' ');
        content += `${fecha}  ${turno} ${metros} ${sondasCol}  ${manStr} ${trasStr}\n`;
      } else {
        content += `${fecha}  ${turno} ${metros}  ${manStr} ${trasStr}\n`;
      }
    });

    content += `-----------------------------------------\n`;
    content += `TOTAL METROS REALIZADOS: ${sumaMetrosTotales.toFixed(1)} m\n`;

    if (totalManitou > 0) {
      content += `TOTAL MANITOU: ${totalManitou} ${totalManitou === 1 ? 'día' : 'días'}\n`;
    }
    if (totalTraslado > 0) {
      content += `TOTAL TRASLADO: ${totalTraslado} ${totalTraslado === 1 ? 'día' : 'días'}\n`;
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `informe-ciclo-${formatDate(start).replace(/\//g, '-')}-al-${formatDate(end).replace(/\//g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
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

function initExportReportModal() {
  const modal = document.getElementById('exportReportModal');
  const reportStart = document.getElementById('reportStart');
  const reportEnd = document.getElementById('reportEnd');

  document.getElementById('openExportModal')?.addEventListener('click', () => {
    const start = localStorage.getItem('cycleStart') || new Date().toISOString().slice(0,10);
    const end = localStorage.getItem('cycleEnd') || new Date().toISOString().slice(0,10);
    
    if (reportStart) reportStart.value = start;
    if (reportEnd) reportEnd.value = end;

    document.getElementById('settingsModal')?.classList.add('hidden');
    modal?.classList.remove('hidden');
  });

  document.getElementById('cancelExportReport')?.addEventListener('click', () => {
    modal?.classList.add('hidden');
  });

  document.getElementById('confirmExportReport')?.addEventListener('click', () => {
    const start = reportStart?.value;
    const end = reportEnd?.value;

    if (!start || !end) {
      alert('Selecciona ambas fechas');
      return;
    }
    if (start > end) {
      alert('La fecha de inicio no puede ser posterior a la fecha de fin.');
      return;
    }

    exportCycleReport(start, end);
    modal?.classList.add('hidden');
  });
}

function initSettingsModal() {
  const modal = document.getElementById('settingsModal');
  const trasladoCheckbox = document.getElementById('settingTrasladoCuenta');
  const activarSondasCheckbox = document.getElementById('settingActivarSondas');
  const diasExtraNoCuentaCheckbox = document.getElementById('settingDiasExtraNoCuenta');

  document.getElementById('openSettings')?.addEventListener('click', () => {
    if (trasladoCheckbox) {
      trasladoCheckbox.checked = localStorage.getItem('settingTrasladoCuenta') === 'true';
    }
    if (activarSondasCheckbox) {
      activarSondasCheckbox.checked = localStorage.getItem('settingActivarSondas') === 'true';
    }
    if (diasExtraNoCuentaCheckbox) {
      diasExtraNoCuentaCheckbox.checked = localStorage.getItem('settingDiasExtraNoCuenta') === 'true';
    }
    modal?.classList.remove('hidden');
  });

  document.getElementById('cancelSettings')?.addEventListener('click', () => {
    modal?.classList.add('hidden');
  });

  document.getElementById('saveSettings')?.addEventListener('click', () => {
    if (trasladoCheckbox) {
      localStorage.setItem('settingTrasladoCuenta', trasladoCheckbox.checked ? 'true' : 'false');
    }
    if (activarSondasCheckbox) {
      localStorage.setItem('settingActivarSondas', activarSondasCheckbox.checked ? 'true' : 'false');
    }
    if (diasExtraNoCuentaCheckbox) {
      localStorage.setItem('settingDiasExtraNoCuenta', diasExtraNoCuentaCheckbox.checked ? 'true' : 'false');
    }

    modal?.classList.add('hidden');
    
    renderCalendar();
    const start = document.getElementById('cycleStart')?.value;
    const end = document.getElementById('cycleEnd')?.value;
    if (start && end) calculateAndShowCycle(start, end);
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
