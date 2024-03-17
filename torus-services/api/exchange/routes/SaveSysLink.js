/**
 * @Api_Name        : /SaveSysLink,
 * @Description     : Import file from specified path,
 * @Last_Error_Code : ERR-EXC-1000
 */

// Require dependencies
var dir_path = '../../../../';
var modPath = dir_path + 'node_modules/';
var refPath = dir_path + 'torus-references/';
var reqExpress = require(modPath + 'express');
var reqInstanceHelper = require(refPath + 'common/InstanceHelper');
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqTranDBInstance = require(refPath + 'instance/TranDBInstance');
var reqExchangeHelper = require('./helper/ExchangeHelper');
var reqDateFormatter = require(refPath + 'common/dateconverter/DateFormatter')
var router = reqExpress.Router();
var reqLogInfo = require(refPath + 'log/trace/LogInfo');
var async = require(modPath + 'async');
var serviceName = "SaveGateways";
var reqAuditLog = require('../../../../torus-references/log/audit/AuditLog');
var reqTranDBHelper = require('../../../../torus-references/instance/TranDBInstance')
var common = require('./util/Common')

router.post('/SaveSysLink', function (appRequest, appResponse) {
    var objLogInfo = "";
    var inputRequest = appRequest.body.PARAMS;
    var tenant_id = inputRequest.tenant_id;
    var exg_code = inputRequest.exg_code;
    var exffg_code = inputRequest.exffg_code;
    var dst_s_id = inputRequest.dst_s_id;
    var source_s_id = inputRequest.source_s_id;
    var exs_id = inputRequest.exs_id;
    var Description = inputRequest.Description;


    var mHeaders = appRequest.headers;
    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
        objLogInfo.PROCESS_INFO.PROCESS_NAME = 'Save_SysLink';
        reqTranDBHelper.GetTranDBConn(mHeaders, false, function (tran_db_instance) {
            reqAuditLog.GetProcessToken(tran_db_instance, objLogInfo, function (error, prct_id) {
                reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo)
                var CLIENT_ID = objSessionInfo.CLIENT_ID;
                var APP_ID = objSessionInfo.APP_ID;
                var CREATED_DATE = new Date();
                tenant_id = objSessionInfo.TENANT_ID;

                objLogInfo.HANDLER_CODE = 'EXG_FILE_CREATION';
                objLogInfo.PROCESS = 'EXG_FILE_CREATION-ExportFile';
                objLogInfo.ACTION_DESC = '';

                appResponse.on('close', function () { });
                appResponse.on('finish', function () { });
                appResponse.on('end', function () { });
                try {

                    reqFXDBInstance.GetFXDBConnection(mHeaders, 'dep_cas', objLogInfo, function (dep_cas_instance) {
                        reqFXDBInstance.GetFXDBConnection(mHeaders, 'clt_cas', objLogInfo, function (clt_cas_instance) {

                            if (exs_id == "") {
                                common.UpdateandGetCounter(clt_cas_instance, objLogInfo, "EX_SYSTEMS", exs_id, function (status, exs_id) {
                                    if (status === "SUCCESS") {
                                        if (typeof (exs_id) == "number") {
                                            exs_id = "S_" + exs_id;
                                        }
                                        reqFXDBInstance.InsertFXDB(dep_cas_instance, 'ex_systems', [{
                                            "EXS_CODE": exs_id.toString(),
                                            "CLIENT_ID": CLIENT_ID,
                                            "APP_ID": APP_ID,
                                            "TENANT_ID": tenant_id,
                                            "SOURCE_S_ID": source_s_id,
                                            "DST_S_ID": dst_s_id,
                                            "EXFFG_CODE": exffg_code,
                                            // "EXG_CODE": exg_code,
                                            "DESCRIPTION": Description,
                                            "CREATED_BY": objSessionInfo.USER_ID,
                                            "CREATED_DATE": reqDateFormatter.GetTenantCurrentDateTime(mHeaders, objLogInfo),
                                            "prct_id": prct_id
                                        }], objLogInfo, function (pErr) {
                                            if (pErr) {
                                                return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-EXC-', 'Exception Occured While Calling ImportFile API ... ', pErr);
                                            } else {
                                                return reqInstanceHelper.SendResponse(serviceName, appResponse, "Gateways Saved Successfully", objLogInfo, null, null, null);
                                            }
                                        });
                                    } else {
                                        return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-EXC-', 'Error occured during updating fx total items', "");
                                    }
                                })
                            } else {
                                reqFXDBInstance.UpdateFXDB(dep_cas_instance, 'ex_systems', {
                                    "SOURCE_S_ID": source_s_id,
                                    "DST_S_ID": dst_s_id,
                                    "EXFFG_CODE": exffg_code,
                                    "DESCRIPTION": Description,
                                    "MODIFIED_BY": objSessionInfo.USER_ID,
                                    "MODIFIED_DATE": reqDateFormatter.GetTenantCurrentDateTime(mHeaders, objLogInfo),
                                    "prct_id": prct_id
                                }, {
                                    "CLIENT_ID": CLIENT_ID,
                                    "APP_ID": APP_ID,
                                    "TENANT_ID": tenant_id,
                                    "EXS_CODE": exs_id.toString()

                                }, objLogInfo, function (pErr, resData) {
                                    if (pErr) {
                                        return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-EXC-', 'Exception Occured While Calling ImportFile API ... ', pErr);
                                    } else {
                                        return reqInstanceHelper.SendResponse(serviceName, appResponse, "Gateways Saved Successfully", objLogInfo, null, null, null);
                                    }
                                });
                            }
                        })

                    });
                } catch (error) {
                    return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-EXC-', 'Exception Occured While Calling SaveGateways API ... ', error);
                }
            });
        });
    });
});


module.exports = router;