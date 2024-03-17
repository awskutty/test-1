/*  
Purpose   :Create  a new User in wp and update the selected user
@Api_Name : /CreateUser,
@Description: To Create the dynamic ui components and controls.
@Last_Error_code: ERR-MIN-50033'
  */

// Require dependencies
var modPath = '../../../../node_modules/';
var reqExpress = require(modPath + 'express');
var router = reqExpress.Router();
var reqEncHelper = require('../../../../torus-references/common/crypto/EncryptionInstance');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqStringBuilder = require(modPath + 'string-builder');
var KongHelper = require('../../../../torus-references/common/gateway/ApiGatewayHelper');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqDateFormater = require('../../../../torus-references/common/dateconverter/DateFormatter');
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqTranDBHelper = require('../../../../torus-references/instance/TranDBInstance');
var reqsvchelper = require('../../../../torus-references/common/serviceHelper/ServiceHelper');
var reqRedisInstance = require('../../../../torus-references/instance/RedisInstance');
var reqAuditLog = require('../../../../torus-references/log/audit/AuditLog');
var async = require('async');
var request = require('request');
const { resolve } = require('path');
const { reject } = require('q');
const { rejects } = require('assert');
const { Base64Encode } = require('base64-stream');
const PDFDocument = require('pdfkit');

//Prepare Queries
const TOTALUSERS = "update fx_total_items set counter_value = counter_value + 1 where code='USERS'";
const TOTALAPP_USERS = "update fx_total_items set counter_value = counter_value + 1 where code='APP_USERS'";


//global variable declaration
var strServiceName = 'CreateUser';

