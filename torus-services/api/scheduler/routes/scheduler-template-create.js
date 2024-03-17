/*
 *   @Author : Ragavendran
 *   @Description : To create a scheduler template
 *   @status : Tested with sample data need to do with real data
 *   @created-Date : 18/10/2016
 *   @updated-at : 04/04/2017
 */

var rootpath = "../../../../";
var modPath = rootpath + 'node_modules/'
var reqExpress = require(modPath + 'express');
var router = reqExpress.Router();
var reqLogWriter = require(rootpath + 'torus-references/log/trace/LogWriter')
var reqLogInfo = require(rootpath + 'torus-references/log/trace/LogInfo')
var constants = require('./util/message');
var AQMHelper = require('./helper/AQMHelper');

var reqFXDBInstance = require(rootpath + 'torus-references/instance/DBInstance')
var constants = require('./util/message');
var vsprintf = require(modPath + 'sprintf').vsprintf;
var reqDateFormatter = require(rootpath + 'torus-references/common/dateconverter/DateFormatter')
var jobHelper = require('./helper/jobHelper');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqAuditLog = require('../../../../torus-references/log/audit/AuditLog');
var reqTranDBHelper = require('../../../../torus-references/instance/TranDBInstance')

//global variable
var pHeaders = "";
var mDevCas = "";
var serviceName = "SchedulerCreateTmplate";
var serviceModel = reqFXDBInstance.DBInstanceSession['SERVICE_MODEL'];
var isLatestPlatformVersion = false;
if (serviceModel && serviceModel.PLATFORM_VERSION == '7.0') {
    reqInstanceHelper.PrintInfo(serviceName, 'Platform Version - ' + serviceModel.PLATFORM_VERSION, null);
    isLatestPlatformVersion = true;
}

//Query
var QUERY_INSERT_SCHEDULER_TEMPLATE = "insert into SCH_JOB_TEMPLATES(APP_ID, ROUTING_KEY, TEMPLATE_NAME,TEMPLATE_DESCRIPTION, JOB_TYPE, CALLING_METHOD, OBJECT_NAME, PARAM_JSON, CREATED_BY, CREATED_DATE,prct_id) values(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)";
var QUERY_DELETE_SCHEDULER_TEMPLATE = "delete from SCH_JOB_TEMPLATES where TEMPLATE_NAME = %s and app_id = %s";

