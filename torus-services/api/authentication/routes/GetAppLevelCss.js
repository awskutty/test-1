/**
 * @Api_Name        : /GetAppLevelCss
 * @Description     : get data from database for given details
 * @Last_Error_Code : ERR-AUT-17105
 **/

var reqExpress = require('express');
var router = reqExpress.Router();
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var serviceName = 'GetAppLevelCss';
var objLogInfo = null;

router.post('/GetAppLevelCss', function (appRequest, appResponse) {
    try {
        reqInstanceHelper.PrintInfo(serviceName, 'Inside GetAppLevelCss', objLogInfo);
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
            try {
                reqInstanceHelper.PrintInfo(serviceName, 'start', objLogInfo);
                var headers = appRequest.headers;
                var params = appRequest.body.PARAMS;
                reqDBInstance.GetFXDBConnection(headers, 'clt_cas', objLogInfo, function (pClient) {
                    try {
                        reqDBInstance.GetTableFromFXDB(pClient, 'APPLICATIONS', ['app_advance_css'], {
                            app_id: params.APP_ID,
                            is_framework: 'N',
                            client_id: params.CLIENT_ID
                        }, objLogInfo, function (error, result) {
                            try {
                                if (error) {
                                    reqInstanceHelper.SendResponse(serviceName, appResponse, 'FALIURE', objLogInfo, 'ERR-AUT-17101', 'Error in selectFxData', error);
                                } else {
                                    reqInstanceHelper.SendResponse(serviceName, appResponse, result.rows, objLogInfo);
                                }
                            } catch (error) {
                                reqInstanceHelper.SendResponse(serviceName, appResponse, 'FALIURE', objLogInfo, 'ERR-AUT-17102', 'Error in selectFxData', error);
                            }
                        });
                    } catch (error) {
                        reqInstanceHelper.SendResponse(serviceName, appResponse, 'FALIURE', objLogInfo, 'ERR-AUT-17103', 'Error in selectFxData', error);
                    }
                });
            } catch (error) {
                reqInstanceHelper.SendResponse(serviceName, appResponse, 'FALIURE', objLogInfo, 'ERR-AUT-17104', 'Error in GetTableData', error);
            }
        });
    } catch (error) {
        reqInstanceHelper.SendResponse(serviceName, appResponse, 'FALIURE', objLogInfo, 'ERR-AUT-17105', 'Error in GetTableData', error);
    }
});

module.exports = router;