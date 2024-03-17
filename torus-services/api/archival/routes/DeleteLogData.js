var reqExpress = require('express');
var router = reqExpress.Router();
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqTranDBHelper = require('../../../../torus-references/instance/TranDBInstance')
const { resolve } = require('path');
const { reject } = require('q');
var serviceName = 'ArcLogData'
var reqLinq = require('node-linq').LINQ;

router.post('/DeleteLogData', function (appRequest, appResponse) {
    try {
        var mHeaders = appRequest.headers
        var arc_log_mode = appRequest.body.PARAMS.PROCESS_NAME;
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
            reqTranDBHelper.GetTranDBConn(mHeaders, false, function (livedbconnection) {
                reqDBInstance.GetFXDBConnection(mHeaders, 'clt_cas', objLogInfo, function (clt_cas_instance) {
                    reqDBInstance.GetFXDBConnection(mHeaders, 'log_cas', objLogInfo, function (log_cas_instance) {
                        reqDBInstance.GetTableFromFXDB(clt_cas_instance, 'tenant_setup', [], {
                            category: 'LOG_RETENTION_PERIOD',
                            tenant_id: objLogInfo.TENANT_ID
                        }, objLogInfo, async function (pError, result) {
                            try {
                                if (pError) {
                                    reqInstanceHelper.SendResponse(serviceName, appResponse, pError, objLogInfo, 'ERR-AUDIT-100001', 'Exception Error Occured', '', '', pError);
                                } else {
                                    // var arcdata = arc_log_mode.LOG_RETENTION_PERIOD[0]
                                    // var arc_log_mode = Object.keys(arcdata)
                                    var Result = JSON.parse(result.rows[0].setup_json)
                                    var value = Result.trace_log ? Result.trace_log[0] : Result.LOG_RETENTION_PERIOD[0]
                                    for (var i = 0; i < arc_log_mode.length; i++) {
                                        if (arc_log_mode[i].toUpperCase() == 'TRACE_LOG') {
                                            var day_count = value.TRACE_LOG
                                            var day = day_count ? day_count : 30
                                            var pquery = {
                                                query: `delete FROM log_tran.trace_log WHERE starttime < NOW() - interval'${parseInt(day)} days'`,
                                                params: []
                                            }
                                            await executeQuery(log_cas_instance, pquery, objLogInfo, arc_log_mode[i].toUpperCase())
                                            console.log('TRACE_LOG SUCCESS')
                                            continue

                                        } else if (arc_log_mode[i].toUpperCase() == 'SCHEDULER_LOG') {
                                            var day_count = value.SCHEDULER_LOG
                                            var day = day_count ? day_count : 30
                                            var pquery = {
                                                query: `delete FROM log_tran.sch_jobs_log WHERE start_time < NOW() - interval'${parseInt(day)} days'`,
                                                params: []
                                            }
                                            await executeQuery(log_cas_instance, pquery, objLogInfo, arc_log_mode[i].toUpperCase())
                                            console.log('SCHEDULER_LOG SUCCESS')
                                            var pquery = {
                                                query: `delete FROM log_tran.sch_jobs_thread_log WHERE start_time < NOW() - interval'${parseInt(day)} days'`,
                                                params: []
                                            }
                                            await executeQuery(log_cas_instance, pquery, objLogInfo, arc_log_mode[i].toUpperCase())
                                            console.log('SCHEDULER_LOG1 SUCCESS')
                                            continue

                                        } else if (arc_log_mode[i].toUpperCase() == 'AUDIT_LOG') {
                                            var day_count = value.AUDIT_LOG
                                            var day = day_count ? day_count : 30
                                            var pquery = {
                                                query: `delete FROM log_tran.audit_log WHERE datetime < NOW() - interval'${parseInt(day)} days'`,
                                                params: []
                                            }
                                            await executeQuery(log_cas_instance, pquery, objLogInfo, arc_log_mode[i].toUpperCase())
                                            console.log('AUDIT_LOG SUCCESS')
                                            continue

                                        } else if (arc_log_mode[i].toUpperCase() == 'EVENT_LOG') {
                                            var day_count = value.EVENT_LOG
                                            var day = day_count ? day_count : 30
                                            var pquery = {
                                                query: `delete FROM log_tran.event_log WHERE starttime < NOW() - interval'${parseInt(day)} days'`,
                                                params: []
                                            }
                                            await executeQuery(log_cas_instance, pquery, objLogInfo, arc_log_mode[i].toUpperCase())
                                            console.log('EVENT_LOG SUCCESS')
                                            continue
                                        } else if (arc_log_mode[i].toUpperCase() == 'COMM_PROCESS_MESSAGE_LOG') {
                                            var day_count = value.COMM_PROCESS_MESSAGE_LOG
                                            var day = day_count ? day_count : 30
                                            var pquery = {
                                                query: `delete FROM ad_gss_tran.comm_process_message_log WHERE created_date < NOW() - interval'${parseInt(day)} days'`,
                                                params: []
                                            }
                                            await executeQuery(livedbconnection, pquery, objLogInfo, arc_log_mode[i].toUpperCase())
                                            console.log('COMM_PROCESS_MESSAGE_LOG SUCCESS')
                                            continue

                                        } else if (arc_log_mode[i].toUpperCase() == 'EX_LOGS') {
                                            var day_count = value.EX_LOGS
                                            var day = day_count ? day_count : 30
                                            var pquery = {
                                                query: `delete FROM ad_gss_tran.EX_LOGS WHERE created_date < NOW() - interval'${parseInt(day)} days'`,
                                                params: []
                                            }
                                            await executeQuery(livedbconnection, pquery, objLogInfo, arc_log_mode[i].toUpperCase())
                                            console.log('EX_LOGS SUCCESS')
                                            continue

                                        } else if (arc_log_mode[i].toUpperCase() == 'ARCHIVAL_QUERY_LOG') {
                                            var day_count = value.ARCHIVAL_QUERY_LOG
                                            var day = day_count ? day_count : 30
                                            var pquery = {
                                                query: `delete FROM ad_gss_tran.archival_query_log WHERE created_date < NOW() - interval'${parseInt(day)} days'`,
                                                params: []
                                            }
                                            await executeQuery(livedbconnection, pquery, objLogInfo, arc_log_mode[i].toUpperCase())
                                            console.log('ARCHIVAL_QUERY_LOG SUCCESS')
                                            continue

                                        } else if (arc_log_mode[i].toUpperCase() == 'LOG_PURGING_INFO') {
                                            var day_count = value.LOG_PURGING_INFO
                                            var day = day_count ? day_count : 30
                                            var pquery = {
                                                query: `delete FROM log_tran.log_purging_info WHERE start_date < NOW() - interval'${parseInt(day)} days'`,
                                                params: []
                                            }
                                            await executeQuery(log_cas_instance, pquery, objLogInfo, arc_log_mode[i].toUpperCase())
                                            console.log('LOG_PURGING_INFO SUCCESS')

                                        }
                                        // reqInstanceHelper.SendResponse(serviceName, appResponse, 'SUCCESS', objLogInfo, '', '', '', 'SUCCESS', '');
                                    }
                                    reqInstanceHelper.SendResponse(serviceName, appResponse, 'SUCCESS', objLogInfo, '', '', '', 'SUCCESS', '');
                                }
                            } catch (error) {
                                reqInstanceHelper.SendResponse(serviceName, appResponse, error, objLogInfo, 'ERR-AUDIT-1000030', 'Exception occured', '', '', error);
                            }
                        })




                        function executeQuery(pConnection, pquery, objLogInfo, Log_Table) {
                            try {
                                var objRow = {}
                                objRow.app_id = objLogInfo.app_id;
                                objRow.tenant_id = objLogInfo.TENANT_ID;
                                objRow.start_date = new Date();
                                objRow.query = pquery.query;
                                objRow.log_table = Log_Table;
                                return new Promise((resolve, reject) => {
                                    reqDBInstance.ExecuteSQLQueryWithParams(log_cas_instance, pquery, objLogInfo, function (pRes, pErr) {
                                        if (pErr) {
                                            reqInstanceHelper.SendResponse(serviceName, appResponse, pErr, objLogInfo, 'ERR-AUDIT-100002', 'Error Occured while Deleting Data from Table', '', '', pErr);
                                            objRow.end_date = new Date();
                                            objRow.rows_count = '-';
                                            objRow.status = "FAILURE"
                                        } else {
                                            // reqInstanceHelper.SendResponse(serviceName, appResponse, pRes, objLogInfo, '', '', '', 'SUCCESS', '');
                                            // resolve(pRes)
                                            objRow.end_date = new Date();
                                            objRow.rows_count = pRes.rowCount;
                                            objRow.status = "SUCCESS"
                                        }
                                        reqDBInstance.InsertFXDB(log_cas_instance, 'log_purging_info', [objRow], objLogInfo, async function (err, res) {
                                            if (err) {
                                                reqInstanceHelper.SendResponse(serviceName, appResponse, err, objLogInfo, 'ERR-AUDIT_INSERT-100003', 'Error while Inserting Data into Table', err.message, 'FAILURE', '');
                                            } else {
                                                // reqInstanceHelper.SendResponse(serviceName, appResponse, res, objLogInfo, '', '', '', 'SUCCESS', '');
                                                resolve()
                                            }
                                        })
                                    })
                                })
                            } catch (error) {

                            }
                        }
                    })
                })
            })
        })
    } catch (error) {

    }


})
module.exports = router