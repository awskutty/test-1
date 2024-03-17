/**
 * @Api_Name        : /ImportFile,
 * @Description     : Import file from specified path,
 * @Last_Error_Code : ERR-EXC-1002
 */

// Require dependencies
var dir_path = '../../../../';
var modPath = dir_path + 'node_modules/';
var refPath = dir_path + 'torus-references/';
var reqExpress = require(modPath + 'express');
var reqInstanceHelper = require(refPath + 'common/InstanceHelper');
var reqFXDBInstance = require(refPath + 'instance/DBInstance');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqExchangeHelper = require('./helper/ExchangeHelper');
var router = reqExpress.Router();
var reqLogInfo = require(refPath + 'log/trace/LogInfo');
var async = require(modPath + 'async');
var reqPath = require('path');
var serviceName = "UploadFile";
var commonFile = require('./util/Common');

router.post('/Upload', function (appRequest, appResponse) {
    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {

        reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo)
        //reqObj['TENANT_ID'] = objSessionInfo.TENANT_ID;
        objLogInfo.HANDLER_CODE = 'EXG_FILE_CREATION';
        objLogInfo.PROCESS = 'EXG_FILE_CREATION-ExportFile';
        objLogInfo.ACTION_DESC = 'ExportFile';

        appResponse.on('close', function () { });
        appResponse.on('finish', function () { });
        appResponse.on('end', function () { });
        try {
            var mHeaders = appRequest.headers;
            var reqBody = appRequest.body.PARAMS;
            reqBody.objSessionInfo = objSessionInfo;
            reqBody.objLogInfo = objLogInfo;
            reqBody['tenant_id'] = objSessionInfo['TENANT_ID'];
            reqBody.from_screen = true;
            var FFG_CODE = reqBody.EXFFG_CODE;
            reqBody.SERVICE_LOG_FOLDER_PATH = reqPath.join(__dirname, '../service_logs/upload/' + objSessionInfo.TENANT_ID + '/' + objSessionInfo.APP_ID + '/' + FFG_CODE + '/');
            reqFXDBInstance.GetFXDBConnection(mHeaders, 'dep_cas', objLogInfo, function (dep_cas_instance) {
                reqFXDBInstance.GetFXDBConnection(mHeaders, 'clt_cas', objLogInfo, function (clt_cas_instance) {
                    reqTranDBInstance.GetTranDBConn(mHeaders, false, function (tran_db_instance) {
                        reqBody.dep_cas_instance = dep_cas_instance;
                        reqBody.clt_cas_instance = clt_cas_instance;
                        reqBody.tran_db_instance = tran_db_instance;
                        reqBody.headers = mHeaders;
                        reqExchangeHelper.CheckServiceLogForFileUploadProcess(reqBody, function () {
                            //reqExchangeHelper.GetGatewayDetails(reqBody, function (resGatewayDetails) {

                            var exGatewayCond = {
                                'exg_code': reqBody.EXG_CODE,
                                'client_id': reqBody.objSessionInfo.CLIENT_ID,
                                'app_id': reqBody.objSessionInfo.APP_ID
                            }
                            reqExchangeHelper.GetExGatewayDetails(reqBody.dep_cas_instance, exGatewayCond, objLogInfo, function (perr, resGatewayDetails) {
                                reqBody.GatewayDetails = {
                                    SUCCESS_DATA: resGatewayDetails.rows[0]
                                }
                                // reqBody.GatewayDetails = resGatewayDetails.rows[0];

                                reqExchangeHelper.UploadFileProcess(reqBody, function (pErrorCode, pErrorMesg, pErrorObj, pStrResponse) {
                                    try {
                                        reqInstanceHelper.SendResponse(serviceName, appResponse, pStrResponse, objLogInfo, pErrorCode, pErrorMesg, pErrorObj);
                                    } catch (error) {
                                        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-EXC-10002', 'Catch Error in uploadFileProcess()', error);
                                    }
                                })
                            });
                        });

                    });
                });
            });
        } catch (error) {
            return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-EXC-10000', 'Exception Occured While Calling ImportFile API ... ', error);
        }
    });
});


function getGatewayCode(reqObj, callBack) {
    var resObj = {};
    try {
        reqFXDBInstance.GetTableFromFXDB(reqObj.dep_cas_instance, 'ex_systems ', [], {
            "CLIENT_ID": reqObj.objSessionInfo.CLIENT_ID,
            "APP_ID": reqObj.objLogInfo.APP_ID,
            "TENANT_ID": reqObj.TENANT_ID,
            "SOURCE_S_ID": reqObj.objSessionInfo.S_ID,
            "DST_S_ID": reqObj.Des_sys,
            "EXFFG_CODE": reqObj.EXFFG_CODE,
            "EXG_CODE": reqObj.EXG_CODE
        }, reqObj.objLogInfo, function (error, result) {
            if (error) {
                resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "ERR", "", error, "", "");
            } else {
                resObj = commonFile.prepareMethodResponse("SUCCESS", "", result[0]["exg_code"], "", "", "", "", "");
            }
            callBack(resObj)
        });
    } catch (error) {
        resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "ERR", "Exception occured in getGatewayCode", error, "", "");
        callBack(resObj)
    }
}

function getDBInstances(mHeaders, objLogInfo, callBackDBInstance) {
    var obj = {
        "dep_cas_instance": "",
        "clt_cas_instance": "",
        "res_cas_instance": "",
        "tran_db_instance": ""
    };

    async.series({
        dep_cas_instance: function (callbackAsync) {
            reqFXDBInstance.GetFXDBConnection(mHeaders, 'dep_cas', objLogInfo, function (dep_cas_instance) {
                callbackAsync(null, dep_cas_instance);
            });
        },
        clt_cas_instance: function (callbackAsync) {
            reqFXDBInstance.GetFXDBConnection(mHeaders, 'clt_cas', objLogInfo, function (clt_cas_instance) {
                callbackAsync(null, clt_cas_instance);
            });
        },
        res_cas_instance: function (callbackAsync) {
            reqFXDBInstance.GetFXDBConnection(mHeaders, 'res_cas', objLogInfo, function (res_cas_instance) {
                callbackAsync(null, res_cas_instance);
            });
        },
        tran_db_instance: function (callbackAsync) {
            reqTranDBInstance.GetTranDBConn(mHeaders, false, function (tran_db_instance) {
                callbackAsync(null, tran_db_instance);
            });
        }
    }, function (error, result) {
        if (error) {
            callBackDBInstance(obj);
        } else {
            callBackDBInstance(result);
        }
    });
}

module.exports = router;