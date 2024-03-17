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

var AQMHelper = require('./helper/AQMHelper')

var mDevCas = "";

//global variables

var pHeaders = "";

var resobj = {};

var objLogInfo = {};



router.post('/updateJobRule', function (req, res, next) {
    pHeaders = req.headers;

    // var objLogInfo = reqLogInfo.AssignLogInfoDetailForCP(req.body, req);
    reqLogInfo.AssignLogInfoDetail(req, function (objLogInfo, objSessionInfo) {
        objLogInfo.PROCESS = 'StartJob-Scheduler';
        objLogInfo.ACTION_DESC = 'StartJob';
        reqLogWriter.Eventinsert(objLogInfo);

        var job_name = req.body.job_name || "";
        var template_name = req.body.template_name || "";
        var job_rule = req.body.job_rule || "";
        var app_id = objLogInfo.APP_ID || "";


        var session_info = req.body.session_info;

        var app_id = session_info.APP_ID;
        var user_id = (session_info.USER_ID === undefined) ? session_info.U_ID : session_info.USER_ID;

        var pCLIENT_ID = session_info.CLIENT_ID;
        var pAPP_NAME = session_info.APP_CODE;

        var obj = {};

        var cas_type = "dev_cas";
        reqFXDBInstance.GetFXDBConnection(pHeaders, cas_type, objLogInfo, function (pCltClient) {
            mDevCas = pCltClient;
            // if(cas_type == "dev_cas")
            var condition = "app_id ='" + app_id + "' and category = 'scheduler_jobs'  and code = '" + job_name + "' and designer_name = 'scheduler' ";
            AQMHelper.AQMlocking(mDevCas, condition, pHeaders, function (lockAQM) {
                if (lockAQM != "" && lockAQM != session_info.LOGIN_NAME) {
                    resobj.STATUS = constants.FAILURE;
                    resobj.locked_by = lockAQM;
                    res.send(resobj);
                    return;
                }

                async.series([
                    function (asynccallback) {

                        var pSELECTQUERY_JOBS = "select * from sch_jobs where job_name = " + job_name + " and  template_name = " + template_name;
                        var pDELETEQUERY = "delete from sch_jobs where job_name = " + job_name + " and  template_name = " + template_name;

                        var comment = "Scheduler > " + template_name + ">" + job_name;

                        AQMHelper.AQMdesignersave(mDevCas, app_id, pCLIENT_ID, session_info.APP_CODE, 'scheduler', 'scheduler_jobs', job_name, "SAVE", session_info.LOGIN_NAME, session_info.APP_REQ_ID, 'scheduler_jobs', pSELECTQUERY_JOBS, pDELETEQUERY, "0", comment, job_name, pHeaders, function (resAQM) {
                            asynccallback();
                        });
                    },

                    function (asynccallback) {
                        if (template_name !== "" || template_name !== null || template_name !== undefined) {
                            var pSELECTQUERY_JOBS = "select * from sch_jobs where job_name = " + job_name + " and  template_name = " + template_name;
                            var pDELETEQUERY = "delete from sch_jobs where job_name = " + job_name + " and  template_name = " + template_name;

                            var comment = "Scheduler > " + template_name + ">" + job_name;

                            AQMHelper.AQMdesignersave(mDevCas, app_id, pCLIENT_ID, session_info.APP_CODE, 'scheduler', 'template_code', template_name, "", session_info.LOGIN_NAME, session_info.APP_REQ_ID, 'scheduler_jobs', pSELECTQUERY_JOBS, pDELETEQUERY, "0", comment, job_name, pHeaders, function (resAQM) {
                                asynccallback();
                            });
                        } else {
                            asynccallback();
                        }
                    },

                    function (asynccallback) {
                        jobHelper.UpdateJobNew(mDevCas, objLogInfo, job_name, job_rule, app_id, function (callback) {
                            if (callback !== "") {
                                obj.STATUS = "SUCCESS";
                                obj.MESSAGE = "DATA SAVED SUCCESSFULLY";
                            } else {
                                obj.STATUS = "FAILURE";
                                obj.MESSAGE = "ERROR SAVING DATA";
                            }

                            res.send(obj);
                        });
                    }
                ], function (err) {

                })
            });
        });
    })
});

module.exports = router;