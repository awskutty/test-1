/**
 * @Api_Name        : /ImportFile,
 * @Description     : Import file from specified path
 * @Last_Error_Code : ERR-EXC-1000
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
var router = reqExpress.Router();
var reqLogInfo = require(refPath + 'log/trace/LogInfo');
var async = require(modPath + 'async');
var serviceName = "ImportFile";
var reqAuditLog = require(refPath + 'log/audit/AuditLog');

router.post('/Import', function (appRequest, appResponse) {
    var objLogInfo = "";
    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {

        reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo)
        var CLIENT_ID = objSessionInfo.CLIENT_ID;
        objLogInfo.HANDLER_CODE = 'EXG_FILE_CREATION';
        objLogInfo.PROCESS = 'EXG_FILE_CREATION-ExportFile';
        objLogInfo.ACTION_DESC = 'ExportFile';

        appResponse.on('close', function () {});
        appResponse.on('finish', function () {});
        appResponse.on('end', function () {});
        try {
            var fileParams = appRequest.files;
            var fileCount = Object.keys(fileParams).length;

            //appRequest.body.PARAMS = JSON.parse(appRequest.body.PARAMS);

            var fileContents = [];

            // fileObj.fileName = fileParams.files.name;
            // fileObj.fileContent = fileParams.files.data;
            // fileContents.push(fileObj);

            for (var index = 0; index < fileCount; index++) {
                var fileObj = {};
                fileObj.name = fileParams["FILE_" + index].name;
                fileObj.fileContent = fileParams["FILE_" + index].data;
                fileContents.push(fileObj);
            }

            var mHeaders = appRequest.headers;
            var reqBody = JSON.parse(appRequest.body.PARAMS);
            var importFileObj = reqBody;
            importFileObj["headers"] = mHeaders;
            importFileObj['tenant_id'] = objSessionInfo.TENANT_ID;
            importFileObj['TENANT_ID'] = objSessionInfo.TENANT_ID;

            var updateFromComponent = importFileObj.updateFromComponent || false;

            getDBInstances(mHeaders, objLogInfo, function (DBInstance) {
                Object.assign(importFileObj, DBInstance);
                reqAuditLog.GetProcessToken(DBInstance.tran_db_instance, objLogInfo, function (err, prct_id) {
                    try {
                        if (err) {
                            return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-CODE', 'Error in GetProcessToken() function ... ', err, "", "");
                        }
                        objLogInfo.PROCESS_INFO.PRCT_ID = prct_id;
                        importFileObj["session"] = objSessionInfo;
                importFileObj["objLogInfo"] = objLogInfo;
                importFileObj["SESSION_ID"] = appRequest.body.SESSION_ID;
                        async.series([
                            // function (asyncCallback){
                            //         if(updateFromComponent){
                            //            // var fileID = importFileObj.
                            //         }
                            //         else{
                            //             asyncCallback()
                            //         }
                            // },
                            function (asyncCallback) {
                                // to prevent code rework
                                //commented to obtain id
                              //  importFileObj.hasSystemID = true;
                                if (importFileObj.hasSystemID) {
                                    reqExchangeHelper.GetSystemGateways(importFileObj, function (respSysGateways) {
                                        if (respSysGateways.STATUS === "SUCCESS") {
                                            importFileObj.EXFFG_CODE = respSysGateways.SUCCESS_DATA.exffg_code;
                                       // importFileObj.EXG_CODE = respSysGateways.SUCCESS_DATA.exg_code;
                                            //Object.assign(exportFileObj,respSysGateways.SUCCESS_DATA)
                                            asyncCallback();
                                        } else {
                                            asyncCallback();
                                           // return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, respSysGateways.ERROR_CODE, respSysGateways.ERROR_MESSAGE, respSysGateways.ERROR_OBJECT);
                                        }
                                    })
                                } else {
                                    asyncCallback();
                                }
                            },
                            function (asyncCallback) {
                                reqExchangeHelper.ImportFile(fileContents, importFileObj, function (responseData) {
                                    if (responseData.STATUS === "SUCCESS") {
                                        return reqInstanceHelper.SendResponse(serviceName, appResponse, responseData, objLogInfo, null, null, null);
                                    } else {
                                        return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, responseData.ERROR_CODE, responseData.ERROR_MESSAGE, responseData.ERROR_OBJECT,"FAILURE","FAILURE");
                                    }
                                    asyncCallback();
                                });
                            }
                        ]);
                    } catch (error) {
                        return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-CODE', 'Catch Error in GetProcessToken() function ... ', error, "", "");
                    }
                });

                  });
        } catch (error) {
            return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-EXC-10000', 'Exception Occured While Calling ImportFile API ... ', error);
        }
    });
});


function getDBInstances(mHeaders, objLogInfo, callBackDBInstance) {
    var obj = {
        "dev_cas_instance": "",
        "dep_cas_instance": "",
        "clt_cas_instance": "",
        "res_cas_instance": "",
        "tran_db_instance": ""
    };

    async.series({
       /*  dev_cas_instance: function (callbackAsync) {
            reqFXDBInstance.GetFXDBConnection(mHeaders, 'dev_cas', objLogInfo, function (dev_cas_instance) {
                callbackAsync(null, dev_cas_instance);
            });
        }, */
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