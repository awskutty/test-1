var reqExpress = require('express');
var router = reqExpress.Router();
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var strServiceName = 'UnassignUser';
router.post('/UnassignUser', function (appRequest, appResponse) {
    try {
        var objLogInfo = '';
        var pHeader = appRequest.headers;
        var pParams = appRequest.body.PARAMS;
        var AppuId = pParams.APPUId;
        var UId = pParams.UId;
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, sessionInfo) {
            try {
                var AppId = pParams.APP_ID || objLogInfo.APP_ID;
                reqDBInstance.GetFXDBConnection(pHeader, 'clt_cas', objLogInfo, function (DBSession) {
                    try {
                        var objCond = {};
                        objCond.APP_ID = AppId;
                        objCond.U_ID = UId;
                        // objCond.APPU_ID = AppuId;
                        reqDBInstance.UpdateFXDB(DBSession, 'IV_APP_USERS', { status: 'UNASSIGNED' }, objCond, objLogInfo, function (pErr, PRes) {
                            if (pErr) {
                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50555', 'Delete  APP_USERS ', pErr, '', '');
                            } else {
                                reqDBInstance.GetFXDBConnection(pHeader, 'clt_cas', objLogInfo, function (DBSession) {
                                    try {
                                        reqDBInstance.UpdateFXDB(DBSession, 'APP_USERS', { status: 'UNASSIGNED' }, objCond, objLogInfo, function (pErr, PRes) {
                                            if (pErr) {
                                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50555', 'Delete  APP_USERS ', pErr, '', '');
                                            } else {
                                                reqInstanceHelper.SendResponse(strServiceName, appResponse, PRes, objLogInfo, '', '', '', '', '');
                                            }
                                        })

                                    } catch (error) {
                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50552', 'Exception occured main function ', error, '', '');
                                    }
                                })
                            }
                        })

                    } catch (error) {
                        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50552', 'Exception occured main function ', error, '', '');
                    }
                })
            } catch (error) {
                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50550', 'Exception occured main function ', error, '', '');
            }
        })
    } catch (error) {
        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50551', 'Exception occured main function ', error, '', '');
    }
})
module.exports = router