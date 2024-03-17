/*
@Api_Name           : /ClearWPUserSessions,
@Description        : To  clear the users session  call from press F9 key press,
@Last_Error_Code    : ERR-AUT-10712
*/

// Require dependencies
var modPath = '../../../../node_modules/'
var refPath = '../../../../torus-references/';
var reqExpress = require(modPath + 'express');
var router = reqExpress.Router();
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var DBInstance = require('../../../../torus-references/instance/DBInstance');
var reqRedisInstance = require('../../../../torus-references/instance/RedisInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var serviceName = 'ClearWPUserSessions';

// API hosting
router.post('/ClearWPUserSessions', function (appRequest, appResponse) {
    try {
        var objLogInfo;
        appResponse.on('close', function () { });
        appResponse.on('finish', function () { });
        appResponse.on('end', function () { });
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, sessionInfo) {
            objLogInfo.PROCESS = 'ClearWPUserSessions-Authentication';
            objLogInfo.ACTION = 'ClearWPUserSessions';
            objLogInfo.HANDLER_CODE = 'Clear_WP_UserSessions';
            // Initialize local variables
            var strLoginName = appRequest.body.PARAMS.pUname;
            var strSessionID = appRequest.body.PARAMS.SESSION_ID;
            reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo);

            // main function call and result will send from here
            _DoClearUserSession(function (finalcallback) {
                if (finalcallback.STATUS == 'SUCCESS') {
                    reqInstanceHelper.SendResponse(serviceName, appResponse, finalcallback.SUCCESS_DATA, objLogInfo, '', '', '', 'SUCCESS', finalcallback.SUCCESS_MESSAGE);
                } else {
                    reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, finalcallback.ERROR_CODE, finalcallback.ERROR_MESSAGE, finalcallback.ERROR_OBJECT);
                }
            });

            // Do the ClearUserSessions when user already logged from another sysytem
            function _DoClearUserSession(finalcallback) {
                try {
                    reqInstanceHelper.PrintInfo(serviceName, '_DoClearUserSession function executing...', objLogInfo);
                    DBInstance.GetFXDBConnection(appRequest.headers, 'clt_cas', objLogInfo, function Callback_GetCassandraConn(mClient) {
                        // To select the user
                        reqInstanceHelper.PrintInfo(serviceName, 'querying users table', objLogInfo);
                        DBInstance.GetTableFromFXDB(mClient, 'users', ['u_id', 'login_name'], {
                            'login_name': strLoginName
                        }, objLogInfo, function callbackSelUser(err, pResult) {
                            try {
                                if (err) {
                                    finalcallback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10701', ' GetTableFromFXDB for USERS table failed', err))
                                } else {
                                    if (pResult.rows.length > 0) {
                                        reqInstanceHelper.PrintInfo(serviceName, 'got result from  users table', objLogInfo);
                                        var strUid = pResult.rows[0].u_id;
                                        _ClrSession(strUid, mClient, function (res) {
                                            finalcallback(res)
                                        });
                                    } else {
                                        finalcallback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10702', 'Users table rows not found', ''))
                                    }
                                }
                            } catch (error) {
                                return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-AUT-10703', 'querying users table', error);
                            }
                        });
                    });
                } catch (error) {
                    return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-AUT-10704', 'catch error  _DoClearUserSession function', error);
                }
            }

            // To delete the user session entry against the user id
            function _ClrSession(pUid, mClient, callback) {
                try {

                    reqInstanceHelper.PrintInfo(serviceName, '_ClrSession function called, delete user_sessions query executing...', objLogInfo);
                    // Delete the user session
                    DBInstance.DeleteFXDB(mClient, 'user_sessions', {
                        'u_id': pUid
                    }, objLogInfo, function callbackDelSess(err, pResult) {
                        try {
                            if (err) {
                                callback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10705', ' DeleteFXDB from  user_sessions Failed', err))
                            } else {
                                var strResult = "SUCCESS"
                                callback(sendMethodResponse("SUCCESS", '', strResult, '', ' ', ''));
                                var rediskey = 'SESSIONID-' + strSessionID;
                                reqInstanceHelper.PrintInfo(serviceName, 'Delete user_sessions success...', objLogInfo);
                                reqRedisInstance.GetRedisConnection(function (error, clientR) {
                                    try {
                                        if (error) {
                                            callback(sendMethodResponse('FAILURE', '', '', 'ERR-AUT-10712', 'Exception Occured While Delete key from redis ', error));
                                        } else {
                                            clientR.del(rediskey, function (err, reply) {
                                                try {
                                                    if (err) {
                                                        callback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-10706', ' Deleteing  Redis session  failed ', err))
                                                    } else {
                                                        reqInstanceHelper.PrintInfo(serviceName, 'Redis Session ID Cleared. Redis SessionID is :' + rediskey, objLogInfo);
                                                        var strResult = "SUCCESS"
                                                        // Return the response
                                                        callback(sendMethodResponse("SUCCESS", '', strResult, '', ' ', ''));
                                                    }
                                                } catch (error) {
                                                    callback(sendMethodResponse('FAILURE', '', '', 'ERR-AUT-10707', 'Exception Occured While Delete key from redis ', error));
                                                }
                                            });
                                        }
                                    } catch (error) {
                                        callback(sendMethodResponse('FAILURE', '', '', 'ERR-AUT-10711', 'Exception Occured While Delete key from redis ', error));
                                    }
                                });
                            }
                        } catch (error) {
                            callback(sendMethodResponse('FAILURE', '', '', 'ERR-AUT-10708', 'Exception Occured While executing callbackDelSess function  ', error));
                        }
                    });
                } catch (error) {
                    callback(sendMethodResponse('FAILURE', '', '', 'ERR-AUT-10709', 'Exception Occured While executing _ClrSession function  ', error));
                }
            }
        })
    } catch (error) {
        return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-AUT-10710', 'Catch error - ClearWPUserSessions function', error);
    }
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
    }
    return obj
}
module.exports = router;
//*******End of Serive*******//