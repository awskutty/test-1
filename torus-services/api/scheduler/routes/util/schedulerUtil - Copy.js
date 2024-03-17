/**
 * @Author : Ragavendran
 * @Description : Utility file for scheduler
 * @status : completed
 * @Error_code : ERR-SCHEDULER-UTIL-0001
 * @updated-at : 04/04/2017
 */
var rootpath = "../../../../../";
var modPath = rootpath + 'node_modules/';
var reqExpress = require(modPath + 'express');
var router = reqExpress.Router();
var schedule = require(modPath + 'node-schedule');
var moment = require(modPath + 'moment');
var constants = require('./message');
var util = require('./utility');
var jobHelper = require('../helper/jobHelper');
var http = require('http');
var ruleHelper = require('../helper/ruleHelper.js');
var reqRedisInstance = require('../../../../../torus-references/instance/RedisInstance');
var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');
const { retry } = require('async');
var reqFXDBInstance = require(rootpath + 'torus-references/instance/DBInstance');
var reqDateFormatter = require(rootpath + 'torus-references/common/dateconverter/DateFormatter');

var objTraverse = require(modPath + 'obj-traverse');
//var Client = require(modPath + 'node-rest-client').Client;

var request = require(modPath + 'request');
var uuid = require(modPath + 'uuid');
var ServiceName = 'SchedulerUtil';
global.jobs = [];
var job_obj = {};
var mDevCas = "";

var cas_type = "";

var RedisURLKey = "NGINX_HAPROXY_URL";
var URLPrecedence = "";
var objLogInfo;
reqRedisInstance.GetRedisConnection(function (error, clientR) {
    try {
        clientR.get(RedisURLKey, function (err, res) {
            if (err) {
                console.log("ERROR WHILE FETCHING HAPROXY/NGINX URL FROM REDIS " + JSON.stringify(err));
            } else {
                console.log("Redis Res" + res);
                if (res != undefined && res != null) {
                    var jsonData = JSON.parse(res);
                    if (jsonData != {}) {
                        URLPrecedence = jsonData["url"] || "";
                        URLPrecedence = URLPrecedence.split('/microsvc')[0];
                        console.log("URL PRECEDENCE" + URLPrecedence);
                    }
                }
            }
        });
    } catch (ex) { console.log(ex); }

});

/**
 * Method for creating cron expressions
 * 
 * @param frequencytype - Frequency by which the job to be executed
 * @param frequency - 
 */
function createCronExpression(frequencytype, frequency, start) {
    var exp = "";
    switch (frequencytype) {
        case "SECS":
            exp = "*/" + frequency + " * * * * *";
            start = new Date(new Date(start).getTime() - (frequency * 1000)).toISOString();
            break;
        case "MINS":
            exp = new Date(start).getSeconds() + " */" + frequency + " * * * *";
            start = new Date(new Date(start).getTime() - (frequency * 60 * 1000)).toISOString();
            break;
        case "HRS":
            exp = new Date(start).getSeconds() + " " + new Date(start).getMinutes() + " */" + frequency + " * * *";
            start = new Date(new Date(start).getTime() - (frequency * 60 * 60 * 1000)).toISOString();
            break;
        case "DAILY":
            var jobstart = new Date(new Date(start));
            var hours = jobstart.getHours();
            var min = jobstart.getMinutes();
            exp = "00 " + min + " " + hours + " * * *";
            // exp = "0 * /" + frequency + " * *";
            // exp = "00 49 18 * * *";
            CL("I", ServiceName, "Daily Job called - " + exp);
            break;
        case "WEEKLY":
            exp = "* * * * /" + frequency;
            break;
        case "MONTHLY":
            exp = "* * * /" + frequency + " *";
            break;
    }
    CL("I", ServiceName, "Job expression " + exp);
    return exp;
}


function createExactTimeForDelay(frequencytype, frequency) {
    var exp = "";
    var now = new Date();
    var momentType = "";

    switch (frequencytype) {
        case "SECS":
            momentType = "seconds";
            break;
        case "MINS":
            momentType = "minutes";
            break;
        case "HRS":
            momentType = "hours";
            break;
        case "DAILY":
            momentType = "days";
            break;
        case "WEEKLY":
            momentType = "weeks";
            break;
        case "MONTHLY":
            momentType = "months";
            break;
    }


    exp = new Date(moment(new Date()).add(frequency, momentType).format("YYYY-MM-DD HH:mm:ss"));
    CL("I", ServiceName, "Job expression " + exp);
    return exp;
}

/**
 * Method for preparing cron job
 * 
 */
async function prepareCronJobAPI(objLogInfo, jobObject, pDevCas, pcas_type, routing_key, SCHEDULE_DET_OBJ, req, pcallback) {
    try {
        CL("I", ServiceName, "CRON Job Preparation Started", objLogInfo);
        cas_type = pcas_type;
        var job_name = jobObject.job_name;
        var app_id = jobObject.app_id;
        var tenant_id = jobObject.tenant_id;
        var calling_method = jobObject.calling_method;
        var uid = jobObject.created_by;
        var job_description = jobObject.job_description;
        var job_mode = jobObject.job_mode;
        var job_type = jobObject.job_type;
        var object_name = jobObject.object_name;
        var param_json = (jobObject.param_json && jobObject.param_json != 'null') ? JSON.parse(jobObject.param_json) : {};
        //var parsedJson = JSON.parse(param_json); 
        if (param_json.session_id && param_json.session_id.toUpperCase() == "$STATIC_SESSION_ID$") {
            try {
                CL("I", ServiceName, "$STATIC_SESSION_ID param available. Going to create static sessionid using loggedin sessionid. ", objLogInfo);
                var sessID = `SESSIONID-STATIC-SESSION-${objLogInfo.TENANT_ID.toUpperCase()}-${objLogInfo.APP_ID}`
                var redisConn = await getredisconn(2);
                var checkRedivalue = await redisConn.get(sessID);
                if (!checkRedivalue) {
                    var currSessionIdvalue = await redisConn.get(`SESSIONID-${objLogInfo.SESSION_ID}`);
                    await redisInsert(redisConn, sessID, currSessionIdvalue);
                }
                param_json.session_id = sessID;
                param_json = JSON.stringify(param_json);
                CL("I", ServiceName, "Static sessionid created successfully. ", objLogInfo);

            } catch (error) {
                CL('I', ServiceName, "Exception occured while creating static sessionid function. Error : " + error, objLogInfo);
                pcallback();
            }
        }
        var scheduler_info = (jobObject.scheduler_info && jobObject.scheduler_info != 'null') ? JSON.parse(jobObject.scheduler_info) : {};
        var run_category = scheduler_info.run_category;
        var run_type = scheduler_info.run_type;
        var frequency_type = scheduler_info.frequency_type;
        var frequency = scheduler_info.frequency;
        var job_start_date = scheduler_info.job_start_date;
        var job_end_date = scheduler_info.job_end_date;

        CL("I", ServiceName, "FREQUENCY TYPE " + frequency_type + " FREQUENCY " + frequency, objLogInfo);


        //  var routingKey = (routing_key === undefined) ? '' : jobObject.routing_key;
        //routingKey = jobObject.routing_key;
        var routingKey = routing_key;
        mDevCas = pDevCas;

        CL("I", ServiceName, "job running category - " + run_category, objLogInfo);
        CL("I", ServiceName, "job running type - " + run_type, objLogInfo);
        // Adding Job Info In param_json to Send Job Notifications
        param_json.jobObject = jobObject;
        switch (run_category) {
            case "Single":
                objLogInfo.doDBOperations = true;
                if (run_type === "Exact_Time") {
                    addCronJob(objLogInfo, job_name, job_description, scheduler_info, new Date(job_start_date), false, object_name, calling_method, param_json, app_id, routingKey, SCHEDULE_DET_OBJ, req);
                } else if (run_type === "Time_After") {
                    //frequency = 3;
                    CRONEXP = createExactTimeForDelay(frequency_type, frequency);

                    addCronJob(objLogInfo, job_name, job_description, scheduler_info, CRONEXP, false, object_name, calling_method, param_json, app_id, routingKey, SCHEDULE_DET_OBJ, req);
                } else {
                    // currently no operation
                }
                pcallback();
                break;

            case "Multiple":
                objLogInfo.doDBOperations = true;
                var rule = createCronExpression(frequency_type, frequency, job_start_date);
                addCronMulti(objLogInfo, job_name, job_description, scheduler_info, job_start_date, job_end_date, rule, true, object_name, calling_method, param_json, app_id, routingKey, SCHEDULE_DET_OBJ, req, function () {
                    pcallback();
                });
                break;

            case "OnDemand":
                CL("I", ServiceName, "OnDemand ", objLogInfo);
                objLogInfo.doDBOperations = true;
                var obj = {};
                obj.API = object_name;
                obj.URLPrecedence = URLPrecedence;
                obj.METHOD_TYPE = calling_method;
                obj.ROUTING_KEY = routingKey;
                obj.METHOD_ARGS = param_json;
                obj.job_name = job_name;
                obj.objLogInfo = objLogInfo;
                obj.mDevCas = mDevCas;
                obj.APP_ID = app_id;
                obj.jobInfo = jobObject;
                obj.job_description = job_description;
                callapi(obj);
                pcallback();
                break;
            default:
                pcallback();
                break;
        }
    } catch (error) {
        CL('I', ServiceName, "Exception occured while executing prepareCronJobAPI function. Error : " + error, objLogInfo);
    }
}


