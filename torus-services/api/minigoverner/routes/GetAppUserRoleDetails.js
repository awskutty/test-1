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
const { isNull } = require('lodash');



// Host the login api
router.post('/GetAppUserRoleDetails', function (appRequest, appResponse) {
    var cond = {};
    var strServiceName = "GetAppUserRoleDetails";
    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, sessionInfo) {
        try {
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
                var u_id = appRequest.body.PARAMS.u_id;
                var GetAPPUID = [];
                var GetAPPRID = [];
                var GetAPPSTS_ID = [];
                var arrappusr = [];
                var arrAPPUerDet = [];
                var appUserRoleMenus = [];
                var arrAppDetails = [];
                var arrAPPRDet = [];
                var arrAppUSER = [];
                // var arrAppUserSTSDetails = [];
                var arrAppSTSDetails = [];
                var loginName = ''
                _GetUserDtls()

                function _GetUserDtls() {
                    try {
                        reqFXDBInstance.GetTableFromFXDB(mCltClient, 'USERS', ['LOGIN_NAME', 'U_ID'], { U_ID: u_id }, objLogInfo, function (pError, result) {
                            if (pError) {
                                return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50947', 'Error while table', pError, '', '');
                            } else if (result.rows.length) {
                                loginName = result.rows[0].login_name
                                _getappuserdetails();
                            } else {
                                return reqInstanceHelper.SendResponse(strServiceName, appResponse, 'FAILURE', objLogInfo, 'ERR-USER-404', 'Uer not found', 'User not found', 'FAILURE', '');
                            }
                        })

                    } catch (error) {

                    }
                }
                function _getappuserdetails() {

                    reqInstanceHelper.PrintInfo(strServiceName, 'Querying application table', objLogInfo);
                    reqFXDBInstance.GetTableFromFXDB(mCltClient, 'applications', ['app_id', 'app_code', 'app_description'], {}, objLogInfo, function (err, Res) {
                        if (err) {
                            return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50737', 'Error while Querying application table', err, '', '');
                        } else {
                            try {
                                reqInstanceHelper.PrintInfo(strServiceName, 'Got Result from applications', objLogInfo);
                                arrAppDetails = Res.rows;
                            } catch (Error) {
                                return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50745', 'Error in Getting result from applications', err, '', '');
                            }
                        }
                    });
                    reqInstanceHelper.PrintInfo(strServiceName, 'Querying APP_USERS  table', objLogInfo);
                    var selappuser = {
                        query: "select * from iv_app_users where u_id=? and status is null",
                        params: [u_id]
                    }
                    reqFXDBInstance.ExecuteSQLQueryWithParams(mCltClient, selappuser, objLogInfo, function (result, err) {
                        // reqFXDBInstance.GetTableFromFXDB(mCltClient, 'app_users', ['u_id', 'appu_id', 'app_id', 'ug_code', 'role_mode'], { 'u_id': u_id, 'status': isNull}, objLogInfo, function callbackfilter(err, result) {
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
                                    _getappuserroledetails();
                                }
                                else {
                                    reqInstanceHelper.PrintInfo(strServiceName, 'No records in app_users table', objLogInfo);
                                    _getappuserroledetails();
                                }
                            } catch (Error) {
                                return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50745', 'Error in Getting result from app_users', err, '', '');
                            }
                        }
                    })
                }

                function _getappuserroledetails() {
                    reqInstanceHelper.PrintInfo(strServiceName, 'Querying APP_USER_ROLES  table', objLogInfo);
                    reqFXDBInstance.GetTableFromFXDB(mCltClient, 'iv_app_user_roles', ['appu_id', 'appr_id', 'appur_id'], { 'appu_id': GetAPPUID }, objLogInfo, function callbackfilter(pErr, pResult) {
                        if (pErr) {
                            return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50701', 'Querying app_users roles table have been failed', pErr, '', '');
                        } else {
                            try {
                                if (pResult.rows.length > 0) {
                                    reqInstanceHelper.PrintInfo(strServiceName, 'Got result from app_user_roles table', objLogInfo);
                                    arrAPPUerDet = pResult.rows;
                                    var approles = new reqLINQ(pResult.rows)
                                        .Where(function (u) {
                                            return u.appr_id !== null;
                                        }).ToArray();
                                    GetAPPRID = new reqLINQ(approles)
                                        .Select(function (APPRID) {
                                            return APPRID.appr_id;
                                        }).ToArray();

                                    if (GetAPPRID.length > 0) {
                                        reqFXDBInstance.GetTableFromFXDB(mCltClient, 'APP_USER_ROLE_MENUS', [], { U_ID: u_id }, objLogInfo, function (pError, result) {
                                            if (pError) {
                                                return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50800', 'Error occured query app user role menu', pError, '', '');
                                            } else {
                                                appUserRoleMenus = result.rows
                                                _GetAppRoleDet();
                                            }

                                        })
                                    } else {
                                        _GetAppRoleDet();
                                    }

                                } else {
                                    reqInstanceHelper.PrintInfo(strServiceName, 'No records in app_users_roles table', objLogInfo);
                                    _GetAppRoleDet();
                                }

                            } catch (Error) {
                                return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50745', 'Error in Getting result from app user roles', pErr, '', '');
                            }
                        }
                    })

                }

                function _GetAppRoleDet() {

                    reqInstanceHelper.PrintInfo(strServiceName, 'Querying APP_ROLES  table', objLogInfo);
                    reqFXDBInstance.GetTableFromFXDB(mCltClient, 'app_roles', ['app_id', 'appr_id', 'role_description'], { 'appr_id': GetAPPRID }, objLogInfo, function callbackfilter(pErr, pResult) {
                        if (pErr) {
                            return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50701', 'Querying app_roles table have been failed', pErr, '', '');
                        } else {
                            try {
                                if (pResult.rows.length > 0) {
                                    reqInstanceHelper.PrintInfo(strServiceName, 'Got result from app roles table', objLogInfo);
                                    arrAPPRDet = pResult.rows;
                                    _GetFilteredAPPSTSDet();
                                    // _result();
                                } else {
                                    reqInstanceHelper.PrintInfo(strServiceName, 'No records in app_roles table', objLogInfo);
                                    _GetFilteredAPPSTSDet();
                                    // _result();
                                }
                            } catch (Error) {
                                return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50745', 'Error in Getting result from app roles', pErr, '', '');
                            }
                        }
                    })
                }

                function _GetFilteredAPPSTSDet() {
                    try {
                        reqInstanceHelper.PrintInfo(strServiceName, 'Querying app_user_sts table', objLogInfo);
                        reqFXDBInstance.GetTableFromFXDB(mCltClient, 'app_user_sts', [], { 'appu_id': GetAPPUID }, objLogInfo, function (err, Res) {

                            if (err) {
                                return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50728', 'Error while app_user_sts table', err, '', '');
                            } else {
                                try {

                                    reqInstanceHelper.PrintInfo(strServiceName, 'Got result from app_user_sts table', objLogInfo);
                                    GetAPPSTS_ID = new reqLINQ(Res.rows)
                                        .Select(function (APPSTS_UID) {
                                            return APPSTS_UID.appsts_id;
                                        }).ToArray();
                                    GetAPPSTS_ID = unique(GetAPPSTS_ID);

                                    if (GetAPPSTS_ID.length > 0) {
                                        _GetFilteredSTSDet();
                                    } else {
                                        _GetFilteredSTSDet();
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

                        reqInstanceHelper.PrintInfo(strServiceName, 'Querying app_system_to_system table', objLogInfo);
                        reqFXDBInstance.GetTableFromFXDB(mCltClient, 'app_system_to_system', [], { 'appsts_id': GetAPPSTS_ID }, objLogInfo, function (err, Res) {

                            if (err) {
                                return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50731', 'Error While Querying app_system_to_system', err, '', '');
                            } else {
                                try {
                                    arrAppSTSDetails = Res.rows;
                                    reqInstanceHelper.PrintInfo(strServiceName, 'Got result from app_system_to_system table', objLogInfo);
                                    _result();
                                } catch (error) {
                                    return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50732', 'Error in calling _GetFilteredAPPURDet Function', error, '', '');
                                }
                            }
                        });

                    } catch (error) {
                        return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50733', 'Error in calling _GetFilteredSTSDet Function', error, '', '');
                    }
                }

                function _result() {
                    //  var arrAppUSER = [];   

                    for (var i = 0; i < arrappusr.length; i++) {
                        var objapp = {}
                        var objUSER = {};
                        objUSER.APP_ID = arrappusr[i].app_id;
                        objUSER.UG_CODE = arrappusr[i].ug_code;

                        for (var k = 0; k < arrAppDetails.length; k++) {
                            if (arrappusr[i].app_id == arrAppDetails[k].app_id) {
                                objUSER.APPU_ID = arrappusr[i].appu_id;
                                objUSER.APP_CODE = arrAppDetails[k].app_code;
                                objUSER.APP_DESCRIPTION = arrAppDetails[k].app_description;
                            }
                        }
                        var arrAppSTSFrom = [];
                        objSTS = {};
                        var Condn = '';
                        for (var sts = 0; sts < arrAppSTSDetails.length; sts++) {
                            if (arrappusr[i].app_id == arrAppSTSDetails[sts].app_id) {
                                var objASTSForm = {};
                                if (Condn != '') {
                                    Condn += "," + arrAppSTSDetails[sts].s_description;
                                }
                                if (Condn == '') {
                                    Condn = arrAppSTSDetails[sts].s_description;
                                }
                                objASTSForm.APPSTS_ID = arrAppSTSDetails[sts].appsts_id;
                                objASTSForm.S_DESCRIPTION = arrAppSTSDetails[sts].s_description;
                                objASTSForm.S_ID = arrAppSTSDetails[sts].s_id;
                                objASTSForm.CLUSTER_CODE = arrAppSTSDetails[sts].cluster_code;
                                arrAppSTSFrom.push(objASTSForm);

                            }
                        }
                        objUSER.APP_USER_STS_DESC = Condn;
                        objSTS.APP_SYSTEM_TO_SYSTEM = arrAppSTSFrom;
                        objUSER.APP_USER_STS_DETAILS = objSTS;
                        objUSER.U_ID = u_id
                        objUSER.LOGIN_NAME = loginName
                        objUSER.ROLE_MODE = arrappusr[i].role_mode;
                        var arrApprmenus = [];
                        for (var apur = 0; apur < appUserRoleMenus.length; apur++) {
                            if (arrappusr[i].app_id == appUserRoleMenus[apur].app_id)
                                arrApprmenus.push(appUserRoleMenus[apur])
                        }
                        objUSER.APP_USER_ROLE_MENUS = arrApprmenus;

                        var apprdet = [];
                        var CondnApp = '';

                        for (var j = 0; j < arrAPPRDet.length; j++) {

                            if (arrappusr[i].app_id == arrAPPRDet[j].app_id) {
                                var objARForm = {};
                                if (CondnApp != '') {
                                    CondnApp += ',' + arrAPPRDet[j].role_description;
                                }

                                if (CondnApp == '') {
                                    CondnApp = arrAPPRDet[j].role_description;
                                }
                                objARForm.APPR_ID = arrAPPRDet[j].appr_id;
                                objARForm.ROLE_DESCRIPTION = arrAPPRDet[j].role_description;
                                apprdet.push(objARForm);
                            }
                        }
                        objUSER.ROLES = CondnApp;
                        //objUSER.ROLES_DETAILS = apprdet;
                        var roleobj = { ROLES: apprdet }
                        objUSER.ROLES_DETAILS = roleobj;
                        arrAppUSER.push(objUSER);
                    }
                    _Response();

                }

                function _Response() {
                    return reqInstanceHelper.SendResponse(strServiceName, appResponse, arrAppUSER, objLogInfo, '', '', '', '', '');
                }

            })
        } catch (Error) {
            return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50745', 'Error while calling GetAppUserRoleDetails API Function', error, '', '');
        }
    });

});
module.exports = router;