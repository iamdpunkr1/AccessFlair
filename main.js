const { app, BrowserWindow, ipcMain, screen, desktopCapturer, Menu, systemPreferences } = require('electron')
const screenshot = require('screenshot-desktop');
const robot = require("@hurdlegroup/robotjs");
const path = require("node:path");
const os = require("os");
const {getCursorShape} = require('cursor-shape-detector'); 

let lastMousePos = robot.getMousePos();
let screenHeight;
let screenWidth;
let nativeOrigin = { x: 0, y: 0 };
let screenNumber = 0;
let screenShotDisplays;




function createWindow () {
    const win = new BrowserWindow({
        width: 1024,
        height: 768,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            // nodeIntegration: true,
            // contextIsolation: false,
            preload:path.join(__dirname, 'preload.js')
        }
    })
        // Create the menu
        // const menu = Menu.buildFromTemplate([
        //     {
        //         label: 'Menu',
        //         submenu: [
        //             {
        //                 label: 'Disconnect',
        //                 click: () => {
        //                     //console.log('Disconnect clicked');
        //                     // Add your disconnect logic here
        //                 }
        //             },
        //             {
        //                 label: 'Select Screen',
        //                 click: () => {
        //                     //console.log('Select Screen clicked');
        //                     // Add your select screen logic here
        //                 }
        //             }
        //         ]
        //     }
        // ]);
        // Menu.setApplicationMenu(menu);
    win.removeMenu();
    win.loadFile('index.html');
}

app.whenReady().then(()=> {
    createWindow();
    try{
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;
    if (process.platform === 'darwin' && primaryDisplay.scaleFactor === 2) {
      screenHeight = height;
      screenWidth = width;
    }else{
      screenHeight = height*primaryDisplay.scaleFactor;
      screenWidth = width*primaryDisplay.scaleFactor;
    }
  }catch(e){
    console.log("Error: 1001")
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

    let ss;
    try{
    if(screenShotDisplays){
        ss = await screenshot({ screen:screenShotDisplays[screenNumber].id,  quality:100 });
    }else{
        ss = await screenshot({  quality:100});
    }
    }catch(e){
        console.log("ERROR 1002")
    }
    return ss;
});



ipcMain.on("mouse-move", function(event, arg) {
    try{
    const x =  Math.round(arg.x * screenWidth)+ nativeOrigin.x;
    const y = Math.round(arg.y * screenHeight) + nativeOrigin.y;
    robot.moveMouse(x, y);
    lastMousePos = { x, y };
    }catch(e){
        console.log("ERROR 1003");
    }
    
})

ipcMain.on('mouse-click', (_, data) => {
    try{
      const { button } = data;
      robot.mouseClick(button === 2 ? 'right' : 'left');
    }catch(e){
      console.log("ERROR 1004");
    }
  });

  ipcMain.on('mouse-down', (_, __) => {
    try{
      robot.mouseToggle("down");
    }catch(e){
      console.log("ERROR 1005");
    }
    });

  ipcMain.on('mouse-up', (_, __) => {
    try{
      robot.mouseToggle("up");
    }catch(e){
      console.log("ERROR 1006");
    }
  });

  ipcMain.on('mouse-scroll', (_, data) => {
    try{
      const { deltaX, deltaY} = data;
      robot.scrollMouse(deltaX, deltaY);
    }catch(e){
      console.log("ERROR 1007");
    }
  });

  ipcMain.on('key-up', (_, data) => {
    try{
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
  
    }catch(e){
      console.log("ERROR 1008");
    }
  });


ipcMain.on('screen-number', (_, data) => {
    try{
      screenNumber = data;
      const displays = screen.getAllDisplays();
      screenHeight = displays[screenNumber].size.height * displays[screenNumber].scaleFactor;
      screenWidth = displays[screenNumber].size.width * displays[screenNumber].scaleFactor;
      nativeOrigin = displays[screenNumber].nativeOrigin;
    }catch(e){
      console.log("ERROR 1009");
    }

    });

ipcMain.handle('get-mouse-pos', () => {
  try{
    const currentMousePos = robot.getMousePos();
    if (currentMousePos.x !== lastMousePos.x || currentMousePos.y !== lastMousePos.y) {
        lastMousePos = currentMousePos;
        return { x: currentMousePos.x, y: currentMousePos.y };
        }
      lastMousePos = currentMousePos;
    }catch(e){
      console.log("ERROR 1010");
    }
    return null;
  });

ipcMain.handle('capture-screen', async () => {
    try{
        const sources = await desktopCapturer.getSources({
        types: ['screen']     
    });
    return sources[screenNumber].id;
    }catch(e){
      console.log("ERROR 1011");
    }
});

ipcMain.handle('check-access',async ()=> {
  try{
  const hasScreenPermission = systemPreferences.getMediaAccessStatus("screen") === "granted";
  return hasScreenPermission;
  }catch(e){
    console.log("ERROR 1012");
  }
  return null;
})

ipcMain.handle("get-os", async () => {
   try{
      return os.platform();
   }catch(e){
    console.log("ERROR 1013");
   }
   
});

ipcMain.handle('get-cursor-style',async ()=> {

    try{
     return await getCursorShape(); 
    }catch(e){
      console.log("ERROR 1014");
    }
    
})

ipcMain.handle('screen-resolution', ()=> {
  try{
    return {os:process.platform, screenHeight, screenWidth};  
  }catch(e){
    console.log("ERROR 1015");
  }
    
})

ipcMain.handle('get-displays', async () => {
  try{
    
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

    return { totalDisplays:updatedDisplays.length , sources: updatedSources, displays: updatedDisplays };
  }catch(e){
    console.log("ERROR 1016");
    return null;
  }
});