function addCronJob(objLogInfo, job_name, job_description, scheduler_info, CRONEXP, isRepeat, object_name, calling_method, param_json, APP_ID, ROUTING_KEY, SCHEDULE_DET_OBJ, req) {
    try {
        var jobInfo = (param_json && param_json.jobObject) ? param_json.jobObject : {};
        var jobNotificationReqObj = {
            jobInfo: jobInfo,
            objLogInfo
        };
        var job_obj = {};
        var error_msg = "";
        var retry_count = 0;

        if (SCHEDULE_DET_OBJ.RETRY_JOB_COUNT !== undefined) {
            retry_count = SCHEDULE_DET_OBJ.RETRY_JOB_COUNT;
        }
        CL("I", ServiceName, "Current Retry count for Job " + job_name + " is " + retry_count, objLogInfo);
        var job_inc_id = uuid.v4();
        jobHelper.UpdateTryCount(mDevCas, objLogInfo, job_name, retry_count, APP_ID, function () {
            jobHelper.UpdateJobStatus(mDevCas, objLogInfo, job_name, APP_ID, "STARTED", function () {
                var thread_id = uuid.v4();
                // For Job Start Notification
                jobNotificationReqObj.fromWhere = 'JOB_START';
                jobHelper.SendJobNotifications(jobNotificationReqObj);
                var JSCHEDULE = schedule.scheduleJob(CRONEXP, function () {
                    var start_time = new Date();
                    // var objLogInfo = {};
                    // if (req.body) {
                    //     objLogInfo = reqLogInfo.AssignLogInfoDetailForCP(req.body, req);
                    // }
                    if (!thread_id) {
                        thread_id = uuid.v4();
                    }
                    if (!param_json.jobObject) {
                        param_json.jobObject = jobInfo;
                    }
                    addJobLogCommon(mDevCas, objLogInfo, UUIDString(), thread_id, job_name, job_description, isRepeat, object_name, calling_method, param_json, JSCHEDULE, APP_ID, ROUTING_KEY, SCHEDULE_DET_OBJ, job_inc_id, start_time);
                    updateThreadLogCommon(mDevCas, objLogInfo, 'insert', job_inc_id, job_name, thread_id, constants.THREADSTARTED, start_time, null, "", APP_ID, ROUTING_KEY, '', function () { }); // Thread Started
                });
                //CL('I', ServiceName, "SCH OBJ" + JSON.stringify(JSCHEDULE), objLogInfo);
                job_obj.job_name = job_name.toString();
                job_obj.scheduleObj = JSCHEDULE;
                addJobsArray(job_obj);
            });
        });
        updateJobsLogCommon(mDevCas, objLogInfo, 'insert', constants.JOBSTARTED, new Date(), null, "", job_name, job_description, APP_ID, ROUTING_KEY, job_inc_id); // Job Started
    } catch (error) {
        // For Job Termination
        jobNotificationReqObj.fromWhere = 'JOB_TERMINATION';
        jobNotificationReqObj.error_msg = 'Catch Error in addCronJob()..';
        jobNotificationReqObj.node_error_msg = error;
        jobHelper.SendJobNotifications(jobNotificationReqObj);
        CL('D', ServiceName, "Exception occured while executing addCronJob function. Error : " + error, objLogInfo);
    }

}

// function test() {
//     var schedule = require('node-schedule');
//     var startTime = new Date(new Date("2016-10-31 11:10:00"));
//     var endTime = new Date(new Date("2016-10-31 11:12:00"));
//     var j = schedule.scheduleJob({
//         start: startTime,
//         end: endTime,
//         rule: '*/20 * * * * *'
//     }, function () {
//         console.log('Time for tea!' + new Date(Date.now()));
//     });
// }

function getCharacterFromString(position, keyword) {
    try {
        var stringLength = keyword.length;
        if (position === "FIRST") {
            var firstChar = keyword.charAt(0);
            return firstChar;
        } else if (position === "LAST") {
            var lastChar = keyword.charAt(stringLength - 1);
            return lastChar;
        } else {
            return "";
        }
    } catch (error) {
        CL("D", ServiceName, "Exception occured executing getCharacterFromString function " + error);
    }
}

function addCronMulti(objLogInfo, job_name, job_description, scheduler_info, start, end, CRONEXP, isRepeat, object_name, calling_method, param_json, APP_ID, ROUTING_KEY, SCHEDULE_DET_OBJ, req, pcallback) {
    try {
        var jobInfo = (param_json && param_json.jobObject) ? param_json.jobObject : {};
        var jobNotificationReqObj = {
            jobInfo: jobInfo,
            objLogInfo
        };
        var job_obj = {};
        var error_msg = "";
        var retry_count = 0;
        var start_time = new Date(new Date(start));
        var end_time = new Date(new Date(end));

        if (SCHEDULE_DET_OBJ.RETRY_JOB_COUNT !== undefined) {
            retry_count = SCHEDULE_DET_OBJ.RETRY_JOB_COUNT;
        }
        CL("I", ServiceName, "Current Retry count for Job " + job_name + " is " + retry_count);
        var job_inc_id = '';
        if (req.body && req.body.jobThreadID) {
            job_inc_id = req.body.jobThreadID;
        } else {
            job_inc_id = uuid.v4();
            if (!req.body) {
                req.body = {};
            }
            req.body.jobThreadID = job_inc_id;
        }
        jobHelper.UpdateTryCount(mDevCas, objLogInfo, job_name, retry_count, APP_ID, function () {
            jobHelper.UpdateJobStatus(mDevCas, objLogInfo, job_name, APP_ID, "STARTED", function () {
                var thread_id = uuid.v4();
                // For Job Start Notification
                jobNotificationReqObj.fromWhere = 'JOB_START';
                if (objLogInfo.doDBOperations || !global.isLatestPlatformVersion) {
                    jobHelper.SendJobNotifications(jobNotificationReqObj);
                }
                console.log('================== CRON Service Startup Time - ' + new Date().toLocaleString());
                console.log(start_time, CRONEXP, ' ================== start_time, CRONEXP');
                var msgTobePublished = {
                    PROCESS: 'START_JOB', PAYLOAD: { headers: req.headers, clientParams: req.body }
                };
                var CheckAndPublishInRedisReqObj = {
                    msgTobePublished,
                    objLogInfo
                };
                var JSCHEDULE = {};
                CheckAndPublishInRedis(CheckAndPublishInRedisReqObj, function () {
                    // Not allowing to start the job via Rest API 
                    if (objLogInfo.scheduleTheJob || !global.isLatestPlatformVersion) {

                        JSCHEDULE = schedule.scheduleJob({
                            start: start_time,
                            end: end_time,
                            rule: CRONEXP
                        }, function () {
                            try {
                                reqInstanceHelper.PrintInfo(ServiceName, 'Each Cron Thread With Delay - ' + CRONEXP + ' and its Startup Time - ' + new Date().toLocaleString(), objLogInfo);
                                if (!thread_id) {
                                    thread_id = uuid.v4();
                                }
                                CL('I', ServiceName, 'Multi Cron job started - ' + job_description, objLogInfo);
                                // To start the schedule and execute the serive
                                var start_time = new Date();
                                if (!param_json.jobObject) {
                                    param_json.jobObject = jobInfo;
                                }
                                var TimeSlotReqObj = {};
                                TimeSlotReqObj.scheduler_info = JSON.parse(jobInfo.scheduler_info);
                                if (scheduler_info.allow_concurrency) {
                                    reqInstanceHelper.PrintInfo(ServiceName, 'This Job is a Concurrency Case', objLogInfo);
                                }
                                reqInstanceHelper.PrintInfo(ServiceName, 'This Job is Not a Concurrency Case', objLogInfo);
                                reqRedisInstance.GetRedisConnectionwithIndex(4, function (error, redisClient) {
                                    if (error) {
                                        console.log('============================ Error While Getting Redis Connection =============================');
                                        return;
                                    }
                                    var schJobRedisKey = 'SCH_JOB_DESC_' + job_description;
                                    var schJobRedisKeyTTL = 5; // Need to be paramterized
                                    var schJobRedisKeyValue = {};
                                    schJobRedisKeyValue.DATE_AND_TIME = new Date().toLocaleString();
                                    schJobRedisKeyValue.JOB_NAME = job_description;
                                    // redisClient.set(schJobRedisKey, JSON.stringify(schJobRedisKeyValue), 'NX', 'EX', schJobRedisKeyTTL, function (error, result) {
                                    reqRedisInstance.RedisSetNx(redisClient, schJobRedisKey, JSON.stringify(schJobRedisKeyValue), schJobRedisKeyTTL, function (result) {
                                        console.log(error, result, new Date(), "============================================++++++++++");
                                        if (error || !result) {
                                            console.log('============================ Already JOB API Called =============================');
                                            return;
                                        } else {
                                            console.log('============================ Going Calling JOB API =============================');
                                            objLogInfo.doDBOperations = true; // To Insert update Logs in Table n Solr
                                            objLogInfo.isThreadResult = true;
                                            console.log('=============================Insert Success=============================');
                                            addJobLogCommon(mDevCas, objLogInfo, UUIDString(), thread_id, job_name, job_description, isRepeat, object_name, calling_method, param_json, JSCHEDULE, APP_ID, ROUTING_KEY, SCHEDULE_DET_OBJ, job_inc_id, start_time);
                                        }
                                    });
                                });
                            } catch (error) {
                                // For Job Thread Termination
                                jobNotificationReqObj.fromWhere = 'JOB_THREAD_TERMINATION';
                                jobNotificationReqObj.error_msg = 'Catch Error in Scheduling New CRON Job Callback..';
                                jobNotificationReqObj.node_error_msg = error;
                                jobHelper.SendJobNotifications(jobNotificationReqObj);
                                CL('I', ServiceName, 'Exception occured for job ' + job_description + '\n Error : ' + error + '\n', objLogInfo);
                            }
                        });
                    }
                });
                job_obj.job_name = job_name.toString();
                job_obj.scheduleObj = JSCHEDULE;
                if (objLogInfo.scheduleTheJob || !global.isLatestPlatformVersion) {
                    addJobsArray(job_obj);
                }
                pcallback();
            });
        });
        updateJobsLogCommon(mDevCas, objLogInfo, 'insert', constants.JOBSTARTED, new Date(), null, "", job_name, job_description, APP_ID, ROUTING_KEY, job_inc_id); // Job Started
    } catch (error) {
        // For Job Termination
        jobNotificationReqObj.fromWhere = 'JOB_TERMINATION';
        jobNotificationReqObj.error_msg = 'Catch Error in addCronMulti()..';
        jobNotificationReqObj.node_error_msg = error;
        jobHelper.SendJobNotifications(jobNotificationReqObj);
        CL('I', ServiceName, 'Exception occured for job ' + job_description + '\n Error : ' + error + '\n', objLogInfo);
    }
}

