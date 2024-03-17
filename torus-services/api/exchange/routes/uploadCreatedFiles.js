/**
 * @Api_Name        : /UploadCreatedFiles,
 * @Description     : Export file from specified path,
 * @Last_Error_Code : ERR-EXG-1060
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
var serviceName = "UploadCreatedFiles";


router.post('/UploadCreatedFiles', function (appRequest, appResponse) {
    var inputRequest = appRequest.body.PARAMS;
    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
        reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo);
        objLogInfo.HANDLER_CODE = 'EXG_FILE_CREATION_UPLOAD';
        objLogInfo.PROCESS = 'EXG_FILE_CREATION-Upload';
        objLogInfo.ACTION_DESC = 'UploadCreatedFiles';

        appResponse.on('close', function () { });
        appResponse.on('finish', function () { });
        appResponse.on('end', function () { });
        try {
            var mHeaders = appRequest.headers;
            var params = appRequest.body.PARAMS;
            getDBInstances(mHeaders, objLogInfo, function (DBInstance) {
                Object.assign(inputRequest, DBInstance);
                inputRequest["objSessionInfo"] = objSessionInfo;
                inputRequest["session"] = objSessionInfo;
                inputRequest['tenant_id'] = objSessionInfo['TENANT_ID'];
                inputRequest['objLogInfo'] = objLogInfo;
                inputRequest['from_scheduler'] = true;
                inputRequest.clt_cas_instance = DBInstance.clt_cas_instance;
                reqTranDBInstance.GetTranDBConn(mHeaders, false, function (tran_db_instance) {
                    inputRequest.tran_db_instance = tran_db_instance;
                    inputRequest.headers = mHeaders;
                    inputRequest.upload_file_limit_count = params.upload_file_limit_count;
                    var FFG_CODE = params.EXFFG_CODE;
                    inputRequest.SERVICE_LOG_FOLDER_PATH = reqPath.join(__dirname, '../service_logs/upload/' + objSessionInfo.TENANT_ID + '/' + objSessionInfo.APP_ID + '/' + FFG_CODE + '/');
                    reqExchangeHelper.CheckServiceLogForFileUploadProcess(inputRequest, function () {
                        reqExchangeHelper.GetCreatedFiles(inputRequest, function (pErrorCode, pErrorMesg, pErrorObj, pArrResponseData) {
                            try {
                                if (pErrorCode) {
                                    reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, pErrorCode, pErrorMesg, pErrorObj);
                                }
                                else if (pArrResponseData.length) {
                                    reqFXDBInstance.GetFXDBConnection(mHeaders, 'dep_cas', objLogInfo, function (dep_cas_instance) {
                                        try {
                                            inputRequest.dep_cas_instance = dep_cas_instance;
                                            reqExchangeHelper.GetGatewayDetails(inputRequest, function (resGatewayDetails) {
                                                inputRequest.GatewayDetails = resGatewayDetails;
                                                inputRequest.Selected_items = pArrResponseData;
                                                reqExchangeHelper.UploadFileProcess(inputRequest, function (pErrorCode, pErrorMesg, pErrorObj, pStrResponseData) {
                                                    if (!pStrResponseData) {
                                                        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, pErrorCode, pErrorMesg, pErrorObj);
                                                    }
                                                    else {
                                                        reqInstanceHelper.SendResponse(serviceName, appResponse, pStrResponseData, objLogInfo, null, null, null);
                                                    }
                                                });
                                            });
                                        } catch (error) {
                                            reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-EXC-1002', 'Catch Error in GetFXDBConnection()...', error);
                                        }
                                    });
                                } else {
                                    reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-EXC-1000', 'There is No Eligiblity File Names for this process...', '');
                                }
                            } catch (error) {
                                reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-EXC-1001', 'Catch Error in GetCreatedFiles()', error);
                            }
                        });
                    })
                });
            });
        } catch (error) {
            return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-EXC-1003', 'Exception Occured While Calling SaveGateways API ... ', error);
        }
    });

    function getDBInstances(mHeaders, objLogInfo, callBackDBInstance) {
        var obj = {
            "clt_cas_instance": ""
        };

        async.series({
            clt_cas_instance: function (callbackAsync) {
                reqFXDBInstance.GetFXDBConnection(mHeaders, 'clt_cas', objLogInfo, function (clt_cas_instance) {
                    callbackAsync(null, clt_cas_instance);
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

});



module.exports = router;