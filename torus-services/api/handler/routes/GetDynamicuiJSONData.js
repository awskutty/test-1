/****
 * Api_Name          : /GetDynamicuiJSONData
 * Description       : To Get the dynamic ui json data from tran table
 * Lase_Error_Code   : ERR-HAN-40340
 ****/

// Require dependencies
var reqExpress = require("express");
var reqAsync = require("async");
var reqTranDBHelper = require("../../../../torus-references/instance/TranDBInstance");
var reqLogInfo = require("../../../../torus-references/log/trace/LogInfo");
var reqInstanceHelper = require("../../../../torus-references/common/InstanceHelper");
var reqFXDBInstance = require("../../../../torus-references/instance/DBInstance");
var reqCommon = require('../../../../torus-references/transaction/Common');
var router = reqExpress.Router();

// Host api to Delete Item
router.post("/GetDynamicuiJSONData", function(appRequest, appResponse) {
    try {
        var serviceName = 'GetDynamicuiJSONData';
        var pHeaders = appRequest.headers
        reqLogInfo.AssignLogInfoDetail(appRequest, function(objLogInfo, objSessionInfo) {
            try {
                reqFXDBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function Callback_GetCassandraConn(pClient) {
                    reqTranDBHelper.GetTranDBConn(pHeaders, false, function(pSession) {
                        var params = appRequest.body.PARAMS;
                        var DttCode = params.DttCode;
                        var DtCode = params.DtCode;
                        var ColumnName = params.JsonColumn;
                        var FilterColumn = params.FilterColumn;
                        var FilterValue = params.FilterValue;
                        getTargetTable()

                        function getTargetTable() {
                            try {
                                var cond = {};
                                // cond.app_id = objSessionInfo.APP_ID;
                                cond.dt_code = DtCode;
                                reqFXDBInstance.GetTableFromFXDB(pClient, 'DT_INFO', [], cond, objLogInfo, function(error, result) {
                                    try {
                                        if (error) {
                                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-HAN-41303', 'Error in GetTableFromFXDB DTT info callback', error);
                                            return reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-HAN-41600', 'Error occured query target table', pError, "FAILIURE");
                                        } else {
                                            if (result.rows) {
                                                var objRow = result.rows[0]
                                                var arrRelationjson = JSON.parse(objRow.relation_json)
                                                reqInstanceHelper.PrintInfo(serviceName, 'getting target table', objLogInfo);
                                                reqCommon.DoFilterRecursiveArr(arrRelationjson, DttCode, 'DTT_CODE', 'CHILD_DTT_RELEATIONS', objLogInfo, function(dttinfo) {
                                                    if (dttinfo) {
                                                        reqInstanceHelper.PrintInfo(serviceName, 'Got the target table', objLogInfo);
                                                        var targettable = dttinfo.TARGET_TABLE;
                                                        var trncond = {};
                                                        trncond[FilterColumn] = FilterValue;
                                                        reqTranDBHelper.GetTableFromTranDB(pSession, targettable, trncond, objLogInfo, function(pResult, pError) {
                                                            if (pError) {
                                                                return reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-HAN-41305', 'Error occured query target table', pError, "FAILIURE");
                                                            } else {
                                                                var jsonrow = pResult[0][ColumnName];
                                                                return reqInstanceHelper.SendResponse(serviceName, appResponse, jsonrow, objLogInfo, '', '', '', "SUCCESS");
                                                            }
                                                        })
                                                    } else {
                                                        reqInstanceHelper.PrintInfo(serviceName, 'Target table not found', objLogInfo);
                                                        return reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-HAN-41611', 'Target table no rows found', 'Target Table not found from releation json', "FAILIURE");
                                                    }
                                                })
                                            } else {
                                                reqInstanceHelper.PrintInfo(serviceName, 'No rows found', objLogInfo);
                                                return reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-HAN-41610', 'DT_INFO table no rows found', 'No rows found', "FAILIURE");
                                            }
                                        }
                                    } catch (error) {
                                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-HAN-41304', 'Exception in GetTableFromFXDB callback', error);
                                    }
                                });
                            } catch (error) {
                                return reqInstanceHelper.SendResponse(serviceName, appResponse, 'FAILURE', null, 'ERR-HAN-41302', 'Error on getTargetTable function ', error)
                            }
                        }
                    })
                })
            } catch (error) {
                return reqInstanceHelper.SendResponse(serviceName, appResponse, 'FAILURE', null, 'ERR-HAN-41301', 'Error on AssignLogInfoDetail function ', error)
            }
        })
    } catch (error) {
        return reqInstanceHelper.SendResponse(serviceName, appResponse, 'FAILURE', null, 'ERR-HAN-41300', 'Error on GetDynamicuiJSONData api function ', error)
    }
});

module.exports = router
/*********** End of Service **********/