router.post('/createtemplate', function (req, res, next) {
    try {
        pHeaders = req.headers;
        var request = req.body;
        //req.headers.routingkey = "";
        req.body.PARAMS = req.body;
        req.body.SESSION_ID = "";
        var resobj = {};
        var mHeaders = req.headers;
        var prct_id = ''
        reqLogInfo.AssignLogInfoDetail(req, function (objLogInfo, objSessionInfo) {
            objLogInfo.PROCESS_INFO.PROCESS_NAME = 'Create_Template';
            reqTranDBHelper.GetTranDBConn(mHeaders, false, function (tran_db_instance) {
                reqAuditLog.GetProcessToken(tran_db_instance, objLogInfo, async function (error, prctId) {
                    prct_id = prctId
                    var tenant_id = objSessionInfo.TENANT_ID;
                    // var objLogInfo = reqLogInfo.AssignLogInfoDetailForCP(req.body, req);
                    objLogInfo.PROCESS = 'CreateTemplate-Scheduler';
                    objLogInfo.ACTION_DESC = 'CreateTemplate';
                    reqLogWriter.Eventinsert(objLogInfo);


                    var template_name = "";
                    var template_description = "";
                    var job_type = "";
                    var calling_method = "";
                    var object_name = "";
                    var param_json = {};
                    var session_info = {};
                    var portal_type = "";
                    var cas_type = "";
                    var app_id = "";
                    var routing_key = "";
                    var user_id = "";
                    var code = "";


                    var validateRes = await validateSessionInfo()


                    function validateSessionInfo() {
                        try {
                            for (var sessiondata in request.session_info) {
                                if (sessiondata != 'CLIENT_ID') {
                                    if (sessiondata == 'U_ID') {
                                        if (request.session_info[sessiondata] !== objLogInfo.USER_ID) {
                                            return false;
                                        }
                                    } else if (sessiondata == 'LOGIN_NAME') {
                                        if (request.session_info[sessiondata] !== objLogInfo.LOGIN_NAME) {
                                            return false;
                                        }
                                    } else if (sessiondata == 'APP_ID') {
                                        if (request.session_info[sessiondata] !== objLogInfo.APP_ID) {
                                            return false;
                                        }
                                    }

                                }
                            }
                            return true
                        } catch (error) {

                        }
                    }

                    if (validateRes) {
                        template_name = request.template_name;
                        job_type = request.job_type;
                        calling_method = request.calling_method;
                        object_name = request.object_name;
                        param_json = request.param_json;
                        session_info = request.session_info;
                        portal_type = request.portal_type;
                        routing_key = request.routing_key;
                        template_description = request.template_description;
                        template_notification = request.template_notification;
                        prct_id = prct_id;

                        app_id = session_info.APP_ID;
                        pCLIENT_ID = session_info.CLIENT_ID;
                        pAPP_NAME = session_info.APP_CODE;


                        user_id = (session_info.USER_ID === undefined) ? session_info.U_ID : session_info.USER_ID;
                        var user_action = "SAVE"

                        // :tocheck
                        if (portal_type === "CP") {
                            cas_type = "dev_cas"
                        } else {
                            cas_type = "dep_cas"
                        }

                        if (template_name === "" || template_name === null || template_name === undefined) {
                            template_name = UUIDString();
                            console.log(template_name);
                        }
                        job_type = "SERVICE";
                        // Get cassandra instance

                        reqFXDBInstance.GetFXDBConnection(mHeaders, cas_type, objLogInfo, function CallbackGetCassandraConn(pCltClient) {
                            mDevCas = pCltClient;
                            try {
                                var objFoInsert = {
                                    app_id,
                                    routing_key,
                                    template_description,
                                    template_name,
                                    job_type,
                                    calling_method,
                                    object_name,
                                    param_json,
                                    user_id,
                                    tenant_id,
                                    headers: pHeaders,
                                    template_notification,
                                    prct_id: prct_id
                                };
                                if (cas_type === "dev_cas") {
                                    var pSELECTQUERY = "select * from sch_job_templates where app_id = " + app_id + " and  template_name = " + template_name;
                                    var pDELETEQUERY = "delete from sch_job_templates where app_id = " + app_id + " and  template_name = " + template_name;
                                    var comment = "Scheduler > " + template_name;
                                    var condition = "app_id ='" + app_id + "' and category = 'scheduler_job_templates'  and code = '" + template_name + "' and designer_name = 'scheduler' ";
                                    AQMHelper.AQMlocking(mDevCas, condition, pHeaders, function (lockAQM) {
                                        if (lockAQM != "" && lockAQM != session_info.LOGIN_NAME) {
                                            resobj.STATUS = constants.FAILURE;
                                            resobj.locked_by = lockAQM;
                                            res.send(resobj);
                                            return;
                                        }
                                        AQMHelper.AQMdesignersave(mDevCas, app_id, pCLIENT_ID, pAPP_NAME, 'scheduler', 'scheduler_job_templates', template_name, user_action, session_info.LOGIN_NAME, session_info.APP_REQ_ID, 'SCH_JOB_TEMPLATES', pSELECTQUERY, pDELETEQUERY, "0", comment, template_name, pHeaders, function (resAQM) {
                                            deleteSchedulerTemplate(objLogInfo, template_name, app_id, function () {
                                                try {
                                                    insertIntoSchJobTemplates(objFoInsert, objLogInfo, function (error) {
                                                        try {
                                                            if (error) {
                                                                resobj.STATUS = constants.FAILURE;
                                                                resobj.MESSAGE = error.message;
                                                                res.send(resobj);
                                                            } else {
                                                                CL('S', serviceName, 'Successfully Inserted Job Template Details...', objLogInfo);
                                                                selectAndUpdateJobs(mDevCas, objLogInfo, request);
                                                            }
                                                        } catch (error) {
                                                            CL('D', serviceName, 'Catch Error in insertIntoSchJobTemplates() Callback...' + error.stack, objLogInfo);
                                                            resobj.STATUS = constants.FAILURE;
                                                            resobj.MESSAGE = error.message;
                                                            res.send(resobj);
                                                        }
                                                    });
                                                } catch (error) {
                                                    CL('D', serviceName, 'Catch Error in deleteSchedulerTemplate() Callback...' + error.stack, objLogInfo);
                                                    resobj.STATUS = constants.FAILURE;
                                                    resobj.MESSAGE = error.message;
                                                    res.send(resobj);
                                                }
                                            });
                                        })
                                    });
                                } else {
                                    deleteSchedulerTemplate(objLogInfo, template_name, app_id, function () {
                                        try {
                                            insertIntoSchJobTemplates(objFoInsert, objLogInfo, function (error) {
                                                try {
                                                    if (error) {
                                                        resobj.STATUS = constants.FAILURE;
                                                        resobj.MESSAGE = error.message;
                                                        res.send(resobj);
                                                    } else {
                                                        CL('S', serviceName, 'Successfully Inserted Job Template Details...', objLogInfo);
                                                        selectAndUpdateJobs(mDevCas, objLogInfo, request);
                                                    }
                                                } catch (error) {
                                                    CL('D', serviceName, 'Catch Error in insertIntoSchJobTemplates() Callback...' + error.stack, objLogInfo);
                                                    resobj.STATUS = constants.FAILURE;
                                                    resobj.MESSAGE = error.message;
                                                    res.send(resobj);
                                                }
                                            });
                                        } catch (error) {
                                            CL('D', serviceName, 'Catch Error in deleteSchedulerTemplate() Callback...' + error.stack, objLogInfo);
                                            resobj.STATUS = constants.FAILURE;
                                            resobj.MESSAGE = error.message;
                                            res.send(resobj);
                                        }
                                    });
                                }
                            } catch (ex) {
                                resobj.STATUS = constants.FAILURE;
                                resobj.MESSAGE = ex;
                                res.send(resobj);
                            }
                        });
                    } else {
                        CL('D', serviceName, 'Session info not matched', objLogInfo);
                        resobj.STATUS = constants.FAILURE;
                        resobj.MESSAGE = '401-UNAUTHORIZED';
                        res.send(resobj);
                    }
                });
            });
        });

        function selectAndUpdateJobs(pClient, objLogInfo, currentTemplate) {
            if (!currentTemplate.template_name) {
                resobj.STATUS = constants.SUCCESS;
                resobj.MESSAGE = constants.SCHEDULER_TEMPLATE_CREATION_SUCCESS;
                res.send(resobj);
            } else {
                var reqLinq = require('node-linq').LINQ;
                reqFXDBInstance.GetTableFromFXDB(pClient, 'SCH_JOBS', [], {
                    template_name: currentTemplate.template_name
                }, objLogInfo, function (error, result) {
                    if (error) {
                        return res.send(error);
                    } else {
                        var currentTemplateJobs = new reqLinq(result.rows)
                            .Where(function (item) {
                                return (item.template_name == currentTemplate.template_name);
                            }).ToArray();
                        var i = 0;

                        if (i < currentTemplateJobs.length) {
                            doUpdateJob(currentTemplateJobs[i]);
                        } else {
                            resobj.STATUS = constants.SUCCESS;
                            resobj.MESSAGE = constants.SCHEDULER_TEMPLATE_CREATION_SUCCESS;
                            res.send(resobj);
                        }

                        function doUpdateJob(currentJob) {
                            i++;
                            currentJob.calling_method = currentTemplate.calling_method;
                            currentJob.job_type = currentTemplate.job_type;
                            currentJob.job_notification = currentTemplate.template_notification;
                            currentJob.object_name = currentTemplate.object_name;
                            currentJob.template_name = currentTemplate.template_name;
                            currentJob.session_info = currentTemplate.session_info;
                            currentJob.job_created_mode = "MANUAL";
                            currentJob.routing_key = pHeaders.routingkey;
                            currentJob.scheduler_info = JSON.parse(currentJob.scheduler_info);
                            currentJob.param_json = JSON.parse(currentJob.param_json);
                            //Object.assign(currentJob, currentTemplate);
                            jobHelper.CreateJobWithParam(pHeaders, currentJob, objLogInfo, prct_id, function (error, result) {
                                if (error) {
                                    return res.send(error);
                                } else {
                                    if (i < currentTemplateJobs.length) {
                                        doUpdateJob(currentTemplateJobs[i]);
                                    } else {
                                        resobj.STATUS = constants.SUCCESS;
                                        resobj.MESSAGE = constants.SCHEDULER_TEMPLATE_CREATION_SUCCESS;
                                        res.send(resobj);
                                    }
                                }
                            });
                        }
                    }
                });

            }

        }

        function insertIntoSchJobTemplates(pObjFoInsert, pObjLogInfo, insertIntoSchJobTemplatesCallback) {
            CL('S', serviceName, 'Inserting Job Template Details into SCH_JOB_TEMPLATES Table...', pObjLogInfo);
            var schJobsTemplateData = {
                "APP_ID": pObjFoInsert.app_id,
                "ROUTING_KEY": pObjFoInsert.routing_key,
                "TEMPLATE_DESCRIPTION": pObjFoInsert.template_description,
                "TEMPLATE_NOTIFICATION": JSON.stringify(pObjFoInsert.template_notification),
                "TEMPLATE_NAME": pObjFoInsert.template_name,
                "JOB_TYPE": pObjFoInsert.job_type,
                "CALLING_METHOD": pObjFoInsert.calling_method,
                "OBJECT_NAME": pObjFoInsert.object_name,
                "PARAM_JSON": JSON.stringify(pObjFoInsert.param_json),
                "CREATED_BY": pObjFoInsert.user_id.toString(),
                "CREATED_DATE": reqDateFormatter.GetCurrentDate(pObjFoInsert.headers),
                "prct_id": prct_id
            };
            if (isLatestPlatformVersion) {
                reqInstanceHelper.PrintInfo(serviceName, 'Adding TENANT ID Filters - ' + pObjFoInsert.tenant_id, pObjLogInfo);
                schJobsTemplateData.TENANT_ID = pObjFoInsert.tenant_id;
            }
            reqFXDBInstance.InsertFXDB(mDevCas, 'SCH_JOB_TEMPLATES', [schJobsTemplateData], pObjLogInfo, function (pErr) {
                try {
                    if (pErr) {
                        CL('D', serviceName, 'Job Template Details Insert Failed...' + pErr.stack, pObjLogInfo);
                        insertIntoSchJobTemplatesCallback(pErr);
                    } else {
                        CL('S', serviceName, 'Successfully Inserted Job Template Details...', pObjLogInfo);
                        insertIntoSchJobTemplatesCallback(null);
                    }
                } catch (error) {
                    CL('D', serviceName, 'Catch Error in InsertFXDB()...' + error.stack, pObjLogInfo);
                    insertIntoSchJobTemplatesCallback(error);
                }
            });
        }
    } catch (ex) {
        resobj.STATUS = constants.FAILURE;
        resobj.MESSAGE = ex;
        res.send(resobj);
    }
});


