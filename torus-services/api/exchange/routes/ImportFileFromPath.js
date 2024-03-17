/**
 * @Api_Name        : /ImportFile,
 * @Description     : Import file from specified path,
 * @Last_Error_Code : ERR-IMPORTFILEFROMPATH-1002
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
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');
var router = reqExpress.Router();
var reqLogInfo = require(refPath + 'log/trace/LogInfo');
var reqAuditLog = require(refPath + 'log/audit/AuditLog');
var async = require(modPath + 'async');
var serviceName = "ImportFile";

router.post('/ImportFileFromPath', function (appRequest, appResponse) {
    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
        reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo);
        var CLIENT_ID = objSessionInfo.CLIENT_ID;
        var TENANT_ID = objSessionInfo.TENANT_ID;
        objLogInfo.HANDLER_CODE = 'EXG_FILE_UPDATE';
        objLogInfo.PROCESS = 'EXG_FILE_UPDATE';
        objLogInfo.ACTION_DESC = 'IMPORT_FILE';

        appResponse.on('close', function () { });
        appResponse.on('finish', function () { });
        appResponse.on('end', function () { });
        try {
            var mHeaders = appRequest.headers;
            var importFileObj = appRequest.body.PARAMS;
            var selected_files = importFileObj.Selected_items;
            getDBInstances(mHeaders, objLogInfo, function (DBInstance) {
                Object.assign(importFileObj, DBInstance);
                importFileObj["session"] = objSessionInfo;
                importFileObj["objLogInfo"] = objLogInfo;
                importFileObj["SESSION_ID"] = appRequest.body.SESSION_ID;
                async.series([
                    function (asyncCallback) {
                        // to prevent code rework
                        importFileObj.hasSystemID = false;
                        if (importFileObj.hasSystemID) {
                            reqExchangeHelper.GetSystemGateways(importFileObj, function (respSysGateways) {
                                if (respSysGateways.STATUS === "SUCCESS") {
                                    importFileObj.EXFFG_CODE = respSysGateways.SUCCESS_DATA.exffg_code;
                                    importFileObj.EXG_CODE = respSysGateways.SUCCESS_DATA.exg_code;
                                    asyncCallback();
                                } else {
                                    return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, respSysGateways.ERROR_CODE, respSysGateways.ERROR_MESSAGE, respSysGateways.ERROR_OBJECT);
                                }
                            })
                        } else {
                            asyncCallback();
                        }
                    },
                    function (asyncCallback) {
                        importFileObj.FROM_UPDATE_FILES = true;
                        var arrExhfID = [];
                        for (var i = 0; i < selected_files.length; i++) {
                            if (selected_files[i] && Object.keys(selected_files[i]).length) {
                                selected_files[i]["status"] = selected_files[i]["STATUS"];
                                selected_files[i]["fileName"] = selected_files[i]["name"];
                                arrExhfID.push(selected_files[i].hf_id);
                            }
                        }
                        if (arrExhfID.length) {
                            importFileObj["headers"] = mHeaders;
                            reqAuditLog.GetProcessToken(importFileObj.tran_db_instance, objLogInfo, function (err, prct_id) {
                                objLogInfo.PROCESS_INFO.PRCT_ID = prct_id;
                                var modifiedDate = reqDateFormatter.GetCurrentDateInUTC(mHeaders, objLogInfo);
                                var ex_header_files_prct_update_qry = "update EX_HEADER_FILES set prct_id = '" + prct_id + "', MODIFIED_DATE =  '" + modifiedDate + "' where file_status = 'DOWNLOADED' and exhf_id in (" + arrExhfID.toString() + ")";
                                reqInstanceHelper.PrintInfo(serviceName, 'New Prct_id update query - ' + ex_header_files_prct_update_qry, objLogInfo);
                                reqTranDBInstance.ExecuteSQLQuery(importFileObj.tran_db_instance, ex_header_files_prct_update_qry, objLogInfo, function (result, error) {
                                    if (error) {
                                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-EXC-1001', 'updating New PRCT_ID in the EX_HEADER_FILES Table is Failed...', error);
                                        return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-EXC-1001', 'Error while Updating New Prct_id in EX_HEADER_FILES...', error, "FAILURE", "FAILURE");
                                    } else {
                                        reqExchangeHelper.ImportFile(selected_files, importFileObj, function (responseData) {
                                            // console.log(JSON.stringify(responseData));
                                            if (responseData.STATUS === "SUCCESS") {
                                                return reqInstanceHelper.SendResponse(serviceName, appResponse, responseData.SUCCESS_DATA, objLogInfo, null, null, null);
                                            } else {
                                                return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, responseData.ERROR_CODE, responseData.ERROR_MESSAGE, responseData.ERROR_OBJECT, "FAILURE", "FAILURE");
                                            }
                                        });
                                    }
                                });
                            });
                        } else {
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-IMPORTFILEFROMPATH-1002', 'Please Select Atleast One File...', '');
                            return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-IMPORTFILEFROMPATH-1002', 'Please Select Atleast One File...', '', 'FAILURE', 'FAILURE');
                        }
                    }
                ]);
            });
        } catch (error) {
            return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-EXC-10000', 'Exception Occured While Calling ImportFile API ... ', error);
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
            callBackDBInstance(obj);
        } else {
            callBackDBInstance(result);
        }
    });
}

module.exports = router;