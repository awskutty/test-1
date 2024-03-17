// Require dependencies
var modPath = '../../../../node_modules/';
var express = require(modPath + 'express');
var CryptoJS = require(modPath + 'crypto-js');
var reqEncHelper = require('../../../../torus-references/common/crypto/EncryptionInstance');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqsvchelper = require('../../../../torus-references/common/serviceHelper/ServiceHelper');


// Prepare queries
const apClient = 'select * from clients where email_id=? allow filtering';
const RowSet = 'Select * from tenant_setup where tenant_id = ? and client_id=? and category=?';

// Initialize Global variables
var resultSessionInfo = new SessionInfo();
var strResult = '';
var strMessage = '';
var key = CryptoJS.enc.Utf8.parse('5061737323313235');
var iv = CryptoJS.enc.Utf8.parse('5061737323313235');
var router = express.Router();

// Host the login api
router.post('/DoPlatfomSignin', function (req, resp, next) {
    var serviceModel = reqFXDBInstance.DBInstanceSession['SERVICE_MODEL'];
    var objLogInfo = reqLogInfo.AssignLogInfoDetailForCP(req.body, req);
    reqLogWriter.Eventinsert(objLogInfo);
    objLogInfo.PROCESS = 'APLogin-Authentication';
    objLogInfo.ACTION = 'DoPlatfomSignin';
    objLogInfo.USER_NAME = req.body.pUname;

    try {
        resp.setHeader('Content-Type', 'application/json');
        // Initialize local variables
        var strUname = req.body.pUname.toUpperCase();
        var strPwd = req.body.pPwd;
        var decrypted = reqEncHelper.DecryptPassword(strPwd);
        var objUrl = {};
        var strShowEnvSetup = true;
        DoPlatfomSignin();

        function DoPlatfomSignin() {
            try {
                //reqCassandraInstance.GetCassandraConn(req.headers, 'plt_cas', function Callback_GetCassandraConn(pltClient) {
                reqDBInstance.GetFXDBConnection(req.headers, 'plt_cas', objLogInfo, function (pltClient) {
                    // Get user detail
                    //pltClient.execute(apClient, [strUname], { prepare: true }, function (err, result) {
                    reqDBInstance.GetTableFromFXDB(pltClient, 'CLIENTS', [], { 'email_id': strUname }, objLogInfo, function (err, result) {
                        try {
                            if (err)
                                reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10029");

                            else {
                                // Check for user found or not
                                if (result.rows.length > 0) {
                                    var user = result.rows[0];
                                    resultSessionInfo.CLIENT_NAME = user.client_name;
                                    resultSessionInfo.CLIENT_URL = user.client_url;
                                    if (user.is_free == 'Y') {
                                        strResult = "FAILURE";
                                        strMessage = "Invalid username";
                                        reqLogWriter.TraceInfo(objLogInfo, 'Invalid username');
                                        PrepareResultStr(resultSessionInfo);
                                    } else {
                                        CheckInvalidPassword(user);
                                    }
                                }
                            }
                        } catch (error) {

                            errorHandler("ERR-FX-10029", "Error DoPlatfomSignin function ERR-002 " + error);
                        }
                    });
                });
            } catch (error) {
                errorHandler("ERR-FX-10028", "Error DoPlatfomSignin function ERR-003 " + error);
            }
        };
        // End of fn Do_Login

        // Check for Invalid password
        function CheckInvalidPassword(user) {
            try {
                if (user.client_password != reqEncHelper.EncryptPassword(decrypted)) {
                    strResult = 'FAILURE';
                    strMessage = 'Invalid password';
                    reqLogWriter.TraceInfo(objLogInfo, 'Invalid password');
                    PrepareResultStr(resultSessionInfo);
                } else {
                    checkActivation(user);
                }
            } catch (error) {
                errorHandler("ERR-FX-10027", "Error DoPlatfomSignin function ERR-004 " + error);
            }
        }

        function checkActivation(user) {
            try {
                if (user.is_activated == 'Y') {
                    reqLogWriter.TraceInfo(objLogInfo, ' Active  Account');
                    if (user.dev_dep_status == "CREATED") {
                        strShowEnvSetup = false;
                    }
                    var strUrlJson = resultSessionInfo.CLIENT_URL;
                    if (strUrlJson) {
                        objUrl = strUrlJson;
                        resultSessionInfo.CLIENT_URL = JSON.parse(objUrl);
                    }
                    FillClientSetup(user);

                } else {
                    strResult = "FAILURE";
                    strMessage = "Account has not be activated";
                    reqLogWriter.TraceInfo(objLogInfo, 'Account has not be activated');
                    PrepareResultStr(resultSessionInfo);
                }
            } catch (error) {
                errorHandler("ERR-FX-10026", "Error DoPlatfomSignin function ERR-002 " + error);
            }
        }

        // Prepare client setup info
        // Assign CHAT_PASS and CHAT_ENABLE properties
        function FillClientSetup(user) {
            try {
                //reqCassandraInstance.GetCassandraConn(req.headers, 'clt_cas', function Callback_GetCassandraConn(cltClient) {
                reqDBInstance.GetFXDBConnection(req.headers, 'clt_cas', objLogInfo, function (cltClient) {
                    //cltClient.execute(RowSet, ['0', user.client_id, 'CHT_USR_ORG_PWD'], function (err, result) {

                    var cond = {};
                    cond.setup_code = 'CHT_USR_ORG_PWD';
                    if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
                        reqsvchelper.GetSetupJson(cltClient, cond, objLogInfo, function (res) {
                            if (res.Status == 'SUCCESS') {
                                aftergetsetupJson(res.Data[0]);
                            } else {
                                errorHandler("ERR-FX-10025", "Error DoPlatfomSignin function ERR-005 " + error);
                            }
                        });
                    } else {
                        reqDBInstance.GetTableFromFXDB(cltClient, 'TENANT_SETUP', [], { tenant_id: '0', client_id: user.client_id, category: 'CHT_USR_ORG_PWD' }, objLogInfo, function (err, result) {
                            if (err) {
                                reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10025");
                                return;
                            } else {
                                aftergetsetupJson(result.rows[0]);
                            }
                        });
                    }

                    function aftergetsetupJson() {
                        try {
                            if (result.rows.length > 0) {
                                for (var i = 0; i < result.rows.length; i++) {

                                    var cltsetup = result.rows[i];
                                    var setup = cltsetup.category;
                                }
                                //console.log('CLIENT SETUP::' + cltsetup)
                                if (cltsetup != undefined && cltsetup.setup_json != null) {

                                    var parsedObj = JSON.parse(cltsetup.setup_json);
                                    resultSessionInfo.CHAT_PASS = parsedObj.CHT_USR_ORG_PWD;
                                }
                            }
                            chatEnable(user, cltClient);
                        } catch (error) {
                            errorHandler("ERR-FX-10025", "Error DoPlatfomSignin function ERR-005 " + error);
                        }
                    }
                });
            } catch (error) {
                errorHandler("ERR-FX-10025", "Error DoPlatfomSignin function ERR-005 " + error);
            }
        }

        function chatEnable(user, cltClient) {
            try {
                //cltClient.execute(RowSet, ['0', user.client_id, 'ENABLE_CHAT'], function (err, result) {
                reqDBInstance.GetTableFromFXDB(cltClient, 'TENANT_SETUP', [], { tenant_id: '0', client_id: user.client_id, category: 'ENABLE_CHAT' }, objLogInfo, function (err, result) {
                    try {
                        if (err) {
                            reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10024");
                            return;
                        } else {
                            if (result.rows.length > 0) {
                                for (var i = 0; i < result.rows.length; i++) {
                                    var cltsetup = result.rows[i];
                                    var setup = cltsetup.category;
                                }
                                if (cltsetup != undefined && cltsetup.setup_json != null) {
                                    var parsedObj = JSON.parse(cltsetup.setup_json);
                                    resultSessionInfo.CHAT_ENABLE = parsedObj.ENABLE_CHAT;
                                    SuccessCallback(user);
                                }
                            } else {
                                SuccessCallback(user);
                            }
                        }
                    } catch (error) {
                        errorHandler("ERR-FX-10024", "Error DoPlatfomSignin function ERR-006 " + error);
                    }
                });
            } catch (error) {
                errorHandler("ERR-FX-10024", "Error DoPlatfomSignin function ERR-006 " + error);
            }
        }

        function SuccessCallback(user) {
            try {
                strResult = "SUCCESS";
                resultSessionInfo.CLIENT_ID = user.client_id;
                resultSessionInfo.CLIENT_NAME = user.client_name;
                // resultSessionInfo.CLIENT_URL = JSON.parse(objUrl);
                resultSessionInfo.LICENSE_MODEL = user.license_model;
                resultSessionInfo.ORGANISATION_NAME = user.organisation_name;
                if (user.subscription_model_json) {
                    resultSessionInfo.SUBS_MODEL = user.subscription_model_json;
                } else {
                    resultSessionInfo.SUBS_MODEL = '';
                }
                resultSessionInfo.SHOW_ENVIRONMENT_SETUP = strShowEnvSetup;
                resultSessionInfo.CHAT_ENABLE = resultSessionInfo.CHAT_ENABLE;
                resultSessionInfo.CHAT_PASSWORD = resultSessionInfo.CHAT_PASSWORD;
                PrepareResultStr(resultSessionInfo);
            } catch (error) {
                errorHandler("ERR-FX-10023", "Error DoPlatfomSignin function ERR-007 " + error);
            }
        }

        function PrepareResultStr(Sess_info) {
            try {
                resultSessionInfo.RESULT = strResult;
                resultSessionInfo.MESSAGE = strMessage;
                ResultStr = JSON.stringify(Sess_info);
                reqLogWriter.TraceInfo(objLogInfo, ' Result Json' + ResultStr);
                reqLogWriter.TraceInfo(objLogInfo, ' Login Success');

                resp.write(ResultStr);
                reqLogWriter.EventUpdate(objLogInfo);
                resp.end();
            } catch (error) {

                errorHandler("ERR-FX-10022", "Error DoPlatfomSignin function ERR-008 " + error);
            }
        }

    } catch (error) {
        errorHandler("ERR-FX-10021", "Error APLogin function ERR-001 " + error);
    }

    function errorHandler(errcode, message) {
        console.log(errcode, message);
        reqLogWriter.TraceError(objLogInfo, message, errcode);
    }
});

// Session Class declaration
function SessionInfo() {
    this.RESULT = '';
    this.CLIENT_ID = '';
    this.CLIENT_URL = '';
    this.LICENSE_MODEL = '';
    this.ORGANISATION_NAME = '';
    this.SHOW_ENVIRONMENT_SETUP = '';
    this.SUBS_MODEL = '';
}

//var app={APP_ID:"",APP_CODE:"",APP_DESCRIPTION:"",APP_ICON:"",APP_TYPE:""};

module.exports = router;