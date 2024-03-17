// Require dependencies
var modPath = '../../../../node_modules/'
var express = require(modPath + 'express');
var reqTranDBInstance = require('../../../../torus-references/instance/AnalyticInstance');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper')
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');

// Initialize Global variables
var strResult = '';
var strMessage = '';
var router = express.Router();
var redisInstance = require('../../../../torus-references/instance/RedisInstance.js');
var serviceName = "Analytics Third Party Integration"

// Host the login api
router.post('/checkanalyticsenv', function (appReq, appResp) {

    reqLogInfo.AssignLogInfoDetail(appReq, function (objLogInfo, objSessionInfo) {

        reqFXDBInstance.GetFXDBConnection(appReq.headers, 'clt_cas', objLogInfo, function (pClient) {

            try {
                reqInstanceHelper.PrintInfo(serviceName, '_GetClientSetup function executing..', objLogInfo);
                reqFXDBInstance.GetTableFromFXDB(pClient, 'tenant_setup', [], {
                    'tenant_id': appReq.body.PARAMS.TENANT_ID,
                    'client_id': appReq.body.PARAMS.CLIENT_ID,
                    'category': 'ANALYTICS'
                }, objLogInfo, function callbackcltsetup(err, cltresult) {
                    try {
                        if (err)
                            sendErrorResponse("Error in FXDB Connection", err)
                        else {
                            if (!err && cltresult.rows.length > 0) {
                                sendSuccessResponse(JSON.parse(cltresult.rows[0]['setup_json']));
                            } else {
                                sendErrorResponse("Analytics Not Enbled", err)
                            }
                        }
                    } catch (error) {
                        sendErrorResponse("Error in FXDB Connection", error)
                    }
                })
            } catch (error) {
                sendErrorResponse("Error in FXDB Connection", error)
            }

            function sendSuccessResponse(data) {
                reqInstanceHelper.SendResponse(serviceName, appResp, data, objLogInfo, '', '', '', "SUCCESS");
            }

            function sendErrorResponse(message, error) {
                reqInstanceHelper.SendResponse(serviceName, appResp, null, objLogInfo, '', message, error);
            }

        })
    })
})
module.exports = router;