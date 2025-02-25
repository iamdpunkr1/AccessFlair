const { app, BrowserWindow, ipcMain, screen, desktopCapturer, systemPreferences } = require('electron')
const screenshot = require('screenshot-desktop');
const robot = require("@hurdlegroup/robotjs");
const path = require("node:path");
const os = require("os");
const {getCursorShape} = require('cursor-shape-detector'); 
const http = require('http');


let lastMousePos = robot.getMousePos();
let screenHeight;
let screenWidth;
let nativeOrigin = { x: 0, y: 0 };
let screenNumber = 0;
let screenShotDisplays;


function sendToErrorServer(errorLog) {
  
  const data = JSON.stringify(errorLog);
  
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/log',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };
  
  const req = http.request(options, (res) => {
    // Log response status
    console.log(`Error sent to server. Status: ${res.statusCode}`);
  });
  
  req.on('error', (error) => {
    console.error('Failed to send error to logging server:', error.message);
  });
  
  req.write(data);
  req.end();
}

// Function to log errors consistently
function logError(code, error) {
  // Get system details
  const pcDetails = {
    hostname: os.hostname(),
    platform: os.platform(),
    architecture: os.arch(),
    cpus: os.cpus()[0].model,
    totalMemory: `${(os.totalmem() / (1024 * 1024 * 1024)).toFixed(2)} GB`,
    freeMemory: `${(os.freemem() / (1024 * 1024 * 1024)).toFixed(2)} GB`,
    uptime: `${(os.uptime() / 3600).toFixed(2)} hours`,
    userInfo: os.userInfo().username,
    nodeVersion: process.version
  };

  // Create combined error object
  const errorLog = {
    timestamp: new Date().toISOString(),
    code,
    message: error?.message || error,
    stack: error?.stack,
    pcDetails
  };

  console.error(`ERROR ${code}:`, JSON.stringify(errorLog, null, 2));
  
  // In production, send to error logging server
  // if (app.isPackaged) {
    sendToErrorServer(errorLog);
  // }
}

let win;

function createWindow () {
    win = new BrowserWindow({
        width: 1024,
        height: 768,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload:path.join(__dirname, 'preload.js')
        }
    })
    win.removeMenu();
    win.loadFile('index.html');
    win.webContents.openDevTools();
}

