/*
@Api_Name           : /GetSTPComments,
@Description        : Query the STP_COMMENTS table data,
@Last_Error_Code    : ERR-HAN-41603
*/

// Require dependencies
var reqExpress = require('express');
var router = reqExpress.Router();
var reqCasInstance = require('../../../../torus-references/instance/CassandraInstance');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance')
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper')

// Global variable initialization
var mResCas = '';
var pHeaders = "";

var serviceName = 'GetSTPComments'

// Host the api to server
router.post('/GetSTPComments', function (appRequest, appResponse, next) {
    var objLogInfo = "";
    try {
        var serviceModel = reqFXDBInstance.DBInstanceSession['SERVICE_MODEL'];
        // Close event when client closes the api request
        appResponse.on('close', function () { });
        appResponse.on('finish', function () { });
        appResponse.on('end', function () { });

        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
            objLogInfo.HANDLER_CODE = 'SHOW_TRAN_COMMENT_LIST';
            reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo)
            appResponse.setHeader('Content-Type', 'text/plain');
            pHeaders = appRequest.headers;
            reqInstanceHelper.PrintInfo(serviceName, 'Getting FXDB Connection', objLogInfo)
            reqFXDBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function CallbackGetCassandraConn(pClient) {

                mResCas = pClient;
                var response = "";
                var app_id = objSessionInfo.APP_ID;
                var CondObj = {
                    app_id: app_id.toString()
                };
                if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
                    CondObj.tenant_id = objLogInfo.TENANT_ID;
                }
                reqInstanceHelper.PrintInfo(serviceName, 'QUerying Stp_comments', objLogInfo);
                reqFXDBInstance.GetTableFromFXDB(mResCas, 'stp_comments', [], CondObj, objLogInfo, function callback(pErr, pResult) {
                    try {
                        if (pErr) {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, "ERR-HAN-41601", "Error fetching stp_comments method", pErr);
                        } else {
                            var comments = [];
                           var distinct_comment = [];
                            var res = {};
                            var totalresponse = [];
                            var finalres = {};
                            for (var i in pResult.rows) {
                                var comment = {};
                                comment.APP_ID = pResult.rows[i].app_id;
                                comment.STPC_ID = pResult.rows[i].stpc_id;
                                comment.STP_COMMENT = pResult.rows[i].stp_comment;
                                comment.STPC_CATEGORY = pResult.rows[i].stpc_category;
                                comments.push(comment);
                            if (distinct_comment.indexOf(pResult.rows[i].stpc_category) < 0 && pResult.rows[i].stpc_category != '') {
                                distinct_comment.push(pResult.rows[i].stpc_category)
                            }

                      }

                            res.COMMENTS = comments;
                            res.DISTINCT_COMMENTS = distinct_comment;

                            totalresponse.push(res);
                            finalres.ALLCOMMENTS = totalresponse;

                            response = finalres;
                            reqInstanceHelper.SendResponse(serviceName, appResponse, response, objLogInfo, null, null, null)
                        }
                    } catch (ex) {
                        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, "ERR-HAN-41602", "Exception occured", ex);
                    }
                });
            });
        });
    } catch (ex) {
        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, "ERR-HAN-41603", "Exception occured", ex);
    }
});

module.exports = router;
/*********** End of Service **********/