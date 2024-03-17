/**
 * @Api_Name        : /WPSimpleLogin,
 * @Description     : Authenticate user name pwd  and other validations check, like  first time login,
 * already login, tenant_setup etc..
 * @Last_Error_Code :ERR-AUT-14854
 * @Last_Modified_for:Force logout changed to common helper file.
 * Newchanges with active inactive
 **/

// Require dependencies
var modPath = '../../../../node_modules/';
var reqExpress = require(modPath + 'express');
var ldap = require(modPath + 'ldapjs');
var router = reqExpress.Router();
var reqLINQ = require(modPath + 'node-linq').LINQ;
var reqUuid = require(modPath + 'uuid');
// var reqTimeSpan = require(modPath + 'timespan');
var reqEncHelper = require('../../../../torus-references/common/crypto/EncryptionInstance');
var reqDateFormater = require('../../../../torus-references/common/dateconverter/DateFormatter');
var reqProducer = require('../../../../torus-references/common/Producer');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var DBInstance = require('../../../../torus-references/instance/DBInstance');
var reqRedisInstance = require('../../../../torus-references/instance/RedisInstance');
var reqsvchelper = require('../../../../torus-references/common/serviceHelper/ServiceHelper');
var reqLoginPageHelper = require('./helper/LoginPageHelper');
var reqJWT = require('jsonwebtoken');
var request = require('request');
var crypto = require('crypto');
var reqMoment = require('moment');

// Initialize Global variables
var router = reqExpress.Router();
//var need_analytics = false;

