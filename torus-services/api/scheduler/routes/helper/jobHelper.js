/*
 *   @Author : Ragavendran
 *   @Description : Helper file for job scheduler
 *   @status : In-Progress
 *   @created-Date : 19/10/2016
 *   @Last_Error_Code : ERR-JOBHELPER-0005
 */

var rootpath = "../../../../../";
var modPath = rootpath + 'node_modules/';
var reqExpress = require(modPath + 'express');
var router = reqExpress.Router();
var request = require('request');
var schedule = require(modPath + 'node-schedule');
var reqLinq = require('node-linq').LINQ;
var uuid = require(modPath + 'uuid');
var reqCasInstance = require(rootpath + 'torus-references/instance/CassandraInstance');
var reqLogWriter = require(rootpath + 'torus-references/log/trace/LogWriter');
var reqLogInfo = require('../../../../../torus-references/log/trace/LogInfo');
var reqAuditLog = require('../../../../../torus-references/log/audit/AuditLog');
var constants = require('../util/message');
var async = require('async');
var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');
var reqFXDBInstance = require('../../../../../torus-references/instance/DBInstance');
var reqRedisInstance = require('../../../../../torus-references/instance/RedisInstance');
var reqTranDBInstance = require('../../../../../torus-references/instance/TranDBInstance');
var vsprintf = require(modPath + 'sprintf').vsprintf;
var reqDateFormatter = require('../../../../../torus-references/common/dateconverter/DateFormatter');
var reqSolrInstance = require('../../../../../torus-references/instance/SolrInstance');
var schedulerUtil = require('../util/schedulerUtil');
var headers = "";
var ServiceName = 'jobHelper';

/**
 * Create a job 
 * 
 * @param mResCas - cassandra instance
 * @param query - query for execution
 * @param job_code - unique ID
 * @param object_name - API Url for which the execution to be done
 * @param calling_method - Defines the method type (GET/POST)
 * @param param_json - Contains the api request body (type : JSON String)
 * @param job_type - Defines the type of job whether it as API/DB scripts
 * @param job_mode - Defines the mode of job(Predefined/runtime)
 * @param status - Defines the status of job(created/started/stopped/aborted)
 * @param scheduler_info - Defines the info about scheduler(Start time,frequency , stop time) - type : JSON String
 * 
 * @return - JSON response regarding success/failure of job creation
 */



var serviceModel = reqFXDBInstance.DBInstanceSession['SERVICE_MODEL'];
var isLatestPlatformVersion = false;
var serviceName = 'JOBHELPER';

function createJob(mResCas, QUERY, objLogInfo, APP_ID, ROUTING_KEY, JOB_NAME, JOB_DESCRIPTION, TEMPLATE_NAME, JOB_TYPE, CALLING_METHOD, JOB_MODE, OBJECT_NAME, PARAM_JSON, SCHEDULER_INFO, STATUS, CREATED_BY, CREATED_DATE, JOB_RULE, prct_id, created_by_name, callback) {
    try {
        var resdata = {};
        headers = objLogInfo["headers"] || "";
        serviceModel = reqFXDBInstance.DBInstanceSession['SERVICE_MODEL'];
        if (serviceModel && serviceModel.PLATFORM_VERSION == '7.0') {
            reqInstanceHelper.PrintInfo(serviceName, 'Patform Version - ' + serviceModel.PLATFORM_VERSION, null);
            isLatestPlatformVersion = true;
        }
        var job_notification = DeleteKeyFromLogInfo(objLogInfo, 'job_notification');
        var tenant_id = DeleteKeyFromLogInfo(objLogInfo, 'tenant_id');
        var template_description = DeleteKeyFromLogInfo(objLogInfo, 'template_description');
        var job_created_mode = DeleteKeyFromLogInfo(objLogInfo, 'job_created_mode');
        var job_created = JSON.parse(PARAM_JSON).job_created_option;
        var schjobsInsertData = {
            "APP_ID": APP_ID,
            "ROUTING_KEY": ROUTING_KEY,
            "JOB_NAME": JOB_NAME,
            "JOB_DESCRIPTION": JOB_DESCRIPTION,
            "TEMPLATE_NAME": TEMPLATE_NAME,
            "JOB_TYPE": JOB_TYPE,
            "CALLING_METHOD": CALLING_METHOD,
            "JOB_MODE": JOB_MODE,
            "OBJECT_NAME": OBJECT_NAME,
            "PARAM_JSON": PARAM_JSON,
            "SCHEDULER_INFO": SCHEDULER_INFO,
            "JOB_CREATED_MODE": job_created_mode || job_created,
            "STATUS": STATUS,
            "CREATED_BY": CREATED_BY,
            "CREATED_DATE": reqDateFormatter.ConvertDate("'" + CREATED_DATE + "'", headers),
            "RULE_INFO": JOB_RULE,
            "JOB_NOTIFICATION": job_notification,
            "TEMPLATE_DESCRIPTION": template_description,
            "prct_id": prct_id,
            "CREATED_BY_NAME": created_by_name

        };
        if (isLatestPlatformVersion) {
            reqInstanceHelper.PrintInfo(serviceName, 'Adding TENANT ID Filters - ' + tenant_id, objLogInfo);
            schjobsInsertData.TENANT_ID = tenant_id;
        }
        var paramsoption;
        if (schjobsInsertData.PARAM_JSON) {
            paramsoption = JSON.parse(schjobsInsertData.PARAM_JSON)
        }
        if (paramsoption.job_created_option || paramsoption.job_created_option == null) {
            delete paramsoption.job_created_option;
        }
        schjobsInsertData.PARAM_JSON = JSON.stringify(paramsoption);
        reqFXDBInstance.InsertFXDB(mResCas, 'SCH_JOBS', [schjobsInsertData], objLogInfo, function (pErr) {
            try {
                if (pErr) {
                    resdata.STATUS = constants.FAILURE;
                    resdata.MESSAGE = pErr.message;
                    CL("D", ServiceName, "Job creation failed for " + JOB_NAME + " due to " + pErr.message);
                    callback(resdata);
                } else {
                    resdata.STATUS = constants.SUCCESS;
                    resdata.MESSAGE = constants.SCHEDULER_JOB_CREATION_SUCCESS;
                    resdata.JOBNAME = JOB_NAME;
                    CL("S", ServiceName, "Job creation success for " + JOB_NAME);
                    callback(resdata);
                }
            } catch (error) {
                resdata.STATUS = constants.FAILURE;
                resdata.MESSAGE = error;
                CL("D", ServiceName, "Exception while creating job callback " + JOB_NAME + " due to " + error.message);
                callback(resdata);
            }
        });
    } catch (ex) {
        CL("D", ServiceName, "Exception while creating job " + JOB_NAME + " due to " + ex.message);
        resdata.STATUS = constants.FAILURE;
        resdata.MESSAGE = ex;
        callback(resdata);
    }
}

// To Delete Key From ObjLog Info
function DeleteKeyFromLogInfo(logInfo, keyName) {
    var data = '';
    if (logInfo) {
        if (logInfo[keyName]) {
            data = logInfo[keyName];
            delete logInfo[keyName];
        }
    }
    return data;
}

// To create a new job
function createJobNew(mResCas, QUERY, objLogInfo, APP_ID, ROUTING_KEY, JOB_NAME, JOB_DESCRIPTION, TEMPLATE_NAME, JOB_TYPE, CALLING_METHOD, JOB_MODE, OBJECT_NAME, PARAM_JSON, SCHEDULER_INFO, STATUS, CREATED_BY, CREATED_DATE, JOB_RULE, prct_id, callback) {
    var resdata = {};
    headers = objLogInfo["headers"] || "";
    try {
        reqFXDBInstance.InsertFXDB(mResCas, 'SCH_JOBS', [{
            "APP_ID": APP_ID,
            "ROUTING_KEY": ROUTING_KEY,
            "JOB_NAME": JOB_NAME,
            "JOB_DESCRIPTION": JOB_DESCRIPTION,
            "TEMPLATE_NAME": TEMPLATE_NAME,
            "JOB_TYPE": JOB_TYPE,
            "CALLING_METHOD": CALLING_METHOD,
            "JOB_MODE": JOB_MODE,
            "OBJECT_NAME": OBJECT_NAME,
            "PARAM_JSON": PARAM_JSON,
            "SCHEDULER_INFO": SCHEDULER_INFO,
            "STATUS": STATUS,
            "CREATED_BY": CREATED_BY,
            "CREATED_DATE": reqDateFormatter.ConvertDate("'" + CREATED_DATE + "'", headers),
            "RULE_INFO": JOB_RULE,
            "prct_id": prct_id
        }], objLogInfo, function (pErr) {
            try {
                CL("D", ServiceName, "Query : " + objLogInfo.MESSAGE, objLogInfo);
                if (pErr) {
                    resdata.STATUS = constants.FAILURE;
                    resdata.MESSAGE = pErr.message;
                    CL("D", ServiceName, "Job creation failed for " + JOB_NAME + " due to " + pErr.message);
                    callback(resdata);
                } else {
                    resdata.STATUS = constants.SUCCESS;
                    resdata.MESSAGE = constants.SCHEDULER_JOB_CREATION_SUCCESS;
                    resdata.JOBNAME = JOB_NAME;
                    CL("S", ServiceName, "Job creation success for " + JOB_NAME);
                    callback(resdata);
                }
            } catch (error) {
                resdata.STATUS = constants.FAILURE;
                resdata.MESSAGE = ex;
                CL("D", ServiceName, "Exception while creating job callback " + JOB_NAME + " due to " + error.message);
                callback(resdata);
            }
        });
    } catch (ex) {
        resdata.STATUS = constants.FAILURE;
        resdata.MESSAGE = ex;
        CL("D", ServiceName, "Exception while creating job " + JOB_NAME + " due to " + ex.message);
        callback(resdata);
    }
}

// To create sch template
function createScheduleTemplate(mDevCas, QUERY, objLogInfo, app_id, schtempl_name, routing_key, schtempl_description, schtempl_scheduler_info, user_id, created_date, callback) {
    var resdata = {};
    headers = objLogInfo["headers"] || "";
    try {
        var parsed_query = vsprintf(QUERY, [addSingleQuote(app_id), addSingleQuote(schtempl_name), addSingleQuote(routing_key), addSingleQuote(schtempl_description), addSingleQuote(schtempl_scheduler_info), addSingleQuote(user_id), dateString(created_date)]);
        CL('I', ServiceName, "Query : " + parsed_query, objLogInfo);
        reqFXDBInstance.ExecuteQuery(mDevCas, parsed_query, objLogInfo, function (pErr, pResult) {
            try {
                if (pErr) {
                    resdata.STATUS = constants.FAILURE;
                    resdata.MESSAGE = pErr.message;
                    CL("D", ServiceName, "Schedule template creation failed for " + schtempl_name + " due to " + pErr.message);
                    callback(resdata);
                } else {
                    resdata.STATUS = constants.SUCCESS;
                    resdata.MESSAGE = constants.SCHEDULE_TEMPLATE_CREATION_SUCCESS;
                    resdata.SCHEDULETEMPLATENAME = schtempl_name;
                    CL("S", ServiceName, "Schedule template creation success for " + schtempl_name);
                    callback(resdata);
                }
            } catch (error) {
                resdata.STATUS = constants.FAILURE;
                resdata.MESSAGE = ex;
                CL("D", ServiceName, "Exception while creating schedule template callback " + schtempl_name + " due to " + error.message);
                callback(resdata);
            }
        });
    } catch (ex) {
        resdata.STATUS = constants.FAILURE;
        resdata.MESSAGE = ex;
        CL("D", ServiceName, "Exception while creating schedule template " + schtempl_name + " due to " + ex.message);
        callback(resdata);
    }
}



