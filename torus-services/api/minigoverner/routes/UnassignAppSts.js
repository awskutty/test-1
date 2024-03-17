var reqExpress = require('express');
var router = reqExpress.Router();
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqLINQ = require('node-linq').LINQ;
var strServiceName = 'SaveAppsts';
router.post('/UnAssignappsts', function (appRequest, appResponse) {
    try {
        var objLogInfo = '';
        var pHeader = appRequest.headers;
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, sessionInfo) {
            try {
                var pParams = appRequest.body.PARAMS;
                var APP_ID = pParams.APP_ID || objLogInfo.APP_ID;
                var ClusterCode = pParams.CLUSTER_CODE;
                var AppSTSId = pParams.APP_STS_ID;
                reqDBInstance.GetFXDBConnection(pHeader, 'clt_cas', objLogInfo, function (DBSession) {
                    try {
                        mainfunction()

                        function mainfunction() {
                            try {
                                checkappusts(function (res) {
                                    var objCond = {};
                                    objCond.APP_ID = APP_ID;
                                    objCond.CLUSTER_CODE = ClusterCode;
                                    objCond.APPSTS_ID = AppSTSId;
                                    reqDBInstance.DeleteFXDB(DBSession, 'APP_SYSTEM_TO_SYSTEM', objCond, objLogInfo, function (pErr, PRes) {
                                        try {
                                            if (pErr) {
                                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50550', 'appsysinsert function ', pErr, '', '');
                                            } else {
                                                reqInstanceHelper.SendResponse(strServiceName, appResponse, 'SUCCESS', objLogInfo, '', '', '', '', '');
                                            }
                                        } catch (error) {
                                            reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50551', 'Error occured in delete app_sts function ', error, '', '');
                                        }
                                    })
                                })
                            } catch (error) {
                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50552', 'mainfunction function ', error, '', '');
                            }
                        }


                        function checkappusts(pcallback) {
                            try {
                                var selectquery = {
                                query : `select * from app_user_sts aus inner join app_users ap on aus.appu_id=ap.appu_id 
                                    where aus.appsts_id = ? and ap.status is null and ap.app_id = ? `,
                                params : [AppSTSId,APP_ID]
                                }                                
                                reqInstanceHelper.PrintInfo(strServiceName, 'Querying app_user_sts table', objLogInfo);
                                reqDBInstance.ExecuteSQLQueryWithParams(DBSession, selectquery, objLogInfo, function (Result, err) {                               
                             
                                    try {
                                        if (err) {
                                            reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50556', 'Error Occured ', err, '', '');
                                        } else {
                                            if (Result.rows.length) {
                                                // var AppstsInfo = new reqLINQ(Result.rows)
                                                //     .Where(function (res) {
                                                //         return res.appsts_id == AppSTSId;
                                                //     }).ToArray();
                                                // if (AppstsInfo.length) {
                                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, 'System Linked with some users.Unassign from application not allowed', objLogInfo, '', '', '', 'FAILURE', '');
                                                // } else {
                                                //     pcallback()
                                                // }
                                            } else {
                                                pcallback()
                                            }
                                        }
                                    } catch (error) {
                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50555', 'checkappusts callbackfunction ', error, '', '');
                                    }
                                })
                            } catch (error) {
                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50556', 'checkappusts function ', error, '', '');
                            }
                        }
                    } catch (error) {
                        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50553', 'Exception Ocuured GetFXDBConnection ', error, '', '');
                    }
                })
            } catch (error) {
                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50554', 'Exception Ocuured AssignLogInfoDetail ', error, '', '');
            }
        })
    } catch (error) {
        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50555', 'Exception Ocuured while UnAssignappsts router ', error, '', '');
    }
})
module.exports = router