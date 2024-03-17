/**
 * @Api_Name        : /DeleteSysLinkgateways,
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
var reqTranDBInstance = require(refPath + 'instance/TranDBInstance');
var reqExchangeHelper = require('./helper/ExchangeHelper');
var reqDateFormatter = require(refPath + 'common/dateconverter/DateFormatter')
var router = reqExpress.Router();
var reqLogInfo = require(refPath + 'log/trace/LogInfo');
var async = require(modPath + 'async');
var serviceName = "SaveGateways";
var common = require('./util/Common')

router.post('/DeleteSysLinkgateways', function (appRequest, appResponse) {
    var objLogInfo = "";
    var inputRequest = appRequest.body.PARAMS;

    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {

        reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo)
        var CLIENT_ID = objSessionInfo.CLIENT_ID;
        var APP_ID = objSessionInfo.APP_ID;
        inputRequest['tenant_id'] = objSessionInfo.TENANT_ID;
inputRequest['TENANT_ID'] = objSessionInfo.TENANT_ID;
        objLogInfo.HANDLER_CODE = 'DELETESYSLINKGATEWAYS';
        objLogInfo.PROCESS = 'DELETESYSLINKGATEWAYS_PROCESS';
        objLogInfo.ACTION_DESC = '';

        appResponse.on('close', function () { });
        appResponse.on('finish', function () { });
        appResponse.on('end', function () { });
        try {
            var mHeaders = appRequest.headers;
            var deleteFor = inputRequest.DELETE_FOR;
            var tableName = "";
            var condition = {};

            if (deleteFor == "GATEWAYS") {
                tableName = "ex_gateways";
                condition = {
                    "CLIENT_ID": CLIENT_ID,
                    "APP_ID": APP_ID,
                    "EXG_CODE": inputRequest.gw_code,
                }

            } else if (deleteFor == "SYSLINK") {
                tableName = "ex_systems";
                condition = {
                    //"EXSG_ID": inputRequest.exsg_id,
                    "CLIENT_ID": CLIENT_ID,
                    "APP_ID": APP_ID,
                    "TENANT_ID": inputRequest.tenant_id,
                    "EXS_CODE": inputRequest.exs_code
                }
            } else if (deleteFor == "SYSTEM_GATEWAYS") {
                tableName = "ex_system_gateways";
                condition = {
                    "CLIENT_ID": CLIENT_ID,
                    "APP_ID": APP_ID,
                    "TENANT_ID": inputRequest.tenant_id,
                    "EXSG_ID": inputRequest.exsg_code
                }
            }
            else if (deleteFor == "EXG_MENU_SETUP") {
                tableName = "ex_menu_setup";
                condition = {
                    "CLIENT_ID": CLIENT_ID,
                    "APP_ID": APP_ID,
                    "TENANT_ID": inputRequest.tenant_id,
                    "MENU_ITEM_CODE": inputRequest.menu_item_code
                }
            }
            else{

            }

            reqFXDBInstance.GetFXDBConnection(mHeaders, 'dep_cas', objLogInfo, function (dep_cas_instance) {
                reqFXDBInstance.GetFXDBConnection(mHeaders, 'clt_cas', objLogInfo, function (clt_cas_instance) {
                    reqFXDBInstance.DeleteFXDB(dep_cas_instance, tableName, condition, objLogInfo, function (error, result) {
                        if (error) {
                            return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-EXC-', 'Exception Occured deletion ', error);
                        } else {
                            return reqInstanceHelper.SendResponse(serviceName, appResponse, "Deleted Successfully", objLogInfo, null, null, null);
                        }
                    });
                });
            });
        } catch (error) {
            return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-EXC-', 'Exception Occured While Calling SaveGateways API ... ', error);
        }
    });
});


module.exports = router;