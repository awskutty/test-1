var modPath = '../../../../node_modules/'
var reqExpress = require('express');
var router = reqExpress.Router();
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');

var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var strServiceName = 'UnassignCluster';
var async = require(modPath + 'async');
router.post('/UnassignCluster', function (appRequest, appResponse) {
    try {
        var objLogInfo = '';
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, sessionInfo) {
            try {
                var pHeader = appRequest.headers;
                objLogInfo.HANDLER_CODE = 'UnassignCluster';
                objLogInfo.PROCESS = 'UnassignCluster-MiniGoverner';
                objLogInfo.ACTION_DESC = 'UnassignCluster';
                var ismultiapp = sessionInfo.IS_MULTIAPP;
                var params = appRequest.body.PARAMS;
                var ClusterCode = params.CLUSTER_CODE;
                var ClientID = params.CLIENT_ID;
                var STSID = params.STS_ID;
                var ParentSTSID = params.PARENT_SID || '0';
                var ChildSID = params.CHIL_SID;
                var AppSTID = params.APPST_ID;
                var APPSTSID = params.APPSTS_ID;
                var STID = params.ST_ID;
                var APPID = objLogInfo.APP_ID;
                var SID = params.S_ID;
                var SCODE = params.S_CODE;
                var SDESC = params.S_DESCRIPTION;
                var IsEnabled = params.IS_ENABLED || '';
                var SCategory = params.S_CATEGORY;
                reqDBInstance.GetFXDBConnection(pHeader, 'clt_cas', objLogInfo, function (DBSession) {
                    if (ismultiapp == 'Y') {
                        reqDBInstance.DeleteFXDB(DBSession, 'system_to_system', {
                            'sts_id': STSID,
                            'cluster_code': ClusterCode,
                            'parent_s_id': ParentSTSID,
                            'child_s_id': ChildSID
                        }, objLogInfo, function (pErr, pRes) {
                            if (pErr) {
                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50520', 'Exception Ocuured while GetFXDBConnection ', pErr, '', '');
                            } else {
                                console.log(pRes)
                                reqInstanceHelper.SendResponse(strServiceName, appResponse, 'Deleted Successfully', objLogInfo, '', '', '', '', '');
                            }
                        })
                    } else {

                        try {
                            reqDBInstance.GetTableFromFXDB(DBSession, 'app_user_sts', [], {
                                'appsts_id': APPSTSID
                            }, objLogInfo, function (perror, presult) {
                                if (perror) {
                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50521', 'Exception Ocuured while GetFXDBConnection ', perror, '', '');
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
                                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50522', 'Exception Ocuured while GetFXDBConnection ', Err, '', '');
                                            } else {
                                                reqDBInstance.DeleteFXDB(DBSession, 'system_to_system', {
                                                    'sts_id': STSID,
                                                    'cluster_code': ClusterCode,
                                                    'parent_s_id': ParentSTSID,
                                                    'child_s_id': ChildSID
                                                }, objLogInfo, function (pErr, pRes) {
                                                    if (pErr) {
                                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50523', 'Exception Ocuured while GetFXDBConnection ', pErr, '', '');
                                                    } else {
                                                        reqDBInstance.InsertFXDB(DBSession, 'system_to_system', [{
                                                            sts_id: STSID,
                                                            cluster_code: '',
                                                            parent_s_id: ParentSTSID,
                                                            child_s_id: ChildSID,
                                                            child_s_description: SDESC,
                                                            created_date: new Date(),
                                                        }], objLogInfo, function (pErr, pRes) {
                                                            if (pErr) {
                                                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50524', 'Insertion Process Failed', pErr, '', '');
                                                            } else {
                                                                getSTCode(STID, function (res) {
                                                                    reqDBInstance.InsertFXDB(DBSession, 'app_system_to_system', [{
                                                                        appsts_id: APPSTSID,
                                                                        app_id: APPID,
                                                                        cluster_code: '',
                                                                        appst_id: AppSTID,
                                                                        parent_s_id: ParentSTSID,
                                                                        child_s_id: ChildSID,
                                                                        s_code: SCODE,
                                                                        s_description: SDESC,
                                                                        s_id: SID,
                                                                        st_id: STID,
                                                                        sts_id: STSID,
                                                                        is_enabled: IsEnabled,
                                                                        created_date: new Date(),
                                                                    }], objLogInfo, function (pErr, pRes) {
                                                                        if (pErr) {
                                                                            reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50525', 'Insertion Process Failed', pErr, '', '');
                                                                        } else {
                                                                            reqInstanceHelper.SendResponse(strServiceName, appResponse, 'SUCCESS', objLogInfo, '', '', '', '', '');
                                                                        }
                                                                    })
                                                                })
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
                            reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50526', 'Exception Ocuured while GetFXDBConnection ', error, '', '');
                        }
                    }

                    // to get system type code 
                    function getSTCode(pStId, pcallback) {
                        try {
                            reqDBInstance.GetTableFromFXDB(DBSession, 'system_types', ['st_code'], {
                                'st_id': pStId
                            }, objLogInfo, function (pErr, pRes) {
                                if (pErr) {
                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50526', 'Querying system_types table have been Failed', pErr, '', '');
                                } else {
                                    if (pRes.rows.length) {
                                        pcallback(pRes.rows[0])
                                    } else {
                                        reqInstanceHelper.PrintInfo(strServiceName, 'system type code not found for this st_id ' + pStId, objLogInfo);
                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50535', 'System type entry not found', 'System type entry not found', '', '');
                                    }
                                }
                            })
                        } catch (error) {
                            reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50527', 'Exception ocuured in getSTCode', error, '', '');
                        }
                    }
                })

            } catch (error) {
                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50528', 'Exception Ocuured while AssignLogInfoDetail ', error, '', '');
            }

        })
    } catch (error) {
        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50529', 'Exception Ocuured while Delete Cluster ', error, '', '');
    }
});
module.exports = router;