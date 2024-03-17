/* 
@Api_Name           : /ValidateSessionPassword
@Description        : To validate the password while session timeout case
@Last_Error_code    : ERR-AUT-11903
*/

// Require dependencies
var node_modules = '../../../../node_modules/'
var reqExpress = require(node_modules + 'express')
var router = reqExpress.Router()
var ldap = require('ldapjs');
var reqEncHelper = require('../../../../torus-references/common/crypto/EncryptionInstance');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var DBInstance = require('../../../../torus-references/instance/DBInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqLoginPageHelper = require('./helper/LoginPageHelper');
var reqRedisInstance = require('../../../../torus-references/instance/RedisInstance');
var serviceName = "ValidateSessionPassword";

//Global Variable
var mCltClient = '';

// Host the GetAppInfo api
router.post('/ValidateSessionPassword', function (appRequest, appResponse, pNext) {
    var headers = appRequest.headers;
    var objLogInfo;
    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
        try {
            objLogInfo.HANDLER_CODE = 'Validate_SessionPassword';
            objLogInfo.PROCESS = 'ValidateSessionPassword-Authentication';
            objLogInfo.ACTION_DESC = 'ValidateSessionPassword';
            // Handle the close event when client closes the api request
            appResponse.on('close', function () { });
            appResponse.on('finish', function () { });
            appResponse.on('end', function () { });

            reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo);
            var params = {};
            var strUname = appRequest.body.PARAMS.LOGIN_NAME.toUpperCase();
            var strPwd = appRequest.body.PARAMS.PSWD;
            var SALTKEY = appRequest.headers['salt-session'];
            reqLoginPageHelper.GetLoginConfig(headers, objSessionInfo, objLogInfo, function (Ldapconfig) {
                if (Ldapconfig.status) {
                    params.source = 'LDAP';
                    params.data = Ldapconfig;
                    validateSession(params);
                } else {
                    params.source = 'DB';
                    validateSession(params);
                }
            });

            async function validateSession(params) {
                if (params.source == 'DB') {
                    DBInstance.GetFXDBConnection(headers, 'clt_cas', objLogInfo, function Callback_GetCassandraConn(pClient) {
                        mCltClient = pClient
                        appResponse.setHeader('Content-Type', 'application/json');
                        var SlatValue;
                        reqLoginPageHelper.get_salt_value(SALTKEY, function (Res, err) {
                            if (err) {
                                return reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, '', '', '', 'FAILURE', 'Error occured salt when getting salt')
                            } else {
                                SlatValue = Res.salt;
                                reqInstanceHelper.PrintInfo(serviceName, 'Getting user details from users table', objLogInfo)
                                DBInstance.GetTableFromFXDB(mCltClient, 'users', [], {
                                    'login_name': strUname.toUpperCase()
                                }, objLogInfo, function callbackusersel(error, result) {
                                    try {
                                        if (error) {
                                            return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-AUT-11901', 'Error while getting users', error)
                                        } else {
                                            if (result.rows.length > 0) {
                                                var hashedDBPwd = reqEncHelper.passwordHash256Withsalt(result.rows[0].login_password, SlatValue);
                                                if (hashedDBPwd != strPwd) {
                                                    reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, '', '', '', 'FAILURE', 'Invalid password')
                                                    reqLoginPageHelper.DeleteSaltSession(serviceName, objLogInfo, SALTKEY)
                                                } else {
                                                    reqInstanceHelper.SendResponse(serviceName, appResponse, 'SUCCESS', objLogInfo, null, null, null)
                                                    reqLoginPageHelper.DeleteSaltSession(serviceName, objLogInfo, SALTKEY)
                                                }
                                            } else {
                                                return reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, '', '', '', 'FAILURE', 'Incorrect Login Name')
                                            }
                                        }
                                    } catch (error) {
                                        return reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-AUT-11902', 'Exception Occured', error)
                                    }
                                })
                            }
                        })
                    });
                } else if (params.source == 'LDAP') {
                    var Ldapconfig = params.data;
                    var ldapAuth = 'FAILURE'
                    var decrypted = reqEncHelper.DecryptPassword(strPwd);
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
                        var response = await reqLoginPageHelper.LdapAuthentication(strUname, decrypted, ldapClient, LDAP_OU, LDAP_LOGIN_ID, LDAP_PASSWORD, LDAP_FILTER_ATTRIBUTE)
                        // , function (response) {
                        try {
                            ldapClient.unbind(function (error) {
                                if (error) {
                                    return reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'errcode', 'errmsg', error);
                                }
                            });
                            if (response.userstatus) {
                                ldapAuth = "SUCCESS"
                                break;
                                // return reqInstanceHelper.SendResponse(serviceName, appResponse, 'SUCCESS', objLogInfo, null, null, null)
                            } else {
                                ldapAuth = "FAILURE"
                                // return reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, '', '', '', 'FAILURE', 'Invalid password');
                            }
                        } catch (error) {
                            return reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'errcode', 'errmsg', error);
                        }
                        // });
                    }

                    if (ldapAuth == "SUCCESS") {
                        return reqInstanceHelper.SendResponse(serviceName, appResponse, 'SUCCESS', objLogInfo, null, null, null)
                    } else {
                        return reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, '', '', '', 'FAILURE', 'Invalid password');
                    }

                }
            }
        } catch (error) {
            return reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-AUT-11903', 'Exception occured initially', error)
        }
    });
});

module.exports = router;


/******** End of Service ********/