//API Host
router.post('/CreateUser', function (appRequest, appResponse, next) {
    var serviceModel = reqFXDBInstance.DBInstanceSession['SERVICE_MODEL'];
    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, sessionInfo) {
        var pHeaders = appRequest.headers;
        objLogInfo.PROCESS_INFO.PROCESS_NAME = 'Create_User';
        reqRedisInstance.GetRedisConnection(function (error, clientR) {
            try {
                reqInstanceHelper.PrintInfo(strServiceName, 'Begin', objLogInfo);
                objLogInfo.PROCESS = 'CreateUser-MiniGoverner';
                objLogInfo.ACTION_DESC = 'CreateUser';
                //Initialize Local variable  variables
                var strUserDetails = appRequest.body.PARAMS;
                var roleMode = strUserDetails.ROLE_MODE;
                var strAppid = strUserDetails.APP_ID || sessionInfo.APP_ID;
                var strClientid = sessionInfo.CLIENT_ID;
                var strTenantId = sessionInfo.TENANT_ID;
                var tenantSetupJson = {};
                var strUserID = sessionInfo.U_ID;
                var strUserName = sessionInfo.USER_NAME;
                var strSID = sessionInfo.S_ID;
                var strSDesc = sessionInfo.S_DESC;
                var ismultiapp = sessionInfo.IS_MULTIAPP;
                var muid = appRequest.body.PARAMS.U_ID;
                var usergrpCode = appRequest.body.PARAMS.UG_CODE || '';
                var UNIQ_U_ID = muid ? muid : '';
                var mappu_id = appRequest.body.PARAMS.appu_id
                var UNIQ_APPU_ID = mappu_id ? mappu_id : '';
                var mappr_id = appRequest.body.PARAMS.appr_id;
                var APPUR_MENUS = appRequest.body.PARAMS.APPUR_MENUS;
                var IsExternal = appRequest.body.PARAMS.IsExternal || null;
                var USER_MENUS = appRequest.body.PARAMS.USER_MENUS
                var APPUR_MENU_SETUP = appRequest.body.APPUR_MENU_SETUP
                var CLUSTER_NAME = strUserDetails.CLUSTER_NAME;
                var arrAppStsId = [];
                arrAppStsId = strUserDetails.APPSTS_ID;
                var userStatus = '';
                var userActionDesc = '';
                var userApprovalStatus = '';
                var strResult = '';
                var sbUser = new reqStringBuilder();
                var pPassword = '';
                var mappuID;
                var mappurID;
                var trandbInstance;
                var passwordPolicy;
                var newUserCreationSetup;
                var makerCheckerModel;
                var showclustersystem;
                var prctID = ''

                reqFXDBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function CallbackGetCassandraConn(pCltClient) {
                    reqFXDBInstance.GetFXDBConnection(pHeaders, 'res_cas', objLogInfo, function CallbackGetCassandraConn(resClient) {

                        reqFXDBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function CallbackGetCassandraConn(depClient) {
                            var mClient = pCltClient;
                            if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
                                var cond = {};
                                cond.setup_code = ['EXTENTED_USER_INFO', 'NEW_USER_CREATION', 'PASSWORD_POLICY'];
                                if (mappr_id && mappr_id.length > 1) {
                                    cond.setup_code.push('APP_ROLE_CONFLICTS')
                                }
                                reqsvchelper.GetSetupJson(mClient, cond, objLogInfo, async function (res) {
                                    if (res.Status == 'SUCCESS' && res.Data.length) {
                                        if (mappr_id && mappr_id.length > 1) {
                                            var conflictRoleSetup = res.Data.filter((pData) => { return pData.category == 'APP_ROLE_CONFLICTS' });
                                            if (conflictRoleSetup.length) {
                                                var validationRes = await RoleConflictValidation(conflictRoleSetup);
                                                if (validationRes.status == 'SUCCESS') {
                                                    aftergetsetupJson(res.Data);
                                                } else {
                                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-MIN-50058', validationRes.message, validationRes.Message, 'SUCCESS', validationRes.message);
                                                }
                                            } else {
                                                aftergetsetupJson(res.Data);
                                            }
                                        } else {
                                            aftergetsetupJson(res.Data);
                                        }
                                    } else {
                                        AddUserCommonFun();
                                    }
                                });
                            } else {
                                var condParams = {
                                    tenant_id: strTenantId,
                                    client_id: strClientid,
                                    category: 'EXTENTED_USER_INFO'
                                };
                                reqFXDBInstance.GetTableFromFXDB(mClient, 'tenant_setup', [], condParams, objLogInfo, function (error, result) {
                                    if (error) {
                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-MIN-50028', 'Exception occured while Getting Target Table from Tenant Setup Json...', error);
                                    } else if (!result.rows.length) {
                                        AddUserCommonFun();
                                    } else {
                                        aftergetsetupJson(result.rows);
                                    }
                                });

                            }

                            function RoleConflictValidation(pConflictSetup) {
                                return new Promise(async (resolve, reject) => {
                                    try {
                                        var curAppCode = await getappCode()
                                        var parsedConfig = JSON.parse(pConflictSetup[0].setup_json).APP_ROLE_CONFLICTS;
                                        var curAppRoleConfSetup = parsedConfig.filter((pdata) => { return pdata.app_code == curAppCode });
                                        var selectedRoleConflict = []
                                        for (var i = 0; i < mappr_id.length; i++) {
                                            var curselectedRoleid = curAppRoleConfSetup.filter((Roledata) => { return mappr_id[i] == Roledata.role_id })
                                            if (curselectedRoleid.length) {
                                                var confligRoleid = curselectedRoleid[0].conflict_role_id;
                                                for (var j = 0; j < mappr_id.length; j++) {
                                                    if (confligRoleid.indexOf(mappr_id[j]) > -1) {
                                                        selectedRoleConflict.push(mappr_id[j])
                                                    }
                                                }
                                            }
                                        }
                                        var res = {}
                                        if (selectedRoleConflict.length) {
                                            res.status = "FAILURE"
                                            res.message = "Selected role combination not allowed."
                                            resolve(res)
                                        } else {
                                            res.status = "SUCCESS"
                                            resolve(res)
                                        }
                                    } catch (error) {
                                        var res = {};
                                        res.status = "FAILURE";
                                        res.message = "Exception occured.";
                                        res.error = error;
                                        resolve(res);
                                    }
                                })
                            }

                            async function getappCode() {
                                try {
                                    return new Promise((resolve, reject) => {
                                        reqFXDBInstance.GetTableFromFXDB(mClient, 'applications', [], { app_id: strAppid }, objLogInfo, function (error, result) {
                                            if (!error) {
                                                result.qry_status = "SUCCESS";
                                                console.log("ExecuteQuery function ended");
                                                resolve(result.rows[0].app_code);
                                            } else {
                                                QueryObj.qry_status = "ERROR";
                                                QueryObj.err_msg = err.toString();
                                                console.log("ExecuteQuery function ended");
                                                resolve(QueryObj);
                                            }
                                        });
                                    });
                                } catch (error) {
                                    console.log("error occured " + error);
                                    reject(error)
                                }

                            }

                            function aftergetsetupJson(result) {
                                reqTranDBHelper.GetTranDBConn(pHeaders, false, function (tran_db_instance) {
                                    if (strUserDetails.U_ID) {
                                        objLogInfo.PROCESS_INFO.PROCESS_NAME = 'Update user'
                                    } else {
                                        objLogInfo.PROCESS_INFO.PROCESS_NAME = 'Create user'
                                    }
                                    reqAuditLog.GetProcessToken(tran_db_instance, objLogInfo, function (error, prct_id) {
                                        prctID = prct_id
                                        trandbInstance = tran_db_instance;
                                        var ExttableInfo = result.filter(res => res.category == 'EXTENTED_USER_INFO');
                                        tenantSetupJson = ExttableInfo[0].setup_json ? JSON.parse(ExttableInfo[0].setup_json) : {};
                                        var targetTable = tenantSetupJson.TARGET_TABLE;
                                        if (targetTable != '') {
                                            var condObj = {
                                                u_id: 0
                                            };
                                            reqTranDBHelper.GetTableFromTranDB(tran_db_instance, targetTable, condObj, objLogInfo, function (UserExtresult, error) {
                                                if (error) {
                                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-MIN-50031', 'Target Table from Tenant Setup Json is Not Found...' + targetTable, error);
                                                } else {
                                                    var passwordsetupRow = result.filter(res => res.category == 'PASSWORD_POLICY');
                                                    if (passwordsetupRow.length) {
                                                        passwordPolicy = JSON.parse(passwordsetupRow[0].setup_json).VALIDATION;
                                                    }
                                                    var setupRow = result.filter(res => res.category == 'NEW_USER_CREATION');
                                                    if (setupRow.length) {
                                                        var parsedSetup = JSON.parse(setupRow[0].setup_json);
                                                        newUserCreationSetup = parsedSetup;
                                                        makerCheckerModel = newUserCreationSetup.NEED_MAKER_CHECKER_MODEL;
                                                        showclustersystem = newUserCreationSetup.SHOW_CLUSTER_SYSTEM;
                                                    }

                                                    AddUserCommonFun();
                                                }
                                            });
                                        } else {
                                            AddUserCommonFun();
                                        }
                                    });

                                });
                            };

                            function AddUserCommonFun(params, AddUserCommonFunCB) {
                                try {
                                    reqInstanceHelper.GetRedisValue('KONG_CONFIG', pHeaders, function CallbackGetCassandraConn(Kong) {
                                        var mKongClient = JSON.parse(Kong);
                                        //Main Function call
                                        if ((ismultiapp == 'Y' && (mappu_id == null || mappu_id == undefined || mappu_id == '') && muid != '')) {
                                            CreateMultiApp_Users();
                                        } else {
                                            CreateUser(function (finalcallback) {
                                                if (finalcallback.STATUS == 'SUCCESS') {
                                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, finalcallback.SUCCESS_DATA, objLogInfo, '', '', '', finalcallback.STATUS, finalcallback.INFO_MESSAGE);

                                                } else {
                                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, finalcallback.ERROR_CODE, finalcallback.ERROR_MESSAGE, finalcallback.ERROR_OBJECT, finalcallback.STATUS, finalcallback.INFO_MESSAGE);
                                                }
                                            });
                                        }

                                        function CreateMultiApp_Users() {

                                            fx_total_item('APP_USERS', function (Uniqueid) {
                                                mappuID = Uniqueid.toString();
                                                var appuserinsert = [{
                                                    appu_id: mappuID,
                                                    app_id: strAppid,
                                                    u_id: muid,
                                                    created_by: strUserID,
                                                    created_date: reqDateFormater.GetTenantCurrentDateTime(pHeaders, objLogInfo),
                                                    prct_id: prctID
                                                }];
                                                if (usergrpCode && roleMode == "USER_GROUP") {
                                                    appuserinsert[0].ug_code = usergrpCode
                                                    appuserinsert[0].role_mode = roleMode
                                                } else {
                                                    appuserinsert[0].role_mode = roleMode
                                                }

                                                var table_name = '';
                                                if (makerCheckerModel == 'Y') {
                                                    table_name = 'iv_app_users'
                                                }
                                                else {
                                                    table_name = 'app_users'
                                                }


                                                var selectquery = {
                                                    query: `select * from ?? where u_id =? and app_id=?`,
                                                    params: [table_name, muid, strAppid]
                                                }
                                                //makerCheckerModel

                                                reqFXDBInstance.ExecuteSQLQueryWithParams(mClient, selectquery, objLogInfo, function callbackDelete(pResult, pError) {
                                                    if (pResult.rows.length > 0) {
                                                        reqFXDBInstance.DeleteFXDB(mClient, 'iv_app_users', { 'u_id': muid, 'app_id': strAppid }, objLogInfo, function (pError, pResult) {

                                                            reqFXDBInstance.DeleteFXDB(mClient, 'app_users', { 'u_id': muid, 'app_id': strAppid }, objLogInfo, function (pError, pResult) {

                                                                if (pError) {

                                                                } else {
                                                                    if (makerCheckerModel == 'Y') {
                                                                        // multiappInsert(appuserinsert, 'APP_USERS', function (result) {
                                                                        multiappInsert(appuserinsert, table_name, function (result) {
                                                                            if (result == 'SUCCESS') {
                                                                                createMultiAppUserRoles();
                                                                            }
                                                                        });
                                                                    } else {
                                                                        multiappInsert(appuserinsert, 'APP_USERS', function (result) {
                                                                            multiappInsert(appuserinsert, 'IV_APP_USERS', function (result) {
                                                                                if (result == 'SUCCESS') {
                                                                                    createMultiAppUserRoles();
                                                                                }
                                                                            });
                                                                        });
                                                                    }

                                                                }
                                                            })
                                                        })
                                                    } else {
                                                        if (makerCheckerModel == 'Y') {
                                                            //multiappInsert(appuserinsert, 'APP_USERS', function (result) {
                                                            multiappInsert(appuserinsert, table_name, function (result) {
                                                                if (result == 'SUCCESS') {
                                                                    createMultiAppUserRoles();
                                                                }
                                                            });
                                                        } else {
                                                            multiappInsert(appuserinsert, 'APP_USERS', function (result) {
                                                                multiappInsert(appuserinsert, 'IV_APP_USERS', function (result) {
                                                                    if (result == 'SUCCESS') {
                                                                        createMultiAppUserRoles();
                                                                    }
                                                                });
                                                            });
                                                        }
                                                    }
                                                })
                                            });
                                        }

                                        function createMultiAppUserRoles() {
                                            var Roles = strUserDetails.appr_id;
                                            var appuserrolesinsert = [];
                                            var obj = {};
                                            var currentValue = '';
                                            async.forEachOfSeries(Roles, function (value, key, appuserRolesCallback) {
                                                currentValue = value;
                                                fx_total_item('APP_USER_ROLES', function (Uniqueid) {
                                                    mappurID = Uniqueid.toString();
                                                    obj = {};
                                                    obj['appu_id'] = mappuID.toString();
                                                    obj['appur_id'] = mappurID;
                                                    obj['appr_id'] = currentValue == undefined ? "" : currentValue.toString()
                                                    obj['created_by'] = strUserID
                                                    obj['created_date'] = reqDateFormater.GetTenantCurrentDateTime(pHeaders, objLogInfo)
                                                    obj['prct_id'] = prctID
                                                    appuserrolesinsert.push(obj);
                                                    appuserRolesCallback();
                                                });
                                            }, function (err) {
                                                if (!err) {


                                                    //with app role id 
                                                    if (appuserrolesinsert.length > 0) {
                                                        if (makerCheckerModel == 'Y') {
                                                            multiappInsert(appuserrolesinsert, 'IV_APP_USER_ROLES', function (result) {
                                                                if (result == 'SUCCESS') {
                                                                    Updateuser(function (result) {
                                                                        if (result.STATUS == 'SUCCESS') {


                                                                            appuserSTSinsert(arrAppStsId, mappuID.toString(), 'CREATE', function (result) {
                                                                                if (result == 'SUCCESS') {
                                                                                    if (roleMode == "ROLE_MENUS") {
                                                                                        insertIntoAppUserRoleMenu(function () {
                                                                                            reqInstanceHelper.SendResponse(strServiceName, appResponse, result.SUCCESS_DATA, objLogInfo, '', '', '', 'SUCCESS', result.INFO_MESSAGE);
                                                                                        })
                                                                                    } else {
                                                                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, result.SUCCESS_DATA, objLogInfo, '', '', '', 'SUCCESS', result.INFO_MESSAGE);
                                                                                    }
                                                                                }
                                                                            })

                                                                        }
                                                                    });
                                                                }

                                                            });
                                                        } else {
                                                            multiappInsert(appuserrolesinsert, 'APP_USER_ROLES', function (result) {
                                                                multiappInsert(appuserrolesinsert, 'IV_APP_USER_ROLES', function (result) {
                                                                    if (result == 'SUCCESS') {
                                                                        Updateuser(function (result) {
                                                                            if (result.STATUS == 'SUCCESS') {

                                                                                appuserSTSinsert(arrAppStsId, mappuID.toString(), 'CREATE', function (result) {
                                                                                    if (result == 'SUCCESS') {
                                                                                        if (roleMode == "ROLE_MENUS") {
                                                                                            insertIntoAppUserRoleMenu(function () {
                                                                                                reqInstanceHelper.SendResponse(strServiceName, appResponse, result.SUCCESS_DATA, objLogInfo, '', '', '', 'SUCCESS', result.INFO_MESSAGE);
                                                                                            })
                                                                                        } else {
                                                                                            reqInstanceHelper.SendResponse(strServiceName, appResponse, result.SUCCESS_DATA, objLogInfo, '', '', '', 'SUCCESS', result.INFO_MESSAGE);
                                                                                        }
                                                                                    }
                                                                                })

                                                                            }
                                                                        });
                                                                    }
                                                                });

                                                            });
                                                        }
                                                    } else {
                                                        // Without RoleID selection from client side.
                                                        Updateuser(function (result) {
                                                            if (result.STATUS == 'SUCCESS') {
                                                                reqInstanceHelper.SendResponse(strServiceName, appResponse, result.SUCCESS_DATA, objLogInfo, '', '', '', 'SUCCESS', result.INFO_MESSAGE);
                                                            }
                                                        });
                                                    }

                                                } else {
                                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-514', 'Error in APP_USER', err, '', '');
                                                }
                                            });
                                        }

                                        function insertIntoAppUserRoleMenu(pcallback) {
                                            try {
                                                if (APPUR_MENUS.length) {
                                                    var mappurm = [];
                                                    for (var i = 0; i < APPUR_MENUS.length; i++) {
                                                        APPUR_MENUS[i].created_by_name = objLogInfo.LOGIN_NAME
                                                        APPUR_MENUS[i].created_by = strUserID;
                                                        APPUR_MENUS[i].u_id = UNIQ_U_ID;
                                                        APPUR_MENUS[i].created_date = reqDateFormater.GetTenantCurrentDateTime(pHeaders, objLogInfo)
                                                        APPUR_MENUS[i].created_date_utc = reqDateFormater.GetCurrentDateInUTC(pHeaders, objLogInfo)
                                                        APPUR_MENUS[i].login_name = strUserDetails.LOGIN_NAME.toUpperCase()
                                                        APPUR_MENUS[i].app_description = objLogInfo.APP_DESC
                                                        APPUR_MENUS[i].appu_id = mappuID || mappu_id || UNIQ_APPU_ID
                                                        APPUR_MENUS[i].prct_id = prctID
                                                        mappurm.push(APPUR_MENUS[i])
                                                    }
                                                    multiappInsert(mappurm, 'app_user_role_menus', function () {
                                                        pcallback()
                                                    })
                                                } else {
                                                    pcallback()
                                                }

                                            } catch (error) {

                                            }
                                        }

                                        function multiappInsert(insrtData, tablename, insrtcallback) {
                                            reqFXDBInstance.InsertFXDB(mClient, tablename, insrtData, objLogInfo, function callbackInsertFXDB(err, Iresult) {
                                                if (err) {
                                                    return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-514', 'Error in insert "' + tablename + '" table', err, '', '');
                                                } else {
                                                    insrtcallback('SUCCESS');
                                                }
                                            });

                                        }

                                        function fx_total_item(tablename, fxcallback) {
                                            var fxqry = "update fx_total_items set counter_value = counter_value + 1 where code='" + tablename + "'";
                                            reqFXDBInstance.ExecuteQuery(mClient, fxqry, objLogInfo, function (updateerr, updateres) {
                                                if (updateerr) {
                                                    return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-51435', 'Error in update  app_user_sts table', updateerr, '', '');
                                                } else {
                                                    reqFXDBInstance.GetTableFromFXDB(mClient, 'fx_total_items', [], {
                                                        'code': tablename
                                                    }, objLogInfo, function callbackSelSTS(error, pResult) {
                                                        try {
                                                            if (error) {
                                                                return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-51422', 'Error in Querying app_user_sts table', pError, '', '');
                                                            } else if (pResult) {
                                                                if (pResult.rows.length > 0) {
                                                                    var mappuseruniqID = pResult.rows[0].counter_value;
                                                                    fxcallback(mappuseruniqID);
                                                                } else {
                                                                    fxcallback(mappuseruniqID);
                                                                }
                                                            }
                                                        } catch (error) {
                                                            return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-51423', 'Error while query fx_total_items table  callbackSelSTS  function ', error, '', '');
                                                        }
                                                    });
                                                }

                                            });
                                        }

                                        //UserAppRolesCount
                                        function _UserAppRolesCount(callback) {
                                            try {
                                                const TOTALAPP_USER_ROLES = "update fx_total_items set counter_value = counter_value + 1 where code='APP_USER_ROLES'";
                                                reqFXDBInstance.ExecuteQuery(mClient, TOTALAPP_USER_ROLES, objLogInfo, function (updateerr, updateres) {
                                                    if (updateerr) {
                                                        return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-51435', 'Error in update  app_user_sts table', updateerr, '', '');
                                                    } else {
                                                        var strAPPRUNIQID = '';
                                                        var strAURCode = 'APP_USER_ROLES';
                                                        reqFXDBInstance.GetTableFromFXDB(mClient, 'fx_total_items', [], {
                                                            'code': strAURCode
                                                        }, objLogInfo, function callbackSelSTS(error, pResult) {
                                                            try {
                                                                if (error) {
                                                                    return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-51422', 'Error in Querying app_user_sts table', pError, '', '');
                                                                } else if (pResult) {
                                                                    if (pResult.rows.length > 0) {
                                                                        strAPPRUNIQID = pResult.rows[0].counter_value;
                                                                        callback(strAPPRUNIQID);
                                                                    } else {
                                                                        callback(strAPPRUNIQID);
                                                                    }
                                                                }
                                                            } catch (error) {
                                                                return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-51423', 'Error while query fx_total_items table  callbackSelSTS  function ', error, '', '');
                                                            }
                                                        });
                                                    }

                                                });
                                            } catch (error) {
                                                return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-51424', 'Exception Occured while executing _UserAppRolesCount function  ', error, '', '');
                                            }
                                        }

                                        //Prepare Create a  new  user function
                                        function CreateUser(finalcallback) {
                                            try {
                                                if (strUserDetails.U_ID == '') {
                                                    reqInstanceHelper.PrintInfo(strServiceName, 'U_id is not available , going to check user already created ', objLogInfo);
                                                    reqFXDBInstance.GetTableFromFXDB(mClient, 'users', ['login_name'], {
                                                        'login_name': strUserDetails.LOGIN_NAME.toUpperCase(),
                                                        'client_id': strClientid
                                                    }, objLogInfo, function (err, pResult) {
                                                        try {
                                                            if (err) {
                                                                finalcallback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-50001', 'GetTableFromFXDB USERS Failed', err));
                                                            } else {
                                                                // Find the user if already exist or not
                                                                if (pResult.rows.length > 0) {
                                                                    reqInstanceHelper.PrintInfo(strServiceName, 'User name already created  ', objLogInfo);
                                                                    finalcallback(sendMethodResponse("FAILURE", '', '', '', '', '', '', 'User already exist', objLogInfo));
                                                                } else {
                                                                    //New user creation
                                                                    reqInstanceHelper.PrintInfo(strServiceName, ' User Name not available , Going to create new user', objLogInfo);
                                                                    _CreateNewUser(function (result) {
                                                                        CreateorUpdateAppUserRoles("CREATE", function (callBackResponse) {
                                                                            if (callBackResponse.STATUS === "SUCCESS") {
                                                                                finalcallback(result);
                                                                            } else {
                                                                                finalcallback(callBackResponse);
                                                                            }
                                                                        });
                                                                    });
                                                                }
                                                            }
                                                        } catch (error) {
                                                            finalcallback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-50002', 'GetTableFromFXDB USERS callback function ', error));
                                                        }
                                                    });
                                                } else {
                                                    // Existing user
                                                    reqInstanceHelper.PrintInfo((strServiceName, 'U_id is available , going to update the selected user ', objLogInfo));
                                                    Updateuser(function (result) {
                                                        var updateValue = {
                                                            role_mode: roleMode
                                                        }
                                                        if (usergrpCode) {
                                                            updateValue.ug_code = usergrpCode
                                                        }
                                                        reqFXDBInstance.UpdateFXDB(mClient, 'app_users', updateValue, { appu_id: mappu_id }, objLogInfo, function (err, Res) {
                                                            reqFXDBInstance.UpdateFXDB(mClient, 'iv_app_users', updateValue, { appu_id: mappu_id }, objLogInfo, function (err, Res) {
                                                                CreateorUpdateAppUserRoles("EDIT", function (callBackResponse) {
                                                                    if (callBackResponse.STATUS === "SUCCESS") {
                                                                        finalcallback(result);
                                                                    } else {
                                                                        finalcallback(callBackResponse);
                                                                    }
                                                                });
                                                            })
                                                        });
                                                    });
                                                }


                                                function MultipleRoleInsert(Roles, CreationType, callback) {
                                                    var InsertArr = [];
                                                    var obj = {};
                                                    if (Roles == undefined) {
                                                        Roles = [];
                                                    }
                                                    var currentValue = '';
                                                    async.forEachOfSeries(Roles, function (value, key, callback1) {
                                                        currentValue = value;
                                                        try {
                                                            _UserAppRolesCount(function (appur_id) {
                                                                obj = {};
                                                                obj['appu_id'] = strUserDetails.appu_id.toString();
                                                                obj['appur_id'] = appur_id.toString();
                                                                obj['appr_id'] = currentValue == undefined ? "" : currentValue.toString();
                                                                obj['created_by'] = strUserID;
                                                                obj['created_date'] = reqDateFormater.GetTenantCurrentDateTime(pHeaders, objLogInfo);
                                                                obj['prct_id'] = prctID
                                                                InsertArr.push(obj);
                                                                callback1();
                                                            });
                                                            // }
                                                        } catch (error) { }
                                                    }, function (err) {
                                                        if (!err) {
                                                            //With Role Id from client side 
                                                            if (InsertArr.length > 0) {
                                                                var tabl = '';

                                                                if (makerCheckerModel == 'Y' && CreationType == 'EDIT') {
                                                                    tabl = 'iv_app_user_roles'

                                                                    reqFXDBInstance.InsertFXDB(mClient, tabl, InsertArr, objLogInfo, function (error, Iresult) {
                                                                        if (error) {
                                                                            callback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-50003', 'Insert app_user_roles Failed', error));
                                                                        } else {

                                                                            appuserSTSinsert(arrAppStsId, UNIQ_APPU_ID, CreationType, function (result) {
                                                                                if (result == 'SUCCESS') {


                                                                                    var rolmenucond = {
                                                                                        'login_name': strUserDetails.LOGIN_NAME,
                                                                                        'app_id': strAppid
                                                                                    }
                                                                                    reqFXDBInstance.DeleteFXDB(mClient, 'app_user_role_menus', rolmenucond, objLogInfo, function () {

                                                                                        if (roleMode == "ROLE_MENUS") {
                                                                                            insertIntoAppUserRoleMenu(function () {
                                                                                                callback(sendMethodResponse("SUCCESS", '', 'SUCCESS', '', '', '', 'SUCCESS'));
                                                                                            })
                                                                                        } else {

                                                                                            callback(sendMethodResponse("SUCCESS", '', 'SUCCESS', '', '', '', 'SUCCESS'));
                                                                                        }
                                                                                    })
                                                                                }
                                                                            });
                                                                        }
                                                                    });

                                                                }
                                                                else {
                                                                    multiappInsert(InsertArr, 'app_user_roles', function (result) {
                                                                        if (result == 'SUCCESS') {

                                                                            multiappInsert(InsertArr, 'iv_app_user_roles', function (result) {
                                                                                if (result == 'SUCCESS') {

                                                                                    appuserSTSinsert(arrAppStsId, UNIQ_APPU_ID, CreationType, function (result) {
                                                                                        if (result == 'SUCCESS') {

                                                                                            var rolmenucond = {
                                                                                                'login_name': strUserDetails.LOGIN_NAME,
                                                                                                'app_id': strAppid
                                                                                            }
                                                                                            reqFXDBInstance.DeleteFXDB(mClient, 'app_user_role_menus', rolmenucond, objLogInfo, function () {
                                                                                                if (roleMode == "ROLE_MENUS") {
                                                                                                    insertIntoAppUserRoleMenu(function () {
                                                                                                        callback(sendMethodResponse("SUCCESS", '', 'SUCCESS', '', '', '', 'SUCCESS'));
                                                                                                    })
                                                                                                } else {
                                                                                                    callback(sendMethodResponse("SUCCESS", '', 'SUCCESS', '', '', '', 'SUCCESS'));
                                                                                                }
                                                                                            })
                                                                                        }
                                                                                    })


                                                                                }
                                                                            });
                                                                        }
                                                                    });
                                                                }
                                                            } else {
                                                                //Without Role Id from client side 
                                                                callback(sendMethodResponse("SUCCESS", '', 'SUCCESS', '', '', '', 'SUCCESS'));
                                                            }

                                                        } else {
                                                            callback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-50003', 'Insert app_user_roles Failed', err));
                                                        }
                                                    });
                                                }



                                                function CreateorUpdateAppUserRoles(CreationType, callback) {
                                                    try {

                                                        if (usergrpCode && CreationType != 'CREATE') {
                                                            reqFXDBInstance.DeleteFXDB(mClient, 'iv_app_user_roles', { appu_id: mappu_id }, objLogInfo, function () {

                                                                reqFXDBInstance.DeleteFXDB(mClient, 'app_user_role_menus', { login_name: strUserDetails.LOGIN_NAME }, objLogInfo, function (pError, pResult) {
                                                                    if (pError) {

                                                                    } else {
                                                                        insertIntoAppUserRoleMenu(function () {
                                                                            callback(sendMethodResponse("SUCCESS", '', 'SUCCESS', '', '', '', 'SUCCESS'));
                                                                        })
                                                                    }
                                                                })
                                                            })
                                                        } else {
                                                            var apprIdARR = strUserDetails.appr_id;
                                                            if (CreationType == 'CREATE') {
                                                                MultipleRoleInsert(apprIdARR, CreationType, callback);
                                                            } else {
                                                                var appurId;
                                                                var appuid;
                                                                var selectquery = {
                                                                    //  query: `select * from app_users where u_id =? and app_id=? and status is null`,
                                                                    query: `select * from iv_app_users where u_id =? and app_id=? and status is null`,
                                                                    params: [strUserDetails.U_ID, strAppid]
                                                                }
                                                                reqFXDBInstance.ExecuteSQLQueryWithParams(mClient, selectquery, objLogInfo,
                                                                    function callbackDelete(appIDresult, appIDerror) {
                                                                        try {
                                                                            if (appIDerror) {

                                                                            } else {
                                                                                if (appIDresult.rows.length > 0) {
                                                                                    appuid = appIDresult.rows[0].appu_id;
                                                                                    if (makerCheckerModel == 'Y') {
                                                                                        // tabl = 'iv_app_user_roles'
                                                                                        reqFXDBInstance.DeleteFXDB(mClient, 'iv_app_user_roles', {
                                                                                            'appu_id': appuid,
                                                                                        }, objLogInfo, function (uError, uResult) {
                                                                                            if (uError) {
                                                                                                callback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-50003', 'Delete  app_user_roles Failed', uError));
                                                                                            } else {

                                                                                                var Roles = strUserDetails.appr_id;
                                                                                                strUserDetails.appr_id = appuid;
                                                                                                MultipleRoleInsert(Roles, CreationType, callback);
                                                                                            }
                                                                                        });
                                                                                    } else {

                                                                                        reqFXDBInstance.DeleteFXDB(mClient, 'app_user_roles', {
                                                                                            'appu_id': appuid,
                                                                                        }, objLogInfo, function (uError, uResult) {
                                                                                            if (uError) {
                                                                                                callback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-50003', 'Delete  app_user_roles Failed', uError));
                                                                                            } else {
                                                                                                reqFXDBInstance.DeleteFXDB(mClient, 'iv_app_user_roles', {
                                                                                                    'appu_id': appuid,
                                                                                                }, objLogInfo, function (uError, uResult) {
                                                                                                    if (uError) {
                                                                                                        callback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-50003', 'Delete  app_user_roles Failed', uError));
                                                                                                    } else {

                                                                                                        var Roles = strUserDetails.appr_id;
                                                                                                        strUserDetails.appr_id = appuid;
                                                                                                        MultipleRoleInsert(Roles, CreationType, callback);
                                                                                                    }
                                                                                                });
                                                                                            }
                                                                                        });
                                                                                    }
                                                                                } else {
                                                                                    callback(sendMethodResponse("FAILURE", '', '', '', 'No Data found for app user', '', '', ''));
                                                                                }
                                                                            }

                                                                        } catch (error) {

                                                                        }
                                                                    });
                                                            }
                                                        }

                                                    } catch (e) {
                                                        callback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-50003', 'Exception in app_user_roles', e));
                                                    }
                                                }
                                            } catch (error) {
                                                finalcallback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-50006', ' Exception occured while CreateUser function ', error));
                                            }
                                        }

                                        //Update the selected user
                                        function Updateuser(callbackupdateuser) {
                                            try {
                                                _PrepareJson(strUserDetails.STATIC_MODULE, function (res) {
                                                    try {
                                                        if (res.STATUS == 'FAILURE') {
                                                            callbackupdateuser(res);
                                                        } else {

                                                            var updateuserRow;
                                                            var updateStatus;

                                                            reqFXDBInstance.GetTableFromFXDB(mClient, 'users', ['status'], { 'u_id': strUserDetails.U_ID, 'client_id': strClientid }, objLogInfo, function (err, pResult) {

                                                                if (err) {
                                                                    finalcallback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-50001', 'GetTableFromFXDB USERS Failed', err));
                                                                } else {
                                                                    updateStatus = pResult.rows[0].status;
                                                                    if (makerCheckerModel == "Y") {

                                                                        if (updateStatus == 'READY_FOR_APPROVAL') {
                                                                            userActionDesc = 'CREATE_REQUEST';
                                                                        }
                                                                        else {
                                                                            userActionDesc = 'MODIFY_REQUEST';
                                                                        }

                                                                        updateuserRow = {
                                                                            'iv_first_name': strUserDetails.FIRST_NAME,
                                                                            'iv_middle_name': strUserDetails.MIDDLE_NAME,
                                                                            'iv_last_name': strUserDetails.LAST_NAME,
                                                                            'iv_email_id': strUserDetails.EMAIL_ID,
                                                                            'iv_allocated_ip': strUserDetails.ALLOCATED_IP,
                                                                            'iv_double_authentication': strUserDetails.DOUBLE_AUTHENTICATION,
                                                                            'iv_double_authentication_model': strUserDetails.DOUBLE_AUTHENTICATION_MODEL,
                                                                            'iv_water_marking': strUserDetails.NEED_WATERMARKING,
                                                                            'iv_is_enabled': strUserDetails.IS_ENABLED,
                                                                            'iv_session_timeout': strUserDetails.SESSION_TIMEOUT,
                                                                            'modified_by': strUserID,
                                                                            'modified_date': reqDateFormater.GetTenantCurrentDateTime(pHeaders, objLogInfo),
                                                                            'iv_mobile_no': strUserDetails.MOBILE_NUMBER,
                                                                            'iv_enforce_change_password': strUserDetails.ENFORCE_CHANGE_PWD,
                                                                            'allocated_static_module': sbUser.toString(),
                                                                            'iv_profile_pic': strUserDetails.PROFILE_PIC,
                                                                            'iv_start_active_date': strUserDetails.START_ACTIVE_DATE ? reqDateFormater.GetDateAt12AM(pHeaders, objLogInfo, strUserDetails.START_ACTIVE_DATE) : null,
                                                                            'iv_end_active_date': strUserDetails.END_ACTIVE_DATE ? reqDateFormater.GetDateAt12AM(pHeaders, objLogInfo, strUserDetails.END_ACTIVE_DATE) : null,
                                                                            // 'status': userStatus,
                                                                            'action_desc': userActionDesc,
                                                                            'approval_status': userApprovalStatus,
                                                                            'modified_by_name': objLogInfo.LOGIN_NAME,
                                                                            'prct_id': prctID
                                                                        }

                                                                    } else {
                                                                        userStatus = 'ACTIVE';

                                                                        updateuserRow = {
                                                                            'first_name': strUserDetails.FIRST_NAME,
                                                                            'middle_name': strUserDetails.MIDDLE_NAME,
                                                                            'last_name': strUserDetails.LAST_NAME,
                                                                            'email_id': strUserDetails.EMAIL_ID,
                                                                            'allocated_ip': strUserDetails.ALLOCATED_IP,
                                                                            'double_authentication': strUserDetails.DOUBLE_AUTHENTICATION,
                                                                            'double_authentication_model': strUserDetails.DOUBLE_AUTHENTICATION_MODEL,
                                                                            'water_marking': strUserDetails.NEED_WATERMARKING,
                                                                            'is_enabled': strUserDetails.IS_ENABLED,
                                                                            'session_timeout': strUserDetails.SESSION_TIMEOUT,
                                                                            'modified_by': strUserID,
                                                                            'modified_date': reqDateFormater.GetTenantCurrentDateTime(pHeaders, objLogInfo),
                                                                            'mobile_no': strUserDetails.MOBILE_NUMBER,
                                                                            'enforce_change_password': strUserDetails.ENFORCE_CHANGE_PWD,
                                                                            'allocated_static_module': sbUser.toString(),
                                                                            'profile_pic': strUserDetails.PROFILE_PIC,
                                                                            'start_active_date': strUserDetails.START_ACTIVE_DATE ? reqDateFormater.GetDateAt12AM(pHeaders, objLogInfo, strUserDetails.START_ACTIVE_DATE) : null,
                                                                            'end_active_date': strUserDetails.END_ACTIVE_DATE ? reqDateFormater.GetDateAt12AM(pHeaders, objLogInfo, strUserDetails.END_ACTIVE_DATE) : null,
                                                                            'status': userStatus,
                                                                            'action_desc': userActionDesc,
                                                                            'approval_status': userApprovalStatus,
                                                                            'modified_by_name': objLogInfo.LOGIN_NAME,
                                                                            'prct_id': prctID,

                                                                            'iv_first_name': strUserDetails.FIRST_NAME,
                                                                            'iv_middle_name': strUserDetails.MIDDLE_NAME,
                                                                            'iv_last_name': strUserDetails.LAST_NAME,
                                                                            'iv_email_id': strUserDetails.EMAIL_ID,
                                                                            'iv_allocated_ip': strUserDetails.ALLOCATED_IP,
                                                                            'iv_double_authentication': strUserDetails.DOUBLE_AUTHENTICATION,
                                                                            'iv_double_authentication_model': strUserDetails.DOUBLE_AUTHENTICATION_MODEL,
                                                                            'iv_water_marking': strUserDetails.NEED_WATERMARKING,
                                                                            'iv_is_enabled': strUserDetails.IS_ENABLED,
                                                                            'iv_session_timeout': strUserDetails.SESSION_TIMEOUT,
                                                                            'iv_mobile_no': strUserDetails.MOBILE_NUMBER,
                                                                            'iv_enforce_change_password': strUserDetails.ENFORCE_CHANGE_PWD,
                                                                            'iv_profile_pic': strUserDetails.PROFILE_PIC,
                                                                            'iv_start_active_date': strUserDetails.START_ACTIVE_DATE ? reqDateFormater.GetDateAt12AM(pHeaders, objLogInfo, strUserDetails.START_ACTIVE_DATE) : null,
                                                                            'iv_end_active_date': strUserDetails.END_ACTIVE_DATE ? reqDateFormater.GetDateAt12AM(pHeaders, objLogInfo, strUserDetails.END_ACTIVE_DATE) : null

                                                                        }
                                                                    }

                                                                    reqFXDBInstance.UpdateFXDB(mClient, 'users', updateuserRow, {
                                                                        'client_id': strClientid.toString(),
                                                                        'login_name': strUserDetails.LOGIN_NAME,
                                                                        'u_id': strUserDetails.U_ID
                                                                    }, objLogInfo, function callbackCreateUser(uError, uResult) {
                                                                        try {
                                                                            if (uError) {
                                                                                callbackupdateuser(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-50003', 'Update  USERS Failed', uError));
                                                                            } else {
                                                                                callbackupdateuser(sendMethodResponse("SUCCESS", '', 'SUCCESS', '', '', '', 'SUCCESS'));
                                                                            }
                                                                        } catch (error) {
                                                                            callbackupdateuser(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-50004', 'Exception occured while executing callbackCreateUser', error));
                                                                        }
                                                                    });
                                                                }
                                                            });
                                                        }
                                                    } catch (error) {
                                                        callbackupdateuser(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-50004', 'Exception occured while executing Updateuser  function ', error));
                                                    }
                                                });
                                            } catch (error) {
                                                callbackupdateuser(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-50005', ' Exception occured while executing GetTableFromFXDB USERS Failed', error));
                                            }
                                        }

                                        //Prepare private function to create New user
                                        function _CreateNewUser(callbacknewuser) {
                                            try {
                                                reqFXDBInstance.ExecuteQuery(mClient, TOTALUSERS, objLogInfo, function (err, uresult) {
                                                    try {
                                                        if (err) {
                                                            callbacknewuser(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-50007', 'Update tx_Total_items for users failed', err));
                                                        } else {
                                                            reqFXDBInstance.GetTableFromFXDB(mClient, 'fx_total_items', ['counter_value'], {
                                                                'code': 'USERS'
                                                            }, objLogInfo, function (err, cresult) {
                                                                if (err) {
                                                                    callbacknewuser(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-50008', 'Select  tx_Total_items for users failed', err));
                                                                } else { // get Newuser id
                                                                    UNIQ_U_ID = cresult.rows[0].counter_value;
                                                                    var pPassword = strUserDetails.PASSWORD;
                                                                    _PrepareJson(strUserDetails.STATIC_MODULE, function (res) {
                                                                        if (res.STATUS == 'FAILURE') {
                                                                            callbacknewuser(res);
                                                                        } else {
                                                                            //Insert new user function call
                                                                            insertusert(pPassword, function (result) {
                                                                                callbacknewuser(result);
                                                                            });
                                                                        }
                                                                    });
                                                                }
                                                            });
                                                        }
                                                    } catch (error) {
                                                        callbacknewuser(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-50009', 'Exception occured while Select  tx_Total_items for users failed', error));
                                                    }
                                                });
                                            } catch (error) {
                                                callbacknewuser(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-50010', 'Exception occured while executing _CreateNewUser function ', error));
                                            }
                                        }

                                        function _PrepareJson(pStaticModule, callbackjson) {
                                            reqInstanceHelper.PrintInfo(strServiceName, '_PrepareJson function executing... To prepar staticModule   ', objLogInfo);
                                            try {
                                                sbUser.append("[");
                                                var staticModule = strUserDetails.STATIC_MODULE;
                                                //prepare JSON for allocated_static_module column 
                                                for (var i = 0; i < staticModule.length; i++) {
                                                    if (i > 0) {
                                                        sbUser.append(",");
                                                    }
                                                    sbUser.append("{");
                                                    sbUser.appendFormat("\"CODE\":\"{0}\",\"DESC\":\"{1}\"", staticModule[i].CODE, staticModule[i].DESC);
                                                    sbUser.append("}");
                                                }
                                                sbUser.append("]");
                                                callbackjson(sbUser);
                                            } catch (error) {
                                                callbackjson(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-50011', 'Exception Occured while executing _PrepareJson function  ', error));
                                            }
                                        }

                                        //Insert new user function prepare
                                        function insertusert(pPassword, callbackinsertuser) {
                                            try {
                                                var dynamicPwd = newUserCreationSetup.DYNAMIC_PASSWORD_CREATION;
                                                userStatus = 'ACTIVE';
                                                if (dynamicPwd && dynamicPwd == "Y" && makerCheckerModel && makerCheckerModel == 'Y') {
                                                    //In this case we need to create user without password.
                                                    //While approve password will generate and send alert to user

                                                    reqInstanceHelper.PrintInfo(strServiceName, '----- > dynamicPwd -| Y and  makerCheckerModel | Y', objLogInfo);
                                                    reqInstanceHelper.PrintInfo(strServiceName, 'No need to send an alert to user..', objLogInfo);
                                                    pPassword = '';
                                                    userStatus = "READY_FOR_APPROVAL";
                                                    userActionDesc = "CREATE_REQUEST";
                                                    InsertProcess();

                                                } else if (makerCheckerModel && dynamicPwd == "Y" && makerCheckerModel && makerCheckerModel == 'N') {
                                                    // create dynamic password and send alert to user with dynamic password
                                                    reqEncHelper.GetDynamicPwd(passwordPolicy, objLogInfo, function (dynampswrd) {
                                                        reqInstanceHelper.PrintInfo(strServiceName, 'Got the dynamic Password', objLogInfo);
                                                        pPassword = reqEncHelper.passwordHash256(dynampswrd);
                                                        strUserDetails.ENFORCE_CHANGE_PWD = 'Y';
                                                        var pCommdata = {};
                                                        pCommdata.TEMP_PWD = dynampswrd;
                                                        pCommdata.LOGIN_NAME = strUserDetails.LOGIN_NAME;
                                                        pCommdata.PASSWORD = strUserDetails.PASSWORD;
                                                        pCommdata.TO_MAIL_ADDRESS = strUserDetails.EMAIL_ID;
                                                        pCommdata.TO_MOBILE_NO = strUserDetails.MOBILE_NUMBER;
                                                        pCommdata.COMMG_CODE = newUserCreationSetup.COMMUNICATION_GROUP_CODE;
                                                        sendalertTouser(pCommdata, function (res) {
                                                            InsertProcess();
                                                        });
                                                    });
                                                } else if (dynamicPwd && dynamicPwd == "N" && makerCheckerModel && makerCheckerModel == 'Y') {
                                                    userStatus = "READY_FOR_APPROVAL";
                                                    userActionDesc = "CREATE_REQUEST"
                                                    InsertProcess();
                                                } else if (dynamicPwd && dynamicPwd == "N" && makerCheckerModel && makerCheckerModel == 'N') {
                                                    userStatus = "ACTIVE";
                                                    InsertProcess();
                                                }


                                                function InsertProcess() {
                                                    var InsertObj = [{
                                                        'client_id': strClientid.toString(),
                                                        'u_id': UNIQ_U_ID.toString(),
                                                        'first_name': strUserDetails.FIRST_NAME,
                                                        'middle_name': strUserDetails.MIDDLE_NAME,
                                                        'last_name': strUserDetails.LAST_NAME,
                                                        'login_name': strUserDetails.LOGIN_NAME.toUpperCase(),
                                                        'email_id': strUserDetails.EMAIL_ID,
                                                        'allocated_ip': strUserDetails.ALLOCATED_IP,
                                                        'login_password': pPassword,
                                                        'double_authentication': strUserDetails.DOUBLE_AUTHENTICATION,
                                                        'double_authentication_model': strUserDetails.DOUBLE_AUTHENTICATION_MODEL,
                                                        'water_marking': strUserDetails.NEED_WATERMARKING,
                                                        'session_timeout': strUserDetails.SESSION_TIMEOUT,
                                                        'created_by': strUserID.toString(),
                                                        'mobile_no': strUserDetails.MOBILE_NUMBER,
                                                        'created_date': reqDateFormater.GetTenantCurrentDateTime(pHeaders, objLogInfo),
                                                        'enforce_change_password': strUserDetails.ENFORCE_CHANGE_PWD,
                                                        'allocated_static_module': sbUser.toString(),
                                                        'profile_pic': strUserDetails.PROFILE_PIC,
                                                        'start_active_date': strUserDetails.START_ACTIVE_DATE ? reqDateFormater.GetDateAt12AM(pHeaders, objLogInfo, strUserDetails.START_ACTIVE_DATE) : null,
                                                        'end_active_date': strUserDetails.END_ACTIVE_DATE ? reqDateFormater.GetDateAt12AM(pHeaders, objLogInfo, strUserDetails.END_ACTIVE_DATE) : null,
                                                        'status': userStatus,
                                                        'action_desc': userActionDesc,
                                                        'created_by_name': objLogInfo.LOGIN_NAME,
                                                        'prct_id': prctID,
                                                        'is_external': IsExternal,
                                                        'app_user_role_menus': APPUR_MENU_SETUP,
                                                        'is_enabled': strUserDetails.IS_ENABLED,
                                                        'iv_is_enabled': strUserDetails.IS_ENABLED,
                                                        'iv_first_name': strUserDetails.FIRST_NAME,
                                                        'iv_middle_name': strUserDetails.MIDDLE_NAME,
                                                        'iv_last_name': strUserDetails.LAST_NAME,
                                                        'iv_login_name': strUserDetails.LOGIN_NAME.toUpperCase(),
                                                        'iv_email_id': strUserDetails.EMAIL_ID,
                                                        'iv_allocated_ip': strUserDetails.ALLOCATED_IP,
                                                        'iv_login_password': pPassword,
                                                        'iv_double_authentication': strUserDetails.DOUBLE_AUTHENTICATION,
                                                        'iv_double_authentication_model': strUserDetails.DOUBLE_AUTHENTICATION_MODEL,
                                                        'iv_water_marking': strUserDetails.NEED_WATERMARKING,
                                                        'iv_session_timeout': strUserDetails.SESSION_TIMEOUT,
                                                        'iv_mobile_no': strUserDetails.MOBILE_NUMBER,
                                                        'iv_enforce_change_password': strUserDetails.ENFORCE_CHANGE_PWD,
                                                        'iv_profile_pic': strUserDetails.PROFILE_PIC,
                                                        'iv_start_active_date': strUserDetails.START_ACTIVE_DATE ? reqDateFormater.GetDateAt12AM(pHeaders, objLogInfo, strUserDetails.START_ACTIVE_DATE) : null,
                                                        'iv_end_active_date': strUserDetails.END_ACTIVE_DATE ? reqDateFormater.GetDateAt12AM(pHeaders, objLogInfo, strUserDetails.END_ACTIVE_DATE) : null,
                                                    }];

                                                    var serviceModel = reqFXDBInstance.DBInstanceSession['SERVICE_MODEL'];
                                                    if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
                                                        InsertObj[0]['system_id'] = strSID;
                                                        InsertObj[0]['tenant_id'] = strTenantId;
                                                    }

                                                    reqInstanceHelper.PrintInfo(strServiceName, 'Insertusert function executing... ', objLogInfo);
                                                    reqFXDBInstance.InsertFXDB(mClient, 'users', InsertObj, objLogInfo, function callbackInsertFXDB(err, Iresult) {
                                                        try {
                                                            if (err) {
                                                                return callbackinsertuser(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-50012', 'insertusert function failed to insert users table ', err));
                                                            }
                                                            var strUserid = strUserID.toString();
                                                            reqInstanceHelper.PrintInfo(strServiceName, 'User insert success, Gogin to insert user_password_log table ', objLogInfo);
                                                            if (!pPassword) {
                                                                pPassword = 'TEMP_PASSWORD';
                                                            }
                                                            reqFXDBInstance.InsertFXDB(mClient, 'user_password_log', [{
                                                                'u_id': UNIQ_U_ID.toString(),
                                                                'new_password': pPassword,
                                                                'created_date': reqDateFormater.GetTenantCurrentDateTime(pHeaders, objLogInfo),
                                                                'created_by': strUserid
                                                            }], objLogInfo, function callbackErr(err) {
                                                                try {
                                                                    if (err) {
                                                                        return callbackinsertuser(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-50013', 'insertusert function failed to insert user_password_log table ', err));
                                                                    } else {
                                                                        reqInstanceHelper.PrintInfo(strServiceName, 'user_password_log insert success, Gogin to last_pwd_creation table ', objLogInfo);
                                                                        reqFXDBInstance.InsertFXDB(mClient, 'last_pwd_creation', [{
                                                                            'u_id': UNIQ_U_ID.toString(),
                                                                            'last_created_date': reqDateFormater.GetTenantCurrentDateTime(pHeaders, objLogInfo),
                                                                            'last_created_pwds': pPassword,
                                                                            'prct_id': prctID
                                                                        }], objLogInfo, function callbackErr(err) {
                                                                            try {
                                                                                if (err) {
                                                                                    return callbackinsertuser(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-50014', 'insertusert function failed to insert last_pwd_creation table ', err));
                                                                                } else {
                                                                                    reqInstanceHelper.PrintInfo(strServiceName, 'Insert result last_pwd_creation SUCCESS ', objLogInfo);
                                                                                    var serviceModel = reqFXDBInstance.DBInstanceSession['SERVICE_MODEL'];
                                                                                    reqInstanceHelper.PrintInfo(strServiceName, ' serviceModel is : ' + serviceModel.TYPE, objLogInfo);
                                                                                    if (serviceModel) {
                                                                                        if (serviceModel.TYPE == 'LITE') {
                                                                                            reqInstanceHelper.PrintInfo(strServiceName, ' ServiceModel is LITE, No need to create KONG user ,appuserinsert function will call to insert into app_users table.  ' + serviceModel, objLogInfo);
                                                                                            appuserinsert(function (result) {
                                                                                                callbackinsertuser(result);
                                                                                            });
                                                                                        } else {
                                                                                            createKongUser(function (res) {
                                                                                                callbackinsertuser(res);
                                                                                            });
                                                                                        }
                                                                                    } else {
                                                                                        createKongUser(function (res) {
                                                                                            callbackinsertuser(res);
                                                                                        });
                                                                                    }

                                                                                    //Create user in KONG
                                                                                    function createKongUser(callbackKong) {
                                                                                        try {
                                                                                            reqInstanceHelper.PrintInfo(strServiceName, 'createKongUser function executing... ', objLogInfo);
                                                                                            KongHelper.CreateKongUser(UNIQ_U_ID.toString(), strUserDetails.LOGIN_NAME.toUpperCase(), mKongClient, function (kongRes) {
                                                                                                if (kongRes.status == 'SUCCESS')
                                                                                                    strResult = 'SUCCESS';
                                                                                                else {
                                                                                                    strResult = kongRes.status;
                                                                                                    reqInstanceHelper.PrintInfo(strServiceName, 'User Created BUt Kong User Not Created ', objLogInfo);
                                                                                                }
                                                                                                appuserinsert(function (result) {
                                                                                                    callbackKong(result);
                                                                                                });
                                                                                            });
                                                                                        } catch (error) {
                                                                                            callbackinsertuser(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-50026', 'Exception occured while createKongUser function   ', error));
                                                                                        }
                                                                                    }

                                                                                }
                                                                            } catch (error) {
                                                                                callbackinsertuser(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-50015', 'Exception occured while executing last_pwd_creation callbackErr  ', error));
                                                                            }
                                                                        });
                                                                    }
                                                                } catch (error) {
                                                                    callbackinsertuser(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-50016', 'Exception occured while executing callbackErr function  ', error));
                                                                }
                                                            });
                                                        } catch (error) {
                                                            callbackinsertuser(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-50017', 'insertusert function failed to update  insert user table ', error));
                                                        }
                                                    });
                                                }



                                            } catch (error) {
                                                callbackinsertuser(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-50018', 'Exception occured while executing insertusert function  ', error));
                                            }
                                        }

                                        function appuserSTSinsert(appstsid, UNIQ_APPU_ID, event, callbackappuserstsinsert) {
                                            try {
                                                if (showclustersystem == 'Y') {
                                                    if (appstsid.length > 0) {
                                                        if (event == 'EDIT' && makerCheckerModel == 'N') {
                                                            reqFXDBInstance.DeleteFXDB(mClient, 'app_user_sts', {
                                                                'appu_id': UNIQ_APPU_ID
                                                            }, objLogInfo, function callbackdelausts(uError, uResult) {
                                                                if (uError) {
                                                                    return callbackappuserstsinsert(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-50003', 'Delete  app_user_sts Failed', uError));
                                                                } else {

                                                                }
                                                            })
                                                        }
                                                        reqInstanceHelper.PrintInfo(strServiceName, ' appusersts delete function executing.. ', objLogInfo);
                                                        reqFXDBInstance.DeleteFXDB(mClient, 'iv_app_user_sts', {
                                                            'appu_id': UNIQ_APPU_ID
                                                        }, objLogInfo, function callbackdelausts(uError, uResult) {
                                                            if (uError) {
                                                                return callbackappuserstsinsert(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-50003', 'Delete  app_user_sts Failed', uError));
                                                            } else {

                                                                var appuserstsrow = [];
                                                                var obj = {};
                                                                var currentValue = '';
                                                                async.forEachOfSeries(appstsid, function (value, key, appuserstsCallback) {
                                                                    currentValue = value;
                                                                    fx_total_item('APP_USER_STS', function (Uniqueid) {
                                                                        var appUStsID = Uniqueid.toString();
                                                                        obj = {};
                                                                        obj['appu_id'] = UNIQ_APPU_ID.toString();
                                                                        obj['appusts_id'] = appUStsID;
                                                                        obj['appsts_id'] = currentValue == undefined ? "" : currentValue.toString();
                                                                        obj['created_by'] = strUserID
                                                                        obj['created_date'] = reqDateFormater.GetTenantCurrentDateTime(pHeaders, objLogInfo)
                                                                        appuserstsrow.push(obj);
                                                                        appuserstsCallback();
                                                                    });
                                                                }, function (err) {
                                                                    if (!err) {
                                                                        reqInstanceHelper.PrintInfo(strServiceName, ' appuserstsinsert function executing.. ', objLogInfo);
                                                                        if (event == 'EDIT' && makerCheckerModel == 'Y') {
                                                                            reqFXDBInstance.InsertFXDB(mClient, 'iv_app_user_sts', appuserstsrow, objLogInfo, function callbackinsts(err) {
                                                                                if (err) {
                                                                                    return callbackappuserstsinsert(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-50021', 'appuserstsinsert function failed to insert app_user_sts table ', err));
                                                                                } else {
                                                                                    callbackappuserstsinsert("SUCCESS");
                                                                                }
                                                                            })
                                                                        }
                                                                        else {

                                                                            reqFXDBInstance.InsertFXDB(mClient, 'app_user_sts', appuserstsrow, objLogInfo, function callbackinusersts(err) {
                                                                                reqFXDBInstance.InsertFXDB(mClient, 'iv_app_user_sts', appuserstsrow, objLogInfo, function callbackinusersts(err) {
                                                                                    if (err) {
                                                                                        return callbackappuserstsinsert(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-50021', 'appuserstsinsert function failed to insert app_user_sts table ', err));
                                                                                    } else {
                                                                                        callbackappuserstsinsert("SUCCESS");
                                                                                    }
                                                                                })
                                                                            })
                                                                        }
                                                                    }
                                                                })
                                                            }

                                                        })
                                                    }
                                                    else {
                                                        callbackappuserstsinsert("SUCCESS");
                                                    }
                                                }
                                                else {
                                                    callbackappuserstsinsert("SUCCESS");
                                                }

                                            } catch (error) {
                                                callbackappuserstsinsert(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-50022', ' Exception occured while executing  callbackappusersts function  ', error));
                                            }
                                        }

                                        // insert into app_users table.(Assign application done)
                                        function appuserinsert(callbackappuserinsert) {
                                            try {
                                                reqInstanceHelper.PrintInfo(strServiceName, ' appuserinsert function executing.. ', objLogInfo);
                                                reqFXDBInstance.ExecuteQuery(mClient, TOTALAPP_USERS, objLogInfo, function callbacktotappu(err) {
                                                    try {
                                                        if (err) {
                                                            return callbackappuserinsert(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-50019', 'appuserinsert function failed to update  fx_total_items table ', err));
                                                        } else {
                                                            reqFXDBInstance.GetTableFromFXDB(mClient, 'fx_total_items', ['counter_value'], {
                                                                'code': 'APP_USERS'
                                                            }, objLogInfo, function callbackappuct(err, res) {
                                                                try {
                                                                    if (err) {
                                                                        return callbackappuserinsert(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-50020', 'appuserinsert function failed to select   fx_total_items table ', err));
                                                                    } else {
                                                                        var ctrval = res.rows;
                                                                        UNIQ_APPU_ID = ctrval[0].counter_value.toString();
                                                                        strUserDetails.appu_id = UNIQ_APPU_ID.toString();
                                                                        var appuserRow = [{
                                                                            'u_id': UNIQ_U_ID.toString(),
                                                                            'app_id': strAppid,
                                                                            'appu_id': UNIQ_APPU_ID.toString(),
                                                                            'created_by': strUserID,
                                                                            'created_date': reqDateFormater.GetTenantCurrentDateTime(pHeaders, objLogInfo)
                                                                        }]

                                                                        if (usergrpCode && roleMode == 'USER_GROUP') {
                                                                            appuserRow[0].ug_code = usergrpCode
                                                                        } else {
                                                                            appuserRow[0].role_mode = roleMode
                                                                        }


                                                                        reqFXDBInstance.InsertFXDB(mClient, 'app_users', appuserRow, objLogInfo, function callbackinsappu(err) {
                                                                            reqFXDBInstance.InsertFXDB(mClient, 'iv_app_users', appuserRow, objLogInfo, function callbackinsappu(err) {
                                                                                if (err) {
                                                                                    return callbackappuserinsert(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-50021', 'appuserinsert function failed to insert app_users table ', err));
                                                                                } else {
                                                                                    reqInstanceHelper.PrintInfo(strServiceName, '*********** User created successfully***********', objLogInfo);

                                                                                    // insert appusersts

                                                                                    //     for(var i=0;i<arrAppStsId.length;i++){
                                                                                    //     appuserSTSinsert(arrAppStsId[i],UNIQ_APPU_ID,'CREATE',function(result) {
                                                                                    //         callbackappuserinsert(result);
                                                                                    //     });
                                                                                    // }  

                                                                                    appuserSTSinsert(arrAppStsId, UNIQ_APPU_ID, 'CREATE', function (result) {
                                                                                        if (result == 'SUCCESS') {
                                                                                            if (strUserDetails.appr_id) {
                                                                                                reqFXDBInstance.GetTableFromFXDB(mClient, 'app_roles', ['role_description'], {
                                                                                                    appr_id: strUserDetails.appr_id
                                                                                                }, objLogInfo, function callbackappuct(err, res) {
                                                                                                    if (err) {
                                                                                                        return callbackappuserinsert(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-50032', 'Error While Querying app_roles Table ', err));
                                                                                                    } else {
                                                                                                        var role_description = '';
                                                                                                        if (res.rows.length) {
                                                                                                            role_description = res.rows[0].role_description;
                                                                                                        }

                                                                                                        if (tenantSetupJson) {
                                                                                                            var objUserData = {
                                                                                                                u_id: UNIQ_U_ID.toString(),
                                                                                                                created_by: strUserID,
                                                                                                                created_by_name: strUserName,
                                                                                                                system_name: strSDesc,
                                                                                                                system_id: strSID,
                                                                                                                created_date: reqDateFormater.GetTenantCurrentDateTime(pHeaders, objLogInfo),
                                                                                                                dt_code: tenantSetupJson.DT_CODE,
                                                                                                                process_status: tenantSetupJson.PROCESS_STATUS,
                                                                                                                status: userStatus,
                                                                                                                //action_desc: userActionDesc,
                                                                                                                approval_status: userApprovalStatus,
                                                                                                                dtt_code: tenantSetupJson.DTT_CODE,
                                                                                                                first_name: strUserDetails.FIRST_NAME.toUpperCase(),
                                                                                                                login_name: strUserDetails.LOGIN_NAME.toUpperCase(),
                                                                                                                last_name: strUserDetails.LAST_NAME.toUpperCase(),
                                                                                                                middle_name: strUserDetails.MIDDLE_NAME,
                                                                                                                email_id: strUserDetails.EMAIL_ID,
                                                                                                                mobile_no: strUserDetails.MOBILE_NUMBER,
                                                                                                                role_id: JSON.stringify(strUserDetails.appr_id),
                                                                                                                role_name: role_description,
                                                                                                                tenant_id: objLogInfo.TENANT_ID
                                                                                                            };
                                                                                                            reqInstanceHelper.PrintInfo(strServiceName, 'check tenant_id is tenant_id available or not in Dttinfo table ', objLogInfo);
                                                                                                            // get dtt info table to check tenant_id column is available or not
                                                                                                            GetDttInfo(tenantSetupJson.DTT_CODE, function (dttinfoRes) {
                                                                                                                if (dttinfoRes.status == 'SUCCESS' && dttinfoRes.istenantavail) {
                                                                                                                    objUserData.tenant_id = objLogInfo.TENANT_ID;
                                                                                                                }
                                                                                                                var objTargetInsert = {
                                                                                                                    Target_table: tenantSetupJson.TARGET_TABLE || 'Thers_Is_No_Target_Table_From_Tenant_Setup',
                                                                                                                    Target_table_data: [objUserData],
                                                                                                                    tran_db_instance: trandbInstance
                                                                                                                };
                                                                                                                TargetTableInsert(objTargetInsert, objLogInfo, function (pResult, error) {
                                                                                                                    if (error) {
                                                                                                                        callbackappuserinsert(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-50027', ' Exception occured while Inserting into Target Table from Tenant Setup Json...', error));
                                                                                                                    } else {
                                                                                                                        callbackappuserinsert(sendMethodResponse("SUCCESS", '', 'SUCCESS', '', '', '', 'SUCCESS'));
                                                                                                                    }
                                                                                                                });

                                                                                                            });
                                                                                                        } else {
                                                                                                            callbackappuserinsert(sendMethodResponse("SUCCESS", '', 'SUCCESS', '', '', '', 'SUCCESS'));
                                                                                                        }
                                                                                                    }
                                                                                                });
                                                                                            } else {
                                                                                                var role_description = '';
                                                                                                if (tenantSetupJson) {
                                                                                                    var objUserData = {
                                                                                                        u_id: UNIQ_U_ID.toString(),
                                                                                                        created_by: strUserID,
                                                                                                        created_by_name: strUserName,
                                                                                                        system_name: strSDesc,
                                                                                                        system_id: strSID,
                                                                                                        created_date: reqDateFormater.GetTenantCurrentDateTime(pHeaders, objLogInfo),
                                                                                                        dt_code: tenantSetupJson.DT_CODE,
                                                                                                        process_status: tenantSetupJson.PROCESS_STATUS,
                                                                                                        status: userStatus,
                                                                                                        // action_desc:userActionDesc,
                                                                                                        approval_status: userApprovalStatus,
                                                                                                        dtt_code: tenantSetupJson.DTT_CODE,
                                                                                                        first_name: strUserDetails.FIRST_NAME.toUpperCase(),
                                                                                                        login_name: strUserDetails.LOGIN_NAME.toUpperCase(),
                                                                                                        last_name: strUserDetails.LAST_NAME.toUpperCase(),
                                                                                                        middle_name: strUserDetails.MIDDLE_NAME,
                                                                                                        email_id: strUserDetails.EMAIL_ID,
                                                                                                        mobile_no: strUserDetails.MOBILE_NUMBER || "NULL",
                                                                                                        role_id: JSON.stringify(strUserDetails.appr_id),
                                                                                                        role_name: role_description,
                                                                                                        tenant_id: objLogInfo.TENANT_ID,
                                                                                                        start_active_date: strUserDetails.START_ACTIVE_DATE ? reqDateFormater.GetDateAt12AM(pHeaders, objLogInfo, strUserDetails.START_ACTIVE_DATE) : null,
                                                                                                        end_active_date: strUserDetails.END_ACTIVE_DATE ? reqDateFormater.GetDateAt12AM(pHeaders, objLogInfo, strUserDetails.END_ACTIVE_DATE) : null,
                                                                                                    };
                                                                                                    reqInstanceHelper.PrintInfo(strServiceName, 'check tenant_id is tenant_id available or not in Dttinfo table ', objLogInfo);
                                                                                                    // get dtt info table to check tenant_id column is available or not
                                                                                                    GetDttInfo(tenantSetupJson.DTT_CODE, function (dttinfoRes) {
                                                                                                        if (dttinfoRes.status == 'SUCCESS' && dttinfoRes.istenantavail) {
                                                                                                            objUserData.tenant_id = objLogInfo.TENANT_ID;
                                                                                                        }
                                                                                                        var objTargetInsert = {
                                                                                                            Target_table: tenantSetupJson.TARGET_TABLE || 'Thers_Is_No_Target_Table_From_Tenant_Setup',
                                                                                                            Target_table_data: [objUserData],
                                                                                                            tran_db_instance: trandbInstance
                                                                                                        };
                                                                                                        TargetTableInsert(objTargetInsert, objLogInfo, function (pResult, error) {
                                                                                                            if (error) {
                                                                                                                callbackappuserinsert(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-50027', ' Exception occured while Inserting into Target Table from Tenant Setup Json...', error));
                                                                                                            } else {
                                                                                                                callbackappuserinsert(sendMethodResponse("SUCCESS", '', 'SUCCESS', '', '', '', 'SUCCESS'));
                                                                                                            }
                                                                                                        });

                                                                                                    });
                                                                                                } else {
                                                                                                    callbackappuserinsert(sendMethodResponse("SUCCESS", '', 'SUCCESS', '', '', '', 'SUCCESS'));
                                                                                                }
                                                                                            }
                                                                                        }
                                                                                    });


                                                                                }
                                                                            });
                                                                        });
                                                                    }
                                                                } catch (error) {
                                                                    callbackappuserinsert(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-50022', ' Exception occured while executing  callbackappuct function  ', error));
                                                                }
                                                            });
                                                        }
                                                    } catch (error) {
                                                        callbackappuserinsert(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-50023', 'Exception occured while executing  appuserinsert function failed to insert app_users table ', error));
                                                    }
                                                });
                                            } catch (error) {
                                                callbackappuserinsert(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-50024', 'Exception occured while executing  appuserinsert function, Failed to insert app_users table ', error));
                                            }
                                        }


                                        function GetDttInfo(strDTTCODE, dttinfocallback) {
                                            try {
                                                var dttInfoRes = {};
                                                reqFXDBInstance.GetTableFromFXDB(depClient, 'DTT_INFO', ['DTT_DFD_JSON'], {
                                                    DTT_CODE: strDTTCODE
                                                }, objLogInfo, function callbackres(err, res) {
                                                    var strDttDfd = '';
                                                    if (err) {
                                                        dttInfoRes.status = 'FAILURE';
                                                        dttInfoRes.error = err;
                                                        dttinfocallback(dttInfoRes);
                                                    } else {
                                                        if (res.rows.length) {
                                                            dttInfoRes.status = 'SUCCESS';
                                                            dttInfoRes.istenantavail = false;
                                                            if (res.rows[0]['dtt_dfd_json'].indexOf("TENANT_ID") > -1) {
                                                                dttInfoRes.istenantavail = true;
                                                            }
                                                            dttinfocallback(dttInfoRes);
                                                        }
                                                    }
                                                });

                                            } catch (error) {

                                            }
                                        }
                                        async function sendalertTouser(pPrams, pcallback) {
                                            try {
                                                //_PrintInfo('Entered into SendAlertToUser Function');
                                                var pReqBody = {};
                                                var PrctId = "USER" + new Date().getMilliseconds() * 11111;
                                                sessionInfo.NEED_PERSIST = true;
                                                sessionInfo.TEMPLATE_FROM = "SETUP";
                                                var arrATMTData = [{
                                                    COMMMG_CODE: pPrams.COMMG_CODE,
                                                    dt_code: 'USERS',
                                                    dtt_code: 'USERS',
                                                    PRCT_ID: prctID,
                                                    WFTPA_ID: 'DEFAULT',
                                                    from_scheduler: 'N',
                                                    EVENT_CODE: 'DEFAULT',
                                                    session_info: sessionInfo,
                                                    STATIC_DATA: { "LOGIN_NAME": pPrams.LOGIN_NAME, "MESSAGE_VALUE": pPrams.TEMP_PWD, 'TO_EMAIL_ID': pPrams.TO_MAIL_ADDRESS, 'TO_MOBILE_NO': pPrams.TO_MOBILE_NO },
                                                    tenant_id: objLogInfo.TENANT_ID,
                                                    app_id: objLogInfo.APP_ID,
                                                    routingkey: objLogInfo.ROUTINGKEY

                                                }];
                                                var u_name = pPrams.LOGIN_NAME.toUpperCase()
                                                var pdfFilePath = `${u_name}_Credentials.pdf`;
                                                var ATMT_DETAILS = [{
                                                    'FILE_NAME': pdfFilePath,
                                                    'TRN_ID': UNIQ_U_ID
                                                }]
                                                var User_Details = [{
                                                    'LOGIN_NAME': pPrams.LOGIN_NAME,
                                                    'TEMP_PASSWORD': pPrams.TEMP_PWD
                                                }]
                                                var pswd = pPrams.TO_MOBILE_NO.slice(-4);

                                                var user_data = formattedString = Object.entries(User_Details[0])
                                                    .map(([key, value]) => `"${key}":"${value}"`)
                                                    .join(',\n');
                                                var encryptionOptions = {
                                                    userPassword: pswd,
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
                                                        'trn_id': UNIQ_U_ID
                                                    }], objLogInfo, async function callbackErr(err) {
                                                        if (err) {
                                                            reqInstanceHelper.PrintError(pConsumerName, objLogInfo, ' ERR-ATMT-001', 'Error in COMM_PROCESS_ATMT', error);
                                                        } else {

                                                            // Comm process data  table insert
                                                            pReqBody.COMMM_CODE = pPrams.COMMG_CODE;
                                                            pReqBody.TEMPLATECODE = pPrams.COMMG_CODE;
                                                            pReqBody['ATMT_DATA'] = JSON.stringify(ATMT_DETAILS);
                                                            pReqBody.SESSION_ID = pHeaders['session-id'];
                                                            pReqBody.WFTPA_ID = 'DEFAULT';
                                                            pReqBody.DT_CODE = 'DEFAULT';
                                                            pReqBody.DTT_CODE = 'DEFAULT';
                                                            pReqBody.EVENT_CODE = 'DEFAULT';
                                                            pReqBody.PRCT_ID = prctID;
                                                            pReqBody.STATIC_DATA = { "LOGIN_NAME": pPrams.LOGIN_NAME, "MESSAGE_VALUE": pPrams.TEMP_PWD, 'TO_EMAIL_ID': pPrams.TO_MAIL_ADDRESS, 'TO_MOBILE_NO': pPrams.TO_MOBILE_NO };
                                                            pReqBody.SKIP_COMM_FLOW = true;
                                                            pReqBody.ATMT_DETAILS = JSON.stringify(ATMT_DETAILS);
                                                            var commReq = {};
                                                            commReq.PARAMS = pReqBody;
                                                            commReq.PROCESS_INFO = objLogInfo.PROCESS_INFO
                                                            commReq.SESSION_ID = pHeaders['session-id'];

                                                            var RedisURLKey = "NGINX_HAPROXY_URL";
                                                            var URLPrecedence = "";
                                                            URLPrecedence = serviceModel.NODEFS_URL;
                                                            var allPorts = await getPortNumber()
                                                            var CommPort = allPorts.ServicePort['Communication']
                                                            URLPrecedence = URLPrecedence.replace('<service_port>', CommPort);
                                                            var res = await clientR.get(RedisURLKey)
                                                            URLPrecedence = JSON.parse(res)["url"];
                                                            var ngxUrl = URLPrecedence.split("microsvc")[0];
                                                            var uri = URLPrecedence + "/Communication/SendMessage/";
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

                                                            // _PrintInfo('App Request', +commReq);
                                                            // _PrintInfo('Going to Call SendMessage API');
                                                            request(options, function (err, httpResponse, resbody) {
                                                                try {
                                                                    if (err) {
                                                                        console.log(err);
                                                                        pcallback(err);
                                                                    } else {
                                                                        pcallback();

                                                                    }
                                                                } catch (error) {
                                                                    console.log(error);
                                                                }
                                                            });
                                                        }
                                                    })
                                                });

                                            } catch (error) {
                                                console.log(error);
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
                                    });
                                } catch (error) {
                                    console.log(error);
                                }
                            }
                        });
                    })
                })

            } catch (error) {
                return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50025', 'Exception occured while executing  CreateUser function ', error, '', '');
            };
        });
    });
});



// Tenant Setup Target Table Insert
function TargetTableInsert(pReqObj, objLogInfo, TargetTableInsertCB) {
    try {
        if (pReqObj.Target_table == "Thers_Is_No_Target_Table_From_Tenant_Setup") {
            TargetTableInsertCB("SUCCESS", null);
        } else {
            var targetTable = pReqObj.Target_table;
            var tran_db_instance = pReqObj.tran_db_instance;
            delete pReqObj.Target_table_data[0].approval_status;
            var targetTableData = pReqObj.Target_table_data || [];
            reqTranDBHelper.InsertTranDBWithAudit(tran_db_instance, targetTable, targetTableData, objLogInfo, function (pResult, pErr) {
                TargetTableInsertCB(pResult, pErr);
            });
        }
    } catch (error) {
        console.log(error);
        TargetTableInsertCB(null, error);
    }

}


//Common Result  Preparation
function sendMethodResponse(status, successMessage, SuccessDataObj, errorCode, errorMessage, errorObject, ProcessStatus, INfoMessage) {
    var obj = {
        'STATUS': status,
        'SUCCESS_MESSAGE': successMessage,
        'ERROR_CODE': errorCode,
        'SUCCESS_DATA': SuccessDataObj,
        'ERROR_MESSAGE': errorMessage,
        'ERROR_OBJECT': errorObject,
        'PROCESS_STATUS': ProcessStatus,
        'INFO_MESSAGE': INfoMessage,
    };
    return obj;
}


module.exports = router;
//*******End of Serive*******//
