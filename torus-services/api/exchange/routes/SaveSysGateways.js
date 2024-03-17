/**
 * @Api_Name        : /SaveSysGateways,
 * @Description     : Import file from specified path,
 * @Last_Error_Code : ERR-EXC-1000
 */

// Require dependencies
var dir_path = '../../../../';
var modPath = dir_path + 'node_modules/';
var refPath = dir_path + 'torus-references/';
var reqExpress = require(modPath + 'express');
var reqInstanceHelper = require(refPath + 'common/InstanceHelper');
var reqFXDBInstance = require(refPath + 'instance/DBInstance');
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');
var router = reqExpress.Router();
var reqLogInfo = require(refPath + 'log/trace/LogInfo');
var serviceName = "SaveSysGateways";
var reqAuditLog = require('../../../../torus-references/log/audit/AuditLog');
var reqTranDBHelper = require('../../../../torus-references/instance/TranDBInstance')
var common = require('./util/Common');

router.post('/SaveSysGateways', function (appRequest, appResponse) {
    var inputRequest = appRequest.body.PARAMS;
    var mHeaders = appRequest.headers;
    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
        objLogInfo.PROCESS_INFO.PROCESS_NAME = 'Save_Sys_Gateways';
        reqTranDBHelper.GetTranDBConn(mHeaders, false, function (tran_db_instance) {
            reqAuditLog.GetProcessToken(tran_db_instance, objLogInfo, function (error, prct_id) {
                reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo);
                var CLIENT_ID = objSessionInfo.CLIENT_ID;
                var APP_ID = objSessionInfo.APP_ID;

                var exg_code = inputRequest.exg_code;
                var tenant_id = objSessionInfo.TENANT_ID;
                var exs_code = inputRequest.exs_code;
                var exsg_id = inputRequest.exsg_id;
                var CREATED_BY = objSessionInfo.USER_ID;

                objLogInfo.HANDLER_CODE = 'SAVESYSGATEWAYS';
                objLogInfo.PROCESS = 'SAVESYSGATEWAYS_PROCESS';
                objLogInfo.ACTION_DESC = 'SAVESYSGATEWAYS';

                appResponse.on('close', function () { });
                appResponse.on('finish', function () { });
                appResponse.on('end', function () { });
                try {
                    reqFXDBInstance.GetFXDBConnection(mHeaders, 'dep_cas', objLogInfo, function (dep_cas_instance) {
                        reqFXDBInstance.GetFXDBConnection(mHeaders, 'clt_cas', objLogInfo, function (clt_cas_instance) {

                            if (exsg_id == "" || exsg_id == undefined) {
                                common.UpdateandGetCounter(clt_cas_instance, objLogInfo, "EX_SYSTEM_GATEWAYS", exsg_id, function (status, exsg_id) {
                                    if (status === "SUCCESS") {
                                        if (typeof (exsg_id) == "number") {
                                            exsg_id = "SG_" + exsg_id;
                                        }
                                        reqFXDBInstance.InsertFXDB(dep_cas_instance, 'ex_system_gateways', [{
                                            "CLIENT_ID": CLIENT_ID,
                                            "APP_ID": APP_ID,
                                            "EXSG_ID": exsg_id,
                                            "EXS_CODE": exs_code,
                                            "EXG_CODE": exg_code,
                                            "TENANT_ID": tenant_id,
                                            "CREATED_BY": CREATED_BY,
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
                                reqFXDBInstance.UpdateFXDB(dep_cas_instance, 'ex_system_gateways', {
                                    "EXS_CODE": exs_code,
                                    "EXG_CODE": exg_code,
                                    "MODIFIED_BY": objSessionInfo.USER_ID,
                                    "MODIFIED_DATE": reqDateFormatter.GetTenantCurrentDateTime(mHeaders, objLogInfo),
                                    "prct_id": prct_id
                                }, {
                                    "CLIENT_ID": CLIENT_ID,
                                    "APP_ID": APP_ID,
                                    "EXSG_ID": exsg_id,
                                    "TENANT_ID": tenant_id

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