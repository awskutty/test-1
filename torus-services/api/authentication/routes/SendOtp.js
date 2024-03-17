/**
 * @Api_Name        : /SendOtp,
 * @Description     : To send the OTP to user request and insert the entry into Redis with TTL
 * @Last_Error_Code :ERR-AUT-
 **/

// Require dependencies
var modPath = "../../../../node_modules/";
var reqExpress = require(modPath + "express");
var router = reqExpress.Router();
var async = require(modPath + 'async');
var reqLINQ = require(modPath + 'node-linq').LINQ;
var reqUuid = require(modPath + 'uuid');
var reqLogInfo = require("../../../../torus-references/log/trace/LogInfo");
var reqInstanceHelper = require("../../../../torus-references/common/InstanceHelper");
var reqDBInstance = require("../../../../torus-references/instance/DBInstance");
var reqRedisInstance = require("../../../../torus-references/instance/RedisInstance");
var reqSendSMS = require('../../../../torus-references/communication/core/sms/SendSMS');
var reqSMTPMail = require('../../../../torus-references/communication/core/mail/SMTPMessage');

router.post("/SendOTP", function (appRequest, appResponse) {
    try {
        var objLogInfo;
        var pHeaders = appRequest.headers;
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
            try {
                var serviceName = "SendOTP";
                var params = appRequest.body.PARAMS;
                var intOTPLength = params.OTPLength;
                var intOtpExpire = params.OTpEXpire;
                var strSendto = params.SendTO;
                var strMode = params.Mode;
                var quryCond = {};
                var MAIL_Template = params.MAIL_Template;
                var SMS_Template = params.SMS_Template;
                var SendToMobile = params.SendToMobile;
                var SendToMail = params.SendToMail;
                console.log('OTP Mode to ====>' + strMode);
                if (strMode == 'MAIL') {
                    quryCond.category = ['MAIL_SETUP', MAIL_Template];
                } else if (strMode == 'SMS') {
                    quryCond.category = ['SMS_SETUP', SMS_Template];
                } else {
                    quryCond.category = ['SMS_SETUP', 'MAIL_SETUP', MAIL_Template, SMS_Template];
                }
                quryCond.client_id = params.CLIENT_ID;
                quryCond.tenant_id = params.TENANT_ID;

                // //to Generarte Randome Number 
                function randomIntInc(low, high) {
                    return Math.floor(Math.random() * (high - low + 1) + low);
                }
                var arrRandomNum = new Array(intOTPLength);
                for (var i = 0; i < arrRandomNum.length; i++) {
                    arrRandomNum[i] = randomIntInc(1, 9);
                }
                var OTPValue = arrRandomNum.toString().replace(/,/g, '');

                //Get redis connection
                reqRedisInstance.GetRedisConnection(function (error, clientR) {
                    try {
                        //DB Connection
                        reqDBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function Callback_GetCassandraConn(pClient) {
                            try {
                                get_communication_setup(preparemsg);
                            } catch (error) {
                                return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-AUT-14900', 'Exception Occured While WPSimpleLogin API Calling... ', error);
                            }
                            //Get setuo and template from tenant_setup table
                            function get_communication_setup(callback) {
                                try {
                                    reqInstanceHelper.PrintInfo(serviceName, "Query Tenant setup", objLogInfo);
                                    if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
                                        var cond = {};
                                        cond.setup_code = ['SMS_SETUP', 'MAIL_SETUP', MAIL_Template, SMS_Template];
                                        reqsvchelper.GetSetupJson(pClient, cond, objLogInfo, function (res) {
                                            if (res.Status == 'SUCCESS' && res.Data.length) {
                                                callback(res.Data);
                                            } else {
                                                return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, res.ErrorCode, res.ErrorMsg, res.Error);
                                            }
                                        });
                                    } else {
                                        reqDBInstance.GetTableFromFXDB(pClient, 'TENANT_SETUP', ['CATEGORY', 'SETUP_JSON'], quryCond, objLogInfo, function tenantresult(err, res) {
                                            try {
                                                if (err) {
                                                    return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-AUT-14901', 'err occured get setup ', err);
                                                } else {
                                                    callback(res.rows);
                                                }
                                            } catch (error) {
                                                return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-AUT-14902', 'Exception Occured  get setup callback', error);
                                            }
                                        });
                                    }
                                } catch (error) {
                                    return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-AUT-14903', 'Exception Occured  get setup', error);
                                }
                            }

                            function preparemsg(DbRes) {
                                var comSetup = new reqLINQ(DbRes)
                                    .Where(function (item) {
                                        return item.category === "MAIL_SETUP" || item.category === "SMS_SETUP";
                                    }).ToArray();
                                sendmessage(comSetup, DbRes);
                            }

                            //Send message/Mail to user
                            function sendmessage(comSetup, DbRes) {
                                try {
                                    if (comSetup.length) {
                                        async.forEachOf(comSetup, function (value, key, callback) {
                                            sendmsg();
                                            async function sendmsg() {
                                                var templtsetup;
                                                if (value.category == 'SMS_SETUP') {
                                                    templtsetup = SMS_Template;
                                                } else {
                                                    templtsetup = MAIL_Template;
                                                }
                                                var comTemplate = new reqLINQ(DbRes.rows)
                                                    .Where(function (item) {
                                                        return item.category === templtsetup;
                                                    }).ToArray();
                                                if (comTemplate.length) {
                                                    var TemplatesetupJson = comTemplate[0].setup_json;
                                                    if (value.category == 'SMS_SETUP') {
                                                        if (SendToMobile) {
                                                            reqInstanceHelper.PrintInfo(serviceName, 'sms sending to ' + SendToMobile + ' Number', objLogInfo);
                                                            var StrMessage = JSON.parse(TemplatesetupJson).MESSAGE;
                                                            StrMessage = StrMessage.replace('{MESSAGE_VALUE}', OTPValue);
                                                            var deCryptedSMSSetup = await reqDBInstance.GetDecryptedData(pClient, value.setup_json, objLogInfo);
                                                            var strUrl = JSON.parse(deCryptedSMSSetup).SMS.URL;
                                                            strUrl = strUrl.replace('<MESSAGE>', StrMessage);
                                                            strUrl = strUrl.replace('<MOBILENO>', SendToMobile);
                                                            strUrl = encodeURI(strUrl);
                                                            reqInstanceHelper.PrintInfo(serviceName, "strUrl======>" + strUrl, objLogInfo);
                                                            reqInstanceHelper.PrintInfo(serviceName, "Sending sms", objLogInfo);
                                                            reqSendSMS.Sendmsg(strUrl, objLogInfo, function (response) {
                                                                reqInstanceHelper.PrintInfo(serviceName, "send sms response is " + response, objLogInfo);
                                                                callback();
                                                            });
                                                        } else {
                                                            reqInstanceHelper.PrintInfo(serviceName, "Mobile number is empty", objLogInfo);
                                                            callback();
                                                            reqInstanceHelper.SendResponse(serviceName, appResponse, 'FAILURE', objLogInfo, 'ERR-AUT-14914', '', '', 'FAILURE', 'Mobile number is empty');
                                                        }
                                                    } else {
                                                        console.log('sms sending to ' + SendToMail + ' Mail id ');
                                                        if (SendToMail) {
                                                            var parsedValue = JSON.parse(TemplatesetupJson);
                                                            var MailMsg = parsedValue.MESSAGE;
                                                            MailMsg = MailMsg.replace('{MESSAGE_VALUE}', OTPValue);
                                                            var deCryptedsetup = await reqDBInstance.GetDecryptedData(pClient, value.setup_json, objLogInfo);
                                                            var MailSetup = JSON.parse(deCryptedsetup).MAIL;
                                                            var pMailMsg = {};
                                                            pMailMsg.IsBodyHtml = true;
                                                            pMailMsg.ServerName = MailSetup.SERVERNAME;
                                                            pMailMsg.PortNo = MailSetup.PORTNO;
                                                            pMailMsg.EMailID = MailSetup.EMAILID;
                                                            pMailMsg.To = SendToMail;
                                                            pMailMsg.Pwd = MailSetup.PASSWORD;
                                                            pMailMsg.Subject = parsedValue.SUBJECT;
                                                            pMailMsg.Body = MailMsg;
                                                            reqInstanceHelper.PrintInfo(serviceName, "Sending Mail", objLogInfo);
                                                            reqSMTPMail.SendMail(pMailMsg, objLogInfo, function mailres(res) {
                                                                reqInstanceHelper.PrintInfo(serviceName, "send Mail response is " + res, objLogInfo);
                                                                callback();
                                                            });
                                                        } else {
                                                            reqInstanceHelper.PrintInfo(serviceName, "Mail id is empty", objLogInfo);
                                                            callback();
                                                            reqInstanceHelper.SendResponse(serviceName, appResponse, 'FAILURE', objLogInfo, 'ERR-AUT-14914', '', '', 'FAILURE', 'Mail id is empty');
                                                        }
                                                    }
                                                } else {
                                                    return reqInstanceHelper.SendResponse(serviceName, appResponse, 'FAILURE', objLogInfo, 'ERR-AUT-14914', '', '', 'FAILURE', 'Com Template not found');
                                                }
                                            }

                                        }, function (error) {
                                            if (error) {
                                                return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-AUT-14904', 'Exception Occured While WPSimpleLogin API Calling... ', error);
                                            } else {
                                                OTPValueInsertRedis();
                                            }
                                        });
                                    } else {
                                        return reqInstanceHelper.SendResponse(serviceName, appResponse, 'FAILURE', objLogInfo, 'ERR-AUT-14914', '', '', 'FAILURE', 'Com Setup not found');
                                    }
                                } catch (error) {
                                    return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-AUT-14905', 'Exception Occured While ... ', error);
                                }
                            }

                            //insert the otp value into Redis
                            function OTPValueInsertRedis() {
                                try {
                                    reqInstanceHelper.PrintInfo(serviceName, "Going to insert otp value into redis", objLogInfo);
                                    var rediskey = reqUuid.v1();
                                    reqRedisInstance.RedisInsert(clientR, 'OTP_' + rediskey, parseInt(OTPValue), intOtpExpire);
                                    var resObj = {};
                                    resObj.OTPId = rediskey;
                                    //appResponse.send(rediskey);
                                    console.log(resObj);
                                    reqInstanceHelper.SendResponse(serviceName, appResponse, resObj, objLogInfo, '', '', '', "SUCCESS");
                                } catch (error) {
                                    return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-AUT-14906', 'Exception Occured While WPSimpleLogin API Calling... ', error);
                                }

                            }

                        });
                    } catch (error) {
                        return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-AUT-14907', 'Exception Occured While WPSimpleLogin API Calling... ', error);
                    }

                });
            } catch (error) {
                return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-AUT-14908', 'Exception Occured While WPSimpleLogin API Calling... ', error);
            }
        });
    } catch (error) {
        return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-AUT-14909', 'Exception Occured While WPSimpleLogin API Calling... ', error);
    }
});

module.exports = router;
/************ End of Service ***********/