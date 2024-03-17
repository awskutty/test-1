/*
 *   @Author : Ragavendran
 *   @Description : Tested with sample data need to do with real data
 *   @status : Tested ,having a doubt 
 *   @created-Date : 18/10/2016
 *   @updated-at : 04/04/2017
 */


var rootpath = "../../../../";
var modPath = rootpath + 'node_modules/'
var reqExpress = require(modPath + 'express');
var router = reqExpress.Router();
var schedule = require(modPath + 'node-schedule');
var reqCasInstance = require(rootpath + 'torus-references/instance/CassandraInstance');
var reqLogWriter = require(rootpath + 'torus-references/log/trace/LogWriter')
var reqLogInfo = require(rootpath + 'torus-references/log/trace/LogInfo')
var constants = require('./util/message');
var jobHelper = require('./helper/jobHelper');
var async = require(modPath + 'async');
var AQMHelper = require('./helper/AQMHelper')
var schedulerUtil = require('./util/schedulerUtil');
var reqFXDBInstance = require(rootpath + 'torus-references/instance/DBInstance')
var vsprintf = require(modPath + 'sprintf').vsprintf;

//global variable
var pHeaders = "";
var mDevCas = "";
var resobj = {};
var ServiceName = 'scheduler-job-delete'
//Query
var QUERY_DELETE_JOB_TEMPLATE = "delete from SCH_JOBS where JOB_NAME = %s and app_id = %s";
var QUERY_UPDATE_JOB_LOG = "update SCH_JOBS_LOG set STATUS = %s where JOB_NAME = %s and app_id = %s";