var serviceName = 'WPSimpleLogin';
router.post('/WPSimpleLogin', function (appRequest, appResponse, next) {
    try {
        var strMessage = '';
        var strResult = '';
        var pUser;
        var pHeaders = "";
        var mCltClient = "";
        var strTenantID = '';
        var strClientID = '';
        var resultSessionInfo = new SessionInfo();
        var objLogInfo;
        var serviceModel = DBInstance.DBInstanceSession['SERVICE_MODEL'];
        reqLogInfo.AssignLogInfoDetail(appRequest, function (resLogInfo, objSessionInfo) {
            try {
                objLogInfo = resLogInfo;
                // Handle the close event when client close the connection
                appResponse.on('close', function () { });
                appResponse.on('finish', function () { });
                appResponse.on('end', function () { });
                var FORCE_LOGOUT = appRequest.body.PARAMS.FORCE_LOGOUT || '';
                objLogInfo.PROCESS = 'WPSimpleLogin-Authentication';
                objLogInfo.ACTION = 'WPSimpleLogin';
                objLogInfo.USER_NAME = appRequest.body.PARAMS.pUname;
                objLogInfo.LOGIN_NAME = (appRequest.body.PARAMS && appRequest.body.PARAMS.pUname && appRequest.body.PARAMS.pUname.toUpperCase()) || '';
                objLogInfo.HANDLER_CODE = 'WP_SIMPLE_LOGIN';
                objLogInfo.FORCE_LOGOUT = appRequest.body.PARAMS.FORCE_LOGOUT;
                reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo);

                pHeaders = appRequest.headers;
                DBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function Callback_GetCassandraConn(pClient) {
                    reqRedisInstance.GetRedisConnectionwithIndex(2, function (error, RedisSession) {
                        reqRedisInstance.GetRedisConnection(function (error, clientR) {
                            try {
                                mCltClient = pClient;
                                resultSessionInfo = new SessionInfo();
                                // Initialize local variables
                                var IsCompleted = false;
                                appResponse.setHeader('Content-Type', 'application/json');
                                var tmpIp = appRequest.body.PARAMS.pClientIP; //appRequest.connection.remoteAddress;
                                tmpIp = tmpIp.split(':');
                                var strClientIp = tmpIp[0];
                                if (appRequest.body.PARAMS.TENANT_ID == undefined && appRequest.body.PARAMS.TENANT_ID == null) {
                                    var splitheader = pHeaders.routingkey.split('~');
                                    splitheader = splitheader[2].split('-');
                                    strTenantID = splitheader[1];
                                } else {
                                    strTenantID = appRequest.body.PARAMS.TENANT_ID;
                                }
                                // var strClientIp = appRequest.headers['x-real-ip'];
                                var strUname = appRequest.body.PARAMS.pUname.toUpperCase();
                                var UserEnteredCaptcha = appRequest.body.PARAMS.Captcha;
                                var NeedCaptcha = appRequest.body.PARAMS.NeedCaptcha;
                                var strPwd = appRequest.body.PARAMS.pPwd;
                                var logintrycnt = appRequest.body.PARAMS.pLoginTryCount;
                                var NEED_DUPLICATE_LOGIN_CHECK = '';
                                var tmpPwdExpiredTime = '';
                                var MaxInactivedays = '';
                                var intlogintrycount = '';
                                var pswdexpirationdays = '';
                                var CL_STP_SESSION_TIMEOUT = '';
                                var strModel = '';
                                var CltSetup;
                                var jwttoken = '';
                                var strSessionId = 'SESSIONID-' + strUname + '-' + Date.now();
                                var rediskey = strSessionId;
                                var JWTExpire = '';
                                //var Need_Analytics = ''
                                var ServerExpire = '';
                                var serviceModel = DBInstance.DBInstanceSession['SERVICE_MODEL'];
                                var NeedJwt = serviceModel.NEED_JWT;
                                var NeddextrAuth = "";
                                var SALTKEY = appRequest.headers["salt-session"];
                                // SALTKEY = '';
                                var SaltValue;
                                var decrypted;
                                var loginPwd;
                                var SAD;//Start_active_date
                                var EAD;//End_active_date
                                var LstSuccessfulLoogin;
                                var decrptpassword = ''; //reqEncHelper.DecryptPassword(strPwd);





                                Check_LDAP_Config(function (finalcallback) {
                                    try {
                                        userAuthenticationLog(pUser, finalcallback.PROCESS_STATUS, finalcallback.INFO_MESSAGE, function () {
                                            if (finalcallback.STATUS == 'SUCCESS') {
                                                // var temp = JSON.parse(finalcallback.SUCCESS_DATA);
                                                // temp['NEED_ANALYTICS'] = need_analytics;
                                                // finalcallback.SUCCESS_DATA = JSON.stringify(temp);
                                                //appResponse.cookie('authRes', finalcallback.SUCCESS_DATA, { maxAge: 900000, httpOnly: true });


                                                reqInstanceHelper.SendResponse(serviceName, appResponse, finalcallback.SUCCESS_DATA, objLogInfo, '', '', '', finalcallback.PROCESS_STATUS, finalcallback.INFO_MESSAGE);

                                                //Delete the Page load session from redis
                                                if (finalcallback.PROCESS_STATUS == "SUCCESS" && SALTKEY) {
                                                    reqLoginPageHelper.DeleteSaltSession(serviceName, objLogInfo, SALTKEY);
                                                }


                                            } else {
                                                reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, finalcallback.ERROR_CODE, finalcallback.ERROR_MESSAGE, finalcallback.ERROR_OBJECT, finalcallback.INFO_MESSAGE);
                                            }
                                        })
                                    } catch (error) {
                                        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, finalcallback.ERROR_CODE, finalcallback.ERROR_MESSAGE, finalcallback.ERROR_OBJECT, finalcallback.INFO_MESSAGE);

                                    }
                                });

                                // Check ldap config and authenticate user with ldap if ldap auth is enabled
                                function Check_LDAP_Config(finalcallback) {
                                    try {
                                        reqLoginPageHelper.GetLoginConfig(pHeaders, objSessionInfo, objLogInfo, async function (Ldapconfig) {
                                            try {
                                                resultSessionInfo.NEED_LDAP = Ldapconfig.NEED_LDAP_VERIFICATION;
                                                if (Ldapconfig.status) {
                                                    var LdapAuthRes = 'FAILURE';
                                                    decrptpassword = reqEncHelper.DecryptPassword(strPwd);
                                                    if (!Ldapconfig.data.length) {
                                                        Ldapconfig.data = [Ldapconfig.data]
                                                    }
                                                    for (var i = 0; i < Ldapconfig.data.length; i++) {
                                                        var LDAP_URL = "ldap://" + Ldapconfig.data[i].SERVER + ":" + Ldapconfig.data[i].PORT;
                                                        var LDAP_OU = Ldapconfig.data[i].OU;
                                                        var LDAP_LOGIN_ID = Ldapconfig.data[i].LOGIN_ID;
                                                        var LDAP_PASSWORD = Ldapconfig.data[i].PASSWORD;
                                                        var LDAP_FILTER_ATTRIBUTE = Ldapconfig.data[i].FILTER_ATTRIBUTE;

                                                        // initialize ldapClient // todo : hardcoded in LdapConfig.json file
                                                        var ldapClient = ldap.createClient({
                                                            url: LDAP_URL
                                                        });
                                                        var response = await reqLoginPageHelper.LdapAuthentication(strUname, decrptpassword, ldapClient, LDAP_OU, LDAP_LOGIN_ID, LDAP_PASSWORD, LDAP_FILTER_ATTRIBUTE)
                                                        // , function (response) {
                                                        try {
                                                            ldapClient.unbind(function (err) {
                                                                if (err) {
                                                                    finalcallback(err);
                                                                }
                                                            });
                                                            if (response.userstatus === true) {
                                                                LdapAuthRes = "SUCCESS"
                                                                break;
                                                            } else {
                                                                LdapAuthRes == "FAILURE"
                                                            }
                                                        } catch (error) {
                                                            finalcallback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14849', 'GetTableFromFXDB USERS Failed', error));
                                                        }
                                                        // });
                                                    }

                                                    if (LdapAuthRes == "SUCCESS") {
                                                        // call do_login with ldap auth as true
                                                        Do_Login(true, function (res) {
                                                            finalcallback(res);
                                                        });
                                                    } else {
                                                        strResult = 'FAILURE';
                                                        strMessage = 'LDAP Unauthorized';
                                                        // if (response.message.code == '49') { //invalid password
                                                        //     strMessage = 'invalid password'
                                                        // }
                                                        finalcallback(sendMethodResponse("SUCCESS", strMessage, strMessage, '', '', '', 'FAILURE', ''));
                                                    }

                                                } else {
                                                    // call do_login with noraml login 
                                                    Do_Login(false, function (res) {
                                                        finalcallback(res);
                                                    });
                                                }
                                            } catch (error) {
                                                finalcallback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14801', 'GetTableFromFXDB USERS Failed', error));
                                            }
                                        });


                                        // Check for all login verification contexts
                                        function Do_Login(ldap_status, callback) {
                                            try {
                                                reqLoginPageHelper.get_salt_value(SALTKEY, function (res, err) {
                                                    if (NeedCaptcha == "Y" && res.captcha == UserEnteredCaptcha || NeedCaptcha == "N") {
                                                        // res.salt = 'khgjhg';
                                                        if (res.salt || res.strPwd) {
                                                            if (res.salt) {
                                                                SaltValue = res;
                                                            }
                                                            var finalresult = '';
                                                            var usrCol = ['pwd_type', 'created_date', 'pwd_created_date', 'u_id', 'login_password', 'client_id', 'login_name', 'last_name', 'start_active_date', 'end_active_date', 'last_successful_login', 'first_name', 'allocated_ip', 'enforce_change_password', 'account_locked_date', 'double_authentication', 'double_authentication_model', 'need_external_auth', 'has_analytics', 'profile_pic', 'mobile_no', 'email_id', 'status', 'tenant_id'];

                                                            var pcond = {
                                                                'login_name': strUname
                                                            };
                                                            if (strUname.toUpperCase() != "TORUS_ADMIN") {
                                                                pcond.tenant_id = strTenantID;
                                                            }
                                                            DBInstance.GetTableFromFXDB(mCltClient, 'USERS', usrCol,
                                                                pcond, objLogInfo, function callbackseluser(err, result) {
                                                                    if (err) {
                                                                        callback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14812', 'GetTableFromFXDB USERS Failed', err));
                                                                    } else {
                                                                        try {
                                                                            // Check for user found or not
                                                                            if (result.rows.length > 0) {
                                                                                pUser = result.rows[0];
                                                                                loginPwd = result.rows[0].login_password;
                                                                                resultSessionInfo.U_ID = pUser.u_id;
                                                                                resultSessionInfo.CLIENT_ID = pUser.client_id;
                                                                                strClientID = pUser.client_id;
                                                                                resultSessionInfo.LOGIN_NAME = pUser.login_name;
                                                                                resultSessionInfo.FIRST_NAME = pUser.first_name;
                                                                                resultSessionInfo.PROFILE_PIC = pUser.profile_pic;
                                                                                resultSessionInfo.EMAIL_ID = pUser.email_id;
                                                                                resultSessionInfo.MOBILE_NO = pUser.mobile_no;
                                                                                resultSessionInfo.HAS_ANALYTICS = pUser.has_analytics;
                                                                                NeddextrAuth = pUser.need_external_auth;
                                                                                resultSessionInfo.NEED_EXT_AUTH = NeddextrAuth;
                                                                                EmailID = pUser.email_id;
                                                                                strModel = (pUser.double_authentication_model !== null) ? pUser.double_authentication_model.toUpperCase() : "";
                                                                                if (pUser.double_authentication != '') {
                                                                                    resultSessionInfo.NEED_OTP = pUser.double_authentication;
                                                                                }
                                                                                SAD = pUser.start_active_date;
                                                                                EAD = pUser.end_active_date;
                                                                                LstSuccessfulLoogin = pUser.last_successful_login;

                                                                                // check Start acitive and end active date
                                                                                // it shoukd be between the current date
                                                                                // var isAccessibleDate = startEndactiveDatevalidation();
                                                                                // // if (!isAccessibleDate) {
                                                                                // strResult = 'FAILURE';
                                                                                // strMessage = 'User not provision to access this application . Please contact adminstrator';
                                                                                // callback(sendMethodResponse("SUCCESS", '', '', '', '', '', 'FAILURE', 'User not between the start & end active. Please contact adminstrator'));
                                                                                // } else {
                                                                                // Check for allocated ip
                                                                                if (pUser.allocated_ip != '' && pUser.allocated_ip != null && pUser.allocated_ip != strClientIp) {
                                                                                    strResult = 'FAILURE';
                                                                                    strMessage = 'Invalid login Ip';
                                                                                    callback(sendMethodResponse("SUCCESS", '', '', '', '', '', 'FAILURE', 'Invalid login Ip'));
                                                                                } else if (pUser.status == 'ACCOUNT_LOCKED') {
                                                                                    // Check for Account Locked
                                                                                    strResult = 'FAILURE';
                                                                                    strMessage = 'User has been Locked . Please contact adminstrator';
                                                                                    callback(sendMethodResponse("SUCCESS", '', '', '', '', '', 'FAILURE', 'User has been Locked . Please contact adminstrator'));
                                                                                } else if (pUser.status != 'ACTIVE') {
                                                                                    // Invalid user - user not active state
                                                                                    strResult = 'FAILURE';
                                                                                    strMessage = 'Invalid Credentials';
                                                                                    callback(sendMethodResponse("SUCCESS", 'Invalid  Credentials', 'Invalid Credentials', '', '', '', 'FAILURE', 'invalid Credentials'));
                                                                                } else if (ldap_status === false) {
                                                                                    // Check for INVALID PASSWORD
                                                                                    CheckInvalidPassword(pUser, function (result) {
                                                                                        callback(result);
                                                                                    });
                                                                                } else {
                                                                                    _GetClientSetup(pUser, function (result) {
                                                                                        callback(result);
                                                                                    });
                                                                                }
                                                                                // }
                                                                            } else {
                                                                                // Invalid user
                                                                                strResult = 'FAILURE';
                                                                                strMessage = 'Invalid Credentials';
                                                                                callback(sendMethodResponse("SUCCESS", 'Invalid  Credentials', 'Invalid Credentials', '', '', '', 'FAILURE', 'invalid Credentials'));
                                                                            }

                                                                        } catch (error) {
                                                                            callback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14817', 'Exception Occured while executing GetTableFromFXDB USERS callback function ', error));
                                                                        }
                                                                    }
                                                                });
                                                        } else {
                                                            callback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14853', 'Exception Occured while Get the salt value', 'Please Reload the page & try again'));
                                                        }
                                                    } else {
                                                        callback(sendMethodResponse('SUCCESS', 'Invalid Captcha', 'Invalid Captcha', '', '', '', 'FAILURE', 'Invalid Captcha'));
                                                    }
                                                });
                                                // Get user detail

                                            } catch (error) {
                                                callback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14818', 'Exception Occured while executing Do_Login function ', error));
                                            }
                                        }

                                        function startEndactiveDatevalidation() {
                                            try {
                                                var blnisactive = false;
                                                // var momentPwdCreateTime = reqMoment(pUser.pwd_created_date);
                                                // var tenantCurrentDate = reqDateFormater.GetTenantCurrentDate(pHeaders, objLogInfo).split(" 12.00.00.000000 PM")[0];//reqMoment(reqDateFormater.GetTenantCurrentDateTime(pHeaders, objLogInfo));
                                                var tenantCurrentDate = new Date(reqDateFormater.GetTenantCurrentDateTimeWithoutformat(pHeaders, objLogInfo));
                                                var curntFormatedDate = `${tenantCurrentDate.getUTCFullYear()}-${tenantCurrentDate.getMonth() + 1}-${tenantCurrentDate.getDate()}`;
                                                // MomentSAD.isAfter(currrentmomentDate);
                                                // var diffMins = currrentmomentDate.diff(momentPwdCreateTime, 'minutes');

                                                if (SAD && EAD) {
                                                    // var formatedSad = reqDateFormater.GetDateAt12AM(pHeaders, objLogInfo, SAD).split(" 12.00.00.000000 AM")[0];
                                                    // var fromatedEad = reqDateFormater.GetDateAt12AM(pHeaders, objLogInfo, EAD).split(" 12.00.00.000000 AM")[0];
                                                    var formatedSad = `${SAD.getUTCFullYear()}-${SAD.getMonth() + 1}-${SAD.getDate()}`;
                                                    var fromatedEad = `${EAD.getUTCFullYear()}-${EAD.getMonth() + 1}-${EAD.getDate()}`;

                                                    // if (reqDateFormater.GetDateAt12AM(pHeaders, objLogInfo, SAD) <= reqDateFormater.GetTenantCurrentDate(pHeaders, objLogInfo) && reqDateFormater.GetDateAt12AM(pHeaders, objLogInfo, EAD) >= reqDateFormater.GetTenantCurrentDate(pHeaders, objLogInfo)) {
                                                    // var tenantCurrentDate = reqDateFormater.GetTenantCurrentDate(pHeaders, objLogInfo).split(" 12.00.00.000000 AM")[0];//reqMoment(reqDateFormater.GetTenantCurrentDateTime(pHeaders, objLogInfo));
                                                    if (new Date(formatedSad) <= new Date(curntFormatedDate) && new Date(fromatedEad) >= new Date(curntFormatedDate)) {

                                                        blnisactive = true;
                                                    }
                                                } else if (SAD && !EAD) {
                                                    // if (reqDateFormater.GetDateAt12AM(pHeaders, objLogInfo, SAD) <= reqDateFormater.GetTenantCurrentDate(pHeaders, objLogInfo)) {
                                                    // var formatedSad = reqDateFormater.GetDateAt12AM(pHeaders, objLogInfo, SAD).split(" 12.00.00.000000 AM")[0];
                                                    var formatedSad = `${SAD.getUTCFullYear()}-${SAD.getMonth() + 1}-${SAD.getDate()}`;
                                                    if (new Date(formatedSad) <= new Date(tenantCurrentDate)) {
                                                        blnisactive = true;
                                                    }
                                                } else if (!SAD && EAD) {
                                                    // if (reqDateFormater.GetDateAt12AM(pHeaders, objLogInfo, EAD) >= reqDateFormater.GetTenantCurrentDate(pHeaders, objLogInfo)) {
                                                    // var fromatedEad = reqDateFormater.GetDateAt12AM(pHeaders, objLogInfo, EAD).split(" 12.00.00.000000 AM")[0];
                                                    var fromatedEad = `${EAD.getUTCFullYear()}-${EAD.getMonth() + 1}-${EAD.getDate()}`;
                                                    if (new Date(fromatedEad) >= new Date(tenantCurrentDate)) {
                                                        blnisactive = true;
                                                    }
                                                } else if (!SAD || !EAD) {
                                                    blnisactive = true;
                                                }
                                                return blnisactive;
                                            } catch (error) {
                                                console.log(error);
                                            }
                                        }

                                        // Check for Invalid password and update last_unsuccessful_login
                                        async function CheckInvalidPassword(pUser, callbackInvalidpwd) {
                                            try {
                                                reqInstanceHelper.PrintInfo(serviceName, 'CheckInvalidPassword Function executing...', objLogInfo);
                                                //Hash the saved password
                                                var encryptedPwd;
                                                if (SALTKEY && SaltValue.salt) {
                                                    encryptedPwd = reqEncHelper.passwordHash256Withsalt(loginPwd, SaltValue.salt);
                                                } else {
                                                    strPwd = reqEncHelper.EncryptPassword(decrypted);
                                                    encryptedPwd = pUser.login_password;
                                                }
                                                if (encryptedPwd != strPwd) {
                                                    // if (pUser.login_password != reqEncHelper.EncryptPassword(decrypted)) {
                                                    // DBInstance.UpdateFXDB(mCltClient, 'USERS', {
                                                    //     'last_unsuccessful_login': reqDateFormater.GetTenantCurrentDateTime(pHeaders, objLogInfo)
                                                    // }, {
                                                    //     'u_id': pUser.u_id,
                                                    //     'client_id': pUser.client_id,
                                                    //     'login_name': pUser.login_name
                                                    // }, objLogInfo, function callbackupdate(err) {
                                                    try {
                                                        // if (err) {
                                                        //     callbackInvalidpwd(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14845', 'Error Occured while Update users table Last Unsuccessfull_login ', err));
                                                        // } else {
                                                        strResult = 'FAILURE';
                                                        strMessage = 'Invalid Credentials.';
                                                        _GetCltSetupForIVP(pUser, function (IVPResult) {
                                                            callbackInvalidpwd(IVPResult);
                                                        });
                                                        // }
                                                    } catch (error) {
                                                        callbackInvalidpwd(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14846', 'Exception Occured Occured while Update users table Last Unsuccessfull_login ', error));
                                                    }
                                                    // });

                                                } else {
                                                    //Force Logout and clear the sessions in signin screen 
                                                    await RedisSession.DEL('LOGIN_ATTEMPT~' + pUser.login_name);
                                                    if (FORCE_LOGOUT === 'Y') {
                                                        var param = {
                                                            U_ID: pUser.u_id,
                                                            SESSION_ID: appRequest.headers['session-id'],
                                                            LOGINIP: appRequest.body.PARAMS.pLoginIP,
                                                            NeedextrAuth: NeddextrAuth,
                                                            Logout_Mode: "SELF",
                                                            loginName: pUser.login_name
                                                        }
                                                        reqsvchelper.ReleaseTranLocks(pHeaders, mCltClient, param, appRequest, appResponse, objLogInfo, function (res) {
                                                            reqInstanceHelper.PrintInfo(serviceName, 'Session cleared successfully in self login ', objLogInfo);
                                                            _GetClientSetup(pUser, function (res) {
                                                                callbackInvalidpwd(res);
                                                            });
                                                        })
                                                    } else {
                                                        reqInstanceHelper.PrintInfo(serviceName, 'Password verified ', objLogInfo);
                                                        _GetClientSetup(pUser, function (res) {
                                                            callbackInvalidpwd(res);
                                                        });
                                                    }

                                                }
                                            } catch (error) {
                                                callbackInvalidpwd(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14819', 'Exception Occured while executing CheckInvalidPassword function ', error));
                                            }
                                        }

                                        // Prepare tenant setup
                                        function _GetClientSetup(pUser, Callbackclinetsetup) {
                                            try {
                                                reqInstanceHelper.PrintInfo(serviceName, '_GetClientSetup function executing..', objLogInfo);
                                                if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
                                                    var cond = {};
                                                    cond.setup_code = ['AUTHENTICATION', 'PASSWORD_POLICY', 'SMS_SETUP', 'MAIL_SETUP', 'ATMT_VWR_TYPE', 'CHT_USR_ORG_PWD', 'CONTROL_FORMAT', 'ENABLE_JWT', 'CURRENT_JWT', 'ENABLE_CHAT', 'SYSTEM SELECTON', 'ACCUSOFT', 'TIMEZONE'];
                                                    cond.TenatId = strTenantID;
                                                    reqsvchelper.GetSetupJson(pClient, cond, objLogInfo, function (res) {
                                                        if (res.Status == 'SUCCESS' && res.Data.length) {
                                                            var cltresult = {
                                                                rows: []
                                                            };
                                                            for (var h = 0; h < res.Data.length; h++) {
                                                                cltresult.rows.push(res.Data[h]);
                                                            }
                                                            CltSetup = cltresult;
                                                            reqInstanceHelper.PrintInfo(serviceName, 'Got tenant_setup result and check is user login first time ');

                                                            const tzDetails = CltSetup.rows.filter(row => row.category === 'TIMEZONE');
                                                            if (tzDetails) {
                                                                objLogInfo.TIMEZONE_INFO = JSON.parse(tzDetails[0].setup_json);
                                                                resultSessionInfo.TIMEZONE_INFO = JSON.parse(tzDetails[0].setup_json);
                                                            } else {
                                                                Callbackclinetsetup(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14955', 'setup json not found', 'TIMEZONE'));
                                                            }

                                                            var isAccessibleDate = startEndactiveDatevalidation();
                                                            if (!isAccessibleDate) {
                                                                strResult = 'FAILURE';
                                                                strMessage = 'User account is expired. Please contact adminstrator';
                                                                Callbackclinetsetup(sendMethodResponse("SUCCESS", '', '', '', '', '', 'FAILURE', 'User account is expired.Please contact System Administrator'));
                                                            } else {
                                                                CheckFirstTimeLogin(pUser, function (res) {
                                                                    Callbackclinetsetup(res);
                                                                });
                                                            }
                                                        } else {
                                                            return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, res.ErrorCode, res.ErrorMsg, res.Error, 'FAILURE');
                                                        }
                                                    });
                                                } else {
                                                    DBInstance.GetTableFromFXDB(mCltClient, 'tenant_setup', [], {
                                                        'tenant_id': strTenantID,
                                                        'client_id': strClientID
                                                    }, objLogInfo, function callbackcltsetup(err, cltresult) {
                                                        try {
                                                            if (err)
                                                                Callbackclinetsetup(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14820', 'GetTableFromFXDB USERS Failed', err));
                                                            else {
                                                                if (!err && cltresult.rows.length > 0) {
                                                                    CltSetup = cltresult;
                                                                    reqInstanceHelper.PrintInfo(serviceName, 'Got tenant_setup result and check is user login first time ');
                                                                    CheckFirstTimeLogin(pUser, function (res) {
                                                                        Callbackclinetsetup(res);
                                                                    });
                                                                } else {
                                                                    strResult = 'FAILURE';
                                                                    strMessage = 'Tenant Setup Not Found';
                                                                    Callbackclinetsetup(sendMethodResponse("SUCCESS", '', '', '', '', '', strResult, strMessage));
                                                                }
                                                            }
                                                        } catch (error) {
                                                            Callbackclinetsetup(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14821', 'Exception Occured while executing GetTableFromFXDB tenant_setup Failed', error));
                                                        }
                                                    });

                                                }
                                            } catch (error) {
                                                Callbackclinetsetup(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14822', 'Exception Occured while executing  _GetClientSetup	 function', error));
                                            }
                                        }

                                        // Lock the user account if feature enabled in tenant_setup
                                        function _GetCltSetupForIVP(pUser, callbackIVPwd) {
                                            try {

                                                if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
                                                    var cond = {};
                                                    cond.setup_code = ['AUTHENTICATION', 'TIMEZONE'];
                                                    cond.TenatId = strTenantID;
                                                    reqsvchelper.GetSetupJson(pClient, cond, objLogInfo, function (res) {
                                                        if (res.Status == 'SUCCESS' && res.Data.length) {
                                                            aftergetsetupJson(res.Data);
                                                        } else {
                                                            return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, res.ErrorCode, res.ErrorMsg, res.Error);
                                                        }
                                                    });
                                                } else {
                                                    DBInstance.GetTableFromFXDB(mCltClient, 'tenant_setup', [], {
                                                        'tenant_id': strTenantID,
                                                        'client_id': strClientID,
                                                        'category': ['AUTHENTICATION', 'TIME_ZONE']
                                                    }, objLogInfo,
                                                        function callbackcltsetup(err, cltresult) {
                                                            try {
                                                                if (err)
                                                                    callbackIVPwd(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14601', 'GetTableFromFXDB USERS Failed', err));
                                                                else {
                                                                    if (!err && cltresult.rows.length > 0) {
                                                                        aftergetsetupJson(cltresult.rows);
                                                                    }
                                                                }
                                                            } catch (error) {

                                                            }
                                                        });
                                                }

                                                function aftergetsetupJson(authSetup) {
                                                    try {
                                                        // CltSetup = cltresult;

                                                        const tzDetails = authSetup.filter(row => row.category === 'TIMEZONE');
                                                        if (tzDetails) {
                                                            objLogInfo.TIMEZONE_INFO = JSON.parse(tzDetails[0].setup_json);
                                                        } else {
                                                            callbackIVPwd(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14955', 'setup json not found', 'TIMEZONE'));
                                                        }
                                                        const authtntsetup = authSetup.filter(row => row.category === 'AUTHENTICATION');
                                                        if (authtntsetup.length) {
                                                            PrepareAuthenticationSetup(authtntsetup[0], async function (res) {
                                                                //LOGIN TRY COUNT
                                                                var UserRedKey = 'LOGIN_ATTEMPT~' + pUser.login_name
                                                                var Redlogintrycnt = await RedisSession.get(UserRedKey);
                                                                if (Redlogintrycnt) {
                                                                    logintrycnt = JSON.parse(Redlogintrycnt).attempt_count
                                                                } else {
                                                                    logintrycnt = 0
                                                                }
                                                                var logtrycnt = logintrycnt + 1;

                                                                var atmtCount = JSON.stringify({
                                                                    attempt_count: logintrycnt + 1

                                                                })
                                                                if (intlogintrycount <= logtrycnt) {
                                                                    await RedisSession.DEL(UserRedKey);
                                                                    strResult = 'FAILURE';
                                                                    strMessage = 'User has been Locked . Please contact adminstrator';
                                                                    DBInstance.UpdateFXDB(mCltClient, 'users', {
                                                                        'account_locked_date': reqDateFormater.GetTenantCurrentDateTime(pHeaders, objLogInfo),
                                                                        'status': 'ACCOUNT_LOCKED',
                                                                        'remarks': 'Account locked due to too many failed login attempts.'
                                                                    }, {
                                                                        'u_id': pUser.u_id,
                                                                        'client_id': pUser.client_id,
                                                                        'login_name': pUser.login_name
                                                                    }, objLogInfo, function callbackuserlockupd(err) {
                                                                        try {
                                                                            if (!err)
                                                                                callbackIVPwd(sendMethodResponse("SUCCESS", '', '', '', '', '', 'FAILURE', 'User has been Locked . Please contact adminstrator'));
                                                                            else {
                                                                                callbackIVPwd(sendMethodResponse('FAILURE', '', '', 'ERR-AUT-14844', 'Error While Lock the user', err));
                                                                            }
                                                                        } catch (error) {
                                                                            callbackIVPwd(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14822', 'Exception Occured while executing  _GetClientSetup function ', error));
                                                                        }
                                                                    });
                                                                } else {
                                                                    await RedisSession.SETEX(UserRedKey, res.LOGIN_ATTEMPT_WINDOW_TIME, atmtCount)
                                                                    DBInstance.UpdateFXDB(mCltClient, 'USERS', {
                                                                        'last_unsuccessful_login': reqDateFormater.GetTenantCurrentDateTime(pHeaders, objLogInfo)
                                                                    }, {
                                                                        'u_id': pUser.u_id,
                                                                        'client_id': pUser.client_id,
                                                                        'login_name': pUser.login_name
                                                                    }, objLogInfo, function callbackupdate(err) {
                                                                        if (err) {
                                                                        } else {
                                                                            callbackIVPwd(sendMethodResponse('SUCCESS', 'Invalid Credentials', `Invalid Credentials. You have ${intlogintrycount - (logintrycnt + 1)} attempt(s) left.`, '', '', '', 'FAILURE', 'InValid Credentials'));
                                                                        }
                                                                    });
                                                                }
                                                            });
                                                        } else {
                                                            callbackIVPwd(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14955', 'setup json not found', 'AUTHENTICATION'));
                                                        }
                                                    } catch (error) {
                                                        callbackIVPwd(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14843', 'Exception Occured while executing  _GetClientSetup	 function', error));
                                                    }
                                                }

                                            } catch (error) {
                                                callbackIVPwd(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14844', 'Exception Occured while executing  _GetClientSetup	 function', error));
                                            }
                                        }

                                        // Prepare authentication setup json object
                                        function PrepareAuthenticationSetup(authSetup, callbackAuthsetup) {
                                            try {
                                                var clientRow = authSetup;
                                                var setupjson = clientRow.setup_json;
                                                var parsedObj = JSON.parse(setupjson);
                                                intlogintrycount = parsedObj.LOGIN_TRY_COUNT;
                                                pswdexpalertdays = parsedObj.PWD_EXPIRY_ALERT_DAYS;
                                                pswdexpirationdays = parsedObj.PWD_EXPIRATION_DAYS;
                                                JWTExpire = parsedObj.JWT_TIMEOUT;
                                                ServerExpire = parsedObj.SERVER_TIMEOUT;

                                                //Need_Analytics = parsedObj.NEED_ANALYTICS;
                                                NEED_DUPLICATE_LOGIN_CHECK = parsedObj.NEED_DUPLICATE_LOGIN_CHECK;

                                                tmpPwdExpiredTime = parseInt(parsedObj.TMP_PWD_EXPIRE_TIME_MINS);
                                                MaxInactivedays = parseInt(parsedObj.MAX_INACTIVE_DAYS);
                                                if (setupjson != null) {
                                                    resultSessionInfo.SYSTEM_DISPLAY = parsedObj.SYSTEM_DISPLAY == 'SYSTEM_CODE' ? 'S_CODE' : 'S_DESC';
                                                    resultSessionInfo.USER_NAME_DISPLAY = parsedObj.USER_NAME_DISPLAY;
                                                } else {
                                                    resultSessionInfo.SYSTEM_DISPLAY = 'S_DESC';
                                                    resultSessionInfo.USER_NAME_DISPLAY = 'LOGIN_NAME';
                                                }

                                                // if (parsedObj.NEED_ANALYTICS != null) {
                                                //     resultSessionInfo.NEED_ANALYTICS = parsedObj.NEED_ANALYTICS;
                                                // }

                                                if (parsedObj.SESSION_TIMEOUT != null) {
                                                    CL_STP_SESSION_TIMEOUT = parsedObj.SESSION_TIMEOUT;
                                                }
                                                if (parsedObj.SESSION_LOGOUT_TIMEOUT != null) {
                                                    resultSessionInfo.SESSION_LOGOUT_TIMEOUT = parsedObj.SESSION_LOGOUT_TIMEOUT;
                                                }
                                                if (parsedObj.NEED_SYSTEM_SELECTION_EXPANDED != null) {
                                                    resultSessionInfo.NEED_SYSTEM_SELECTION_EXPANDED = parsedObj.NEED_SYSTEM_SELECTION_EXPANDED;
                                                }
                                                if (parsedObj.RECORDS_PER_PAGE != null) {
                                                    resultSessionInfo.RECORDS_PER_PAGE = parsedObj.RECORDS_PER_PAGE;
                                                }
                                                // resultSessionInfo.KEYGEN = strSessionId;
                                                var token = reqJWT.sign({
                                                    login_name: strUname
                                                }, rediskey, {
                                                    expiresIn: JWTExpire
                                                });
                                                resultSessionInfo.SESSION_ID = token; //for handleing old pack not to distrub
                                                resultSessionInfo.LOGIN_ATTEMPT_WINDOW_TIME = parsedObj.LOGIN_ATTEMPT_WINDOW_TIME || 600;

                                                rediskey = 'SESSIONID-' + token;
                                                // strSessionId = token;
                                                // resultSessionInfo.Token = token;
                                                callbackAuthsetup(resultSessionInfo);
                                            } catch (error) {
                                                callbackAuthsetup(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14823', 'Exception Occured while executing PrepareAuthenticationSetup function', error));
                                            }
                                        }

                                        // Get the password policy
                                        function _GetPasswordPolicy(pCltSetup, callbackPwdPolicy) {
                                            try {
                                                var passpolicy = new reqLINQ(pCltSetup.rows)
                                                    .Where(function (item) {
                                                        return item.category === "PASSWORD_POLICY";
                                                    }).ToArray();
                                                resultSessionInfo.PASSWORD_POLICY = passpolicy[0].setup_json;
                                                callbackPwdPolicy(resultSessionInfo);
                                            } catch (error) {
                                                callbackPwdPolicy(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14824', 'Exception Occured while executing _GetPasswordPolicy function', error));
                                            }
                                        }
                                        // Check for FIRST TIME LOGIN
                                        function CheckFirstTimeLogin(pUser, callbackfirsttimelogin) {
                                            try {
                                                // cltresult = CltSetup;
                                                var authSetup = new reqLINQ(CltSetup.rows)
                                                    .Where(function (item) {
                                                        return item.category === "AUTHENTICATION";
                                                    }).ToArray();

                                                function firsttimeLogin() {
                                                    DBInstance.GetTableFromFXDB(mCltClient, 'user_password_log', [], {
                                                        'u_id': pUser.u_id
                                                    }, objLogInfo, function callbackflogin(err, pwglogresult) {
                                                        try {
                                                            if (err)
                                                                callbackfirsttimelogin(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14825', 'GetTableFromFXDB USERS Failed', err));
                                                            else {
                                                                if (pwglogresult.rows.length <= 1 && pUser.enforce_change_password == 'Y') {
                                                                    reqInstanceHelper.PrintInfo(serviceName, 'User first-time login,need to change password, Executing function to get PWD Policy', objLogInfo);
                                                                    strResult = 'FIRST_TIME_LOGIN';
                                                                    strMessage = 'User first-time login. Please change your password';
                                                                    _GetPasswordPolicy(CltSetup, function (res) {
                                                                        callbackfirsttimelogin(sendMethodResponse("SUCCESS", '', '', '', '', '', 'FAILURE', 'User first-time login. Please change your password'));
                                                                    });
                                                                } else if (pUser.pwd_type == 'TEMP') {
                                                                    reqInstanceHelper.PrintInfo(serviceName, 'User login using temporary password,need to change password, Executing function to get PWD Policy', objLogInfo);
                                                                    strResult = 'FIRST_TIME_LOGIN';
                                                                    strMessage = 'User login using temporary password. Please change your password';
                                                                    _GetPasswordPolicy(CltSetup, function (res) {
                                                                        callbackfirsttimelogin(sendMethodResponse("SUCCESS", '', '', '', '', '', 'FAILURE', 'User login using temporary password. Please change your password'));
                                                                    });
                                                                } else {
                                                                    reqInstanceHelper.PrintInfo(serviceName, 'User not first time login, executing alredy logged in from any other system', objLogInfo);
                                                                    CheckAlreadyLoggedIn(pUser, pwglogresult, function (res) {
                                                                        callbackfirsttimelogin(res);
                                                                    });
                                                                }
                                                            }
                                                        } catch (error) {
                                                            callbackfirsttimelogin(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14826', 'Exception Occured while executing callbackflogin function', error));
                                                        }
                                                    });
                                                }

                                                function checkTempPwdExpired() {
                                                    var momentPwdCreateTime = reqMoment(pUser.pwd_created_date).add(new Date().getTimezoneOffset(), "minutes");
                                                    var timezoneDiff = new Date().getTimezoneOffset() + parseInt(objLogInfo.TIMEZONE_INFO.timezone_offset);
                                                    // Moment with tenant timeone  gives like server timezone, so get the difference from server offset and add to current tenant moment 
                                                    var currrentmomentDate = reqMoment(reqDateFormater.GetTenantCurrentDateTimeWithoutformat(pHeaders, objLogInfo)).add(timezoneDiff, "minutes");
                                                    var diffMins = currrentmomentDate.diff(momentPwdCreateTime, 'minutes');
                                                    reqInstanceHelper.PrintInfo(serviceName, 'Password created Date time |' + momentPwdCreateTime._d);
                                                    reqInstanceHelper.PrintInfo(serviceName, 'Current Tenant date time | ' + currrentmomentDate._d);
                                                    reqInstanceHelper.PrintInfo(serviceName, 'Differents in Mints | ' + diffMins);
                                                    if (tmpPwdExpiredTime < diffMins) {
                                                        reqInstanceHelper.PrintInfo(serviceName, 'TEMP password is expired');
                                                        strResult = 'FAILURE';
                                                        strMessage = 'Your Temporary password is expired. Please contact adminstrator.';
                                                        // callback(sendMethodResponse("SUCCESS", '', '', '', '', '', 'FAILURE', 'User is inactive more than specified days . Please contact adminstrator'));

                                                        DBInstance.UpdateFXDB(mCltClient, 'users', {
                                                            'account_locked_date': reqDateFormater.GetTenantCurrentDateTime(pHeaders, objLogInfo),
                                                            'status': 'TMP_PWD_EXPIRED',
                                                            'remarks': 'Temp Password Expired'
                                                        }, {
                                                            'u_id': pUser.u_id,
                                                            'client_id': pUser.client_id,
                                                            'login_name': pUser.login_name
                                                        }, objLogInfo, function callbackuserlockupd(err) {
                                                            try {
                                                                if (!err) {
                                                                    return callbackfirsttimelogin(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14875', ' Temporary password is expired.Pls Contact administrator', ''));
                                                                } else {
                                                                    return callbackfirsttimelogin(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14855', 'Error occured', err, 'FAILURE', 'Error occured while lock the user'));
                                                                }
                                                            } catch (error) {
                                                                return callbackfirsttimelogin(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14854', 'Exception occured while lock the account', error, 'FAILURE', 'Exception Occured '));
                                                            }
                                                        });
                                                    } else {
                                                        firsttimeLogin();
                                                    }
                                                }

                                                PrepareAuthenticationSetup(authSetup[0], function (res) {


                                                    if (pUser.pwd_type == 'TEMP') {
                                                        // var tmpPwdExpTime = tmpPwdExpiredTime;
                                                        checkTempPwdExpired();
                                                    }
                                                    else {
                                                        firsttimeLogin();
                                                    }




                                                });

                                            } catch (error) {
                                                callbackfirsttimelogin(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14827', 'Exception Occured while executing CheckFirstTimeLogin function', error));
                                            }
                                        }


                                        // Check for Already Logged In
                                        function CheckAlreadyLoggedIn(pUser, pwdlogresult, callbackalreadyloggedin) {
                                            try {
                                                //ALREADY LOGGED IN
                                                cltresult = CltSetup;
                                                if (cltresult.rows.length > 0) {
                                                    var authSetup = new reqLINQ(cltresult.rows)
                                                        .Where(function (item) {
                                                            return item.category === "AUTHENTICATION";
                                                        }).ToArray();

                                                    OTP_SMS_TEMPLATE = new reqLINQ(cltresult.rows)
                                                        .Where(function (item) {
                                                            return item.category === "SMS_SETUP";
                                                        }).ToArray();
                                                    OTP_MAIL_TEMPLATE = new reqLINQ(cltresult.rows)
                                                        .Where(function (item) {
                                                            return item.category === "MAIL_SETUP";
                                                        }).ToArray();

                                                    if (authSetup.length > 0) {
                                                        PrepareAuthenticationSetup(authSetup[0], function (res) {
                                                            if (res.STATUS == 'FAILURE') {
                                                                callbackalreadyloggedin(res);
                                                            } else {
                                                                if (userInactiveValidation()) {
                                                                    // Check inactiveuser

                                                                    strResult = 'FAILURE';
                                                                    strMessage = 'User is inactive more than specified days';
                                                                    // callback(sendMethodResponse("SUCCESS", '', '', '', '', '', 'FAILURE', 'User is inactive more than specified days . Please contact adminstrator'));

                                                                    DBInstance.UpdateFXDB(mCltClient, 'users', {
                                                                        'account_locked_date': reqDateFormater.GetTenantCurrentDateTime(pHeaders, objLogInfo),
                                                                        'status': 'ACCOUNT_LOCKED',
                                                                        // 'remarks': 'Account is locked due to user inactive more than the specified days'
                                                                        'remarks': 'Account is locked due to user inactivity reason'
                                                                    }, {
                                                                        'u_id': pUser.u_id,
                                                                        'client_id': pUser.client_id,
                                                                        'login_name': pUser.login_name
                                                                    }, objLogInfo, function callbackuserlockupd(err) {
                                                                        try {
                                                                            if (!err)
                                                                                return callbackalreadyloggedin(sendMethodResponse("SUCCESS", '', '', 'ERR-AUT-14856', '', '', 'FAILURE', 'You are not allowed to login to the system due to inactivity reason. Please contact adminstrator'));
                                                                            else {
                                                                                return callbackalreadyloggedin(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14855', 'Error occured', err, 'FAILURE', 'Error occured while lock the user'));
                                                                            }
                                                                        } catch (error) {
                                                                            return callbackalreadyloggedin(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14854', 'Exception occured while lock the account', error, 'FAILURE', 'Exception Occured '));
                                                                        }
                                                                    });

                                                                } else {
                                                                    if (NEED_DUPLICATE_LOGIN_CHECK == 'Y') {
                                                                        reqInstanceHelper.PrintInfo(serviceName, 'NEED_DUPLICATE_LOGIN_CHECK param is True, Executing GetTableFromFXDB user_sessions table');
                                                                        DBInstance.GetTableFromFXDB(mCltClient, 'user_sessions', ['u_id', 'login_ip', 'session_id'], {
                                                                            'u_id': pUser.u_id
                                                                        }, objLogInfo, function (err, result) {
                                                                            try {
                                                                                if (err)
                                                                                    callbackalreadyloggedin(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14828', 'GetTableFromFXDB USERS Failed', err));
                                                                                else {
                                                                                    //Ip comparison removed
                                                                                    // var Dublicateip = new reqLINQ(result.rows)
                                                                                    //     .Where(function (item) {
                                                                                    //         return item.login_ip === strClientIp;
                                                                                    //     }).ToArray();
                                                                                    if (result.rows.length > 0) {
                                                                                        reqInstanceHelper.PrintInfo(serviceName, 'User Already Logged in from another system', objLogInfo);
                                                                                        strResult = 'ALREADY LOGGEDIN';
                                                                                        var resultobj = {
                                                                                            SESSION_ID: result.rows[0].session_id,
                                                                                            message: 'User has already logged in from another system'
                                                                                        };
                                                                                        strMessage = 'User has already logged in from another system';
                                                                                        callbackalreadyloggedin(sendMethodResponse("SUCCESS", '', resultobj, '', '', 'FAILURE', 'FAILURE', 'User has already logged in from another system '));
                                                                                    } else {
                                                                                        pwdexpirationcheck(pwdlogresult, function (res) {
                                                                                            callbackalreadyloggedin(res);
                                                                                        });
                                                                                    }
                                                                                }
                                                                            } catch (error) {
                                                                                callbackalreadyloggedin(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14830', 'Exception Occured while executing GetTableFromFxDb user_sessions callback function ', error));
                                                                            }

                                                                        });
                                                                    } else {
                                                                        pwdexpirationcheck(pwdlogresult, function (res) {
                                                                            callbackalreadyloggedin(res);
                                                                        });
                                                                    }
                                                                }

                                                            }
                                                        });
                                                    } else {
                                                        strResult = 'FAILURE';
                                                        strMessage = 'Tenant setup missing';
                                                        callbackalreadyloggedin(sendMethodResponse("SUCCESS", '', '', "ERR-AUT-14855", strResult, '', strResult, strMessage));

                                                    }
                                                    function userInactiveValidation() {
                                                        try {
                                                            if (LstSuccessfulLoogin) {
                                                                var LastLogindate = reqMoment(LstSuccessfulLoogin);
                                                                var currentDate = reqMoment(new Date());
                                                                var diffDays = currentDate.diff(LastLogindate, 'days');
                                                                if (diffDays > MaxInactivedays) {
                                                                    //user is inactive more than specified date. 
                                                                    return true;
                                                                } else {
                                                                    return false;
                                                                }
                                                            } else {
                                                                var UserCreatedDate = reqMoment(pUser.created_date);
                                                                var currentDate = reqMoment(new Date());
                                                                var diffDays = currentDate.diff(UserCreatedDate, 'days');
                                                                if (diffDays > MaxInactivedays) {
                                                                    //user is inactive more than specified date. 
                                                                    return true;
                                                                } else {
                                                                    return false;
                                                                }
                                                            }
                                                        } catch (error) {
                                                            console.log(error);
                                                        }
                                                    }
                                                }
                                            } catch (error) {
                                                callbackalreadyloggedin(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14832', 'Exception Occured while executing CheckAlreadyLoggedIn function', error));
                                            }
                                        }

                                        // Check for Password expiration
                                        function pwdexpirationcheck(pwdlogresult, callback) {
                                            try {
                                                if (resultSessionInfo.NEED_LDAP == 'N') {
                                                    IsPasswordExpired(pwdlogresult, function (blnExpired) {
                                                        if (blnExpired) {
                                                            reqInstanceHelper.PrintInfo(objLogInfo, 'User password expired ', objLogInfo);
                                                            // Do Check Password Expiration
                                                            _GetPasswordPolicy(CltSetup, function (res) {
                                                                strResult = 'FAILURE';
                                                                strMessage = 'User password expired. Please change your password';
                                                                callback(sendMethodResponse("SUCCESS", '', '', '', '', '', 'FAILURE', 'User password expired. Please change your password'));
                                                            });
                                                        } else {
                                                            // //Success callback
                                                            SuccessCallback(cltresult, pUser, function (result) {
                                                                callback(result);
                                                            });
                                                        }
                                                    });
                                                } else {
                                                    SuccessCallback(cltresult, pUser, function (result) {
                                                        callback(result);
                                                    });
                                                }
                                            } catch (error) {
                                                callback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14834', 'Exception Occured while executing pwdexpirationcheck function ', error));
                                            }

                                        }

                                        // do check the password has been expired
                                        function IsPasswordExpired(pResPwdLog, callbackpwdexpired) {
                                            try {
                                                var blnExpired = false;
                                                if (pResPwdLog.rows.length > 0) {
                                                    var arrPwdLog = new reqLINQ(pResPwdLog.rows)
                                                        .OrderByDescending(function (pLog) {
                                                            return pLog.created_date;
                                                        })
                                                        .ToArray();
                                                    if (arrPwdLog.length > 0) {
                                                        var dtCreateDate = arrPwdLog[0].created_date;
                                                        var dtCurrentDate = new Date(); //reqDateFormater.GetTenantCurrentDateTime(pHeaders, objLogInfo);
                                                        // var tsDiff = reqTimeSpan.fromDates(dtCurrentDate, dtCreateDate, true);
                                                        var DiffDays = reqMoment(dtCurrentDate).diff(reqMoment(dtCreateDate), 'days');

                                                        // If PWD_EXPIRATION_DAYS is Zero , Password is never going to expire
                                                        blnExpired = (pswdexpirationdays == 0) ? false : (DiffDays > pswdexpirationdays);

                                                    }
                                                }
                                                callbackpwdexpired(blnExpired);
                                            } catch (error) {
                                                finalcallback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14835', 'GetTableFromFXDB USERS Failed', error));
                                            }
                                        }


                                        // Assign session info values for success case
                                        function SuccessCallback(rowsCltSetUp, pUser, callbacksuccess) {
                                            try {
                                                reqInstanceHelper.PrintInfo(serviceName, 'SuccessCallback function executing ... ', objLogInfo);
                                                strResult = 'SUCCESS';
                                                strMessage = 'SUCCESS';
                                                resultSessionInfo.RESULT_FLAG = 'Y';
                                                resultSessionInfo.USER_NAME = pUser.first_name;
                                                resultSessionInfo.U_ID = pUser.u_id;
                                                resultSessionInfo.LOGIN_NAME = pUser.login_name;
                                                resultSessionInfo.FIRST_NAME = pUser.first_name;
                                                resultSessionInfo.LAST_NAME = pUser.last_name;
                                                resultSessionInfo.PROFILE_PIC = pUser.profile_pic;
                                                // resultSessionInfo.JWT_SECRET_KEY = strSessionId;
                                                resultSessionInfo.TENANT_ID = strTenantID;
                                                resultSessionInfo.LAST_SUCCESSFULL_LOGIN = pUser.last_successful_login;
                                                // var tzInfo = rowsCltSetUp.rows.filter((pdataRow) => {
                                                //     return pdataRow.category == 'TIMEZONE';
                                                // });
                                                // resultSessionInfo.TIMEZONE_INFO = JSON.parse(tzInfo[0].setup_json);
                                                if (CL_STP_SESSION_TIMEOUT != 0)
                                                    resultSessionInfo.SESSION_TIMEOUT = CL_STP_SESSION_TIMEOUT;
                                                else if (pUser.session_timeout != null)
                                                    resultSessionInfo.SESSION_TIMEOUT = pUser.session_timeout;
                                                else
                                                    resultSessionInfo.SESSION_TIMEOUT = 0;
                                                // if (pUser.session_logout_timeout) {
                                                //     resultSessionInfo.SESSION_LOGOUT_TIMEOUT = pUser.session_logout_timeout
                                                // } else {
                                                //     resultSessionInfo.SESSION_LOGOUT_TIMEOUT = 0;
                                                // }
                                                var ttl = '';
                                                if (NeedJwt != undefined && NeedJwt == 'Y') {
                                                    ttl = parseInt(JWTExpire);
                                                } else {
                                                    ttl = parseInt(ServerExpire);
                                                }
                                                console.log('-----------ttl' + ttl);

                                                reqRedisInstance.RedisInsert(RedisSession, rediskey, resultSessionInfo, ttl);
                                                FillClientSetup(rowsCltSetUp, pUser, function (res) {
                                                    callbacksuccess(res);
                                                });
                                            } catch (error) {
                                                finalcallback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14836', 'Exception Occured while executing SuccessCallback function', error));
                                            }
                                        }


                                        function externalauth(callbackextauth) {
                                            try {
                                                clientR.get('EXTERNAL_AUTH_INFO', function (err, Info) {
                                                    //For Block chain loging
                                                    var HYPER_LEDGER_INFO = JSON.parse(Info).HYPER_LEDGER;
                                                    var apiurl = HYPER_LEDGER_INFO.API_URL;
                                                    var Blockscret = HYPER_LEDGER_INFO.SECRET_KEY;
                                                    var BlockJwtExpire = HYPER_LEDGER_INFO.Expire;
                                                    var Blockjwt = reqJWT.sign({
                                                        login_name: strUname,
                                                        id: strUname
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
                                                            resultSessionInfo.EXT_AUTH_TOKEN_BLOCKCHAIN = accessToken;
                                                            callbackextauth("SUCCESS");
                                                        }
                                                    });
                                                });
                                            } catch (error) {
                                                callbackextauth(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14854', 'Exception Occured ext Login', error));
                                            }
                                        }
                                        // Prepare client setup info
                                        function FillClientSetup(rowsCltSetUp, pUser, callbackfillclientsetup) {

                                            try {
                                                reqInstanceHelper.PrintInfo(serviceName, 'FillClientSetup function executing...', objLogInfo);
                                                for (var i = 0; i < rowsCltSetUp.rows.length; i++) {
                                                    var cltsetup = rowsCltSetUp.rows[i];
                                                    var setup = cltsetup.category;
                                                    switch (setup) {
                                                        case "PASSWORD_POLICY":
                                                            if (cltsetup.setup_json != null)
                                                                resultSessionInfo.PASSWORD_POLICY = cltsetup.setup_json;
                                                            break;
                                                        case "ATMT_VWR_TYPE":
                                                            if (cltsetup.setup_json != null) {
                                                                var parsedObj = JSON.parse(cltsetup.setup_json);
                                                                resultSessionInfo.ATMT_VWR_TYPE = parsedObj.ATMT_VWR_TYPE;
                                                            } else
                                                                resultSessionInfo.ATMT_VWR_TYPE = 'ACCUSOFT';
                                                            break;
                                                        case "CHT_USR_ORG_PWD":
                                                            if (cltsetup.setup_json != null) {
                                                                var parsedObj = JSON.parse(cltsetup.setup_json);
                                                                // resultSessionInfo.CHAT_PASS = parsedObj.CHT_USR_ORG_PWD;
                                                            }
                                                            break;
                                                        case "CONTROL_FORMAT":
                                                            if (cltsetup.setup_json != null) {
                                                                var parsedObj = JSON.parse(cltsetup.setup_json);
                                                                resultSessionInfo.DATE_FORMAT = parsedObj.DATE_FORMAT;
                                                                resultSessionInfo.MONTH_FORMAT = parsedObj.MONTH_FORMAT;
                                                            }
                                                            break;
                                                        case "ENABLE_JWT":
                                                            if (cltsetup.setup_json != null) {
                                                                var parsedObj = JSON.parse(cltsetup.setup_json);
                                                                resultSessionInfo.ENABLE_JWT = parsedObj.ENABLE_JWT;
                                                                //console.log('JWT', resultSessionInfo.ENABLE_JWT)
                                                            }
                                                            break;
                                                        case "CURRENT_JWT":
                                                            if (cltsetup.setup_json != null) {
                                                                var parsedObj = JSON.parse(cltsetup.setup_json);
                                                                jwttoken = parsedObj.Token;
                                                            }
                                                            break;
                                                        case "ENABLE_CHAT":
                                                            if (cltsetup.setup_json != null) {
                                                                var parsedObj = JSON.parse(cltsetup.setup_json);
                                                                resultSessionInfo.CHAT_ENABLE = parsedObj.ENABLE_CHAT;
                                                            }
                                                            break;
                                                        case "SYSTEM SELECTON":
                                                            if (cltsetup.setup_json != null) {
                                                                var parsedObj = JSON.parse(cltsetup.setup_json);
                                                                resultSessionInfo.NEED_SYSTEM_TYPES = parsedObj;
                                                            }
                                                            break;
                                                        case "ACCUSOFT":
                                                            if (cltsetup.setup_json != null) {
                                                                var parsedObj = JSON.parse(cltsetup.setup_json);
                                                                resultSessionInfo.ACCUSOFT_TYPE = parsedObj.OS_TYPE;
                                                                resultSessionInfo.ACCUSOFT_URL = parsedObj.URL;
                                                            }
                                                            break;
                                                        default:
                                                            break;
                                                    }
                                                }

                                                //prepare JWT token
                                                if (resultSessionInfo.ENABLE_JWT == 'Y') {
                                                    resultSessionInfo.API_GATEWAY_SETUP = new API_GATEWAY_SETUP;
                                                    resultSessionInfo.API_GATEWAY_SETUP.SessionToken = jwttoken;
                                                }
                                                PrepareLangJson(pUser.client_id, function (res) {
                                                    // reqInstanceHelper.PrintInfo(serviceName, 'PrepareLangJson function executing...', objLogInfo);
                                                    callbackfillclientsetup(res);
                                                });

                                            } catch (err) {
                                                callbackfillclientsetup(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14836', 'Exception Occured while executing FillClientSetup function', err));
                                            }
                                        }

                                        // Prepare language Json
                                        function PrepareLangJson(pClientId, callbacklanguage) {
                                            try {
                                                PrepareResultStr(resultSessionInfo, 'Success case', function (result) {
                                                    callbacklanguage(result);
                                                });
                                            } catch (error) {
                                                callbacklanguage(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14837', 'Exception Occured while executing PrepareLangJson function', error));
                                            }
                                        }

                                        // Prepare result data json to send to client
                                        function PrepareResultStr(Sess_info, pParent, callbackResult) {
                                            try {
                                                if (strResult == 'FAILURE') { }
                                                if (!IsCompleted) {
                                                    if (strMessage == 'SUCCESS' && resultSessionInfo.NEED_OTP == 'Y' && (strModel != '' || null)) {
                                                        var OTPId = reqUuid.v1();
                                                        Sess_info.OTPId = OTPId;
                                                        if (strModel == "MAIL" || strModel == "M") {
                                                            var param = {};
                                                            param.OTPId = OTPId;
                                                            param.OTP_MAIL_TEMPLATE = 'LOGIN_OTP_MAIL_TEMPLATE'; //OTP_MAIL_TEMPLATE[0].setup_json;
                                                            param.OTP_SMS_TEMPLATE = '';
                                                            param.login_name = pUser.login_name;
                                                            param.email_id = pUser.email_id;
                                                            param.mobile_no = pUser.mobile_no;
                                                            param.u_id = pUser.u_id;
                                                            param.client_id = pUser.client_id;
                                                            param.msgvalue = 0;
                                                            param.tenant_id = strTenantID;
                                                            param.double_authentication_model = pUser.double_authentication_model;
                                                            reqProducer.ProduceMessage('OTP', param, pHeaders, function caalback(res) { });
                                                            //reqSendotp.SendOTP(param);
                                                        } else if (strModel == "SMS" || strModel == "S") {
                                                            var param = {};
                                                            param.OTPId = OTPId;
                                                            param.OTP_MAIL_TEMPLATE = '';
                                                            param.OTP_SMS_TEMPLATE = 'LOGIN_OTP_SMS_TEMPLATE'; //OTP_SMS_TEMPLATE[0].setup_json;
                                                            param.login_name = pUser.login_name;
                                                            param.email_id = pUser.email_id;
                                                            param.mobile_no = pUser.mobile_no;
                                                            param.u_id = pUser.u_id;
                                                            param.client_id = pUser.client_id;
                                                            param.msgvalue = 0;
                                                            param.tenant_id = strTenantID;
                                                            param.double_authentication_model = pUser.double_authentication_model;
                                                            reqProducer.ProduceMessage('OTP', param, pHeaders, function caalback() { });
                                                            //reqSendotp.SendOTP(param);
                                                        } else if (strModel == "BOTH" || strModel == "B") {
                                                            var param = {};
                                                            param.OTPId = OTPId;
                                                            param.OTP_MAIL_TEMPLATE = 'LOGIN_OTP_MAIL_TEMPLATE'; //OTP_MAIL_TEMPLATE[0].setup_json;
                                                            param.OTP_SMS_TEMPLATE = 'LOGIN_OTP_SMS_TEMPLATE'; //OTP_SMS_TEMPLATE[0].setup_json;
                                                            param.login_name = pUser.login_name;
                                                            param.email_id = pUser.email_id;
                                                            param.mobile_no = pUser.mobile_no;
                                                            param.u_id = pUser.u_id;
                                                            param.client_id = pUser.client_id;
                                                            param.tenant_id = strTenantID;
                                                            param.msgvalue = 0;
                                                            param.double_authentication_model = pUser.double_authentication_model;
                                                            reqProducer.ProduceMessage('OTP', param, pHeaders, function caalback() { });
                                                        }
                                                    }
                                                    IsCompleted = true;
                                                    resultSessionInfo.LOGIN_RESULT = strResult;
                                                    resultSessionInfo.MESSAGE = strMessage;
                                                    resultSessionInfo.LOGIN_IP = strClientIp;
                                                    if (serviceModel.PLATFORM_VERSION) {
                                                        Sess_info['PLATFORM_VERSION'] = serviceModel.PLATFORM_VERSION;
                                                    }
                                                    ResultStr = JSON.stringify(Sess_info);
                                                    callbackResult(sendMethodResponse("SUCCESS", '', ResultStr, '', '', '', "SUCCESS", ''));

                                                }
                                            } catch (error) {
                                                callbackResult(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14838', 'Exception Occured while executing PrepareResultStr function', error));
                                            }
                                        }
                                    } catch (error) {
                                        return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-AUT-14857', 'Exception Occured While WPSimpleLogin API Calling... ', error);
                                    }
                                }
                            } catch (error) {
                                return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-AUT-14839', 'Exception Occured While GetFXDBConnection  ', error);
                            }
                        });
                    });
                });
            } catch (error) {
                return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-AUT-14848', 'Exception Occured While  executing AssignLogInfoDetail  ', error);
            }
        });
        // User Authentication Log
        function userAuthenticationLog(pUser, status, remarks, callbackUserAuthLog) {
            try {
                // DB Insert
                DBInstance.InsertFXDB(mCltClient, 'user_authentication_log', [{
                    'login_name': pUser.login_name,
                    'tenant_id': strTenantID,
                    'client_ip': pUser.client_ip,
                    'login_status': status,
                    'remarks': remarks,
                    'created_date': reqDateFormater.GetTenantCurrentDateTime(pHeaders, objLogInfo),
                    'created_date_utc': reqDateFormater.GetCurrentDateInUTC(pHeaders, objLogInfo)
                }], objLogInfo, function (pError, pResult) {
                    if (pError) {
                        reqInstanceHelper.PrintInfo(serviceName, 'Error occurred while inserting data - ' + pError, objLogInfo)
                    }
                    callbackUserAuthLog();

                })

            } catch (error) {
                reqInstanceHelper.PrintInfo(serviceName, 'Error occurred during User Authentication Log insert - ' + error, objLogInfo);
                callbackUserAuthLog();
            }

        }

    } catch (error) {
        return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-AUT-14855', 'Exception Occured While WPSimpleLogin API Calling... ', error);
    }
});


// Session Class declaration
function SessionInfo() {
    this.LOGIN_RESULT = "";
    this.RESULT_FLAG = "";
    this.USER_NAME = "";
    this.LOGIN_NAME = "";
    this.U_ID = "";
    this.CLIENT_ID = "";
    this.RECORDS_PER_PAGE = 10;
    this.MESSAGE = "";
    // this.USER_APPS = "";
    this.SESSION_TIMEOUT = "";
    // this.APPSYS = "";
    this.LOGIN_IP = "";
    this.CHAT_PASS = "";
    this.CHAT_ENABLE = "";
    this.DATE_FORMAT = "dd/MM/yyyy";
    this.ACCUSOFT_TYPE = "";
    this.ACCUSOFT_URL = "";
    this.ATMT_VWR_TYPE = "ACCUSOFT";
    this.NEED_OTP = "";
    this.PASSWORD_POLICY = "";
    this.API_GATEWAY_SETUP = "";
    this.NEED_LDAP = "";
    this.EMAIL_ID = "";
    this.MOBILE_NO = "";
    // this.NEED_ANALYTICS = "";
};

function API_GATEWAY_SETUP() {
    this.SessionToken = "";
};
//Commin Result  Preparation
function sendMethodResponse(status, successMessage, SuccessDataObj, errorCode, errorMessage, errorObject, ProcessStatus, INfoMessage) {
    var obj = {
        'STATUS': status,
        'SUCCESS_MESSAGE': successMessage,
        'SUCCESS_DATA': SuccessDataObj,
        'ERROR_CODE': errorCode,
        'ERROR_MESSAGE': errorMessage,
        'ERROR_OBJECT': errorObject,
        'PROCESS_STATUS': ProcessStatus,
        'INFO_MESSAGE': INfoMessage
    };
    return obj;
}
module.exports = router;
/************ End of Service ***********/