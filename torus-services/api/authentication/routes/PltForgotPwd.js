/*
Modified By Udhayaraj MS
*/
// Require dependencies
var modPath = '../../../../node_modules/'
var reqExpress = require(modPath + 'express');
var reqGetCltPwdPolicy = require('./GetCltPwdPolicy');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');;
var reqPwdPolicy = require('./GetPltPwdPolicy');
var router = reqExpress.Router();
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqProducer = require('../../../../torus-references/common/Producer');
var DBInstance = require('../../../../torus-references/instance/DBInstance');
// Cassandra initialization
var mPltClient = '';

// Prepare queries
const CFORGOTPWD = 'select client_id,email_id,mobile_no from clients where email_id =? allow filtering';
const SETUP = 'select value from platform_setup where code =?';
// Host the login api
router.post('/PltForgotPwd', function(pReq, pResp, pNext) {
    var objLogInfo = reqLogInfo.AssignLogInfoDetailForCP(pReq.body, pReq);
    objLogInfo.PROCESS = 'PltForgotPwd-Authentication';
    objLogInfo.ACTION = 'PltForgotPwd';
    reqLogWriter.Eventinsert(objLogInfo);

    try {

        pHeaders = pReq.headers;
        DBInstance.GetFXDBConnection(pHeaders, 'plt_cas', objLogInfo, function Callback_GetCassandraConn(pClient) {
            // reqCasInstance.GetCassandraConn(pHeaders, 'plt_cas', function Callback_GetCassandraConn(pClient) {
            mPltClient = pClient;
            // Initialize local variables
            reqLogWriter.TraceInfo(objLogInfo, 'PltForgotPwd called...');
            pResp.setHeader('Content-Type', 'application/json');
            var mailid = pReq.body.CName.toUpperCase();
            var strCname = pReq.body.CName.toUpperCase();
            var strCpswd = "Username not found";
            var strClient_id = "";
            var strEmail_id = "";
            var strMobileno = "";
            DBInstance.GetTableFromFXDB(mPltClient, 'clients', ['client_id', 'email_id', 'mobile_no'], {
                'email_id': mailid
            }, objLogInfo, function callbackpltfpwd(err, result) {
                // mPltClient.execute(CFORGOTPWD, [mailid], {
                //     prepare: true
                // }, function callbackpltfpwd(err, result) {
                if (err) {
                    reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10173");
                } else {
                    if (result.rows.length == 0) {
                        reqLogWriter.EventUpdate(objLogInfo);
                        pResp.send(strCpswd);
                    } else {
                        for (var i = 0; i < result.rows.length; i++) {
                            var client = result.rows;
                            var param = {};
                            var Ctpwd = {};
                            var msgvalue = Math.floor(Math.random() * 99999999);
                            strCpswd = "User Found";
                            Client_id = client[0].client_id;
                            param.email_id = client[0].email_id;
                            param.mobile_no = client[0].mobile_no;
                            param.client_url = "";
                            param.needurlreplace = 'N';
                            param.user_name = strCname;
                            param.OTP = msgvalue;
                            DBInstance.GetTableFromFXDB(mPltClient, 'platform_setup', ['value'], {
                                'code': 'FRGT_PWD_TEMPLATE'
                            }, objLogInfo, function callbacksetup(err, res) {
                                // mPltClient.execute(SETUP, ["FRGT_PWD_TEMPLATE"], {
                                //     prepare: true
                                // }, function callbacksetup(err, res) {
                                try {
                                    if (err) {
                                        reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10173");
                                    } else {
                                        var pTemplate = res.rows[0].value;
                                        param.SMS_TEMPLATE = JSON.parse(pTemplate).SMS_TEMPLATE;
                                        param.MAIL_TEMPLATE = JSON.parse(pTemplate).MAIL_TEMPLATE;
                                        reqProducer.ProduceMessage('APCP_OTP', param, pHeaders, function(response) {
                                            try {
                                                if (err) {
                                                    reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10173");
                                                } else {
                                                    if (response == "SUCCESS") {
                                                        reqPwdPolicy.GetPltPwdPolicy(mPltClient, function callback(res) {
                                                            try {
                                                                Ctpwd.OTP = Client_id + "&" + msgvalue;
                                                                Ctpwd.PASSWORD_POLICY = JSON.parse(res);
                                                                Ctpwd.MESSAGE = strCpswd;
                                                                Ctpwd.CLIENT_ID = Client_id;
                                                                Ctpwd = JSON.stringify(Ctpwd);
                                                                pResp.send(JSON.stringify(Ctpwd));
                                                            } catch (error) {
                                                                errorHandler("ERR-FX-10173", "Error PltForgotPwd function" + error)
                                                            }
                                                        });
                                                    }
                                                }
                                            } catch (error) {
                                                errorHandler("ERR-FX-10172", "Error PltForgotPwd function" + error)
                                            }
                                        });
                                    }
                                } catch (error) {
                                    errorHandler("ERR-FX-10171", "Error PltForgotPwd function" + error)
                                }
                            })
                        }
                    }
                }
            })
        })
    } catch (error) {
        errorHandler("ERR-FX-10170", "Error PltForgotPwd function" + error)
    }

    function errorHandler(errcode, message) {
        console.log(message, errcode);
        reqLogWriter.TraceError(objLogInfo, message, errcode);
    }
});


module.exports = router;