/**
 * Create a job log
 * 
 * @param mResCas - cassandra instance
 * @param query - query for execution
 * @param job_code - Unique ID for job table
 * 
 * @return - JSON response regarding success/failure of job deletion
 */

// TO delete a job
function deleteJob(mResCas, query, objLogInfo, job_code, app_id, callback) {
    var resdata = {};
    headers = objLogInfo["headers"] || "";
    try {
        var parsed_query = vsprintf(query, [addSingleQuote(job_code), addSingleQuote(app_id)]);
        CL('I', ServiceName, "Query : " + parsed_query, objLogInfo);
        reqFXDBInstance.ExecuteQuery(mResCas, parsed_query, objLogInfo, function (pErr, pResult) {
            try {
                if (pErr) {
                    resdata.STATUS = constants.FAILURE;
                    resdata.MESSAGE = pErr.message;
                    CL("D", ServiceName, "Job deletion failed for job " + job_code + " due to " + pErr.message);
                    callback(resdata);
                } else {
                    resdata.STATUS = constants.SUCCESS;
                    resdata.MESSAGE = constants.SCHEDULER_JOB_DELETION_SUCCESS;
                    CL("S", ServiceName, "Job deletion success for job " + job_code);
                    CL("S", ServiceName, "Del Query " + parsed_query);
                    callback(resdata);
                }
            } catch (error) {
                resdata.STATUS = constants.FAILURE;
                resdata.MESSAGE = ex;
                CL("D", ServiceName, "Exception while deleting job  callback " + job_code + " due to " + error.message);
                callback(resdata);
            }
        });
    } catch (ex) {
        resdata.STATUS = constants.FAILURE;
        resdata.MESSAGE = ex;
        CL("D", ServiceName, "Exception while deleting job " + job_code + " due to " + ex.message);
        callback(resdata);
    }
}

// TO delete sch template
function deleteScheduleTemplate(mResCas, query, objLogInfo, job_code, app_id, callback) {
    var resdata = {};
    headers = objLogInfo["headers"] || "";
    try {
        var parsed_query = vsprintf(query, [addSingleQuote(job_code), addSingleQuote(app_id)]);
        CL('I', ServiceName, "Query : " + parsed_query, objLogInfo);
        reqFXDBInstance.ExecuteQuery(mResCas, parsed_query, objLogInfo, function (pErr, pResult) {
            try {
                if (pErr) {
                    resdata.STATUS = constants.FAILURE;
                    resdata.MESSAGE = pErr.message;
                    CL("D", ServiceName, "Template deletion failed for template " + job_code + " due to " + pErr.message);
                    callback(resdata);
                } else {
                    resdata.STATUS = constants.SUCCESS;
                    resdata.MESSAGE = constants.SCHEDULER_SCHEDULE_TEMPLATE_DELETION_SUCCESS;
                    CL("S", ServiceName, "Template deletion success for template " + job_code);
                    callback(resdata);
                }
            } catch (error) {
                resdata.STATUS = constants.FAILURE;
                resdata.MESSAGE = ex;
                CL("D", ServiceName, "Exception while deleting template callback" + job_code + " due to " + error.message);
                callback(resdata);
            }
        });
    } catch (ex) {
        resdata.STATUS = constants.FAILURE;
        resdata.MESSAGE = ex;
        CL("D", ServiceName, "Exception while deleting template " + job_code + " due to " + ex.message);
        callback(resdata);
    }
}



/**
 * Add job log
 * 
 * @param mResCas - cassandra instance
 * @param query - query for execution
 * @param schjl_id - unique ID
 * @param job_code - Unique ID for job table
 * @param status - Defines the status of job(created/started/stopped/aborted)
 * @param start_time - start time of the process
 * @param end_time - end timeof the process
 * @param error_msg - error message if any(in case of aborted)
 * 
 * @return - JSON response regarding success/failure of job log insertion
 */


function addJobsLog(mResCas, query, objLogInfo, schjl_id, job_code, status, start_time, end_time, error_msg, callback) {
    var resdata = {};
    headers = objLogInfo["headers"] || "";
    try {
        var parsed_query = vsprintf(query, [schjl_id, addSingleQuote(job_code), status, start_time, end_time, error_msg]);
        CL('I', ServiceName, "Query : " + parsed_query, objLogInfo);
        // solr insert
        reqFXDBInstance.ExecuteQuery(mResCas, parsed_query, objLogInfo, function (pErr, pResult) {
            try {
                if (pErr) {
                    resdata.STATUS = constants.FAILURE;
                    resdata.MESSAGE = pErr.message;
                    CL("D", ServiceName, "Job logging error for job " + job_code + " due to " + pErr.message);
                    callback(resdata);
                } else {
                    resdata.STATUS = constants.SUCCESS;
                    resdata.MESSAGE = constants.SCHEDULER_JOB_LOG_ADD_SUCCESS;
                    CL("S", ServiceName, "Job logging success for job " + job_code);
                    callback(resdata);
                }
            } catch (error) {
                resdata.STATUS = constants.FAILURE;
                resdata.MESSAGE = ex;
                CL("D", ServiceName, "Job logging exception for job callback  " + job_code + " due to " + error.message);
                callback(resdata);
            }

        });
    } catch (ex) {
        resdata.STATUS = constants.FAILURE;
        resdata.MESSAGE = ex;
        CL("D", ServiceName, "Job logging exception for job " + job_code + " due to " + ex.message);
        callback(resdata);
    }
}

/**
 * Update job log
 * 
 * @param mResCas - cassandra instance
 * @param query - query for execution
 * @param schjl_id - unique ID
 * @param job_code - Unique ID for job table
 * @param status - Defines the status of job(created/started/stopped/aborted)
 * @param start_time - start time of the process
 * @param end_time - end timeof the process
 * @param error_msg - error message if any(in case of aborted)
 * 
 * @return - JSON response regarding success/failure of job log insertion
 */


function updateJobsLog(mResCas, query, objLogInfo, status, start_time, end_time, error_msg, job_name, job_description, app_id, routing_key, callback, job_inc_id, jobthreadId) {
    try {
        var serviceModel = reqFXDBInstance.DBInstanceSession['SERVICE_MODEL'];
        var resdata = {};
        var objsolrtdata = {};
        var tenant_id = objLogInfo.TENANT_ID;
        headers = objLogInfo["headers"] || "";
        // To check whether any value is null if no then push those value and pass it for query param
        if (query.startsWith("update")) {
            if (serviceModel.AUDIT_ARCHIVAL_MODEL == 'SOLR' && job_inc_id) {
                CL("I", ServiceName, "Prepare job log table update query for job - " + job_description + ' ' + job_name, objLogInfo);

                objsolrtdata.END_TIME = {
                    "set": reqDateFormatter.ConvertDate(end_time, headers, null, 'YYYY-MM-DD HH:mm:ss.SSSS')
                };
                objsolrtdata.END_TIME_UTC = {
                    "set": end_time.toISOString()
                };
                objsolrtdata.STATUS = {
                    "set": status
                };
                objsolrtdata.ERROR_MSG = {
                    "set": error_msg
                };
                objsolrtdata.APP_ID = app_id;
                if (tenant_id) {
                    objsolrtdata.TENANT_ID = tenant_id;
                }
                objsolrtdata.JOB_NAME = job_name;
                objsolrtdata.JOB_INSTANCE_ID = job_inc_id;
                objsolrtdata.id = job_inc_id;
                if (serviceModel.AUDIT_ARCHIVAL_MODEL == 'SOLR') {
                    solrjoblogupdate();
                }
            } else {
                var strSearchCond = strSearchCond = 'JOB_NAME:"' + job_name + '" AND APP_ID:"' + app_id + '" AND STATUS:"Started"';
                if (serviceModel.AUDIT_ARCHIVAL_MODEL == 'SOLR') {
                    GetIdfromsolr(strSearchCond, 'SCH_JOBS_LOG', function (res) {
                        try {
                            objsolrtdata.END_TIME = {
                                "set": reqDateFormatter.ConvertDate(end_time, headers, null, 'YYYY-MM-DD HH:mm:ss.SSSS')
                            };
                            objsolrtdata.STATUS = {
                                "set": status
                            };
                            objsolrtdata.ERROR_MSG = {
                                "set": error_msg
                            };
                            objsolrtdata.APP_ID = app_id;
                            if (tenant_id) {
                                objsolrtdata.TENANT_ID = tenant_id;
                            }
                            objsolrtdata.JOB_NAME = job_name;
                            objsolrtdata.JOB_INSTANCE_ID = res.data[(res.data.length - 1)].id;
                            objsolrtdata.id = res.data[(res.data.length - 1)].id; //always taking last record which is the latest too
                            // objsolrtdata.JOB_INSTANCE_ID = res.data[0].id;
                            // objsolrtdata.id = res.data[0].id;
                            solrjoblogupdate();
                        } catch (error) {

                        }
                    });
                } else {
                    // DB Update 
                    var update = {
                        "status": status,
                        "end_time": end_time
                    };

                    var whereCond = {
                        "job_name": job_name,
                        "thread_id": jobthreadId
                    };
                    reqFXDBInstance.GetFXDBConnection(headers, 'log_cas', objLogInfo, function (pCltClient) {
                        reqFXDBInstance.UpdateFXDB(pCltClient, "SCH_JOBS_LOG", update, whereCond, objLogInfo, function (pError, pResult) {
                            if (pError) {
                                // reqInstanceHelper.SendResponse(ServiceName, '', objLogInfo, pError, 'FAILURE');
                                callback(pError)
                            }
                            else {
                                // reqInstanceHelper.SendResponse(ServiceName, "SUCCESS", objLogInfo, pResult, '', '', '', 'SUCCESS');
                                callback(pResult)
                            }
                        })
                    })
                }

            }
        } else {
            // insert the value into solr for job log
            CL("I", ServiceName, "Prepare job log table Insert query for job - " + job_description, objLogInfo);
            var objsolrtdata = {};
            objsolrtdata.START_TIME_UTC = start_time.toISOString();
            objsolrtdata.START_TIME = reqDateFormatter.ConvertDate(start_time, headers, null, 'YYYY-MM-DD HH:mm:ss.SSSS');
            // objsolrtdata.END_TIME = end_time ? end_time : '';
            objsolrtdata.STATUS = {
                "set": status
            };
            objsolrtdata.ERROR_MSG = error_msg;
            objsolrtdata.APP_ID = app_id;
            if (tenant_id) {
                objsolrtdata.TENANT_ID = tenant_id;
            }
            objsolrtdata.ROUTING_KEY = routing_key;
            objsolrtdata.JOB_DESCRIPTION = job_description;
            objsolrtdata.JOB_NAME = job_name;
            objsolrtdata.JOB_INSTANCE_ID = job_inc_id ? job_inc_id : '';
            objsolrtdata.id = job_inc_id;
            if (serviceModel.AUDIT_ARCHIVAL_MODEL == 'SOLR') {
                solrjoblogupdate();
            }
            else {
                // Insert DB
                var schinsert = {};
                schinsert.job_name = job_name;
                schinsert.APP_ID = app_id;
                schinsert.job_description = job_description
                //   schinsert.schjtl_id = job_inc_id;
                //   schinsert.CREATED_DATE = CREATED_DATE;
                //   schinsert.CREATED_BY = CREATED_BY || '1';
                schinsert.end_time = end_time;
                schinsert.error_msg = error_msg;
                //   schinsert.RESPONSE = result;
                //   schinsert.routing_key = objLogInfo.ROUTINGKEY;
                schinsert.start_time = start_time;
                schinsert.status = status;
                schinsert.created_date = reqDateFormatter.GetTenantCurrentDateTime(headers, objLogInfo)
                schinsert.thread_id = job_inc_id;
                //   _PrintInfo(objLogInfo, " Scheduler SCH_JOBS_LOG insert started");
                reqFXDBInstance.GetFXDBConnection(headers, 'log_cas', objLogInfo, function CallbackGetCassandraConn(pCltClient) {
                    reqFXDBInstance.InsertFXDB(pCltClient, "SCH_JOBS_LOG", [schinsert], objLogInfo, function (error, result) {
                        if (error) {
                            // reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, error, 'FAILURE');
                            callback(error)
                        }
                        else {
                            //reqInstanceHelper.SendResponse(ServiceName, appResponse, "SUCCESS", objLogInfo, result, '', '', '', 'SUCCESS');
                            callback(result)
                        }
                    })
                })


            }
        }

        // Solr Insert SCH_JOBS_LOG core
        function solrjoblogupdate() {
            try {
                CL("I", ServiceName, "solr insert started - SCH_JOBS_LOG " + JSON.stringify(objsolrtdata), objLogInfo);
                reqSolrInstance.SolrUpdate(headers, 'SCH_JOBS_LOG', objsolrtdata, objLogInfo, function (res) {
                    try {
                        CL("I", ServiceName, "SCH_JOBS_LOG solr insert success for job - " + job_description, objLogInfo);
                        callback(res);
                    } catch (error) {
                        CL("D", ServiceName, "Exception occured while insert the data into solr", objLogInfo);
                        callback(res);
                    }
                });
            } catch (error) {

            }
        }

    } catch (ex) {
        resdata.STATUS = constants.FAILURE;
        resdata.MESSAGE = ex;
        CL("D", ServiceName, "Job logging exception for job " + job_name + " due to " + ex.message, objLogInfo);
        callback(resdata);
    }
}


