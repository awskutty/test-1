/*
    @Description        : Helper file for SaveBurnMarkupToDB API
*/

// Require dependencies
var reqPath = require('path');
var request = require('request');
var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');
var reqCommon = require('./Common');
var reqPccConf = require('../viewer-webtier/PccConfig');
var reqDBInstance = require('../../../../../torus-references/instance/DBInstance');
var reqTranDBInstance = require('../../../../../torus-references/instance/TranDBInstance');
var reqsvchelper = require('../../../../../torus-references/common/serviceHelper/ServiceHelper');
var objLogInfo = null;
var mSession = null;
var serviceName = 'SaveBurnMarkupToDBHelper';

//This will call when unexpected close or finish
function finishApiCall() {
    if (mSession) {
        reqTranDBInstance.CallRollback(mSession);
    }
}

// Get accusoft url from tenant_setup
function saveBurnMarkupToDB(pParams, pHeaders, pMethod, pObjLogInfo, callback) {
    try {
        var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
        objLogInfo = pObjLogInfo;
        var strResult = 'FAILURE';
        var result = null;
        var fs = require('fs');
        var filename = 'myfile.pdf';
        var ws = fs.createWriteStream(filename);
        reqDBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function (pClient) {
            try {
                if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
                    var cond = {};
                    cond.setup_code = 'ACCUSOFT';
                    reqsvchelper.GetSetupJson(pClient, cond, objLogInfo, function (res) {
                        if (res.Status == 'SUCCESS' && res.Data.length) {
                            aftergetsetupJson(res.Data);
                        } else {
                            return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, res.ErrorCode, res.ErrorMsg, res.Error);
                        }
                    });
                } else {
                    var pCond = { 'CATEGORY': 'ACCUSOFT', 'CLIENT_ID': pParams.pClientId, 'TENANT_ID': '0' };
                    reqDBInstance.GetTableFromFXDB(pClient, 'TENANT_SETUP', [], pCond, objLogInfo, function (error, result) {
                        try {
                            if (error) {
                                return callback(prepareErrorData(error, 'ERR-RES-71613', 'Error in saveBurnMarkupToDB function'));
                            } else if (result.rows.length) {
                                aftergetsetupJson(result.rows);
                            } else {
                                return callback(null, null, 'No tenant setup found.');
                            }
                        } catch (error) {
                            return callback(prepareErrorData(error, 'ERR-RES-71613', 'Exception occured get tenant setup'));
                        }
                    });
                }



                function aftergetsetupJson(result) {
                    var setupJson = JSON.parse(result[0].setup_json);
                    var accPath = setupJson.URL;
                    var strSaveURL = pParams.SAVEURL;
                    var imagingServiceUri = '';
                    if (strSaveURL.indexOf('v2') != -1) {
                        imagingServiceUri = strSaveURL.replace(accPath, reqPccConf.WebServiceScheme + '://' + reqPccConf.WebServiceHost + ':' + reqPccConf.WebServicePort + '/' + reqPccConf.WebServiceV2Path); // http:192.168.2.68:18681/v2
                    } else {
                        imagingServiceUri = strSaveURL.replace(accPath, reqPccConf.WebServiceScheme + '://' + reqPccConf.WebServiceHost + ':' + reqPccConf.WebServicePort + '/' + reqPccConf.WebServicePath); // http:192.168.2.68:18681/PCCIS/V1
                    }
                    var strExt = reqPath.extname(pParams.ATMT_NAME);
                    imagingServiceUri = imagingServiceUri.replace(strExt, '');
                    var options = {
                        url: imagingServiceUri,
                        method: 'GET',//pMethod,
                        headers: {
                            "acs-api-key": reqPccConf.ApiKey
                        }
                    };
                    request(options, function (error, responseFromImagingService, responseBodyFromImagingService) {
                        if (error) {
                            // strResult = "Burn Process Failed";
                            // reqInstanceHelper.PrintInfo(serviceName, strResult, objLogInfo);
                            // return callback(strResult);
                            return callback(prepareErrorData(error, 'ERR-RES-71612', 'Error in saveBurnMarkupToDB function'));
                        }
                    }).pipe(ws);
                    ws.on('finish', function () {
                        reqInstanceHelper.PrintInfo(serviceName, 'file downloaded', objLogInfo);
                        fs.readFile(filename, function (error, data) {
                            if (error) {
                                // strResult = "Burn Process Failed";
                                // reqInstanceHelper.PrintInfo(serviceName, strResult, objLogInfo);
                                // return callback(strResult);
                                return callback(prepareErrorData(error, 'ERR-RES-71601', 'Error in saveBurnMarkupToDB function'));
                            } else {
                                data = new Buffer.from(data, 'base64');
                                fs.unlink(filename, function (error) {
                                    if (error) {
                                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-RES-71605', 'Error in saveBurnMarkupToDB function', error);
                                    } else {
                                        reqInstanceHelper.PrintInfo(serviceName, 'file successfully deleted', objLogInfo);
                                    }
                                });
                                reqTranDBInstance.GetTranDBConn(pHeaders, true, function (pSession) {
                                    try {
                                        mSession = pSession;
                                        reqCommon.SaveBurnedAtmt(pHeaders, pSession, pParams.TRNA_ID, pParams.pUserId, pParams.pAppUId, pParams.pLoginName, pParams.pClientId, data, pParams.AT_CODE, pParams.NEW_RELATIVE_PATH, pParams.ATMT_NAME, objLogInfo, function (objAttDetailResult) {
                                            try {
                                                var objCond = new Object();
                                                objCond['TRN_ID'] = pParams.TRNA_ID;
                                                reqTranDBInstance.DeleteTranDB(pSession, 'TRN_ANNOTATIONS', objCond, objLogInfo, function (result) {
                                                    try {
                                                        reqTranDBInstance.Commit(pSession, true, function callbackres(res) {
                                                            return callback(null, objAttDetailResult);
                                                        });
                                                    } catch (error) {
                                                        reqTranDBInstance.Commit(pSession, false, function callbackres(res) {
                                                            return callback(prepareErrorData(error, 'ERR-RES-71606', 'Error in saveBurnMarkupToDB function'));
                                                        });
                                                    }
                                                });
                                            } catch (error) {
                                                reqTranDBInstance.Commit(pSession, false, function callbackres(res) {
                                                    return callback(prepareErrorData(error, 'ERR-RES-71607', 'Error in saveBurnMarkupToDB function'));
                                                });
                                            }
                                        });
                                    } catch (error) {
                                        reqTranDBInstance.Commit(pSession, false, function callbackres(res) {
                                            return callback(prepareErrorData(error, 'ERR-RES-71608', 'Error in saveBurnMarkupToDB function'));
                                        });
                                    }
                                });
                            }
                        });
                    });
                }
            } catch (error) {
                return callback(prepareErrorData(error, 'ERR-RES-71609', 'Error in saveBurnMarkupToDB function'));
            }
        });
    } catch (error) {
        return callback(prepareErrorData(error, 'ERR-RES-71610', 'Error in saveBurnMarkupToDB function'));
    }
}



function prepareErrorData(error, errorCode, errorMessage) {
    var errJson = {
        ERROR: error,
        ERROR_CODE: errorCode,
        ERROR_MESSAGE: errorMessage
    };
    return errJson;
}

module.exports = {
    SaveBurnMarkupToDB: saveBurnMarkupToDB,
    FinishApiCall: finishApiCall
};
/******** End of File *******/