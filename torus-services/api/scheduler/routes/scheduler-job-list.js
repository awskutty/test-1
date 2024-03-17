/*
 *   @Author : Ragavendran
 *   @Description : To list scheduler jobs
 *   @status : Tested with sample data need to check with real data
 *   @created-Date : 19/10/2016
 */


var rootpath = "../../../../";
var modPath = rootpath + 'node_modules/'
var reqExpress = require(modPath + 'express');
var router = reqExpress.Router();
var reqLogWriter = require(rootpath + 'torus-references/log/trace/LogWriter')
var reqLogInfo = require(rootpath + 'torus-references/log/trace/LogInfo')
var constants = require('./util/message');
var jobHelper = require('./helper/jobHelper');
var reqAsync = require('async');
var AQMHelper = require('./helper/AQMHelper');
var reqFXDBInstance = require(rootpath + 'torus-references/instance/DBInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');

//global variable
var serviceName = 'LISTJOBS';
var pHeaders = "";
var mDevCas = "";
var resobj = {};
var serviceModel = reqFXDBInstance.DBInstanceSession['SERVICE_MODEL'];
var isLatestPlatformVersion = false;
if (serviceModel && serviceModel.PLATFORM_VERSION == '7.0') {
    reqInstanceHelper.PrintInfo(serviceName, 'Platform Version - ' + serviceModel.PLATFORM_VERSION, null);
    isLatestPlatformVersion = true;
}

//Query


router.post('/listjobs', function (req, res, next) {
    var QUERY_LIST_SCHEDULER_TEMPLATE = '';
    try {
        reqLogInfo.AssignLogInfoDetail(req, function (objLogInfo, objSessionInfo) {
            pHeaders = req.headers;

            //req.headers.routingkey = "";
            req.body.PARAMS = req.body;
            req.body.SESSION_ID = "";
            var tenant_id = objSessionInfo.TENANT_ID;

            // console.log(objLogInfo,objSessionInfo,tenant_id,'-----------------------');
            // var objLogInfo = reqLogInfo.AssignLogInfoDetailForCP(req.body, req);
            objLogInfo.PROCESS = 'JobList-Scheduler';
            objLogInfo.ACTION_DESC = 'JobList';
            reqLogWriter.Eventinsert(objLogInfo);

            var portal_type = "";
            var cas_type = "";

            var app_id = "";
            var mode = "";

            portal_type = req.body.portal_type;
            app_id = objLogInfo.APP_ID;
            mode = req.body.SchedulerMode;

            if (portal_type === "CP") {
                cas_type = "dev_cas";
            } else {
                cas_type = "dep_cas";
            }

            // Get cassandra instance
            var mHeaders = req.headers;
            reqFXDBInstance.GetFXDBConnection(mHeaders, cas_type, objLogInfo, function CallbackGetCassandraConn(pCltClient) {
                mDevCas = pCltClient;

                var condition = [];
                condition.push(app_id);
                if (mode === 'MANUAL') {
                    QUERY_LIST_SCHEDULER_TEMPLATE = "select * from SCH_JOBS where app_id = %s ";
                } else if (mode === 'AUTO') {
                    QUERY_LIST_SCHEDULER_TEMPLATE = "select * from SCH_JOBS where app_id = %s and job_created_mode ='" + mode + "'";
                }

                if (isLatestPlatformVersion) {
                    QUERY_LIST_SCHEDULER_TEMPLATE = QUERY_LIST_SCHEDULER_TEMPLATE + " and tenant_id = '" + tenant_id + "'";
                }

                QUERY_LIST_SCHEDULER_TEMPLATE = QUERY_LIST_SCHEDULER_TEMPLATE + ' allow filtering';
                // call create scheduler template method
                jobHelper.Listjobs(mDevCas, QUERY_LIST_SCHEDULER_TEMPLATE, objLogInfo, condition, function (resListJob) {

                    if (resListJob.STATUS == "Success") {
                        var data = resListJob.DATA;

                        var newdata = [];

                        for (var i = 0; i < data.length; i++) {
                            if (data[i]['job_mode'] != 'RUNTIME') {
                                if (mode === 'MANUAL') {
                                    if (data[i]['job_created_mode'] != 'AUTO') {
                                        newdata.push(data[i]);
                                    }
                                } else {
                                    if (data[i]['job_created_mode'] == 'AUTO') {
                                        newdata.push(data[i]);
                                    }
                                }
                            }
                        }

                        resListJob.DATA = newdata;

                        if (portal_type == 'CP') { // Service call from CP to get AQM Locking
                            reqAsync.forEachSeries(resListJob.DATA, function (row, asyncallback) {
                                var condition = "app_id ='" + app_id + "' and category = 'scheduler_jobs'  and code = '" + row.job_name + "' and designer_name = 'scheduler' ";
                                AQMHelper.AQMlocking(mDevCas, condition, pHeaders, function (lockAQM) {
                                    row.locked_by = lockAQM;
                                    asyncallback();
                                })
                            }, function (pErr, pWarning) {
                                res.send(resListJob);
                            })
                        } else {
                            res.send(resListJob);
                        }
                    } else { // Service call from WP 
                        res.send(resListJob);
                    }

                })
            });
        });
    } catch (ex) {
        resobj.STATUS = constants.FAILURE;
        resobj.MESSAGE = ex;
        resobj.DATA = [];
        res.send(resobj);
    }
});

module.exports = router;