/**
 * Delete job log
 * 
 * @param mResCas - cassandra instance
 * @param query - query for execution
 * @param job_code - job code table id
 */

function deleteJobsLog(mResCas, query, objLogInfo, job_code, callback) {
    var resdata = {};
    headers = objLogInfo["headers"] || "";
    try {
        var parsed_query = vsprintf(query, [addSingleQuote(job_code)]);
        CL('I', ServiceName, "Query : " + parsed_query, objLogInfo);
        reqFXDBInstance.ExecuteQuery(mResCas, parsed_query, objLogInfo, function (pErr, pResult) {
            try {
                if (pErr) {
                    resdata.STATUS = constants.FAILURE;
                    resdata.MESSAGE = pErr.message;
                    CL("D", ServiceName, "Job log deletion error");
                    callback(resdata);
                } else {
                    resdata.STATUS = constants.SUCCESS;
                    resdata.MESSAGE = constants.SCHEDULER_JOB_LOG_DELETION_SUCCESS;
                    CL("S", ServiceName, "Job log deletion success");
                    callback(resdata);
                }
            } catch (error) {
                resdata.STATUS = constants.FAILURE;
                resdata.MESSAGE = ex;
                CL("D", ServiceName, "Job log deletion exception callback " + error.message);
                callback(resdata);
            }
        });
    } catch (ex) {
        resdata.STATUS = constants.FAILURE;
        resdata.MESSAGE = ex;
        CL("D", ServiceName, "Job log deletion exception " + ex.message);
        callback(resdata);
    }
}



/**
 * Add thread log
 * @param mResCas - cassandra instance
 * @param query - query for execution
 * @param schjtl_id - unique ID
 * @param job_code - unique id of job table
 * @param thread_id - thread id of a job
 * @param status - thread status(started,stopped,aborted)
 * @param start_time - start time of thread
 * @param end_time - end time of thread
 * @param error_msg - error message if any(aborted error message)
 */
function addThreadLog(mResCas, query, objLogInfo, schjtl_id, job_code, thread_id, status, start_time, end_time, error_msg, result, callback) {
    var resdata = {};
    headers = objLogInfo["headers"] || "";
    try {
        var parsed_query = vsprintf(query, [addSingleQuote(schjtl_id), addSingleQuote(job_code), addSingleQuote(thread_id), addSingleQuote(status), dateString(start_time), dateString(end_time), addSingleQuote(error_msg), addSingleQuote(thread_id), addSingleQuote(result)]);
        CL('I', ServiceName, "Query : " + parsed_query, objLogInfo);
        //solr insert
        reqFXDBInstance.ExecuteQuery(mResCas, parsed_query, objLogInfo, function (pErr, pResult) {
            if (pErr) {
                resdata.STATUS = constants.FAILURE;
                resdata.MESSAGE = pErr.message;
                CL("D", ServiceName, "Thread logging error for job " + job_code + " due to " + pErr.message);
                callback(resdata);
            } else {
                resdata.STATUS = constants.SUCCESS;
                resdata.MESSAGE = constants.SCHEDULER_JOB_THREAD_LOG_ADD_SUCCESS;
                CL("S", ServiceName, "Thread logging success for job " + job_code);
                callback(resdata);
            }
        });
    } catch (ex) {
        resdata.STATUS = constants.FAILURE;
        resdata.MESSAGE = ex;
        CL("D", ServiceName, "Job log deletion error for job " + job_code + " due to " + ex.message);
        callback(resdata);
    }
}



/**
 * Add thread log
 * @param mResCas - cassandra instance
 * @param query - query for execution
 * @param schjtl_id - unique ID
 * @param job_code - unique id of job table
 * @param thread_id - thread id of a job
 * @param status - thread status(started,stopped,aborted)
 * @param start_time - start time of thread
 * @param end_time - end time of thread
 * @param error_msg - error message if any(aborted error message)
 */
var arrObjUpdateFailedThread = []; // To Store the Solr Update Failed Data and Trying to update continuously, If updated then the record will be removed from the array...
function addThreadLogVariableParameter(mResCas, query, objLogInfo, jobthreadid, job_code, thread_id, status, start_time, end_time, error_msg, APP_ID, ROUTING_KEY, result, threadRow, apiResponse, callback) {
    try {
        var serviceModel = reqFXDBInstance.DBInstanceSession['SERVICE_MODEL'];
        if (objLogInfo && objLogInfo.doDBOperations) {
            var resdata = {};
            var insert = false;
            var tenant_id = objLogInfo.TENANT_ID;
            headers = objLogInfo["headers"] || "";
            var objsolrtdata = {};
            // To check whether any value is null if no then push those value and pass it for query param
            if (query.startsWith("update")) {
                CL("I", ServiceName, 'Update Thread log for job - ' + job_code, objLogInfo);
                var strSearchCond = '';

                if (objLogInfo.isThreadResult) {
                    CL("I", ServiceName, 'Thread Result Status Update for job - ' + job_code, objLogInfo);
                    strSearchCond = 'THREAD_ID: "' + thread_id + '" AND JOB_NAME:"' + job_code + '" AND APP_ID:"' + APP_ID + '" AND TENANT_ID:"' + tenant_id + '" AND START_TIME: "' + reqDateFormatter.ConvertDate(start_time, headers, null, 'YYYY-MM-DD HH:mm:ss.SSSS') + '"';
                } else if (thread_id) {
                    CL("I", ServiceName, 'Thread_id available for job - ' + job_code, objLogInfo);
                    strSearchCond = 'THREAD_ID: "' + thread_id + '" AND JOB_NAME:"' + job_code + '" AND APP_ID:"' + APP_ID + '" AND TENANT_ID:"' + tenant_id + '" AND STATUS:"Started"' + ' AND START_TIME: "' + reqDateFormatter.ConvertDate(start_time, headers, null, 'YYYY-MM-DD HH:mm:ss.SSSS') + '"';
                } else {
                    CL("I", ServiceName, 'Thread_id not available going to stop all thread in Started status threads.' + job_code, objLogInfo);
                    strSearchCond = 'JOB_NAME:"' + job_code + '" AND APP_ID:"' + APP_ID + '" AND TENANT_ID:"' + tenant_id + '" AND STATUS:"Started"';
                }
                CL("S", ServiceName, '==============================Solr Query for update - =================================' + strSearchCond, objLogInfo);
                if (serviceModel.AUDIT_ARCHIVAL_MODEL == 'SOLR') {
                    setTimeout(() => {

                        GetIdfromsolr(strSearchCond, 'SCH_JOBS_THREAD_LOG', function (solrRes) {
                            try {
                                var objSolrDataForUpdate = {
                                    status,
                                    error_msg,
                                    result,
                                    strSearchCond,
                                    end_time,
                                    start_time
                                };
                                prepareDataForUpdate(arrObjUpdateFailedThread, objLogInfo, function (result) { });
                                if (solrRes.status == 'No Data Found') {
                                    if (thread_id) {
                                        arrObjUpdateFailedThread.push(objSolrDataForUpdate);
                                    }
                                    return CL("D", ServiceName, 'Solr Data Not Found For this Search Condition - ' + strSearchCond, objLogInfo);
                                } else {
                                    CL("S", ServiceName, 'solrRes.data.length - ' + solrRes.data.length, objLogInfo);
                                    threadStatusUpdate(objSolrDataForUpdate, solrRes.data, objLogInfo, callback);
                                }
                            } catch (error) {
                                CL("D", ServiceName, "Error while executing GetIdfromsolr thread log from solr  " + error.message);
                                callback(resdata);
                            }
                        });
                    }, 21000);
                } else {
                    //callback();
                    // DB Update 
                    if (threadRow) {
                        var update = {
                            "status": status,
                            "end_time": end_time
                        };

                        if (apiResponse) {
                            update.response = apiResponse
                        }
                        if (error_msg) {
                            update.error_msg = error_msg
                        }
                        var whereCond = {
                            'schjtl_id': threadRow[0].schjtl_id
                        };
                        reqFXDBInstance.GetFXDBConnection(headers, 'log_cas', objLogInfo, function (pCltClient) {
                            // var UpdateQuery = `update SCH_JOBS_THREAD_LOG set status=${status},end_time=${end_time},error_msg=${error_msg} where schjtl_id=${threadRow[0].schjtl_id}`
                            // var UpdateQuery = `update SCH_JOBS_THREAD_LOG set status='BREAK_TEST',end_time=${end_time},error_msg='test' where schjtl_id=${threadRow[0].schjtl_id}`
                            reqFXDBInstance.UpdateFXDB(pCltClient, "SCH_JOBS_THREAD_LOG", update, whereCond, objLogInfo, function (pError, pResult) {
                                // reqFXDBInstance.ExecuteQuery(pCltClient, UpdateQuery, objLogInfo, function (pError, pResult) {
                                if (pError) {
                                    // reqInstanceHelper.SendResponse(ServiceName, '', objLogInfo, pError, 'FAILURE');
                                    callback(pError)
                                }
                                else {
                                    // reqInstanceHelper.SendResponse(ServiceName, "SUCCESS", objLogInfo, pResult, '', '', '', 'SUCCESS');
                                    callback(pResult)
                                }
                            })
                        })
                    } else {
                        callback()
                    }

                }
            } else {
                insert = true;
                var objsolrtdata = {};
                objsolrtdata.STATUS = status;
                objsolrtdata.START_TIME_UTC = start_time.toISOString();
                objsolrtdata.START_TIME = reqDateFormatter.ConvertDate(start_time, headers, null, 'YYYY-MM-DD HH:mm:ss.SSSS');
                // objsolrtdata.END_TIME = end_time ? end_time : '';
                objsolrtdata.ERROR_MSG = error_msg;
                objsolrtdata.ROUTING_KEY = ROUTING_KEY;
                objsolrtdata.RESPONSE = result;
                objsolrtdata.SCHJTL_ID = jobthreadid;
                objsolrtdata.JOB_NAME = job_code;
                objsolrtdata.APP_ID = APP_ID;
                if (tenant_id) {
                    objsolrtdata.TENANT_ID = tenant_id;
                }
                objsolrtdata.THREAD_ID = thread_id;
                objsolrtdata.JOB_INSTANCE_ID = jobthreadid;
                if (serviceModel.AUDIT_ARCHIVAL_MODEL == 'SOLR') {
                    solrinsertupdate();
                } else {
                    // Insert into db
                    var schinsert = {};
                    schinsert.job_name = job_code;
                    schinsert.APP_ID = APP_ID;
                    schinsert.schjtl_id = uuid.v4();
                    schinsert.start_time = start_time;
                    //  schinsert.CREATED_DATE = CREATED_DATE;
                    //  schinsert.CREATED_BY = CREATED_BY;
                    //  schinsert.end_time = end_time;
                    schinsert.error_msg = error_msg;
                    schinsert.RESPONSE = result;
                    //  schinsert.routing_key = objLogInfo.ROUTINGKEY;
                    //  schinsert.start_time = start_time;
                    schinsert.status = status;
                    schinsert.thread_id = jobthreadid
                    reqFXDBInstance.GetFXDBConnection(headers, 'log_cas', objLogInfo, function CallbackGetCassandraConn(pCltClient) {
                        reqFXDBInstance.InsertFXDB(pCltClient, "SCH_JOBS_THREAD_LOG", [schinsert], objLogInfo, function (error, result) {
                            if (error) {
                                // reqInstanceHelper.SendResponse(ServiceName, '', objLogInfo, error, 'FAILURE');
                                callback()
                            }
                            else {
                                // reqInstanceHelper.SendResponse(ServiceName, "SUCCESS", objLogInfo, result, '', '', '', 'SUCCESS');
                                callback(result)
                            }
                        })
                    })
                }
            }

            function solrinsertupdate() {
                try {
                    CL('I', ServiceName, 'solr insert started SCH_JOBS_THREAD_LOG  - ' + JSON.stringify(objsolrtdata), objLogInfo);
                    // Solr insert/update SCH_JOBS_THREAD_LOG core 
                    reqSolrInstance.SolrUpdate(headers, "SCH_JOBS_THREAD_LOG", objsolrtdata, objLogInfo, function (res) {
                        CL('S', ServiceName, 'solr insert success SCH_JOBS_THREAD_LOG  - ' + JSON.stringify(objsolrtdata), objLogInfo);
                        try {
                            var fxn_row = {};
                            fxn_row.date_time = new Date();
                            fxn_row.user_id = '1';
                            fxn_row.type = 'SCHEDULER';
                            fxn_row.message = result;
                            fxn_row.is_reviewed = 'N';
                            fxn_row.status = 'TO_READ';
                            fxn_row.fxn_id = 'uuid.v4()';
                            if (insert) {
                                reqFXDBInstance.InsertFXDB(mResCas, 'FX_NOTIFICATIONS', [fxn_row], objLogInfo, function (error, result) {
                                    if (error) {
                                        CL('D', ServiceName, 'FX_NOTIFICATIONS error : ' + error.stack, objLogInfo);
                                    } else {
                                        CL('S', ServiceName, 'Notification insert Success', objLogInfo);
                                    }
                                }, ['', '', '', '', '', '', 'UUID']);
                            }
                            CL("S", ServiceName, "Thread logging success for job " + job_code);
                            callback(resdata);
                        } catch (error) {
                            CL("D", ServiceName, "Exception occured while insert the data into thread log core, due to " + error);
                        }
                    });
                } catch (error) {
                    resdata.STATUS = constants.FAILURE;
                    resdata.MESSAGE = error;
                    CL("D", ServiceName, "Job log deletion error for job " + job_code + " due to " + error.message);
                    callback(resdata);
                }
            }
        } else {
            callback();
        }
    } catch (ex) {
        resdata.STATUS = constants.FAILURE;
        resdata.MESSAGE = ex;
        CL("D", ServiceName, "Job log deletion error for job " + job_code + " due to " + ex.message);
        callback(resdata);
    }
}

