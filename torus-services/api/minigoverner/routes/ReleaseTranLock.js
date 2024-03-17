var reqExpress = require('express');
var router = reqExpress.Router();
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqTRNDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var strServiceName = 'ReleaseTranLock';
var request = require('request');
var reqRedisInstance = require('../../../../torus-references/instance/RedisInstance');
var reqsvchelper = require('../../../../torus-references/common/serviceHelper/ServiceHelper');

router.post('/ReleaseTranLock', function (appRequest, appResponse) {
    try {
        var objLogInfo = '';
        var pHeader = appRequest.headers;
        var pParams = appRequest.body.PARAMS;
        var UId = pParams.SELECTED_USER_ID;
        var Logoutmode = pParams.Logout_Mode;
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, sessionInfo) {
            try {
                var AppId = objLogInfo.APP_ID;
                var loginName = objLogInfo.LOGIN_NAME
                reqDBInstance.GetFXDBConnection(pHeader, 'clt_cas', objLogInfo, function (mclient) {
                    if (pParams.pUname) {
                        try {
                            var objCond = {};
                            objCond.LOGIN_NAME = pParams.pUname.toUpperCase();
                            // Query the USERS table for get the selected u_id
                            reqDBInstance.GetTableFromFXDB(mclient, 'USERS', [], objCond, objLogInfo, function (error, result) {
                                try {
                                    if (error) {
                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50613', 'ERROR IN GET USERS TABLE ', error, '', '');
                                    } else {
                                        if (result.rows.length > 0) {
                                            UId = result.rows[0].u_id;
                                            ReleaseTranLocks(mclient);
                                        } else {
                                            reqInstanceHelper.SendResponse(strServiceName, appResponse, 'SUCCESS', objLogInfo, '', '', '', '', 'User not Found');
                                        }
                                    }
                                } catch (error) {
                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50614', 'Exception occured GetTableFromFXDB() function ', error, '', '');
                                }
                            })
                        } catch (error) {
                            reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50615', 'Exception occured GetFXDBConnection() function ', error, '', '');
                        }
                    } else {
                        ReleaseTranLocks(mclient);
                    }
                })


                function ReleaseTranLocks(mclient) {
                    try {
                        var param = {
                            U_ID: UId,
                            Logout_Mode: 'FORCED',
                            loginName: loginName
                        }
                        reqsvchelper.ReleaseTranLocks(pHeader, mclient, param, appRequest, appResponse, objLogInfo, function (resdata) {

                            reqInstanceHelper.SendResponse(strServiceName, appResponse, resdata.Status, objLogInfo, resdata.ErrorCode, resdata.ErrorMsg, resdata.Error, '', '');

                        })
                    } catch (error) {

                    }
                    // reqTRNDBInstance.GetTranDBConn(pHeader, false, function (DBSession) {
                    //     try {
                    //         var objCond = {};
                    //         objCond.LOCKED_BY = UId;
                    //         var updatecolumn = {
                    //             LOCKED_BY: '',
                    //             LOCKED_BY_NAME: ''
                    //         }
                    //         var updatecond = {
                    //             LOCKED_BY: UId,
                    //         }
                    //         // Update the TRANSACTION_SET For Clear the session LOCKED BY AND LOCKED BY NAME COLUMN
                    //         reqTRNDBInstance.UpdateTranDBWithAudit(DBSession, 'TRANSACTION_SET', updatecolumn, updatecond, objLogInfo, function (result, pError) {
                    //             if (pError) {
                    //                 reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50601', 'Update error in TRANSACTION_SET  ', pError, '', '');
                    //             } else {
                    //                 reqDBInstance.GetFXDBConnection(pHeader, 'clt_cas', objLogInfo, function (mclient) {
                    //                     try {
                    //                         var objCond = {};
                    //                         objCond.U_ID = UId;
                    //                         // Query the USER_SESSIONS table for get the selected user session id and logip column values
                    //                         reqDBInstance.GetTableFromFXDB(mclient, 'USER_SESSIONS', [], objCond, objLogInfo, function (error, result) {
                    //                             try {
                    //                                 if (error) {
                    //                                     reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50602', 'ERROR IN GET USER SESSION TABLE ', error, '', '');
                    //                                 } else {
                    //                                     if (result.rows.length > 0) {
                    //                                         var RedisURLKey = "NGINX_HAPROXY_URL";
                    //                                         var URLPrecedence = "";
                    //                                         // get the nginx url in redis
                    //                                         reqRedisInstance.GetRedisConnection(function (error, clientR) {
                    //                                             if (error) {
                    //                                                 reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50603', 'ERROR IN GET REDIS CONNECTION ', error, '', '');
                    //                                             } else {
                    //                                                 clientR.get(RedisURLKey, function (err, res) {
                    //                                                     if (err) {
                    //                                                         reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50604', 'ERROR IN GET REDIS URL ', err, '', '');
                    //                                                     } else {
                    //                                                         URLPrecedence = JSON.parse(res)["url"];
                    //                                                         console.log("URL PRECEDENCE" + URLPrecedence)

                    //                                                         var url = "";
                    //                                                         url = URLPrecedence.split("microsvc")[0];
                    //                                                         console.log("URL IS " + url);

                    //                                                         var PARAMS = {
                    //                                                             PARAMS: {
                    //                                                                 pLoginIP: result.rows[0].login_ip,
                    //                                                                 Logout_Mode: Logoutmode || 'FORCED',
                    //                                                                 LoginName: loginName || ''
                    //                                                             }

                    //                                                         }
                    //                                                         //Call the WpLogoff for clear the user session in redis
                    //                                                         var options = {
                    //                                                             url: url + 'Authentication/WPLogoff/',
                    //                                                             method: 'POST',
                    //                                                             json: true,
                    //                                                             headers: {
                    //                                                                 "session-id": result.rows[0].session_id
                    //                                                             },
                    //                                                             body: PARAMS
                    //                                                         };
                    //                                                         request(options, function (error, response, body) {
                    //                                                             try {
                    //                                                                 if (error) {
                    //                                                                     reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50605', 'ERROR IN WPGETLOGOFF ', error, '', '');
                    //                                                                 } else {
                    //                                                                     reqInstanceHelper.SendResponse(strServiceName, appResponse, 'SUCCESS', objLogInfo, '', '', '', '', '');
                    //                                                                 }
                    //                                                             } catch (error) {
                    //                                                                 reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50606', 'ERROR IN Wplogoff api', error, '', '');
                    //                                                             }
                    //                                                         })
                    //                                                     }
                    //                                                 })
                    //                                             }
                    //                                         })
                    //                                     } else {
                    //                                         reqInstanceHelper.SendResponse(strServiceName, appResponse, 'SUCCESS', objLogInfo, '', '', '', '', 'User not Loggedin');
                    //                                     }
                    //                                 }
                    //                             } catch (error) {
                    //                                 reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50607', 'Exception occured GetTableFromFXDB() function ', error, '', '');
                    //                             }
                    //                         })
                    //                     } catch (error) {
                    //                         reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50608', 'Exception occured GetFXDBConnection() function ', error, '', '');
                    //                     }
                    //                 })
                    //             }

                    //         })
                    //     } catch (error) {
                    //         reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50610', 'Exception occured GetTranDBConn() function ', error, '', '');
                    //     }
                    // })
                }
            } catch (error) {
                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50611', 'Exception occured in AssignLogInfoDetail() callback ', error, '', '');
            }
        })
    } catch (error) {
        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50612', 'Exception occured main function ', error, '', '');
    }
})
module.exports = router