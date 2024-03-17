/*
 *   @Author : Ragavendran
 *   @Description : To delete a scheduler template
 *   @status : Tested with sample data need to do with real data
 *   @created-Date : 18/10/2016
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
var AQMHelper = require('./helper/AQMHelper');
var async = require(modPath + 'async');

//global variable
var pHeaders = "";
var mResCas = "";
var resobj = {};

var reqFXDBInstance = require(rootpath + 'torus-references/instance/DBInstance')

var vsprintf = require(modPath + 'sprintf').vsprintf;

//Query
var QUERY_DELETE_SCHEDULER_TEMPLATE = "delete from SCH_JOB_TEMPLATES where TEMPLATE_NAME = %s and app_id = %s";
var QUERY_JOBS = "select template_name from SCH_JOBS where app_id = %s allow filtering";

router.post('/deletetemplate', function (req, res, next) {
    try {
        pHeaders = req.headers;

        var portal_type = "";
        var cas_type = "";

        var app_id = "";
        var template_name = "";
        var session_info = "";

        //req.headers.routingkey = "";
        req.body.PARAMS = req.body;
        req.body.SESSION_ID = "";


        // var objLogInfo = reqLogInfo.AssignLogInfoDetailForCP(req.body, req);
        reqLogInfo.AssignLogInfoDetail(req, function (objLogInfo, objSessionInfo) {

            objLogInfo.PROCESS = 'DeleteTemplate-Scheduler';
            objLogInfo.ACTION_DESC = 'DeleteTemplate';
            reqLogWriter.Eventinsert(objLogInfo);

            portal_type = req.body.portal_type;
            app_id = objLogInfo.APP_ID;
            template_name = req.body.template_name;
            session_info = req.body.session_info;

            if (portal_type === "CP") {
                cas_type = "dev_cas";
            } else {
                cas_type = "dep_cas";
            }

            // Get cassandra instance
            var mHeaders = req.headers;
            reqFXDBInstance.GetFXDBConnection(mHeaders, cas_type, objLogInfo, function (pCltClient) {
                mResCas = pCltClient;

                isJobExistsForTemplate(objLogInfo, template_name, app_id, function (resObjCount) {



                    if (resObjCount.STATUS === constants.SUCCESS) {
                        if (resObjCount.DATA) {
                            resObjCount.MESSAGE = constants.JOBEXIST;
                            res.send(resObjCount);
                        } else {
                            var pDELETEQUERY_AQM = "delete from aqm_designer_changes where client_id = %s and code = %s and app_id = %s and category = %s and group_code = %s";
                            var pDELETEQUERY = "delete from sch_job_templates where app_id = " + app_id + " and  template_name = " + template_name;
                            var comment = "Scheduler > " + template_name;

                            if (cas_type === "dev_cas") {
                                // AQMHelper.AQMdesignersave(mDevCas, app_id, pCLIENT_ID, pAPP_NAME, 'scheduler', 'scheduler_job_templates', template_name, user_action, session_info.LOGIN_NAME, session_info.APP_REQ_ID, 'SCH_JOB_TEMPLATES', pSELECTQUERY, pDELETEQUERY, "0", comment, template_name, function (resAQM) {
                                var condition = "app_id ='" + app_id + "' and category = 'scheduler_job_templates'  and code = '" + template_name + "' and designer_name = 'scheduler' ";
                                AQMHelper.AQMlocking(mResCas, condition, pHeaders, function (lockAQM) {
                                    if (lockAQM != "" && lockAQM != session_info.LOGIN_NAME) {
                                        resobj.STATUS = constants.FAILURE;
                                        resobj.locked_by = lockAQM;
                                        res.send(resobj);
                                        return;
                                    }
                                    async.series([

                                        function (callbackasync) {
                                            try {
                                                var parsed_pDELETEQUERY_AQM = vsprintf(pDELETEQUERY_AQM, [addSingleQuote(session_info.CLIENT_ID), addSingleQuote(template_name), addSingleQuote(app_id), addSingleQuote('scheduler_job_templates'), addSingleQuote(template_name)]);

                                                reqFXDBInstance.ExecuteQuery(mResCas, parsed_pDELETEQUERY_AQM, objLogInfo, function (pErr, pResult) {
                                                    if (pErr) {
                                                        callbackasync();
                                                    } else {
                                                        callbackasync();
                                                    }
                                                });
                                            } catch (ex) {
                                                callback("Exception : " + ex.toString());
                                            }
                                        },
                                        function (callbackasync) {
                                            AQMHelper.AQMardesignersave(mResCas, app_id, session_info.APP_CODE, "scheduler", "scheduler_job_templates", template_name, "", "DELETE", session_info.LOGIN_NAME, session_info.APP_REQ_ID, pHeaders, function (resAQM) {
                                                callbackasync();
                                            });
                                        },
                                        function (callbackasync) {
                                            deleteSchedulerTemplate(objLogInfo, template_name, app_id, function () {
                                                res.send(resobj);
                                            })
                                        },
                                    ], function (err) {

                                    })
                                });
                            }
                            else {
                                deleteSchedulerTemplate(objLogInfo, template_name, app_id, function () {
                                    res.send(resobj);
                                })
                            }
                        }
                    } else {
                        resObjCount.MESSAGE = constants.JOBEXIST;
                        res.send(resObjCount);
                    }
                })
            });
        })
    } catch (ex) {
        resobj.STATUS = constants.FAILURE;
        resobj.MESSAGE = ex;
        res.send(resobj);
    }
});

/**
 * deletes a scheduler template
 * 
 * @param template_code - Unique ID for scheduler template
 * @return - JSON response regarding success/failure of deletion
 */