// Retring Solr Update if Failed to Update 
function prepareDataForUpdate(pArrObjSolrDataForUpdate, pObjLogInfo, prepareDataForUpdateCB) {
    try {
        CL("S", ServiceName, 'Solr Data For Update in Background Process Count - ' + pArrObjSolrDataForUpdate.length, pObjLogInfo);
        // CL("S", ServiceName, 'Solr Data for Update - ' + JSON.stringify(pArrObjSolrDataForUpdate), pObjLogInfo);
        if (!pArrObjSolrDataForUpdate.length) {
            return prepareDataForUpdateCB();
        }
        var arrSuccessSolrUpdate = [];
        async.forEachOfSeries(pArrObjSolrDataForUpdate, function (solrObjForUpdate, key, asynccallback) {
            try {
                if (!solrObjForUpdate || !solrObjForUpdate.strSearchCond) {
                    CL("D", ServiceName, 'Search Condition is Empty...');
                    asynccallback();
                    // return prepareDataForUpdateCB();
                }
                CL("S", ServiceName, '==============================Solr Query for Retry Update - =================================' + solrObjForUpdate.strSearchCond, pObjLogInfo);
                GetIdfromsolr(solrObjForUpdate.strSearchCond, 'SCH_JOBS_THREAD_LOG', function (solrRes) {
                    if (solrRes.status == 'No Data Found') {
                        CL('D', ServiceName, 'Solr Data Not Found For this, Retry Solr Update Search Condition - ' + solrObjForUpdate.strSearchCond, pObjLogInfo);
                        asynccallback();
                    } else {
                        CL("S", ServiceName, 'Solr Response Count - ' + solrRes.data.length, pObjLogInfo);
                        threadStatusUpdate(solrObjForUpdate, solrRes.data, pObjLogInfo, function (solrUpdateResult) {
                            if (solrUpdateResult) {
                                arrSuccessSolrUpdate.push(solrObjForUpdate);
                            }
                            asynccallback();
                        });
                    }
                });
            } catch (err) {
                CL("D", ServiceName, "Catch Error in prepareDataForUpdate(); async.forEachOfSeries();" + err.message);
                rmvProcessedData(arrSuccessSolrUpdate, pArrObjSolrDataForUpdate);
                return prepareDataForUpdateCB();
            }
        }, function (err) {
            if (err) {
                CL("D", ServiceName, "Error in prepareDataForUpdate(); Error - " + err.message);
                rmvProcessedData(arrSuccessSolrUpdate, pArrObjSolrDataForUpdate);
                prepareDataForUpdateCB();
            } else {
                CL("S", ServiceName, "Thread Log Update Success in prepareDataForUpdate();");
                rmvProcessedData(arrSuccessSolrUpdate, pArrObjSolrDataForUpdate);
                if (pObjLogInfo && pObjLogInfo.isFromStopJob) {
                    if (pArrObjSolrDataForUpdate.length) {
                        setTimeout(() => {
                            CL("S", ServiceName, "Successfully Called prepareDataForUpdate(); in setTimeout()");
                            prepareDataForUpdate(pArrObjSolrDataForUpdate, pObjLogInfo, prepareDataForUpdateCB);
                        }, 10000);
                    } else {
                        pObjLogInfo.isFromStopJob = false;
                    }
                }
                prepareDataForUpdateCB();
            }
        });
    } catch (err) {
        CL("D", ServiceName, "Catch Error in prepareDataForUpdate()" + err.message);
        prepareDataForUpdateCB();
    }
}

// Remove or Slice Data from SolrDataForUpdate Array
function rmvProcessedData(pArrSolrSuccessData, pArrObjSolrDataForUpdate) {
    for (var i = 0; i < pArrSolrSuccessData.length; i++) {
        var lastIndex = pArrObjSolrDataForUpdate.lastIndexOf(pArrSolrSuccessData[i]);
        if (lastIndex > -1) {
            pArrObjSolrDataForUpdate.splice(lastIndex, 1);
        }
    }
}
// Common Function To Update Solr Data in SCH_JOBS_THREAD_LOG Solr Core
function threadStatusUpdate(pSolrResult, pArrSolrDataForUpdate, objLogInfo, threadStatusUpdateCB) {
    try {
        // Expected Array will be 
        // [{status : 'Started' OR 'Completed',
        //     error_msg:'error_msg',
        //     result: 'API Result will be shown here'
        // }]

        if (!pArrSolrDataForUpdate.length) {
            return threadStatusUpdateCB(false);
        }
        var objsolrtdata = {};
        async.forEachOfSeries(pArrSolrDataForUpdate, function (value, key, asynccallback) {
            try {
                objsolrtdata.STATUS = {
                    "set": pSolrResult.status
                };
                objsolrtdata.END_TIME = {
                    "set": reqDateFormatter.ConvertDate(pSolrResult.end_time, headers, null, 'YYYY-MM-DD HH:mm:ss.SSSS')
                };
                objsolrtdata.END_TIME_UTC = {
                    "set": pSolrResult.end_time.toISOString()
                };
                objsolrtdata.ERROR_MSG = {
                    "set": pSolrResult.error_msg
                };
                objsolrtdata.RESPONSE = {
                    "set": pSolrResult.result
                };
                objsolrtdata.id = value.id;
                reqSolrInstance.SolrUpdate(headers, "SCH_JOBS_THREAD_LOG", objsolrtdata, objLogInfo, function (res) {
                    if (res) {
                        console.log('SCH_JOBS_THREAD_LOG Solr Update Success');
                        asynccallback();
                    }
                });
            } catch (err) {
                CL("D", ServiceName, "Catch Error in solrUpdateForData(); async.forEachOfSeries();" + err.message);
                threadStatusUpdateCB(false);
            }
        }, function (err) {
            if (err) {
                CL("D", ServiceName, "Error while Update thread log into solr  " + err.message);
                threadStatusUpdateCB(false);
            } else {
                CL("S", ServiceName, "Thread log Update Success");
                threadStatusUpdateCB(true);
            }
        });
    } catch (err) {
        CL("D", ServiceName, "Catch Error in solrUpdateForData()" + err.message);
        threadStatusUpdateCB(false);
    }
}
/**
 * List Jobs
 * 
 * @param mResCas - cassandra instance
 * @param query - query for execution
 * @param params - Array of parameters for query
 */
function listjobs(mResCas, query, objLogInfo, condition, callback) {
    try {
        var resdata = {};
        headers = objLogInfo["headers"] || "";
        var parsed_query = vsprintf(query, [addSingleQuote(condition[0])]);
        CL('I', ServiceName, 'Query is : ' + parsed_query, objLogInfo);
        reqFXDBInstance.ExecuteQuery(mResCas, parsed_query, objLogInfo, function (pErr, pResult) {
            try {
                if (pErr) {
                    resdata.STATUS = constants.FAILURE;
                    resdata.MESSAGE = pErr.message;
                    CL("D", ServiceName, "Job listing error due to " + pErr.message);
                    callback(resdata);
                } else {
                    resdata.STATUS = constants.SUCCESS;
                    resdata.DATA = pResult.rows;
                    CL("S", ServiceName, "Job listing success");
                    callback(resdata);
                }
            } catch (error) {
                resdata.STATUS = constants.FAILURE;
                resdata.MESSAGE = ex;
                CL("D", ServiceName, "Job listing exception due to " + error.message);
                callback(resdata);
            }
        });
    } catch (ex) {
        resdata.STATUS = constants.FAILURE;
        resdata.MESSAGE = ex;
        CL("D", ServiceName, "Job listing exception due to " + ex.message);
        callback(resdata);
    }
}


