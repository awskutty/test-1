var node_modules = '../../../../node_modules/'
var referenceRoot = '../../../../torus-references'
var reqExpress = require(node_modules + 'express')
var router = reqExpress.Router()
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');

var serviceName = "CheckClusterSystem";

// Host the api
router.post('/CheckClusterSystem', function (appRequest, appResponse, pNext) {
    var objLogInfo;
    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
        reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo)

        objLogInfo.HANDLER_CODE = 'CheckClusterSystem'
        objLogInfo.PROCESS = 'CheckClusterSystem-Minigoverner';
        objLogInfo.ACTION_DESC = 'CheckClusterSystem';

        appResponse.on('close', function () { });
        appResponse.on('finish', function () { });
        appResponse.on('end', function () { });

        try {
            var mHeaders = appRequest.headers;
            reqInstanceHelper.PrintInfo(serviceName, 'Getting FXDB COnnection', objLogInfo)
            reqFXDBInstance.GetFXDBConnection(mHeaders, 'clt_cas', objLogInfo, function CallbackGetCassandraConn(pCltClient) {
                var mCltClient = pCltClient;
                appResponse.setHeader('Content-Type', 'application/json');

                // Initialize Global variables
                var Client_id = objSessionInfo.CLIENT_ID;
                var App_id = objSessionInfo.APP_ID;
                var strInputParam = appRequest.body.PARAMS;
                //var resinfo = new resultinfo();
                reqInstanceHelper.PrintInfo(serviceName, 'Calling appSystemtoSytem method', objLogInfo);
                reqFXDBInstance.GetTableFromFXDB(mCltClient, 'app_system_to_system', [], {
                    'app_id': App_id,
                    'cluster_code': strInputParam.clusterCode || ""
                }, objLogInfo, function callbackgetsyst(error, result) {
                    try {
                        if (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Error Ocuured Get System table ', pError, '', '');
                        } else {
                            var data = {};
                            var sys = []
                            data.has_SysParent = "N"
                            if (result.rows.length > 0) {
                                data.has_SysParent = "Y"
                                for (i = 0; i < result.rows.length; i++) {
                                    var syslist = {}
                                    syslist.CLUSTER_CODE = result.rows[i].cluster_code;
                                    syslist.S_DESCRIPTION = result.rows[i].s_description;
                                    syslist.S_ID = result.rows[i].s_id
                                    sys.push(syslist)
                                }
                                data.CLUSTER_SYSTEMS = sys
                            }
                            return reqInstanceHelper.SendResponse(serviceName, appResponse, data, objLogInfo, null, null, null)
                        }
                    } catch (error) {
                        reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Exception Ocuured Get System table', error, '', '');
                    }
                });
            })
        } catch (error) {
            reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Exception Ocuured while GetFXDBConnection ', error, '', '');
        }
    })
})

module.exports = router;