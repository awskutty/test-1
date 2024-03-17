/*
Modified By Udhayaraj Ms for handling User Not found.
*/
// Require dependencies
var modPath = '../../../../node_modules/'
var reqExpress = require(modPath + 'express');
var reqGetCltPwdPolicy = require('./GetCltPwdPolicy');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqProducer = require('../../../../torus-references/common/Producer');
var router = reqExpress.Router();

// Cassandra initialization
// var mCltClient = reqCasInstance.SessionValues['clt_cas'];

const FORGOTPWD = 'select client_id,u_id,email_id,mobile_no from users where login_name=?';
const USERSELSTMT = 'Select * from users where login_name =?';
const SETUP = 'select setup_json from client_setup where client_id =? and category=?';

// Host the login api
router.post('/CltForgotPwd', function(pReq, pResp, pNext) {
    var objLogInfo = reqLogInfo.AssignLogInfoDetailForCP(pReq.body, pReq);
    objLogInfo.PROCESS = 'CltForgotPwd-Authentication';
    objLogInfo.ACTION = 'CltForgotPwd';
    reqLogWriter.Eventinsert(objLogInfo);

    try {
        var strUname = pReq.body.UName.toUpperCase();
        var Fpswd = "UserName Not Found"
        var fclient_id = "";
        var femail_id = "";
        var fmobileno = "";
        var fu_id = "";
        var cltID = '';
        var msgvalue = 0;
        var pUsermail = "";
        var pMobileno = "";
        var PwdPolicy;
        GetCltPwdPolicy();

        function GetCltPwdPolicy() {
            try {
                //reqCassandraInstance.GetCassandraConn(pReq.headers, 'clt_cas', function Callback_GetCassandraConn(mCltClient) {
                reqDBInstance.GetFXDBConnection(pReq.headers, 'clt_cas', objLogInfo, function Callback_GetCassandraConn(mCltClient) {
                    //mCltClient.execute(FORGOTPWD, [strUname], function (err, res) {
                    reqDBInstance.GetTableFromFXDB(mCltClient, 'USERS', ['client_id', 'u_id', 'email_id', 'mobile_no'], {
                        'login_name': strUname
                    }, objLogInfo, function(err, res) {
                        try {
                            if (err) {
                                reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10066");

                            } else {
                                if (res.rows.length == 0) {
                                    pResp.send(Fpswd);
                                } else {
                                    for (var i = 0; i < res.rows.length; i++) {
                                        var forgotPwd = res.rows[i];
                                        Fpswd = "User Found";
                                        fclient_id = forgotPwd.client_id;
                                        reqGetCltPwdPolicy.GetCltPwdPolicy(mCltClient, fclient_id, function callback(res) {
                                            try {
                                                if (!err) {
                                                    PwdPolicy = res;
                                                    femail_id = forgotPwd.email_id;
                                                    fmobileno = forgotPwd.mobile_no;
                                                    fu_id = forgotPwd.u_id;
                                                    clt_forgotOTP(strUname, mCltClient);
                                                }
                                            } catch (error) {
                                                errorHandler("ERR-FX-10066", "Error CltForgotPwd function ERR-004 " + error)
                                            }
                                        });

                                    }
                                }
                            }
                        } catch (error) {
                            errorHandler("ERR-FX-10065", "Error CltForgotPwd function ERR-004 " + error)
                        }
                    });
                });
            } catch (error) {
                errorHandler("ERR-FX-10064", "Error CltForgotPwd function ERR-004 " + error)
            }
        }


        function clt_forgotOTP(strUname, mCltClient) {
            //mCltClient.execute(USERSELSTMT, [strUname], function (err, res) {
            reqDBInstance.GetTableFromFXDB(mCltClient, 'USERS', [], {
                'login_name': strUname
            }, objLogInfo, function(err, res) {
                try {
                    if (err) {
                        reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10063");

                    } else {
                        for (var i = 0; i < res.rows.length; i++) {
                            var user = res.rows[0];
                            cltID = user.client_id;
                            var pUsermail = user.email_id;
                            var pMobileno = user.mobile_no;
                            //mCltClient.execute(SETUP, [cltID, 'FRGT_PWD_TEMPLATE'], function (err, result) {
                            reqDBInstance.GetTableFromFXDB(mCltClient, 'CLIENT_SETUP', ['setup_json'], {
                                'client_id': cltID,
                                'category': 'FRGT_PWD_TEMPLATE'
                            }, objLogInfo, function(err, result) {
                                try {
                                    if (err) {
                                        reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10063");

                                    } else {
                                        if (result.rows.length > 0) {
                                            var ftpwd = {};
                                            var msgvalue = Math.floor(Math.random() * 99999999);
                                            var param = {};
                                            param.email_id = femail_id;
                                            param.mobile_no = fmobileno;
                                            param.client_url = "";
                                            param.needurlreplace = 'N';
                                            param.user_name = strUname;
                                            param.OTP = msgvalue;
                                            var pTemplate = result.rows[0].setup_json;
                                            param.SMS_TEMPLATE = JSON.parse(pTemplate).SMS_TEMPLATE;
                                            param.MAIL_TEMPLATE = JSON.parse(pTemplate).MAIL_TEMPLATE;
                                            reqProducer.ProduceMessage('APCP_OTP', param, pReq.headers, function(response) {
                                                try {
                                                    if (err) {
                                                        reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10063");

                                                    } else {
                                                        if (response == "SUCCESS") {
                                                            var strOTPResult = cltID + "&" + msgvalue;
                                                            ftpwd.OTP = strOTPResult;
                                                            ftpwd.PASSWORD_POLICY = JSON.parse(PwdPolicy);
                                                            ftpwd.MESSAGE = Fpswd;
                                                            ftpwd.User_ID = fu_id;
                                                            ftpwd = JSON.stringify(ftpwd);
                                                            reqLogWriter.EventUpdate(objLogInfo);
                                                            pResp.send(JSON.stringify(ftpwd));
                                                        }
                                                    }
                                                } catch (error) {
                                                    errorHandler("ERR-FX-10063", "Error CltForgotPwd function ERR-004 " + error)
                                                }
                                            });
                                        }
                                    }

                                } catch (error) {
                                    errorHandler("ERR-FX-10062", "Error CltForgotPwd function ERR-004 " + error)
                                }
                            })
                        }
                    }
                } catch (error) {
                    errorHandler("ERR-FX-10061", "Error CltForgotPwd function ERR-004 " + error)
                }
            })
        }
    } catch (error) {
        errorHandler("ERR-FX-10060", "Error CltForgotPwd function ERR-004 " + error)
    }

    function errorHandler(errcode, message) {
        console.log(message.stack, errcode);
        reqLogWriter.TraceError(objLogInfo, message, errcode);
    }
});


module.exports = router;