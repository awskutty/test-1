/*
 *   @Author : Ragavendran
 *   @Description : To start a scheduler job
 *   @status : In Progress
 *   @created-Date : 19/10/2016
 */


var rootpath = "../../../../";
var modPath = rootpath + 'node_modules/';
var reqExpress = require(modPath + 'express');
var router = reqExpress.Router();
var schedule = require(modPath + 'node-schedule');
var reqCasInstance = require(rootpath + 'torus-references/instance/CassandraInstance');
var reqLogWriter = require(rootpath + 'torus-references/log/trace/LogWriter');
var reqLogInfo = require(rootpath + 'torus-references/log/trace/LogInfo');
var constants = require('./util/message');
var util = require('./util/utility');
var cassandraCounter = require('./util/cassandraCounter');
var async = require(modPath + 'async');
var jobHelper = require('./helper/jobHelper');
var schedulerUtil = require('./util/schedulerUtil');
var reqFXDBInstance = require(rootpath + 'torus-references/instance/DBInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');


var serviceModel = reqFXDBInstance.DBInstanceSession['SERVICE_MODEL'];
//global variable
var pHeaders = "";
var mDevCas = "";
var resobj = {};
var objLogInfo = {};
var serviceName = 'STARTALLJOBS';
var isLatestPlatformVersion = false;
if (serviceModel && serviceModel.PLATFORM_VERSION == '7.0') {
    reqInstanceHelper.PrintInfo(serviceName, 'Platform Version - ' + serviceModel.PLATFORM_VERSION, null);
    isLatestPlatformVersion = true;
}
//Query
var QUERY_ADD_THREAD_LOG = "insert into sch_jobs_thread_log(schjtl_id,job_name,thread_id,status,start_time,end_time,error_msg) values(%s,%s,%s,%s,%s,%s,%s)";

router.post('/startAllJobs', function (req, res, next) {
    try {
        reqLogInfo.AssignLogInfoDetail(req, function (objLogInfo, objSessionInfo) {
            var QUERY_GET_JOB_DETAIL = {};
            var tenant_id = objSessionInfo.TENANT_ID;
            QUERY_GET_JOB_DETAIL.Table_Name = 'SCH_JOBS';
            QUERY_GET_JOB_DETAIL.Cond_Obj = {};
            pHeaders = req.headers;

            // var objLogInfo = reqLogInfo.AssignLogInfoDetailForCP(req.body, req);
            objLogInfo.PROCESS = 'StartAllJobs-Scheduler';
            objLogInfo.ACTION_DESC = 'StartAllJobs';
            reqLogWriter.Eventinsert(objLogInfo);
            objLogInfo.doRedisPubSub = true;

            var cas_type = "dep_cas";

            var app_id = objLogInfo.APP_ID || '';

            var routingKey = "";

            var startCreated = req.body.startCreated;

            if (pHeaders.hasOwnProperty("routingkey")) {
                routingKey = pHeaders.routingkey;
            }


            // Get cassandra instance
            var mHeaders = req.headers;
            reqFXDBInstance.GetFXDBConnection(mHeaders, cas_type, objLogInfo, function (pCltClient) {
                mDevCas = pCltClient;
                if (app_id != '' && app_id != undefined) {
                    QUERY_GET_JOB_DETAIL.Cond_Obj.app_id = app_id;
                }
                if (isLatestPlatformVersion) {
                    reqInstanceHelper.PrintInfo(serviceName, 'Adding TENANT ID Filters...', objLogInfo);
                    QUERY_GET_JOB_DETAIL.Cond_Obj.TENANT_ID = tenant_id;
                }
                jobHelper.StartAllJobs(mDevCas, objLogInfo, routingKey, cas_type, QUERY_GET_JOB_DETAIL, startCreated, schedulerUtil, req, function (response) {
                    res.send(response);
                });

            });
        });

    } catch (ex) {
        resobj.STATUS = constants.FAILURE;
        resobj.MESSAGE = ex;
        res.send(resobj);
    }
});


module.exports = router;