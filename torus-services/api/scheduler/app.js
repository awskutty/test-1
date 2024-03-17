process.title = 'Torus_Svc_Scheduler';
var reqInstanceHelper = require('../../../torus-references/common/InstanceHelper');
var schUtil = require('./routes/util/schedulerUtil');
var reqSolrHelper = require('../../../torus-references/log/trace/SolrLogHelper');
var servicePath = 'Scheduler';
var servicePathConsumer = 'SCHEDULER_CONSUMER';
global.serviceName = 'SCHEDULER';
var uuid = require('../../../node_modules/' + 'uuid');
var reqOs = require("os");

var reqFXDBInstance = require('../../../torus-references/instance/DBInstance');
var redis = require("redis");
var redisInstance = require('../../../torus-references/instance/RedisInstance');
var serviceNamePad = 20;


// Include the cluster module
var reqCluster = require('cluster');
// Code to run if we're in the master process
if (!reqCluster.isMaster) {
    // Count the machine's CPUs
    var cpuCount = reqOs.cpus().length;
    // Create a worker for each CPU
    for (var i = 0; i < cpuCount; i += 1) {
        reqCluster.fork();
    }
    // Listen for dying workers
    reqCluster.on('exit', function (worker) {
        // Replace the dead worker, we're not sentimental
        console.log('Worker %d died :(', worker.id);
        reqCluster.fork();
    });
    // Code to run if we're in a worker process
} else {
    var reqEvents = require('events');
    var reqAppHelper = require('../../../torus-references/instance/AppHelper');

    var objEvents = new reqEvents();
    objEvents.on('EventAfterInit', AfterInitDBListener);
    // reqAppHelper.LoadAllInstanses(servicePath, function (pResult) {
    //     if (pResult == 'SUCCESS') {
    //         reqInstanceHelper.PrintInfo(servicePath, 'Instances loaded successfully.', null);
    //         var serviceModel = (reqFXDBInstance.DBInstanceSession && reqFXDBInstance.DBInstanceSession['SERVICE_MODEL']) || null;
    //         // To set the latest platform version property in the global to access anywhere without writing extra code..
    //         if (serviceModel && serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
    //             global.isLatestPlatformVersion = true;
    //             // global.isLatestPlatformVersion = false;
    //         } else {
    //             global.isLatestPlatformVersion = false;
    //         }
    //         objEvents.emit('EventAfterInit');
    //     }
    // });

    reqInstanceHelper.GetConfig('SERVICE_MODEL', function (ResSvcModel) {
        reqFXDBInstance.LoadServiceModel('SERVICE_MODEL', JSON.parse(ResSvcModel), function (res) {
            reqInstanceHelper.PrintInfo(servicePath, 'Instances loaded successfully.', null);
            var serviceModel = (reqFXDBInstance.DBInstanceSession && reqFXDBInstance.DBInstanceSession['SERVICE_MODEL']) || null;
            // To set the latest platform version property in the global to access anywhere without writing extra code..
            if (serviceModel && serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
                global.isLatestPlatformVersion = true;
                // global.isLatestPlatformVersion = false;
            } else {
                global.isLatestPlatformVersion = false;
            }
            objEvents.emit('EventAfterInit');
        });
    })

    function AfterInitDBListener() {
        var arrRoutes = [];
        var reqPing = require('./routes/Ping');
        var getIdeProjects = require('./routes/getIdeProjects');

        // Route initialization for scheduler template
        var scheduler_template_create = require('./routes/scheduler-template-create');
        var scheduler_template_edit = require('./routes/scheduler-template-edit');
        var scheduler_template_delete = require('./routes/scheduler-template-delete');
        var scheduler_template_list = require('./routes/scheduler-template-list');
        var scheduler_template_detail = require('./routes/scheduler-template-detail');

        // Route initialization for scheduler job
        var scheduler_job_create = require('./routes/scheduler-job-create');
        var scheduler_job_delete = require('./routes/scheduler-job-delete');
        var scheduler_job_list = require('./routes/scheduler-job-list');
        var scheduler_job_start = require('./routes/scheduler-job-start');
        var scheduler_job_startall = require('./routes/scheduler-job-startall');
        var scheduler_job_stop = require('./routes/scheduler-job-stop');
        var scheduler_job_stopall = require('./routes/scheduler-job-stopall');
        var scheduler_job_detail = require('./routes/scheduler-job-detail');

        var scheduler_log_jobs = require('./routes/scheduler-log-jobs');
        var scheduler_thread_log = require('./routes/scheduler-log-thread');

        // var schedule_template_create = require('./routes/schedule-template-create');
        // var schedule_template_list = require('./routes/schedule-template-list');
        // var schedule_template_detail = require('./routes/schedule-template-detail');

        var scheduler_rule = require('./routes/initiateScheduleJob');
        var get_job_rule = require('./routes/getJobRule');
        var update_job_rule = require('./routes/updateJobRule');
        var scheduler_batch_create = require('./routes/scheduler-batch-create');
        var scheduler_batch_list = require('./routes/scheduler-batch-list');
        var scheduler_batch_delete = require('./routes/scheduler-batch-delete');
        var scheduler_batch_update = require('./routes/scheduler-batch-update');
        var scheduler_batch_call = require('./routes/scheduler-batch-call');
        var scheduler_batch_fetch_log = require('./routes/scheduler-batch-fetch-log');
        var scheduler_batch_fetch_process_log = require('./routes/scheduler-batch-fetch-process-log');

        arrRoutes.push(reqPing);
        arrRoutes.push(getIdeProjects);
        arrRoutes.push(scheduler_template_create);
        arrRoutes.push(scheduler_template_edit);
        arrRoutes.push(scheduler_template_delete);
        arrRoutes.push(scheduler_template_list);
        arrRoutes.push(scheduler_template_detail);
        arrRoutes.push(scheduler_job_create);
        arrRoutes.push(scheduler_job_delete);
        arrRoutes.push(scheduler_job_list);
        arrRoutes.push(scheduler_job_start);
        arrRoutes.push(scheduler_job_startall);
        arrRoutes.push(scheduler_job_stop);
        arrRoutes.push(scheduler_job_stopall);
        arrRoutes.push(scheduler_job_detail);
        arrRoutes.push(scheduler_log_jobs);
        arrRoutes.push(scheduler_thread_log);
        arrRoutes.push(scheduler_rule);
        arrRoutes.push(get_job_rule);
        arrRoutes.push(update_job_rule);
        arrRoutes.push(scheduler_batch_create);
        arrRoutes.push(scheduler_batch_list);
        arrRoutes.push(scheduler_batch_delete);
        arrRoutes.push(scheduler_batch_update);
        arrRoutes.push(scheduler_batch_call);
        arrRoutes.push(scheduler_batch_fetch_log);
        arrRoutes.push(scheduler_batch_fetch_process_log);
        // To start all jobs if already in started status 
        jobStartup();
        // Using Consumer To Get the Start n Stop Job Payload [multi node concept]
        var reqConsumer = require('./routes/consumer');
        if (global.isLatestPlatformVersion) {
            reqConsumer.StartConsuming();
        }
        reqAppHelper.StartService(servicePath, arrRoutes, __dirname);

    }

}