/**
 * To get job detail
 * 
 * @param mResCas - cassandra instance
 * @param query - query for execution
 * @param job_code - job table unique id
 */
function getJobDetail(mResCas, QUERY, objLogInfo, job_code, app_id, callback) {
    try {
        var resdata = {};
        headers = objLogInfo["headers"] || "";
        var parsed_query = vsprintf(QUERY, [addSingleQuote(job_code), addSingleQuote(app_id)]);
        // var parsed_query = vsprintf(QUERY, [job_code, app_id]);
        CL('I', ServiceName, "Query : " + parsed_query, objLogInfo);
        var schjobqry = {
            query: "select * from SCH_JOBS where job_name = ? and app_id =?",
            params: [job_code, app_id]
        }
        reqFXDBInstance.ExecuteQuery(mResCas, parsed_query, objLogInfo, function (pErr, pResult) {
            // reqFXDBInstance.ExecuteSQLQueryWithParams(mResCas, schjobqry, objLogInfo, function (pResult, pErr) {
            try {
                if (pErr) {
                    resdata.STATUS = constants.FAILURE;
                    resdata.MESSAGE = pErr.message;
                    CL("D", ServiceName, "Error fetching detail for job " + job_code + " due to " + pErr.message);
                    callback(resdata);
                } else {
                    resdata.STATUS = constants.SUCCESS;
                    resdata.DATA = pResult.rows[0];
                    CL("S", ServiceName, "Job detail obtained successfully for job " + job_code);
                    callback(resdata);
                }

            } catch (error) {
                resdata.STATUS = constants.FAILURE;
                resdata.MESSAGE = error;
                CL("D", ServiceName, "Exception fetching detail for job callback" + job_code + " due to " + error.message);
                callback(resdata);
            }
        });
    } catch (ex) {
        resdata.STATUS = constants.FAILURE;
        resdata.MESSAGE = ex;
        CL("D", ServiceName, "Exception fetching detail for job " + job_code + " due to " + ex.message);
        callback(resdata);
    }
}

function getJobDetailNew(mResCas, QUERY, objLogInfo, job_code, callback) {
    try {
        var resdata = {};
        headers = objLogInfo["headers"] || "";
        var parsed_query = vsprintf(QUERY, [addSingleQuote(job_code)]);
        CL('I', ServiceName, "Query : " + parsed_query, objLogInfo);
        reqFXDBInstance.ExecuteQuery(mResCas, parsed_query, objLogInfo, function (pErr, pResult) {
            try {
                if (pErr) {
                    resdata.STATUS = constants.FAILURE;
                    resdata.MESSAGE = pErr.message;
                    CL("D", ServiceName, "Error fetching detail for job " + job_code + " due to " + pErr.message);
                    callback(resdata);
                } else {
                    CL("S", ServiceName, "Job detail obtained successfully for job " + job_code);
                    if (pResult.rows.length > 0) {
                        resdata.STATUS = constants.SUCCESS;
                        resdata.DATA = pResult.rows[0];
                    } else {
                        resdata.STATUS = constants.FAILURE;
                        resdata.MESSAGE = "";
                    }
                    callback(resdata);
                }
            } catch (error) {
                resdata.STATUS = constants.FAILURE;
                resdata.MESSAGE = error;
                CL("D", ServiceName, "Exception fetching detail for job " + job_code + " due to " + error.message);
                callback(resdata);
            }
        });
    } catch (ex) {
        resdata.STATUS = constants.FAILURE;
        resdata.MESSAGE = ex;
        CL("D", ServiceName, "Exception fetching detail for job " + job_code + " due to " + ex.message);
        callback(resdata);
    }
}


function getSchedulerTemplateDetail(mResCas, query, objLogInfo, condition, callback) {
    try {
        var resdata = {};
        headers = objLogInfo["headers"] || "";
        var parsed_query = vsprintf(query, [addSingleQuote(job_code), addSingleQuote(condition[0])]);
        CL('I', ServiceName, "Query : " + parsed_query, objLogInfo);
        reqFXDBInstance.ExecuteQuery(mResCas, parsed_query, objLogInfo, function (pErr, pResult) {
            try {
                if (pErr) {
                    resdata.STATUS = constants.FAILURE;
                    resdata.MESSAGE = pErr.message;
                    CL("D", ServiceName, "Error fetching detail for template " + job_code + " due to " + pErr.message);
                    callback(resdata);
                } else {
                    resdata.STATUS = constants.SUCCESS;
                    resdata.DATA = pResult.rows[0];
                    CL("S", ServiceName, "Template detail obtained successfully for " + job_code);
                    callback(resdata);
                }
            } catch (error) {
                resdata.STATUS = constants.FAILURE;
                resdata.MESSAGE = error;
                CL("D", ServiceName, "Exception fetching detail for template " + job_code + " due to " + error.message);
                callback(resdata);
            }
        });
    } catch (ex) {
        resdata.STATUS = constants.FAILURE;
        resdata.MESSAGE = ex;
        CL("D", ServiceName, "Exception fetching detail for template " + job_code + " due to " + ex.message);
        callback(resdata);
    }
}

function getAllJobDetail(mDepCas, queryInfo, objLogInfo, callback) {
    try {
        var resdata = {};
        var tableName = queryInfo.Table_Name;
        var condObj = queryInfo.Cond_Obj;
        condObj.job_created_mode = 'MANUAL';
        headers = objLogInfo["headers"] || "";
        console.log('-------------', tableName, JSON.stringify(condObj));
        if (condObj.app_id) {
            var jobStatus = "'STOPPED','CREATED'"
            if (queryInfo && queryInfo.process == 'STOP_ALL') {
                jobStatus = "'STARTED'"
            }
            var schjobdtl = {
                query: `select * from SCH_JOBS where app_id=? and (job_created_mode=? or job_created_mode is null) and tenant_id=? and status in (${jobStatus}) `,
                params: [condObj.app_id, condObj.job_created_mode, condObj.TENANT_ID]
            }
        } else {
            var schjobdtl = {
                query: "select * from SCH_JOBS where (job_created_mode=? or job_created_mode is null) and status in (?)",
                params: [condObj.job_created_mode, condObj.STATUS]
            }
        }
        // reqFXDBInstance.GetTableFromFXDB(mDepCas, tableName, [], condObj, objLogInfo, function (pErr, pResult) {
        reqFXDBInstance.ExecuteSQLQueryWithParams(mDepCas, schjobdtl, objLogInfo, function (pResult, pErr) {
            try {
                if (pErr) {
                    resdata.STATUS = constants.FAILURE;
                    resdata.MESSAGE = pErr.message;
                    CL("D", ServiceName, "Error fetching job details due to " + pErr.message);
                    callback(resdata);
                } else {
                    resdata.STATUS = constants.SUCCESS;
                    resdata.DATA = pResult.rows;
                    CL("S", ServiceName, "Job details obtained successfully. Total job  " + pResult.rows.length);
                    callback(resdata);
                }
            } catch (error) {
                resdata.STATUS = constants.FAILURE;
                resdata.MESSAGE = error;
                CL("D", ServiceName, "Exception fetching jobs detail due to " + error.message);
                callback(resdata);
            }
        });
    } catch (ex) {
        resdata.STATUS = constants.FAILURE;
        resdata.MESSAGE = ex;
        CL("D", ServiceName, "Exception fetching jobs detail due to " + ex.message);
        callback(resdata);
    }
}

function updateJobStatus(mDevCas, objLogInfo, job_name, app_id, status, pcallback) {
    try {
        if (objLogInfo.doDBOperations || !global.isLatestPlatformVersion) {
            CL("I", ServiceName, 'Going to update status of the job ' + job_name + 'status - ' + status, objLogInfo);
            var query = "update sch_jobs set status = %s where job_name = %s and app_id = %s";
            var resdata = {};
            headers = objLogInfo["headers"] || "";
            var parsed_query = vsprintf(query, [addSingleQuote(status), addSingleQuote(job_name), addSingleQuote(app_id)]);
            CL('I', ServiceName, "Query : " + parsed_query, objLogInfo);
            reqFXDBInstance.ExecuteQuery(mDevCas, parsed_query, objLogInfo, function (pErr, pResult) {
                try {
                    if (pErr) {
                        resdata.STATUS = constants.FAILURE;
                        resdata.MESSAGE = pErr.message;
                        CL("D", ServiceName, "Error updating job status for job " + job_name + " due to " + pErr.message);
                        pcallback();
                    } else {
                        resdata.STATUS = constants.SUCCESS;
                        CL("S", ServiceName, "Job status updated successfully for job " + job_name);
                        pcallback();
                    }
                } catch (error) {
                    resdata.STATUS = constants.FAILURE;
                    resdata.MESSAGE = error;
                    CL("D", ServiceName, "Exception while updating job status for job " + job_name + " due to " + error.message);
                    pcallback();
                }
            });
        } else {
            pcallback();
        }
    } catch (ex) {
        resdata.STATUS = constants.FAILURE;
        resdata.MESSAGE = ex;
        CL("D", ServiceName, "Exception while updating job status for job " + job_name + " due to " + ex.message);
        pcallback();
    }
}


