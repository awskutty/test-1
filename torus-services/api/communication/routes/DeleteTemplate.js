/****
  @Descriptions                 : Delet Template Information  
  @Last_Error_Code              : ERR-DELETETEMPLATE-0002
 ****/


var reqExpress = require('express');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var router = reqExpress.Router();
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');

var serviceName = 'DeleteTemplate';

router.post('/DeleteTemplate', function (appRequest, appResponse) {
    try {
        var pHeader = appRequest.headers;
        var objLogInfo = {};
        var clientParams = appRequest.body.PARAMS;
        var APP_ID = clientParams.APP_ID || '';
        var EVENT_CODE = clientParams.EVENT_CODE || '';
        var WFTPA_ID = clientParams.WFTPA_ID || '';
        var DT_CODE = clientParams.DT_CODE || '';
        var DTT_CODE = clientParams.DTT_CODE || '';
        var COMMMG_CODE = clientParams.COMMMG_CODE;
        var COMMMT_CODE = clientParams.COMMMT_CODE;
        reqLogInfo.AssignLogInfoDetail(appRequest, function (pLogInfo, pSessionInfo) {
            objLogInfo = pLogInfo;
            reqFXDBInstance.GetFXDBConnection(pHeader, 'dep_cas', objLogInfo, function (depConnection) {
                var delteCondObj = {};
                delteCondObj.APP_ID = APP_ID;
                delteCondObj.EVENT_CODE = EVENT_CODE;
                delteCondObj.WFTPA_ID = WFTPA_ID;
                delteCondObj.DT_CODE = DT_CODE;
                delteCondObj.DTT_CODE = DTT_CODE;
                if (COMMMT_CODE) {
                    delteCondObj.COMMMT_CODE = COMMMT_CODE;
                }
                reqFXDBInstance.DeleteFXDB(depConnection, 'COMM_INFO', delteCondObj, objLogInfo, function (error, result) {
                    if (error) {
                        reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-DELETETEMPLATE-0002', 'Error While Deleting Data into COMM_INFO Table...', error, 'FAILURE', '');
                    } else {
                        reqInstanceHelper.SendResponse(serviceName, appResponse, 'SUCCESS', objLogInfo, '', '', '', '', '');
                    }
                });
            });
        });
    } catch (error) {
        reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-DELETETEMPLATE-0001', 'Catch Error in DeleteTemplate API....', error, 'FAILURE', '');
    }

});

module.exports = router;