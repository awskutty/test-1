/*
 *  * @Api_Name : /GetClientAppUsers,
@Description: To GetClientAppUsers
@Last_Error_code:ERR-MIN-50745
@Last_modified for : comma seprated for error handling 
@Last_modified for : Framework Changes not reflected in 220 Env 

 */
// Require dependencies
var modPath = '../../../../node_modules/';
var reqExpress = require('express');
var reqLINQ = require('node-linq').LINQ;
var router = reqExpress.Router();
var unique = require('array-unique');
var async = require('async');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqsvchelper = require('../../../../torus-references/common/serviceHelper/ServiceHelper');




// Host the login api
router.post('/GetClientAppUsers', function (appRequest, appResponse) {
    var cond = {};
    var strServiceName = "GetClientAppUsers";
    // var objLogInfo = '';
    var arrUSER = [];
    var User_Search_Str = '';
    var Sys_Search_Str = '';
    var Role_Search_Str = '';
    //  var resData = {}; 
    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, sessionInfo) {
        try {
            var APP_ID = sessionInfo.APP_ID;
            var PCLIENT_ID = sessionInfo.CLIENT_ID;
            var SYSTEM_DESC = sessionInfo.SYSTEM_DESC;
            var StrTntId = sessionInfo.TENANT_ID;
            var Ismultiapp = sessionInfo.IS_MULTIAPP;

            var strSID = sessionInfo.S_ID;
            // var Ismultiapp='Y';
            reqInstanceHelper.PrintInfo(strServiceName, 'Begin', objLogInfo);
            appResponse.on('close', function () { });
            appResponse.on('finish', function () { });
            appResponse.on('end', function () { });
            objLogInfo.HANDLER_CODE = 'GetClientAppUsers';
            objLogInfo.PROCESS = 'GetClientAppUsers-MiniGoverner';
            objLogInfo.ACTION_DESC = 'GetClientAppUsers';
            reqInstanceHelper.PrintInfo(strServiceName, 'Service Begined Successfully', objLogInfo);
            var mHeaders = appRequest.headers;

            reqFXDBInstance.GetFXDBConnection(mHeaders, 'clt_cas', objLogInfo, function CallbackGetCassandraConn(pCltClient) {
                reqInstanceHelper.PrintInfo(strServiceName, 'Cassandra Connection initiated Successfully', objLogInfo);
                var mCltClient = pCltClient;
                var strInputParamJson = appRequest.body.PARAMS;
                appResponse.setHeader('Content-Type', 'application/json');
                // Initialize the variables
                User_Search_Str = appRequest.body.PARAMS.USER_SEARCH;
                Sys_Search_Str = appRequest.body.PARAMS.SYSTEM_SEARCH;
                Role_Search_Str = appRequest.body.PARAMS.ROLE_SEARCHVAL;
                var Advance_search = appRequest.body.PARAMS.AdvanceSearch;
                var SIDARR = appRequest.body.PARAMS.SIDArr;
                var client_s_id = appRequest.body.PARAMS.S_ID;
                var screen_name = appRequest.body.PARAMS.SCREEN_NAME;
                var stsID = strInputParamJson.STS_ID;
                var ShowAllUsers = strInputParamJson.SHOW_OTHERS_USERS;
                var pApp_id = APP_ID;
                var pClient_id = PCLIENT_ID;
                var sysdesc = SYSTEM_DESC;
                var sbsys = '';
                var issearch = '';
                var totalRecords = '';
                var totalpages = '';
                var pageno = appRequest.body.PARAMS.CURRENT_PAGENO;
                var recordsPerPage = appRequest.body.PARAMS.RECORDS_PER_PAGE;
                if (User_Search_Str != '' || Sys_Search_Str != '' || Role_Search_Str != '') {
                    reqInstanceHelper.PrintInfo(strServiceName, 'Search true ', objLogInfo);
                    issearch = 'Y';
                } else {
                    reqInstanceHelper.PrintInfo(strServiceName, 'Default load all assigned users for current logedin system ', objLogInfo);
                    Sys_Search_Str = '';
                    issearch = 'N';
                }
                var appstsarr = [];
                // var resultset = new resultinfo();
                var lstAppu_id = '';
                var arrappusr = [];
                var GetAPPUID = [];
                var GetUID = [];
                var arrUsrData = [];
                var GetUserSearchRes = [];
                var GetSrchUID = [];
                var arrAppUsrSTS = [];
                var GetAppSTSID = [];
                var arrSTSDet = [];
                var Sys_Search = [];
                var arrAPPRDet = [];
                var GetAPPRID = [];
                var arrRole = [];
                var arrFinAppRoleDetails = [];
                var arrFinAppURDetails = [];
                var GetFinalAPPR_ID = [];
                var arrFinAppSTSDetails = [];
                var arrFinAppUserSTSDetails = [];
                var GetFinalAPPSTS_ID = [];
                var arrUserDetails = [];
                var GetFinalUID = [];
                var arrAPPUserDetails = [];
                var arrAPPUF = [];
                var matches = [];
                var IsAB = true;
                var IsAC = true;
                var IsBC = true;
                var arrFilUAppUsrs = [];
                var arrFilSTSAppUsrs = [];
                var arrFilRAppUsrs = [];
                var RoleSearch = [];
                var appUserRoleMenus = []
                var strUids = ''
                var uids = ''
                var userpage = ''
                var arrAppDetails = [];
                var arrAppuserDetails = [];
                var cond = {};
                cond.setup_code = 'NEW_USER_CREATION';
                reqsvchelper.GetSetupJson(mCltClient, cond, objLogInfo, function (res) {
                    if (res.Status == 'SUCCESS' && res.Data.length) {
                        var Setupjson = JSON.parse(res.Data[0].setup_json);
                        makerCheckerModel = Setupjson.NEED_MAKER_CHECKER_MODEL;
                    }
                    var serviceModel = reqFXDBInstance.DBInstanceSession['SERVICE_MODEL'];
                    if (serviceModel.TYPE == 'ULTIMATE') {
                        reqInstanceHelper.PrintInfo(strServiceName, 'Running ServiceModel is ULTIMATE.DoFilter funtion will executing...', objLogInfo);
                        DoFilter();
                    } else if (serviceModel.TYPE == 'LITE' && serviceModel.TRANDB == 'ORACLE') {
                        reqInstanceHelper.PrintInfo(strServiceName, 'Running ServiceModel is LITE and DB Type is ORACLE, DoFilter funtion will executing... ', objLogInfo);
                        DoFilter();
                    } else if (serviceModel.TYPE == 'LITE' && (serviceModel.TRANDB == 'POSTGRES' || serviceModel.TRANDB == 'MYSQL')) {
                        reqInstanceHelper.PrintInfo(strServiceName, 'Running ServiceModel is LITE and DB Type is POSTGRES litefiler function will executing...', objLogInfo);
                        // litefiler();
                        DoFilter();

                    }
                    //Prepare do filter
                    function DoFilter() {
                        try {
                            reqInstanceHelper.PrintInfo(strServiceName, 'Querying app_users table', objLogInfo);
                            var appuserfilter = {};
                            if (Ismultiapp == 'Y') {
                                appuserfilter = {};
                            } else {
                                //appuserfilter.app_id = pApp_id;
                            }
                            reqFXDBInstance.GetTableFromFXDB(mCltClient, 'iv_app_users', ['u_id', 'appu_id', 'app_id', 'ug_code', 'role_mode'], appuserfilter, objLogInfo, function callbackfilter(err, result) {
                                if (err) {
                                    return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50701', 'Querying app_users table have been failed', err, '', '');
                                } else {
                                    try {
                                        if (result.rows.length > 0) {
                                            reqInstanceHelper.PrintInfo(strServiceName, 'Got result from app_users table', objLogInfo);
                                            arrappusr = result.rows;

                                            GetAPPUID = new reqLINQ(result.rows)
                                                .Select(function (APPUID) {
                                                    return APPUID.appu_id;
                                                }).ToArray();
                                            GetUID = new reqLINQ(result.rows)
                                                .Select(function (UID) {
                                                    return UID.u_id;
                                                }).ToArray();
                                        }
                                        else {
                                            reqInstanceHelper.SendResponse(strServiceName, appResponse, 'FAILURE', objLogInfo, 'ERR-UI-110612', 'No records found in user table', '', "FAILURE", '');
                                        }
                                        _GetUsers();

                                    } catch (error) {
                                        return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50702', 'Error while calling GetAPPUID or GetUID  LINQ query', error, '', '');
                                    }
                                }
                            });

                        } catch (error) {
                            return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50703', 'Error while Calling DoFilter Function', error, '', '');
                        }
                    }

                    function _GetUsers() {
                        try {
                            var colList = ['pwd_type', 'created_date', 'created_by_name', 'status', 'action_desc', 'approval_status', 'remarks', 'start_active_date', 'end_active_date', 'login_name', 'system_id', 'u_id', 'client_id', 'allocated_designer', 'double_authentication', 'allocated_static_module', 'double_authentication_model', 'email_id', 'first_name', 'last_name', 'enforce_change_password', 'middle_name', 'mobile_no', 'water_marking', 'is_enabled', 'session_timeout', 'allocated_ip', 'last_successful_login', 'account_locked_date', 'profile_pic'];
                            strUids = _FormStringCondition(GetUID);
                            uids = strUids.split(',', strUids.length);
                            cond = {
                                u_id: uids,
                                client_id: pClient_id
                            };
                            if (Ismultiapp == 'Y') {
                                cond = {};
                            }
                            if (client_s_id != undefined && client_s_id != '') {
                                strSID = client_s_id;
                            }
                            if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
                                cond = {};

                                // SIDARR = [];
                                if (SIDARR == undefined) {
                                    SIDARR = [];
                                }
                                if (Advance_search == undefined) {
                                    SIDARR.push(strSID);
                                }

                                // if (Advance_search || Advance_search == '') {


                                var SIDS = SIDARR;
                                // cond['tenant_id'] = StrTntId;
                                async.forEachOfSeries(SIDS, function (value, key, callback1) {
                                    // cond['system_id'] = value;
                                    cond.tenant_id = objLogInfo.TENANT_ID
                                    GetusersList(colList, value, function (res) {
                                        // getDynamicatmt.push()
                                        callback1();
                                    });
                                }, function (err) {
                                    if (err != '') {
                                        //reqInstanceHelper.SendResponse(strServiceName, appResponse, 'FAILURE', objLogInfo, 'ERR-UI-110612', err, null, "FAILURE", '');

                                        afteruserGot(arrUsrData);
                                    } else {
                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, 'SUCCESS', objLogInfo, null, null, null);

                                    }
                                });
                            } else {
                                GetusersList(colList);
                            }
                            reqInstanceHelper.PrintInfo(strServiceName, 'Querying users table', objLogInfo);


                        } catch (error) {
                            return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50706', 'Error in Calling _GetUsers function ', error, '', '');
                        }
                    }


                    function GetusersList(colList, SID, aysnCallback) {
                        if(screen_name == 'APPROVESCREEN'){
                            if (User_Search_Str == '' || User_Search_Str == undefined) {  
                            var selectQuery = `select * from users where tenant_id = '${cond.tenant_id}' and u_id in (select u_id from iv_app_users) and login_name not in ('VPH_ADMIN','NPSS_ADMIN') and (status is null or status='ACTIVE' or status='DISABLED' or status='READY_FOR_APPROVAL' or status='REJECTED' or status='ACCOUNT_LOCKED') and (action_desc = 'CREATE_REQUEST' or action_desc = 'DELETE_REQUEST' or action_desc = 'MODIFY_REQUEST') order by login_name`;
                            } else {
                                selectQuery = `select * from users where tenant_id = '${cond.tenant_id}' and u_id in (select u_id from iv_app_users) and login_name not in ('VPH_ADMIN','NPSS_ADMIN') and (status is null or status='ACTIVE' or status='DISABLED' or status='READY_FOR_APPROVAL' or status='REJECTED' or status='ACCOUNT_LOCKED') and (action_desc = 'CREATE_REQUEST' or action_desc = 'DELETE_REQUEST' or action_desc = 'MODIFY_REQUEST') and login_name like '%${User_Search_Str.toUpperCase()}%' order by login_name`;
                            }
                        }
                        else {

                        if (User_Search_Str == '' || User_Search_Str == undefined) {
                            selectQuery = `select * from users where tenant_id = '${cond.tenant_id}' and u_id in (select u_id from iv_app_users) and login_name not in ('VPH_ADMIN','NPSS_ADMIN') and (status is null or status='ACTIVE' or status='DISABLED' or status='READY_FOR_APPROVAL' or status='REJECTED' or status='ACCOUNT_LOCKED') order by login_name`;
                        } else {
                            selectQuery = `select * from users where tenant_id = '${cond.tenant_id}' and u_id in (select u_id from iv_app_users) and login_name not in ('VPH_ADMIN','NPSS_ADMIN') and (status is null or status='ACTIVE' or status='DISABLED' or status='READY_FOR_APPROVAL' or status='REJECTED' or status='ACCOUNT_LOCKED') and login_name like '%${User_Search_Str.toUpperCase()}%' order by login_name`;
                        }
                    }
                        if (pageno == undefined && recordsPerPage == undefined) {
                            // this.pageno = '';
                            pageno = 1;
                            userpage = 1;
                            recordsPerPage = 10;
                        }


                        //`select * from clt_tran.users where tenant_id='aefab' and u_id in (select u_id from clt_tran.app_users) and (status is null or status='ACTIVE' or status='DISABLED' or status='READY_FOR_APPROVAL' or status='REJECTED' or status='ACCOUNT_LOCKED') order by login_name`

                        reqFXDBInstance.ExecuteQueryWithPagingCount(mCltClient, selectQuery, pageno, recordsPerPage, objLogInfo, function (UserRes, pCount, err) {


                            //   reqFXDBInstance.GetTableFromFXDB(mCltClient, 'USERS', colList, cond, objLogInfo, function (err, UserRes) {
                            if (err) {
                                return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50704', 'Querying  users table have been failed', err, '', '');
                            } else {
                                try {
                                    this.totalRecords = pCount[0].count;

                                    if (UserRes.length > 0) {

                                        reqInstanceHelper.PrintInfo(strServiceName, 'Got result from users table', objLogInfo);
                                        if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0' && Advance_search != undefined) {
                                            let getrows = UserRes;
                                            for (var i = 0; i < getrows.length; i++) {
                                                arrUsrData.push(getrows[i]);
                                            }
                                        } else {
                                            arrUsrData = UserRes;
                                        }                                       
                                        afteruserGot(arrUsrData);                                        
                                    } else {
                                        if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0' && (Advance_search != '' || ShowAllUsers != '')) {
                                            _getallocatedusers(SID, function (res) {
                                                if (ShowAllUsers == 'Y') {
                                                    for (var k = 0; k < res.length; k++) {
                                                        var filterUserData = arrUsrData.filter((data) => {
                                                            return data.u_id == res[k].u_id;
                                                        });
                                                        if (filterUserData.length == 0) {
                                                            arrUsrData.push(res[k]);
                                                        }
                                                    }
                                                    if (UserRes.rows.length == 0) {
                                                        UserRes.rows = arrUsrData;
                                                    }
                                                } else {
                                                    arrUsrData = [];
                                                    for (var k = 0; k < res.length; k++) {
                                                        if (arrUsrData.indexOf(res[k]) == -1) {
                                                            arrUsrData.push(res[k]);
                                                        }
                                                    }
                                                }
                                                aysnCallback(arrUsrData);
                                            });
                                        } else {
                                            afteruserGot(arrUsrData);
                                        }
                                    }

                                } catch (error) {
                                    return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50705', 'Error in GetUserSearchRes or GetSrchUID LINQ query', error, '', '');
                                }
                            }

                        });
                    
                    }

                    function afteruserGot(UsersList) {
                        if (Advance_search || Advance_search == '') {
                            reqInstanceHelper.PrintInfo(strServiceName, 'User search param available ', objLogInfo);
                            for (var i = 0; i < UsersList.length; i++) {
                                if (UsersList[i].login_name.toUpperCase().indexOf(Advance_search.toUpperCase()) != -1) {
                                    GetUserSearchRes.push(UsersList[i]);
                                }
                            }                            

                            GetSrchUID = new reqLINQ(GetUserSearchRes)
                                .Select(function (UID) {
                                    return UID.u_id;
                                }).ToArray();
                        } else if (User_Search_Str != '' && User_Search_Str != undefined) {
                            reqInstanceHelper.PrintInfo(strServiceName, 'User search param available ', objLogInfo);
                            for (var i = 0; i < UsersList.length; i++) {
                                if (UsersList[i].login_name.toUpperCase().indexOf(User_Search_Str.toUpperCase()) != -1) {
                                    GetUserSearchRes.push(UsersList[i]);
                                }
                            }
                            GetSrchUID = new reqLINQ(GetUserSearchRes)
                                .Select(function (UID) {
                                    return UID.u_id;
                                }).ToArray();
                        } else { // list all users as default
                            GetUserSearchRes = UsersList;
                            GetSrchUID = new reqLINQ(GetUserSearchRes)
                                .Select(function (UID) {
                                    return UID.u_id;
                                }).ToArray();
                        }
                        // var ismultiapp="Y";
                        // if(Ismultiapp!='Y'){
                        _GetAppUsrSTSDet();
                        // }
                    }

                    function _getallocatedusers(currentSID, pcallback) {
                        var stsCond = {};                        
                        var columns = ['appsts_id'];
                        getdatafromtable('APP_SYSTEM_TO_SYSTEM', stsCond, columns, function (Res) {
                            var apstsRes = Res;
                            var stsCol = ['appu_id', 'appusts_id', 'appsts_id'];
                            // select APP_USER_STS table  to get the allocated Appsts id
                            getdatafromtable('IV_APP_USER_STS', {}, stsCol, function (res) {
                                var appUsersts = [];
                                for (var i = 0; i < apstsRes.length; i++) {

                                    for (var j = 0; j < res.length; j++) {

                                        if (res[j].appsts_id == apstsRes[i].appsts_id) {
                                            appUsersts.push(res[j]);
                                        }
                                    }
                                }

                                var appUId = [];

                                for (i = 0; i < appUsersts.length; i++) {
                                    if (appUsersts[i].appu_id) {
                                        appUId.push(appUsersts[i].appu_id);
                                    }
                                }                               

                                var appuserCond = {};

                                // get U_ID from APP_USERS table using app_u_id 
                                getdatafromtable('APP_USERS', appuserCond, ['u_id'], function (res) {
                                    // get User details from users table Uid as where condition
                                    var uId = [];

                                    if (res.length > 0) {
                                        for (i = 0; i < res.length; i++) {
                                            if (res[i].u_id) {
                                                uId.push(res[i].u_id);
                                            }
                                        }
                                    }
                                    getdatafromtable('users', {
                                        u_id: uId,
                                        client_id: PCLIENT_ID,
                                        tenant_id: objLogInfo.TENANT_ID
                                    }, [], function (res) {
                                        pcallback(res);
                                    });
                                });
                            });
                        });
                    }


                    function getdatafromtable(pTableName, pCond, columns, pcallback) {
                        reqFXDBInstance.GetTableFromFXDB(mCltClient, pTableName, columns, pCond, objLogInfo, function (err, Resp) {
                            if (err) {
                                return reqInstanceHelper.SendResponse(strServiceName, appResponse, 'FAILURE', objLogInfo, 'ERR-MIN-50706', 'Error in Calling _Getallocateduesr function ', err, '', '');
                            } else {
                                pcallback(Resp.rows);
                            }
                        });
                    }

                    function isempty(x) {
                        if (x !== "")
                            return true;
                    }


                    function _GetAppSTSforS_ID(AppstsCallback) {
                        var condobj = {
                            parent_s_id: strSID
                        };
                        reqFXDBInstance.GetTableFromFXDB(mCltClient, 'APP_SYSTEM_TO_SYSTEM', ['child_s_id'], condobj, objLogInfo, function (err, Userappsts) {
                            if (err) {
                                return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50704', 'Querying  users table have been failed', err, '', '');
                            } else {
                                try {
                                    if (Userappsts.rows.length > 0) {
                                        var stschildarr = Userappsts.rows;
                                        for (i = 0; i < stschildarr.length; i++) {
                                            var childid = stschildarr[i].child_s_id;
                                            if (appstsarr.indexOf(childid) == -1) {
                                                appstsarr.push(childid);
                                            }
                                        }
                                        appstsarr.push(strSID);
                                        AppstsCallback(appstsarr);
                                    } else {
                                        appstsarr.push(strSID);
                                        AppstsCallback(appstsarr);
                                    }

                                } catch (error) {
                                    return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50705', 'Error in GetUserSearchRes or GetSrchUID LINQ query', error, '', '');
                                }
                            }
                        });
                    }

                    function _FormStringCondition(pString) {
                        if (pString.length == 0)
                            return '';
                        var strValues = pString;
                        var strTemp = '';
                        for (var i = 0; i < strValues.length; i++)
                            if (strTemp == '')
                                strTemp = `'${strValues[i]}'`;
                            else
                                strTemp = `${strTemp},'${strValues[i]}'`;
                        return strTemp;
                    }

                    function _FormStringSTSCondition(pString) {
                        if (pString.length == 0)
                            return '';
                        var strValues = pString;
                        var strTemp = '';
                        for (var i = 0; i < strValues.length; i++)
                            if (strTemp == '')
                                strTemp = `${strValues[i]}`;
                            else
                                strTemp = `${strTemp},${strValues[i]}`;
                        return strTemp;
                    }

                    function _GetAppUsrSTSDet() {
                        try {

                            if (arrappusr.length) {
                                reqInstanceHelper.PrintInfo(strServiceName, 'Querying app_user_sts table', objLogInfo);
                                // if (mCltClient.DBConn && mCltClient.DBConn.DBType.toUpperCase() == 'ORACLEDB') {
                                var returnedAPPUSERSTSArry = '';
                                if (GetAPPUID.length) {
                                    returnedAPPUSERSTSArry = prepareArray(GetAPPUID, 1000);
                                } else {
                                    returnedAPPUSERSTSArry = [];
                                }

                                var selectQuery = '';
                                var appsts_ids = '';
                                var splitedsts = '';
                                for (var i = 0; i < returnedAPPUSERSTSArry.length; i++) {
                                    appuserssts_ids = _FormStringCondition(returnedAPPUSERSTSArry[i]);
                                    if (splitedsts == '') {
                                        splitedsts += ` appu_id in (${appuserssts_ids})`;
                                    } else {
                                        splitedsts += ` or appu_id in ( ${appuserssts_ids} )`;
                                    }
                                }
                                selectQuery = `select * from IV_APP_USER_STS where ${splitedsts}`;
                                reqInstanceHelper.PrintInfo(strServiceName, 'Querying APP_USER_STS  table', objLogInfo);
                                reqFXDBInstance.ExecuteQuery(mCltClient, selectQuery, objLogInfo, function caLlbacklitefiler(err, AppUsrstsRes) {
                                    try {
                                        if (err) {
                                            return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50707', 'Querying app_user_sts table have been failed', err, '', '');
                                        } else {
                                            try {
                                                if (AppUsrstsRes.rows.length > 0) {
                                                    reqInstanceHelper.PrintInfo(strServiceName, 'Got result from app_user_sts table', objLogInfo);
                                                    arrAppUsrSTS = AppUsrstsRes.rows;
                                                    GetAppSTSID = new reqLINQ(AppUsrstsRes.rows)
                                                        .Select(function (APPSTSID) {
                                                            return APPSTSID.appsts_id;
                                                        }).ToArray();
                                                }
                                                GetAppSTSID = GetAppSTSID.filter(isempty);
                                                _GetSysToSysDet();
                                            } catch (error) {
                                                return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50708', 'Error in GetAppSTSID Linq query', error, '', '');
                                            }

                                        }
                                    } catch (error) {
                                        return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50743', 'Error while  Executing Searchquery', error, '', '');
                                    }
                                });
                            }

                        } catch (error) {
                            return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50709', 'Error in calling _GetAppUsrSTSDet function', error, '', '');
                        }
                    }
                    //To get the app system to system details 
                    function _GetSysToSysDet() {
                        try {
                            var colList = ['appsts_id', 'cluster_code', 'appst_id', 'child_s_id', 's_code', 's_description', 's_id', 'sts_id', 'st_id'];
                            var strAppSts = _FormStringSTSCondition(GetAppSTSID);
                            var appstsids = strAppSts.split(',', strAppSts.length);
                            var cond = {
                                appsts_id: appstsids,
                                app_id: pApp_id
                            };
                            // This case for oracle environment not loaded user list because 1000 ids form IN Condition
                            if (mCltClient.DBConn && mCltClient.DBConn.DBType.toUpperCase() == 'ORACLEDB') {
                                var returnedSTSArry = '';
                                if (appstsids.length) {
                                    returnedSTSArry = prepareArray(appstsids, 1000);
                                } else {
                                    returnedSTSArry = [];
                                }

                                var selectQuery = '';
                                var appsts_ids = '';
                                var splitedsts = '';
                                for (var i = 0; i < returnedSTSArry.length; i++) {
                                    appsts_ids = _FormStringCondition(returnedSTSArry[i]);
                                    if (splitedsts == '') {
                                        splitedsts += ` appsts_id in (${appsts_ids})`;
                                    } else {
                                        splitedsts += ` or appsts_id in ( ${appsts_ids} )`;
                                    }
                                }
                                selectQuery = `select * from APP_SYSTEM_TO_SYSTEM where app_id= '${pApp_id}' and ${splitedsts}`;
                                reqInstanceHelper.PrintInfo(strServiceName, 'Querying app_system_to_system  table', objLogInfo);
                                reqFXDBInstance.ExecuteQuery(mCltClient, selectQuery, objLogInfo, function caLlbacklitefiler(err, Result) {
                                    try {
                                        if (err) {
                                            return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50777', 'Error while Querying APP_SYSTEM_TO_SYSTEM table', err, 'FAILURE', '');
                                        } else {
                                            if (Result.rows.length) {
                                                reqInstanceHelper.PrintInfo(strServiceName, 'Got result from APP_SYSTEM_TO_SYSTEM table', objLogInfo);
                                                arrSTSDet = Result.rows;
                                                if (Sys_Search_Str != '' && Sys_Search_Str != undefined) {
                                                    reqInstanceHelper.PrintInfo(strServiceName, 'System  search param available ', objLogInfo);
                                                    Sys_Search = new reqLINQ(Result.rows)
                                                        .Where(function (appsyslst) {
                                                            return appsyslst.s_description.toUpperCase().startsWith(Sys_Search_Str.toUpperCase());
                                                        }).ToArray();
                                                }
                                            }
                                            _GetAppUsrRoles();
                                        }
                                    } catch (error) {
                                        return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50743', 'Error while  Executing Searchquery', error, '', '');
                                    }
                                });
                            } else {
                                reqInstanceHelper.PrintInfo(strServiceName, 'Querying APP_SYSTEM_TO_SYSTEM to table', objLogInfo);
                                reqFXDBInstance.GetTableFromFXDB(mCltClient, 'APP_SYSTEM_TO_SYSTEM', colList, cond, objLogInfo, function (err, appsystemto_system) {
                                    if (err) {
                                        return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50710', 'Querying APP_SYSTEM_TO_SYSTEM have been failed', err, '', '');
                                    } else {
                                        try {

                                            if (appsystemto_system.rows.length > 0) {
                                                reqInstanceHelper.PrintInfo(strServiceName, 'Got result from APP_SYSTEM_TO_SYSTEM table', objLogInfo);
                                                arrSTSDet = appsystemto_system.rows;
                                                if (Sys_Search_Str != '' && Sys_Search_Str != undefined) {
                                                    reqInstanceHelper.PrintInfo(strServiceName, 'System  search param available ', objLogInfo);
                                                    Sys_Search = new reqLINQ(appsystemto_system.rows)
                                                        .Where(function (appsyslst) {
                                                            return appsyslst.s_description.toUpperCase().startsWith(Sys_Search_Str.toUpperCase());
                                                        }).ToArray();
                                                }
                                            }
                                            _GetAppUsrRoles();

                                        } catch (error) {
                                            return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50711', 'Error in  Sys_Search LINQ query', error, '', '');
                                        }
                                    }
                                });
                            }

                        } catch (error) {
                            return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50712', 'Error in calling _GetSysToSysDet fucntion ', error, '', '');
                        }
                    }

                    //Based on the splited_size value then overall array splited the given values and return 
                    function prepareArray(Arrayvalue, splited_size) {
                        var index = 0;
                        var arrayLength = Arrayvalue.length;
                        var tempArray = [];

                        for (index = 0; index < arrayLength; index += splited_size) {
                            myChunk = Arrayvalue.slice(index, index + splited_size);
                            // Do something if you want with the group
                            tempArray.push(myChunk);
                        }

                        return tempArray;
                    }

                    //select appu user roles from  app_user_roles table using appu_id column
                    function _GetAppUsrRoles() {
                        try {
                            if (arrappusr.length) {
                                reqInstanceHelper.PrintInfo(strServiceName, 'Querying app_user_roles tables', objLogInfo);

                                // if (mCltClient.DBConn && mCltClient.DBConn.DBType.toUpperCase() == 'ORACLEDB') {
                                var returnedAPPUSERSTSArry = '';
                                if (GetAPPUID.length) {
                                    returnedAPPUSERSTSArry = prepareArray(GetAPPUID, 1000);
                                } else {
                                    returnedAPPUSERSTSArry = [];
                                }

                                var selectQuery = '';
                                var appsts_ids = '';
                                var splitedsts = '';
                                for (var i = 0; i < returnedAPPUSERSTSArry.length; i++) {
                                    appuserssts_ids = _FormStringCondition(returnedAPPUSERSTSArry[i]);
                                    if (splitedsts == '') {
                                        splitedsts += ` appu_id in (${appuserssts_ids})`;
                                    } else {
                                        splitedsts += ` or appu_id in ( ${appuserssts_ids} )`;
                                    }
                                }



                                selectQuery = `select * from IV_APP_USER_ROLES where ${splitedsts}`;
                                reqInstanceHelper.PrintInfo(strServiceName, 'Querying APP_USER_ROLES  table', objLogInfo);
                                reqFXDBInstance.ExecuteQuery(mCltClient, selectQuery, objLogInfo, function caLlbacklitefiler(err, AppRolesRes) {
                                    try {
                                        if (err) {
                                            return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50713', 'Error while Querying app_user_roles table', err, '', '');
                                        } else {
                                            try {

                                                if (AppRolesRes.rows.length > 0) {
                                                    reqInstanceHelper.PrintInfo(strServiceName, 'Got result from app_user_roles table', objLogInfo);
                                                    arrAPPRDet = AppRolesRes.rows;
                                                    var approles = new reqLINQ(AppRolesRes.rows)
                                                        .Where(function (u) {
                                                            return u.appr_id !== null;
                                                        }).ToArray();
                                                    GetAPPRID = new reqLINQ(approles)
                                                        .Select(function (APPRID) {
                                                            return APPRID.appr_id;
                                                        }).ToArray();
                                                    // GetAPPRID = new reqLINQ(AppRolesRes.rows)
                                                    //     .Select(function(APPRID ) {       
                                                    //              return APPRID.appr_id                                                   
                                                    //     }).ToArray();
                                                    _GetAppRoleDet();
                                                } else {
                                                    _PrepareCondn();
                                                }

                                            } catch (error) {
                                                return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50714', 'Error in GetAPPRID LINQ query', error, '', '');
                                            }
                                        }
                                    } catch (error) {
                                        return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50715', 'Error while calling _GetAppUsrRoles Function', error, '', '');
                                    }
                                });
                            }
                        } catch (error) {
                            return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50715', 'Error while calling _GetAppUsrRoles Function', error, '', '');
                        }
                    }
                    //TO get app user roles details
                    function _GetAppRoleDet() {
                        try {
                            reqInstanceHelper.PrintInfo(strServiceName, 'Querying app_roles table', objLogInfo);

                            var returnedAPPUSERSTSArry = '';
                            if (GetAPPRID.length) {
                                returnedAPPUSERSTSArry = prepareArray(GetAPPRID, 1000);
                            } else {
                                returnedAPPUSERSTSArry = [];
                            }

                            var selectQuery = '';
                            var appsts_ids = '';
                            var splitedRoleID = '';
                            for (var i = 0; i < returnedAPPUSERSTSArry.length; i++) {
                                approle_ids = _FormStringCondition(returnedAPPUSERSTSArry[i]);
                                if (splitedRoleID == '') {
                                    splitedRoleID += ` appr_id in (${approle_ids})`;
                                } else {
                                    splitedRoleID += ` or appr_id in ( ${approle_ids} )`;
                                }
                            }
                            selectQuery = `select * from APP_ROLES where app_id='${pApp_id}' and  ${splitedRoleID}`;
                            reqInstanceHelper.PrintInfo(strServiceName, 'Querying APP_ROLES  table', objLogInfo);
                            reqFXDBInstance.ExecuteQuery(mCltClient, selectQuery, objLogInfo, function caLlbacklitefiler(err, RolesRes) {
                                try {
                                    if (err) {
                                        return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50716', 'Error while Querying  app_roles table', err, '', '');
                                    } else {
                                        try {
                                            if (RolesRes.rows.length > 0) {
                                                reqInstanceHelper.PrintInfo(strServiceName, 'Got result from app_roles table', objLogInfo);
                                                arrRole = RolesRes.rows;
                                                if (Role_Search_Str != '' && Role_Search_Str != undefined) {
                                                    reqInstanceHelper.PrintInfo(strServiceName, 'Role search param available ', objLogInfo);
                                                    RoleSearch = new reqLINQ(RolesRes.rows)
                                                        .Where(function (roles) {
                                                            return roles.role_description.toUpperCase().startsWith(Role_Search_Str.toUpperCase());

                                                        }).ToArray();
                                                }
                                            }
                                            _PrepareCondn();

                                        } catch (error) {
                                            return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50717', 'Error in RoleSearch LINQ query', error, '', '');
                                        }

                                    }
                                } catch (error) {
                                    return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50715', 'Error while calling _GetAppUsrRoles Function', error, '', '');
                                }
                            });

                        } catch (error) {
                            return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50718', 'Error while callng _GetAppRoleDet Function', error, '', '');
                        }
                    }

                    //prepare filter conditions
                    function _PrepareCondn() {
                        try {

                            if (RoleSearch.length > 0 && Role_Search_Str != '' && Sys_Search.length > 0 && Sys_Search_Str != '' && GetUserSearchRes.length > 0 && User_Search_Str != '') {
                                _PrepareFilter();
                            } else if (RoleSearch.length > 0 && Role_Search_Str != '' && Sys_Search.length == 0 && Sys_Search_Str == '' && GetUserSearchRes.length == 0 && User_Search_Str == '') {
                                _PrepareFilter();
                            } else if (RoleSearch.length == 0 && Role_Search_Str == '' && Sys_Search.length > 0 && Sys_Search_Str != '' && GetUserSearchRes.length == 0 && User_Search_Str == '') {
                                _PrepareFilter();
                            } else if (RoleSearch.length == 0 && Role_Search_Str == '' && Sys_Search.length == 0 && Sys_Search_Str == '' && GetUserSearchRes.length > 0 && User_Search_Str != '') {
                                _PrepareFilter();
                            } else if (RoleSearch.length > 0 && Role_Search_Str != '' && Sys_Search.length > 0 && Sys_Search_Str != '' && GetUserSearchRes.length == 0 && User_Search_Str != '') {
                                arrUSER = [];
                                _Response();
                            } else if (RoleSearch.length > 0 && Role_Search_Str != '' && Sys_Search.length == 0 && Sys_Search_Str != '' && GetUserSearchRes.length > 0 && User_Search_Str != '') {
                                arrUSER = [];
                                _Response();
                            } else if (RoleSearch.length == 0 && Role_Search_Str != '' && Sys_Search.length > 0 && Sys_Search_Str != '' && GetUserSearchRes.length > 0 && User_Search_Str != '') {
                                arrUSER = [];
                                _Response();
                            } else if (GetUserSearchRes.length > 0 && User_Search_Str != '' && Sys_Search.length > 0 && Sys_Search_Str != '') {
                                _PrepareFilter();
                            } else if (Sys_Search.length > 0 && Sys_Search_Str != '' && RoleSearch.length > 0 && Role_Search_Str != '') {
                                _PrepareFilter();
                            } else if (RoleSearch.length > 0 && Role_Search_Str != '' && GetUserSearchRes.length > 0 && User_Search_Str != '') {
                                _PrepareFilter();
                            } else if ((User_Search_Str == '' || User_Search_Str == undefined) && (Sys_Search == 0 || Sys_Search == '') && (Role_Search_Str == '' || Role_Search_Str == undefined) && GetUserSearchRes.length > 0) {
                                _PrepareFilter();
                            } else {
                                arrUSER = [];
                                _Response();
                            }
                        } catch (error) {
                            return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50718', 'Error in while calling _PrepareCondn Function', error, '', '');
                        }
                    }

                    //prepare filter conditions
                    function _PrepareFilter() {
                        try {

                            if (RoleSearch.length > 0) {
                                for (i = 0; i < RoleSearch.length; i++) {
                                    if (arrAPPRDet.length > 0) {
                                        for (j = 0; j < arrAPPRDet.length; j++) {
                                            if (arrAPPRDet[j].appr_id == RoleSearch[i].appr_id) {
                                                arrFilRAppUsrs.push(arrAPPRDet[j].appu_id);
                                            }
                                        }
                                    }
                                }
                            }
                            if (Sys_Search.length > 0) {
                                for (i = 0; i < Sys_Search.length; i++) {
                                    if (arrAppUsrSTS.length > 0) {
                                        for (j = 0; j < arrAppUsrSTS.length; j++) {
                                            if (arrAppUsrSTS[j].appsts_id == Sys_Search[i].appsts_id) {
                                                arrFilSTSAppUsrs.push(arrAppUsrSTS[j].appu_id);
                                            }
                                        }
                                    }
                                }
                            }
                            if (GetUserSearchRes.length > 0) {
                                for (i = 0; i < GetUserSearchRes.length; i++) {
                                    if (arrappusr.length > 0) {
                                        for (j = 0; j < arrappusr.length; j++) {
                                            if (arrappusr[j].u_id == GetUserSearchRes[i].u_id) {
                                                arrFilUAppUsrs.push(arrappusr[j].appu_id);
                                            }
                                        }
                                    }
                                }
                            }

                            _arrayUnique();
                        } catch (error) {
                            return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50719', 'Error in calling _PrepareFilter Function', error, '', '');
                        }
                    }

                    function getMatch(a, b) {
                        try {

                            for (var i = 0; i < a.length; i++) {
                                for (var e = 0; e < b.length; e++) {
                                    if (a[i] === b[e]) matches.push(a[i]);
                                }
                            }
                            return matches;

                        } catch (error) {
                            return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50720', 'Error in calling getMatch Function', error, '', '');
                        }
                    }

                    function _arrayUnique() {
                        try {

                            if (arrFilUAppUsrs.length == 0) {
                                IsAB = false;
                                IsAC = false;
                            }
                            if (arrFilSTSAppUsrs.length == 0) {
                                IsAB = false;
                                IsBC = false;
                            }
                            if (arrFilRAppUsrs.length == 0) {
                                IsAC = false;
                                IsBC = false;
                            }
                            if (IsAB && IsAC && IsBC) {
                                matches = [];
                                var arrRes1 = getMatch(arrFilUAppUsrs, arrFilSTSAppUsrs);
                                matches = [];
                                var arrRes2 = getMatch(arrFilSTSAppUsrs, arrFilRAppUsrs);
                                matches = [];
                                arrAPPUF = getMatch(arrRes1, arrRes2);
                                matches = [];
                            } else if (IsAB) {
                                matches = [];
                                arrAPPUF = getMatch(arrFilUAppUsrs, arrFilSTSAppUsrs);
                            } else if (IsAC) {
                                matches = [];
                                arrAPPUF = getMatch(arrFilUAppUsrs, arrFilRAppUsrs);
                            } else if (IsBC) {
                                matches = [];
                                arrAPPUF = getMatch(arrFilSTSAppUsrs, arrFilRAppUsrs);
                            }
                            if (arrAPPUF.length == 0) {
                                if (arrFilUAppUsrs.length > 0) {
                                    arrAPPUF = arrFilUAppUsrs;
                                } else if (arrFilSTSAppUsrs.length > 0) {
                                    arrAPPUF = arrFilSTSAppUsrs;
                                } else if (arrFilRAppUsrs.length > 0) {
                                    arrAPPUF = arrFilRAppUsrs;
                                }
                            }
                            if (arrAPPUF.length > 0) {

                                _GetFilteredUsersId();
                               
                            } else {

                                if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0' || Ismultiapp == 'Y') {

                                    // else {
                                    arrAPPUserDetails = arrAPPUserDetails;
                                    arrUserDetails = GetUserSearchRes;
                                    arrFinAppSTSDetails = arrAppUsrSTS;
                                    arrFinAppRoleDetails = arrRole;
                                    arrFinAppURDetails = arrAPPRDet;
                                    arrFinAppUserSTSDetails = arrAppUsrSTS;

                                    // arrUSER = GetUserSearchRes;
                                    _PrepareJson();
                                } else {
                                    arrUSER = [];
                                    _Response();
                                }

                            }

                        } catch (error) {
                            return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50721', 'Error in calling _arrayUnique Function', error, '', '');
                        }
                    }

                    //get appuser details with appu_id and u_id 
                    function _GetFilteredUsersId() {
                        try {
                            var splitedarrAPPUF = prepareArray(arrAPPUF, 1000)
                            var appuids = ''
                            var appuidsjoined = ''
                            for (var i = 0; i < splitedarrAPPUF.length; i++) {
                                appuids = _FormStringCondition(splitedarrAPPUF[i]);
                                if (appuidsjoined == '') {
                                    appuidsjoined += ` appu_id in (${appuids})`;
                                } else {
                                    appuidsjoined += ` or appu_id in ( ${appuids} )`;
                                }
                            }

                            console.log('appuidsjoined ' + appuidsjoined)

                            reqInstanceHelper.PrintInfo(strServiceName, 'Querying app_users table', objLogInfo);

                            //var selectQuery = `select * from app_users where ${appuidsjoined} and app_id= '${pApp_id}'`;
                            var selectQuery = `select * from iv_app_users where ${appuidsjoined} and app_id= '${pApp_id}'`;
                            reqFXDBInstance.ExecuteQuery(mCltClient, selectQuery, objLogInfo, function (err, UsersRes) {
                                if (err) {
                                    return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50722', 'Error while Querying iv_app_users table', err, '', '');
                                } else {
                                    try {
                                        reqInstanceHelper.PrintInfo(strServiceName, 'Got result from iv_app_users table', objLogInfo);
                                        if (UsersRes.rows.length) {
                                            arrAPPUserDetails = UsersRes.rows;
                                            GetFinalUID = new reqLINQ(arrAPPUserDetails)
                                                .Select(function (UID) {
                                                    return UID.u_id;
                                                }).ToArray();
                                            GetFinalAPPU_ID = new reqLINQ(arrAPPUserDetails)
                                                .Select(function (APP_UID) {
                                                    return APP_UID.appu_id;
                                                }).ToArray();

                                            //Reason for ALL users listing in multi App context and ULTIMATE EVN 
                                            // do not filter the user with condtion app_id so that skip the values
                                            if (Ismultiapp === 'Y' && serviceModel.PLATFORM_VERSION != '7.0') {
                                                arrAPPUserDetails = arrAPPUserDetails;
                                                arrUserDetails = GetUserSearchRes;
                                                arrFinAppSTSDetails = arrAppUsrSTS;
                                                arrFinAppRoleDetails = arrRole;
                                                arrFinAppURDetails = arrAPPRDet;
                                                arrFinAppUserSTSDetails = arrAppUsrSTS;                                              
                                                _PrepareJson(); 
                                            }

                                        } else {
                                            if (GetUserSearchRes.length) {
                                                // arrUSER = [];
                                                arrUSER = GetUserSearchRes;
                                                arrUserDetails = GetUserSearchRes;
                                                _PrepareJson();

                                            } else {
                                                arrUSER = [];
                                                _Response();
                                            }
                                        }

                                    } catch (error) {
                                        return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50723', 'Error in LINQ query GetFinalUID & GetFinalAPPU_ID ', error, '', '');
                                    }
                                }
                                _GetFilteredUsrDet();
                            });

                        } catch (error) {
                            return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50724', 'Error in calling _GetFilteredUsersId Function', error, '', '');
                        }
                    }

                    //get user details with U_id  and client_id
                    function _GetFilteredUsrDet() {
                        try {
                            reqInstanceHelper.PrintInfo(strServiceName, 'Querying users table', objLogInfo);
                            reqFXDBInstance.GetTableFromFXDB(mCltClient, 'users', ['login_name', 'u_id', 'client_id', 'allocated_designer', 'double_authentication', 'allocated_static_module', 'double_authentication_model', 'email_id', 'first_name', 'last_name', 'enforce_change_password', 'middle_name', 'mobile_no', 'water_marking', 'session_timeout', 'allocated_ip', 'last_successful_login', 'account_locked_date', 'profile_pic'], {
                                'u_id': GetFinalUID,
                                'client_id': pClient_id
                            }, objLogInfo, function (err, URes) {
                                if (err) {
                                    return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50725', 'Error while Querying users table', err, '', '');
                                } else {
                                    try {
                                        arrUserDetails = [];
                                        reqInstanceHelper.PrintInfo(strServiceName, 'Got result From users table', objLogInfo);
                                        if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION != '7.0') {
                                            arrUserDetails = URes.rows;
                                        } else {
                                            arrUserDetails = GetUserSearchRes;
                                        }
                                        _GetFilteredAPPSTSDet();

                                    } catch (error) {
                                        return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50726', 'Error in calling vjsn Function', error, '', '');
                                    }
                                }
                            });

                        } catch (error) {
                            return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50727', 'Error in calling _GetFilteredUsrDet Function', error, '', '');
                        }
                    }

                    //get app_user_sts details with GetFinalAPPU_ID
                    function _GetFilteredAPPSTSDet() {
                        try {
                            reqInstanceHelper.PrintInfo(strServiceName, 'Querying app_user_sts table', objLogInfo);
                            reqFXDBInstance.GetTableFromFXDB(mCltClient, 'iv_app_user_sts', [], {
                                'appu_id': GetFinalAPPU_ID
                            }, objLogInfo, function (err, Res) {
                                if (err) {
                                    return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50728', 'Error while app_user_sts table', err, '', '');
                                } else {
                                    try {

                                        arrFinAppUserSTSDetails = Res.rows;
                                        reqInstanceHelper.PrintInfo(strServiceName, 'Got result from app_user_sts table', objLogInfo);
                                        GetFinalAPPSTS_ID = new reqLINQ(Res.rows)
                                            .Select(function (APPSTS_UID) {
                                                return APPSTS_UID.appsts_id;
                                            }).ToArray();
                                        GetFinalAPPSTS_ID = unique(GetFinalAPPSTS_ID);
                                        // console.log(GetFinalAPPSTS_ID);
                                        if (GetFinalAPPSTS_ID.length > 0) {
                                            _GetFilteredSTSDet();
                                        } else {
                                            _GetFilteredAPPURDet();
                                        }
                                    } catch (error) {
                                        return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50729', 'Error in  GetFinalAPPSTS_ID LINQ query', error, '', '');
                                    }
                                }
                            });

                        } catch (error) {
                            return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50730', 'Error in calling _GetFilteredAPPSTSDet Function', error, '', '');
                        }
                    }
                    //get app_system_tosystem details
                    function _GetFilteredSTSDet() {
                        try {
                            GetFinalAPPSTS_ID = GetFinalAPPSTS_ID.filter(isempty);
                            reqInstanceHelper.PrintInfo(strServiceName, 'Querying app_system_to_system table', objLogInfo);
                            reqFXDBInstance.GetTableFromFXDB(mCltClient, 'app_system_to_system', ['appsts_id', 'cluster_code', 'appst_id', 'child_s_id', 's_code', 's_description', 's_id', 'sts_id', 'st_id'], {
                                'appsts_id': GetFinalAPPSTS_ID,
                                'app_id': pApp_id
                            }, objLogInfo, function (err, Res) {
                                if (err) {
                                    return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50731', 'Error While Querying app_system_to_system', err, '', '');
                                } else {
                                    try {

                                        arrFinAppSTSDetails = Res.rows;
                                        reqInstanceHelper.PrintInfo(strServiceName, 'Got result from app_system_to_system table', objLogInfo);
                                        _GetFilteredAPPURDet();

                                    } catch (error) {
                                        return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50732', 'Error in calling _GetFilteredAPPURDet Function', error, '', '');
                                    }
                                }
                            });

                        } catch (error) {
                            return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50733', 'Error in calling _GetFilteredSTSDet Function', error, '', '');
                        }
                    }
                    //get the app_user roles details
                    function _GetFilteredAPPURDet() {
                        try {

                            reqInstanceHelper.PrintInfo(strServiceName, 'Querying app_user_roles table', objLogInfo);
                            reqFXDBInstance.GetTableFromFXDB(mCltClient, 'iv_app_user_roles', ['appr_id', 'appur_id', 'appu_id'], {
                                'appu_id': GetFinalAPPU_ID
                            }, objLogInfo, function (err, Res) {
                                if (err) {
                                    return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50734', 'Error while Querying  app_user_roles', error, '', '');
                                } else {
                                    try {
                                        reqInstanceHelper.PrintInfo(strServiceName, 'Got result from app_user_roles table', objLogInfo);
                                        if (Res.rows.length > 0) {
                                            arrFinAppURDetails = Res.rows;
                                            var finalapprid = new reqLINQ(Res.rows)
                                                .Where(function (u) {
                                                    return u.appr_id !== null;
                                                }).ToArray();
                                           
                                            GetFinalAPPR_ID = new reqLINQ(finalapprid)
                                                .Select(function (APPR_ID) {
                                                    return APPR_ID.appr_id;
                                                }).ToArray();
                                            GetFinalAPPR_ID = unique(GetFinalAPPR_ID);
                                            if (GetFinalAPPR_ID.length > 0) {
                                                reqFXDBInstance.GetTableFromFXDB(mCltClient, 'APP_USER_ROLE_MENUS', [], { APPR_ID: GetFinalAPPR_ID }, objLogInfo, function (pError, result) {
                                                    if (pError) {
                                                        return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50800', 'Error occured query app user role menu', pError, '', '');
                                                    } else {
                                                        appUserRoleMenus = result.rows
                                                        _GetFilteredAPPRDet();
                                                    }

                                                })
                                            } else {
                                                _PrepareJson();
                                            }


                                        } else {
                                            _PrepareJson();
                                        }
                                        //}
                                    } catch (error) {
                                        return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50735', 'Error in GetFinalAPPR_ID Linq query', error, '', '');
                                    }
                                }
                            });

                        } catch (error) {
                            return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50736', 'Error while  calling _GetFilteredAPPURDet function', error, '', '');
                        }
                    }

                    //get app_roles details with GetFinalAPPR_ID
                    function _GetFilteredAPPRDet() {
                        try {
                            reqInstanceHelper.PrintInfo(strServiceName, 'Querying app_roles table', objLogInfo);
                            reqFXDBInstance.GetTableFromFXDB(mCltClient, 'app_roles', ['appr_id', 'role_code', 'role_description'], {
                                'appr_id': GetFinalAPPR_ID,
                                'app_id': pApp_id
                            }, objLogInfo, function (err, Res) {
                                if (err) {
                                    return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50737', 'Error while Querying app_roles table', err, '', '');
                                } else {
                                    try {
                                        arrFinAppRoleDetails = Res.rows;
                                        reqInstanceHelper.PrintInfo(strServiceName, 'Got Result from app_roles', objLogInfo);
                                        _PrepareJson();
                                    } catch (error) {
                                        return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50738', 'Error in Getting result from app_roles', error, '', '');
                                    }
                                }
                            });
                        } catch (error) {
                            return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50739', 'Error in calling _GetFilteredAPPRDet Function', error, '', '');
                        }
                    }


                    // Preare result 
                    function _PrepareJson() {
                        try {
                            arrUSER = [];
                            for (i = 0; i < arrUserDetails.length; i++) {
                                if (arrUserDetails[i].login_name != 'VPH_ADMIN' && arrUserDetails[i].login_name != 'NPSS_ADMIN' && arrUserDetails[i].status != 'DELETED') {
                                    var objUSER = {};
                                    objUSER.LOGIN_NAME = arrUserDetails[i].login_name;
                                    objUSER.PROFILE_PIC = arrUserDetails[i].iv_profile_pic;
                                    objUSER.CLIENT_ID = arrUserDetails[i].client_id;
                                    objUSER.U_ID = arrUserDetails[i].u_id;
                                    objUSER.DOUBLE_AUTHENTICATION = arrUserDetails[i].iv_double_authentication;
                                    objUSER.DOUBLE_AUTHENTICATION_MODEL = arrUserDetails[i].iv_double_authentication_model;
                                    objUSER.EMAIL_ID = arrUserDetails[i].iv_email_id;
                                    objUSER.FIRST_NAME = arrUserDetails[i].iv_first_name;
                                    objUSER.LAST_NAME = arrUserDetails[i].iv_last_name;
                                    objUSER.ENFORCE_CHANGE_PWD = arrUserDetails[i].iv_enforce_change_password;
                                    objUSER.MIDDLE_NAME = arrUserDetails[i].iv_middle_name;
                                    objUSER.MOBILE_NO = arrUserDetails[i].iv_mobile_no;
                                    objUSER.WATER_MARKING = arrUserDetails[i].iv_water_marking;
                                    if (arrUserDetails[i].iv_is_enabled == null || arrUserDetails[i].iv_is_enabled == '') {
                                        arrUserDetails[i].iv_is_enabled = 'Y'
                                    }
                                    objUSER.IS_ENABLED = arrUserDetails[i].iv_is_enabled;
                                    objUSER.SESSION_TIMEOUT = arrUserDetails[i].iv_session_timeout;
                                    objUSER.ALLOCATED_IP = arrUserDetails[i].iv_allocated_ip;
                                    objUSER.LAST_SUCCESSFUL_LOGIN = arrUserDetails[i].last_successful_login;
                                    objUSER.HAS_ANALYTICS = arrUserDetails[i].has_analytics;
                                    objUSER.SYSTEMID = arrUserDetails[i].system_id;
                                    if (arrUserDetails[i].status == 'READY_FOR_APPROVAL') {
                                        arrUserDetails[i].status = 'INACTIVE';
                                    }
                                    objUSER.STATUS = arrUserDetails[i].status;
                                    if (makerCheckerModel == 'Y') {
                                        objUSER.REQ_STATUS = _virtualStatus(arrUserDetails[i].status, arrUserDetails[i].action_desc);
                                    }
                                    objUSER.ACTION_DESC = arrUserDetails[i].action_desc;
                                    objUSER.APPROVAL_STATUS = arrUserDetails[i].approval_status;
                                    objUSER.REMARKS = arrUserDetails[i].remarks;
                                    objUSER.START_ACTIVE_DATE = arrUserDetails[i].iv_start_active_date;
                                    objUSER.END_ACTIVE_DATE = arrUserDetails[i].iv_end_active_date;
                                    objUSER.CREATED_BY_NAME = arrUserDetails[i].created_by_name;
                                    objUSER.PWD_TYPE = arrUserDetails[i].pwd_type;
                                    objUSER.CREATED_DATE = arrUserDetails[0].created_date.toLocaleString().replaceAll('/', '-');


                                    var arrApprmenus = [];
                                    for (var apur = 0; apur < appUserRoleMenus.length; apur++) {
                                        var objuserRole = {}
                                        if (arrUserDetails[i].login_name == appUserRoleMenus[apur].login_name) {
                                            arrApprmenus.push(appUserRoleMenus[apur])
                                        }
                                    }
                                    objUSER.APP_USER_ROLE_MENUS = arrApprmenus;
                                    var arrAppSTSFrom = [];
                                    objSTS = {};
                                    var Condn = '';
                                    if (arrAPPUserDetails.length > 0) {
                                        for (j = 0; j < arrAPPUserDetails.length; j++) {
                                            if (arrAPPUserDetails[j].u_id == arrUserDetails[i].u_id) {
                                                if (arrAPPUserDetails[j].status == 'UNASSIGNED') {
                                                    arrAPPUserDetails[j].appu_id = null;
                                                }
                                                objUSER.APPU_ID = arrAPPUserDetails[j].appu_id;
                                                objUSER.UG_CODE = arrAPPUserDetails[j].ug_code;
                                                objUSER.ROLE_MODE = arrAPPUserDetails[j].role_mode;
                                                var Getappstsid = new reqLINQ(arrFinAppUserSTSDetails)
                                                    .Where(function (item) {
                                                        return item.appu_id == arrAPPUserDetails[j].appu_id;
                                                    }).ToArray();
                                                for (k = 0; k < Getappstsid.length; k++) {
                                                    var Getstsid = new reqLINQ(arrFinAppSTSDetails)
                                                        .Where(function (item) {
                                                            return item.appsts_id == Getappstsid[k].appsts_id;
                                                        }).ToArray();
                                                    for (n = 0; n < Getstsid.length; n++) {
                                                        var objASTSForm = {};
                                                        if (Condn != '') {
                                                            Condn += ',' + Getstsid[n].s_description;
                                                            objASTSForm.APPSTS_ID = Getstsid[n].appsts_id;
                                                            objUSER.SID_DESCRIPTION = Getstsid[n].s_description;
                                                            objASTSForm.S_DESCRIPTION = Getstsid[n].s_description;
                                                            objASTSForm.S_ID = Getstsid[n].s_id;
                                                            objASTSForm.CLUSTER_CODE = Getstsid[n].cluster_code;
                                                            arrAppSTSFrom.push(objASTSForm);
                                                        } else {
                                                            Condn = Getstsid[n].s_description;
                                                            objUSER.SID_DESCRIPTION = Getstsid[n].s_description;
                                                            objASTSForm.APPSTS_ID = Getstsid[n].appsts_id;
                                                            objASTSForm.S_DESCRIPTION = Getstsid[n].s_description;
                                                            objASTSForm.S_ID = Getstsid[n].s_id;
                                                            objASTSForm.CLUSTER_CODE = Getstsid[n].cluster_code;
                                                            arrAppSTSFrom.push(objASTSForm);
                                                        }
                                                    }
                                                }
                                            }

                                        }
                                        var arrAppRFrom = [];
                                        var objARForm = {};
                                        objR = {};
                                        var CondnRole = '';

                                        if (arrAPPUserDetails.length > 0) {
                                            for (j = 0; j < arrAPPUserDetails.length; j++) {
                                                if (arrAPPUserDetails[j].u_id == arrUserDetails[i].u_id) {
                                                    objUSER.APPU_ID = arrAPPUserDetails[j].appu_id;
                                                    var Getapprid = new reqLINQ(arrFinAppURDetails)
                                                        .Where(function (item) {
                                                            return item.appu_id == arrAPPUserDetails[j].appu_id;
                                                        }).ToArray();

                                                    for (k = 0; k < Getapprid.length; k++) {
                                                        var Getrid = new reqLINQ(arrFinAppRoleDetails)
                                                            .Where(function (item) {
                                                                return item.appr_id == Getapprid[k].appr_id;
                                                            }).ToArray();
                                                        for (m = 0; m < Getrid.length; m++) {
                                                            objARForm = {};
                                                            if (CondnRole != '') {
                                                                CondnRole += ',' + Getrid[m].role_description;;
                                                                objARForm.APPR_ID = Getrid[m].appr_id;
                                                                objARForm.S_DESCRIPTION = Getrid[m].role_description;
                                                                arrAppRFrom.push(objARForm);
                                                            } else {
                                                                CondnRole = Getrid[m].role_description;
                                                                objARForm.APPR_ID = Getrid[m].appr_id;
                                                                objARForm.S_DESCRIPTION = Getrid[m].role_description;
                                                                arrAppRFrom.push(objARForm);
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                        objUSER.APP_USER_STS_DESC = Condn;
                                        objSTS.APP_SYSTEM_TO_SYSTEM = arrAppSTSFrom;
                                        objUSER.APP_USER_STS_DETAILS = objSTS;
                                        objR.ROLES = arrAppRFrom;
                                        objUSER.ROLES = CondnRole;
                                        objUSER.ROLES_DETAILS = objR;

                                        var arrAppdet = [];
                                        var objAppForm = {};
                                        objAppDet = {};
                                        var CondnApp = '';
                                        arrAppuserDetails

                                        if (arrAppuserDetails.length > 0) {
                                            for (j = 0; j < arrAppuserDetails.length; j++) {
                                                if (arrAppuserDetails[j].app_id == arrUserDetails[i].app_id) {

                                                    var Getuid = new reqLINQ(arrAppuserDetails)
                                                        .Where(function (item) {
                                                            return item.u_id == arrAPPUserDetails[j].u_id;
                                                        }).ToArray();

                                                    for (m = 0; m < Getuid.length; m++) {
                                                        objAppForm = {};
                                                        if (CondnApp != '') {
                                                            CondnApp += ',' + Getuid[m].app_description;
                                                            objAppForm.APP_ID = Getuid[m].app_id;
                                                            objAppForm.APP_CODE = Getuid[m].app_code;
                                                            objAppForm.APP_DESCRIPTION = Getuid[m].app_description;
                                                            arrAppRFrom.push(objAppForm);
                                                        } else {
                                                            CondnApp = Getuid[m].app_description;
                                                            objAppForm.APP_ID = Getuid[m].app_id;
                                                            objAppForm.APP_CODE = Getuid[m].app_code;
                                                            objAppForm.APP_DESCRIPTION = Getuid[m].app_description;
                                                            arrAppRFrom.push(objAppForm);
                                                        }
                                                    }
                                                }
                                            }
                                        }

                                        objAppDet.APPLICATIONS = arrAppdet;
                                        objUSER.APP_DETAILS = objAppDet;

                                        objUSER.ACCOUNT_LOCKED_DATE = arrUserDetails[i].account_locked_date;
                                        if (objUSER.ACCOUNT_LOCKED_DATE == null) {
                                            objUSER.ACCOUNT_LOCKED_DATE = '';
                                        }
                                        objUSER.CHANGED_DATE_FORMAT = '';
                                        if (arrUserDetails[i].allocated_static_module != '') {
                                            var strSM = JSON.parse(arrUserDetails[i].allocated_static_module);
                                        }
                                        var objSM = {};
                                        objSM.STATIC_MODULE = strSM;
                                        objUSER.ALLOCATED_STATIC_MODULE = objSM;
                                        arrUSER.push(objUSER);
                                    } else {
                                        if (Ismultiapp == 'Y' || serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
                                            var arrAppRFrom = [];
                                            var arrAppSTSFrom = [];
                                            var objARForm = {};
                                            objR = {};
                                            var CondnRole = '';
                                            var Condn = '';
                                            objUSER.APP_USER_STS_DESC = Condn;
                                            objSTS.APP_SYSTEM_TO_SYSTEM = arrAppSTSFrom;
                                            objUSER.APP_USER_STS_DETAILS = objSTS;
                                            objR.ROLES = arrAppRFrom;
                                            objUSER.ROLES = CondnRole;
                                            objUSER.ROLES_DETAILS = objR;
                                            objUSER.ACCOUNT_LOCKED_DATE = arrUserDetails[i].account_locked_date;
                                            if (objUSER.ACCOUNT_LOCKED_DATE == null) {
                                                objUSER.ACCOUNT_LOCKED_DATE = '';
                                            }
                                            objUSER.CHANGED_DATE_FORMAT = '';
                                            if (arrUserDetails[i].allocated_static_module != '') {
                                                var strSM = JSON.parse(arrUserDetails[i].allocated_static_module);
                                            }
                                            var objSM = {};
                                            objSM.STATIC_MODULE = strSM;
                                            objUSER.ALLOCATED_STATIC_MODULE = objSM;
                                            arrUSER.push(objUSER);
                                        }
                                    }
                                } else {
                                    return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50740', 'No records in users table', error, '', '');
                                }
                            }

                            var arr = new reqLINQ(arrUSER).OrderBy(function (usr) {
                                return usr.LOGIN_NAME;
                            }).ToArray();
                            arrUSER = arr;
                            _Response();

                        } catch (error) {
                            return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50740', 'Error in calling _PrepareJson Function', error, '', '');
                        }
                    }

                    function _virtualStatus(Ustatus, Uaction_desc) {

                        if (Ustatus == 'INACTIVE') {
                            return 'Waiting for New User Approval'
                        } else if ((Ustatus == 'ACTIVE' || Ustatus == 'DISABLED' || Ustatus == 'REJECTED') && Uaction_desc == 'MODIFY_REQUEST') {
                            return 'Waiting for Change Request Approval'
                        } else if (Ustatus == 'ACTIVE' && Uaction_desc == 'DELETE_REQUEST') {
                            return 'Waiting for Delete Request Approval'
                        } else {
                            return ''
                        }
                    }
                    // For SQL DB search query prepare and execution
                    function litefiler() {
                        try {
                            reqInstanceHelper.PrintInfo(strServiceName, 'Executing litefiler Function', objLogInfo);
                            if (Ismultiapp == 'Y') {
                                var litequery = "SELECT * FROM   (SELECT U.client_id,  U.u_id,  U.account_locked_date, U.status,U.start_active_date,U.end_active_date,U.created_by_name,U.pwd_type, U.enforce_change_password,  allocated_designer,  U.allocated_ip,  U.allocated_static_module,  U.double_authentication,  U.double_authentication_model,  U.email_id,  U.login_name,  U.first_name,  U.middle_name,  U.last_name,  U.last_successful_login,  U.last_unsuccessful_login,  U.mobile_no,  U.session_timeout,  U.water_marking,  AU.appu_id,  R.role_description,  R.appr_id,  String_agg(ASTS.s_description, ',')  S_DESCRIPTION,  Replace(Upper(String_agg(Cast(sys_json AS TEXT), '~')), ']~[',  ',')  SYS_JSON  FROM   users U  LEFT JOIN app_users AU  ON AU.u_id = U.u_id  AND AU.app_id = '" + pApp_id + "'  LEFT JOIN app_user_sts AUS  ON AUS.appu_id = AU.appu_id  LEFT JOIN app_user_roles APR  ON APR.appu_id = AU.appu_id  LEFT JOIN app_roles R  ON R.appr_id = APR.appr_id  LEFT JOIN app_system_to_system ASTS  ON ASTS.appsts_id = AUS.appsts_id  LEFT JOIN system_to_system STS  ON STS.sts_id = ASTS.sts_id  LEFT JOIN systems S  ON S.s_id = STS.child_s_id  LEFT JOIN(SELECT ROW1.appsts_id,  '['  || Row_to_json(row1)  || ']' SYS_JSON  FROM   (SELECT ASTS.s_description,  ASTS.appsts_id,  ASTS.s_id,  ASTS.cluster_code  FROM   app_system_to_system ASTS) ROW1) R1  ON R1.appsts_id = AUS.appsts_id  GROUP  BY U.client_id,  U.u_id,  U.account_locked_date,  U.enforce_change_password,  allocated_designer,  U.allocated_ip,  U.allocated_static_module,  U.double_authentication,  U.double_authentication_model,  U.email_id,  U.login_name,  U.first_name,  U.middle_name,  U.last_name,  U.last_successful_login,  U.last_unsuccessful_login,  U.mobile_no,  U.session_timeout,  U.water_marking,  AU.appu_id,  R.role_description,  R.appr_id) VW";
                            } else {
                                var litequery = "SELECT * FROM  (SELECT U.client_id,  U.u_id,  U.account_locked_date,  U.status,U.start_active_date,U.end_active_date,U.created_by_name,U.pwd_type, U.enforce_change_password,  allocated_designer,  U.allocated_ip,  U.allocated_static_module,  U.double_authentication,  U.double_authentication_model,  U.email_id,  U.login_name,  U.first_name,  U.middle_name,  U.last_name,  U.last_successful_login,  U.last_unsuccessful_login,  U.mobile_no,  U.session_timeout,  U.water_marking,  AU.appu_id,  R.role_description,  R.appr_id,  String_agg(ASTS.s_description, ',')  S_DESCRIPTION,  Replace(Upper(String_agg(Cast(sys_json AS TEXT), '~')), ']~[', ','  )  SYS_JSON  FROM   users U  INNER JOIN app_users AU  ON AU.u_id = U.u_id  AND AU.app_id = '" + pApp_id + "'  LEFT JOIN app_user_sts AUS  ON AUS.appu_id = AU.appu_id  LEFT JOIN app_user_roles APR  ON APR.appu_id = AU.appu_id  LEFT JOIN app_roles R  ON R.appr_id = APR.appr_id  LEFT JOIN app_system_to_system ASTS  ON ASTS.appsts_id = AUS.appsts_id  LEFT JOIN system_to_system STS  ON STS.sts_id = ASTS.sts_id  LEFT JOIN systems S  ON S.s_id = STS.child_s_id  LEFT JOIN(SELECT ROW1.appsts_id,  '['  || Row_to_json(row1)  || ']' SYS_JSON  FROM  (SELECT ASTS.s_description,  ASTS.appsts_id,  ASTS.s_id,  ASTS.cluster_code  FROM   app_system_to_system ASTS) ROW1)  R1  ON R1.appsts_id = AUS.appsts_id  GROUP  BY U.client_id,  U.u_id,  U.account_locked_date,  U.enforce_change_password,  allocated_designer,  U.allocated_ip,  U.allocated_static_module,  U.double_authentication,  U.double_authentication_model,  U.email_id,  U.login_name,  U.first_name,  U.middle_name,  U.last_name,  U.last_successful_login,  U.last_unsuccessful_login,  U.mobile_no,  U.session_timeout,  U.water_marking,  AU.appu_id,  R.role_description,  R.appr_id) VW";
                            }
                            //}
                            var Searchquery;
                            if (issearch == 'Y') {
                                reqInstanceHelper.PrintInfo(strServiceName, 'Is search call: Y', objLogInfo);

                                if (User_Search_Str != '' && User_Search_Str != undefined && User_Search_Str != null) {
                                    reqInstanceHelper.PrintInfo(strServiceName, 'User Search params :' + User_Search_Str, objLogInfo);
                                    Searchquery = litequery + " WHERE UPPER(VW.LOGIN_NAME) like '%" + User_Search_Str.toUpperCase() + "%'";
                                }
                                if (Sys_Search_Str != '' && Sys_Search_Str != undefined && Sys_Search_Str != null) {
                                    reqInstanceHelper.PrintInfo(strServiceName, 'System Search params : ' + Sys_Search_Str, objLogInfo);
                                    if (User_Search_Str != '' && User_Search_Str != undefined && User_Search_Str != null) {
                                        Searchquery = Searchquery + " AND UPPER(VW.S_DESCRIPTION) like '%" + Sys_Search_Str.toUpperCase() + "%'";
                                    } else {
                                        Searchquery = litequery + " WHERE UPPER(VW.S_DESCRIPTION) like '%" + Sys_Search_Str.toUpperCase() + "%'";
                                    }
                                }
                                if (Role_Search_Str != '' && Role_Search_Str != undefined && Role_Search_Str != null) {
                                    reqInstanceHelper.PrintInfo(strServiceName, 'Role Search params : ' + Role_Search_Str, objLogInfo);
                                    if (Sys_Search_Str != '' && Sys_Search_Str != undefined && Sys_Search_Str != null) {
                                        Searchquery = Searchquery + " AND UPPER(VW.ROLE_DESCRIPTION) like '%" + Role_Search_Str.toUpperCase() + "%'";
                                    } else if (User_Search_Str != '' && User_Search_Str != undefined && User_Search_Str != null) {
                                        Searchquery = Searchquery + " AND UPPER(VW.ROLE_DESCRIPTION) like '%" + Role_Search_Str.toUpperCase() + "%'";
                                    } else {
                                        Searchquery = litequery + " WHERE UPPER(VW.ROLE_DESCRIPTION) like '%" + Role_Search_Str.toUpperCase() + "%'";
                                    }
                                }
                            } else {
                                reqInstanceHelper.PrintInfo(strServiceName, 'Is search call: N, Default loading all users', objLogInfo);
                                Searchquery = litequery;
                            }
                            reqInstanceHelper.PrintInfo(strServiceName, 'Querying Searchquery table', objLogInfo);
                            reqFXDBInstance.ExecuteQueryWithPagingCount(mCltClient, Searchquery, 1, 10, objLogInfo, function caLlbacklitefiler(Result, count, err) {
                                try {
                                    if (err) {
                                        return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50741', 'Error while Querying Searchquery table', err, 'FAILURE', '');
                                    } else {
                                        if (Result.length > 0) {
                                            reqInstanceHelper.PrintInfo(strServiceName, 'Got result  from Searchquery table', objLogInfo);
                                            reqInstanceHelper.PrintInfo(strServiceName, 'Total Returned Rows ' + Result.length, objLogInfo);
                                            prepareResult();
                                        } else {
                                            return reqInstanceHelper.SendResponse(strServiceName, appResponse, [], objLogInfo, '', '', '', '', '');
                                        }
                                        //to Prepare the filtered result
                                        function prepareResult() {
                                            try {
                                                reqInstanceHelper.PrintInfo(strServiceName, 'Executing prepareResult function', objLogInfo);
                                                var appUID = [];
                                                var arrname = [];
                                                for (i = 0; i < Result.length; i++) {
                                                    reqInstanceHelper.PrintInfo(strServiceName, 'for loop executing...' + 'i is : ' + i, objLogInfo);
                                                    if (Result[i].login_name !== 'VPH_ADMIN' && Result[i].login_name !== 'NPSS_ADMIN' && Result[i].status !== 'DELETED') {
                                                        var objname = {};
                                                        var ASM = {};
                                                        var ROLES = {};
                                                        var arrrole = [];
                                                        var objarrd = {};
                                                        var appstsdetails = {};
                                                        var objappsys = {};
                                                        var arrappsys = [];
                                                        if (Result[i].sys_json != null) {
                                                            var splitsys = Result[i].sys_json.split('~');
                                                            var sys = JSON.parse(splitsys);
                                                            objappsys.APP_SYSTEM_TO_SYSTEM = sys;
                                                            objname.APP_USER_STS_DETAILS = objappsys;
                                                        } else {
                                                            objappsys.APP_SYSTEM_TO_SYSTEM = [];
                                                            objname.APP_USER_STS_DETAILS = {
                                                                APP_SYSTEM_TO_SYSTEM: []
                                                            };
                                                        }
                                                        appUID.push(Result[i].appu_id);
                                                        ROLES.APPR_ID = Result[i].appr_id;
                                                        ROLES.S_DESCRIPTION = Result[i].role_description;
                                                        arrrole.push(ROLES);
                                                        objarrd.ROLES = arrrole;
                                                        objname.ROLES_DETAILS = objarrd;
                                                        objname.LOGIN_NAME = Result[i].login_name;
                                                        objname.FIRST_NAME = Result[i].iv_first_name;
                                                        objname.ACCOUNT_LOCKED_DATE = Result[i].account_locked_date;
                                                        if (objname.ACCOUNT_LOCKED_DATE == null) {
                                                            objname.ACCOUNT_LOCKED_DATE = '';
                                                        }
                                                        ASM.STATIC_MODULE = JSON.parse(Result[i].allocated_static_module);
                                                        objname.ALLOCATED_STATIC_MODULE = ASM;
                                                        objname.ALLOCATED_IP = Result[i].iv_allocated_ip;
                                                        objname.APPU_ID = Result[i].appu_id;
                                                        objname.LAST_SUCCESSFUL_LOGIN = Result[i].last_successful_login;
                                                        objname.MIDDLE_NAME = Result[i].iv_middle_name;
                                                        objname.MOBILE_NO = Result[i].iv_mobile_no;
                                                        objname.CLIENT_ID = Result[i].client_id;
                                                        objname.DOUBLE_AUTHENTICATION = Result[i].iv_double_authentication;
                                                        objname.DOUBLE_AUTHENTICATION_MODEL = Result[i].iv_double_authentication_model;
                                                        objname.ENFORCE_CHANGE_PWD = Result[i].iv_enforce_change_password;
                                                        objname.EMAIL_ID = Result[i].iv_email_id;
                                                        objname.LAST_NAME = Result[i].iv_last_name;
                                                        objname.SESSION_TIMEOUT = Result[i].iv_session_timeout;
                                                        objname.U_ID = Result[i].u_id;
                                                        objname.WATER_MARKING = Result[i].iv_water_marking;
                                                        objname.ROLES = Result[i].role_description;
                                                        objname.APP_USER_STS_DESC = Result[i].s_description;
                                                        objname.STATUS = Result[i].status;
                                                        objname.ACTION_DESC = Result[i].action_desc;
                                                        objname.APPROVAL_STATUS = arrUserDetails[i].approval_status;
                                                        objname.REMARKS = Result[i].remarks;
                                                        objname.START_ACTIVE_DATE = Result[i].iv_start_active_date;
                                                        objname.END_ACTIVE_DATE = Result[i].iv_end_active_date;
                                                        objname.CREATED_BY_NAME = Result[i].created_by_name;
                                                        objname.PWD_TYPE = Result[i].pwd_type;
                                                        objname.CREATED_DATE = Result[i].created_date;
                                                        objname.UG_CODE = Result[i].UG_CODE
                                                        objname.ROLE_MODE = Result[i].ROLE_MODE
                                                        arrname.push(objname);

                                                    }
                                                }
                                                reqInstanceHelper.PrintInfo(strServiceName, 'for loop finished...', objLogInfo);
                                                reqInstanceHelper.PrintInfo(strServiceName, 'Users loaded successfully...', objLogInfo);
                                                return reqInstanceHelper.SendResponse(strServiceName, appResponse, arrname, objLogInfo, '', '', '', '', '');
                                            } catch (error) {
                                                return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50742', 'Error while  calling prepareResult Function', error, '', '');
                                            }
                                        }
                                    }
                                } catch (error) {
                                    return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50743', 'Error while  Executing Searchquery', error, '', '');
                                }
                            });
                        } catch (error) {
                            return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50744', 'Error while  Executing litefiler function', error, '', '');
                        }
                    }
                });
            });
            

            function _Response() {
                if (this.userpage == 1) {
                    var current_page = 1;
                } else {
                    current_page = appRequest.body.PARAMS.CURRENT_PAGENO;
                }
                var resData = {};
                resData.USERDATA = arrUSER;
                resData.current_pageno = current_page;
                resData.total_records = totalRecords;
                return reqInstanceHelper.SendResponse(strServiceName, appResponse, resData, objLogInfo, '', '', '', '', '');
            }

        } catch (error) {
            return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50745', 'Error while calling GetClientAppUsers API Function', error, '', '');
        }
    });
});
module.exports = router;
/*********** End of Service **********/