function deleteSchedulerTemplate(objLogInfo, TEMPLATE_NAME, app_id, callback) {
    try {
        var parsed_query = vsprintf(QUERY_DELETE_SCHEDULER_TEMPLATE, [addSingleQuote(TEMPLATE_NAME), addSingleQuote(app_id)]);

        reqFXDBInstance.ExecuteQuery(mResCas, parsed_query, objLogInfo, function (pErr, pResult) {
            if (pErr) {
                resobj.STATUS = constants.FAILURE;
                resobj.MESSAGE = pErr.message;
                callback();
            } else {
                resobj.STATUS = constants.SUCCESS;
                resobj.MESSAGE = constants.SCHEDULER_TEMPLATE_DELETION_SUCCESS;
                callback();
            }
        });
    } catch (ex) {
        resobj.STATUS = constants.FAILURE;
        resobj.MESSAGE = ex;
        callback();
    }
}


function isJobExistsForTemplate(objLogInfo, template_name, app_id, callback) {
    var resobj = {};
    var temp = false;
    try {
        var parsed_query = vsprintf(QUERY_JOBS, [addSingleQuote(app_id)]);

        reqFXDBInstance.ExecuteQuery(mResCas, parsed_query, objLogInfo, function (pErr, pResult) {
            if (pErr) {
                resobj.STATUS = constants.FAILURE;
                resobj.DATA = pErr.message;
                callback(resobj);
            } else {
                var i = 0;
                resobj.STATUS = constants.SUCCESS;
                for (var i in pResult.rows) {
                    if (pResult.rows[i]["template_name"] === template_name) {
                        temp = true;
                    }
                }

                if (!temp) {
                    resobj.DATA = false;
                } else {
                    resobj.DATA = true;
                }
                callback(resobj);
            }
        });
    } catch (ex) {
        resobj.STATUS = constants.FAILURE;
        resobj.DATA = ex;
        callback(resobj);
    }
}

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
        console.log("DATE STRING CALLED");
        //return "'" + myDate.getFullYear() + "-" + (myDate.getMonth() + 1) + "-" + myDate.getDate() + " " + hour + ":" + minute + ":" +second + "'";
        return "'" + reqDateFormatter.ConvertDate("'" + myDate + "'", pHeaders, true) + "'";
    }
    else {
        return null;
    }
}


module.exports = router;