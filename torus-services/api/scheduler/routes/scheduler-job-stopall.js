/*
 *   @Author : Ragavendran
 *   @Description : To stop a scheduler job
 *   @status : In-Progress
 *   @created-Date : 20/10/2016
 
 */


var rootpath = "../../../../";
var modPath = rootpath + 'node_modules/';
var reqExpress = require(modPath + 'express');
var router = reqExpress.Router();
var reqLogWriter = require(rootpath + 'torus-references/log/trace/LogWriter');
var reqLogInfo = require(rootpath + 'torus-references/log/trace/LogInfo');
var constants = require('./util/message');
var async = require(modPath + 'async');
var reqLINQ = require('node-linq').LINQ;
var jobHelper = require('./helper/jobHelper');
var schedulerUtil = require('./util/schedulerUtil');
var reqFXDBInstance = require(rootpath + 'torus-references/instance/DBInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');

//global variable
var pHeaders = "";
var serviceName = 'STOPALLJOBS';
var mDevCas = "";
var resobj = {};
var serviceModel = reqFXDBInstance.DBInstanceSession['SERVICE_MODEL'];
var isLatestPlatformVersion = false;
if (serviceModel && serviceModel.PLATFORM_VERSION == '7.0') {
    reqInstanceHelper.PrintInfo(serviceName, 'Platform Version - ' + serviceModel.PLATFORM_VERSION, null);
    isLatestPlatformVersion = true;
}

global.jobs = [];

router.post('/stopAllJobs', function (req, res, next) {
    reqLogInfo.AssignLogInfoDetail(req, function (objLogInfo, objSessionInfo) {
        var tenant_id = objSessionInfo.TENANT_ID;
        pHeaders = req.headers;
        // variable initialization
        pHeaders = req.headers;

        //req.headers.routingkey = "";
        req.body.PARAMS = req.body;
        req.body.SESSION_ID = "";


        // var objLogInfo = reqLogInfo.AssignLogInfoDetailForCP(req.body, req);

        objLogInfo.PROCESS = 'StopAllJobs-Scheduler';
        objLogInfo.ACTION_DESC = 'StopAllJobs';
        reqLogWriter.Eventinsert(objLogInfo);
        objLogInfo.doDBOperations = true;
        objLogInfo.doRedisPubSub = true;
        var portal_type = "";
        var cas_type = "";


        var app_id = "";
        var job_name = "";

        var cas_type = "dep_cas";

        var app_id = objLogInfo.APP_ID;

        var QUERY_GET_JOB_DETAIL = {};
        QUERY_GET_JOB_DETAIL.Table_Name = 'SCH_JOBS';
        QUERY_GET_JOB_DETAIL.Cond_Obj = { STATUS: 'STARTED' };
        QUERY_GET_JOB_DETAIL.process = "STOP_ALL"
        if (app_id != '' && app_id != undefined) {
            QUERY_GET_JOB_DETAIL.Cond_Obj.app_id = app_id;
        }
        if (isLatestPlatformVersion) {
            reqInstanceHelper.PrintInfo(serviceName, 'Adding TENANT ID Filters...', objLogInfo);
            QUERY_GET_JOB_DETAIL.Cond_Obj.TENANT_ID = tenant_id;
        }
        var mHeaders = req.headers;
        reqFXDBInstance.GetFXDBConnection(mHeaders, cas_type, objLogInfo, function (pCltClient) {
            mDevCas = pCltClient;

            jobHelper.GetAllJobDetail(mDevCas, QUERY_GET_JOB_DETAIL, objLogInfo,
                function (resJobDetail) {
                    if (resJobDetail.STATUS === constants.FAILURE) {
                        res.send(resJobDetail);
                    }
                    else {
                        var data = resJobDetail.DATA;
                        if (data.length) {
                            reqFXDBInstance.GetFXDBConnection(mHeaders, 'log_cas', objLogInfo, function (logDBConn) {
                                async.forEachOf(data, function (value, key, callback_async) {
                                    if (data[key]['job_mode'] !== 'RUNTIME') {
                                        objLogInfo.TENANT_ID = value.tenant_id; // Adding TENANT_ID in the objLogInfo because unable to pass the tenant_id parameter
                                        job_name = value['job_name'];
                                        reqFXDBInstance.GetTableFromFXDB(logDBConn, 'sch_jobs_log', [], {
                                            status: 'Started',
                                            job_name: value.job_name
                                        }, objLogInfo, function (pError, result) {
                                            if (result && result.rows.length) {
                                                var jobthreadId = new reqLINQ(result.rows)
                                                    .Select(function (item) {
                                                        return (item.thread_id);
                                                    }).ToArray();

                                                schedulerUtil.StopCronJob(mDevCas, objLogInfo, data[key]["job_name"], data[key]["app_id"], jobthreadId);
                                                var msgTobePublished = {
                                                    PROCESS: 'STOP_JOB',
                                                    PAYLOAD: {
                                                        appID: app_id,
                                                        jobName: job_name
                                                    }
                                                };
                                                var CheckAndPublishInRedisReqObj = {
                                                    msgTobePublished,
                                                    objLogInfo
                                                };
                                                schedulerUtil.CheckAndPublishInRedis(CheckAndPublishInRedisReqObj, function () { });
                                                callback_async();
                                            } else {
                                                callback_async()
                                            }

                                        })
                                    }
                                    else {
                                        callback_async();
                                    }
                                }, function (err) {
                                    res.send({ "STATUS": "Success" });
                                });
                            })

                        }

                    }
                });
        });
    });
});

module.exports = router;