/**
 * @Api_Name        : /LoadCodeSnippets
 * @Description     : get data from database for given details
 * @Last_Error_Code : ERR-AUT-16110
 **/

var reqExpress = require('express');
var router = reqExpress.Router();
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var serviceName = 'LoadCodeSnippets';
var objLogInfo = null;

router.post('/LoadCodeSnippets', function (appRequest, appResponse) {
    try {
        reqInstanceHelper.PrintInfo(serviceName, 'Inside LoadCodeSnippets', objLogInfo);
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
            try {
                reqInstanceHelper.PrintInfo(serviceName, 'start', objLogInfo);
                var headers = appRequest.headers;
                var params = appRequest.body.PARAMS;
                params['CONDITION']['tenant_id'] = objLogInfo.TENANT_ID
                try {
                    var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
                    reqDBInstance.GetFXDBConnection(headers, 'dep_cas', objLogInfo, function (pClient) {
                        try {
                            reqDBInstance.GetTableFromFXDBNoCache(pClient, 'code_snippets', params.COLUMNS, params.CONDITION, objLogInfo, function (error, result) {
                                try {
                                    if (error) {
                                        reqInstanceHelper.SendResponse(serviceName, appResponse, 'FALIURE', objLogInfo, 'ERR-AUT-16105', 'Error in selectFxData', error);
                                    } else {
                                        reqInstanceHelper.SendResponse(serviceName, appResponse, result.rows, objLogInfo);
                                    }
                                } catch (error) {
                                    reqInstanceHelper.SendResponse(serviceName, appResponse, 'FALIURE', objLogInfo, 'ERR-AUT-16106', 'Error in selectFxData', error);
                                }
                            });
                        } catch (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, 'FALIURE', objLogInfo, 'ERR-AUT-16107', 'Error in selectFxData', error);
                        }
                    });
                } catch (error) {
                    reqInstanceHelper.SendResponse(serviceName, appResponse, 'FALIURE', objLogInfo, 'ERR-AUT-16108', 'Error in selectFxData', error);
                }

            } catch (error) {
                reqInstanceHelper.SendResponse(serviceName, appResponse, 'FALIURE', objLogInfo, 'ERR-AUT-16109', 'Error in GetTableData', error);
            }
        });
    } catch (error) {
        reqInstanceHelper.SendResponse(serviceName, appResponse, 'FALIURE', objLogInfo, 'ERR-AUT-16110', 'Error in GetTableData', error);
    }
});

module.exports = router;