/*
 *   @Author : Ragavendran
 *   @Description : To get scheduler jobs log
 *   @status : In-Progress
 *   @created-Date : 19/10/2016
 */


var rootpath = "../../../../";
var modPath = rootpath + 'node_modules/'
var reqExpress = require(modPath + 'express');
var reqMoment = require(modPath + 'moment');
var reqDateFormat = require(modPath + 'dateformat');
var router = reqExpress.Router();
var constants = require('./util/message');
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqSolrInstance = require('../../../../torus-references/instance/SolrInstance');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');

var serviceName = 'getJobsLog'
//global variable
var pHeaders = "";
var mResCas = "";
var resobj = {};
var resultdata = [];

router.post('/getJobsLog', function (req, res, next) {
    try {
        reqLogInfo.AssignLogInfoDetail(req, function (objLogInfo, objSessionInfo) {
            var serviceModel = reqFXDBInstance.DBInstanceSession['SERVICE_MODEL'];
            pHeaders = req.headers;
            var portal_type = "";
            var cas_type = "";
            var app_id = "";
            var intRecordsPerPage = req.body.RecordsperPage || 10;
            var intCurrentPage = req.body.CurrentPage || 1;
            var isSearch = req.body.Is_Search || '';
            var filtreCond = req.body.FILTERCOND;
            portal_type = req.body.portal_type;
            app_id = objLogInfo.APP_ID;
            var tenant_id = objSessionInfo.TENANT_ID || 0;
            if (portal_type === "CP") {
                cas_type = "dev_cas";
            } else {
                cas_type = "solr";
            }
            if (serviceModel.AUDIT_ARCHIVAL_MODEL == 'SOLR') {
                if (cas_type == 'solr') {
                    var strCondition = '';
                    // var intRecordsPerPage = req.body.RecordsperPage || 10;
                    // var intCurrentPage = req.body.CurrentPage || 1 ;
                    var solrSearch = '';
                    var appendQuery = '';
                    var operator = ''
                    if (isSearch == 'Y') {
                        // FYI FILTERCOND is undefined
                        if (Object.keys(filtreCond).length > 0) {
                            Object.keys(filtreCond).forEach((key, index) => {
                                if (index != 0) {
                                    operator = 'AND'
                                }
                                if (key != 'START_TIME' && key != 'END_TIME') {
                                    if (solrSearch == '') {

                                        if (filtreCond[key]) {
                                            solrSearch = ` ${key}:"${filtreCond[key]}"`
                                        }

                                    } else {
                                        if (filtreCond[key]) {
                                            solrSearch = `${solrSearch} ${operator} ${key}:"${filtreCond[key]}"`
                                        }

                                    }
                                }
                            })
                        }

                        if (solrSearch != '') {
                            solrSearch = solrSearch + ` AND APP_ID : ${app_id}`
                        } else {
                            solrSearch = 'TENANT_ID:"' + tenant_id + '" AND APP_ID:"' + app_id + '"'
                        }


                    } else {
                        solrSearch = 'TENANT_ID:"' + tenant_id + '" AND APP_ID:"' + app_id + '"'; // Getting Jobs Log based on TENANT and APP
                    }



                    if (filtreCond && filtreCond['START_TIME'] != '' && filtreCond['END_TIME'] == '') {
                        var starttime = reqDateFormat(filtreCond['START_TIME'], "yyyy-mm-dd' 00:00:00.0000'");
                        var Lastime = '*';
                        solrSearch = '(' + solrSearch + ' AND START_TIME : [ "' + starttime + '" TO ' + Lastime + '])';
                    }
                    else if (filtreCond && filtreCond['END_TIME'] != '' && filtreCond['START_TIME'] == '') {
                        var sttime = '*';
                        var endtime = reqDateFormat(filtreCond['END_TIME'], "yyyy-mm-dd' 23:59:59.0000'");
                        solrSearch = `(${solrSearch} AND END_TIME : ["${sttime}" TO "${endtime}"])`;
                    }
                    else if (filtreCond && filtreCond['START_TIME'] != '' && filtreCond['END_TIME'] != '') {
                        var starttime = reqDateFormat(filtreCond['START_TIME'], "yyyy-mm-dd' 00:00:00.0000'");
                        var endtime = reqDateFormat(filtreCond['END_TIME'], "yyyy-mm-dd' 23:59:59.0000'");
                        solrSearch = `(START_TIME:["${starttime}" TO "${endtime}"] AND ${solrSearch})`;
                    }

                    reqSolrInstance.LogSolrSearchWithPaging(pHeaders, 'SCH_JOBS_LOG', solrSearch, intRecordsPerPage, intCurrentPage, function (pDocuments) {
                        try {
                            var ResultDocs = pDocuments;
                            var totalDocs = pDocuments.response.docs;
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
                            resobj.STATUS = constants.FAILURE;
                            resobj.MESSAGE = error;
                            resobj.DATA = [];
                            res.send(resdata);
                        }
                    })
                }
            }
            else {

                var cond
                var QUERY_LIST_SCHEDULER_JOBS_LOG;
                var resdata = {};
                // mDevCas = pClient;
                var rowData = [];
                if (isSearch == 'Y') {
                    if (filtreCond) {
                        var Start_Time = filtreCond.START_TIME
                        if (Start_Time) {
                            var [datePart, timePart] = Start_Time.split(' ');
                            var [year, month, day] = datePart.split('-');
                            var formattedDay = parseInt(day, 10).toString();
                            var formattedMonth = parseInt(month, 10).toString();
                            var Day = day.padStart(2, '0');
                            var starttime = `${year}-${formattedMonth}-${formattedDay} ${timePart}`;
                        }
                        var End_Time = filtreCond.END_TIME
                        if (End_Time) {
                            var [datePart, timePart] = End_Time.split(' ');
                            var [year, month, day] = datePart.split('-');
                            var Day = day.padStart(2, '0');
                            var formatDay = parseInt(day, 10).toString();
                            var formatMonth = parseInt(month, 10).toString();
                            var endtime = `${year}-${formatMonth}-${formatDay} ${timePart}`;
                        }
                        if (filtreCond.JOB_DESCRIPTION && filtreCond.STATUS) {
                            QUERY_LIST_SCHEDULER_JOBS_LOG = `SELECT * from SCH_JOBS_LOG where job_description='${filtreCond.JOB_DESCRIPTION}' AND status ='${filtreCond.STATUS}' AND app_id='${app_id}'`
                        } else if (filtreCond.JOB_DESCRIPTION) {
                            QUERY_LIST_SCHEDULER_JOBS_LOG = `SELECT * from SCH_JOBS_LOG where job_description='${filtreCond.JOB_DESCRIPTION}' AND app_id='${app_id}'`
                        }
                        else {
                            if (filtreCond.STATUS.length > 0) {
                                QUERY_LIST_SCHEDULER_JOBS_LOG = `SELECT * from SCH_JOBS_LOG where status ='${filtreCond.STATUS}' AND app_id='${app_id}'`
                            } else {
                                QUERY_LIST_SCHEDULER_JOBS_LOG = `SELECT * from SCH_JOBS_LOG where app_id='${app_id}'`
                            }
                        }
                        if (starttime && endtime) {
                            //cond = `start_time between '${starttime.slice(0, 19)}' and '2023-03-28 23:59:59' and end_time between '${endtime.slice(0, 19)}' and '2023-03-28 23:59:59' `
                            cond = `start_time >= '${starttime.slice(0, 19)}' and end_time <= '${endtime.slice(0, 11)}23:59:59'`
                        } else if (starttime && !endtime) {
                            cond = `start_time >= '${starttime.slice(0, 19)}'`
                            //cond = `start_time >='${starttime}'`
                        } else if (!starttime && endtime) {
                            cond = `end_time <= '${endtime.slice(0, 11)}23:59:59'`
                        }
                        if (cond && filtreCond.JOB_DESCRIPTION && filtreCond.STATUS) {
                            QUERY_LIST_SCHEDULER_JOBS_LOG = `${QUERY_LIST_SCHEDULER_JOBS_LOG} AND ${cond}`
                        } else if (cond) {
                            QUERY_LIST_SCHEDULER_JOBS_LOG = `SELECT * FROM SCH_JOBS_LOG where ${cond} `
                        }
                    }
                } else {
                    QUERY_LIST_SCHEDULER_JOBS_LOG = "select * from SCH_JOBS_LOG where APP_ID = '" + app_id + "'";
                }

                // Get cassandra instance
                var QUERY_LIST_SCHEDULER_JOBS_LOGS = QUERY_LIST_SCHEDULER_JOBS_LOG + ' order by created_date desc'
                reqFXDBInstance.GetFXDBConnection(pHeaders, 'log_cas', objLogInfo, function (mDevCas) {
                    reqFXDBInstance.ExecuteQueryWithPagingCount(mDevCas, QUERY_LIST_SCHEDULER_JOBS_LOGS, intCurrentPage, intRecordsPerPage, objLogInfo, function (result, pCount, err) {
                        if (err) {
                            reqInstanceHelper.SendResponse(serviceName, res, err, objLogInfo, "ERR-SCH-10001", "Exception error occured", "", "", err)
                        } else {
                            if (result && result.length) {
                                for (var i = 0; i < result.length; i++) {
                                    var obj = {}
                                    obj.JOB_NAME = result[i].job_name;
                                    obj.JOB_DESCRIPTION = result[i].job_description;
                                    obj.START_TIME = result[i].start_time.toLocaleString();
                                    obj.STATUS = result[i].status;
                                    obj.ERROR = result[i].error;
                                    if (!result[i].end_time) {
                                        obj.END_TIME = result[i].end_time;
                                    } else {
                                        obj.END_TIME = result[i].end_time.toLocaleString();
                                    }
                                    rowData.push(obj)
                                }

                                resdata.TotalNumberOfPages = pCount[0].count
                                resdata.PageCount = Math.ceil(result.length / intRecordsPerPage);
                            }
                            resdata.DATA = rowData

                            resdata.STATUS = constants.SUCCESS;
                            resdata.CurrentPage = intCurrentPage;


                            reqInstanceHelper.SendResponse(serviceName, res, resdata, "SUCCESS", "", "", "", "", "")
                            //reqInstanceHelper.SendResponse(serviceName, res, "Success", objLogInfo, '', '', '', 'SUCCESS', '');


                        }
                    })
                })
            }
        });
    } catch (ex) {
        resobj.STATUS = constants.FAILURE;
        resobj.MESSAGE = ex;
        resobj.DATA = [];
        res.send(resdata);
    }
});

module.exports = router;