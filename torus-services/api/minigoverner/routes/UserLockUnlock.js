/*
    @Api_Name : /UserLockUnlock,
    @Description: To change user lock or unlock
    @Last Error Code : 'ERR-MIN-51707'
*/

// Require dependencies
var reqExpress = require('express');
var router = reqExpress.Router();
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqDateFormater = require('../../../../torus-references/common/dateconverter/DateFormatter');
var reqsvchelper = require('../../../../torus-references/common/serviceHelper/ServiceHelper');
var reqEncHelper = require('../../../../torus-references/common/crypto/EncryptionInstance');
var reqRedisInstance = require('../../../../torus-references/instance/RedisInstance');
var reqAuditLog = require('../../../../torus-references/log/audit/AuditLog');
var reqTranDBHelper = require('../../../../torus-references/instance/TranDBInstance');
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var serviceName = 'UserLockUnlock';
var request = require('request');
var reqasync = require('async')
const fs = require('fs');
const { Base64Encode } = require('base64-stream');
const PDFDocument = require('pdfkit');
// Host api to server
router.post('/UserLockUnlock', function (appRequest, appResposnse) {
    var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
    var objLogInfo;
    var mSession = null;
    var pHeaders = appRequest.headers;
    //this will call when unexpected close or finish
    function finishApiCall() {
        if (mSession) {
            reqTranDBInstance.CallRollback(mSession);
        }
    }

    reqFXDBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function CallbackGetCassandraConn(pCltClient) {
        reqFXDBInstance.GetFXDBConnection(pHeaders, 'res_cas', objLogInfo, function CallbackGetCassandraConn(resClient) {

            reqFXDBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function CallbackGetCassandraConn(depClient) {
                reqLogInfo.AssignLogInfoDetail(appRequest, function (resObjLogInfo, objSessionInfo) {
                    objLogInfo = resObjLogInfo;
                    objLogInfo.PROCESS_INFO.PROCESS_NAME = 'User_Lock_Unlock';
                    reqTranDBHelper.GetTranDBConn(pHeaders, false, function (tran_db_instance) {

                        var CLIENT_ID = objSessionInfo.CLIENT_ID;
                        var LOGIN_NAME = objSessionInfo.LOGIN_NAME;
                        var strClinentID = CLIENT_ID;
                        var params = appRequest.body;
                        var headers = appRequest.headers;
                        var strLoginname = appRequest.body.PARAMS.LOGIN_NAME;
                        var strProcess = appRequest.body.PARAMS.PROCESS;
                        var strSUID = appRequest.body.PARAMS.SELECTED_USER_ID;
                        var strUID = params.U_ID;
                        var strRejectReason = appRequest.body.PARAMS.REMARKS;

                        if (strProcess == 'LOCK') {
                            objLogInfo.PROCESS_INFO.PROCESS_NAME = 'Lock user'
                        } else {
                            objLogInfo.PROCESS_INFO.PROCESS_NAME = 'Unlock User'
                        }
                        reqAuditLog.GetProcessToken(tran_db_instance, objLogInfo, function (error, prct_id) {
                            reqRedisInstance.GetRedisConnection(function (error, clientR) {
                                try {
                                    objLogInfo.HANDLER_CODE = 'UserLockUnlock'; //correct it
                                    appResposnse.on('close', function () { });
                                    appResposnse.on('finish', function () { });
                                    appResposnse.on('end', function () { });
                                    reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo);

                                    var sessionInfoKeys = Object.keys(objSessionInfo);
                                    // This loop is for merge session values with params
                                    for (var i = 0; i < sessionInfoKeys.length; i++) {
                                        var currentKey = sessionInfoKeys[i];
                                        params[currentKey] = objSessionInfo[currentKey];
                                    }
                                    reqDBInstance.GetFXDBConnection(headers, 'clt_cas', objLogInfo, async function CallbackGetCassandraConn(pClient) {
                                        try {

                                            if (strProcess == "APPROVE" || strProcess == 'REJECT') {
                                                reqInstanceHelper.PrintInfo(serviceName, 'Processname |' + strProcess, objLogInfo);
                                                approveUser(strProcess);
                                            } else {
                                                DoUserLockUnlock();
                                            }

                                            function DoUserLockUnlock() {
                                                try {
                                                    if (strProcess == 'LOCK') {
                                                        //Lock the user
                                                        reqDBInstance.UpdateFXDB(pClient, 'users', {
                                                            'account_locked_date': reqDateFormater.GetTenantCurrentDateTime(headers, objLogInfo),
                                                            'modified_by': strUID,
                                                            'modified_date': reqDateFormater.GetTenantCurrentDateTime(headers, objLogInfo),
                                                            'status': 'ACCOUNT_LOCKED',
                                                            'remarks': `${strRejectReason} Account locked by ${objLogInfo.LOGIN_NAME}`,
                                                            'prct_id': prct_id
                                                        }, {
                                                            'client_id': strClinentID,
                                                            'login_name': strLoginname,
                                                            'u_id': strSUID
                                                        }, objLogInfo, function callbackLOCK(error, result) {
                                                            try {
                                                                if (error) {
                                                                    reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-51701', 'Error in DoUserLockUnlock function', error);
                                                                } else {
                                                                    reqInstanceHelper.PrintInfo(serviceName, 'User name ' + strLoginname + ' Locked successfully.', objLogInfo);
                                                                    reqInstanceHelper.SendResponse(serviceName, appResposnse, 'User name ' + strLoginname + ' Locked successfully.', objLogInfo);
                                                                }
                                                            } catch (error) {
                                                                reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-51702', 'Error in DoUserLockUnlock function', error);
                                                            }
                                                        });
                                                    } else {
                                                        //Unlock the locked user
                                                        reqDBInstance.UpdateFXDB(pClient, 'users', {
                                                            'account_locked_date': null,
                                                            'modified_by': strUID,
                                                            'modified_date': reqDateFormater.GetTenantCurrentDateTime(headers, objLogInfo),
                                                            'status': 'ACTIVE',
                                                            'remarks': `Account unlocked by ${objLogInfo.LOGIN_NAME}`,
                                                            'prct_id': prct_id,
                                                            'account_unlocked_date': reqDateFormater.GetTenantCurrentDateTime(headers, objLogInfo),
                                                        }, {
                                                            'client_id': strClinentID,
                                                            'login_name': strLoginname,
                                                            'u_id': strSUID
                                                        }, objLogInfo, function callbackUNLOCK(error, result) {
                                                            try {
                                                                if (error) {
                                                                    reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-51703', 'Error in DoUserLockUnlock function', error);
                                                                } else {
                                                                    reqInstanceHelper.PrintInfo(serviceName, 'User name ' + strLoginname + ' UnLocked successfully.', objLogInfo);
                                                                    reqInstanceHelper.SendResponse(serviceName, appResposnse, 'User name ' + strLoginname + ' UnLocked successfully.', objLogInfo);
                                                                }
                                                            } catch (error) {
                                                                reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-51704', 'Error in DoUserLockUnlock function', error);
                                                            }
                                                        });
                                                    }
                                                } catch (error) {
                                                    reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-51705', 'Error in DoUserLockUnlock function', error);
                                                }
                                            }

                                            function approveUser(pProcess) {
                                                try {

                                                    var userCond = {
                                                        'client_id': strClinentID,
                                                        'login_name': strLoginname,
                                                        'u_id': strSUID
                                                    };
                                                    var collist = ['login_name', 'email_id', 'mobile_no', 'action_desc', 'iv_is_enabled', 'remarks'];
                                                    _getUserdtls(userCond, 'users', collist, async function (result) {
                                                        try {
                                                            if (result.length) {
                                                                reqInstanceHelper.PrintInfo(serviceName, 'Got the user details ', objLogInfo);
                                                                var userdtl = result[0];
                                                                var status = 'ACTIVE';

                                                                if (pProcess == 'REJECT') {

                                                                    strRejectReason = ` ${strRejectReason}.Account rejected by ${objLogInfo.LOGIN_NAME}`;
                                                                    if (userdtl.action_desc == 'CREATE_REQUEST') {
                                                                        var userUpdateob = {
                                                                            'modified_by': strSUID,
                                                                            'modified_date': reqDateFormater.GetTenantCurrentDateTime(headers, objLogInfo),
                                                                            'status': 'REJECTED',
                                                                            'approval_status': 'REJECTED',
                                                                            'action_desc': 'APPROVAL_REJECTED',
                                                                            'remarks': strRejectReason,
                                                                            'prct_id': prct_id
                                                                        };
                                                                    } else {
                                                                        var userUpdateob = {
                                                                            'modified_by': strSUID,
                                                                            'modified_date': reqDateFormater.GetTenantCurrentDateTime(headers, objLogInfo),
                                                                            // 'status': status,
                                                                            'approval_status': 'REJECTED',
                                                                            'action_desc': 'APPROVAL_REJECTED',
                                                                            'remarks': strRejectReason,
                                                                            'prct_id': prct_id
                                                                        };
                                                                    }



                                                                    await appUerStatusUpdated(strSUID);
                                                                    await _updateUser(userCond, userUpdateob);
                                                                    await appUsertableupdated(pProcess);
                                                                    await updateAppUserSTS(pProcess);
                                                                    await _updateAppUserRoleDetails(pProcess);

                                                                } else {
                                                                    var action_desc = '';
                                                                    var approval_status = 'APPROVED';
                                                                    if (userdtl.action_desc == 'CREATE_REQUEST') {
                                                                        action_desc = 'CREATE_REQUEST_APPROVED';
                                                                    } else if (userdtl.action_desc == 'MODIFY_REQUEST') {
                                                                        if (userdtl.iv_is_enabled == 'N') {
                                                                            status = 'DISABLED';
                                                                        }
                                                                        action_desc = 'MODIFY_REQUEST_APPROVED';
                                                                    } else if (userdtl.action_desc == 'DELETE_REQUEST') {
                                                                        action_desc = 'DELETE_REQUEST_APPROVED';
                                                                        status = 'DELETED';
                                                                    }

                                                                    // if user is active check the temp/dynamic password setup from category "NEW_USER_CREATION"
                                                                    _getsetupinfo(function (res) {
                                                                        aftergetsetupJson(res, userdtl, async function (userobj) {
                                                                            userobj.modified_by = strUID;
                                                                            userobj.modified_date = reqDateFormater.GetTenantCurrentDateTime(headers, objLogInfo);
                                                                            userobj.status = status;
                                                                            userobj.action_desc = action_desc;
                                                                            userobj.approval_status = approval_status;
                                                                            userobj.account_locked_date = null;
                                                                            userobj.prct_id = prct_id;
                                                                            await _updateUser(userCond, userobj);
                                                                            await appUsertableupdated(pProcess);
                                                                            await updateAppUserSTS(pProcess);
                                                                            await _updateAppUserRoleDetails(pProcess);
                                                                        });
                                                                    });

                                                                }
                                                            } else {
                                                                reqInstanceHelper.SendResponse(serviceName, appResposnse, 'FAILURE', objLogInfo, 'ERR-MIN-51750', 'User not found', 'Requested User not availabel.');
                                                            }
                                                        } catch (error) {
                                                            console.log(error);
                                                        }
                                                    });

                                                    function _updateUser(pCond, pupdatevalue) {
                                                        return new Promise((resolve, reject) => {
                                                            try {
                                                                reqInstanceHelper.PrintInfo(serviceName, 'Updating user table', objLogInfo);
                                                                reqDBInstance.UpdateFXDB(pClient, 'users', pupdatevalue, pCond, objLogInfo, function callbackUNLOCK(error, result) {
                                                                    try {
                                                                        if (error) {
                                                                            resolve('FAILURE')
                                                                            //reqInstanceHelper.SendResponse(serviceName, appResposnse, 'FAILURE', objLogInfo, 'ERR-MIN-51710', 'Error in approveUser function', error);
                                                                        } else {
                                                                            reqInstanceHelper.PrintInfo(serviceName, 'User name ' + strLoginname + ' updated successfully.', objLogInfo);
                                                                            // reqInstanceHelper.SendResponse(serviceName, appResposnse, 'User name ' + strLoginname + ' updated successfully.', objLogInfo);
                                                                            resolve('User name ' + strLoginname + ' updated successfully.')
                                                                        }

                                                                    } catch (error) {
                                                                        reqInstanceHelper.SendResponse(serviceName, appResposnse, 'FAILURE', objLogInfo, 'ERR-MIN-51711', 'Error in approveUser function', error);
                                                                    }
                                                                });
                                                            } catch (error) {
                                                                reqInstanceHelper.SendResponse(serviceName, appResposnse, 'FAILURE', objLogInfo, 'ERR-MIN-51831', 'Exception occured in _updateUser function', error);
                                                            }
                                                        })
                                                    }

                                                    function appUerStatusUpdated(pCond) {
                                                        return new Promise((resolve, reject) => {
                                                            var objcond = {
                                                                'u_id': pCond
                                                            };
                                                            reqDBInstance.GetTableFromFXDB(pClient, 'IV_APP_USERS', ['status'], objcond, objLogInfo, function (pErr, PRes) {
                                                                if (PRes.rows[0].status == 'UNASSIGNED') {
                                                                    var statusvalue = null;
                                                                    var updaterow = {
                                                                        'status': statusvalue
                                                                    };
                                                                    reqDBInstance.UpdateFXDB(pClient, 'IV_APP_USERS', updaterow, objcond, objLogInfo, function (pErr, PRes) {


                                                                        if (pErr) {
                                                                            resolve('FAILURE')

                                                                            // reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50555', 'update APP_USERS ', pErr, '', '');
                                                                        } else {
                                                                            resolve('SUCCESS')
                                                                            //  reqInstanceHelper.SendResponse(strServiceName, appResponse, 'SUCCESS', objLogInfo, '', '', '', '', '');
                                                                        }

                                                                    })


                                                                } else {
                                                                    resolve('SUCCESS')
                                                                }
                                                            })

                                                        })
                                                    }

                                                } catch (error) {
                                                    reqInstanceHelper.SendResponse(serviceName, appResposnse, 'FAILURE', objLogInfo, 'ERR-MIN-51712', 'Error in approveUser function', error);
                                                }

                                                function appUsertableupdated(pProcess) {
                                                    return new Promise((resolve, reject) => {
                                                        var cond = {
                                                            u_id: strSUID
                                                            // , app_id: objLogInfo.APP_ID
                                                        };

                                                        var selectQuery = `select * from fn_hst_app_users('${strSUID}','${pProcess}')`;
                                                        reqInstanceHelper.PrintInfo(serviceName, 'Updating app_users table', objLogInfo);
                                                        reqDBInstance.ExecuteQuery(pClient, selectQuery, objLogInfo, function callbackUNLOCK(err, RolesRes) {
                                                            if (error) {
                                                                // reqInstanceHelper.SendResponse(serviceName, appResposnse, 'FAILURE', objLogInfo, 'ERR-MIN-51710', 'Error in app_user_role function', error);
                                                                resolve('FAILURE')
                                                            } else {

                                                                //  return reqInstanceHelper.SendResponse(serviceName, appResposnse, 'SUCCESS', objLogInfo);
                                                                resolve('SUCCESS')
                                                            }
                                                        })

                                                    })
                                                }

                                                function updateAppUserSTS(pProcess) {
                                                    return new Promise((resolve, reject) => {
                                                        var cond = {
                                                            u_id: strSUID,
                                                            app_id: objLogInfo.APP_ID
                                                        };
                                                        _getUserdtls(cond, 'iv_app_users', ['appu_id'], async function (pResult) {
                                                            if (pResult.length) {
                                                                var selectQuery = `select * from fn_insert_app_user_sts('${pResult[0].appu_id}','${pProcess}')`;
                                                                reqInstanceHelper.PrintInfo(serviceName, 'Updating app_user_role table', objLogInfo);
                                                                reqDBInstance.ExecuteQuery(pClient, selectQuery, objLogInfo, function callbackUNLOCK(err, StsRes) {
                                                                    if (err) {
                                                                        resolve('FAILURE')
                                                                    } else {
                                                                        resolve('SUCCESS')
                                                                    }
                                                                })

                                                            }
                                                        })
                                                    })
                                                }

                                                function _updateAppUserRoleDetails(pProcess) {
                                                    return new Promise((resolve, reject) => {
                                                        var cond = {
                                                            u_id: strSUID
                                                            , app_id: objLogInfo.APP_ID
                                                        };
                                                        _getUserdtls(cond, 'iv_app_users', ['appu_id'], async function (pResult) {
                                                            if (pResult.length) {
                                                                // for (var i = 0; i < pResult.length; i++) {
                                                                //     await appuserInsertFunctioncall(pResult[i].appu_id)
                                                                // }

                                                                reqasync.forEachOfSeries(pResult, function (data, indx, callback) {
                                                                    var selectQuery = `select * from fn_hst_app_user_roles('${data.appu_id}','${pProcess}')`;
                                                                    reqInstanceHelper.PrintInfo(serviceName, 'Updating app_user_role table', objLogInfo);
                                                                    reqDBInstance.ExecuteQuery(pClient, selectQuery, objLogInfo, function callbackUNLOCK(err, RolesRes) {
                                                                        if (err) {
                                                                            // reqInstanceHelper.SendResponse(serviceName, appResposnse, 'FAILURE', objLogInfo, 'ERR-MIN-51710', 'Error in app_user_role function', error);
                                                                            resolve('FAILURE')
                                                                        } else {
                                                                            //  return reqInstanceHelper.SendResponse(serviceName, appResposnse, 'SUCCESS', objLogInfo);
                                                                            callback()

                                                                        }
                                                                    })
                                                                }, function (error) {
                                                                    if (error) {
                                                                        // pRes.send('Error occured  async  ' + error)
                                                                    } else {
                                                                        // resolve('SUCCESS');
                                                                        reqInstanceHelper.SendResponse(serviceName, appResposnse, 'User name ' + strLoginname + ' updated successfully.', objLogInfo);
                                                                    }
                                                                })

                                                            } else {
                                                                reqInstanceHelper.SendResponse(serviceName, appResposnse, 'FAILURE', objLogInfo, 'ERR-MIN-51710', 'No records in app_users table', error);
                                                            }
                                                        })
                                                    })
                                                }

                                                function _getsetupinfo(callback) {
                                                    try {
                                                        var cond = {};
                                                        cond.setup_code = ['NEW_USER_CREATION', 'PASSWORD_POLICY'];
                                                        reqsvchelper.GetSetupJson(pClient, cond, objLogInfo, function (res) {
                                                            if (res.Status == 'SUCCESS' && res.Data.length) {
                                                                callback(res.Data);
                                                            }
                                                        });

                                                    } catch (error) {
                                                        reqInstanceHelper.SendResponse(serviceName, appResposnse, 'FAILURE', objLogInfo, 'ERR-MIN-51830', 'Exception occured in _getsetupinfo function', error);
                                                    }
                                                }

                                                function aftergetsetupJson(result, pUserDtl, callback) {
                                                    try {
                                                        var userobj = {};
                                                        var passwordsetupRow = result.filter(res => res.category == 'PASSWORD_POLICY');
                                                        if (passwordsetupRow.length) {
                                                            var parsedpolicy = passwordsetupRow[0].setup_json ? JSON.parse(passwordsetupRow[0].setup_json) : {};
                                                            var passwordPolicy = parsedpolicy.VALIDATION;
                                                        }
                                                        var newUserCreationSetup = result.filter(res => res.category == 'NEW_USER_CREATION');

                                                        if (newUserCreationSetup.length) {
                                                            var parsedseetup = JSON.parse(newUserCreationSetup[0].setup_json);
                                                            var dynamicPwd = parsedseetup.DYNAMIC_PASSWORD_CREATION;
                                                        }
                                                        // var dynamicPwd = newUserCreationSetup[0].setup_json ? JSON.parse(newUserCreationSetup[0].setup_json)
                                                        userobj.PWD_TYPE = 'NOT_TEMP';
                                                        if ((pUserDtl.action_desc == 'CREATE_REQUEST' || pUserDtl.remarks == 'Temp Password Expired') && dynamicPwd == "Y") {
                                                            // var dynampswrd = '';
                                                            reqEncHelper.GetDynamicPwd(passwordPolicy, objLogInfo, function (dynampswrd) {
                                                                console.log('Password is | ' + dynampswrd);
                                                                pPassword = reqEncHelper.passwordHash256(dynampswrd);
                                                                userobj.ENFORCE_CHANGE_PASSWORD = 'Y';
                                                                userobj.login_password = pPassword;
                                                                console.log('******Password is ||| ' + pPassword);
                                                                userobj.PWD_CREATED_DATE = reqDateFormater.GetTenantCurrentDateTime(headers, objLogInfo);
                                                                userobj.PWD_TYPE = 'TEMP';
                                                                var alertParam = {};
                                                                alertParam.TEMP_PWD = dynampswrd;
                                                                alertParam.LOGIN_NAME = pUserDtl.login_name;
                                                                alertParam.TO_MAIL_ADDRESS = pUserDtl.email_id;
                                                                alertParam.TO_MOBILE_NO = pUserDtl.mobile_no;
                                                                alertParam.COMMG_CODE = parsedseetup.COMMUNICATION_GROUP_CODE;
                                                                alertParam.REMARKS = 'Temp Password Expired'
                                                                sendalertTouser(alertParam, function (res) {
                                                                    callback(userobj);
                                                                });
                                                            });
                                                        } else {
                                                            callback(userobj);
                                                        }

                                                    } catch (error) {
                                                        reqInstanceHelper.SendResponse(serviceName, appResposnse, 'FAILURE', objLogInfo, 'ERR-MIN-51829', 'Exception occured in aftergetsetupJson function', error);
                                                    }
                                                }

                                                function getDynamicPwd(passwordPolicy, pcallback) {
                                                    try {
                                                        var gendynpwd = new RandExp(passwordPolicy).gen();
                                                        var pwdpatern = new RegExp(passwordPolicy);
                                                        if (!pwdpatern.test(gendynpwd)) {
                                                            //Not matched with pwd policy generate  pwd
                                                            reqInstanceHelper.PrintInfo(serviceName, 'Dynamic pwd not matched password policy. Regenerate the pwd.', objLogInfo);
                                                            getDynamicPwd(pcallback);
                                                        } else {
                                                            pcallback(gendynpwd);

                                                        }
                                                    } catch (error) {
                                                        reqInstanceHelper.SendResponse(serviceName, appResposnse, 'FAILURE', objLogInfo, 'ERR-MIN-51840', 'Exception occured in getDynamicPwd function', error);
                                                    }

                                                }

                                                async function sendalertTouser(pPrams, pcallback) {
                                                    try {
                                                        var pReqBody = {};
                                                        var processinfo = {};
                                                        var PrctId = "USER" + new Date().getMilliseconds() * 11111;
                                                        objSessionInfo.NEED_PERSIST = true;
                                                        objSessionInfo.TEMPLATE_FROM = "SETUP";
                                                        var arrATMTData = [{
                                                            COMMMG_CODE: pPrams.COMMG_CODE,
                                                            dt_code: 'USERS',
                                                            dtt_code: 'USERS',
                                                            PRCT_ID: PrctId,
                                                            WFTPA_ID: 'DEFAULT',
                                                            from_scheduler: 'N',
                                                            EVENT_CODE: 'DEFAULT',
                                                            session_info: objSessionInfo,
                                                            // commmg_code: 'COMM_CATEGORY1630643829251',
                                                            STATIC_DATA: { "LOGIN_NAME": pPrams.LOGIN_NAME, "MESSAGE_VALUE": pPrams.TEMP_PWD, 'TO_EMAIL_ID': pPrams.TO_MAIL_ADDRESS, 'TO_MOBILE_NO': pPrams.TO_MOBILE_NO },
                                                            tenant_id: objLogInfo.TENANT_ID,
                                                            app_id: objLogInfo.APP_ID,
                                                            routingkey: objLogInfo.ROUTINGKEY

                                                        }];
                                                        var u_name = pPrams.LOGIN_NAME
                                                        var pdfFilePath = `${u_name}_Credentials.pdf`;
                                                        var ATMT_DETAILS = [{
                                                            'FILE_NAME': pdfFilePath,
                                                            'TRN_ID': prct_id
                                                        }]
                                                        var User_Details = [{
                                                            'LOGIN_NAME': pPrams.LOGIN_NAME,
                                                            'TEMP_PASSWORD': pPrams.TEMP_PWD
                                                        }]
                                                        var pswd = pPrams.TO_MOBILE_NO.slice(-4);
                                                        var encryptionOptions = {
                                                            userPassword: pswd,
                                                            ownerPassword: '123456',
                                                            permissions: {
                                                                printing: 'highResolution',
                                                                modifying: false,
                                                                copying: false,
                                                                annotating: true,
                                                                fillingForms: true,
                                                                contentAccessibility: true,
                                                                documentAssembly: true
                                                            }
                                                        };

                                                        var doc = new PDFDocument(encryptionOptions);
                                                        function generatePdf() {
                                                            return new Promise((resolve, reject) => {
                                                                // var imagePath = 'E:\\fx_wp_ng9\\src\\assets\\images\\default-app.png';
                                                                const imageWidth = 100;
                                                                const imageHeight = 100;

                                                                const pdfWidth = doc.page.width;
                                                                const imageX = (pdfWidth - imageWidth) / 2;
                                                                const imageY = 50;
                                                                // doc.image(imagePath, imageX, imageY, { width: imageWidth, height: imageHeight, align: 'center', valign: 'top' });
                                                                var pdfHeight = doc.page.height;
                                                                doc.rect(10, 10, pdfWidth - 20, pdfHeight - 20).stroke();
                                                                function createRow(doc, key, value, x, y, rowHeight) {
                                                                    const cellWidth = 200;
                                                                    doc.rect(x, y, cellWidth, rowHeight).stroke();
                                                                    doc.rect(x + cellWidth, y, cellWidth, rowHeight).stroke();
                                                                    var textY = y + 15;
                                                                    doc.text(key, x + 5, textY, { width: cellWidth - 10, align: 'center' });
                                                                    doc.text(value, x + cellWidth + 5, textY, { width: cellWidth - 10, align: 'center' });
                                                                }
                                                                doc.moveDown(17);
                                                                doc.fontSize(14).text(`This is the Credentials for the user :  ${User_Details[0].LOGIN_NAME.toUpperCase()} `, { align: 'center' });
                                                                doc.moveDown();
                                                                doc.fontSize(14).text('User Details', { align: 'center' });
                                                                doc.moveDown();
                                                                const increasedRowHeight = 40;
                                                                let rowY = doc.y;
                                                                createRow(doc, 'LOGIN_NAME:', User_Details[0].LOGIN_NAME, 110, rowY, increasedRowHeight);
                                                                rowY += increasedRowHeight;
                                                                createRow(doc, 'TEMP_PASSWORD:', User_Details[0].TEMP_PASSWORD, 110, rowY, increasedRowHeight);
                                                                rowY += increasedRowHeight;
                                                                var finalString = '';
                                                                var stream = doc.pipe(new Base64Encode());
                                                                doc.end();
                                                                stream.on('data', function (chunk) {
                                                                    finalString += chunk;
                                                                });

                                                                stream.on('end', function () {
                                                                    resolve(finalString)
                                                                });
                                                            })
                                                        }

                                                        generatePdf().then((base64String) => {
                                                            reqFXDBInstance.InsertFXDB(resClient, 'COMM_PROCESS_ATMT', [{
                                                                'atmt_name': pdfFilePath,
                                                                'atmt_data': base64String,
                                                                'trn_id': prct_id
                                                            }], objLogInfo, async function callbackErr(err) {
                                                                if (err) {
                                                                    reqInstanceHelper.PrintError(pConsumerName, objLogInfo, ' ERR-ATMT-001', 'Error in COMM_PROCESS_ATMT', error);
                                                                } else {

                                                                    // Comm process data  table insert
                                                                    pReqBody.COMMM_CODE = pPrams.COMMG_CODE;
                                                                    pReqBody.TEMPLATECODE = pPrams.COMMG_CODE;
                                                                    pReqBody['ATMT_DATA'] = JSON.stringify(arrATMTData);
                                                                    pReqBody.SESSION_ID = pHeaders['session-id'];
                                                                    pReqBody.WFTPA_ID = 'DEFAULT';
                                                                    pReqBody.DT_CODE = 'DEFAULT';
                                                                    pReqBody.DTT_CODE = 'DEFAULT';
                                                                    pReqBody.EVENT_CODE = 'DEFAULT';
                                                                    pReqBody.PRCT_ID = PrctId;
                                                                    // pReqBody.TEMPLATECODE = 'TEMP_PWD_MAIL_TEMPLATE';
                                                                    pReqBody.STATIC_DATA = { "LOGIN_NAME": pPrams.LOGIN_NAME, "MESSAGE_VALUE": pPrams.TEMP_PWD, 'TO_EMAIL_ID': pPrams.TO_MAIL_ADDRESS, 'TO_MOBILE_NO': pPrams.TO_MOBILE_NO };
                                                                    pReqBody.SKIP_COMM_FLOW = true;
                                                                    pReqBody.ATMT_DETAILS = JSON.stringify(ATMT_DETAILS);
                                                                    processinfo.MODULE = 'Administration';
                                                                    processinfo.MENU_GROUP = 'Application Setup';
                                                                    processinfo.MENU_ITEM = 'Communication';
                                                                    processinfo.PROCESS_NAME = 'DEFAULT';

                                                                    var commReq = {};
                                                                    commReq.PARAMS = pReqBody;
                                                                    commReq.PROCESS_INFO = params.PROCESS_INFO;
                                                                    commReq.SESSION_ID = pHeaders['session-id'];
                                                                    var URLPrecedence = "";
                                                                    URLPrecedence = serviceModel.NODEFS_URL;
                                                                    var allPorts = await getPortNumber()
                                                                    var CommPort = allPorts.ServicePort['Communication']
                                                                    URLPrecedence = URLPrecedence.replace('<service_port>', CommPort);
                                                                    var uri = URLPrecedence + "/Communication/SendMessage/";
                                                                    //  var uri = "http://192.168.2.210:30509/Communication/SendMessage/";
                                                                    console.log('URI is               | ' + uri);
                                                                    var options = {
                                                                        url: uri,
                                                                        method: 'POST',
                                                                        json: true,
                                                                        headers: {
                                                                            'RoutingKey': pHeaders.routingkey,
                                                                            'session-id': pHeaders['session-id']
                                                                        },
                                                                        body: commReq
                                                                    };

                                                                    reqInstanceHelper.PrintInfo(serviceName, 'Communication serive cexecuting', objLogInfo);
                                                                    request(options, function (err, httpResponse, resbody) {
                                                                        try {
                                                                            if (err) {
                                                                                // _PrintError(objLogInfo, 'Error in sending Mail ' + err || err.stack, 'ERR-COM-20050');
                                                                                reqInstanceHelper.SendResponse(serviceName, appResposnse, 'FAILURE', objLogInfo, 'ERR-MIN-51827', 'Error in request function', err);
                                                                            } else {
                                                                                reqInstanceHelper.PrintInfo(serviceName, 'Alert sent to user', objLogInfo);
                                                                                pcallback();
                                                                            }
                                                                        } catch (error) {
                                                                            reqInstanceHelper.SendResponse(serviceName, appResposnse, 'FAILURE', objLogInfo, 'ERR-MIN-51826', 'Exception occured in request function', error);
                                                                        }
                                                                    });
                                                                }
                                                            })
                                                        });

                                                    } catch (error) {
                                                        reqInstanceHelper.SendResponse(serviceName, appResposnse, 'FAILURE', objLogInfo, 'ERR-MIN-51825', 'Error in _getUserdtls function', error);
                                                    }
                                                }
                                                async function getPortNumber() {
                                                    try {
                                                        return new Promise((resolve, reject) => {
                                                            reqInstanceHelper.ReadConfigFile(function (error, pConfig) {
                                                                resolve(pConfig)
                                                            })
                                                        })
                                                    } catch (error) {
                                                        reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, 'ERR-CODE-400031', 'getPortNumber Function error', error, 'FAILURE', error);
                                                    }
                                                }
                                            }

                                            function _getUserdtls(pcond, ptableName, pColList, pcallback) {
                                                try {
                                                    reqDBInstance.GetTableFromFXDB(pClient, ptableName, pColList, pcond, objLogInfo, function (pErr, pResult) {
                                                        try {
                                                            if (pErr) {
                                                                pcallback(pErr);
                                                            } else {
                                                                pcallback(pResult.rows);
                                                            }

                                                        } catch (error) {
                                                            reqInstanceHelper.SendResponse(serviceName, appResposnse, 'FAILURE', objLogInfo, 'ERR-MIN-51824', 'Error in _getUserdtls function', error);
                                                        }
                                                    });
                                                } catch (error) {
                                                    reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-51724', 'Error in getuserdtls function', error);
                                                }
                                            }
                                        } catch (error) {
                                            reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-51706', 'Error in reqDBInstance.GetFXDBConnection callback', error);
                                        }
                                    });
                                } catch (error) {
                                    reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-51707', 'Error in reqLogInfo.AssignLogInfoDetail callback', error);
                                }
                            });
                        });
                    });
                });
            });
        });
    })

})


module.exports = router;
//*******End of Serive*******//