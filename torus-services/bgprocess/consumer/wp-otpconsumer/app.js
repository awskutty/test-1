/****
  Descriptions - Node app.js file to start apcp-otp consumer service  
 ****/

// Require dependencies
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var servicePath = 'WP-OTPConsumer';
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
        reqInstanceHelper.PrintWarn(servicePath, 'Worker %d died :(', worker.id, objLogInfo);
        reqCluster.fork();
    });
    // Code to run if we're in a worker process
} else {
    var reqEvents = require('events');
    var reqAppHelper = require('../../../../torus-references/instance/AppHelper');

    var objEvents = new reqEvents();
    objEvents.on('EventAfterInit', AfterInitDBListener);
    process.title = 'Torus_Bg_WP-OTPConsumer';
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
        var reqConsumer = require('./routes/Consumer');
        var topic = 'OTP';
        var group = 'WPOTPGrp';
        var headers = {
            routingkey: 'clt-0~app-0~tnt-0~env-0'
        };
        reqAppHelper.StartConsumer(servicePath, reqConsumer, topic, group, headers);

        // this is for check service running
        var arrRoutes = [];
        var reqPing = require('./routes/Ping');
        arrRoutes.push(reqPing);
        reqAppHelper.StartService(servicePath, arrRoutes, __dirname);
    }
}
/******** End of File **********/