router.post('/deletejob', function (req, res, next) {
    try {
        pHeaders = req.headers;

        CL("I", ServiceName, "Delete job called");

        //req.headers.routingkey = "";
        req.body.PARAMS = req.body;
        req.body.SESSION_ID = "";


        //var objLogInfo = reqLogInfo.AssignLogInfoDetailForCP(req.body, req);
        reqLogInfo.AssignLogInfoDetail(req, function (objLogInfo, objSessionInfo) {
            objLogInfo.doDBOperations = true;
            objLogInfo.doRedisPubSub = true;
            objLogInfo.PROCESS = 'DeleteJob-Scheduler';
            objLogInfo.ACTION_DESC = 'DeleteJob';
            reqLogWriter.Eventinsert(objLogInfo);

            var portal_type = "";
            var cas_type = "";

            var app_id = "";
            var job_name = "";

            var template_name = "";

            portal_type = req.body.portal_type;
            app_id = objLogInfo.APP_ID;
            job_name = req.body.job_name;
            session_info = req.body.session_info;

            if (portal_type === "CP") {
                cas_type = "dev_cas";
            } else {
                cas_type = "dep_cas";
            }

            // Get cassandra instance
            var mHeaders = req.headers;
            reqFXDBInstance.GetFXDBConnection(mHeaders, cas_type, objLogInfo, function CallbackGetCassandraConn(pCltClient) {
                mDevCas = pCltClient;

                if (cas_type === "dev_cas") {

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
                                try {
                                    var query = "select * from sch_jobs where job_name = %s and app_id = %s";
                                    var parsed_query = vsprintf(query, [addSingleQuote(job_name), addSingleQuote(app_id)]);
                                    CL("I", ServiceName, "Delete job initated for job " + job_name);
                                    reqFXDBInstance.ExecuteQuery(mDevCas, parsed_query, objLogInfo, function (pErr, pResult) {
                                        if (pErr) {
                                            asynccallback();
                                        } else {
                                            template_name = pResult.rows[0]["template_name"];
                                            asynccallback();
                                        }
                                    });
                                } catch (ex) {
                                    asynccallback();
                                }
                            },
                            function (asynccallback) {
                                CL("I", ServiceName, "Delete job AQM Modification started for job " + job_name);
                                AQMHelper.AQMModification(mDevCas, session_info.CLIENT_ID, session_info.APP_ID, "scheduler_jobs", job_name, job_name, "Y", pHeaders, function (resAQM) {
                                    asynccallback();
                                })
                            },
                            function (asynccallback) {
                                var query_del = "delete from aqm_designer_changes where client_id = %s and code = %s and app_id = %s and category = %s and group_code = %s"
                                try {
                                    var parsed_query = vsprintf(query, [addSingleQuote(session_info.CLIENT_ID), addSingleQuote(job_name), addSingleQuote(app_id), "scheduler_jobs", addSingleQuote(job_name)]);
                                    CL("I", ServiceName, "Delete job AQM designer changes started for job " + job_name);
                                    reqFXDBInstance.ExecuteQuery(mDevCas, parsed_query, objLogInfo, function (pErr, pResult) {
                                        if (pErr) {
                                            asynccallback();
                                        } else {
                                            asynccallback();
                                        }
                                    });
                                } catch (ex) {
                                    asynccallback();
                                }
                            },
                            function (asynccallback) {
                                try {
                                    var query_del1 = "delete from aqm_designer_changes where client_id = %s and code = %s and app_id = %s and category = %s and group_code = %s"
                                    var parsed_query = vsprintf(query_del1, [addSingleQuote(session_info.CLIENT_ID), addSingleQuote(template_name), addSingleQuote(app_id), addSingleQuote("template_code"), addSingleQuote(job_name)]);
                                    reqFXDBInstance.ExecuteQuery(mDevCas, parsed_query, objLogInfo, function (pErr, pResult) {
                                        if (pErr) {
                                            asynccallback();
                                        } else {
                                            asynccallback();
                                        }
                                    });
                                } catch (ex) {
                                    asynccallback();
                                }
                            },
                            function (asynccallback) {
                                CL("I", ServiceName, "Delete job AQMar Designer Save called for job " + job_name);
                                AQMHelper.AQMardesignersave(mDevCas, session_info.APP_REQ_ID, session_info.APP_CODE, "scheduler", "scheduler_jobs", job_name, "", "DELETE", session_info.LOGIN_NAME, session_info.APP_REQ_ID, pHeaders, function (AQMCallback) {
                                    asynccallback();
                                })
                            },
                            function (asynccallback) {
                                CL("I", ServiceName, "Stop Cron job called for job " + job_name);
                                schedulerUtil.StopCronJob(mDevCas, job_name, app_id);
                                asynccallback();
                            },
                            function (asynccallback) {
                                CL("I", ServiceName, "Delete job method called " + job_name);
                                jobHelper.DeleteJob(mDevCas, QUERY_DELETE_JOB_TEMPLATE, objLogInfo, job_name, app_id, function (resDelObj) {
                                    res.send(resDelObj);
                                })
                            }
                        ], function (err) {
                        });
                    });

                } else {
                    CL("I", ServiceName, "Stop Cron job called for job " + job_name);
                    schedulerUtil.StopCronJob(mDevCas, objLogInfo, job_name, app_id);
                    var msgTobePublished = {
                        PROCESS: 'DELETE_JOB', PAYLOAD: { appID: app_id, jobName: job_name }
                    };
                    var CheckAndPublishInRedisReqObj = {
                        msgTobePublished,
                        objLogInfo
                    };
                    schedulerUtil.CheckAndPublishInRedis(CheckAndPublishInRedisReqObj, function () {
                        CL("I", ServiceName, "Delete job method called " + job_name);
                        jobHelper.DeleteJob(mDevCas, QUERY_DELETE_JOB_TEMPLATE, objLogInfo, job_name, app_id, function (resDelObj) {
                            res.send(resDelObj);
                        });
                    });
                }
            });
        })
    } catch (ex) {
        CL("I", ServiceName, "Delete job exception " + JSON.stringify(ex));
        resobj.STATUS = constants.FAILURE;
        resobj.MESSAGE = ex;
        res.send(resobj);
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

function dateString(date) {
    if (date !== null) {
        var myDate = new Date(date);
        hour = myDate.getHours();
        minute = myDate.getMinutes();
        second = myDate.getSeconds();
        return "'" + myDate.getFullYear() + "-" + (myDate.getMonth() + 1) + "-" + myDate.getDate() + " " + hour + ":" + minute + ":" + second + "'";
    }
    else {
        return null;
    }
}

module.exports = router;