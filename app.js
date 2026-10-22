(function () {
  var KEY = 'pressure-diary-v1';
  var $ = function (id) { return document.getElementById(id); };
  var entries = load();
  var editId = null;

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; }
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(entries)); }
    catch (e) { alert('Не удалось сохранить в localStorage'); }
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function nowDefaults() {
    var d = new Date();
    $('date').value = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    setTime(pad(d.getHours()) + ':' + pad(d.getMinutes()));
  }
  function fillSelect(el, max) {
    for (var i = 0; i < max; i++) {
      var o = document.createElement('option');
      o.value = o.textContent = pad(i);
      el.appendChild(o);
    }
  }
  function getTime() { return $('hour').value + ':' + $('min').value; }
  function setTime(t) {
    var p = t.split(':');
    $('hour').value = p[0];
    $('min').value = p[1];
  }
  function level(s, d) {
    if (s >= 180 || d >= 120) return 'var(--bad)';
    if (s >= 140 || d >= 90) return 'var(--high)';
    if (s >= 130 || d >= 85) return 'var(--warn)';
    return 'var(--ok)';
  }
  function esc(s) {
    return s.replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function fmtDate(iso) {
    var p = iso.split('-');
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
  }

  function render() {
    var list = $('list');
    if (!entries.length) {
      list.innerHTML = '<p class="empty">Пока нет измерений</p>';
      $('stats').hidden = true;
      return;
    }
    var sorted = entries.slice().sort(function (a, b) {
      return (b.date + b.time).localeCompare(a.date + a.time);
    });
    var html = '', cur = null;
    sorted.forEach(function (e) {
      if (e.date !== cur) {
        if (cur !== null) html += '</div>';
        cur = e.date;
        html += '<div class="day"><h3>' + fmtDate(e.date) + '</h3>';
      }
      html += '<div class="entry">' +
        '<div class="dot" style="background:' + level(e.sys, e.dia) + '"></div>' +
        '<div class="body"><div class="vals">' + e.sys + '/' + e.dia +
        '<small>пульс ' + e.pulse + '</small></div>' +
        '<div class="time">' + e.time + '</div>' +
        (e.note ? '<div class="note">' + esc(e.note) + '</div>' : '') + '</div>' +
        '<div class="acts"><button data-edit="' + e.id + '">Правка</button>' +
        '<button data-del="' + e.id + '">Удалить</button></div></div>';
    });
    list.innerHTML = html + '</div>';

    var last = sorted.slice(0, 7);
    var avg = function (k) { return Math.round(last.reduce(function (a, e) { return a + e[k]; }, 0) / last.length); };
    $('stats').hidden = false;
    $('stats').innerHTML = '<div><b>' + avg('sys') + '/' + avg('dia') + '</b><span>среднее, посл. ' + last.length + '</span></div>' +
      '<div><b>' + avg('pulse') + '</b><span>пульс ср.</span></div>' +
      '<div><b>' + entries.length + '</b><span>всего</span></div>';
  }

  function resetForm() {
    editId = null;
    $('form').reset();
    nowDefaults();
    $('formTitle').textContent = 'Новое измерение';
    $('save').textContent = 'Сохранить';
    $('cancel').hidden = true;
  }

  $('form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var data = {
      date: $('date').value, time: getTime(),
      sys: +$('sys').value, dia: +$('dia').value, pulse: +$('pulse').value,
      note: $('note').value.trim()
    };
    if (editId) {
      entries = entries.map(function (e) { return e.id === editId ? Object.assign({ id: editId }, data) : e; });
    } else {
      data.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      entries.push(data);
    }
    persist();
    resetForm();
    render();
  });

  $('cancel').addEventListener('click', resetForm);

  $('list').addEventListener('click', function (ev) {
    var t = ev.target;
    var del = t.getAttribute('data-del'), ed = t.getAttribute('data-edit');
    if (del && confirm('Удалить запись?')) {
      entries = entries.filter(function (e) { return e.id !== del; });
      if (editId === del) resetForm();
      persist(); render();
    }
    if (ed) {
      var e = entries.find(function (x) { return x.id === ed; });
      if (!e) return;
      editId = ed;
      $('date').value = e.date; setTime(e.time);
      $('sys').value = e.sys; $('dia').value = e.dia; $('pulse').value = e.pulse;
      $('note').value = e.note || '';
      $('formTitle').textContent = 'Редактирование';
      $('save').textContent = 'Обновить';
      $('cancel').hidden = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  $('export').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pressure-diary.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });

  $('import').addEventListener('change', function (ev) {
    var f = ev.target.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var arr = JSON.parse(r.result);
        if (!Array.isArray(arr)) throw 0;
        var ids = {};
        entries.forEach(function (e) { ids[e.id] = 1; });
        var added = 0;
        arr.forEach(function (e) {
          if (e && e.id && e.date && e.time && !ids[e.id]) { entries.push(e); added++; }
        });
        persist(); render();
        alert('Добавлено записей: ' + added);
      } catch (e) { alert('Неверный файл'); }
      ev.target.value = '';
    };
    r.readAsText(f);
  });

  fillSelect($('hour'), 24);
  fillSelect($('min'), 60);
  nowDefaults();
  render();
})();