function startAllJobs(mDevCas, objLogInfo, routingKey, cas_type, queryInfo, startCreated, schedulerUtil, req, callback) {
    try {
        objLogInfo = objLogInfo || {};
        headers = objLogInfo["headers"] || "";
        var rkey = "";
        var resobj = {};
        rkey = routingKey;
        objLogInfo.isFromServiceStartUp = (objLogInfo.isFromServiceStartUp) || false;
        queryInfo.process = 'START_ALL'
        getAllJobDetail(mDevCas, queryInfo, objLogInfo, function (resJobDetail) {
            try {
                if (resJobDetail.STATUS === constants.FAILURE) {
                    callback(resJobDetail);
                } else {
                    var data = resJobDetail.DATA;
                    async.forEachOfSeries(data, function (value, key, callback_async) {
                        var condition = "";
                        if (startCreated) {
                            // When click the Start all jobs button from scheduler static screen
                            condition = (data[key]["status"].toUpperCase() === "STOPPED" || data[key]["status"] === "CREATED");
                        } else {
                            // While startup the scheduler service - call from app.js 
                            condition = (data[key]["status"].toUpperCase() === "STARTED");
                        }
                        if ((data[key]['job_mode'] == 'RUNTIME') || (data[key].scheduler_info && JSON.parse(data[key].scheduler_info).run_category == 'OnDemand')) {
                            condition = false;
                        }
                        if (condition) {
                            reqRedisInstance.GetRedisConnectionwithIndex(2, function (error, redisInstance) {
                                if (error) {
                                    reqInstanceHelper.PrintError(ServiceName, null, 'ERR-JOBHELPER-0001', 'Error While Getting Redis Connection...', error);
                                    callback_async();
                                } else {
                                    CheckAndGetRedisKey(redisInstance, value, function (error, redisKeyValue) {
                                        try {
                                            redisKeyValue = (redisKeyValue && JSON.parse(redisKeyValue));
                                            if (redisKeyValue.length) {
                                                rkey = (redisKeyValue[0].ROUTINGKEY) || '';
                                            }
                                        } catch (error) { }
                                        reqInstanceHelper.PrintInfo(ServiceName, 'After Updating the Routing Key From Scheduler Job Info - ' + rkey, objLogInfo);
                                        var currentJob = data[key];
                                        objLogInfo.TENANT_ID = currentJob.tenant_id; // Adding TENANT_ID in the objLogInfo because unable to pass the tenant_id parameter
                                        var jobNotificationReqObj = {
                                            jobInfo: data[key],
                                            objLogInfo
                                        };
                                        // For Job Termination
                                        jobNotificationReqObj.fromWhere = 'JOB_TERMINATION';
                                        jobNotificationReqObj.error_msg = 'Scheduler Service May be Restarted..';
                                        jobNotificationReqObj.node_error_msg = '';
                                        SendJobNotifications(jobNotificationReqObj);
                                        // Update the old job Log status as JOB_INTERRUPTED
                                        // updateJobsLog(mDevCas, 'update', objLogInfo, constants.THREADABORTED, '', new Date(), 'JOB_INTERRUPTED', currentJob.job_name.toString(), currentJob.job_description, currentJob.app_id, currentJob.routing_key, function (resUpdateJobLog) { });
                                        // Update thread log status 
                                        objLogInfo.doDBOperations = true;
                                        addThreadLogVariableParameter(mDevCas, 'update', objLogInfo, '', currentJob.job_name, '', constants.THREADABORTED, '', new Date(), 'THREAD_INTERRUPTED', currentJob.app_id, '', '', '', '', function (res) { });
                                        objLogInfo.doDBOperations = false;
                                        var strSearchCond = strSearchCond = 'JOB_NAME:"' + currentJob.job_name + '" AND APP_ID:"' + currentJob.app_id + '" AND STATUS:"Started"';
                                        GetIdfromsolr(strSearchCond, 'SCH_JOBS_LOG', function (solrRes) {
                                            if (solrRes.status !== 'No Data Found') {
                                                currentJob.thread_id = solrRes.data[(solrRes.data.length - 1)].JOB_INSTANCE_ID; // Using the Last Job Instance ID from the Solr
                                            }
                                            // For Job Thread Termination
                                            jobNotificationReqObj.fromWhere = 'JOB_THREAD_TERMINATION';
                                            jobNotificationReqObj.error_msg = 'Scheduler Service May be Restarted..';
                                            jobNotificationReqObj.node_error_msg = '';
                                            SendJobNotifications(jobNotificationReqObj);
                                            // Preate new cron job 
                                            if (!req.body) { // For Service Startup Only
                                                req.body = {
                                                    PROCESS_INFO: {
                                                        MODULE: 'Administration',
                                                        MENU_GROUP: 'General',
                                                        MENU_ITEM: 'Scheduler',
                                                        PROCESS_NAME: 'DEFAULT'
                                                    },
                                                    portal_type: 'WP',
                                                };
                                            }
                                            if (!req.body.job_info) {
                                                req.body.job_info = data[key];
                                            } else {
                                                req.body.job_info = data[key];
                                            }
                                            req.body.jobThreadID = currentJob.thread_id;
                                            schedulerUtil.PrepareCronJobAPI(objLogInfo, data[key], mDevCas, cas_type, rkey, getSchDetail(data[key]), req, function () {
                                                callback_async();
                                            });
                                        });
                                    });
                                }
                            });
                        } else {
                            callback_async();
                        }
                    }, function (err) {
                        if (err) {
                            resobj.STATUS = constants.FAILURE;
                            resobj.MESSAGE = err;
                            CL("D", ServiceName, "Error while starting all jobs due to " + err.message);
                            callback(resobj);
                        } else {
                            resobj.STATUS = constants.SUCCESS;
                            CL("S", ServiceName, "All Jobs Started Successfully");
                            callback(resobj);
                        }
                    });
                }
            } catch (error) {
                resobj.STATUS = constants.FAILURE;
                resobj.MESSAGE = error;
                CL("D", ServiceName, "Exception while starting all jobs callback due to " + error.message);
                callback(resobj);
            }
        });
    } catch (ex) {
        resobj.STATUS = constants.FAILURE;
        resobj.MESSAGE = ex;
        CL("D", ServiceName, "Exception while starting all jobs due to " + ex.message);
        callback(resobj);
    }
}


function parseJson(data) {
    if (typeof data === 'string') {
        try {
            return JSON.parse(data);
        } catch (e) {
            return {};
        }
    } else {
        return data;
    }
}

function getSchDetail(job_obj) {
    var rule_info = parseJson(job_obj["rule_info"]) || "";
    var param_json = parseJson(job_obj["param_json"]) || "";
    if (rule_info !== "" && rule_info != null && rule_info != "null") {
        if (param_json["SCHEDULER_DETAILS"] !== undefined) {
            CL('I', ServiceName, "JOB " + job_obj["job_name"] + " HAS BEEN SCHEDULED ON INIT");
            return param_json["SCHEDULER_DETAILS"];
        } else {
            return "";
        }
    } else {
        return "";
    }
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
        //return "'" + myDate.getFullYear() + "-" + (myDate.getMonth() + 1) + "-" + myDate.getDate() + " " + hour + ":" + minute + ":" + second + "'";
        return "'" + reqDateFormatter.ConvertDate("'" + myDate + "'", headers, true) + "'";
    } else {
        return null;
    }
}

function isInt(value) {
    return !isNaN(value) &&
        parseInt(Number(value)) == value &&
        !isNaN(parseInt(value, 10));
}

function updateTryCount(mDevCas, objLogInfo, job_name, retry_count, APP_ID, pcallback) {
    try {
        if (objLogInfo.doDBOperations || !global.isLatestPlatformVersion) {
            // if (objLogInfo.doDBOperations || !objLogInfo.isFromRestAPI || !global.isLatestPlatformVersion) {
            var count;
            var query = "update SCH_JOBS set retry_attempt = '" + retry_count + "' where app_id = '" + APP_ID + "' and job_name = '" + job_name + "'";
            CL('I', ServiceName, "Query : " + query, objLogInfo);
            reqFXDBInstance.ExecuteQuery(mDevCas, query, objLogInfo, function (pErr, pResult) {
                try {
                    if (pErr) {
                        CL("D", ServiceName, "Error while updating try count for job " + job_name);
                        pcallback();
                    } else {
                        CL("S", ServiceName, "Try count updated successfully for job " + job_name);
                        pcallback();
                    }
                } catch (error) {
                    CL("D", ServiceName, "Exception occured while updateTryCount callback for job " + job_name + error.message);
                    pcallback();
                }
            });
        } else {
            pcallback();
        }
    } catch (error) {
        CL("D", ServiceName, "Exception occured while updateTryCount for job " + job_name + error.message);
        pcallback();
    }
}

function GetRetryCount(mResCas, objLogInfo, job_name, callback) {
    try {
        var query = "select retry_attempt from sch_jobs where job_name = '" + job_name + "' allow filtering ";
        CL('I', ServiceName, "Query : " + query, objLogInfo);
        reqFXDBInstance.ExecuteQuery(mResCas, query, objLogInfo, function (pErr, pResult) {
            try {
                if (pErr) {
                    CL("D", ServiceName, "Error getting retry count for job " + job_name + " due to " + pErr.message);
                    callback("");
                } else {
                    if (pResult.rows.length > 0) {
                        CL("S", ServiceName, "Retry count obtained successfully for job " + job_name);
                        callback(pResult.rows[0]["retry_attempt"]);
                    } else {
                        callback("");
                    }
                }
            } catch (error) {
                CL("D", ServiceName, "Exception Occured GetRetryCount callback due to " + error.message);
            }
        });
    } catch (error) {
        CL("D", ServiceName, "Exception Occured GetRetryCount due to " + error.message);
    }
}

function UpdateJobNew(mDevCas, objLogInfo, job_name, job_rule, app_id, callback) {
    try {
        var QUERY_UPDATE_JOB_DETAIL = "update SCH_JOBS set rule_info = '" + job_rule + "' , job_mode = 'REFERENCE JOB' where job_name = '" + job_name + "' and app_id = '" + app_id + "'";
        CL('I', ServiceName, "Query : " + QUERY_UPDATE_JOB_DETAIL, objLogInfo);
        reqFXDBInstance.ExecuteQuery(mDevCas, QUERY_UPDATE_JOB_DETAIL, objLogInfo, function (pErr, pResult) {
            try {
                if (pErr) {
                    CL("S", ServiceName, "Reference job updation failed for job " + job_name + " due to " + pErr.message);
                    callback("");
                } else {
                    CL("S", ServiceName, "Reference job updated successfully for job " + job_name);
                    callback("SUCCESS");
                }
            } catch (error) {
                CL("D", ServiceName, "Exception occured while executing UpdateJobNew callback function for job - " + job_name + "due to " + error);
                callback(error);
            }
        });
    } catch (error) {
        CL("D", ServiceName, "Exception occured while executing UpdateJobNew function for job - " + job_name + "due to " + error);
        callback(error);
    }
}

//Query
var QUERY_INSERT_JOB = "insert into SCH_JOBS(APP_ID,ROUTING_KEY,JOB_NAME,JOB_DESCRIPTION,TEMPLATE_NAME,JOB_TYPE,CALLING_METHOD,JOB_MODE,OBJECT_NAME,PARAM_JSON,SCHEDULER_INFO,STATUS,CREATED_BY,CREATED_DATE,PRCT_ID,CREATED_BY_NAME) values(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)";
var QUERY_DELETE_JOB_TEMPLATE = "delete from SCH_JOBS where JOB_NAME = %s and app_id = %s";