function CheckAndPublishInRedis(params, CheckAndPublishInRedisCB) {
    try {
        /* params should contains
        - objLogInfo
        - msgTobePublished
        */
        if (params.objLogInfo && params.objLogInfo.doRedisPubSub && global.isLatestPlatformVersion) {
            console.log('******** Going TO Publish a Msg in Redis **********');
            reqRedisInstance.GetRedisConnectionwithIndex(4, function (error, redisClient) {
                if (error) {
                    reqInstanceHelper.PrintError(ServiceName, params.objLogInfo, 'ERR-SCHEDULER-UTIL-0002', 'Error while Getting Redis Connection()...', error);
                }
                if (params.msgTobePublished.PAYLOAD && params.msgTobePublished.PAYLOAD.headers && params.msgTobePublished.PAYLOAD.headers.LOG_INFO) { delete params.msgTobePublished.PAYLOAD.headers.LOG_INFO };
                redisClient.publish('SCHEDULER_REDIS_PUBSUB', JSON.stringify(params.msgTobePublished));
                redisClient.on("error", function (err) {
                    console.log("Error " + err);
                });
                CheckAndPublishInRedisCB();
            });
        } else {
            CheckAndPublishInRedisCB();
        }
    } catch (error) {
        reqInstanceHelper.PrintError(ServiceName, params.objLogInfo, 'ERR-SCHEDULER-UTIL-0001', 'Catch Error in CheckAndPublishInRedis()...', error);
        CheckAndPublishInRedisCB();
    }
}

