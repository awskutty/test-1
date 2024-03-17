/*
@Api_Name         : /ArchivalIndex,
@Description      : To insert "Static table (manually created tables)" table entry for archival process
@Last_Error_code  : ERR-HAN-
*/

// Require dependencies
var reqExpress = require('express');
var router = reqExpress.Router();
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqCommon = require('../../../../torus-references/transaction/Common');
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');
router.post('/savestatictable', function (appRequest, appResponse) {
    try {
        var ServiceName = 'savestatictable';
        var pHeaders = appRequest.headers;
        var params = appRequest.body.PARAMS;
        var pTargetTable = params.TargetTable;
        var pKeyColumn = params.KeyColumn;

        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
            reqDBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function (pClient) {

                var pTable = "ARC_STATIC_TABLES";
                var pRows = [{
                    'TARGET_TABLE': pTargetTable.toUpperCase(),
                    "APP_ID": objLogInfo.APP_ID,
                    'KEY_COLUMN_NAME': pKeyColumn.toUpperCase(),
                    'CREATED_BY': objLogInfo.U_ID,
                    'CREATED_DATE': reqDateFormatter.GetTenantCurrentDateTime(pHeaders, objLogInfo)
                }];
                _inserttable(pTable, pRows).then((res) => {
                    reqInstanceHelper.SendResponse(ServiceName, appResponse, "SUCCESS", objLogInfo, '', '', '', 'SUCCESS', 'Data saved successfully.');
                }).catch((error) => {
                });

                function _inserttable(pTable, pRows) {
                    return new Promise((resolve, reject) => {
                        try {
                            reqDBInstance.InsertFXDB(pClient, pTable, pRows, objLogInfo, function (pErr, pRes) {
                                if (pErr) {
                                    reject(pErr);
                                } else {
                                    resolve(pRes);
                                }
                            });
                        } catch (error) {
                            reject(error);
                        }
                    });
                }

            });
        });
    } catch (error) {

    }
});
module.exports = router;