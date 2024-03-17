/*
@Api_Name           : /ChangePassword,
@Description        : To Change password from static module and after forget password --> Change password
@Last_Error_Code    : ERR-AUT-11008
@Last_Code_Changes   :For Password_Repetition_Count Validation using USER_PASSWORD_LOG table
*/

// Require dependencies
var modPath = '../../../../node_modules/';
var refPath = '../../../../torus-references/';
var reqExpress = require(modPath + 'express');
var router = reqExpress.Router();
var reqEncHelper = require('../../../../torus-references/common/crypto/EncryptionInstance');
var DBInstance = require('../../../../torus-references/instance/DBInstance');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqRedisInstance = require('../../../../torus-references/instance/RedisInstance');
var reqLoginPageHelper = require('./helper/LoginPageHelper');
var reqsvchelper = require('../../../../torus-references/common/serviceHelper/ServiceHelper');
var reqDateFormater = require('../../../../torus-references/common/dateconverter/DateFormatter');
var reqLinq = require(modPath + "node-linq").LINQ;
var reqTranDBHelper = require('../../../../torus-references/instance/TranDBInstance')
// var reqTimeSpan = require(modPath + 'timespan');
var reqAuditLog = require('../../../../torus-references/log/audit/AuditLog');
var moment = require('moment');
const { identity, reject } = require('lodash');
const { resolve } = require('path');
var serviceName = 'ChangePassword';