/**
 * Create a template for scheduler
 * 
 * @param template_code - Unique ID 
 * @param object_name - API Url for which the execution to be done
 * @param calling_method - Defines the method type (GET/POST)
 * @param param_json - Contains the api request body 
 * @param job_type - Defines the type of job whether it as API/DB scripts
 * 
 * @return - JSON response regarding success/failure of creation
 */
function createSchedulerTemplate(APP_ID, ROUTING_KEY, TEMPLATE_NAME, TEMPLATE_DESCRIPTION, JOB_TYPE, CALLING_METHOD, OBJECT_NAME, PARAM_JSON, CREATED_BY, CREATED_DATE, callback) {
    try {

        if (cas_type === "dev_cas") {
            AQMHelper.AQMdesignersave(mDevCas, app_id, pCLIENT_ID, pAPP_NAME, 'scheduler', 'scheduler_job_templates', template_name, pUSER_ACTION, pU_NAME, pAPP_REQ_ID, pGROUP_CATEGORY, pSELECTQUERY, pDELETEQUERY, pWFTPA_ID, pCOMMENT, pGROUP_CODE, pHeaders, function () {
                mDevCas.execute(QUERY_INSERT_SCHEDULER_TEMPLATE, [APP_ID, ROUTING_KEY, TEMPLATE_NAME, TEMPLATE_DESCRIPTION, JOB_TYPE, CALLING_METHOD, OBJECT_NAME, PARAM_JSON, CREATED_BY, CREATED_DATE, prct_id], function (pErr, pResult) {
                    if (pErr) {
                        resobj.STATUS = constants.FAILURE;
                        resobj.MESSAGE = pErr.message;
                        callback();
                    } else {
                        resobj.STATUS = constants.SUCCESS;
                        resobj.MESSAGE = constants.SCHEDULER_TEMPLATE_CREATION_SUCCESS;
                        callback();
                    }
                });
            })
        }

    } catch (ex) {
        resobj.STATUS = constants.FAILURE;
        resobj.MESSAGE = ex;
        callback();
    }
}