function createJobWithParam(pHeaders, params, objLogInfo, prct_id, callback) {
    try {
        var job_name = params.job_name;
        var job_description = params.job_description;
        var job_created_value = params.job_created_mode;
        if (!objLogInfo) {
            objLogInfo = {};
        }
        objLogInfo.job_notification = (params.job_notification && (typeof (params.job_notification) == 'object' && JSON.stringify(params.job_notification)) || params.job_notification) || '';
        objLogInfo.template_description = params.template_description || '';
        objLogInfo.job_created_mode = params.job_created_mode || '';
        objLogInfo.tenant_id = params.tenant_id || '';
        var job_type = params.job_type;
        var calling_method = params.calling_method;
        var object_name = params.object_name;
        var param_json = params.param_json;
        param_json['job_created_option'] = job_created_value
        var session_info = params.session_info;
        var routing_key = params.routing_key;
        var scheduler_info = params.scheduler_info;
        var job_mode = params.job_mode;
        var template_name = params.template_name;
        var cas_type = "";
        if (params.portal_type === "CP") {
            cas_type = "dev_cas";
        } else {
            cas_type = "dep_cas";
        }

        var app_id = session_info.APP_ID;
        var user_id = (session_info.USER_ID === undefined) ? session_info.U_ID : session_info.USER_ID;
        var client_id = session_info.CLIENT_ID;
        var created_by_name = session_info.LOGIN_NAME;

        reqFXDBInstance.GetFXDBConnection(pHeaders, cas_type, objLogInfo, function CallbackGetCassandraConn(pCltClient) {
            mDevCas = pCltClient;
            if (job_name === "" || job_name === null || job_name === undefined) {
                job_name = UUIDString();
            }
            if (cas_type === "dev_cas") {
                var condition = "app_id ='" + app_id + "' and category = 'scheduler_jobs'  and code = '" + job_name + "' and designer_name = 'scheduler' ";
                AQMHelper.AQMlocking(mDevCas, condition, pHeaders, function (lockAQM) {
                    if (lockAQM != "" && lockAQM != session_info.LOGIN_NAME) {
                        resobj.STATUS = constants.FAILURE;
                        resobj.locked_by = lockAQM;
                        return callback(resobj);
                    }
                    async.series([
                        function (asynccallback) {

                            var pSELECTQUERY_JOBS = "select * from sch_jobs where job_name = " + job_name + "and  template_name = " + template_name;
                            var pDELETEQUERY = "delete from sch_jobs where job_name = " + job_name + " and  template_name = " + template_name;

                            var comment = "Scheduler > " + template_name + ">" + job_name;
                            CL("I", ServiceName, "AQM Designer Save Started for Job " + job_name);
                            AQMHelper.AQMdesignersave(mDevCas, app_id, client_id, session_info.APP_CODE, 'scheduler', 'scheduler_jobs', job_name, "SAVE", session_info.LOGIN_NAME, session_info.APP_REQ_ID, 'scheduler_jobs', pSELECTQUERY_JOBS, pDELETEQUERY, "0", comment, job_name, pHeaders, function (resAQM) {
                                asynccallback();
                            });
                        },
                        function (asynccallback) {
                            if (template_name !== "" || template_name !== null || template_name !== undefined) {
                                var pSELECTQUERY_JOBS = "select * from sch_jobs where job_name = " + job_name + "and  template_name = " + template_name;
                                var pDELETEQUERY = "delete from sch_jobs where job_name = " + job_name + " and  template_name = " + template_name;

                                var comment = "Scheduler > " + template_name + ">" + job_name;

                                AQMHelper.AQMdesignersave(mDevCas, app_id, client_id, session_info.APP_CODE, 'scheduler', 'template_code', template_name, "", session_info.LOGIN_NAME, session_info.APP_REQ_ID, 'scheduler_jobs', pSELECTQUERY_JOBS, pDELETEQUERY, "0", comment, job_name, pHeaders, function (resAQM) {
                                    asynccallback();
                                });
                            } else {
                                asynccallback();
                            }
                        },
                        function (asynccallback) {
                            CL("I", ServiceName, "Create job method called for job " + job_name);
                            deleteJob(mDevCas, QUERY_DELETE_JOB_TEMPLATE, objLogInfo, job_name, app_id, function (resDelObj) {
                                createJob(mDevCas, QUERY_INSERT_JOB, objLogInfo, app_id, routing_key, job_name, job_description, template_name, job_type, calling_method, job_mode, object_name, JSON.stringify(param_json), JSON.stringify(scheduler_info), "CREATED", user_id, new Date(), "", prct_id, created_by_name,
                                    function (resJobCreate) {
                                        return callback(null, resJobCreate);
                                    });
                            });
                        }
                    ], function (err) {
                        CL("D", ServiceName, "Error ccured while executing async series function.Error : " + err);
                    });
                });
            } else {
                CL("I", ServiceName, "Create job method called for job " + job_name);
                deleteJob(mDevCas, QUERY_DELETE_JOB_TEMPLATE, objLogInfo, job_name, app_id, function (resDelObj) {
                    createJob(mDevCas, QUERY_INSERT_JOB, objLogInfo, app_id, routing_key, job_name, job_description, template_name, job_type, calling_method, job_mode, object_name, JSON.stringify(param_json), JSON.stringify(scheduler_info), "CREATED", user_id, new Date(), "", prct_id, created_by_name,
                        function (resJobCreate) {
                            return callback(null, resJobCreate);
                        });
                });
            }
        });
    } catch (error) {
        CL("D", ServiceName, "Exception occured while executing createJobWithParam function.Error : " + error);
    }
}

function SendJobNotifications(jobNotificationReqObj) {
    try {
        console.log("SendJobNotifications ---------------")
        var jobInfo = jobNotificationReqObj.jobInfo;
        var jobNotification = jobInfo.job_notification ? JSON.parse(jobInfo.job_notification) : {};
        var fromWhere = jobNotificationReqObj.fromWhere;
        var errorMesg = jobNotificationReqObj.error_msg || 'There is No Error Mesg While Occuring Interruption';
        var nodeErrorMesg = jobNotificationReqObj.node_error_msg || 'There is No Error Mesg From Node While Occuring Interruption';
        var objLogInfo = jobNotificationReqObj.objLogInfo || {};
        var collaborationName;
        var jobParamInfo = jobInfo.param_json ? JSON.parse(jobInfo.param_json) : {};
        var commStaticData = {
            job_name: jobInfo.job_description,
            success_msg: '',
            failure_msg: '',
            scheduler_info: jobInfo.scheduler_info,
            param_json: jobInfo.param_json
        };
        //         Sample Params {
        // 	"session_id": "STATIC-SESSION-KEEQB-4",
        // 	"PARAMS": {},
        // 	"PROCESS_INFO": {
        // 		"MODULE": "EXCHANGE",
        // 		"MENU_GROUP": "Exchange Process",
        // 		"MENU_ITEM": "Kenya Common File Upload",
        // 		"PROCESS_NAME": "Continue"
        // 	}
        // }
        var sessionID = jobParamInfo['session_id'] || jobParamInfo['session-id'] || '';
        var processInfo = jobParamInfo.PROCESS_INFO || '';
        if (!sessionID || !processInfo) {
            console.log('**************** For Mail sending Process, Plz.Check Whether the Scheduler Param Json has Session-id and PROCESS_INFO ******************');
            return;
        }

        var insertObj = {
            DT_CODE: 'DEFAULT',
            DTT_CODE: 'DEFAULT',
            WFTPA_ID: 'DEFAULT',
            EVENT_CODE: 'DEFAULT',
            STATIC_DATA: commStaticData
        };

        if (fromWhere == 'JOB_START') {
            if (jobNotification && jobNotification.job_start) {
                collaborationName = jobNotification.job_start;
                commStaticData.success_msg = 'Job Started Successfully';
                commStaticData.failure_msg = '';
                commStaticData.error_msg = '';
                commStaticData.node_error_msg = '';
                insertObj.TEMPLATECODE = collaborationName;
            } else {
                console.log('There is No Collaboration Name Found For Job Start');
                console.log('=========================', jobNotification);
                return;
            }
        } else if (fromWhere == 'JOB_END') {
            if (jobNotification && jobNotification.job_end) {
                collaborationName = jobNotification.job_end;
                commStaticData.success_msg = 'Job Ended Successfully';
                commStaticData.failure_msg = '';
                commStaticData.error_msg = '';
                commStaticData.node_error_msg = '';
                insertObj.TEMPLATECODE = collaborationName;
            } else {
                console.log('There is No Collaboration Name Found For Job End');
                console.log('=========================', jobNotification);
                return;
            }
        } else if (fromWhere == 'JOB_TERMINATION') {
            if (jobNotification && jobNotification.job_termination) {
                collaborationName = jobNotification.job_termination;
                commStaticData.success_msg = '';
                commStaticData.failure_msg = 'Job Terminated...';
                commStaticData.error_msg = errorMesg;
                commStaticData.node_error_msg = nodeErrorMesg;
                insertObj.TEMPLATECODE = collaborationName;
            } else {
                console.log('There is No Collaboration Name Found For Job Termination');
                console.log('=========================', jobNotification);
                return;
            }
        } else if (fromWhere == 'JOB_THREAD_START') {
            if (jobNotification && jobNotification.job_thread_start) {
                collaborationName = jobNotification.job_thread_start;
                commStaticData.success_msg = 'Job Thread Started Successfully';
                commStaticData.failure_msg = '';
                commStaticData.error_msg = '';
                commStaticData.node_error_msg = '';
                insertObj.TEMPLATECODE = collaborationName;
            } else {
                console.log('There is No Collaboration Name Found For Job Thread Start');
                console.log('=========================', jobNotification);
                return;
            }
        } else if (fromWhere == 'JOB_THREAD_END') {
            if (jobNotification && jobNotification.job_thread_end) {
                collaborationName = jobNotification.job_thread_end;
                commStaticData.success_msg = 'Job Thread Ended Successfully';
                commStaticData.failure_msg = '';
                commStaticData.error_msg = '';
                commStaticData.node_error_msg = '';
                insertObj.TEMPLATECODE = collaborationName;
            } else {
                console.log('There is No Collaboration Name Found For Job Thread Stop');
                console.log('=========================', jobNotification);
                return;
            }
        } else if (fromWhere == 'JOB_THREAD_TERMINATION') {
            if (jobNotification && jobNotification.job_thread_termination) {
                collaborationName = jobNotification.job_thread_termination;
                commStaticData.success_msg = '';
                commStaticData.failure_msg = 'Job Thread Terminated...';
                commStaticData.error_msg = errorMesg;
                commStaticData.node_error_msg = nodeErrorMesg;
                insertObj.TEMPLATECODE = collaborationName;
            } else {
                console.log('There is No Collaboration Name Found For Job Thread Termination');
                console.log('=========================', jobNotification);
                return;
            }
        } else {
            console.log('There is No From Where Data...');
            return;
        }

        var redisKey = 'SESSIONID-' + sessionID;
        console.log(redisKey, 'Redis key');
        reqInstanceHelper.GetConfig(redisKey, function (pSessionInfo, error) {
            // console.log(redisKey, 'Redis key Output', pSessionInfo, error, 'Error');
            if (pSessionInfo) {
                insertObj.SESSION_INFO = pSessionInfo;
                pSessionInfo = JSON.parse(pSessionInfo);
                insertObj.CREATED_BY = pSessionInfo[1].USER_ID;
                objLogInfo.headers.routingKey = pSessionInfo.ROUTINGKEY;
                objLogInfo.APP_ID = pSessionInfo.APP_ID;
                objLogInfo.USER_ID = pSessionInfo.USER_ID;
                var headers = {
                    'session-id': sessionID,
                    'routingKey': pSessionInfo[0].ROUTINGKEY
                };
                var RedisURLKey = 'NGINX_HAPROXY_URL';
                var serverhost = '';
                console.log('Getting NGINX_HAPROXY_URL')
                reqRedisInstance.GetRedisConnection(function (error, clientR) {
                    if (error) {
                        console.log("ERROR WHILE FETCHING HAPROXY/NGINX URL FROM REDIS " + JSON.stringify(error));
                    } else {
                        clientR.get(RedisURLKey, function (err, res) {
                            if (err) {
                                console.log("ERROR WHILE FETCHING HAPROXY/NGINX URL FROM REDIS " + JSON.stringify(err));
                            } else {
                                console.log(' NGINX_HAPROXY_URL - ' + res);
                                serverhost = JSON.parse(res)["url"];
                                console.log("URL PRECEDENCE" + serverhost)
                                serverhost = serverhost.split("microsvc")[0] + 'Communication/SendMessage';
                                var input_request = {
                                    url: serverhost,
                                    method: 'POST',
                                    json: true,
                                    body: { PARAMS: insertObj, PROCESS_INFO: processInfo },
                                    headers: headers
                                };
                                console.log('Calling API ');
                                request(input_request, function (error, response, body) {
                                    console.log(JSON.stringify(body), serverhost + ' ------API Result-----------')
                                    if (error) {
                                    } else {
                                    }
                                });
                            }
                        });
                    }
                });
            } else {
                return console.log(redisKey, 'SessionID is Not Existing...');
            }
        });
    } catch (error) {
        console.log('Catch Error in SendJobNotifications();', error);
    }
}

