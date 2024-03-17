/**
 * @Api_Name        : /SSORedirect,
 * @Description     : Perform login and direct redirect to torus landing for SSO mode
 * @Last_Error_Code :ERR-AUT-14910
 */


var reqExpress = require('express');
var router = reqExpress.Router();
var reqInstanceHelper = require("../../../../torus-references/common/InstanceHelper");
var reqTranDBInstance = require("../../../../torus-references/instance/TranDBInstance");
var reqFXDBInstance = require("../../../../torus-references/instance/DBInstance");
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');
var reqEncryptionInstance = require('../../../../torus-references/common/crypto/EncryptionInstance');
var request = require('request');
var async = require('async');
var fs = require('fs');
var LINQ = require('node-linq').LINQ;
var crypto = require('crypto');
var CryptoJS = require('crypto-js');
var key = CryptoJS.enc.Utf8.parse('5061737323313235');
var iv = CryptoJS.enc.Utf8.parse('5061737323313235');
var serviceName = "SSORedirect";

router.post('/SSORedirect', function (appRequest, appResponse) {
    var objLogInfo;
    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, sessionInfo) {
        try {
            var params = appRequest.body.PARAMS;
            console.log("appRequest.body.PARAMS" + JSON.stringify(appRequest.body.PARAMS));
            var system = params.system.toUpperCase();
            var token = params.token;
            var logInfo = '';
            var systemInfo = {};
            var clientIP = appRequest.host; //appRequest.headers["x-real-ip"];
            var errorURI = appRequest.headers.referer + "#/auth/sso?";
            var errorMessage = "";
            var refererURL = '';
            var tenantID = params.TenantID;
            var ClientID = params.ClientID;
            var logout = "";

            function isEmptyObject(obj) {
                return !Object.keys(obj).length;
            }

            function encryption(pVal) {
                var key = CryptoJS.enc.Utf8.parse('5061737323313235');
                var iv = CryptoJS.enc.Utf8.parse('5061737323313235');
                var encrypted = CryptoJS.AES.encrypt(CryptoJS.enc.Utf8.parse(pVal), key, {
                    keySize: 128 / 8,
                    iv: iv,
                    mode: CryptoJS.mode.CBC,
                    padding: CryptoJS.pad.Pkcs7
                });
                return encrypted.ciphertext.toString(CryptoJS.enc.Base64);
            }

            function SendErrorResponse(pErrorCode, pErrorMsg, pErrObject) {
                reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, pErrorCode, pErrorMsg, pErrObject);
            }


            if (token == undefined && system == undefined) {
                errorMessage = "Invalid Inputs";
                SendErrorResponse('ERR-AUT-14910', errorMessage);
            } else {
                reqFXDBInstance.GetFXDBConnection(appRequest.headers, 'clt_cas', null, function (session) {
                    try {
                        var query = "select * from tenant_setup where client_id = '" + ClientID + "' AND tenant_id ='" + tenantID + "' AND category = 'SSO_INFO'";
                        fetchData(query, function (error, result) {
                            try {
                                if (!checkError(error)) {
                                    if (result.rows.length > 0) {
                                        var tenantSetup = JSON.parse(result.rows[0].setup_json);
                                        for (var i = 0; i < tenantSetup.length; i++) {
                                            if (tenantSetup[i].SYSTEM == system) {
                                                systemInfo = tenantSetup[i];
                                                logout = systemInfo.LOGOUT;
                                            }
                                        }
                                        if (isEmptyObject(systemInfo)) {
                                            errorMessage = "Authentication Failed. Unknown System";
                                            SendErrorResponse('ERR-AUT-14911', errorMessage);
                                        } else {
                                            startHandShake();
                                        }
                                    } else {
                                        errorMessage = "No setup found for SSO";
                                        SendErrorResponse('ERR-AUT-14912', errorMessage);
                                    }
                                }
                            } catch (error) {
                                errorMessage = "Exception Occured";
                                SendErrorResponse('ERR-AUT-14913', errorMessage);
                            }

                        });

                        function insertData(objInsert, callback) {
                            return reqTranDBInstance.InsertTranDBWithAudit(session, objInsert.table, objInsert.data, logInfo, callback);
                        }

                        function updateData(objUpdate, callback) {
                            return reqTranDBInstance.UpdateTranDBWithAudit(session, objUpdate.table, objUpdate.data, objUpdate.condition, logInfo, callback);
                        }

                        function fetchData(query, callback) {
                            return reqFXDBInstance.ExecuteQuery(session, query, logInfo, callback);
                        }

                        function checkError(error) {
                            if (error) {
                                SendErrorResponse('ERR-AUT-14915', "Exception Occured", error);
                            } else {
                                return false;
                            }
                        }
                    } catch (error) {
                        errorMessage = "Exception Occured";
                        SendErrorResponse('ERR-AUT-14914', errorMessage, error);
                    }

                });

                function startHandShake() {
                    try {
                        var apiMethod = '';
                        refererURL = systemInfo.VALIDATE_TOKEN.URL.split('/microsvc')[0];
                        if (systemInfo.VALIDATE_TOKEN.METHOD === "GET") {
                            apiMethod = 'GET';
                        } else if (systemInfo.VALIDATE_TOKEN.METHOD === "POST") {
                            apiMethod = 'POST';
                        }

                        if (apiMethod === 'GET') {
                            console.log("startHandShake called");
                            console.log("token " + token);
                            console.log(systemInfo.VALIDATE_TOKEN.URL.replace('<ST_ID>', token));

                            request({
                                uri: systemInfo.VALIDATE_TOKEN.URL.replace('<ST_ID>', token),
                                method: apiMethod,
                            }, handShakeCB);
                        } else if (apiMethod === 'POST') {
                            request({
                                uri: systemInfo.VALIDATE_TOKEN.URL,
                                method: apiMethod,
                            }, handShakeCB);
                        }


                        function handShakeCB(error, response, body) {
                            try {
                                if (error) {
                                    console.log('----------handShakeCB error--------- ' + error);
                                    appResponse.send(error);
                                } else {
                                    console.log('----------handShakeCB body--------- ' + body);
                                    var result = JSON.parse(body);
                                    if (result.result == "valid") {
                                        //  getAdditionalAPIParams(result);
                                        // if (false) {

                                        if (result.username != undefined && result.username != "") {
                                            result.username = result.username.replace(/ /g, '+');
                                            //signUp(result.username);
                                            login(result.username, result.ssoid);
                                        } else {
                                            var data = {
                                                username: result.ssoid //system + '_' + result.ssoid
                                            };
                                            request({
                                                uri: refererURL + '/microsvc/vgstssocheckuserexists/',
                                                method: 'post',
                                                json: data
                                            }, checkUserExistsCB);

                                            function checkUserExistsCB(error, response, body) {
                                                try {
                                                    if (error) {
                                                        SendErrorResponse('ERR-AUT-14916', 'Error on vgstssocheckuserexists', error);
                                                    } else {
                                                        if (body.process_status == 'SUCCESS' && body.message == 'NEW USER') {
                                                            signUp(result.ssoid);
                                                        } else if (body.process_status == 'SUCCESS' && body.message == 'USER ALREADY EXISTS') {
                                                            var errorMessage = body.message;
                                                            SendErrorResponse('ERR-AUT-14916', errorMessage, error);
                                                        }
                                                    }
                                                } catch (error) {
                                                    appResponse.send(error);
                                                }
                                            }
                                        }
                                    } else {
                                        errorMessage = "Invalid Token Received";
                                        SendErrorResponse('ERR-AUT-14916', errorMessage, error);
                                    }
                                }
                            } catch (error) {
                                errorMessage = "Exception Occured";
                                SendErrorResponse('ERR-AUT-14916', errorMessage, error);
                            }
                        }
                    } catch (error) {
                        errorMessage = "Exception Occured";
                        SendErrorResponse('ERR-AUT-14916', errorMessage, error);
                    }

                }
            }

            function setAPIURIwithAdditionalParams(apiURI, param, value) {
                var systemProperties = Object.keys(systemInfo);
                for (var i = 0; i < systemProperties.length; i++) {
                    if (systemProperties[i] == apiURI) {
                        systemInfo[apiURI] = systemInfo[apiURI] + "&" + param + "=" + value;
                        return;
                    }
                }
            }

            function getAdditionalAPIParams(apiResponse) {
                try {
                    var apiReponseParams = Object.keys(apiResponse);
                    var additionalParams = Object.keys(systemInfo.ADDITIONAL_PARAMS);
                    for (var i = 0; i < additionalParams.length; i++) {
                        var params = systemInfo.ADDITIONAL_PARAMS[additionalParams[i]];
                        for (var j = 0; j < params.length; j++) {
                            var param = params[j];
                            var value = apiResponse[param];
                            setAPIURIwithAdditionalParams(additionalParams[i], param, value);
                        }
                    }
                } catch (error) {

                }
            }

            function login(username, vendorUsername) {
                try {
                    console.log('Preparesalt function executing...');
                    //Prepare SALT Value
                    var SaltKey = '';
                    var SaltValue = '';
                    var options = {
                        url: refererURL + '/Authentication/Preparesalt',
                        method: 'POST',
                        "rejectUnauthorized": false,
                        form: {},
                    };
                    request(options, function (error, response, body) {
                        if (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, "ERR-AUTH-14917", 'Error on salt prepare', err);
                        } else {
                            console.log("Preparesalt function response" + body);
                            var saltresponse = JSON.parse(body);
                            console.log("Preparesalt saltresponse" + saltresponse.process_status);
                            if (saltresponse.process_status == 'SUCCESS') {
                                SaltKey = saltresponse.data.SaltKey;
                                SaltValue = saltresponse.data.SaltValue;
                                username = reqEncryptionInstance.DecryptPassword(username);
                                console.log('----login executing----- ' + username);
                                var firsthashpwd = reqEncryptionInstance.passwordHash256("Admin@100");
                                console.log("firsthashpwd sso redirect----" + firsthashpwd);
                                var Hashwithsalt = reqEncryptionInstance.passwordHash256Withsalt(firsthashpwd, SaltValue);
                                var data = {
                                    PARAMS: {
                                        pClientIP: clientIP,
                                        pUname: username,
                                        pPwd: Hashwithsalt,
                                        pLoginTryCount: 0,
                                        NeedCaptcha: "N",
                                        "LD_CODE": "",
                                        "LANG_PART": "",
                                        "TENANT_ID": tenantID
                                    }
                                };
                                request({
                                    uri: refererURL + '/Authentication/WPSimpleLogin',
                                    method: 'POST',
                                    json: data,
                                    headers: {
                                        "Content-Type": "application/json",
                                        "salt-session": SaltKey
                                    }
                                }, getLoginDataCB);

                                function getLoginDataCB(error, response, body) {
                                    try {
                                        console.log('login result ' + JSON.stringify(body));
                                        console.log(error);
                                        if (error) {
                                            errorMessage = "Authenticating VGST Failed";
                                            SendErrorResponse('ERR-AUT-14916', errorMessage, error);
                                        } else {
                                            if (body.process_status == "SUCCESS") {
                                                var stringifiedBody = JSON.stringify(body);
                                                var encryptedBody = encryption(stringifiedBody);
                                                var resultLandingPage = {
                                                    system: system,
                                                    vusername: vendorUsername,
                                                    login_result: encryptedBody,
                                                    logout: logout
                                                };
                                                reqInstanceHelper.SendResponse(serviceName, appResponse, resultLandingPage, objLogInfo, '', '', '', 'SUCCESS', 'LOGIN_SUCCESS');
                                            } else {
                                                errorMessage = "Authentication Failed";
                                                SendErrorResponse('ERR-AUT-14916', errorMessage, error);
                                            }
                                        }
                                    } catch (error) {
                                        SendErrorResponse('ERR-AUT-14916', "Exception Occured", error);
                                    }
                                }
                            } else {
                                SendErrorResponse('ERR-AUT-14914', body);
                            }
                        }
                    });
                } catch (error) {
                    errorMessage = "Exception Occured";
                    SendErrorResponse('ERR-AUT-14916', errorMessage, error);
                }
            }

            function signUp(username) {
                var torusSignupAPI = systemInfo.TORUS_SIGNUP.URL + "&system=" + system + "&username=" + username;
                //appResponse.redirect(torusSignupAPI);
                var resultSignUpPage = {
                    status: 'SIGNUP',
                    system: system,
                    username: username,
                    TORUS_SIGNUP_URL: torusSignupAPI
                };
                reqInstanceHelper.SendResponse(serviceName, appResponse, resultSignUpPage, objLogInfo, '', '', '', 'SUCCESS', 'SUCCESS_FOR_SIGNUP');
            }
        } catch (error) {
            SendErrorResponse('ERR-AUT-14916', "Exception Occured", error);
        }
    });
});

module.exports = router;