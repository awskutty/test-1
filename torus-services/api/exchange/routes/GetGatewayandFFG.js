/**
 * @Api_Name        : /ViewCreatedFiles,
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
var fs = require('fs');
var serviceName = "GetGatewayandFFG";

var serviceModel = reqFXDBInstance.DBInstanceSession['SERVICE_MODEL'];
router.post('/GetGatewayandFFG', function (appRequest, appResponse) {
    var inputRequest = appRequest.body.PARAMS;
    var reqBody = inputRequest;
    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
        var isLatestPlatformVersion = false;
        if (serviceModel && serviceModel.PLATFORM_VERSION == '7.0') {
            reqInstanceHelper.PrintInfo(serviceName, 'Platform Version - ' + serviceModel.PLATFORM_VERSION, objLogInfo);
            isLatestPlatformVersion = true;
        }
        reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo)
        var CLIENT_ID = objSessionInfo.CLIENT_ID;
        var TENANT_ID = objSessionInfo.TENANT_ID;
        var APP_ID = objSessionInfo.APP_ID;
        var source_s_id = objSessionInfo.S_ID;
        var DST_SYS_ID = inputRequest.SYS_ID;
        var tenant_id = objSessionInfo.TENANT_ID;

        objLogInfo.HANDLER_CODE = 'GETGATEWAYANDFFG';
        objLogInfo.PROCESS = 'GETGATEWAYANDFFG_PROCESS';
        objLogInfo.ACTION_DESC = 'GATEWAYANDFFG';

        appResponse.on('close', function () { });
        appResponse.on('finish', function () { });
        appResponse.on('end', function () { });
        try {
            var mHeaders = appRequest.headers;

            getDBInstances(mHeaders, objLogInfo, function (DBInstance) {
                Object.assign(inputRequest, DBInstance);
                inputRequest["session"] = objSessionInfo;

                reqFXDBInstance.GetFXDBConnection(mHeaders, 'dep_cas', objLogInfo, function (dep_cas_instance) {
                    reqBody.dep_cas_instance = dep_cas_instance;
                    reqBody.objLogInfo = objLogInfo;
                    var exs_code = "";
                    var exg_code_obj = "";
                    var exg_code_arr = [];
                    var system_gateways = "";
                    var gateways = "";
                    ffg_json = "";
                    ffg_json_arr = [];
                    ex_sys_gateway = "";
                    gateways = [];
                    ffg_code = "";
                    sg = "";
                    async.series({
                        system_gateways: function (callbackAsync) {
                            reqFXDBInstance.GetTableFromFXDB(dep_cas_instance, 'ex_systems', [], {
                                'client_id': CLIENT_ID,
                                'app_id': APP_ID,
                                'dst_s_id': DST_SYS_ID,
                                'source_s_id': source_s_id,
                                'tenant_id': tenant_id
                            }, objLogInfo, function (error, result) {
                                if (!error) {
                                    sg = result.rows;
                                    callbackAsync(null, result.rows);
                                } else {
                                    callbackAsync(null, []);
                                }
                            });
                        },
                        ffg_json: function (callbackAsync) {
                            async.forEachOf(sg, function (value, key, asynccallback) {
                                ffg_code = value["exffg_code"] || "";
                                exs_code = value["exs_code"] || "";

                                reqFXDBInstance.GetTableFromFXDB(dep_cas_instance, 'ex_file_format_groups ', ['exffg_code', 'exffg_name', 'default_input_json'], {
                                    'app_id': APP_ID,
                                    'exffg_code': ffg_code
                                }, objLogInfo, function (error, result) {
                                    if (!error) {
                                        if (result.rows.length > 0) {
                                            ffg_json_arr.push(result.rows[0]);
                                        }

                                        asynccallback();
                                    } else {
                                        callbackAsync(null, []);
                                    }
                                });
                            }, function (err) {
                                callbackAsync(null, ffg_json_arr);
                            })


                        },
                        ex_sys_gateway: function (callbackAsync) {
                            async.forEachOf(sg, function (value, key, asynccallback) {
                                reqFXDBInstance.GetTableFromFXDB(dep_cas_instance, 'ex_system_gateways', [], {
                                    'client_id': CLIENT_ID,
                                    'app_id': APP_ID,
                                    'tenant_id': tenant_id,
                                }, objLogInfo, function (error, result) {
                                    if (!error) {
                                        var rows = result.rows;
                                        if (result.rows.length > 0) {
                                            for (var i = 0; i < rows.length; i++) {
                                                if (rows[i]["exs_code"] == value["exs_code"]) {
                                                    exg_code_obj = rows[i];
                                                    exg_code_arr.push(exg_code_obj);
                                                }
                                            }
                                        }

                                        asynccallback();
                                    } else {
                                        callbackAsync(null, {});
                                    }
                                });

                            }, function (err) {
                                callbackAsync(null, exg_code_arr);
                            });
                        },
                        gateways: function (callbackAsync) {
                            var exGatewayCond = {
                                'client_id': CLIENT_ID,
                                'app_id': APP_ID
                            };
                            if (isLatestPlatformVersion) {
                                exGatewayCond.TENANT_ID = TENANT_ID;
                            }
                            async.forEachOf(exg_code_arr, function (value, key, asyncCallback) {
                                exGatewayCond.exg_code = value.exg_code;
                                reqFXDBInstance.GetTableFromFXDB(dep_cas_instance, 'ex_gateways', [], exGatewayCond, objLogInfo, function (error, result) {
                                    if (!error) {
                                        if (result.rows.length > 0) {
                                            gateways.push(result.rows[0]);
                                        }
                                        asyncCallback();
                                    } else {
                                        callbackAsync(null, []);
                                    }
                                });
                            }, function (err) {
                                callbackAsync(null, gateways);
                            })

                        },

                    }, function (err, result) {
                        if (!err) {
                            return reqInstanceHelper.SendResponse(serviceName, appResponse, result, objLogInfo, '', '', '');
                        } else {
                            return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-EXC-', 'Exception Occured While Calling getGatewayandFFg.. ', err);
                        }

                    })
                });
            });
        } catch (error) {
            return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-EXC-', 'Exception Occured While Calling SaveGateways API ... ', error);
        }
    });
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


module.exports = router;