/**
 * deletes a scheduler template
 * 
 * @param template_code - Unique ID for scheduler template
 * @return - JSON response regarding success/failure of deletion
 */
function deleteSchedulerTemplate(objLogInfo, TEMPLATE_NAME, app_id, callback) {
    try {
        var resobj = {};
        var parsed_query = vsprintf(QUERY_DELETE_SCHEDULER_TEMPLATE, [addSingleQuote(TEMPLATE_NAME), addSingleQuote(app_id)]);

        reqFXDBInstance.ExecuteQuery(mDevCas, parsed_query, objLogInfo, function (pErr, pResult) {
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

function saveToAQM() {

}

function addSingleQuote(data) {
    if (data !== null) {
        if (data.indexOf("'") > -1) {
            data = data.replaceAll("'", "''")
        }
        return "'" + data + "'";
    } else {
        return null;
    }
}

function dateString(date) {
    if (date !== null) {
        var myDate = new Date(date);
        hour = myDate.getHours();
        minute = myDate.getMinutes();
        second = myDate.getSeconds();
        //return "'" + myDate.getFullYear() + "-" + (myDate.getMonth() + 1) + "-" + myDate.getDate() + " " + hour + ":" + minute + ":" +second + "'";
        return "'" + reqDateFormatter.ConvertDate("'" + myDate + "'", pHeaders, true) + "'";
    } else {
        return null;
    }
}

module.exports = router;