function addJobLogCommon(mDevCas, objLogInfo, SCHJTL_ID, THREAD_ID, JOB_CODE, job_description, IS_REPEAT, API, METHOD_TYPE, METHOD_ARGS, JSCHEDULE, APP_ID, ROUTING_KEY, SCHEDULE_DET_OBJ, job_inc_id, start_time) {
    try {
        var jobInfo = getJobData();
        // Catching the while parsing the scheduler_info JSON 
        try {
            var scheduler_info = jobInfo.scheduler_info && JSON.parse(jobInfo.scheduler_info) || {};
        } catch (error) { }
        function getJobData() {
            var data = {};
            if (METHOD_ARGS) {
                if (METHOD_ARGS.jobObject) {
                    data = METHOD_ARGS.jobObject;
                    delete METHOD_ARGS.jobObject;
                }
            }
            return data;
        }
        var error_msg = "";
        CL("I", ServiceName, "Repeat job status for Job " + job_description + " : " + IS_REPEAT, objLogInfo);
        if (!IS_REPEAT) {
            CL("I", ServiceName, "Removing Job " + JOB_CODE, objLogInfo);
            removeCronJob(objLogInfo, JOB_CODE, APP_ID);
        }
        if (job_description === null) {
            job_description = "";
        }
        // updateJobsLogCommon(mDevCas, objLogInfo, 'insert', constants.JOBSTARTED, new Date(), null, "", JOB_CODE, job_description, APP_ID, ROUTING_KEY, job_inc_id); // Job Started
        // updateThreadLogCommon(mDevCas, objLogInfo, 'insert', SCHJTL_ID, JOB_CODE, THREAD_ID, constants.THREADSTARTED, new Date(), null, "", APP_ID, ROUTING_KEY, '') // Thread Started

        if (METHOD_ARGS["headers"] === undefined) {
            METHOD_ARGS["headers"] = "";
        }

        var req_type_json = {};
        if (SCHEDULE_DET_OBJ !== "") {
            METHOD_ARGS["SCHEDULER_DETAILS"] = SCHEDULE_DET_OBJ;
        } else {
            METHOD_ARGS["SCHEDULER_DETAILS"] = {};
        }
        var pattern = /^((http|https):\/\/)/;
        var pattern1 = /^(www)/;
        // Check if Url is not public URL
        if (!pattern.test(API) && !pattern1.test(API)) {
            if (getCharacterFromString("FIRST", API) !== '/') {
                API = "/" + API;
            }

            if (getCharacterFromString("LAST", URLPrecedence) == "/") {
                URLPrecedence = URLPrecedence.slice(0, -1);
            }

            API = URLPrecedence + API;
        }
        CL('S', ServiceName, 'JOB CALLED FOR the API ' + API, objLogInfo);

        CL('I', ServiceName, 'Job api method - ' + METHOD_TYPE, objLogInfo);

        if (METHOD_TYPE === "POST") {
            req_type_json = {
                url: API,
                method: "POST",
                json: true,
                body: METHOD_ARGS,
                headers: {
                    "RoutingKey": ROUTING_KEY,
                    "session-id": "STATIC_SESSION_" + ROUTING_KEY
                }
            };
        } else {
            req_type_json = {
                url: API,
                method: "GET",
                json: true,
                body: METHOD_ARGS,
                headers: {
                    "RoutingKey": ROUTING_KEY,
                    "session_id": "STATIC_SESSION_" + ROUTING_KEY
                }
            };
        }
        // Getting Timeout Value from the Scheduler Info
        if (scheduler_info && scheduler_info.thread_wait_time) {
            req_type_json.timeout = Number(scheduler_info.thread_wait_time) * 1000; // Convert into Milli Seconds
        }

        // req_type_json.timeout = 18000000; // 5 Hours in Milli Seconds
        if (METHOD_ARGS.session_id != undefined) {
            req_type_json.headers["session-id"] = METHOD_ARGS.session_id;
        }
        try {
            var jobNotificationReqObj = {
                jobInfo: jobInfo,
                fromWhere: 'JOB_THREAD_START',
                objLogInfo
            };

            // Creating a Multiple CRON Jobs Based on No of Job Threads at a time
            // Getting Job Thread Count From the Scheduler Info
            var threadCount = (scheduler_info.thread_count && Number(scheduler_info.thread_count)) || 1;
            CL('I', ServiceName, 'Thread Count - ' + threadCount, objLogInfo);
            for (let v = 0; v < threadCount; v++) {
                // For Job Thread Start
                try {
                    jobHelper.SendJobNotifications(jobNotificationReqObj);
                } catch (error) {
                    console.log(error)
                }
                var schJobThreadRedisKey = APP_ID + '_' + JOB_CODE + '_' + THREAD_ID + '_' + JSON.stringify(start_time);
                schJobThreadRedisKey = schJobThreadRedisKey.replace(/"/g, '');
                var schJobThreadRedisKeyTTL = 3600; // 1Hr - For Job Thread Expiring Time in Reids 
                var schJobThreadRedisKeyValue = {};
                schJobThreadRedisKeyValue.DATE_AND_TIME = new Date().toLocaleString();
                schJobThreadRedisKeyValue.JOB_NAME = job_description;
                // Used To Capture the Redis Key Expire Events 
                reqRedisInstance.GetRedisConnectionwithIndex(5, function (error, redisClient) {
                    redisClient.set(schJobThreadRedisKey, JSON.stringify(schJobThreadRedisKeyValue), 'EX', schJobThreadRedisKeyTTL);
                    updateThreadLogCommon(mDevCas, objLogInfo, 'insert', job_inc_id, JOB_CODE, THREAD_ID, constants.THREADSTARTED, start_time, null, "", APP_ID, ROUTING_KEY, '', function () {
                        reqInstanceHelper.PrintInfo(ServiceName, 'Job Type - Multi Cron', objLogInfo);
                        reqInstanceHelper.PrintInfo(ServiceName, 'Job Description - ' + job_description, objLogInfo);
                        reqInstanceHelper.PrintInfo(ServiceName, 'Job API - ' + API, objLogInfo);
                        request(req_type_json, function (error, response, body) {
                            var socket_message = {
                                status: '',
                                error: '',
                                data: '',
                                job_name: ''
                            };

                            // var notifymsg = body;
                            if (error || response && response.statusCode !== 200 && response.statusCode !== 304) {
                                var apiError = error || body || '';
                                apiError = (typeof apiError !== 'string') && JSON.stringify(apiError) || apiError;
                                // For Job Thread Termination
                                jobNotificationReqObj.fromWhere = 'JOB_THREAD_TERMINATION';
                                jobNotificationReqObj.error_msg = 'Error While Calling Job API...';
                                jobNotificationReqObj.node_error_msg = apiError;
                                jobHelper.SendJobNotifications(jobNotificationReqObj);
                                socket_message.status = 'Failure';
                                socket_message.error = apiError;
                                reqInstanceHelper.PrintInfo(ServiceName, 'Job API - ' + API + ' and Its Result - ' + apiError, objLogInfo);
                                error_msg = apiError;
                                if (!IS_REPEAT) {
                                    CL("I", ServiceName, "Removing Job " + JOB_CODE, objLogInfo);
                                    removeCronJob(objLogInfo, JOB_CODE, APP_ID);
                                }
                                updateJobsLogCommon(mDevCas, objLogInfo, 'update', constants.JOBABORTED, null, new Date(), error_msg, JOB_CODE, job_description, APP_ID, ROUTING_KEY); // Job Completed
                                updateThreadLogCommon(mDevCas, objLogInfo, 'update', SCHJTL_ID, JOB_CODE, THREAD_ID, constants.THREADABORTED, start_time, new Date(), error_msg, APP_ID, ROUTING_KEY, '', function () { }); // Thread Completed
                            } else {
                                // For Job Thread Stop
                                jobNotificationReqObj.fromWhere = 'JOB_THREAD_END';
                                jobHelper.SendJobNotifications(jobNotificationReqObj);
                                var notifymsg = JSON.stringify(body);
                                socket_message.status = body.NOTIFY_RESULT ? body.NOTIFY_RESULT : 'Success';
                                reqInstanceHelper.PrintInfo(ServiceName, 'Job API - ' + API + ' and Its Result - ' + notifymsg, objLogInfo);
                                // thread status update
                                updateThreadLogCommon(mDevCas, objLogInfo, 'update', SCHJTL_ID, JOB_CODE, THREAD_ID, constants.THREADCOMPLETED, start_time, new Date(), error_msg, APP_ID, ROUTING_KEY, notifymsg, function () { }); // Thread Completed
                                CL('I', ServiceName, '-----------------------\n', objLogInfo);
                                CL("I", ServiceName, "Next thread going to start. Rule Engine Initiated for Job " + job_description + ' job code :' + JOB_CODE, objLogInfo);
                                ruleEngine(mDevCas, objLogInfo, JOB_CODE, body);
                            }
                            // Removing SCH_JOB_THREAD_KEY from Redis after getting the Thread API Resp

                            redisClient.del(schJobThreadRedisKey);
                            socket_message.job_name = JOB_CODE;
                            socket_message.data = notifymsg;
                            emitSocket(socket_message, (result) => {
                                if (result == 'SUCCESS') {
                                    CL('S', ServiceName, 'MESSAGE emitted to : ' + job_description, objLogInfo);
                                } else {
                                    CL('S', ServiceName, 'Problem in MESSAGE emit : ' + job_description, objLogInfo);
                                }
                            });
                        });
                    });
                });
            }
        } catch (ex) {
            // For Job Thread Termination
            jobNotificationReqObj.fromWhere = 'JOB_THREAD_TERMINATION';
            jobNotificationReqObj.error_msg = 'Catch Error While Calling API..';
            jobNotificationReqObj.node_error_msg = ex;
            jobHelper.SendJobNotifications(jobNotificationReqObj);
            CL("D", ServiceName, "EXCEPTION OCCURED WHILE CALLING API FOR JOB " + JOB_CODE, objLogInfo);
            if (!IS_REPEAT) {
                console.log("JOB REMOVED");
                removeCronJob(objLogInfo, JOB_CODE, APP_ID);
            }
        }
    } catch (ex) {
        // For Job Thread Termination
        jobNotificationReqObj.fromWhere = 'JOB_THREAD_TERMINATION';
        jobNotificationReqObj.error_msg = 'Catch Error in addJobLogCommon()..';
        jobNotificationReqObj.node_error_msg = ex;
        jobHelper.SendJobNotifications(jobNotificationReqObj);
        CL("D", ServiceName, "EXCEPTION OCCURED : " + JSON.stringify(ex), objLogInfo);
        if (!IS_REPEAT) {
            removeCronJob(objLogInfo, JOB_CODE, APP_ID);
        }
        updateJobsLogCommon(mDevCas, objLogInfo, 'update', constants.JOBABORTED, null, new Date(), "Exception:" + ex, JOB_CODE, job_description, APP_ID, ROUTING_KEY); // Job Completed
        updateThreadLogCommon(mDevCas, objLogInfo, 'update', SCHJTL_ID, JOB_CODE, THREAD_ID, constants.THREADABORTED, null, new Date(), "Exception:" + ex, APP_ID, ROUTING_KEY, '', function () { }); // Thread Completed
    }
}


/**
 * remove cron job 
 * @param job_code - unique id for the job
 */

// need to update thread status 
function removeCronJob(objLogInfo, job_name, app_id) {
    try {
        var jobInfo = getJobData();
        function getJobData() {
            var data = {};
            if (objLogInfo) {
                if (objLogInfo.jobInfo) {
                    data = objLogInfo.jobInfo;
                    delete objLogInfo.jobInfo;
                }
            }
            return data;
        }
        CL("I", ServiceName, "Remove cron job called", objLogInfo);
        jobHelper.UpdateJobStatus(mDevCas, objLogInfo, job_name, app_id, "STOPPED", function () {
            for (var i in global.jobs) {
                console.log(global.jobs.length, 'Job Count --------------------------------------------------------------')
                console.log(global.jobs[i]["job_name"], 'Job Names --------------------------------------------------------------')
                if (global.jobs[i]["job_name"] === job_name.toString()) {
                    console.log('Delete Job Info' + global.jobs[i]);
                    if (global.jobs[i]["scheduleObj"]) {
                        global.jobs[i]["scheduleObj"].cancel();
                        // var x = schedule.cancelJob(global.jobs[i]["scheduleObj"]);
                        CL("I", ServiceName, "JOB " + global.jobs[i]["job_name"] + " has been cancelled successfully ", objLogInfo);
                    }
                    removeJobFromJobArray(job_name);
                }
            }
        });
    } catch (error) {
        CL("D", ServiceName, "Exception occured while remove cronJob. Error : " + error, objLogInfo);
    }
}

function removeCronJobInitial(job_name, app_id) {
    for (var i in global.jobs) {
        if (global.jobs[i]["job_name"] === job_name.toString()) {

            if (global.jobs[i]["scheduleObj"] !== null) {
                global.jobs[i]["scheduleObj"].cancel();
            }

            removeJobFromJobArray(job_name);
        }
    }
}

/**
 * Add job code to a global array 
 * @param job_obj - unique id for the job
 */
function addJobsArray(job_obj) {
    global.jobs.push(job_obj);
}


/**
 * remove jobs from global array
 * @param job_code - unique id for the job
 */
function removeJobFromJobArray(job_name) {
    for (var i in global.jobs) {
        if (global.jobs[i]["job_name"] === job_name.toString()) {
            global.jobs.splice(i, 1);
        }
    }
}

function updateJobsLogCommon(mDevCas, objLogInfo, query, job_status, start_time, end_time, error_msg, job_code, job_description, APP_ID, ROUTING_KEY, job_inc_id) {
    try {
        if (objLogInfo.isFromServiceStartUp || objLogInfo.doDBOperations || !global.isLatestPlatformVersion) {
            jobHelper.UpdateJobsLog(mDevCas, query, objLogInfo, job_status, start_time, end_time, error_msg, job_code.toString(), job_description, APP_ID, ROUTING_KEY, function (resUpdateJobLog) {
                CL("I", ServiceName, "Job Log Has been " + job_status + " for job " + job_description);
            }, job_inc_id);
        }
    } catch (error) {
        CL("D", ServiceName, "Exception occured while updateJobsLogCommon. Error : " + error + job_description);
    }
}

function updateThreadLogCommon(mDevCas, objLogInfo, query, code, job_code, thread_id, job_status, start_time, end_time, error_msg, APP_ID, ROUTING_KEY, result, updateThreadLogCommonCB) {
    try {
        jobHelper.AddThreadLogVariableParameter(mDevCas, query, objLogInfo, code, job_code, thread_id.toString(), job_status, start_time, end_time, error_msg, APP_ID, ROUTING_KEY, result,
            function (resAddThreadLog) {
                CL("I", ServiceName, "Thread Log Has been " + job_status + " for job " + job_code + " and for thread " + thread_id);
                if (updateThreadLogCommonCB) {
                    updateThreadLogCommonCB();
                }
            });
    } catch (error) {
        CL("D", ServiceName, "Exception occured while updateThreadLogCommon. Error : " + error + job_code);
        if (updateThreadLogCommonCB) {
            updateThreadLogCommonCB();
        }
    }
}

function stopCronJob(pDevCas, objLogInfo, job_name, app_id) {
    try {
        CL("I", ServiceName, "Stop Cron Job Called", objLogInfo);
        mDevCas = pDevCas;
        removeCronJob(objLogInfo, job_name, app_id);
        updateJobsLogCommon(mDevCas, objLogInfo, 'update', constants.JOBSTOPPED, null, new Date(), "", job_name, "", app_id, ""); // Job Completed
        return constants.SUCCESS;
    } catch (error) {
        CL("D", ServiceName, "Exception occured while stopCronJob. Error : " + error + job_name, objLogInfo);
    }
}

function addSingleQuote(data) {
    return "'" + data + "'";
}

// For Phase 2


function ruleEngine(mResCas, objLogInfo, job_name, service_response) {
    try {
        CL("I", ServiceName, "Rule Engine Started......", objLogInfo);
        var SCHEDULER_DETAILS = service_response["SCHEDULER_DETAILS"] || "";
        var unique_id = SCHEDULER_DETAILS["UNIQUE_ID"] || ""; // must be given by the client
        CL("I", ServiceName, "Job Rule Processing started for Job " + job_name + " With Unique ID " + unique_id);
        if (unique_id !== "") {
            getJobRule(mResCas, objLogInfo, job_name, function (jobRule) {
                processJobDetailsFromJobRule(mResCas, objLogInfo, unique_id, jobRule, service_response);
            });
        }
    } catch (error) {
        CL("D", ServiceName, "Exception occured while ruleEngine. Error : " + error + job_name, objLogInfo);
    }
}


function getJobRule(mResCas, objLogInfo, job_name, callback) {
    try {
        ruleHelper.GetJobRule(mResCas, objLogInfo, job_name, function (res_jobrule) {
            if (res_jobrule.STATUS !== "FAILURE") {
                callback(res_jobrule.DATA);
            } else {
                callback("");
            }
        });
    } catch (error) {
        CL("D", ServiceName, "Exception occured while getJobRule. Error : " + error + job_name, objLogInfo);
    }
}



function processJobDetailsFromJobRule(mResCas, objLogInfo, unique_id, jobRule, service_response) {
    try {
        var MainJobRule = jobRule;
        if (jobRule !== "") {
            jobRule = JSON.parse(jobRule);
        }
        var resp = "";
        // main job
        for (var i in jobRule) {
            if (jobRule[i]["unique_id"] == unique_id) {
                CL("I", ServiceName, "Main Job Initiated for Job with unique ID " + unique_id);
                resp = getdetailsofNewJob(jobRule[i], service_response);
                if (resp.repeat_job !== "") {
                    CL("I", ServiceName, "Executing Repeat Job for unique ID " + unique_id);
                    executeRepeatJob(mResCas, objLogInfo, resp.repeat_job, MainJobRule, service_response, function () { });
                } else if (resp.subJob !== "") {
                    CL("I", ServiceName, "Executing Sub Job for unique ID " + unique_id);
                    executeSubJob(mResCas, objLogInfo, resp.subJob, MainJobRule, service_response, function () { });
                } else { }
            }
        }
        // sub job
        if (resp == "" || resp == undefined) {
            CL("I", ServiceName, "Getting Detail of sub job");
            var tempjob = objTraverse.findFirst(jobRule[0], "children", {
                "unique_id": unique_id
            });
            resp = getdetailsofNewJob(tempjob, service_response);
            CL("I", ServiceName, "Sub Job Detail Obtained from rule tree with unique ID " + unique_id);
            if (resp.repeat_job !== "") {
                CL("I", ServiceName, "Executing Repeat Job for unique ID " + unique_id);
                executeRepeatJob(mResCas, objLogInfo, resp.repeat_job, MainJobRule, service_response, function () { });
            } else if (resp.subJob !== "") {
                CL("I", ServiceName, "Executing Sub Job for unique ID " + unique_id);
                executeSubJob(mResCas, objLogInfo, resp.subJob, MainJobRule, service_response, function () { });
            } else { }
        }
    } catch (error) {
        CL("D", ServiceName, "Exception occured while processJobDetailsFromJobRule. Error : " + error, objLogInfo);
    }
}

function getdetailsofNewJob(job, service_response) {
    try {
        var subJob = "";
        var repeat_job = "";
        var obj = {};
        var result_key = job["result_key"];
        var result_val = service_response[result_key];
        // call sub job
        if (job["repetition"]["is_repeat"] == false) {
            var sub_jobs = job["children"];
            for (var i in sub_jobs) {
                if (sub_jobs[i]["result_val"] == result_val) {
                    if (sub_jobs[i]["repetition"]["is_repeat"] == true) {
                        repeat_job = sub_jobs[i];
                        subJob = "";
                        break;
                    } else {
                        subJob = sub_jobs[i];
                        repeat_job = "";
                        break;
                    }
                }
            }
        } else {
            repeat_job = job;
            subJob = "";
        }
        obj.subJob = subJob;
        obj.repeat_job = repeat_job;
        return obj;
    } catch (error) {
        CL("D", ServiceName, "Exception occured while processJobDetailsFromJobRule. Error : " + error, objLogInfo);
    }
}


function getSubJobofRepeatJob(job, service_response) {
    try {
        var subJob = "";
        var repeat_job = "";
        var obj = {};
        var result_key = job["result_key"];
        var result_val = service_response[result_key];
        // call sub job
        if (job["repetition"]["is_repeat"] == true) {
            var sub_jobs = job["children"];

            for (var i in sub_jobs) {
                if (sub_jobs[i]["result_val"] == result_val) {

                    if (sub_jobs[i]["repetition"]["is_repeat"] == true) {
                        repeat_job = sub_jobs[i];
                        subJob = "";
                        break;
                    } else {
                        subJob = sub_jobs[i];
                        repeat_job = "";
                        break;
                    }
                }
            }
        } else {
            repeat_job = job;
            subJob = "";
        }

        obj.subJob = subJob;
        obj.repeat_job = repeat_job;
        return obj;
    } catch (error) {
        CL("D", ServiceName, "Exception occured while getSubJobofRepeatJob. Error : " + error, objLogInfo);
    }
}


function executeSubJob(mResCas, objLogInfo, subjob, MainJobRule, service_response, callback) {
    try {
        var template_name = subjob["job_rule_template"];
        CL("I", ServiceName, "Sub Job Execution Started");
        var SCHEDULEOBJ = {};
        SCHEDULEOBJ.UNIQUE_ID = subjob["unique_id"];
        SCHEDULEOBJ.RETRY_JOB_COUNT = "";
        ruleHelper.CreateJobFromTemplate(mResCas, objLogInfo, template_name, MainJobRule, service_response, subjob, function (job_name, app_id, job_detail) {
            if ((job_name !== "") && (job_detail !== "")) {
                CL("I", ServiceName, "Created new Sub Job");
                if ((job_detail["STATUS"] == "SUCCESS") || (job_detail["STATUS"] == "Success")) {

                    var QUERY_GET_JOB_DETAIL = "select * from SCH_JOBS where job_name = %s allow filtering";
                    jobHelper.GetJobDetailNew(mResCas, QUERY_GET_JOB_DETAIL, objLogInfo, job_name, function (callback_job_detail) {
                        if ((callback_job_detail.STATUS == "SUCCESS") || (callback_job_detail.STATUS == "Success")) {
                            var job_data = callback_job_detail.DATA;
                            CL("I", ServiceName, "Preparing to execute Sub Job Schedule");
                            prepareCronJobAPI(objLogInfo, job_data, mResCas, "dep_cas", job_data.routing_key, SCHEDULEOBJ);
                            callback();
                        }
                    });
                }
            } else {
                callback();
            }
        });
    } catch (error) {
        CL("D", ServiceName, "Exception occured while executeSubJob. Error : " + error, objLogInfo);
    }
}

function executeRepeatJob(mResCas, objLogInfo, job, MainJobRule, service_response, callback) {
    try {
        var template_name = job["job_rule_template"];
        var retry_count = 1;
        var SCHEDULER_DETAILS = service_response["SCHEDULER_DETAILS"] || "";
        CL("I", ServiceName, "Repeat Job Execution Started");
        var job_count = 1;
        if (SCHEDULER_DETAILS.RETRY_JOB_COUNT === "") {
            job_count = 1;
        } else {
            job_count = parseInt(SCHEDULER_DETAILS.RETRY_JOB_COUNT) + 1;
        }
        service_response["SCHEDULER_DETAILS"] = SCHEDULER_DETAILS;
        ruleHelper.CreateJobFromTemplate(mResCas, objLogInfo, template_name, MainJobRule, service_response, job, function (job_name, app_id, job_detail) {
            var SCHEDULEOBJ = {};
            SCHEDULEOBJ.UNIQUE_ID = job["unique_id"];
            //SCHEDULEOBJ.RETRY_JOB_NAME = job_name;
            SCHEDULEOBJ.RETRY_JOB_COUNT = job_count;
            service_response["SCHEDULER_DETAILS"] = SCHEDULEOBJ;
            ruleHelper.UpdateJobSchDetails(mResCas, objLogInfo, job_name, service_response, job_count, function (callback_update) {
                if ((job_name !== "") && (job_detail !== "")) {
                    if ((job_detail["STATUS"] == "SUCCESS") || (job_detail["STATUS"] == "Success")) {
                        CL("I", ServiceName, "Repeat Job Count for " + job_count + " for job " + job_name);
                        if (parseInt(job_count) <= parseInt(job["repetition"]["repeat_count"])) {
                            CL("I", ServiceName, "Job count Eligible for repetition for job " + job_name);
                            if (service_response[job.result_key] === job.result_val) {
                                CL("I", ServiceName, "Job result eligible for repetition for job " + job_name);
                                var QUERY_GET_JOB_DETAIL = "select * from SCH_JOBS where job_name = %s allow filtering";
                                jobHelper.GetJobDetailNew(mResCas, QUERY_GET_JOB_DETAIL, objLogInfo, job_name, function (callback_job_detail) {
                                    if ((callback_job_detail.STATUS == "SUCCESS") || (callback_job_detail.STATUS == "Success")) {
                                        var job_data = callback_job_detail.DATA;
                                        prepareCronJobAPI(objLogInfo, job_data, mResCas, "dep_cas", job_data.routing_key, SCHEDULEOBJ);
                                        callback();
                                    }
                                });
                            } else {
                                CL("I", ServiceName, "Job result not eligible for repetition for job " + job_name);
                                //processJobDetailsFromJobRule(mResCas, objLogInfo, job.parent_id, MainJobRule, service_response);
                                execJobAfterRepeatProcess(job, service_response, mResCas, objLogInfo, MainJobRule, job_name);

                            }

                        } else {
                            CL("I", ServiceName, "Job count not eligible for repetition");
                            execJobAfterRepeatProcess(job, service_response, mResCas, objLogInfo, MainJobRule, job_name);
                        }
                    } else {

                    }
                } else {
                    callback();
                }
            });
        });

        function execJobAfterRepeatProcess(job, service_response, mResCas, objLogInfo, MainJobRule, job_name) {
            try {
                if (job["children"] !== undefined) {
                    CL("I", ServiceName, "Executing child job for repeat job " + job_name);
                    var subJobForRepeatJob = getSubJobofRepeatJob(job, service_response);
                    if (subJobForRepeatJob["subJob"] !== "") {
                        CL("I", ServiceName, "Executing child job which is a Subjob for repeat job " + job_name);
                        executeSubJob(mResCas, objLogInfo, subJobForRepeatJob.subJob, MainJobRule, service_response, function () {
                            callback();
                        });
                    }
                    if (subJobForRepeatJob["repeat_job"] !== "") {
                        CL("I", ServiceName, "Executing the same repeat job " + job_name);
                        service_response["SCHEDULER_DETAILS"]["RETRY_JOB_COUNT"] = 0;
                        processJobDetailsFromJobRule(mResCas, objLogInfo, subJobForRepeatJob["repeat_job"].unique_id, MainJobRule, service_response);
                    }
                } else {
                    CL("I", ServiceName, "No child job present for " + job_name + " so exiting ");
                }
            } catch (error) {
                CL("D", ServiceName, "Exception occured while execJobAfterRepeatProcess. Error : " + error, objLogInfo);
            }
        }
    } catch (error) {
        CL("D", ServiceName, "Exception occured while executeRepeatJob. Error : " + error, objLogInfo);
    }
}

function emitSocket(params, callback) {
    reqInstanceHelper.EmitSocketMessage('scheduler_socket', params.job_name, params, (result) => {
        callback(result);
    });
}

function callapi(obj) {
    try {
        CL("I", ServiceName, "callapi ", objLogInfo);
        var pattern = /^((http|https):\/\/)/;
        var pattern1 = /^(www)/;
        var API = obj["API"];
        var jobInfo = obj["jobInfo"];
        // Catching the while parsing the scheduler_info JSON 
        try {
            var scheduler_info = jobInfo.scheduler_info && JSON.parse(jobInfo.scheduler_info) || {};
        } catch (error) { }
        var URLPrecedence = obj["URLPrecedence"];
        var METHOD_TYPE = obj["METHOD_TYPE"];
        var ROUTING_KEY = obj["ROUTING_KEY"];
        var METHOD_ARGS = obj["METHOD_ARGS"];
        var objLogInfo = obj["objLogInfo"];
        var job_name = obj["job_name"];
        var mDevCas = obj["mDevCas"];
        var APP_ID = obj["APP_ID"];
        var job_description = obj["job_description"];
        var SCHJTL_ID = uuid.v4();
        var thread_id = util.GetTimeStamp();
        var job_inc_id = uuid.v4();
        var onDemandJobStartTime = new Date();
        var jobNotificationReqObj = {
            jobInfo: jobInfo,
            fromWhere: 'JOB_START',
            objLogInfo
        };
        // For Job Start
        CL("I", ServiceName, "SendJobNotifications going to call ---------------", objLogInfo);
        jobHelper.SendJobNotifications(jobNotificationReqObj);
        jobHelper.UpdateJobStatus(mDevCas, objLogInfo, job_name, APP_ID, "STARTED", function () { });
        updateJobsLogCommon(mDevCas, objLogInfo, 'insert', constants.JOBSTARTED, onDemandJobStartTime, null, "", job_name, job_description, APP_ID, ROUTING_KEY, job_inc_id); // Job Started
        var req_type_json = {};
        // Check if Url is not public URL
        if (!pattern.test(API) && !pattern1.test(API)) {
            if (getCharacterFromString("FIRST", API) !== '/') {
                API = "/" + API;
            }
            if (getCharacterFromString("LAST", URLPrecedence) == "/") {
                URLPrecedence = URLPrecedence.slice(0, -1);
            }
            API = URLPrecedence + API;
        }
        CL('S', ServiceName, 'CALLING API  ' + API);
        if (METHOD_TYPE === "POST") {
            req_type_json = {
                url: API,
                method: "POST",
                json: true,
                body: METHOD_ARGS,
                headers: {
                    "RoutingKey": ROUTING_KEY,
                    "session-id": METHOD_ARGS.session_id
                }
            };
        } else {
            req_type_json = {
                url: API,
                method: "GET",
                json: true,
                body: METHOD_ARGS,
                headers: {
                    "RoutingKey": ROUTING_KEY
                }
            };
        }
        // Getting Timeout Value from the Scheduler Info
        if (scheduler_info && scheduler_info.thread_wait_time) {
            req_type_json.timeout = Number(scheduler_info.thread_wait_time) * 1000; // Convert into Milli Seconds
        }
        if (METHOD_ARGS.session_id != undefined) {
            req_type_json.headers["session-id"] = METHOD_ARGS.session_id;
        }
        // For Job Thread Start
        jobNotificationReqObj.fromWhere = 'JOB_THREAD_START';
        // Creating a Multiple CRON Jobs Based on No of Job Threads at a time
        // Getting Job Thread Count From the Scheduler Info
        var threadCount = (scheduler_info.thread_count && Number(scheduler_info.thread_count)) || 1;
        CL('I', ServiceName, 'Thread Count - ' + threadCount, objLogInfo);
        for (let v = 0; v < threadCount; v++) {
            jobHelper.SendJobNotifications(jobNotificationReqObj);
            updateThreadLogCommon(mDevCas, objLogInfo, 'insert', job_inc_id, job_name, thread_id, constants.THREADSTARTED, onDemandJobStartTime, null, "", APP_ID, ROUTING_KEY, '', function () { }); // Thread Started
            reqInstanceHelper.PrintInfo(ServiceName, 'Job Type - OnDemand', objLogInfo);
            reqInstanceHelper.PrintInfo(ServiceName, 'Job Description - ' + job_description, objLogInfo);
            reqInstanceHelper.PrintInfo(ServiceName, 'Job API - ' + API, objLogInfo);
            request(req_type_json, function (error, response, body) {
                var socket_message = {
                    status: '',
                    error: '',
                    data: '',
                    job_name: ''
                };
                var notifymsg = JSON.stringify(body);
                socket_message.job_name = job_name;
                socket_message.data = notifymsg;
                if (error || response && response.statusCode !== 200 && response.statusCode !== 304) {
                    var apiError = error || body || '';
                    apiError = (typeof apiError !== 'string') && JSON.stringify(apiError) || apiError;
                    // For Job Thread Termination
                    jobNotificationReqObj.fromWhere = 'JOB_THREAD_TERMINATION';
                    jobNotificationReqObj.error_msg = 'Error in Request API Module Callback..';
                    jobNotificationReqObj.node_error_msg = apiError;
                    jobHelper.SendJobNotifications(jobNotificationReqObj);
                    reqInstanceHelper.PrintInfo(ServiceName, 'Job API - ' + API + ' and Its Result - ' + apiError, objLogInfo);
                    socket_message.status = 'Failure';
                    socket_message.error = apiError;
                    emitSocket(socket_message, (result) => {
                        if (result == 'SUCCESS') {
                            CL('S', ServiceName, 'MESSAGE emitted to : ' + job_name);
                        } else {
                            CL('S', ServiceName, 'Problem in MESSAGE emit : ' + job_name);
                        }
                    });
                    // Allowing Only one Time 
                    if (v == 0) {
                        jobHelper.UpdateJobStatus(mDevCas, objLogInfo, job_name, APP_ID, "ABORTED", function () { });
                        updateJobsLogCommon(mDevCas, objLogInfo, 'update', constants.JOBABORTED, onDemandJobStartTime, new Date(), "", job_name, job_description, APP_ID, ROUTING_KEY, job_inc_id); // Job Started
                    }
                    updateThreadLogCommon(mDevCas, objLogInfo, 'update', job_inc_id, job_name, thread_id, constants.THREADABORTED, onDemandJobStartTime, new Date(), JSON.stringify(error), APP_ID, ROUTING_KEY, ''); // Thread Started

                } else {
                    reqInstanceHelper.PrintInfo(ServiceName, 'Job API - ' + API + ' and Its Result - ' + notifymsg, objLogInfo);
                    // For Job Thread Stop
                    jobNotificationReqObj.fromWhere = 'JOB_THREAD_END';
                    jobHelper.SendJobNotifications(jobNotificationReqObj);
                    socket_message.status = body.NOTIFY_RESULT ? body.NOTIFY_RESULT : 'Success';
                    emitSocket(socket_message, (result) => {
                        if (result == 'SUCCESS') {
                            CL('S', ServiceName, 'MESSAGE emitted to : ' + job_name);
                        } else {
                            CL('S', ServiceName, 'Problem in MESSAGE emit : ' + job_name);
                        }
                    });
                    // Allowing Only one Time 
                    if (v == 0) {
                        jobHelper.UpdateJobStatus(mDevCas, objLogInfo, job_name, APP_ID, "STOPPED", function () { });
                        updateJobsLogCommon(mDevCas, objLogInfo, 'update', constants.JOBSTOPPED, onDemandJobStartTime, new Date(), "", job_name, job_description, APP_ID, ROUTING_KEY, job_inc_id); // Job Started
                    }
                    updateThreadLogCommon(mDevCas, objLogInfo, 'update', job_inc_id, job_name, thread_id, constants.THREADSTOPPED, onDemandJobStartTime, new Date(), "", APP_ID, ROUTING_KEY, notifymsg); // Thread Started
                }
            });
        }

        // For Job End
        jobNotificationReqObj.fromWhere = 'JOB_END';
        jobHelper.SendJobNotifications(jobNotificationReqObj);
    } catch (error) {
        // For Job Thread Termination
        jobNotificationReqObj.fromWhere = 'JOB_THREAD_TERMINATION';
        jobNotificationReqObj.error_msg = 'Catch Error in callapi()..';
        jobNotificationReqObj.node_error_msg = error.stack;
        jobHelper.SendJobNotifications(jobNotificationReqObj);
        CL('S', ServiceName, 'JOB ABORTED DUE TO THE FOLLOWING ERROR');
        CL('S', ServiceName, error);
        jobHelper.UpdateJobStatus(mDevCas, objLogInfo, job_name, APP_ID, "ABORTED", function () { });
        setTimeout(function () {
            updateJobsLogCommon(mDevCas, objLogInfo, 'update', constants.JOBABORTED, onDemandJobStartTime, new Date(), JSON.stringify(error), job_name, job_description, APP_ID, ROUTING_KEY, job_inc_id); // Job Started
            updateThreadLogCommon(mDevCas, objLogInfo, 'update', job_inc_id, job_name, thread_id, constants.THREADABORTED, onDemandJobStartTime, new Date(), JSON.stringify(error), APP_ID, ROUTING_KEY, ''); // Thread Started
        }, 2000);
    }
}


// function executeRepeatJobOld(mResCas, objLogInfo, job, MainJobRule, service_response, callback) {
//     var job_name = job["job_name"];

//     var SCHEDULEOBJ = {};
//     SCHEDULEOBJ.UNIQUE_ID = job["unique_id"];
//     SCHEDULEOBJ.HAS_SCHEDULE_RETRY = true;
//     SCHEDULEOBJ.SCHEDULE_RETRY_COUNT = "";

//     jobHelper.GetRetryCount(mResCas, objLogInfo, job_name, function (callback_retrycount) {
//         if (callback_retrycount !== "") {
//             if (parseInt(callback_retrycount) < parseInt(job["repetition"]["repeat_count"])) {
//                 var QUERY_GET_JOB_DETAIL = "select * from SCH_JOBS where job_name = %s allow filtering ";
//                 jobHelper.GetJobDetailNew(mResCas, QUERY_GET_JOB_DETAIL, objLogInfo, job_name, function (callback_job_detail) {
//                     if ((callback_job_detail.STATUS == "SUCCESS") || (callback_job_detail.STATUS == "Success")) {
//                         var job_data = callback_job_detail.DATA
//                         prepareCronJobAPI(objLogInfo, job_data, mResCas, "dep_cas", job_data.routing_key, SCHEDULEOBJ);
//                         callback();

//                     }
//                 })
//             } else {
//                 // exit
//             }
//         } else {
//             // exit (need to check)
//         }
//     })

// }
function executeBatchJob(pHeaders, batch_flow_id, batch_job_arr, batch_id, job_id, process_id, callback) {
    try {
        reqFXDBInstance.GetFXDBConnection(pHeaders, "dep_cas", {}, function (pCltClient) {
            mDevCas = pCltClient;
            batch_job_arr = JSON.parse(batch_job_arr);
            var batches = batch_job_arr[0]['children'];
            var batch = [];
            var job = {};
            var nextBatchCount = "";
            var nextJobCount = "";
            var currentBatch = [];
            var currentJob = {};
            var nextJob = {};
            var nextBatch = "";
            var currentBatchJobs = '';
            var nextJobofnextBranch = '';
            var jobExecuted = false;
            if (batch_id == '') {
                currentBatch = getFirstOrderBatch(batch_job_arr);
            } else {
                currentBatch = getBatchFromBatches(batches, batch_id);
            }
            currentBatchJobs = currentBatch['children'];
            currentJob = getJobFromJobs(currentBatch['children'], job_id);
            nextBatch = getNextBatch(batches, currentBatch);
            nextJobofCurrentBranch = getNextJob(currentBatchJobs, currentJob);

            if (nextJobofCurrentBranch == "") {
                // if (currentBatchJobs.length > 0) {
                //     if (currentJob['id'] == undefined) {
                //         var currentJobofCurrentBranch = getFirstOrderJobofBatch(currentBatch);
                //         jobExecuted = true;
                //         executeJob(pHeaders, batch_flow_id, currentBatch['id'], currentJobofCurrentBranch,process_id, function (response) {
                //             createBatchProcessLog(pHeaders,mDevCas, process_id, batch_flow_id, 'INPROGRESS', 'UPDATE', function (resp) {
                //                 createBatchProcessProcessLog(pHeaders,mDevCas, process_id, currentBatch['id'],currentJobofCurrentBranch['id'], 'CREATED', 'CREATE', function(resp2){
                //                     return callback('EXECUTED');
                //                 })
                //             })
                //         });
                //     } else {
                //         jobExecuted = true;

                //         executeJob(pHeaders, batch_flow_id, currentBatch['id'], currentJob,process_id, function (response) {
                //             createBatchProcessLog(pHeaders,mDevCas, process_id, batch_flow_id, 'INPROGRESS', 'UPDATE', function (resp) {
                //                 createBatchProcessProcessLog(pHeaders,mDevCas, process_id, currentBatch['id'],currentJob['id'], 'CREATED', 'CREATE', function(resp2){
                //                     return callback('EXECUTED');
                //                 })
                //             });
                //         });
                //     }
                // }
                if (nextBatch != '') {
                    nextJobofnextBranch = getFirstOrderJobofBatch(nextBatch);
                    if (nextJobofnextBranch != '') {

                        executeJob(pHeaders, batch_flow_id, nextBatch['id'], nextJobofnextBranch, process_id, function (response) {
                            createBatchProcessLog(pHeaders, mDevCas, process_id, batch_flow_id, 'INPROGRESS', 'UPDATE', function (resp) {
                                createBatchProcessProcessLog(pHeaders, mDevCas, process_id, nextBatch['id'], nextJobofnextBranch['id'], 'INPROGRESS', 'CREATE', '', function (resp2) {
                                    return callback('EXECUTED');
                                });
                            });
                        });
                    } else {
                        createBatchProcessLog(pHeaders, mDevCas, process_id, batch_flow_id, 'COMPLETED', 'UPDATE', function (resp) {
                            return callback('COMPLETED');
                        });
                    }
                } else {
                    createBatchProcessLog(pHeaders, mDevCas, process_id, batch_flow_id, 'COMPLETED', 'UPDATE', function (resp) {
                        return callback('COMPLETED');
                    });
                }
            } else {
                jobExecuted = true;
                executeJob(pHeaders, batch_flow_id, currentBatch['id'], nextJobofCurrentBranch, process_id, function (response) {
                    createBatchProcessLog(pHeaders, mDevCas, process_id, batch_flow_id, 'INPROGRESS', 'UPDATE', function (resp) {
                        createBatchProcessProcessLog(pHeaders, mDevCas, process_id, currentBatch['id'], nextJobofCurrentBranch['id'], 'INPROGRESS', 'CREATE', '', function (resp2) {
                            return callback('EXECUTED');
                        });
                    });
                });
            }

        });
    } catch (error) {
        CL("D", ServiceName, "Exception occured while executeBatchJob. Error : " + error, objLogInfo);
    }
}


function createBatchProcessLog(pHeaders, mDevCas, process_id, batch_id, batch_process_status, type, callback) {
    try {
        var query = "";
        var datecurrent = dateString(new Date(), pHeaders);
        var query_sch_batch_process_job_log = '';
        var objLogInfo = {};
        var resdata = {};
        if (type == 'CREATE') {
            query = "insert into sch_batch_process_log(process_id,batch_id,started_on,batch_process_status) values('" + process_id + "','" + batch_id + "'," + datecurrent + ",'" + batch_process_status + "')";
        } else {
            if (batch_process_status == 'INPROGRESS') {
                datecurrent = '';
            }
            query = "update sch_batch_process_log set ended_on = " + datecurrent + ",batch_process_status = '" + batch_process_status + "' where process_id = '" + process_id + "' and batch_id = '" + batch_id + "'";
        }
        reqFXDBInstance.ExecuteQuery(mDevCas, query, objLogInfo, function (pErr, pResult) {
            if (pErr) {
                resdata.STATUS = constants.FAILURE;
                resdata.MESSAGE = '';
                resdata.DATA = '';
                return callback(resdata);
            } else {
                resdata.STATUS = constants.SUCCESS;
                resdata.MESSAGE = '';
                resdata.DATA = '';
                return callback(resdata);
            }
        });
    }
    catch (ex) {
        resdata.STATUS = constants.FAILURE;
        resdata.MESSAGE = '';
        resdata.DATA = ex;
        return callback(resdata);
    }

}


function createBatchProcessProcessLog(pHeaders, mDevCas, process_id, batch_id, job_id, job_status, type, response, callback) {
    try {
        var query = "";
        var datecurrent = dateString(new Date(), pHeaders);
        var objLogInfo = {};
        var query_sch_batch_process_job_log = '';
        var resdata = {};

        if (type == 'CREATE') {
            query = "insert into sch_batch_process_job_log(process_id,batch_id,job_id,started_on,job_status) values('" + process_id + "','" + batch_id + "','" + job_id + "' , " + datecurrent + ",'" + job_status + "')";

        } else {
            query = "update sch_batch_process_job_log set ended_on = " + datecurrent + ",job_status = '" + job_status + "' , job_response = '" + response + "' where process_id = '" + process_id + "' and batch_id = '" + batch_id + "' and job_id = '" + job_id + "'";
        }

        reqFXDBInstance.ExecuteQuery(mDevCas, query, objLogInfo, function (pErr, pResult) {
            try {
                if (pErr) {
                    resdata.STATUS = constants.FAILURE;
                    resdata.MESSAGE = '';
                    resdata.DATA = '';
                    return callback(resdata);
                } else {
                    resdata.STATUS = constants.SUCCESS;
                    resdata.MESSAGE = '';
                    resdata.DATA = '';
                    return callback(resdata);
                }
            } catch (error) {
                CL("D", ServiceName, "Exception occured while createBatchProcessProcessLog callback. Error : " + error, objLogInfo);
            }
        });
    } catch (error) {
        CL("D", ServiceName, "Exception occured while createBatchProcessProcessLog. Error : " + error, objLogInfo);
    }

}

function executeJob(pHeaders, batch_flow_id, batchid, jobDetail, process_id, callback) {
    try {
        var METHOD_TYPE = jobDetail.calling_method;
        var API = jobDetail.object_name;
        var METHOD_ARGS = JSON.parse(jobDetail.param_json);
        METHOD_ARGS['batch_flow_id'] = batch_flow_id;
        METHOD_ARGS['batch_id'] = batchid;
        METHOD_ARGS['job_id'] = jobDetail['id'];
        METHOD_ARGS['app_headers'] = pHeaders;
        METHOD_ARGS['process_id'] = process_id;
        var req_type_json = {};
        if (METHOD_TYPE === "POST") {
            req_type_json = {
                url: API,
                method: "POST",
                json: true,
                body: METHOD_ARGS
            };
        } else {
            req_type_json = {
                url: API,
                method: "GET",
                json: true,
                body: METHOD_ARGS
            };
        }
        if (METHOD_ARGS.session_id != undefined) {
            req_type_json.headers["session-id"] = METHOD_ARGS.session_id;
        }
        try {
            request(req_type_json, function (error, response, body) {
                callback(body);
            });
        } catch (ex) {
            callback(ex);
        }
    } catch (ex) {
        callback(ex);
    }
}



function getFirstOrderJobofBatch(batch_arr) {
    batch_arr = batch_arr['children'];
    for (var i = 0; i < batch_arr.length; i++) {
        if (batch_arr[i]['order'] == 1) {
            return batch_arr[i];
        }
    }
    return '';
}

function getFirstOrderJob(jobs_arr) {
    for (var i = 0; i < jobs_arr.length; i++) {
        if (jobs_arr[i]['order'] == 1) {
            return jobs_arr[i];
        }
    }

    return '';
}

function getFirstOrderBatch(batch_arr) {
    batch_arr = batch_arr[0]['children'];
    for (var i = 0; i < batch_arr.length; i++) {
        if (batch_arr[i]['order'] == 1) {
            return batch_arr[i];
        }
    }
    return '';
}

function getBatchFromBatches(batch_arr, batch_id) {
    var jobs = [];
    for (var i = 0; i < batch_arr.length; i++) {
        if (batch_arr[i]['id'] == batch_id) {
            jobs = batch_arr[i];
            return jobs;
        }
    }

    return jobs;
}


function getJobFromJobs(jobs_arr, job_id) {
    var job = {};
    for (var i = 0; i < jobs_arr.length; i++) {
        if (jobs_arr[i]['id'] == job_id) {
            job = jobs_arr[i];
            return job;
        }
    }

    return job;
}

function getNextBatch(batch_arr, current_batch) {
    for (var i = 0; i < batch_arr.length; i++) {
        if (batch_arr[i]['order'] == current_batch['order'] + 1) {
            return batch_arr[i];
        }
    }
    return "";
}


function getNextJob(job_arr, current_job) {
    if (current_job['order'] == undefined) {
        for (var i = 0; i < job_arr.length; i++) {
            if (job_arr[i]['order'] == 1) {
                return job_arr[i];
            }
        }
    }
    else {
        for (var i = 0; i < job_arr.length; i++) {
            if (job_arr[i]['order'] == current_job['order'] + 1) {
                return job_arr[i];
            }
        }
    }

    return "";
}

function getandExecuteBatchFlowDetail(app_headers, batch_flow_id, batch_id, job_id, process_id, callback) {
    try {
        var mDevCas = '';
        var resdata = {};
        var objLogInfo = {};
        reqFXDBInstance.GetFXDBConnection(app_headers, "dep_cas", objLogInfo, function (pCltClient) {
            mDevCas = pCltClient;
            var query = "select * from sch_batch where batch_id = '" + batch_flow_id + "' allow filtering";
            reqFXDBInstance.ExecuteQuery(mDevCas, query, objLogInfo, function (pErr, pResult) {
                try {
                    if (pErr) {
                        resdata.STATUS = constants.FAILURE;
                        resdata.MESSAGE = '';
                        resdata.DATA = '';
                        return callback(resdata);
                    } else {
                        if (pResult.rows.length > 0) {
                            var obj = pResult.rows[0];
                            executeBatchJob(app_headers, obj['batch_id'], obj['batch_job_info'], batch_id, job_id, process_id, function (resp) {
                                resdata.STATUS = constants.SUCCESS;
                                return callback(resdata);
                            });
                        } else {
                            resdata.STATUS = constants.FAILURE;
                            resdata.MESSAGE = '';
                            resdata.DATA = '';
                            return callback(resdata);
                        }
                    }
                } catch (error) {
                    resdata.STATUS = constants.FAILURE;
                    resdata.MESSAGE = '';
                    resdata.DATA = error;
                    CL("D", ServiceName, "Exception occured while getandExecuteBatchFlowDetail callback. Error : " + error, objLogInfo);
                    return callback(resdata);
                }
            });
        });
    } catch (e) {
        resdata.STATUS = constants.FAILURE;
        resdata.MESSAGE = '';
        resdata.DATA = e;
        CL("D", ServiceName, "Exception occured while getandExecuteBatchFlowDetail. Error : " + e, objLogInfo);
        return callback(resdata);
    }
}

function dateString(date, headers) {
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

async function getredisconn(pIndex) {
    try {
        return new Promise((resolve, reject) => {
            reqRedisInstance.GetRedisConnectionwithIndex(pIndex, function (error, redisconn) {
                resolve(redisconn)
            })
        })
    } catch (error) {

    }
}

async function redisInsert(RedisSession, pkey, pvalue) {
    return new Promise(async (resolve, reject) => {
        // reqRedisInstance.RedisInsert(RedisSession, pkey, pvalue, -1)
        await RedisSession.set(pkey, pvalue)
        resolve()
    })
}

module.exports = {
    PrepareCronJobAPI: prepareCronJobAPI,
    StopCronJob: stopCronJob,
    RemoveCronJob: removeCronJob,
    ExecuteBatchJob: executeBatchJob,
    GetandExecuteBatchFlowDetail: getandExecuteBatchFlowDetail,
    CreateBatchProcessLog: createBatchProcessLog,
    CreateBatchProcessProcessLog: createBatchProcessProcessLog,
    CheckAndPublishInRedis: CheckAndPublishInRedis
};