app.whenReady().then(()=> {
    createWindow();
    try {
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width, height } = primaryDisplay.size;
      if (process.platform === 'darwin' && primaryDisplay.scaleFactor === 2) {
        screenHeight = height;
        screenWidth = width;
      } else {
        screenHeight = height*primaryDisplay.scaleFactor;
        screenWidth = width*primaryDisplay.scaleFactor;
      }
    } catch(error) {
      logError(1001, error);
      return {
        error: true,
        message: "Failed to get display information",
        code: "ERROR_1001"
      };
    }
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

ipcMain.handle('get-screenshot', async () => {
    try {
      let ss;
      if(screenShotDisplays) {
        ss = await screenshot({ screen:screenShotDisplays[screenNumber].id, quality:100 });
      } else {
        ss = await screenshot({ quality:100 });
      }
      return ss;
    } catch(error) {
      logError(1002, error);
      return {
        error: true,
        message: "Failed to capture screenshot",
        code: "ERROR_1002"
      };
    }
});

ipcMain.on("mouse-move", function(event, arg) {
    try {
      const x = Math.round(arg.x * screenWidth) + nativeOrigin.x;
      const y = Math.round(arg.y * screenHeight) + nativeOrigin.y;
      robot.moveMouse(x, y);
      lastMousePos = { x, y };
    } catch(error) {
      logError(1003, error);

    }
})

ipcMain.on('mouse-click', (event, data) => {
    try {
      const { button } = data;
      robot.mouseClick(button === 2 ? 'right' : 'left');
    } catch(error) {
      logError(1004, error);
    }
});

ipcMain.on('mouse-down', (event, __) => {
    try {
      robot.mouseToggle("down");
    } catch(error) {
      logError(1005, error);
    }
});

ipcMain.on('mouse-up', (event, __) => {
    try {
      robot.mouseToggle("up");
    } catch(error) {
      logError(1006, error);
    }
});

ipcMain.on('mouse-scroll', (event, data) => {
    try {
      const { deltaX, deltaY } = data;
      robot.scrollMouse(deltaX, deltaY);
    } catch(error) {
      logError(1007, error);
    }
});

ipcMain.on('key-up', (event, data) => {
    try {
      const { key, code:modifier } = data;
      
      // Map of special keys to their robotjs equivalents
      const specialKeysMap = {
        'Shift': 'shift',
        'Enter': 'enter',
        'Control': 'control',
        'Alt': 'alt',
        'Meta': 'command',
        'Backspace': 'backspace',
        'Delete': 'delete',
        'ArrowUp': 'up',
        'ArrowDown': 'down',
        'ArrowLeft': 'left',
        'ArrowRight': 'right',
        'Tab': 'tab'
      };

      const robotKey = specialKeysMap[key] || key.toLowerCase();
      robot.keyToggle(robotKey, 'down', modifier);
      robot.keyToggle(robotKey, 'up', modifier);
    } catch(error) {
      logError(1008, error);
    }
});

ipcMain.on('screen-number', (event, data) => {
    try {
      screenNumber = data;
      const displays = screen.getAllDisplays();
      screenHeight = displays[screenNumber].size.height * displays[screenNumber].scaleFactor;
      screenWidth = displays[screenNumber].size.width * displays[screenNumber].scaleFactor;
      nativeOrigin = displays[screenNumber].nativeOrigin;
    } catch(error) {
      logError(1009, error);
    }
});

ipcMain.handle('get-mouse-pos', () => {
    try {
      const currentMousePos = robot.getMousePos();
      if (currentMousePos.x !== lastMousePos.x || currentMousePos.y !== lastMousePos.y) {
        lastMousePos = currentMousePos;
        return { x: currentMousePos.x, y: currentMousePos.y };
      }
      lastMousePos = currentMousePos;
      return null;
    } catch(error) {
      logError(1010, error);
      return {
        error: true,
        message: "Failed to get mouse position",
        code: "ERROR_1010"
      };
    }
});

ipcMain.handle('capture-screen', async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen']     
      });
      return sources[screenNumber].id;
    } catch(error) {
      logError(1011, error);
      return {
        error: true,
        message: "Failed to capture screen",
        code: "ERROR_1011"
      };
    }
});

ipcMain.handle('check-access', async () => {
    try {
      // Fixed typo in method name: getMediaAccessStatu → getMediaAccessStatus
      const hasScreenPermission = systemPreferences.getMediaAccessStatus("screen") === "granted";
      return hasScreenPermission;
    } catch(error) {
      logError(1012, error);
      return {
        error: true,
        message: "Unable to check screen sharing permissions",
        code: "ERROR_1012"
      };
    }
});

ipcMain.handle("get-os", async () => {
    try {
      return os.platform();
    } catch(error) {
      logError(1013, error);
      return {
        error: true,
        message: "Failed to get operating system information",
        code: "ERROR_1013"
      };
    }
});

ipcMain.handle('get-cursor-style', async () => {
    try {
      return await getCursorShape(); 
    } catch(error) {
      logError(1014, error);
      return {
        error: true,
        message: "Failed to get cursor style",
        code: "ERROR_1014"
      };
    }
});

ipcMain.handle('screen-resolution', () => {
    try {
      return {os: process.platform, screenHeight, screenWidth};  
    } catch(error) {
      logError(1015, error);
      return {
        error: true,
        message: "Failed to get screen resolution",
        code: "ERROR_1015"
      };
    }
});

ipcMain.handle('get-displays', async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
      });

      const updatedSources = sources.map(source => {
        return {
          id: source.id,
          name: source.name
        }
      });

      const displays = await screenshot.listDisplays();
      screenShotDisplays = displays;
      const updatedDisplays = displays.map(display => {
        return {
          id: display.id,
          name: display.name
        }
      });

      return { totalDisplays: updatedDisplays.length, sources: updatedSources, displays: updatedDisplays };
    } catch(error) {
      logError(1016, error);
      return {
        error: true,
        message: "Failed to get display information",
        code: "ERROR_1016"
      };
    }
});