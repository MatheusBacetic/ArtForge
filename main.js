const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  // Define o caminho do ícone com base na plataforma
  const iconPath =
    process.platform === 'darwin'
      ? path.join(__dirname, 'frontend/icon.icns') // macOS
      : process.platform === 'win32'
      ? path.join(__dirname, 'frontend/favicon.ico') // Windows
      : path.join(__dirname, 'frontend/icon.png'); // Linux

  // Cria a janela principal
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 800, // LARGURA MÍNIMA
    minHeight: 600, // ALTURA MÍNIMA
    icon: iconPath, // Define o ícone da janela
    webPreferences: {
      nodeIntegration: true, // Habilita integração com Node.js
    },
  });

  // Carrega o arquivo HTML principal
  mainWindow.loadFile(path.join(__dirname, 'frontend/index.html'));

  // Abre as ferramentas de desenvolvimento (opcional, para depuração)
  mainWindow.webContents.openDevTools();

  // Evento opcional: Fecha a janela
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Quando o Electron estiver pronto, cria a janela
app.whenReady().then(() => {
  createWindow();

  // Para macOS: Recria a janela se não houver nenhuma aberta
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Fecha o aplicativo quando todas as janelas forem fechadas (exceto no macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});