var modPath = '../../../../node_modules/'
var reqExpress = require(modPath + 'express');
var router = reqExpress.Router();
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var serviceModel = reqFXDBInstance.DBInstanceSession['SERVICE_MODEL'];

var strServiceName = "LoadApplications";
router.post('/LoadApplications', function (appRequest, appResponse) {
    var objLogInfo;

    try {
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, sessionInfo) {
            reqInstanceHelper.PrintInfo(strServiceName, 'Service Begined Successfully', objLogInfo);
            // objLogInfo.HANDLER_CODE = 'LoadApplications';
            // objLogInfo.PROCESS = 'LoadApplications-MiniGoverner';
            // objLogInfo.ACTION_DESC = 'LoadApplications';
            var mHeaders = appRequest.headers;

            reqFXDBInstance.GetFXDBConnection(mHeaders, 'clt_cas', objLogInfo, function GetCassandraConn(pCltClient) {
                reqInstanceHelper.PrintInfo(strServiceName, 'Connection Initiated Successfully', objLogInfo);
                var mClient = pCltClient;
                var strClientID = sessionInfo.CLIENT_ID;
                var whereCond = {};
                var table_name = 'applications'
                var columns = ['app_id', 'app_code', 'app_description'];

                // Function call

                loadApplications();

                function loadApplications() {
                    var appListarr = [];

                    reqInstanceHelper.PrintInfo(strServiceName, 'Querying applications table', objLogInfo);
                    reqFXDBInstance.GetTableFromFXDB(mClient, table_name, columns, whereCond, objLogInfo, function (pError, pResult) {
                        try {
                            if (pError) {

                            } else {
                                var approws = pResult.rows;
                                reqInstanceHelper.SendResponse(strServiceName, appResponse, approws, objLogInfo, '', '', '', '', '');
                            }

                        } catch {
                            reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50902', 'Error while Querying application table', error, '', '');
                        }
                    })
                }
            })
        })
    } catch {
        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50903', 'Error while calling LoadApplications API function', error, '', '');
    }

    appResponse.on('close', function () { });
    appResponse.on('finish', function () { });
    appResponse.on('end', function () { });
})
module.exports = router;