if (process.env.NODE_ENV == 'production') {
    console.log = function () { };
}


// jobStartup();

function jobStartup() {
    console.log("Job At Startup");
    var rootpath = "../../";
    var schedulerUtil = require('./routes/util/schedulerUtil');
    //var reqCasInstance = require(rootpath + 'references/helper/CassandraInstance');
    //var reqFXDBInstance = require('../../../torus-references/instance/DBInstance')
    var jobHelper = require('./routes/helper/jobHelper');
    var pHeaders = {};
    var objLogInfo = {};
    var mDepCas = "";

    reqFXDBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function (pClient) {

        mDepCas = pClient;
        var QUERY_GET_JOB_DETAIL = {};
        QUERY_GET_JOB_DETAIL.Table_Name = 'SCH_JOBS';
        QUERY_GET_JOB_DETAIL.Cond_Obj = { STATUS: 'STARTED' };
        objLogInfo.isFromServiceStartUp = true;
        // objLogInfo.doRedisPubSub = true;
        objLogInfo.scheduleTheJob = true;
        objLogInfo.doDBOperations = false;
        jobHelper.StartAllJobs(mDepCas, objLogInfo, '', 'dep_cas', QUERY_GET_JOB_DETAIL, false, schedulerUtil, {}, function (response) {
            // res.send(response)
        });

    });
}