function GetIdfromsolr(strSearchCond, pcore, pcallback) {
    try {
        serviceModel = reqFXDBInstance.DBInstanceSession['SERVICE_MODEL'];
        var ObjRes = {};
        if (serviceModel.AUDIT_ARCHIVAL_MODEL == 'SOLR') {
            reqSolrInstance.GetSolrLogConn(headers, pcore, function (client) {
                try {
                    client.options.get_max_request_entity_size = 1;
                    var query = client.createQuery().q(strSearchCond).rows(200);
                    // var query = client.createQuery().q(strSearchCond);
                    client.search(query, function (error, obj) {
                        try {
                            if (error) {
                                console.log(error);
                                ObjRes.status = 'No Data Found';
                                pcallback(ObjRes);
                            } else {
                                if (obj.response.docs.length) {
                                    ObjRes.status = 'SUCCESS';
                                    ObjRes.data = obj.response.docs;
                                    pcallback(ObjRes);
                                } else {
                                    ObjRes.status = 'No Data Found';
                                    pcallback(ObjRes);
                                }
                            }
                        } catch (error) {
                            CL("D", ServiceName, "Exception occured while executing GetIdfromsolr function.Error : " + error);
                        }
                    });
                } catch (error) {
                    CL("D", ServiceName, "Exception occured while Getting solr connection function.Error : " + error);
                }
            });
        } else {
            // do db insert
            ObjRes.status = 'No Data Found';
            pcallback(ObjRes)
        }
    } catch (error) {
        CL("D", ServiceName, "Exception occured while executing GetIdfromsolr function.Error : " + error);
    }
}

// Used for Starting a Job from Rest API as well as Consumer Service [Latest platform changes]
function StartJobCommon(params, StartJobCommonCB) {
    try {
        /*  params should contains 
         - req [appRequest]
         - res [appResponse] */

        schedulerUtil = require('../util/schedulerUtil');
        var pHeaders = "";
        var resobj = {};
        var req = params.req;
        var res = params.res;
        var objLogInfo = reqLogInfo.AssignLogInfoDetailForCP(req.body, req);
        // objLogInfo.isFromConsumer = req.isFromConsumer || false;
        objLogInfo.doRedisPubSub = params.doRedisPubSub || false;
        objLogInfo.doDBOperations = req.doDBOperations || false;
        objLogInfo.scheduleTheJob = req.scheduleTheJob || false;
        CL("I", ServiceName, "Begin", objLogInfo);
        pHeaders = req.headers;
        var portal_type = "";
        var cas_type = "";
        var app_id = "";
        var job_name = "";
        objLogInfo.MENU_ITEM_DESC = 'StartJob-Scheduler';
        objLogInfo.ACTION_DESC = 'StartJob';
        objLogInfo.HANDLER_CODE = 'startjob';
        reqLogWriter.Eventinsert(objLogInfo);
        var job_info = req.body.job_info || {};

        portal_type = req.body.portal_type || "";
        app_id = job_info.app_id || "";
        var tenant_id = job_info.tenant_id || "";
        objLogInfo.TENANT_ID = tenant_id; // Adding TENANT_ID in the objLogInfo because unable to pass the tenant_id parameter
        job_name = job_info.job_name || "";
        var jobNotificationReqObj = {
            jobInfo: job_info,
            objLogInfo
        };
        if (portal_type === "CP") {
            cas_type = "dev_cas";
        } else {
            cas_type = "dep_cas";
        }

        var routingKey = "";
        if (pHeaders && pHeaders.hasOwnProperty("routingkey")) {
            routingKey = pHeaders.routingkey;
        }

        // Get cassandra instance
        var mHeaders = req.headers;
        reqFXDBInstance.GetFXDBConnection(mHeaders, cas_type, objLogInfo, function CallbackGetCassandraConn(mDevCas) {
            CL("I", ServiceName, "Get job details helper function - Started", objLogInfo);
            // To get the job from SCH_JOBS table
            var QUERY_GET_JOB_DETAIL = "select * from SCH_JOBS where job_name = %s and app_id = %s ";
            getJobDetail(mDevCas, QUERY_GET_JOB_DETAIL, objLogInfo, job_name, app_id,
                function (resJobDetail) {
                    var jobDesc = resJobDetail.DATA.job_description;
                    if (resJobDetail.STATUS === constants.FAILURE) {
                        CL("D", ServiceName, "Error while get the job", objLogInfo);
                        // For Job Termination Notification
                        jobNotificationReqObj.fromWhere = 'JOB_TERMINATION';
                        jobNotificationReqObj.error_msg = 'Error in Getting Job Details - jobHelper.GetJobDetail() Callback..';
                        SendJobNotifications(jobNotificationReqObj);
                        if (res) {
                            res.send(resJobDetail);
                        }
                        if (StartJobCommonCB) {
                            StartJobCommonCB();
                        }
                    } else {
                        CL("I", ServiceName, "Got the schedule job. Going to prepare cron job", objLogInfo);
                        schedulerUtil.PrepareCronJobAPI(objLogInfo, resJobDetail.DATA, mDevCas, cas_type, routingKey, "", req, function () {
                            console.log("GLOBAL JOBS" + global.jobs); // global.logs can be accessed anywhere
                            resobj.STATUS = constants.SUCCESS;
                            resobj.DATA = resJobDetail;
                            CL("I", ServiceName, '-------------------------------- Job has been started. job name - ' + job_name + ', job description - ' + jobDesc + ' --------------------------------', objLogInfo);
                            if (res) {
                                res.send(resobj);
                            }
                            if (StartJobCommonCB) {
                                StartJobCommonCB();
                            }
                        });
                    }
                    reqLogWriter.EventUpdate(objLogInfo);
                });
        });
    } catch (error) {
        console.log(error, 'Catch Error in StartJobCommon()..');
        if (res) {
            res.send(resobj);
        }
        if (StartJobCommonCB) {
            StartJobCommonCB();
        }
    }
}
// Used for Stopping a Job from Rest API as well as Consumer Service [Latest platform changes]
function StopJobCommon(params, StopJobCommonCB) {
    try {
        /*  params should contains 
         - req [appRequest]
         - res [appResponse] */
        var resobj = {};
        var req = params.req;
        var res = params.res;
        // var objLogInfo = reqLogInfo.AssignLogInfoDetailForCP(req.body, req) || {};
        reqLogInfo.AssignLogInfoDetail(req, function (objLogInfo, objSessionInfo) {


            objLogInfo.doRedisPubSub = params.doRedisPubSub || false;
            objLogInfo.doDBOperations = params.doDBOperations || false;
            objLogInfo.PROCESS = 'StopJob-Scheduler';
            objLogInfo.ACTION_DESC = 'StopJob';
            CL("I", ServiceName, 'Stop job started', objLogInfo);
            reqLogWriter.Eventinsert(objLogInfo);
            var portal_type = "";
            var cas_type = "";
            var app_id = "";
            var job_name = "";
            var jobInfo = {};
            portal_type = req.body.portal_type;
            app_id = objLogInfo.APP_ID;
            job_name = req.body.job_name;
            jobInfo = req.body.job_info || {};
            if (portal_type === "CP") {
                cas_type = "dev_cas";
            } else {
                cas_type = "dep_cas";
            }
            var mHeaders = req.headers;
            reqFXDBInstance.GetFXDBConnection(mHeaders, cas_type, objLogInfo, function (mDevCas) {
                reqFXDBInstance.GetFXDBConnection(mHeaders, 'log_cas', objLogInfo, function (logDBConn) {
                    objLogInfo.jobInfo = jobInfo;
                    objLogInfo.TENANT_ID = jobInfo.tenant_id;
                    reqFXDBInstance.GetTableFromFXDB(logDBConn, 'sch_jobs_log', [], {
                        status: 'Started',
                        job_name: jobInfo.job_name
                    }, objLogInfo, function (pError, result) {
                        if (pError) {

                        } else {
                            if (result.rows.length) {
                                var jobthreadId = new reqLinq(result.rows)
                                    .Select(function (item) {
                                        return (item.thread_id);
                                    }).ToArray();

                                schedulerUtil = require('../util/schedulerUtil');
                                resobj.STATUS = schedulerUtil.StopCronJob(mDevCas, objLogInfo, job_name, app_id, jobthreadId);
                                objLogInfo.isFromStopJob = true;
                                addThreadLogVariableParameter(mDevCas, 'update', objLogInfo, '', job_name, '', constants.JOBSTOPPED, '', new Date(), 'Manually Stopped', app_id, '', '', '', '', function (res) { })
                                CL("I", ServiceName, '-------------------------------- Job has been Stoped. Job name - ' + job_name + ' --------------------------------', objLogInfo)
                                var msgTobePublished = {
                                    PROCESS: 'STOP_JOB',
                                    PAYLOAD: {
                                        appID: app_id,
                                        jobName: job_name
                                    }
                                };
                                // For Job End Notification
                                var jobNotificationReqObj = {
                                    jobInfo: jobInfo,
                                    fromWhere: 'JOB_END',
                                    objLogInfo
                                };
                                if (objLogInfo.doDBOperations || !global.isLatestPlatformVersion) {
                                    SendJobNotifications(jobNotificationReqObj);
                                }
                                var CheckAndPublishInRedisReqObj = {
                                    msgTobePublished,
                                    objLogInfo
                                };
                                schedulerUtil.CheckAndPublishInRedis(CheckAndPublishInRedisReqObj, function () {
                                    res.send(resobj);
                                });
                            } else {
                                resobj.STATUS = 'Success';
                                res.send(resobj);

                            }
                        }
                    });
                })
            });
        })
    } catch (error) {
        console.log(error, 'Catch Error in StopJobCommon()..');
        resobj.STATUS = 'FAILURE';
        if (res) {
            res.send(resobj);
        }
        if (StopJobCommonCB) {
            StopJobCommonCB();
        }
    }
}

async function CheckAndGetRedisKey(redisInstance, pJob_info, CheckAndGetRedisKeyCB) {
    try {
        // Redis - get key from redis
        var param_json = (pJob_info && pJob_info.param_json && JSON.parse(pJob_info.param_json)) || '';
        var sessionIDRedisKey = (param_json && param_json.session_id) || '';
        if (sessionIDRedisKey) {
            sessionIDRedisKey = 'SESSIONID-' + sessionIDRedisKey;
            var redisKeyValue = await redisInstance.get(sessionIDRedisKey);
            CheckAndGetRedisKeyCB(null, redisKeyValue);
        } else {
            CheckAndGetRedisKeyCB(null, null);
        }
    } catch (error) {
        reqInstanceHelper.PrintError(ServiceName, null, 'ERR-JOBHELPER-0003', 'Catch Error in CheckAndGetRedisKey()...', error);
        CheckAndGetRedisKeyCB(error, null);
    }
}

module.exports = {
    CreateJob: createJob,
    CreateJobNew: createJobNew,
    DeleteJob: deleteJob,
    AddJobsLog: addJobsLog,
    AddThreadLog: addThreadLog,
    AddThreadLogVariableParameter: addThreadLogVariableParameter,
    UpdateJobsLog: updateJobsLog,
    DeleteJobsLog: deleteJobsLog,
    Listjobs: listjobs,
    GetJobDetail: getJobDetail,
    UpdateJobStatus: updateJobStatus,
    GetAllJobDetail: getAllJobDetail,
    GetJobDetailNew: getJobDetailNew,
    StartAllJobs: startAllJobs,
    CreateScheduleTemplate: createScheduleTemplate,
    GetSchedulerTemplateDetail: getSchedulerTemplateDetail,
    DeleteScheduleTemplate: deleteScheduleTemplate,
    UpdateTryCount: updateTryCount,
    GetRetryCount: GetRetryCount,
    UpdateJobNew: UpdateJobNew,
    CreateJobWithParam: createJobWithParam,
    GetIdfromsolr: GetIdfromsolr,
    SendJobNotifications: SendJobNotifications,
    StartJobCommon: StartJobCommon,
    StopJobCommon: StopJobCommon
};