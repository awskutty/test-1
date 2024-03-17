/**
 * @Api_Name        : /GetTableData
 * @Description     : get data from database for given details
 * @Last_Error_Code : ERR-AUT-16110
 **/

var reqExpress = require('express');
var router = reqExpress.Router();
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var serviceName = 'GetTableData';
var objLogInfo = null;

router.post('/GetTableData', function (appRequest, appResponse) {
    try {
        reqInstanceHelper.PrintInfo(serviceName, 'Inside GetTableData', objLogInfo);
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
            try {
                reqInstanceHelper.PrintInfo(serviceName, 'start', objLogInfo);
                var headers = appRequest.headers;
                var params = appRequest.body.PARAMS;
                if (params.IS_TRAN_DB) {
                    selectTranData();
                } else {
                    selectFxData();
                }
                function selectTranData() {
                    try {
                        var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
                        reqTranDBInstance.GetTranDBConn(headers, false, function (pSession) {
                            try {
                                reqTranDBInstance.GetTableFromTranDB(pSession, params.TABLE_NAME, params.CONDITION, objLogInfo, function (result, error) {
                                    try {
                                        if (error) {
                                            reqInstanceHelper.SendResponse(serviceName, appResponse, 'FALIURE', objLogInfo, 'ERR-AUT-16101', 'Error in selectTranData', error);
                                        } else {
                                            reqInstanceHelper.SendResponse(serviceName, appResponse, result, objLogInfo);
                                        }
                                    } catch (error) {
                                        reqInstanceHelper.SendResponse(serviceName, appResponse, 'FALIURE', objLogInfo, 'ERR-AUT-16102', 'Error in selectTranData', error);
                                    }
                                })
                            } catch (error) {
                                reqInstanceHelper.SendResponse(serviceName, appResponse, 'FALIURE', objLogInfo, 'ERR-AUT-16103', 'Error in selectTranData', error);
                            }
                        });
                    } catch (error) {
                        reqInstanceHelper.SendResponse(serviceName, appResponse, 'FALIURE', objLogInfo, 'ERR-AUT-16104', 'Error in selectTranData', error);
                    }
                }
                function selectFxData() {
                    try {
                        var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
                        reqDBInstance.GetFXDBConnection(headers, params.SCHEMA + '_cas', objLogInfo, function (pClient) {
                            try {
                                reqDBInstance.GetTableFromFXDB(pClient, params.TABLE_NAME, params.COLUMNS, params.CONDITION, objLogInfo, function (error, result) {
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