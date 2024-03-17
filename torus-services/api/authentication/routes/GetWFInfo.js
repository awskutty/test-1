/*
@Api_Name : /GetWFInfo,
@Description: To retrieve WF_MENU_INFO  result , and prepare Language setup,
@Last_Error_Code:ERR-AUT-10128
@Modified for: system routing based on system_tosystem table
*/

// Require dependencies
var modPath = '../../../../node_modules/';
var reqExpress = require(modPath + 'express');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var DBInstance = require('../../../../torus-references/instance/DBInstance');
var reqRedisInstance = require('../../../../torus-references/instance/RedisInstance');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqsvchelper = require('../../../../torus-references/common/serviceHelper/ServiceHelper');
var reqmomnent = require('moment');
var reqLINQ = require(modPath + 'node-linq').LINQ;
var reqJWT = require('jsonwebtoken');
var request = require('request');
const { resolve } = require('path');
const { reject } = require('lodash');
// Initialize Global variables
var serviceName = 'GetWFInfo';
var mDepClient = '';
var mCltClient = '';
var pHeaders = '';

var strResult = '';
var strMessage = '';
var router = reqExpress.Router();



// Host the api to Server
router.post('/GetWFInfo', function callbackCpsignin(appRequest, appResponse) {
    var serviceModel = DBInstance.DBInstanceSession['SERVICE_MODEL'];
    var objLogInfo;
    var systemExtendedInfo = {};
    var userExtendedInfo = {};
    var UserPrefData = {};
    try {

        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, sessionInfo) {
            try {
                _PrintInfo('Begin');
                appResponse.on('close', function () { });
                appResponse.on('finish', function () { });
                appResponse.on('end', function () { });
                var objWF = new WFInfo();
                objWF.Moduleinfo = "";
                objWF.LangInfo = "";
                //objWF.IS_MULTIAPP = "N";
                objLogInfo.PROCESS = 'GetWFInfo-Authentication';
                objLogInfo.ACTION = 'GetWFInfo';
                objLogInfo.HANDLER_CODE = 'Get_WF_Info';
                pHeaders = appRequest.headers;
                var Routingkey = pHeaders['routingkey'];
                var singlearr = [];
                var serviceModel = DBInstance.DBInstanceSession['SERVICE_MODEL'];
                DBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function Callback_GetCassandraConn(pClient) {
                    mDepClient = pClient;
                    DBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function Callback_GetCassandraConnclt(pClientclt) {
                        reqTranDBInstance.GetTranDBConn(pHeaders, false, function (tran_db_instance) {
                            mCltClient = pClientclt;
                            //Redis Session
                            reqRedisInstance.GetRedisConnection(function (error, clientR) {
                                appResponse.setHeader('Content-Type', 'application/json');
                                var IsCompleted = false;
                                var pLdCode = appRequest.body.PARAMS.LD_CODE;
                                var lang_part = appRequest.body.PARAMS.LANG_PART;
                                var tmpid = appRequest.body.PARAMS.LANG_PART.split('~');
                                var pClientId = tmpid[0];
                                var pGroup = tmpid[1];
                                var pGroupkey = tmpid[2];
                                var appid = appRequest.body.PARAMS.APP_ID;
                                var apprid = appRequest.body.PARAMS.APPR_ID;
                                var appu_id = appRequest.body.PARAMS.SESSION_INFO.APPU_ID;
                                var sessinfo = appRequest.body.PARAMS.SESSION_INFO;
                                sessinfo.TIMEZONE_INFO = sessionInfo.TIMEZONE_INFO;
                                var CurrentUId = sessinfo.U_ID;
                                var CurrentSId = sessinfo.SYSTEM_ID;
                                var CurrentPSId = sessinfo.PARENT_S_ID;
                                // var CurrentStCode = sessinfo.ST_CODE;
                                var RedisInsert = [];
                                var RedisSessionIsDisabled = '';
                                var RedisSessionApprID = '';
                                var device = "MOBILE";
                                if (appRequest.body.PARAMS.DEVICE != undefined) {
                                    device = appRequest.body.PARAMS.DEVICE;
                                }
                                objLogInfo.APP_ID = appid;
                                var systemRoutinstCode = objLogInfo.PARENT_SYS_TYPE_FOR_ROUTING;
                                var NeedsysRouting = objLogInfo.NEED_SYSTEM_ROUTING;
                                console.log('---------> NeedsysRouting' + NeedsysRouting);
                                console.log('---------> systemRoutinstCode  ' + systemRoutinstCode);
                                // serviceModel.NEED_SYSTEM_ROUTING = NeedsysRouting;
                                var RoutingSId = '';
                                var ISPortal = false;
                                var Token = appRequest.headers['session-id'];
                                if (Token == undefined) {
                                    Token = sessinfo.SESSION_ID;
                                }
                                var rediskey = 'SESSIONID-' + Token;
                                var arrModules = [];
                                var arrMenuGrps = [];
                                var arrMenuitems = [];
                                var clustersystems = [];

                                //License verification for login application
                                var reqObj = {
                                    type: 'APP'
                                };
                                reqsvchelper.GetLicenseSetup(objLogInfo, reqObj, function (licenseResult) {
                                    try {
                                        if (licenseResult.Status == "SUCCESS") {
                                            //skip license verification if user is "TORUS_ADMIN and tenan_id is "0""
                                            if (licenseResult.Data == 'SKIP_LICENSE_VERIFICATION') {
                                                if (NeedsysRouting == 'Y') {
                                                    //To get the Db session id from system to system table for system based routing
                                                    GetDbsystemId().then(function (dbSid) {
                                                        RoutingSId = dbSid;
                                                        // serviceModel.PARENT_SYS_ID_ROUTING = RoutingSId;
                                                        sessinfo["RoutingSId"] = RoutingSId;
                                                        GetUserAPPRID();
                                                    }).catch(function (error) {
                                                        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-AUT-10128', 'Error occured while geting db system id ', error);
                                                    });
                                                } else {
                                                    //To check Misbehaviour apprId 
                                                    GetUserAPPRID();
                                                }
                                            } else {
                                                var LcType = licenseResult.Data.LICENSE_TYPE;
                                                var isBetween = reqmomnent(new Date()).isBetween(reqmomnent(licenseResult.Data.START_ACTIVE_DATE), reqmomnent(licenseResult.Data.END_ACTIVE_DATE));
                                                if (isBetween) {
                                                    if (NeedsysRouting == 'Y') {
                                                        //To get the Db session id from system to system table for system based routing
                                                        GetDbsystemId().then(function (dbSid) {
                                                            RoutingSId = dbSid;
                                                            // serviceModel.PARENT_SYS_ID_ROUTING = RoutingSId;
                                                            sessinfo["RoutingSId"] = RoutingSId;

                                                            GetUserAPPRID();

                                                        }).catch(function (error) {
                                                            reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-AUT-10128', 'Error occured while geting db system id ', error);
                                                        });
                                                    } else {
                                                        //To check Misbehaviour apprId

                                                        GetUserAPPRID();
                                                    }
                                                } else if (LcType.toUpperCase() == 'TRIAL') {
                                                    reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-AUT-10129', `Your application trial license is expired. Please contact system administrator.`, '');
                                                } else {
                                                    reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-AUT-10129', `Your application license is expired. Please contact system administrator.`, '');
                                                }
                                            }
                                        } else if (licenseResult.ErrorCode == '404') {
                                            reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-AUT-10129', `You do not have license to access this application. Please contact system administrator.`, '');
                                        } else {
                                            reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-AUT-10129', 'Error occured ', licenseResult.Error);
                                        }
                                    } catch (error) {
                                        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-AUT-10132', 'Exception occured while GetLicenseSetup ', error);
                                    }

                                });


                                //To get the Db session id from system to system table for system based routing
                                function GetDbsystemId() {
                                    _PrintInfo('GetDbsystemId function called');
                                    return new Promise((resolve, reject) => {
                                        DBInstance.GetTableFromFXDB(mCltClient, 'SYSTEM_TO_SYSTEM', ['db_s_id'], {
                                            'sts_id': sessinfo.STS_ID
                                        }, objLogInfo, function (err, result) {
                                            if (err) {
                                                reject(err);
                                            } else {
                                                if (result.rows.length) {
                                                    _PrintInfo('DB system is ' + result.rows[0].db_s_id);
                                                    if (result.rows[0].db_s_id) {
                                                        var dbSId = result.rows[0].db_s_id;
                                                        resolve(dbSId);
                                                    } else {
                                                        reject('system level routing not found');
                                                    }
                                                } else {
                                                    reject('system level routing not found');
                                                }
                                            }
                                        });
                                    });
                                }

                                function getUserPreferencesDtls(pcallback) {
                                    getUserPreferences();
                                    function getUserPreferences() {
                                        _PrintInfo('getUserPreferences function called');
                                        var pcond = {
                                            u_id: CurrentUId,
                                            app_id: appid,
                                            category: 'DEFAULT_PAGE'
                                        };
                                        DBInstance.GetTableFromFXDB(mCltClient, 'USER_PREFERENCE', ['category', 'setup_json'], pcond, objLogInfo, function (pErr, pRes) {
                                            if (pErr) {
                                                reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-AUT-10115', 'Error occure while getting user preference details', pErr, 'FAILURE', '');
                                            } else {
                                                var userpreferenceArr = [];
                                                if (pRes.rows.length) {
                                                    userpreferenceArr = pRes.rows.filter((setupValues) => {
                                                        var jsonValues = JSON.parse(setupValues.setup_json);
                                                        return jsonValues.appur_id == apprid;
                                                    });
                                                }
                                                UserPrefData.user_preference = userpreferenceArr;
                                                _PrintInfo('getUserPreferences function ended');
                                                GetLastaccessMenu();
                                            }
                                        });

                                    }
                                    function GetLastaccessMenu() {
                                        _PrintInfo('GetLastaccessMenu function called');
                                        // var query = `select menu_info from user_menu_access_log where app_id='${appid}' and u_id='${CurrentUId}' and appur_id='${apprid}'  order by umal_id desc`;
                                        var selQuery = {
                                            query: `select menu_info from user_menu_access_log where app_id=? and u_id=? and appur_id=?  order by umal_id desc`,
                                            params: [objLogInfo.APP_ID, CurrentUId, apprid]
                                        };
                                        //DBInstance.ExecuteQuery(mCltClient, query, objLogInfo, function (pErr, pRes) {
                                        DBInstance.ExecuteSQLQueryWithParams(mCltClient, selQuery, objLogInfo, function (pRes, pErr) {
                                            if (pRes) {
                                                UserPrefData.last_access_page = pRes.rows[0] || [];
                                                _PrintInfo('GetLastaccessMenu function ended');
                                                GetFavMenu();

                                            } else {
                                                reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-AUT-10115', 'Error occure while getting menu details', pErr, 'FAILURE', '');
                                            }
                                        });
                                    }

                                    function GetFavMenu() {
                                        _PrintInfo('Get fav menu function called');
                                        var pcond = {
                                            U_ID: CurrentUId,
                                            APP_ID: appid,
                                            APPUR_ID: apprid
                                        };
                                        DBInstance.GetTableFromFXDB(mCltClient, 'USER_FAVORITE_MENU', ['menu_info', 'reference_key'], pcond, objLogInfo, function (pErr, pRes) {
                                            if (pErr) {
                                                reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-AUT-10115', 'Error occure while getting user favorite menu', pErr, 'FAILURE', '');
                                            } else {
                                                _PrintInfo('Fet fav menu function ended');
                                                UserPrefData.user_fav_menu = pRes.rows;
                                                _PrintInfo('Get fav menu function ended');
                                                pcallback(UserPrefData);
                                            }
                                        });
                                    }
                                }

                                function GetUserAPPRID() {
                                    //Get Redis session value for the logged in session ID
                                    _PrintInfo('Getting value from redis for rediskey...' + rediskey);
                                    reqInstanceHelper.GetConfig(rediskey, function (strRedisValue) {
                                        try {
                                            var redisValue = JSON.parse(strRedisValue);
                                            if (redisValue.length > 0) {
                                                _PrintInfo('Got Redis value.' + redisValue.length);
                                                RedisInsert = redisValue;
                                                var AppRows = new reqLINQ(redisValue[0].USER_APPS)
                                                    .Where(function (item) {
                                                        return item.APP_ID === appid;
                                                    }).ToArray();
                                                // var RedisSessionApprID = JSON.parse(AppRows[0].CLUSTER_NODES)[0].clustersystems[0].data.appRId
                                                if (AppRows.length) {
                                                    clustersystems = JSON.parse(AppRows[0].CLUSTER_NODES)[0].clustersystems;
                                                    FindISDisabled(clustersystems);

                                                    function FindISDisabled(clustersystems) {
                                                        var astsRow = new reqLINQ(clustersystems)
                                                            .Where(function (item) {
                                                                return item.data.appsts_id === sessinfo.APP_STS_ID;
                                                            }).ToArray();

                                                        if (astsRow.length == 0) {
                                                            findinchildsys(clustersystems[0].children);
                                                        } else {
                                                            RedisSessionIsDisabled = astsRow[0].data.disabled;
                                                            RedisSessionApprID = astsRow[0].data.appRId;
                                                        }

                                                        function findinchildsys(parents) {
                                                            try {
                                                                for (var sys in parents) {
                                                                    if (RedisSessionApprID == '') {
                                                                        if (parents[sys].data.appsts_id == sessinfo.APP_STS_ID) {
                                                                            RedisSessionIsDisabled = parents[sys].data.disabled;
                                                                            RedisSessionApprID = parents[sys].data.appRId;
                                                                            return;
                                                                        } else {
                                                                            findinchildofchildsys(parents[sys].children);
                                                                        }
                                                                    } else {
                                                                        return;
                                                                    }
                                                                }
                                                            } catch (error) {
                                                                reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-AUT-10123', 'Exception occured findinchildsys ', error, 'FAILURE', 'Exception occured findinchildsys ');
                                                            }

                                                        }

                                                        function findinchildofchildsys(childsys) {
                                                            try {
                                                                for (csys in childsys) {
                                                                    if (childsys[csys].data.appsts_id == sessinfo.APP_STS_ID) {
                                                                        RedisSessionIsDisabled = childsys[csys].data.disabled;
                                                                        RedisSessionApprID = childsys[csys].data.appRId;
                                                                        return;
                                                                    } else {
                                                                        findinchildofchildsys(childsys[csys].children);
                                                                    }
                                                                }
                                                            } catch (error) {
                                                                reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-AUT-10124', 'Exception occured findinchildofchildsys ', error, 'FAILURE', 'Exception occured findinchildofchildsys ');
                                                            }
                                                        }
                                                    }
                                                    //Comapre session values and request values 
                                                    _PrintInfo('apprid is ' + apprid);
                                                    _PrintInfo('RedisSessionApprID is ' + RedisSessionApprID);
                                                    if (!apprid && sessinfo.LOGIN_NAME.toUpperCase() == "TORUS_ADMIN") {
                                                        apprid = '0'
                                                    }
                                                    if (typeof apprid == 'string') {
                                                        apprid = apprid;
                                                    } else {
                                                        apprid = apprid[0];
                                                    }
                                                    if (RedisSessionApprID.indexOf(apprid) > -1 || (apprid == '0' && sessinfo.LOGIN_NAME.toUpperCase() == "TORUS_ADMIN")) {
                                                        _PrintInfo('Role matched. Cheking system disabled');
                                                        if (RedisSessionIsDisabled) {
                                                            _PrintInfo('System disabled,login Rejected');
                                                            // RedisInsert.push(sessinfo);
                                                            // clientR.set(rediskey, JSON.stringify(RedisInsert));
                                                            reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-AUT-10120', 'UNAUTHORIZED', '', 'FAILURE', 'Some thing went to wrong');
                                                        } else {
                                                            _PrintInfo('System enabled, executing mainfunction ');
                                                            mainfunction();
                                                        }
                                                    } else {
                                                        // RedisInsert.push(sessinfo)
                                                        // clientR.set(rediskey, JSON.stringify(RedisInsert));
                                                        reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-AUT-10121', 'UNAUTHORIZED', '', 'FAILURE', 'Some thing went to wrong');
                                                    }
                                                } else {
                                                    return reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-AUT-10220', 'Application not found', '', 'FAILURE');
                                                }
                                            } else {
                                                ISPortal = true;
                                                mainfunction();
                                            }
                                        } catch (error) {
                                            reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-AUT-10122', 'Exception occured ', error, 'FAILURE', 'Exception occured ');
                                        }
                                    });
                                }

                                //get system type code  st_code and code appst_id 
                                function mainfunction() {
                                    if (sessinfo.ST_ID) {
                                        getAppsystemType();
                                    } else {
                                        GetWFInfo(function (finalcallback) {
                                            if (finalcallback.STATUS == 'SUCCESS') {
                                                reqInstanceHelper.SendResponse(serviceName, appResponse, finalcallback.SUCCESS_DATA, objLogInfo, '', '', '', 'SUCCESS', finalcallback.SUCCESS_MESSAGE);
                                            } else {
                                                reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, finalcallback.ERROR_CODE, finalcallback.ERROR_MESSAGE, finalcallback.ERROR_OBJECT);
                                            }
                                        });
                                    }
                                }

                                function getAppsystemType() {
                                    try {
                                        DBInstance.GetTableFromFXDB(mCltClient, 'SYSTEM_TYPES', [], {
                                            'st_id': sessinfo.ST_ID
                                        }, objLogInfo, function (pError, pResult) {
                                            if (pError) {
                                                reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-AUT-10115', 'Query SYSTEM_TYPE Failed ', pError, 'FAILURE', '');
                                            } else {
                                                if (pResult.rows.length > 0) {
                                                    // systemExtendedInfo = pResult.rows;
                                                    sessinfo.ST_CODE = pResult.rows[0].st_code;
                                                    sessinfo.ST_DESCRIPTION = pResult.rows[0].st_description;
                                                }
                                                GetSysTypeTargetTableData(pResult.rows, function () {

                                                    if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
                                                        var cond = {};
                                                        cond.setup_code = 'EXTENTED_USER_INFO';
                                                        reqsvchelper.GetSetupJson(mCltClient, cond, objLogInfo, function (res) {
                                                            if (res.Status == 'SUCCESS' && res.Data) {
                                                                aftergetsetupJson(res.Data);
                                                            }
                                                        });
                                                    } else {
                                                        DBInstance.GetTableFromFXDB(mCltClient, 'tenant_setup', ['setup_json'], {
                                                            'client_id': pClientId,
                                                            'tenant_id': sessinfo.TENANT_ID,
                                                            'category': "EXTENTED_USER_INFO"
                                                        }, objLogInfo, function (pError, pRes) {
                                                            if (pError) {
                                                                reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-AUT-10127', 'Error While Querying EXTENTED_USER_INFO Category from TENANT_SETUP', pError, 'FAILURE', '');
                                                            } else {
                                                                aftergetsetupJson(pRes.rows);
                                                            }
                                                        });
                                                    }


                                                    function aftergetsetupJson(pRes) {
                                                        GetUserTargetTableData(pRes, function () {
                                                            DBInstance.GetTableFromFXDB(mCltClient, 'app_system_types', [], {
                                                                'app_id': sessinfo.APP_ID,
                                                                'st_id': sessinfo.ST_ID,
                                                            }, objLogInfo, function (pErr, pRes) {
                                                                try {
                                                                    if (pErr) {
                                                                        reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-AUT-10115', 'Query SYSTEM_TYPE Failed ', pError, 'FAILURE', '');
                                                                    } else {
                                                                        if (pRes.rows.length > 0) {
                                                                            sessinfo.APPST_ID = pRes.rows[0].appst_id;
                                                                        }
                                                                        // main function call and result will send from here
                                                                        GetWFInfo(function (finalcallback) {
                                                                            if (finalcallback.STATUS == 'SUCCESS') {
                                                                                reqInstanceHelper.SendResponse(serviceName, appResponse, finalcallback.SUCCESS_DATA, objLogInfo, '', '', '', 'SUCCESS', finalcallback.SUCCESS_MESSAGE);
                                                                            } else {
                                                                                reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, finalcallback.ERROR_CODE, finalcallback.ERROR_MESSAGE, finalcallback.ERROR_OBJECT);
                                                                            }
                                                                        });
                                                                    }
                                                                } catch (error) {
                                                                    reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-AUT-10116', 'Exception Occured while query app_system_types table ', error, 'FAILURE', '');
                                                                }
                                                            });
                                                        });
                                                    }
                                                });
                                            }
                                        });
                                    } catch (error) {
                                        reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-AUT-10117', 'Exception Occured while getAppsystemType ', error, 'FAILURE', '');
                                    }
                                }


                                function GetSysTypeTargetTableData(arrSystemTypeResult, GetSysTypeTargetTableDataCB) {
                                    try {
                                        if (arrSystemTypeResult.length) {
                                            var systemTypeTargetTable = arrSystemTypeResult[0].target_table;
                                            if (systemTypeTargetTable) {
                                                var condObj = {
                                                    s_id: CurrentSId
                                                };
                                                reqTranDBInstance.GetTableFromTranDB(tran_db_instance, systemTypeTargetTable, condObj, objLogInfo, function (result, error) {
                                                    if (error) {
                                                        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-AUT-10126', 'Error While Querying System Type Target Table...', error);
                                                    } else {
                                                        if (result.length) {
                                                            _PrintInfo('System Extended Information Updated...');
                                                            delete result[0].created_clientip;
                                                            delete result[0].modified_clientip;

                                                            systemExtendedInfo = result[0];
                                                        } else {
                                                            systemExtendedInfo = {};
                                                        }
                                                        GetSysTypeTargetTableDataCB();
                                                    }
                                                });
                                            } else {
                                                _PrintInfo('There is No Target Table From SYSTEM_TYPES Table For System...');
                                                GetSysTypeTargetTableDataCB();
                                            }
                                        } else {
                                            _PrintInfo('There is No Record From SYSTEM_TYPES Table For System...');
                                            GetSysTypeTargetTableDataCB();
                                        }
                                    } catch (error) {
                                        GetSysTypeTargetTableDataCB();
                                    }
                                }

                                function GetUserTargetTableData(arrUserTypeResult, GetUserTargetTableData) {
                                    try {
                                        if (arrUserTypeResult.length) {
                                            tenantSetupJson = arrUserTypeResult[0].setup_json ? JSON.parse(arrUserTypeResult[0].setup_json) : {};
                                            var userTargetTable = tenantSetupJson.TARGET_TABLE;
                                            if (userTargetTable) {
                                                var condObj = {
                                                    u_id: CurrentUId
                                                };
                                                reqTranDBInstance.GetTableFromTranDB(tran_db_instance, userTargetTable, condObj, objLogInfo, function (result, error) {
                                                    if (error) {
                                                        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-AUT-10128', 'Error While Querying Tenant Setup User Target Table...', error);
                                                    } else {
                                                        if (result.length) {
                                                            _PrintInfo('User Extended Information Updated...');
                                                            delete result[0].created_clientip;
                                                            delete result[0].modified_clientip;
                                                            userExtendedInfo = result[0];
                                                        } else {
                                                            userExtendedInfo = {};
                                                        }
                                                        GetUserTargetTableData();
                                                    }
                                                });
                                            } else {
                                                _PrintInfo('There is No Target Table From Tenant Setup For User...');
                                                GetUserTargetTableData();
                                            }
                                        } else {
                                            _PrintInfo('There is No Record From Tenant Setup For EXTENTED_USER_INFO Category...');
                                            GetUserTargetTableData();
                                        }
                                    } catch (error) {
                                        GetUserTargetTableData();
                                    }
                                }

                                // Query WF Info, to get module and menu information
                                function GetWFInfo(finalcallback) {
                                    try {
                                        if (!apprid && sessinfo.LOGIN_NAME.toUpperCase() == "TORUS_ADMIN") {
                                            apprid = '0';
                                        }
                                        DBInstance.GetTableFromFXDB(mDepClient, 'WF_MENU_INFO_FILTER', [], {
                                            'app_id': appid,
                                            'tenant_id': sessinfo.TENANT_ID
                                        }, objLogInfo, function callbackGetwfinfo(err, res) {
                                            try {
                                                if (err) {
                                                    finalcallback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10101', ' Error while querying wf_menu_info', err));
                                                } else {
                                                    if (res.rows.length) {
                                                        objWF.IS_MULTIAPP = "Y";
                                                        sessinfo.IS_MULTIAPP = objWF.IS_MULTIAPP;
                                                        _PrintInfo('Filtered menu info not available. This is  multi app case. Go with main menu info');
                                                    } else {
                                                        objWF.IS_MULTIAPP = "Y";
                                                        sessinfo.IS_MULTIAPP = objWF.IS_MULTIAPP;
                                                    }

                                                    DBInstance.GetTableFromFXDB(mCltClient, ' APP_USER_ROLE_MENUS', [], {
                                                        'app_id': appid,
                                                        'appr_id': apprid,
                                                        'appu_id': appu_id
                                                    }, objLogInfo, function callbackAppUserRoleMenus(error, pRes) {

                                                        if (error) {
                                                            finalcallback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10101', ' Error while querying APP_USER_ROLE_MENUS', error));
                                                        } else {
                                                            // arrModules = pRes.rows;

                                                            var filteredMenu = pRes.rows;
                                                            DBInstance.GetTableFromFXDB(mDepClient, ' WF_MENU_INFO', [], {
                                                                'app_id': appid,
                                                                'appr_id': apprid
                                                            }, objLogInfo, function callbackmenufilter(error, pRes) {
                                                                if (error) {
                                                                    finalcallback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10101', ' Error while querying wf_menu_info', error));
                                                                } else {
                                                                    if (pRes.rows.length) {
                                                                        _PrintInfo('Got menu info result.');
                                                                        var wfMenuInfo = pRes.rows[0];
                                                                        var wfmenuModules = JSON.parse(wfMenuInfo.menu_json).MODULES;
                                                                        try {
                                                                            getUserPreferencesDtls(function (pUserprefRes) {
                                                                                // if (objWF.IS_MULTIAPP == 'YES') {
                                                                                if (filteredMenu.length) {
                                                                                    GetDistinctModuleMenu(filteredMenu);
                                                                                    // To get distinct module and menu group and menu items
                                                                                    _PrintInfo('Compare main menu and filtered menu - Started');
                                                                                    //To remove module from menuinfo json that was not available in filtered json table
                                                                                    for (var i = wfmenuModules.length - 1; i >= 0; i--) {
                                                                                        if (arrModules.indexOf(wfmenuModules[i].UIM_CODE) < 0) {
                                                                                            wfmenuModules.splice(i, 1);
                                                                                        }
                                                                                        else {
                                                                                            if (wfmenuModules[i].MENUGROUPS.length == 0) {
                                                                                                wfmenuModules.splice(i, 1);
                                                                                            }
                                                                                            // To remove unallocated menu groups
                                                                                            for (var j = wfmenuModules[i].MENUGROUPS.length - 1; j >= 0; j--) {
                                                                                                if (arrMenuGrps.indexOf(wfmenuModules[i].MENUGROUPS[j].UIMG_CODE) < 0) {
                                                                                                    wfmenuModules[i].MENUGROUPS.splice(j, 1);
                                                                                                } else {
                                                                                                    if (wfmenuModules[i].MENUGROUPS[j].MENUITEMS.length == 0) {
                                                                                                        wfmenuModules[i].MENUGROUPS.splice(j, 1);
                                                                                                    } else {
                                                                                                        // To remove unallocated screen name
                                                                                                        for (var m = wfmenuModules[i].MENUGROUPS[j].MENUITEMS.length - 1; m >= 0; m--) {
                                                                                                            var screenName = wfmenuModules[i].MENUGROUPS[j].MENUITEMS[m].UIMI_CODE;
                                                                                                            // screenName = 's_' + screenName.replace(/[^A-Za-z0-9_ ]/g, "").replace(/ /g, "_").toLowerCase();
                                                                                                            if (arrMenuitems.indexOf(screenName) < 0) {
                                                                                                                wfmenuModules[i].MENUGROUPS[j].MENUITEMS.splice(m, 1);
                                                                                                            }
                                                                                                        }
                                                                                                    }
                                                                                                }
                                                                                            }
                                                                                        }
                                                                                    }
                                                                                    _PrintInfo('Compare main menu and filtered menu - Ended');
                                                                                    var objRes = {};
                                                                                    objRes.MODULES = wfmenuModules;
                                                                                    // objRes.USER_PREFERENCES = pUserprefRes;
                                                                                    prepareMenu(JSON.stringify(objRes), pUserprefRes, function (resultJson) {
                                                                                        objWF.Moduleinfo = resultJson;
                                                                                        objWF.USER_PREFERENCES = pUserprefRes;
                                                                                    });
                                                                                    prepareLangRes();
                                                                                } else {
                                                                                    sessinfo.IS_MULTIAPP = "Y";
                                                                                    var objRes = {};
                                                                                    objRes.MODULES = wfmenuModules;
                                                                                    // objRes.USER_PREFERENCES = pUserprefRes;
                                                                                    objRes.IS_MULTIAPP = "Y";
                                                                                    prepareMenu(JSON.stringify(objRes), pUserprefRes, function (resultJson) {
                                                                                        objWF.Moduleinfo = resultJson;
                                                                                        objWF.USER_PREFERENCES = pUserprefRes;
                                                                                    });
                                                                                    prepareLangRes();
                                                                                }
                                                                            });
                                                                        } catch (error) {
                                                                            finalcallback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10103', ' Exception occurs after executing wf_menu_info_filter table   ', error));
                                                                        }
                                                                    } else {
                                                                        objWF.Warning = "No modules found";
                                                                        _PrintInfo('WF_MENU_INFO Rows not found ');
                                                                        prepareLangRes();

                                                                    }
                                                                }
                                                            });
                                                        }
                                                    });





                                                }
                                            } catch (error) {
                                                finalcallback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10110', ' Exception occurs while executing WF_MENU_INFO table execution  ', error));
                                            }
                                        });
                                    } catch (error) {
                                        finalcallback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10104', ' Exception occurs after  executing WF_MENU_INFO table   ', error));
                                    }



                                    // To prepare distinct module and menu and menu items
                                    function GetDistinctModuleMenu(pfilteredrows) {
                                        try {
                                            _PrintInfo('Geting distinct module and menu group and menu items from filtered menu info- started');

                                            for (var k = 0; k < pfilteredrows.length; k++) {
                                                if (arrModules.indexOf(pfilteredrows[k].module_code) < 0) {
                                                    arrModules.push(pfilteredrows[k].module_code); //Filtered table Module name
                                                }
                                                if (arrMenuGrps.indexOf(pfilteredrows[k].menu_group_code) < 0) {
                                                    arrMenuGrps.push(pfilteredrows[k].menu_group_code); //Filtered table Menu group name
                                                }
                                                arrMenuitems.push(pfilteredrows[k].menu_item_code); //Filtered table screen name
                                            }
                                            _PrintInfo('Get distinct module menu - Ended');
                                        } catch (error) {
                                            sendMethodResponse('FAILURE', '', '', 'ERR-AUT-10125', 'Error while getting distinct module and menu', error);
                                        }
                                    }

                                    //Prepare Language and result json
                                    function prepareLangRes() {
                                        _PrintInfo('prepareLangRes inner function executing...');
                                        if (pLdCode != '') {
                                            _PrintInfo('Language code is available, need to prepare Language setup');
                                            PrepareLangJson(pClientId, function (result) {
                                                finalcallback(result);
                                            });
                                        } else {
                                            _PrintInfo('Language code is not available');
                                            PrepareResultStr(objWF, function (result) {
                                                finalcallback(result);
                                            });
                                        }
                                    }

                                    //To remove Module if it not have the menu group, Like remove Menu group if it not have menu items
                                    function prepareMenu(menuJsonString, pUserprefData, callback) {
                                        try {
                                            var menuJson = JSON.parse(menuJsonString);
                                            var tempJson = JSON.parse(menuJsonString);
                                            var userPref = pUserprefData.user_fav_menu || [];
                                            if (menuJson != null || menuJson != "") {
                                                for (var moduleIndex = menuJson.MODULES.length - 1; moduleIndex >= 0; moduleIndex--) {
                                                    var groupLength = menuJson.MODULES[moduleIndex].MENUGROUPS.length;
                                                    var UIMDesc = menuJson.MODULES[moduleIndex].UIM_DESCRIPTION;
                                                    for (var groupIndex = groupLength - 1; groupIndex >= 0; groupIndex--) {
                                                        var itemLength = menuJson.MODULES[moduleIndex].MENUGROUPS[groupIndex].MENUITEMS.length;
                                                        var MGDesc = menuJson.MODULES[moduleIndex].MENUGROUPS[groupIndex].UIMG_DESCRIPTION;
                                                        for (var itemIndex = itemLength - 1; itemIndex >= 0; itemIndex--) {
                                                            var MIDesc = menuJson.MODULES[moduleIndex].MENUGROUPS[groupIndex].MENUITEMS[itemIndex].UIMI_DESCRIPTION;
                                                            var deviceType = menuJson.MODULES[moduleIndex].MENUGROUPS[groupIndex].MENUITEMS[itemIndex].ACTIONS[0].DEVICE_TYPE;
                                                            var refKey = `${UIMDesc}>${MGDesc}>${MIDesc}`;
                                                            var FavMenu = userPref.filter((value) => {
                                                                return value.reference_key == refKey;
                                                            });
                                                            if (FavMenu.length) {
                                                                tempJson.MODULES[moduleIndex].MENUGROUPS[groupIndex].MENUITEMS[itemIndex]['IS_FAV_MENU'] = true;
                                                            } else {
                                                                tempJson.MODULES[moduleIndex].MENUGROUPS[groupIndex].MENUITEMS[itemIndex]['IS_FAV_MENU'] = false;
                                                            }

                                                            if (deviceType != device) {
                                                                tempJson.MODULES[moduleIndex].MENUGROUPS[groupIndex].MENUITEMS.splice(itemIndex, 1);
                                                            }
                                                        }
                                                        if (tempJson.MODULES[moduleIndex].MENUGROUPS[groupIndex].MENUITEMS.length == 0) {
                                                            tempJson.MODULES[moduleIndex].MENUGROUPS.splice(groupIndex, 1);
                                                        }
                                                    }
                                                    if (tempJson.MODULES[moduleIndex].MENUGROUPS.length == 0) {
                                                        tempJson.MODULES.splice(moduleIndex, 1);
                                                    }
                                                }
                                            }
                                        } catch (ex) {
                                            callback(ex);
                                        }
                                        callback(JSON.stringify(tempJson));
                                    }

                                    // Prepare language Json for Ld Code from language_dictionary_json table
                                    function PrepareLangJson(pClientId, callback) {
                                        try {
                                            _PrintInfo('PrepareLangJson function executing');
                                            if (pLdCode != '') {
                                                if (tmpid.length < 3) {
                                                    DBInstance.GetTableFromFXDB(mCltClient, 'language_dictionary_json', ['language_code', 'group', 'group_key', 'ldj_object'], {
                                                        language_code: pLdCode,
                                                        client_id: pClientId,
                                                        group: pGroup
                                                    }, objLogInfo, function callbackUserlang(err, resLang) {
                                                        if (err) {
                                                            callback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10105', ' Exception occurs while language_dictionary_json query execution failed ', err));
                                                        } else {
                                                            _PrintInfo('Got language_dictionary_json table result without group_key');
                                                            var strLangJson = JSON.stringify(resLang);
                                                            if (strLangJson != '') {
                                                                _PrepareLangJson(resLangData, function (strRes) {
                                                                    objWF.LangInfo = '{' + strRes.SUCCESS_DATA + '}';
                                                                    PrepareResultStr(objWF, function (result) {
                                                                        callback(result);
                                                                    });
                                                                });
                                                            }
                                                        }
                                                    });
                                                } else {
                                                    //Language Data Json
                                                    _PrintInfo('query language_dictionary_json table with  group_key');
                                                    DBInstance.GetTableFromFXDB(mCltClient, 'language_dictionary_json', ['language_code', 'group', 'group_key', 'ldj_object'], {
                                                        language_code: pLdCode,
                                                        client_id: pClientId,
                                                        group: pGroup,
                                                        group_key: pGroupkey,
                                                    }, objLogInfo, function callbackUserlangdata(err, resLangData) {
                                                        try {
                                                            if (err) {
                                                                callback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10106', 'Querying  language_dictionary_json  failed', err));
                                                            } else {
                                                                var strLangJson = resLangData;
                                                                if (strLangJson.rows.length) {
                                                                    _PrintInfo('Language available against given group key.');
                                                                    _PrepareLangJson(resLangData, function (strRes) {
                                                                        if (strRes.STATUS === "SUCCESS") {
                                                                            objWF.LangInfo = '{' + strRes.SUCCESS_DATA + '}';
                                                                        } else {
                                                                            callback(strRes);
                                                                        }
                                                                    });
                                                                } else {
                                                                    _PrintInfo('Language not available against given group key.');
                                                                    objWF.LangInfo = '{}';
                                                                }
                                                                PrepareResultStr(objWF, function (res) {
                                                                    callback(res);
                                                                });
                                                            }
                                                        } catch (error) {
                                                            callback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10107', ' Exception occurs while executing language_dictionary_json function  ', error));
                                                        }
                                                    });
                                                }
                                            }
                                        } catch (error) {
                                            callback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10108', ' Exception occurs while executing PrepareLangJson function  ', error));
                                        }
                                    }

                                    // To form language info as a string, replace special characters like \\, {,}
                                    function _PrepareLangJson(resLang, callback) {
                                        _PrintInfo('_PrepareLangJson function executing');
                                        try {
                                            var strlang = '';
                                            if (resLang.rows.length > 0) {
                                                for (var i = 0; i < resLang.rows.length; i++) {
                                                    if (strlang) {
                                                        strlang = strlang + ',';
                                                    }
                                                    var str = resLang.rows[i].ldj_object;
                                                    str = str.replaceAll('\\', '');
                                                    str = str.replaceAll('{', '');
                                                    str = str.replace('}', '');
                                                    strlang = strlang + str;
                                                }
                                                callback(sendMethodResponse("SUCCESS", '', strlang, '', '', ''));
                                            } else {
                                                callback(sendMethodResponse("SUCCESS", '', strlang, '', '', ''));
                                            }
                                        } catch (error) {
                                            callback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10109', ' Exception occurs while executing _PrepareLangJson method ', error));
                                        }
                                    }

                                    // To prepare the final result and insert the session info to reis
                                    function PrepareResultStr(pMessage, callback) {
                                        try {
                                            _PrintInfo('PrepareResultStr function executing...................');
                                            // Session info insert into Redis                                  
                                            if (ISPortal) { // portal mode
                                                var NeedJwt = serviceModel.NEED_JWT;
                                                var RedisTTL = '';
                                                DBInstance.GetTableFromFXDB(mCltClient, 'tenant_setup', ['setup_json'], {
                                                    'client_id': pClientId,
                                                    'tenant_id': sessinfo.TENANT_ID,
                                                    'category': "AUTHENTICATION"
                                                }, objLogInfo, function (perr, pRes) {
                                                    if (perr) {
                                                        callback(sendMethodResponse('FAILURE', '', '', 'ERR-AUT-10119', 'Error occured when get the session timeout setup ', error));
                                                    } else {
                                                        var Setupjson = JSON.parse(pRes.rows[0].setup_json);
                                                        _PrintInfo('Need system Routingkey ' + Setupjson.NEED_SYSTEM_ROUTING);
                                                        sessinfo.NEED_SYSTEM_ROUTING = Setupjson.NEED_SYSTEM_ROUTING;
                                                        //sessinfo.PARENT_SYS_TYPE_FOR_ROUTING = Setupjson.PARENT_SYS_TYPE_FOR_ROUTING
                                                        if (NeedJwt != undefined && NeedJwt == "Y" && ISPortal) {
                                                            _PrintInfo('Portal screen loading');
                                                            RedisTTL = Setupjson.PORTAL_JWT_TIMEOUT;
                                                        } else {
                                                            RedisTTL = Setupjson.SERVER_TIMEOUT;
                                                        }
                                                        //For portal screen loadin Generate new session id and save into redis send it to client
                                                        var session = sessinfo.LOGIN_NAME + '-' + Date.now();
                                                        //JWT Token generation
                                                        var JWT_SECRET_KEY = 'SESSIONID-' + session;
                                                        var token = reqJWT.sign({
                                                            login_name: sessinfo.LOGIN_NAME
                                                        }, JWT_SECRET_KEY, {});
                                                        rediskey = 'SESSIONID-' + token;

                                                        // portalsession.token = token;
                                                        // portalsession.sessionid = session;//KEYGEN SECRET
                                                        pMessage.SESSION_ID = token; ////for old pack do not  distrub
                                                        sessinfo.JWT_SECRET_KEY = JWT_SECRET_KEY;
                                                        sessinfo.ROUTINGKEY = Routingkey;
                                                        sessinfo.USER_EXTENDED_INFO = userExtendedInfo;
                                                        RedisInsert[0]['SELECTED_ROLE'] = apprid;
                                                        sessinfo.SYSTEM_EXTENDED_INFO = systemExtendedInfo;
                                                        console.log('Routingkey  Routingkey  Routingkey  ' + Routingkey);
                                                        getaccesstoken(function getTokenRes(ExttokenRes) {
                                                            reqRedisInstance.GetRedisConnectionwithIndex(2, function (error, RedisSession) {
                                                                reqRedisInstance.RedisInsert(RedisSession, rediskey, sessinfo, RedisTTL);
                                                                // clientR.set(rediskey, JSON.stringify(sessinfo));
                                                                pMessage.isportal = ISPortal;
                                                                _PrintInfo('Session info successfully inserted into Redis for portal');
                                                                finalRes();
                                                            });
                                                        });
                                                    }
                                                });
                                            } else {

                                                DBInstance.GetTableFromFXDB(mCltClient, 'tenant_setup', ['setup_json'], {
                                                    'client_id': pClientId,
                                                    'tenant_id': sessinfo.TENANT_ID,
                                                    'category': "AUTHENTICATION"
                                                }, objLogInfo, function (perr, pRes) {
                                                    if (perr) {

                                                    } else {
                                                        pMessage.isportal = ISPortal;
                                                        var Setupjson = JSON.parse(pRes.rows[0].setup_json);
                                                        sessinfo.INBOX_SYSTEM_TYPES = Setupjson.INBOX_SYSTEM_TYPE
                                                        var userFavMenu = pMessage.USER_PREFERENCES;
                                                        getaccesstoken(function (ExttokenRes) {
                                                            if (ExttokenRes == "SUCCESS") {
                                                                sessinfo.ROUTINGKEY = Routingkey;
                                                                RedisInsert[0]['SELECTED_ROLE'] = apprid;
                                                                RedisInsert[0]['ROUTINGKEY'] = Routingkey;
                                                                RedisInsert[1] = sessinfo;
                                                                // reqRedisInstance.GetRedisConnectionwithIndex(2, async function (error, RedisSession) {
                                                                // Remain TTL get 
                                                                // RedisSession.TTL(rediskey, function (err, ttl) {
                                                                // var ttl = await RedisSession.TTL(rediskey)
                                                                //Redis insert with TTL
                                                                // reqRedisInstance.RedisInsert(RedisSession, rediskey, RedisInsert, ttl);
                                                                // _PrintInfo('Session info successfully inserted into Redis for wp');
                                                                finalRes();
                                                                // });
                                                                // });
                                                            }

                                                        });
                                                    }
                                                })
                                            }

                                            function finalRes() {
                                                GetStaticModules(async function (staticModule) {
                                                    try {
                                                        var ArchivalRequiredMenus = await getMenuInfoExtented()
                                                        var SessionINFO = {};
                                                        SessionINFO.ST_CODE = sessinfo.ST_CODE;
                                                        SessionINFO.ST_DESCRIPTION = sessinfo.ST_DESCRIPTION;
                                                        SessionINFO.APPST_ID = sessinfo.APPST_ID;
                                                        SessionINFO.EXT_AUTH_TOKEN_BLOCKCHAIN = sessinfo.EXT_AUTH_TOKEN_BLOCKCHAIN || '';
                                                        pMessage.UpdateSession = SessionINFO;
                                                        pMessage.systemExtendedInfo = systemExtendedInfo;
                                                        pMessage.userExtendedInfo = userExtendedInfo;
                                                        pMessage.ALLOCATED_STATIC_MODULE = staticModule;
                                                        pMessage.ARCHIVALDB_REQ_MENUS = ArchivalRequiredMenus;
                                                        pMessage.INBOX_SYSTEM_TYPE = sessinfo.INBOX_SYSTEM_TYPES
                                                        var strResponse = JSON.stringify(pMessage);

                                                        RedisInsert[1].MODULEINFO = pMessage.Moduleinfo ? JSON.parse(pMessage.Moduleinfo) : [];
                                                        RedisInsert[1].STATIC_MODULE = staticModule;
                                                        reqRedisInstance.GetRedisConnectionwithIndex(2, async function (error, RedisSession) {
                                                            // Remain TTL get 
                                                            // RedisSession.TTL(rediskey, function (err, ttl) {
                                                            var ttl = await RedisSession.TTL(rediskey)
                                                            //Redis insert with TTL
                                                            reqRedisInstance.RedisInsert(RedisSession, rediskey, RedisInsert, ttl);
                                                            _PrintInfo('Session info successfully inserted into Redis for wp');
                                                            callback(sendMethodResponse('SUCCESS', '', strResponse, '', '', ''));
                                                            // });
                                                        });
                                                    } catch (error) {
                                                        callback(sendMethodResponse('FAILURE', '', '', 'ERR-AUT-10142', 'Exception Occured While executing GetStaticModules function  ', error));
                                                    }
                                                });
                                            }

                                            function getaccesstoken(callbackextauth) {
                                                try {
                                                    if (sessinfo.NEED_EXT_AUTH == "Y") {
                                                        clientR.get('EXTERNAL_AUTH_INFO_' + objLogInfo.headers.routingkey, function (err, Info) {
                                                            //For Block chain loging
                                                            var HYPER_LEDGER_INFO = JSON.parse(Info).HYPER_LEDGER;
                                                            var apiurl = HYPER_LEDGER_INFO.API_URL;
                                                            var Blockscret = HYPER_LEDGER_INFO.SECRET_KEY;
                                                            var BlockJwtExpire = HYPER_LEDGER_INFO.Expire;
                                                            var Blockjwt = reqJWT.sign({
                                                                login_name: sessinfo.LOGIN_NAME,
                                                                id: sessinfo.LOGIN_NAME
                                                            }, Blockscret, {
                                                                expiresIn: BlockJwtExpire
                                                            });
                                                            var jwtoptions = {
                                                                method: 'GET',
                                                                url: apiurl + 'auth/jwt/callback',
                                                                headers: {
                                                                    Authorization: 'Bearer ' + Blockjwt
                                                                }
                                                            };
                                                            request(jwtoptions, function (error, response, body) {
                                                                if (error) {
                                                                    reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-AUT-14851', "Block jwt callback error", error);
                                                                } else {
                                                                    var accessToken = JSON.parse(body).access_token;
                                                                    sessinfo.EXT_AUTH_TOKEN_BLOCKCHAIN = accessToken;
                                                                    callbackextauth("SUCCESS");
                                                                }
                                                            });
                                                        });
                                                    } else {
                                                        callbackextauth("SUCCESS");
                                                    }

                                                } catch (error) {
                                                    callbackextauth(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14853', 'Exception Occured ext Login', error));
                                                }
                                            }


                                            function getMenuInfoExtented() {
                                                return new Promise((resolve, reject) => {
                                                    try {
                                                        var whereCond = {};
                                                        whereCond.app_id = appid;
                                                        whereCond.appr_id = apprid
                                                        DBInstance.GetTableFromFXDB(mDepClient, 'wf_menu_info_extented', [], whereCond, objLogInfo, function (pError, result) {
                                                            if (pError) {
                                                                reject(pError)
                                                            } else {
                                                                var archhivalModeMenus = []
                                                                if (result.rows && result.rows.length) {
                                                                    var resRows = result.rows;
                                                                    archhivalModeMenus = JSON.parse(resRows[0].menu_items)
                                                                }
                                                                resolve(archhivalModeMenus)
                                                            }
                                                        })
                                                    } catch (error) {
                                                        console.log(error)
                                                        reject(error)
                                                    }
                                                })
                                            }

                                        } catch (error) {
                                            callback(sendMethodResponse('FAILURE', '', '', 'ERR-AUT-10112', 'Exception Occured While PrepareResultStr function  ', error));
                                        }
                                    }
                                }

                                // Get staticModule info for appuser Role
                                // Query and get the static module group from "app_role_static_module" table

                                function GetStaticModules(returnBack) {
                                    try {
                                        // if role id "0" then get all the static module from "CODE_DESCRIPTIONS" table.
                                        _PrintInfo('Getting static menu details');
                                        var allocatedModule = [];
                                        if (apprid == '0') {
                                            DBInstance.GetTableFromFXDB(mCltClient, 'CODE_DESCRIPTIONS', [], {
                                                CDT_CODE: 'STATIC_MODULE'
                                            }, objLogInfo, function (pErr, pRes) {
                                                if (pErr) {
                                                    reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-AUT-10118', 'Error Occured While get code desc value ', pErr);
                                                } else if (pRes.rows.length) {
                                                    var codeDesStaticModule = JSON.parse(pRes.rows[0].code_value);
                                                    var favMenus = UserPrefData.user_fav_menu || [];
                                                    // for (var stmg = 0; stmg < stMenugrop.length; stmg++) {
                                                    for (var cdmg = 0; cdmg < codeDesStaticModule.length; cdmg++) {
                                                        var curntScrn = codeDesStaticModule[cdmg].DESC;
                                                        var FavMenu = favMenus.filter((value) => {
                                                            // var parsedMenuInfo = JSON.parse(value.menu_info);
                                                            return curntScrn == JSON.parse(value.menu_info).menuItem;
                                                        });
                                                        if (FavMenu.length) {
                                                            codeDesStaticModule[cdmg]['IS_FAV_MENU'] = true;
                                                        } else {
                                                            codeDesStaticModule[cdmg]['IS_FAV_MENU'] = false;
                                                        }
                                                        allocatedModule.push(codeDesStaticModule[cdmg]);
                                                    }

                                                    returnBack(allocatedModule);
                                                } else {
                                                    _PrintInfo('Static module entry not available in code desc table');
                                                    returnBack(allocatedModule);
                                                }
                                            });
                                        } else {
                                            DBInstance.GetTableFromFXDB(mCltClient, 'APP_ROLE_STATIC_MODULE', [], {
                                                APPR_ID: apprid
                                            }, objLogInfo, function (err, res) {
                                                if (err) {
                                                    reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-AUT-10119', 'Error Occured While get code desc value ', pErr);
                                                } else if (res.rows.length) {
                                                    _PrintInfo('Got the result from role based static entries. Total number of allocated MGs | ' + res.rows.length);
                                                    var stMenugrop = JSON.parse(res.rows[0].static_module);
                                                    DBInstance.GetTableFromFXDB(mCltClient, 'CODE_DESCRIPTIONS', [], {
                                                        CDT_CODE: 'STATIC_MODULE'
                                                    }, objLogInfo, function (pErr, pRes) {
                                                        if (pErr) {
                                                            reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-AUT-10118', 'Error Occured While get code desc value ', pErr);
                                                        } else if (pRes.rows.length) {
                                                            var codeDesStaticModule = JSON.parse(pRes.rows[0].code_value);
                                                            var favMenus = UserPrefData.user_fav_menu || [];
                                                            for (var stmg = 0; stmg < stMenugrop.length; stmg++) {
                                                                for (var cdmg = 0; cdmg < codeDesStaticModule.length; cdmg++) {
                                                                    if (stMenugrop[stmg].DESC === codeDesStaticModule[cdmg].DESC && stMenugrop[stmg].MENU_GROUP == codeDesStaticModule[cdmg].MENU_GROUP) {
                                                                        var curntScrn = codeDesStaticModule[cdmg].DESC;
                                                                        var curntMg = codeDesStaticModule[cdmg].MENU_GROUP;
                                                                        var FavMenu = favMenus.filter((value) => {
                                                                            // var parsedMenuInfo = JSON.parse(value.menu_info);
                                                                            return curntScrn == JSON.parse(value.menu_info).menuItem;
                                                                        });
                                                                        if (FavMenu.length) {
                                                                            codeDesStaticModule[cdmg]['IS_FAV_MENU'] = true;
                                                                        } else {
                                                                            codeDesStaticModule[cdmg]['IS_FAV_MENU'] = false;
                                                                        }

                                                                        allocatedModule.push(codeDesStaticModule[cdmg]);
                                                                    }
                                                                }
                                                            }
                                                            returnBack(allocatedModule);
                                                        } else {
                                                            _PrintInfo('Static module entry not available in code desc table');
                                                            returnBack(allocatedModule);
                                                        }
                                                    });
                                                } else {
                                                    // no static module assiged to this role
                                                    _PrintInfo('There is no static menu allocated to this role | ' + apprid);
                                                    returnBack(allocatedModule);
                                                }
                                            });
                                        }
                                    } catch (error) {
                                        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-AUT-10120', 'Exception Occured While GetStaticModules function ', error);
                                    }
                                }
                            });
                        });
                    });
                });
            } catch (error) {
                reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-AUT-10113', 'Exception Occured While GetWFInfo function ', error);
            }
        });
    } catch (error) {
        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-AUT-10114', 'Exception Occured While GetWFInfo function ', error);
    }

    function _PrintInfo(pMessage) {
        reqInstanceHelper.PrintInfo(serviceName, pMessage, objLogInfo);
    }

});



function WFInfo() {
    this.Moduleinfo = "";
    this.LangInfo = "";
    this.USER_PREFERENCES = "";
    //this.IS_MULTIAPP = "N";
}

function sendMethodResponse(status, successMessage, SuccessDataObj, errorCode, errorMessage, errorObject) {
    var obj = {
        'STATUS': status,
        'SUCCESS_MESSAGE': successMessage,
        'SUCCESS_DATA': SuccessDataObj,
        'ERROR_CODE': errorCode,
        'ERROR_MESSAGE': errorMessage,
        'ERROR_OBJECT': errorObject
    };
    return obj;
}


module.exports = router;
//*******End of Service*******//