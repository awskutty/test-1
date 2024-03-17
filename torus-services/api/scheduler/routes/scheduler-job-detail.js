/*
 *   @Author : Ragavendran
 *   @Description : To get a scheduler job detail
 *   @status : Tested with sample data need to check with real data
 *   @created-Date : 19/10/2016
 */


var rootpath = "../../../../";
var modPath = rootpath + 'node_modules/'
var reqExpress = require(modPath + 'express');
var router = reqExpress.Router();
var schedule = require(modPath + 'node-schedule');
var reqCasInstance = require(rootpath + 'torus-references/instance/CassandraInstance');
var reqLogWriter = require(rootpath + 'torus-references/log/trace/LogWriter')
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo')
var constants = require('./util/message');
var jobHelper = require('./helper/jobHelper');
var reqFXDBInstance = require(rootpath + 'torus-references/instance/DBInstance')

//global variable
var pHeaders = "";
var mDevCas = "";
var resobj = {};
var ServiceName = 'scheduler-job-details'
//Query
var QUERY_GET_JOB_DETAIL = "select * from SCH_JOBS where job_name = %s and app_id = %s";

router.post('/getJobDetail', function (req, res, next) {
    try {
        pHeaders = req.headers;


        //req.headers.routingkey = "";
        req.body.PARAMS = req.body;
        req.body.SESSION_ID = "";


        // var objLogInfo = reqLogInfo.AssignLogInfoDetailForCP(req.body, req); 
        reqLogInfo.AssignLogInfoDetail(req, function (objLogInfo, objSessionInfo) {
            objLogInfo.PROCESS = 'JobDetail-Scheduler';
            objLogInfo.ACTION_DESC = 'JobDetail';
            reqLogWriter.Eventinsert(objLogInfo);

            var portal_type = "";
            var cas_type = "";

            // var app_id = objLogInfo.APP_ID;
            var app_id = objLogInfo.APP_ID;
            var job_name = "";

            portal_type = req.body.portal_type;
            job_name = req.body.job_name;
            CL("I", ServiceName, "Delete job method called " + job_name);
            if (portal_type === "CP") {
                cas_type = "dev_cas";
            } else {
                cas_type = "dep_cas";
            }

            // Get cassandra instance
            var mHeaders = req.headers;
            reqFXDBInstance.GetFXDBConnection(mHeaders, cas_type, objLogInfo, function CallbackGetCassandraConn(pCltClient) {
                mDevCas = pCltClient;

                // call create scheduler template method
                jobHelper.GetJobDetail(mDevCas, QUERY_GET_JOB_DETAIL, objLogInfo, job_name, app_id, function (resListJob) {
                    res.send(resListJob);
                })
            });
        })
    } catch (ex) {
        resobj.STATUS = constants.FAILURE;
        resobj.MESSAGE = ex;
        resobj.DATA = [];
        res.send(resobj);
    }
});

module.exports = router;