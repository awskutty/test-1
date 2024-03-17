/****
 * Api_Name          : /getsparklist,
 * Description       : ,
 * Last_Error_Code   : ERR-ANL-5100
 ****/

// Require dependencies
var modPath = '../../../../node_modules/'
var express = require(modPath + 'express');
var reqTranDBInstance = require('../../../../torus-references/instance/AnalyticInstance');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInsHelper = require('../../../../torus-references/common/InstanceHelper');

// Initialize Global variables
var strResult = '';
var strMessage = '';


var router = express.Router();

// Host the login api
router.post('/getsparklist', function (appReq, appResp) {

    reqLogInfo.AssignLogInfoDetail(appReq, function (objLogInfo, objSessionInfo) {
    reqLogWriter.Eventinsert(objLogInfo);
    objLogInfo.PROCESS = 'getsparklist-Analytics';
    objLogInfo.ACTION = 'getsparklist';
    var strHeader = {};

    if (appReq.headers && appReq.headers.routingkey) {
        strHeader = appReq.headers;
        strHeader.routingkey = "CLT-0~APP-0~TNT-0~ENV-0";
    }
    else {
        strHeader = { 'routingkey': 'CLT-0~APP-0~TNT-0~ENV-0' }
    }

    var query = "SELECT project_id, redis_key, user_id FROM project_connections where project_id = " + appReq.body.prjct_id + " and user_id = " + appReq.body.usr_id + " and project_connections.redis_key LIKE '%spark%' ;"

    try {
        reqTranDBInstance.GetTranDBConn(strHeader, false, function callbackGetTranDB(pSession) {
            reqTranDBInstance.ExecuteSQLQuery(pSession, query, objLogInfo, function callback(res, err) {
                if (err) {
                    _SendResponse({}, 'ERR-ANL-111105', 'Error selecting from project_connections Table', err, null,objLogInfo);
                }
                else {
                    if (res.rows != null) {
                        var temparry = [];
                        var rediscount = 0;
                        for (var i = 0; i < res.rows.length; i++) {
                            reqInsHelper.GetConfig(res.rows[i].redis_key, function callback(pResult, pError) {
                                if (pError) {
                                    _SendResponse({}, 'ERR-ANL-111105', 'Error selecting from project_connections Table', pError, null,objLogInfo);
                                    return
                                }
                                else {
                                    temparry.push(JSON.parse(pResult));
                                    rediscount++
                                    if (rediscount == res.rows.length) {
                                        _SendResponse(JSON.stringify({ status: 'success', data: temparry }), '', '', null, null,objLogInfo);
                                    }
                                }
                            })
                        }
                    }
                    else {
                        _SendResponse(JSON.stringify({ status: "failed to fetch data" }), '', '', null, null,objLogInfo);
                    }
                }
            })
        })
    } catch (error) {
        errorHandler("ERR-ANL-111105", "Error in getting trandb function in datasourceconfig" + error)
    }
    });
    // To send the app response
    function _SendResponse(pResponseData, pErrorCode, pErrorMsg, pError, pWarning,pobjLogInfo) {
        var strProcessStatus = (pWarning != null && pWarning != '') ? 'FAILURE' : 'SUCCESS'
        var ResponseData = (pResponseData == null || pResponseData == undefined) ? '' : pResponseData
        return reqInsHelper.SendResponse('ChangeSearchTag', appResp, ResponseData, pobjLogInfo, pErrorCode, pErrorMsg, pError, strProcessStatus, pWarning)
    }

    function errorHandler(errcode, message) {
        console.log(errcode, message);
        reqLogWriter.TraceError(objLogInfo, message, errcode);
    }
});
module.exports = router;