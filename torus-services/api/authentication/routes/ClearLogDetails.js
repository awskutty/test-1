/*
@Api_Name           : /ClearLogDetails,
@Description        : To search the log data from Solr
@Last_Error_code    : ERR-AUT-14708
*/

// Require dependencies
var reqExpress = require('express');
var router = reqExpress.Router();
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqLogviewerHelper = require('./helper/LogviewerHelper');
var reqSolrHelper = require('../../../../torus-references/instance/SolrInstance');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');

var serviceName = 'ClearLogDetails';

router.post('/ClearLogDetails', function (appRequest, appResponse) {
    try {

        var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
        var TraceLogCore = 'TRACE_LOG_CORE';
        if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
            TraceLogCore = 'DEBUG_LOG';
        }
        var params = appRequest.body.PARAMS;
        var header = appRequest.headers;
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
            try {
                objLogInfo.HANDLER_CODE = 'ClearLogDetails';
                objLogInfo.PROCESS = 'ClearLogDetails-Authentication';
                objLogInfo.ACTION = 'ClearLogDetails';

                // Handle the close event when client closes the api request
                appResponse.on('close', function () { });
                appResponse.on('finish', function () { });
                appResponse.on('end', function () { });

                reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo);

                var searchCond = params.LOG_DETAILS;
                var intRecordsPerPage = params.RECORDS_PER_PAGE;
                var intCurrentPage = params.PAGE_NO;

                reqLogviewerHelper.SolrLogSearch(header, TraceLogCore, searchCond, intRecordsPerPage, intCurrentPage, objLogInfo, function (error, result) {
                    try {
                        if (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, 'FAILURE', objLogInfo, 'ERR-AUT-14708', 'Exception occured while fetching solrLogsearch', error);
                        } else {
                            var values = [];
                            var field = 'id';
                            var solrDocs = result.SolrDocs ? result.SolrDocs : [];
                            for (var i = 0; i < solrDocs.length; i++) {
                                values.push(solrDocs[i][field]);
                            }
                            if (values.length) {
                                reqSolrHelper.SolrDelete(header, TraceLogCore, field, values, objLogInfo, function (result) {
                                    if (result != 'SUCCESS') {
                                        reqInstanceHelper.SendResponse(serviceName, appResponse, 'FAILURE', objLogInfo, 'errcode', 'errmsg', result);
                                    } else {
                                        reqInstanceHelper.SendResponse(serviceName, appResponse, 'SUCCESS', objLogInfo);
                                    }
                                });
                            } else {
                                reqInstanceHelper.SendResponse(serviceName, appResponse, 'SUCCESS', objLogInfo);
                            }
                        }
                    } catch (error) {
                        reqInstanceHelper.SendResponse(serviceName, appResponse, 'FAILURE', objLogInfo, 'ERR-AUT-14708', 'Exception occured while fetching solrLogsearch', error);
                    }
                });
            } catch (error) {
                reqInstanceHelper.SendResponse(serviceName, appResponse, 'FAILURE', objLogInfo, 'ERR-AUT-14707', 'Exception occured while fetching LoginDetail data', error);
            }
        });
    } catch (error) {
        reqInstanceHelper.SendResponse(serviceName, appResponse, 'FAILURE', objLogInfo, 'ERR-AUT-14706', 'Exception occured while fetching data from TRACE_LOG_CORE', error);
    }
});

module.exports = router;