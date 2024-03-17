/*
@Api_Name           : /CheckOTP,
@Description        : For OTP verification
@Last_Error_code    : ERR-AUT-11410'
*/

// Require dependencies
var modPath = '../../../../node_modules/'
var reqExpress = require(modPath + 'express');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqRedisInstance = require('../../../../torus-references/instance/RedisInstance');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqEncHelper = require('../../../../torus-references/common/crypto/EncryptionInstance');
var router = reqExpress.Router();
// var reqTimeSpan = require('timespan');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqDateFormater = require('../../../../torus-references/common/dateconverter/DateFormatter');
const { reject } = require('lodash');


//global variable Initialization
var strServiceName = "CheckOTP";

// Host the method to express
router.post('/CheckOTP', function (appRequest, appResponse) {
    try {
        var objLogInfo;
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, sessionInfo) {
            reqInstanceHelper.PrintInfo(strServiceName, 'Begin', objLogInfo);

            appResponse.on('close', function () { });
            appResponse.on('finish', function () { });
            appResponse.on('end', function () { });

            objLogInfo.HANDLER_CODE = 'CHECK_OTP';
            objLogInfo.PROCESS = 'CheckOTP-Authentication';
            objLogInfo.ACTION_DESC = 'CheckOTP';

            reqDBInstance.GetFXDBConnection(appRequest.headers, 'clt_cas', objLogInfo, async function Callback_GetCassandraConn(mCltClient) {
                reqInstanceHelper.PrintInfo(strServiceName, 'FX DB connection initiated Successfully', objLogInfo);
                // Initialize local variables
                appResponse.setHeader('Content-Type', 'application/json');
                var pUId = appRequest.body.PARAMS.U_ID;
                var pLoginName = appRequest.body.PARAMS.LOGIN_NAME.toUpperCase();
                var pOTPVal = appRequest.body.PARAMS.OTP_VAL;
                var pclientID = appRequest.body.PARAMS.CLIENT_ID;
                var strResult;
                var strOTPID = appRequest.body.PARAMS.Token;
                var decryptedOtp = reqEncHelper.DecryptPassword(pOTPVal);
                var Type = appRequest.body.PARAMS.Type;
                // main function call and result will send from here
                // _Mainfunction(function (finalcallback) {
                //     if (finalcallback.STATUS == 'SUCCESS') {
                //         reqInstanceHelper.SendResponse(strServiceName, appResponse, finalcallback.SUCCESS_DATA, objLogInfo, '', '', '', finalcallback.PROCESS_STATUS, finalcallback.INFO_MESSAGE);
                //     } else {
                //         reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, finalcallback.ERROR_CODE, finalcallback.ERROR_MESSAGE, finalcallback.ERROR_OBJECT);
                //     }
                // });

                getandValidateOTPfromRedis(function (finalcallback) {
                    if (finalcallback.STATUS == 'SUCCESS') {
                        reqInstanceHelper.SendResponse(strServiceName, appResponse, finalcallback.SUCCESS_DATA, objLogInfo, '', '', '', finalcallback.PROCESS_STATUS, finalcallback.INFO_MESSAGE);
                    } else {
                        reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, finalcallback.ERROR_CODE, finalcallback.ERROR_MESSAGE, finalcallback.ERROR_OBJECT);
                    }
                });


                // Compare OTP_LOGS with client typed logs 
                function _Mainfunction(finalcallback) {
                    try {
                        reqInstanceHelper.PrintInfo(strServiceName, 'Querying OTP_LOGS Table', objLogInfo);
                        reqDBInstance.GetTableFromFXDB(mCltClient, 'OTP_LOGS', [], {
                            'login_name': pLoginName,
                            'OTP_ID': strOTPID
                        }, objLogInfo, function callbackusersel(err, pResult) {
                            try {
                                if (err) {
                                    finalcallback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-11401', 'GetTableFromFXDB  OTP_LOGS failed ', err));
                                } else {
                                    if (pResult.rows.length > 0) {
                                        reqInstanceHelper.PrintInfo(strServiceName, 'Got result from OTP_LOGS table', objLogInfo);
                                        var currenttime = reqDateFormater.GetTenantCurrentDateTime(appRequest.headers, objLogInfo);
                                        var OtpCreateddate = pResult.rows[0].created_date;
                                        var TableOTP = pResult.rows[0].otp;
                                        // var tsDiff = reqTimeSpan.fromDates(currenttime, OtpCreateddate, true);
                                        // var blnExpired = (tsDiff.minutes < 2)
                                        // if (!blnExpired) {
                                        //     strResult = 'OTP Expired';
                                        //     _Response();
                                        // } else {
                                        if (TableOTP == reqEncHelper.EncryptPassword(decryptedOtp)) {
                                            reqInstanceHelper.PrintInfo(strServiceName, 'OTP has been Verified', objLogInfo);
                                            strResult = 'SUCCESS';
                                            reqInstanceHelper.PrintInfo(strServiceName, 'Deleting in OTP_LOGS Table', objLogInfo);
                                            reqDBInstance.DeleteFXDB(mCltClient, 'OTP_LOGS', {
                                                'LOGIN_NAME': pLoginName,
                                                'OTP_ID': strOTPID
                                            }, objLogInfo, function callbackdeleteotp(err, Result) {
                                                try {
                                                    if (err) {
                                                        finalcallback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-11402', 'Deletion in OTP_LOGS table has Failed  ', err));
                                                    } else {
                                                        var unlockuser = true;
                                                        if (Type == 'UnlockUser') {
                                                            reqInstanceHelper.PrintInfo(strServiceName, 'Updating in  Users Table ', objLogInfo);
                                                            reqDBInstance.GetTableFromFXDB(mCltClient, 'USERS', ['U_ID', 'CLIENT_ID'], {
                                                                'LOGIN_NAME': pLoginName
                                                            }, objLogInfo, function (err, res) {
                                                                if (err) {
                                                                    finalcallback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-11402', 'Deletion in OTP_LOGS table has Failed  ', err));
                                                                } else {
                                                                    var pUId = res.rows[0].u_id;
                                                                    var pclientID = res.rows[0].client_id;
                                                                    reqDBInstance.UpdateFXDB(mCltClient, 'users', {
                                                                        account_locked_date: null
                                                                    }, {
                                                                        'u_id': pUId,
                                                                        'client_id': pclientID,
                                                                        'login_name': pLoginName
                                                                    }, objLogInfo, function callbackuseraccnt(err, res) {
                                                                        try {
                                                                            if (err) {
                                                                                finalcallback(sendMethodResponse('FAILURE', '', '', 'ERR-AUT-11409', 'Error occured while unlock user', err, 'FAILURE', ''));
                                                                            } else {
                                                                                strResult = 'SUCCESS';
                                                                                finalcallback(sendMethodResponse("SUCCESS", '', 'SUCCESS', '', '', ''));
                                                                            }
                                                                        } catch (error) {
                                                                            finalcallback(sendMethodResponse('FAILURE', '', '', 'ERR-AUT-11410', 'Exception Occured while unlock user', error, 'FAILURE', ''));
                                                                        }
                                                                    })
                                                                }
                                                            })
                                                        } else {
                                                            finalcallback(sendMethodResponse("SUCCESS", '', 'SUCCESS', '', '', ''));
                                                        }
                                                    }
                                                } catch (error) {
                                                    finalcallback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-11403', 'Exception Occured While DeleteFXDB OTP_LOGS table  ', error));
                                                }
                                            })
                                        } else {
                                            reqInstanceHelper.PrintInfo(strServiceName, 'OTP did not Match', objLogInfo);
                                            strResult = 'Invalid OTP';
                                            finalcallback(sendMethodResponse("SUCCESS", '', '', '', '', '', 'FAILURE', strResult));
                                        }
                                    } else {
                                        reqInstanceHelper.PrintInfo(strServiceName, 'OTP Not Found', objLogInfo);
                                        strResult = "OTP Not Found";
                                        finalcallback(sendMethodResponse("SUCCESS", '', '', '', '', '', 'FAILURE', strResult));
                                    }
                                }
                            } catch (error) {
                                finalcallback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-11406', 'Exception Occured While Querying OTP_LOGS Table', error));
                            }
                        })
                    } catch (error) {
                        finalcallback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-11407', 'Exception Occured While executing  _Mainfunction ', error));
                    }
                }

                async function getandValidateOTPfromRedis(finalcallback) {
                    try {
                        reqRedisInstance.GetRedisConnectionwithIndex('3', async function (err, redsSession) {
                            try {
                                var otpkey = 'OTP~' + strOTPID
                                var redisOtp = await reqRedisInstance.GetKeyValue(redsSession, otpkey, objLogInfo);
                                if (redisOtp) {
                                    var redisOTPVal = JSON.parse(redisOtp).OTP
                                    if (redisOTPVal == reqEncHelper.EncryptPassword(decryptedOtp)) {
                                        await redsSession.del(otpkey)
                                        reqInstanceHelper.PrintInfo(strServiceName, 'OTP has been Verified', objLogInfo);
                                        if (Type == 'UnlockUser') {
                                            reqInstanceHelper.PrintInfo(strServiceName, 'Updating in  Users Table ', objLogInfo);
                                            reqDBInstance.GetTableFromFXDB(mCltClient, 'USERS', ['U_ID', 'CLIENT_ID'], {
                                                'LOGIN_NAME': pLoginName
                                            }, objLogInfo, function (err, res) {
                                                if (err) {
                                                    finalcallback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-11402', 'Deletion in OTP_LOGS table has Failed  ', err));
                                                } else {
                                                    var pUId = res.rows[0].u_id;
                                                    var pclientID = res.rows[0].client_id;
                                                    reqDBInstance.UpdateFXDB(mCltClient, 'users', {
                                                        account_locked_date: null
                                                    }, {
                                                        'u_id': pUId,
                                                        'client_id': pclientID,
                                                        'login_name': pLoginName
                                                    }, objLogInfo, function callbackuseraccnt(err, res) {
                                                        try {
                                                            if (err) {
                                                                finalcallback(sendMethodResponse('FAILURE', '', '', 'ERR-AUT-11409', 'Error occured while unlock user', err, 'FAILURE', ''));
                                                            } else {
                                                                strResult = 'SUCCESS';
                                                                finalcallback(sendMethodResponse("SUCCESS", '', 'SUCCESS', '', '', ''));
                                                            }
                                                        } catch (error) {
                                                            finalcallback(sendMethodResponse('FAILURE', '', '', 'ERR-AUT-11410', 'Exception Occured while unlock user', error, 'FAILURE', ''));
                                                        }
                                                    })
                                                }
                                            })
                                        } else {
                                            finalcallback(sendMethodResponse("SUCCESS", '', 'SUCCESS', '', '', ''));
                                        }
                                    } else {
                                        // OTP NOT MATCHED
                                        reqInstanceHelper.PrintInfo(strServiceName, 'OTP did not Match', objLogInfo);
                                        strResult = 'Invalid OTP';
                                        finalcallback(sendMethodResponse("SUCCESS", '', '', '', '', '', 'FAILURE', strResult));
                                    }
                                } else {
                                    // OTP NOT FOUND
                                    reqInstanceHelper.PrintInfo(strServiceName, 'OTP Not Found', objLogInfo);
                                    strResult = "OTP Not Found";
                                    finalcallback(sendMethodResponse("SUCCESS", '', '', '', '', '', 'FAILURE', strResult));
                                }

                            } catch (error) {
                                return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-AUT-11419', 'Exception Occured redisconnection callback function ', error, '', '');
                            }
                        })
                    } catch (error) {
                        return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-AUT-11418', 'Exception Occured getandValidateOTPfromRedis function ', error, '', '');
                    }

                }
            })
        })
    } catch (error) {
        return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-AUT-11408', 'Exception Occured While Executing CheckOTP API ', error, '', '');
    }
});

//Common Result  Preparation
function sendMethodResponse(status, successMessage, SuccessDataObj, errorCode, errorMessage, errorObject, ProcessStatus, INfoMessage) {
    var obj = {
        'STATUS': status,
        'SUCCESS_MESSAGE': successMessage,
        'SUCCESS_DATA': SuccessDataObj,
        'ERROR_CODE': errorCode,
        'ERROR_MESSAGE': errorMessage,
        'ERROR_OBJECT': errorObject,
        'PROCESS_STATUS': ProcessStatus,
        'INFO_MESSAGE': INfoMessage
    }
    return obj
}
module.exports = router;
/*********** End of Service **********/