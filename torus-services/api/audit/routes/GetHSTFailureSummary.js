/**
 * Api_Name         : /GetHSTFailureSummary
 * Description      : To List the HST table Failure summary data list count
 * Last Error_Code  : ERR-AUT-
 New service
 */

var reqExpress = require('express');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var router = reqExpress.Router();
// Initialize Global variables

var router = reqExpress.Router();

var serviceName = 'GetHSTFailureSummary';

// Host the HSTFailureSummary api
router.post('/GetHSTFailureSummary', function (appRequest, appResponse) {
    try {
        var pHeaders = appRequest.headers;
        reqLogInfo.AssignLogInfoDetail(appRequest, function callbackAssignLogInfoDetail(objLogInfo, pSessionInfo) {
            var arrQuery = [
                { TABLE: 'HST_TRAN_DATA', Query: `SELECT COUNT (*) AS COUNT FROM HST_TRAN_DATA WHERE IS_PROCESSED='Y' AND PROCESS_COUNT='2' AND TENANT_ID='${objLogInfo.TENANT_ID}'` },
                { TABLE: 'HST_FX_TABLE_DATA', Query: `SELECT COUNT (*)  AS COUNT FROM HST_FX_TABLE_DATA WHERE IS_PROCESSED='Y' AND PROCESS_COUNT='2' AND TENANT_ID='${objLogInfo.TENANT_ID}'` },
                { TABLE: 'HST_TRN_ATTACHMENTS', Query: `SELECT COUNT (*)  AS COUNT FROM HST_TRN_ATTACHMENTS WHERE IS_PROCESSED='Y' AND PROCESS_COUNT='2' AND TENANT_ID='${objLogInfo.TENANT_ID}'` }
            ];
            reqTranDBInstance.GetTranDBConn(pHeaders, false, function (TranDbConn) {

                mainfnction();
                async function mainfnction() {
                    try {
                        var resArr = [];
                        for (var i = 0; i < arrQuery.length; i++) {
                            var resObj = {};
                            var queryRes = await executequery(arrQuery[i].Query);
                            _PrintInfo(`Executing query for  ${arrQuery[i].TABLE}`);
                            resObj.entity = arrQuery[i].TABLE;
                            resObj.count = queryRes;
                            resArr.push(resObj);
                            // resObj[arrQuery[i].TABLE] = queryRes;
                        }
                        return reqInstanceHelper.SendResponse(serviceName, appResponse, resArr, objLogInfo, '', '', '', 'SUCCESS', '');

                    } catch (error) {
                        _PrintInfo(`Exception occured execute query ${error}`);
                    }
                }
                function executequery(pQuery) {
                    try {
                        return new Promise((resolve, reject) => {
                            reqTranDBInstance.ExecuteSQLQuery(TranDbConn, pQuery, objLogInfo, function (pRes, pErr) {
                                if (pErr) {
                                    _PrintInfo(pErr);
                                } else {
                                    resolve(pRes.rows[0].count);
                                }
                            });
                        });
                    } catch (error) {
                        _PrintInfo(`Exception occured execute query ${error}`);
                    }
                }
                function _PrintInfo(pMessage) {
                    reqInstanceHelper.PrintInfo(serviceName, pMessage, objLogInfo);
                }
            });

        });


    } catch (error) {

    }
});

module.exports = router;