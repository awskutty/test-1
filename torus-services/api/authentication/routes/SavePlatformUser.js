/*
modified by UdhayaRaj Ms for insert into user_password_log on 08-11-2016
*/

// Require dependencies
var modPath = '../../../../node_modules/'
var reqExpress = require(modPath + 'express');
var reqEncHelper = require('../../../../torus-references/common/crypto/EncryptionInstance');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var DBInstance = require('../../../../torus-references/instance/DBInstance');
var reqDateFormater = require('../../../../torus-references/common/dateconverter/DateFormatter');
var router = reqExpress.Router();
//var reqMoment = require('moment');

// Cassandra initialization
var mCltClient = '';
var pHeaders = '';
const TOTALUSERS = 'update fx_total_items set counter_value = counter_value + 1 where code=?';
const UPDATEUSER = 'update users set first_name=?,middle_name=?,last_name=?,email_id=?,allocated_ip=? ,double_authentication=?,double_authentication_model=?,water_marking=?,session_timeout=?,modified_by=?,modified_date=?,allocated_designer=?, mobile_no=?,enforce_change_password=? where client_id=? and login_name = ? and u_id = ?';
const SELECTUSER = 'Select login_name FROM users where login_name=?';
const USERCOUNT = 'select counter_value from fx_total_items where code=?';
const USERINS = 'insert into users(client_id,u_id,first_name,middle_name,last_name,login_name,email_id,allocated_ip,login_password,double_authentication,double_authentication_model,water_marking,session_timeout,created_by,created_date,allocated_designer,mobile_no,enforce_change_password) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)';
const UPLTDETINS = 'insert into users_platform_details(client_id,login_name) values(?,?)';
const LSTPWDINS = 'insert into last_pwd_creation (u_id, last_created_date,last_created_pwds) VALUES(?,?,?)';
const USERPWDLOG = 'INSERT INTO user_password_log(u_id,new_password,old_password,created_date,created_by) VALUES(?,?,?,?,?)';
var objLogInfo = null;
router.post('/SavePlatformUser', function (pReq, pResp, pNext) {
    try {
        pHeaders = pReq.headers;
        DBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function Callback_GetCassandraConn(pClient) {
            //reqCasInstance.GetCassandraConn(pHeaders, 'clt_cas', function Callback_GetCassandraConn(pClient) {
            mCltClient = pClient;

            objLogInfo = reqLogInfo.AssignLogInfoDetailForCP(pReq.body, pReq);
            objLogInfo.PROCESS = 'SavePlatformUser-Authentication';
            objLogInfo.ACTION = 'SavePlatformUser';
            reqLogWriter.Eventinsert(objLogInfo);

            // Initialize local variables
            pResp.setHeader('Content-Type', 'application/json');
            var user_details = pReq.body.PF_USERS;
            var lst_USERS = JSON.parse(user_details);
            var TYPE = pReq.body.TYPE;
            var pClientId = pReq.body.CLIENT_ID;
            var pU_id = pReq.body.U_ID;
            var pDesigner = pReq.body.ALLOCATED_DESIGNER || "";
            var pStaticModule = pReq.body.ALLOCATED_STATIC_MODULE || "";
            var strUSERS = '';
            var userdet = '';
            var UNIQ_U_ID = '';
            var encryptpwd = lst_USERS.PASSWORD; //reqEncHelper.EncryptPassword(lst_USERS.PASSWORD)
            var strPFuser = new _PlatFormUsers();
            var params = {};
            var ctrlrName = pReq.body.CTRLR_NAME ||"";
            if (lst_USERS.U_ID == '') {
                CheckUserExist();
            } else {
                params = {
                    'first_name': lst_USERS.FIRST_NAME,
                    'middle_name': lst_USERS.MIDDLE_NAME,
                    'last_name': lst_USERS.LAST_NAME,
                    'email_id': lst_USERS.EMAIL_ID,
                    'allocated_ip': lst_USERS.ALLOCATED_IP,
                    'double_authentication': lst_USERS.DOUBLE_AUTHENTICATION,
                    'double_authentication_model': lst_USERS.DOUBLE_AUTHENTICATION_MODEL,
                    'water_marking': lst_USERS.NEED_WATERMARKING,
                    'session_timeout': lst_USERS.SESSION_TIMEOUT,
                    'modified_by': pU_id,
                    'modified_date': reqDateFormater.GetTenantCurrentDateTime(pHeaders, objLogInfo),
                    'allocated_designer': pDesigner,                    
                    'mobile_no': lst_USERS.MOBILE_NUMBER,
                    'enforce_change_password': lst_USERS.ENFORCE_CHANGE_PWD
                }
                if(ctrlrName!=""){
                    params.allocated_static_module =  pStaticModule
                }
                DBInstance.UpdateFXDB(mCltClient, 'users', params , {
                    'client_id': pClientId,
                    'login_name': lst_USERS.LOGIN_NAME.toUpperCase(),
                    'u_id': lst_USERS.U_ID
                }, objLogInfo, function callbackupduser(err) {
                    // mCltClient.execute(UPDATEUSER, [lst_USERS.FIRST_NAME, lst_USERS.MIDDLE_NAME, lst_USERS.LAST_NAME, lst_USERS.EMAIL_ID, lst_USERS.ALLOCATED_IP, lst_USERS.DOUBLE_AUTHENTICATION, lst_USERS.DOUBLE_AUTHENTICATION_MODEL, lst_USERS.NEED_WATERMARKING, lst_USERS.SESSION_TIMEOUT, pU_id, reqDateFormater.GetTenantCurrentDateTime(pHeaders, objLogInfo), pDesigner, lst_USERS.MOBILE_NUMBER, lst_USERS.ENFORCE_CHANGE_PWD, pClientId, lst_USERS.LOGIN_NAME.toUpperCase(), lst_USERS.U_ID], {
                    //     prepare: true
                    // }, function callbackupduser(err) {
                    try {
                        if (err) {
                            console.log(err.stack);
                        } else {
                            strPFuser.RESULT = '';
                            strPFuser.MESSAGE = "SUCCESS"
                            reqLogWriter.EventUpdate(objLogInfo);
                            pResp.send(strPFuser);
                        }
                    } catch (error) {
                        errorHandler("ERR-FX-10189", "Error SavePlatformUser function" + error)
                    }
                })
            }

            function CheckUserExist() {
                try {
                    DBInstance.GetTableFromFXDB(mCltClient, 'users', ['login_name'], {
                        'login_name': lst_USERS.LOGIN_NAME.toUpperCase()
                    }, objLogInfo, function callbackslectu(err, result) {
                        // mCltClient.execute(SELECTUSER, [lst_USERS.LOGIN_NAME.toUpperCase()], {
                        //     prepare: true
                        // }, function callbackslectu(err, result) {
                        try {
                            if (err) {
                                reqLogWriter.TraceError(objLogInfo, SELECTUSER + 'Execution failed' + err, 'ERR-FX-10188');
                            } else {
                                if (result.rows.length > 0) {
                                    strPFuser.MESSAGE = 'User already exist';
                                    pResp.send(strPFuser);
                                } else {
                                    const TOTALUSERS = 'update fx_total_items set counter_value = counter_value + 1 where code=\'USERS\'';
                                    DBInstance.ExecuteQuery(mCltClient, TOTALUSERS, objLogInfo, function callbackTOTALUSERS(err, result) {
                                        // mCltClient.execute(TOTALUSERS, ['USERS'], {
                                        //     prepare: true
                                        // }, function callbackTOTALUSERS(err, result) {
                                        if (err)
                                            reqLogWriter.TraceError(objLogInfo, USERCOUNT + 'Execution failed' + err, 'ERR-FX-10188');
                                        else {
                                            DBInstance.GetTableFromFXDB(mCltClient, 'FX_TOTAL_ITEMS', ['counter_value'], {
                                                'code': 'USERS'
                                            }, objLogInfo, function callbackusercount(err, res) {
                                                // mCltClient.execute(USERCOUNT, ['USERS'], {
                                                //     prepare: true
                                                // }, function callbackusercount(err, res) {
                                                try {
                                                    if (err) {
                                                        reqLogWriter.TraceError(objLogInfo, USERCOUNT + 'Execution failed' + err, 'ERR-FX-10188');
                                                    } else {
                                                        UNIQ_U_ID = res.rows[0].counter_value.toString();
                                                        console.log('UNIQ_U_ID is :' + UNIQ_U_ID);
                                                        DBInstance.InsertFXDB(mCltClient, 'users', [{
                                                            'client_id': pClientId,
                                                            'u_id': UNIQ_U_ID,
                                                            'first_name': lst_USERS.FIRST_NAME,
                                                            'middle_name': lst_USERS.MIDDLE_NAME,
                                                            'last_name': lst_USERS.LAST_NAME,
                                                            'login_name': lst_USERS.LOGIN_NAME.toUpperCase(),
                                                            'email_id': lst_USERS.EMAIL_ID.toUpperCase(),
                                                            'allocated_ip': lst_USERS.ALLOCATED_IP,
                                                            'login_password': encryptpwd,
                                                            'double_authentication': lst_USERS.DOUBLE_AUTHENTICATION,
                                                            'double_authentication_model': lst_USERS.DOUBLE_AUTHENTICATION_MODEL,
                                                            'water_marking': lst_USERS.NEED_WATERMARKING,
                                                            'session_timeout': lst_USERS.SESSION_TIMEOUT,
                                                            'created_by': pU_id,
                                                            'created_date': reqDateFormater.GetTenantCurrentDateTime(pHeaders, objLogInfo),
                                                            'allocated_designer': pDesigner,
                                                            'allocated_static_module': pStaticModule,
                                                            'mobile_no': lst_USERS.MOBILE_NUMBER,
                                                            'enforce_change_password': lst_USERS.ENFORCE_CHANGE_PWD
                                                        }], objLogInfo, function callbackuserins(err) {
                                                            // mCltClient.execute(USERINS, [pClientId, UNIQ_U_ID, lst_USERS.FIRST_NAME, lst_USERS.MIDDLE_NAME, lst_USERS.LAST_NAME, lst_USERS.LOGIN_NAME.toUpperCase(), lst_USERS.EMAIL_ID.toUpperCase(), lst_USERS.ALLOCATED_IP, encryptpwd, lst_USERS.DOUBLE_AUTHENTICATION, lst_USERS.DOUBLE_AUTHENTICATION_MODEL, lst_USERS.NEED_WATERMARKING, lst_USERS.SESSION_TIMEOUT, pU_id, Date.now(), pDesigner, lst_USERS.MOBILE_NUMBER, lst_USERS.ENFORCE_CHANGE_PWD], {
                                                            //     prepare: true
                                                            // }, function callbackuserins(err) {
                                                            try {
                                                                if (err) {
                                                                    reqLogWriter.TraceError(objLogInfo, USERINS + 'Execution failed' + err, 'ERR-FX-10188');
                                                                } else {
                                                                    SaveUser();
                                                                }
                                                            } catch (error) {
                                                                errorHandler("ERR-FX-10188", "Error SavePlatformUser function" + error)
                                                            }
                                                        })
                                                    }
                                                } catch (error) {
                                                    errorHandler("ERR-FX-10187", "Error SavePlatformUser function" + error)
                                                }
                                            })
                                        }
                                    })

                                }
                            }
                        } catch (error) {
                            errorHandler("ERR-FX-10186", "Error SavePlatformUser function" + error)
                        }
                    })
                } catch (error) {
                    errorHandler("ERR-FX-10185", "Error SavePlatformUser function" + error)
                }
            }

            //Prepare to save the user as chat user and inserts
            function SaveUser() {
                //        var strPwd = '';
                //        mCltClient.execute(CLIENTSETUP, [pClientId, "CHT_USR_PWD"], {
                //            prepare: true
                //        }, function callbackclientsetup(err, result) {
                //            if (err) {
                //                console.log(err.stack)
                //            } else {
                //                if (result.rows.length > 0) {
                //                    strPwd = result.rows[0].setup_json;
                //                    strPwd = strPwd[0].CHT_USR_PWD;
                //                    RocketChatHelper.__CreateUser(Cassandra_userIns, UNIQ_U_ID, lst_USERS.LOGIN_NAME.toUpperCase(), lst_USERS.EMAIL_ID.toUpperCase(), strpassword, pClientId, "");
                DBInstance.InsertFXDB(mCltClient, 'users_platform_details', [{
                    'client_id': pClientId,
                    'login_name': lst_USERS.LOGIN_NAME.toUpperCase()
                }], objLogInfo, function callbackupltdet(err) {
                    // mCltClient.execute(UPLTDETINS, [pClientId, lst_USERS.LOGIN_NAME.toUpperCase()], {
                    //         prepare: true
                    //     }, function callbackupltdet(err) {
                    try {
                        if (err) {
                            console.log(er.stack)
                        } else {
                            DBInstance.InsertFXDB(mCltClient, 'last_pwd_creation', [{
                                'u_id': UNIQ_U_ID,
                                'last_created_date': reqDateFormater.GetTenantCurrentDateTime(pHeaders, objLogInfo),
                                'last_created_pwds': encryptpwd
                            }], objLogInfo, function callbacklstpwdins(err) {
                                // mCltClient.execute(LSTPWDINS, [UNIQ_U_ID, Date.now(), encryptpwd], {
                                //     prepare: true
                                // }, function callbacklstpwdins(err) {
                                try {
                                    if (err) {
                                        reqLogWriter.TraceError(objLogInfo, LSTPWDINS + 'Execution failed' + err, 'ERR-FX-10184');
                                    } else {
                                        DBInstance.InsertFXDB(mCltClient, 'user_password_log', [{
                                            'u_id': UNIQ_U_ID,
                                            'new_password': '',
                                            'old_password': encryptpwd,
                                            'created_date': reqDateFormater.GetTenantCurrentDateTime(pHeaders, objLogInfo),
                                            'created_by': pU_id
                                        }], objLogInfo, function callbackUSERPWDLOG(err, presult) {
                                            // mCltClient.execute(USERPWDLOG, [UNIQ_U_ID, '', encryptpwd, reqDateFormater.GetTenantCurrentDateTime(pHeaders, objLogInfo), pU_id], {
                                            //     prepare: true
                                            // }, function callbackUSERPWDLOG(err, presult) {
                                            if (err)
                                                reqLogWriter.TraceError(objLogInfo, USERPWDLOG + 'Execution failed' + err, 'ERR-FX-10184');
                                            else {

                                                if (TYPE == "USERS_SAVE") {
                                                    strPFuser.MESSAGE = "SUCCESS";
                                                    strPFuser.RESULT = ''
                                                    pResp.send(strPFuser);
                                                } else {
                                                    var LoadPlatformUser = require('./LoadPlatformUsers.js');
                                                    LoadPlatformUser.GetLoginName(pClientId, function callback(strRes) {
                                                        try {
                                                            strPFuser.RESULT = strRes;
                                                            strPFuser.MESSAGE = "SUCCESS";
                                                            pResp.send(strPFuser);
                                                        } catch (error) {
                                                            errorHandler("ERR-FX-10184", "Error SavePlatformUser function" + error)
                                                        }
                                                    });
                                                }
                                            }
                                        })
                                    }
                                } catch (error) {
                                    errorHandler("ERR-FX-10182", "Error SavePlatformUser function" + error)
                                }
                            })
                        }
                    } catch (error) {
                        errorHandler("ERR-FX-10181", "Error SavePlatformUser function" + error)
                    }
                })
                //                }
                //            }
                //        })
            }
        })
    } catch (error) {
        errorHandler("ERR-FX-10180", "Error SavePlatformUser function" + error)
    }

    function errorHandler(errcode, message) {
        console.log(message, errcode);
        reqLogWriter.TraceError(objLogInfo, message, errcode);
    }

    function _PlatFormUsers() {
        var RESULT = '';
        var MESSAGE = '';
    }
});


module.exports = router;