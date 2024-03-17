/*
 *   @Author : Ragavendran
 *   @Description : To get scheduler thread log
 *   @status : In-Progress
 *   @created-Date : 19/10/2016
 *   @updated-at : 04/04/2017
 */


var rootpath = "../../../../";
var modPath = rootpath + 'node_modules/'
var reqExpress = require(modPath + 'express');
var router = reqExpress.Router();
var constants = require('./util/message');
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqSolrInstance = require('../../../../torus-references/instance/SolrInstance');
var reqMoment = require(modPath + 'moment');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
//global variable
var pHeaders = "";
var mDevCas = "";
var resobj = {};
var serviceName = 'getThreadLog'



router.post('/getThreadLog', function (req, res, next) {
    try {
        reqLogInfo.AssignLogInfoDetail(req, function (objLogInfo, objSessionInfo) {
            var serviceModel = reqFXDBInstance.DBInstanceSession['SERVICE_MODEL'];
            pHeaders = req.headers;
            var portal_type = "";
            var cas_type = "";
            var app_id = "";
            portal_type = req.body.portal_type;
            app_id = objLogInfo.APP_ID;
            var tenant_id = objSessionInfo.TENANT_ID;
            var job_name = req.body.job_name;
            var intRecordsPerPage = req.body.RecordsperPage || 10;
            var intCurrentPage = req.body.CurrentPage || 1;

            // if (!job_name) {
            //     res.send('job_name undefied')
            // }
            if (portal_type === "CP") {
                cas_type = "dev_cas";
            } else {
                cas_type = "solr";
            }
            if (serviceModel.AUDIT_ARCHIVAL_MODEL == 'SOLR') {
                if (cas_type == "solr") { // Get the data from SCH_JOBS_THREAD_LOG core
                    // var intRecordsPerPage = req.body.RecordsperPage;
                    // var intCurrentPage = req.body.CurrentPage;
                    var selectedJobId = req.body.job_inc_id;
                    var strSearchCond = 'JOB_NAME:"' + job_name + '" AND TENANT_ID:"' + tenant_id + '" AND APP_ID:"' + app_id + '" AND JOB_INSTANCE_ID:' + selectedJobId;
                    reqSolrInstance.LogSolrSearchWithPaging(pHeaders, 'SCH_JOBS_THREAD_LOG', strSearchCond, intRecordsPerPage, intCurrentPage, function (pDocuments) {
                        try {
                            var ResultDocs = pDocuments;
                            var totalDocs = pDocuments.response.docs;
                            // for (var i = 0; i < totalDocs.length; i++) {
                            //     if (totalDocs[i].START_TIME) {
                            //         totalDocs[i].START_TIME = reqMoment(totalDocs[i].START_TIME).format('YYYY-MM-DD hh:mm:ss.SSSS a');
                            //     }
                            //     if (totalDocs[i].END_TIME) {
                            //         totalDocs[i].END_TIME = reqMoment(totalDocs[i].END_TIME).format('YYYY-MM-DD hh:mm:ss.SSSS a');
                            //     }
                            // }
                            var resdata = {};
                            if (ResultDocs.response.numFound) {
                                resdata.STATUS = constants.SUCCESS;
                                resdata.DATA = totalDocs;
                                resdata.TotalNumberOfDocs = ResultDocs.response.numFound;
                                resdata.RecordsFrom = ResultDocs.response.start + 1;
                                resdata.PageCount = Math.ceil(ResultDocs.response.numFound / intRecordsPerPage);
                                resdata.RecordsTo = ResultDocs.response.start + ResultDocs.response.docs.length;
                                resdata.CurrentPage = intCurrentPage;
                                res.send(resdata);
                            } else {
                                resdata.STATUS = constants.SUCCESS;
                                resdata.DATA = []
                                res.send(resdata);
                            }
                        } catch (error) {
                            res.send(error)
                        }
                    })

                }
            }
            else {
                var resdata = {};
                condition = [];
                var QUERY_LIST_SCHEDULER_THREAD_LOG = "select * from SCH_JOBS_THREAD_LOG where APP_ID = '" + app_id + "' and JOB_NAME = " + addSingleQuote(job_name);
                var QUERY_LIST_SCHEDULER_THREAD_LOGS = QUERY_LIST_SCHEDULER_THREAD_LOG + ' order by start_time desc'
                reqFXDBInstance.GetFXDBConnection(pHeaders, 'log_cas', {}, function CallbackGetCassandraConn(pClient) {
                    // mDevCas = pClient;
                    reqFXDBInstance.ExecuteQueryWithPagingCount(pClient, QUERY_LIST_SCHEDULER_THREAD_LOGS, intCurrentPage, intRecordsPerPage, objLogInfo, function (result, pCount, pErr) {
                        if (pErr) {
                            resdata.STATUS = constants.FAILURE;
                            resdata.MESSAGE = pErr.message;
                            reqInstanceHelper.SendResponse(serviceName, res, pErr, objLogInfo, "ERR-SCH-100021", "Exception error occured", "", "", "")
                        } else {
                            if (result && result.length) {
                                for (var i = 0; i < result.length; i++) {
                                    var obj = {}
                                    obj.START_TIME = result[i].start_time.toLocaleString();
                                    if (!result[i].end_time) {
                                        obj.END_TIME = result[i].end_time;
                                    } else {
                                        obj.END_TIME = result[i].end_time.toLocaleString();
                                    }
                                    obj.STATUS = result[i].status;
                                    obj.ERROR_MSG = result[i].error_msg;
                                    obj.RESULT = result[i].result;
                                    condition.push(obj)
                                }
                                resdata.STATUS = constants.SUCCESS;
                                resdata.TotalNumberOfDocs = pCount[0].count
                                resdata.CurrentPage = intCurrentPage;

                            }
                            resdata.DATA = condition;
                            reqInstanceHelper.SendResponse(serviceName, res, resdata, "SUCCESS", "", "", "", "", "")
                        }
                    });
                });
            }
        });
    } catch (ex) {
        resobj.STATUS = constants.FAILURE;
        resobj.MESSAGE = ex;
        resobj.DATA = [];
        res.send(resdata);
    }
});

function addSingleQuote(data) {
    if (data !== null) {
        if (data.indexOf("'") > -1) {
            data = data.replaceAll("'", "''")
        }
        return "'" + data + "'";
    }
    else {
        return null;
    }
}

module.exports = router;