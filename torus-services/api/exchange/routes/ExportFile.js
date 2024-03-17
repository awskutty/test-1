/**
 * @Api_Name        : /ExportFile,
 * @Description     : Export file to specified path,
 * @Last_Error_Code : ERR-EXG-120001
 */

// Require dependencies
var dir_path = '../../../../';
var modPath = dir_path + 'node_modules/';
var refPath = dir_path + 'torus-references/';
var reqExpress = require(modPath + 'express');
var reqInstanceHelper = require(refPath + 'common/InstanceHelper');
var reqFXDBInstance = require(refPath + 'instance/DBInstance');
var reqTranDBInstance = require(refPath + 'instance/TranDBInstance');
var reqExchangeHelper = require('./helper/ExchangeHelper');
var reqLogInfo = require(refPath + 'log/trace/LogInfo');
var serviceName = "ExportFile";
var async = require(modPath + 'async');
var router = reqExpress.Router();
var reqAuditLog = require(refPath + 'log/audit/AuditLog');

router.post('/Export', function (appRequest, appResponse) {
    var objLogInfo = "";
    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {

        reqInstanceHelper.PrintInfo(serviceName, 'Export File Process Begin', objLogInfo)
        var CLIENT_ID = objSessionInfo.CLIENT_ID;
        objLogInfo.HANDLER_CODE = 'EXG_FILE_CREATION';
        objLogInfo.PROCESS = 'EXG_FILE_CREATION-ExportFile';
        objLogInfo.ACTION_DESC = 'ExportFile';

        appResponse.on('close', function () { });
        appResponse.on('finish', function () { });
        appResponse.on('end', function () { });

        try {
            var mHeaders = appRequest.headers;
            var reqBody = appRequest.body.PARAMS;
            //:toremove
            // reqBody.WRITE_METHOD = "INSTANCE";
            var writeMethod = reqBody.WRITE_METHOD || "";
            var exportFileObj = reqBody;

            var EXFFG_CODE = reqBody.EXFFG_CODE || "";
            exportFileObj['tenant_id'] = objSessionInfo.TENANT_ID;
            exportFileObj['TENANT_ID'] = objSessionInfo.TENANT_ID;

            exportFileObj.WRITE_METHOD = writeMethod;
            exportFileObj.WFTPA_ID = reqBody.WFTPA_ID || "";
            exportFileObj.EXFFG_ID = reqBody.EXFFG_ID || "";
            exportFileObj.EXS_ID = reqBody.EXS_ID || "";
            exportFileObj.DTT_CODE = reqBody.DTT_CODE || "";
            exportFileObj.DT_CODE = reqBody.DT_CODE || "";
            exportFileObj.EXSG_ID = reqBody.EXSG_ID || "";
            exportFileObj.URL = reqBody.URL || "";
            exportFileObj.FILTERS = reqBody.FILTERS || "";
            exportFileObj.DATA_BINDING = reqBody.DATA_BINDING || "";
            exportFileObj.TOKEN_ID = reqBody.TOKEN_ID || "";
            exportFileObj.EXG_CODE = reqBody.EXG_CODE
            exportFileObj.objLogInfo = objLogInfo;
            exportFileObj.mHeaders = mHeaders;

            reqInstanceHelper.PrintInfo(serviceName, 'Obtaining DB Instances', objLogInfo)
            getDBInstances(mHeaders, objLogInfo, function (DBInstance) {

                Object.assign(exportFileObj, DBInstance);
                exportFileObj["session"] = objSessionInfo;
                reqAuditLog.GetProcessToken(DBInstance.tran_db_instance, objLogInfo, function (err, prct_id) {
                    try {
                        if (err) {
                            return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-CODE', 'Error in GetProcessToken() function ... ', err, "", "");
                        }
                        objLogInfo.PROCESS_INFO.PRCT_ID = prct_id;
                        async.series([
                            function (asyncCallback) {
                                // to prevent code change
                                if (exportFileObj.hasSystemID) {
                                    reqInstanceHelper.PrintInfo(serviceName, 'Getting System Gateways', objLogInfo)
                                    reqExchangeHelper.GetSystemGateways(exportFileObj, function (respSysGateways) {
                                        reqInstanceHelper.PrintInfo(serviceName, 'System Gateway calling ends', objLogInfo)
                                        if (respSysGateways.STATUS === "SUCCESS") {
                                            if (EXFFG_CODE == "") {
                                                exportFileObj.EXFFG_CODE = respSysGateways.SUCCESS_DATA.exffg_code;
                                            }
                                            else {
                                                exportFileObj.EXFFG_CODE = EXFFG_CODE;
                                            }
                                            asyncCallback();
                                        } else {
                                            return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, respSysGateways.ERROR_CODE, respSysGateways.ERROR_MESSAGE, respSysGateways.ERROR_OBJECT, "", "");
                                        }
                                    })
                                } else {
                                    asyncCallback();
                                }
                            },
                            function (asyncCallback) {
                                reqExchangeHelper.Getstoragepath(exportFileObj, function (storagePath) {
                                    var fileUploadLinuxPath = 'Upload/' + objSessionInfo.TENANT_ID + '/' + objSessionInfo.APP_ID + '/' + EXFFG_CODE + '/';
                                    storagePath = storagePath ? (storagePath + fileUploadLinuxPath) : fileUploadLinuxPath;
                                    exportFileObj.storagePath = storagePath;
                                    reqInstanceHelper.PrintInfo(serviceName, 'Storage path is ' + storagePath, objLogInfo);
                                    reqInstanceHelper.PrintInfo(serviceName, 'Export File method called', objLogInfo)
                                    reqExchangeHelper.ExportFile(exportFileObj, appRequest, function (responseData) {
                                        reqInstanceHelper.PrintInfo(serviceName, 'Export File method calling ends', objLogInfo)

                                        if (writeMethod == "INSTANCE") {
                                            var fs = require('fs');

                                            var data = {};
                                            data.type = "INSTANCE";
                                            try {
                                                data.file_name = responseData.SUCCESS_DATA.adapterObj.FILE_FORMAT_OBJ.FILE_NAME;
                                            }
                                            catch (ex) {
                                                data.file_name = "";
                                            }

                                            return reqInstanceHelper.SendResponse(serviceName, appResponse, data, objLogInfo, null, null, null, "", "");
                                        }
                                        else {
                                            if (responseData.STATUS === "SUCCESS") {
                                                return reqInstanceHelper.SendResponse(serviceName, appResponse, responseData.SUCCESS_DATA, objLogInfo, null, null, null, "", "");
                                            } else {
                                                return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, responseData.ERROR_CODE, responseData.ERROR_MESSAGE, responseData.ERROR_OBJECT, "", "");
                                            }
                                        }
                                    });

                                });
                            }
                        ]);
                    } catch (error) {
                        return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-CODE', 'Catch Error in GetProcessToken() function ... ', error, "", "");
                    }
                });
            });
        } catch (error) {
            return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-EXG-120001', 'Exception Occured While Calling ExportFile API ... ', error, "", "");
        }
    });
});

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
            reqInstanceHelper.PrintInfo(serviceName, 'Error While Obtaining DB Instance ' + JSON.stringify(error), objLogInfo)
            callBackDBInstance(obj);
        } else {
            callBackDBInstance(result);
        }
    });
}

module.exports = router;