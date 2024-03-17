//****************************************************

//              Developed by Ragavan

//****************************************************
/*
@Api_Name           : /WPGetAppSysInfo,
@Description        : To Get APplication and system informations after login.
@Last_Error_Code    : ERR-AUT-14631 - ERR-AUT-14643
@Last_Modify_Change : Inset csrf token into redis
*/
var node_modules = '../../../../node_modules/';
var reqExpress = require(node_modules + 'express');
var router = reqExpress.Router();
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqRedisInstance = require('../../../../torus-references/instance/RedisInstance');
var async = require(node_modules + 'async');
var serviceName = "WPGetAppurStsDetail";
var reqUuid = require(node_modules + 'uuid');
var reqLINQ = require(node_modules + 'node-linq').LINQ;
//var params = appRequest.body;
var arrayToTree = require(node_modules + 'array-to-tree');
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');
var reqDateFormater = require('../../../../torus-references/common/dateconverter/DateFormatter');
var reqsvchelper = require('../../../../torus-references/common/serviceHelper/ServiceHelper');


router.post('/WPGetAppurStsDetail', function (appRequest, appResponse, pNext) {
    var loginame = '';
    var serviceModel = reqFXDBInstance.DBInstanceSession['SERVICE_MODEL'];
    var objLogInfo;
    var headers = appRequest.headers;
    var token = appRequest.headers['session-id'];
    if (token == undefined) {
        token = appRequest.body.PARAMS.pSessionID; //handle old cases
    }
    var rediskey = 'SESSIONID-' + token;

    var u_id = '';
    var appuid = [];
    var appusersRows = []
    var userGrpRow = []
    var appusersts = [];
    var applications = [];
    var appurid = [];
    var appid = [];
    var appUserSTSSorted = [];
    var appData = [];
    var userDetail = {};
    var clusterCode = '';
    var userManagementModel = "";
    var NeedsysRouting = '';
    var ParentsystypeRouting = 0;
    var strClientIp;
    var RoutingKey = appRequest.headers['routingkey'];
    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, sessionInfo) {

        reqFXDBInstance.GetFXDBConnection(appRequest.headers, 'clt_cas', objLogInfo, function CallbackGetCassandraConn(mClient) {

            loginame = appRequest.body.PARAMS.pUname;
            // strClientIp = appRequest.headers['x-real-ip'] || '192.168.2.43';
            strClientIp = appRequest.connection.remoteAddress.split(':')[3];

            //loginame = 'SOM_TAA';
            async.series([
                function (asyncCallback) {
                    var condition = {
                        LOGIN_NAME: loginame.toUpperCase()
                    };
                    var retrieveColumns = [];
                    reqFXDBInstance.GetTableFromFXDB(mClient, 'users', retrieveColumns, condition, objLogInfo, function callbackGet(pError, pResult) {
                        try {
                            if (pError) {
                                reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-AUT-14631', pError, '', '');
                            } else {
                                if (pResult.rows.length > 0) {
                                    u_id = pResult.rows[0].u_id;
                                    userDetail = pResult.rows[0];
                                    asyncCallback();
                                } else {
                                    asyncCallback();
                                }
                            }
                        } catch (ex) {
                            asyncCallback();
                        }
                    });
                },
                function (asyncCallback) {
                    var selectquery = {
                        query:`select appu_id,app_id,role_mode,ug_code from app_users where u_id =? and (status = '' OR status is null)`,
                        params:[u_id]
                    }
                    reqFXDBInstance.ExecuteSQLQueryWithParams(mClient, selectquery, objLogInfo,
                      function callbackDelete(pResult,pError) {  
                        if (pError) {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-AUT-14632', pError, '', '');
                        } else {
                            if (pResult.rows.length > 0) {
                                appusersRows = pResult.rows
                                for (i = 0; i < pResult.rows.length; i++) {
                                    appuid.push(pResult.rows[i].appu_id);
                                    appid.push(pResult.rows[i].app_id);
                                    appData.push({
                                        "appu_id": pResult.rows[i].appu_id,
                                        "app_id": pResult.rows[i].app_id
                                    });
                                    //get_app(appid[i]);
                                }
                                asyncCallback();
                            } else {
                                return reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-AUT-14635', 'No records found in app user', pError, ''); 
                            }
                        }
                    });
                },
                function (asyncCallback) {

                    var query = "select * from app_user_roles where appu_id in (";
                    var tempappuid = []
                    for (var i = 0; i < appusersRows.length; i++) {
                        if (appusersRows[i].role_mode == 'ROLE' || appusersRows[i].role_mode == 'ROLE_MENUS' || appusersRows[i].role_mode == '' || appusersRows[i].role_mode == null) {
                            tempappuid.push(appusersRows[i].appu_id)
                            query += "'" + appusersRows[i].appu_id + "'";
                            if (i != (appusersRows.length - 1)) {
                                query += ",";
                            }
                        }
                    }
                    query += ")";
                    if (tempappuid.length) {
                        reqFXDBInstance.ExecuteQuery(mClient, query, objLogInfo, function callbackGet(pError, pResult) {
                            if (pError) {
                                reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-AUT-14633', pError, '', '');
                            } else {
                                if (pResult.rows.length > 0) {
                                    appurid = pResult.rows;
                                    asyncCallback();
                                } else {
                                    //reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, ' ', 'No records found in app user roles', pError, '');
                                    asyncCallback();
                                }
                            }
                        });
                    } else {
                        asyncCallback();
                    }
                },
                function (asyncCallback) {
                    var query = "select * from USER_GROUP_APP_ROLES where ug_code in (";
                    var tempugId = []
                    for (var i = 0; i < appusersRows.length; i++) {
                        if (appusersRows[i].role_mode == 'USER_GROUP' && appusersRows[i].ug_code)
                            tempugId.push(appusersRows[i].ug_code)
                        query += "'" + appusersRows[i].ug_code + "'";
                        if (i != (appusersRows.length - 1)) {
                            query += ",";
                        }
                    }
                    query += ")";
                    if (tempugId.length) {
                        reqFXDBInstance.ExecuteQuery(mClient, query, objLogInfo, function callbackGet(pError, pResult) {
                            if (pError) {
                                reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-AUT-14633', pError, '', '');
                            } else {
                                if (pResult.rows.length > 0) {
                                    userGrpRow = pResult.rows;
                                    asyncCallback();
                                } else {
                                    //reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, ' ', 'No records found in app user roles', pError, '');
                                    asyncCallback();
                                }
                            }
                        });
                    } else {
                        asyncCallback();
                    }
                },
                function (asyncCallback) {
                    var query = "select * from app_user_sts where appu_id in (";
                    for (var i = 0; i < appuid.length; i++) {
                        query += "'" + appuid[i] + "'";
                        if (i != (appuid.length - 1)) {
                            query += ",";
                        }
                    }
                    query += ")";

                    reqFXDBInstance.ExecuteQuery(mClient, query, objLogInfo, function callbackGet(pError, pResult) {
                        if (pError) {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-AUT-14634', pError, '', '');
                        } else {
                            if (pResult.rows.length > 0) {
                                appusersts = pResult.rows;

                                for (var i = 0; i < appusersts.length; i++) {
                                    for (var j = 0; j < appData.length; j++) {
                                        if (appData[j]['appu_id'] === appusersts[i]['appu_id']) {
                                            appusersts[i]['app_id'] = appData[j]['app_id'];
                                            break;
                                        }
                                    }
                                }
                                asyncCallback();
                            } else {
                                reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-AUT-14635', 'No records found in app user sts', pError, '');
                            }
                        }
                    });


                },
                function (asyncCallback) {
                    var query = "select app_id,app_code,app_description,app_icon_data as app_icon,disclaimer_message,menu_type from applications where app_id in (";
                    for (var i = 0; i < appid.length; i++) {
                        query += "'" + appid[i] + "'";
                        if (i != (appid.length - 1)) {
                            query += ",";
                        }
                    }
                    query += ") and client_id = '" + sessionInfo.CLIENT_ID + "' and is_framework = 'N' allow filtering";

                    reqFXDBInstance.ExecuteQuery(mClient, query, objLogInfo, function (pError, pResult) {
                        if (pError) {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-AUT-14636', pError, '', '');
                        } else {
                            if (pResult.rows.length > 0) {
                                applications = pResult.rows;
                                asyncCallback();
                            } else {
                                reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-AUT-14637', 'No records found in applications', pError, '');
                            }
                        }
                    });
                },
                function (asyncCallback) {

                    appUserSTSSorted = [];

                    var obj = {};
                    for (var i = 0; i < appusersts.length; i++) {
                        var app_id = appusersts[i]["app_id"];
                        var arrSystem = new reqLINQ(applications).Where(function (item) {
                            return item.app_id === app_id;
                        }).ToArray();
                        if (arrSystem.length == 0) {
                            continue;
                        }
                        if (appUserSTSSorted.length > 0) {
                            var pushed = false;
                            for (var j = 0; j < appUserSTSSorted.length; j++) {

                                if (appUserSTSSorted[j]["app_id"] == appusersts[i]["app_id"]) {
                                    pushed = true;

                                    if (appUserSTSSorted[j]["systems"] == undefined) {
                                        appUserSTSSorted[j]["systems"] = [];
                                        appUserSTSSorted[j]["systems"].push(appusersts[i]);
                                    } else {
                                        appUserSTSSorted[j]["systems"].push(appusersts[i]);
                                    }
                                }
                            }

                            if (pushed == false) {
                                appUserSTSSorted.push({
                                    "app_id": appusersts[i]['app_id'],
                                    "appu_id": appusersts[i]['appu_id'],
                                    "systems": [appusersts[i]]
                                });
                            }
                        } else {
                            appUserSTSSorted.push({
                                "app_id": appusersts[i]['app_id'],
                                "appu_id": appusersts[i]['appu_id'],
                                "systems": [appusersts[i]]
                            });
                        }
                    }

                    asyncCallback();
                },
                function (asyncCallback) {

                    async.forEachOf(appUserSTSSorted, function (value, key, callbackasyncfor) {
                        // var query = "select is_enabled,s_id,child_s_id as CHILD_S_ID,s_description as sysDesc,s_code,sts_id,st_id as ST_ID,appsts_id,wft_code,cluster_code,appst_id,parent_s_id as PARENT_S_ID,st_code as ST_CODE from app_system_to_system where appsts_id in (";
                        var query = 'select asts.is_enabled,asts.s_id,asts.child_s_id as CHILD_S_ID,s.s_description as sysDesc,asts.s_code,asts.sts_id,asts.st_id as ST_ID,asts.appsts_id,asts.wft_code,asts.cluster_code,asts.appst_id,asts.parent_s_id as PARENT_S_ID,asts.st_code as ST_CODE, s.icon_data from app_system_to_system asts inner join systems s on s.s_id = asts.s_id where asts.appsts_id in (';
                        for (var i = 0; i < value.systems.length; i++) {
                            query += "'" + value.systems[i]['appsts_id'] + "'";
                            if (i != (value.systems.length - 1)) {
                                query += ",";
                            }
                        }

                        query += ")  order by  asts.sts_id asc";

                        reqFXDBInstance.ExecuteQuery(mClient, query, objLogInfo, function (pError, pResult) {
                            if (pError) {
                                reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-AUT-14638', pError, '', '');
                            } else {
                                if (pResult.rows.length > 0) {

                                    var rowData = pResult.rows;

                                    clusterCode = rowData[0]['cluster_code'];

                                    rowData = appendAppData(rowData);

                                    var rowDataRefined = [];

                                    for (var i = 0; i < rowData.length; i++) {
                                        var objData = {};
                                        objData['label'] = rowData[i]['sysdesc'];
                                        // rowData[i]['disabled'] = false;
                                        if (rowData[i].is_enabled == '' || rowData[i].is_enabled == null || rowData[i].is_enabled == "Y") {
                                            rowData[i]['disabled'] = false;
                                        } else {
                                            rowData[i]['disabled'] = true;
                                        }
                                        objData['data'] = rowData[i];
                                        objData["parent_s_id"] = rowData[i]["parent_s_id"];
                                        objData["s_id"] = rowData[i]["s_id"];
                                        objData["sys_icon"] = rowData[i]["icon_data"];
                                        delete rowData[i]["icon_data"];
                                        rowDataRefined.push(objData);
                                    }


                                    // var temp = unflatten(rowDataRefined);
                                    // temp = makeTree(temp);
                                    // temp = removeDuplicates(temp, "s_id")
                                    // temp = removeNonParent(temp, canRemove);
                                    if (rowDataRefined.length == 1) {
                                        if (rowDataRefined[0].children == undefined) {
                                            rowDataRefined[0].children = [];
                                        }
                                    }
                                    var temp = arrayToTree(rowDataRefined, {
                                        parentProperty: 'parent_s_id',
                                        customID: 's_id'
                                    });
                                    appUserSTSSorted[key]['CLUSTER_NODES'] = [];
                                    appUserSTSSorted[key]['CLUSTER_NODES'] = temp;
                                    delete appUserSTSSorted[key]["systems"];
                                    callbackasyncfor();
                                } else {
                                    //reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, ' ', pError, '', '');
                                    callbackasyncfor();
                                }
                            }
                        });


                    }, function (err) {

                        for (var i = 0; i < appUserSTSSorted.length; i++) {
                            for (var j = 0; j < applications.length; j++) {
                                if (applications[j]['app_id'] === appUserSTSSorted[i]['app_id']) {

                                    var clusternode = appUserSTSSorted[i]['CLUSTER_NODES'];

                                    var appu_id = '';
                                    if (clusternode.length > 0) {
                                        try {
                                            appu_id = clusternode[0]['data']['APPU_ID'];
                                        } catch (ex) {
                                            console.log(ex);
                                        }
                                    }

                                    applications[j]['appu_id'] = appu_id;
                                    var temp = {};
                                    temp = appUserSTSSorted[i];
                                    appUserSTSSorted[i] = applications[j];
                                    appUserSTSSorted[i]['CLUSTER_NODES'] = [];

                                    var obj = {};
                                    var temparr = [];
                                    obj['cluster_code'] = clusterCode;
                                    obj['clustersystems'] = temp['CLUSTER_NODES'];
                                    temparr.push(obj);

                                    appUserSTSSorted[i]['CLUSTER_NODES'] = temparr;
                                }
                            }
                        }
                        asyncCallback();
                    });

                },
                function (asyncCallback) {

                    if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
                        var cond = {};
                        cond.setup_code = ['USER_MANAGEMENT', 'AUTHENTICATION'];
                        reqsvchelper.GetSetupJson(mClient, cond, objLogInfo, function (res) {
                            if (res.Status == 'SUCCESS' && res.Data.length) {
                                aftergetsetupJson(res.Data);
                            } else {
                                asyncCallback();
                            }
                        });
                    } else {
                        var query = "select category,setup_json from tenant_setup where  tenant_id = '" + sessionInfo.TENANT_ID + "' and category in ('USER_MANAGEMENT','AUTHENTICATION') and client_id = '" + sessionInfo.CLIENT_ID + "'";
                        console.log('tenant query' + query);
                        reqFXDBInstance.ExecuteQuery(mClient, query, objLogInfo, function (error, result) {
                            try {
                                if (error) {
                                    asyncCallback();
                                } else {
                                    aftergetsetupJson(result.rows);
                                }
                            } catch (e) {
                                asyncCallback();
                            };
                        });
                    }

                    function aftergetsetupJson(result) {
                        try {
                            if (result.length > 0) {
                                for (var i = 0; i < result.length; i++) {
                                    if (result[i].category == 'USER_MANAGEMENT') {
                                        userManagementModel = JSON.parse(result[i].setup_json).USER_MANAGEMENT_MODEL;
                                    } else {
                                        NeedsysRouting = JSON.parse(result[i].setup_json).NEED_SYSTEM_ROUTING;
                                        ParentsystypeRouting = JSON.parse(result[i].setup_json).PARENT_SYS_TYPE_FOR_ROUTING;
                                    }
                                }
                                asyncCallback();
                            } else {
                                asyncCallback();
                            }
                            // }
                        } catch (e) {
                            asyncCallback();
                        }
                    }
                },
                function (asyncCallback) {
                    console.log('---------------- INSERT USER SESSIONS TABLE BEGIN-------------');
                    reqFXDBInstance.InsertFXDB(mClient, 'USER_SESSIONS', [{
                        'US_ID': reqUuid.v1(),
                        'U_ID': u_id,
                        'SESSION_ID': token,
                        'LOGIN_IP': strClientIp,
                        'CREATED_BY': u_id,
                        'CREATED_DATE': reqDateFormater.GetTenantCurrentDateTime(appRequest.headers, objLogInfo),
                        'CREATED_TZ': objLogInfo.CLIENTTZ,
                        'CREATED_TZ_OFFSET': objLogInfo.CLIENTTZ_OFFSET
                    }], objLogInfo, function (err, pResult) {
                        asyncCallback();
                    });
                },
                function (asyncCallback) {
                    console.log('---------------- INSERT HST_USER_SESSIONS TABLE BEGIN-------------');
                    reqFXDBInstance.InsertFXDB(mClient, 'HST_USER_SESSIONS', [{
                        'U_ID': u_id,
                        'SESSION_ID': token,
                        'LOGIN_NAME': loginame,
                        'LOGIN_IP': strClientIp,
                        'LOGON_TIME': reqDateFormatter.GetTenantCurrentDateTime(headers, objLogInfo),
                        'CREATED_BY': u_id,
                        'CREATED_DATE': reqDateFormater.GetTenantCurrentDateTime(headers, objLogInfo),
                        'CREATED_TZ': objLogInfo.CLIENTTZ,
                        'CREATED_TZ_OFFSET': objLogInfo.CLIENTTZ_OFFSET
                    }], objLogInfo, function (err, pResult) {
                        asyncCallback();
                    });
                }, function (asyncCallback) {
                    console.log('---------------- UPDATE USER TABLE LAST SUCCESSFULL LOGIN-------------');
                    reqFXDBInstance.UpdateFXDB(mClient, "USERS", {
                        LAST_SUCCESSFUL_LOGIN: reqDateFormater.GetTenantCurrentDateTime(appRequest.headers, objLogInfo),
                    }, {
                        'U_ID': u_id
                    }, objLogInfo, function (err, pResult) {
                        asyncCallback();
                    });
                }
            ],
                function (err) {
                    var finalObj = {};
                    finalObj['USER_APPS'] = appUserSTSSorted;

                    var objApplications = {
                        "Applications": ""
                    };

                    var keys = Object.keys(appUserSTSSorted[0]);

                    var temparrApp = [];
                    for (var sts of appUserSTSSorted) {
                        var obj = {};
                        for (var i = 0; i < keys.length; i++) {
                            if (keys[i].toLowerCase() == 'cluster_nodes') {
                                obj['Systems'] = sts[keys[i]];
                            } else {
                                obj[keys[i].toLowerCase()] = sts[keys[i]];
                            }


                            if (keys[i].toLowerCase() == 'app_description') {
                                obj['desc'] = sts[keys[i]];
                            }

                        }
                        temparrApp.push(obj);
                    }

                    objApplications['Applications'] = temparrApp;

                    finalObj['APPSYS'] = JSON.stringify(objApplications);

                    // finalObj['USER_APPS'] = [];
                    finalObj['LAST_SUCCESSFUL_LOGIN'] = userDetail.last_successful_login;
                    finalObj['LAST_UNSUCCESSFUL_LOGIN'] = userDetail.last_unsuccessful_login;
                    finalObj['ALLOCATED_STATIC_MODULE'] = userDetail.allocated_static_module;
                    finalObj['LANG_DATA'] = '';
                    finalObj['APP_LANG_DATA'] = '';
                    finalObj['SESSION_ID'] = objLogInfo.SESSION_ID;
                    finalObj['LOGIN_NAME'] = objLogInfo.USER_NAME;
                    finalObj['NEED_OTP'] = 'N';
                    finalObj['JWT_SECRET_KEY'] = sessionInfo.JWT_SECRET_KEY;
                    finalObj['LOGIN_RESULT'] = '';
                    finalObj['USER_MANAGEMENT_MODEL'] = userManagementModel;
                    finalObj['NEED_SYSTEM_ROUTING'] = NeedsysRouting;
                    finalObj['PARENT_SYS_TYPE_FOR_ROUTING'] = ParentsystypeRouting;
                    finalObj['NEED_EXT_AUTH'] = userDetail.need_ext_auth;

                    reqRedisInstance.GetRedisConnection(async function (error, clientR) {
                        try {
                            if (error) {
                                reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-AUT-14639', 'errmsg', error);
                            } else {
                                var RedisValue = [];
                                var objForRedis = Object.assign(finalObj);
                                objForRedis.USER_APPS = reqInstanceHelper.ArrKeyToUpperCase(objForRedis.USER_APPS);
                                for (var i = 0; i < objForRedis.USER_APPS.length; i++) {
                                    var currentApp = objForRedis.USER_APPS[i];
                                    currentApp.CLUSTER_NODES = JSON.stringify(currentApp.CLUSTER_NODES);
                                }
                                RedisValue.push(objForRedis);
                                //var objSessionInfo = {};
                                sessionInfo.U_ID = u_id;
                                sessionInfo.token = reqUuid.v1()
                                RedisValue.push(sessionInfo);
                                finalObj.token =  sessionInfo.token
                                //Remain TTL get for key 
                                reqRedisInstance.GetRedisConnectionwithIndex(2, async function (error, RedisSession) {
                                    // RedisSession.TTL(rediskey, function (error, ttl) {
                                    try {
                                        var ttl = await RedisSession.TTL(rediskey)
                                        if (error) {
                                            reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-AUT-14640', 'errmsg', error);
                                        } else {
                                            reqRedisInstance.RedisInsert(RedisSession, rediskey, RedisValue, ttl);
                                            reqInstanceHelper.PrintInfo(serviceName, 'Session info successfully inserted into Redis', objLogInfo);
                                            // appResponse.cookie('session-id', rediskey, { maxAge: 900000, httpOnly: true });
                                            reqInstanceHelper.SendResponse(serviceName, appResponse, JSON.stringify(finalObj), objLogInfo, '', '', '', '');
                                        }
                                    } catch (error) {
                                        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-AUT-14642', 'errmsg', error);
                                    }
                                    // });
                                });
                            }
                        } catch (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'errcode', 'ERR-AUT-14643', error);
                        }
                    });
                });

        });

        function appendAppData(tempData) {
            for (var i = 0; i < tempData.length; i++) {
                var appsts_id = tempData[i]['appsts_id'];
                for (var j = 0; j < appusersts.length; j++) {
                    if (appusersts[j]['appsts_id'] === appsts_id) {
                        var appu_id = appusersts[j]['appu_id'];
                        tempData[i]['APPU_ID'] = appu_id;
                        // if (appurid.length) {
                        tempData[i]['appRId'] = [];
                        for (var k = 0; k < appurid.length; k++) {
                            if (appurid[k]['appu_id'] === appu_id) {
                                tempData[i]['appRId'].push(appurid[k]['appr_id']);
                                // tempData[i]['appRId'] = appurid[k]['appr_id'];

                                tempData[i]['appusts_id'] = appusersts[j]['appusts_id'];
                                // tempData[i]['SYS_ICON'] = "images/sys.png";
                                // break;
                            } else if (loginame.toUpperCase() == "TORUS_ADMIN" && tempData[i]['appRId'].length == 0 && appurid.length - 1 == k) {
                                tempData[i]['appRId'] = '0'
                            }
                            //  else {

                            // }
                        }

                        for (var l = 0; l < appusersRows.length; l++) {
                            if (appusersRows[l].ug_code && appusersRows[l].role_mode && appu_id == appusersRows[l].appu_id) {
                                var arrusrGrp = new reqLINQ(userGrpRow).Where(function (item) {
                                    return item.ug_code === appusersRows[l].ug_code;
                                }).ToArray();

                                var arrApRid = new reqLINQ(arrusrGrp).Select(function (item) {
                                    return item.appr_id;
                                }).ToArray();

                                if (arrusrGrp.length) {
                                    // tempData[i]['appRId'].push(arrusrGrp[0]['appr_id']);
                                    tempData[i]['appRId'] = arrApRid;
                                    tempData[i]['APPU_ID'] = appu_id;
                                    tempData[i]['appusts_id'] = appusersts[j]['appusts_id'];
                                }
                            }
                        }
                        // } else {
                        //     tempData[i]['appRId'] = '0';
                        //     tempData[i]['APPU_ID'] = appu_id;
                        //     tempData[i]['appusts_id'] = appusersts[j]['appusts_id'];
                        //     // tempData[i]['SYS_ICON'] = "images/sys.png";
                        // }
                        break;
                    }
                }
            }
            return tempData;
        }

    });

});

module.exports = router;