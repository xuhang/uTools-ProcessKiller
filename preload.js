const os = require('os')
const iconv = require('iconv-lite')
const { spawn, exec } = require("child_process")
const jschardet = require("jschardet")

//-------checkUpdate------
const fs = require('fs')
const path = require("path")
const { dialog, BrowserWindow, nativeImage } = require('electron').remote
const { shell } = require('electron');

pluginInfo = JSON.parse(fs.readFileSync(path.join(__dirname, 'plugin.json')));
logo = nativeImage.createFromPath(path.join(__dirname, 'logo.png'));

messageBox = (options, callback) => {
    dialog.showMessageBox(BrowserWindow.getFocusedWindow(), options, index => {
        callback(index);
    })
}

open = url => {
    shell.openExternal(url);
}
// ------------------------

isWin = os.platform() == 'win32' ? true : false;

getIco = isWin ? require('icon-extractor') : require('file-icon');

totalMem = os.totalmem();

powershell = (cmd, callback) => {
    const ps = spawn('powershell', ['-NoProfile', '-Command', cmd], { encoding: 'buffer' })
    let chunks = [], err_chunks = [], size = 0, err_size = 0;
    ps.stdout.on('data', chunk => {
        chunks.push(chunk);
        size += chunk.length;
    })
    ps.stderr.on('data', err_chunk => {
        err_chunks.push(err_chunk);
        err_size += err_chunk.length;
    })
    ps.on('close', code => {
        let stdout = Buffer.concat(chunks, size);
        stdout = stdout.length ? iconv.decode(stdout, jschardet.detect(stdout).encoding) : '';
        let stderr = Buffer.concat(err_chunks, err_size);
        stderr = stderr.length ? iconv.decode(stderr, jschardet.detect(stderr).encoding) : '';
        callback(stdout, stderr)
    })
}

tasklist = (callback) => {
    var tasklist = [];
    if (isWin) {
        exec('net session > NULL && echo 1 || echo 0', (err, stdout, stderr) => {
            let isAdmin = parseInt(stdout),
                IncludeUserName = isAdmin ? '-IncludeUserName' : '',
                UserName = isAdmin ? ',UserName' : '';
                powershell(`Get-Process ${IncludeUserName} | sort-object ws -descending | Select-Object ProcessName,Path,Description,WorkingSet${UserName} | ConvertTo-Json`, (stdout, stderr) => {
                    stderr && dialog.showMessageBox(BrowserWindow.getFocusedWindow(), { type: 'error', title: '啊嘞?!', message: stderr })
                    tasklist = JSON.parse(stdout);
                    callback(tasklist);
                });
        })
    } else {
        exec('ps -A -o pid -o %cpu -o %mem -o user -o comm | sed 1d | sort -rnk 3', (err, stdout, stderr) => {
            lines = stdout.split('\n');
            lines.forEach(line => {
                if (line) {
                    l = /(\d+)\s+(\d+[\.|\,]\d+)\s+(\d+[\.|\,]\d+)\s+(.*?)\s+(.*)/.exec(line);
                    dict = {
                        pid: l[1],
                        cpu: l[2],
                        mem: l[3],
                        usr: l[4],
                        path: l[5],
                        nam: l[5].split('/').pop(),
                    }
                    let ico = /\/Applications\/(.*?)\.app\//.exec(dict.path)
                    dict.ico = ico ? ico[1] : false;
                    tasklist.push(dict);
                }
            });
            callback(tasklist);
        });
    }
}

taskkill = (task, path, callback) => {
    if (isWin) {
        let restart = path == undefined ? '' : `;Start-Process -FilePath "${path}"`;
        powershell(`Stop-Process -Name ${task}${restart}`, (stdout, stderr) => {
            callback(stderr.split('\n')[0])
        });
    } else {
        let restart = path == undefined ? '' : `&& "${path}"`;
        exec(`kill -9 ${task}${restart}`, (err, stdout, stderr) => {
            callback(stderr);
        });
    }
}