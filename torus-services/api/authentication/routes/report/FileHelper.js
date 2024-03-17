var modPath = '../../../../node_modules/'
var path = require('../' + modPath + 'path');
var fs = require("fs");

function CreateTempDir(Ppath, pReportPath, foldername, pcallback) {
    var dir = path.join(Ppath, pReportPath, foldername)
    // var dir = Ppath + '\\' + foldername
    if (!fs.existsSync(dir)) {
        fs.mkdir(dir, 1, function (err) {
            if (!err) {
                console.log('Directory Created Successfully')
                return pcallback(dir)
            }


        })
    } else
        return pcallback(dir)
}

function CreateDir(Ppath, foldername) {
    var dir = path.join(Ppath, foldername)
    if (!fs.existsSync(dir)) {
        fs.mkdir(dir, 1, function (err) {
            if (!err) {
                console.log('Directory Created Successfully')
                return dir
            } else
                return dir
        })
    } else
        return dir
}

function DisposeTempFile(pDirectory) {
    try {
        if (fs.existsSync(pDirectory)) {
            fs.readdir(pDirectory, function (err, data) {
                for (var i = 0; i < data.length; i++)
                    fs.unlinkSync(pDirectory + '/' + data[i]);
            })
        }
    } catch (ex) {
        console.log('Delete Directory failed', ex)
    }
}
module.exports = {
    CreateDir: CreateDir,
    CreateTempDir: CreateTempDir,
    DisposeTempFile: DisposeTempFile
}