var rootpath = "../../../../";
var modPath = rootpath + 'node_modules/'
var reqExpress = require(modPath + 'express');
var router = reqExpress.Router();
var schedule = require(modPath + 'node-schedule');
var reqCasInstance = require(rootpath + 'torus-references/instance/CassandraInstance');
var reqLogWriter = require(rootpath + 'torus-references/log/trace/LogWriter')
var reqLogInfo = require(rootpath + 'torus-references/log/trace/LogInfo')
var constants = require('./util/message');
var util = require('./util/utility');
var cassandraCounter = require('./util/cassandraCounter');
var async = require(modPath + 'async');
var jobHelper = require('./helper/jobHelper');
var schedulerUtil = require('./util/schedulerUtil');
var ruleHelper = require('./helper/ruleHelper.js')

var reqFXDBInstance = require(rootpath + 'torus-references/instance/DBInstance')


var mDevCas = "";

//global variable
var pHeaders = "";

var resobj = {};

var objLogInfo = {};

var QUERY_GET_JOB_DETAIL = "select * from SCH_JOBS where job_name = %s allow filtering";

router.post('/getJobRule', function (req, res, next) {
    pHeaders = req.headers;

    var objLogInfo = reqLogInfo.AssignLogInfoDetailForCP(req.body, req);
    objLogInfo.PROCESS = 'GetJobRule-Scheduler';
    objLogInfo.ACTION_DESC = 'GetJobRule';
    reqLogWriter.Eventinsert(objLogInfo);

    var job_name = req.body.job_name || "";

    var cas_type = "dev_cas";
    reqFXDBInstance.GetFXDBConnection(pHeaders, cas_type, objLogInfo, function (pCltClient) {
        mDevCas = pCltClient;
        jobHelper.GetJobDetailNew(mDevCas, QUERY_GET_JOB_DETAIL, objLogInfo, job_name, function (callback) {
            res.send(callback);
        });
    });
});

module.exports = router;