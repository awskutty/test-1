var reqExpress = require('express');
var router = reqExpress.Router();
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');

var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var strServiceName = 'DeleteCluster';

router.post('/DeleteCluster', function (appRequest, appResponse) {
    try {
        var objLogInfo = '';
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, sessionInfo) {
            try {
                var pHeader = appRequest.headers;
                objLogInfo.HANDLER_CODE = 'DeleteCluster';
                objLogInfo.PROCESS = 'DeleteCluster-MiniGoverner';
                objLogInfo.ACTION_DESC = 'DeleteCluster';
                var params = appRequest.body.PARAMS;
                var ClusterCode = params.CLUSTER_CODE;
                var ClientID = params.CLIENT_ID;
                reqDBInstance.GetFXDBConnection(pHeader, 'clt_cas', objLogInfo, function (DBSession) {
                    try {
                        //check cluster have the systems
                        reqDBInstance.GetTableFromFXDB(DBSession, 'system_to_system', [], {
                            'cluster_code': ClusterCode
                        }, objLogInfo, function (pError, pRes) {
                            try {
                                if (pError) {
                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Error Ocuured check cluster have system ', pError, '', '');
                                } else {
                                    if (pRes.rows.length > 0) {
                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, 'Cluster have the system Not allowed to Delete', objLogInfo, '', '', '', '', '');
                                    } else {
                                        DeleteCC();
                                    }
                                }
                            } catch (error) {
                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Exception Ocuured check cluster have system ', error, '', '');
                            }
                        })
                    } catch (error) {
                        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Exception Ocuured while GetFXDBConnection ', error, '', '');
                    }

                    //Delete from cluster tab;e
                    function DeleteCC() {
                        reqDBInstance.DeleteFXDB(DBSession, 'clusters', {
                            'cluster_code': ClusterCode,
                            'client_id': ClientID
                        }, objLogInfo, function (err, Result) {
                            if (err) {
                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Error Ocuured delete cluster', err, '', '');
                            } else {
                                reqInstanceHelper.SendResponse(strServiceName, appResponse, 'SUCCESS', objLogInfo, '', '', '', '', '');
                            }
                        })
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