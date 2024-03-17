/**
 * @Api_Name        : /GetFFGfromSystemId,
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
var router = reqExpress.Router();
var reqLogInfo = require(refPath + 'log/trace/LogInfo');
var reqEncryptInstance = require('../../../../torus-references/common/crypto/EncryptionInstance');
//var async = require(modPath + 'async');
var serviceName = "ImportFile";

var serviceModel = reqFXDBInstance.DBInstanceSession['SERVICE_MODEL'];
router.post('/GetFFGfromSystemId', function (appRequest, appResponse) {
    var objLogInfo = "";
    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
        var isLatestPlatformVersion = false;
        if (serviceModel && serviceModel.PLATFORM_VERSION == '7.0') {
            reqInstanceHelper.PrintInfo(serviceName, 'Platform Version - ' + serviceModel.PLATFORM_VERSION, objLogInfo);
            isLatestPlatformVersion = true;
        }
        reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo);
        var CLIENT_ID = objSessionInfo.CLIENT_ID;
        var APP_ID = objSessionInfo.APP_ID;
        var tenant_id = objSessionInfo.TENANT_ID || "";
        var selected_menu = appRequest.body.PARAMS.Selected_Menu || "";

        objLogInfo.HANDLER_CODE = 'EXG_FILE_CREATION';
        objLogInfo.PROCESS = 'EXG_FILE_CREATION-ExportFile';
        objLogInfo.ACTION_DESC = 'ExportFile';

        appResponse.on('close', function () { });
        appResponse.on('finish', function () { });
        appResponse.on('end', function () { });
        try {
            var mHeaders = appRequest.headers;
            reqFXDBInstance.GetFXDBConnection(mHeaders, 'dep_cas', objLogInfo, function (dep_cas_instance) {
                var obj = {
                    "ffg_json": "",
                    "gateways": "",
                    "system_gateways": "",
                    "systemgw_setup": "",
                    "selectedrow": "",
                    "exgmenu_setup": "",
                    "SelectedRowValues": ""
                };
                var exffg_code = "";
                var gw_code = "";

                var promis = new Promise((resolve, reject) => {
                    //doing selectedrow
                    if (selected_menu != "" && selected_menu != undefined) {
                        reqFXDBInstance.GetTableFromFXDBNoCache(dep_cas_instance, 'ex_menu_setup', [], {
                            "MENU_ITEM_CODE": selected_menu.UIA_CODE,
                            "DST_S_CODE": selected_menu.S_ID,
                            "CLIENT_ID": CLIENT_ID,
                            "APP_ID": APP_ID,
                            "TENANT_ID": tenant_id
                        }, objLogInfo, function (error, result) {
                            if (error) {
                                reject(error);
                            } else {
                                if (result.rows.length > 0) {
                                    exffg_code = result.rows[0]["exffg_code"];
                                    gw_code = result.rows[0]["gw_code"];
                                    getdefault_json(dep_cas_instance, objLogInfo, APP_ID, exffg_code, function (res) {
                                        var obj = {
                                            "action": result.rows[0]["action_type"],
                                            "Destination_System": result.rows[0]["dst_s_code"],
                                            "exg_code": gw_code,
                                            "exffg_code": exffg_code,
                                            "default_json": res.default_input_json
                                        };
                                        resolve(obj);
                                    });
                                } else {
                                    resolve("");
                                }
                            }
                        });
                    } else {
                        resolve("");
                    }
                });
                promis.then((result) => {
                    obj.selectedrow = result;

                    //doing ffg_json
                    var condObj = {};
                    if (selected_menu != "" && selected_menu != undefined && exffg_code != "") {
                        condObj = {
                            'app_id': APP_ID,
                            'exffg_code': exffg_code
                        };
                    } else {
                        condObj = {
                            'app_id': APP_ID
                        };
                    }
                    return new Promise((resolve, reject) => {
                        reqFXDBInstance.GetTableFromFXDBNoCache(dep_cas_instance, 'ex_file_format_groups ', ['exffg_code', 'exffg_name', 'default_input_json', 'direction', 'ffg_json'], condObj, objLogInfo, function (error, result) {
                            if (error) {
                                reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-EXC-', '', error);
                            } else {
                                resolve(result.rows);
                            }
                        });
                    });
                }).then((result) => {
                    obj.ffg_json = result;

                    //doing gateways
                    var condObj = {};
                    if (selected_menu != "" && selected_menu != undefined && gw_code != "") {
                        condObj = {
                            'client_id': CLIENT_ID,
                            'exg_code': gw_code,
                            'app_id': APP_ID
                        };
                    } else {
                        condObj = {
                            'client_id': CLIENT_ID,
                            'app_id': APP_ID
                        };
                    }
                    if (isLatestPlatformVersion) {
                        condObj.tenant_id = tenant_id;
                    }
                    return new Promise(async (resolve, reject) => {
                        reqExchangeHelper.GetExGatewayDetails(dep_cas_instance, condObj, objLogInfo, function (error, result) {
                            if (error) {
                                reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-EXC-', '', error);
                            } else {
                                resolve(result.rows);
                            }
                        });
                    });
                }).then((result) => {

                    for (var i = 0; i < result.length; i++) {
                        result[i].gateway_config = reqEncryptInstance.Encryption(result[i].gateway_config)
                    }
                    obj.gateways = result;

                    //doing system_gateways
                    return new Promise((resolve, reject) => {
                        reqFXDBInstance.GetTableFromFXDBNoCache(dep_cas_instance, 'ex_systems', [], {
                            'client_id': CLIENT_ID,
                            'app_id': APP_ID
                        }, objLogInfo, function (error, result) {
                            if (error) {
                                reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-EXC-', '', error);
                            } else {
                                resolve(result.rows);
                            }
                        });
                    });
                }).then((result) => {
                    obj.system_gateways = result;

                    //doing systemgw_setup
                    return new Promise((resolve, reject) => {
                        reqFXDBInstance.GetTableFromFXDBNoCache(dep_cas_instance, 'ex_system_gateways', [], {
                            'client_id': CLIENT_ID,
                            'app_id': APP_ID
                        }, objLogInfo, function (error, result) {
                            if (error) {
                                reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-EXC-', '', error);
                            } else {
                                resolve(result.rows);
                            }
                        });
                    });
                }).then((result) => {
                    obj.systemgw_setup = result;

                    //doing exgmenu_setup
                    return new Promise((resolve, reject) => {
                        reqFXDBInstance.GetTableFromFXDBNoCache(dep_cas_instance, 'ex_menu_setup', [], {
                            'client_id': CLIENT_ID,
                            'app_id': APP_ID
                        }, objLogInfo, function (error, result) {
                            if (error) {
                                reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-EXC-', '', error);
                            } else {
                                resolve(result.rows);
                            }
                        });
                    });
                }).then((result) => {
                    obj.exgmenu_setup = result;

                    //sending response
                    obj.SelectedRowValues = obj.selectedrow;
                    return reqInstanceHelper.SendResponse(serviceName, appResponse, obj, objLogInfo, '', '', '');

                }).catch((error) => {
                    return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-EXC-', '', error);
                });

                function getdefault_json(dep_cas_instance, objLogInfo, APP_ID, exffg_code, callback) {
                    var condObj = {
                        'exffg_code': exffg_code,
                        'app_id': APP_ID
                    };
                    reqFXDBInstance.GetTableFromFXDBNoCache(dep_cas_instance, 'ex_file_format_groups ', ['default_input_json'], condObj, objLogInfo, function (error, result) {
                        if (!error) {
                            if (result.rows.length) {
                                callback(result.rows[0]);
                            } else {
                                callback([]);
                            }
                        } else {
                            callback([]);
                        }
                    });
                }
            });
        } catch (error) {
            return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-EXC-', 'Exception Occured While Calling ImportFile API ... ', error);
        }
    });
});

module.exports = router;