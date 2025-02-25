const { app, BrowserWindow, ipcMain, screen, desktopCapturer, Menu, systemPreferences } = require('electron')
const screenshot = require('screenshot-desktop');
const robot = require("@hurdlegroup/robotjs");
const path = require("node:path");
const os = require("os");
const { getCursorShape } = require('cursor-shape-detector');

let lastMousePos = robot.getMousePos();
let screenHeight;
let screenWidth;
let nativeOrigin = { x: 0, y: 0 };
let screenNumber = 0;
let screenShotDisplays;

function createWindow() {
    const win = new BrowserWindow({
        width: 1024,
        height: 768,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    });
    win.removeMenu();
    win.loadFile('index.html');
}

app.whenReady().then(() => {
    createWindow();
    try {
        const primaryDisplay = screen.getPrimaryDisplay();
        const { width, height } = primaryDisplay.size;
        if (process.platform === 'darwin' && primaryDisplay.scaleFactor === 2) {
            screenHeight = height;
            screenWidth = width;
        } else {
            screenHeight = height * primaryDisplay.scaleFactor;
            screenWidth = width * primaryDisplay.scaleFactor;
        }
    } catch (e) {
        console.error("ERROR 1001 - Failed to retrieve primary display info:", e);
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

ipcMain.handle('get-screenshot', async () => {
    try {
        let ss;
        if (screenShotDisplays) {
            ss = await screenshot({ screen: screenShotDisplays[screenNumber].id, quality: 100 });
        } else {
            ss = await screenshot({ quality: 100 });
        }
        return ss;
    } catch (e) {
        console.error("ERROR 1002 - Failed to capture screenshot:", e);
        return null;
    }
});

ipcMain.on("mouse-move", (event, arg) => {
    try {
        const x = Math.round(arg.x * screenWidth) + nativeOrigin.x;
        const y = Math.round(arg.y * screenHeight) + nativeOrigin.y;
        robot.moveMouse(x, y);
        lastMousePos = { x, y };
    } catch (e) {
        console.error("ERROR 1003 - Failed to move mouse:", e);
    }
});

ipcMain.on('mouse-click', (_, data) => {
    try {
        const { button } = data;
        robot.mouseClick(button === 2 ? 'right' : 'left');
    } catch (e) {
        console.error("ERROR 1004 - Failed to execute mouse click:", e);
    }
});

ipcMain.on('mouse-down', () => {
    try {
        robot.mouseToggle("down");
    } catch (e) {
        console.error("ERROR 1005 - Failed to execute mouse down event:", e);
    }
});

ipcMain.on('mouse-up', () => {
    try {
        robot.mouseToggle("up");
    } catch (e) {
        console.error("ERROR 1006 - Failed to execute mouse up event:", e);
    }
});

ipcMain.on('mouse-scroll', (_, data) => {
    try {
        const { deltaX, deltaY } = data;
        robot.scrollMouse(deltaX, deltaY);
    } catch (e) {
        console.error("ERROR 1007 - Failed to execute mouse scroll:", e);
    }
});

ipcMain.on('key-up', (_, data) => {
    try {
        const { key, code: modifier } = data;
        const specialKeysMap = {
            'Shift': 'shift', 'Enter': 'enter', 'Control': 'control', 'Alt': 'alt', 'Meta': 'command',
            'Backspace': 'backspace', 'Delete': 'delete', 'ArrowUp': 'up', 'ArrowDown': 'down',
            'ArrowLeft': 'left', 'ArrowRight': 'right', 'Tab': 'tab'
        };
        const robotKey = specialKeysMap[key] || key.toLowerCase();
        robot.keyToggle(robotKey, 'down', modifier);
        robot.keyToggle(robotKey, 'up', modifier);
    } catch (e) {
        console.error("ERROR 1008 - Failed to execute key press:", e);
    }
});

ipcMain.on('screen-number', (_, data) => {
    try {
        screenNumber = data;
        const displays = screen.getAllDisplays();
        screenHeight = displays[screenNumber].size.height * displays[screenNumber].scaleFactor;
        screenWidth = displays[screenNumber].size.width * displays[screenNumber].scaleFactor;
        nativeOrigin = displays[screenNumber].nativeOrigin;
    } catch (e) {
        console.error("ERROR 1009 - Failed to switch screen:", e);
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
    } catch (e) {
        console.error("ERROR 1010 - Failed to retrieve mouse position:", e);
    }
    return null;
});

ipcMain.handle('capture-screen', async () => {
    try {
        const sources = await desktopCapturer.getSources({ types: ['screen'] });
        return sources[screenNumber].id;
    } catch (e) {
        console.error("ERROR 1011 - Failed to capture screen source:", e);
        return null;
    }
});

ipcMain.handle('check-access', async () => {
    try {
        return systemPreferences.getMediaAccessStatus("screen") === "granted";
    } catch (e) {
        console.error("ERROR 1012 - Failed to check screen access permissions:", e);
    }
    return null;
});

ipcMain.handle("get-os", async () => {
    try {
        return os.platform();
    } catch (e) {
        console.error("ERROR 1013 - Failed to retrieve OS information:", e);
    }
});

ipcMain.handle('get-cursor-style', async () => {
    try {
        return await getCursorShape();
    } catch (e) {
        console.error("ERROR 1014 - Failed to detect cursor shape:", e);
    }
});

ipcMain.handle('screen-resolution', () => {
    try {
        return { os: process.platform, screenHeight, screenWidth };
    } catch (e) {
        console.error("ERROR 1015 - Failed to retrieve screen resolution:", e);
    }
});

ipcMain.handle('get-displays', async () => {
    try {
        const sources = await desktopCapturer.getSources({ types: ['screen'] });
        const updatedSources = sources.map(source => ({ id: source.id, name: source.name }));
        const displays = await screenshot.listDisplays();
        screenShotDisplays = displays;
        const updatedDisplays = displays.map(display => ({ id: display.id, name: display.name }));
        return { totalDisplays: updatedDisplays.length, sources: updatedSources, displays: updatedDisplays };
    } catch (e) {
        console.error("ERROR 1016 - Failed to retrieve display list:", e);
        return null;
    }
});
