/*
@Api_Name           : /SendForgotPwdOTP,
@Description        : To Change password from static module and  from forget paswword screen,
@Last_Error_Code    : ERR-AUT-10909
*/

// Require dependencies
var modPath = '../../../../node_modules/';
var refPath = '../../../../torus-references/';
var reqExpress = require(modPath + 'express');
var reqLINQ = require(modPath + 'node-linq').LINQ;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqProducer = require('../../../../torus-references/common/Producer');
var DBInstance = require('../../../../torus-references/instance/DBInstance');
var reqEncHelper = require('../../../../torus-references/common/crypto/EncryptionInstance');
var reqUuid = require('uuid');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqsvchelper = require('../../../../torus-references/common/serviceHelper/ServiceHelper');
var router = reqExpress.Router();
var serviceName = 'SendForgotPwdOTP';
// Global variables
var mCltClient = '';
var pHeaders = '';

// Host api to server
router.post('/SendForgotPwdOTP', function (appRequest, appResponse) {
    var objLogInfo;
    var serviceModel = DBInstance.DBInstanceSession['SERVICE_MODEL'];
    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, sessionInfo) {
        try {
            objLogInfo.PROCESS = 'SendForgotPwdOTP-Authentication';
            objLogInfo.ACTION = 'SendForgotPwdOTP';
            objLogInfo.HANDLER_CODE = 'Send_Forgot_PwdOTP';
            appResponse.on('close', function () { });
            appResponse.on('finish', function () { });
            appResponse.on('end', function () { });

            reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo);
            pHeaders = appRequest.headers;
            DBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function Callback_GetCassandraConn(pClient) {
                mCltClient = pClient;
                // Initialize local variables
                appResponse.setHeader('Content-Type', 'application/json');
                var user_name = appRequest.body.PARAMS.pUname.toUpperCase();
                var msgvalue = Math.floor(Math.random() * 99999999);
                var encmsgvalue = reqEncHelper.EncryptPassword(msgvalue.toString());
                var strTENSNTID = appRequest.body.PARAMS.TENANT_ID;
                objLogInfo.TENANT_ID = strTENSNTID;
                var insertrow = [];
                var OTPId = reqUuid.v1();

                // main function call and result will send from here
                GetOtpParams(function (finalcallback) {
                    if (finalcallback.STATUS == 'SUCCESS') {
                        reqInstanceHelper.SendResponse(serviceName, appResponse, finalcallback.SUCCESS_DATA, objLogInfo, '', '', '', 'SUCCESS', finalcallback.SUCCESS_MESSAGE);
                    } else {
                        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, finalcallback.ERROR_CODE, finalcallback.ERROR_MESSAGE, finalcallback.ERROR_OBJECT);
                    }
                });

                //Prepare OTP Params to send OTP
                function GetOtpParams(finalcallback) {
                    try {
                        reqInstanceHelper.PrintInfo(serviceName, 'GetOtpParams function executing...', objLogInfo);
                        DBInstance.GetTableFromFXDB(mCltClient, 'users', [], {
                            'login_name': user_name
                        }, objLogInfo, function callbackuser(err, result) {
                            try {
                                if (err) {
                                    finalcallback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10901', 'GetTableFromFXDB users Failed', err));
                                } else {
                                    if (result.rows.length > 0) {
                                        var param = result.rows[0];
                                        param.tenant_id = strTENSNTID;
                                        //param.login_name = result.rows[0].login_name;
                                        //param.email_id = result.rows[0].email_id;
                                        //param.mobile_no = result.rows[0].mobile_no;
                                        //param.u_id = result.rows[0].u_id;
                                        //param.client_id = result.rows[0].client_id;


                                        if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
                                            var cond = {};
                                            cond.setup_code = ['PASSWORD_POLICY', 'AUTHENTICATION', 'FRGT_PWD_MAIL_TEMPLATE'];
                                            reqsvchelper.GetSetupJson(mCltClient, cond, objLogInfo, function (res) {
                                                if (res.Status == 'SUCCESS' && res.Data.length) {
                                                    aftergetsetupJson(res);
                                                }
                                            });
                                        } else {
                                            DBInstance.GetTableFromFXDB(mCltClient, 'tenant_setup', ['setup_json', 'category'], {
                                                'category': ['PASSWORD_POLICY', 'AUTHENTICATION'],
                                                'tenant_id': strTENSNTID,
                                                'client_id': param.client_id
                                            }, objLogInfo, function callbackpwdpolicy(err, result) {
                                                if (err) {
                                                    finalcallback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10902', 'GetTableFromFXDB tenant_setup Failed', err));
                                                } else {
                                                    aftergetsetupJson(result.rows);
                                                }
                                            });
                                        }


                                        function aftergetsetupJson(result) {
                                            param.msgvalue = msgvalue;
                                            // param.double_authentication_model = result.rows[0].double_authentication_model;
                                            param.OTPId = OTPId;

                                            try {
                                                var Authenticationsetup = new reqLINQ(result.Data)
                                                    .Where(function (item) {
                                                        return item.category == 'AUTHENTICATION';
                                                    }).ToArray();
                                                param.OTPsend = JSON.parse(Authenticationsetup[0].setup_json).FORTGET_PWD_OTP;
                                                var PWDPOLICY = new reqLINQ(result.Data)
                                                    .Where(function (item) {
                                                        return item.category == 'PASSWORD_POLICY';
                                                    }).ToArray();

                                                var parsedtemplateData = JSON.parse(Authenticationsetup[0].setup_json)
                                                param.OTP_SMS_TEMPLATE = 'FRGT_PWD_SMS_TEMPLATE';
                                                param.OTP_MAIL_TEMPLATE = 'FRGT_PWD_MAIL_TEMPLATE';
                                                param.OTP_TTL = parsedtemplateData.OTP_TTL
                                                reqProducer.ProduceMessage('OTP', param, pHeaders, function (response) {
                                                    reqInstanceHelper.PrintInfo(serviceName, 'ProduceMessage Function Executing...', objLogInfo);
                                                    try {
                                                        if (response == "SUCCESS") {
                                                            reqInstanceHelper.PrintInfo(serviceName, 'ProduceMessage Function Executed.', objLogInfo);
                                                            var pswd_policy = {}
                                                            pswd_policy.Data = PWDPOLICY;
                                                            pswd_policy.TTL = parsedtemplateData.OTP_TTL || 120
                                                            GetPwdPolicy(pswd_policy, function (res) {
                                                                finalcallback(res);
                                                            });
                                                        } else {
                                                            finalcallback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10903', 'ProduceMessage Failed', err));
                                                        }

                                                    } catch (error) {
                                                        finalcallback(sendMethodResponse('FAILURE', '', '', 'ERR-AUT-10904', 'Exception Occured While executing ProduceMessage function function  ', error));
                                                    }
                                                });
                                            } catch (error) {
                                                finalcallback(sendMethodResponse('FAILURE', '', '', 'ERR-AUT-10909', 'Exception Occured While executing ProduceMessage function function  ', error));
                                            }
                                        }

                                        // }
                                        // });
                                    } else {
                                        finalcallback(sendMethodResponse('FAILURE', '', '', 'ERR-AUT-10910', 'Invalid User', ''));
                                    }
                                }
                            } catch (error) {
                                finalcallback(sendMethodResponse('FAILURE', '', '', 'ERR-AUT-10905', 'Exception Occured While executing callbackuser function  ', error));
                            }
                        });
                    } catch (error) {
                        finalcallback(sendMethodResponse('FAILURE', '', '', 'ERR-AUT-10906', 'Exception Occured While executing GetOtpParams function  ', error));
                    }
                }


                //Prepare Password Policy and prepare final result
                function GetPwdPolicy(pswd_policy, callback) {
                    try {
                        reqInstanceHelper.PrintInfo(serviceName, 'GetPwdPolicy Function executing...', objLogInfo);
                        var Result = {};
                        Pwd = pswd_policy.Data[0].setup_json;
                        reqInstanceHelper.PrintInfo(serviceName, 'OTP : ' + msgvalue, objLogInfo);
                        Result.OTPTOKEN = OTPId;
                        Result.PASSWORD_POLICY = JSON.parse(Pwd);
                        Result.TTL = JSON.parse(pswd_policy.TTL);
                        // Result.HEADERS = objLogInfo.headers;
                        var strResult = JSON.stringify(Result);
                        var strFinalRes = strResult;
                        reqInstanceHelper.PrintInfo(serviceName, 'GetPwdPolicy finished', objLogInfo);
                        callback(sendMethodResponse('SUCCESS', '', strFinalRes, '', '', ''));
                    } catch (error) {
                        callback(sendMethodResponse('FAILURE', '', '', 'ERR-AUT-10907', 'Exception Occured While executing GetPwdPolicy function  ', error));
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