/*
    @Service name       : Communication,
    @Description        : This is a main file for all api calls in this service,
    @Number of API's    : 2
*/

// Require dependencies
var refPath = '../../../torus-references/'
var reqInstanceHelper = require('../../../torus-references/common/InstanceHelper');
var reqRedisInstance = require('../../../torus-references/instance/RedisInstance');
var servicePath = 'Communication';
var objLogInfo = null;

// Include the cluster module
var reqCluster = require('cluster');
// Code to run if we're in the master process
if (!reqCluster.isMaster) {
    // Count the machine's CPUs
    var cpuCount = require('os').cpus().length;
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
    var reqDBInstance = require('../../../torus-references/instance/DBInstance');
    var objEvents = new reqEvents();
    objEvents.on('EventAfterInit', AfterInitDBListener);
    process.title = 'Torus_Svc_Communication';
    // reqAppHelper.LoadAllInstanses(servicePath, function (pResult) {
    //     if (pResult == 'SUCCESS') {
    //         reqInstanceHelper.PrintInfo(servicePath, 'Instances loaded successfully.', null);
    //         objEvents.emit('EventAfterInit');
    //     }
    // });
    reqInstanceHelper.GetConfig('SERVICE_MODEL', function (ResSvcModel) {
        reqDBInstance.LoadServiceModel('SERVICE_MODEL', JSON.parse(ResSvcModel), function (res) {
            reqInstanceHelper.PrintInfo(servicePath, 'Instances loaded successfully.', null);
            objEvents.emit('EventAfterInit');
        });
    })
    function AfterInitDBListener() {
        var arrRoutes = [];
        var reqPing = require('./routes/Ping');
        var reqSendMessage = require('./routes/SendMessage');
        var reqListTemplate = require('./routes/ListTemplate');
        var reqSaveTemplate = require('./routes/SaveTemplate');
        var reqDeleteTemplate = require('./routes/DeleteTemplate');
        var reqRetryJobs = require('./routes/RetryMessages');
        var reqGetHeaderInfo = require('./routes/ServiceHelper/StartupHelper');
        var reqcommprocessData = require('./routes/GetCommProcessData');
        var reqcommprocessMessage = require('./routes/GetCommProcessMessage');
        var reqcommprocessMessageLog = require('./routes/GetCommProcessMessageLog');
        arrRoutes.push(reqListTemplate);
        arrRoutes.push(reqSaveTemplate);
        arrRoutes.push(reqDeleteTemplate);
        arrRoutes.push(reqPing);
        arrRoutes.push(reqSendMessage);
        arrRoutes.push(reqRetryJobs);
        arrRoutes.push(reqcommprocessData);
        arrRoutes.push(reqcommprocessMessage);
        arrRoutes.push(reqcommprocessMessageLog);
        reqAppHelper.StartService(servicePath, arrRoutes, __dirname);
        reqGetHeaderInfo.GetHeaderInfo(function () {
            reqInstanceHelper.PrintInfo(servicePath, 'All Threads started successfully.', objLogInfo);
        });
    }
}
/******** End of File *******/