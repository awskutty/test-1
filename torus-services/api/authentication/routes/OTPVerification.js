/**
 * @Api_Name        : /verifyOtp,
 * @Description     : Verify user entered OTP with Redis entry (send_otp handler)
 * @Last_Error_Code :ERR-AUT-
 **/

// Require dependencies
var modPath = "../../../../node_modules/";
var reqExpress = require(modPath + "express");
var router = reqExpress.Router();
var reqLogInfo = require("../../../../torus-references/log/trace/LogInfo");
var reqInstanceHelper = require("../../../../torus-references/common/InstanceHelper");
var reqRedisInstance = require("../../../../torus-references/instance/RedisInstance");
var reqInstanceHelper = require("../../../../torus-references/common/InstanceHelper");
var reqDBInstance = require("../../../../torus-references/instance/DBInstance");
var reqsvchelper = require('../../../../torus-references/common/serviceHelper/ServiceHelper');
router.post("/verifyOtp", function (appRequest, appResponse) {
    try {
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
            try {
                var serviceModel = reqFXDBInstance.DBInstanceSession['SERVICE_MODEL'];
                var serviceName = "verifyOtp";
                var sessioninfo = objSessionInfo;
                var pHeaders = appRequest.headers;
                var params = appRequest.body.PARAMS;
                var Rediskey = 'OTP_' + params.OTPId;
                var UserEnteredOTP = params.UserEnteredOTP;
                var defaultpwdval = '';
                var quryCond = {
                    category: 'DEFAULT_OTP_CONFIG',
                    client_id: sessioninfo.CLIENT_ID,
                    tenant_id: sessioninfo.TENANT_ID
                };
                var RedisPwd = '';
                reqRedisInstance.GetRedisConnection(function (error, clientR) {
                    try {
                        clientR.get(Rediskey, function (err, RedPwd) {
                            RedisPwd = RedPwd;
                            if (err) {
                                return reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-AUT-14200', 'Err Occured get data from session DB ', err);
                            } else {
                                reqInstanceHelper.PrintInfo(serviceName, "RedPwd=========" + RedPwd, objLogInfo);
                                reqInstanceHelper.PrintInfo(serviceName, "UserEnteredOTP=========" + UserEnteredOTP, objLogInfo);
                                if (RedisPwd) {
                                    if (UserEnteredOTP == RedisPwd) {
                                        reqInstanceHelper.SendResponse(serviceName, appResponse, 'SUCCESS', objLogInfo, '', '', error, 'SUCCESS');
                                        deleteOtpFromRedis();
                                    } else {
                                        reqInstanceHelper.PrintInfo(serviceName, "check default otp", objLogInfo);
                                        checkdefaultotp();
                                    }
                                } else {
                                    checkdefaultotp();
                                }
                            }
                        });

                        function deleteOtpFromRedis() {
                            try {
                                reqInstanceHelper.PrintInfo(serviceName, 'Going to delete OTP Value', objLogInfo);
                                clientR.del(Rediskey, function (err, reply) {
                                    if (err) {
                                        reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-AUT-14204', 'Err Occured remove OTP from Session DB', err, 'FAILURE');
                                    } else {
                                        reqInstanceHelper.PrintInfo(serviceName, 'OTP Value Deleted', objLogInfo);
                                    }
                                });
                            } catch (error) {
                                return reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-AUT-14208', 'Exception Occured deleteOtpFromRedis function... ', error);
                            }
                        }

                        function checkdefaultotp() {
                            try {
                                reqDBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function Callback_GetCassandraConn(pClient) {
                                    if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
                                        var cond = {};
                                        cond.setup_code = 'DEFAULT_OTP_CONFIG';
                                        reqsvchelper.GetSetupJson(pClient, cond, objLogInfo, function (res) {
                                            if (res.Status == 'SUCCESS' && res.Data.length) {
                                                var Setupjson = JSON.parse(res.Data[0].setup_json);
                                                aftergetsetupJson(Setupjson);
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
                                                    var Setupjson = JSON.parse(res.rows[0].setup_json);
                                                    aftergetsetupJson(Setupjson);
                                                }
                                            } catch (error) {
                                                return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-AUT-14902', 'Exception Occured  get setup callback', error);
                                            }
                                        });

                                    }
                                    function aftergetsetupJson(Setupjson) {
                                        try {
                                            if (Setupjson.NEED_DEFAULT_OTP == 'Y') {
                                                if (UserEnteredOTP == Setupjson.OTP_VALUE) {
                                                    reqInstanceHelper.PrintInfo(serviceName, "default otp matched", objLogInfo);
                                                    deleteOtpFromRedis();
                                                    reqInstanceHelper.SendResponse(serviceName, appResponse, 'SUCCESS', objLogInfo, '', '', error, 'SUCCESS');
                                                } else {
                                                    reqInstanceHelper.PrintInfo(serviceName, "default otp also not  matched", objLogInfo);
                                                    reqInstanceHelper.SendResponse(serviceName, appResponse, 'FAILURE', objLogInfo, '', '', '', 'FAILURE', 'Invalid Otp');
                                                }
                                            } else if (Setupjson.NEED_DEFAULT_OTP == 'N' && RedisPwd == null) {
                                                reqInstanceHelper.SendResponse(serviceName, appResponse, 'FAILURE', objLogInfo, '', '', '', 'FAILURE', 'OTP Expired');
                                            }
                                        } catch (error) {
                                            return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-AUT-14902', 'Exception Occured  get setup callback', error);
                                        }
                                    }
                                });
                            } catch (error) {
                                return reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-AUT-14208', 'Exception Occured defaultotp function... ', error);
                            }
                        }
                    } catch (error) {
                        return reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-AUT-14201', 'Exception Occured Get Session DB ... ', error);
                    }
                });
            } catch (error) {
                return reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-AUT-14202', 'Exception occured  getting objlog info  ', error);
            }

        });
    } catch (error) {
        return reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-AUT-14203', 'Exception occured main catch', error);
    }
});
module.exports = router;
/************ End of Service ***********/