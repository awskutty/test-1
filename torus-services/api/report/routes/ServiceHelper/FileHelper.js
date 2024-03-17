/**
 *Decsription      : To perform file related operation
 *Last Error Code  : ERR-RPT-60724
 **/

var modPath = '../../../../../node_modules/'
var refPath = '../../../../../torus-references/'
var path = require(modPath + 'path');
var reqInsHelper = require('../../../../../torus-references/common/InstanceHelper');
var fs = require("fs");

function CreateTempDir(Ppath, foldername, pcallback) {
    var dir = ''
    try {
        var dir = path.join(Ppath, foldername)
        if (!fs.existsSync(dir)) {
            fs.mkdir(dir, 1, function(err) {
                if (!err) {
                    _PrintInfo('Directory Created Successfully')
                    return _PrepareAndSendCallback('SUCCESS', dir, '', '', null, null, pcallback)
                }
            })
        } else
            return _PrepareAndSendCallback('SUCCESS', dir, '', '', null, null, pcallback)
    } catch (error) {
        return _PrepareAndSendCallback('FAILURE', dir, 'ERR-RPT-60724', 'Error on CreateTempDir() - ' + dir, error, null, pcallback)
    }
}

function CreateDir(Ppath, foldername) {
    var dir = path.join(Ppath, foldername)
    if (!fs.existsSync(dir)) {
        fs.mkdir(dir, 1, function(err) {
            if (!err) {
                _PrintInfo('Directory Created Successfully')
                return dir
            } else
                return dir
        })
    } else
        return dir
}

function DisposeTempFile(pDirectory) {
    try {
        fs.unlinkSync(pDirectory);
    } catch (ex) {
        _PrintInfo('Delete Directory failed')
    }
}

// To print the information 
function _PrintInfo(pMessage) {
    reqInsHelper.PrintInfo('FileHelper', pMessage, null)
}

// To prepare and send callback object
function _PrepareAndSendCallback(pStatus, pData, pErrorCode, pErrMsg, pError, pWarning, pCallback) {
    var objCallback = {
        Status: pStatus,
        Data: pData,
        ErrorCode: pErrorCode,
        ErrorMsg: pErrMsg,
        Error: pError,
        Warning: pWarning
    }
    return pCallback(objCallback)
}

module.exports = {
    CreateDir: CreateDir,
    CreateTempDir: CreateTempDir,
    DisposeTempFile: DisposeTempFile
}