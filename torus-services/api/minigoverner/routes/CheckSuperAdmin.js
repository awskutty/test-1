/****
 * Author          : Imrankhan,
 * Api_Name          : /isSuperAdmin,
 * Description       : This api used to check logged in user's role is superadmin or not,
 ****/

var reqExpress = require('express');
var router = reqExpress.Router();
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
router.post('/CheckSuperAdmin', function (appRequest, appResponse) {
    try {
        var ServiceName = 'CheckSuperAdmin';
        reqLogInfo.AssignLogInfoDetail(appRequest, function callbackAssignLogInfoDetail(objLogInfo, pSessionInfo) {
            try {
                var strInputParamJson = appRequest.body.PARAMS;
                var appRId = strInputParamJson.appRId;
                var pHeaders = appRequest.headers;
                _PrintInfo('Requestes Role id is ' + appRId);
                if (!appRId && objLogInfo.LOGIN_NAME.toUpperCase() == "TORUS_ADMIN") {
                    appRId = '0';
                }
                reqFXDBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function CallbackGetCassandraConn(pCltClient) {
                    var pcond = {};
                    pcond.appr_id = appRId;
                    pcond.app_id = objLogInfo.APP_ID;
                    reqFXDBInstance.GetTableFromFXDB(pCltClient, 'app_roles', ['appr_id', 'role_code', 'role_description'], pcond, objLogInfo, function (pErr, result) {
                        var ResObj = {};
                        ResObj.data = false;
                        if (pErr) {
                            reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50901', 'Error occured while query app role', pErr, '', '');
                        } else if (result.rows.length) {
                            if (result.rows[0].role_code && result.rows[0].role_code.toUpperCase() == 'SUPERADMIN') {
                                ResObj.data = true;
                                ResObj.RoleDesc = result.rows[0].role_description;
                                _PrintInfo('is SuperAdmin | ' + ResObj.data);
                                _PrintInfo('Role Desc is  | ' + ResObj.RoleDesc);
                            }
                        } else if (objLogInfo.LOGIN_NAME.toUpperCase() == "TORUS_ADMIN" && appRId == '0') {
                            ResObj.data = true;
                        }
                        reqInstanceHelper.SendResponse(ServiceName, appResponse, ResObj, objLogInfo, '', '', '', '', '');
                    });
                });


                function _PrintInfo(pMessage) {
                    reqInstanceHelper.PrintInfo(ServiceName, pMessage, objLogInfo);
                }
            } catch (error) {
                reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50902', 'Exception occured', error, '', '');
            }
        });


    } catch (error) {
        reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50903', 'Exception occured', error, '', '');
    }

});

module.exports = router;