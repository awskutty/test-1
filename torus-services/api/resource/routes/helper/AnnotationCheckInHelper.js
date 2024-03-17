/*
    @Description        : Helper file for AnnotationCheckIn API
*/

// Require dependencies
var reqPath = require('path');
var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');
var reqCommon = require('./Common');
var reqDBInstance = require('../../../../../torus-references/instance/DBInstance');
var reqTranDBInstance = require('../../../../../torus-references/instance/TranDBInstance');
var objLogInfo = null;
var mSession = null;
var serviceName = 'AnnotationCheckInHelper';

//This will call when unexpected close or finish
function finishApiCall() {
    if (mSession) {
        reqTranDBInstance.CallRollback(mSession);
    }
}

// This will do annotation check in
function doAnnotationChkIn(pParams, pHeaders, pFile, pObjLogInfo, callback) {
    objLogInfo = pObjLogInfo;
    var Result = "FAILURE";
    var objAnnChkIn = new reqCommon.AnnotationCheckInResult();
    var objAttDetResult = new reqCommon.AttachmentDetails();
    var strOrgExt = "";
    var logInfo = null;
    try {
        var intTRNAId = pParams.TRNA_ID;
        reqDBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function (pClient) {
            try {
                var FileCount = pParams.FILE_COUNT;
                var StrRsParams = JSON.parse(pParams.RSPARAMS);
                var strAppId = pParams.APP_ID;
                var strUserId = pParams.pUserId;
                var strAppUId = pParams.pAppUId;
                var strClientId = pParams.pClientId;
                var strLoginName = pParams.pLoginName;
                var strAppDesc = pParams.APP_DESC;
                var strSysID = pParams.SYSTEM_ID;
                var strSysDesc = pParams.SYSTEM_DESC;
                var strSessionId = pParams.SESSION_ID;
                var strUsername = pParams.USER_NAME;
                var strMenuItemDesc = pParams.MENU_ITEM_DESC;
                var strActionDesc = pParams.ACTION_DESC;
                var AttachmentDetails = StrRsParams.Items;
                var FileStartIndex = 14;
                var strNewATCode = ""
                var RelativePath = ""
                var ByteData = new Buffer.from('base64');
                for (var i = 0; i < AttachmentDetails.length; i++) {
                    var dr = AttachmentDetails[i];
                    RelativePath = dr.RELATIVE_PATH;
                    getATTypes(pClient, function (ATTypes) {
                        try {
                            for (var j = 0; j < ATTypes.length; j++) {
                                var htATT = ATTypes[j];
                                var strExt = reqPath.extname(RelativePath).toLowerCase();
                                var atExt = (htATT.AT_EXTENSIONS).toString().toLowerCase();
                                if (atExt.indexOf(strExt) != -1) {
                                    strNewATCode = htATT.AT_CODE.toString();
                                    break;
                                }
                            }
                            if (pFile.FILE_0) {
                                ByteData = pFile.FILE_0.data;
                            }
                            FileStartIndex = FileStartIndex + 1;
                            reqTranDBInstance.GetTranDBConn(pHeaders, true, function (pSession) {
                                try {
                                    mSession = pSession;
                                    reqCommon.SaveBurnedAtmt(pHeaders, pSession, intTRNAId, strUserId, strAppUId, strLoginName, strClientId, pFile.FILE_0.data, strNewATCode, RelativePath.toString(), dr.FILE_NAME, logInfo, function (objAttDetResult) {
                                        try {
                                            objAnnChkIn.AttachmentId = objAttDetResult.AttId;
                                            objAnnChkIn.RelativePath = objAttDetResult.FilePath;
                                            objAnnChkIn.ATCode = objAttDetResult.ATCode;
                                            objAnnChkIn.Result = "SUCCESS";
                                            reqTranDBInstance.Commit(pSession, true, function callbackres(res) {
                                                return callback(null, objAnnChkIn);
                                            });
                                        } catch (error) {
                                            reqTranDBInstance.Commit(pSession, false, function callbackres(res) {
                                                return callback(prepareErrorData(error, 'ERR-RES-71805', 'Error in reqCommon.SaveBurnedAtmt callback'));
                                            });
                                        }
                                    });
                                } catch (error) {
                                    reqTranDBInstance.Commit(pSession, false, function callbackres(res) {
                                        return callback(prepareErrorData(error, 'ERR-RES-71806', 'Error in doAnnotationChkIn function'));
                                    });
                                }
                            });
                        } catch (error) {
                            return callback(prepareErrorData(error, 'ERR-RES-71807', 'Error in doAnnotationChkIn function'));
                        }
                    });
                }
            } catch (error) {
                return callback(prepareErrorData(error, 'ERR-RES-71808', 'Error in doAnnotationChkIn function'));
            }
        });
    } catch (error) {
        return callback(prepareErrorData(error, 'ERR-RES-71801', 'Error in doAnnotationChkIn function'));
    }
}

// To get AT Types
function getATTypes(pClient, callback) {
    try {
        var Result = [];
        getTableFromFXDB("ATTACHMENT_TYPES", "", pClient, function (ds) {
            try {
                if (ds.rows) {
                    var arrRows = ds.rows;
                    for (var i = 0; i < arrRows.length; i++) {
                        var objRow = arrRows[i];
                        var objNew = new Object();
                        for (var key in objRow) {
                            var strUpperCaseKey = key.toUpperCase();
                            objNew[strUpperCaseKey] = objRow[key];
                        }
                        Result.push(objNew);
                    }
                }
                return callback(Result);
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-RES-71810', 'Error in getATTypes function', error);
                return callback(error);
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-RES-71811', 'Error in getATTypes function', error);
        return callback(error);
    }
}

// To get data from FXDB
function getTableFromFXDB(pTablename, pCond, pClient, callback) {
    try {
        var Result = null;
        if (pClient) {
            reqDBInstance.GetTableFromFXDB(pClient, pTablename, [], pCond, objLogInfo, function (error, result) {
                if (error) {
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-RES-71812', 'Error in getTableFromFXDB function', error);
                    return callback(Result);
                } else {
                    Result = result;
                    return callback(Result);
                }
            });
        } else {
            return callback(Result);
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-RES-71813', 'Error in getTableFromFXDB function', error);
        return callback(error);
    }
}

// To prepare Error Object
function prepareErrorData(error, errorCode, errorMessage) {
    var errJson = {
        ERROR: error,
        ERROR_CODE: errorCode,
        ERROR_MESSAGE: errorMessage
    }
    return errJson;
}

module.exports = {
    DoAnnotationChkIn: doAnnotationChkIn,
    FinishApiCall: finishApiCall
}
/******** End of File *******/