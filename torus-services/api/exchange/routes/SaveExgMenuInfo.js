/*
  @Decsription      : To Save Exchange Menu Informations
  @Last Error Code  : 'ERR-ExG-00003'
*/


var dir_path = '../../../../';
var modPath = dir_path + 'node_modules/';
var refPath = dir_path + 'torus-references/';
var reqExpress = require(modPath + 'express');
var reqInstanceHelper = require(refPath + 'common/InstanceHelper');
var reqFXDBInstance = require(refPath + 'instance/DBInstance');
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');
var router = reqExpress.Router();
var reqLogInfo = require(refPath + 'log/trace/LogInfo');
var serviceName = "SaveExgMenuInfo";
var reqAuditLog = require('../../../../torus-references/log/audit/AuditLog');
var reqTranDBHelper = require('../../../../torus-references/instance/TranDBInstance')

router.post('/SaveExgMenuInfo', function (appRequest, appResponse) {
    var inputRequest = appRequest.body.PARAMS;
    var mHeaders = appRequest.headers;
    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
        objLogInfo.PROCESS_INFO.PROCESS_NAME = 'Save_ExgMenuInfo';
        reqTranDBHelper.GetTranDBConn(mHeaders, false, function (tran_db_instance) {
            reqAuditLog.GetProcessToken(tran_db_instance, objLogInfo, function (error, prct_id) {
                reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo)
                var CLIENT_ID = objSessionInfo.CLIENT_ID;
                var APP_ID = objSessionInfo.APP_ID;
                var tenant_id = objSessionInfo.TENANT_ID;
                var menu_code = inputRequest.menu;
                var action_type = inputRequest.action;
                var dst_s_code = inputRequest.Destination_System;
                var exffg_code = inputRequest.exffg_code;
                var gw_code = inputRequest.exg_code;
                var menu_group_code = inputRequest.menu_group;
                var menu_item_code = inputRequest.menu_item;
                var needToInsert = inputRequest.isNewExgRecord || false;
                var CREATED_BY = objSessionInfo.USER_ID;
                var prct_id = prct_id;

                appResponse.on('close', function () { });
                appResponse.on('finish', function () { });
                appResponse.on('end', function () { });
                try {
                    var ex_menu_setup_obj = {
                        "GW_CODE": gw_code,
                        "ACTION_TYPE": action_type,
                        "EXFFG_CODE": exffg_code,
                        "MENU_GROUP_CODE": menu_group_code,
                        "MENU_CODE": menu_code,
                        "MODIFIED_BY": CREATED_BY,
                        "MODIFIED_DATE": reqDateFormatter.GetTenantCurrentDateTime(mHeaders, objLogInfo)
                    };
                    var condObj = {
                        "CLIENT_ID": CLIENT_ID,
                        "APP_ID": APP_ID,
                        "TENANT_ID": tenant_id,
                        "DST_S_CODE": dst_s_code,
                        "MENU_ITEM_CODE": menu_item_code,
                        "prct_id": prct_id
                    }
                    reqFXDBInstance.GetFXDBConnection(mHeaders, 'dep_cas', objLogInfo, function (dep_cas_instance) {
                        if (!needToInsert) {
                            reqFXDBInstance.UpdateFXDB(dep_cas_instance, 'ex_menu_setup', ex_menu_setup_obj, condObj, objLogInfo, function (pErr) {
                                if (pErr) {
                                    return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-EXG-00001', 'Exception Occured While Updating ex_menu_setup Table... ', pErr);
                                }
                                else {
                                    return reqInstanceHelper.SendResponse(serviceName, appResponse, "Menu Details Updated Successfully...", objLogInfo, null, null, null);
                                }
                            })
                        }
                        else {
                            var ex_menu_setup_Insert_obj = {
                                "CLIENT_ID": CLIENT_ID,
                                "APP_ID": APP_ID,
                                "TENANT_ID": tenant_id,
                                "GW_CODE": gw_code,
                                "ACTION_TYPE": action_type,
                                "DST_S_CODE": dst_s_code,
                                "EXFFG_CODE": exffg_code,
                                "MENU_GROUP_CODE": menu_group_code,
                                "MENU_ITEM_CODE": menu_item_code,
                                "MENU_CODE": menu_code,
                                "CREATED_BY": CREATED_BY,
                                "CREATED_DATE": reqDateFormatter.GetTenantCurrentDateTime(mHeaders, objLogInfo),
                                "prct_id": prct_id
                            };
                            reqFXDBInstance.InsertFXDB(dep_cas_instance, 'ex_menu_setup', [ex_menu_setup_Insert_obj], objLogInfo, function (pErr) {
                                if (pErr) {
                                    return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-EXG-00002', 'Exception Occured While Calling SaveExgMenuInfo API ... ', pErr);
                                }
                                else {
                                    return reqInstanceHelper.SendResponse(serviceName, appResponse, "Menu Details Saved Successfully", objLogInfo, null, null, null);
                                }
                            });
                        }

                    });
                }
                catch (ex) {
                    return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-EXG-00003', 'Exception Occured While Calling SaveExgMenuInfo API ... ', error);
                }
            });
        });
    });
});

module.exports = router;