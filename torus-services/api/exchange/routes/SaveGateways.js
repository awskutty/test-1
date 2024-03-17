/**
 * @Api_Name        : /SaveGateways,
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
var reqExchangeHelper = require('./helper/ExchangeHelper')
var serviceName = "SaveGateways";
var reqAuditLog = require('../../../../torus-references/log/audit/AuditLog');
var reqTranDBHelper = require('../../../../torus-references/instance/TranDBInstance')

var serviceModel = reqFXDBInstance.DBInstanceSession['SERVICE_MODEL'];
router.post('/SaveGateways', function (appRequest, appResponse) {
    var inputRequest = appRequest.body.PARAMS;
    var mHeaders = appRequest.headers;
    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
        objLogInfo.PROCESS_INFO.PROCESS_NAME = 'Save_Gateways';
        reqTranDBHelper.GetTranDBConn(mHeaders, false, function (tran_db_instance) {
            reqAuditLog.GetProcessToken(tran_db_instance, objLogInfo, function (error, prct_id) {
                var isLatestPlatformVersion = false;
                if (serviceModel && serviceModel.PLATFORM_VERSION == '7.0') {
                    reqInstanceHelper.PrintInfo(serviceName, 'Platform Version - ' + serviceModel.PLATFORM_VERSION, objLogInfo);
                    isLatestPlatformVersion = true;
                }
                reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo)
                var CLIENT_ID = objSessionInfo.CLIENT_ID;
                var TENANT_ID = objSessionInfo.TENANT_ID;
                var APP_ID = objSessionInfo.APP_ID;
                var EXG_CODE = inputRequest.gw_code;
                var GATEWAY_CONFIG = inputRequest.gw_config || "";
                var GATEWAY_NAME = inputRequest.gw_name;
                var GATEWAY_TYPE = inputRequest.gw_type;
                var READ_PATH = inputRequest.gw_read_path;
                var WRITE_PATH = inputRequest.gw_write_path;
                var CREATED_BY = objSessionInfo.USER_ID;

                objLogInfo.HANDLER_CODE = 'SAVEGATEWAYS';
                objLogInfo.PROCESS = 'SAVEGATEWAYS_PROCESS';
                objLogInfo.ACTION_DESC = 'SAVEGATEWAYS';

                appResponse.on('close', function () { });
                appResponse.on('finish', function () { });
                appResponse.on('end', function () { });
                try {

                    reqFXDBInstance.GetFXDBConnection(mHeaders, 'dep_cas', objLogInfo, async function (dep_cas_instance) {
                        await reqFXDBInstance.setSearchPath(dep_cas_instance, ['tran_db', 'dep_cas'], objLogInfo);
                        var can_insert = true;
                        var exGatewayCond = {
                            'exg_code': EXG_CODE,
                            'client_id': CLIENT_ID,
                            'app_id': APP_ID
                        };
                        if (isLatestPlatformVersion) {
                            exGatewayCond.TENANT_ID = TENANT_ID;
                        }
                        reqFXDBInstance.GetTableFromFXDB(dep_cas_instance, 'ex_gateways', [], exGatewayCond, objLogInfo, async function (error, result) {
                            if (!error) {
                                if (result.rows.length > 0) {
                                    can_insert = false;
                                }
                            }

                            if (can_insert) {
                                var exGatewayInsertData = {};
                                exGatewayInsertData.GATEWAY_CONFIG = JSON.stringify(GATEWAY_CONFIG);
                                exGatewayInsertData.CLIENT_ID = CLIENT_ID;
                                exGatewayInsertData.APP_ID = APP_ID;
                                exGatewayInsertData.EXG_CODE = EXG_CODE;
                                if (isLatestPlatformVersion) {
                                    exGatewayInsertData.TENANT_ID = TENANT_ID;
                                }
                                exGatewayInsertData.GATEWAY_NAME = GATEWAY_NAME;
                                exGatewayInsertData.GATEWAY_TYPE = GATEWAY_TYPE;
                                exGatewayInsertData.HANDLER_CODE = '';
                                exGatewayInsertData.READ_PATH = READ_PATH;
                                exGatewayInsertData.WRITE_PATH = WRITE_PATH;
                                exGatewayInsertData.CREATED_BY = CREATED_BY;
                                exGatewayInsertData.CREATED_DATE = reqDateFormatter.GetTenantCurrentDateTime(mHeaders, objLogInfo);
                                exGatewayInsertData.prct_id = prct_id
                                reqFXDBInstance.InsertFXDB(dep_cas_instance, 'ex_gateways', [exGatewayInsertData], objLogInfo, function (pErr) {
                                    if (pErr) {
                                        return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-EXC-', 'Exception Occured While Calling ImportFile API ... ', pErr);
                                    } else {
                                        return reqInstanceHelper.SendResponse(serviceName, appResponse, "Gateways Saved Successfully", objLogInfo, null, null, null);
                                    }
                                });
                            } else {
                                if (isLatestPlatformVersion) {
                                    delete exGatewayCond.TENANT_ID;
                                }
                                reqFXDBInstance.UpdateFXDB(dep_cas_instance, 'ex_gateways', {
                                    "GATEWAY_CONFIG": JSON.stringify(GATEWAY_CONFIG),
                                    "GATEWAY_NAME": GATEWAY_NAME,
                                    "GATEWAY_TYPE": GATEWAY_TYPE,
                                    "HANDLER_CODE": "",
                                    "READ_PATH": READ_PATH,
                                    "WRITE_PATH": WRITE_PATH,
                                    "MODIFIED_BY": objSessionInfo.USER_ID,
                                    "MODIFIED_DATE": reqDateFormatter.GetTenantCurrentDateTime(mHeaders, objLogInfo),
                                    "prct_id": prct_id
                                }, exGatewayCond, objLogInfo, function (pErr, resData) {
                                    if (pErr) {
                                        return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-EXC-', 'Exception Occured While Calling ImportFile API ... ', pErr);
                                    } else {
                                        return reqInstanceHelper.SendResponse(serviceName, appResponse, "Gateways Saved Successfully", objLogInfo, null, null, null);
                                    }
                                });
                            }
                        });
                    });
                } catch (error) {
                    return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-EXC-', 'Exception Occured While Calling SaveGateways API ... ', error);
                }
            });
        });
    });
});


module.exports = router;