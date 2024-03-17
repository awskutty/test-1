var reqExpress = require('express');
var router = reqExpress.Router();
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');

var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var strServiceName = 'DeleteUserGroup';

router.post('/DeleteUserGroup', function (appRequest, appResponse) {
    try {
        var objLogInfo = '';
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, sessionInfo) {
            try {
                var pHeader = appRequest.headers;
                objLogInfo.HANDLER_CODE = 'DeleteUserGroup';
                objLogInfo.PROCESS = 'DeleteUserGroup-MiniGoverner';
                objLogInfo.ACTION_DESC = 'DeleteUserGroup';
                var params = appRequest.body.PARAMS;

                reqDBInstance.GetFXDBConnection(pHeader, 'clt_cas', objLogInfo, function (DBSession) {
                    try {
                        //check cluster have the systems
                        reqDBInstance.GetTableFromFXDB(DBSession, 'APP_USERS', [], {
                            'ug_code': params.ug_code
                        }, objLogInfo, function (pError, pRes) {
                            try {
                                if (pError) {
                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Error Ocuured check cluster have user group ', pError, '', '');
                                } else {
                                    if (pRes.rows.length > 0) {
                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, 'Group assigned to some user. Not allowed to Delete', objLogInfo, '', '', '', '', '');
                                    } else {
                                        DeleteUg();
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
                    function DeleteUg() {
                        reqDBInstance.DeleteFXDB(DBSession, 'USER_GROUP', {
                            'code': params.ug_code
                        }, objLogInfo, function (err, Result) {
                            if (err) {
                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Error Ocuured delete USER_GROUP', err, '', '');
                            } else {
                                reqDBInstance.DeleteFXDB(DBSession, 'USER_GROUP_APP_ROLES', {
                                    'ug_code': params.ug_code
                                }, objLogInfo, function (pErr, Result) {
                                    if (pErr) {
                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Error Ocuured delete USER_GROUP_APP_ROLES', err, '', '');
                                    } else {
                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, 'SUCCESS', objLogInfo, '', '', '', '', '');
                                    }
                                })
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