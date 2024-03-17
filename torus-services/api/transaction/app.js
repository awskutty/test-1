/*
    @Service name       : Transaction,
    @Description        : This is a main file for all api calls in this service,
    @Number of API's    : 6
*/

// Require dependencies
var reqInstanceHelper = require('../../../torus-references/common/InstanceHelper');
var reqDBInstance = require('../../../torus-references/instance/DBInstance');
var servicePath = 'Transaction';

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

    var objEvents = new reqEvents();
    objEvents.on('EventAfterInit', AfterInitDBListener);
    process.title = 'Torus_Svc_Transaction';
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

        var reqDeleteTranComments = require('./routes/DeleteTranComments');
        var reqLoadTranscation = require('./routes/LoadTranscation');
        var reqLoadTranscations = require('./routes/LoadTranscations');
        var reqPing = require('./routes/Ping');
        var reqSaveTranComments = require('./routes/SaveTranComments');
        var reqSaveTransaction = require('./routes/SaveTransaction');
        var reqDFPOSaveTransaction = require('./routes/ext/SaveTransaction');
        var reqDFPOLoadTranscation = require('./routes/ext/LoadTranscation');
        var reqDFPODeleteItem = require('./routes/ext/DeleteItem');

        arrRoutes.push(reqDeleteTranComments);
        arrRoutes.push(reqLoadTranscation);
        arrRoutes.push(reqLoadTranscations);
        arrRoutes.push(reqPing);
        arrRoutes.push(reqSaveTranComments);
        arrRoutes.push(reqSaveTransaction);
        arrRoutes.push(reqDFPOSaveTransaction);
        arrRoutes.push(reqDFPOLoadTranscation);
        arrRoutes.push(reqDFPODeleteItem);

        reqAppHelper.StartService(servicePath, arrRoutes, __dirname);
    }
}
/******** End of File *******/