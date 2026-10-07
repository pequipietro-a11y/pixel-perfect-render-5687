const { app, BrowserWindow } = require("electron");

function createWindow() {
  const win = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 1024,
    minHeight: 600,
    title: "Fluxo — Editor de Motion Design",
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  win.loadURL("https://fluxomotioncom.lovable.app");
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());
