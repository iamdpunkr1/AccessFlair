const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('eApi', {
    getScreenshot: () => ipcRenderer.invoke('get-screenshot'),
    stopShare: () => ipcRenderer.send('stop-share'),
    mouseMove: (coords) => ipcRenderer.send('mouse-move', coords),
    mouseClick: (button) => ipcRenderer.send('mouse-click', { button }),
    mouseDown: () => ipcRenderer.send('mouse-down'),
    mouseUp: () => ipcRenderer.send('mouse-up'),
    mouseScroll: (delta) => ipcRenderer.send('mouse-scroll', delta),
    keyUp: (data) => ipcRenderer.send('key-up', data),
    setScreenNumber: (screenNumber) => ipcRenderer.send('screen-number', screenNumber),
    getMousePos: () => ipcRenderer.invoke('get-mouse-pos'),
    captureScreen: () => ipcRenderer.invoke('capture-screen'),
    checkAccess: () => ipcRenderer.invoke('check-access'),
    getCursorStyle: () => ipcRenderer.invoke('get-cursor-style'),
    getScreenResolution: () => ipcRenderer.invoke('screen-resolution'),
    getDisplays: () => ipcRenderer.invoke('get-displays'),
    setOrigin: (data) => ipcRenderer.send('set-origin', data),
    getOs: () => ipcRenderer.invoke('get-os'),
    
});
