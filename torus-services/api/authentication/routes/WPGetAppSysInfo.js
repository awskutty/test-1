/*
@Api_Name           : /WPGetAppSysInfo,
@Description        : To Get APplication and system informations after login.
@Last_Error_Code    : ERR-AUT-14631
*/

// Require dependencies
var modPath = '../../../../node_modules/';
var refPath = '../../../../torus-references/';
var reqExpress = require(modPath + 'express');
var router = reqExpress.Router();
var reqUuid = require(modPath + 'uuid');
var reqUtil = require('util');
var reqAsync = require('async');
var reqLINQ = require(modPath + 'node-linq').LINQ;
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var DBInstance = require('../../../../torus-references/instance/DBInstance');
var reqRedisInstance = require('../../../../torus-references/instance/RedisInstance');
var reqDateFormater = require('../../../../torus-references/common/dateconverter/DateFormatter');
//Global Variables
var pHeaders;
var pUser;
var strResult = '';
var serviceName = 'WPGetAppSysInfo';
var UID;
var ClientID;
var strClientIp;
var mCltClient;

// Host the WPGetAppSysInfo api
router.post('/WPGetAppSysInfo', function (appRequest, appResponse) {
    try {
        var objLogInfo;
        // Handle the close event when client closes the api request
        appResponse.on('close', function () { });
        appResponse.on('finish', function () { });
        appResponse.on('end', function () { });

        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, sessionInfo) {
            try {
                pHeaders = appRequest.headers;
                var resultSessionInfo = new SessionInfo();
                var strUname = appRequest.body.PARAMS.pUname.toUpperCase();
                var token = appRequest.headers['session-id'];
                var rediskey = 'SESSIONID-' + token;
                if (token == undefined) {
                    var sessionID = appRequest.body.PARAMS.pSessionID;//handle old cases
                    rediskey = 'SESSIONID-' + sessionID
                    token = sessionID;
                }
                var SecretKey = ''
                strClientIp = appRequest.headers['x-real-ip'] || '192.168.2.43';
                var ldCode = appRequest.body.PARAMS.LD_CODE;
                objLogInfo.PROCESS = 'WPGetAppSysInfo-Authentication';
                objLogInfo.ACTION = 'WPGetAppSysInfo';
                objLogInfo.HANDLER_CODE = 'WP_GET_APP_SYS_INFO';

                reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo);
                // Get DB connection
                DBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function Callback_GetCassandraConn(pClient) {
                    reqRedisInstance.GetRedisConnection(function (error, clientR) {
                        try {
                            if (error) {
                                appResponse.send(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14630', 'RDB DB Connection Failed ', error))
                            } else {
                                mCltClient = pClient;
                                // Function call
                                _Mainfunction(function (finalcallback) {
                                    if (finalcallback.STATUS == 'SUCCESS') {
                                        reqInstanceHelper.SendResponse(serviceName, appResponse, finalcallback.SUCCESS_DATA, objLogInfo, '', '', '', 'SUCCESS', finalcallback.SUCCESS_MESSAGE);
                                    } else {
                                        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, finalcallback.ERROR_CODE, finalcallback.ERROR_MESSAGE, finalcallback.ERROR_OBJECT);
                                    }
                                });

                                // Select users assign user details to result object
                                function _Mainfunction(finalcallback) {
                                    try {
                                        reqInstanceHelper.PrintInfo(serviceName, 'Get redis value. rediskey is  ' + rediskey, objLogInfo);
                                        reqInstanceHelper.GetConfig(rediskey, function (redisvalue) {
                                            try {
                                                var sessionValue = JSON.parse(redisvalue);
                                                var SessionLoginName = sessionValue.LOGIN_NAME;
                                                SecretKey = sessionValue.JWT_SECRET_KEY;
                                                reqInstanceHelper.PrintInfo(serviceName, 'Session LoginName is ' + SessionLoginName, objLogInfo);
                                                reqInstanceHelper.PrintInfo(serviceName, 'Login name  is ' + strUname, objLogInfo);
                                                if (SessionLoginName == strUname) {
                                                    reqInstanceHelper.PrintInfo(serviceName, 'GetTableFromFXDB USERS table ', objLogInfo);
                                                    DBInstance.GetTableFromFXDB(mCltClient, 'USERS', [], {
                                                        'LOGIN_NAME': strUname
                                                    }, objLogInfo, function callbackuserselect(err, UserResult) {
                                                        try {
                                                            if (err) {
                                                                finalcallback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14601', 'GetTableFromFXDB USERS Failed', err))
                                                            } else {
                                                                if (UserResult.rows.length > 0) {
                                                                    reqInstanceHelper.PrintInfo(serviceName, 'Got Result for GetTableFromFXDB USERS table ', objLogInfo);
                                                                    pUser = UserResult.rows[0];
                                                                    UID = UserResult.rows[0].u_id;
                                                                    ClientID = UserResult.rows[0].client_id;
                                                                    resultSessionInfo.SESSION_ID = token;
                                                                    resultSessionInfo.LOGIN_NAME = strUname;
                                                                    if (pUser.last_successful_login != null) {
                                                                        resultSessionInfo.LAST_SUCCESSFUL_LOGIN = pUser.last_successful_login;
                                                                    } else {
                                                                        resultSessionInfo.LAST_SUCCESSFUL_LOGIN = '';
                                                                    }
                                                                    if (pUser.last_unsuccessful_login != null) {
                                                                        resultSessionInfo.LAST_UNSUCCESSFUL_LOGIN = pUser.last_unsuccessful_login;
                                                                    } else {
                                                                        resultSessionInfo.LAST_UNSUCCESSFUL_LOGIN = '';
                                                                    }
                                                                    if (pUser.allocated_static_module != null) {
                                                                        resultSessionInfo.ALLOCATED_STATIC_MODULE = pUser.allocated_static_module;
                                                                    } else {
                                                                        resultSessionInfo.ALLOCATED_STATIC_MODULE = '[]';
                                                                    }
                                                                    if (pUser.double_authentication != '') {
                                                                        resultSessionInfo.NEED_OTP = pUser.double_authentication;
                                                                    }
                                                                    //prepare Appsystem info
                                                                    resultSessionInfo.USER_APPS = JSON.parse(UserResult.rows[0].appur_sts);
                                                                    if (resultSessionInfo.USER_APPS == null) {
                                                                        resultSessionInfo.USER_APPS = [];
                                                                    }
                                                                    var tempappln = [];
                                                                    tempappln = resultSessionInfo.USER_APPS;
                                                                    var i;
                                                                    for (i = 0; i < tempappln.length; i++) {
                                                                        if (typeof (tempappln[i].CLUSTER_NODES) == 'string') {
                                                                            var clsusternode = JSON.parse(tempappln[i].CLUSTER_NODES)
                                                                            if (clsusternode.length == 0) {
                                                                                tempappln.splice(i, 1);
                                                                            }
                                                                        }
                                                                        else if (tempappln[i].CLUSTER_NODES.length == 0) {
                                                                            tempappln.splice(i, 1);
                                                                        }
                                                                    }
                                                                    resultSessionInfo.USER_APPS = tempappln;

                                                                    PrepareEnableDisableFlag(function callback() {
                                                                        try {
                                                                            //Prepare application json   function call
                                                                            PrepareApplications(function (res) {
                                                                                if (res.STATUS == 'FAILURE') {
                                                                                    finalcallback(res);
                                                                                } else {
                                                                                    insertusersession(function (result) {
                                                                                        finalcallback(result);
                                                                                    })
                                                                                }
                                                                            });
                                                                        } catch (error) {
                                                                            finalcallback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14628', 'PrepareEnableDisableFlag  Failed', error))
                                                                        }

                                                                    })

                                                                    function PrepareEnableDisableFlag(pCallback) {
                                                                        try {
                                                                            //to set enable disable flag into appur_stst json value.
                                                                            reqAsync.forEachOf(resultSessionInfo.USER_APPS, function (usrApp, index, asyncallback) {
                                                                                reqInstanceHelper.PrintInfo(serviceName, '-----------USER_APPS looping ', objLogInfo);
                                                                                arrAppSTS = [];
                                                                                //Get apstsID to query app_system_to_system table
                                                                                __GetAppSTSID(usrApp.CLUSTER_NODES);
                                                                                GetISEnabledflag(function callbackGetEnableFlag(pResultRows) {
                                                                                    reqInstanceHelper.PrintInfo(serviceName, 'appsystosys Result ' + pResultRows.rows.length, objLogInfo);
                                                                                    __SetEnableflag(pResultRows, usrApp.CLUSTER_NODES, function (stringuserapp) {
                                                                                        usrApp.CLUSTER_NODES = stringuserapp
                                                                                    })
                                                                                    asyncallback(null)
                                                                                })

                                                                            }, function (err, result) {
                                                                                reqInstanceHelper.PrintInfo(serviceName, 'USER_APPS loop end ', objLogInfo);
                                                                                pCallback();
                                                                            })
                                                                        } catch (error) {
                                                                            finalcallback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14627', 'PrepareEnableDisableFlag  Failed', error))
                                                                        }
                                                                    }




                                                                    function GetISEnabledflag(callback) {
                                                                        try {
                                                                            reqInstanceHelper.PrintInfo(serviceName, 'geeting appsytosy USERS table ', objLogInfo);
                                                                            DBInstance.GetTableFromFXDB(mCltClient, 'app_system_to_system', [], {
                                                                                'appsts_id': arrAppSTS
                                                                            }, objLogInfo, function (Err, Result) {
                                                                                if (Err) {
                                                                                    finalcallback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14601', 'GetTableFromFXDB USERS Failed', err))
                                                                                } else {
                                                                                    callback(Result)
                                                                                }
                                                                            })
                                                                        } catch (error) {
                                                                            finalcallback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14618', 'GetTableFromFXDB USERS callback function Failed', error))
                                                                        }
                                                                    }

                                                                }
                                                            }
                                                        } catch (error) {
                                                            finalcallback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14618', 'GetTableFromFXDB USERS callback function Failed', error))
                                                        }
                                                    })
                                                } else {
                                                    reqInstanceHelper.PrintInfo(serviceName, 'Login name  is Mismatched,Login rejected. ' + strUname, objLogInfo);
                                                    finalcallback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14632', 'UNAUTHORIZED', ''))
                                                }

                                            } catch (error) {
                                                finalcallback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14631', 'Exception occured Get redis value for session ', error))
                                            }

                                        })
                                    } catch (error) {
                                        finalcallback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14602', 'GetTableFromFXDB USERS Failed', error))
                                    }

                                }


                                //Prepare application json string
                                function PrepareApplications(callback) {
                                    try {
                                        //Prepare Applications
                                        reqInstanceHelper.PrintInfo(serviceName, 'PrepareApplications function executing... ', objLogInfo);
                                        var sbApps = '{\"Applications\" :[ ';
                                        for (app = 0; app < resultSessionInfo.USER_APPS.length; app++) {
                                            sbApps = sbApps + reqUtil.format("{" + '"app_id"' + " : " + '"%s"' + " , " + '"app_code"' + " : " + '"%s"' + " , " + '"desc"' + " : " + '"%s"' + ", " + '"logo"' + " : " + '"%s"' + "," + '"appu_id"' + " : " + '"%s"' + "," + '"disclaimer_message"' + " : " + '"%s"' + "," + '"appu_disclaimer_message"' + " : " + '"%s"' + "," + '"Systems"' + " : " + '%s' + " } ", resultSessionInfo.USER_APPS[app].APP_ID, resultSessionInfo.USER_APPS[app].APP_CODE, resultSessionInfo.USER_APPS[app].APP_DESCRIPTION, resultSessionInfo.USER_APPS[app].APP_ICON, resultSessionInfo.USER_APPS[app].APPU_ID, resultSessionInfo.USER_APPS[app].DISCLAIMER_MESSAGE, resultSessionInfo.USER_APPS[app].APPU_DISCLAIMER_MESSAGE, resultSessionInfo.USER_APPS[app].CLUSTER_NODES);
                                            sbApps = sbApps + ',';
                                        }
                                        var strRes = sbApps.substr(0, sbApps.length - 1) + ']}';
                                        resultSessionInfo.APPSYS = strRes;
                                        resultSessionInfo.JWT_SECRET_KEY = SecretKey;
                                        var RedisValue = [];
                                        RedisValue.push(resultSessionInfo)
                                        //Remain TTL get for key 
                                        clientR.TTL(rediskey, function (err, ttl) {
                                            // clientR.set(rediskey, JSON.stringify(RedisValue), 'EX', ttl);
                                            reqRedisInstance.RedisInsert(clientR, rediskey, RedisValue, ttl)
                                            reqInstanceHelper.PrintInfo(serviceName, 'Session info successfully inserted into Redis', objLogInfo);
                                            callback(resultSessionInfo)
                                        });

                                    } catch (error) {
                                        callback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14603', '_ClearUserSession  function failed ', error));
                                    }
                                }

                                var arrAppSTS = [];
                                var arrClusterSys = [];
                                function __GetAppSTSID(clusterNode) {
                                    var objAppUser_sts = JSON.parse(clusterNode);
                                    for (var sys in objAppUser_sts) {

                                        var arrClusterSys = objAppUser_sts[sys].clustersystems
                                        for (var clu in arrClusterSys) {
                                            AppendRowToResult(arrClusterSys[clu].data.appsts_id)
                                            // Call Recursive systems and append to array
                                            AddChildSystems(arrClusterSys[clu].children);
                                        }
                                    }
                                }

                                function AddChildSystems(arrSTS) {
                                    for (var sys in arrSTS) {
                                        AppendRowToResult(arrSTS[sys].data.appsts_id);
                                        AddChildSystems(arrSTS[sys].children);
                                    }
                                }

                                // Form the system row and add it to array result
                                function AppendRowToResult(sys) {
                                    arrAppSTS.push(sys);
                                }


                                function __SetEnableflag(pRows, clusterNode, pcallback) {
                                    try {
                                        var AppUser_sts = JSON.parse(clusterNode);
                                        for (var sys in AppUser_sts) {
                                            arrClusterSys = AppUser_sts[sys].clustersystems
                                            for (var clu in arrClusterSys) {

                                                var apstsRow = new reqLINQ(pRows.rows)
                                                    .Where(function (item) {
                                                        return item.appsts_id === arrClusterSys[clu].data.appsts_id;
                                                    }).ToArray();

                                                if (apstsRow.length > 0 && apstsRow[0].is_enabled == '' || apstsRow[0].is_enabled == null || apstsRow[0].is_enabled == "Y") {
                                                    arrClusterSys[clu].disabled = false;
                                                    arrClusterSys[clu].data.disabled = false;
                                                } else {
                                                    arrClusterSys[clu].disabled = true;
                                                    arrClusterSys[clu].data.disabled = true;
                                                }
                                                // Call Recursive systems and append to array
                                                setflagtoChildSystems(pRows, arrClusterSys[clu].children);
                                            }
                                        }
                                        pcallback(JSON.stringify(AppUser_sts))
                                    } catch (error) {
                                        pcallback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14629', '__SetEnableflag Failed', error))
                                    }
                                }

                                function setflagtoChildSystems(pRows, arrSTS) {
                                    for (var sys in arrSTS) {
                                        var apstsRow = new reqLINQ(pRows.rows)
                                            .Where(function (item) {
                                                return item.appsts_id === arrSTS[sys].data.appsts_id;
                                            }).ToArray();
                                        if (apstsRow.length > 0 && apstsRow[0].is_enabled == '' || apstsRow[0].is_enabled == null || apstsRow[0].is_enabled == "Y") {
                                            arrSTS[sys].disabled = false;
                                            arrSTS[sys].data.disabled = false
                                        } else {
                                            arrSTS[sys].disabled = true;
                                            arrSTS[sys].data.disabled = true;
                                        }
                                        setflagtoChildSystems(pRows, arrSTS[sys].children);
                                    }
                                }
                                // Insert user sessions and update last_successful_login in Users table
                                function insertusersession(callbacksessioninsert) {
                                    try {
                                        reqInstanceHelper.PrintInfo(serviceName, 'insertusersession function executing ', objLogInfo);
                                        DBInstance.InsertFXDB(mCltClient, 'USER_SESSIONS', [{
                                            'US_ID': reqUuid.v1(),
                                            'U_ID': pUser.u_id,
                                            'SESSION_ID': token,
                                            'LOGIN_IP': strClientIp,
                                            'CREATED_BY': pUser.u_id,
                                            'CREATED_DATE': reqDateFormater.GetTenantCurrentDateTime(pHeaders, objLogInfo)
                                        }], objLogInfo, function callbackusersessioninsert(err, pResult) {
                                            try {
                                                if (err) {
                                                    callbacksessioninsert(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14604', 'GetTableFromFXDB OTP_LOGS Failed', err))
                                                } else {
                                                    try {
                                                        reqInstanceHelper.PrintInfo(serviceName, 'Usersession insert success', objLogInfo);
                                                        //updatre last_successful_login date 
                                                        DBInstance.UpdateFXDB(mCltClient, 'USERS', {
                                                            'last_successful_login': reqDateFormater.GetTenantCurrentDateTime(pHeaders, objLogInfo)
                                                        }, {
                                                                'u_id': UID,
                                                                'client_id': ClientID,
                                                                'login_name': strUname
                                                            }, objLogInfo, function callbackupdateusers(err, Res) {
                                                                try {
                                                                    if (err) {
                                                                        callbacksessioninsert(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14605', 'GetTableFromFXDB OTP_LOGS Failed', err))
                                                                    } else {
                                                                        reqInstanceHelper.PrintInfo(serviceName, 'Last successfull login result Updated ', objLogInfo);
                                                                        PrepareLangJson(function (res) {
                                                                            callbacksessioninsert(res)
                                                                        })
                                                                    }
                                                                } catch (error) {
                                                                    callbacksessioninsert(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14606', '_ClearUserSession  function failed ', error));
                                                                }
                                                            })
                                                    } catch (error) {
                                                        callbacksessioninsert(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14607', '_ClearUserSession  function failed ', error));
                                                    }

                                                }
                                            } catch (error) {
                                                callbacksessioninsert(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14619', 'callbackusersessioninsert  function failed ', error));
                                            }
                                        })
                                    } catch (error) {
                                        callbacksessioninsert(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14608', '_ClearUserSession  function failed ', error));
                                    }
                                }

                                // Prepare Language setup from language_dictionary_json
                                function PrepareLangJson(callbacklanguage) {
                                    try {
                                        reqInstanceHelper.PrintInfo(serviceName, 'PrepareLangJson function executing... ', objLogInfo);
                                        if (ldCode != '') {
                                            // Prepare statement of languge
                                            var s = lang_part.split('~');
                                            DBInstance.GetTableFromFXDB(mCltClient, 'language_dictionary_json', ['language_code', 'group', 'group_key', 'ldj_object'], {
                                                'language_code': ldCode,
                                                'client_id': s[0],
                                                'group': s[1]
                                            }, objLogInfo, function (err, resLang) {
                                                try {
                                                    if (err)
                                                        callbacklanguage(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14609', 'GetTableFromFXDB OTP_LOGS Failed', err))
                                                    else {
                                                        _PrepareLangJson(resLang, function (strLangJson) {
                                                            if (strLangJson != '') {
                                                                resultSessionInfo.LANG_DATA = '{' + strLangJson + '}';
                                                            }
                                                            PrepareResultStr(resultSessionInfo, function (res) {
                                                                callbacklanguage(res);
                                                            });

                                                        });
                                                    }
                                                    //Language Data Json
                                                    if (resultSessionInfo.USER_APPS.length > 0) {
                                                        pAppId = resultSessionInfo.USER_APPS[0].APP_ID;
                                                        try {
                                                            DBInstance.GetTableFromFXDB(mCltClient, 'language_dictionary_json', ['language_code', 'group', 'group_key', 'ldj_object'], {
                                                                'language_code': ldCode,
                                                                'client_id': pClientId,
                                                                'group': 'APP',
                                                                'group_key': pAppId
                                                            }, objLogInfo, function (err, resLangData) {
                                                                if (err)
                                                                    callbacklanguage(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14610', 'GetTableFromFXDB OTP_LOGS Failed', err))
                                                                else {
                                                                    _PrepareLangJson(resLangData, function (strLangJson) {
                                                                        if (strLangJson != '') {
                                                                            resultSessionInfo.APP_LANG_DATA = '{' + strLangJson + '}';
                                                                        }
                                                                        PrepareResultStr(resultSessionInfo, function (res) {
                                                                            callbacklanguage(res);
                                                                        });

                                                                    });
                                                                }
                                                            });
                                                        } catch (error) {
                                                            callbacklanguage(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14611', 'GetTableFromFXDB OTP_LOGS Failed', error));
                                                        }
                                                    }
                                                } catch (error) {
                                                    callbacklanguage(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14620', 'GetTableFromFXDB OTP_LOGS Failed', error));
                                                }

                                            });
                                        } else
                                            reqInstanceHelper.PrintInfo(serviceName, 'ldCode not availavle, Continue ', objLogInfo);
                                        PrepareResultStr(resultSessionInfo, function (result) {
                                            callbacklanguage(result);
                                        })
                                    } catch (error) {
                                        callbacklanguage(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14612', '_ClearUserSession  function failed ', error));
                                    }
                                }

                                //prepare Language Json 
                                function _PrepareLangJson(resLang, callback) {
                                    try {
                                        reqInstanceHelper.PrintInfo(serviceName, '_PrepareLangJson Executing...', objLogInfo);
                                        var strlang = '';

                                        for (var i = 0; i < resLang.rows.length; i++) {
                                            if (i > 0)
                                                strlang = strlang + ',';
                                            var str = resLang.rows[i].ldj_object;
                                            str = reqS(str).replaceAll('\\', '').s;
                                            str = reqS(str).replaceAll('{', '').s;
                                            str = reqS(str).replace('}', '').s;
                                            strlang = strlang + str;
                                        }
                                        callback(strlang);
                                    } catch (error) {
                                        callback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14613', '_ClearUserSession  function failed ', error));
                                    }
                                }


                                //Prepare final Result 
                                function PrepareResultStr(resultSessionInfo, callback) {
                                    try {
                                        reqInstanceHelper.PrintInfo(serviceName, 'PrepareResultStr function executing...', objLogInfo);
                                        resultSessionInfo.LOGIN_RESULT = strResult;
                                        resultSessionInfo.MESSAGE = 'SUCCESS';
                                        resultSessionInfo.LOGIN_IP = strClientIp;
                                        ResultStr = JSON.stringify(resultSessionInfo);
                                        callback(sendMethodResponse("SUCCESS", '', ResultStr, '', '', ''));
                                    } catch (error) {
                                        callback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14614', '_ClearUserSession  function failed ', error));
                                    }
                                }

                            }

                        } catch (error) {
                            return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-AUT-14616', 'Exception Occured While WPGetAppSysInfo-GetFXDBConnection ', error);
                        }
                    })
                })
            } catch (error) {
                return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-AUT-14617', 'Exception Occured While WPGetAppSysInfo-AssignLogInfoDetail ', error);
            }

        })
    } catch (error) {
        return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-AUT-14615', 'Exception Occured While Change Password', error);
    }

    function SessionInfo() {
        this.MESSAGE = "";
        this.USER_APPS = "";
        this.LOGIN_IP = "";
        this.APPSYS = "";
        this.LAST_SUCCESSFUL_LOGIN = "";
        this.LAST_UNSUCCESSFUL_LOGIN = "";
        this.ALLOCATED_STATIC_MODULE = "";
        this.LANG_DATA = "";
        this.APP_LANG_DATA = "";
    };

});

//Common Result  Preparation
function sendMethodResponse(status, successMessage, SuccessDataObj, errorCode, errorMessage, errorObject) {
    var obj = {
        'STATUS': status,
        'SUCCESS_MESSAGE': successMessage,
        'SUCCESS_DATA': SuccessDataObj,
        'ERROR_CODE': errorCode,
        'ERROR_MESSAGE': errorMessage,
        'ERROR_OBJECT': errorObject
    }
    return obj
}
module.exports = router;
/*********** End of Service **********/