global.CL = function (console_type, ServiceName, data, objLogInfo) {
    try {
        var time = "";
        var keyword = '';
        if (console_type == 'I' || console_type == 'S') {
            keyword = 'INFO';
        } else if (console_type == 'D') {
            keyword = 'ERROR';
        }

        // keyword = keyword + getPad().substring(0, getPad().length - keyword.toString().length);

        time = getCurrentDateTime();
        var dataType = getDataType(data);
        if (dataType === "STRING") {
            getPad(serviceNamePad, ' ', function (pad) {
                ServiceName = ServiceName + pad.substring(0, pad.length - ServiceName.toString().length);
                consoletext = keyword + " " + time + ":" + ServiceName + " " + data;
                console.log(getConsoleColor(console_type), consoletext);
            });
        } else if (dataType === "OBJECT" || dataType === "ARRAY") {
            getPad(serviceNamePad, ' ', function (pad) {
                ServiceName = ServiceName + pad.substring(0, pad.length - ServiceName.toString().length);
                consoletext = keyword + " " + time + ":" + ServiceName + " " + JSON.stringify(data);
                console.log(getConsoleColor(console_type), consoletext);
            });
        } else {
            getPad(serviceNamePad, ' ', function (pad) {
                ServiceName = ServiceName + pad.substring(0, pad.length - ServiceName.toString().length);
                consoletext = keyword + " " + time + ":" + ServiceName + " " + data;
                console.log(getConsoleColor(console_type), consoletext);
            });
        }
        if (objLogInfo) {
            objLogInfo.MESSAGE = consoletext;
            objLogInfo.LOGTYPE = 'INFO';
            objLogInfo.IS_INFO = 'Y';
            objLogInfo.SERVICEURL = '/scheduler/';
            reqSolrHelper.SaveLogToFile(objLogInfo, function () {

            });
        }
    } catch (error) {
        console.log('Error occured in CL function ' + error);
    }
};

global.UUIDString = function () {
    return uuid.v4();
};


function getConsoleColor(consoleType) {
    switch (consoleType) {
        case "D":
            return "\x1b[31m";
        case "S":
            return "\x1b[32m";
        case "I":
            // return "\x1b[34m"; // blue
            return "\x1b[37m"; // White
    }
}

function getCurrentDateTime() {
    var date = new Date();
    var month = (date.getMonth() + 1) < 10 ? "0" + (date.getMonth() + 1) : (date.getMonth() + 1);
    var day = date.getDate() < 10 ? "0" + date.getDate() : date.getDate();
    var year = date.getFullYear();
    var current_date = year + "-" + month + "-" + day;
    var hours = date.getHours() < 10 ? "0" + date.getHours() : date.getHours();
    var minutes = date.getMinutes() < 10 ? "0" + date.getMinutes() : date.getMinutes();
    var seconds = date.getSeconds() < 10 ? "0" + date.getSeconds() : date.getSeconds();
    time = hours + ":" + minutes + ":" + seconds;
    return current_date + " " + time + " ";
}

function getPad(padCount, padChar, callback) {
    var pad = '';
    for (var j = 0; j < padCount; j++) {
        pad += padChar;
    }
    return callback(pad);
}

function getDataType(object) {
    var stringConstructor = "test".constructor;
    var arrayConstructor = [].constructor;
    var objectConstructor = {}.constructor;

    if (object === null) {
        return "NULL";
    } else if (object === undefined) {
        return "UNDEFINED";
    } else if (object.constructor === stringConstructor) {
        return "STRING";
    } else if (object.constructor === arrayConstructor) {
        return "ARRAY";
    } else if (object.constructor === objectConstructor) {
        return "OBJECT";
    } else {
        return "DONTKNOW";
    }
}


