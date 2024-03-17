/*
@Api_Name           : /SendForgotPwdOTP,
@Description        : To Change password from static module and  from forget paswword screen,
@Last_Error_Code    : ERR-AUT-10909
*/

// Require dependencies
var reqExpress = require('express');
var router = reqExpress.Router();
var reqLINQ = require('node-linq').LINQ;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqSMTPMessage = require('../../../../torus-references/communication/core/mail/SMTPMessage');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqsvchelper = require('../../../../torus-references/common/serviceHelper/ServiceHelper');
// Global variables
var mCltClient = '';
var mHeaders = '';
var serviceName = 'SendLogAsMail';

// Host api to server
router.post('/SendLogAsMail', function (appRequest, appResponse) {
    var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
    var objLogInfo;
    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, sessionInfo) {
        try {
            objLogInfo.PROCESS = 'SendLogAsMail-Authentication';
            objLogInfo.ACTION = 'SendLogAsMail';
            objLogInfo.HANDLER_CODE = 'SEND_LOG_AS_MAIL';
            appResponse.on('close', function () { });
            appResponse.on('finish', function () { });
            appResponse.on('end', function () { });

            reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo);
            mHeaders = appRequest.headers;

            // Initialize local variables
            //var login_name = sessionInfo.LOGIN_NAME.toUpperCase();
            var log = appRequest.body.PARAMS.LOG;
            var tenant_id = sessionInfo.TENANT_ID;
            var client_id = sessionInfo.CLIENT_ID;

            reqDBInstance.GetFXDBConnection(mHeaders, 'clt_cas', objLogInfo, function Callback_GetCassandraConn(pClient) {
                mCltClient = pClient;

                // main function call and result will send from here
                sendLog(function (result) {
                    if (result.STATUS == 'SUCCESS') {
                        reqInstanceHelper.SendResponse(serviceName, appResponse, result.SUCCESS_DATA, objLogInfo, '', '', '', 'SUCCESS', result.SUCCESS_MESSAGE);
                    } else {
                        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, result.ERROR_CODE, result.ERROR_MESSAGE, result.ERROR_OBJECT);
                    }
                });

                //Prepare OTP Params to send OTP
                function sendLog(callback) {
                    try {
                        reqInstanceHelper.PrintInfo(serviceName, 'GetOtpParams function executing...', objLogInfo);


                        if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
                            var cond = {};
                            cond.setup_code = ['MAIL_SETUP', 'LOG_MAIL_TEMPLATE'];
                            reqsvchelper.GetSetupJson(pClient, cond, objLogInfo, function (res) {
                                if (res.Status == 'SUCCESS' && res.Data.length) {
                                    aftergetsetupJson(res.Data);
                                } else {
                                    return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, res.ErrorCode, res.ErrorMsg, res.Error);
                                }
                            });
                        } else {
                            reqDBInstance.GetTableFromFXDB(mCltClient, 'tenant_setup', ['category', 'setup_json'], {
                                'category': ['MAIL_SETUP', 'LOG_MAIL_TEMPLATE'],
                                'tenant_id': tenant_id,
                                'client_id': client_id
                            }, objLogInfo, function callbackpwdpolicy(err, result) {
                                if (err) {
                                    callback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10902', 'GetTableFromFXDB tenant_setup Failed', err));
                                } else {
                                    aftergetsetupJson(result.rows);
                                }
                            });
                        }

                        async function aftergetsetupJson(result) {
                            try {
                                var mail_setup = new reqLINQ(result)
                                    .Where(function (item) {
                                        return item.category == 'MAIL_SETUP';
                                    }).ToArray();
                                var log_setup = new reqLINQ(result)
                                    .Where(function (item) {
                                        return item.category == 'LOG_MAIL_TEMPLATE';
                                    }).ToArray();
                                if (mail_setup.length && log_setup.length) {
                                    var template = JSON.parse(log_setup[0].setup_json);
                                    var deCryptedsetup = await reqDBInstance.GetDecryptedData(mCltClient, mail_setup[0].setup_json, objLogInfo);
                                    var mailSetup = JSON.parse(deCryptedsetup).MAIL;
                                    template.MESSAGE = template.MESSAGE.replace('$CLIENT_URL', log.CLIENT_URL);
                                    template.MESSAGE = template.MESSAGE.replace('$SERVICE_URL', log.SERVICE_URL);
                                    template.MESSAGE = template.MESSAGE.replace('$HANDLER_CODE', log.HANDLER_CODE);
                                    template.MESSAGE = template.MESSAGE.replace('$SYSTEM', log.SYSTEM);
                                    template.MESSAGE = template.MESSAGE.replace('$APPLICATION', log.APPLICATION);
                                    template.MESSAGE = template.MESSAGE.replace('$MESSAGE', log.MESSAGE);
                                    template.IS_HTML = true;
                                    var mail_params = {
                                        ServerName: mailSetup.SERVERNAME,
                                        PortNo: mailSetup.PORTNO,
                                        EMailID: mailSetup.EMAILID,
                                        Pwd: mailSetup.PASSWORD,
                                        To: template.EMAIL_ID,
                                        Subject: template.SUBJECT,
                                        IsBodyHtml: template.IS_HTML ? true : false,
                                        Body: template.MESSAGE
                                    };
                                    reqSMTPMessage.SendMail(mail_params, objLogInfo, function (result) {
                                        if (result.Status == 'SUCCESS') {
                                            callback(sendMethodResponse("SUCCESS", 'SUCCESS', { email_id: template.EMAIL_ID }));
                                        } else {
                                            callback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10902', 'SendMail Failed', err));
                                        }
                                    });
                                } else {
                                    callback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10902', 'tenant_setup Failed', err));
                                }
                            } catch (error) {
                                callback(sendMethodResponse('FAILURE', '', '', 'ERR-AUT-10909', 'Exception Occured While executing ProduceMessage function function  ', error));
                            }
                        }
                    } catch (error) {
                        callback(sendMethodResponse('FAILURE', '', '', 'ERR-AUT-10906', 'Exception Occured While executing GetOtpParams function  ', error));
                    }
                }

            });
        } catch (error) {
            return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-AUT-10908', 'Exception Occured While executing SendForgotPwdOTP function', error);
        }
    });
});

//Commin Result  Preparation
function sendMethodResponse(status, successMessage, SuccessDataObj, errorCode, errorMessage, errorObject) {
    var obj = {
        'STATUS': status,
        'SUCCESS_MESSAGE': successMessage,
        'SUCCESS_DATA': SuccessDataObj,
        'ERROR_CODE': errorCode,
        'ERROR_MESSAGE': errorMessage,
        'ERROR_OBJECT': errorObject
    };
    return obj;
}
module.exports = router;
//*******End of Serive*******//