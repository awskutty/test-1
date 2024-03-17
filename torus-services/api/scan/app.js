var reqInstanceHelper = require('../../../torus-references/common/InstanceHelper');
var reqDBInstance = require('../../../torus-references/instance/DBInstance');
var servicePath = 'NodeScan';

// Include the cluster moduless
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

    var objEvents = new reqEvents();
    objEvents.on('EventAfterInit', AfterInitDBListener);
    process.title = 'Torus_Svc_Scan';
    // reqAppHelper.LoadAllInstanses(servicePath, function (pResult) {
    //     if (pResult == 'SUCCESS') {
    //         reqInstanceHelper.PrintInfo(servicePath, 'Instances loaded successfully.', null);
    //         //console.log('INFO : ', reqDateFormat(new Date(), 'yyyy-mm-dd hh:mm:ss'), servicePath, 'Instances loaded successfully.');
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
        var GetScanData = require('./routes/GetScanData');
        var SaveAttachment = require('./routes/SaveAttachment');
        var getATMTDATA = require('./routes/getATMTDATA');

        arrRoutes.push(reqPing);
        arrRoutes.push(GetScanData);
        arrRoutes.push(SaveAttachment);
        arrRoutes.push(getATMTDATA);

        reqAppHelper.StartService(servicePath, arrRoutes, __dirname);
    }
}

if (process.env.NODE_ENV == 'production') {
    console.log = function () { };
}