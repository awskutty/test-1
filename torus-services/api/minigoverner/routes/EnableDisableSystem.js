//app_system_to_system Enable Disable in cluster level system entry 

var reqExpress = require('express');
var router = reqExpress.Router();
var reqLINQ = require('node-linq').LINQ;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');

var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var strServiceName = 'EnableDisbaleSystem';
router.post('/EnableDisableSystem', function (appRequest, appResponse) {
    try {
        var objLogInfo = '';
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, sessionInfo) {
            reqInstanceHelper.PrintInfo(strServiceName, 'SaveCluster Service Begin', objLogInfo);
            var pHeader = appRequest.headers;
            objLogInfo.HANDLER_CODE = 'EnableDisbaleSystem';
            objLogInfo.PROCESS = 'EnableDisbaleSystem-MiniGoverner';
            objLogInfo.ACTION_DESC = 'EnableDisbaleSystem'
            var allParams = appRequest.body.PARAMS[0];
            var IsEnabled = allParams.IsEnabled;
            var APP_ID = allParams.APP_ID || objLogInfo.APP_ID
            var cond = {
                appsts_id: allParams.APPSTS_ID,
                cluster_code: allParams.CLUSTER_CODE,
                app_id: APP_ID
            }
            reqDBInstance.GetFXDBConnection(pHeader, 'clt_cas', objLogInfo, function (DBSession) {
                reqDBInstance.UpdateFXDB(DBSession, 'app_system_to_system', {
                    'is_enabled': IsEnabled
                }, cond, objLogInfo, function (error, result) {
                    if (error) {
                        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-500091', 'Update app system to system for Enable Disbale', error, '', '');
                    } else {
                        reqInstanceHelper.SendResponse(strServiceName, appResponse, 'SUCCESS', objLogInfo, '', '', '', '', '');
                    }

                });
            });
        });
    } catch (error) {
        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-500090', 'Exception Ocuured while SaveCluster function ', error, '', '');
    }
});
module.exports = router;