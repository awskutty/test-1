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
var jobHelper = require('./helper/jobHelper');
var schedulerUtil = require('./util/schedulerUtil');

var reqFXDBInstance = require(rootpath + 'torus-references/instance/DBInstance')


var ruleHelper = require("./helper/ruleHelper.js")

//global variable
var pHeaders = "";
var mDevCas = "";
var resobj = {};

var objLogInfo = {};

var QUERY_GET_JOB_DETAIL = "select * from SCH_JOBS where job_name = %s allow filtering";

router.post('/rule/initiatemain', function (req, res, next) {
    pHeaders = req.headers;

    var cas_type = "";

    var QUERY_INSERT_JOB = "insert into SCH_JOBS(APP_ID,ROUTING_KEY,JOB_NAME,JOB_DESCRIPTION,TEMPLATE_NAME,JOB_TYPE,CALLING_METHOD,JOB_MODE,OBJECT_NAME,PARAM_JSON,SCHEDULER_INFO,STATUS,CREATED_BY,CREATED_DATE,RULE_INFO) values(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)";

    // var objLogInfo = reqLogInfo.AssignLogInfoDetailForCP(req.body, req);
    reqLogInfo.AssignLogInfoDetail(req, function (objLogInfo, objSessionInfo) {
        objLogInfo.PROCESS = 'InitiateSchedulerJob-Scheduler';
        objLogInfo.ACTION_DESC = 'InitiateSchedulerJob';
        reqLogWriter.Eventinsert(objLogInfo);

        var portal_type = req.body.portal_type || "";
        var app_id = objLogInfo.APP_ID || "";
        var job_name = req.body.job_name || "";
        var reqdata = req.body || "";


        if (portal_type === "CP") {
            cas_type = "dev_cas";
        } else {
            cas_type = "dep_cas";
        }

        var routingKey = "";

        if (pHeaders.hasOwnProperty("routingkey")) {
            routingKey = pHeaders.routingkey;
        }


        // Get cassandra instance
        var mHeaders = req.headers;


        reqFXDBInstance.GetFXDBConnection(mHeaders, cas_type, objLogInfo, function CallbackGetCassandraConn(pCltClient) {
            mDevCas = pCltClient;

            jobHelper.GetJobDetailNew(mDevCas, QUERY_GET_JOB_DETAIL, objLogInfo, job_name,
                function (resJobDetail) {
                    if (resJobDetail.STATUS === constants.FAILURE) {
                        res.send(resJobDetail);
                    } else {
                        resJobDetail = resJobDetail.DATA;

                        ruleHelper.CreateJobFromTemplate(mDevCas, objLogInfo, resJobDetail.template_name, resJobDetail.rule_info, reqdata, resJobDetail, function (resJobCreate) {
                            console.log("NEW JOB" + resJobCreate);
                            jobHelper.GetJobDetailNew(mDevCas, QUERY_GET_JOB_DETAIL, objLogInfo, resJobCreate, function (resJobDetailNew) {

                                //resJobDetailNew.DATA["param_json"] = {};
                                //resJobDetailNew.DATA["param_json"] = JSON.stringify(reqdata)

                                var SCHEDULER_DETAILS = {};

                                var schdet = JSON.parse(resJobDetailNew.DATA.rule_info)

                                SCHEDULER_DETAILS.UNIQUE_ID = schdet[0].unique_id;
                                if (schdet[0]["repetition"]["is_repeat"] === true) {
                                    SCHEDULER_DETAILS.RETRY_JOB_COUNT = schdet[0]["repetition"]["repeat_count"];
                                } else {
                                    SCHEDULER_DETAILS.RETRY_JOB_COUNT = 0;
                                }

                                schedulerUtil.PrepareCronJobAPI(objLogInfo, resJobDetailNew.DATA, mDevCas, cas_type, routingKey, SCHEDULER_DETAILS, req);
                                console.log("GLOBAL JOBS" + global.jobs); // global.logs can be accessed anywhere
                                res.send(resobj);

                            });
                        });
                    }
                });
        });
    })
});

module.exports = router;