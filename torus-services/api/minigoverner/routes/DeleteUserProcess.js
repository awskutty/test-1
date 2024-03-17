/*
    @Api_Name : /DeleteUserProcess,
    @Description: To Delete User Process
    @Last Error Code : 'ERR-MIN-51927'
*/

// Require dependencies
var reqExpress = require('express');
var router = reqExpress.Router();
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');;
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqsvchelper = require('../../../../torus-references/common/serviceHelper/ServiceHelper');
var reqLINQ = require('node-linq').LINQ;
var serviceName = 'DeleteUserProcess';

// Host api to server
router.post('/DeleteUserProcess', function (appRequest, appResponse) {
    try {
        var serviceModel = reqFXDBInstance.DBInstanceSession['SERVICE_MODEL'];
        var objLogInfo;
        var mSession = null;
        //this will call when unexpected close or finish
        function finishApiCall() {
            if (mSession) {
                reqTranDBInstance.CallRollback(mSession);
            }
        }
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
            try {
                var CLIENT_ID = objSessionInfo.CLIENT_ID;
                var TENANT_ID = objSessionInfo.TENANT_ID;
                var APP_ID = objSessionInfo.APP_ID;
                var Ismultiapp = objSessionInfo.IS_MULTIAPP;
                objLogInfo.HANDLER_CODE = 'DeleteUserProcess'; //correct it
                appResponse.on('close', function () {
                    finishApiCall(appResponse);
                });
                appResponse.on('finish', function () {
                    finishApiCall(appResponse);
                });
                appResponse.on('end', function () {
                    finishApiCall(appResponse);
                });
                reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo);
                var params = appRequest.body;
                var headers = appRequest.headers;
                var sessionInfoKeys = Object.keys(objSessionInfo);
                // This loop is for merge session values with params
                for (var i = 0; i < sessionInfoKeys.length; i++) {
                    var currentKey = sessionInfoKeys[i];
                    params[currentKey] = objSessionInfo[currentKey];
                }
                var makerCheckerModel;
                reqFXDBInstance.GetFXDBConnection(headers, 'clt_cas', objLogInfo, function CallbackGetCassandraConn(pCltClient) {
                    try {
                        var mClient = pCltClient;
                        var strClientId = CLIENT_ID;
                        var strLoginName = appRequest.body.PARAMS.LOGIN_NAME;
                        var strSelectedUsrId = appRequest.body.PARAMS.SELECTED_USER_ID;
                        var strAppId = APP_ID;
                        var strAppuId = appRequest.body.PARAMS.APPU_ID;
                        var strUserDelete = appRequest.body.PARAMS.USER_DELETE;
                        var strResult = '';

                        var cond = {};
                        cond.setup_code = 'NEW_USER_CREATION';
                        reqsvchelper.GetSetupJson(mClient, cond, objLogInfo, function (res) {
                            if (res.Status == 'SUCCESS' && res.Data.length) {
                                var Setupjson = JSON.parse(res.Data[0].setup_json);
                                makerCheckerModel = Setupjson.NEED_MAKER_CHECKER_MODEL;
                                if (Ismultiapp == 'Y') {
                                    _checkappUser();
                                } else {
                                    _DeleteUserProcess();
                                }
                                // aftergetsetupJson(res.Data);
                            } else {
                                reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-MIN-51940', 'Error occured GetSetupJson', '');
                            }
                        });

                        // Multi app case to check the the user assigned to some other application
                        function _checkappUser() {
                            try {
                                var condobj = {};
                                condobj.U_ID = strSelectedUsrId;
                                condobj.status = null;

                                var selappuser = {
                                    query: "select * from iv_app_users where u_id=? and status is null",
                                    params: [strSelectedUsrId]
                                }
                                // reqFXDBInstance.GetTableFromFXDB(mClient, 'APP_USERS', [], condobj, objLogInfo, function (pErr, appUdata) {
                                reqFXDBInstance.ExecuteSQLQueryWithParams(mClient, selappuser, objLogInfo, function (appUdata, pErr) {
                                    try {
                                        if (pErr) {
                                            reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-MIN-51932', 'Error occured  _checkappUser', pErr);
                                        } else {
                                            reqInstanceHelper.PrintInfo(serviceName, 'app user rows' + appUdata.rows.length, objLogInfo);

                                            var AppUserInfo = new reqLINQ(appUdata.rows)
                                                .Where(function (res) {
                                                    return res.app_id != strAppId;
                                                }).ToArray();
                                            if (AppUserInfo.length) {
                                                var strResmsg = 'User assigned to some other application.Delete not allowed.';
                                                reqInstanceHelper.PrintInfo(serviceName, strResmsg, objLogInfo);
                                                reqInstanceHelper.SendResponse(serviceName, appResponse, strResmsg, objLogInfo, '', '', '', 'FAILURE');
                                            } else {
                                                //User not assigned to other application. we can delete the user
                                                _DeleteUserProcess();
                                            }
                                        }
                                    } catch (error) {
                                        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-MIN-51931', 'Exception occured  _checkappUser callback function', error);
                                    }
                                });
                            } catch (error) {
                                reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-MIN-51930', 'Exception occured  _checkappUser function', error);
                            }
                        }


                        function _DeleteUserProcess() {

                            try {
                                if (strUserDelete == 'Y') {
                                    if (makerCheckerModel == 'Y') {

                                        reqFXDBInstance.UpdateFXDB(mClient, 'users', {
                                            'action_desc': 'DELETE_REQUEST',
                                            'approval_status': ''
                                        }, {
                                            'login_name': strLoginName,
                                            'u_id': strSelectedUsrId,
                                            'client_id': CLIENT_ID
                                        }, objLogInfo, function callbackUpdateUser(Error, Result) {
                                            if (Error) {
                                                strResult = Error;
                                                _Response();
                                            } else {
                                                strResult = 'SUCCESS';
                                                _Response();
                                            }
                                        });
                                    }
                                    else {
                                        // reqFXDBInstance.DeleteFXDB(mClient, 'users', {}, {
                                        //     'login_name': strLoginName,
                                        //     'u_id': strSelectedUsrId,
                                        //     'client_id': CLIENT_ID
                                        // }, objLogInfo, function callbackUpdateUser(Error, Result) {
                                        //     if (Error) {
                                        //         strResult = Error;
                                        //         _Response();
                                        //     } else {
                                        //          _DeleteUserSessions();
                                        //         strResult = 'SUCCESS';
                                        //         _Response();
                                        //     }
                                        // });
                                        reqFXDBInstance.DeleteFXDB(mClient, 'user_password_log', {
                                                'u_id': strSelectedUsrId
                                            }, objLogInfo, function callbackDelUsrPWDLog(pErr, pResult) {
                                                try {
                                                    if (pErr) {
                                                        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-MIN-51901', 'Error in _DeleteUserProcess function', pErr);
                                                    } else if (pResult) {
                                                        strResult = 'SUCCESS';
                                                        _DeleteUserSessions();
                                                    }
                                                } catch (error) {
                                                    reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-MIN-51902', 'Error in _DeleteUserProcess function', error);
                                                }
                                            });
                                    }
                                    

                                } else if (strUserDelete == 'N') {
                                    reqFXDBInstance.GetTableFromFXDB(mClient, 'users', ['u_id', 'appur_sts'], {
                                        'login_name': strLoginName,
                                    }, objLogInfo, function callbackselecteUser(Error, Result) {
                                        if (Error) {
                                            strResult = Error;
                                            _Response();
                                        } else {
                                            var strUID = Result.rows[0].u_id;
                                            var strAppUr_STS = Result.rows[0].appur_sts;
                                            if (strAppUr_STS != '' && strAppUr_STS != null) {
                                                var appurJson = JSON.parse(strAppUr_STS);
                                                for (i = 0; i < appurJson.length; i++) {
                                                    if (strAppId == appurJson[i].APP_ID) {
                                                        break;
                                                    }
                                                }
                                                appurJson.splice(i, 1);
                                                var AppurSTS = JSON.stringify(appurJson);
                                            } else {
                                                AppurSTS = null;
                                            }
                                            reqFXDBInstance.UpdateFXDB(mClient, 'users', {
                                                'appur_sts': AppurSTS
                                            }, {
                                                'client_id': strClientId.toString(),
                                                'login_name': strLoginName,
                                                'u_id': strUID
                                            }, objLogInfo, function callbackUpdateUser(Error, Result) {
                                                if (Error) {
                                                    strResult = Error;
                                                    _Response();
                                                } else {
                                                    //_DeleteAppUserRoles();
                                                    strResult = 'SUCCESS';
                                                    _Response();
                                                }
                                            });
                                        }
                                    });
                                }

                                // Do the user session delete against the user
                                function _DeleteUserSessions() {
                                    try {
                                        reqFXDBInstance.DeleteFXDB(mClient, 'user_sessions', {
                                            'u_id': strSelectedUsrId
                                        }, objLogInfo, function callbackDelSess(pError, pResult) {
                                            try {
                                                if (pError) {
                                                    reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-MIN-51904', 'Error in _DeleteUserSessions function', pError);
                                                } else if (pResult) {
                                                    strResult = 'SUCCESS';
                                                    _DeleteLastPwdCreation();
                                                }
                                            } catch (error) {
                                                reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-MIN-51905', 'Error in _DeleteUserSessions function', error);
                                            }
                                        });
                                    } catch (error) {
                                        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-MIN-51906', 'Error in _DeleteUserSessions function', error);
                                    }

                                }

                                // Do the last password creation delete against the user
                                function _DeleteLastPwdCreation() {
                                    try {
                                        reqFXDBInstance.DeleteFXDB(mClient, 'last_pwd_creation', {
                                            'u_id': strSelectedUsrId
                                        }, objLogInfo, function callbackDelSess(pError, pResult) {
                                            try {
                                                if (pError) {
                                                    reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-MIN-51907', 'Error in _DeleteLastPwdCreation function', error);
                                                } else if (pResult) {
                                                    strResult = 'SUCCESS';
                                                    _DeleteAppUsers();
                                                }
                                            } catch (error) {
                                                reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-MIN-51908', 'Error in _DeleteLastPwdCreation function', error);
                                            }
                                        });
                                    } catch (error) {
                                        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-MIN-51909', 'Error in _DeleteLastPwdCreation function', error);
                                    }
                                }

                                // Do the app users delete against the user
                                function _DeleteAppUsers() {
                                    try {
                                        if (strAppuId) {
                                            reqFXDBInstance.DeleteFXDB(mClient, 'app_users', {
                                                'appu_id': strAppuId,
                                                'u_id': strSelectedUsrId,
                                                'app_id': strAppId
                                            }, objLogInfo, function callbackDelSess(pError, pResult) {
                                                try {

                                                    if (pError) {
                                                        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-MIN-51910', 'Error in _DeleteAppUsers function', pError);
                                                    } else if (pResult) {
                                                        strResult = 'SUCCESS';
                                                        if (strUserDelete == 'Y') {
                                                            _DeleteAppUserSTS();
                                                        } else if (strUserDelete == 'N') {
                                                            _Response();
                                                        }
                                                    }
                                                } catch (error) {
                                                    reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-MIN-51911', 'Error in _DeleteAppUsers function', error);
                                                }
                                            });
                                        } else {
                                            if (strUserDelete == 'Y') {
                                                _DeleteAppUserSTS();
                                            } else if (strUserDelete == 'N') {
                                                _Response();
                                            }
                                        }

                                    } catch (error) {
                                        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-MIN-51912', 'Error in _DeleteAppUsers function', error);
                                    }
                                }

                                // Do the app users sts delete against the user
                                function _DeleteAppUserSTS() {
                                    try {
                                        if (strAppuId) {
                                            reqFXDBInstance.DeleteFXDB(mClient, 'app_user_sts', {
                                                'appu_id': strAppuId
                                            }, objLogInfo, function callbackDelSess(pError, pResult) {
                                                try {
                                                    if (pError) {
                                                        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-MIN-51913', 'Error in _DeleteAppUserSTS function', pError);
                                                        // console.error(pError);
                                                    } else if (pResult) {
                                                        strResult = 'SUCCESS';
                                                        if (strUserDelete == 'Y') {
                                                            _DeleteAppUserRoles();
                                                        } else if (strUserDelete == 'N') {
                                                            _DeleteAppUsers();
                                                        }
                                                    }
                                                } catch (error) {
                                                    reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-MIN-51914', 'Error in _DeleteAppUserSTS function', error);
                                                }
                                            });
                                        } else {
                                            if (strUserDelete == 'Y') {
                                                _DeleteAppUserRoles();
                                            } else if (strUserDelete == 'N') {
                                                _DeleteAppUsers();
                                            }
                                        }

                                    } catch (error) {
                                        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-MIN-51915', 'Error in _DeleteAppUserSTS function', error);
                                    }
                                }

                                // Do the app users roles delete against the user
                                function _DeleteAppUserRoles() {
                                    try {
                                        if (strAppuId) {
                                            reqFXDBInstance.DeleteFXDB(mClient, 'app_user_roles', {
                                                'appu_id': strAppuId
                                            }, objLogInfo, function callbackDelSess(pError, pResult) {
                                                try {
                                                    if (pError) {
                                                        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-MIN-51916', 'Error in _DeleteAppUserRoles function', pError);
                                                    } else if (pResult) {
                                                        strResult = 'SUCCESS';
                                                        if (strUserDelete == 'Y') {
                                                            _DeleteUsers();
                                                        } else if (strUserDelete == 'N') {
                                                            _DeleteAppUserSTS();
                                                        }
                                                    }
                                                } catch (error) {
                                                    reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-MIN-51917', 'Error in _DeleteAppUserRoles function', error);
                                                }
                                            });
                                        } else {
                                            if (strUserDelete == 'Y') {
                                                _DeleteUsers();
                                            } else if (strUserDelete == 'N') {
                                                _DeleteAppUserSTS();
                                            }
                                        }

                                    } catch (error) {
                                        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-MIN-51918', 'Error in _DeleteAppUserRoles function', error);
                                    }
                                }

                                // Do the user delete
                                function _DeleteUsers() {
                                    try {
                                        reqFXDBInstance.DeleteFXDB(mClient, 'users', {
                                            'u_id': strSelectedUsrId,
                                            'login_name': strLoginName,
                                            'client_id': strClientId
                                        }, objLogInfo, function callbackDelSess(pError, pResult) {
                                            try {

                                                if (pError) {
                                                    reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-MIN-51919', 'Error in _DeleteUsers function', error);
                                                } else if (pResult) {
                                                    strResult = 'SUCCESS';
                                                    DeleteTenantSetupTargetTableUser({}, function (error, result) {
                                                        _Response();
                                                    });
                                                }
                                            } catch (error) {
                                                reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-MIN-51920', 'Error in _DeleteUsers function', error);
                                            }
                                        });
                                    } catch (error) {
                                        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-MIN-51921', 'Error in _DeleteUsers function', error);
                                    }
                                }

                                function _Response() {
                                    reqInstanceHelper.SendResponse(serviceName, appResponse, strResult, objLogInfo);
                                }

                                // To Delete ethe user Info in Tenant Setup Target Table Also
                                function DeleteTenantSetupTargetTableUser(params, DeleteTenantSetupTargetTableUserCB) {
                                    try {
                                        if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
                                            var cond = {};
                                            cond.setup_code = 'EXTENTED_USER_INFO';
                                            reqsvchelper.GetSetupJson(mClient, cond, objLogInfo, function (res) {
                                                if (res.Status == 'SUCCESS' && res.Data.length) {
                                                    // var Setupjson = JSON.parse(res.Data[0].setup_json);
                                                    aftergetsetupJson(res.Data);
                                                } else {
                                                    DeleteTenantSetupTargetTableUserCB(null, res);
                                                }
                                            });
                                        } else {
                                            reqFXDBInstance.GetTableFromFXDB(mClient, 'tenant_setup', [], condParams, objLogInfo, function (error, result) {
                                                if (error) {
                                                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-MIN-51924', 'Error while Getting Data From TENANT_SETUP Table.... ', error);
                                                    DeleteTenantSetupTargetTableUserCB(error, null); // No Record Found
                                                } else if (!result.rows.length) {
                                                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-MIN-51925', 'There is No Record Found from Tenant Setup Table... ', '');
                                                    DeleteTenantSetupTargetTableUserCB(null, result);
                                                } else {
                                                    aftergetsetupJson(result.rows);
                                                }
                                            });
                                        }


                                        function aftergetsetupJson(result) {
                                            reqTranDBInstance.GetTranDBConn(headers, false, function (tran_db_instance) {
                                                var tenantSetupJson = result[0].setup_json ? JSON.parse(result[0].setup_json) : {};
                                                var targetTable = tenantSetupJson.TARGET_TABLE;
                                                if (targetTable) {
                                                    var condObj = {
                                                        u_id: strSelectedUsrId
                                                    };
                                                    reqInstanceHelper.PrintInfo(serviceName, 'EXTENTED_USER_INFO Category Target Table User Delete Process Started', objLogInfo);
                                                    reqTranDBInstance.DeleteTranDB(tran_db_instance, targetTable, condObj, objLogInfo, function (pResult, pError) {
                                                        if (pError) {
                                                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-MIN-51927', 'EXTENTED_USER_INFO Category Target Table User Delete Process Failed... ', pError);

                                                        } else {
                                                            reqInstanceHelper.PrintInfo(serviceName, 'EXTENTED_USER_INFO Category Target Table User Delete Process Completed Successfully', objLogInfo);
                                                        }
                                                        DeleteTenantSetupTargetTableUserCB(pError, pResult);
                                                    });
                                                } else {
                                                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-MIN-51926', 'There is No Target Table from Tenant Setup Json...... ', '');
                                                    DeleteTenantSetupTargetTableUserCB(null, null);
                                                            }
            
                                                        });
                                                    }
                                                           

                                    } catch (error) {
                                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-MIN-51936', 'Catch Error while Getting Data From TENANT_SETUP Table... ', error);
                                        DeleteTenantSetupTargetTableUserCB(error, null);
                                    }
                                }

                            } catch (error) {
                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-MIN-51926', 'Catch Error while Getting Data From TENANT_SETUP Table... ', error);
                                DeleteTenantSetupTargetTableUserCB(error, null);
                            }
                        }

                    } catch (error) {
                        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-MIN-51903', 'Error in _DeleteUserProcess function', error);
                    }
                });
            } catch (error) {
                reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-MIN-51922', 'Error in reqDBInstance.GetFXDBConnection callback', error);
            }
        });
    } catch (error) {
        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-MIN-51923', 'Error in reqLogInfo.AssignLogInfoDetail callback', error);
    }
});



module.exports = router;
//*******End of Serive*******//