/*
 * @Api_Name : /GetLanguage
 * @Description: To get language dictionary
 * @Last_Error_code:ERR-AUT-110999
 */

// Require dependencies
var reqExpress = require('express');
var router = reqExpress.Router();
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var pHeaders = {};
var objLogInfo = ''
// Global variable initialization 
var serviceName = 'GetLanguage';

// Host api to server
router.post('/GetLanguage', function (appRequest, appResponse, next) {
    try {
        pHeaders = appRequest.headers;
        var arrlang = [];
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
            try {
                objLogInfo.HANDLER_CODE = 'GET_LANG_JSON';
                objLogInfo.PROCESS = 'GetLanguage-Authentication';
                objLogInfo.ACTION = 'GetLanguage';

                reqTranDBInstance.GetTranDBConn(pHeaders, false, function (pSession) {
                    try {
                        reqTranDBInstance.GetTableFromTranDB(pSession, 'languages', {}, objLogInfo, function (result, error) {
                            try {
                                if (error) {
                                    return reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-AUT-14253', 'Error on select Language query', error);
                                } else {
                                    if (result.length) {
                                        return reqInstanceHelper.SendResponse(serviceName, appResponse, result, objLogInfo)
                                    } else {
                                        return reqInstanceHelper.SendResponse(serviceName, appResponse, 'No rows Found', objLogInfo);
                                    }
                                }
                            } catch (error) {
                                return reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-AUT-14253', 'Error fetching details from language', error)
                            }
                        });
                    } catch (error) {
                        return reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-AUT-14252', 'Get Connection Error', error)
                    }
                })
            } catch (error) {
                return reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-AUT-14251', 'Exception occured', error)
            }
        })
    } catch (error) {
        return reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-AUT-14250', 'Exception occured initally', error)
    }
});



module.exports = router;
// End function