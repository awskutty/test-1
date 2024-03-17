var modPath = '../../../../node_modules/'
var reqExpress = require('express');
var router = reqExpress.Router();
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');

var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var strServiceName = 'DeleteClusterSystem';
var async = require(modPath + 'async');
router.post('/DeleteClusterSystem', function (appRequest, appResponse) {
    try {
        var objLogInfo = '';
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, sessionInfo) {
            try {
                var pHeader = appRequest.headers;
                objLogInfo.HANDLER_CODE = 'DeleteClusterSystem';
                objLogInfo.PROCESS = 'DeleteClusterSystem-MiniGoverner';
                objLogInfo.ACTION_DESC = 'DeleteClusterSystem';
                var params = appRequest.body.PARAMS;
                var ClusterCode = params.CLUSTER_CODE;
                var ClientID = params.CLIENT_ID;
                var STSID = params.STS_ID;
                var ParentSTSID = params.PARENT_SID;
                if (ParentSTSID == undefined) {
                    ParentSTSID = '0'
                }
                var ChildSID = params.CHIL_SID;
                var AppSTID = params.APPST_ID;
                var APPSTSID = params.APPSTS_ID;
                var STID = params.ST_ID;
                var APPID = objLogInfo.APP_ID


                reqDBInstance.GetFXDBConnection(pHeader, 'clt_cas', objLogInfo, function (DBSession) {
                    try {
                        reqDBInstance.GetTableFromFXDB(DBSession, 'app_user_sts', [], {
                            'appsts_id': APPSTSID
                        }, objLogInfo, function (perror, presult) {
                            if (perror) {
                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Exception Ocuured while GetFXDBConnection ', Err, '', '');
                            } else {
                                if (presult.rows.length > 0) {
                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, 'This Cluster system allocated to some users. Not allowed to delete. ', objLogInfo, 'ERR-MIN-', '', '', '', '');
                                } else {
                                    reqDBInstance.DeleteFXDB(DBSession, 'app_system_to_system', {
                                        'appsts_id': APPSTSID,
                                        'app_id': APPID,
                                        'cluster_code': ClusterCode
                                    }, objLogInfo, function (Err, Res) {
                                        if (Err) {
                                            reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Exception Ocuured while GetFXDBConnection ', Err, '', '');
                                        } else {
                                            reqDBInstance.DeleteFXDB(DBSession, 'app_system_types', {
                                                'appst_id': AppSTID || '0',
                                                'app_id': APPID,
                                                'st_id': STID,
                                            }, objLogInfo, function (err, res) {
                                                if (err) {
                                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Exception Ocuured while GetFXDBConnection ', err, '', '');
                                                } else {
                                                    reqDBInstance.DeleteFXDB(DBSession, 'system_to_system', {
                                                        'sts_id': STSID,
                                                        'cluster_code': ClusterCode,
                                                        'parent_s_id': ParentSTSID,
                                                        'child_s_id': ChildSID
                                                    }, objLogInfo, function (pErr, pRes) {
                                                        if (pErr) {
                                                            reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Exception Ocuured while GetFXDBConnection ', pErr, '', '');
                                                        } else {
                                                            reqInstanceHelper.SendResponse(strServiceName, appResponse, 'SUCCESS', objLogInfo, '', '', '', '', '');
                                                        }
                                                    })
                                                }
                                            })
                                        }
                                    })
                                }
                            }
                        })

                    } catch (error) {
                        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Exception Ocuured while GetFXDBConnection ', error, '', '');
                    }
                })
            } catch (error) {
                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Exception Ocuured while AssignLogInfoDetail ', error, '', '');
            }

        })
    } catch (error) {
        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Exception Ocuured while Delete Cluster ', error, '', '');
    }
});
module.exports = router;