// API hosting
router.post('/ChangePassword', function (appRequest, appResponse) {
    try {
        var serviceModel = DBInstance.DBInstanceSession['SERVICE_MODEL'];
        var pHeaders = appRequest.headers;
        var SALTKEY = appRequest.headers["salt-session"];
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, sessionInfo) {

            objLogInfo.PROCESS_INFO.MODULE = 'General'
            objLogInfo.PROCESS_INFO.MENU_GROUP = 'Admin'
            objLogInfo.PROCESS_INFO.MENU_ITEM = 'Change_Password'
            objLogInfo.PROCESS_INFO.PROCESS_NAME = 'Change_Password';
            reqTranDBHelper.GetTranDBConn(pHeaders, false, function (tran_db_instance) {
                reqAuditLog.GetProcessToken(tran_db_instance, objLogInfo, function (error, prct_id) {
                    objLogInfo.HANDLER_CODE = 'CHANGE_PASSWORD';
                    objLogInfo.PROCESS = 'ChangePassword-Authentication';
                    objLogInfo.ACTION = 'ChangePassword';

                    // Handle the close event when client closes the api request
                    appResponse.on('close', function () { });
                    appResponse.on('finish', function () { });
                    appResponse.on('end', function () { });

                    reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo);
                    var strUID = appRequest.body.PARAMS.pUID;
                    var strOldPwd = appRequest.body.PARAMS.pOldPwd;
                    var strNewPwd = appRequest.body.PARAMS.pNewPwd;
                    var strpPwdRep = appRequest.body.PARAMS.pPwdRep;
                    var strpPwdRepCnt = appRequest.body.PARAMS.pPwdRepCnt;
                    var strLoginName = appRequest.body.PARAMS.pLoginName.toUpperCase();
                    var strInputParamJson = appRequest.body;
                    // var strTENANTI = appRequest.body.PARAMS.TENANT_ID;
                    if (!objLogInfo.TENANT_ID) {
                        objLogInfo.TENANT_ID = appRequest.body.PARAMS.TENANT_ID;
                    }
                    var strTENANTI = objLogInfo.TENANT_ID
                    var OTPId = appRequest.body.PARAMS.PToken;
                    var OTPValue = appRequest.body.PARAMS.OTPValue;
                    var decryptedOtp = reqEncHelper.DecryptPassword(OTPValue);
                    var strPwdRepCnt = '';
                    var strEncNewPwd = '';
                    var strEncOldPwd = '';
                    var strResult = '';
                    var strClientID = '';
                    var strNeedChange = '';
                    var strCheckPwdVerify = '';
                    var strLastPwdSel = '';
                    var strUserPwdLogUpdate = '';
                    var isLastPasswordSel = false;


                    // Funcrion call
                    _MainChangePassword(function (finalcallback) {
                        if (finalcallback.STATUS == 'SUCCESS') {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, finalcallback.SUCCESS_DATA, objLogInfo, '', '', '', 'SUCCESS', finalcallback.INFO_MESSAGE);
                        } else {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, finalcallback.ERROR_CODE, finalcallback.ERROR_MESSAGE, finalcallback.ERROR_OBJECT);
                        }
                    });

                    // Get clt_cas connection instance
                    function _MainChangePassword(finalcallback) {
                        try {
                            DBInstance.GetFXDBConnection(appRequest.headers, 'clt_cas', objLogInfo, function (mClient) {
                                // OTP Verification
                                if (OTPId) {
                                    reqInstanceHelper.PrintInfo(serviceName, objLogInfo, 'Change Password using Forget password.OTP available', objLogInfo);
                                    CompareOTP(function (res) {
                                        finalcallback(res);
                                    });
                                } else {
                                    reqInstanceHelper.PrintInfo(serviceName, objLogInfo, 'Change Password using Static Module.OTP not Required', objLogInfo);
                                    // if (strOldPwd == '') {
                                    //     _SelectUser(mClient, function (res) {
                                    //         finalcallback(res);
                                    //     });
                                    // } else {
                                    if (strOldPwd != '') {
                                        // strEncOldPwd = reqEncHelper.EncryptPassword(strOldPwd);
                                        strEncOldPwd = reqEncHelper.passwordHash256(strOldPwd);
                                        _ChangePassword(mClient, strCheckPwdVerify, function (res) {
                                            finalcallback(res);
                                        });
                                    } else {
                                        reqInstanceHelper.PrintInfo(serviceName, objLogInfo, 'OTP/Old password not available', objLogInfo);
                                        finalcallback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10845', 'Something went wrong.', 'OTP/Old password is not matched'));
                                    }
                                }

                                // Compare Entered OTP With OTP Logs table entry
                                function CompareOTP(CaompareOtpcallback) {
                                    try {
                                        reqInstanceHelper.PrintInfo(serviceName, 'Compare OTP function executing...', objLogInfo);
                                        reqRedisInstance.GetRedisConnectionwithIndex('3', async function (err, redsSession) {
                                            var otpkey = 'OTP~' + OTPId
                                            var redisOtpJSON = await reqRedisInstance.GetKeyValue(redsSession, otpkey, objLogInfo);
                                            if (redisOtpJSON) {
                                                var redisOTPValue = JSON.parse(redisOtpJSON).OTP
                                                if (redisOTPValue == reqEncHelper.EncryptPassword(decryptedOtp)) {
                                                    await redsSession.del(otpkey)
                                                    reqInstanceHelper.PrintInfo(serviceName, 'OTP Matched ', objLogInfo);
                                                    if (strOldPwd == '') {
                                                        _SelectUser(mClient, function (res) {
                                                            CaompareOtpcallback(res);
                                                        });
                                                    } else {
                                                        if (strOldPwd != '') {
                                                            // strEncOldPwd = reqEncHelper.EncryptPassword(strOldPwd);
                                                            strEncOldPwd = reqEncHelper.passwordHash256(strOldPwd);
                                                        };
                                                        _ChangePassword(mClient, strCheckPwdVerify, function (result) {
                                                            CaompareOtpcallback(result);
                                                        });
                                                    }
                                                } else {
                                                    reqInstanceHelper.PrintInfo(serviceName, 'Invalid OTP', objLogInfo);
                                                    strResult = 'Invalid OTP';
                                                    CaompareOtpcallback(sendMethodResponse("SUCCESS", '', '', '', '', '', '', strResult));
                                                }
                                            } else {
                                                reqInstanceHelper.PrintInfo(serviceName, 'OTP Not Found for requested OTP Token ID', objLogInfo);
                                                strResult = 'OTP Not Found';
                                                CaompareOtpcallback(sendMethodResponse("SUCCESS", '', '', '', '', '', '', strResult));
                                            }
                                        })
                                    } catch (error) {
                                        CaompareOtpcallback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10805', 'Exception Occured while executing CompareOTP  function ', error));
                                    }
                                }
                            });
                        } catch (error) {
                            CaompareOtpcallback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10806', 'Exception Occured while executing  _MainChangePassword function ', error));
                        }
                    }

                    function _ChangePassword(mClient, strCheckPwdVerify, cllbackChangepwd) {
                        try {
                            reqInstanceHelper.PrintInfo(serviceName, objLogInfo, '_ChangePassword function executing', objLogInfo);
                            strNeedChange = 'Y';
                            strResult = '';
                            if (strCheckPwdVerify == '') {
                                strCheckPwdVerify = 'Y';
                            }
                            strEncNewPwd = strNewPwd;
                            var SlatValue;
                            reqLoginPageHelper.get_salt_value(SALTKEY, function (Res, err) {
                                if (err) {
                                    cllbackChangepwd(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10807', 'Slat value not able to get', err));
                                } else {
                                    SlatValue = Res.salt;
                                    DBInstance.GetTableFromFXDB(mClient, 'USERS', [], {
                                        'login_name': strLoginName
                                    }, objLogInfo, function (err, pResult) {
                                        try {
                                            if (err) {
                                                cllbackChangepwd(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10807', 'GetTableFromFXDB users Failed', err));
                                            } else {
                                                // Check the User
                                                if (pResult.rows.length == 0) {
                                                    cllbackChangepwd(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10808', 'No User found for Change Password', ''));
                                                }
                                                if (pResult.rows.length > 0) {
                                                    rsUsers = pResult.rows[0];
                                                    if (strCheckPwdVerify == 'Y') {
                                                        if (strEncOldPwd == '')
                                                            strEncOldPwd = rsUsers.login_password;
                                                        var hashedDBPwd = reqEncHelper.passwordHash256Withsalt(rsUsers.login_password, SlatValue);
                                                        // Check the old password
                                                        if (strOldPwd != hashedDBPwd) {
                                                            strResult = "Old password wrong";
                                                            return cllbackChangepwd(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10809', strResult, ''));
                                                        }
                                                    }
                                                    var cond = {};
                                                    cond.setup_code = ['AUTHENTICATION'];
                                                    strClientID = rsUsers.client_id;
                                                    if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
                                                        reqsvchelper.GetSetupJson(mClient, cond, objLogInfo, function (res) {
                                                            if (res.Status == 'SUCCESS' && res.Data.length) {
                                                                aftergetsetupJson(res.Data[0]);
                                                            } else {
                                                                cllbackChangepwd(sendMethodResponse("FAILURE", '', '', res.ErrorCode, res.ErrorMsg, res.Error));
                                                            }
                                                        });
                                                    } else {
                                                        var strCategory = 'AUTHENTICATION';
                                                        // To select the client setup
                                                        reqInstanceHelper.PrintInfo(serviceName, 'GetTableFromFXDB from TENANT_SETUP ', objLogInfo);
                                                        DBInstance.GetTableFromFXDB(mClient, 'TENANT_SETUP', [], {
                                                            tenant_id: strTENANTI,
                                                            client_id: strClientID,
                                                            category: strCategory
                                                        }, objLogInfo, function (pError, pResult) {
                                                            try {
                                                                if (pError) {

                                                                } else {
                                                                    if (pResult.rows.length == 0) {
                                                                        cllbackChangepwd(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10811', 'No Rows Found from TENANT_SETUP for category ' + strCategory, ''));
                                                                    } else {
                                                                        aftergetsetupJson(pResult.rows[0]);
                                                                    }
                                                                }
                                                            } catch (error) {
                                                                cllbackChangepwd(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10812', 'Exception occured while GetTableFromFXDB TENANT_SETUP Failed', error));
                                                            }
                                                        });

                                                    }


                                                    function aftergetsetupJson(pResult) {
                                                        try {
                                                            // Check the Authendication
                                                            reqInstanceHelper.PrintInfo(serviceName, 'Got Rows from tentant_setup table for Category-AUTHENTICATION ', objLogInfo);
                                                            var strClientStp = pResult;
                                                            var strSetupJson = JSON.parse(strClientStp.setup_json);
                                                            strPwdRepCnt = strSetupJson.PASSWORD_REPETITION_COUNT;
                                                            strUID = rsUsers.u_id;

                                                            _UserPwdLog(mClient, function (res) {
                                                                cllbackChangepwd(res);
                                                            });

                                                        } catch (error) {
                                                            cllbackChangepwd(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10812', 'Exception occured while GetTableFromFXDB TENANT_SETUP Failed', error));
                                                        }

                                                    }
                                                }
                                            }

                                        } catch (error) {
                                            cllbackChangepwd(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10813', 'Exception occured while GetTableFromFXDB USERS Table callback function Failed', error));
                                        }
                                    });
                                }
                            });
                        } catch (error) {
                            cllbackChangepwd(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10814', 'Exception occured while executing _ChangePassword function Failed', error));
                        }
                    }

                    // Query the current user info
                    function _SelectUser(mClient, callback) {
                        try {
                            // Select the user
                            DBInstance.GetTableFromFXDB(mClient, 'USERS', [], {
                                'login_name': strLoginName
                            }, objLogInfo, function (pErr, pResult) {
                                try {
                                    if (pErr) {
                                        callback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10815', 'GetTableFromFXDB users Failed', pErr));
                                    } else if (pResult) {
                                        var strUserid = pResult.rows[0].u_id;
                                        _ForgetPassword(strUserid, mClient, function (res) {
                                            callback(res);
                                        });
                                    }
                                } catch (error) {
                                    callback(sendMethodResponse('FAILURE', '', '', 'ERR-AUT-10816', 'Exception Occured While executing  SelectUser callbackfunction  ', error));
                                }
                            });
                        } catch (error) {
                            callback(sendMethodResponse('FAILURE', '', '', 'ERR-AUT-10817', 'Exception Occured While executing  _SelectUser function  ', error));
                        }
                    }

                    // Get the old passowrd from USER_PASSWORD_LOG table
                    function _ForgetPassword(pUsrId, mClient, callbackforgetpassword) {
                        try {
                            // Select the user password log
                            DBInstance.GetTableFromFXDB(mClient, 'USER_PASSWORD_LOG', [], {
                                u_id: pUsrId
                            }, objLogInfo, function (pErr, pResult) {
                                try {
                                    if (pErr) {
                                        callbackforgetpassword(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10818', 'GetTableFromFXDB USER_PASSWORD_LOG  failed ', pErr));
                                    } else if (pResult) {
                                        // Prepare the linq query for find the old password while we do the forget password
                                        var arrOldPWD = new reqLinq(pResult.rows)
                                            .OrderByDescending(function (u) {
                                                return u.created_date;
                                            }).ToArray();
                                        strOldPwd = arrOldPWD[0].new_password;
                                        strEncOldPwd = arrOldPWD[0].new_password;

                                        strCheckPwdVerify = 'N';
                                        // console.log(strEncOldPwd);
                                        _ChangePassword(mClient, strCheckPwdVerify, function (res) {
                                            callbackforgetpassword(res);
                                        });
                                    }
                                } catch (error) {
                                    callbackforgetpassword(sendMethodResponse('FAILURE', '', '', 'ERR-AUT-10819', 'Exception Occured While executing  GetTableFromFXDB USER_PASSWORD_LOG callback function  ', error));
                                }
                            });
                        } catch (error) {
                            callbackforgetpassword(sendMethodResponse('FAILURE', '', '', 'ERR-AUT-10820', 'Exception Occured While executing  _ForgetPassword function  ', error));
                        }
                    }

                    // Get and update the LAST_PWD_CREATION details 
                    async function _UserPwdLog(mClient, callback) {
                        try {
                            // if (isLastPasswordSel) {
                            // To the last password selection
                            reqInstanceHelper.PrintInfo(serviceName, 'To check password log details', objLogInfo);
                            // DBInstance.GetTableFromFXDB(mClient, 'LAST_PWD_CREATION', [], {
                            //     u_id: strUID
                            // }, objLogInfo, function (pError, pResult) {
                            //     try {
                            //         if (pError) {
                            //             callback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10821', 'GetTableFromFXDB LAST_PWD_CREATION  failed ', pError));
                            //         } else {
                            //             if (pResult.rows.length > 0) {
                            //                 var strUserEntries = pResult.rows[0];
                            //                 var strPwds = strUserEntries.last_created_pwds.toString().trim().split(',');
                            //                 // Check whether the password alreardy used or not

                            //                 var pwdused = new reqLinq(strPwds)
                            //                     .Where(function (u) {
                            //                         return u == strEncNewPwd;
                            //                     }).ToArray();

                            //                 if (pwdused.length > 0) {
                            //                     strResult = 'Password Already Used';
                            //                 }
                            //             } else {
                            //                 DBInstance.UpdateFXDB(mClient, 'LAST_PWD_CREATION', {
                            //                     last_created_pwds: strEncNewPwd,
                            //                     last_created_date: reqDateFormater.GetTenantCurrentDateTime(appRequest.headers, objLogInfo)
                            //                 }, {
                            //                     u_id: strUID
                            //                 }, objLogInfo, function (err, result) {
                            //                     if (err)
                            //                         callback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10822', 'UpdateFXDB LAST_PWD_CREATION failed ', err));
                            //                     else {
                            //                         _UpdatePassword(mClient, function (res) {
                            //                             callback(res);
                            //                         });
                            //                     }
                            //                 });
                            //             }
                            //             // Check the password,repitation count and do the updation of user password log
                            //             if (strPwds && (strPwds[0] == strEncNewPwd || strResult == "") && strPwds.length >= strPwdRepCnt) {
                            //                 var strPwdtoRemove = strUserEntries.last_created_pwds.toString().replace(strPwds[0], "").trim();
                            //                 var strCommatoRemove = strPwdtoRemove.toString().replace(',', "").trim();
                            //                 var strLCPwds = '';
                            //                 if (strCommatoRemove != '')
                            //                     strLCPwds = strCommatoRemove + "," + strEncNewPwd;
                            //                 else
                            //                     strLCPwds = strEncNewPwd;
                            //                 DBInstance.UpdateFXDB(mClient, 'LAST_PWD_CREATION', {
                            //                     last_created_pwds: strLCPwds,
                            //                     last_created_date: reqDateFormater.GetTenantCurrentDateTime(appRequest.headers, objLogInfo)
                            //                 }, {
                            //                     u_id: strUID
                            //                 }, objLogInfo, function (pErr, pResult) {
                            //                     try {
                            //                         if (pErr) {
                            //                             callback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10823', 'UpdateFXDB LAST_PWD_CREATION failed ', pErr));
                            //                         } else {
                            //                             strNeedChange = 'N';
                            //                             strResult = "";
                            //                             _UpdatePassword(mClient, function (res) {
                            //                                 callback(res);
                            //                             });;
                            //                         }
                            //                     } catch (error) {
                            //                         callback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10824', 'UpdateFXDB LAST_PWD_CREATION failed ', error));
                            //                     }
                            //                 });

                            //             } else if (strResult == "") {
                            //                 if (strPwds && strPwds.length < strPwdRepCnt) {
                            //                     var strPwd = strUserEntries.last_created_pwds;
                            //                     strPwd = strPwd + "," + strEncNewPwd;
                            //                     // To update the user password log
                            //                     DBInstance.UpdateFXDB(mClient, 'LAST_PWD_CREATION', {
                            //                         last_created_pwds: strPwd,
                            //                         last_created_date: reqDateFormater.GetTenantCurrentDateTime(appRequest.headers, objLogInfo)
                            //                     }, {
                            //                         u_id: strUID
                            //                     }, objLogInfo, function (pErr, pResult) {
                            //                         try {
                            //                             if (pErr) {
                            //                                 callback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10825', 'UpdateFXDB LAST_PWD_CREATION failed ', pErr));
                            //                                 // console.error(pErr);
                            //                             } else {
                            //                                 strNeedChange = 'N';
                            //                                 _UpdatePassword(mClient, function (res) {
                            //                                     callback(res);
                            //                                 });
                            //                             }
                            //                         } catch (error) {
                            //                             callback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10826', 'UpdateFXDB LAST_PWD_CREATION failed ', error));
                            //                         }
                            //                     });

                            //                 } else if (strNeedChange == "Y" && strOldPwd != "") {
                            //                     // Check the old password and do the updation of user password log
                            //                     DBInstance.UpdateFXDB(mClient, 'LAST_PWD_CREATION', {
                            //                         last_created_pwds: strEncNewPwd,
                            //                         last_created_date: reqDateFormater.GetTenantCurrentDateTime(appRequest.headers, objLogInfo)
                            //                     }, {
                            //                         u_id: strUID
                            //                     }, objLogInfo, function (pErr, pResult) {
                            //                         try {
                            //                             if (pErr) {
                            //                                 callback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10827', 'UpdateFXDB LAST_PWD_CREATION failed ', pErr));
                            //                             } else {
                            //                                 strResult = '';
                            //                                 _UpdatePassword(mClient, function (res) {
                            //                                     callback(res);
                            //                                 });
                            //                             }
                            //                         } catch (error) {
                            //                             callback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10828', 'Exception Occured UpdateFXDB LAST_PWD_CREATION failed ', error));
                            //                         }
                            //                     });
                            //                 }
                            //             } else {
                            //                 callback(sendMethodResponse("SUCCESS", '', '', 'ERR-AUT-10829', '', '', '', 'Entered Password already Used'));
                            //             }
                            //         }
                            //     } catch (error) {
                            //         callback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10830', 'Exception Occured LAST_PWD_CREATION mailcallback error ', error));
                            //     }
                            // });
                            // }


                            var pwdAlreadyUsed = await checkPasswordrepeatCount(mClient, objLogInfo);
                            if (pwdAlreadyUsed) {
                                callback(sendMethodResponse("SUCCESS", '', '', 'ERR-AUT-10829', '', '', '', 'Entered Password already Used'));
                            } else {
                                _UpdatePassword(mClient, function (res) {
                                    callback(res);
                                });
                            }
                        } catch (error) {
                            callback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10831', 'Exception Occured _UpdatePassword function failed ', error));
                        }
                    }

                    //Update new password into users table
                    function _UpdatePassword(mClient, cllbackupdatePwd) {
                        try {
                            if (strResult == "") {
                                // To new passowrd as active password 
                                reqInstanceHelper.PrintInfo(serviceName, 'UpdateFXDB to update the users table with new password ', objLogInfo);
                                DBInstance.UpdateFXDB(mClient, 'USERS', {
                                    login_password: strEncNewPwd,
                                    //start_active_date: reqDateFormater.GetTenantCurrentDateTime(appRequest.headers, objLogInfo),
                                    modified_by: strUID,
                                    modified_date: reqDateFormater.GetTenantCurrentDateTime(appRequest.headers, objLogInfo),
                                    enforce_change_password: 'N',
                                    pwd_type: 'NOT_TEMP',
                                    pwd_created_date: reqDateFormater.GetTenantCurrentDateTime(appRequest.headers, objLogInfo),
                                    prct_id: prct_id
                                }, {
                                    u_id: strUID,
                                    login_name: strLoginName,
                                    client_id: strClientID
                                }, objLogInfo, function (pErr, pResult) {
                                    try {
                                        if (pErr) {
                                            cllbackupdatePwd(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10832', 'UpdateFXDB USERS failed ', pErr));
                                        } else {
                                            // To insert the new password into user password log
                                            reqInstanceHelper.PrintInfo(serviceName, 'User table insert success with new password,insert new password into USER_PASSWORD_LOG table', objLogInfo);
                                            DBInstance.InsertFXDB(mClient, 'USER_PASSWORD_LOG', [{
                                                u_id: strUID,
                                                new_password: strEncNewPwd,
                                                old_password: strEncOldPwd,
                                                created_by: strUID,
                                                created_date: new Date()
                                            }], objLogInfo, function (pErr, pResult) {
                                                try {
                                                    if (pErr) {
                                                        cllbackupdatePwd(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10833', 'InsertFXDB USER_PASSWORD_LOG failed ', pErr));
                                                        // console.error(pErr);
                                                    } else {
                                                        if (OTPId != '' && OTPId != undefined) {
                                                            reqInstanceHelper.PrintInfo(serviceName, 'OTP checking finished gogin to delete OTP_LOGS Table ', objLogInfo);
                                                            DBInstance.DeleteFXDB(mClient, 'OTP_LOGS', {
                                                                'LOGIN_NAME': strLoginName,
                                                                'OTP_ID': OTPId
                                                            }, objLogInfo, function callbackdeleteOTPlogs(err, pResult) {
                                                                if (err) {
                                                                    cllbackupdatePwd(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10834', 'DeleteFXDB OTP_LOGS failed ', err));
                                                                } else {
                                                                    strResult = "SUCCESS";
                                                                    _ClearUserSession(mClient, function (res) {
                                                                        cllbackupdatePwd(res);
                                                                    });
                                                                }
                                                            });
                                                        } else {
                                                            strResult = "SUCCESS";
                                                            cllbackupdatePwd(sendMethodResponse("SUCCESS", 'Password Changed Successfully...', strResult, '', '', ''));
                                                        }
                                                    }
                                                } catch (error) {
                                                    cllbackupdatePwd(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10835', 'Exception Occured USER_PASSWORD_LOG callbackfunction', error));
                                                }
                                            });
                                        }
                                    } catch (error) {
                                        cllbackupdatePwd(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10836', 'Exception Occured UpdateFXDB Users callabckfunction', error));
                                    }
                                });
                            }
                        } catch (error) {
                            cllbackupdatePwd(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10837', 'Exception Occured _UpdatePassword function failed ', error));
                        }
                    }


                    function checkPasswordrepeatCount(mClient, objLogInfo) {
                        return new Promise((resolve, reject) => {
                            try {

                                reqInstanceHelper.PrintInfo(serviceName, 'Going to check password already used. ', objLogInfo);

                                var pwdLogQuery = {
                                    query: 'select new_password from user_password_log where u_id= ? order by created_date desc rownum <= ?',
                                    params: [strUID, strPwdRepCnt]

                                }
                                if (mClient.DBConn.DBType == 'pg') {
                                    pwdLogQuery = {
                                        query: 'select new_password from user_password_log where u_id= ? order by created_date desc limit ?',
                                        params: [strUID, strPwdRepCnt]
                                    }
                                }
                                DBInstance.ExecuteSQLQueryWithParams(mClient, pwdLogQuery, objLogInfo, function (pResult, pError) {
                                    if (pError) {
                                        reject(pError)
                                    } else {
                                        var pwdAlreadyUsed = false
                                        if (pResult.rows.length) {
                                            for (var i = 0; i < pResult.rows.length; i++) {
                                                if (pResult.rows[i].new_password == strEncNewPwd) {
                                                    reqInstanceHelper.PrintInfo(serviceName, 'Password already used. ', objLogInfo);
                                                    pwdAlreadyUsed = true
                                                    break
                                                }
                                            }
                                        }
                                        resolve(pwdAlreadyUsed)
                                    }
                                })
                            } catch (error) {
                                reject(pError)
                            }
                        })
                    }
                    // TO clear usersession
                    function _ClearUserSession(mClient, callbackClearUserSession) {
                        try {
                            reqInstanceHelper.PrintInfo(serviceName, 'Going to Clear usersession', objLogInfo);
                            // Clear the User Sessions
                            DBInstance.GetTableFromFXDB(mClient, 'USERS', [], {
                                'login_name': strLoginName
                            }, objLogInfo, function (pErr, pResult) {
                                try {
                                    if (pErr) {
                                        callbackClearUserSession(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10838', 'GetTableFromFXDB  USERS failed ', pError));
                                    } else {
                                        if (pResult.rows.length > 0) {
                                            var strUid = pResult.rows[0].u_id;
                                            // To delete the userSession
                                            DBInstance.DeleteFXDB(mClient, 'USER_SESSIONS', {
                                                u_id: strUid
                                            }, objLogInfo, function (pError, pResult) {
                                                if (pError) {
                                                    callbackClearUserSession(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10839', 'DeleteFXDB  USER_SESSIONS failed ', pError));
                                                } else if (pResult) {
                                                    callbackClearUserSession(sendMethodResponse("SUCCESS", 'Password Changed Successfully...', 'SUCCESS', '', ''));
                                                    if (SALTKEY) {
                                                        reqLoginPageHelper.DeleteSaltSession(serviceName, objLogInfo, SALTKEY);
                                                    }
                                                }
                                            });
                                        }
                                    }
                                } catch (error) {
                                    callbackClearUserSession(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10840', 'GetTableFromFXDB USERS function failed ', error));
                                }
                            });
                        } catch (error) {
                            callbackClearUserSession(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10841', '_ClearUserSession  function failed ', error));
                        }
                    }
                });
            });
        });
    } catch (error) {
        return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-AUT-10842', 'Exception Occured While Change Password', error);
    }

});

//Common Result  Preparation
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
//*******End of Serive*******//