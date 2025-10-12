async function api(path, opts = {}) {
  const res = await fetch("/api" + path, opts);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || res.statusText);
  }
  return res.json().catch(() => ({}));
}

async function loadPrinters() {
  try {
    const data = await api("/printers");
    const select = document.getElementById("printers-list");
    const currentPrinter = document.getElementById("selected-printer");

    select.innerHTML = "";
    data.printers.forEach(p => {
      const option = document.createElement("option");
      option.value = p.name;
      option.textContent = p.name;
      if (data.preferred === p.name) option.selected = true;
      select.appendChild(option);
    });

    currentPrinter.textContent = data.preferred || "по умолчанию";

    document.getElementById("port").value = data.port;
    document.getElementById("autolaunch").checked = !!data.autoLaunch;
  } catch (e) {
    alert("Ошибка при загрузке списка принтеров: " + e.message);
  }
}

document.getElementById("btn-refresh").addEventListener("click", loadPrinters);

document.getElementById("printers-list").addEventListener("change", async (e) => {
  const printerName = e.target.value;
  await fetch("/api/printers/select", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ printerName })
  });
  document.getElementById("selected-printer").textContent = printerName;
});

document.getElementById("save-port").addEventListener("click", async () => {
  const port = parseInt(document.getElementById("port").value, 10);
  await fetch("/api/config/port", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ port })
  });
  alert("Порт сохранён. Перезапустите приложение для применения.");
});

document.getElementById("save-autolaunch").addEventListener("click", async () => {
  const autoLaunch = document.getElementById("autolaunch").checked;
  await fetch("/api/config/autolaunch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ autoLaunch })
  });
  alert("Настройка автозапуска сохранена.");
});

document.getElementById("test-print").addEventListener("click", async () => {
  await fetch("/api/print/test", { method: "POST" });
  alert("Тестовая печать отправлена");
});

document.getElementById("sample-print").addEventListener("click", async () => {
  const html = `<div style="font-family:Arial; font-size:12px"><h3>Sample Ticket</h3><div>Order #12345</div><div>${new Date().toLocaleString()}</div></div>`;
  await fetch("/api/print", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html })
  });
  alert("Пример отправлен на печать");
});

document.getElementById("btn-print").addEventListener("click", async () => {
  const html = document.getElementById("html").value;
  await fetch("/api/print", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html })
  });
  alert("HTML отправлен на печать");
});

loadPrinters();

document.addEventListener("DOMContentLoaded", async () => {
  const versionEl = document.getElementById("app-version");
  const updateStatus = document.getElementById("update-status");
  const checkBtn = document.getElementById("check-update");

  const versionRes = await fetch("/api/version").then(r => r.json());
  versionEl.textContent = versionRes.version;

  checkBtn.addEventListener("click", async () => {
    updateStatus.textContent = "Проверка обновлений...";

    try {
      const res = await fetch("/api/check-for-updates").then(r => r.json());

      if (res.error) {
        updateStatus.textContent = "Ошибка: " + res.error;
      } else if (res.updateAvailable) {
        updateStatus.textContent = `Найдено обновление ${res.info.version}. Фоновая загрузка...`;
      } else {
        updateStatus.textContent = "У вас последняя версия.";
      }
    } catch (e) {
      updateStatus.textContent = "Ошибка при запросе обновления: " + e.message;
    }
  });
});
