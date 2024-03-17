/*
    @Descriptions        : Helper file for DownloadFile API
*/

// Require dependencies
var path = require('path');
var reqCommon = require('./Common');
var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');
var reqDBInstance = require('../../../../../torus-references/instance/DBInstance');
var objLogInfo = null;
var serviceName = 'DownloadFileHelper';
var mSession = null;

//This will call when unexpected close or finish
function finishApiCall() {
    if (mSession) {
        reqTranDBInstance.CallRollback(mSession);
    }
}

// This is for get file from database
function downloadFile(pheaders, strFilePath, pObjLogInfo, callback) {
    try {
        objLogInfo = pObjLogInfo;
        var byt = null;
        var fileExt = path.extname(strFilePath).toLowerCase();
        var ATCode = "";
        var arrIMG = [".bmp", ".tif", ".tiff", ".gif", ".png", ".jpg", ".jpeg", ".jfif", ".jpe", ".ico"];
        var arrAVI = [".wmv", ".avi", ".mp4"];
        var arrMP3 = [".mp3"];
        if (arrIMG.indexOf(fileExt) >= 0) {
            ATCode = "IMG"
        } else if (arrMP3.indexOf(fileExt) >= 0) {
            ATCode = "MP3"
        } else if (arrAVI.indexOf(fileExt) >= 0) {
            ATCode = "AVI"
        }
        var relativePath = path.basename(strFilePath);
        GetAttachmentFromDB(pheaders, relativePath, "TRNA_DATA", ATCode, "", function (error, result) {
            try {
                if (error) {
                    return callback(prepareErrorData(error, 'ERR-RES-70205', 'Error in downloadFile function'));
                } else {
                    return callback(null, result);
                }
            } catch (error) {
                return callback(prepareErrorData(error, 'ERR-RES-70206', 'Error in downloadFile function'));
            }
        });
    } catch (error) {
        return callback(prepareErrorData(error, 'ERR-RES-70207', 'Error in downloadFile function'));
    }
}

// This is for get byte from database
function GetAttachmentFromDB(pheaders, pRelativePath, pAttachmentTable, pAT_CODE, pRSDBInfo, callback) {
    try {
        var byteData = null;
        reqDBInstance.GetFXDBConnection(pheaders, 'res_cas', objLogInfo, function (pClient) {
            try {
                switch (pAT_CODE) {
                    case 'IMG':
                        var pCond = { 'RELATIVE_PATH': pRelativePath };
                        reqDBInstance.GetTableFromFXDB(pClient, pAttachmentTable, ['text_data'], pCond, objLogInfo, function (error, result) {
                            if (error) {
                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-RES-70204', 'Error in GetAttachmentFromDB function', error);
                            } else {
                                var rs = result.rows[0];
                                if (rs && rs.text_data) {
                                    byteData = new Buffer.from(rs.text_data, 'base64');
                                }
                                return callback(null, byteData);
                            }
                        });
                        break;

                    default:
                        var pCond = { 'RELATIVE_PATH': pRelativePath };
                        reqDBInstance.GetTableFromFXDB(pClient, pAttachmentTable, ['byte_data'], pCond, objLogInfo, function (error, result) {
                            if (error) {
                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-RES-70208', 'Error in GetAttachmentFromDB function', error);
                            } else {
                                var rs = result.rows[0];
                                if (rs) {
                                    byteData = rs.byte_data;
                                }
                                return callback(null, byteData);
                            }
                        });
                        break;
                }
            } catch (error) {
                return callback(prepareErrorData(error, 'ERR-RES-70209', 'Error in GetAttachmentFromDB function'));
            }
        });
    } catch (error) {
        return callback(prepareErrorData(error, 'ERR-RES-70201', 'Error in GetAttachmentFromDB function'));
    }
}

function prepareErrorData(error, errorCode, errorMessage) {
    var errJson = {
        ERROR: error,
        ERROR_CODE: errorCode,
        ERROR_MESSAGE: errorMessage
    }
    return errJson;
}

module.exports = {
    DownloadFile: downloadFile,
    FinishApiCall: finishApiCall
}
/******** End of File *******/