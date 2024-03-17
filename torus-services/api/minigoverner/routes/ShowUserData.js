/*  
Purpose   : Show User's Modified Data 
@Api_Name : /ShowUserData,
@Description: Occurs user's previous data and actual data.

  */

// Require dependencies
var modPath = '../../../../node_modules/';
var reqExpress = require(modPath + 'express');
var router = reqExpress.Router();
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqsvchelper = require('../../../../torus-references/common/serviceHelper/ServiceHelper');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
const { resolve } = require('path');
const { reject } = require('lodash');

//global variable declaration
var strServiceName = 'ShowUserData';
router.post('/ShowUserData', function (appRequest, appResponse, next) {
    var pHeaders = appRequest.headers;
    var params = appRequest.body.PARAMS
    var loginName = params.LoginName
    var u_id = params.U_Id
    var appu_Id = params.Appu_Id
    var res = {}
    var Udetails = {}
    var iv_roles = ''
    var actual_roles = ''
    var iv_systems = ''
    var actual_systems = ''
    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, sessionInfo) {
        try {
            reqInstanceHelper.PrintInfo(strServiceName, 'Begin', objLogInfo);
            reqFXDBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function (dbConnection) {
                if (loginName || u_id) {
                    showUserDetails(loginName, u_id)
                }
                async function showUserDetails(LoginName, U_Id) {
                    return new Promise((resolve, reject) => {
                        try {
                            let sQuery = `select login_name ,iv_login_name ,first_name ,iv_first_name ,middle_name ,iv_middle_name ,
                            last_name ,iv_last_name ,email_id ,iv_email_id ,mobile_no ,iv_mobile_no ,enforce_change_password,is_enabled,iv_is_enabled,
                            iv_enforce_change_password ,double_authentication ,iv_double_authentication iv_start_active_date, start_active_date ,
                            iv_end_active_date,end_active_date from users
                             where login_name='${loginName}' and u_id='${U_Id}' and tenant_id='${sessionInfo.TENANT_ID}'`
                            reqFXDBInstance.ExecuteQuery(dbConnection, sQuery, objLogInfo, async function (Error, Result) {
                                if (Error) {
                                    return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-0001', 'Querying  users table have been failed', Error, '', '');
                                } else {
                                    if (Result.rows.length) {
                                        Udetails.UserDetails = Result.rows
                                        var Success = await showUserRole(appu_Id)
                                        if (Success = "Success") {
                                            reqInstanceHelper.SendResponse(strServiceName, appResponse, Udetails, objLogInfo, "", "", "", "SUCCESS", "SUCCESS")
                                        } else {
                                            return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-0002', 'Error Occured', '', '', '');
                                        }
                                    }
                                }
                            })
                        } catch (error) {
                            return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-0003', 'Querying  users table have been failed', error, '', '');
                        }
                    })
                }

                async function showUserRole(Appu_Id) {
                    return new Promise((resolve, reject) => {
                        try {
                            let sQuery = `select role_description from iv_app_user_roles iaur inner join app_roles ar on iaur.appr_id = ar.appr_id where iaur.appu_id ='${Appu_Id}'`
                            reqFXDBInstance.ExecuteQuery(dbConnection, sQuery, objLogInfo, async function (Error, IvRolesRes) {
                                if (Error) {
                                    return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-0004', 'Querying iv_app_user_roles failed', Error, '', '');
                                } else {
                                    var ivroles = IvRolesRes.rows
                                    res.iv_appUDetails = ivroles
                                    iv_roles = prepareString(ivroles, 'role_description')
                                    let Query = `select role_description from app_user_roles iaur inner join app_roles ar on iaur.appr_id = ar.appr_id where iaur.appu_id ='${Appu_Id}'`
                                    reqFXDBInstance.ExecuteQuery(dbConnection, Query, objLogInfo, async function (Error, Result) {
                                        if (Error) {
                                            return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-0005', 'Querying app_user_roles failed', Error, '', '');
                                        } else {
                                            var liveRoles = Result.rows
                                            res.appUDetails = liveRoles
                                            actual_roles = prepareString(liveRoles, 'role_description')
                                            //We are implementing at feature
                                            // showUserRolemenu()
                                            Udetails.iv_appUDetails = iv_roles
                                            Udetails.appUDetails = actual_roles
                                            var result = await showUserSystem()
                                            if (result == "Success") {
                                                resolve("Success")
                                            }
                                        }
                                    })
                                }
                            })
                        } catch (error) {
                            return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-0010', 'Error Occured', error, '', '');
                        }
                    })
                }

                async function showUserSystem() {
                    return new Promise((resolve, reject) => {

                        try {
                            var sQuery = `select s_description from app_system_to_system asts where appsts_id in(select appsts_id from iv_app_user_sts aus where appu_id ='${appu_Id}')`
                            reqFXDBInstance.ExecuteQuery(dbConnection, sQuery, objLogInfo, function (Error, iv_Result) {
                                if (Error) {
                                    return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-0006', 'Querying iv_app_user_sts failed', Error, '', '');
                                } else {
                                    res.IV_USystemDetails = iv_Result.rows
                                    let iv_Sys = prepareString(iv_Result.rows, 's_description')
                                    iv_systems = iv_Sys.split(',').sort().join(',')
                                    var Query = `select s_description from app_system_to_system asts where appsts_id in(select appsts_id from app_user_sts aus where appu_id ='${appu_Id}')`
                                    reqFXDBInstance.ExecuteQuery(dbConnection, Query, objLogInfo, function (Error, Result) {
                                        if (Error) {
                                            return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-0007', 'Querying app_user_sts failed', Error, '', '');
                                        } else {
                                            if (Result.rows.length) {
                                                res.USystemDetails = Result.rows
                                                let actualSys = prepareString(Result.rows, 's_description')
                                                actual_systems = actualSys.split(',').sort().join(',')
                                                Udetails.iv_differingSystem = iv_systems
                                                Udetails.appdifferingSystem = actual_systems
                                                resolve("Success")
                                                resolve("Success")
                                            }
                                            resolve("Success")
                                        }
                                    })
                                }
                            })
                        } catch (error) {
                            return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-0008', 'Error Occured', error, '', '');
                        }
                    })
                }

                function prepareString(pRows, pdescription) {
                    var str = ''
                    for (var i = 0; i < pRows.length; i++) {
                        if (pRows[i][pdescription]) {
                            if (str == '') {
                                str = pRows[i][pdescription]
                            } else {
                                str = str + ',' + pRows[i][pdescription]
                            }
                        }
                    }
                    return str
                }
            })
        } catch (error) {
            return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-0009', 'Error Occured', error, '', '');
        }
    })
})

module.exports = router;